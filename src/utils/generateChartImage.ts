import { ChartConfig } from '../types';
import { renderChart } from './chartRendererNode';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Генерирует изображение графика и сохраняет его в файл
 * 
 * @param config Конфигурация графика
 * @param data Данные OHLCV для графика
 * @param outputPath Путь для сохранения изображения
 * @param options Дополнительные опции
 * @returns Promise<{filePath: string, base64: string}>
 */
export async function generateChartImage({
  config,
  data,
  outputPath = 'chart.png',
  tokenInfo,
  interval = 'hour',
  width = 1280,
  height = 1280,
  canvas
}: {
  config: ChartConfig;
  data: any[];
  outputPath?: string;
  tokenInfo?: any;
  interval?: string;
  width?: number;
  height?: number;
  canvas?: HTMLCanvasElement; // Опциональный canvas для веб-режима
}): Promise<{ filePath: string; base64: string; canvas?: any }> {
  try {
    // В Node.js создаем директорию для сохранения, если она не существует
    if (typeof window === 'undefined' && outputPath) {
      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }

    // Генерируем график
    const result = await renderChart({
      config,
      data,
      tokenInfo,
      interval,
      width,
      height,
      outputPath,
      canvas
    });

    return {
      filePath: outputPath || '',
      base64: result.base64,
      canvas: result.canvas
    };
  } catch (error) {
    console.error('Ошибка при генерации графика:', error);
    throw error;
  }
}

/**
 * Пример использования:
 * 
 * import { generateChartImage } from './utils/generateChartImage';
 * import defaultConfig from './config/defaultChartConfig';
 * 
 * // Данные OHLCV
 * const data = [
 *   [1617235200, 100, 120, 90, 110, 1000], // [timestamp, open, high, low, close, volume]
 *   [1617321600, 110, 130, 100, 120, 1200],
 *   // ...
 * ];
 * 
 * // Генерация и сохранение графика
 * generateChartImage({
 *   config: defaultConfig,
 *   data,
 *   outputPath: 'output/chart.png'
 * })
 * .then(result => {
 *   console.log('График сохранен:', result.filePath);
 * })
 * .catch(error => {
 *   console.error('Ошибка:', error);
 * });
 * 
 * // Использование в браузере:
 * const canvas = document.getElementById('my-canvas');
 * generateChartImage({
 *   config: defaultConfig,
 *   data,
 *   canvas: canvas
 * })
 * .then(result => {
 *   // Canvas уже обновлен
 *   console.log('База 64:', result.base64.substring(0, 50) + '...');
 * });
 */ 