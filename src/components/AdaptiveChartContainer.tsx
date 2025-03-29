import React, { useRef, useEffect, useState } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { ChartConfig } from '../types';
import { renderAdaptiveChart, setupResizeObserver } from '../utils/adaptiveChartRenderer';

interface AdaptiveChartContainerProps {
  config: ChartConfig;
  data: any[];
  tokenInfo?: any;
  interval?: string;
  preserveAspectRatio?: boolean;
  maxWidth?: number;
  maxHeight?: number;
  minHeight?: number | string;
  className?: string;
  style?: React.CSSProperties;
  showDownloadButton?: boolean;
  onRenderComplete?: (result: { canvas: HTMLCanvasElement, base64: string }) => void;
}

/**
 * Компонент для адаптивного отображения графиков
 * Автоматически подстраивается под размер родительского контейнера
 */
const AdaptiveChartContainer: React.FC<AdaptiveChartContainerProps> = ({
  config,
  data,
  tokenInfo,
  interval = 'hour',
  preserveAspectRatio = true,
  maxWidth = 1280,
  maxHeight = 1280,
  minHeight = '300px',
  className,
  style,
  showDownloadButton = false,
  onRenderComplete
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  // Функция рендеринга графика
  const renderChart = async () => {
    if (!containerRef.current || !data || data.length === 0) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await renderAdaptiveChart({
        config,
        data,
        tokenInfo,
        interval,
        container: containerRef.current,
        preserveAspectRatio,
        maxWidth,
        maxHeight,
        onRenderComplete: (result) => {
          setImageUrl(result.base64);
          if (onRenderComplete) {
            onRenderComplete(result);
          }
          // Use a small delay to ensure the chart is fully rendered before hiding the loader
          setTimeout(() => setIsLoading(false), 100);
        }
      });
    } catch (err) {
      console.error('Error rendering chart:', err);
      setError(err instanceof Error ? err.message : 'Error rendering chart');
      setIsLoading(false);
    }
  };

  // Функция для скачивания изображения
  const handleDownload = () => {
    if (imageUrl) {
      const link = document.createElement('a');
      link.download = 'chart.png';
      link.href = imageUrl;
      link.click();
    }
  };

  // Рендерим график при изменении данных или конфигурации
  useEffect(() => {
    renderChart();
  }, [data, config, tokenInfo, interval, maxWidth, maxHeight, preserveAspectRatio]);

  // Настраиваем обработчик изменения размера контейнера
  useEffect(() => {
    if (containerRef.current) {
      const cleanup = setupResizeObserver(containerRef.current, renderChart);
      return cleanup;
    }
  }, []);

  return (
    <Box 
      className={`adaptive-chart-container ${className || ''}`}
      ref={containerRef}
      sx={{
        position: 'relative',
        width: '100%',
        minHeight,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        ...style
      }}
    >
      {error && (
        <Typography color="error" sx={{ p: 2 }}>
          {error}
        </Typography>
      )}
      
      {showDownloadButton && !isLoading && !error && imageUrl && (
        <Box sx={{ mt: 1, textAlign: 'center' }}>
          <button onClick={handleDownload}>
            Download Image
          </button>
        </Box>
      )}
    </Box>
  );
};

export default AdaptiveChartContainer; 