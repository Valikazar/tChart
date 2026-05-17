import React, { useCallback, useState } from 'react';
import { Paper, Typography, Collapse, Box, IconButton, Divider, FormControl, Select, MenuItem, Checkbox, FormControlLabel, Stack, Button } from '@mui/material';
import { styled } from '@mui/material/styles';
import DeleteIcon from '@mui/icons-material/Delete';
import ColorPicker from './ColorPicker';
import ImageSettings from './ImageSettings';
import SliderWithInput from './SliderWithInput';
import { BarType, ImagePartType, BarConfig, ExtendedBarConfig } from './types';
import { processBarImage, processBodyImage } from '../utils/imageProcessing';
import ImageSelectionButton from './ImageSelectionButton';

interface BarConfiguratorProps {
  title: string;
  barType: BarType;
  config: BarConfig | ExtendedBarConfig;
  onImageUpdate: (barType: BarType | 'background', partType: ImagePartType | 'image', settings: any) => void;
  onColorUpdate: (barType: BarType | 'background' | 'overlay', color: string) => void;
  onImageSettingsUpdate: (barType: BarType, partType: ImagePartType, settings: any) => void;
  onUpdate: (config: BarConfig | ExtendedBarConfig) => void;
  showOnlyTop?: boolean;
  onFileNameUpdate?: (file: File) => void;
  uploadedFileName?: string;
  onCopyStyleFrom?: (fromBarType: BarType, toBarType: BarType) => void;
}

const ConfigSection = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2),
  marginBottom: theme.spacing(2),
}));

// Create styled grid components
const GridContainer = styled('div')(({ theme }) => ({
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.spacing(2)
}));

const GridItem = styled('div')(({ theme }) => ({
  flexBasis: '100%',
  [theme.breakpoints.up('sm')]: {
    flexBasis: 'calc(50% - 8px)',
  }
}));

const ImageGridItem = styled('div')(({ theme }) => ({
  flexBasis: '100%',
  [theme.breakpoints.up('sm')]: {
    flexBasis: 'calc(50% - 8px)',
  },
  [theme.breakpoints.up('md')]: {
    flexBasis: 'calc(33.33% - 8px)',
  }
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

const ImageSection = ({ type, config, barType, onImageClick, onImageDrop, onImageReset, onImageSettingsUpdate, onGalleryImageSelect, getImageParams, uploadedFileName }) => {
  const isCenter = type === 'center';
  const showSection = true; // Показываем center для всех типов баров: upBar, downBar, candle, knife, doji
  const imageConfig = isCenter ? (config as ExtendedBarConfig).center : config[type];

  // Отладочный вывод для параметров ImageSettings
  React.useEffect(() => {
    if (showSection && imageConfig?.url) {
      // console.log(`[DEBUG] ImageSection - Parameters for ${barType}.${type}:`, {
      //   scale: typeof imageConfig.scale === 'number' ? imageConfig.scale : parseFloat(imageConfig.scale) || 1,
      //   offsetX: typeof imageConfig.offsetX === 'number' ? imageConfig.offsetX : parseInt(imageConfig.offsetX) || 0,
      //   offsetY: typeof imageConfig.offsetY === 'number' ? imageConfig.offsetY : parseInt(imageConfig.offsetY) || 0,
      //   startFrom: type === 'body' ? (imageConfig.startFrom || 'top') : undefined,
      //   isBody: type === 'body',
      //   rotation: typeof imageConfig.rotation === 'number' ? imageConfig.rotation : parseInt(imageConfig.rotation) || 0,
      //   overlap: type === 'body' ? (typeof imageConfig.overlap === 'number' ? imageConfig.overlap : parseInt(imageConfig.overlap) || 2) : undefined,
      //   hue: typeof imageConfig.hue === 'number' ? imageConfig.hue : parseInt(imageConfig.hue) || 0,
      //   mirror: !!imageConfig.mirror
      // });
    }
  }, [imageConfig, barType, type, showSection]);

  if (!showSection) return null;

  // Получаем актуальные параметры для изображения - это для передачи в галерею при выборе нового изображения
  const imageParams = getImageParams ? getImageParams(type) : {
    scale: imageConfig?.scale || 1,
    x_offset: imageConfig?.offsetX || 0,
    y_offset: imageConfig?.offsetY || 0,
    rotation: imageConfig?.rotation || 0,
    overlap: type === 'body' ? (imageConfig?.overlap || 0) : undefined,
    hue: imageConfig?.hue || 0,
    mirrored: imageConfig?.mirror || false
  };
  
  // Функция для получения текущих параметров изображения
  const getCurrentImageParams = () => {
    return getImageParams(type);
  };

  return (
    <Box sx={{ mb: 2 }}>
      {/* Разграничитель сверху */}
      <Divider sx={{ my: 1 }} />
      
      {/* Заголовок с типом изображения и превью справа */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="h6" sx={{ 
            color: '#FFE082', 
            fontWeight: 'bold',
            textTransform: 'uppercase',
            fontSize: '1.1rem'
          }}>
            {type}
          </Typography>
          <Typography variant="h6" sx={{ color: 'text.secondary' }}>
            ↓
          </Typography>
        </Box>
        
        {/* Image Preview рядом с заголовком */}
        {imageConfig?.url && (
          <Box>
            <img
              src={imageConfig.url}
              alt={`${type} image preview`}
              style={{
                maxHeight: '40px',
                maxWidth: '60px',
                objectFit: 'contain',
                borderRadius: '4px',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                backgroundColor: 'rgba(0, 0, 0, 0.1)'
              }}
              onError={(e) => {
                // Hide image if it fails to load
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </Box>
        )}
      </Box>
      
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
        
        <ImageSelectionButton 
          partType={type as 'top' | 'body' | 'bottom' | 'center'}
          onImageSelect={(imageUrl, galleryImageParams) => onGalleryImageSelect(type, imageUrl, galleryImageParams)}
          label="From Gallery"
          tooltip={`Select ${type} image from server gallery`}
          currentImage={imageConfig?.url}
          imageParams={imageParams}
          getCurrentImageParams={getCurrentImageParams}
          uploadedFileName={uploadedFileName}
        />
      </Stack>
      
      {imageConfig?.url && (
        <Collapse in={true}>
          <Box sx={{ mt: 1 }}>
            <ImageSettings
              scale={typeof imageConfig.scale === 'number' ? imageConfig.scale : parseFloat(imageConfig.scale) || 1}
              offsetX={typeof imageConfig.offsetX === 'number' ? imageConfig.offsetX : parseInt(imageConfig.offsetX) || 0}
              offsetY={typeof imageConfig.offsetY === 'number' ? imageConfig.offsetY : parseInt(imageConfig.offsetY) || 0}
              startFrom={type === 'body' ? (imageConfig.startFrom || 'top') : undefined}
              isBody={type === 'body'}
              rotation={typeof imageConfig.rotation === 'number' ? imageConfig.rotation : parseInt(imageConfig.rotation) || 0}
              overlap={type === 'body' ? (typeof imageConfig.overlap === 'number' ? imageConfig.overlap : parseInt(imageConfig.overlap) || 2) : undefined}
              hue={typeof imageConfig.hue === 'number' ? imageConfig.hue : parseInt(imageConfig.hue) || 0}
              mirror={!!imageConfig.mirror}
              onScaleChange={value => onImageSettingsUpdate(barType, type, { scale: value })}
              onOffsetXChange={value => onImageSettingsUpdate(barType, type, { offsetX: value })}
              onOffsetYChange={value => onImageSettingsUpdate(barType, type, { offsetY: value })}
              onStartFromChange={
                type === 'body'
                  ? (value) => onImageSettingsUpdate(barType, type, { startFrom: value })
                  : undefined
              }
              onRotationChange={value => onImageSettingsUpdate(barType, type, { rotation: value })}
              onOverlapChange={
                type === 'body'
                  ? (value) => onImageSettingsUpdate(barType, type, { overlap: value })
                  : undefined
              }
              onHueChange={value => onImageSettingsUpdate(barType, type, { hue: value })}
              onMirrorChange={value => onImageSettingsUpdate(barType, type, { mirror: value })}
            />
          </Box>
        </Collapse>
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
  showOnlyTop = false,
  onFileNameUpdate,
  uploadedFileName,
  onCopyStyleFrom,
}) => {
  // Получаем список доступных типов баров для копирования (исключая текущий)
  const availableBarTypes: BarType[] = (['upBar', 'downBar', 'candle', 'knife', 'doji'] as BarType[]).filter(type => type !== barType);
  
  const [selectedBarType, setSelectedBarType] = useState<BarType>(availableBarTypes[0] || 'upBar');
  
  const configWithDefaults = {
    ...config
  };

  const handleGalleryImageSelect = (partType: ImagePartType, imageUrl: string, imageParams?: any) => {
    // Проверяем, есть ли у изображения сохраненные параметры или переданные из галереи
    const hasParameters = imageParams && (
      imageParams.has_params || 
      'scale' in imageParams || 
      'x_offset' in imageParams || 
      'y_offset' in imageParams ||
      'rotation' in imageParams ||
      'overlap' in imageParams ||
      'hue' in imageParams ||
      'color' in imageParams ||
      'mirrored' in imageParams
    );
    
    if (hasParameters) {
      // Проверяем наличие каждого ожидаемого параметра в объекте
      const hasScale = 'scale' in imageParams;
      const hasXOffset = 'x_offset' in imageParams;
      const hasYOffset = 'y_offset' in imageParams;
      const hasRotation = 'rotation' in imageParams;
      const hasOverlap = 'overlap' in imageParams;
      const hasHue = 'hue' in imageParams || 'color' in imageParams;
      const hasMirrored = 'mirrored' in imageParams;
      
      // Убедимся, что мы правильно считываем имена параметров и преобразуем их в числа
      const updatedParams = {
        url: imageUrl,
        scale: hasScale ? parseFloat(String(imageParams.scale)) : 1,
        offsetX: hasXOffset ? parseInt(String(imageParams.x_offset)) : 0,
        offsetY: hasYOffset ? parseInt(String(imageParams.y_offset)) : (partType === 'body' ? 0 : 0),
        startFrom: partType === 'body' ? 'top' : undefined,
        rotation: hasRotation ? parseInt(String(imageParams.rotation)) : 0,
        overlap: hasOverlap ? parseInt(String(imageParams.overlap)) : (partType === 'body' ? 0 : undefined),
        hue: hasHue ? 
          ('hue' in imageParams ? parseInt(String(imageParams.hue)) : 
          parseInt(String(imageParams.color)) || 0) : 0,
        mirror: hasMirrored ? Boolean(imageParams.mirrored) : false
      };
      
      // Обновляем конфигурацию
      onImageUpdate(barType, partType, updatedParams);
    } else {
      // Создаем дефолтные параметры
      const defaultParams = {
        url: imageUrl,
        scale: 1,
        offsetX: 0,
        offsetY: partType === 'body' ? 0 : 0,
        startFrom: partType === 'body' ? 'top' : undefined,
        rotation: 0,
        overlap: partType === 'body' ? 0 : undefined,
        hue: 0,
        mirror: false
      };
      
      onImageUpdate(barType, partType, defaultParams);
    }
  };

  // Вспомогательная функция для проверки, является ли partType 'center'
  const isCenter = (partType: string): boolean => {
    return partType === 'center';
  };

  const renderImageSection = (
    barType: BarType,
    partType: ImagePartType,
    settings?: { 
      url: string; 
      scale: number; 
      offsetX: number; 
      offsetY: number; 
      startFrom?: 'top' | 'bottom' | 'fill';
      hue?: number;
      mirror?: boolean;
    }
  ) => {
    return (
      <ImageGridItem>
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
              hue={settings.hue || 0}
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
              onHueChange={(hue) =>
                onImageSettingsUpdate(barType, partType, {
                  ...settings,
                  hue,
                })
              }
            />
          )}
        </Collapse>
      </ImageGridItem>
    );
  };

  const handleImageDrop = useCallback(
    async (partType: ImagePartType, e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();

      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) {
        try {
          // Save file name when dropping an image
          if (onFileNameUpdate) {
            onFileNameUpdate(file);
          }
          
          // Определяем категорию на основе partType
          let category: string;
          if (partType === 'body') {
            category = 'body';
          } else if (partType === 'center') {
            category = 'center';
          } else { // 'top' или 'bottom'
            category = 'topbot';
          }
          
          const url = partType === 'body' 
            ? await processBodyImage(file, category)
            : await processBarImage(file, category);
            
          const imageParams = {
            url,
            scale: 1,
            offsetX: 0,
            offsetY: partType === 'body' ? 0 : 0,
            startFrom: partType === 'body' ? 'top' : undefined,
            rotation: 0,
            overlap: partType === 'body' ? 0 : undefined,
            mirror: false
          };
          
          // console.log(`Dropped image params for ${barType}.${partType}:`, imageParams);
          onImageUpdate(barType, partType, imageParams);
        } catch (error) {
          console.error('Failed to process image:', error);
        }
      }
    },
    [onImageUpdate, barType, onFileNameUpdate]
  );

  const handleImageReset = (partType: ImagePartType) => {
    const resetParams = { 
      url: '', 
      scale: 1, 
      offsetX: 0, 
      offsetY: 0,
      startFrom: partType === 'body' ? 'top' : undefined,
      rotation: 0,
      overlap: partType === 'body' ? 0 : undefined,
      mirror: false
    };
    onImageUpdate(barType, partType, resetParams);
  };

  const handleImageClick = (partType: ImagePartType) => {
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
          
          // Определяем категорию на основе partType
          let category: string;
          if (partType === 'body') {
            category = 'body';
          } else if (partType === 'center') {
            category = 'center';
          } else { // 'top' или 'bottom'
            category = 'topbot';
          }
          
          const url = partType === 'body' 
            ? await processBodyImage(file, category)
            : await processBarImage(file, category);
            
          const imageParams = {
            url,
            scale: 1,
            offsetX: 0,
            offsetY: 0,
            startFrom: partType === 'body' ? 'top' : undefined,
            rotation: 0,
            overlap: partType === 'body' ? 0 : undefined,
            mirror: false
          };
          
          // console.log(`Selected image params for ${barType}.${partType}:`, imageParams);
          onImageUpdate(barType, partType, imageParams);
        } catch (error) {
          console.error('Failed to process image:', error);
        }
      }
    };
    input.click();
  };

  // Load updated image parameters when calling ImageSelectionButton
  const getImageParams = (partType: ImagePartType) => {
    // Нам нужно найти актуальные текущие параметры для этого изображения
    if (!config || !config[partType]) {
      return {
        scale: 1,
        x_offset: 0,
        y_offset: 0,
        rotation: 0,
        overlap: partType === 'body' ? 0 : undefined,
        hue: 0,
        mirrored: false
      };
    }
    
    // Получаем текущие параметры для этого типа
    const imageConfig = config[partType];
    
   //console.log(`Getting current parameters for ${barType}.${partType}:`, imageConfig);
    
    return {
      scale: imageConfig.scale !== undefined ? imageConfig.scale : 1,
      x_offset: imageConfig.offsetX !== undefined ? imageConfig.offsetX : 0,
      y_offset: imageConfig.offsetY !== undefined ? imageConfig.offsetY : 0,
      rotation: imageConfig.rotation !== undefined ? imageConfig.rotation : 0,
      overlap: partType === 'body' && imageConfig.overlap !== undefined ? imageConfig.overlap : 0,
      hue: imageConfig.hue !== undefined ? imageConfig.hue : 0,
      mirrored: imageConfig.mirror === true
    };
  };

  // Функция для обработки копирования стилей
  const handleCopyStyle = () => {
    if (onCopyStyleFrom) {
      onCopyStyleFrom(selectedBarType, barType);
    }
  };

  return (
    <Paper sx={{ p: 1, width: '100%' }}>
      
      {/* Copy Style Section */}
      {onCopyStyleFrom && (
        <Box sx={{ mb: 2, p: 1, backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: 1 }}>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <Typography variant="caption" sx={{ minWidth: '80px' }}>Copy style from:</Typography>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <Select
                value={selectedBarType}
                onChange={(e) => setSelectedBarType(e.target.value as BarType)}
                displayEmpty
              >
                {availableBarTypes.map((type) => (
                  <MenuItem key={type} value={type}>
                    {type === 'upBar' ? 'Up Bar' :
                     type === 'downBar' ? 'Down Bar' :
                     type === 'candle' ? 'Candle' :
                     type === 'knife' ? 'Knife' :
                     type === 'doji' ? 'Doji' : type}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button 
              variant="outlined" 
              size="small" 
              onClick={handleCopyStyle}
              disabled={!selectedBarType}
            >
              Copy
            </Button>
          </Box>
        </Box>
      )}
      
      {/* Bar Color Settings */}
      <Divider sx={{ my: 0 }} />
      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 1 }}>
          <Typography>Bar Color</Typography>
          <ColorPicker
            color={config.color}
            onChange={(color) => onColorUpdate(barType, color)}
            enableEyedropper={true}
          />
        </Box>
      </Box>

            {/* Image Sections */}
      {['top', 'body', 'center', 'bottom'].filter(type => {
        if (showOnlyTop) {
          return type === 'top';
        }
        // Показываем center для всех типов баров: upBar, downBar, candle, knife, doji
        return true;
      }).map(type => (
        <ImageSection
          key={type}
          type={type as ImagePartType}
          config={config}
          barType={barType}
          onImageClick={handleImageClick}
          onImageDrop={(type, e) => handleImageDrop(type, e)}
          onImageReset={handleImageReset}
          onImageSettingsUpdate={onImageSettingsUpdate}
          onGalleryImageSelect={handleGalleryImageSelect}
          getImageParams={getImageParams}
          uploadedFileName={uploadedFileName}
        />
      ))}
      

    </Paper>
  );
};

export default BarConfigurator; 