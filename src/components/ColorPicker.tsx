import React, { useState, useEffect } from 'react';
import { ChromePicker } from 'react-color';
import { Box, IconButton, Popover } from '@mui/material';
import { styled } from '@mui/material/styles';

interface ColorPickerProps {
  color: string;
  onChange: (color: string) => void;
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

const ColorPicker: React.FC<ColorPickerProps> = ({ color, onChange }) => {
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const [pickerColor, setPickerColor] = useState(color);

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

  const open = Boolean(anchorEl);

  return (
    <>
      <ColorButton onClick={handleClick}>
        <ColorSwatch sx={{ backgroundColor: pickerColor }} />
      </ColorButton>
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
    </>
  );
};

export default ColorPicker; 