import React from 'react';
import { Paper, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import { ChartConfig, OHLCVData } from '../types';

interface ChartPreviewProps {
  config: ChartConfig;
  data: OHLCVData[];
}

const PreviewContainer = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2),
  marginTop: theme.spacing(2),
  height: '400px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  backgroundColor: props => props.config.background.color,
  backgroundImage: props => props.config.background.image ? `url(${props.config.background.image})` : 'none',
  backgroundSize: 'cover',
  backgroundPosition: 'center',
}));

const ChartPreview: React.FC<ChartPreviewProps> = ({ config, data }) => {
  return (
    <PreviewContainer>
      <Typography variant="h6" gutterBottom>
        Предварительный просмотр
      </Typography>
      {/* Здесь будет отрисовка графика */}
    </PreviewContainer>
  );
};

export default ChartPreview; 