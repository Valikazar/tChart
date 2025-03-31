import { renderChart, DEMO_DATA, DEMO_TOKEN_INFO } from '../utils/universalChartRenderer';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { ChartConfig } from '../types';

// Пример конфигурации графика
const config: ChartConfig = {
  background: { 
    color: '#000000',
    opacity: 0.3
  },
  overlay: {
    color: 'rgba(0,0,0,0.5)'
  },
  upBar: { 
    color: '#00ff00',
    lineWidth: 1,
    lineColor: '#008800',
    borderWidth: 1,
    borderColor: '#00ff00',
    borderStyle: 'outside'
  },
  downBar: { 
    color: '#ff0000',
    lineWidth: 1,
    lineColor: '#880000',
    borderWidth: 1,
    borderColor: '#ff0000', 
    borderStyle: 'outside'
  },
  knife: {
    color: '#00aa00',
    lineWidth: 1,
    lineColor: '#008800',
    borderWidth: 1,
    borderColor: '#00ff00'
  },
  candle: {
    color: '#aa0000',
    lineWidth: 1,
    lineColor: '#880000',
    borderWidth: 1,
    borderColor: '#ff0000'
  },
  font: { 
    family: 'Arial', 
    size: 18, 
    color: '#ffffff' 
  },
  text: {
    content: '',
    x: 0,
    y: 0,
    color: '#ffffff',
    size: 18,
    family: 'Arial',
    align: 'left' as CanvasTextAlign,
    baseline: 'top' as CanvasTextBaseline
  },
  display: {
    showTokenName: true,
    showMarketCap: true,
    showPrice: true,
    showMinMax: true,
    showTimeline: true,
    showPriceChange: true
  },
  // Добавляем недостающие поля
  network: 'ethereum',
  poolAddress: '0x0000000000000000000000000000000000000000',
  duration: 24,
  numBars: 24,
  interval: 'hour'
};

/**
 * Пример генерации графика и сохранения его в файл
 */
async function generateChartExample() {
  console.log('Генерация графика...');
  
  try {
    // Рендерим график с демо-данными
    const result = await renderChart({
      config,
      data: DEMO_DATA,
      tokenInfo: DEMO_TOKEN_INFO,
      width: 1280,
      height: 1280,
      interval: 'hour'
    });
    
    // Сохраняем результат в файл (только для Node.js)
    if (typeof window === 'undefined' && result.buffer) {
      const outputDir = './output';
      const outputPath = join(outputDir, 'chart-example.png');
      
      try {
        writeFileSync(outputPath, result.buffer);
        console.log(`График успешно сохранен в ${outputPath}`);
      } catch (error) {
        console.error('Ошибка при сохранении файла:', error);
      }
    } else {
      console.log('График сгенерирован, base64 данные:', result.base64.substring(0, 50) + '...');
    }
  } catch (error) {
    console.error('Ошибка при генерации графика:', error);
  }
}

// Запускаем пример
if (require.main === module) {
  generateChartExample();
}

export { generateChartExample }; 