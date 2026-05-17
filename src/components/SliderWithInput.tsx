import React, { useState, useEffect } from 'react';
import { Box, Slider, TextField } from '@mui/material';

interface SliderWithInputProps {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  isFloat?: boolean;
}

const SliderWithInput: React.FC<SliderWithInputProps> = ({
  value,
  onChange,
  min,
  max,
  step,
  isFloat = false,
}) => {
  const [inputValue, setInputValue] = useState(value.toString());

  useEffect(() => {
    setInputValue(isFloat ? value.toFixed(3) : value.toString());
  }, [value, isFloat]);

  const handleSliderChange = (_: Event, newValue: number | number[]) => {
    const value = Array.isArray(newValue) ? newValue[0] : newValue;
    onChange(value);
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.value;
    setInputValue(newValue);
    
    const numValue = parseFloat(newValue);
    if (!isNaN(numValue) && numValue >= min && numValue <= max) {
      onChange(isFloat ? numValue : Math.round(numValue));
    }
  };

  const handleBlur = () => {
    const numValue = parseFloat(inputValue);
    if (isNaN(numValue) || numValue < min) {
      setInputValue(min.toString());
      onChange(min);
    } else if (numValue > max) {
      setInputValue(max.toString());
      onChange(max);
    } else {
      const roundedValue = isFloat ? numValue : Math.round(numValue);
      setInputValue(isFloat ? roundedValue.toFixed(3) : roundedValue.toString());
      onChange(roundedValue);
    }
  };

  return (
    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
      <Slider
        value={value}
        onChange={handleSliderChange}
        min={min}
        max={max}
        step={step}
        sx={{ flex: 1, minWidth: '100px' }}
      />
      <TextField
        value={inputValue}
        onChange={handleInputChange}
        onBlur={handleBlur}
        size="small"
        type="number"
        sx={{ minWidth: '90px' }}
        inputProps={{
          step,
          min,
          max,
          style: { width: '60px' }
        }}
      />
    </Box>
  );
};

export default SliderWithInput; 