import React, { useEffect, useRef, useState } from 'react';
import { Box } from '@mui/material';
import ChartPreview from './ChartPreview';
import { ChartConfig } from '../types';

interface TokenInfo {
  priceUsd: number;
  marketCap: number;
  priceChange: {
    '5m': number;
    '1h': number;
    '6h': number;
    '24h': number;
  };
  name?: string;
}

interface AdaptiveChartContainerProps {
  config: ChartConfig;
  data: number[][] | { timestamp: number; open: number; high: number; low: number; close: number; volume: number; }[];
  tokenInfo: TokenInfo;
  preserveAspectRatio?: boolean;
  minHeight?: number;
  isPreview?: boolean;
}

/**
 * Компонент для адаптивного отображения графиков
 * Автоматически подстраивается под размер родительского контейнера
 */
export const AdaptiveChartContainer: React.FC<AdaptiveChartContainerProps> = ({
  config,
  data,
  tokenInfo,
  preserveAspectRatio = true,
  minHeight = 400,
  isPreview = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const width = containerRef.current.clientWidth;
        const height = preserveAspectRatio ? width : Math.max(width * 0.5, minHeight);
        setDimensions({ width, height });
      }
    };

    const resizeObserver = new ResizeObserver(updateDimensions);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    updateDimensions();

    return () => {
      resizeObserver.disconnect();
    };
  }, [preserveAspectRatio, minHeight]);

  return (
    <Box
      ref={containerRef}
      sx={{
        width: '100%',
        height: preserveAspectRatio ? 'auto' : minHeight,
        minHeight: preserveAspectRatio ? 'auto' : minHeight,
        position: 'relative',
      }}
    >
      {dimensions.width > 0 && dimensions.height > 0 && (
        <ChartPreview
          config={config}
          data={data}
          tokenInfo={tokenInfo}
          width={dimensions.width}
          height={dimensions.height}
          isPreview={isPreview}
        />
      )}
    </Box>
  );
};

export default AdaptiveChartContainer; 