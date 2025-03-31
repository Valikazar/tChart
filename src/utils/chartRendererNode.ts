import { ChartConfig } from '../types';

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
  canvas?: HTMLCanvasElement | OffscreenCanvas; // Canvas из браузера
}

interface RenderOutput {
  base64: string;
  canvas?: HTMLCanvasElement | OffscreenCanvas;
}

// Вспомогательные функции
function priceToY(price: number, height: number, minPrice: number, priceRange: number, topMargin: number, bottomMargin: number): number {
  return height - bottomMargin - ((price - minPrice) / priceRange) * (height - topMargin - bottomMargin);
}

function indexToX(index: number, leftMargin: number, barWidth: number, gap: number): number {
  return leftMargin + index * (barWidth + gap);
}

// Функция предзагрузки изображения в браузере
async function preloadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.crossOrigin = 'anonymous'; // Для CORS
    img.src = url;
  });
}

/**
 * Функция отрисовки графика для браузера
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
  canvas: existingCanvas
}: RenderChartParams): Promise<RenderOutput> {
  // Определяем и подготавливаем canvas и контекст
  let canvas;
  let ctx;
  
  if (existingCanvas) {
    // Используем переданный canvas
    canvas = existingCanvas;
    ctx = canvas.getContext('2d');
  } else {
    // Создаем новый canvas
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
    ctx.fillStyle = barConfig.color;
    ctx.fillRect(x, Math.min(y_open, y_close), barWidth, Math.abs(y_close - y_open));

    // Отрисовка границы бара, если настроена
    if ((barConfig.borderWidth || 0) > 0) {
      ctx.strokeStyle = barConfig.borderColor || '#FFFFFF';
      ctx.lineWidth = barConfig.borderWidth || 1;
      ctx.strokeRect(x, Math.min(y_open, y_close), barWidth, Math.abs(y_close - y_open));
    }
  }

  // Добавление метаданных

  ctx.font = `${config.font.size || 20}px ${config.font.family || 'Arial'}`;
  ctx.fillStyle = config.font.color || '#FFFFFF';
  ctx.textBaseline = 'top';

  // Форматируем цену и market cap
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

  if (tokenInfo) {
    // Отрисовка имени токена
    ctx.fillText(tokenInfo.name, chartLeftMargin, 10);
    
    // Отрисовка market cap
    const mcText = formatMarketCap(tokenInfo.marketCap);
    const nameWidth = ctx.measureText(tokenInfo.name).width;
    ctx.fillText(mcText, chartLeftMargin + nameWidth + 20, 10);
    
    // Отрисовка цены
    const priceText = `$${tokenInfo.priceUsd.toFixed(8)}`;
    const priceWidth = ctx.measureText(priceText).width;
    ctx.fillText(priceText, canvas.width - chartRightMargin - priceWidth, 10);
    
    // Отрисовка изменений цены
    const yPos = canvas.height - 40;
    const xStep = (canvas.width - leftMargin - rightMargin) / 4;
    
    ctx.fillText(`5m: ${tokenInfo.priceChange['5m'].toFixed(2)}%`, leftMargin + xStep * 0, yPos);
    ctx.fillText(`1h: ${tokenInfo.priceChange['1h'].toFixed(2)}%`, leftMargin + xStep * 1, yPos);
    ctx.fillText(`6h: ${tokenInfo.priceChange['6h'].toFixed(2)}%`, leftMargin + xStep * 2, yPos);
    ctx.fillText(`24h: ${tokenInfo.priceChange['24h'].toFixed(2)}%`, leftMargin + xStep * 3, yPos);
  }

  // Возвращаем результат
  return {
    base64: canvas.toDataURL('image/png'),
    canvas
  };
} 