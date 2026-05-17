import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Card,
  CardMedia,
  CardActionArea,
  Typography,
  Box,
  CircularProgress,
  CardContent,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tabs,
  Tab,
  TextField
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import axios from 'axios';
import TagInput from './TagInput';
import PresetLikeButton from './PresetLikeButton';
import { useAccount } from 'wagmi';

const SUPREME_ADMIN = '0xf7427BD018809723e778Be7EaE4FaB6C81474C70';

interface PresetDialogProps {
  open: boolean;
  onClose: () => void;
  onPresetSelect: (config: any) => void;
}

interface PresetImage {
  filename: string;
  path: string;
  id?: number;
  name?: string;
  owner?: string;
  genre?: string;
  uses?: number;
  likes?: number;
  user_liked?: boolean;
  tags?: string[];
}

interface PresetGroup {
  [key: string]: PresetImage[];
}

const PresetDialog: React.FC<PresetDialogProps> = ({ open, onClose, onPresetSelect }) => {
  const { address } = useAccount();
  const [presets, setPresets] = useState<PresetGroup>({});
  const [filteredPresets, setFilteredPresets] = useState<PresetGroup>({});
  const [userPresets, setUserPresets] = useState<PresetGroup>({});
  const [filteredUserPresets, setFilteredUserPresets] = useState<PresetGroup>({});
  const [loading, setLoading] = useState(true);
  const [userPresetsLoading, setUserPresetsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState(0);
  const [creatorFilter, setCreatorFilter] = useState('');

  useEffect(() => {
    if (open) {
      loadPresets();
      loadUserPresets();
      loadAvailableTags();
      setActiveTab(0); // Сбрасываем на первую вкладку при открытии
      setSelectedTags([]); // Сбрасываем выбранные теги
      setCreatorFilter(''); // Сбрасываем фильтр создателя
    }
  }, [open]);

  // Устанавливаем первую вкладку после загрузки пресетов
  useEffect(() => {
    if (Object.keys(presets).length > 0) {
      const genres = getGenres();
      if (activeTab >= genres.length) {
        setActiveTab(0);
      }
    }
  }, [presets]);

  // Получение списка жанров и создание вкладок
  const getGenres = () => {
    const genres = Object.keys(presets).filter(genre => genre !== '');
    return [...genres, 'ALL', "User's"];
  };

  // Фильтрация пресетов по выбранным тегам и активной вкладке
  useEffect(() => {
    let workingPresets = presets;
    
    // Фильтрация по тегам
    if (selectedTags.length > 0) {
      const filtered: PresetGroup = {};
      
      Object.entries(presets).forEach(([category, images]) => {
        const filteredImages = images.filter(image => 
          image.tags && selectedTags.some(tag => 
            image.tags!.includes(tag.toLowerCase())
          )
        );
        
        if (filteredImages.length > 0) {
          filtered[category] = filteredImages;
        }
      });
      
      workingPresets = filtered;
    }
    
    // Фильтрация по активной вкладке (жанру)
    const genres = getGenres();
    const selectedGenre = genres[activeTab];
    
    if (selectedGenre && selectedGenre !== 'ALL' && selectedGenre !== "User's") {
      const genreFiltered: PresetGroup = {};
      if (workingPresets[selectedGenre]) {
        genreFiltered[selectedGenre] = workingPresets[selectedGenre];
      }
      setFilteredPresets(genreFiltered);
    } else {
      setFilteredPresets(workingPresets);
    }
  }, [presets, selectedTags, activeTab]);

  // Фильтрация пользовательских пресетов
  useEffect(() => {
    let workingUserPresets = userPresets;
    
    // Фильтрация по тегам
    if (selectedTags.length > 0) {
      const filtered: PresetGroup = {};
      
      Object.entries(userPresets).forEach(([category, images]) => {
        const filteredImages = images.filter(image => 
          image.tags && selectedTags.some(tag => 
            image.tags!.includes(tag.toLowerCase())
          )
        );
        
        if (filteredImages.length > 0) {
          filtered[category] = filteredImages;
        }
      });
      
      workingUserPresets = filtered;
    }
    
    // Фильтрация по адресу создателя
    if (creatorFilter.trim()) {
      const filtered: PresetGroup = {};
      
      Object.entries(workingUserPresets).forEach(([category, images]) => {
        const filteredImages = images.filter(image => 
          image.owner && image.owner.toLowerCase().includes(creatorFilter.toLowerCase())
        );
        
        if (filteredImages.length > 0) {
          filtered[category] = filteredImages;
        }
      });
      
      workingUserPresets = filtered;
    }
    
    setFilteredUserPresets(workingUserPresets);
  }, [userPresets, selectedTags, creatorFilter]);

  const loadPresets = async () => {
    try {
      setLoading(true);
      setError(null);
      const baseUrl = process.env.NODE_ENV === 'production' 
        ? window.location.origin 
        : 'http://localhost:3002';
      
      // Используем новый API для получения пресетов с тегами
      const params: any = { approved: 'true' };
      if (address) {
        params.user_address = address;
      }
      const response = await axios.get(`${baseUrl}/api/presets`, { params });
      
      if (response.data && response.data.presets) {
        // Группируем пресеты по жанрам для совместимости с существующим интерфейсом
        const groupedPresets: PresetGroup = {};
        
        response.data.presets.forEach((preset: any) => {
          const genre = preset.genre || '';
          if (!groupedPresets[genre]) {
            groupedPresets[genre] = [];
          }
          
          groupedPresets[genre].push({
            filename: `${preset.name}.jpg`,
            path: `${baseUrl}${preset.image_url}`,
            id: preset.id,
            name: preset.name,
            owner: preset.owner,
            genre: preset.genre,
            uses: preset.uses,
            likes: preset.likes,
            user_liked: preset.user_liked || false,
            tags: preset.tags || []
          });
        });
        
        setPresets(groupedPresets);
      } else {
        // Fallback к старому API
        const oldResponse = await axios.get(`${baseUrl}/api/images/presets`);
        setPresets(oldResponse.data.images);
      }
    } catch (err) {
      setError('Error loading presets');
      console.error('Error loading presets:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadUserPresets = async () => {
    try {
      setUserPresetsLoading(true);
      const baseUrl = process.env.NODE_ENV === 'production' 
        ? window.location.origin 
        : 'http://localhost:3002';
      
      // Загружаем только опубликованные, НЕ одобренные пресеты, исключая суперпользователя
      const params: any = { 
        public: 'true',
        approved: 'false'
      };
      if (address) {
        params.user_address = address;
      }
      
      const response = await axios.get(`${baseUrl}/api/presets`, { params });
      
      if (response.data && response.data.presets) {
        // Фильтруем пресеты, исключая суперпользователя
        const userPresetsOnly = response.data.presets.filter((preset: any) => 
          preset.owner.toLowerCase() !== SUPREME_ADMIN.toLowerCase()
        );
        
        // Группируем пресеты по жанрам
        const groupedPresets: PresetGroup = {};
        
        userPresetsOnly.forEach((preset: any) => {
          const genre = preset.genre || '';
          if (!groupedPresets[genre]) {
            groupedPresets[genre] = [];
          }
          
          groupedPresets[genre].push({
            filename: `${preset.name}.jpg`,
            path: `${baseUrl}${preset.image_url}`,
            id: preset.id,
            name: preset.name,
            owner: preset.owner,
            genre: preset.genre,
            uses: preset.uses,
            likes: preset.likes,
            user_liked: preset.user_liked || false,
            tags: preset.tags || []
          });
        });
        
        setUserPresets(groupedPresets);
      }
    } catch (err) {
      console.error('Error loading user presets:', err);
    } finally {
      setUserPresetsLoading(false);
    }
  };

  const loadAvailableTags = async () => {
    try {
      const baseUrl = process.env.NODE_ENV === 'production' 
        ? window.location.origin 
        : 'http://localhost:3002';
      
      const response = await axios.get(`${baseUrl}/api/tags?type=presets`);
      
      if (response.data && response.data.success) {
        setAvailableTags(response.data.tags);
      }
    } catch (err) {
      console.error('Error loading tags:', err);
    }
  };

  const handlePresetClick = async (preset: PresetImage) => {
    try {
      const baseUrl = process.env.NODE_ENV === 'production' 
        ? window.location.origin 
        : 'http://localhost:3002';
      
      console.log(`Loading preset: ${preset.name}`);
      const response = await axios.get(`${baseUrl}/api/preset/${preset.id || preset.name}`);
      
      if (response.data.success) {
        // Увеличиваем счетчик использований пресета
        try {
          if (preset.id) {
            await axios.post(`${baseUrl}/api/presets-use`, { id: preset.id });
          }
        } catch (err) {
          console.warn('Could not update preset use counter:', err);
        }
        
        onPresetSelect(response.data.config);
        onClose();
      }
    } catch (err) {
      console.error('Error loading preset config:', err);
      setError('Error loading preset config');
    }
  };

  // Function to add tag from popular tags cloud
  const handleAddPopularTag = (tag: string) => {
    if (!selectedTags.includes(tag) && selectedTags.length < 10) {
      setSelectedTags(prev => [...prev, tag]);
      // Переключаемся на вкладку ALL при выборе тега
      const genres = getGenres();
      const allTabIndex = genres.indexOf('ALL');
      if (allTabIndex !== -1) {
        setActiveTab(allTabIndex);
      }
    }
  };

  // Function to handle tab change
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  // Function to handle tag changes (включая изменения из TagInput)
  const handleTagsChange = (newTags: string[]) => {
    setSelectedTags(newTags);
    // Переключаемся на вкладку ALL при изменении тегов
    if (newTags.length > 0) {
      const genres = getGenres();
      const allTabIndex = genres.indexOf('ALL');
      if (allTabIndex !== -1) {
        setActiveTab(allTabIndex);
      }
    }
  };

  // Function to handle like changes
  const handleLikeChange = (presetId: number, liked: boolean, newLikesCount: number) => {
    // Update the preset in both presets and filteredPresets
    const updatePresetInGroup = (group: PresetGroup) => {
      Object.keys(group).forEach(genre => {
        group[genre] = group[genre].map(preset => {
          if (preset.id === presetId) {
            return {
              ...preset,
              user_liked: liked,
              likes: newLikesCount
            };
          }
          return preset;
        });
      });
    };

    updatePresetInGroup(presets);
    updatePresetInGroup(filteredPresets);
    updatePresetInGroup(userPresets);
    updatePresetInGroup(filteredUserPresets);
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="md"
      fullWidth
      disableAutoFocus
      disableEnforceFocus
      sx={{ zIndex: 1500 }}
    >
      <DialogTitle>
        Select preset
        <IconButton
          aria-label="close"
          onClick={onClose}
          sx={{
            position: 'absolute',
            right: 8,
            top: 8,
            color: (theme) => theme.palette.grey[500],
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        {/* Фильтр по тегам в аккордеоне */}
        <Accordion sx={{ mb: 2 }}>
          <AccordionSummary 
            expandIcon={<ExpandMoreIcon />}
            sx={{ minHeight: '48px', '& .MuiAccordionSummary-content': { margin: '8px 0' } }}
          >
            <Typography variant="subtitle1">
              Filter by tags ({selectedTags.length}/10)
            </Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ px: 2, py: 1 }}>
            <TagInput
              tags={selectedTags}
              onChange={handleTagsChange}
              availableTags={availableTags}
              maxTags={10}
              placeholder="Add tags to filter presets (Enter, comma or space to add)"
              label=""
            />
            
            {/* Popular tags cloud */}
            {availableTags.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Popular tags from presets (click to add):
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
          </AccordionDetails>
        </Accordion>
        
        {/* Вкладки по жанрам */}
        {!loading && !error && Object.keys(presets).length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Tabs 
              value={activeTab} 
              onChange={handleTabChange}
              variant="scrollable"
              scrollButtons="auto"
              sx={{ borderBottom: 1, borderColor: 'divider' }}
            >
              {getGenres().map((genre, index) => (
                <Tab 
                  key={genre || `genre-${index}`} 
                  label={genre || 'Other'} 
                  sx={{ textTransform: 'none' }}
                />
              ))}
            </Tabs>
          </Box>
        )}

        {/* Фильтр по адресу создателя для вкладки User's */}
        {!loading && !error && getGenres()[activeTab] === "User's" && (
          <Box sx={{ mb: 2 }}>
            <TextField
              fullWidth
              label="Creator Wallet Address Filter"
              placeholder="Enter wallet address to filter presets..."
              value={creatorFilter}
              onChange={(e) => setCreatorFilter(e.target.value)}
              size="small"
              sx={{ mb: 1 }}
            />
          </Box>
        )}
        
        {loading || userPresetsLoading ? (
          <Box display="flex" justifyContent="center" alignItems="center" minHeight={300}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Typography color="error" align="center">{error}</Typography>
        ) : (
          <Box sx={{ mt: 1 }}>
            {(() => {
              const genres = getGenres();
              const selectedGenre = genres[activeTab];
              
              // Если выбрана вкладка User's, показываем пользовательские пресеты
              if (selectedGenre === "User's") {
                return (
                  <>
                    {Object.entries(filteredUserPresets).map(([category, images]) => {
                      const shouldShowCategoryTitle = category;
                      
                      return (
                        <Box key={category} sx={{ mb: 3 }}>
                          {shouldShowCategoryTitle && (
                            <Typography variant="h6" sx={{ mb: 1 }}>{category}</Typography>
                          )}
                          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' }, gap: 2 }}>
                            {images.map((preset) => (
                            <Card key={preset.filename} sx={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
                              <CardActionArea 
                                onClick={() => handlePresetClick(preset)}
                                sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}
                              >
                                <CardMedia
                                  component="img"
                                  height="200"
                                  image={`${process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3002'}/api/preset-image/${preset.name}`}
                                  alt={preset.filename}
                                  sx={{ objectFit: 'contain' }}
                                />
                                <CardContent sx={{ p: 1, textAlign: 'center', width: '100%' }}>
                                  <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
                                    {(preset.name || preset.filename.split('.')[0]).toUpperCase()}
                                  </Typography>
                                  
                                  {/* Отображение адреса создателя */}
                                  {preset.owner && (
                                    <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block', wordBreak: 'break-all' }}>
                                      Creator: {preset.owner.slice(0, 6)}...{preset.owner.slice(-4)}
                                    </Typography>
                                  )}
                                  
                                                       
                                  {/* Отображение статистики */}
                                  {(preset.uses !== undefined || preset.likes !== undefined) && (
                                    <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                                      {preset.uses !== undefined && `Uses: ${preset.uses}`}
                                      {preset.uses !== undefined && preset.likes !== undefined && ' • '}
                                      {preset.likes !== undefined && `Likes: ${preset.likes}`}
                                    </Typography>
                                  )}
                                  
                                  {/* Отображение тегов */}
                                  {preset.tags && preset.tags.length > 0 && (
                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, justifyContent: 'center' }}>
                                      {preset.tags.slice(0, 3).map((tag, index) => (
                                        <Chip
                                          key={index}
                                          label={tag}
                                          size="small"
                                          color="primary"
                                          variant="outlined"
                                          sx={{ fontSize: '0.7rem', height: '20px' }}
                                        />
                                      ))}
                                      {preset.tags.length > 3 && (
                                        <Chip
                                          label={`+${preset.tags.length - 3}`}
                                          size="small"
                                          color="default"
                                          variant="outlined"
                                          sx={{ fontSize: '0.7rem', height: '20px' }}
                                        />
                                      )}
                                    </Box>
                                  )}
                                </CardContent>
                              </CardActionArea>
                              
                              {/* Кнопка лайка */}
                              {preset.id && (
                                <Box sx={{ 
                                  position: 'absolute', 
                                  top: 8, 
                                  right: 8, 
                                  zIndex: 1,
                                  backgroundColor: 'rgba(0, 0, 0, 0.5)',
                                  borderRadius: '50%'
                                }}>
                                  <PresetLikeButton
                                    presetId={preset.id}
                                    initialLikes={preset.likes || 0}
                                    userAddress={address}
                                    initialLiked={preset.user_liked || false}
                                    onLikeChange={handleLikeChange}
                                    size="small"
                                  />
                                </Box>
                              )}
                            </Card>
                            ))}
                          </Box>
                        </Box>
                      );
                    })}
                    
                    {/* Сообщение если нет пользовательских пресетов */}
                    {Object.keys(filteredUserPresets).length === 0 && (
                      <Typography color="text.secondary" align="center" sx={{ mt: 3 }}>
                        {creatorFilter.trim() 
                          ? 'No unpublished user presets found with the specified creator address'
                          : 'No unpublished user presets available'
                        }
                      </Typography>
                    )}
                  </>
                );
              }
              
              // Обычные пресеты для других вкладок
              return Object.entries(filteredPresets).map(([category, images]) => {
                const shouldShowCategoryTitle = selectedGenre === 'ALL' && category;
                
                return (
                  <Box key={category} sx={{ mb: 3 }}>
                    {shouldShowCategoryTitle && (
                      <Typography variant="h6" sx={{ mb: 1 }}>{category}</Typography>
                    )}
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' }, gap: 2 }}>
                      {images.map((preset) => (
                      <Card key={preset.filename} sx={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
                        <CardActionArea 
                          onClick={() => handlePresetClick(preset)}
                          sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}
                        >
                          <CardMedia
                            component="img"
                            height="200"
                            image={`${process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3002'}/api/preset-image/${preset.name}`}
                            alt={preset.filename}
                            sx={{ objectFit: 'contain' }}
                          />
                          <CardContent sx={{ p: 1, textAlign: 'center', width: '100%' }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
                              {(preset.name || preset.filename.split('.')[0]).toUpperCase()}
                            </Typography>
                            
                            {/* Отображение статистики */}
                            {(preset.uses !== undefined || preset.likes !== undefined) && (
                              <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                                {preset.uses !== undefined && `Uses: ${preset.uses}`}
                                {preset.uses !== undefined && preset.likes !== undefined && ' • '}
                                {preset.likes !== undefined && `Likes: ${preset.likes}`}
                              </Typography>
                            )}
                            
                            {/* Отображение тегов */}
                            {preset.tags && preset.tags.length > 0 && (
                              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, justifyContent: 'center' }}>
                                {preset.tags.slice(0, 3).map((tag, index) => (
                                  <Chip
                                    key={index}
                                    label={tag}
                                    size="small"
                                    color="primary"
                                    variant="outlined"
                                    sx={{ fontSize: '0.7rem', height: '20px' }}
                                  />
                                ))}
                                {preset.tags.length > 3 && (
                                  <Chip
                                    label={`+${preset.tags.length - 3}`}
                                    size="small"
                                    color="default"
                                    variant="outlined"
                                    sx={{ fontSize: '0.7rem', height: '20px' }}
                                  />
                                )}
                              </Box>
                            )}
                          </CardContent>
                        </CardActionArea>
                        
                        {/* Кнопка лайка */}
                        {preset.id && (
                          <Box sx={{ 
                            position: 'absolute', 
                            top: 8, 
                            right: 8, 
                            zIndex: 1,
                            backgroundColor: 'rgba(0, 0, 0, 0.5)',
                            borderRadius: '50%'
                          }}>
                            <PresetLikeButton
                              presetId={preset.id}
                              initialLikes={preset.likes || 0}
                              userAddress={address}
                              initialLiked={preset.user_liked || false}
                              onLikeChange={handleLikeChange}
                              size="small"
                            />
                          </Box>
                        )}
                      </Card>
                      ))}
                    </Box>
                  </Box>
                );
              });
            })()}
            
            {/* Сообщение если нет пресетов после фильтрации */}
            {Object.keys(filteredPresets).length === 0 && selectedTags.length > 0 && getGenres()[activeTab] !== "User's" && (
              <Typography color="text.secondary" align="center" sx={{ mt: 3 }}>
                No presets found with selected tags
              </Typography>
            )}
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PresetDialog; 