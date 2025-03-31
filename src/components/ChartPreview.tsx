import React, { useEffect, useRef, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { ChartConfig } from '../types';
import { renderChart, DEMO_DATA, DEMO_TOKEN_INFO } from '../utils/chartRendererUniversal';

interface ChartPreviewProps {
  config: ChartConfig;
  data?: any[];
  tokenInfo?: {
    priceUsd: number;
    marketCap: number;
    priceChange: {
      '5m': number;
      '1h': number;
      '6h': number;
      '24h': number;
    };
    name?: string;
  } | null;
  interval?: string;
  width?: number;
  height?: number;
  id?: string;
  tokenName?: string;
  isPreview?: boolean;
}

/**
 * Компонент для отображения графика криптовалюты
 */
const ChartPreview: React.FC<ChartPreviewProps> = ({
  config,
  data,
  tokenInfo,
  interval = 'hour',
  width = 1280,
  height = 1280,
  id = 'chart-canvas',
  tokenName,
  isPreview = false
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Используем демо данные для превью или если не переданы реальные данные
  const chartData = isPreview || !data || data.length === 0 ? DEMO_DATA : data;
  const chartTokenInfo = isPreview || !tokenInfo ? DEMO_TOKEN_INFO : tokenInfo;

  useEffect(() => {
    const renderCryptochart = async () => {
      try {
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        setIsLoading(true);

        // В браузере используем canvas напрямую
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          throw new Error('Unable to get canvas context');
        }

        // Устанавливаем размеры канваса
        canvas.width = width;
        canvas.height = height;

        // Рендерим график используя универсальный рендерер
        const result = await renderChart({
          config,
          data: chartData,
          tokenInfo: chartTokenInfo,
          interval,
          width,
          height,
          tokenName,
          canvas: undefined // Лучше не передавать canvas в браузере, так как skia-canvas и браузерный canvas несовместимы
        });
        
        // Отрисовываем полученное изображение на canvas
        const img = new Image();
        img.onload = () => {
          ctx.clearRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          setIsLoading(false);
        };
        img.onerror = (err) => {
          console.error('Error loading rendered image:', err);
          setError('Error loading rendered image');
          setIsLoading(false);
        };
        img.src = result.base64;
      } catch (err) {
        console.error('Error rendering chart:', err);
        setError(err instanceof Error ? err.message : 'Error rendering chart');
        setIsLoading(false);
      }
    };

    // Не рендерим, если нет данных и не в режиме превью
    if (!isPreview && (!data || data.length === 0)) {
      setIsLoading(false);
      return;
    }

    renderCryptochart();
  }, [config, data, tokenInfo, chartData, chartTokenInfo, interval, width, height, isPreview, tokenName]);

  return (
    <Box className="chart-preview">
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
          opacity: isLoading ? 0 : 1,
          transition: 'opacity 0.3s ease-in-out'
        }}
      />
      {!isPreview && chartTokenInfo && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle1" gutterBottom>
            Token Info:
          </Typography>
          <Typography>
            Price: ${chartTokenInfo.priceUsd.toFixed(8)}
          </Typography>
          <Typography>
            Market Cap: ${chartTokenInfo.marketCap.toLocaleString()}
          </Typography>
          <Typography>
            Price Changes:
          </Typography>
          <Box sx={{ pl: 2 }}>
            <Typography>5m: {chartTokenInfo.priceChange['5m']}%</Typography>
            <Typography>1h: {chartTokenInfo.priceChange['1h']}%</Typography>
            <Typography>6h: {chartTokenInfo.priceChange['6h']}%</Typography>
            <Typography>24h: {chartTokenInfo.priceChange['24h']}%</Typography>
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default ChartPreview; 