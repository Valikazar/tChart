import React from 'react';
import { Box, Button, Typography, IconButton } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { ImageSettings } from '../types';

interface ImageControlsProps {
  label: string;
  settings: ImageSettings | null | undefined;
  onChange: (settings: ImageSettings | null) => void;
}

const ImageControls: React.FC<ImageControlsProps> = ({ label, settings, onChange }) => {
  const handleReset = () => {
    if (settings) {
      onChange(null);
    }
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
      <Typography variant="body2" sx={{ minWidth: 100 }}>{label}:</Typography>
      {settings?.url ? (
        <>
          <Typography variant="body2" noWrap sx={{ flex: 1, maxWidth: 200 }}>
            {settings.url.split('/').pop()}
          </Typography>
          <IconButton size="small" onClick={handleReset} color="error">
            <DeleteIcon />
          </IconButton>
        </>
      ) : (
        <Typography variant="body2" color="text.secondary">Нет изображения</Typography>
      )}
    </Box>
  );
};

export default ImageControls; 