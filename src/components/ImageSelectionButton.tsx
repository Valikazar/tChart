import React, { useState, useEffect, useImperativeHandle, forwardRef, useRef } from 'react';
import { Button, Box, Tooltip, Stack } from '@mui/material';
import PhotoLibraryIcon from '@mui/icons-material/PhotoLibrary';
import SaveIcon from '@mui/icons-material/Save';
import ImageGallery from './ImageGallery';
import SaveToGalleryButton from './SaveToGalleryButton';
import { useAccount } from 'wagmi';

const SUPREME_ADMIN = '0xf7427BD018809723e778Be7EaE4FaB6C81474C70';

// Image file structure from API
interface ImageFile {
  filename: string;
  path: string;
  id?: number;
  name?: string;
  genre?: string;
  class?: string;
  owner?: string;
  scale?: number;
  x_offset?: number;
  y_offset?: number;
  rotation?: number;
  overlap?: number;
  color?: string;
  mirrored?: boolean;
  has_params?: boolean;
}

export interface ImageSelectionButtonHandle {
  setImageSource: (source: 'gallery' | 'local' | 'url') => void;
  setImageOwner: (owner: string | undefined) => void;
  setImageParams: (params: any) => void;
}

interface ImageSelectionButtonProps {
  partType: 'top' | 'body' | 'bottom' | 'center' | 'background';
  onImageSelect: (imageUrl: string, imageParams?: any) => void;
  label?: string;
  tooltip?: string;
  // Параметры для SaveToGalleryButton
  currentImage?: string; // Base64 текущего изображения
  imageOwner?: string; // Владелец изображения, если из галереи
  imageSource?: 'gallery' | 'local' | 'url'; // Источник изображения
  imageParams?: { // Параметры редактирования изображения
    scale?: number;
    x_offset?: number;
    y_offset?: number;
    rotation?: number;
    overlap?: number;
    hue?: number;
    mirrored?: boolean;
  };
  onSaveSuccess?: (data: any) => void;
  onImageSourceChange?: (source: 'gallery' | 'local' | 'url') => void;
  // Функция для получения актуальных параметров изображения
  getCurrentImageParams?: () => any;
  uploadedFileName?: string;
}

const ImageSelectionButton = forwardRef<ImageSelectionButtonHandle, ImageSelectionButtonProps>((
  {
  partType,
  onImageSelect,
  label = 'Select from gallery',
    tooltip = 'Select image from server gallery',
    currentImage,
    imageOwner: initialImageOwner,
    imageSource: initialImageSource = 'local',
    imageParams: initialImageParams,
    onSaveSuccess,
    onImageSourceChange,
    getCurrentImageParams,
    uploadedFileName
  }, 
  ref
) => {
  const [galleryOpen, setGalleryOpen] = useState(false);
  const { address } = useAccount();
  
  // State to track image metadata
  const [imageOwner, setImageOwner] = useState<string | undefined>(initialImageOwner);
  const [imageSource, setImageSource] = useState<'gallery' | 'local' | 'url'>(initialImageSource || 'local');
  const [imageParams, setImageParams] = useState(initialImageParams || {});

  // Функция для получения актуальных параметров изображения
  const getActualImageParams = () => {
    // Если родительский компонент предоставил функцию для получения актуальных параметров
    if (getCurrentImageParams) {
      return getCurrentImageParams();
    }
    
    // Иначе возвращаем текущие параметры из состояния компонента
    return imageParams;
  };

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    setImageSource: (source) => {
      setImageSource(source);
      if (onImageSourceChange) onImageSourceChange(source);
    },
    setImageOwner: (owner) => {
      setImageOwner(owner);
    },
    setImageParams: (params) => {
      setImageParams(params);
    }
  }));

  // Reset image source to 'local' when a new image is loaded but not from gallery
  useEffect(() => {
    // This effect captures cases when an image is loaded from computer or URL
    // but not via the gallery handler
    if (currentImage && initialImageSource !== 'gallery' && imageSource !== initialImageSource) {
      setImageSource(initialImageSource || 'local');
      setImageOwner(undefined);
    }
  }, [currentImage, initialImageSource, imageSource]);

  // Определяем категорию для API-запроса на основе типа части
  const getCategory = (): 'body' | 'center' | 'topbot' | 'bg' => {
    if (partType === 'body') return 'body';
    if (partType === 'center') return 'center';
    if (partType === 'background') return 'bg';
    return 'topbot'; // для 'top' и 'bottom'
  };

  // Определяем заголовок галереи
  const getTitle = (): string => {
    switch(partType) {
      case 'top': return 'Top Images';
      case 'body': return 'Body Images';
      case 'bottom': return 'Bottom Images';
      case 'center': return 'Center Images';
      case 'background': return 'Background Images';
      default: return 'Select Image';
    }
  };
  
  // Handler for image selection from gallery
  const handleImageSelect = (imageUrl: string, imageData: any) => {
    // Set image metadata from selected image
    setImageOwner(imageData.owner);
    // Always set source to gallery when selecting from gallery
    setImageSource('gallery');
    
    if (onImageSourceChange) {
      onImageSourceChange('gallery');
    }
    
    let newParams = {};
    
    // Проверяем, получили ли мы напрямую параметры или объект ImageFile
    if (imageData && typeof imageData === 'object') {
      if ('has_params' in imageData && imageData.has_params) {
        // Это объект ImageFile с has_params = true
        newParams = {
          scale: imageData.scale,
          x_offset: imageData.x_offset,
          y_offset: imageData.y_offset,
          rotation: imageData.rotation,
          overlap: imageData.overlap,
          hue: typeof imageData.color === 'string' 
              ? parseInt(imageData.color) || 0 
              : (imageData.color || 0),
          mirrored: imageData.mirrored
        };
      } else if ('scale' in imageData) {
        // Это уже объект с параметрами (напрямую из Gallery)
        newParams = imageData;
      }
      
      setImageParams(newParams);
    }
    
    // ВАЖНО: Передаем параметры напрямую в onImageSelect
    onImageSelect(imageUrl, newParams);
  };

  return (
    <Box>
      <Stack direction="row" spacing={1}>
      <Tooltip title={tooltip}>
        <Button
          variant="outlined"
          size="small"
          startIcon={<PhotoLibraryIcon />}
          onClick={() => setGalleryOpen(true)}
          sx={{ mt: 1, mb: 1 }}
        >
          {label}
        </Button>
      </Tooltip>
        
        {currentImage && (
          <SaveToGalleryButton
            imageBase64={currentImage}
            currentCategory={getCategory()}
            walletAddress={address}
            isSupreme={address === SUPREME_ADMIN}
            imageOwner={imageOwner}
            imageSource={imageSource}
            imageParams={{
              // Убедимся, что мы передаём актуальные параметры и все поля будут определены
              scale: imageParams?.scale || 1,
              x_offset: imageParams?.x_offset || 0,
              y_offset: imageParams?.y_offset || 0,
              rotation: imageParams?.rotation || 0,
              overlap: imageParams?.overlap || 0,
              hue: imageParams?.hue || 0,
              mirrored: imageParams?.mirrored || false
            }}
            onSuccess={onSaveSuccess}
            getImageParams={getActualImageParams}
            uploadedFileName={uploadedFileName}
          />
        )}
      </Stack>
      
      <ImageGallery
        open={galleryOpen}
        onClose={() => setGalleryOpen(false)}
        onSelect={handleImageSelect}
        category={getCategory()}
        title={getTitle()}
      />
    </Box>
  );
});

export default ImageSelectionButton; 