export type BarType = 'upBar' | 'downBar' | 'candle' | 'knife' | 'doji';
export type ImagePartType = 'top' | 'body' | 'bottom' | 'center';

export interface ImageConfig {
  url: string;
  scale: number;
  offsetX: number;
  offsetY?: number;
  startFrom?: 'top' | 'bottom' | 'fill';
  rotation?: number;
  overlap?: number; // overlap percentage for tiling (0-99)
  hue?: number; // color balance value in degrees (0-360)
  mirror?: boolean; // зеркальное отображение по горизонтали
}

export interface BackgroundConfig {
  color: string;
  image?: ImageConfig;
  overlayColor?: string;
  opacity?: number;
  overlay?: {
    color: string;
  };
}

export interface BarConfig {
  color: string;
}

// Новый интерфейс для управления High/Low линиями
export interface HighLowLinesConfig {
  lineWidth: number; // Общая ширина для всех типов баров
  upBar: {
    lineColor?: string;
  };
  downBar: {
    lineColor?: string;
  };
  candle: {
    lineColor?: string;
  };
  knife: {
    lineColor?: string;
  };
  doji?: {
    lineColor?: string;
  };
}

// Новый интерфейс для управления границами
export interface BordersConfig {
  borderWidth: number; // Общая ширина границ для всех типов баров
  applyToAll?: boolean; // Применять общие параметры ко всем барам (по умолчанию true)
  topBevel?: number; // Процент скоса верхних углов (0-100)
  bottomBevel?: number; // Процент скоса нижних углов (0-100)
  topRound?: boolean; // Использовать скругление для верхних углов (по умолчанию true)
  bottomRound?: boolean; // Использовать скругление для нижних углов (по умолчанию true)
  borderSides?: {
    top: boolean;
    bottom: boolean;
    left: boolean;
    right: boolean;
  };
  upBar: {
    borderColor?: string;
    enabled?: boolean; // Включение/отключение рамок для Up Bar
    borderWidth?: number;
    topBevel?: number;
    bottomBevel?: number;
    topRound?: boolean;
    bottomRound?: boolean;
    borderSides?: {
      top: boolean;
      bottom: boolean;
      left: boolean;
      right: boolean;
    };
  };
  downBar: {
    borderColor?: string;
    enabled?: boolean; // Включение/отключение рамок для Down Bar
    borderWidth?: number;
    topBevel?: number;
    bottomBevel?: number;
    topRound?: boolean;
    bottomRound?: boolean;
    borderSides?: {
      top: boolean;
      bottom: boolean;
      left: boolean;
      right: boolean;
    };
  };
  candle: {
    borderColor?: string;
    enabled?: boolean; // Включение/отключение рамок для Candle
    borderWidth?: number;
    topBevel?: number;
    bottomBevel?: number;
    topRound?: boolean;
    bottomRound?: boolean;
    borderSides?: {
      top: boolean;
      bottom: boolean;
      left: boolean;
      right: boolean;
    };
  };
  knife: {
    borderColor?: string;
    enabled?: boolean; // Включение/отключение рамок для Knife
    borderWidth?: number;
    topBevel?: number;
    bottomBevel?: number;
    topRound?: boolean;
    bottomRound?: boolean;
    borderSides?: {
      top: boolean;
      bottom: boolean;
      left: boolean;
      right: boolean;
    };
  };
  doji?: {
    borderColor?: string;
    enabled?: boolean; // Необязательное управление рамками для Doji
    borderWidth?: number;
    topBevel?: number;
    bottomBevel?: number;
    topRound?: boolean;
    bottomRound?: boolean;
    borderSides?: {
      top: boolean;
      bottom: boolean;
      left: boolean;
      right: boolean;
    };
  };
}

export interface ExtendedBarConfig extends BarConfig {
  top?: {
    url: string;
    scale: number;
    offsetX: number;
    offsetY: number;
    rotation?: number;
    hue?: number;
    mirror?: boolean;
  };
  body?: {
    url: string;
    scale: number;
    offsetX: number;
    offsetY: number;
    startFrom: 'top' | 'bottom' | 'fill';
    rotation?: number;
    overlap?: number;
    hue?: number;
    mirror?: boolean;
  };
  bottom?: {
    url: string;
    scale: number;
    offsetX: number;
    offsetY: number;
    rotation?: number;
    hue?: number;
    mirror?: boolean;
  };
  center?: {
    url: string;
    scale: number;
    offsetX: number;
    offsetY: number;
    rotation?: number;
    hue?: number;
    mirror?: boolean;
  };
}

export interface DojiConfig extends ExtendedBarConfig {
  active: boolean;
}

export interface VerticalLineConfig {
  active: boolean;
  position: number;
  style?: 'solid' | 'dashed';
  color?: string;
  width?: number;
}

export interface ChartConfig {
  background: BackgroundConfig;
  overlay: {
    color: string;
  };
  upBar: ExtendedBarConfig;
  downBar: ExtendedBarConfig;
  candle: ExtendedBarConfig;
  knife: ExtendedBarConfig;
  doji?: DojiConfig;
  // Новое поле для High/Low линий
  highLowLines: HighLowLinesConfig;
  // Новое поле для границ
  borders: BordersConfig;
  font: {
    family: string;
    size: number;
    color: string;
  };
  display: {
    showMarketCap: boolean;
    showPrice: boolean;
    showTimeline: boolean;
    showPriceChange: boolean;
    showTokenName: boolean;
    showMinMax: boolean;
  };
  // Новое поле для Fine Tuning
  fineTuning: {
    maxCandles: number;
    maxKnives: number;
  };
  verticalLine?: VerticalLineConfig;
  network: string;
  poolAddress: string;
  duration: number;
  numBars: number;
  interval: string;
  displayName?: string;
  free?: boolean;
}

export interface OHLCVData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Network {
  id: string;
  name: string;
}

export interface ChartGeneratorParams {
  network: string;
  poolAddress: string;
  duration: number;
  numBars: number;
  interval: string;
}

export interface TokenInfo {
  marketCap: number;
  priceUsd: number;
  priceChange: {
    '5m': number;
    '1h': number;
    '6h': number;
    '24h': number;
  };
  name: string;
}

// Interactive overlay image placed over the chart
export interface OverlayItem {
  id: string; // unique id
  url: string; // image url
  x: number; // center x in canvas coords
  y: number; // center y in canvas coords
  scale: number; // uniform scale multiplier (1.0 = natural size)
  rotation: number; // radians
  mirrored?: boolean; // horizontal mirror
  // Natural image size (set after image load for hit testing). Optional for serialization
  naturalWidth?: number;
  naturalHeight?: number;
}

export interface ChartPreviewProps {
  config: ChartConfig;
  data: any[];
  tokenInfo: TokenInfo | null;
} 