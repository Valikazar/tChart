import { ChartConfig, ExtendedBarConfig } from '../types';

// Загружаем skia-canvas
let Canvas;
let loadImageFunc;

// Динамически импортируем skia-canvas (работает как в Node.js, так и с полифилом skia-canvas в браузере)
const initCanvas = async () => {
  try {
    if (typeof window === 'undefined') {
      // Node.js
      const skiaCanvas = require('skia-canvas');
      Canvas = skiaCanvas.Canvas;
      loadImageFunc = skiaCanvas.loadImage;
    } else {
      // Браузер с полифилом
      if (!window['skia-canvas']) {
        throw new Error('skia-canvas not available in browser. Make sure to include skia-canvas-browser.js');
      }
      Canvas = window['skia-canvas'].Canvas;
      loadImageFunc = window['skia-canvas'].loadImage;
    }
  } catch (e) {
    console.error('Error loading skia-canvas:', e);
    throw new Error('skia-canvas not found. Please install: npm install skia-canvas');
  }
};

interface ChartData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface TokenInfo {
  marketCap: number;
  priceUsd: number;
  priceChange: {
    '5m': number;
    '1h': number;
    '6h': number;
    '24h': number;
  };
  name?: string;
}

interface RenderChartParams {
  config: ChartConfig;
  data: ChartData[] | any[]; // Поддерживаем разные форматы данных
  tokenInfo?: TokenInfo | null;
  interval?: string;
  width?: number;
  height?: number;
  outputPath?: string; // Путь для сохранения файла (опционально)
  canvas?: any; // Опциональный skia-canvas
  tokenName?: string;
}

interface RenderOutput {
  buffer?: Buffer;
  base64: string;
  canvas?: any;
}

// Вспомогательные функции
function priceToY(price: number | string, height: number, minPrice: number, priceRange: number, topMargin: number, bottomMargin: number): number {
  const safePrice = typeof price === 'string' ? parseFloat(price) : price || 0;
  return height - bottomMargin - ((safePrice - minPrice) / priceRange) * (height - topMargin - bottomMargin);
}

function indexToX(index: number, leftMargin: number, barWidth: number, gap: number): number {
  return leftMargin + index * (barWidth + gap);
}

// Функция предзагрузки изображения
async function preloadImage(url: string): Promise<any> {
  try {
    return await loadImageFunc(url);
  } catch (error) {
    console.error('Error loading image:', error);
    throw error;
  }
}

/**
 * Универсальная функция отрисовки графика использующая только skia-canvas
 * @param params Параметры для рендеринга графика
 * @returns Promise<RenderOutput> Результат рендеринга
 */
export async function renderChart({
  config,
  data,
  tokenInfo,
  interval = 'hour',
  width = 1280,
  height = 1280,
  outputPath,
  canvas: existingCanvas,
  tokenName
}: RenderChartParams): Promise<RenderOutput> {
  // Инициализируем Canvas, если еще не инициализирован
  if (!Canvas) {
    await initCanvas();
  }
  
  // Определяем canvas и контекст
  let canvas;
  let ctx;
  
  if (existingCanvas) {
    // Используем переданный skia-canvas
    canvas = existingCanvas;
    ctx = canvas.getContext('2d');
  } else {
    // Создаем новый canvas
    canvas = new Canvas(width, height);
    ctx = canvas.getContext('2d');
  }

  if (!ctx) throw new Error('Failed to get canvas context');

  // Параметры графика
  const leftMargin = 100;
  const rightMargin = 100;
  const topMargin = 70;
  const bottomMargin = 180;

  const chartLeftMargin = leftMargin / 2;
  const chartRightMargin = rightMargin / 2;

  const totalWidth = canvas.width - chartLeftMargin - chartRightMargin;
  const barWidth = totalWidth / (data.length * 1.15);
  const gap = barWidth * 0.15;

  const baseScaleMultiplier = 8 / (data?.length || 8);
  const scaleRatio = 24 / data.length;

  // Находим минимальную и максимальную цены
  const prices = data.flatMap(d => {
    // Проверяем формат данных
    if (Array.isArray(d)) {
      return [
        typeof d[1] === 'string' ? parseFloat(d[1]) : d[1], // open
        typeof d[2] === 'string' ? parseFloat(d[2]) : d[2], // high
        typeof d[3] === 'string' ? parseFloat(d[3]) : d[3], // low
        typeof d[4] === 'string' ? parseFloat(d[4]) : d[4]  // close
      ];
    } else {
      return [
        typeof d.open === 'string' ? parseFloat(d.open) : d.open,
        typeof d.high === 'string' ? parseFloat(d.high) : d.high,
        typeof d.low === 'string' ? parseFloat(d.low) : d.low,
        typeof d.close === 'string' ? parseFloat(d.close) : d.close
      ];
    }
  });
  const maxPrice = Math.max(...prices);
  const minPrice = Math.min(...prices);
  const priceRange = maxPrice - minPrice;

  // Очищаем canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Отрисовка фона
  if (config.background.image?.url) {
    try {
      const backgroundImg = await preloadImage(config.background.image.url);
      ctx.drawImage(backgroundImg, 0, 0, canvas.width, canvas.height);

      if (config.overlay?.color) {
        ctx.save();
        ctx.fillStyle = config.overlay.color;
        ctx.globalAlpha = config.background.opacity || 0;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
      }
    } catch (error) {
      console.error('Error loading background image:', error);
      ctx.fillStyle = config.background.color || '#000000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  } else {
    ctx.fillStyle = config.background.color || '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // Массив для хранения center изображений
  const centerImages: Array<{
    x: number;
    y: number;
    config: any;
    barWidth: number;
  }> = [];

  // Отрисовка баров
  for (let i = 0; i < data.length; i++) {
    const d = data[i];
    const x = indexToX(i, chartLeftMargin, barWidth, gap);
    
    // Получаем значения в зависимости от формата данных
    const open = Array.isArray(d) ? (typeof d[1] === 'string' ? parseFloat(d[1]) : d[1]) : (typeof d.open === 'string' ? parseFloat(d.open) : d.open);
    const high = Array.isArray(d) ? (typeof d[2] === 'string' ? parseFloat(d[2]) : d[2]) : (typeof d.high === 'string' ? parseFloat(d.high) : d.high);
    const low = Array.isArray(d) ? (typeof d[3] === 'string' ? parseFloat(d[3]) : d[3]) : (typeof d.low === 'string' ? parseFloat(d.low) : d.low);
    const close = Array.isArray(d) ? (typeof d[4] === 'string' ? parseFloat(d[4]) : d[4]) : (typeof d.close === 'string' ? parseFloat(d.close) : d.close);

    const y_open = priceToY(open, canvas.height, minPrice, priceRange, topMargin, bottomMargin);
    const y_close = priceToY(close, canvas.height, minPrice, priceRange, topMargin, bottomMargin);
    const y_high = priceToY(high, canvas.height, minPrice, priceRange, topMargin, bottomMargin);
    const y_low = priceToY(low, canvas.height, minPrice, priceRange, topMargin, bottomMargin);

    const isUpBar = y_close > y_open;
    const barHeight = Math.abs(y_close - y_open);
    const heightThreshold = 300;

    const useCandle = !isUpBar && barHeight > heightThreshold;
    const useKnife = isUpBar && barHeight > heightThreshold;
    const barConfig = useCandle ? config.candle : useKnife ? config.knife : !isUpBar ? config.upBar : config.downBar;

    if (!barConfig) continue;

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
      ctx.beginPath();
      ctx.strokeStyle = barConfig.lineColor || barConfig.color;
      ctx.lineWidth = (barConfig.lineWidth || 1) * baseScaleMultiplier * scaleRatio;
      ctx.moveTo(x + barWidth / 2, y_high);
      ctx.lineTo(x + barWidth / 2, y_low);
      ctx.stroke();
    }

    // Отрисовка тела бара
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, Math.min(y_open, y_close), barWidth, Math.abs(y_close - y_open));
    ctx.clip();

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
            ctx.drawImage(
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
              ctx.drawImage(
                bodyImg,
                0, 0,
                bodyImg.width, bodyImg.height * (remainingHeight / scaledHeight),
                x + (barConfig.body?.offsetX || 0), currentY,
                bodyWidth, remainingHeight
              );
              break;
            } else if (startFrom === 'bottom' && currentY < bodyY) {
              const remainingHeight = scaledHeight - (bodyY - currentY);
              ctx.drawImage(
                bodyImg,
                0, bodyImg.height - (bodyImg.height * (remainingHeight / scaledHeight)),
                bodyImg.width, bodyImg.height * (remainingHeight / scaledHeight),
                x + (barConfig.body?.offsetX || 0), bodyY,
                bodyWidth, remainingHeight
              );
              break;
            }

            ctx.drawImage(
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
        ctx.fillStyle = barConfig.color;
        ctx.fillRect(x, Math.min(y_open, y_close), barWidth, Math.abs(y_close - y_open));
      }
    } else {
      ctx.fillStyle = barConfig.color;
      ctx.fillRect(x, Math.min(y_open, y_close), barWidth, Math.abs(y_close - y_open));
    }

    ctx.restore();

    // Отрисовка границ
    if ((barConfig.borderWidth || 0) > 0) {
      ctx.strokeStyle = barConfig.borderColor || barConfig.color;
      const borderWidth = (barConfig.borderWidth || 1) * baseScaleMultiplier * scaleRatio * 2;
      ctx.lineWidth = borderWidth;
      
      if (barConfig.borderStyle === 'inside') {
        const halfBorder = borderWidth / 2;
        ctx.strokeRect(
          x + halfBorder,
          Math.min(y_open, y_close) + halfBorder,
          barWidth - borderWidth,
          Math.abs(y_close - y_open) - borderWidth
        );
      } else {
        const offset = borderWidth / 2;
        ctx.strokeRect(
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
          
          ctx.drawImage(
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

      ctx.drawImage(
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

  // Отрисовка текста и меток времени
  ctx.font = `${config.font.size}px ${config.font.family}`;
  ctx.fillStyle = config.font.color;
  ctx.textBaseline = 'top';

  // Временные метки
  const timeLabels = Array.from({ length: 5 }, (_, i) => {
    if (i === 4) return 'Now';
    const timestamp = data[0][0] + ((data[data.length - 1][0] - data[0][0]) * i) / 4;
    const timeDiffInSeconds = data[data.length - 1][0] - timestamp;
    const hoursAgo = Math.round(timeDiffInSeconds / 3600);
    return interval === 'day' ? `${Math.round(hoursAgo / 24)}D ago` : `${hoursAgo}h ago`;
  });

  const labelPositions = Array.from({ length: timeLabels.length }, (_, i) => {
    // Добавляем отступ для первой и последней метки, чтобы они не выходили за границы
    if (i === 0) {
      return leftMargin + 10; // Добавляем отступ для первой метки
    } else if (i === timeLabels.length - 1) {
      return canvas.width - rightMargin - 10; // Добавляем отступ для последней метки
    } else {
      return leftMargin + i * (canvas.width - leftMargin - rightMargin) / (timeLabels.length - 1);
    }
  });

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
  ctx.shadowColor = 'black';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;

  // Определяем topOffset для всех элементов
  const topOffset = Math.round(canvas.height * 0.01);

  // Определяем изменения цены
  const changes = tokenInfo
    ? [
        { period: '5M', value: tokenInfo.priceChange['5m'] },
        { period: '1H', value: tokenInfo.priceChange['1h'] },
        { period: '6H', value: tokenInfo.priceChange['6h'] },
        { period: '24H', value: tokenInfo.priceChange['24h'] }
      ]
    : [
        { period: '5M', value: 3.14 },
        { period: '1H', value: -6.66 },
        { period: '6H', value: 0.00 },
        { period: '1D', value: 500.00 }
      ];

  // Отрисовка имени токена и MC
  if (config.display?.showTokenName) {
    const tokenNameText = tokenInfo?.name || tokenName || 'Token';
    ctx.fillText(tokenNameText, leftMargin / 2, topOffset);
    
    if (config.display?.showMarketCap && tokenInfo) {
      const mcText = formatMarketCap(tokenInfo.marketCap);
      const tokenNameWidth = ctx.measureText(tokenNameText).width;
      ctx.fillText(mcText, leftMargin / 2 + tokenNameWidth + 20, topOffset);
    }
  } else if (config.display?.showMarketCap && tokenInfo) {
    const mcText = formatMarketCap(tokenInfo.marketCap);
    ctx.fillText(mcText, leftMargin / 2, topOffset);
  }

  // Отрисовка Price
  if (config.display?.showPrice && tokenInfo) {
    const priceText = `Price: $${tokenInfo.priceUsd.toFixed(8)}`;
    const priceWidth = ctx.measureText(priceText).width;
    // Размещаем текст справа вверху
    ctx.fillText(priceText, canvas.width - (rightMargin / 2) - priceWidth, topOffset);

    // Отрисовка Min/Max если включено
    if (config.display?.showMinMax) {
      const minPrice = Math.min(...data.map(item => Array.isArray(item) ? parseFloat(item[3]) : parseFloat(item.low)));
      const maxPrice = Math.max(...data.map(item => Array.isArray(item) ? parseFloat(item[2]) : parseFloat(item.high)));
      const minMaxText = `Min/max: $${minPrice.toFixed(6)} / $${maxPrice.toFixed(7)}`;
      ctx.font = `${config.font.size * 0.8}px ${config.font.family}`;
      // Размещаем текст Min/Max под текстом Price
      const minMaxWidth = ctx.measureText(minMaxText).width;
      ctx.fillText(minMaxText, canvas.width - (rightMargin / 2) - minMaxWidth, topOffset + config.font.size * 1.2);
      ctx.font = `${config.font.size}px ${config.font.family}`; // Восстанавливаем исходный размер шрифта
    }
  }

  // Сбрасываем тень
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  // Отрисовка временных меток
  if (config.display?.showTimeline) {
    timeLabels.forEach((label, i) => {
      const textWidth = ctx.measureText(label).width;
      const yPosition = config.display?.showPriceChange 
        ? canvas.height - bottomMargin + 50  // Если Price Change активен, рисуем над линией
        : canvas.height - bottomMargin + 110; // Если Price Change неактивен, рисуем внизу
      
      // Рассчитываем позицию X с учетом выхода за границы
      let xPosition = labelPositions[i] - textWidth / 2;
      
      // Проверяем, не выходит ли текст за левую границу
      if (xPosition < leftMargin / 2) {
        xPosition = leftMargin / 2;
      }
      
      // Проверяем, не выходит ли текст за правую границу
      if (xPosition + textWidth > canvas.width - rightMargin / 2) {
        xPosition = canvas.width - rightMargin / 2 - textWidth;
      }
      
      // Добавляем усиленную тень для лучшей читаемости
      ctx.save();
      ctx.shadowColor = 'black';
      ctx.shadowBlur = 6;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;
      
      // Сам текст временных меток
      ctx.fillStyle = config.font.color;
      ctx.fillText(label, xPosition, yPosition);
      ctx.restore();
    });
  }

  // Отрисовка разделительной линии только если активны оба элемента
  if (config.display?.showTimeline && config.display?.showPriceChange) {
    ctx.strokeStyle = 'yellow';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(leftMargin / 2, canvas.height - bottomMargin + 97);
    ctx.lineTo(canvas.width - rightMargin / 2, canvas.height - bottomMargin + 97);
    ctx.stroke();
  }

  // Отрисовка изменений цены - делаем это в последнюю очередь, чтобы оно всегда было поверх всего
  if (config.display?.showPriceChange) {
    const changeWidth = (canvas.width - leftMargin / 2 - rightMargin / 2) / changes.length;
    
    // Отрисовка текста price change с тенями вместо фона
    changes.forEach((change, i) => {
      const x = leftMargin / 2 + i * changeWidth + changeWidth / 2;
      const text = `${change.period}: ${change.value >= 0 ? '+' : ''}${change.value.toFixed(2)}%`;
      const textWidth = ctx.measureText(text).width;
      
      // Рассчитываем позицию X с учетом выхода за границы
      let xPosition = x - textWidth / 2;
      
      // Проверяем, не выходит ли текст за левую границу
      if (xPosition < leftMargin / 2) {
        xPosition = leftMargin / 2;
      }
      
      // Проверяем, не выходит ли текст за правую границу
      if (xPosition + textWidth > canvas.width - rightMargin / 2) {
        xPosition = canvas.width - rightMargin / 2 - textWidth;
      }
      
      // Добавляем усиленную тень для лучшей читаемости
      ctx.save();
      ctx.shadowColor = 'black';
      ctx.shadowBlur = 6;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;
      
      // Отрисовываем текст изменения цены
      ctx.fillStyle = change.value > 0 ? config.upBar.color : change.value < 0 ? config.downBar.color : 'yellow';
      ctx.fillText(text, xPosition, canvas.height - bottomMargin + 110);
      ctx.restore();
    });
  }

  // Получаем результаты рендеринга
  let base64 = canvas.toDataURL('image/png');

  // Адаптируем результат в зависимости от окружения
  const isNodeEnvironment = typeof window === 'undefined';
  
  if (isNodeEnvironment && outputPath) {
    const fs = require('fs');
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(outputPath, buffer);
    return { buffer, base64, canvas };
  }
  
  // Возвращаем результат
  return { 
    buffer: isNodeEnvironment ? canvas.toBuffer('image/png') : undefined,
    base64,
    canvas 
  };
} 

// Экспортируем демо-данные для preview
export const DEMO_DATA = Array.from({ length: 24 }, (_, i) => {
  const timestamp = Math.floor(Date.now() / 1000) - (24 - i) * 3600;
  const basePrice = 0.00000450;
  const volatility = 0.00000050;
  const open = basePrice + (Math.random() - 0.5) * volatility;
  const close = basePrice + (Math.random() - 0.5) * volatility;
  const high = Math.max(open, close) + Math.random() * volatility * 0.5;
  const low = Math.min(open, close) - Math.random() * volatility * 0.5;
  return [timestamp, open, high, low, close];
});

// Экспортируем демо-данные для информации о токене
export const DEMO_TOKEN_INFO = {
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