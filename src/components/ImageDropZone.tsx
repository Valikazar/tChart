import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Box, Paper, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import { BarType, ImagePartType } from '../types';

interface ImageDropZoneProps {
  barType: BarType | 'background';
  partType: ImagePartType | 'image';
  onImageDrop: (barType: BarType | 'background', partType: ImagePartType | 'image', file: File) => void;
  currentImage?: string;
}

const DropZoneContainer = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2),
  border: '2px dashed #cccccc',
  borderRadius: theme.shape.borderRadius,
  cursor: 'pointer',
  textAlign: 'center',
  minHeight: '100px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  '&:hover': {
    borderColor: theme.palette.primary.main,
  },
}));

const PreviewImage = styled('img')({
  maxWidth: '100%',
  maxHeight: '100px',
  objectFit: 'contain',
});

const ImageDropZone: React.FC<ImageDropZoneProps> = ({
  barType,
  partType,
  onImageDrop,
  currentImage,
}) => {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        onImageDrop(barType, partType, acceptedFiles[0]);
      }
    },
    [barType, partType, onImageDrop]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif']
    },
    multiple: false,
  });

  return (
    <DropZoneContainer {...getRootProps()}>
      <input {...getInputProps()} />
      <Box>
        {currentImage ? (
          <PreviewImage src={currentImage} alt="Preview" />
        ) : (
          <Typography color="textSecondary">
            {isDragActive
              ? 'Перетащите файл сюда'
              : 'Нажмите или перетащите изображение'}
          </Typography>
        )}
      </Box>
    </DropZoneContainer>
  );
};

export default ImageDropZone; 