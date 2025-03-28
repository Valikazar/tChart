export type BarType = 'upBar' | 'downBar' | 'candle' | 'knife';
export type ImagePartType = 'body' | 'top' | 'bottom' | 'center';

export interface OHLCVData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ChartConfig {
  upBar: {
    body: string | null;
    top: string | null;
    bottom: string | null;
    color: string;
  };
  downBar: {
    body: string | null;
    top: string | null;
    bottom: string | null;
    color: string;
  };
  candle: {
    body: string | null;
    top: string | null;
    bottom: string | null;
    center: string | null;
    color: string;
  };
  knife: {
    body: string | null;
    top: string | null;
    bottom: string | null;
    center: string | null;
    color: string;
  };
  background: {
    color: string;
    image: string | null;
  };
} 