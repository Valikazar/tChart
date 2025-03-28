import React, { useState, useEffect } from 'react';
import { Container, CssBaseline, ThemeProvider, createTheme, Typography, Button, Grid, Box, Divider, FormControl, InputLabel, Select, MenuItem, Slider, Accordion, AccordionSummary, AccordionDetails, FormControlLabel, Checkbox, Paper } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import BarConfigurator from './components/BarConfigurator';
import BackgroundConfigurator from './components/BackgroundConfigurator';
import ChartPreview from './components/ChartPreview';
import ChartGenerator from './components/ChartGenerator';
import { BarType, ImagePartType, ChartConfig, BarConfig, ExtendedBarConfig } from './types';
import './fonts.css';
import headerImage from './img/header.webp';
import ColorPicker from './components/ColorPicker';

const theme = createTheme({
  palette: {
    mode: 'dark',
  },
});

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
  text: {
    content: '',
    x: 0,
    y: 0,
    color: '#000000',
    size: 14,
    family: 'Arial',
    align: 'left',
    baseline: 'top'
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
    color: '#26a69a',
    lineWidth: 1,
    borderWidth: 0,
    borderStyle: 'inside',
    borderColor: '#FFFFFF'
  },
  downBar: {
    color: '#ef5350',
    lineWidth: 1,
    borderWidth: 0,
    borderStyle: 'inside',
    borderColor: '#FFFFFF'
  },
  candle: {
    color: '#00ff00',
    lineWidth: 1,
    borderWidth: 0,
    borderStyle: 'inside',
    borderColor: '#FFFFFF'
  },
  knife: {
    color: '#FF0700',
    lineWidth: 1,
    borderWidth: 0,
    borderStyle: 'inside',
    borderColor: '#FFFFFF'
  },
  network: 'polygon_pos',
  poolAddress: '0xa030be97a53d6462c675962fec3eafbe53b8bb6c',
  duration: 24,
  numBars: 20,
  interval: 'hour'
};

const App: React.FC = () => {
  const [config, setConfig] = useState<ChartConfig>(defaultConfig);
  const [ohlcvData, setOhlcvData] = useState<any>(null);

  useEffect(() => {
    fetch('data/ohlcv.json')
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        if (data?.data?.attributes?.ohlcv_list) {
          setOhlcvData(data.data.attributes.ohlcv_list);
        }
      })
      .catch(error => {
        console.error('Error loading OHLCV data:', error);
      });
  }, []);

  const handleConfigUpdate = (newConfig: ChartConfig) => {
    setConfig(newConfig);
  };

  const handleImageUpdate = (
    barType: BarType | 'background',
    partType: ImagePartType | 'image',
    settings: { url: string }
  ) => {
    setConfig(prevConfig => {
      const newConfig = { ...prevConfig };
      if (barType === 'background') {
        newConfig.background.image = { ...settings, scale: 1, offsetX: 0, offsetY: 0 };
      } else {
        const barConfig = newConfig[barType];
        if (barConfig && typeof barConfig === 'object') {
          (barConfig as any)[partType] = { ...settings, scale: 1, offsetX: 0, offsetY: 0 };
        }
      }
      return newConfig;
    });
  };

  const handleImageSettingsUpdate = (
    barType: BarType,
    partType: ImagePartType,
    settings: { scale: number; offsetX: number; offsetY: number }
  ) => {
    setConfig(prevConfig => {
      const newConfig = { ...prevConfig };
      const barConfig = newConfig[barType];
      if (barConfig && typeof barConfig === 'object') {
        const imageSettings = (barConfig as any)[partType];
        if (imageSettings) {
          (barConfig as any)[partType] = {
            ...imageSettings,
            ...settings
          };
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
        if (!newConfig.overlay) {
          newConfig.overlay = { color: color };
        } else {
          newConfig.overlay.color = color;
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

  const handleOpacityUpdate = (opacity: number) => {
    setConfig(prevConfig => ({
      ...prevConfig,
      background: {
        ...prevConfig.background,
        opacity
      }
    }));
  };

  const getFontBinaryData = async (fontFamily: string): Promise<string> => {
    try {
      const fontPath = `../fonts/${fontFamily}.ttf`;
      const response = await fetch(fontPath);
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64data = reader.result as string;
          resolve(base64data.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('Error loading font:', error);
      return '';
    }
  };

  const handleExport = async (params?: { network: string; poolAddress: string; duration: number; numBars: number; interval: string }) => {
    const fontBinaryData = await getFontBinaryData(config.font.family);
    const exportConfig = {
      ...config,
      network: params?.network || config.network,
      poolAddress: params?.poolAddress || config.poolAddress,
      duration: params?.duration || config.duration,
      numBars: params?.numBars || config.numBars,
      interval: params?.interval || config.interval,
      fontBinary: fontBinaryData
    };
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
  };

  const loadFontFromBinary = async (binaryData: string): Promise<void> => {
    try {
      const fontFace = new FontFace(config.font.family, `url(data:font/ttf;base64,${binaryData})`);
      await fontFace.load();
      document.fonts.add(fontFace);
    } catch (error) {
      console.error('Error loading font from binary:', error);
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
            if (importedConfig.fontBinary) {
              await loadFontFromBinary(importedConfig.fontBinary);
            }
            setConfig(importedConfig);
            callback(importedConfig);
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

  const handleBarConfigUpdate = (barType: BarType, newConfig: BarConfig | ExtendedBarConfig) => {
    setConfig(prev => ({
      ...prev,
      [barType]: newConfig
    }));
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

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Container maxWidth="xl">
        <Typography variant="h3" component="h1" gutterBottom align="center" sx={{ mt: 4, mb: 2 }}>
          tChart Constructor
        </Typography>
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 4 }}>
          <img 
            src={headerImage} 
            alt="Chart Constructor Header" 
            style={{ maxWidth: '100%', height: 'auto' }}
          />
        </Box>
        <Divider sx={{ my: 1 }} />
        <Typography variant="h4" gutterBottom align="center">
          Chart Configuration
        </Typography>
        <Box sx={{ 
          display: 'flex', 
          flexDirection: { xs: 'column', md: 'row' },
          gap: 1 
        }}>
          <Box sx={{ 
            width: { xs: '100%', md: '60%' }, 
            position: { xs: 'sticky', md: 'sticky' }, 
            top: { xs: 0, md: 24 },
            mb: { xs: 2, md: 0 },
            zIndex: 1,
            backgroundColor: 'background.paper'
          }}>
            <ChartPreview
              config={config}
              data={ohlcvData}
            />
          </Box>
          <Box sx={{ 
            width: { xs: '100%', md: '40%' }, 
            maxHeight: { xs: 'none', md: 'calc(100vh - 100px)' }, 
            overflowY: 'auto',
            paddingRight: { xs: 0, md: 0 }
          }}>
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
                  <Typography variant="h4">Up Bar <span style={{color: config.upBar.color}}>▲</span></Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ px: 2, py: 1, width: '100%', backgroundColor: 'background.paper' }}>
                  <BarConfigurator
                    title="Up Bar"
                    barType="upBar"
                    config={config.upBar}
                    onUpdate={(upBar) => handleConfigUpdate({ ...config, upBar })}
                    onImageUpdate={(barType, partType, settings) => {
                      const newConfig = { ...config };
                      if (newConfig[barType] && partType) {
                        (newConfig[barType] as any)[partType] = settings;
                      }
                      handleConfigUpdate(newConfig);
                    }}
                    onColorUpdate={(barType, color) => {
                      const newConfig = { ...config };
                      if (newConfig[barType]) {
                        newConfig[barType].color = color;
                      }
                      handleConfigUpdate(newConfig);
                    }}
                    onImageSettingsUpdate={(barType, partType, settings) => {
                      const newConfig = { ...config };
                      if (newConfig[barType] && partType && (newConfig[barType] as any)[partType]) {
                        (newConfig[barType] as any)[partType] = {
                          ...(newConfig[barType] as any)[partType],
                          ...settings
                        };
                      }
                      handleConfigUpdate(newConfig);
                    }}
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
                  <Typography variant="h4">Down Bar <span style={{color: config.downBar.color}}>▼</span></Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ px: 2, py: 1, width: '100%', backgroundColor: 'background.paper' }}>
                  <BarConfigurator
                    title="Down Bar"
                    barType="downBar"
                    config={config.downBar}
                    onUpdate={(downBar) => handleConfigUpdate({ ...config, downBar })}
                    onImageUpdate={(barType, partType, settings) => {
                      const newConfig = { ...config };
                      if (newConfig[barType] && partType) {
                        (newConfig[barType] as any)[partType] = settings;
                      }
                      handleConfigUpdate(newConfig);
                    }}
                    onColorUpdate={(barType, color) => {
                      const newConfig = { ...config };
                      if (newConfig[barType]) {
                        newConfig[barType].color = color;
                      }
                      handleConfigUpdate(newConfig);
                    }}
                    onImageSettingsUpdate={(barType, partType, settings) => {
                      const newConfig = { ...config };
                      if (newConfig[barType] && partType && (newConfig[barType] as any)[partType]) {
                        (newConfig[barType] as any)[partType] = {
                          ...(newConfig[barType] as any)[partType],
                          ...settings
                        };
                      }
                      handleConfigUpdate(newConfig);
                    }}
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
                  <Typography variant="h4">Candle <span style={{color: config.candle.color}}>⇑⇑</span></Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ px: 2, py: 1, width: '100%', backgroundColor: 'background.paper' }}>
                  <BarConfigurator
                    title="Candle"
                    barType="candle"
                    config={config.candle}
                    onUpdate={(candle) => handleConfigUpdate({ ...config, candle })}
                    onImageUpdate={(barType, partType, settings) => {
                      const newConfig = { ...config };
                      if (newConfig[barType] && partType) {
                        (newConfig[barType] as any)[partType] = settings;
                      }
                      handleConfigUpdate(newConfig);
                    }}
                    onColorUpdate={(barType, color) => {
                      const newConfig = { ...config };
                      if (newConfig[barType]) {
                        newConfig[barType].color = color;
                      }
                      handleConfigUpdate(newConfig);
                    }}
                    onImageSettingsUpdate={(barType, partType, settings) => {
                      const newConfig = { ...config };
                      if (newConfig[barType] && partType && (newConfig[barType] as any)[partType]) {
                        (newConfig[barType] as any)[partType] = {
                          ...(newConfig[barType] as any)[partType],
                          ...settings
                        };
                      }
                      handleConfigUpdate(newConfig);
                    }}
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
                  <Typography variant="h4">Knife <span style={{color: config.knife.color}}>⇓⇓</span></Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ px: 2, py: 1, width: '100%', backgroundColor: 'background.paper' }}>
                  <BarConfigurator
                    title="Knife"
                    barType="knife"
                    config={config.knife}
                    onUpdate={(knife) => handleConfigUpdate({ ...config, knife })}
                    onImageUpdate={(barType, partType, settings) => {
                      const newConfig = { ...config };
                      if (newConfig[barType] && partType) {
                        (newConfig[barType] as any)[partType] = settings;
                      }
                      handleConfigUpdate(newConfig);
                    }}
                    onColorUpdate={(barType, color) => {
                      const newConfig = { ...config };
                      if (newConfig[barType]) {
                        newConfig[barType].color = color;
                      }
                      handleConfigUpdate(newConfig);
                    }}
                    onImageSettingsUpdate={(barType, partType, settings) => {
                      const newConfig = { ...config };
                      if (newConfig[barType] && partType && (newConfig[barType] as any)[partType]) {
                        (newConfig[barType] as any)[partType] = {
                          ...(newConfig[barType] as any)[partType],
                          ...settings
                        };
                      }
                      handleConfigUpdate(newConfig);
                    }}
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
                  <Typography variant="h4">Text <span style={{color: config.font.color}}>Ψ</span></Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ px: 2, py: 1, width: '100%', backgroundColor: 'background.paper' }}>  
                  <Paper sx={{ p: 0, mb: 0 }}>
                    <Box sx={{ p: 2, width: '100%' }}>
                      <Typography variant="h6" sx={{ mb: 2 }}>Text Settings</Typography>
                      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2 }}>
                        <ColorPicker
                          color={config.font.color}
                          onChange={(color) => handleConfigChange('font.color', color)}
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
                              'Crystal',
                              'GetVoIP Grotesque',
                              'Robotech GP',
                              'Anita Semi Square',
                              'Garoa Hacker',
                              'Extra',
                              'Anarchy Sans',
                              'Keenton'
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
          </Box>
        </Box>

        <Divider sx={{ my: 4 }} />

        <Box sx={{ p: 2 }}>
          <ChartGenerator config={config} onExport={handleExport} onImport={(callback) => handleImport(callback)} />
        </Box>
      </Container>
    </ThemeProvider>
  );
};

export default App; 