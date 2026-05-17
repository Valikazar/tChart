import React, { useState, useEffect, useRef } from 'react';
import { Container, CssBaseline, ThemeProvider, createTheme, Typography, Box, Divider, FormControl, InputLabel, Select, MenuItem, Accordion, AccordionSummary, AccordionDetails, FormControlLabel, Checkbox, Paper, Slider, Snackbar, Alert, Button, Dialog, DialogTitle, DialogContent, TextField, IconButton, Link, DialogActions, Menu, ListItemIcon, ListItemText } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CloseIcon from '@mui/icons-material/Close';
import TelegramIcon from '@mui/icons-material/Telegram';
import XIcon from '@mui/icons-material/X';
import VolunteerActivismIcon from '@mui/icons-material/VolunteerActivism';
import HelpIcon from '@mui/icons-material/Help';
import ViewModuleIcon from '@mui/icons-material/ViewModule';

import SportsEsportsIcon from '@mui/icons-material/SportsEsports';
import RedditIcon from '@mui/icons-material/Reddit';
import GroupIcon from '@mui/icons-material/Group';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import PageHeader from './components/PageHeader';
import BarConfigurator from './components/BarConfigurator';
import BackgroundConfigurator from './components/BackgroundConfigurator';
import ChartPreview from './components/ChartPreview';
import ChartGenerator from './components/ChartGenerator';
import PresetDialog from './components/PresetDialog';
import HighLowLinesConfigurator from './components/HighLowLinesConfigurator';
import BordersConfigurator from './components/BordersConfigurator';
import { BarType, ImagePartType, ChartConfig, ExtendedBarConfig, HighLowLinesConfig, BordersConfig, DojiConfig } from './components/types';
import { convertConfigToBase64, getConfigImagesSize, formatSize } from './utils/base64Utils';
import ColorPicker from './components/ColorPicker';
import axios from 'axios';
import Web3Profile from './components/Web3Profile';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import ProfileDialog from './components/ProfileDialog';
import ProfilePresetsDialog from './components/ProfilePresetsDialog';
import SaveLoadPresetButton from './components/SaveLoadPresetButton';
import { useAccount } from 'wagmi';
import { uniqueNamesGenerator, adjectives, colors, animals } from 'unique-names-generator';



// Function to generate unique name by adding one word
const generateUniqueNameWithSuffix = (baseName: string): string => {
  // Generate one random word from available dictionaries
  const wordSuffix = uniqueNamesGenerator({
    dictionaries: [adjectives, colors, animals],
    length: 1,
    style: 'capital'
  });

  return `${baseName}-${wordSuffix}`;
};

// Function to check preset name uniqueness on server
const checkPresetNameUnique = async (name: string): Promise<boolean> => {
  try {
    const baseUrl = process.env.NODE_ENV === 'production'
      ? window.location.origin
      : 'http://localhost:3002';

    const response = await axios.get(`${baseUrl}/api/preset/${name}`);
    // If we got response, preset exists
    return false;
  } catch (error) {
    // If 404 error, preset doesn't exist - name is unique
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return true;
    }
    // For other errors consider name not unique (safe approach)
    return false;
  }
};

// Function to get unique preset name
export const getUniquePresetName = async (originalName: string): Promise<string> => {
  let finalName = originalName;
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    const isUnique = await checkPresetNameUnique(finalName);
    if (isUnique) {
      return finalName;
    }

    // Generate new name with suffix
    finalName = generateUniqueNameWithSuffix(originalName);
    attempts++;
  }

  // If couldn't find unique name in maxAttempts attempts,
  // add timestamp
  return `${originalName}-${Date.now()}`;
};

// Function to check image name uniqueness
const checkImageNameUnique = async (name: string, category: string): Promise<boolean> => {
  try {
    const baseUrl = process.env.NODE_ENV === 'production'
      ? window.location.origin
      : 'http://localhost:3002';

    const response = await axios.get(`${baseUrl}/api/image-info/${category}/${name}`);
    // If we got response, image exists
    return false;
  } catch (error) {
    // If 404 error, image doesn't exist - name is unique
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return true;
    }
    // For other errors consider name not unique (safe approach)
    return false;
  }
};

// Function to get unique image name
export const getUniqueImageName = async (originalName: string, category: string): Promise<string> => {
  let finalName = originalName;
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    const isUnique = await checkImageNameUnique(finalName, category);
    if (isUnique) {
      return finalName;
    }

    // Generate new name with suffix
    finalName = generateUniqueNameWithSuffix(originalName);
    attempts++;
  }

  // If couldn't find unique name in maxAttempts attempts,
  // add timestamp
  return `${originalName}-${Date.now()}`;
};

const defaultConfig: ChartConfig = {
  background: {
    color: '#000000',
    opacity: 0.5,
    image: {
      url: '',
      scale: 1,
      offsetX: 0,
      offsetY: 0
    }
  },
  overlay: {
    color: '#000000'
  },
  font: {
    family: 'Arial',
    size: 40,
    color: '#ffffff'
  },
  display: {
    showMarketCap: false,
    showPrice: true,
    showTimeline: true,
    showPriceChange: true,
    showTokenName: true,
    showMinMax: false
  },
  upBar: {
    color: '#26a69a'
  } as ExtendedBarConfig,
  downBar: {
    color: '#ef5350'
  } as ExtendedBarConfig,
  candle: {
    color: '#00ff00'
  },
  knife: {
    color: '#FF0700'
  },
  doji: {
    color: '#FFFF00',
    active: false
  },
  highLowLines: {
    lineWidth: 1,
    upBar: {
      lineColor: '#26a69a'
    },
    downBar: {
      lineColor: '#ef5350'
    },
    candle: {
      lineColor: '#00ff00'
    },
    knife: {
      lineColor: '#FF0700'
    },
    doji: {
      lineColor: '#FFFF00'
    }
  },
  borders: {
    applyToAll: true,
    borderWidth: 0,
    topBevel: 0,
    bottomBevel: 0,
    topRound: true,
    bottomRound: true,
    borderSides: {
      top: true,
      bottom: true,
      left: true,
      right: true
    },
    upBar: {
      borderColor: '#FFFFFF'
    },
    downBar: {
      borderColor: '#FFFFFF'
    },
    candle: {
      borderColor: '#FFFFFF'
    },
    knife: {
      borderColor: '#FFFFFF'
    },
    doji: {
      borderColor: '#FFFFFF'
    }
  },
  fineTuning: {
    maxCandles: 10,
    maxKnives: 10
  },
  network: 'polygon_pos',
  poolAddress: '0xa030be97a53d6462c675962fec3eafbe53b8bb6c',
  duration: 4,
  numBars: 20,
  interval: 'hour',
  free: false
};

const App: React.FC = () => {
  console.log('🎨 [APP] App component rendering...');
  const appRenderStart = performance.now();

  const navigate = useNavigate();
  const [config, setConfig] = useState<ChartConfig>(defaultConfig);
  const [ohlcvData, setOhlcvData] = useState<any>(null);
  const [notification, setNotification] = useState<{ show: boolean, message: string, type: 'success' | 'error' }>({
    show: false,
    message: '',
    type: 'success'
  });
  const [groupId, setGroupId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isTgSession, setIsTgSession] = useState<boolean>(false);
  const [forceRender, setForceRender] = useState<number>(0);
  const chartPreviewRef = useRef<HTMLDivElement>(null);
  const [donateDialogOpen, setDonateDialogOpen] = useState<boolean>(false);
  const [presetDialogOpen, setPresetDialogOpen] = useState<boolean>(false);
  const [web3DialogOpen, setWeb3DialogOpen] = useState<boolean>(false);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const { address } = useAccount();
  const [userRegistered, setUserRegistered] = useState(false);
  const [savePresetDialogOpen, setSavePresetDialogOpen] = useState(false);
  const [editingPreset, setEditingPreset] = useState<{ name: string, id: number } | null>(null);
  const [clearConfirmDialogOpen, setClearConfirmDialogOpen] = useState(false);

  // State for storing uploaded file names
  const [uploadedFileName, setUploadedFileName] = useState<string>('');

  // Synchronizes parameters from ChartGenerator with the main configuration
  const syncChartParameters = (params: { network: string; poolAddress: string; duration: number; numBars: number; interval: string; displayName?: string }) => {
    setConfig(prevConfig => ({
      ...prevConfig,
      network: params.network,
      poolAddress: params.poolAddress,
      duration: params.duration,
      numBars: params.numBars,
      interval: params.interval,
      displayName: params.displayName || prevConfig.displayName || ''
    }));
  };

  // Function to extract filename without extension and save it
  const handleFileNameUpdate = (file: File) => {
    if (file && file.name) {
      // Remove file extension and clean up name
      const nameWithoutExtension = file.name.replace(/\.[^/.]+$/, '');
      // Replace spaces and special characters with underscores for better compatibility
      const cleanName = nameWithoutExtension.replace(/[^a-zA-Z0-9_-]/g, '_');
      setUploadedFileName(cleanName);
      console.log('Stored uploaded file name:', cleanName);
    }
  };

  useEffect(() => {
    console.log('⏱️  [APP] useEffect: Starting initial data loading...');
    const effectStartTime = performance.now();

    // Ленивая загрузка шрифтов - не блокируем первоначальный рендер
    console.log('⏱️  [APP] Loading fonts asynchronously...');
    import('./fonts.css').then(() => {
      console.log('✅ [APP] Fonts loaded');
    }).catch(err => {
      console.error('❌ [APP] Error loading fonts:', err);
    });

    // Loading OHLCV data
    console.log('⏱️  [APP] Fetching OHLCV data...');
    const fetchStartTime = performance.now();
    fetch('data/ohlcv.json')
      .then(response => {
        console.log(`✅ [APP] OHLCV fetch completed in ${(performance.now() - fetchStartTime).toFixed(2)}ms`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        const parseStartTime = performance.now();
        console.log('⏱️  [APP] Parsing OHLCV data...');
        if (data?.data?.attributes?.ohlcv_list) {
          // Get current time in seconds
          const now = Math.floor(Date.now() / 1000);

          // Get original data
          const originalData = data.data.attributes.ohlcv_list;

          // Distribute data evenly across timestamps: 24h, 18h, 12h, 6h ago and current time
          const modifiedData = originalData.map((bar, index, array) => {
            // Calculate relative position from 0 to 1
            const relativePosition = index / (array.length - 1);

            // Calculate timestamp (in seconds)
            // 24 hours = 86400 seconds
            const hours = 24 - (relativePosition * 24);
            const newTimestamp = now - Math.round(hours * 3600);

            return [newTimestamp, bar[1], bar[2], bar[3], bar[4], bar[5]];
          });

          setOhlcvData(modifiedData);
          console.log(`✅ [APP] OHLCV data parsed and set in ${(performance.now() - parseStartTime).toFixed(2)}ms`);
        }
      })
      .catch(error => {
        console.error('❌ [APP] Error loading OHLCV data:', error);
      });

    // Check URL for config and token parameters
    console.log('⏱️  [APP] Checking URL parameters...');
    const urlParams = new URLSearchParams(window.location.search);
    const configParam = urlParams.get('config');
    const tokenParam = urlParams.get('token');

    if (configParam && tokenParam) {
      console.log('⏱️  [APP] Found config and token in URL, loading from server...');
      // Save parameters for possible future updates
      setGroupId(configParam);
      setToken(tokenParam);
      setIsTgSession(true);

      // Load configuration from server
      loadConfigFromServer(configParam, tokenParam);
    } else {
      console.log('✅ [APP] No config parameters in URL');
    }

    console.log(`✅ [APP] Initial effect completed in ${(performance.now() - effectStartTime).toFixed(2)}ms`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Function to display notifications
  const showNotification = (message: string, type: 'success' | 'error') => {
    setNotification({
      show: true,
      message,
      type
    });
  };

  const handleCloseNotification = () => {
    setNotification(prev => ({ ...prev, show: false }));
  };

  const handleConfigUpdate = (barType: BarType, newBarConfig: ExtendedBarConfig | DojiConfig) => {
    const updatedConfig = { ...config };

    // Update current bar configuration
    if (barType === 'doji') {
      updatedConfig[barType] = newBarConfig as DojiConfig;
    } else {
      updatedConfig[barType] = newBarConfig as ExtendedBarConfig;
    }

    setConfig(updatedConfig);
  };

  const handleImageUpdate = (
    barType: BarType | 'background',
    partType: ImagePartType | 'image',
    settings: any
  ) => {
    // console.log(`[DEBUG] App.tsx - handleImageUpdate for ${barType}.${partType}:`, JSON.stringify(settings));

    // Determine which fields are present
    const hasScale = settings.scale !== undefined;
    const hasOffsetX = settings.offsetX !== undefined;
    const hasOffsetY = settings.offsetY !== undefined;
    const hasRotation = settings.rotation !== undefined;
    const hasOverlap = settings.overlap !== undefined;
    const hasHue = settings.hue !== undefined;
    const hasMirror = settings.mirror !== undefined;

    // Normalize numeric parameters to avoid type issues
    const normalizedSettings = {
      ...settings,
      url: settings.url,
      scale: hasScale
        ? (typeof settings.scale === 'number' ? settings.scale : parseFloat(String(settings.scale)) || 1)
        : 1,
      offsetX: hasOffsetX
        ? (typeof settings.offsetX === 'number' ? settings.offsetX : parseInt(String(settings.offsetX)) || 0)
        : 0,
      offsetY: hasOffsetY
        ? (typeof settings.offsetY === 'number' ? settings.offsetY : parseInt(String(settings.offsetY)) || 0)
        : 0,
      rotation: hasRotation
        ? (typeof settings.rotation === 'number' ? settings.rotation : parseInt(String(settings.rotation)) || 0)
        : 0,
      overlap: hasOverlap
        ? (typeof settings.overlap === 'number' ? settings.overlap : parseInt(String(settings.overlap)) || 0)
        : 0,
      hue: hasHue
        ? (typeof settings.hue === 'number' ? settings.hue : parseInt(String(settings.hue)) || 0)
        : 0,
      mirror: hasMirror ? Boolean(settings.mirror) : false
    };

    // console.log(`[DEBUG] App.tsx - normalized parameters:`, JSON.stringify(normalizedSettings));

    setConfig(prevConfig => {
      const newConfig = { ...prevConfig };
      if (barType === 'background') {
        // Keep existing parameters if any and apply new ones
        newConfig.background.image = {
          ...newConfig.background.image, // Keep existing parameters if any
          ...normalizedSettings, // Apply new parameters
        };
        // console.log(`[DEBUG] App.tsx - updated background parameters:`, JSON.stringify(newConfig.background.image));
      } else {
        const barConfig = newConfig[barType];
        if (barConfig && typeof barConfig === 'object') {
          // Keep existing parameters if any and apply new ones
          if (!(barConfig as any)[partType]) {
            (barConfig as any)[partType] = {}; // Create object if it doesn't exist
          }
          (barConfig as any)[partType] = {
            ...(barConfig as any)[partType], // Keep existing parameters
            ...normalizedSettings, // Apply new parameters
          };
          // console.log(`[DEBUG] App.tsx - updated parameters ${barType}.${partType}:`, JSON.stringify((barConfig as any)[partType]));
        }
      }
      return newConfig;
    });
  };

  const handleColorUpdate = (barType: BarType | 'background' | 'overlay', color: string) => {
    setConfig(prevConfig => {
      const newConfig = { ...prevConfig };
      if (barType === 'background') {
        newConfig.background.color = color;
      } else if (barType === 'overlay') {
        newConfig.overlay.color = color;
      } else if (barType === 'doji') {
        if (newConfig.doji) {
          newConfig.doji.color = color;
        }
      } else {
        const barConfig = newConfig[barType];
        if (barConfig && typeof barConfig === 'object') {
          barConfig.color = color;
        }
      }
      return newConfig;
    });
  };

  const handleImageSettingsUpdate = (
    barType: BarType,
    partType: ImagePartType,
    settings: any
  ) => {
    // console.log(`Updating image settings for ${barType}.${partType}:`, settings);
    setConfig(prevConfig => {
      const newConfig = { ...prevConfig };
      const barConfig = newConfig[barType];
      if (barConfig && typeof barConfig === 'object' && (barConfig as any)[partType]) {
        (barConfig as any)[partType] = {
          ...(barConfig as any)[partType],
          ...settings
        };
      }
      return newConfig;
    });
  };

  const handleOpacityUpdate = (opacity: number) => {
    setConfig(prevConfig => ({
      ...prevConfig,
      background: {
        ...prevConfig.background,
        opacity
      }
    }));
  };

  const handleExport = async (params?: { network: string; poolAddress: string; duration: number; numBars: number; interval: string; displayName?: string }) => {
    try {
      // Создаем базовую конфигурацию для экспорта
      const baseExportConfig = {
        ...config,
        network: params?.network || config.network,
        poolAddress: params?.poolAddress || config.poolAddress,
        duration: params?.duration || config.duration,
        numBars: params?.numBars || config.numBars,
        interval: params?.interval || config.interval,
        displayName: params?.displayName || config.displayName || ''
      };

      // Показываем индикатор загрузки
      showNotification('Converting to base64...', 'success');

      // Конвертируем все изображения в base64
      const exportConfig = await convertConfigToBase64(baseExportConfig);

      // Показываем статистику
      const { totalSize, imageCount, jpegCount, pngCount } = getConfigImagesSize(exportConfig);
      if (imageCount > 0) {
        console.log(`[EXPORT] Config converted to base64: ${imageCount} images (JPEG: ${jpegCount}, PNG: ${pngCount}), total size: ${formatSize(totalSize)}`);
        showNotification(`Export ready: ${imageCount} images (JPEG: ${jpegCount}, PNG: ${pngCount}, ${formatSize(totalSize)})`, 'success');
      }

      // Создаем и скачиваем файл
      const configString = JSON.stringify(exportConfig, null, 2);
      const blob = new Blob([configString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'chart-config.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting configuration:', error);
      showNotification('Error exporting configuration', 'error');
    }
  };

  const handleImport = (callback: (config: ChartConfig) => void) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = async (event) => {
          try {
            const importedConfig = JSON.parse(event.target?.result as string);

            // First, reset all current settings to default
            const resetConfig = { ...defaultConfig };

            // Then apply imported settings
            const mergedConfig = deepMerge(resetConfig, importedConfig);

            // Ensure all required fields are present and valid
            const finalConfig = ensureConfigIntegrity(mergedConfig);

            setConfig(finalConfig);

            // Reload font if changed
            if (finalConfig.font.family !== config.font.family) {
              reloadFontStyles(finalConfig.font.family);
            }

            callback(finalConfig);
          } catch (error) {
            console.error('Failed to parse configuration:', error);
            alert('Error importing configuration');
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  // Function to deep merge objects with better handling of missing fields
  const deepMerge = (target: any, source: any): any => {
    const output = { ...target };

    if (isObject(target) && isObject(source)) {
      Object.keys(source).forEach(key => {
        if (isObject(source[key])) {
          if (!(key in target)) {
            Object.assign(output, { [key]: source[key] });
          } else {
            output[key] = deepMerge(target[key], source[key]);
          }
        } else {
          Object.assign(output, { [key]: source[key] });
        }
      });
    }

    return output;
  };

  // Function to ensure all required fields are present in config
  const ensureConfigIntegrity = (config: any): ChartConfig => {
    // Ensure borders configuration has all required fields
    if (!config.borders) {
      config.borders = {} as any;
    }
    if ((config.borders as any).applyToAll === undefined) (config.borders as any).applyToAll = true;
    if (config.borders.applyToAll === undefined) (config.borders as any).applyToAll = true;

    // Set default values for missing border fields
    if (config.borders.topBevel === undefined) config.borders.topBevel = 0;
    if (config.borders.bottomBevel === undefined) config.borders.bottomBevel = 0;
    if (config.borders.topRound === undefined) config.borders.topRound = true;
    if (config.borders.bottomRound === undefined) config.borders.bottomRound = true;
    if (!config.borders.borderSides) {
      config.borders.borderSides = {
        top: true,
        bottom: true,
        left: true,
        right: true
      };
    } else {
      // Ensure all borderSides fields are present
      if (config.borders.borderSides.top === undefined) config.borders.borderSides.top = true;
      if (config.borders.borderSides.bottom === undefined) config.borders.borderSides.bottom = true;
      if (config.borders.borderSides.left === undefined) config.borders.borderSides.left = true;
      if (config.borders.borderSides.right === undefined) config.borders.borderSides.right = true;
    }

    // Ensure other critical fields are present
    if (!config.doji) {
      config.doji = { color: '#FFFF00', active: false };
    }
    if (config.doji.active === undefined) config.doji.active = false;

    // Ensure per-bar border enable flags default to true
    if (!config.borders.upBar) config.borders.upBar = {} as any;
    if (config.borders.upBar.enabled === undefined) (config.borders.upBar as any).enabled = true;
    if ((config.borders.upBar as any).borderSides === undefined) (config.borders.upBar as any).borderSides = { top: true, bottom: true, left: true, right: true };
    if (!config.borders.downBar) config.borders.downBar = {} as any;
    if (config.borders.downBar.enabled === undefined) (config.borders.downBar as any).enabled = true;
    if ((config.borders.downBar as any).borderSides === undefined) (config.borders.downBar as any).borderSides = { top: true, bottom: true, left: true, right: true };
    if (!config.borders.candle) config.borders.candle = {} as any;
    if (config.borders.candle.enabled === undefined) (config.borders.candle as any).enabled = true;
    if ((config.borders.candle as any).borderSides === undefined) (config.borders.candle as any).borderSides = { top: true, bottom: true, left: true, right: true };
    if (!config.borders.knife) config.borders.knife = {} as any;
    if (config.borders.knife.enabled === undefined) (config.borders.knife as any).enabled = true;
    if ((config.borders.knife as any).borderSides === undefined) (config.borders.knife as any).borderSides = { top: true, bottom: true, left: true, right: true };
    if (config.borders.doji) {
      if ((config.borders.doji as any).enabled === undefined) (config.borders.doji as any).enabled = true;
      if ((config.borders.doji as any).borderSides === undefined) (config.borders.doji as any).borderSides = { top: true, bottom: true, left: true, right: true };
    }

    if (!config.fineTuning) {
      config.fineTuning = { maxCandles: 10, maxKnives: 10 };
    }
    if (config.fineTuning.maxCandles === undefined) config.fineTuning.maxCandles = 10;
    if (config.fineTuning.maxKnives === undefined) config.fineTuning.maxKnives = 10;

    return config as ChartConfig;
  };

  // Helper function to check if item is an object
  const isObject = (item: any): boolean => {
    return (item && typeof item === 'object' && !Array.isArray(item));
  };

  const handleConfigChange = (path: string, value: any) => {
    setConfig(prevConfig => {
      const newConfig = { ...prevConfig };
      const keys = path.split('.');
      let current: any = newConfig;

      for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]];
      }

      current[keys[keys.length - 1]] = value;
      return newConfig;
    });
  };

  const handleDisplayChange = (path: string, value: boolean) => {
    setConfig(prevConfig => {
      const newConfig = { ...prevConfig };
      newConfig.display[path] = value;
      return newConfig;
    });
  };

  const handleHighLowLinesUpdate = (newHighLowLinesConfig: HighLowLinesConfig) => {
    setConfig(prevConfig => ({
      ...prevConfig,
      highLowLines: newHighLowLinesConfig
    }));
  };

  const handleBordersUpdate = (newBordersConfig: BordersConfig) => {
    setConfig(prevConfig => ({
      ...prevConfig,
      borders: newBordersConfig
    }));
  };

  const handleDojiToggle = (active: boolean) => {
    setConfig(prevConfig => ({
      ...prevConfig,
      doji: prevConfig.doji ? {
        ...prevConfig.doji,
        active
      } : {
        color: '#FFFF00',
        active
      }
    }));
  };

  // Function to copy style from one bar type to another
  const handleCopyStyleFrom = (fromBarType: BarType, toBarType: BarType) => {
    setConfig(prevConfig => {
      const newConfig = { ...prevConfig };

      // Helper function to deep clone an object
      const deepClone = (obj: any) => {
        if (obj === null || typeof obj !== 'object') return obj;
        if (obj instanceof Date) return new Date(obj.getTime());
        if (Array.isArray(obj)) return obj.map(item => deepClone(item));

        const cloned: any = {};
        for (const key in obj) {
          if (obj.hasOwnProperty(key)) {
            cloned[key] = deepClone(obj[key]);
          }
        }
        return cloned;
      };

      // Get source configuration
      let sourceConfig: any;
      if (fromBarType === 'doji' && newConfig.doji) {
        sourceConfig = newConfig.doji;
      } else {
        sourceConfig = newConfig[fromBarType];
      }

      if (!sourceConfig) return newConfig;

      // Deep clone source config to avoid references
      const clonedSourceConfig = deepClone(sourceConfig);

      // Apply to target bar type
      if (toBarType === 'doji') {
        if (!newConfig.doji) {
          newConfig.doji = { color: '#FFFF00', active: false };
        }
        // Keep the active state but replace everything else
        const wasActive = newConfig.doji.active;
        newConfig.doji = {
          ...clonedSourceConfig,
          active: wasActive // Preserve active state for doji
        };
      } else {
        // For regular bar types, completely replace the configuration
        // but preserve the basic structure
        const newBarConfig: any = {
          color: clonedSourceConfig.color
        };

        // Copy all image settings
        if (clonedSourceConfig.top) newBarConfig.top = clonedSourceConfig.top;
        if (clonedSourceConfig.body) newBarConfig.body = clonedSourceConfig.body;
        if (clonedSourceConfig.center) newBarConfig.center = clonedSourceConfig.center;
        if (clonedSourceConfig.bottom) newBarConfig.bottom = clonedSourceConfig.bottom;

        // Replace the entire configuration
        (newConfig[toBarType] as any) = newBarConfig;
      }

      return newConfig;
    });

    showNotification(`Style copied from ${fromBarType} to ${toBarType}`, 'success');
  };

  // Function to send updated configuration back to server
  const updateTelegramConfig = async () => {
    if (!groupId || !token) {
      showNotification('Error: no group parameters or token', 'error');
      return;
    }

    try {
      // Создаем базовую конфигурацию для отправки
      const baseExportConfig = {
        ...config,
        network: config.network,
        poolAddress: config.poolAddress,
        duration: config.duration,
        numBars: config.numBars,
        interval: config.interval,
        displayName: config.displayName || ''
      };

      showNotification('Preparing configuration for sending to server...', 'success');

      // Конвертируем все изображения в base64 для надёжности
      const exportConfig = await convertConfigToBase64(baseExportConfig);

      // Define base API URL
      const baseUrl = process.env.NODE_ENV === 'production'
        ? window.location.origin
        : 'http://localhost:3002';

      // Check data size before sending
      const configSize = JSON.stringify(exportConfig).length;
      const { totalSize, imageCount, jpegCount, pngCount } = getConfigImagesSize(exportConfig);

      console.log(`[TELEGRAM UPDATE] Sending configuration: ${imageCount} images (JPEG: ${jpegCount}, PNG: ${pngCount}), total size: ${formatSize(totalSize)}, JSON size: ${formatSize(configSize)}`);

      const response = await axios.put(`${baseUrl}/api/config/${groupId}`, {
        config: exportConfig,
        token: token
      });

      if (response.data && response.data.success) {
        showNotification(`Configuration updated (${imageCount} images: JPEG: ${jpegCount}, PNG: ${pngCount})`, 'success');
      } else {
        showNotification('Configuration update error', 'error');
      }
    } catch (error) {
      console.error('Error updating configuration:', error);
      showNotification('Configuration update error', 'error');
    }
  };

  // Effect to track font changes in configuration
  useEffect(() => {
    if (config.font.family) {
      // console.log(`[FONT DEBUG] Font family changed to: ${config.font.family}`);
      reloadFontStyles(config.font.family);
    }
  }, [config.font.family]);

  // Effect for automatic user registration when wallet connects
  useEffect(() => {
    if (address && !userRegistered && !isTgSession) {
      console.log(`New wallet connected: ${address}`);

      const registerUser = async () => {
        try {
          const baseUrl = process.env.NODE_ENV === 'production'
            ? window.location.origin
            : 'http://localhost:3002';

          const response = await axios.post(`${baseUrl}/api/user-auto-register`, {
            address: address
          });

          if (response.data.success) {
            console.log(`User auto-registered: ${response.data.username}`);
            if (!response.data.alreadyExists) {
              showNotification(`Welcome! Your username is: ${response.data.username}`, 'success');
            }
            setUserRegistered(true);
          }
        } catch (error) {
          console.error('Error auto-registering user:', error);
          // Don't show error to user since it's not critical
        }
      };

      registerUser();
    }
  }, [address, userRegistered, isTgSession]);

  // Effect for warning when leaving page
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Check if there are changes in configuration (compare with default)
      const hasChanges = JSON.stringify(config) !== JSON.stringify(defaultConfig);

      if (hasChanges) {
        const message = 'Are you sure you want to leave? All unsaved chart preset changes will be lost.';
        e.preventDefault();
        e.returnValue = message;
        return message;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [config]);

  // Function to open/close donate dialog
  const handleDonateDialogToggle = () => {
    setDonateDialogOpen(!donateDialogOpen);
  };

  // Function to copy address to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      showNotification('Address copied to clipboard', 'success');
    }).catch(err => {
      console.error('Could not copy text: ', err);
      showNotification('Failed to copy address', 'error');
    });
  };

  // Function to get image from ChartPreview
  const getPreviewImage = async (): Promise<string> => {
    const chartCanvas = document.getElementById('chart-canvas') as HTMLCanvasElement;
    if (chartCanvas) {
      // console.log('Using chart-canvas for preset image');
      return chartCanvas.toDataURL('image/jpeg', 0.8);
    }

    // Create temporary canvas with placeholder if main one not found
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 800;
    tempCanvas.height = 600;
    const ctx = tempCanvas.getContext('2d');

    if (ctx) {
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 24px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Chart Configuration Preset', tempCanvas.width / 2, tempCanvas.height / 2);

      return tempCanvas.toDataURL('image/jpeg', 0.8);
    }

    return '';
  };

  const handlePresetSelect = (presetConfig: ChartConfig) => {
    // Reset all settings to default
    const resetConfig = { ...defaultConfig };
    // Apply settings from preset
    const mergedConfig = deepMerge(resetConfig, presetConfig);
    // Ensure all required fields are present and valid
    const finalConfig = ensureConfigIntegrity(mergedConfig);
    // Update configuration
    setConfig(finalConfig);
    // Reload font if changed
    if (finalConfig.font.family !== config.font.family) {
      reloadFontStyles(finalConfig.font.family);
    }
    showNotification('Preset applied successfully', 'success');
  };

  const handleEditPreset = (presetName: string, presetId: number) => {
    if (presetName === '' && presetId === 0) {
      // Reset editing mode
      setEditingPreset(null);
      showNotification('Editing mode disabled', 'success');
    } else {
      // Set editing mode
      setEditingPreset({ name: presetName, id: presetId });
      showNotification(`Preset editing mode enabled: ${presetName}`, 'success');
    }
  };

  // Function to clear all settings and reset to default
  const handleClearSettings = () => {
    setClearConfirmDialogOpen(true);
  };

  const handleConfirmClear = () => {
    // Create a completely fresh default config to ensure no references remain
    const freshDefaultConfig: ChartConfig = {
      background: {
        color: '#000000',
        opacity: 0.5,
        image: {
          url: '',
          scale: 1,
          offsetX: 0,
          offsetY: 0
        }
      },
      overlay: {
        color: '#000000'
      },
      font: {
        family: 'Arial',
        size: 40,
        color: '#ffffff'
      },
      display: {
        showMarketCap: true,
        showPrice: true,
        showTimeline: true,
        showPriceChange: true,
        showTokenName: true,
        showMinMax: true
      },
      upBar: {
        color: '#26a69a'
      } as ExtendedBarConfig,
      downBar: {
        color: '#ef5350'
      } as ExtendedBarConfig,
      candle: {
        color: '#00ff00'
      },
      knife: {
        color: '#FF0700'
      },
      doji: {
        color: '#FFFF00',
        active: false
      },
      highLowLines: {
        lineWidth: 1,
        upBar: {
          lineColor: '#26a69a'
        },
        downBar: {
          lineColor: '#ef5350'
        },
        candle: {
          lineColor: '#00ff00'
        },
        knife: {
          lineColor: '#FF0700'
        },
        doji: {
          lineColor: '#FFFF00'
        }
      },
      borders: {
        applyToAll: true,
        borderWidth: 0,
        topBevel: 0,
        bottomBevel: 0,
        topRound: true,
        bottomRound: true,
        borderSides: {
          top: true,
          bottom: true,
          left: true,
          right: true
        },
        upBar: {
          borderColor: '#FFFFFF'
        },
        downBar: {
          borderColor: '#FFFFFF'
        },
        candle: {
          borderColor: '#FFFFFF'
        },
        knife: {
          borderColor: '#FFFFFF'
        },
        doji: {
          borderColor: '#FFFFFF'
        }
      },
      fineTuning: {
        maxCandles: 10,
        maxKnives: 10
      },
      network: 'polygon_pos',
      poolAddress: '0xa030be97a53d6462c675962fec3eafbe53b8bb6c',
      duration: 4,
      numBars: 20,
      interval: 'hour',
      free: false
    };

    // Reset configuration to fresh default
    setConfig(freshDefaultConfig);

    // Clear editing preset from memory
    setEditingPreset(null);

    // Force re-render to clear any cached images or components
    setForceRender(prev => prev + 1);

    // Reload default font
    reloadFontStyles(freshDefaultConfig.font.family);

    // Close confirmation dialog
    setClearConfirmDialogOpen(false);

    // Show success notification
    showNotification('All settings have been reset to default', 'success');

    // console.log('All settings cleared and reset to default state');
  };

  // Function to load font and update styles
  const reloadFontStyles = (fontFamily: string) => {
    if (fontFamily && fontFamily !== 'Arial') {
      //console.log(`[FONT DEBUG] Forcing font load: ${fontFamily}`);
      const tempDiv = document.createElement('div');
      tempDiv.style.position = 'absolute';
      tempDiv.style.visibility = 'hidden';
      tempDiv.style.fontFamily = fontFamily;
      tempDiv.innerText = 'Font Preload';
      document.body.appendChild(tempDiv);
      setTimeout(() => {
        document.body.removeChild(tempDiv);
        //console.log(`[FONT DEBUG] Font preload complete for: ${fontFamily}`);
        setForceRender(prev => prev + 1);
      }, 300);
    }
  };

  // Function to load configuration from server
  const loadConfigFromServer = async (groupId: string, token: string) => {
    try {
      // Define base API URL
      const baseUrl = process.env.NODE_ENV === 'production'
        ? window.location.origin
        : 'http://localhost:3002';

      const response = await axios.get(`${baseUrl}/api/config/${groupId}`, {
        params: { token }
      });

      if (response.data) {
        // Logging received data for debugging
        // console.log('Received config from server:', response.data);
        // console.log('Network params in received config:', {
        //   network: response.data.network,
        //   poolAddress: response.data.poolAddress,
        //   duration: response.data.duration,
        //   numBars: response.data.numBars,
        //   interval: response.data.interval
        // });

        // Clear URL to prevent parameters from being saved in browser history
        window.history.replaceState({}, document.title, window.location.pathname);

        // Apply imported configuration
        const importedConfig = response.data;
        const mergedConfig = deepMerge(defaultConfig, importedConfig);

        // Ensure all required fields are present and valid
        const finalConfig = ensureConfigIntegrity(mergedConfig);

        // Logging final configuration after merging
        // console.log('Final config after merge:', finalConfig);
        // console.log('[FONT DEBUG] Font from config:', finalConfig.font.family);

        setConfig(finalConfig);

        // Force load and apply font
        reloadFontStyles(finalConfig.font.family);

        showNotification('Configuration successfully loaded', 'success');
      }
    } catch (error) {
      console.error('Error loading configuration from server:', error);
      showNotification('Configuration loading error', 'error');
    }
  };

  // Track when component finishes rendering
  useEffect(() => {
    console.log(`✅ [APP] App component fully rendered in ${(performance.now() - appRenderStart).toFixed(2)}ms`);
  });

  console.log(`⏱️  [APP] App component return/render in ${(performance.now() - appRenderStart).toFixed(2)}ms`);

  return (
    <Container maxWidth="xl" sx={{ transform: { lg: 'scale(0.8)', md: 'none', xs: 'none' }, transformOrigin: 'top center' }}>
      <PageHeader
        isTgSession={isTgSession}
        onDonateClick={handleDonateDialogToggle}
        onProfileClick={() => setProfileDialogOpen(true)}
        onUpdateTgClick={updateTelegramConfig}
      />

      <Divider sx={{ my: 1 }} />
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Button
          variant="contained"
          color="primary"
          startIcon={<ViewModuleIcon />}
          onClick={() => setPresetDialogOpen(true)}
          sx={{ mr: 2 }}
        >
          Presets
        </Button>
        <Typography variant="h4" sx={{ flexGrow: 1 }} align="center">
          Chart Configuration
        </Typography>
      </Box>
      <Box sx={{
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        gap: 1
      }}>
        <Box
          ref={chartPreviewRef}
          sx={{
            width: { xs: '100%', md: '60%' },
            position: { xs: 'sticky', md: 'sticky' },
            top: { xs: 0, md: 24 },
            mb: { xs: 2, md: 0 },
            zIndex: 100,
            backgroundColor: 'background.paper'
          }}
        >
          <ChartPreview
            config={config}
            data={ohlcvData}
            showTokenInfo={false}
            key={`chart-preview-${forceRender}`}
            tokenName="Token"
          />
        </Box>
        <Box sx={{
          width: { xs: '100%', md: '40%' },
          maxHeight: { xs: 'none', md: 'calc(100vh - 100px)' },
          overflowY: 'auto',
          paddingRight: { xs: 0, md: 0 }
        }}>
          <Box sx={{ pb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Button
                variant="outlined"
                color="warning"
                onClick={handleClearSettings}
                sx={{ mr: 1 }}
              >
                Clear
              </Button>
              <SaveLoadPresetButton
                editingPreset={editingPreset}
                address={address}
                isTgSession={isTgSession}
                onClick={() => setSavePresetDialogOpen(true)}
                sx={{ ml: 1 }}
              />
            </Box>
          </Box>

          <Box sx={{ width: '100%' }}>
            <Accordion sx={{ width: '100%' }}>
              <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
                sx={{ minHeight: '48px', '& .MuiAccordionSummary-content': { margin: '8px 0' } }}
              >
                <Typography variant="h4">Background</Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ px: 2, py: 1, width: '100%', backgroundColor: 'background.paper' }}>
                <BackgroundConfigurator
                  config={config.background}
                  onImageUpdate={(settings) => handleImageUpdate('background', 'image', settings)}
                  onColorUpdate={(color) => handleColorUpdate('background', color)}
                  onOverlayColorUpdate={(color) => handleColorUpdate('overlay', color)}
                  onOpacityUpdate={handleOpacityUpdate}
                  onFileNameUpdate={handleFileNameUpdate}
                  uploadedFileName={uploadedFileName}
                />
              </AccordionDetails>
            </Accordion>
          </Box>
          <Box sx={{ width: '100%', mt: 2 }}>
            <Accordion sx={{ width: '100%' }}>
              <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
                sx={{ minHeight: '48px', '& .MuiAccordionSummary-content': { margin: '8px 0' } }}
              >
                <Typography variant="h4">Up Bar <span style={{ color: config.upBar.color }}>▲</span></Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ px: 2, py: 1, width: '100%', backgroundColor: 'background.paper' }}>
                <BarConfigurator
                  title="Up Bar"
                  barType="upBar"
                  config={config.upBar}
                  onUpdate={(newConfig) => handleConfigUpdate('upBar', newConfig as ExtendedBarConfig)}
                  onImageUpdate={handleImageUpdate}
                  onColorUpdate={handleColorUpdate}
                  onImageSettingsUpdate={handleImageSettingsUpdate}
                  onFileNameUpdate={handleFileNameUpdate}
                  uploadedFileName={uploadedFileName}
                  onCopyStyleFrom={handleCopyStyleFrom}
                />
              </AccordionDetails>
            </Accordion>
          </Box>
          <Box sx={{ width: '100%', mt: 2 }}>
            <Accordion sx={{ width: '100%' }}>
              <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
                sx={{ minHeight: '48px', '& .MuiAccordionSummary-content': { margin: '8px 0' } }}
              >
                <Typography variant="h4">Down Bar <span style={{ color: config.downBar.color }}>▼</span></Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ px: 2, py: 1, width: '100%', backgroundColor: 'background.paper' }}>
                <BarConfigurator
                  title="Down Bar"
                  barType="downBar"
                  config={config.downBar}
                  onUpdate={(newConfig) => handleConfigUpdate('downBar', newConfig as ExtendedBarConfig)}
                  onImageUpdate={handleImageUpdate}
                  onColorUpdate={handleColorUpdate}
                  onImageSettingsUpdate={handleImageSettingsUpdate}
                  onFileNameUpdate={handleFileNameUpdate}
                  uploadedFileName={uploadedFileName}
                  onCopyStyleFrom={handleCopyStyleFrom}
                />
              </AccordionDetails>
            </Accordion>
          </Box>
          <Box sx={{ width: '100%', mt: 2 }}>
            <Accordion sx={{ width: '100%' }}>
              <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
                sx={{ minHeight: '48px', '& .MuiAccordionSummary-content': { margin: '8px 0' } }}
              >
                <Typography variant="h4">Candle <span style={{ color: config.candle.color }}>⇑⇑</span></Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ px: 2, py: 1, width: '100%', backgroundColor: 'background.paper' }}>
                <BarConfigurator
                  title="Candle"
                  barType="candle"
                  config={config.candle}
                  onUpdate={(newConfig) => handleConfigUpdate('candle', newConfig as ExtendedBarConfig)}
                  onImageUpdate={handleImageUpdate}
                  onColorUpdate={handleColorUpdate}
                  onImageSettingsUpdate={handleImageSettingsUpdate}
                  onFileNameUpdate={handleFileNameUpdate}
                  uploadedFileName={uploadedFileName}
                  onCopyStyleFrom={handleCopyStyleFrom}
                />
              </AccordionDetails>
            </Accordion>
          </Box>
          <Box sx={{ width: '100%', mt: 2 }}>
            <Accordion sx={{ width: '100%' }}>
              <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
                sx={{ minHeight: '48px', '& .MuiAccordionSummary-content': { margin: '8px 0' } }}
              >
                <Typography variant="h4">Knife <span style={{ color: config.knife.color }}>⇓⇓</span></Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ px: 2, py: 1, width: '100%', backgroundColor: 'background.paper' }}>
                <BarConfigurator
                  title="Knife"
                  barType="knife"
                  config={config.knife}
                  onUpdate={(newConfig) => handleConfigUpdate('knife', newConfig as ExtendedBarConfig)}
                  onImageUpdate={handleImageUpdate}
                  onColorUpdate={handleColorUpdate}
                  onImageSettingsUpdate={handleImageSettingsUpdate}
                  onFileNameUpdate={handleFileNameUpdate}
                  uploadedFileName={uploadedFileName}
                  onCopyStyleFrom={handleCopyStyleFrom}
                />
              </AccordionDetails>
            </Accordion>
          </Box>
          <Box sx={{ width: '100%', mt: 2 }}>
            <Accordion sx={{ width: '100%' }}>
              <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
                sx={{ minHeight: '48px', '& .MuiAccordionSummary-content': { margin: '8px 0' } }}
              >
                <Typography variant="h4">Doji (Flat) <span style={{ color: config.doji?.color || '#FFFF00' }}>—</span></Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ px: 2, py: 1, width: '100%', backgroundColor: 'background.paper' }}>
                <Box sx={{ mb: 2 }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={config.doji?.active || false}
                        onChange={(e) => handleDojiToggle(e.target.checked)}
                      />
                    }
                    label="Active"
                  />
                </Box>
                {config.doji?.active && (
                  <BarConfigurator
                    title="Doji"
                    barType="doji"
                    config={config.doji}
                    onUpdate={(newConfig) => {
                      setConfig(prevConfig => ({
                        ...prevConfig,
                        doji: newConfig as DojiConfig
                      }));
                    }}
                    onImageUpdate={handleImageUpdate}
                    onColorUpdate={handleColorUpdate}
                    onImageSettingsUpdate={handleImageSettingsUpdate}
                    onFileNameUpdate={handleFileNameUpdate}
                    uploadedFileName={uploadedFileName}
                    onCopyStyleFrom={handleCopyStyleFrom}
                  />
                )}
              </AccordionDetails>
            </Accordion>
          </Box>
          <Box sx={{ width: '100%', mt: 2 }}>
            <Accordion sx={{ width: '100%' }}>
              <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
                sx={{ minHeight: '48px', '& .MuiAccordionSummary-content': { margin: '8px 0' } }}
              >
                <Typography variant="h4">Borders ▣</Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ px: 2, py: 1, width: '100%', backgroundColor: 'background.paper' }}>
                <BordersConfigurator
                  config={config.borders}
                  barColors={{
                    upBar: config.upBar.color,
                    downBar: config.downBar.color,
                    candle: config.candle.color,
                    knife: config.knife.color,
                    doji: config.doji?.color
                  }}
                  onUpdate={handleBordersUpdate}
                />
              </AccordionDetails>
            </Accordion>
          </Box>
          <Box sx={{ width: '100%', mt: 2 }}>
            <Accordion sx={{ width: '100%' }}>
              <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
                sx={{ minHeight: '48px', '& .MuiAccordionSummary-content': { margin: '8px 0' } }}
              >
                <Typography variant="h4">High/Low Lines ||</Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ px: 2, py: 1, width: '100%', backgroundColor: 'background.paper' }}>
                <HighLowLinesConfigurator
                  config={config.highLowLines}
                  barColors={{
                    upBar: config.upBar.color,
                    downBar: config.downBar.color,
                    candle: config.candle.color,
                    knife: config.knife.color
                  }}
                  onUpdate={handleHighLowLinesUpdate}
                />
              </AccordionDetails>
            </Accordion>
          </Box>
          <Box sx={{ width: '100%', mt: 2 }}>
            <Accordion sx={{ width: '100%' }}>
              <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
                sx={{ minHeight: '48px', '& .MuiAccordionSummary-content': { margin: '8px 0' } }}
              >
                <Typography variant="h4">Text <span style={{ color: config.font.color }}>Ψ</span></Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ px: 2, py: 1, width: '100%', backgroundColor: 'background.paper' }}>
                <Paper sx={{ p: 0, mb: 0 }}>
                  <Box sx={{ p: 2, width: '100%' }}>
                    <Typography variant="h6" sx={{ mb: 2 }}>Text Settings</Typography>
                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2 }}>
                      <ColorPicker
                        color={config.font.color}
                        onChange={(color) => handleConfigChange('font.color', color)}
                        enableEyedropper={true}
                      />
                      <FormControl fullWidth>
                        <InputLabel>Font Family</InputLabel>
                        <Select
                          value={config.font.family}
                          label="Font Family"
                          onChange={(e) => handleConfigChange('font.family', e.target.value)}
                          MenuProps={{
                            PaperProps: {
                              sx: {
                                maxHeight: 300,
                                maxWidth: '95%'
                              },
                            },
                          }}
                          sx={{
                            fontFamily: config.font.family,
                            fontSize: '16px'
                          }}
                        >
                          {[
                            'Arial',
                            'Rich Eatin',
                            'Computer Speak',
                            'Idealist Sans',
                            'Komi',
                            'Blogger Sans',
                            'CRYSTAL',
                            'GetVoIP Grotesque',
                            'ROBOTECH GP',
                            'Anita Semi-square',
                            'Garoa Hacker Clube',
                            'Anarchy Sans',
                            'Keenton',
                            'Audiowide',
                            'Glitch Goblin',
                            'Gridtile',
                            'Harry P',
                            'Home Video',
                            'LIBRARY 3 AM',
                            'Lofty Goals',
                            'MatrixType',
                            'Minecraft',
                            'Mountain King',
                            'New Walt Disney UI',
                            'Pixelated Elegance',
                            'Procrastinating Pixie',
                            'Roblox Font',
                            'RO twimch',
                            'Ryga',
                            'Sparky Stones',
                            'Star Jedi Hollow',
                            'Super Crafty',
                            'Super Funky',
                            'Super Mystery',
                            'Super Shiny',
                            'Taurus Mono Outline',
                            'Wkwk',
                            'X Company'
                          ].map((font) => (
                            <MenuItem
                              key={font}
                              value={font}
                              sx={{
                                fontFamily: font,
                                fontSize: '16px'
                              }}
                            >
                              {font}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Box>
                    <Typography gutterBottom>Font Size: {config.font.size}px</Typography>
                    <Slider
                      value={config.font.size}
                      onChange={(_, value) => handleConfigChange('font.size', value)}
                      min={10}
                      max={70}
                      step={1}
                      marks={[
                        { value: 10, label: '10px' },
                        { value: 40, label: '40px' },
                        { value: 70, label: '70px' },
                      ]}
                      sx={{
                        width: '90%',
                        ml: 2
                      }}
                    />
                    <Box sx={{ mt: 2 }}>
                      <Typography gutterBottom>Display Options</Typography>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={config.display.showMarketCap}
                              onChange={(e) => handleDisplayChange('showMarketCap', e.target.checked)}
                            />
                          }
                          label="Show Market Cap"
                        />
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={config.display.showPrice}
                              onChange={(e) => handleDisplayChange('showPrice', e.target.checked)}
                            />
                          }
                          label="Show Price"
                        />
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={config.display.showTimeline}
                              onChange={(e) => handleDisplayChange('showTimeline', e.target.checked)}
                            />
                          }
                          label="Show Timeline"
                        />
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={config.display.showPriceChange}
                              onChange={(e) => handleDisplayChange('showPriceChange', e.target.checked)}
                            />
                          }
                          label="Show Price Change"
                        />
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={config.display.showTokenName}
                              onChange={(e) => handleDisplayChange('showTokenName', e.target.checked)}
                            />
                          }
                          label="Token Name"
                        />
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={config.display.showMinMax}
                              onChange={(e) => handleDisplayChange('showMinMax', e.target.checked)}
                            />
                          }
                          label="Show Min/Max Price"
                        />
                      </Box>
                    </Box>
                  </Box>
                </Paper>
              </AccordionDetails>
            </Accordion>
          </Box>
          <Box sx={{ width: '100%', mt: 2 }}>
            <Accordion sx={{ width: '100%' }}>
              <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
                sx={{ minHeight: '40px', '& .MuiAccordionSummary-content': { margin: '6px 0' } }}
              >
                <Typography variant="h5" sx={{ fontSize: '1.1rem', color: '#cccccc' }}>Fine Tuning</Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ px: 2, py: 1, width: '100%', backgroundColor: 'background.paper' }}>
                <Paper sx={{ p: 0, mb: 0 }}>
                  <Box sx={{ p: 2, width: '100%' }}>
                    <Typography variant="h6" sx={{ mb: 2, fontSize: '1rem' }}>Bar Type Limits</Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Typography sx={{ fontSize: '0.9rem', color: '#cccccc', minWidth: '120px' }}>
                          Max Candles:
                        </Typography>
                        <TextField
                          type="number"
                          value={config.fineTuning?.maxCandles || 10}
                          onChange={(e) => handleConfigChange('fineTuning.maxCandles', parseInt(e.target.value) || 10)}
                          inputProps={{ min: 1, max: 100 }}
                          size="small"
                          sx={{ width: '80px' }}
                        />
                        <Typography sx={{ fontSize: '0.9rem', color: '#cccccc' }}>%</Typography>
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={() => handleConfigChange('fineTuning.maxCandles', 10)}
                          sx={{ fontSize: '0.8rem' }}
                        >
                          Default
                        </Button>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Typography sx={{ fontSize: '0.9rem', color: '#cccccc', minWidth: '120px' }}>
                          Max Knives:
                        </Typography>
                        <TextField
                          type="number"
                          value={config.fineTuning?.maxKnives || 10}
                          onChange={(e) => handleConfigChange('fineTuning.maxKnives', parseInt(e.target.value) || 10)}
                          inputProps={{ min: 1, max: 100 }}
                          size="small"
                          sx={{ width: '80px' }}
                        />
                        <Typography sx={{ fontSize: '0.9rem', color: '#cccccc' }}>%</Typography>
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={() => handleConfigChange('fineTuning.maxKnives', 10)}
                          sx={{ fontSize: '0.8rem' }}
                        >
                          Default
                        </Button>
                      </Box>
                    </Box>
                  </Box>
                </Paper>
              </AccordionDetails>
            </Accordion>
          </Box>
        </Box>
      </Box>

      <Divider sx={{ my: 4 }} />

      <Box sx={{ p: 2 }}>
        <ChartGenerator
          config={config}
          onExport={handleExport}
          onImport={(callback) => handleImport(callback)}
          onParamsChange={syncChartParameters}
          editingPreset={editingPreset}
          isTgSession={isTgSession}
        />
      </Box>

      {/* Dialog for displaying donation addresses */}
      <Dialog
        open={donateDialogOpen}
        onClose={handleDonateDialogToggle}
        maxWidth="md"
        disableAutoFocus
        disableEnforceFocus
        sx={{ zIndex: 1500 }}
      >
        <DialogTitle>
          Support tChart Project
          <IconButton
            aria-label="close"
            onClick={handleDonateDialogToggle}
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
          <Box sx={{ mb: 2, mt: 1 }}>
            <Typography variant="subtitle1" gutterBottom>Eth/Polygon:</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <TextField
                fullWidth
                variant="outlined"
                value="0xf7427BD018809723e778Be7EaE4FaB6C81474C70"
                InputProps={{
                  readOnly: true,
                }}
                size="small"
              />
              <IconButton
                color="primary"
                onClick={() => copyToClipboard("0xf7427BD018809723e778Be7EaE4FaB6C81474C70")}
                sx={{ ml: 1 }}
              >
                <ContentCopyIcon />
              </IconButton>
            </Box>

            <Typography variant="subtitle1" gutterBottom>Solana:</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <TextField
                fullWidth
                variant="outlined"
                value="9ykJzDcfE1ZqtTneupQo7ET1X1nmgpQzxHBDtGXcMamU"
                InputProps={{
                  readOnly: true,
                }}
                size="small"
              />
              <IconButton
                color="primary"
                onClick={() => copyToClipboard("9ykJzDcfE1ZqtTneupQo7ET1X1nmgpQzxHBDtGXcMamU")}
                sx={{ ml: 1 }}
              >
                <ContentCopyIcon />
              </IconButton>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDonateDialogToggle} color="primary">
            Close
          </Button>
        </DialogActions>
      </Dialog>

      <PresetDialog
        open={presetDialogOpen}
        onClose={() => setPresetDialogOpen(false)}
        onPresetSelect={handlePresetSelect}
      />

      <Dialog
        open={web3DialogOpen}
        onClose={() => setWeb3DialogOpen(false)}
        maxWidth="sm"
        fullWidth
        disableAutoFocus
        disableEnforceFocus
        sx={{ zIndex: 1500 }}
      >
        <DialogTitle>Web3 Profile</DialogTitle>
        <DialogContent>
          <Web3Profile />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setWeb3DialogOpen(false)} color="primary">
            Close
          </Button>
        </DialogActions>
      </Dialog>

      <ProfileDialog
        open={profileDialogOpen}
        onClose={() => setProfileDialogOpen(false)}
        address={address}
        onPresetSelect={handlePresetSelect}
        onEditPreset={handleEditPreset}
      />

      {/* ProfilePresetsDialog для сохранения пресетов */}
      <ProfilePresetsDialog
        open={savePresetDialogOpen}
        onClose={() => setSavePresetDialogOpen(false)}
        address={address}
        getPreviewImage={getPreviewImage}
        onImportConfig={(config) => {
          // Reset all settings to default
          const resetConfig = { ...defaultConfig };
          // Apply settings from preset
          const mergedConfig = deepMerge(resetConfig, config);
          // Ensure all required fields are present and valid
          const finalConfig = ensureConfigIntegrity(mergedConfig);
          // Update configuration
          setConfig(finalConfig);
          // Reload font if changed
          if (finalConfig.font.family !== config.font.family) {
            reloadFontStyles(finalConfig.font.family);
          }
          showNotification('Preset applied successfully', 'success');
        }}
        onExportConfig={() => handleExport()}
        getCurrentConfig={() => config}
        autoSave={!editingPreset}
        onEditPreset={handleEditPreset}
        editingPreset={editingPreset}
      />



      {/* Clear confirmation dialog */}
      <Dialog
        open={clearConfirmDialogOpen}
        onClose={() => setClearConfirmDialogOpen(false)}
        maxWidth="sm"
        disableAutoFocus
        disableEnforceFocus
        sx={{ zIndex: 1500 }}
      >
        <DialogTitle>
          Confirm Clear Settings
        </DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to clear all settings and reset to default values?
          </Typography>
          <Typography sx={{ mt: 2, color: 'warning.main' }}>
            Warning: This action will remove all customizations including images, colors, network settings, pool address, and any preset information. This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setClearConfirmDialogOpen(false)} color="primary">
            Cancel
          </Button>
          <Button onClick={handleConfirmClear} color="warning" variant="contained">
            Clear All Settings
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add notification component */}
      <Snackbar
        open={notification.show}
        autoHideDuration={6000}
        onClose={handleCloseNotification}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        sx={{ zIndex: 1600 }}
      >
        <Alert
          onClose={handleCloseNotification}
          severity={notification.type}
          sx={{ width: '100%' }}
        >
          {notification.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default App; 