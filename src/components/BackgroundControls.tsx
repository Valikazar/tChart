import React from 'react';
import { Box, Typography, IconButton } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { BackgroundConfig } from '../types';

interface BackgroundControlsProps {
  background: BackgroundConfig;
  onChange: (background: BackgroundConfig) => void;
}

const BackgroundControls: React.FC<BackgroundControlsProps> = ({ background, onChange }) => {
  const handleReset = () => {
    onChange({
      ...background,
      url: ''
    });
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
      <Typography variant="body2" sx={{ minWidth: 100 }}>Background:</Typography>
      {background.url ? (
        <>
          <Typography variant="body2" noWrap sx={{ flex: 1, maxWidth: 200 }}>
            {background.url.split('/').pop()}
          </Typography>
          <IconButton size="small" onClick={handleReset} color="error">
            <DeleteIcon />
          </IconButton>
        </>
      ) : (
        <Typography variant="body2" color="text.secondary">No background image</Typography>
      )}
    </Box>
  );
};

export default BackgroundControls; 