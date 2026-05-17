import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Card,
  CardMedia,
  CardContent,
  CircularProgress,
  Alert,
  Chip,
  Tooltip,
  IconButton,
  Button
} from '@mui/material';
import Grid from '@mui/material/Grid';
import { Add as AddIcon, Info as InfoIcon } from '@mui/icons-material';
import axios from 'axios';

interface AdditionalImage {
  filename: string;
  path: string;
  id: number;
  name: string;
  genre: string;
  class: string;
  scale?: number;
  x_offset?: number;
  y_offset?: number;
  rotation?: number;
  overlap?: number;
  color?: string;
  mirrored?: boolean;
  tags: string[];
  has_params: boolean;
}

interface AdditionalGraphicsProps {
  onImageSelect: (image: AdditionalImage) => void;
  selectedImage?: AdditionalImage | null;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`additional-graphics-tabpanel-${index}`}
      aria-labelledby={`additional-graphics-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 2 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

const AdditionalGraphics: React.FC<AdditionalGraphicsProps> = ({
  onImageSelect,
  selectedImage
}) => {
  const [tabValue, setTabValue] = useState(0);
  const [images, setImages] = useState<Record<string, AdditionalImage[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [genres, setGenres] = useState<string[]>([]);
  const [visibleCounts, setVisibleCounts] = useState<Record<string, number>>({});

  const INITIAL_BATCH = 24;
  const LOAD_MORE_STEP = 24;

  // Загружаем изображения при монтировании компонента
  useEffect(() => {
    loadAdditionalImages();
  }, []);

  const loadAdditionalImages = async () => {
    setLoading(true);
    setError(null);

    try {
      const baseUrl = process.env.NODE_ENV === 'production'
        ? window.location.origin
        : 'http://localhost:3002';

      const response = await axios.get(`${baseUrl}/api/images/add`);

      if (response.data && response.data.images) {
        const imagesData = response.data.images;
        setImages(imagesData);

        // Получаем список жанров из ключей объекта
        const availableGenres = Object.keys(imagesData).filter(genre =>
          genre !== '' && imagesData[genre].length > 0
        );
        setGenres(availableGenres);
        // Инициализируем видимые количества по жанрам
        const initCounts: Record<string, number> = {};
        availableGenres.forEach(g => {
          initCounts[g] = Math.min(INITIAL_BATCH, imagesData[g]?.length || 0);
        });
        setVisibleCounts(initCounts);

        // Loaded images metadata
      } else {
        setImages({});
        setGenres([]);
      }
    } catch (err) {
      // Silent fail to avoid console noise in production
      setError('Failed to load additional graphics');
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleImageClick = (image: AdditionalImage) => {
    onImageSelect(image);
  };

  const getImageUrl = (imagePath: string) => {
    const baseUrl = process.env.NODE_ENV === 'production'
      ? window.location.origin
      : 'http://localhost:3002';
    return `${baseUrl}${imagePath}`;
  };

  const getGenreDisplayName = (genre: string) => {
    if (genre === '') return 'General';
    return genre.charAt(0).toUpperCase() + genre.slice(1);
  };

  if (loading) {
    return (
      <Box sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: 200,
        p: 2
      }}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>Loading additional graphics...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  if (genres.length === 0) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>
          Additional Graphics
        </Typography>
        <Alert severity="info">
          No additional graphics available at the moment.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%' }}>
      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <AddIcon />
        Additional Graphics
      </Typography>

      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons={false}
          allowScrollButtonsMobile={false}
          sx={{
            '& .MuiTabs-flexContainer': {
              flexWrap: 'wrap',
              gap: 1
            },
            '& .MuiTabs-scroller': {
              overflow: 'visible !important'
            },
            '& .MuiTabs-indicator': {
              display: 'none'
            }
          }}
          aria-label="additional graphics tabs"
        >
          {genres.map((genre, index) => (
            <Tab
              key={genre}
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {getGenreDisplayName(genre)}
                  <Chip
                    size="small"
                    label={images[genre]?.length || 0}
                    color="primary"
                    variant="outlined"
                    sx={{
                      color: tabValue === index ? '#000000 !important' : 'inherit',
                      borderColor: tabValue === index ? '#000000 !important' : 'inherit'
                    }}
                  />
                </Box>
              }
              id={`additional-graphics-tab-${index}`}
              aria-controls={`additional-graphics-tabpanel-${index}`}
              sx={{
                minHeight: 'auto',
                padding: '8px 16px',
                margin: '4px',
                borderRadius: '20px',
                backgroundColor: tabValue === index ? 'primary.main' : 'transparent',
                color: tabValue === index ? '#000000 !important' : 'text.primary',
                border: tabValue === index ? 'none' : '1px solid',
                borderColor: tabValue === index ? 'transparent' : 'divider',
                '&:hover': {
                  backgroundColor: tabValue === index ? 'primary.dark' : 'action.hover'
                },
                '& .MuiChip-root': {
                  color: tabValue === index ? '#000000 !important' : 'inherit'
                }
              }}
            />
          ))}
        </Tabs>
      </Box>

      {genres.length > 0 && (
        <TabPanel value={tabValue} index={tabValue}>
          {(() => {
            const genre = genres[tabValue];
            const list = images[genre] || [];
            const visible = list.slice(0, visibleCounts[genre] || INITIAL_BATCH);
            return (
              <>
                <Box sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 2,
                  width: '100%',
                  maxWidth: '100%',
                  boxSizing: 'border-box'
                }}>
                  {visible.map((image) => (
                    <Box key={image.id} sx={{
                      flexBasis: { xs: 'calc(50% - 8px)', sm: 'calc(33.333% - 8px)', md: 'calc(25% - 8px)', lg: 'calc(20% - 8px)' },
                      minWidth: { xs: '78px', sm: '89px', md: '100px', lg: '111px' },
                      maxWidth: { xs: '111px', sm: '123px', md: '133px', lg: '144px' },
                      boxSizing: 'border-box'
                    }}>
                      <Card
                        sx={{
                          cursor: 'pointer',
                          transition: 'transform 0.2s',
                          border: selectedImage?.id === image.id ? 2 : 1,
                          borderColor: selectedImage?.id === image.id ? 'primary.main' : 'divider',
                          width: '100%',
                          '&:hover': {
                            transform: 'scale(1.05)',
                            boxShadow: 3
                          }
                        }}
                        onClick={() => handleImageClick(image)}
                      >
                        <CardMedia
                          component="img"
                          image={getImageUrl(image.path)}
                          alt={image.name}
                          loading="lazy"
                          decoding="async"
                          sx={{
                            objectFit: 'contain',
                            backgroundColor: 'background.default',
                            width: '100%',
                            height: { xs: '71px', sm: '78px', md: '89px', lg: '100px' },
                            minHeight: { xs: '71px', sm: '78px', md: '89px', lg: '100px' }
                          }}
                        />
                      </Card>
                    </Box>
                  ))}
                </Box>
                {list.length === 0 && (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <Typography color="text.secondary">No images in this category</Typography>
                  </Box>
                )}
                {list.length > visible.length && (
                  <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                    <Button
                      variant="outlined"
                      onClick={() => setVisibleCounts((prev) => ({
                        ...prev,
                        [genre]: Math.min((prev[genre] || INITIAL_BATCH) + LOAD_MORE_STEP, list.length)
                      }))}
                    >
                      Show more
                    </Button>
                  </Box>
                )}
              </>
            );
          })()}
        </TabPanel>
      )}
    </Box>
  );
};

export default AdditionalGraphics;


