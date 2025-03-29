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
      filePath: outputPath,
      base64: result.base64,
      canvas: result.canvas
    };
  } catch (error) {
    console.error('Error generating chart:', error);
    throw error;
  }
}

/**
 * Usage example:
 * 
 * generateChartImage({
 *   config: chartConfig,
 *   data: chartData,
 *   outputPath: './output/chart.png'
 * })
 * .then(result => {
 *   console.log('Chart generated:', result.filePath);
 * })
 * .catch(error => {
 *   console.error('Error:', error);
 * });
 */ 