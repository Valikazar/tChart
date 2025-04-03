import React from 'react';
import { Box, Typography, Select, MenuItem, FormControl, InputLabel, Switch, FormControlLabel } from '@mui/material';
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
  onScaleChange: (scale: number) => void;
  onOffsetXChange: (offsetX: number) => void;
  onOffsetYChange: (offsetY: number) => void;
  onStartFromChange?: (startFrom: 'top' | 'bottom' | 'fill') => void;
  onRotationChange?: (rotation: number) => void;
  onOverlapChange?: (overlap: number) => void;
  onHueChange?: (hue: number) => void;
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
  onScaleChange,
  onOffsetXChange,
  onOffsetYChange,
  onStartFromChange,
  onRotationChange,
  onOverlapChange,
  onHueChange,
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
      {onHueChange && (
        <Box sx={{ mb: 1, minWidth: '200px' }}>
          <Typography variant="caption" gutterBottom>
            Color Balance
          </Typography>
          <SliderWithInput
            value={hue}
            onChange={onHueChange}
            min={0}
            max={360}
            step={1}
            isFloat={false}
          />
        </Box>
      )}
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
      {isBody && onOverlapChange && (
        <Box sx={{ mb: 1, minWidth: '200px' }}>
          <Typography variant="caption" gutterBottom>
            Overlap (%)
          </Typography>
          <SliderWithInput
            value={overlap}
            onChange={onOverlapChange}
            min={0}
            max={50}
            step={1}
            isFloat={false}
          />
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
      {onRotationChange && (
        <Box sx={{ mb: 1, minWidth: '200px' }}>
          <Typography variant="caption" gutterBottom>
            Rotation
          </Typography>
          <SliderWithInput
            value={rotation}
            onChange={onRotationChange}
            min={-180}
            max={180}
            step={1}
          />
        </Box>
      )}
    </Box>
  );
};

export default ImageSettings; 