import React, { useCallback, useRef } from 'react';
import { Paper, Typography, Box, IconButton, Stack } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import ColorPicker from './ColorPicker';
import SliderWithInput from './SliderWithInput';
import { BackgroundConfig, ImageConfig } from './types';
import { processBackgroundImage } from '../utils/imageProcessing';
import ImageSelectionButton, { ImageSelectionButtonHandle } from './ImageSelectionButton';

interface BackgroundConfiguratorProps {
  config: BackgroundConfig;
  onImageUpdate: (settings: Partial<ImageConfig>) => void;
  onColorUpdate: (color: string) => void;
  onOverlayColorUpdate: (color: string) => void;
  onOpacityUpdate: (opacity: number) => void;
  onFileNameUpdate?: (file: File) => void;
  uploadedFileName?: string;
}

const BackgroundConfigurator: React.FC<BackgroundConfiguratorProps> = ({
  config,
  onImageUpdate,
  onColorUpdate,
  onOverlayColorUpdate,
  onOpacityUpdate,
  onFileNameUpdate,
  uploadedFileName,
}) => {
  // For tracking the ImageSelectionButton instance
  const imageSelectionRef = useRef<ImageSelectionButtonHandle>(null);

  const handleImageDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) {
        try {
          // Save file name when dropping an image
          if (onFileNameUpdate) {
            onFileNameUpdate(file);
          }
          
          const url = await processBackgroundImage(file);
          onImageUpdate({ url });
          
          // Set the image source to 'local' when a file is uploaded from the computer
          if (imageSelectionRef.current) {
            imageSelectionRef.current.setImageSource('local');
            imageSelectionRef.current.setImageOwner(undefined);
          }
        } catch (error) {
          console.error('Failed to process image:', error);
        }
      }
    },
    [onImageUpdate, onFileNameUpdate]
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
          // Save file name when selecting an image
          if (onFileNameUpdate) {
            onFileNameUpdate(file);
          }
          
          const url = await processBackgroundImage(file);
          onImageUpdate({ url });
          
          // Update the imageSource reference in any components that use this image
          if (imageSelectionRef.current) {
            imageSelectionRef.current.setImageSource('local');
            imageSelectionRef.current.setImageOwner(undefined);
          }
        } catch (error) {
          console.error('Failed to process image:', error);
        }
      }
    };
    input.click();
  };
  
  const handleGalleryImageSelect = (imageUrl: string, imageParams?: any) => {
    const defaultImageConfig = {
      url: imageUrl,
      scale: 1,
      offsetX: 0,
      offsetY: 0,
      rotation: 0,
      hue: 0,
      mirror: false
    };

    // Проверяем, есть ли у изображения сохраненные параметры или переданные из галереи
    const hasParameters = imageParams && (
      imageParams.has_params || 
      'scale' in imageParams || 
      'x_offset' in imageParams || 
      'y_offset' in imageParams ||
      'rotation' in imageParams ||
      'hue' in imageParams ||
      'color' in imageParams ||
      'mirrored' in imageParams
    );

    // Если у изображения есть параметры из галереи, применяем их
    if (hasParameters) {
      const updatedConfig = {
        ...defaultImageConfig,
        url: imageUrl,
        scale: 'scale' in imageParams ? parseFloat(imageParams.scale) : defaultImageConfig.scale,
        offsetX: 'x_offset' in imageParams ? parseInt(imageParams.x_offset) : defaultImageConfig.offsetX,
        offsetY: 'y_offset' in imageParams ? parseInt(imageParams.y_offset) : defaultImageConfig.offsetY,
        rotation: 'rotation' in imageParams ? parseInt(imageParams.rotation) : defaultImageConfig.rotation,
        hue: 'hue' in imageParams ? parseInt(imageParams.hue) : 
             'color' in imageParams ? parseInt(imageParams.color) : defaultImageConfig.hue,
        mirror: 'mirrored' in imageParams ? !!imageParams.mirrored : defaultImageConfig.mirror
      };
      
      onImageUpdate(updatedConfig);
    } else {
      // Если параметров нет, используем значения по умолчанию
      onImageUpdate(defaultImageConfig);
    }
  };
  
  // Отладочный вывод
  // console.log('BackgroundConfigurator - config.image params:', {
  //   scale: config.image?.scale,
  //   offsetX: config.image?.offsetX,
  //   offsetY: config.image?.offsetY,
  //   rotation: config.image?.rotation,
  //   overlap: config.image?.overlap,
  //   color: config.color,
  //   mirror: config.image?.mirror
  // });

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
              enableEyedropper={true}
            />
          </Box>
        </Box>

        <Box sx={{ mb: 2 }}>
          <Typography sx={{ mb: 1 }}>Background Image</Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <Box
              sx={{
                border: '2px dashed',
                borderColor: 'divider',
                borderRadius: 1,
                p: 1,
                display: 'flex',
                flexGrow: 1,
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
            
            <ImageSelectionButton 
              ref={imageSelectionRef}
              partType="background"
              onImageSelect={handleGalleryImageSelect}
              label="From Gallery"
              tooltip="Select background image from server gallery"
              currentImage={config.image?.url}
              imageSource="local"
              imageParams={{
                scale: config.image?.scale,
                x_offset: config.image?.offsetX,
                y_offset: config.image?.offsetY,
                rotation: config.image?.rotation,
                overlap: config.image?.overlap,
                hue: config.image?.hue,
                mirrored: config.image?.mirror
              }}
              uploadedFileName={uploadedFileName}
            />
          </Stack>
        </Box>

        {/* Overlay Settings */}
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2" gutterBottom>Overlay</Typography>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 1 }}>
            <Typography>Overlay Color</Typography>
            <ColorPicker
              color={config.overlay?.color || '#000000'}
              onChange={onOverlayColorUpdate}
              enableEyedropper={true}
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
              step={0.005}
              isFloat={true}
            />
          </Box>
        </Box>
      </Box>
    </Paper>
  );
};

export default BackgroundConfigurator; 