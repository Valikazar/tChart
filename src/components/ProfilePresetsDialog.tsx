import React, { useEffect, useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Typography, Alert, Select, MenuItem, Box, Card, CardMedia, CardContent, CardActions, Chip, Checkbox, FormControlLabel } from '@mui/material';
import axios from 'axios';
import TagInput from './TagInput';
import { getUniquePresetName } from '../App';

const SUPREME_ADMIN = '0xf7427BD018809723e778Be7EaE4FaB6C81474C70';
const GENRES = ['meme', 'layer', 'utility', 'art', 'finance', 'fun', 'other'];

// Настройка базового URL для axios - прямое обращение к серверу
const API_BASE_URL = process.env.NODE_ENV === 'production'
  ? '' // В продакшене используем относительные пути
  : 'http://localhost:3002'; // В разработке напрямую к серверу

// Базовый URL для статических изображений
const STATIC_BASE_URL = process.env.NODE_ENV === 'production'
  ? '' // В продакшене используем относительные пути
  : 'http://localhost:3002'; // URL сервера изображений в разработке (теперь порт 3002)

const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // Включаем передачу кук для CORS
  timeout: 10000 // Увеличиваем таймаут для отладки
});

// В режиме разработки добавляем логирование запросов для отладки
if (process.env.NODE_ENV === 'development') {
  axiosInstance.interceptors.request.use(config => {
    console.log('Sending request to:', config.url, config.method, config.data);
    return config;
  });
  
  axiosInstance.interceptors.response.use(
    response => {
      console.log('Server response:', response.status, response.data);
      return response;
    },
    error => {
      console.error('Request error:', error.message, error.response?.status, error.response?.data);
      return Promise.reject(error);
    }
  );
}

// Функция для ресайза изображения до 200x200 пикселей и конвертации в JPEG
async function resizeImageToBase64(base64Image: string, targetWidth: number = 200, targetHeight: number = 200): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onload = () => {
      try {
        // Создаем canvas для ресайза
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('Cannot get canvas context'));
          return;
        }
        
        // Устанавливаем размеры canvas
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        
        // Заливаем белым фоном для JPEG (поскольку JPEG не поддерживает прозрачность)
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, targetWidth, targetHeight);
        
        // Рисуем изображение с ресайзом
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
        
        // Конвертируем в JPEG base64 с качеством 0.8
        const resizedBase64 = canvas.toDataURL('image/jpeg', 0.8);
        console.log(`Resized image to ${targetWidth}x${targetHeight} JPEG, size: ${resizedBase64.length} chars`);
        resolve(resizedBase64);
      } catch (error) {
        console.error('Error resizing image:', error);
        reject(error);
      }
    };
    
    img.onerror = () => {
      console.error('Error loading image for resize');
      reject(new Error('Failed to load image for resize'));
    };
    
    img.src = base64Image;
  });
}

// Функция для конвертации всех URL в конфигурации в base64
async function convertUrlsToBase64(config: any): Promise<any> {
  if (!config) return config;

  // Копируем конфигурацию
  const newConfig = JSON.parse(JSON.stringify(config));
  
  // Функция для конвертации фонового изображения в JPEG base64 с белой подложкой
  async function processBackgroundUrl(obj: any, key: string): Promise<void> {
    if (obj && obj[key] && typeof obj[key] === 'string' && 
        obj[key].startsWith('http') && !obj[key].startsWith('data:')) {
      try {
        console.log(`Converting background URL to JPEG base64: ${obj[key]}`);
        const response = await fetch(obj[key], { mode: 'cors' });
        const blob = await response.blob();
        
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          
          img.onload = () => {
            try {
              // Создаем canvas для конвертации в JPEG
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');
              
              if (!ctx) {
                reject(new Error('Cannot get canvas context'));
                return;
              }
              
              canvas.width = img.naturalWidth;
              canvas.height = img.naturalHeight;
              
              // Заливаем белым фоном для JPEG (поскольку JPEG не поддерживает прозрачность)
              ctx.fillStyle = '#FFFFFF';
              ctx.fillRect(0, 0, canvas.width, canvas.height);
              
              // Рисуем изображение
              ctx.drawImage(img, 0, 0);
              
              // Конвертируем в JPEG base64 с качеством 0.8
              const jpegBase64 = canvas.toDataURL('image/jpeg', 0.8);
              obj[key] = jpegBase64;
              console.log(`Converted background URL to JPEG base64 (${jpegBase64.length} chars)`);
              resolve();
            } catch (error) {
              console.error('Error in canvas conversion:', error);
              reject(error);
            }
          };
          
          img.onerror = () => {
            console.error('Error loading image');
            reject(new Error('Failed to load image'));
          };
          
          // Создаем URL для загрузки blob как изображения
          const imageUrl = URL.createObjectURL(blob);
          
          // Сохраняем оригинальный обработчик onload
          const originalOnLoad = img.onload;
          
          // Переопределяем обработчик чтобы очистить URL после загрузки
          img.onload = function() {
            URL.revokeObjectURL(imageUrl);
            if (originalOnLoad) originalOnLoad.call(this);
          };
          
          img.src = imageUrl;
        });
      } catch (error) {
        console.error(`Error converting background URL to JPEG base64: ${obj[key]}`, error);
      }
    }
  }

  // Функция для конвертации изображений баров в PNG base64 без белой подложки
  async function processBarUrl(obj: any, key: string): Promise<void> {
    if (obj && obj[key] && typeof obj[key] === 'string' && 
        obj[key].startsWith('http') && !obj[key].startsWith('data:')) {
      try {
        console.log(`Converting bar URL to PNG base64: ${obj[key]}`);
        const response = await fetch(obj[key], { mode: 'cors' });
        const blob = await response.blob();
        
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          
          img.onload = () => {
            try {
              // Создаем canvas для конвертации в PNG
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');
              
              if (!ctx) {
                reject(new Error('Cannot get canvas context'));
                return;
              }
              
              canvas.width = img.naturalWidth;
              canvas.height = img.naturalHeight;
              
              // НЕ заливаем фон - оставляем прозрачным для PNG
              // Рисуем изображение
              ctx.drawImage(img, 0, 0);
              
              // Конвертируем в PNG base64 (поддерживает прозрачность)
              const pngBase64 = canvas.toDataURL('image/png');
              obj[key] = pngBase64;
              console.log(`Converted bar URL to PNG base64 (${pngBase64.length} chars)`);
              resolve();
            } catch (error) {
              console.error('Error in canvas conversion:', error);
              reject(error);
            }
          };
          
          img.onerror = () => {
            console.error('Error loading image');
            reject(new Error('Failed to load image'));
          };
          
          // Создаем URL для загрузки blob как изображения
          const imageUrl = URL.createObjectURL(blob);
          
          // Сохраняем оригинальный обработчик onload
          const originalOnLoad = img.onload;
          
          // Переопределяем обработчик чтобы очистить URL после загрузки
          img.onload = function() {
            URL.revokeObjectURL(imageUrl);
            if (originalOnLoad) originalOnLoad.call(this);
          };
          
          img.src = imageUrl;
        });
      } catch (error) {
        console.error(`Error converting bar URL to PNG base64: ${obj[key]}`, error);
      }
    }
  }
  
  // Обрабатываем фоновое изображение (конвертируем в JPEG с белой подложкой)
  if (newConfig.background && newConfig.background.image) {
    await processBackgroundUrl(newConfig.background.image, 'url');
  }
  
  // Обрабатываем изображения для баров (конвертируем в PNG без белой подложки)
  const barTypes = ['upBar', 'downBar', 'candle', 'knife', 'doji'];
  const partTypes = ['top', 'body', 'bottom', 'center'];
  
  for (const barType of barTypes) {
    if (newConfig[barType]) {
      for (const partType of partTypes) {
        if (newConfig[barType][partType]) {
          await processBarUrl(newConfig[barType][partType], 'url');
        }
      }
    }
  }
  
  return newConfig;
}

interface ProfilePresetsDialogProps {
  open: boolean;
  onClose: () => void;
  address: string | undefined;
  onImportConfig?: (config: any) => void;
  onExportConfig?: () => void;
  getPreviewImage: () => Promise<string>; // функция для получения base64 canvas
  isPublicView?: boolean; // Флаг для отображения публичных пресетов
  autoSave?: boolean; // Флаг для автоматического открытия формы сохранения
  onEditPreset?: (presetName: string, presetId: number) => void; // Функция для редактирования пресета
  editingPreset?: {name: string, id: number} | null; // Информация о редактируемом пресете
  getCurrentConfig?: () => any; // Функция для получения текущей конфигурации
}

const ProfilePresetsDialog: React.FC<ProfilePresetsDialogProps> = ({ 
  open, 
  onClose, 
  address, 
  onImportConfig, 
  onExportConfig, 
  getPreviewImage,
  isPublicView = false,
  autoSave = false,
  onEditPreset,
  editingPreset,
  getCurrentConfig
}) => {
  const [error, setError] = useState('');
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [newPresetGenre, setNewPresetGenre] = useState(GENRES[0]);
  const [saveSuccess, setSaveSuccess] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [imageRefreshKey, setImageRefreshKey] = useState(Date.now());
  const [useCustomGenre, setUseCustomGenre] = useState(false);
  const [customGenre, setCustomGenre] = useState('');
  const [availableGenres, setAvailableGenres] = useState<string[]>(GENRES);

  const isAdmin = address?.toLowerCase() === SUPREME_ADMIN.toLowerCase();

  // Функция для загрузки данных пресета при редактировании
  const loadPresetData = async (presetId: number) => {
    try {
      console.log('Loading preset data for editing:', presetId);
      const response = await axiosInstance.get(`/api/preset/${presetId}`);
      
      if (response.data && response.data.success && response.data.preset) {
        const preset = response.data.preset;
        console.log('Loaded preset data:', preset);
        
        // Устанавливаем жанр пресета
        if (preset.genre) {
          setNewPresetGenre(preset.genre);
          console.log('Set genre from preset:', preset.genre);
        }
        
        // Устанавливаем теги пресета
        if (preset.tags && Array.isArray(preset.tags)) {
          setTags(preset.tags);
          console.log('Set tags from preset:', preset.tags);
        } else {
          setTags([]);
          console.log('No tags found for preset');
        }
      }
    } catch (error) {
      console.error('Error loading preset data:', error);
    }
  };

  // Функция для загрузки доступных тегов
  const loadAvailableTags = async () => {
    try {
      const response = await axiosInstance.get('/api/tags?type=presets');
      if (response.data && response.data.success) {
        setAvailableTags(response.data.tags);
      }
    } catch (error) {
      console.error('Error loading tags:', error);
      setAvailableTags([]);
    }
  };

  // Функция для загрузки доступных жанров из базы данных
  const loadAvailableGenres = async () => {
    try {
      const response = await axiosInstance.get('/api/preset-genres');
      if (response.data && response.data.success && Array.isArray(response.data.genres)) {
        const dbGenres = response.data.genres;
        // Объединяем с базовыми жанрами и убираем дубликаты
        const allGenres = [...new Set([...GENRES, ...dbGenres])];
        setAvailableGenres(allGenres);
        console.log('Loaded preset genres from database:', allGenres);
      } else {
        // Если API не отвечает или нет данных, используем базовые жанры
        console.log('Using default genres');
        setAvailableGenres(GENRES);
      }
    } catch (error) {
      console.error('Error loading preset genres from database:', error);
      // Fallback к базовым жанрам в случае ошибки
      setAvailableGenres(GENRES);
    }
  };

  // Функция для добавления тега из облака популярных тегов
  const handleAddPopularTag = (tag: string) => {
    if (!tags.includes(tag) && tags.length < 10) {
      setTags(prev => [...prev, tag]);
    }
  };

  useEffect(() => {
    if (open && address) {
      setSaveSuccess('');
      
      // Загружаем доступные теги и жанры
      loadAvailableTags();
      loadAvailableGenres();
      
      // Автоматически открываем форму сохранения если autoSave = true или режим редактирования
      if ((autoSave || editingPreset) && !isPublicView) {
        setShowSaveForm(true);
        
        // Если режим редактирования, заполняем поля
        if (editingPreset) {
          setNewPresetName(editingPreset.name);
          // Загружаем данные пресета для получения жанра и тегов
          loadPresetData(editingPreset.id);
        }
      }
    }
  }, [open, address, isPublicView, autoSave, editingPreset]);

  // Обновляем выбранный жанр при загрузке новых жанров
  useEffect(() => {
    if (availableGenres.length > 0 && newPresetGenre === GENRES[0] && !editingPreset) {
      setNewPresetGenre(availableGenres[0]);
    }
  }, [availableGenres, newPresetGenre, editingPreset]);

  // Отдельный эффект для обновления имени пресета при изменении editingPreset
  useEffect(() => {
    if (editingPreset) {
      setNewPresetName(editingPreset.name);
    }
  }, [editingPreset]);

  const handleSavePreset = async () => {
    setError('');
    setSaveSuccess('');
    
    // Проверяем обязательные поля
    if (!address) {
      setError('Wallet address is required');
      return;
    }
    
    if (!newPresetName.trim()) {
      setError('Enter preset name');
      return;
    }
    
    // Проверка допустимости символов в имени пресета
    const nameRegex = /^[a-zA-Z0-9_-]+$/;
    if (!nameRegex.test(newPresetName.trim())) {
      setError('Preset name can only contain Latin letters, numbers, hyphens and underscores');
      return;
    }
    
    // Проверка длины имени
    if (newPresetName.trim().length > 32) {
      setError('Preset name cannot be longer than 32 characters');
      return;
    }
    
    const finalGenre = useCustomGenre ? customGenre.trim() : newPresetGenre;
    
    if (!finalGenre) {
      setError(useCustomGenre ? 'Enter custom genre' : 'Select genre');
      return;
    }
    
    // Проверка допустимости символов в кастомном жанре
    if (useCustomGenre) {
      const genreRegex = /^[a-zA-Z0-9_-]+$/;
      if (!genreRegex.test(customGenre.trim())) {
        setError('Custom genre can only contain Latin letters, numbers, hyphens and underscores');
        return;
      }
      
      // Проверка длины кастомного жанра
      if (customGenre.trim().length > 20) {
        setError('Custom genre cannot be longer than 20 characters');
        return;
      }
    }
    
    // Validate tags - only latin letters, numbers, hyphens, underscores (no spaces)
    if (tags.length > 0) {
      const tagRegex = /^[a-zA-Z0-9\-_]+$/;
      const invalidTags = tags.filter(tag => !tagRegex.test(tag));
      if (invalidTags.length > 0) {
        setError(`Tags can only contain latin letters, numbers, hyphens and underscores. Invalid tags: ${invalidTags.join(', ')}`);
        return;
      }
    }
    
    try {
      // Получаем изображение графика
      const originalImageBase64 = await getPreviewImage();
      
      if (!originalImageBase64) {
        setError('Failed to generate preview image');
        return;
      }
      
      // Ресайзим изображение до 200x200 пикселей на клиенте
      console.log('Resizing preset image to 200x200...');
      const imageBase64 = await resizeImageToBase64(originalImageBase64, 200, 200);
      
      // Получаем текущую конфигурацию
      let config: any = null;
      
      if (getCurrentConfig) {
        config = getCurrentConfig();
        console.log('Using config from getCurrentConfig');
      } else {
        // Fallback: попытка получить конфигурацию из data-атрибута canvas
        const canvasElement = document.getElementById('chart-canvas');
        
        if (canvasElement && 'dataset' in canvasElement) {
          const configJson = (canvasElement as HTMLElement).dataset?.config;
          if (configJson) {
            try {
              config = JSON.parse(configJson);
              console.log('Retrieved config from chart-canvas data attribute');
            } catch (e) {
              console.error('Failed to parse config from canvas data attribute:', e);
            }
          }
        }
      }
      
      // Если config все ещё null, используем пустой объект
      config = config || {};
      
      console.log('Converting URLs in config to base64...');
      // Конвертируем все URL в base64 перед отправкой
      const base64Config = await convertUrlsToBase64(config);
      
      console.log('Sending preset data to server with config:', !!base64Config);
      
      let uniqueName = newPresetName.trim();
      let apiEndpoint = '/api/presets-create';
      let presetData: any;

      if (editingPreset) {
        // Режим редактирования - обновляем существующий пресет
        console.log('Updating existing preset:', editingPreset.name);
        
        presetData = {
          id: editingPreset.id,
          owner: address, // Для суперюзера на сервере владелец будет сохранен оригинальный
          genre: finalGenre,
          name: newPresetName.trim(), // используем имя как есть
          imageBase64,
          config: base64Config,
          tags: tags.length > 0 ? tags : undefined
        };
        
        apiEndpoint = '/api/presets-update';
        uniqueName = newPresetName.trim();
        
        console.log('Updating preset with ID:', editingPreset.id);
      } else {
        // Режим создания нового пресета
        console.log('Creating new preset:', newPresetName.trim());
        
        // Генерируем уникальное имя только для новых пресетов
        uniqueName = await getUniquePresetName(newPresetName.trim());
        console.log('Generated unique name:', uniqueName);
        
        // Уведомляем пользователя, если имя было изменено
        if (uniqueName !== newPresetName.trim()) {
          console.log(`Preset name changed from "${newPresetName.trim()}" to "${uniqueName}" to avoid conflicts`);
        }
        
        presetData = {
          owner: address,
          genre: finalGenre,
          name: uniqueName,
          imageBase64,
          config: base64Config,
          tags: tags.length > 0 ? tags : undefined
        };
      }
      
      // Логируем размеры данных для отладки
      console.log('Preset data to send:', {
        owner: !!presetData.owner,
        genre: !!presetData.genre,
        name: !!presetData.name,
        imageBase64Size: presetData.imageBase64?.length || 0,
        configSize: JSON.stringify(presetData.config || {}).length,
        tagsCount: presetData.tags?.length || 0,
        isUpdate: !!editingPreset
      });
      
      // Отправляем запрос с изображением и конфигурацией с base64
      const response = await axiosInstance.post(apiEndpoint, presetData);
      
      // Показываем сообщение с финальным именем пресета
      const action = editingPreset ? 'updated' : 'saved';
      const successMessage = editingPreset 
        ? `Preset "${uniqueName}" updated successfully!`
        : uniqueName !== newPresetName.trim() 
          ? `Preset saved as "${uniqueName}" (name modified to avoid conflicts)`
          : `Preset "${uniqueName}" saved successfully!`;
      setSaveSuccess(successMessage);
      
      // Если использовался кастомный жанр, перезагружаем список жанров
      if (useCustomGenre && customGenre.trim()) {
        await loadAvailableGenres();
        // Переключаемся обратно на обычный режим и устанавливаем новый жанр как выбранный
        setUseCustomGenre(false);
        setNewPresetGenre(customGenre.trim());
        setCustomGenre('');
        console.log('Switched to regular genre mode with new genre:', customGenre.trim());
      }

      // В режиме редактирования оставляем форму открытой, в режиме создания - переходим в режим редактирования
      if (!editingPreset) {
        // После первого сохранения переходим в режим редактирования
        if (response.data && response.data.success && response.data.id && onEditPreset) {
          // Устанавливаем режим редактирования с ID и именем созданного пресета
          onEditPreset(response.data.name || uniqueName, response.data.id);
          
          // Форма остается открытой, но обновляем имя пресета если оно изменилось
          if (response.data.name && response.data.name !== newPresetName.trim()) {
            setNewPresetName(response.data.name);
          }
        } else {
          // Если по каким-то причинам не получили ID, закрываем форму
          setShowSaveForm(false);
          setNewPresetName('');
          setNewPresetGenre(availableGenres[0] || GENRES[0]);
          setTags([]); // Сбрасываем теги
          setUseCustomGenre(false);
          setCustomGenre('');
        }
      } else {
        // В режиме редактирования - обновляем имя пресета если оно изменилось
        if (onEditPreset && uniqueName !== editingPreset.name) {
          onEditPreset(uniqueName, editingPreset.id);
        }
      }
      
      // Обновляем ключ для изображений
      setImageRefreshKey(Date.now());
    } catch (e: any) {
      console.error('Error saving preset:', e);
      setError(e.response?.data?.error || 'Failed to save preset');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth disableAutoFocus disableEnforceFocus sx={{ zIndex: 1500 }}>
      <DialogTitle>
        {isPublicView 
          ? 'Public Presets' 
          : editingPreset 
            ? `Editing Preset: ${editingPreset.name}` 
            : 'Save Preset'
        }
      </DialogTitle>
      <DialogContent>
        {!isPublicView && (
          <>
            <Typography variant="subtitle1" gutterBottom>
              Wallet address: {address}
            </Typography>
            {/* Пояснение для пользователя */}
            <Typography variant="body2" sx={{ mb: 2 }}>
              Saved preset will become public only after admin approval.
            </Typography>
            {/* Кнопки для админа */}
            {isAdmin && (
              <Box sx={{ mb: 2 }}>
                <Button variant="outlined" onClick={onImportConfig} sx={{ mr: 1 }}>Import configuration</Button>
                <Button variant="outlined" onClick={onExportConfig}>Export configuration</Button>
              </Box>
            )}
          </>
        )}
        
        {/* Форма сохранения пресета отображается только для профиля */}
        {showSaveForm && !isPublicView && (
          <Box sx={{ mb: 2, p: 2, border: '1px solid #444', borderRadius: 2 }}>
            <Typography variant="h6">
              {editingPreset ? `Editing Preset: ${editingPreset.name}` : 'Save New Preset'}
            </Typography>
            <TextField
              label="Preset Name"
              value={newPresetName}
              onChange={e => setNewPresetName(e.target.value)}
              fullWidth
              sx={{ mb: 2 }}
              helperText="Only Latin letters, numbers, hyphens and underscores allowed (max 32 characters)"
            />
            {/* Checkbox для кастомного жанра (только для суперюзера) */}
            {isAdmin && (
              <FormControlLabel
                control={
                  <Checkbox
                    checked={useCustomGenre}
                    onChange={(e) => setUseCustomGenre(e.target.checked)}
                  />
                }
                label="Add custom genre"
                sx={{ mb: 1 }}
              />
            )}
            
            {/* Поле жанра: Select или TextField в зависимости от режима */}
            {useCustomGenre && isAdmin ? (
              <TextField
                label="Custom Genre"
                value={customGenre}
                onChange={e => setCustomGenre(e.target.value)}
                fullWidth
                sx={{ mb: 2 }}
                helperText="Only Latin letters, numbers, hyphens and underscores allowed (max 20 characters)"
                placeholder="Enter new genre name"
              />
            ) : (
              <Select
                label="Genre"
                value={newPresetGenre}
                onChange={e => setNewPresetGenre(e.target.value as string)}
                fullWidth
                sx={{ mb: 2 }}
                MenuProps={{
                  disablePortal: true, // Отключаем портал - рендерим в текущем контейнере
                  PaperProps: {
                    sx: {
                      zIndex: 1600,
                      maxHeight: 300
                    }
                  }
                }}
              >
                {availableGenres.map(g => <MenuItem key={g} value={g}>{g}</MenuItem>)}
              </Select>
            )}
            <TagInput 
              tags={tags} 
              onChange={setTags}
              availableTags={availableTags}
              maxTags={10}
              placeholder="Add tags (press Enter or comma to add)"
              label="Tags"
            />
            
            {/* Popular tags cloud from database */}
            {availableTags.length > 0 ? (
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
                      variant={tags.includes(tag) ? "filled" : "outlined"}
                      color={tags.includes(tag) ? "primary" : "default"}
                      onClick={() => handleAddPopularTag(tag)}
                      disabled={tags.includes(tag) || tags.length >= 10}
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

            <Button variant="contained" color={editingPreset ? "warning" : "success"} onClick={handleSavePreset}>
              {editingPreset ? 'Update' : 'Save'}
            </Button>
            <Button onClick={() => {
              setShowSaveForm(false);
              setUseCustomGenre(false);
              setCustomGenre('');
              // Сбрасываем поля только если не в режиме редактирования
              if (!editingPreset) {
                setNewPresetName('');
                setNewPresetGenre(availableGenres[0] || GENRES[0]);
                setTags([]);
              }
              setSaveSuccess('');
              setError('');
            }} sx={{ ml: 2 }}>Cancel</Button>
            {editingPreset && (
              <Button 
                onClick={() => {
                  // Сбрасываем режим редактирования через callback
                  if (onEditPreset) {
                    onEditPreset('', 0); // Передаем пустые значения для сброса
                  }
                  setShowSaveForm(false);
                  setNewPresetName('');
                  setNewPresetGenre(availableGenres[0] || GENRES[0]);
                  setTags([]);
                  setSaveSuccess('');
                  setError('');
                  setUseCustomGenre(false);
                  setCustomGenre('');
                }} 
                color="secondary" 
                sx={{ ml: 2 }}
              >
                Exit Edit Mode
              </Button>
            )}
          </Box>
        )}
        
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {saveSuccess && <Alert severity="success" sx={{ mb: 2 }}>{saveSuccess}</Alert>}

      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default ProfilePresetsDialog; 