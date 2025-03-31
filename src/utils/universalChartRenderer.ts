import { ChartConfig, ExtendedBarConfig, TokenInfo as TokenInfoType } from '../types';

// Кэш для изображений для оптимизации загрузки
const imageCache = new Map<string, any>();

// Настройки Canvas
let Canvas;
let loadImageFunc;

// Демо-данные для превью
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

// Демо-данные для информации о токене
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

// Инициализация Canvas в зависимости от окружения
const initCanvas = async () => {
  try {
    if (typeof window === 'undefined') {
      // Node.js
      const skiaCanvas = require('skia-canvas');
      Canvas = skiaCanvas.Canvas;
      loadImageFunc = skiaCanvas.loadImage;
    } else {
      // Браузер
      if (window['skia-canvas']) {
        // Используем полифил если есть
        Canvas = window['skia-canvas'].Canvas;
        loadImageFunc = window['skia-canvas'].loadImage;
      } else {
        // Создаем обертку для HTML Canvas
        Canvas = class HTMLCanvasWrapper {
          width: number;
          height: number;
          htmlCanvas: HTMLCanvasElement;
          
          constructor(width: number, height: number) {
            this.width = width;
            this.height = height;
            this.htmlCanvas = document.createElement('canvas');
            this.htmlCanvas.width = width;
            this.htmlCanvas.height = height;
          }
          
          getContext(type: string) {
            return this.htmlCanvas.getContext(type);
          }
          
          toDataURL(format: string) {
            return this.htmlCanvas.toDataURL(format);
          }
        };
        
        // Обертка для загрузки изображений в браузере
        loadImageFunc = (url: string) => {
          return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = url;
          });
        };
      }
    }
  } catch (e) {
    console.error('Error initializing canvas:', e);
    throw new Error('Canvas initialization failed');
  }
};

export interface ChartData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface TokenInfo extends TokenInfoType {}

export interface RenderChartParams {
  config: ChartConfig;
  data: ChartData[] | any[]; // Поддерживаем массивы и объекты
  tokenInfo?: TokenInfo;
  interval?: string;
  width?: number;
  height?: number;
  outputPath?: string; // Путь для сохранения файла (только для Node.js)
  canvas?: any; // Опциональный существующий canvas
}

export interface RenderOutput {
  buffer?: Buffer;
  base64: string;
  canvas?: any;
}

// Вспомогательные функции
function priceToY(price: number | string, height: number, minPrice: number, priceRange: number, topMargin: number, bottomMargin: number) {
  const safePrice = typeof price === 'string' ? parseFloat(price) : price || 0;
  return height - bottomMargin - ((safePrice - minPrice) / priceRange) * (height - topMargin - bottomMargin);
}

function indexToX(i: number, chartLeftMargin: number, barWidth: number, gap: number) {
  return chartLeftMargin + i * (barWidth + gap);
}

// Функция для предзагрузки изображения с кэшированием
async function preloadImage(url: string): Promise<any> {
  if (imageCache.has(url)) {
    return imageCache.get(url);
  }

  try {
    const img = await loadImageFunc(url);
    imageCache.set(url, img);
    return img;
  } catch (error) {
    console.error('Error loading image:', error);
    throw error;
  }
}

// Форматирование market cap
function formatMarketCap(value: number) {
  if (value >= 1e9) {
    return `MC: $${(value / 1e9).toFixed(2)}B`;
  } else if (value >= 1e6) {
    return `MC: $${(value / 1e6).toFixed(2)}M`;
  } else if (value >= 1e3) {
    return `MC: $${(value / 1e3).toFixed(2)}K`;
  } else {
    return `MC: $${value.toFixed(2)}`;
  }
}

/**
 * Универсальная функция рендеринга графика криптовалюты
 * Работает как в Node.js с skia-canvas, так и в браузере с HTML Canvas
 */
export async function renderChart({
  config,
  data = DEMO_DATA,
  tokenInfo = DEMO_TOKEN_INFO,
  interval = 'hour',
  width = 1280,
  height = 1280,
  outputPath,
  canvas: existingCanvas
}: RenderChartParams): Promise<RenderOutput> {
  // Инициализация Canvas, если еще не инициализирован
  if (!Canvas) {
    await initCanvas();
  }

  // Создаем или используем существующий canvas
  let canvas;
  let ctx;
  let bufferCanvas;
  let bufferCtx;

  if (existingCanvas) {
    canvas = existingCanvas;
  } else {
    canvas = new Canvas(width, height);
  }
  
  ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get canvas context');

  // Создаем буферный canvas для двойной буферизации (предотвращает мерцание)
  if (typeof window === 'undefined') {
    // Node.js не требует буферизации
    bufferCanvas = canvas;
    bufferCtx = ctx;
  } else {
    // В браузере используем буфер
    bufferCanvas = new Canvas(width, height);
    bufferCtx = bufferCanvas.getContext('2d');
    if (!bufferCtx) throw new Error('Failed to get buffer canvas context');
  }

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
    // Поддержка разных форматов данных (массив или объект)
    if (Array.isArray(d)) {
      return [
        typeof d[1] === 'string' ? parseFloat(d[1]) : d[1] || 0, // open
        typeof d[2] === 'string' ? parseFloat(d[2]) : d[2] || 0, // high
        typeof d[3] === 'string' ? parseFloat(d[3]) : d[3] || 0, // low
        typeof d[4] === 'string' ? parseFloat(d[4]) : d[4] || 0  // close
      ];
    } else {
      return [
        typeof d.open === 'string' ? parseFloat(d.open) : d.open || 0,
        typeof d.high === 'string' ? parseFloat(d.high) : d.high || 0,
        typeof d.low === 'string' ? parseFloat(d.low) : d.low || 0,
        typeof d.close === 'string' ? parseFloat(d.close) : d.close || 0
      ];
    }
  });
  
  const maxPrice = Math.max(...prices);
  const minPrice = Math.min(...prices);
  const priceRange = maxPrice - minPrice;

  // Очищаем canvas
  bufferCtx.clearRect(0, 0, canvas.width, canvas.height);

  // Отрисовка фона
  if (config.background.image?.url) {
    try {
      const backgroundImg = await preloadImage(config.background.image.url);
      bufferCtx.drawImage(backgroundImg, 0, 0, canvas.width, canvas.height);

      if (config.overlay?.color) {
        bufferCtx.save();
        bufferCtx.fillStyle = config.overlay.color;
        bufferCtx.globalAlpha = config.background.opacity || 0;
        bufferCtx.fillRect(0, 0, canvas.width, canvas.height);
        bufferCtx.restore();
      }
    } catch (error) {
      console.error('Error loading background image:', error);
      bufferCtx.fillStyle = config.background.color || '#000000';
      bufferCtx.fillRect(0, 0, canvas.width, canvas.height);
    }
  } else {
    bufferCtx.fillStyle = config.background.color || '#000000';
    bufferCtx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // Массив для хранения center изображений для последующей отрисовки
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

    // Получаем OHLC значения в зависимости от формата данных
    const open = Array.isArray(d) ? d[1] : d.open;
    const high = Array.isArray(d) ? d[2] : d.high;
    const low = Array.isArray(d) ? d[3] : d.low;
    const close = Array.isArray(d) ? d[4] : d.close;
    
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

  // Отрисовка center изображений
  for (const { x, y, config, barWidth } of centerImages) {
    const scaledWidth = barWidth * (config.scale || 1);
    const scaledHeight = config.height || 50;
    const img = await preloadImage(config.url);
    bufferCtx.drawImage(
      img,
      x - (scaledWidth - barWidth) / 2,
      y - scaledHeight / 2,
      scaledWidth,
      scaledHeight
    );
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

  // Отрисовка текста и меток времени
  bufferCtx.font = `${config.font.size}px ${config.font.family}`;
  bufferCtx.fillStyle = config.font.color;
  bufferCtx.textBaseline = 'top';

  // Временные метки
  const timeLabels = Array.from({ length: 5 }, (_, i) => {
    if (i === 4) return 'Now';
    
    // Вычисляем временную метку на основе данных
    const timestamp = Array.isArray(data[0]) 
      ? data[0][0] + ((data[data.length - 1][0] - data[0][0]) * i) / 4
      : data[0].timestamp + ((data[data.length - 1].timestamp - data[0].timestamp) * i) / 4;
    
    const timeDiffInSeconds = Array.isArray(data[data.length - 1])
      ? data[data.length - 1][0] - timestamp
      : data[data.length - 1].timestamp - timestamp;
    
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

  // Добавляем тень для текста
  bufferCtx.shadowColor = 'black';
  bufferCtx.shadowBlur = 4;
  bufferCtx.shadowOffsetX = 2;
  bufferCtx.shadowOffsetY = 2;

  // Определяем topOffset для всех элементов
  const topOffset = Math.round(canvas.height * 0.01);

  // Определяем изменения цены
  const changes = [
    { period: '5M', value: tokenInfo.priceChange['5m'] },
    { period: '1H', value: tokenInfo.priceChange['1h'] },
    { period: '6H', value: tokenInfo.priceChange['6h'] },
    { period: '24H', value: tokenInfo.priceChange['24h'] }
  ];

  // Отрисовка имени токена и MC
  const tokenNameText = tokenInfo?.name || 'Token';
  
  if (config.display?.showTokenName) {
    bufferCtx.fillText(tokenNameText, leftMargin / 2, topOffset);
    
    if (config.display?.showMarketCap) {
      const mcText = formatMarketCap(tokenInfo.marketCap);
      const tokenNameWidth = bufferCtx.measureText(tokenNameText).width;
      bufferCtx.fillText(mcText, leftMargin / 2 + tokenNameWidth + 20, topOffset);
    }
  } else if (config.display?.showMarketCap) {
    const mcText = formatMarketCap(tokenInfo.marketCap);
    bufferCtx.fillText(mcText, leftMargin / 2, topOffset);
  }

  // Отрисовка Price
  if (config.display?.showPrice) {
    const priceText = `Price: $${tokenInfo.priceUsd.toFixed(8)}`;
    const priceWidth = bufferCtx.measureText(priceText).width;
    // Размещаем текст справа вверху
    bufferCtx.fillText(priceText, canvas.width - (rightMargin / 2) - priceWidth, topOffset);

    // Отрисовка Min/Max если включено
    if (config.display?.showMinMax) {
      // Поддерживаем оба формата данных (массив и объект)
      const minPrice = Math.min(...data.map(item => 
        Array.isArray(item) ? parseFloat(item[3]) : parseFloat(item.low as string)
      ));
      const maxPrice = Math.max(...data.map(item => 
        Array.isArray(item) ? parseFloat(item[2]) : parseFloat(item.high as string)
      ));
      
      const minMaxText = `Min/max: $${minPrice.toFixed(6)} / $${maxPrice.toFixed(7)}`;
      bufferCtx.font = `${config.font.size * 0.8}px ${config.font.family}`;
      // Размещаем текст Min/Max под текстом Price
      const minMaxWidth = bufferCtx.measureText(minMaxText).width;
      bufferCtx.fillText(minMaxText, canvas.width - (rightMargin / 2) - minMaxWidth, topOffset + config.font.size * 1.2);
      bufferCtx.font = `${config.font.size}px ${config.font.family}`; // Восстанавливаем исходный размер шрифта
    }
  }

  // Сбрасываем тень
  bufferCtx.shadowColor = 'transparent';
  bufferCtx.shadowBlur = 0;
  bufferCtx.shadowOffsetX = 0;
  bufferCtx.shadowOffsetY = 0;

  // Отрисовка временных меток
  if (config.display?.showTimeline) {
    timeLabels.forEach((label, i) => {
      const textWidth = bufferCtx.measureText(label).width;
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
  if (config.display?.showTimeline && config.display?.showPriceChange) {
    bufferCtx.strokeStyle = 'yellow';
    bufferCtx.lineWidth = 2;
    bufferCtx.beginPath();
    bufferCtx.moveTo(leftMargin / 2, canvas.height - bottomMargin + 97);
    bufferCtx.lineTo(canvas.width - rightMargin / 2, canvas.height - bottomMargin + 97);
    bufferCtx.stroke();
  }

  // Отрисовка изменений цены
  if (config.display?.showPriceChange) {
    const changeWidth = (canvas.width - leftMargin / 2 - rightMargin / 2) / changes.length;
    
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
      if (xPosition + textWidth > canvas.width - rightMargin / 2) {
        xPosition = canvas.width - rightMargin / 2 - textWidth;
      }
      
      // Добавляем усиленную тень для лучшей читаемости
      bufferCtx.save();
      bufferCtx.shadowColor = 'black';
      bufferCtx.shadowBlur = 6;
      bufferCtx.shadowOffsetX = 2;
      bufferCtx.shadowOffsetY = 2;
      
      // Отрисовываем текст изменения цены
      bufferCtx.fillStyle = change.value > 0 ? config.upBar.color : change.value < 0 ? config.downBar.color : 'yellow';
      bufferCtx.fillText(text, xPosition, canvas.height - bottomMargin + 110);
      bufferCtx.restore();
    });
  }

  // Если используем буферизацию, копируем содержимое буферного канваса на основной
  if (bufferCanvas !== canvas) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bufferCanvas, 0, 0);
  }

  // Генерация результатов
  let base64 = canvas.toDataURL('image/png');
  let buffer;
  
  // Дополнительные действия для Node.js (сохранение файла)
  if (typeof window === 'undefined') {
    buffer = canvas.toBuffer('image/png');
    
    if (outputPath) {
      try {
        const fs = require('fs');
        fs.writeFileSync(outputPath, buffer);
      } catch (error) {
        console.error('Error saving file:', error);
      }
    }
  }

  return {
    buffer,
    base64,
    canvas
  };
}

/**
 * Экспортирует пример использования для Node.js
 */
export const nodeExample = `
const { renderChart, DEMO_DATA, DEMO_TOKEN_INFO } = require('./universalChartRenderer');
const { ChartConfig } = require('../types');

// Пример конфигурации
const config = {
  background: { color: '#000000' },
  upBar: { color: '#00ff00' },
  downBar: { color: '#ff0000' },
  font: { family: 'Arial', size: 14, color: '#ffffff' },
  display: {
    showTokenName: true,
    showMarketCap: true,
    showPrice: true,
    showMinMax: true,
    showTimeline: true,
    showPriceChange: true
  }
};

async function generateChart() {
  const result = await renderChart({
    config,
    data: DEMO_DATA,
    tokenInfo: DEMO_TOKEN_INFO,
    outputPath: 'chart.png'
  });
  
  console.log('Chart generated at chart.png');
}

generateChart().catch(console.error);
`;

/**
 * Экспортирует пример использования для браузера
 */
export const browserExample = `
import { renderChart, DEMO_DATA, DEMO_TOKEN_INFO } from './universalChartRenderer';

// Пример конфигурации
const config = {
  background: { color: '#000000' },
  upBar: { color: '#00ff00' },
  downBar: { color: '#ff0000' },
  font: { family: 'Arial', size: 14, color: '#ffffff' },
  display: {
    showTokenName: true,
    showMarketCap: true,
    showPrice: true,
    showMinMax: true,
    showTimeline: true,
    showPriceChange: true
  }
};

async function displayChart() {
  const container = document.getElementById('chart-container');
  
  const result = await renderChart({
    config,
    data: DEMO_DATA,
    tokenInfo: DEMO_TOKEN_INFO
  });
  
  // Создаем элемент изображения из base64 данных
  const img = new Image();
  img.src = result.base64;
  container.appendChild(img);
}

displayChart().catch(console.error);
`; 