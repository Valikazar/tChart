import React, { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  Typography, 
  Box, 
  Tab, 
  Tabs, 
  IconButton,
  CircularProgress,
  Button,
  Tooltip,
  Chip,
  Checkbox,
  FormControlLabel
} from '@mui/material';
import { styled } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate';
import { getImageUrl, fetchAvailableTags, fetchAllImages } from '../api/imageApi';
import { useAccount } from 'wagmi';
import TagInput from './TagInput';

// Create a styled grid instead of using Grid component
const ImageGrid = styled('div')(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: theme.spacing(1),
  [theme.breakpoints.up('sm')]: {
    gridTemplateColumns: 'repeat(4, 1fr)',
  },
  [theme.breakpoints.up('md')]: {
    gridTemplateColumns: 'repeat(6, 1fr)',
  }
}));

const ImageItem = styled('div')(({ theme }) => ({
  width: '100%',
  cursor: 'pointer',
  border: '1px solid #333',
  borderRadius: theme.shape.borderRadius,
  '&:hover': {
    borderColor: theme.palette.primary.main,
    transform: 'scale(1.05)',
    transition: 'all 0.2s'
  }
}));

const EmptyStateContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  height: '250px',
  gap: theme.spacing(2)
}));

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
  tags?: string[];
}

interface ImageCategory {
  name: string;
  images: ImageFile[];
}

interface ImageGalleryProps {
  open: boolean;
  onClose: () => void;
  onSelect: (imageUrl: string, imageData: ImageFile) => void;
  category: 'body' | 'center' | 'topbot' | 'bg';
  title: string;
}

const ImageGallery: React.FC<ImageGalleryProps> = ({ 
  open, 
  onClose, 
  onSelect, 
  category,
  title
}) => {
  const [categories, setCategories] = useState<ImageCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [hasAnyImagesInGallery, setHasAnyImagesInGallery] = useState<boolean>(false);
  const [userSwitchedTab, setUserSwitchedTab] = useState<boolean>(false); // Флаг для отслеживания ручного переключения
  const [selectedClasses, setSelectedClasses] = useState<{
    bg: boolean;
    topbot: boolean;
    body: boolean;
    center: boolean;
  }>({
    bg: false,
    topbot: false,
    body: false,
    center: false
  });
  const { address } = useAccount();

  useEffect(() => {
    if (open) {
      // Сбрасываем все теги при открытии
      setSelectedTags([]);
      
      // Устанавливаем только соответствующий класс активным
      setSelectedClasses({
        bg: category === 'bg',
        topbot: category === 'topbot',
        body: category === 'body',
        center: category === 'center'
      });
      
      loadImages();
      loadAvailableTags();
      checkGalleryHasImages();
      // Сбрасываем флаг ручного переключения при открытии модалки
      setUserSwitchedTab(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, category]);

  // Перезагружаем изображения при изменении выбранных тегов
  useEffect(() => {
    if (open) {
      loadImages();
      // Сбрасываем флаг ручного переключения при изменении тегов
      setUserSwitchedTab(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTags]);

  // Перезагружаем изображения при изменении выбранных классов
  useEffect(() => {
    if (open) {
      loadImages();
      setUserSwitchedTab(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClasses]);

  // Управляем selectedTab при изменении тегов и категорий
  useEffect(() => {
    if (categories.length === 0) {
      return;
    }

    // Сначала проверяем, если текущая вкладка вне диапазона - сбрасываем
    if (selectedTab >= categories.length) {
      setSelectedTab(0);
      setUserSwitchedTab(false);
      return;
    }
    
    // Автоматическое переключение только если пользователь не переключался вручную
    if (!userSwitchedTab) {
      if (selectedTags.length > 0) {
        // Ищем вкладку "ALL" (обычно последняя)
        const allTabIndex = categories.findIndex(cat => cat.name === 'ALL');
        
        if (allTabIndex !== -1 && selectedTab !== allTabIndex) {
          setSelectedTab(allTabIndex);
        } else if (allTabIndex === -1) {
          // Если вкладки ALL нет, переключаемся на последнюю доступную (которая обычно содержит все изображения)
          const lastTabIndex = categories.length - 1;
          if (selectedTab !== lastTabIndex) {
            setSelectedTab(lastTabIndex);
          }
        }
      } else if (selectedTags.length === 0 && selectedTab !== 0) {
        // Когда теги сброшены, возвращаемся на первую вкладку
        setSelectedTab(0);
      }
    }
  }, [selectedTags.length, categories.length, categories, selectedTab, userSwitchedTab]);

  const loadImages = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Получаем список активных классов
      const activeClasses = Object.entries(selectedClasses)
        .filter(([_, isActive]) => isActive)
        .map(([className, _]) => className as 'body' | 'center' | 'topbot' | 'bg');

      if (activeClasses.length === 0) {
        setCategories([]);
        return;
      }

      // Загружаем изображения для каждого активного класса и объединяем результаты
      const allResponses = await Promise.all(
        activeClasses.map(className => 
          fetchAllImages(className, selectedTags.length > 0 ? selectedTags : undefined)
        )
      );

      // Объединяем категории из всех ответов
      const combinedCategories: ImageCategory[] = [];
      const categoryMap = new Map<string, ImageFile[]>();

      allResponses.forEach(response => {
        response.categories.forEach(category => {
          if (categoryMap.has(category.name)) {
            // Объединяем изображения если категория уже существует
            categoryMap.get(category.name)!.push(...category.images);
          } else {
            // Создаем новую категорию
            categoryMap.set(category.name, [...category.images]);
          }
        });
      });

      // Преобразуем обратно в массив категорий
      categoryMap.forEach((images, name) => {
        combinedCategories.push({ name, images });
      });

      setCategories(combinedCategories);
    } catch (err) {
      console.error('Error loading images:', err);
      setError('Error loading images');
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableTags = async () => {
    try {
      const tags = await fetchAvailableTags();
      setAvailableTags(tags);
    } catch (err) {
      console.error('Error loading available tags:', err);
    }
  };

  const checkGalleryHasImages = async () => {
    try {
      // Проверяем все возможные классы на наличие изображений
      const allClasses: ('body' | 'center' | 'topbot' | 'bg')[] = ['body', 'center', 'topbot', 'bg'];
      const allResponses = await Promise.all(
        allClasses.map(className => fetchAllImages(className, undefined))
      );
      
      const hasImages = allResponses.some(response => 
        response.categories.some(cat => cat.images.length > 0)
      );
      setHasAnyImagesInGallery(hasImages);
    } catch (err) {
      console.error('Error checking gallery images:', err);
      setHasAnyImagesInGallery(false);
    }
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    // Проверяем, что новое значение в допустимом диапазоне
    if (newValue >= 0 && newValue < categories.length) {
      setSelectedTab(newValue);
      setUserSwitchedTab(true); // Помечаем, что пользователь переключился вручную
    }
  };

  // Function to add tag from popular tags cloud
  const handleAddPopularTag = (tag: string) => {
    if (!selectedTags.includes(tag) && selectedTags.length < 10) {
      setSelectedTags(prev => [...prev, tag]);
    }
  };

  // Function to clear all selected tags
  const handleClearTags = () => {
    setSelectedTags([]);
    setUserSwitchedTab(false); // Сбрасываем флаг ручного переключения
  };

  // Function to handle class checkbox changes
  const handleClassChange = (className: 'bg' | 'topbot' | 'body' | 'center', checked: boolean) => {
    setSelectedClasses(prev => ({
      ...prev,
      [className]: checked
    }));
    setUserSwitchedTab(false); // Сбрасываем флаг ручного переключения
  };

  const handleImageSelect = (imageFile: ImageFile) => {
    const fullImageUrl = getImageUrl(imageFile.path);
    
    // Всегда передаем полные данные изображения, включая параметры если они есть
    const imageParams = {
      ...imageFile, // Передаем все свойства imageFile
      hue: typeof imageFile.color === 'string' ? parseInt(imageFile.color) || 0 : (imageFile.color || 0)
    };
    
    onSelect(fullImageUrl, imageParams);
    
    onClose();
  };

  // Проверяем, есть ли изображения после фильтрации по тегам
  const hasFilteredImages = categories.some(category => category.images.length > 0);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth disableAutoFocus disableEnforceFocus sx={{ zIndex: 1500 }}>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">{title}</Typography>
          <Box display="flex" alignItems="center" gap={1}>
            <IconButton edge="end" onClick={onClose} aria-label="close">
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>
      </DialogTitle>
      <DialogContent>
        {loading ? (
          <Box display="flex" justifyContent="center" alignItems="center" height="300px">
            <CircularProgress />
          </Box>
        ) : error ? (
          <Box display="flex" justifyContent="center" alignItems="center" height="300px">
            <Typography color="error">{error}</Typography>
          </Box>
        ) : !hasAnyImagesInGallery ? (
          <EmptyStateContainer>
            <AddPhotoAlternateIcon sx={{ fontSize: 60, color: 'text.secondary' }} />
            <Typography variant="h6" color="text.secondary">
              No images in gallery
            </Typography>
            <Typography variant="body2" color="text.secondary" align="center">
              Add images using the "Save to Gallery" button
            </Typography>
          </EmptyStateContainer>
        ) : (
          <>
            <Tabs
              value={selectedTab}
              onChange={handleTabChange}
              variant="scrollable"
              scrollButtons="auto"
              sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}
            >
              {categories.map((category, index) => (
                <Tab key={index} label={category.name} disabled={category.images.length === 0} />
              ))}
            </Tabs>
            <Box sx={{ mt: 2 }}>
              {categories.map((category, index) => (
                <div key={index} hidden={selectedTab !== index}>
                  {selectedTab === index && (
                    <ImageGrid>
                      {category.images.map((imageFile, imgIndex) => {
                        const displayUrl = getImageUrl(imageFile.path);
                        return (
                          <Tooltip 
                            key={imgIndex} 
                            title={
                              <Box>
                                <Typography variant="body2">{imageFile.name || 'Unknown'}</Typography>
                                {imageFile.tags && imageFile.tags.length > 0 && (
                                  <Box sx={{ mt: 1 }}>
                                    <Typography variant="caption">Tags: </Typography>
                                    {imageFile.tags.slice(0, 3).map((tag, tagIndex) => (
                                      <Chip
                                        key={tagIndex}
                                        label={tag}
                                        size="small"
                                        sx={{ fontSize: '0.6rem', height: '16px', mx: 0.25 }}
                                      />
                                    ))}
                                    {imageFile.tags.length > 3 && (
                                      <Typography variant="caption">+{imageFile.tags.length - 3} more</Typography>
                                    )}
                                  </Box>
                                )}
                              </Box>
                            }
                          >
                            <ImageItem>
                              <Box
                                sx={{
                                  width: '100%',
                                  height: 100,
                                  background: `url(${displayUrl}) no-repeat center/contain`,
                                }}
                                onClick={() => handleImageSelect(imageFile)}
                              />
                              {/* Отображение тегов внизу изображения */}
                              {imageFile.tags && imageFile.tags.length > 0 && (
                                <Box sx={{ 
                                  p: 0.5, 
                                  borderTop: '1px solid #333',
                                  minHeight: '24px',
                                  display: 'flex',
                                  flexWrap: 'wrap',
                                  gap: 0.25,
                                  justifyContent: 'center'
                                }}>
                                  {imageFile.tags.slice(0, 2).map((tag, tagIndex) => (
                                    <Chip
                                      key={tagIndex}
                                      label={tag}
                                      size="small"
                                      color="primary"
                                      variant="outlined"
                                      sx={{ fontSize: '0.6rem', height: '16px' }}
                                    />
                                  ))}
                                  {imageFile.tags.length > 2 && (
                                    <Chip
                                      label={`+${imageFile.tags.length - 2}`}
                                      size="small"
                                      color="default"
                                      variant="outlined"
                                      sx={{ fontSize: '0.6rem', height: '16px' }}
                                    />
                                  )}
                                </Box>
                              )}
                            </ImageItem>
                          </Tooltip>
                        );
                      })}
                    </ImageGrid>
                  )}
                </div>
              ))}
            </Box>
            
            {/* Фильтр по тегам */}
            <Box sx={{ mt: 3, mb: 2 }}>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                <Box sx={{ flexGrow: 1 }}>
                  <TagInput
                    tags={selectedTags}
                    onChange={setSelectedTags}
                    availableTags={availableTags}
                    maxTags={10}
                    placeholder="Add tags to filter images (Enter, comma or space to add)"
                    label="Filter by tags"
                  />
                </Box>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleClearTags}
                  disabled={selectedTags.length === 0}
                  sx={{ 
                    mt: 1,
                    minWidth: 'auto',
                    px: 1.5,
                    fontSize: '0.75rem',
                    whiteSpace: 'nowrap'
                  }}
                >
                  Clear Tags
                </Button>
              </Box>
              
              {/* Popular tags cloud */}
              {availableTags.length > 0 && (
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
                        variant={selectedTags.includes(tag) ? "filled" : "outlined"}
                        color={selectedTags.includes(tag) ? "primary" : "default"}
                        onClick={() => handleAddPopularTag(tag)}
                        disabled={selectedTags.includes(tag) || selectedTags.length >= 10}
                        sx={{ 
                          cursor: 'pointer',
                          '&:hover': {
                            backgroundColor: selectedTags.includes(tag) ? undefined : 'rgba(255, 255, 255, 0.08)'
                          }
                        }}
                      />
                    ))}
                  </Box>
                </Box>
              )}
            </Box>
            
            {/* Сообщение если нет изображений после фильтрации */}
            {!hasFilteredImages && selectedTags.length > 0 && (
              <Typography color="text.secondary" align="center" sx={{ mt: 3 }}>
                No images found with selected tags
              </Typography>
            )}

            {/* Чекбоксы для выбора классов изображений */}
            <Box sx={{ mt: 3, p: 2, border: '1px solid #333', borderRadius: 1 }}>
              <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary' }}>
                Image Classes:
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={selectedClasses.bg}
                      onChange={(e) => handleClassChange('bg', e.target.checked)}
                      size="small"
                    />
                  }
                  label="BG"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={selectedClasses.topbot}
                      onChange={(e) => handleClassChange('topbot', e.target.checked)}
                      size="small"
                    />
                  }
                  label="Top/Bottom"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={selectedClasses.body}
                      onChange={(e) => handleClassChange('body', e.target.checked)}
                      size="small"
                    />
                  }
                  label="Body"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={selectedClasses.center}
                      onChange={(e) => handleClassChange('center', e.target.checked)}
                      size="small"
                    />
                  }
                  label="Center"
                />
              </Box>
            </Box>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ImageGallery; 