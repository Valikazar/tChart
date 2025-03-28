import React from 'react';
import { useDropzone } from 'react-dropzone';
import { styled } from '@mui/material/styles';
import { Paper, Typography } from '@mui/material';
import { BarType, ImagePartType } from '../types';

interface ImageDropZoneProps {
  barType: BarType | 'background';
  partType: ImagePartType | 'image';
  onImageDrop: (barType: BarType | 'background', partType: ImagePartType | 'image', file: File) => void;
  currentImage: string | null;
}

const DropZoneContainer = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2),
  border: '2px dashed #cccccc',
  borderRadius: theme.spacing(1),
  textAlign: 'center',
  cursor: 'pointer',
  minHeight: '100px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundSize: 'contain',
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'center',
  '&:hover': {
    borderColor: theme.palette.primary.main,
  },
}));

const ImageDropZone: React.FC<ImageDropZoneProps> = ({
  barType,
  partType,
  onImageDrop,
  currentImage,
}) => {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif'],
    },
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        onImageDrop(barType, partType, acceptedFiles[0]);
      }
    },
  });

  return (
    <DropZoneContainer
      {...getRootProps()}
      style={{
        backgroundImage: currentImage ? `url(${currentImage})` : 'none',
      }}
    >
      <input {...getInputProps()} />
      {!currentImage && (
        <Typography color="textSecondary">
          {isDragActive
            ? 'Отпустите изображение здесь'
            : `Перетащите изображение для ${barType} ${partType}`}
        </Typography>
      )}
    </DropZoneContainer>
  );
};

export default ImageDropZone; 