import React from 'react';
import { Box, Typography, Select, MenuItem, FormControl, InputLabel, Switch, FormControlLabel } from '@mui/material';
import SliderWithInput from './SliderWithInput';

interface ImageSettingsProps {
  scale: number;
  offsetX: number;
  offsetY: number;
  startFrom?: 'top' | 'bottom' | 'fill';
  isBody?: boolean;
  onScaleChange: (scale: number) => void;
  onOffsetXChange: (offsetX: number) => void;
  onOffsetYChange: (offsetY: number) => void;
  onStartFromChange?: (startFrom: 'top' | 'bottom' | 'fill') => void;
}

const ImageSettings: React.FC<ImageSettingsProps> = ({
  scale,
  offsetX,
  offsetY,
  startFrom = 'top',
  isBody = false,
  onScaleChange,
  onOffsetXChange,
  onOffsetYChange,
  onStartFromChange,
}) => {
  return (
    <Box>
      <Box sx={{ mb: 1, minWidth: '200px' }}>
        <Typography variant="caption" gutterBottom>
          Scale
        </Typography>
        <SliderWithInput
          value={scale}
          onChange={onScaleChange}
          min={0.1}
          max={5}
          step={0.05}
          isFloat={true}
        />
      </Box>
      {isBody && onStartFromChange && (
        <Box sx={{ mb: 1, minWidth: '200px' }}>
          <FormControl fullWidth size="small">
            <InputLabel>Start From</InputLabel>
            <Select
              value={startFrom}
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
      <Box sx={{ mb: 1, minWidth: '200px' }}>
        <Typography variant="caption" gutterBottom>
          X Offset
        </Typography>
        <SliderWithInput
          value={offsetX}
          onChange={onOffsetXChange}
          min={-100}
          max={100}
          step={1}
        />
      </Box>
      {!isBody && (
        <Box sx={{ mb: 1, minWidth: '200px' }}>
          <Typography variant="caption" gutterBottom>
            Y Offset
          </Typography>
          <SliderWithInput
            value={offsetY}
            onChange={onOffsetYChange}
            min={-100}
            max={100}
            step={1}
          />
        </Box>
      )}
    </Box>
  );
};

export default ImageSettings; 