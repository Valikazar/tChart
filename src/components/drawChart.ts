// drawChart.ts
import { ChartConfig, ExtendedBarConfig } from './types';
import {
  UniversalCanvas,
  UniversalCanvasContext,
  UniversalImage,
  createUniversalCanvas,
  loadUniversalImage,
  imageCache,
  hueImageCache,
} from './canvasAbstraction';

// Function to format price with appropriate decimal places
// Shows enough decimal places to display 0.5% price movement
// For very small numbers, uses compact notation like 0.0(8)47
const formatPrice = (price: number): string => {
  if (price === 0) return '0';
  
      // For very small numbers (less than 0.0001), use compact notation
    if (price < 0.0001) {
    // Convert to string and extract significant digits
    const priceStr = price.toExponential(10); // Get enough precision
    const [mantissaPart, exponentPart] = priceStr.split('e');
    const exponent = Math.abs(parseInt(exponentPart));
    
    // Extract all significant digits from mantissa (remove decimal point)
    let significantDigits = mantissaPart.replace('.', '').substring(0, 3); // Take first 3 digits total
    
    // Pad with zeros to ensure consistent length (3 digits)
    significantDigits = significantDigits.padEnd(3, '0');
    
    // Calculate the number of zeros after decimal point in standard notation
    // For 5.31e-6, we want to show 0.0(4)531, not 0.0(6)531
    // This means we need exponent - 2 (because 0.0X means 2 positions are already shown)
    const zerosAfterDecimal = Math.max(0, exponent - 2);
    
    // Return in format: 0.0(zerosAfterDecimal)significantDigits
    return `0.0(${zerosAfterDecimal})${significantDigits}`;
  }
  
  // Calculate the minimum price difference that represents 0.5% movement
  const minPriceDifference = price * 0.005; // 0.5%
  
  // Determine how many decimal places we need to show 0.5% movement
  let decimalPlaces = 0;
  
  // Find the decimal place where 0.5% movement becomes visible
  if (minPriceDifference > 0) {
    // Calculate how many decimal places we need to represent the 0.5% movement
    decimalPlaces = Math.max(0, -Math.floor(Math.log10(minPriceDifference)) + 1);
  }
  
  // For prices >= 1, ensure at least 2 decimal places
  if (price >= 1 && decimalPlaces < 2) {
    decimalPlaces = 2;
  }
  
  // For prices < 1, ensure at least 2 decimal places
  if (price < 1 && decimalPlaces < 2) {
    decimalPlaces = 2;
  }
  
  // Ensure we don't show more than 8 decimal places
  decimalPlaces = Math.min(decimalPlaces, 8);
  
  return price.toFixed(decimalPlaces);
};

// Function to draw text with subscript support on canvas
// Parses format like "0.0(9)479" and renders the number in parentheses as subscript
const drawTextWithSubscript = (
  ctx: UniversalCanvasContext,
  text: string,
  x: number,
  y: number,
  fontSize: number = 16,
  color: string = '#000000',
  fontFamily: string = 'Arial'
) => {
  // Check if text contains compact notation like "0.0(4)531"
  const compactMatch = text.match(/^(.*?)0\.0\((\d+)\)(\d+)(.*)$/);
  
  if (compactMatch) {
    const [, prefix, exponentPart, significantDigits, suffix] = compactMatch;
    let currentX = x;
    
    // Set font and color
    ctx.fillStyle = color;
    ctx.font = `${fontSize}px "${fontFamily}"`;
    
    // Draw prefix (e.g., "Price: $")
    if (prefix) {
      ctx.fillText(prefix, currentX, y);
      currentX += ctx.measureText(prefix).width;
    }
    
    // Draw "0.0" part
    const zeroPointZero = "0.0";
    ctx.fillText(zeroPointZero, currentX, y);
    currentX += ctx.measureText(zeroPointZero).width;
    
    // Draw subscript exponent (smaller font, lower position)
    const subscriptFontSize = fontSize * 0.6;
    ctx.font = `${subscriptFontSize}px "${fontFamily}"`;
    ctx.fillText(exponentPart, currentX, y + fontSize * 0.5);
    currentX += ctx.measureText(exponentPart).width;
    
    // Draw significant digits (normal font)
    ctx.font = `${fontSize}px "${fontFamily}"`;
    ctx.fillText(significantDigits, currentX, y);
    currentX += ctx.measureText(significantDigits).width;
    
    // Draw suffix recursively if it contains more compact notations
    if (suffix) {
      drawTextWithSubscript(ctx, suffix, currentX, y, fontSize, color, fontFamily);
    }
  } else {
    // Regular text without subscript
    ctx.font = `${fontSize}px "${fontFamily}"`;
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }
};

// Function to apply color balance
const applyHueToImage = (
  img: UniversalImage,
  hue: number,
  src: string
): UniversalCanvas => {
  const cacheKey = `${src}_hue_${hue}`;
  if (hueImageCache.has(cacheKey)) {
    return hueImageCache.get(cacheKey)!;
  }

  const tempCanvas = createUniversalCanvas(img.width, img.height);
  const tempCtx = tempCanvas.getContext('2d') as UniversalCanvasContext;

  tempCtx.drawImage(img, 0, 0);

  if (!hue) {
    hueImageCache.set(cacheKey, tempCanvas);
    return tempCanvas;
  }

  const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
  const data = imageData.data;

  const hueRadian = hue * Math.PI / 180;
  const colorToBlend = {
    r: Math.round(127.5 * (1 + Math.cos(hueRadian))),
    g: Math.round(127.5 * (1 + Math.cos(hueRadian - 2 * Math.PI / 3))),
    b: Math.round(127.5 * (1 + Math.cos(hueRadian - 4 * Math.PI / 3))),
  };

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const originalR = data[i];
    const originalG = data[i + 1];
    const originalB = data[i + 2];
    const luminance = 0.299 * originalR + 0.587 * originalG + 0.114 * originalB;
    const normalizedLuminance = luminance / 255;
    const baseFactor = 0.1;
    const brightnessFactor = Math.pow(normalizedLuminance, 0.5) * 0.5;
    const blendFactor = Math.min(baseFactor + brightnessFactor, 0.8);

    data[i] = Math.round(originalR * (1 - blendFactor) + colorToBlend.r * blendFactor);
    data[i + 1] = Math.round(originalG * (1 - blendFactor) + colorToBlend.g * blendFactor);
    data[i + 2] = Math.round(originalB * (1 - blendFactor) + colorToBlend.b * blendFactor);
  }

  tempCtx.putImageData(imageData, 0, 0);
  hueImageCache.set(cacheKey, tempCanvas);
  return tempCanvas;
};

// Функция для зеркального отображения изображения
const mirrorImage = (
  img: UniversalImage | UniversalCanvas,
  src: string
): UniversalCanvas => {
  const cacheKey = `${src}_mirror`;
  if (hueImageCache.has(cacheKey)) {
    return hueImageCache.get(cacheKey)!;
  }

  const tempCanvas = createUniversalCanvas(img.width, img.height);
  const tempCtx = tempCanvas.getContext('2d') as UniversalCanvasContext;
  
  // Сохраняем текущее состояние контекста
  tempCtx.save();
  
  // Устанавливаем зеркальное преобразование (отрицательное масштабирование по X)
  tempCtx.translate(img.width, 0);
  tempCtx.scale(-1, 1);
  
  // Рисуем изображение с зеркальным отображением
  tempCtx.drawImage(img, 0, 0);
  
  // Восстанавливаем контекст
  tempCtx.restore();
  
  hueImageCache.set(cacheKey, tempCanvas);
  return tempCanvas;
};

// Function to preload image
const preloadImage = async (url: string): Promise<UniversalImage> => {
  if (imageCache.has(url)) {
    return imageCache.get(url)!;
  }

  const img = await loadUniversalImage(url);
  imageCache.set(url, img);
  return img;
};

// Main drawing function
export async function drawChart({
  canvas,
  config,
  data,
  tokenInfo,
  interval = 'hour',
  width = 1280,
  height = 1280,
  tokenName,
  isEnhanced = false,
}: {
  canvas: UniversalCanvas;
  config: ChartConfig;
  data: any[];
  tokenInfo: any;
  interval?: string;
  width?: number;
  height?: number;
  tokenName?: string;
  isEnhanced?: boolean;
}): Promise<void> {
  const ctx = canvas.getContext('2d') as UniversalCanvasContext;
  if (!ctx || !data || data.length === 0) return;

  // console.log('[DEBUG] Font configuration at the start of drawing:', config.font);

  // Check if free parameter is defined, if not consider it false
  const isFree = config.free === true;

  const bufferCanvas = createUniversalCanvas(width, height);
  const bufferCtx = bufferCanvas.getContext('2d') as UniversalCanvasContext;
  if (!bufferCtx) return;

  // Set dimensions
  canvas.width = width;
  canvas.height = height;
  bufferCanvas.width = width;
  bufferCanvas.height = height;

  // Chart parameters
  const leftMargin = 100;
  const rightMargin = 100;
  const topMargin = 180;
  const bottomMargin = 180;
  const chartLeftMargin = leftMargin / 2;
  const chartRightMargin = rightMargin / 2;

  const totalWidth = width - chartLeftMargin - chartRightMargin;
  const barWidth = totalWidth / (data.length * 1.15);
  const gap = barWidth * 0.15;

  const numBars = data.length;
  const lineScale = Math.min(width, height) / 1280;
  const barScale = numBars / 15;

  // Find min/max prices
  const prices = data.flatMap(([_, o, h, l, c]) => [
    typeof o === 'string' ? parseFloat(o) : o || 0,
    typeof h === 'string' ? parseFloat(h) : h || 0,
    typeof l === 'string' ? parseFloat(l) : l || 0,
    typeof c === 'string' ? parseFloat(c) : c || 0,
  ]);
  
  // Находим min/max только для тел свечей (open/close)
  const bodyPrices = data.flatMap(([timestamp, o, h, l, c]) => [
    typeof o === 'string' ? parseFloat(o) : o || 0,
    typeof c === 'string' ? parseFloat(c) : c || 0,
  ]);
  const maxBodyPrice = Math.max(...bodyPrices);
  const minBodyPrice = Math.min(...bodyPrices);
  const bodyPriceRange = maxBodyPrice - minBodyPrice;
  
  // Добавляем 5% отступ сверху и снизу от тел свечей
  const maxPrice = maxBodyPrice + bodyPriceRange * 0.01;
  const minPrice = minBodyPrice - bodyPriceRange * 0.01;
  const priceRange = maxPrice - minPrice;

  // Functions for coordinates
  const priceToY = (price: number | string) => {
    const safePrice = typeof price === 'string' ? parseFloat(price) : price || 0;
    return height - bottomMargin - ((safePrice - minPrice) / priceRange) * (height - topMargin - bottomMargin);
  };

  const indexToX = (i: number) => chartLeftMargin + i * (barWidth + gap);

  // Clear buffer canvas
  bufferCtx.clearRect(0, 0, bufferCanvas.width, bufferCanvas.height);

  // Draw background
  if (config.background.image?.url) {
    try {
      const backgroundImg = await preloadImage(config.background.image.url);
      
      // Проверяем наличие опции mirror для фона
      const shouldMirror = config.background.image.mirror === true;
      const processedImg = shouldMirror ? mirrorImage(backgroundImg, config.background.image.url) : backgroundImg;
      
      bufferCtx.drawImage(processedImg, 0, 0, bufferCanvas.width, bufferCanvas.height);

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

  // Draw bars
  const drawBars = async () => {
    const centerImages: Array<{
      x: number;
      y: number;
      config: any;
      barWidth: number;
    }> = [];

    // Предварительно определяем какие бары будут candle и knife
    // Вычисляем относительные пороги в зависимости от количества столбиков
    const baseBarCount = 15; // Базовое количество столбиков для расчета
    const scaleFactor = Math.min(2, Math.max(0.5, baseBarCount / data.length)); // Ограничиваем масштаб от 0.5 до 2
    
    const dojiThreshold = Math.round(30 * scaleFactor);
    const primaryThreshold = Math.round(300 * scaleFactor); // Основной порог
    const fallbackThreshold = Math.round(200 * scaleFactor); // Запасной порог
    
    // Используем настройки fineTuning для ограничения количества специальных баров
    const maxCandlesPercent = config.fineTuning?.maxCandles || 10;
    const maxKnivesPercent = config.fineTuning?.maxKnives || 10;
    const maxCandles = Math.round(data.length * maxCandlesPercent / 100);
    const maxKnives = Math.round(data.length * maxKnivesPercent / 100);
    
    // Функция для поиска специальных баров с двумя уровнями порога
    const findSpecialBars = (isUpType: boolean) => {
      const candidates: Array<{ index: number; height: number }> = [];
      
      // Первый цикл с основным порогом
      for (let i = 0; i < data.length; i++) {
        const [_, open, high, low, close] = data[i];
        const y_open = priceToY(open);
        const y_close = priceToY(close);
        const isUpBar = y_close > y_open;
        const barHeight = Math.abs(y_close - y_open);
        
        const isDoji = config.doji?.active && barHeight <= dojiThreshold;
        
        if (!isDoji && barHeight > primaryThreshold && isUpBar === isUpType) {
          candidates.push({ index: i, height: barHeight });
        }
      }
      
      // Сортируем по высоте и берем максимум согласно настройкам fineTuning
      candidates.sort((a, b) => b.height - a.height);
      const maxBars = isUpType ? maxKnives : maxCandles;
      let selectedIndices = candidates.slice(0, maxBars).map(c => c.index);
      
      // Если ничего не найдено, ищем с запасным порогом - максимум 1 самый большой
      if (selectedIndices.length === 0) {
        const fallbackCandidates: Array<{ index: number; height: number }> = [];
        
        for (let i = 0; i < data.length; i++) {
          const [_, open, high, low, close] = data[i];
          const y_open = priceToY(open);
          const y_close = priceToY(close);
          const isUpBar = y_close > y_open;
          const barHeight = Math.abs(y_close - y_open);
          
          const isDoji = config.doji?.active && barHeight <= dojiThreshold;
          
          if (!isDoji && barHeight > fallbackThreshold && isUpBar === isUpType) {
            fallbackCandidates.push({ index: i, height: barHeight });
          }
        }
        
        // Берем только самый большой
        if (fallbackCandidates.length > 0) {
          fallbackCandidates.sort((a, b) => b.height - a.height);
          selectedIndices = [fallbackCandidates[0].index];
        }
      }
      
      return new Set(selectedIndices);
    };
    
    const selectedCandleIndices = findSpecialBars(false); // candle - падающие бары
    const selectedKnifeIndices = findSpecialBars(true);   // knife - растущие бары

    for (let i = 0; i < data.length; i++) {
      const [_, open, high, low, close] = data[i];
      const x = indexToX(i);
      const y_open = priceToY(open);
      const y_close = priceToY(close);
      const y_high = priceToY(high);
      const y_low = priceToY(low);

      const barHeight = Math.abs(y_close - y_open);

      // Use the unified renderSingleBar function
      await renderSingleBar({
        ctx: bufferCtx,
        barIndex: i,
        barData: data[i],
        config,
        x,
        y_open,
        y_close,
        y_high,
        y_low,
        barWidth,
        barHeight,
        dojiThreshold,
        selectedCandleIndices,
        selectedKnifeIndices,
        lineScale,
        barScale,
        centerImages,
      });
    }

    // Render center images from the collected array
    for (const centerImage of centerImages) {
      try {
        const img = await preloadImage(centerImage.config.url);
        
        const scale = (centerImage.config.scale || 1) * lineScale / barScale;
        const offsetX = (centerImage.config.offsetX || 0) * lineScale / barScale;
        const offsetY = (centerImage.config.offsetY || 0) * lineScale / barScale;
        const rotation = centerImage.config.rotation || 0;
        const hue = centerImage.config.hue || 0;
        const shouldMirror = centerImage.config.mirror === true;

        let processedImg = img;
        if (hue) {
          processedImg = applyHueToImage(processedImg, hue, centerImage.config.url);
        }
        if (shouldMirror) {
          processedImg = mirrorImage(processedImg, centerImage.config.url);
        }

        const scaledWidth = img.width * scale;
        const scaledHeight = img.height * scale;

        bufferCtx.save();
        const centerX = centerImage.x + (centerImage.barWidth - scaledWidth) / 2 + offsetX + scaledWidth / 2;
        const centerY = centerImage.y - scaledHeight / 2 + offsetY + scaledHeight / 2;
        
        bufferCtx.translate(centerX, centerY);
        bufferCtx.rotate((rotation * Math.PI) / 180);
        bufferCtx.translate(-scaledWidth / 2, -scaledHeight / 2);

        bufferCtx.drawImage(processedImg, 0, 0, scaledWidth, scaledHeight);
        bufferCtx.restore();
      } catch (error) {
        console.error('Error loading center image:', error);
      }
    }
  };

  await drawBars();

  // Draw text and time labels
  // console.log('[DEBUG] Applying font:', `${config.font.size}px ${config.font.family}`);
  bufferCtx.font = `${config.font.size}px "${config.font.family}"`;
  bufferCtx.fillStyle = config.font.color;
  bufferCtx.textBaseline = 'top';
  // console.log('[DEBUG] Current context font:', bufferCtx.font);

  const timeLabels = Array.from({ length: 5 }, (_, i) => {
    // "Tomorrow" только для Enhanced Chart с прогнозами, "Now" для паттернов
    if (i === 4 && isEnhanced) {
      return 'Tomorrow';
    }
    if (i === 4) {
      return 'Now';
    }
    const timestamp = data[0][0] + ((data[data.length - 1][0] - data[0][0]) * i) / 4;
    const timeDiffInSeconds = data[data.length - 1][0] - timestamp;
    // Format per interval rules
    const formatAgo = (iv: string): string => {
      const minutesAgo = Math.round(timeDiffInSeconds / 60);
      const hoursAgo = Math.round(timeDiffInSeconds / 3600);
      const daysAgo = Math.round(timeDiffInSeconds / (24 * 3600));
      if (iv === '5m') return `${minutesAgo}m ago`;
      if (iv === '15m' || iv === '30m' || iv === '1h') return `${hoursAgo}h ago`;
      // 4h, 1d, 3d, 1w, 1M → days
      return `${daysAgo}d ago`;
    };
    return formatAgo(interval);
  });

  const labelPositions = Array.from({ length: timeLabels.length }, (_, i) => {
    if (i === 0) return leftMargin + 10;
    if (i === timeLabels.length - 1) return bufferCanvas.width - rightMargin - 10;
    return leftMargin + (i * (bufferCanvas.width - leftMargin - rightMargin)) / (timeLabels.length - 1);
  });

  const formatMarketCap = (value: number) => {
    if (value >= 1e9) return `MC: $${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `MC: $${(value / 1e6).toFixed(2)}M`;
    if (value >= 1e3) return `MC: $${(value / 1e3).toFixed(2)}K`;
    if (value < 1) return `MC: $${formatPrice(value)}`;
    return `MC: $${value.toFixed(2)}`;
  };

  bufferCtx.shadowColor = 'black';
  bufferCtx.shadowBlur = 4;
  bufferCtx.shadowOffsetX = 2;
  bufferCtx.shadowOffsetY = 2;

  const topOffset = Math.round(bufferCanvas.height * 0.01);

  const changes = [
    { period: '5M', value: tokenInfo.priceChange['5m'] },
    { period: '1H', value: tokenInfo.priceChange['1h'] },
    { period: '6H', value: tokenInfo.priceChange['6h'] },
    { period: '24H', value: tokenInfo.priceChange['24h'] },
  ];

  if (config.display.showTokenName) {
    const tokenNameText = tokenName || config.displayName || tokenInfo?.name || 'Token';
    drawTextWithSubscript(bufferCtx, tokenNameText, leftMargin / 2, topOffset, config.font.size, config.font.color, config.font.family);

    if (config.display.showMarketCap) {
      const mcText = formatMarketCap(tokenInfo.marketCap);
      const tokenNameWidth = bufferCtx.measureText(tokenNameText).width;
      drawTextWithSubscript(bufferCtx, mcText, leftMargin / 2 + tokenNameWidth + 20, topOffset, config.font.size, config.font.color, config.font.family);
    }
  } else if (config.display.showMarketCap) {
    const mcText = formatMarketCap(tokenInfo.marketCap);
    drawTextWithSubscript(bufferCtx, mcText, leftMargin / 2, topOffset, config.font.size, config.font.color, config.font.family);
  }

  if (config.display.showPrice) {
    const priceText = `Price: $${formatPrice(tokenInfo.priceUsd)}`;
    const priceWidth = bufferCtx.measureText(priceText).width;
    drawTextWithSubscript(bufferCtx, priceText, bufferCanvas.width - rightMargin / 2 - priceWidth, topOffset, config.font.size, config.font.color, config.font.family);

    if (config.display.showMinMax) {
      const minPrice = Math.min(...data.map((item) => parseFloat(item[3])));
      const maxPrice = Math.max(...data.map((item) => parseFloat(item[2])));
      const minMaxText = `Min/max: $${formatPrice(minPrice)} / $${formatPrice(maxPrice)}`;
      bufferCtx.font = `${config.font.size * 0.8}px "${config.font.family}"`;
      const minMaxWidth = bufferCtx.measureText(minMaxText).width;
      drawTextWithSubscript(bufferCtx, minMaxText, bufferCanvas.width - rightMargin / 2 - minMaxWidth, topOffset + config.font.size * 1.2, config.font.size * 0.8, config.font.color, config.font.family);
      bufferCtx.font = `${config.font.size}px "${config.font.family}"`;
    }
  }

  bufferCtx.shadowColor = 'transparent';
  bufferCtx.shadowBlur = 0;
  bufferCtx.shadowOffsetX = 0;
  bufferCtx.shadowOffsetY = 0;

  if (config.display.showTimeline) {
    timeLabels.forEach((label, i) => {
      const textWidth = bufferCtx.measureText(label).width;
      const yPosition = config.display.showPriceChange
        ? bufferCanvas.height - bottomMargin + 50
        : bufferCanvas.height - bottomMargin + 110;

      let xPosition = labelPositions[i] - textWidth / 2;
      if (xPosition < leftMargin / 2) xPosition = leftMargin / 2;
      if (xPosition + textWidth > bufferCanvas.width - rightMargin / 2)
        xPosition = bufferCanvas.width - rightMargin / 2 - textWidth;

      bufferCtx.save();
      bufferCtx.shadowColor = 'black';
      bufferCtx.shadowBlur = 6;
      bufferCtx.shadowOffsetX = 2;
      bufferCtx.shadowOffsetY = 2;

      bufferCtx.fillStyle = config.font.color;
      bufferCtx.fillText(label, xPosition, yPosition);
      bufferCtx.restore();
    });
  }

  if (config.display.showTimeline && config.display.showPriceChange) {
    bufferCtx.strokeStyle = 'yellow';
    bufferCtx.lineWidth = 2;
        bufferCtx.beginPath();
    bufferCtx.moveTo(leftMargin / 2, bufferCanvas.height - bottomMargin + 97);
    bufferCtx.lineTo(bufferCanvas.width - rightMargin / 2, bufferCanvas.height - bottomMargin + 97);
        bufferCtx.stroke();
      }

  if (config.display.showPriceChange) {
    const changeWidth = (bufferCanvas.width - leftMargin / 2 - rightMargin / 2) / changes.length;

    changes.forEach((change, i) => {
      const x = leftMargin / 2 + i * changeWidth + changeWidth / 2;
      const text = `${change.period}: ${change.value >= 0 ? '+' : ''}${change.value.toFixed(2)}%`;
      const textWidth = bufferCtx.measureText(text).width;

      let xPosition = x - textWidth / 2;
      if (xPosition < leftMargin / 2) xPosition = leftMargin / 2;
      if (xPosition + textWidth > bufferCanvas.width - rightMargin / 2)
        xPosition = bufferCanvas.width - rightMargin / 2 - textWidth;

      bufferCtx.save();
      bufferCtx.shadowColor = 'black';
      bufferCtx.shadowBlur = 6;
      bufferCtx.shadowOffsetX = 2;
      bufferCtx.shadowOffsetY = 2;

      bufferCtx.fillStyle = change.value > 0 ? config.upBar.color : change.value < 0 ? config.downBar.color : 'yellow';
      bufferCtx.fillText(text, xPosition, bufferCanvas.height - bottomMargin + 110);
      bufferCtx.restore();
    });
  }

  // Add tChart.XYZ watermark if free is false
  if (!isFree) {
    // Save current context
      bufferCtx.save();
      
    // Set parameters for vertical text
    bufferCtx.globalAlpha = 0.29; // 20% opacity
    bufferCtx.font = `bold 45px "${config.font.family}"`; // Use consistent font family
    bufferCtx.fillStyle = '#ffffff'; // White text color
    
    // Calculate text size (before rotation)
    const watermarkText = 'tChart.XYZ';
    const textMetrics = bufferCtx.measureText(watermarkText);
    const textHeight = textMetrics.actualBoundingBoxAscent + textMetrics.actualBoundingBoxDescent;
    
    // Rotate context for vertical text
    // Offset 30px from right edge and 30px from bottom edge
    bufferCtx.translate(bufferCanvas.width - 48, bufferCanvas.height - 25);
    bufferCtx.rotate(-Math.PI / 2);
    
    // Draw text
    bufferCtx.fillText(watermarkText, 0, 0);
    
    // Restore context
    bufferCtx.restore();
  }

  // Draw vertical line if configured
  if (config.verticalLine?.active) {
    const lineX = indexToX(config.verticalLine.position);
    const lineY1 = topMargin;
    const lineY2 = height - bottomMargin;
    
    bufferCtx.save();
    bufferCtx.strokeStyle = config.verticalLine.color || '#ff0000';
    bufferCtx.lineWidth = config.verticalLine.width || 2;
    
    if (config.verticalLine.style === 'dashed') {
      bufferCtx.setLineDash([5, 5]);
    }
    
    bufferCtx.beginPath();
    bufferCtx.moveTo(lineX, lineY1);
    bufferCtx.lineTo(lineX, lineY2);
    bufferCtx.stroke();
    bufferCtx.restore();
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bufferCanvas, 0, 0);
}

// Function to render individual bars with transparent background
export async function drawIndividualBars({
  canvas,
  config,
  data,
  tokenInfo,
  interval = 'hour',
  width = 1280,
  height = 1280,
  tokenName,
}: {
  canvas: UniversalCanvas;
  config: ChartConfig;
  data: any[];
  tokenInfo: any;
  interval?: string;
  width?: number;
  height?: number;
  tokenName?: string;
}): Promise<UniversalCanvas[]> {
  const ctx = canvas.getContext('2d') as UniversalCanvasContext;
  if (!ctx || !data || data.length === 0) return [];

  // Chart parameters (same as in main function)
  const leftMargin = 100;
  const rightMargin = 100;
  const topMargin = 180;
  const bottomMargin = 180;
  const chartLeftMargin = leftMargin / 2;
  const chartRightMargin = rightMargin / 2;

  const totalWidth = width - chartLeftMargin - chartRightMargin;
  const barWidth = totalWidth / (data.length * 1.15);
  const gap = barWidth * 0.15;

  const numBars = data.length;
  const lineScale = Math.min(width, height) / 1280;
  const barScale = numBars / 15;

  // Find min/max prices
  const bodyPrices = data.flatMap(([timestamp, o, h, l, c]) => [
    typeof o === 'string' ? parseFloat(o) : o || 0,
    typeof c === 'string' ? parseFloat(c) : c || 0,
  ]);
  const maxBodyPrice = Math.max(...bodyPrices);
  const minBodyPrice = Math.min(...bodyPrices);
  const bodyPriceRange = maxBodyPrice - minBodyPrice;
  
  const maxPrice = maxBodyPrice + bodyPriceRange * 0.01;
  const minPrice = minBodyPrice - bodyPriceRange * 0.01;
  const priceRange = maxPrice - minPrice;

  const priceToY = (price: number | string) => {
    const safePrice = typeof price === 'string' ? parseFloat(price) : price || 0;
    return height - bottomMargin - ((safePrice - minPrice) / priceRange) * (height - topMargin - bottomMargin);
  };

  const indexToX = (i: number) => chartLeftMargin + i * (barWidth + gap);

  const dojiThreshold = Math.round(30 * Math.min(2, Math.max(0.5, 15 / data.length)));
  const primaryThreshold = Math.round(300 * Math.min(2, Math.max(0.5, 15 / data.length)));
  const fallbackThreshold = Math.round(200 * Math.min(2, Math.max(0.5, 15 / data.length)));

  const maxCandlesPercent = config.fineTuning?.maxCandles || 10;
  const maxKnivesPercent = config.fineTuning?.maxKnives || 10;
  const maxCandles = Math.round(data.length * maxCandlesPercent / 100);
  const maxKnives = Math.round(data.length * maxKnivesPercent / 100);

  // Find special bars logic (same as in main function)
  const findSpecialBars = (isUpType: boolean) => {
    const candidates: Array<{ index: number; height: number }> = [];
    
    for (let i = 0; i < data.length; i++) {
      const [_, open, high, low, close] = data[i];
      const y_open = priceToY(open);
      const y_close = priceToY(close);
      const isUpBar = y_close > y_open;
      const barHeight = Math.abs(y_close - y_open);

      const isDoji = config.doji?.active && barHeight <= dojiThreshold;
      
      if (!isDoji && barHeight > primaryThreshold && isUpBar === isUpType) {
        candidates.push({ index: i, height: barHeight });
      }
    }
    
    candidates.sort((a, b) => b.height - a.height);
    const maxBars = isUpType ? maxKnives : maxCandles;
    let selectedIndices = candidates.slice(0, maxBars).map(c => c.index);
    
    if (selectedIndices.length === 0) {
      const fallbackCandidates: Array<{ index: number; height: number }> = [];
      
      for (let i = 0; i < data.length; i++) {
        const [_, open, high, low, close] = data[i];
        const y_open = priceToY(open);
        const y_close = priceToY(close);
        const isUpBar = y_close > y_open;
        const barHeight = Math.abs(y_close - y_open);
        
        const isDoji = config.doji?.active && barHeight <= dojiThreshold;
        
        if (!isDoji && barHeight > fallbackThreshold && isUpBar === isUpType) {
          fallbackCandidates.push({ index: i, height: barHeight });
        }
      }
      
      if (fallbackCandidates.length > 0) {
        fallbackCandidates.sort((a, b) => b.height - a.height);
        selectedIndices = [fallbackCandidates[0].index];
      }
    }
    
    return new Set(selectedIndices);
  };
  
  const selectedCandleIndices = findSpecialBars(false);
  const selectedKnifeIndices = findSpecialBars(true);

  // Array to store individual bar canvases
  const barCanvases: UniversalCanvas[] = [];

  // Render each bar separately
  for (let i = 0; i < data.length; i++) {
    const barCanvas = createUniversalCanvas(width, height);
    const barCtx = barCanvas.getContext('2d') as UniversalCanvasContext;
    if (!barCtx) continue;

    barCanvas.width = width;
    barCanvas.height = height;

    // Clear with transparent background
    barCtx.clearRect(0, 0, barCanvas.width, barCanvas.height);

    const [_, open, high, low, close] = data[i];
    const x = indexToX(i);
    const y_open = priceToY(open);
    const y_close = priceToY(close);
    const y_high = priceToY(high);
    const y_low = priceToY(low);

    const barHeight = Math.abs(y_close - y_open);

    // Use the unified renderSingleBar function
    await renderSingleBar({
      ctx: barCtx,
      barIndex: i,
      barData: data[i],
      config,
      x,
      y_open,
      y_close,
      y_high,
      y_low,
      barWidth,
      barHeight,
      dojiThreshold,
      selectedCandleIndices,
      selectedKnifeIndices,
      lineScale,
      barScale,
      centerImages: null, // Don't collect center images, render them directly
    });

    barCanvases.push(barCanvas);
  }

  return barCanvases;
}

// Function to render only background
export async function drawBackground({
  canvas,
  config,
  data,
  tokenInfo,
  interval = 'hour',
  width = 1280,
  height = 1280,
  tokenName,
}: {
  canvas: UniversalCanvas;
  config: ChartConfig;
  data: any[];
  tokenInfo: any;
  interval?: string;
  width?: number;
  height?: number;
  tokenName?: string;
}): Promise<void> {
  const ctx = canvas.getContext('2d') as UniversalCanvasContext;
  if (!ctx) return;

  const isFree = config.free === true;

  canvas.width = width;
  canvas.height = height;

  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw background
  if (config.background.image?.url) {
    try {
      const backgroundImg = await preloadImage(config.background.image.url);
      
      const shouldMirror = config.background.image.mirror === true;
      const processedImg = shouldMirror ? mirrorImage(backgroundImg, config.background.image.url) : backgroundImg;
      
      ctx.drawImage(processedImg, 0, 0, canvas.width, canvas.height);

      if (config.overlay?.color) {
        ctx.save();
        ctx.fillStyle = config.overlay.color;
        ctx.globalAlpha = config.background.opacity || 0;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
      }
    } catch (error) {
      console.error('Error loading background image:', error);
    }
      } else {
    ctx.fillStyle = config.background.color || '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // Chart parameters
  const leftMargin = 100;
  const rightMargin = 100;
  const bottomMargin = 180;

  // Draw text and labels (same as main function)
  ctx.font = `${config.font.size}px "${config.font.family}"`;
  ctx.fillStyle = config.font.color;
  ctx.textBaseline = 'top';

  const timeLabels = Array.from({ length: 5 }, (_, i) => {
    if (i === 4) return 'Now';
    const timestamp = data[0][0] + ((data[data.length - 1][0] - data[0][0]) * i) / 4;
    const timeDiffInSeconds = data[data.length - 1][0] - timestamp;
    const formatAgo = (iv: string): string => {
      const minutesAgo = Math.round(timeDiffInSeconds / 60);
      const hoursAgo = Math.round(timeDiffInSeconds / 3600);
      const daysAgo = Math.round(timeDiffInSeconds / (24 * 3600));
      if (iv === '5m') return `${minutesAgo}m ago`;
      if (iv === '15m' || iv === '30m' || iv === '1h') return `${hoursAgo}h ago`;
      return `${daysAgo}d ago`;
    };
    return formatAgo(interval);
  });

  const labelPositions = Array.from({ length: timeLabels.length }, (_, i) => {
    if (i === 0) return leftMargin + 10;
    if (i === timeLabels.length - 1) return canvas.width - rightMargin - 10;
    return leftMargin + (i * (canvas.width - leftMargin - rightMargin)) / (timeLabels.length - 1);
  });

  const formatMarketCap = (value: number) => {
    if (value >= 1e9) return `MC: $${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `MC: $${(value / 1e6).toFixed(2)}M`;
    if (value >= 1e3) return `MC: $${(value / 1e3).toFixed(2)}K`;
    if (value < 1) return `MC: $${formatPrice(value)}`;
    return `MC: $${value.toFixed(2)}`;
  };

  ctx.shadowColor = 'black';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;

  const topOffset = Math.round(canvas.height * 0.01);

  const changes = [
    { period: '5M', value: tokenInfo.priceChange['5m'] },
    { period: '1H', value: tokenInfo.priceChange['1h'] },
    { period: '6H', value: tokenInfo.priceChange['6h'] },
    { period: '24H', value: tokenInfo.priceChange['24h'] },
  ];

  if (config.display.showTokenName) {
    const tokenNameText = tokenName || config.displayName || tokenInfo?.name || 'Token';
    drawTextWithSubscript(ctx, tokenNameText, leftMargin / 2, topOffset, config.font.size, config.font.color, config.font.family);

    if (config.display.showMarketCap) {
      const mcText = formatMarketCap(tokenInfo.marketCap);
      const tokenNameWidth = ctx.measureText(tokenNameText).width;
      drawTextWithSubscript(ctx, mcText, leftMargin / 2 + tokenNameWidth + 20, topOffset, config.font.size, config.font.color, config.font.family);
    }
  } else if (config.display.showMarketCap) {
    const mcText = formatMarketCap(tokenInfo.marketCap);
    drawTextWithSubscript(ctx, mcText, leftMargin / 2, topOffset, config.font.size, config.font.color, config.font.family);
  }

  if (config.display.showPrice) {
    const priceText = `Price: $${formatPrice(tokenInfo.priceUsd)}`;
    const priceWidth = ctx.measureText(priceText).width;
    drawTextWithSubscript(ctx, priceText, canvas.width - rightMargin / 2 - priceWidth, topOffset, config.font.size, config.font.color, config.font.family);

    if (config.display.showMinMax) {
      const minPrice = Math.min(...data.map((item) => parseFloat(item[3])));
      const maxPrice = Math.max(...data.map((item) => parseFloat(item[2])));
      const minMaxText = `Min/max: $${formatPrice(minPrice)} / $${formatPrice(maxPrice)}`;
      ctx.font = `${config.font.size * 0.8}px "${config.font.family}"`;
      const minMaxWidth = ctx.measureText(minMaxText).width;
      drawTextWithSubscript(ctx, minMaxText, canvas.width - rightMargin / 2 - minMaxWidth, topOffset + config.font.size * 1.2, config.font.size * 0.8, config.font.color, config.font.family);
      ctx.font = `${config.font.size}px "${config.font.family}"`;
    }
  }

  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  if (config.display.showTimeline) {
    timeLabels.forEach((label, i) => {
      const textWidth = ctx.measureText(label).width;
      const yPosition = config.display.showPriceChange
        ? canvas.height - bottomMargin + 50
        : canvas.height - bottomMargin + 110;

      let xPosition = labelPositions[i] - textWidth / 2;
      if (xPosition < leftMargin / 2) xPosition = leftMargin / 2;
      if (xPosition + textWidth > canvas.width - rightMargin / 2)
        xPosition = canvas.width - rightMargin / 2 - textWidth;

      ctx.save();
      ctx.shadowColor = 'black';
      ctx.shadowBlur = 6;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;

      ctx.fillStyle = config.font.color;
      ctx.fillText(label, xPosition, yPosition);
      ctx.restore();
    });
  }

  if (config.display.showTimeline && config.display.showPriceChange) {
    ctx.strokeStyle = 'yellow';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(leftMargin / 2, canvas.height - bottomMargin + 97);
    ctx.lineTo(canvas.width - rightMargin / 2, canvas.height - bottomMargin + 97);
    ctx.stroke();
  }

  if (config.display.showPriceChange) {
    const changeWidth = (canvas.width - leftMargin / 2 - rightMargin / 2) / changes.length;

    changes.forEach((change, i) => {
      const x = leftMargin / 2 + i * changeWidth + changeWidth / 2;
      const text = `${change.period}: ${change.value >= 0 ? '+' : ''}${change.value.toFixed(2)}%`;
      const textWidth = ctx.measureText(text).width;

      let xPosition = x - textWidth / 2;
      if (xPosition < leftMargin / 2) xPosition = leftMargin / 2;
      if (xPosition + textWidth > canvas.width - rightMargin / 2)
        xPosition = canvas.width - rightMargin / 2 - textWidth;

      ctx.save();
      ctx.shadowColor = 'black';
      ctx.shadowBlur = 6;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;

      ctx.fillStyle = change.value > 0 ? config.upBar.color : change.value < 0 ? config.downBar.color : 'yellow';
      ctx.fillText(text, xPosition, canvas.height - bottomMargin + 110);
      ctx.restore();
    });
  }

  // Add watermark if not free
  if (!isFree) {
    ctx.save();
    ctx.globalAlpha = 0.29;
    ctx.font = `bold 45px "${config.font.family}"`;
    ctx.fillStyle = '#ffffff';
    
    const watermarkText = 'tChart.XYZ';
    const textMetrics = ctx.measureText(watermarkText);
    const textHeight = textMetrics.actualBoundingBoxAscent + textMetrics.actualBoundingBoxDescent;
    
    ctx.translate(canvas.width - 48, canvas.height - 25);
    ctx.rotate(-Math.PI / 2);
    
    ctx.fillText(watermarkText, 0, 0);
    ctx.restore();
  }
}

// Возвращает массив типов столбиков для заданных данных и конфига
export function getBarTypes({
  config,
  data,
  width = 1280,
  height = 1280,
}: {
  config: ChartConfig;
  data: any[];
  width?: number;
  height?: number;
}): string[] {
  const leftMargin = 100;
  const rightMargin = 100;
  const topMargin = 180;
  const bottomMargin = 180;
  const chartLeftMargin = leftMargin / 2;
  const chartRightMargin = rightMargin / 2;
  const totalWidth = width - chartLeftMargin - chartRightMargin;
  const barWidth = totalWidth / (data.length * 1.15);
  const gap = barWidth * 0.15;
  const numBars = data.length;
  const lineScale = Math.min(width, height) / 1280;
  const barScale = numBars / 15;
  const bodyPrices = data.flatMap(([timestamp, o, h, l, c]) => [
    typeof o === 'string' ? parseFloat(o) : o || 0,
    typeof c === 'string' ? parseFloat(c) : c || 0,
  ]);
  const maxBodyPrice = Math.max(...bodyPrices);
  const minBodyPrice = Math.min(...bodyPrices);
  const bodyPriceRange = maxBodyPrice - minBodyPrice;
  const maxPrice = maxBodyPrice + bodyPriceRange * 0.01;
  const minPrice = minBodyPrice - bodyPriceRange * 0.01;
  const priceRange = maxPrice - minPrice;
  const priceToY = (price: number | string) => {
    const safePrice = typeof price === 'string' ? parseFloat(price) : price || 0;
    return height - bottomMargin - ((safePrice - minPrice) / priceRange) * (height - topMargin - bottomMargin);
  };
  const dojiThreshold = Math.round(30 * Math.min(2, Math.max(0.5, 15 / data.length)));
  const primaryThreshold = Math.round(300 * Math.min(2, Math.max(0.5, 15 / data.length)));
  const fallbackThreshold = Math.round(200 * Math.min(2, Math.max(0.5, 15 / data.length)));
  const maxCandlesPercent = config.fineTuning?.maxCandles || 10;
  const maxKnivesPercent = config.fineTuning?.maxKnives || 10;
  const maxCandles = Math.round(data.length * maxCandlesPercent / 100);
  const maxKnives = Math.round(data.length * maxKnivesPercent / 100);
  const findSpecialBars = (isUpType: boolean) => {
    const candidates: Array<{ index: number; height: number }> = [];
    for (let i = 0; i < data.length; i++) {
      const [_, open, high, low, close] = data[i];
      const y_open = priceToY(open);
      const y_close = priceToY(close);
      const isUpBar = y_close > y_open;
      const barHeight = Math.abs(y_close - y_open);
      const isDoji = config.doji?.active && barHeight <= dojiThreshold;
      if (!isDoji && barHeight > primaryThreshold && isUpBar === isUpType) {
        candidates.push({ index: i, height: barHeight });
      }
    }
    candidates.sort((a, b) => b.height - a.height);
    const maxBars = isUpType ? maxKnives : maxCandles;
    let selectedIndices = candidates.slice(0, maxBars).map(c => c.index);
    if (selectedIndices.length === 0) {
      const fallbackCandidates: Array<{ index: number; height: number }> = [];
      for (let i = 0; i < data.length; i++) {
        const [_, open, high, low, close] = data[i];
        const y_open = priceToY(open);
        const y_close = priceToY(close);
        const isUpBar = y_close > y_open;
        const barHeight = Math.abs(y_close - y_open);
        const isDoji = config.doji?.active && barHeight <= dojiThreshold;
        if (!isDoji && barHeight > fallbackThreshold && isUpBar === isUpType) {
          fallbackCandidates.push({ index: i, height: barHeight });
        }
      }
      if (fallbackCandidates.length > 0) {
        fallbackCandidates.sort((a, b) => b.height - a.height);
        selectedIndices = [fallbackCandidates[0].index];
      }
    }
    return new Set(selectedIndices);
  };
  const selectedCandleIndices = findSpecialBars(false);
  const selectedKnifeIndices = findSpecialBars(true);
  const types: string[] = [];
  for (let i = 0; i < data.length; i++) {
    const [_, open, high, low, close] = data[i];
    const y_open = priceToY(open);
    const y_close = priceToY(close);
    const barHeight = Math.abs(y_close - y_open);
      const isDoji = config.doji?.active && barHeight <= dojiThreshold;
      const useCandle = !isDoji && selectedCandleIndices.has(i);
      const useKnife = !isDoji && selectedKnifeIndices.has(i);
    if (isDoji) {
      types.push('doji');
    } else if (useCandle) {
      types.push('candle');
    } else if (useKnife) {
      types.push('knife');
        } else {
      types.push(y_close > y_open ? 'up' : 'down');
    }
  }
  return types;
}

// Unified function to render a single bar
async function renderSingleBar({
  ctx,
  barIndex,
  barData,
  config,
  x,
  y_open,
  y_close,
  y_high,
  y_low,
  barWidth,
  barHeight,
  dojiThreshold,
  selectedCandleIndices,
  selectedKnifeIndices,
  lineScale,
  barScale,
  centerImages = null,
}: {
  ctx: UniversalCanvasContext;
  barIndex: number;
  barData: any[];
  config: ChartConfig;
  x: number;
  y_open: number;
  y_close: number;
  y_high: number;
  y_low: number;
  barWidth: number;
  barHeight: number;
  dojiThreshold: number;
  selectedCandleIndices: Set<number>;
  selectedKnifeIndices: Set<number>;
  lineScale: number;
  barScale: number;
  centerImages?: Array<any> | null;
}): Promise<void> {
  const [_, open, high, low, close] = barData;
  const isUpBar = y_close > y_open;

  // Определяем тип бара с учетом новой логики
  const isDoji = config.doji?.active && barHeight <= dojiThreshold;
  const useCandle = !isDoji && selectedCandleIndices.has(barIndex);
  const useKnife = !isDoji && selectedKnifeIndices.has(barIndex);
      
      let barConfig;
      if (isDoji) {
        barConfig = config.doji!;
      } else if (useCandle) {
        barConfig = config.candle;
      } else if (useKnife) {
        barConfig = config.knife;
      } else {
        barConfig = !isUpBar ? config.upBar : config.downBar;
      }

      const fillDirection = useCandle || !isUpBar ? 'bottom-to-top' : 'top-to-bottom';

  // Центральные изображения для всех типов баров
      if ((barConfig as ExtendedBarConfig).center?.url) {
    if (centerImages) {
      // Добавляем в массив для последующего рендеринга (основная функция drawChart)
        centerImages.push({
          x,
          y: (y_open + y_close) / 2,
          config: (barConfig as ExtendedBarConfig).center,
          barWidth,
        });
    }
    // Для отдельных столбиков центральные изображения будут рендериться в конце функции
      }

      // Draw High/Low lines using new configuration
      const barTypeStr = isDoji ? 'doji' : useCandle ? 'candle' : useKnife ? 'knife' : isUpBar ? 'downBar' : 'upBar';
      const lineConfig = config.highLowLines?.[barTypeStr];
      
      if (config.highLowLines && (config.highLowLines.lineWidth || 0) > 0) {
    ctx.beginPath();
    ctx.strokeStyle = lineConfig?.lineColor || barConfig.color;
    ctx.lineWidth = (config.highLowLines.lineWidth || 1) * lineScale / barScale;
    ctx.moveTo(x + barWidth / 2, y_high);
    ctx.lineTo(x + barWidth / 2, y_low);
    ctx.stroke();
  }

        // Для doji баров обеспечиваем минимальную высоту в 2 пикселя
      let actualBarHeight = isDoji ? Math.max(2, Math.abs(y_close - y_open)) : Math.abs(y_close - y_open);
      let actualBarY = isDoji ? Math.min(y_open, y_close) - 1 : Math.min(y_open, y_close);

      // Выбираем эффекты с учётом режима applyToAll
      const applyToAllBorders = config.borders?.applyToAll ?? true;
      const styleCfg: any = applyToAllBorders ? {} : (config.borders as any)?.[barTypeStr] || {};
      const topBevelPercent = (styleCfg.topBevel !== undefined ? styleCfg.topBevel : (config.borders?.topBevel ?? 0));
      const bottomBevelPercent = (styleCfg.bottomBevel !== undefined ? styleCfg.bottomBevel : (config.borders?.bottomBevel ?? 0));
      const topRound = (styleCfg.topRound !== undefined ? styleCfg.topRound : (config.borders?.topRound ?? true));
      const bottomRound = (styleCfg.bottomRound !== undefined ? styleCfg.bottomRound : (config.borders?.bottomRound ?? true));
      const topBevelLength = barWidth * (topBevelPercent / 100);
      const bottomBevelLength = barWidth * (bottomBevelPercent / 100);
      const topOuterRadius = Math.min(topBevelLength / 2, barWidth / 2);
      const bottomOuterRadius = Math.min(bottomBevelLength / 2, barWidth / 2);

      // Ограничиваем скосы по ширине столбика
      const maxTopBevelLength = Math.min(topBevelLength, barWidth / 2);
      const maxBottomBevelLength = Math.min(bottomBevelLength, barWidth / 2);
      
      // Учитываем толщину границы при расчете минимальной высоты
      const baseBW = (config.borders?.borderWidth || 0);
      const perBarBW = applyToAllBorders ? undefined : (styleCfg.borderWidth !== undefined ? styleCfg.borderWidth : undefined);
      const borderWidth = config.borders ? (perBarBW || 0) * lineScale / barScale : 0;
      const minRequiredHeight = maxTopBevelLength + maxBottomBevelLength + borderWidth;
      
      // Если скосы + граница больше высоты столбика, увеличиваем высоту столбика
      if (minRequiredHeight > actualBarHeight) {
        const heightIncrease = minRequiredHeight - actualBarHeight;
        actualBarHeight = minRequiredHeight;
        actualBarY -= heightIncrease; // Сдвигаем верх столбика вверх
      }
      
      ctx.save();
      
      // Учитываем толщину границы для более точного клипинга
      const clipBorderWidth = config.borders ? ((perBarBW !== undefined ? perBarBW : baseBW) || 0) * lineScale / barScale : 0;
      const clipInset = clipBorderWidth > 0 ? clipBorderWidth / 12 : 0; // Небольшой отступ для учета круглой кисти делим на 12
      
      const clipX = x + clipInset;
      const clipY = actualBarY + clipInset;
      const clipWidth = barWidth - clipInset * 2;
      const clipHeight = actualBarHeight - clipInset * 2;
      const clipMaxTopBevelLength = Math.max(0, maxTopBevelLength - clipInset);
      const clipMaxBottomBevelLength = Math.max(0, maxBottomBevelLength - clipInset);
      const clipTopRadius = Math.max(0, topOuterRadius - clipInset);
      const clipBottomRadius = Math.max(0, bottomOuterRadius - clipInset);
      
      ctx.beginPath();
      // Начинаем с левого нижнего угла
      const startBottomBevelLength = clipMaxBottomBevelLength * (bottomBevelPercent / 100);
      ctx.moveTo(clipX, clipY + clipHeight - startBottomBevelLength);
      
      // Нижний левый скос
      if (bottomBevelPercent > 0) {
        if (bottomRound) {
          ctx.arcTo(clipX, clipY + clipHeight, clipX + clipMaxBottomBevelLength, clipY + clipHeight, clipBottomRadius);
        } else {
          // Острый скос под 45 градусов с учетом процента
          const bevelLength = clipMaxBottomBevelLength * (bottomBevelPercent / 100);
          ctx.lineTo(clipX + bevelLength, clipY + clipHeight);
        }
      } else {
        ctx.lineTo(clipX, clipY + clipHeight);
      }
      
      // Нижняя граница
      if (bottomBevelPercent >= 100 && !bottomRound) {
        // При зубце нет нижней границы - сразу к правому скосу
      } else {
        const bevelLength = clipMaxBottomBevelLength * (bottomBevelPercent / 100);
        ctx.lineTo(clipX + clipWidth - bevelLength, clipY + clipHeight);
      }
      
      // Нижний правый скос
      if (bottomBevelPercent > 0) {
        if (bottomRound) {
          ctx.arcTo(clipX + clipWidth, clipY + clipHeight, clipX + clipWidth, clipY + clipHeight - clipMaxBottomBevelLength, clipBottomRadius);
        } else {
          // Острый скос под 45 градусов с учетом процента
          const bevelLength = clipMaxBottomBevelLength * (bottomBevelPercent / 100);
          ctx.lineTo(clipX + clipWidth, clipY + clipHeight - bevelLength);
        }
      } else {
        ctx.lineTo(clipX + clipWidth, clipY + clipHeight);
      }
      
      // Правая граница
      const clipTopBevelLength = clipMaxTopBevelLength * (topBevelPercent / 100);
      ctx.lineTo(clipX + clipWidth, clipY + clipTopBevelLength);
      
      // Верхний правый скос
      if (topBevelPercent > 0) {
        if (topRound) {
          ctx.arcTo(clipX + clipWidth, clipY, clipX + clipWidth - clipMaxTopBevelLength, clipY, clipTopRadius);
        } else {
          // Острый скос под 45 градусов с учетом процента
          ctx.lineTo(clipX + clipWidth - clipTopBevelLength, clipY);
        }
      } else {
        ctx.lineTo(clipX + clipWidth, clipY);
      }
      
      // Верхняя граница
      if (topBevelPercent >= 100 && !topRound) {
        // При зубце нет верхней границы - сразу к левому скосу
      } else {
        const bevelLength = clipMaxTopBevelLength * (topBevelPercent / 100);
        ctx.lineTo(clipX + bevelLength, clipY);
      }
      
      // Верхний левый скос
      if (topBevelPercent > 0) {
        if (topRound) {
          ctx.arcTo(clipX, clipY, clipX, clipY + clipMaxTopBevelLength, clipTopRadius);
        } else {
          // Острый скос под 45 градусов с учетом процента
          const bevelLength = clipMaxTopBevelLength * (topBevelPercent / 100);
          ctx.lineTo(clipX, clipY + bevelLength);
        }
      } else {
        ctx.lineTo(clipX, clipY);
      }
      
      // Левая граница
      const clipBottomBevelLength = clipMaxBottomBevelLength * (bottomBevelPercent / 100);
      ctx.lineTo(clipX, clipY + clipHeight - clipBottomBevelLength);
      
      ctx.closePath();
      ctx.clip();

  // Draw bar body with full logic from main function
      if (barConfig.body?.url) {
        try {
          const bodyImg = await preloadImage(barConfig.body.url);
          const bodyHeight = Math.max(1, Math.abs(barHeight));
          const bodyWidth = Math.max(1, barWidth);
          const bodyY = Math.min(y_open, y_close);
          const scale = barConfig.body?.scale || 1;
          const rotation = barConfig.body?.rotation || 0;
          const offsetX = barConfig.body?.offsetX || 0;
          const startFrom = barConfig.body?.startFrom || 'top';
          const overlap = barConfig.body?.overlap !== undefined ? barConfig.body.overlap / 100 : 0.02;
          const hue = barConfig.body?.hue || 0;
          const shouldMirror = barConfig.body?.mirror === true;

          let processedImg = bodyImg;
          if (hue) {
            processedImg = applyHueToImage(processedImg, hue, barConfig.body.url);
          }
          if (shouldMirror) {
            processedImg = mirrorImage(processedImg, barConfig.body.url);
          }

          const tempCanvas = createUniversalCanvas(
            Math.sqrt(bodyImg.width * bodyImg.width + bodyImg.height * bodyImg.height),
            Math.sqrt(bodyImg.width * bodyImg.width + bodyImg.height * bodyImg.height)
          );
          const tempCtx = tempCanvas.getContext('2d') as UniversalCanvasContext;
          if (!tempCtx) return;

          tempCtx.save();
          tempCtx.translate(tempCanvas.width / 2, tempCanvas.height / 2);
          tempCtx.rotate((rotation * Math.PI) / 180);
          tempCtx.drawImage(processedImg, -bodyImg.width / 2, -bodyImg.height / 2);
          tempCtx.restore();

          const rotatedWidth =
            Math.abs(bodyImg.width * Math.cos(rotation * Math.PI / 180)) +
            Math.abs(bodyImg.height * Math.sin(rotation * Math.PI / 180));
          const rotatedHeight =
            Math.abs(bodyImg.width * Math.sin(rotation * Math.PI / 180)) +
            Math.abs(bodyImg.height * Math.cos(rotation * Math.PI / 180));

          const imgRatio = rotatedWidth / rotatedHeight;
          const scaledWidth = bodyWidth;
          const scaledHeight = scaledWidth / imgRatio;
          const finalScaledHeight = scaledHeight * scale;

          if (startFrom === 'fill') {
            const visibleTileHeight = finalScaledHeight * (1 - overlap);
            const numTilesFloat = bodyHeight / visibleTileHeight;
            const numTiles = Math.floor(numTilesFloat);

            if (numTiles <= 1) {
          ctx.drawImage(
                tempCanvas,
                (tempCanvas.width - rotatedWidth) / 2,
                (tempCanvas.height - rotatedHeight) / 2,
                rotatedWidth,
                rotatedHeight,
                x + offsetX * lineScale / barScale,
                bodyY,
                bodyWidth,
                bodyHeight
              );
            } else {
              const totalTilesHeight = numTiles * finalScaledHeight - (numTiles - 1) * (finalScaledHeight * overlap);
              const scaleFactor = bodyHeight / totalTilesHeight;
              const adjustedTileHeight = finalScaledHeight * scaleFactor;

              for (let j = 0; j < numTiles; j++) {
                let tileIndex = fillDirection === 'bottom-to-top' ? numTiles - j - 1 : j;
                const tileY = bodyY + tileIndex * adjustedTileHeight * (1 - overlap);

            ctx.drawImage(
                  tempCanvas,
                  (tempCanvas.width - rotatedWidth) / 2,
                  (tempCanvas.height - rotatedHeight) / 2,
                  rotatedWidth,
                  rotatedHeight,
                  x + offsetX * lineScale / barScale,
                  tileY,
                  bodyWidth,
                  adjustedTileHeight
                );
              }
            }
          } else {
            const visibleTileHeight = finalScaledHeight * (1 - overlap);
            const numTilesFloat = bodyHeight / visibleTileHeight;
            const numTiles = Math.ceil(numTilesFloat);

            for (let j = 0; j < numTiles; j++) {
              let tileIndex = fillDirection === 'bottom-to-top' ? numTiles - j - 1 : j;
          let destY = bodyY + tileIndex * visibleTileHeight;

          if (startFrom === 'bottom') {
            destY = bodyY + bodyHeight - (j + 1) * visibleTileHeight;
            if (fillDirection === 'top-to-bottom') {
              tileIndex = j;
            } else {
              tileIndex = numTiles - j - 1;
            }
          }

              let sourceY = (tempCanvas.height - rotatedHeight) / 2;
              let sourceHeight = rotatedHeight;
              let destHeight = finalScaledHeight;

          if (destY < bodyY) {
                const clipTop = bodyY - destY;
                const sourceClipRatio = clipTop / destHeight;
                sourceY += sourceHeight * sourceClipRatio;
                sourceHeight -= sourceHeight * sourceClipRatio;
                destY = bodyY;
            destHeight -= clipTop;
              }

              if (
                destY + destHeight > bodyY + bodyHeight &&
                !(
                  startFrom === 'bottom' &&
                  ((fillDirection === 'top-to-bottom' && j === numTiles - 1) || (fillDirection === 'bottom-to-top' && j === 0))
                )
              ) {
                const clipBottom = destY + destHeight - (bodyY + bodyHeight);
                const sourceClipRatio = clipBottom / destHeight;
                sourceHeight -= sourceHeight * sourceClipRatio;
                destHeight -= clipBottom;
              }

          ctx.drawImage(
                tempCanvas,
                (tempCanvas.width - rotatedWidth) / 2,
                sourceY,
                rotatedWidth,
                sourceHeight,
                x + offsetX * lineScale / barScale,
                destY,
                bodyWidth,
                destHeight
              );
            }
          }
        } catch (error) {
          console.error('Error loading body image:', error);
      ctx.fillStyle = barConfig.color;
      ctx.fillRect(x, actualBarY, barWidth, actualBarHeight);
        }
      } else {
    ctx.fillStyle = barConfig.color;
    ctx.fillRect(x, actualBarY, barWidth, actualBarHeight);
      }

  ctx.restore();

            // Draw borders using new configuration
      const borderTypeStr = isDoji ? 'doji' : useCandle ? 'candle' : useKnife ? 'knife' : isUpBar ? 'downBar' : 'upBar';
      const borderConfig = (config.borders as any)?.[borderTypeStr];
      const borderEnabled = borderConfig?.enabled !== false; // по умолчанию включено
      
      if (config.borders && (((perBarBW || 0) > 0) || ((config.borders.borderWidth || 0) > 0 && (applyToAllBorders || borderConfig?.borderWidth === undefined))) && borderEnabled) {
        const effectiveBW = (perBarBW !== undefined ? perBarBW : (config.borders.borderWidth || 1));
        const borderWidth = (effectiveBW || 1) * lineScale / barScale;
        const borderSides = ((applyToAllBorders ? undefined : styleCfg.borderSides) || config.borders.borderSides) || { top: true, bottom: true, left: true, right: true };
        
        ctx.strokeStyle = borderConfig?.borderColor || barConfig.color;
        ctx.lineWidth = borderWidth;
        ctx.lineJoin = 'round'; // Обеспечивает плавное соединение сегментов
        ctx.lineCap = 'round';

        const halfB = borderWidth / 2;
        const innerX = x + halfB;
        const innerY = actualBarY + halfB;
        const innerWidth = barWidth - borderWidth;
        const innerHeight = actualBarHeight - borderWidth;

        const topBevelPercent = (applyToAllBorders ? (config.borders?.topBevel ?? 0) : (styleCfg.topBevel !== undefined ? styleCfg.topBevel : (config.borders?.topBevel ?? 0)));
        const bottomBevelPercent = (applyToAllBorders ? (config.borders?.bottomBevel ?? 0) : (styleCfg.bottomBevel !== undefined ? styleCfg.bottomBevel : (config.borders?.bottomBevel ?? 0)));
        const topRound = (applyToAllBorders ? (config.borders?.topRound ?? true) : (styleCfg.topRound !== undefined ? styleCfg.topRound : (config.borders?.topRound ?? true)));
        const bottomRound = (applyToAllBorders ? (config.borders?.bottomRound ?? true) : (styleCfg.bottomRound !== undefined ? styleCfg.bottomRound : (config.borders?.bottomRound ?? true)));
        const innerTopBevelLength = innerWidth * (topBevelPercent / 100);
        const innerBottomBevelLength = innerWidth * (bottomBevelPercent / 100);
        // Используем радиусы, уменьшенные на толщину границы относительно клипинга
        const borderHalfWidth = borderWidth / 2;
        const innerTopRadius = Math.max(0, topOuterRadius - borderHalfWidth);
        const innerBottomRadius = Math.max(0, bottomOuterRadius - borderHalfWidth);

        // Ограничиваем скосы по ширине столбика (высота уже была увеличена выше, если нужно)
        const maxTopBevelLength = Math.min(innerTopBevelLength, innerWidth / 2);
        const maxBottomBevelLength = Math.min(innerBottomBevelLength, innerWidth / 2);
        
        const path = {
            // Нижние углы
            bl_start: { x: innerX, y: innerY + innerHeight - maxBottomBevelLength },
            bl_corner: { x: innerX, y: innerY + innerHeight },
            bl_end: { x: innerX + maxBottomBevelLength, y: innerY + innerHeight },
            br_start: { x: innerX + innerWidth - maxBottomBevelLength, y: innerY + innerHeight },
            br_corner: { x: innerX + innerWidth, y: innerY + innerHeight },
            br_end: { x: innerX + innerWidth, y: innerY + innerHeight - maxBottomBevelLength },
            
            // Верхние углы
            tl_start: { x: innerX, y: innerY + maxTopBevelLength },
            tl_corner: { x: innerX, y: innerY },
            tl_end: { x: innerX + maxTopBevelLength, y: innerY },
            tr_start: { x: innerX + innerWidth - maxTopBevelLength, y: innerY },
            tr_corner: { x: innerX + innerWidth, y: innerY },
            tr_end: { x: innerX + innerWidth, y: innerY + maxTopBevelLength }
        };

        // Рисуем каждую сторону границы отдельно для точного контроля
        
        // Левая граница
        if (borderSides.left) {
            ctx.beginPath();
            let startY = innerY + innerHeight;
            let endY = innerY;
            
            // Корректируем точки соединения с скосами и дугами
            if (bottomBevelPercent > 0) {
                const bottomBevelLength = maxBottomBevelLength * (bottomBevelPercent / 100);
                if (bottomRound) {
                    startY = innerY + innerHeight - innerBottomRadius;
                } else {
                    startY = innerY + innerHeight - bottomBevelLength;
                }
            }
            if (topBevelPercent > 0) {
                const topBevelLength = maxTopBevelLength * (topBevelPercent / 100);
                if (topRound) {
                    endY = innerY + innerTopRadius;
                } else {
                    endY = innerY + topBevelLength;
                }
            }
            
            ctx.moveTo(innerX, startY);
            ctx.lineTo(innerX, endY);
            ctx.stroke();
        }
        
        // Правая граница
        if (borderSides.right) {
            ctx.beginPath();
            let startY = innerY;
            let endY = innerY + innerHeight;
            
            // Корректируем точки соединения с скосами и дугами
            if (topBevelPercent > 0) {
                const topBevelLength = maxTopBevelLength * (topBevelPercent / 100);
                if (topRound) {
                    startY = innerY + innerTopRadius;
                } else {
                    startY = innerY + topBevelLength;
                }
            }
            if (bottomBevelPercent > 0) {
                const bottomBevelLength = maxBottomBevelLength * (bottomBevelPercent / 100);
                if (bottomRound) {
                    endY = innerY + innerHeight - innerBottomRadius;
                } else {
                    endY = innerY + innerHeight - bottomBevelLength;
                }
            }
            
            ctx.moveTo(innerX + innerWidth, startY);
            ctx.lineTo(innerX + innerWidth, endY);
            ctx.stroke();
        }
        
        // Верхняя граница
        if (borderSides.top) {
            ctx.beginPath();
            let startX = innerX;
            let endX = innerX + innerWidth;
            
            // Корректируем точки соединения с скосами и дугами
            if (topBevelPercent > 0) {
                const bevelLength = maxTopBevelLength * (topBevelPercent / 100);
                if (topRound) {
                    startX = innerX + innerTopRadius;
                    endX = innerX + innerWidth - innerTopRadius;
                } else {
                    startX = innerX + bevelLength;
                    endX = innerX + innerWidth - bevelLength;
                }
            }
            
            ctx.moveTo(startX, innerY);
            ctx.lineTo(endX, innerY);
            ctx.stroke();
        }
        
        // Нижняя граница
        if (borderSides.bottom) {
            ctx.beginPath();
            let startX = innerX;
            let endX = innerX + innerWidth;
            
            // Корректируем точки соединения с скосами и дугами
            if (bottomBevelPercent > 0) {
                const bevelLength = maxBottomBevelLength * (bottomBevelPercent / 100);
                if (bottomRound) {
                    startX = innerX + innerBottomRadius;
                    endX = innerX + innerWidth - innerBottomRadius;
                } else {
                    startX = innerX + bevelLength;
                    endX = innerX + innerWidth - bevelLength;
                }
            }
            
            ctx.moveTo(startX, innerY + innerHeight);
            ctx.lineTo(endX, innerY + innerHeight);
            ctx.stroke();
        }
        
        // Рисуем скругления отдельно, используя внутренние радиусы
        if (topBevelPercent > 0 && topRound) {
            // Верхний левый скос
            if (borderSides.top) { 
                ctx.beginPath();
                ctx.arc(innerX + innerTopRadius, innerY + innerTopRadius, innerTopRadius, Math.PI, 1.5 * Math.PI);
                ctx.stroke();
            }
            
            // Верхний правый скос
            if (borderSides.top) {
                ctx.beginPath();
                ctx.arc(innerX + innerWidth - innerTopRadius, innerY + innerTopRadius, innerTopRadius, 1.5 * Math.PI, 2 * Math.PI);
                ctx.stroke();
            }
        }
        
        if (bottomBevelPercent > 0 && bottomRound) {
            // Нижний левый скос
            if (borderSides.bottom) {
                ctx.beginPath();
                ctx.arc(innerX + innerBottomRadius, innerY + innerHeight - innerBottomRadius, innerBottomRadius, 0.5 * Math.PI, Math.PI);
                ctx.stroke();
            }
            
            // Нижний правый скос
            if (borderSides.bottom) {
                ctx.beginPath();
                ctx.arc(innerX + innerWidth - innerBottomRadius, innerY + innerHeight - innerBottomRadius, innerBottomRadius, 0, 0.5 * Math.PI);
                ctx.stroke();
            }
        }
        
        // Рисуем острые скосы (без округления) под 45 градусов
        if (topBevelPercent > 0 && !topRound) {
            // Длина скоса зависит от процента: 0% = нет скоса, 100% = максимальный скос
            const bevelLength = maxTopBevelLength * (topBevelPercent / 100);
            
            // Верхний левый скос
            if (borderSides.top) {
                ctx.beginPath();
                ctx.moveTo(innerX, innerY + bevelLength*0.95);
                ctx.lineTo(innerX + bevelLength*0.95, innerY);
                ctx.stroke();
            }
            
            // Верхний правый скос
            if (borderSides.top) {
                ctx.beginPath();
                ctx.moveTo(innerX + innerWidth - bevelLength*0.95, innerY);
                ctx.lineTo(innerX + innerWidth, innerY + bevelLength*0.95);
                ctx.stroke();
            }
        }
        
        if (bottomBevelPercent > 0 && !bottomRound) {
            // Длина скоса зависит от процента: 0% = нет скоса, 100% = максимальный скос
            const bevelLength = maxBottomBevelLength * (bottomBevelPercent / 100);
            
            // Нижний левый скос
            if (borderSides.bottom) {
                ctx.beginPath();
                ctx.moveTo(innerX + bevelLength*0.95, innerY + innerHeight);
                ctx.lineTo(innerX, innerY + innerHeight - bevelLength*0.95);
                ctx.stroke();
            }
            
            // Нижний правый скос
            if ( borderSides.bottom) {
                ctx.beginPath();
                ctx.moveTo(innerX + innerWidth, innerY + innerHeight - bevelLength*0.95);
                ctx.lineTo(innerX + innerWidth - bevelLength*0.95, innerY + innerHeight);
                ctx.stroke();
            }
        }
      }

  // Draw top and bottom images
      for (const part of ['top', 'bottom'] as const) {
        const imgConfig = barConfig[part];
        if (imgConfig?.url) {
          try {
            const img = await preloadImage(imgConfig.url);
            const scale = (imgConfig.scale || 1) * lineScale / barScale;
            const offsetX = (imgConfig.offsetX || 0) * lineScale / barScale;
            const offsetY = (imgConfig.offsetY || 0) * lineScale / barScale;
            const rotation = imgConfig.rotation || 0;
            const hue = imgConfig.hue || 0;
            const shouldMirror = imgConfig.mirror === true;

            let processedImg = img;
            if (hue) {
              processedImg = applyHueToImage(processedImg, hue, imgConfig.url);
            }
            if (shouldMirror) {
              processedImg = mirrorImage(processedImg, imgConfig.url);
            }

            const scaledWidth = img.width * scale;
            const scaledHeight = img.height * scale;

        ctx.save();
            const centerX = x + (barWidth - scaledWidth) / 2 + offsetX + scaledWidth / 2;
            const centerY =
              part === 'top'
                ? Math.min(y_open, y_close) - scaledHeight + offsetY + scaledHeight / 2
                : Math.max(y_open, y_close) + offsetY + scaledHeight / 2;
        ctx.translate(centerX, centerY);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.translate(-scaledWidth / 2, -scaledHeight / 2);

        ctx.drawImage(processedImg, 0, 0, scaledWidth, scaledHeight);
        ctx.restore();
          } catch (error) {
            console.error(`Error loading ${part} image:`, error);
        }
      }
    }

  // Рендерим центральные изображения в конце (для отдельных столбиков)
  if (!centerImages && (barConfig as ExtendedBarConfig).center?.url) {
      try {
      const imgConfig = (barConfig as ExtendedBarConfig).center!;
        const img = await preloadImage(imgConfig.url);
        const scale = (imgConfig.scale || 1) * lineScale / barScale;
        const offsetX = (imgConfig.offsetX || 0) * lineScale / barScale;
        const offsetY = (imgConfig.offsetY || 0) * lineScale / barScale;
        const rotation = imgConfig.rotation || 0;
        const hue = imgConfig.hue || 0;
        const shouldMirror = imgConfig.mirror === true;

        let processedImg = img;
        if (hue) {
          processedImg = applyHueToImage(processedImg, hue, imgConfig.url);
        }
        if (shouldMirror) {
          processedImg = mirrorImage(processedImg, imgConfig.url);
        }

        const scaledWidth = img.width * scale;
        const scaledHeight = img.height * scale;

      ctx.save();
        const centerX = x + (barWidth - scaledWidth) / 2 + offsetX + scaledWidth / 2;
      const centerY = (y_open + y_close) / 2 - scaledHeight / 2 + offsetY + scaledHeight / 2;
      ctx.translate(centerX, centerY);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.translate(-scaledWidth / 2, -scaledHeight / 2);

      ctx.drawImage(processedImg, 0, 0, scaledWidth, scaledHeight);
      ctx.restore();
      } catch (error) {
        console.error('Error loading center image:', error);
      }
    }
}