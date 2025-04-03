import React, { useCallback } from 'react';
import { Grid, Paper, Typography, Collapse, Box, IconButton, Divider, FormControl, Select, MenuItem } from '@mui/material';
import { styled } from '@mui/material/styles';
import DeleteIcon from '@mui/icons-material/Delete';
import ColorPicker from './ColorPicker';
import ImageSettings from './ImageSettings';
import SliderWithInput from './SliderWithInput';
import { BarType, ImagePartType, BarConfig, ExtendedBarConfig } from '../types';
import { processBarImage, processBodyImage } from '../utils/imageProcessing';

interface BarConfiguratorProps {
  title: string;
  barType: BarType;
  config: BarConfig | ExtendedBarConfig;
  onImageUpdate: (barType: BarType | 'background', partType: ImagePartType | 'image', settings: any) => void;
  onColorUpdate: (barType: BarType | 'background' | 'overlay', color: string) => void;
  onImageSettingsUpdate: (barType: BarType, partType: ImagePartType, settings: any) => void;
  onUpdate: (config: BarConfig | ExtendedBarConfig) => void;
}

const ConfigSection = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2),
  marginBottom: theme.spacing(2),
}));

const CompactGrid = styled(Grid)(({ theme }) => ({
  '& .MuiGrid-item': {
    paddingTop: theme.spacing(1),
    paddingBottom: theme.spacing(1),
  },
}));

interface ImageDropZoneProps {
  currentImage?: string;
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  barType?: BarType;
  partType?: ImagePartType;
}

const StyledImageDropZone = styled(Box)<Omit<ImageDropZoneProps, 'onDrop'>>(({ theme }) => ({
  border: `2px dashed ${theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
  padding: theme.spacing(1),
  marginBottom: theme.spacing(1),
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  cursor: 'pointer',
  '&:hover': {
    borderColor: theme.palette.primary.main,
  },
}));

const ImageDropZone: React.FC<ImageDropZoneProps> = ({ currentImage, onDrop, barType, partType }) => {
  return (
    <StyledImageDropZone
      onDrop={onDrop}
      onDragOver={(e) => e.preventDefault()}
      currentImage={currentImage}
      barType={barType}
      partType={partType}
    >
      <Typography>
        {currentImage ? `Change ${partType} image` : `Drop or click to select ${partType} image`}
      </Typography>
    </StyledImageDropZone>
  );
};

const ImageSection = ({ type, config, barType, onImageClick, onImageDrop, onImageReset, onImageSettingsUpdate }) => {
  const isCenter = type === 'center';
  const showSection = isCenter ? (barType === 'candle' || barType === 'knife') : true;
  const imageConfig = isCenter ? (config as ExtendedBarConfig).center : config[type];

  if (!showSection) return null;

  return (
    <Box sx={{ mb: 2 }}>
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
        onClick={() => onImageClick(type)}
        onDrop={(e) => onImageDrop(type, e)}
        onDragOver={(e) => e.preventDefault()}
      >
        <Typography>
          {imageConfig?.url ? 'Change ' : 'Drop or click to select '}<span style={{color: '#FFE082', fontWeight: 'bold'}}>{type}</span>{' image'}
        </Typography>
        {imageConfig?.url && (
          <IconButton 
            size="small" 
            onClick={(e) => {
              e.stopPropagation();
              onImageReset(type);
            }}
            color="error"
          >
            <DeleteIcon />
          </IconButton>
        )}
      </Box>

      {imageConfig?.url && (
        <Box sx={{ mt: 1, ml: 2 }}>
          <ImageSettings
            scale={imageConfig.scale || 1}
            offsetX={imageConfig.offsetX || 0}
            offsetY={type === 'body' ? 0 : (imageConfig.offsetY || 0)}
            startFrom={type === 'body' ? (imageConfig.startFrom || 'top') : undefined}
            isBody={type === 'body'}
            rotation={imageConfig.rotation || 0}
            overlap={type === 'body' ? (imageConfig.overlap || 2) : undefined}
            onScaleChange={(newScale) => {
              onImageSettingsUpdate(barType, type, {
                ...imageConfig,
                scale: newScale,
              });
            }}
            onOffsetXChange={(newOffsetX) => {
              onImageSettingsUpdate(barType, type, {
                ...imageConfig,
                offsetX: newOffsetX,
              });
            }}
            onOffsetYChange={(newOffsetY) => {
              if (type !== 'body') {
                onImageSettingsUpdate(barType, type, {
                  ...imageConfig,
                  offsetY: newOffsetY,
                });
              }
            }}
            onStartFromChange={type === 'body' ? (newStartFrom) => {
              onImageSettingsUpdate(barType, type, {
                ...imageConfig,
                startFrom: newStartFrom,
              });
            } : undefined}
            onRotationChange={(newRotation) => {
              onImageSettingsUpdate(barType, type, {
                ...imageConfig,
                rotation: newRotation,
              });
            }}
            onOverlapChange={type === 'body' ? (newOverlap) => {
              onImageSettingsUpdate(barType, type, {
                ...imageConfig,
                overlap: newOverlap,
              });
            } : undefined}
          />
        </Box>
      )}
    </Box>
  );
};

const BarConfigurator: React.FC<BarConfiguratorProps> = ({
  title,
  barType,
  config,
  onImageUpdate,
  onColorUpdate,
  onImageSettingsUpdate,
  onUpdate,
}) => {
  const configWithDefaults = {
    ...config,
    borderWidth: config.borderWidth ?? 0,
    lineWidth: config.lineWidth ?? 0.5
  };

  const renderImageSection = (
    barType: BarType,
    partType: ImagePartType,
    settings?: { 
      url: string; 
      scale: number; 
      offsetX: number; 
      offsetY: number; 
      startFrom?: 'top' | 'bottom' 
    }
  ) => {
    return (
      <Grid item xs={12} sm={6} md={4}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <Typography variant="caption" sx={{ mr: 1 }}>
            {partType === 'top' ? 'Top' : 
             partType === 'bottom' ? 'Bottom' : 'Center'}
          </Typography>
          <Box sx={{ flexGrow: 1 }}>
            <ImageDropZone
              currentImage={settings?.url}
              onDrop={(e) => handleImageDrop(partType, e)}
              barType={barType}
              partType={partType}
            />
          </Box>
        </Box>
        <Collapse in={!!settings}>
          {settings && (
            <ImageSettings
              scale={settings.scale}
              offsetX={settings.offsetX}
              offsetY={settings.offsetY}
              startFrom={settings.startFrom}
              isBody={partType === 'body'}
              onScaleChange={(scale) =>
                onImageSettingsUpdate(barType, partType, {
                  ...settings,
                  scale,
                })
              }
              onOffsetXChange={(offsetX) =>
                onImageSettingsUpdate(barType, partType, {
                  ...settings,
                  offsetX,
                })
              }
              onOffsetYChange={(offsetY) =>
                onImageSettingsUpdate(barType, partType, {
                  ...settings,
                  offsetY,
                })
              }
              onStartFromChange={partType === 'body' ? (startFrom) =>
                onImageSettingsUpdate(barType, partType, {
                  ...settings,
                  startFrom,
                })
              : undefined}
            />
          )}
        </Collapse>
      </Grid>
    );
  };

  const handleImageDrop = useCallback(
    async (partType: ImagePartType | 'image', e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) {
        try {
          const url = partType === 'body' 
            ? await processBodyImage(file)
            : await processBarImage(file);
            
          onImageUpdate(barType, partType, {
            url,
            scale: 1,
            offsetX: 0,
            offsetY: partType === 'body' ? 0 : 0,
            startFrom: partType === 'body' ? 'top' : undefined
          });
        } catch (error) {
          console.error('Failed to process image:', error);
        }
      }
    },
    [onImageUpdate, barType]
  );

  const handleImageReset = (partType: ImagePartType) => {
    onImageUpdate(barType, partType, { 
      url: '', 
      scale: 1, 
      offsetX: 0, 
      offsetY: 0,
      startFrom: partType === 'body' ? 'top' : undefined 
    });
  };

  const handleImageClick = (partType: ImagePartType) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file && file.type.startsWith('image/')) {
        try {
          const url = partType === 'body' 
            ? await processBodyImage(file)
            : await processBarImage(file);
            
          onImageUpdate(barType, partType, {
            url,
            scale: 1,
            offsetX: 0,
            offsetY: 0,
            startFrom: partType === 'body' ? 'top' : undefined
          });
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
        <Typography variant="h6">{title}</Typography>
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography>Bar Color</Typography>
            <ColorPicker color={configWithDefaults.color} onChange={(color) => onColorUpdate(barType, color)} />
          </Box>
        </Box>

        <Box sx={{ mb: 2 }}>
          <Typography>Border Width & Style</Typography>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 1 }}>
            <Box sx={{ flex: 1, minWidth: '180px' }}>
              <SliderWithInput
                value={configWithDefaults.borderWidth}
                onChange={(value) => onUpdate({ ...configWithDefaults, borderWidth: value })}
                min={0}
                max={15}
                step={1}
              />
            </Box>
          {configWithDefaults.borderWidth > 0 && (
            <>
                <ColorPicker
                  color={configWithDefaults.borderColor || configWithDefaults.color}
                  onChange={(color) => onUpdate({ ...configWithDefaults, borderColor: color })}
                />
                <FormControl size="small">
                  <Select
                    value={configWithDefaults.borderStyle || 'inside'}
                    onChange={(e) => onUpdate({ ...configWithDefaults, borderStyle: e.target.value as 'inside' | 'outside' })}
                  >
                    <MenuItem value="inside">Inside</MenuItem>
                    <MenuItem value="outside">Outside</MenuItem>
                  </Select>
                </FormControl>
            </>
          )}
          </Box>
        </Box>

        <Box sx={{ mb: 2 }}>
          <Typography>High/Low Line</Typography>
          
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 1 }}>
            <Typography variant="body2">Width</Typography>
            <Box sx={{ flex: 1, minWidth: '180px' }}>
              <SliderWithInput
                value={configWithDefaults.lineWidth}
                onChange={(value) => onUpdate({ ...configWithDefaults, lineWidth: value })}
                min={0}
                max={15}
                step={1}
                isFloat={false}
              />
            </Box>
              <ColorPicker
                color={configWithDefaults.lineColor || configWithDefaults.color}
              onChange={(color) => onUpdate({ ...configWithDefaults, lineColor: color })}
            />
          </Box>

        </Box>

        <Divider sx={{ my: 2 }} />
        
        <Box sx={{ mt: 2 }}>
          <ImageSection 
            type="top"
            config={config}
            barType={barType}
            onImageClick={handleImageClick}
            onImageDrop={handleImageDrop}
            onImageReset={handleImageReset}
            onImageSettingsUpdate={onImageSettingsUpdate}
          />
          
          <ImageSection 
            type="body"
            config={config}
            barType={barType}
            onImageClick={handleImageClick}
            onImageDrop={handleImageDrop}
            onImageReset={handleImageReset}
            onImageSettingsUpdate={onImageSettingsUpdate}
          />

          <ImageSection 
            type="center"
            config={config}
            barType={barType}
            onImageClick={handleImageClick}
            onImageDrop={handleImageDrop}
            onImageReset={handleImageReset}
            onImageSettingsUpdate={onImageSettingsUpdate}
          />

          <ImageSection 
            type="bottom"
            config={config}
            barType={barType}
            onImageClick={handleImageClick}
            onImageDrop={handleImageDrop}
            onImageReset={handleImageReset}
            onImageSettingsUpdate={onImageSettingsUpdate}
          />
        </Box>
      </Box>
    </Paper>
  );
};

export default BarConfigurator; 