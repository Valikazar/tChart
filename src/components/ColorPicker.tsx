import React, { useState, useEffect } from 'react';
import { ChromePicker } from 'react-color';
import { Box, IconButton, Popover, Tooltip } from '@mui/material';
import { styled } from '@mui/material/styles';
import ColorizeIcon from '@mui/icons-material/Colorize';

interface ColorPickerProps {
  color: string;
  onChange: (color: string) => void;
  enableEyedropper?: boolean;
}

const ColorButton = styled(IconButton)(({ theme }) => ({
  width: '24px',
  height: '24px',
  padding: 0,
  border: '1px solid #ccc',
  borderRadius: '4px',
}));

const ColorSwatch = styled(Box)({
  width: '100%',
  height: '100%',
  borderRadius: '2px',
});

const EyedropperButton = styled(IconButton)(({ theme }) => ({
  width: '24px',
  height: '24px',
  padding: 0,
  border: '1px solid #ccc',
  borderRadius: '4px',
  marginLeft: '4px',
}));

const getColorFromCanvas = (canvas: HTMLCanvasElement, x: number, y: number): string => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return '#000000';
  
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  
  const canvasX = Math.floor(x * scaleX);
  const canvasY = Math.floor(y * scaleY);
  
  const imageData = ctx.getImageData(canvasX, canvasY, 1, 1);
  const [r, g, b] = imageData.data;
  
  return `#${[r, g, b].map(x => {
    const hex = x.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('')}`;
};

const ColorPicker: React.FC<ColorPickerProps> = ({ color, onChange, enableEyedropper = true }) => {
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const [pickerColor, setPickerColor] = useState(color);
  const [eyedropperActive, setEyedropperActive] = useState(false);

  useEffect(() => {
    setPickerColor(color);
  }, [color]);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleChange = (color: any) => {
    setPickerColor(color.hex);
    onChange(color.hex);
  };

  const handleEyedropperClick = () => {
    setEyedropperActive(true);
    
    const chartCanvas = document.getElementById('chart-canvas') as HTMLCanvasElement;
    if (!chartCanvas) {
      console.warn('Canvas element not found');
      setEyedropperActive(false);
      return;
    }

    document.body.style.cursor = 'crosshair';
    chartCanvas.style.border = '2px solid #2196f3';
    chartCanvas.style.borderRadius = '4px';
    chartCanvas.style.boxShadow = '0 0 10px rgba(33, 150, 243, 0.5)';
    
    const handleCanvasClick = (event: MouseEvent) => {
      const rect = chartCanvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      
      const selectedColor = getColorFromCanvas(chartCanvas, x, y);
      setPickerColor(selectedColor);
      onChange(selectedColor);
      
      chartCanvas.removeEventListener('click', handleCanvasClick);
      document.removeEventListener('keydown', handleEscapeKey);
      document.body.style.cursor = '';
      chartCanvas.style.border = '';
      chartCanvas.style.borderRadius = '';
      chartCanvas.style.boxShadow = '';
      setEyedropperActive(false);
    };

    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        chartCanvas.removeEventListener('click', handleCanvasClick);
        document.removeEventListener('keydown', handleEscapeKey);
        document.body.style.cursor = '';
        chartCanvas.style.border = '';
        chartCanvas.style.borderRadius = '';
        chartCanvas.style.boxShadow = '';
        setEyedropperActive(false);
      }
    };

    chartCanvas.addEventListener('click', handleCanvasClick);
    document.addEventListener('keydown', handleEscapeKey);
  };

  const open = Boolean(anchorEl);

  return (
    <Box sx={{ display: 'flex', alignItems: 'center' }}>
      <ColorButton onClick={handleClick}>
        <ColorSwatch sx={{ backgroundColor: pickerColor }} />
      </ColorButton>
      
      {enableEyedropper && (
        <Tooltip 
          title={eyedropperActive ? "Click on the graph to select a color (ESC to cancel)" : "Eyedropper - select color from graph"}
          arrow
        >
          <EyedropperButton 
            onClick={handleEyedropperClick}
            sx={{ 
              backgroundColor: eyedropperActive ? 'primary.main' : 'transparent',
              color: eyedropperActive ? 'white' : 'inherit'
            }}
          >
            <ColorizeIcon fontSize="small" />
          </EyedropperButton>
        </Tooltip>
      )}
      
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
        disableAutoFocus
        disableEnforceFocus
      >
        <ChromePicker 
          color={pickerColor} 
          onChange={handleChange}
          disableAlpha={true}
          styles={{
            default: {
              picker: {
                background: '#1e1e1e',
                boxShadow: 'none',
                border: '1px solid #333'
              },
              saturation: {
                border: '1px solid #333'
              },
              hue: {
                border: '1px solid #333'
              },
              swatch: {
                border: '1px solid #333'
              }
            }
          }}
        />
      </Popover>
    </Box>
  );
};

export default ColorPicker; 