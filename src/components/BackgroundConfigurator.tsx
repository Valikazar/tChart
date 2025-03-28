import React, { useCallback } from 'react';
import { Paper, Typography, Box, IconButton } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import ColorPicker from './ColorPicker';
import SliderWithInput from './SliderWithInput';
import { BackgroundConfig } from '../types';
import { processBackgroundImage } from '../utils/imageProcessing';

interface BackgroundConfiguratorProps {
  config: BackgroundConfig;
  onImageUpdate: (settings: { url: string }) => void;
  onColorUpdate: (color: string) => void;
  onOverlayColorUpdate: (color: string) => void;
  onOpacityUpdate: (opacity: number) => void;
}

const BackgroundConfigurator: React.FC<BackgroundConfiguratorProps> = ({
  config,
  onImageUpdate,
  onColorUpdate,
  onOverlayColorUpdate,
  onOpacityUpdate,
}) => {
  const handleImageDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) {
        try {
          const url = await processBackgroundImage(file);
          onImageUpdate({ url });
        } catch (error) {
          console.error('Failed to process image:', error);
        }
      }
    },
    [onImageUpdate]
  );

  const handleImageReset = () => {
    onImageUpdate({ url: '' });
  };

  const handleImageClick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file && file.type.startsWith('image/')) {
        try {
          const url = await processBackgroundImage(file);
          onImageUpdate({ url });
        } catch (error) {
          console.error('Failed to process image:', error);
        }
      }
    };
    input.click();
  };

  return (
    <Paper sx={{ p: 0, mb: 0 }}>
      <Box sx={{ p: 2 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>Background</Typography>
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
            <Typography>Background Color</Typography>
            <ColorPicker
              color={config.color}
              onChange={onColorUpdate}
            />
          </Box>
        </Box>

        <Box sx={{ mb: 2 }}>
          <Typography sx={{ mb: 1 }}>Background Image</Typography>
          <Box
            sx={{
              border: '2px dashed',
              borderColor: 'divider',
              borderRadius: 1,
              p: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              cursor: 'pointer',
              '&:hover': {
                borderColor: 'primary.main',
              },
            }}
            onClick={handleImageClick}
            onDrop={handleImageDrop}
            onDragOver={(e) => e.preventDefault()}
          >
            <Typography>
              {config.image?.url ? 
                <>Change <span style={{color: '#FFE082', fontWeight: 'bold'}}>background</span></> : 
                <>Drop or click to select <span style={{color: '#FFE082', fontWeight: 'bold'}}>background</span> image</>
              }
            </Typography>
            {config.image?.url && (
              <IconButton 
                size="small" 
                onClick={(e) => {
                  e.stopPropagation();
                  handleImageReset();
                }}
                color="error"
              >
                <DeleteIcon />
              </IconButton>
            )}
          </Box>
        </Box>

        {/* Overlay Settings */}
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2" gutterBottom>Overlay</Typography>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 1 }}>
            <Typography>Overlay Color</Typography>
            <ColorPicker
              color={config.overlay?.color || '#000000'}
              onChange={onOverlayColorUpdate}
            />
          </Box>
          <Box sx={{ mt: 1 }}>
            <Typography variant="caption" gutterBottom>
              Opacity
            </Typography>
            <SliderWithInput
              value={config.opacity || 0}
              onChange={onOpacityUpdate}
              min={0}
              max={1}
              step={0.01}
              isFloat={true}
            />
          </Box>
        </Box>
      </Box>
    </Paper>
  );
};

export default BackgroundConfigurator; 