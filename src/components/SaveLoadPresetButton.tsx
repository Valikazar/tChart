import React from 'react';
import { Button } from '@mui/material';
import { Style as StyleIcon } from '@mui/icons-material';

interface SaveLoadPresetButtonProps {
  editingPreset?: {name: string, id: number} | null;
  address?: string;
  isTgSession?: boolean;
  disabled?: boolean;
  onClick: () => void;
  variant?: 'contained' | 'outlined' | 'text';
  color?: 'primary' | 'secondary' | 'success' | 'error' | 'info' | 'warning';
  size?: 'small' | 'medium' | 'large';
  fullWidth?: boolean;
  sx?: any;
}

const SaveLoadPresetButton: React.FC<SaveLoadPresetButtonProps> = ({
  editingPreset,
  address,
  isTgSession,
  disabled,
  onClick,
  variant = 'contained',
  color,
  size = 'medium',
  fullWidth,
  sx
}) => {
  const buttonColor = editingPreset ? "warning" : (color || "secondary");
  const buttonText = editingPreset ? `Update: ${editingPreset.name}` : 'Save Preset';
  
  return (
    <Button
      variant={variant}
      color={buttonColor}
      size={size}
      fullWidth={fullWidth}
      startIcon={<StyleIcon />}
      onClick={onClick}
      disabled={disabled || !address || isTgSession}
      sx={sx}
    >
      {buttonText}
    </Button>
  );
};

export default SaveLoadPresetButton; 