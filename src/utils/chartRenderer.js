"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderChart = renderChart;
const canvas_1 = require("canvas");
// Вспомогательные функции
function priceToY(price, height, minPrice, priceRange, topMargin, bottomMargin) {
    return height - bottomMargin - ((price - minPrice) / priceRange) * (height - topMargin - bottomMargin);
}
function indexToX(index, leftMargin, barWidth, gap) {
    return leftMargin + index * (barWidth + gap);
}
// Функция предзагрузки изображения
async function preloadImage(url) {
    return (0, canvas_1.loadImage)(url);
}
// Основная функция отрисовки графика
async function renderChart({ config, data, tokenInfo, interval = 'hour', width = 1280, height = 1280 }) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    // Создаем canvas
    const canvas = (0, canvas_1.createCanvas)(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx)
        throw new Error('Failed to get canvas context');
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
    const baseScaleMultiplier = 8 / ((data === null || data === void 0 ? void 0 : data.length) || 8);
    const scaleRatio = tokenInfo ? (24 / data.length) : 1;
    // Находим минимальную и максимальную цены
    const prices = data.flatMap(d => {
        // Проверяем формат данных
        if (Array.isArray(d)) {
            return [
                typeof d[1] === 'string' ? parseFloat(d[1]) : d[1], // open
                typeof d[2] === 'string' ? parseFloat(d[2]) : d[2], // high
                typeof d[3] === 'string' ? parseFloat(d[3]) : d[3], // low
                typeof d[4] === 'string' ? parseFloat(d[4]) : d[4] // close
            ];
        }
        else {
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
    if ((_a = config.background.image) === null || _a === void 0 ? void 0 : _a.url) {
        try {
            const backgroundImg = await preloadImage(config.background.image.url);
            ctx.drawImage(backgroundImg, 0, 0, canvas.width, canvas.height);
            if (config.background.image.opacity) {
                ctx.save();
                ctx.fillStyle = config.background.color || '#000000';
                ctx.globalAlpha = 1 - (config.background.image.opacity || 0);
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.restore();
            }
        }
        catch (error) {
            console.error('Error loading background image:', error);
            ctx.fillStyle = config.background.color || '#000000';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
    }
    else {
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
        if (!barConfig)
            continue;
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
        if ((_b = barConfig.body) === null || _b === void 0 ? void 0 : _b.url) {
            try {
                const bodyImg = await preloadImage(barConfig.body.url);
                const bodyHeight = Math.max(1, Math.abs(barHeight));
                const bodyWidth = Math.max(1, barWidth);
                const bodyY = Math.min(y_open, y_close);
                const scale = ((_c = barConfig.body) === null || _c === void 0 ? void 0 : _c.scale) || 1;
                const imgRatio = (bodyImg.width / bodyImg.height) * scale;
                const scaledWidth = bodyWidth;
                const scaledHeight = bodyWidth / imgRatio;
                const startFrom = ((_d = barConfig.body) === null || _d === void 0 ? void 0 : _d.startFrom) || 'top';
                if (startFrom === 'fill') {
                    const tileHeight = scaledHeight * 0.98;
                    const numTiles = Math.max(1, Math.ceil(bodyHeight / tileHeight));
                    const adjustedTileHeight = bodyHeight / numTiles + (scaledHeight * 0.02);
                    for (let j = 0; j < numTiles; j++) {
                        ctx.drawImage(bodyImg, x + (((_e = barConfig.body) === null || _e === void 0 ? void 0 : _e.offsetX) || 0), bodyY + j * (adjustedTileHeight - scaledHeight * 0.02), bodyWidth, adjustedTileHeight);
                    }
                }
                else {
                    const repetitions = Math.ceil(bodyHeight / (scaledHeight * 0.98)) + 1;
                    let currentY = startFrom === 'top' ? bodyY : bodyY + bodyHeight - scaledHeight;
                    for (let j = 0; j < repetitions; j++) {
                        if (startFrom === 'top' && currentY + scaledHeight > bodyY + bodyHeight) {
                            const remainingHeight = bodyY + bodyHeight - currentY;
                            ctx.drawImage(bodyImg, 0, 0, bodyImg.width, bodyImg.height * (remainingHeight / scaledHeight), x + (((_f = barConfig.body) === null || _f === void 0 ? void 0 : _f.offsetX) || 0), currentY, bodyWidth, remainingHeight);
                            break;
                        }
                        else if (startFrom === 'bottom' && currentY < bodyY) {
                            const remainingHeight = scaledHeight - (bodyY - currentY);
                            ctx.drawImage(bodyImg, 0, bodyImg.height - (bodyImg.height * (remainingHeight / scaledHeight)), bodyImg.width, bodyImg.height * (remainingHeight / scaledHeight), x + (((_g = barConfig.body) === null || _g === void 0 ? void 0 : _g.offsetX) || 0), bodyY, bodyWidth, remainingHeight);
                            break;
                        }
                        ctx.drawImage(bodyImg, x + (((_h = barConfig.body) === null || _h === void 0 ? void 0 : _h.offsetX) || 0), currentY, bodyWidth, scaledHeight);
                        currentY += startFrom === 'top' ? (scaledHeight * 0.98) : -(scaledHeight * 0.98);
                    }
                }
            }
            catch (error) {
                console.error('Error loading body image:', error);
                ctx.fillStyle = barConfig.color;
                ctx.fillRect(x, Math.min(y_open, y_close), barWidth, Math.abs(y_close - y_open));
            }
        }
        else {
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
                ctx.strokeRect(x + halfBorder, Math.min(y_open, y_close) + halfBorder, barWidth - borderWidth, Math.abs(y_close - y_open) - borderWidth);
            }
            else {
                const offset = borderWidth / 2;
                ctx.strokeRect(x - offset, Math.min(y_open, y_close) - offset, barWidth + borderWidth, Math.abs(y_close - y_open) + borderWidth);
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
    const formatMarketCap = (value) => {
        if (value >= 1e9) {
            return `MC: $${(value / 1e9).toFixed(2)}B`;
        }
        else if (value >= 1e6) {
            return `MC: $${(value / 1e6).toFixed(2)}M`;
        }
        else if (value >= 1e3) {
            return `MC: $${(value / 1e3).toFixed(2)}K`;
        }
        else {
            return `MC: $${value.toFixed(2)}`;
        }
    };
    // Временные метки
    const timeLabels = tokenInfo
        ? Array.from({ length: 5 }, (_, i) => {
            if (i === 4)
                return 'Now';
            const timestamp = data[0].timestamp + ((data[data.length - 1].timestamp - data[0].timestamp) * i) / 4;
            const timeDiffInSeconds = data[data.length - 1].timestamp - timestamp;
            const hoursAgo = Math.round(timeDiffInSeconds / 3600);
            return interval === 'day' ? `${Math.round(hoursAgo / 24)}D ago` : `${hoursAgo}h ago`;
        })
        : ['24h ago', '16h ago', '10h ago', '6h ago', 'Now'];
    const labelPositions = Array.from({ length: timeLabels.length }, (_, i) => leftMargin + i * (canvas.width - leftMargin - rightMargin) / (timeLabels.length - 1));
    // Отрисовка имени токена и MC
    if (config.display.showTokenName) {
        const tokenNameText = (tokenInfo === null || tokenInfo === void 0 ? void 0 : tokenInfo.name) || 'Tryan';
        ctx.fillText(tokenNameText, leftMargin / 2, topOffset);
        if (config.display.showMarketCap) {
            const mcText = tokenInfo
                ? formatMarketCap(tokenInfo.marketCap)
                : 'MC: 999K';
            const tokenNameWidth = ctx.measureText(tokenNameText).width;
            ctx.fillText(mcText, leftMargin / 2 + tokenNameWidth + 20, topOffset);
        }
    }
    else if (config.display.showMarketCap) {
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
        const priceWidth = ctx.measureText(priceText).width;
        ctx.fillText(priceText, leftMargin / 2, topOffset + config.font.size * 1.2);
        // Отрисовка Min/Max если включено
        if (config.display.showMinMax) {
            const minPrice = Math.min(...data.map(item => parseFloat(item[3])));
            const maxPrice = Math.max(...data.map(item => parseFloat(item[2])));
            const minMaxText = `Min/max: $${minPrice.toFixed(6)} / $${maxPrice.toFixed(7)}`;
            ctx.font = `${config.font.size * 0.8}px ${config.font.family}`;
            ctx.fillText(minMaxText, leftMargin / 2, topOffset + config.font.size * 2.4);
            ctx.font = `${config.font.size * 1.2}px ${config.font.family}`; // Восстанавливаем исходный размер шрифта
        }
    }
    // Отрисовка временных меток
    if (config.display.showTimeline) {
        timeLabels.forEach((label, i) => {
            const textWidth = ctx.measureText(label).width;
            const yPosition = config.display.showPriceChange
                ? canvas.height - bottomMargin + 50
                : canvas.height - bottomMargin + 110;
            ctx.fillText(label, labelPositions[i] - textWidth / 2, yPosition);
        });
    }
    // Сбрасываем тень
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    // Возвращаем base64 строку изображения
    return canvas.toDataURL('image/png');
}
