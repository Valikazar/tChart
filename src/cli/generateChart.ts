#!/usr/bin/env node

import { generateChartImage } from '../utils/generateChartImage';
import * as fs from 'fs';
import * as path from 'path';

// Простой обработчик аргументов командной строки
const args = process.argv.slice(2);
const options: Record<string, any> = {
  config: null,
  data: null,
  output: 'chart.png',
  width: 1280,
  height: 1280,
  interval: 'hour',
};

// Парсинг аргументов
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  
  if (arg === '--config' && i + 1 < args.length) {
    options.config = args[++i];
  } else if (arg === '--data' && i + 1 < args.length) {
    options.data = args[++i];
  } else if (arg === '--output' && i + 1 < args.length) {
    options.output = args[++i];
  } else if (arg === '--width' && i + 1 < args.length) {
    options.width = parseInt(args[++i]);
  } else if (arg === '--height' && i + 1 < args.length) {
    options.height = parseInt(args[++i]);
  } else if (arg === '--interval' && i + 1 < args.length) {
    options.interval = args[++i];
  } else if (arg === '--help' || arg === '-h') {
    showHelp();
    process.exit(0);
  }
}

// Проверка обязательных аргументов
if (!options.config || !options.data) {
  console.error('Ошибка: не указаны обязательные параметры --config и --data');
  showHelp();
  process.exit(1);
}

/**
 * Показывает справку по использованию
 */
function showHelp() {
  console.log(`
Генератор графиков для криптовалют без браузера

Использование:
  node generateChart.js --config <путь_к_конфигу> --data <путь_к_данным> [options]

Обязательные параметры:
  --config <путь>   Путь к JSON-файлу с конфигурацией графика
  --data <путь>     Путь к JSON-файлу с данными OHLCV

Опциональные параметры:
  --output <путь>   Путь для сохранения изображения (по умолчанию: chart.png)
  --width <число>   Ширина графика в пикселях (по умолчанию: 1280)
  --height <число>  Высота графика в пикселях (по умолчанию: 1280)
  --interval <тип>  Интервал для временных отметок (hour, day) (по умолчанию: hour)
  --help, -h        Показать эту справку
  `);
}

/**
 * Основная функция
 */
async function main() {
  try {
    // Загружаем конфигурацию из файла
    const configPath = path.resolve(process.cwd(), options.config);
    if (!fs.existsSync(configPath)) {
      throw new Error(`Файл конфигурации не найден: ${configPath}`);
    }
    const configData = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(configData);

    // Загружаем данные из файла
    const dataPath = path.resolve(process.cwd(), options.data);
    if (!fs.existsSync(dataPath)) {
      throw new Error(`Файл с данными не найден: ${dataPath}`);
    }
    const chartData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

    // Полный путь для выходного файла
    const outputPath = path.resolve(process.cwd(), options.output);

    console.log('Генерируем график...');
    console.log(`- Конфигурация: ${configPath}`);
    console.log(`- Данные: ${dataPath}`);
    console.log(`- Выходной файл: ${outputPath}`);
    console.log(`- Размеры: ${options.width}x${options.height}`);

    // Генерируем график
    const result = await generateChartImage({
      config,
      data: chartData,
      outputPath,
      interval: options.interval,
      width: options.width,
      height: options.height
    });

    console.log(`\nГрафик успешно сгенерирован и сохранен в: ${result.filePath}`);
  } catch (error) {
    console.error('Произошла ошибка:', error);
    process.exit(1);
  }
}

// Запуск программы
main(); 