import React from 'react';
import { Box, Typography, Select, MenuItem, FormControl, InputLabel, Switch, FormControlLabel, Paper } from '@mui/material';
import SliderWithInput from './SliderWithInput';

interface ImageSettingsProps {
  scale: number;
  offsetX: number;
  offsetY: number;
  startFrom?: 'top' | 'bottom' | 'fill';
  isBody?: boolean;
  rotation?: number;
  overlap?: number;
  hue?: number;
  mirror?: boolean;
  onScaleChange: (scale: number) => void;
  onOffsetXChange: (offsetX: number) => void;
  onOffsetYChange: (offsetY: number) => void;
  onStartFromChange?: (startFrom: 'top' | 'bottom' | 'fill') => void;
  onRotationChange?: (rotation: number) => void;
  onOverlapChange?: (overlap: number) => void;
  onHueChange?: (hue: number) => void;
  onMirrorChange?: (mirror: boolean) => void;
}

const ImageSettings: React.FC<ImageSettingsProps> = ({
  scale,
  offsetX,
  offsetY,
  startFrom = 'top',
  isBody = false,
  rotation = 0,
  overlap = 2,
  hue = 0,
  mirror = false,
  onScaleChange,
  onOffsetXChange,
  onOffsetYChange,
  onStartFromChange,
  onRotationChange,
  onOverlapChange,
  onHueChange,
  onMirrorChange,
}) => {
  // Принудительное преобразование всех числовых параметров
  const safeScale = typeof scale === 'number' ? scale : parseFloat(scale) || 1;
  const safeOffsetX = typeof offsetX === 'number' ? offsetX : parseInt(offsetX) || 0;
  const safeOffsetY = typeof offsetY === 'number' ? offsetY : parseInt(offsetY) || 0;
  const safeRotation = typeof rotation === 'number' ? rotation : parseInt(rotation) || 0;
  const safeOverlap = typeof overlap === 'number' ? overlap : parseInt(overlap) || 2;
  const safeHue = typeof hue === 'number' ? hue : parseInt(hue) || 0;
  const safeMirror = !!mirror;
  
  // Принудительное преобразование всех числовых параметров обеспечивает корректную работу компонентов
  
  return (
    <Paper
      elevation={0}
      sx={{
        border: '10px solidrgb(150, 147, 117)',
        borderRadius: 2,
        p: 1.5,
        backgroundColor: 'rgba(70, 37, 69, 0.73)'
      }}
    >
      <Box sx={{ mb: 1, minWidth: '200px' }}>
        <Typography variant="caption" gutterBottom>
          Scale
        </Typography>
        <SliderWithInput
          value={safeScale}
          onChange={onScaleChange}
          min={0.1}
          max={7.0}
          step={0.005}
          isFloat={true}
        />
      </Box>
      {onHueChange && (
        <Box sx={{ mb: 1, minWidth: '200px' }}>
          <Typography variant="caption" gutterBottom>
            Color Balance
          </Typography>
          <SliderWithInput
            value={safeHue}
            onChange={onHueChange}
            min={0}
            max={360}
            step={1}
            isFloat={false}
          />
        </Box>
      )}
      {onMirrorChange && (
        <Box sx={{ mb: 1, minWidth: '200px' }}>
          <FormControlLabel
            control={
              <Switch
                checked={safeMirror}
                onChange={(e) => onMirrorChange(e.target.checked)}
                color="primary"
              />
            }
            label="Mirrored"
          />
        </Box>
      )}
      {isBody && onStartFromChange && (
        <Box sx={{ mb: 1, minWidth: '200px' }}>
          <FormControl fullWidth size="small">
            <InputLabel>Start From</InputLabel>
            <Select
              value={startFrom || 'top'}
              label="Start From"
              onChange={(e) => onStartFromChange(e.target.value as 'top' | 'bottom' | 'fill')}
            >
              <MenuItem value="top">Top</MenuItem>
              <MenuItem value="bottom">Bottom</MenuItem>
              <MenuItem value="fill">Fill</MenuItem>
            </Select>
          </FormControl>
        </Box>
      )}
      {isBody && onOverlapChange && (
        <Box sx={{ mb: 1, minWidth: '200px' }}>
          <Typography variant="caption" gutterBottom>
            Overlap (%)
          </Typography>
          <SliderWithInput
            value={safeOverlap}
            onChange={onOverlapChange}
            min={0}
            max={50}
            step={0.05}
            isFloat={false}
          />
        </Box>
      )}
      <Box sx={{ mb: 1, minWidth: '200px' }}>
        <Typography variant="caption" gutterBottom>
          X Offset
        </Typography>
        <SliderWithInput
          value={safeOffsetX}
          onChange={onOffsetXChange}
          min={-120}
          max={120}
          step={0.2}
        />
      </Box>
      {!isBody && (
        <Box sx={{ mb: 1, minWidth: '200px' }}>
          <Typography variant="caption" gutterBottom>
            Y Offset
          </Typography>
          <SliderWithInput
            value={safeOffsetY}
            onChange={onOffsetYChange}
            min={-120}
            max={120}
            step={0.2}
          />
        </Box>
      )}
      {onRotationChange && (
        <Box sx={{ mb: 1, minWidth: '200px' }}>
          <Typography variant="caption" gutterBottom>
            Rotation
          </Typography>
          <SliderWithInput
            value={safeRotation}
            onChange={onRotationChange}
            min={-180}
            max={180}
            step={1}
          />
        </Box>
      )}
    </Paper>
  );
};

export default ImageSettings; 