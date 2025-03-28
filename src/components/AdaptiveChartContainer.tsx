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
        }
      });
      
      setIsLoading(false);
    } catch (err) {
      console.error('Ошибка при рендеринге графика:', err);
      setError(err instanceof Error ? err.message : 'Ошибка при рендеринге графика');
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
      {isLoading && (
        <Box sx={{ 
          position: 'absolute', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          backgroundColor: 'rgba(0,0,0,0.1)',
          zIndex: 2
        }}>
          <CircularProgress />
        </Box>
      )}
      
      {error && (
        <Typography color="error" sx={{ p: 2 }}>
          {error}
        </Typography>
      )}
      
      {showDownloadButton && !isLoading && !error && imageUrl && (
        <Box sx={{ mt: 1, textAlign: 'center' }}>
          <button onClick={handleDownload}>
            Скачать изображение
          </button>
        </Box>
      )}
    </Box>
  );
};

export default AdaptiveChartContainer; 