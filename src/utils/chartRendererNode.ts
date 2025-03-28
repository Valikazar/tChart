import { ChartConfig } from '../types';
// Используем функциональность для определения среды выполнения (браузер/node)
const isNodeEnvironment = typeof window === 'undefined';

// Импортируем canvas в зависимости от среды
let Canvas;
let loadImageFunc;

// В среде Node.js используем skia-canvas
if (isNodeEnvironment) {
  try {
    // Требуется установить: npm install skia-canvas
    const skiaCanvas = require('skia-canvas');
    Canvas = skiaCanvas.Canvas;
    loadImageFunc = skiaCanvas.loadImage;
  } catch (e) {
    console.error('Ошибка загрузки skia-canvas:', e);
    console.error('Пожалуйста, установите skia-canvas: npm install skia-canvas');
  }
} 

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
  name: string;
}

interface RenderChartParams {
  config: ChartConfig;
  data: ChartData[] | any[]; // Поддерживаем разные форматы данных
  tokenInfo?: TokenInfo;
  interval?: string;
  width?: number;
  height?: number;
  outputPath?: string; // Путь для сохранения файла (опционально)
  canvas?: HTMLCanvasElement | OffscreenCanvas; // Опциональный canvas из браузера
}

interface RenderOutput {
  buffer?: Buffer;
  base64: string;
  canvas?: any;
}

// Вспомогательные функции
function priceToY(price: number, height: number, minPrice: number, priceRange: number, topMargin: number, bottomMargin: number): number {
  return height - bottomMargin - ((price - minPrice) / priceRange) * (height - topMargin - bottomMargin);
}

function indexToX(index: number, leftMargin: number, barWidth: number, gap: number): number {
  return leftMargin + index * (barWidth + gap);
}

// Функция предзагрузки изображения в Node.js
async function preloadImageNode(url: string): Promise<any> {
  try {
    // Поддержка как локальных файлов, так и URL
    return await loadImageFunc(url);
  } catch (error) {
    console.error('Ошибка загрузки изображения:', error);
    throw error;
  }
}

// Функция предзагрузки изображения в браузере
async function preloadImageBrowser(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.crossOrigin = 'anonymous'; // Для CORS
    img.src = url;
  });
}

/**
 * Универсальная функция отрисовки графика для Node.js и браузера
 * @param params Параметры для рендеринга графика
 * @returns Promise<RenderOutput> Результат рендеринга (зависит от среды)
 */
export async function renderChart({
  config,
  data,
  tokenInfo,
  interval = 'hour',
  width = 1280,
  height = 1280,
  outputPath,
  canvas: existingCanvas
}: RenderChartParams): Promise<RenderOutput> {
  // Определяем среду и подготавливаем canvas и контекст
  let canvas;
  let ctx;
  
  if (existingCanvas) {
    // Используем переданный canvas (для браузера)
    canvas = existingCanvas;
    ctx = canvas.getContext('2d');
  } else if (isNodeEnvironment) {
    // В Node.js создаем новый canvas с помощью skia-canvas
    if (!Canvas) {
      throw new Error('skia-canvas не найден. Пожалуйста, установите: npm install skia-canvas');
    }
    canvas = new Canvas(width, height);
    ctx = canvas.getContext('2d');
  } else {
    // В браузере создаем HTML5 canvas
    canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    ctx = canvas.getContext('2d');
  }

  if (!ctx) throw new Error('Failed to get canvas context');

  // Параметры графика
  const leftMargin = 120;
  const rightMargin = 120;
  const topMargin = 100;
  const bottomMargin = 200;

  const chartLeftMargin = leftMargin / 2;
  const chartRightMargin = rightMargin / 2;

  const totalWidth = canvas.width - chartLeftMargin - chartRightMargin;
  const barWidth = totalWidth / (data.length * 1.15);
  const gap = barWidth * 0.15;

  const baseScaleMultiplier = 8 / (data?.length || 8);
  const scaleRatio = tokenInfo ? (24 / data.length) : 1;

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
      const backgroundImg = isNodeEnvironment 
        ? await preloadImageNode(config.background.image.url)
        : await preloadImageBrowser(config.background.image.url);
      
      ctx.drawImage(backgroundImg, 0, 0, canvas.width, canvas.height);

      // Проверяем наличие свойства opacity с учетом возможного отсутствия
      const opacity = config.background.image['opacity' as keyof typeof config.background.image];
      
      if (opacity !== undefined) {
        ctx.save();
        ctx.fillStyle = config.background.color || '#000000';
        ctx.globalAlpha = 1 - (opacity as number);
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
      }
      
      // Проверяем наличие overlay
      if (config.overlay?.color) {
        ctx.save();
        ctx.fillStyle = config.overlay.color;
        // Используем opacity из overlay, или из config.background если не указано
        const overlayOpacity = (config.overlay as any).opacity !== undefined 
          ? (config.overlay as any).opacity 
          : ((config.background as any).opacity || 0.3);
        ctx.globalAlpha = overlayOpacity;
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
        const bodyImg = isNodeEnvironment
          ? await preloadImageNode(barConfig.body.url)
          : await preloadImageBrowser(barConfig.body.url);
          
        const bodyHeight = Math.max(1, Math.abs(barHeight));
        const bodyWidth = Math.max(1, barWidth);
        const bodyY = Math.min(y_open, y_close);
        const scale = barConfig.body?.scale || 1;
        const imgRatio = (bodyImg.width / bodyImg.height) * scale;
        const scaledWidth = bodyWidth;
        const scaledHeight = bodyWidth / imgRatio;
        const startFrom = barConfig.body?.startFrom || 'top';

        if (startFrom === 'fill') {
          const tileHeight = scaledHeight * 0.98;
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
  }

  // Отрисовка текста и меток
  ctx.font = `${config.font.size}px ${config.font.family}`;
  ctx.fillStyle = config.font.color;
  ctx.textBaseline = 'top';

  // Добавляем тень для текста
  ctx.shadowColor = 'black';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;

  // Определяем topOffset для всех элементов
  const topOffset = Math.round(canvas.height * 0.02);

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

  // Временные метки
  const timeLabels = tokenInfo
    ? Array.from({ length: 5 }, (_, i) => {
        if (i === 4) return 'Now';
        const timestamp = data[0].timestamp + ((data[data.length - 1].timestamp - data[0].timestamp) * i) / 4;
        const timeDiffInSeconds = data[data.length - 1].timestamp - timestamp;
        const hoursAgo = Math.round(timeDiffInSeconds / 3600);
        return interval === 'day' ? `${Math.round(hoursAgo / 24)}D ago` : `${hoursAgo}h ago`;
      })
    : ['24h ago', '16h ago', '10h ago', '6h ago', 'Now'];

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

  // Отрисовка имени токена и MC
  if (config.display.showTokenName) {
    const tokenNameText = tokenInfo?.name || 'Tryan';
    ctx.fillText(tokenNameText, leftMargin / 2, topOffset);
    
    if (config.display.showMarketCap) {
      const mcText = tokenInfo 
        ? formatMarketCap(tokenInfo.marketCap)
        : 'MC: 999K';
      const tokenNameWidth = ctx.measureText(tokenNameText).width;
      ctx.fillText(mcText, leftMargin / 2 + tokenNameWidth + 20, topOffset);
    }
  } else if (config.display.showMarketCap) {
    const mcText = tokenInfo 
      ? formatMarketCap(tokenInfo.marketCap)
      : 'MC: 999K';
    ctx.fillText(mcText, leftMargin / 2, topOffset);
  }

  // Отрисовка Price
  if (config.display.showPrice) {
    const priceText = tokenInfo
      ? `Price: $${tokenInfo.priceUsd.toFixed(8)}`
      : `Price: $${parseFloat(data[data.length - 1][4]).toFixed(8)}`;
    const textWidth = ctx.measureText(priceText).width;
    // Размещаем текст справа вверху
    ctx.fillText(priceText, canvas.width - rightMargin - textWidth, topOffset);

    // Отрисовка Min/Max если включено
    if (config.display.showMinMax) {
      const minPrice = Math.min(...data.map(item => parseFloat(Array.isArray(item) ? item[3] : item.low)));
      const maxPrice = Math.max(...data.map(item => parseFloat(Array.isArray(item) ? item[2] : item.high)));
      const minMaxText = `Min/max: $${minPrice.toFixed(6)} / $${maxPrice.toFixed(7)}`;
      ctx.font = `${config.font.size * 0.8}px ${config.font.family}`;
      // Размещаем текст Min/Max под текстом Price
      const minMaxWidth = ctx.measureText(minMaxText).width;
      ctx.fillText(minMaxText, canvas.width - rightMargin - minMaxWidth, topOffset + config.font.size * 1.2);
      ctx.font = `${config.font.size}px ${config.font.family}`; // Восстанавливаем исходный размер шрифта
    }
  }

  // Отрисовка временных меток
  if (config.display.showTimeline) {
    // Отрисовка теней и текста временных меток
    timeLabels.forEach((label, i) => {
      const textWidth = ctx.measureText(label).width;
      const yPosition = config.display.showPriceChange 
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

  // Если включены price change, добавляем их в последнюю очередь, чтобы они были поверх всех элементов
  if (config.display.showPriceChange) {
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
    
    const changeWidth = (canvas.width - leftMargin / 2 - rightMargin / 2) / changes.length;
    
    // Отрисовка разделительной линии
    ctx.strokeStyle = 'yellow';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(leftMargin / 2, canvas.height - bottomMargin + 97);
    ctx.lineTo(canvas.width - rightMargin / 2, canvas.height - bottomMargin + 97);
    ctx.stroke();
    
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

  // Сбрасываем тень
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  // Возвращаем результат в зависимости от среды
  if (isNodeEnvironment) {
    // В Node.js возвращаем буфер и base64
    const buffer = await canvas.toBuffer('png');
    const base64 = buffer.toString('base64');

    // Если указан путь для сохранения, сохраняем картинку
    if (outputPath) {
      await canvas.saveAs(outputPath);
    }

    return {
      buffer,
      base64: `data:image/png;base64,${base64}`,
      canvas
    };
  } else {
    // В браузере возвращаем base64 и canvas
    return {
      base64: canvas.toDataURL('image/png'),
      canvas
    };
  }
}

// Алиас для обратной совместимости
export const renderChartNode = renderChart; 