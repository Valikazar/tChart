import React, { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { ChartConfig, ExtendedBarConfig } from '../types';
import { renderChart } from '../utils/chartRendererUniversal';

// Кэш для изображений
const imageCache = new Map<string, HTMLImageElement>();

// Демо-данные для превью
const DEMO_DATA = Array.from({ length: 24 }, (_, i) => {
  const timestamp = Math.floor(Date.now() / 1000) - (24 - i) * 3600;
  const basePrice = 0.00000450;
  const volatility = 0.00000050;
  const open = basePrice + (Math.random() - 0.5) * volatility;
  const close = basePrice + (Math.random() - 0.5) * volatility;
  const high = Math.max(open, close) + Math.random() * volatility * 0.5;
  const low = Math.min(open, close) - Math.random() * volatility * 0.5;
  return [timestamp, open, high, low, close];
});

// Демо-данные для информации о токене
const DEMO_TOKEN_INFO = {
  priceUsd: 0.00000450,
  marketCap: 999000,
  priceChange: {
    '5m': 3.14,
    '1h': -6.66,
    '6h': 0.00,
    '24h': 15.75,
  },
  name: 'Demo Token'
};

// Функция для предзагрузки изображения
const preloadImage = (url: string): Promise<HTMLImageElement> => {
  if (imageCache.has(url)) {
    return Promise.resolve(imageCache.get(url)!);
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      imageCache.set(url, img);
      resolve(img);
    };
    img.onerror = reject;
    img.src = url;
  });
};

interface ChartPreviewProps {
  config: ChartConfig;
  data?: any[];
  tokenInfo?: {
    priceUsd: number;
    marketCap: number;
    priceChange: {
      '5m': number;
      '1h': number;
      '6h': number;
      '24h': number;
    };
    name?: string;
  } | null;
  interval?: string;
  width?: number;
  height?: number;
  id?: string;
  tokenName?: string;
  isPreview?: boolean;
}

/**
 * Компонент для отображения графика криптовалюты
 */
const ChartPreview: React.FC<ChartPreviewProps> = ({
  config,
  data,
  tokenInfo,
  interval = 'hour',
  width = 1280,
  height = 1280,
  id = 'chart-canvas',
  tokenName,
  isPreview = false
}) => {
  // Используем демо данные для превью или если не переданы реальные данные
  const chartData = useMemo(() => (isPreview || !data || data.length === 0) ? DEMO_DATA : data, [data, isPreview]);
  const chartTokenInfo = useMemo(() => (isPreview || !tokenInfo) ? DEMO_TOKEN_INFO : tokenInfo, [tokenInfo, isPreview]);
  
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const bufferCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number>();
  const isDrawingRef = useRef(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Мемоизируем функции для предотвращения ненужных перерисовок
  const priceToY = useCallback((price: number | string, height: number, minPrice: number, priceRange: number, topMargin: number, bottomMargin: number) => {
    const safePrice = typeof price === 'string' ? parseFloat(price) : price || 0;
    return height - bottomMargin - ((safePrice - minPrice) / priceRange) * (height - topMargin - bottomMargin);
  }, []);

  const indexToX = useCallback((i: number, chartLeftMargin: number, barWidth: number, gap: number) => {
    return chartLeftMargin + i * (barWidth + gap);
  }, []);

  // Создаем буферный канвас при монтировании компонента
  useEffect(() => {
    bufferCanvasRef.current = document.createElement('canvas');
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Основная функция отрисовки
  const drawChart = useCallback(async () => {
    const canvas = canvasRef.current;
    const bufferCanvas = bufferCanvasRef.current;
    if (!canvas || !bufferCanvas || !chartData || chartData.length === 0 || isDrawingRef.current) return;

    isDrawingRef.current = true;

    try {
      const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
      const bufferCtx = bufferCanvas.getContext('2d') as CanvasRenderingContext2D;
      if (!ctx || !bufferCtx) return;

      // Устанавливаем размеры буферного канваса
      bufferCanvas.width = canvas.width;
      bufferCanvas.height = canvas.height;

      // Параметры графика
      const leftMargin = 100;
      const rightMargin = 100;
      const topMargin = 70;
      const bottomMargin = 180;

      const chartLeftMargin = leftMargin / 2;
      const chartRightMargin = rightMargin / 2;

      const totalWidth = canvas.width - chartLeftMargin - chartRightMargin;
      const barWidth = totalWidth / (chartData.length * 1.15);
      const gap = barWidth * 0.15;

      const baseScaleMultiplier = 8 / (chartData?.length || 8);
      const scaleRatio = 24 / chartData.length;

      // Находим минимальную и максимальную цены
      const prices = chartData.flatMap(([_, o, h, l, c]) => [
        typeof o === 'string' ? parseFloat(o) : o || 0,
        typeof h === 'string' ? parseFloat(h) : h || 0,
        typeof l === 'string' ? parseFloat(l) : l || 0,
        typeof c === 'string' ? parseFloat(c) : c || 0
      ]);
      const maxPrice = Math.max(...prices);
      const minPrice = Math.min(...prices);
      const priceRange = maxPrice - minPrice;

      // Очищаем буферный канвас
      bufferCtx.clearRect(0, 0, bufferCanvas.width, bufferCanvas.height);

      // Отрисовка фона
      if (config.background.image?.url) {
        try {
          const backgroundImg = await preloadImage(config.background.image.url);
          bufferCtx.drawImage(backgroundImg, 0, 0, bufferCanvas.width, bufferCanvas.height);

          if (config.overlay?.color) {
            bufferCtx.save();
            bufferCtx.fillStyle = config.overlay.color;
            bufferCtx.globalAlpha = config.background.opacity || 0;
            bufferCtx.fillRect(0, 0, bufferCanvas.width, bufferCanvas.height);
            bufferCtx.restore();
          }
        } catch (error) {
          console.error('Error loading background image:', error);
        }
      } else {
        bufferCtx.fillStyle = config.background.color || '#000000';
        bufferCtx.fillRect(0, 0, bufferCanvas.width, bufferCanvas.height);
      }

      // Отрисовка баров
      const drawBars = async () => {
        // Массив для хранения center изображений
        const centerImages: Array<{
          x: number;
          y: number;
          config: any;
          barWidth: number;
        }> = [];

        for (let i = 0; i < chartData.length; i++) {
          const [timestamp, open, high, low, close] = chartData[i];
          const x = indexToX(i, chartLeftMargin, barWidth, gap);
          const y_open = priceToY(open, bufferCanvas.height, minPrice, priceRange, topMargin, bottomMargin);
          const y_close = priceToY(close, bufferCanvas.height, minPrice, priceRange, topMargin, bottomMargin);
          const y_high = priceToY(high, bufferCanvas.height, minPrice, priceRange, topMargin, bottomMargin);
          const y_low = priceToY(low, bufferCanvas.height, minPrice, priceRange, topMargin, bottomMargin);

          const isUpBar = y_close > y_open;
          const barHeight = Math.abs(y_close - y_open);
          const heightThreshold = 300;

          const useCandle = !isUpBar && barHeight > heightThreshold;
          const useKnife = isUpBar && barHeight > heightThreshold;
          const barConfig = useCandle ? config.candle : useKnife ? config.knife : !isUpBar ? config.upBar : config.downBar;

          // Добавляем center изображение в массив для последующей отрисовки
          if ((useCandle || useKnife) && (barConfig as ExtendedBarConfig).center?.url) {
            centerImages.push({
              x,
              y: (y_open + y_close) / 2,
              config: (barConfig as ExtendedBarConfig).center,
              barWidth
            });
          }

          // Отрисовка линии high/low
          if ((barConfig.lineWidth || 0) > 0) {
            bufferCtx.beginPath();
            bufferCtx.strokeStyle = barConfig.lineColor || barConfig.color;
            bufferCtx.lineWidth = (barConfig.lineWidth || 1) * baseScaleMultiplier * scaleRatio;
            bufferCtx.moveTo(x + barWidth / 2, y_high);
            bufferCtx.lineTo(x + barWidth / 2, y_low);
            bufferCtx.stroke();
          }

          // Отрисовка тела бара
          bufferCtx.save();
          bufferCtx.beginPath();
          bufferCtx.rect(x, Math.min(y_open, y_close), barWidth, Math.abs(y_close - y_open));
          bufferCtx.clip();

          if (barConfig.body?.url) {
            try {
              const bodyImg = await preloadImage(barConfig.body.url);
              const bodyHeight = Math.max(1, Math.abs(barHeight));
              const bodyWidth = Math.max(1, barWidth);
              const bodyY = Math.min(y_open, y_close);
              const scale = barConfig.body?.scale || 1;
              const imgRatio = (bodyImg.width / bodyImg.height) * scale;
              const scaledWidth = bodyWidth;
              const scaledHeight = bodyWidth / imgRatio;
              const startFrom = barConfig.body?.startFrom || 'top';

              if (startFrom === 'fill') {
                const tileHeight = scaledHeight * 0.98; // 2% перекрытие
                const numTiles = Math.max(1, Math.ceil(bodyHeight / tileHeight));
                const adjustedTileHeight = bodyHeight / numTiles + (scaledHeight * 0.02);

                for (let j = 0; j < numTiles; j++) {
                  bufferCtx.drawImage(
                    bodyImg,
                    x + (barConfig.body?.offsetX || 0),
                    bodyY + j * (adjustedTileHeight - scaledHeight * 0.02),
                    bodyWidth,
                    adjustedTileHeight
                  );
                }
              } else {
                const repetitions = Math.ceil(bodyHeight / (scaledHeight * 0.98)) + 1;
                let currentY = startFrom === 'top' ? bodyY : bodyY + bodyHeight - scaledHeight;

                for (let j = 0; j < repetitions; j++) {
                  if (startFrom === 'top' && currentY + scaledHeight > bodyY + bodyHeight) {
                    const remainingHeight = bodyY + bodyHeight - currentY;
                    bufferCtx.drawImage(
                      bodyImg,
                      0, 0,
                      bodyImg.width, bodyImg.height * (remainingHeight / scaledHeight),
                      x + (barConfig.body?.offsetX || 0), currentY,
                      bodyWidth, remainingHeight
                    );
                    break;
                  } else if (startFrom === 'bottom' && currentY < bodyY) {
                    const remainingHeight = scaledHeight - (bodyY - currentY);
                    bufferCtx.drawImage(
                      bodyImg,
                      0, bodyImg.height - (bodyImg.height * (remainingHeight / scaledHeight)),
                      bodyImg.width, bodyImg.height * (remainingHeight / scaledHeight),
                      x + (barConfig.body?.offsetX || 0), bodyY,
                      bodyWidth, remainingHeight
                    );
                    break;
                  }

                  bufferCtx.drawImage(
                    bodyImg,
                    x + (barConfig.body?.offsetX || 0),
                    currentY,
                    bodyWidth,
                    scaledHeight
                  );

                  currentY += startFrom === 'top' ? (scaledHeight * 0.98) : -(scaledHeight * 0.98);
                }
              }
            } catch (error) {
              console.error('Error loading body image:', error);
              bufferCtx.fillStyle = barConfig.color;
              bufferCtx.fillRect(x, Math.min(y_open, y_close), barWidth, Math.abs(y_close - y_open));
            }
          } else {
            bufferCtx.fillStyle = barConfig.color;
            bufferCtx.fillRect(x, Math.min(y_open, y_close), barWidth, Math.abs(y_close - y_open));
          }

          bufferCtx.restore();

          // Отрисовка границ
          if ((barConfig.borderWidth || 0) > 0) {
            bufferCtx.strokeStyle = barConfig.borderColor || barConfig.color;
            const borderWidth = (barConfig.borderWidth || 1) * baseScaleMultiplier * scaleRatio * 2;
            bufferCtx.lineWidth = borderWidth;
            
            if (barConfig.borderStyle === 'inside') {
              const halfBorder = borderWidth / 2;
              bufferCtx.strokeRect(
                x + halfBorder,
                Math.min(y_open, y_close) + halfBorder,
                barWidth - borderWidth,
                Math.abs(y_close - y_open) - borderWidth
              );
            } else {
              const offset = borderWidth / 2;
              bufferCtx.strokeRect(
                x - offset,
                Math.min(y_open, y_close) - offset,
                barWidth + borderWidth,
                Math.abs(y_close - y_open) + borderWidth
              );
            }
          }

          // Отрисовка top и bottom изображений
          for (const part of ['top', 'bottom'] as const) {
            const imgConfig = barConfig[part];
            if (imgConfig?.url) {
              try {
                const img = await preloadImage(imgConfig.url);
                const scale = (imgConfig.scale || 1) * baseScaleMultiplier;
                const offsetX = (imgConfig.offsetX || 0) * baseScaleMultiplier;
                const offsetY = (imgConfig.offsetY || 0) * baseScaleMultiplier;
                const scaledWidth = img.width * scale;
                const scaledHeight = img.height * scale;
                
                bufferCtx.drawImage(
                  img,
                  x + (barWidth - scaledWidth) / 2 + offsetX,
                  part === 'top' ? Math.min(y_open, y_close) - scaledHeight + offsetY : Math.max(y_open, y_close) + offsetY,
                  scaledWidth,
                  scaledHeight
                );
              } catch (error) {
                console.error(`Error loading ${part} image:`, error);
              }
            }
          }
        }

        // Отрисовываем center изображения поверх всех баров
        for (const { x, y, config: imgConfig, barWidth } of centerImages) {
          try {
            const img = await preloadImage(imgConfig.url);
            const scale = (imgConfig.scale || 1) * baseScaleMultiplier;
            const offsetX = (imgConfig.offsetX || 0) * baseScaleMultiplier;
            const offsetY = (imgConfig.offsetY || 0) * baseScaleMultiplier;
            const scaledWidth = img.width * scale;
            const scaledHeight = img.height * scale;

            bufferCtx.drawImage(
              img,
              x + (barWidth - scaledWidth) / 2 + offsetX,
              y - scaledHeight / 2 + offsetY,
              scaledWidth,
              scaledHeight
            );
          } catch (error) {
            console.error('Error loading center image:', error);
          }
        }
      };

      await drawBars();

      // Отрисовка текста и меток времени
      bufferCtx.font = `${config.font.size}px ${config.font.family}`;
      bufferCtx.fillStyle = config.font.color;
      bufferCtx.textBaseline = 'top';

      // Временные метки
      const timeLabels = Array.from({ length: 5 }, (_, i) => {
        if (i === 4) return 'Now';
        const timestamp = chartData[0][0] + ((chartData[chartData.length - 1][0] - chartData[0][0]) * i) / 4;
        const timeDiffInSeconds = chartData[chartData.length - 1][0] - timestamp;
        const hoursAgo = Math.round(timeDiffInSeconds / 3600);
        return interval === 'day' ? `${Math.round(hoursAgo / 24)}D ago` : `${hoursAgo}h ago`;
      });

      const labelPositions = Array.from({ length: timeLabels.length }, (_, i) => {
        // Добавляем отступ для первой и последней метки, чтобы они не выходили за границы
        if (i === 0) {
          return leftMargin + 10; // Добавляем отступ для первой метки
        } else if (i === timeLabels.length - 1) {
          return bufferCanvas.width - rightMargin - 10; // Добавляем отступ для последней метки
        } else {
          return leftMargin + i * (bufferCanvas.width - leftMargin - rightMargin) / (timeLabels.length - 1);
        }
      });

      // Отрисовка MC и Price
      bufferCtx.font = `${config.font.size}px ${config.font.family}`;
      bufferCtx.fillStyle = config.font.color;
      bufferCtx.textBaseline = 'top';

      // Форматируем market cap
      const formatMarketCap = (value: number) => {
        if (value >= 1e9) {
          return `MC: $${(value / 1e9).toFixed(2)}B`;
        } else if (value >= 1e6) {
          return `MC: $${(value / 1e6).toFixed(2)}M`;
        } else if (value >= 1e3) {
          return `MC: $${(value / 1e3).toFixed(2)}K`;
        } else {
          return `MC: $${value.toFixed(2)}`;
        }
      };

      // Добавляем тень для текста
      bufferCtx.shadowColor = 'black';
      bufferCtx.shadowBlur = 4;
      bufferCtx.shadowOffsetX = 2;
      bufferCtx.shadowOffsetY = 2;

      // Определяем topOffset для всех элементов
      const topOffset = Math.round(bufferCanvas.height * 0.01);

      // Определяем изменения цены
      const changes = [
        { period: '5M', value: chartTokenInfo.priceChange['5m'] },
        { period: '1H', value: chartTokenInfo.priceChange['1h'] },
        { period: '6H', value: chartTokenInfo.priceChange['6h'] },
        { period: '24H', value: chartTokenInfo.priceChange['24h'] }
      ];

      // Отрисовка имени токена и MC
      if (config.display.showTokenName) {
        const tokenNameText = chartTokenInfo?.name || tokenName || 'Token';
        bufferCtx.fillText(tokenNameText, leftMargin / 2, topOffset);
        
        if (config.display.showMarketCap) {
          const mcText = formatMarketCap(chartTokenInfo.marketCap);
          const tokenNameWidth = bufferCtx.measureText(tokenNameText).width;
          bufferCtx.fillText(mcText, leftMargin / 2 + tokenNameWidth + 20, topOffset);
        }
      } else if (config.display.showMarketCap) {
        const mcText = formatMarketCap(chartTokenInfo.marketCap);
        bufferCtx.fillText(mcText, leftMargin / 2, topOffset);
      }

      // Отрисовка Price
      if (config.display.showPrice) {
        const priceText = `Price: $${chartTokenInfo.priceUsd.toFixed(8)}`;
        const priceWidth = bufferCtx.measureText(priceText).width;
        // Размещаем текст справа вверху
        bufferCtx.fillText(priceText, bufferCanvas.width - (rightMargin / 2) - priceWidth, topOffset);

        // Отрисовка Min/Max если включено
        if (config.display.showMinMax) {
          const minPrice = Math.min(...chartData.map(item => parseFloat(item[3])));
          const maxPrice = Math.max(...chartData.map(item => parseFloat(item[2])));
          const minMaxText = `Min/max: $${minPrice.toFixed(6)} / $${maxPrice.toFixed(7)}`;
          bufferCtx.font = `${config.font.size * 0.8}px ${config.font.family}`;
          // Размещаем текст Min/Max под текстом Price
          const minMaxWidth = bufferCtx.measureText(minMaxText).width;
          bufferCtx.fillText(minMaxText, bufferCanvas.width - (rightMargin / 2) - minMaxWidth, topOffset + config.font.size * 1.2);
          bufferCtx.font = `${config.font.size}px ${config.font.family}`; // Восстанавливаем исходный размер шрифта
        }
      }

      // Сбрасываем тень
      bufferCtx.shadowColor = 'transparent';
      bufferCtx.shadowBlur = 0;
      bufferCtx.shadowOffsetX = 0;
      bufferCtx.shadowOffsetY = 0;

      // Отрисовка временных меток
      if (config.display.showTimeline) {
        timeLabels.forEach((label, i) => {
          const textWidth = bufferCtx.measureText(label).width;
          const yPosition = config.display.showPriceChange 
            ? bufferCanvas.height - bottomMargin + 50  // Если Price Change активен, рисуем над линией
            : bufferCanvas.height - bottomMargin + 110; // Если Price Change неактивен, рисуем внизу
          
          // Рассчитываем позицию X с учетом выхода за границы
          let xPosition = labelPositions[i] - textWidth / 2;
          
          // Проверяем, не выходит ли текст за левую границу
          if (xPosition < leftMargin / 2) {
            xPosition = leftMargin / 2;
          }
          
          // Проверяем, не выходит ли текст за правую границу
          if (xPosition + textWidth > bufferCanvas.width - rightMargin / 2) {
            xPosition = bufferCanvas.width - rightMargin / 2 - textWidth;
          }
          
          // Добавляем усиленную тень для лучшей читаемости
          bufferCtx.save();
          bufferCtx.shadowColor = 'black';
          bufferCtx.shadowBlur = 6;
          bufferCtx.shadowOffsetX = 2;
          bufferCtx.shadowOffsetY = 2;
          
          // Сам текст временных меток
          bufferCtx.fillStyle = config.font.color;
          bufferCtx.fillText(label, xPosition, yPosition);
          bufferCtx.restore();
        });
      }

      // Отрисовка разделительной линии только если активны оба элемента
      if (config.display.showTimeline && config.display.showPriceChange) {
        bufferCtx.strokeStyle = 'yellow';
        bufferCtx.lineWidth = 2;
        bufferCtx.beginPath();
        bufferCtx.moveTo(leftMargin / 2, bufferCanvas.height - bottomMargin + 97);
        bufferCtx.lineTo(bufferCanvas.width - rightMargin / 2, bufferCanvas.height - bottomMargin + 97);
        bufferCtx.stroke();
      }

      // Отрисовка изменений цены - делаем это в последнюю очередь, чтобы оно всегда было поверх всего
      if (config.display.showPriceChange) {
        const changeWidth = (bufferCanvas.width - leftMargin / 2 - rightMargin / 2) / changes.length;
        
        // Отрисовка текста price change с тенями вместо фона
        changes.forEach((change, i) => {
          const x = leftMargin / 2 + i * changeWidth + changeWidth / 2;
          const text = `${change.period}: ${change.value >= 0 ? '+' : ''}${change.value.toFixed(2)}%`;
          const textWidth = bufferCtx.measureText(text).width;
          
          // Рассчитываем позицию X с учетом выхода за границы
          let xPosition = x - textWidth / 2;
          
          // Проверяем, не выходит ли текст за левую границу
          if (xPosition < leftMargin / 2) {
            xPosition = leftMargin / 2;
          }
          
          // Проверяем, не выходит ли текст за правую границу
          if (xPosition + textWidth > bufferCanvas.width - rightMargin / 2) {
            xPosition = bufferCanvas.width - rightMargin / 2 - textWidth;
          }
          
          // Добавляем усиленную тень для лучшей читаемости
          bufferCtx.save();
          bufferCtx.shadowColor = 'black';
          bufferCtx.shadowBlur = 6;
          bufferCtx.shadowOffsetX = 2;
          bufferCtx.shadowOffsetY = 2;
          
          // Отрисовываем текст изменения цены
          bufferCtx.fillStyle = change.value > 0 ? config.upBar.color : change.value < 0 ? config.downBar.color : 'yellow';
          bufferCtx.fillText(text, xPosition, bufferCanvas.height - bottomMargin + 110);
          bufferCtx.restore();
        });
      }

      // Копируем содержимое буферного канваса на основной
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bufferCanvas, 0, 0);

    } finally {
      isDrawingRef.current = false;
    }
  }, [chartData, config, chartTokenInfo, interval, indexToX, priceToY, tokenName]);

  // Запускаем отрисовку при изменении данных
  useEffect(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    animationFrameRef.current = requestAnimationFrame(drawChart);
  }, [drawChart]);

  useEffect(() => {
    // Если нет данных и не превью, не рисуем график
    if (!isPreview && (!data || data.length === 0)) {
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    
    // Вызываем отрисовку через requestAnimationFrame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    animationFrameRef.current = requestAnimationFrame(() => {
      drawChart().then(() => {
        setIsLoading(false);
      }).catch(err => {
        console.error('Error rendering chart:', err);
        setError(err instanceof Error ? err.message : 'Error rendering chart');
        setIsLoading(false);
      });
    });
    
  }, [config, data, tokenInfo, interval, width, height, drawChart, isPreview]);

  return (
    <Box className="chart-preview">
      {error && <div className="error">Error: {error}</div>}
      <canvas
        ref={canvasRef}
        id={id}
        width={width}
        height={height}
        style={{ 
          display: 'block',
          maxWidth: '100%',
          height: 'auto',
          opacity: isLoading ? 0 : 1,
          transition: 'opacity 0.3s ease-in-out'
        }}
      />
      {!isPreview && chartTokenInfo && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle1" gutterBottom>
            Token Info:
          </Typography>
          <Typography>
            Price: ${chartTokenInfo.priceUsd.toFixed(8)}
          </Typography>
          <Typography>
            Market Cap: ${chartTokenInfo.marketCap.toLocaleString()}
          </Typography>
          <Typography>
            Price Changes:
          </Typography>
          <Box sx={{ pl: 2 }}>
            <Typography>5m: {chartTokenInfo.priceChange['5m']}%</Typography>
            <Typography>1h: {chartTokenInfo.priceChange['1h']}%</Typography>
            <Typography>6h: {chartTokenInfo.priceChange['6h']}%</Typography>
            <Typography>24h: {chartTokenInfo.priceChange['24h']}%</Typography>
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default ChartPreview; 