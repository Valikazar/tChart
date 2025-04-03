export type BarType = 'upBar' | 'downBar' | 'candle' | 'knife';
export type ImagePartType = 'top' | 'center' | 'bottom' | 'body';

export interface ImageConfig {
  url: string;
  scale: number;
  offsetX: number;
  offsetY?: number;
  startFrom?: 'top' | 'bottom' | 'fill';
  rotation?: number;
  overlap?: number; // процент нахлёста при тайлинге (0-99)
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
  borderColor?: string;
  borderWidth: number;
  borderStyle?: 'inside' | 'outside';
  lineColor?: string;
  lineWidth: number;
  top?: ImageConfig;
  bottom?: ImageConfig;
  body?: ImageConfig;
}

export interface ExtendedBarConfig extends BarConfig {
  center?: ImageConfig;
}

export interface ChartConfig {
  background: {
    color: string;
    opacity?: number;
    image?: ImageConfig;
  };
  overlay?: {
    color: string;
  };
  font: {
    family: string;
    size: number;
    color: string;
  };
  fontBinary?: string;
  text: {
    content: string;
    x: number;
    y: number;
    color: string;
    size: number;
    family: string;
    align: CanvasTextAlign;
    baseline: CanvasTextBaseline;
  };
  display: {
    showMarketCap: boolean;
    showPrice: boolean;
    showTimeline: boolean;
    showPriceChange: boolean;
    showTokenName: boolean;
    showMinMax: boolean;
  };
  upBar: ExtendedBarConfig;
  downBar: ExtendedBarConfig;
  candle: ExtendedBarConfig;
  knife: ExtendedBarConfig;
  network: string;
  poolAddress: string;
  duration: number;
  numBars: number;
  interval: string;
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

export interface ChartPreviewProps {
  config: ChartConfig;
  data: any[];
  tokenInfo: TokenInfo | null;
} 