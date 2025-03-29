import React, { useEffect, useRef, useState } from 'react';
import { ChartConfig } from '../types';
import { renderChart } from '../utils/chartRendererUniversal';

interface ChartPreviewProps {
  config: ChartConfig;
  data: any[];
  tokenInfo?: any;
  interval?: string;
  width?: number;
  height?: number;
  id?: string;
}

/**
 * Пример компонента для отображения графика криптовалюты
 * с использованием универсальной функции renderChart
 */
const UniversalChartPreview: React.FC<ChartPreviewProps> = ({
  config,
  data,
  tokenInfo,
  interval = 'hour',
  width = 1280,
  height = 1280,
  id = 'chart-canvas',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  
  useEffect(() => {
    // Если нет данных, не рисуем график
    if (!data || data.length === 0) {
      setIsLoading(false);
      return;
    }
    
    const renderChartData = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const canvas = canvasRef.current;
        if (!canvas) {
          throw new Error('Canvas element not found');
        }
        
        // Используем универсальную функцию для отрисовки
        const result = await renderChart({
          config,
          data,
          tokenInfo,
          interval,
          width,
          height,
          canvas // Передаем существующий canvas
        });
        
        // Сохраняем base64 для возможного использования
        setImageUrl(result.base64);
        setIsLoading(false);
      } catch (err) {
        console.error('Error rendering chart:', err);
        setError(err instanceof Error ? err.message : 'Error rendering chart');
        setIsLoading(false);
      }
    };
    
    renderChartData();
  }, [config, data, tokenInfo, interval, width, height]);
  
  // Пример функции для скачивания изображения
  const handleDownload = () => {
    if (imageUrl) {
      const link = document.createElement('a');
      link.download = 'chart.png';
      link.href = imageUrl;
      link.click();
    }
  };
  
  return (
    <div className="universal-chart-preview">
      {error && <div className="error">Error: {error}</div>}
      
      <canvas
        ref={canvasRef}
        id={id}
        width={width}
        height={height}
        style={{ 
          display: 'block',
          maxWidth: '100%',
          height: 'auto',
          aspectRatio: '1/1', // Preserve square aspect ratio
          opacity: isLoading ? 0 : 1,
          transition: 'opacity 0.3s ease-in-out'
        }}
      />
      
      {!isLoading && !error && (
        <div className="chart-actions" style={{ marginTop: '10px' }}>
          <button onClick={handleDownload}>
            Download Image
          </button>
        </div>
      )}
    </div>
  );
};

export default UniversalChartPreview;

/**
 * Usage example:
 * 
 * import UniversalChartPreview from './examples/UniversalChartPreview';
 * import { defaultConfig } from './config';
 * 
 * function MyComponent() {
 *   const [data, setData] = useState([]);
 *   
 *   useEffect(() => {
 *     // Loading data
 *     fetch('https://api.example.com/chart-data')
 *       .then(response => response.json())
 *       .then(chartData => setData(chartData));
 *   }, []);
 *   
 *   return (
 *     <div>
 *       <h2>My Chart</h2>
 *       <UniversalChartPreview
 *         config={defaultConfig}
 *         data={data}
 *         width={800}
 *         height={600}
 *       />
 *     </div>
 *   );
 * }
 */ 