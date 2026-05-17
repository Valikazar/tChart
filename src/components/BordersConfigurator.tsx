import React from 'react';
import { Paper, Typography, Box, Button, FormControl, Select, MenuItem, FormGroup, FormControlLabel, Checkbox } from '@mui/material';
import { styled } from '@mui/material/styles';
import ColorPicker from './ColorPicker';
import SliderWithInput from './SliderWithInput';
import { BordersConfig, BarType } from './types';

interface BordersConfiguratorProps {
  config: BordersConfig;
  barColors: {
    upBar: string;
    downBar: string;
    candle: string;
    knife: string;
    doji?: string;
  };
  onUpdate: (config: BordersConfig) => void;
}

// Create styled grid components
const GridContainer = styled('div')(({ theme }) => ({
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.spacing(2)
}));

const GridItem = styled('div')(({ theme }) => ({
  flexBasis: '100%',
  [theme.breakpoints.up('sm')]: {
    flexBasis: 'calc(50% - 8px)',
  }
}));

const BordersConfigurator: React.FC<BordersConfiguratorProps> = ({
  config,
  barColors,
  onUpdate,
}) => {
  const handleUpdate = (key: keyof BordersConfig, value: any) => {
    onUpdate({
      ...config,
      [key]: value
    });
  };



  const handleBorderSideChange = (side: 'top' | 'bottom' | 'left' | 'right', checked: boolean) => {
    onUpdate({
      ...config,
      borderSides: {
        top: config.borderSides?.top ?? true,
        bottom: config.borderSides?.bottom ?? true,
        left: config.borderSides?.left ?? true,
        right: config.borderSides?.right ?? true,
        [side]: checked
      }
    });
  };

  const handleBarColorUpdate = (barType: BarType, borderColor: string) => {
    onUpdate({
      ...config,
      [barType]: {
        ...config[barType],
        borderColor
      }
    });
  };

  const handleBarEnabledToggle = (barType: BarType, enabled: boolean) => {
    onUpdate({
      ...config,
      [barType]: {
        ...config[barType],
        enabled
      }
    });
  };

  const handleSameAsBodyColors = () => {
    onUpdate({
      ...config,
      upBar: { ...config.upBar, borderColor: barColors.upBar },
      downBar: { ...config.downBar, borderColor: barColors.downBar },
      candle: { ...config.candle, borderColor: barColors.candle },
      knife: { ...config.knife, borderColor: barColors.knife }
    });
  };

  const handleSetAllBlack = () => {
    onUpdate({
      ...config,
      upBar: { ...config.upBar, borderColor: '#000000' },
      downBar: { ...config.downBar, borderColor: '#000000' },
      candle: { ...config.candle, borderColor: '#000000' },
      knife: { ...config.knife, borderColor: '#000000' }
    });
  };

  const handleSetAllWhite = () => {
    onUpdate({
      ...config,
      upBar: { ...config.upBar, borderColor: '#FFFFFF' },
      downBar: { ...config.downBar, borderColor: '#FFFFFF' },
      candle: { ...config.candle, borderColor: '#FFFFFF' },
      knife: { ...config.knife, borderColor: '#FFFFFF' }
    });
  };

  const handleBarParamUpdate = (barType: BarType, key: 'borderWidth' | 'topBevel' | 'bottomBevel' | 'topRound' | 'bottomRound' | 'borderSides', value: any) => {
    onUpdate({
      ...config,
      [barType]: {
        ...config[barType],
        [key]: value
      }
    });
  };

  const renderBarStyleConfig = (barType: BarType, label: string) => {
    const barCfg = config[barType] || ({} as any);
    const effectiveBorderWidth = barCfg.borderWidth ?? config.borderWidth;
    const effectiveTopBevel = barCfg.topBevel ?? (config.topBevel ?? 0);
    const effectiveBottomBevel = barCfg.bottomBevel ?? (config.bottomBevel ?? 0);
    const effectiveTopRound = barCfg.topRound ?? (config.topRound ?? true);
    const effectiveBottomRound = barCfg.bottomRound ?? (config.bottomRound ?? true);
    const effectiveSides = barCfg.borderSides || config.borderSides || { top: true, bottom: true, left: true, right: true };

    return (
      <GridItem key={`style-${barType}`}>
        <Typography variant="subtitle1" sx={{ mb: 1 }}>{label}</Typography>

        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2 }}>
          <Typography variant="caption">Width</Typography>
          <SliderWithInput
            value={effectiveBorderWidth}
            onChange={(val) => handleBarParamUpdate(barType, 'borderWidth', val)}
            min={0}
            max={15}
            step={0.25}
            isFloat={true}
          />
        </Box>

        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2 }}>
          <Typography variant="caption">Top Bevel</Typography>
          <SliderWithInput
            value={effectiveTopBevel}
            onChange={(val) => handleBarParamUpdate(barType, 'topBevel', val)}
            min={0}
            max={100}
            step={1}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={effectiveTopRound}
                onChange={(e) => handleBarParamUpdate(barType, 'topRound', e.target.checked)}
                size="small"
              />
            }
            label="Round"
          />
        </Box>

        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2 }}>
          <Typography variant="caption">Bottom Bevel</Typography>
          <SliderWithInput
            value={effectiveBottomBevel}
            onChange={(val) => handleBarParamUpdate(barType, 'bottomBevel', val)}
            min={0}
            max={100}
            step={1}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={effectiveBottomRound}
                onChange={(e) => handleBarParamUpdate(barType, 'bottomRound', e.target.checked)}
                size="small"
              />
            }
            label="Round"
          />
        </Box>

        <Box sx={{ mb: 2 }}>
          <Typography variant="caption" sx={{ display: 'block', mb: 1 }}>Border Sides</Typography>
          <FormGroup row>
            <FormControlLabel
              control={
                <Checkbox
                  checked={effectiveSides.top ?? true}
                  onChange={(e) => handleBarParamUpdate(barType, 'borderSides', { ...effectiveSides, top: e.target.checked })}
                  size="small"
                />
              }
              label="Top"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={effectiveSides.bottom ?? true}
                  onChange={(e) => handleBarParamUpdate(barType, 'borderSides', { ...effectiveSides, bottom: e.target.checked })}
                  size="small"
                />
              }
              label="Bottom"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={effectiveSides.left ?? true}
                  onChange={(e) => handleBarParamUpdate(barType, 'borderSides', { ...effectiveSides, left: e.target.checked })}
                  size="small"
                />
              }
              label="Left"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={effectiveSides.right ?? true}
                  onChange={(e) => handleBarParamUpdate(barType, 'borderSides', { ...effectiveSides, right: e.target.checked })}
                  size="small"
                />
              }
              label="Right"
            />
          </FormGroup>
        </Box>
      </GridItem>
    );
  };

  const renderBarColorConfig = (barType: BarType, label: string, colorIndicator: string) => {
    const barConfig = config[barType];
    const defaultColor = (barType === 'doji' ? (barColors.doji || '#FFFF00') : (barColors as any)[barType]);
    
    return (
      <GridItem key={barType}>
        <Typography variant="h6" sx={{ mb: 1 }}>
          {label} <span style={{color: colorIndicator}}>
            {barType === 'upBar' ? '▲' : 
             barType === 'downBar' ? '▼' : 
             barType === 'candle' ? '⇑⇑' : barType === 'knife' ? '⇓⇓' : '—'}
          </span>
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 1 }}>
          <Checkbox
            checked={barConfig.enabled ?? true}
            onChange={(e) => handleBarEnabledToggle(barType, e.target.checked)}
            size="small"
          />
          <Typography variant="caption">Color</Typography>
          <ColorPicker
            color={barConfig.borderColor || defaultColor}
            onChange={(color) => handleBarColorUpdate(barType, color)}
            enableEyedropper={true}
          />
        </Box>
      </GridItem>
    );
  };

  return (
    <Paper sx={{ p: 2, width: '100%' }}>
      <Typography variant="h6" sx={{ mb: 2 }}>Borders Settings</Typography>
      
      {/* Общие настройки границ */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>Border Width & Style</Typography>
        <FormControlLabel
          control={
            <Checkbox
              checked={config.applyToAll ?? true}
              onChange={(e) => handleUpdate('applyToAll', e.target.checked)}
              size="small"
            />
          }
          label="for all bars"
          sx={{ mb: 1 }}
        />
        {(config.applyToAll ?? true) && (
          <>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2 }}>
              <Typography variant="caption">Width</Typography>
              <SliderWithInput
                value={config.borderWidth}
                onChange={(val) => handleUpdate('borderWidth', val)}
                min={0}
                max={15}
                step={0.25}
                isFloat={true}
              />
            </Box>
            
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2 }}>
              <Typography variant="caption">Top Bevel</Typography>
              <SliderWithInput
                value={config.topBevel ?? 0}
                onChange={(val) => handleUpdate('topBevel', val)}
                min={0}
                max={100}
                step={1}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={config.topRound ?? true}
                    onChange={(e) => handleUpdate('topRound', e.target.checked)}
                    size="small"
                  />
                }
                label="Round"
              />
            </Box>

            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2 }}>
              <Typography variant="caption">Bottom Bevel</Typography>
              <SliderWithInput
                value={config.bottomBevel ?? 0}
                onChange={(val) => handleUpdate('bottomBevel', val)}
                min={0}
                max={100}
                step={1}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={config.bottomRound ?? true}
                    onChange={(e) => handleUpdate('bottomRound', e.target.checked)}
                    size="small"
                  />
                }
                label="Round"
              />
            </Box>

            {/* Настройки сторон границ */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="caption" sx={{ display: 'block', mb: 1 }}>Border Sides</Typography>
              <FormGroup row>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={config.borderSides?.top ?? true}
                      onChange={(e) => handleBorderSideChange('top', e.target.checked)}
                      size="small"
                    />
                  }
                  label="Top"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={config.borderSides?.bottom ?? true}
                      onChange={(e) => handleBorderSideChange('bottom', e.target.checked)}
                      size="small"
                    />
                  }
                  label="Bottom"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={config.borderSides?.left ?? true}
                      onChange={(e) => handleBorderSideChange('left', e.target.checked)}
                      size="small"
                    />
                  }
                  label="Left"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={config.borderSides?.right ?? true}
                      onChange={(e) => handleBorderSideChange('right', e.target.checked)}
                      size="small"
                    />
                  }
                  label="Right"
                />
              </FormGroup>
            </Box>
          </>
        )}
      </Box>
      
      {/* Индивидуальные настройки границ по типам баров */}
      {!(config.applyToAll ?? true) && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>Per-bar Width & Style</Typography>
          <GridContainer>
            {renderBarStyleConfig('upBar', 'Up Bar')}
            {renderBarStyleConfig('downBar', 'Down Bar')}
            {renderBarStyleConfig('candle', 'Candle')}
            {renderBarStyleConfig('knife', 'Knife')}
            {config.doji && renderBarStyleConfig('doji', 'Doji')}
          </GridContainer>
        </Box>
      )}

      {/* Индивидуальные цвета для каждого типа бара */}
      <Typography variant="h6" sx={{ mb: 2 }}>Individual Colors</Typography>
      
      {/* Кнопки быстрой настройки цветов */}
      <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
        <Button
          variant="outlined"
          size="small"
          onClick={handleSameAsBodyColors}
          sx={{ minWidth: 'auto' }}
        >
          Same as Body
        </Button>
        <Button
          variant="outlined"
          size="small"
          onClick={handleSetAllBlack}
          sx={{ minWidth: 'auto', backgroundColor: '#000000', color: '#FFFFFF', '&:hover': { backgroundColor: '#333333' } }}
        >
          Black
        </Button>
        <Button
          variant="outlined"
          size="small"
          onClick={handleSetAllWhite}
          sx={{ minWidth: 'auto', backgroundColor: '#FFFFFF', color: '#000000', '&:hover': { backgroundColor: '#F5F5F5' } }}
        >
          White
        </Button>
      </Box>
      
      <GridContainer>
        {renderBarColorConfig('upBar', 'Up Bar', barColors.upBar)}
        {renderBarColorConfig('downBar', 'Down Bar', barColors.downBar)}
        {renderBarColorConfig('candle', 'Candle', barColors.candle)}
        {renderBarColorConfig('knife', 'Knife', barColors.knife)}
        {config.doji && renderBarColorConfig('doji', 'Doji', barColors.doji || (config.doji.color || '#FFFF00'))}
      </GridContainer>
    </Paper>
  );
};

export default BordersConfigurator; 