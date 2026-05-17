/**
 * chartRendererAdapter.js
 * Адаптер для использования drawChart.js из компилированной версии
 */

// Импортируем базовые модули
const fs = require('fs');
const path = require('path');
const { Canvas, createCanvas, loadImage, registerFont } = require('canvas');
const { drawChart, drawIndividualBars, drawBackground, getBarTypes } = require('./dist/drawChart');
const { v4: uuidv4 } = require('uuid');

// Добавляем fontkit для правильного определения Family Name
const fontkit = require('fontkit');

// Регистрируем доступные шрифты из папки fonts
const registerAvailableFonts = () => {
  const fontsDir = path.join(__dirname, 'fonts');
  const newFontsDir = path.join(__dirname, 'fonts', 'new');
  let totalRegistered = 0;

  // Функция для регистрации шрифтов из папки
  const registerFontsFromDir = (dirPath, dirName) => {
    if (fs.existsSync(dirPath)) {
      const fontFiles = fs.readdirSync(dirPath).filter(file =>
        file.endsWith('.ttf') || file.endsWith('.otf') || file.endsWith('.woff') || file.endsWith('.woff2')
      );

      fontFiles.forEach(fontFile => {
        const fontPath = path.join(dirPath, fontFile);
        let familyName = null;

        try {
          // Получаем правильный Family Name из файла шрифта
          const font = fontkit.openSync(fontPath);
          familyName = font.familyName;

          if (familyName) {
            console.log(`Регистрирую шрифт: "${familyName}" из файла ${fontFile} (${dirName})`);
            registerFont(fontPath, { family: familyName });
            totalRegistered++;
          } else {
            // Fallback на базовое имя файла, если Family Name не найден
            const baseFontFamily = path.basename(fontFile, path.extname(fontFile));
            console.log(`Регистрирую шрифт: ${baseFontFamily} (fallback) из файла ${fontFile} (${dirName})`);
            registerFont(fontPath, { family: baseFontFamily });
            totalRegistered++;
          }
        } catch (error) {
          console.warn(`Ошибка при регистрации шрифта ${fontFile}: ${error.message}`);
          // Fallback на базовое имя файла
          const baseFontFamily = path.basename(fontFile, path.extname(fontFile));
          console.log(`Регистрирую шрифт: ${baseFontFamily} (fallback) из файла ${fontFile} (${dirName})`);
          registerFont(fontPath, { family: baseFontFamily });
          totalRegistered++;
        }
      });
    } else {
      console.warn(`Папка ${dirName} не найдена.`);
    }
  };

  // Регистрируем шрифты из основной папки fonts
  registerFontsFromDir(fontsDir, 'fonts');

  // Регистрируем шрифты из папки fonts/new
  registerFontsFromDir(newFontsDir, 'fonts/new');

  console.log(`Зарегистрировано ${totalRegistered} шрифтов всего`);
};

// Регистрируем шрифты при импорте модуля
registerAvailableFonts();

/**
 * Основная функция для рендеринга графика
 */
async function renderChart({
  config,
  data,
  tokenInfo,
  interval = 'hour',
  width = 1280,
  height = 1280,
  outputPath,
  separateBars = false,
  format = 'png'
}) {
  // Проверяем входные данные
  if (!config || !data || data.length === 0) {
    throw new Error('Missing required parameters: config and data');
  }

  // Определяем параметры экспорта
  const getExportParams = (format) => {
    const normalizedFormat = format.toLowerCase();
    if (normalizedFormat === 'jpg' || normalizedFormat === 'jpeg') {
      return {
        mimeType: 'image/jpeg',
        extension: 'jpg',
        quality: 0.95 // Высокое качество для JPG
      };
    } else {
      return {
        mimeType: 'image/png',
        extension: 'png',
        quality: undefined
      };
    }
  };

  const exportParams = getExportParams(format);

  // Если нужны отдельные столбики
  if (separateBars) {
    try {
      // Создаем основной канвас для работы
      const canvas = createCanvas(width, height);

      // Получаем массив канвасов для отдельных столбиков
      const barCanvases = await drawIndividualBars({
        canvas,
        config,
        data,
        tokenInfo,
        interval,
        width,
        height,
        tokenName: config.displayName || tokenInfo.name
      });

      // Создаем канвас для фона
      const backgroundCanvas = createCanvas(width, height);
      await drawBackground({
        canvas: backgroundCanvas,
        config,
        data,
        tokenInfo,
        interval,
        width,
        height,
        tokenName: config.displayName || tokenInfo.name
      });

      // Сохраняем файлы
      const timestamp = Date.now();
      const barFilenames = [];

      // Определяем директорию для сохранения
      const saveDir = path.join(__dirname, 'generated_images');
      if (!fs.existsSync(saveDir)) {
        fs.mkdirSync(saveDir, { recursive: true });
      }

      // Сохраняем отдельные столбики
      for (let i = 0; i < barCanvases.length; i++) {
        const barFilename = `bar_${i + 1}_${timestamp}.${exportParams.extension}`;
        const barPath = path.join(saveDir, barFilename);

        const barBuffer = exportParams.quality
          ? barCanvases[i].toBuffer(exportParams.mimeType, { quality: exportParams.quality })
          : barCanvases[i].toBuffer(exportParams.mimeType);
        fs.writeFileSync(barPath, barBuffer);
        barFilenames.push(barFilename);
      }

      // Сохраняем фон
      const backgroundFilename = `background_${timestamp}.${exportParams.extension}`;
      const backgroundPath = path.join(saveDir, backgroundFilename);

      const backgroundBuffer = exportParams.quality
        ? backgroundCanvas.toBuffer(exportParams.mimeType, { quality: exportParams.quality })
        : backgroundCanvas.toBuffer(exportParams.mimeType);
      fs.writeFileSync(backgroundPath, backgroundBuffer);

      // Получаем типы столбиков
      const barTypes = getBarTypes({ config, data, width, height });
      // Сохраняем bars_types.csv
      const csvLines = ['index,type'];
      for (let i = 0; i < barTypes.length; i++) {
        csvLines.push(`${i + 1},${barTypes[i]}`);
      }
      const csvPath = path.join(saveDir, 'bars_types.csv');
      fs.writeFileSync(csvPath, csvLines.join('\n'), 'utf-8');

      console.log(`Сохранены отдельные файлы: ${barCanvases.length} столбиков + 1 фон`);

      return {
        success: true,
        separateBars: true,
        barCount: barCanvases.length,
        barFilenames,
        backgroundFilename,
        message: `Создано ${barCanvases.length} файлов столбиков + 1 файл фона`
      };

    } catch (error) {
      console.error('Ошибка при рендеринге отдельных столбиков:', error);
      return {
        success: false,
        error: error.message
      };
    }
  } else {
    // Обычный рендеринг одного файла
    const canvas = createCanvas(width, height);

    // Вызываем функцию drawChart для рендеринга графика
    await drawChart({
      canvas,
      config,
      data,
      tokenInfo,
      interval,
      width,
      height,
      tokenName: config.displayName || tokenInfo.name
    });

    // Сохраняем результат в файл, если указан путь
    if (outputPath) {
      const buffer = exportParams.quality
        ? canvas.toBuffer(exportParams.mimeType, { quality: exportParams.quality })
        : canvas.toBuffer(exportParams.mimeType);
      fs.writeFileSync(outputPath, buffer);
    }

    // Возвращаем результат в виде base64 строки
    const base64 = canvas.toDataURL(exportParams.mimeType);
    return {
      success: true,
      base64,
      buffer: exportParams.quality
        ? canvas.toBuffer(exportParams.mimeType, { quality: exportParams.quality })
        : canvas.toBuffer(exportParams.mimeType)
    };
  }
}

/**
 * Функция для создания демо-данных
 */
function createDemoData(numBars = 24) {
  return Array.from({ length: numBars }, (_, i) => {
    const now = Math.floor(Date.now() / 1000);
    const timestamp = now - (numBars - i) * 3600; // Каждый элемент с интервалом в 1 час
    const basePrice = 0.00000135;
    const volatility = 0.00000050;
    const open = basePrice + (Math.random() - 0.5) * volatility;
    const close = basePrice + (Math.random() - 0.5) * volatility;
    const high = Math.max(open, close) + Math.random() * volatility * 0.5;
    const low = Math.min(open, close) - Math.random() * volatility * 0.5;
    return [timestamp, open, high, low, close];
  });
}

/**
 * Функция для создания демо-информации о токене
 */
function createDemoTokenInfo() {
  return {
    name: 'Demo Token',
    symbol: 'DEMO',
    priceUsd: 0.00000135,
    marketCap: 999000,
    priceChange: {
      '5m': 3.14,
      '1h': -6.66,
      '6h': 0.00,
      '24h': 15.75
    },
    volume: 15000
  };
}

module.exports = {
  renderChart,
  createDemoData,
  createDemoTokenInfo
};