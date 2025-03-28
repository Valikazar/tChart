import React, { useCallback } from 'react';
import { Box, Typography, IconButton } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';

interface ImageUploaderProps {
  imageUrl?: string;
  onImageSelect: (url: string) => void;
  helperText?: string;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({
  imageUrl,
  onImageSelect,
  helperText = 'Drop or click to select image',
}) => {
  const handleImageDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = () => {
          const url = reader.result as string;
          onImageSelect(url);
        };
        reader.readAsDataURL(file);
      }
    },
    [onImageSelect]
  );

  const handleImageReset = (e: React.MouseEvent) => {
    e.stopPropagation();
    onImageSelect('');
  };

  const handleImageClick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = () => {
          const url = reader.result as string;
          onImageSelect(url);
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  return (
    <Box
      sx={{
        border: '2px dashed',
        borderColor: 'divider',
        borderRadius: 1,
        p: 2,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
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
        {imageUrl ? 'Change image' : helperText}
      </Typography>
      {imageUrl && (
        <IconButton
          size="small"
          onClick={handleImageReset}
          color="error"
        >
          <DeleteIcon />
        </IconButton>
      )}
    </Box>
  );
};

export default ImageUploader; 