import React from 'react';
import { Paper, Typography, Box, Button } from '@mui/material';
import { styled } from '@mui/material/styles';
import ColorPicker from './ColorPicker';
import SliderWithInput from './SliderWithInput';
import { HighLowLinesConfig, BarType } from './types';

interface HighLowLinesConfiguratorProps {
  config: HighLowLinesConfig;
  barColors: {
    upBar: string;
    downBar: string;
    candle: string;
    knife: string;
  };
  onUpdate: (config: HighLowLinesConfig) => void;
}

// Create styled grid components
const GridContainer = styled('div')(({ theme }) => ({
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.spacing(2)
}));

const GridItem = styled('div')(({ theme }) => ({
  flexBasis: '100%',
  [theme.breakpoints.up('sm')]: {
    flexBasis: 'calc(50% - 8px)',
  }
}));

const HighLowLinesConfigurator: React.FC<HighLowLinesConfiguratorProps> = ({
  config,
  barColors,
  onUpdate,
}) => {
  const handleLineWidthChange = (newLineWidth: number) => {
    onUpdate({
      ...config,
      lineWidth: newLineWidth
    });
  };

  const handleBarColorUpdate = (barType: BarType, lineColor: string) => {
    onUpdate({
      ...config,
      [barType]: {
        ...config[barType],
        lineColor
      }
    });
  };

  const handleSameAsBodyColors = () => {
    onUpdate({
      ...config,
      upBar: { ...config.upBar, lineColor: barColors.upBar },
      downBar: { ...config.downBar, lineColor: barColors.downBar },
      candle: { ...config.candle, lineColor: barColors.candle },
      knife: { ...config.knife, lineColor: barColors.knife }
    });
  };

  const handleSetAllBlack = () => {
    onUpdate({
      ...config,
      upBar: { ...config.upBar, lineColor: '#000000' },
      downBar: { ...config.downBar, lineColor: '#000000' },
      candle: { ...config.candle, lineColor: '#000000' },
      knife: { ...config.knife, lineColor: '#000000' }
    });
  };

  const handleSetAllWhite = () => {
    onUpdate({
      ...config,
      upBar: { ...config.upBar, lineColor: '#FFFFFF' },
      downBar: { ...config.downBar, lineColor: '#FFFFFF' },
      candle: { ...config.candle, lineColor: '#FFFFFF' },
      knife: { ...config.knife, lineColor: '#FFFFFF' }
    });
  };

  const renderBarColorConfig = (barType: BarType, label: string, colorIndicator: string) => {
    const barConfig = config[barType];
    const defaultColor = barColors[barType];
    
    return (
      <GridItem key={barType}>
        <Typography variant="h6" sx={{ mb: 1 }}>
          {label} <span style={{color: colorIndicator}}>
            {barType === 'upBar' ? '▲' : 
             barType === 'downBar' ? '▼' : 
             barType === 'candle' ? '⇑⇑' : '⇓⇓'}
          </span>
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 1 }}>
          <Typography variant="caption">Color</Typography>
          <ColorPicker
            color={(barConfig && barConfig.lineColor) || defaultColor}
            onChange={(color) => handleBarColorUpdate(barType, color)}
            enableEyedropper={true}
          />
        </Box>
      </GridItem>
    );
  };

  return (
    <Paper sx={{ p: 2, width: '100%' }}>
      <Typography variant="h6" sx={{ mb: 2 }}>High/Low Lines Settings</Typography>
      
      {/* Общий слайдер ширины линий */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>Line Width (for all bars)</Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 1 }}>
          <Typography variant="caption">Width</Typography>
          <SliderWithInput
            value={config.lineWidth}
            onChange={handleLineWidthChange}
            min={0}
            max={15}
            step={0.25}
            isFloat={true}
          />
        </Box>
      </Box>
      
      {/* Индивидуальные цвета для каждого типа бара */}
      <Typography variant="h6" sx={{ mb: 2 }}>Individual Colors</Typography>
      
      {/* Кнопки быстрой настройки цветов */}
      <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
        <Button
          variant="outlined"
          size="small"
          onClick={handleSameAsBodyColors}
          sx={{ minWidth: 'auto' }}
        >
          Same as Body
        </Button>
        <Button
          variant="outlined"
          size="small"
          onClick={handleSetAllBlack}
          sx={{ minWidth: 'auto', backgroundColor: '#000000', color: '#FFFFFF', '&:hover': { backgroundColor: '#333333' } }}
        >
          Black
        </Button>
        <Button
          variant="outlined"
          size="small"
          onClick={handleSetAllWhite}
          sx={{ minWidth: 'auto', backgroundColor: '#FFFFFF', color: '#000000', '&:hover': { backgroundColor: '#F5F5F5' } }}
        >
          White
        </Button>
      </Box>
      
      <GridContainer>
        {renderBarColorConfig('upBar', 'Up Bar', barColors.upBar)}
        {renderBarColorConfig('downBar', 'Down Bar', barColors.downBar)}
        {renderBarColorConfig('candle', 'Candle', barColors.candle)}
        {renderBarColorConfig('knife', 'Knife', barColors.knife)}
      </GridContainer>
    </Paper>
  );
};

export default HighLowLinesConfigurator; 