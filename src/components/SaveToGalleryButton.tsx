import React, { useState, useEffect } from 'react';
import { 
  Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Select, MenuItem, FormControl, InputLabel,
  Typography, Box, Alert, CircularProgress, SelectChangeEvent, Chip,
  Accordion, AccordionSummary, AccordionDetails
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import axios from 'axios';
import { BASE_URL } from '../api/imageApi';
import TagInput from './TagInput';
import { getUniqueImageName } from '../App';

/**
 * Save to Gallery button component with modal dialog
 * 
 * @param {Object} props
 * @param {string} props.imageBase64 - Base64 image data to save
 * @param {string} props.currentCategory - Current category (body/center/topbot/bg)
 * @param {string} props.walletAddress - User's wallet address
 * @param {boolean} props.isSupreme - Is user a supreme admin
 * @param {string} props.imageOwner - Image owner (if image is from gallery)
 * @param {string} props.imageSource - Image source ("gallery", "local", "url")
 * @param {Object} props.imageParams - Image parameters (scale, x_offset etc.)
 * @param {Function} props.onSuccess - Callback after successful save
 * @param {Function} props.getImageParams - Function to get current image parameters
 */
interface SaveToGalleryButtonProps {
  imageBase64: string; 
  currentCategory: 'body' | 'center' | 'topbot' | 'bg';
  walletAddress?: string;
  isSupreme?: boolean;
  imageOwner?: string;
  imageSource?: 'gallery' | 'local' | 'url';
  imageParams?: {
    scale?: number;
    x_offset?: number;
    y_offset?: number;
    rotation?: number;
    overlap?: number;
    hue?: number;
    color?: string;
    mirrored?: boolean;
  };
  onSuccess?: (data: any) => void;
  getImageParams?: () => any;
  uploadedFileName?: string;
}

interface FormData {
  name: string;
  category: 'body' | 'center' | 'topbot' | 'bg';
  genre: string;
}

interface SaveRequestData {
  name: string;
  category: string;
  genre: string;
  owner?: string;
  imageBase64: string;
  scale?: number | null;
  x_offset?: number | null;
  y_offset?: number | null;
  rotation?: number | null;
  overlap?: number | null;
  color?: number | null;
  mirrored?: number;
  force_overwrite?: boolean;
  tags?: string[];
}

const SaveToGalleryButton: React.FC<SaveToGalleryButtonProps> = ({ 
  imageBase64, 
  currentCategory, 
  walletAddress, 
  isSupreme = false, 
  imageOwner,
  imageSource = 'local',
  imageParams = {},
  onSuccess,
  getImageParams,
  uploadedFileName
}) => {
  // Modal dialog state
  const [modal, setModal] = useState(false);
  
  // Form data
  const [formData, setFormData] = useState<FormData>({
    name: '',
    category: currentCategory || 'body',
    genre: ''
  });
  
  // Создаем локальное состояние для параметров изображения
  const [currentImageParams, setCurrentImageParams] = useState(imageParams);
  
  // Genres list for selected category
  const [genres, setGenres] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // State for tags
  const [tags, setTags] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  
  // Обновление параметров при открытии модального окна
  useEffect(() => {
    if (modal) {
      // Если предоставлена функция getImageParams, используем её для получения актуальных параметров
      if (getImageParams) {
        const freshParams = getImageParams();
        // console.log('Got fresh parameters:', freshParams);
        setCurrentImageParams(freshParams);
      }
    }
  }, [modal, getImageParams]);
  
  // Load genres list when opening modal dialog
  useEffect(() => {
    const fetchGenres = async () => {
      try {
        // Use axios with BASE_URL instead of relative URL
        const response = await axios.get(`${BASE_URL}/genres`);
        
        // Axios automatically throws errors for non-2xx responses
        // and parses JSON, so we don't need additional checks
        
        if (response.data && response.data.success) {
          setGenres(response.data.genres);
        } else {
          console.error('Error in genres response:', response.data ? response.data.error : 'Unknown error');
          setGenres({}); // Пустой объект вместо defaultGenres
          setError('Failed to load genres list from server. Please try again later.');
        }
      } catch (error) {
        console.error('Error loading genres:', error);
        // Fallback to direct API call if proxy fails
        try {
          const directUrl = `http://localhost:3002/api/genres`;
          // console.log('Trying direct API call:', directUrl);
          
          const directResponse = await axios.get(directUrl);
          
          if (directResponse.data && directResponse.data.success) {
            setGenres(directResponse.data.genres);
          } else {
            setGenres({}); // Пустой объект вместо defaultGenres
            setError('Failed to load genres list from server. Please try again later.');
          }
        } catch (fallbackError) {
          console.error('Fallback request also failed:', fallbackError);
          setGenres({}); // Пустой объект вместо defaultGenres
          setError('Failed to load genres list from server. Please try again later.');
        }
      }
    };
    
    const fetchTags = async () => {
      try {
        const response = await axios.get(`${BASE_URL}/tags?type=images`);
        
        if (response.data && response.data.success) {
          setAvailableTags(response.data.tags);
        } else {
          console.error('Error in tags response:', response.data ? response.data.error : 'Unknown error');
          setAvailableTags([]);
        }
      } catch (error) {
        console.error('Error loading tags:', error);
        // Fallback to direct API call if proxy fails
        try {
          const directUrl = `http://localhost:3002/api/tags?type=images`;
          // console.log('Trying direct API call for tags:', directUrl);
          
          const directResponse = await axios.get(directUrl);
          
          if (directResponse.data && directResponse.data.success) {
            setAvailableTags(directResponse.data.tags);
          } else {
            setAvailableTags([]);
          }
        } catch (fallbackError) {
          console.error('Fallback tags request also failed:', fallbackError);
          setAvailableTags([]);
        }
      }
    };

    if (modal) {
      fetchGenres();
      fetchTags();
    }
  }, [modal]);
  
  // Check if button should be active
  const isButtonActive = () => {
    // Debug logging for button activation state
    // console.log('SaveToGallery button activation check:', { 
    //   walletAddress, 
    //   isSupreme, 
    //   imageSource,
    //   imageOwner,
    //   shouldBeActive: !!(walletAddress && (isSupreme || imageSource === 'local' || imageSource === 'url' || (imageSource === 'gallery' && imageOwner === walletAddress)))
    // });
    
    // If wallet not connected, button is inactive
    if (!walletAddress) return false;
    
    // Supreme admin can always save
    if (isSupreme) return true;
    
    // If image is uploaded from computer, button is active
    if (imageSource === 'local' || imageSource === 'url') return true;
    
    // If image is from gallery and belongs to current user, button is active
    if (imageSource === 'gallery' && imageOwner === walletAddress) return true;
    
    // In all other cases, button is inactive
    return false;
  };
  
  // Toggle modal dialog
  const toggle = () => {
    setModal(!modal);
    if (!modal) {
      // Reset errors/success messages when opening dialog
      setError(null);
      setSuccess(null);
      
      // Если изображение из галереи, устанавливаем имя и жанр из URL
      if (imageSource === 'gallery' && imageBase64 && imageBase64.startsWith('http')) {
        const urlParts = imageBase64.split('/');
        if (urlParts.length > 2) {
          // Пытаемся извлечь имя файла из URL
          const filename = urlParts[urlParts.length - 1].split('.')[0];
          if (filename) {
            // console.log('Extracted filename from URL:', filename);
            // Заполняем имя в форме
            setFormData(prev => ({
              ...prev,
              name: filename
            }));
            
            // Пытаемся определить категорию и жанр из URL
            // Например: /api/image/topbot/Animals/filename.png
            if (urlParts.length > 4 && urlParts[urlParts.length - 3]) {
              const genre = urlParts[urlParts.length - 2];
              // console.log('Extracted genre from URL:', genre);
              if (genre) {
                setFormData(prev => ({
                  ...prev,
                  genre: genre
                }));
              }
            }
          }
        }
      }
      // Если изображение загружено с диска и есть сохранённое имя файла
      else if (imageSource === 'local' && uploadedFileName) {
        console.log('Using uploaded file name:', uploadedFileName);
        setFormData(prev => ({
          ...prev,
          name: uploadedFileName
        }));
      }
      
      // Если предоставлена функция getImageParams, используем её для получения актуальных параметров
      if (getImageParams) {
        const freshParams = getImageParams();
        // console.log('Got fresh parameters:', freshParams);
        setCurrentImageParams(freshParams);
      } else {
        // Отладочный вывод полученных параметров
        // console.log('Image parameters on dialog open (from props):', {
        //   imageSource,
        //   imageOwner,
        //   scale: imageParams?.scale,
        //   x_offset: imageParams?.x_offset,
        //   y_offset: imageParams?.y_offset,
        //   rotation: imageParams?.rotation,
        //   overlap: imageParams?.overlap,
        //   color: imageParams?.color,
        //   mirrored: imageParams?.mirrored
        // });
        setCurrentImageParams(imageParams);
      }
    } else {
      // Сброс тегов при закрытии модального окна
      setTags([]);
    }
  };
  
  // Handle text input changes
  const handleTextFieldChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  // Handle select changes
  const handleSelectChange = (e: SelectChangeEvent) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  // Function to add tag from popular tags cloud
  const handleAddPopularTag = (tag: string) => {
    if (!tags.includes(tag) && tags.length < 10) {
      setTags(prev => [...prev, tag]);
    }
  };
  
  // Save image to gallery
  const handleSave = async () => {
    // Check required fields
    if (!formData.name || !formData.category || !formData.genre) {
      setError('Please fill in all fields');
      return;
    }
    
    // Check minimum tags requirement
    if (tags.length < 2) {
      setError('Please add at least 2 tags');
      return;
    }
    
    // Validate name - only latin letters, numbers, spaces, hyphens, underscores
    const nameRegex = /^[a-zA-Z0-9\s\-_]+$/;
    if (!nameRegex.test(formData.name)) {
      setError('Name can only contain latin letters, numbers, spaces, hyphens and underscores');
      return;
    }
    
    // Validate tags - only latin letters, numbers, hyphens, underscores (no spaces)
    const tagRegex = /^[a-zA-Z0-9\-_]+$/;
    const invalidTags = tags.filter(tag => !tagRegex.test(tag));
    if (invalidTags.length > 0) {
      setError(`Tags can only contain latin letters, numbers, hyphens and underscores. Invalid tags: ${invalidTags.join(', ')}`);
      return;
    }
    
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      // Проверяем есть ли функция getImageParams и получаем свежие параметры перед сохранением
      const finalParams = getImageParams ? getImageParams() : currentImageParams;
      
      // Проверяем формат данных изображения
      if (!imageBase64 || typeof imageBase64 !== 'string') {
        throw new Error('Invalid image data: data is missing or not a string');
      }
      
      // Локальная переменная для хранения обработанных данных изображения
      let processedImageData = imageBase64;
      
      // Проверяем, что данные имеют правильный формат для PNG
      if (!imageBase64.startsWith('data:image/png;base64,')) {
        // console.warn('Image data does not have PNG header:', imageBase64.substring(0, 30) + '...');
        
        // Если это URL-изображение (из галереи)
        if (imageBase64.startsWith('http')) {
          // console.log('Detected URL image, loading and converting to PNG');
          try {
            // Загружаем изображение
            const img = new Image();
            
            // Устанавливаем CORS режим для загрузки изображения с другого домена
            img.crossOrigin = 'anonymous';
            
            // Ждем загрузки изображения
            const loadImagePromise = new Promise<void>((resolve, reject) => {
              img.onload = () => resolve();
              img.onerror = () => reject(new Error('Failed to load image from URL'));
              
              // Устанавливаем URL с меткой времени для избежания кеширования
              img.src = `${imageBase64}?t=${Date.now()}`;
            });
            
            await loadImagePromise;
            
            // Создаем canvas и рисуем изображение
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('Could not get canvas context');
            
            ctx.drawImage(img, 0, 0);
            
            // Получаем данные в формате PNG
            processedImageData = canvas.toDataURL('image/png');
            
            // console.log('Successfully converted URL image to PNG format');
          } catch (error) {
            console.error('Failed to load and convert URL image:', error);
            throw new Error('Failed to load image from URL');
          }
        }
        // Обработка data URL, но не PNG формата
        else if (imageBase64.startsWith('data:image/')) {
          // Преобразуем изображение в PNG через canvas
          try {
            const img = new Image();
            img.src = imageBase64;
            
            // Ждем загрузки изображения
            await new Promise((resolve, reject) => {
              img.onload = resolve;
              img.onerror = () => reject(new Error('Failed to load image for conversion'));
            });
            
            // Создаем canvas и рисуем изображение
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('Could not get canvas context');
            
            ctx.drawImage(img, 0, 0);
            
            // Получаем данные в формате PNG
            processedImageData = canvas.toDataURL('image/png');
            
            // Используем преобразованные данные
            // console.log('Successfully converted image to PNG format');
          } catch (convError) {
            console.error('Failed to convert image to PNG:', convError);
            throw new Error('Failed to convert image to PNG format');
          }
        } else {
          throw new Error('Unsupported image format: must be PNG or valid image URL');
        }
      }
      
      // Генерируем уникальное имя изображения
      // console.log('Generating unique image name for:', formData.name);
      const uniqueName = await getUniqueImageName(formData.name, formData.category);
      // console.log('Generated unique name:', uniqueName);
      
      // Уведомляем пользователя, если имя было изменено
      if (uniqueName !== formData.name) {
        console.log(`Image name changed from "${formData.name}" to "${uniqueName}" to avoid conflicts`);
      }
      
      // Явно собираем все параметры, чтобы убедиться что ничего не теряется
      const requestData: SaveRequestData = {
        name: uniqueName,
        category: formData.category,
        genre: formData.genre,
        owner: walletAddress,
        imageBase64: processedImageData, // Используем обработанные данные
        // Добавляем параметры изображения с явной проверкой на undefined
        scale: finalParams?.scale !== undefined ? finalParams.scale : null,
        x_offset: finalParams?.x_offset !== undefined ? finalParams.x_offset : null,
        y_offset: finalParams?.y_offset !== undefined ? finalParams.y_offset : null,
        rotation: finalParams?.rotation !== undefined ? finalParams.rotation : null,
        overlap: finalParams?.overlap !== undefined ? finalParams.overlap : null,
        color: finalParams?.hue !== undefined ? finalParams.hue : null,
        mirrored: finalParams?.mirrored === true ? 1 : 0,
        // Добавляем теги
        tags: tags.length > 0 ? tags : undefined
      };
      
      // Add force_overwrite flag for supreme admin
      if (isSupreme) {
        requestData.force_overwrite = true;
      }
      
      // Debug output
      console.log('Sending image parameters:', requestData);
      
      // Send request to server
      const response = await axios.post(`${BASE_URL}/save-to-gallery`, requestData);
      
      const data = response.data;
      
      if (data.success) {
        // Показываем сообщение с финальным именем изображения
        let successMessage;
        if (data.overwritten) {
          successMessage = uniqueName !== formData.name 
            ? `Image updated as "${uniqueName}" (name modified to avoid conflicts)`
            : `Image "${uniqueName}" updated successfully!`;
        } else {
          successMessage = uniqueName !== formData.name 
            ? `Image saved as "${uniqueName}" (name modified to avoid conflicts)`
            : `Image "${uniqueName}" saved successfully!`;
        }
        setSuccess(successMessage);
        
        // Close modal after 1.5 seconds
        setTimeout(() => {
          toggle();
          if (onSuccess) onSuccess(data);
        }, 1500);
      } else {
        setError(data.error || 'Error saving image');
      }
    } catch (error: any) {
      console.error('Error saving image:', error);
      // Extract error message from axios error if possible
      const errorMessage = error.response?.data?.error || 'Error saving image';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };
  
  // If button should be inactive, return disabled button
  if (!isButtonActive()) {
    return (
      <Button 
        variant="outlined" 
        color="secondary" 
        disabled 
        title="Connect wallet or use your own image" 
        sx={{ mt: 1, mb: 1 }}
      >
        Save to Gallery
      </Button>
    );
  }
  
  return (
    <>
      <Button 
        variant="outlined" 
        color="primary" 
        onClick={toggle} 
        sx={{ mt: 1, mb: 1 }}
      >
        Save to Gallery
      </Button>
      
      <Dialog open={modal} onClose={toggle} maxWidth="md" disableAutoFocus disableEnforceFocus sx={{ zIndex: 1500 }}>
        <DialogTitle>Save to Gallery</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 1, minWidth: '300px' }}>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
            
            {/* Превью изображения */}
            <Box sx={{ 
              width: '100%', 
              maxHeight: '200px', 
              display: 'flex', 
              justifyContent: 'center', 
              mb: 2, 
              border: '1px solid #333',
              borderRadius: 1,
              overflow: 'hidden',
              backgroundColor: '#1a1a1a'
            }}>
              <img 
                src={imageBase64} 
                alt="Preview" 
                style={{ 
                  maxWidth: '100%', 
                  maxHeight: '200px', 
                  objectFit: 'contain' 
                }} 
              />
            </Box>
            
            {/* Текущие параметры изображения */}
            <Accordion sx={{ mb: 2 }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="subtitle1">Image Parameters</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Box sx={{ 
                  p: 1, 
                  border: '1px solid #555', 
                  borderRadius: 1,
                  backgroundColor: '#222',
                  fontSize: '0.9rem',
                  fontFamily: 'monospace'
                }}>
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                    {JSON.stringify({
                      source: imageSource,
                      scale: currentImageParams?.scale,
                      x_offset: currentImageParams?.x_offset,
                      y_offset: currentImageParams?.y_offset,
                      rotation: currentImageParams?.rotation,
                      overlap: currentImageParams?.overlap,
                      hue: currentImageParams?.hue,
                      color: currentImageParams?.color,
                      mirrored: currentImageParams?.mirrored
                    }, null, 2)}
                  </pre>
                </Box>
              </AccordionDetails>
            </Accordion>
            
            <TextField
              label="Name"
              name="name"
              fullWidth
              margin="normal"
              placeholder="Enter image name"
              value={formData.name}
              onChange={handleTextFieldChange}
              disabled={loading}
            />
            
            {isSupreme && (
              <FormControl fullWidth margin="normal">
                <InputLabel id="category-label">Category</InputLabel>
                <Select
                  labelId="category-label"
                  name="category"
                  value={formData.category}
                  onChange={handleSelectChange}
                  disabled={loading}
                  label="Category"
                  MenuProps={{
                    disablePortal: true,
                    PaperProps: {
                      sx: {
                        maxHeight: 300
                      }
                    }
                  }}
                >
                  <MenuItem value="body">Body</MenuItem>
                  <MenuItem value="center">Center</MenuItem>
                  <MenuItem value="topbot">TopBot</MenuItem>
                  <MenuItem value="bg">Background</MenuItem>
                </Select>
              </FormControl>
            )}
            
            <FormControl fullWidth margin="normal">
              <InputLabel id="genre-label">Genre/Style</InputLabel>
              <Select
                labelId="genre-label"
                name="genre"
                value={formData.genre}
                onChange={handleSelectChange}
                disabled={loading}
                label="Genre/Style"
                MenuProps={{
                  disablePortal: true,
                  PaperProps: {
                    sx: {
                      maxHeight: 300
                    }
                  }
                }}
              >
                <MenuItem value="">Select genre</MenuItem>
                {genres[formData.category]?.map((genre) => (
                  <MenuItem key={genre} value={genre}>
                    {genre}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            
            <TagInput
              tags={tags}
              onChange={setTags}
              availableTags={availableTags}
              maxTags={10}
              placeholder="Add tags (Enter, comma or space to add)"
              label="Tags"
            />
            
            {/* Popular tags cloud from database */}
            {availableTags.length > 0 ? (
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Popular tags from gallery (click to add):
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {availableTags.slice(0, 50).map((tag) => (
                    <Chip
                      key={tag}
                      label={tag}
                      size="small"
                      variant={tags.includes(tag) ? "filled" : "outlined"}
                      color={tags.includes(tag) ? "primary" : "default"}
                      onClick={() => handleAddPopularTag(tag)}
                      disabled={loading || (tags.includes(tag) || tags.length >= 10)}
                      sx={{ 
                        cursor: 'pointer',
                        '&:hover': {
                          backgroundColor: tags.includes(tag) ? undefined : 'rgba(255, 255, 255, 0.08)'
                        }
                      }}
                    />
                  ))}
                </Box>
              </Box>
            ) : (
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  No tags available (availableTags.length = {availableTags.length})
                </Typography>
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={toggle} disabled={loading}>
            Cancel
          </Button>
          <Button 
            color="primary" 
            onClick={handleSave} 
            disabled={loading}
            startIcon={loading ? <CircularProgress size={20} /> : undefined}
          >
            {loading ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default SaveToGalleryButton; 