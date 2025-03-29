import { ChartConfig } from '../types';

// Определяем окружение выполнения
const isNodeEnvironment = typeof window === 'undefined';

// Загружаем библиотеки в зависимости от окружения
let Canvas;
let loadImageFunc;

// Динамически импортируем skia-canvas
const initCanvas = async () => {
  if (isNodeEnvironment) {
    try {
      // В Node.js используем обычный import
      const skiaCanvas = require('skia-canvas');
      Canvas = skiaCanvas.Canvas;
      loadImageFunc = skiaCanvas.loadImage;
    } catch (e) {
      console.error('Error loading skia-canvas in Node environment:', e);
      console.error('Please install skia-canvas: npm install skia-canvas');
      throw new Error('skia-canvas not found. Please install: npm install skia-canvas');
    }
  } else {
    // В браузере используем глобальную переменную skia-canvas
    if (window['skia-canvas']) {
      Canvas = window['skia-canvas'].Canvas;
      loadImageFunc = window['skia-canvas'].loadImage;
    } else {
      console.error('skia-canvas not found in browser. Make sure to include skia-canvas-browser.js');
      throw new Error('skia-canvas not available in browser. Make sure to include skia-canvas-browser.js');
    }
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
  canvas?: any; // Опциональный canvas
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
  canvas: existingCanvas
}: RenderChartParams): Promise<RenderOutput> {
  // Инициализируем Canvas, если еще не инициализирован
  if (!Canvas) {
    await initCanvas();
  }
  
  // Определяем canvas и контекст
  let canvas;
  let ctx;
  
  if (existingCanvas) {
    // Проверяем, что переданный canvas совместим с skia-canvas
    if (existingCanvas instanceof HTMLCanvasElement && !isNodeEnvironment) {
      // Если передан HTML-canvas, создаем новый skia-canvas и копируем данные
      canvas = new Canvas(existingCanvas.width, existingCanvas.height);
      ctx = canvas.getContext('2d');
      
      // Позже скопируем содержимое нового canvas обратно в HTML-canvas
    } else {
      // Используем переданный skia-canvas
      canvas = existingCanvas;
      ctx = canvas.getContext('2d');
    }
  } else {
    // Создаем новый canvas
    canvas = new Canvas(width, height);
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
      const backgroundImg = await preloadImage(config.background.image.url);
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
  }

  // Получаем результаты рендеринга
  let base64 = canvas.toDataURL('image/png');

  // Если передан HTML-canvas, копируем данные
  if (existingCanvas instanceof HTMLCanvasElement && !isNodeEnvironment) {
    const htmlCtx = existingCanvas.getContext('2d');
    if (htmlCtx) {
      // Копируем данные из skia-canvas в HTML-canvas
      const imageData = htmlCtx.createImageData(canvas.width, canvas.height);
      const skiaImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < skiaImageData.data.length; i++) {
        imageData.data[i] = skiaImageData.data[i];
      }
      htmlCtx.putImageData(imageData, 0, 0);
    }
  }

  if (isNodeEnvironment) {
    // Для Node.js 
    // Если указан путь для сохранения, записываем файл
    if (outputPath) {
      const fs = require('fs');
      const buffer = canvas.toBuffer('image/png');
      fs.writeFileSync(outputPath, buffer);
      return { buffer, base64, canvas };
    }
    
    return { 
      buffer: canvas.toBuffer('image/png'),
      base64,
      canvas 
    };
  } else {
    // Для браузера
    return { 
      base64,
      canvas 
    };
  }
} 