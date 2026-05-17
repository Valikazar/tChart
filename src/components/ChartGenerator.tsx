import React, { useState, useEffect, useRef } from 'react';
import { Box, TextField, Select, MenuItem, Button, FormControl, InputLabel, Typography, Dialog, DialogTitle, DialogContent, DialogActions, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, IconButton, Tabs, Tab, Checkbox, FormControlLabel, ListSubheader } from '@mui/material';
import { Network, ChartGeneratorParams, TokenInfo, ChartConfig, OverlayItem } from './types';
import ChartPreview, { ChartPreviewHandle } from './ChartPreview';
import AdditionalGraphics from './AdditionalGraphics';
import SignTextEditor from './SignTextEditor';
import { useAccount } from 'wagmi';
import CloseIcon from '@mui/icons-material/Close';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
// Import networks data
import networksData from '../data/networks.json';

// Массив изображений для выпадающего списка с описаниями
const IMAGE_OPTIONS = [
  // Real Chart
  { value: 'real_chart', label: 'REAL CHART', image: '/img/bullish_30.png', group: 'Real Chart', shortDesc: 'Real market data', fullDesc: 'Displays actual market data from the selected token without any modifications or enhancements.' },
  // My Forecast
  { value: 'bullish_30', label: 'Bullish (+30%)', image: '/img/bullish_30.png', group: 'My Forecast', shortDesc: 'Moderate bullish forecast', fullDesc: 'Predicts a moderate 30% price increase, indicating positive momentum and potential buying opportunities.' },
  { value: 'bullish_50', label: 'Bullish (+50%)', image: '/img/bullish_50.png', group: 'My Forecast', shortDesc: 'Strong bullish forecast', fullDesc: 'Forecasts a strong 50% price surge, suggesting significant upward momentum and strong buying pressure.' },
  { value: 'super_bullish', label: 'Super Bullish (+100%)', image: '/img/bullish_100.png', group: 'My Forecast', shortDesc: 'Extreme bullish forecast', fullDesc: 'Predicts a dramatic 100% price increase, indicating explosive growth potential and intense buying frenzy.' },
  { value: 'rocket', label: 'Rocket (+500%)', image: '/img/bullish_500.png', group: 'My Forecast', shortDesc: 'Rocket launch forecast', fullDesc: 'Forecasts an astronomical 500% price explosion, representing a potential moonshot scenario with massive returns.' },
  { value: 'bearish_30', label: 'Bearish (-30%)', image: '/img/bearish_30.png', group: 'My Forecast', shortDesc: 'Moderate bearish forecast', fullDesc: 'Predicts a 30% price decline, indicating negative momentum and potential selling pressure.' },
  { value: 'bearish_50', label: 'Bearish (-50%)', image: '/img/bearish_50.png', group: 'My Forecast', shortDesc: 'Strong bearish forecast', fullDesc: 'Forecasts a significant 50% price drop, suggesting strong downward momentum and heavy selling.' },
  { value: 'rug_pull', label: 'Rug Pull', image: '/img/bearish_100.png', group: 'My Forecast', shortDesc: 'Rug pull scenario', fullDesc: 'Simulates a classic rug pull scenario with 90% price crash, representing sudden liquidity removal and investor panic.' },
  { value: 'ultra_rug_pull', label: 'Ultra Rug Pull (-98%)', image: '/img/bearish_98.png', group: 'My Forecast', shortDesc: 'Complete rug pull', fullDesc: 'Represents the worst-case scenario with 98% price collapse, indicating complete project failure or massive scam.' },
  // Reversal Patterns
  { value: 'double_bottom', label: 'Double Bottom', image: '/img/pattern_double_bottom.png', group: 'Reversal Patterns', shortDesc: 'Bullish reversal pattern', fullDesc: 'A bullish reversal pattern where price forms two distinct bottoms at approximately the same level, indicating strong support and potential upward breakout.' },
  { value: 'double_top', label: 'Double Top', image: '/img/pattern_double_top.png', group: 'Reversal Patterns', shortDesc: 'Bearish reversal pattern', fullDesc: 'A bearish reversal pattern characterized by two peaks at similar levels, suggesting resistance and potential downward movement.' },
  { value: 'head_shoulders', label: 'Head & Shoulders', image: '/img/pattern_head_shoulders.png', group: 'Reversal Patterns', shortDesc: 'Bearish reversal pattern', fullDesc: 'A bearish reversal pattern with three peaks - the middle peak (head) is higher than the two surrounding peaks (shoulders), indicating trend reversal.' },
  { value: 'inverse_head_shoulders', label: 'Inverse Head & Shoulders', image: '/img/pattern_inverse_head_shoulders.png', group: 'Reversal Patterns', shortDesc: 'Bullish reversal pattern', fullDesc: 'A bullish reversal pattern that is the inverse of head and shoulders, with three troughs where the middle trough is deeper than the surrounding ones.' },
  // Continuation Patterns
  { value: 'triangle_ascending', label: 'Triangle (Ascending)', image: '/img/pattern_triangle_asc.png', group: 'Continuation Patterns', shortDesc: 'Bullish continuation pattern', fullDesc: 'A bullish continuation pattern with a rising lower trendline and flat upper trendline, suggesting upward breakout potential.' },
  { value: 'triangle_descending', label: 'Triangle (Descending)', image: '/img/pattern_triangle_desc.png', group: 'Continuation Patterns', shortDesc: 'Bearish continuation pattern', fullDesc: 'A bearish continuation pattern with a falling upper trendline and flat lower trendline, indicating potential downward breakout.' },
  { value: 'triangle_symmetric', label: 'Triangle (Symmetric)', image: '/img/pattern_triangle_sym.png', group: 'Continuation Patterns', shortDesc: 'Neutral continuation pattern', fullDesc: 'A neutral continuation pattern with converging trendlines, indicating consolidation before a breakout in either direction.' },
  { value: 'flag_bullish', label: 'Flag (Bullish)', image: '/img/pattern_flag_bull.png', group: 'Continuation Patterns', shortDesc: 'Bullish continuation pattern', fullDesc: 'A bullish continuation pattern with a strong upward move (flagpole) followed by a rectangular consolidation (flag), suggesting continued upward movement.' },
  { value: 'flag_bearish', label: 'Flag (Bearish)', image: '/img/pattern_flag_bear.png', group: 'Continuation Patterns', shortDesc: 'Bearish continuation pattern', fullDesc: 'A bearish continuation pattern with a strong downward move (flagpole) followed by a rectangular consolidation (flag), indicating continued downward movement.' },
  { value: 'pennant', label: 'Pennant', image: '/img/pattern_pennant.png', group: 'Continuation Patterns', shortDesc: 'Continuation pattern', fullDesc: 'A continuation pattern with a strong move (flagpole) followed by a small symmetrical triangle (pennant), suggesting the trend will continue in the same direction.' },
  { value: 'channel', label: 'Channel', image: '/img/pattern_channel.png', group: 'Continuation Patterns', shortDesc: 'Trading channel pattern', fullDesc: 'A continuation pattern with parallel trendlines containing price movement, indicating the trend will continue within the established channel boundaries.' },
  // Special Patterns
  { value: 'cup_handle_bullish', label: 'Cup & Handle (Bullish)', image: '/img/pattern_cup_handle_bull.png', group: 'Special Patterns', shortDesc: 'Bullish continuation pattern', fullDesc: 'A bullish continuation pattern resembling a cup with a handle, indicating a pause in upward trend before resuming the climb.' },
  { value: 'cup_handle_bearish', label: 'Cup & Handle (Bearish)', image: '/img/pattern_cup_handle_bear.png', group: 'Special Patterns', shortDesc: 'Bearish continuation pattern', fullDesc: 'A bearish continuation pattern resembling an inverted cup with a handle, indicating a pause in downward trend before resuming the decline.' },
  { value: 'rounding_bottom', label: 'Rounding Bottom', image: '/img/pattern_rounding_bottom.png', group: 'Special Patterns', shortDesc: 'Bullish reversal pattern', fullDesc: 'A bullish reversal pattern with a gradual, rounded bottom formation, indicating a slow transition from bearish to bullish sentiment.' },
  { value: 'rounding_top', label: 'Rounding Top', image: '/img/pattern_rounding_top.png', group: 'Special Patterns', shortDesc: 'Bearish reversal pattern', fullDesc: 'A bearish reversal pattern with a gradual, rounded top formation, suggesting a slow transition from bullish to bearish sentiment.' },
  { value: 'diamond', label: 'Diamond', image: '/img/pattern_diamond.png', group: 'Special Patterns', shortDesc: 'Reversal pattern', fullDesc: 'A reversal pattern that forms a diamond shape, indicating increasing volatility followed by a breakout in the direction of the prevailing trend.' },
  // Extreme Scenarios
  { value: 'pump_dump', label: 'Pump & Dump', image: '/img/pattern_pump_dump.png', group: 'Extreme Scenarios', shortDesc: '4-phase manipulation pattern', fullDesc: 'A 4-phase manipulation pattern: 1) Pump - rapid price inflation, 2) Hype - peak consolidation, 3) Dump - initial decline, 4) Crash - final collapse, representing coordinated manipulation by large holders.' },
  { value: 'dead_cat_bounce', label: 'Dead Cat Bounce', image: '/img/pattern_dead_cat.png', group: 'Extreme Scenarios', shortDesc: 'False recovery pattern', fullDesc: 'A bearish pattern showing a temporary price recovery after a significant decline, followed by continued downward movement.' },
  { value: 'squeeze', label: 'Squeeze', image: '/img/pattern_squeeze.png', group: 'Extreme Scenarios', shortDesc: 'Volatility compression', fullDesc: 'A pattern showing decreasing volatility and price range, often preceding a significant breakout in either direction.' },
  { value: 'breakout', label: 'Breakout', image: '/img/pattern_breakout.png', group: 'Extreme Scenarios', shortDesc: 'Price breakout pattern', fullDesc: 'A pattern showing price breaking out of a consolidation range, indicating the start of a new trend direction.' },
  // Crypto-Specific
  // { value: 'whale_manipulation', label: 'Whale Manipulation', image: '/img/pattern_whale.png', group: 'Crypto-Specific', shortDesc: 'Whale activity pattern', fullDesc: 'A pattern representing large holder manipulation with significant price movements caused by whale buying or selling activities.' },
  // { value: 'fomo_rally', label: 'FOMO Rally', image: '/img/pattern_fomo.png', group: 'Crypto-Specific', shortDesc: 'FOMO buying frenzy', fullDesc: 'A pattern showing rapid price increases driven by fear of missing out (FOMO), with accelerating buying pressure and volume.' },
  // { value: 'panic_sell', label: 'Panic Sell', image: '/img/pattern_panic.png', group: 'Crypto-Specific', shortDesc: 'Panic selling pattern', fullDesc: 'A pattern representing mass panic selling with sharp price declines, often triggered by negative news or market events.' },
  // { value: 'accumulation', label: 'Accumulation', image: '/img/pattern_accumulation.png', group: 'Crypto-Specific', shortDesc: 'Accumulation phase', fullDesc: 'A pattern showing steady buying at lower levels, indicating smart money accumulation before a potential upward move.' },
];

// Constant for super admin verification
const SUPREME_ADMIN = '0xf7427BD018809723e778Be7EaE4FaB6C81474C70';

// Interface for trending pool data
interface TrendingPool {
  id: string;
  name: string;
  network: string;
  address: string;
  marketCap: number;
  volume24h: number;
  priceChange24h: number;
}

interface ChartGeneratorProps {
  config: ChartConfig;
  onExport: (params: { network: string; poolAddress: string; duration: number; numBars: number; interval: string; displayName: string }) => void;
  onImport: (onImportComplete: (config: ChartConfig) => void) => void;
  onParamsChange?: (params: { network: string; poolAddress: string; duration: number; numBars: number; interval: string; displayName?: string }) => void;
  editingPreset?: { name: string, id: number } | null;
  isTgSession?: boolean;
}

// Bar duration options mapped to GeckoTerminal base timeframe and aggregate
const BAR_OPTIONS: Record<string, {
  label: string;
  base: 'minute' | 'hour' | 'day';
  aggregate: 1 | 4 | 5 | 12 | 15; // only supported values per docs
  seconds: number; // desired bucket size in seconds
  group?: number; // how many base bars form one desired bar
}> = {
  // minute?aggregate=1 -> 1m base, group 5 => 5m
  '5m': { label: '5 Minutes', base: 'minute', aggregate: 1, seconds: 5 * 60, group: 5 },
  // minute?aggregate=5 -> 5m base, group 3 => 15m
  '15m': { label: '15 Minutes', base: 'minute', aggregate: 5, seconds: 15 * 60, group: 3 },
  // minute?aggregate=15 -> 15m base, group 2 => 30m
  '30m': { label: '30 Minutes', base: 'minute', aggregate: 15, seconds: 30 * 60, group: 2 },
  // minute?aggregate=15 -> 15m base, group 4 => 1h
  '1h': { label: '1 Hour', base: 'minute', aggregate: 15, seconds: 60 * 60, group: 4 },
  // hour?aggregate=1 -> 1h base, group 4 => 4h
  '4h': { label: '4 Hours', base: 'hour', aggregate: 1, seconds: 4 * 60 * 60, group: 4 },
  // hour?aggregate=12 -> 12h base, group 2 => 1d
  '1d': { label: '1 Day', base: 'hour', aggregate: 12, seconds: 24 * 60 * 60, group: 2 },
  // day -> 1d base, group 3/7/30 => 3d/1w/1M
  '3d': { label: '3 Days', base: 'day', aggregate: 1, seconds: 3 * 24 * 60 * 60, group: 3 },
  '1w': { label: 'Week', base: 'day', aggregate: 1, seconds: 7 * 24 * 60 * 60, group: 7 },
  '1M': { label: 'Month', base: 'day', aggregate: 1, seconds: 30 * 24 * 60 * 60, group: 30 }, // approximate month
};

// Backward compat for older saved values: map 'minute'|'hour'|'day' to new keys
const normalizeIntervalKey = (val: string | undefined): keyof typeof BAR_OPTIONS => {
  if (!val) return '1h';
  if ((BAR_OPTIONS as any)[val]) return val as keyof typeof BAR_OPTIONS;
  if (val === 'minute') return '5m';
  if (val === 'hour') return '1h';
  if (val === 'day') return '1d';
  return '1h';
};

const defaultParams: ChartGeneratorParams = {
  network: 'polygon_pos',
  poolAddress: '0xa030be97a53d6462c675962fec3eafbe53b8bb6c',
  duration: 24,
  numBars: 20,
  interval: '1h'
};

const ChartGenerator: React.FC<ChartGeneratorProps> = ({ config, onExport, onImport, onParamsChange, editingPreset, isTgSession }) => {
  const [networks, setNetworks] = useState<Network[]>([]);
  const [params, setParams] = useState<ChartGeneratorParams>({
    network: config.network || defaultParams.network,
    poolAddress: config.poolAddress || defaultParams.poolAddress,
    duration: config.duration || defaultParams.duration,
    numBars: config.numBars || defaultParams.numBars,
    interval: normalizeIntervalKey(config.interval || defaultParams.interval)
  });
  const [chartData, setChartData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [isGenerated, setIsGenerated] = useState(false);

  // Trending pools state
  const [trendingDialogOpen, setTrendingDialogOpen] = useState(false);
  const [trendingPools, setTrendingPools] = useState<TrendingPool[]>([]);
  const [trendingLoading, setTrendingLoading] = useState(false);
  const [trendingError, setTrendingError] = useState<string | null>(null);

  // Tab state
  const [activeTab, setActiveTab] = useState<'top' | 'trending' | 'search'>('top');

  // Top pools state
  const [topPools, setTopPools] = useState<TrendingPool[]>([]);
  const [topLoading, setTopLoading] = useState(false);
  const [topError, setTopError] = useState<string | null>(null);
  const [selectedTopNetwork, setSelectedTopNetwork] = useState<string>('polygon_pos');

  // Search pools state
  const [searchPools, setSearchPools] = useState<TrendingPool[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [networkSelectEnabled, setNetworkSelectEnabled] = useState<boolean>(false);
  const [selectedSearchNetwork, setSelectedSearchNetwork] = useState<string>('polygon_pos');

  // Display name state
  const [displayName, setDisplayName] = useState<string>('');

  // Enhanced chart state
  const [selectedImage, setSelectedImage] = useState<string>('real_chart');
  const [showEnhancedChart, setShowEnhancedChart] = useState<boolean>(false);
  const [enhancedChartData, setEnhancedChartData] = useState<any[] | null>(null);
  const [patternDescription, setPatternDescription] = useState<string>('');

  // Additional graphics state
  const [selectedAdditionalImage, setSelectedAdditionalImage] = useState<any>(null);
  const [overlays, setOverlays] = useState<OverlayItem[]>([]);
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(null);
  const [signEditorOpen, setSignEditorOpen] = useState(false);
  const [pendingSignImage, setPendingSignImage] = useState<any>(null);

  // Input values state for editing (allows empty strings)
  const [inputValues, setInputValues] = useState({
    numBars: (config.numBars || defaultParams.numBars).toString(),
    duration: (config.duration || defaultParams.duration).toString(),
    poolAddress: config.poolAddress || defaultParams.poolAddress
  });

  // Time offset state for super admin
  const [timeOffset, setTimeOffset] = useState({
    hours: '0',
    minutes: '0'
  });

  // Access to user wallet address
  const { address } = useAccount();

  // Check if user is super admin
  const isAdmin = address?.toLowerCase() === SUPREME_ADMIN.toLowerCase();

  // Get effective display name (returns "Token" if empty)
  const getEffectiveDisplayName = () => displayName || 'Token';

  // Synchronize parameters when config changes externally
  useEffect(() => {
    setParams({
      network: config.network || defaultParams.network,
      poolAddress: config.poolAddress || defaultParams.poolAddress,
      duration: config.duration || defaultParams.duration,
      numBars: config.numBars || defaultParams.numBars,
      interval: normalizeIntervalKey(config.interval || defaultParams.interval)
    });
    // Synchronize input values
    setInputValues({
      numBars: (config.numBars || defaultParams.numBars).toString(),
      duration: (config.duration || defaultParams.duration).toString(),
      poolAddress: config.poolAddress || defaultParams.poolAddress
    });
    // Synchronize display name from config
    setDisplayName(config.displayName || '');
  }, [config.network, config.poolAddress, config.duration, config.numBars, config.interval, config.displayName]);

  // Reset tokenInfo and chart data when network or poolAddress changes
  // This ensures fresh data is fetched when preset changes
  useEffect(() => {
    setTokenInfo(null);
    setChartData(null);
    setIsGenerated(false);
  }, [config.network, config.poolAddress]);

  // Load list of networks from local file
  useEffect(() => {
    try {
      const networksList = networksData.data
        .map((network: any) => ({
          id: network.id,
          name: network.attributes.name
        }))
        .sort((a: Network, b: Network) => a.name.localeCompare(b.name));

      setNetworks(networksList);
      // Set Polygon POS as the default network
      const polygonNetwork = networksList.find(n => n.id === 'polygon_pos');
      if (polygonNetwork) {
        setParams(prev => ({ ...prev, network: polygonNetwork.id }));
      }
    } catch (err) {
      console.error('Failed to load networks:', err);
      setError('Failed to load networks');
    }
  }, []);

  // Recalculate token price when time offset changes
  useEffect(() => {
    if (isAdmin && chartData && chartData.length > 0 && tokenInfo) {
      // Calculate time offset for super admin
      const currentTime = Math.floor(Date.now() / 1000);
      const hours = parseInt(timeOffset.hours) || 0;
      const minutes = parseInt(timeOffset.minutes) || 0;
      const timeOffsetSeconds = (hours * 3600) + (minutes * 60);
      const cutoffTime = currentTime - timeOffsetSeconds;

      // Find the last bar that is not newer than cutoff time
      let lastValidBar = chartData[chartData.length - 1];
      for (let i = chartData.length - 1; i >= 0; i--) {
        if (chartData[i][0] <= cutoffTime) {
          lastValidBar = chartData[i];
          break;
        }
      }

      // Update token info with price from the last valid bar
      const currentPrice = lastValidBar[4]; // Close price is at index 4

      setTokenInfo(prevTokenInfo => {
        if (!prevTokenInfo) return null;

        // Recalculate price changes based on the new cutoff time
        const intervals = {
          '5m': 5 * 60,
          '1h': 60 * 60,
          '6h': 6 * 60 * 60,
          '24h': 24 * 60 * 60
        };

        const newPriceChanges = { ...tokenInfo.priceChange };

        // Calculate price changes for each interval
        Object.keys(intervals).forEach(intervalKey => {
          const intervalSeconds = intervals[intervalKey as keyof typeof intervals];
          const targetTime = cutoffTime - intervalSeconds;

          // Find the closest data point to the target time
          let closestPrice = currentPrice;
          let minTimeDiff = Infinity;

          for (let i = chartData.length - 1; i >= 0; i--) {
            const dataTime = chartData[i][0];
            const timeDiff = Math.abs(dataTime - targetTime);

            if (timeDiff < minTimeDiff) {
              minTimeDiff = timeDiff;
              closestPrice = chartData[i][4]; // Close price
            }

            // If we've gone too far back, break
            if (dataTime < targetTime - intervalSeconds) {
              break;
            }
          }

          // Calculate percentage change
          if (closestPrice > 0) {
            const changePercent = ((currentPrice - closestPrice) / closestPrice) * 100;
            newPriceChanges[intervalKey as keyof typeof newPriceChanges] = changePercent;
          }
        });

        return {
          ...prevTokenInfo,
          priceUsd: currentPrice,
          priceChange: newPriceChanges
        };
      });
    }
  }, [timeOffset, isAdmin, chartData]);

  // Handle input field changes (allows empty strings)
  const handleInputChange = (field: 'numBars' | 'duration' | 'poolAddress', value: string) => {
    setInputValues(prev => ({
      ...prev,
      [field]: value
    }));

    // Update params only if value is valid for numeric fields
    if (field === 'numBars' || field === 'duration') {
      if (value !== '') {
        const numValue = parseInt(value);
        if (!isNaN(numValue) && numValue > 0) {
          // Ограничиваем минимальное значение для numBars
          const finalValue = field === 'numBars' ? Math.max(5, numValue) : numValue;

          const updatedParams = {
            ...params,
            [field]: finalValue
          };
          setParams(updatedParams);

          // Notify parent component about parameter changes
          if (onParamsChange) {
            onParamsChange({ ...updatedParams, displayName: getEffectiveDisplayName() });
          }
        }
      }
    } else {
      // For non-numeric fields, update immediately
      const updatedParams = {
        ...params,
        [field]: value
      };
      setParams(updatedParams);

      // Notify parent component about parameter changes
      if (onParamsChange) {
        onParamsChange({ ...updatedParams, displayName: getEffectiveDisplayName() });
      }
    }
  };

  // Handle non-input parameter changes (network, interval)
  const handleParamChange = (param: keyof ChartGeneratorParams, value: string | number) => {
    const updatedParams = {
      ...params,
      [param]: param === 'interval' ? normalizeIntervalKey(String(value)) : value
    };
    setParams(updatedParams);

    // Notify parent component about parameter changes
    if (onParamsChange) {
      onParamsChange({ ...updatedParams, displayName: getEffectiveDisplayName() });
    }
  };

  // Load trending pools
  const loadTrendingPools = async () => {
    setTrendingLoading(true);
    setTrendingError(null);

    try {
      const response = await fetch('https://api.geckoterminal.com/api/v2/networks/trending_pools', {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch trending pools');
      }

      const data = await response.json();

      if (!data?.data) {
        throw new Error('Invalid response format');
      }

      const pools: TrendingPool[] = data.data.map((pool: any) => {
        // Extract network from pool ID as fallback (format: network_pooladdress)
        const extractNetworkFromId = (poolId: string): string => {
          const parts = poolId.split('_');
          if (parts.length >= 2) {
            // For IDs like "polygon_pos_0xabc..." return "polygon_pos"
            return parts.slice(0, -1).join('_');
          }
          return 'unknown';
        };

        return {
          id: pool.id || '',
          name: pool.attributes?.name || 'Unknown',
          network: pool.relationships?.network?.data?.id || extractNetworkFromId(pool.id || ''),
          address: pool.attributes?.address || '',
          marketCap: parseFloat(pool.attributes?.market_cap_usd || pool.attributes?.fdv_usd || '0'),
          volume24h: parseFloat(pool.attributes?.volume_usd?.h24 || '0'),
          priceChange24h: parseFloat(pool.attributes?.price_change_percentage?.h24 || '0')
        };
      });

      setTrendingPools(pools);
    } catch (err) {
      console.error('Error loading trending pools:', err);
      setTrendingError(err instanceof Error ? err.message : 'Failed to load trending pools');
    } finally {
      setTrendingLoading(false);
    }
  };

  // Load top pools for specific network
  const loadTopPools = async (network: string) => {
    setTopLoading(true);
    setTopError(null);

    try {
      const response = await fetch(`https://api.geckoterminal.com/api/v2/networks/${network}/pools`, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch top pools: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Top pools API response:', data);

      if (!data || !data.data || !Array.isArray(data.data)) {
        throw new Error('Invalid response format - expected data array');
      }

      const pools: TrendingPool[] = data.data.map((pool: any) => {
        try {
          // Extract network from pool ID as fallback (format: network_pooladdress)
          const extractNetworkFromId = (poolId: string): string => {
            const parts = poolId.split('_');
            if (parts.length >= 2) {
              // For IDs like "polygon_pos_0xabc..." return "polygon_pos"
              return parts.slice(0, -1).join('_');
            }
            return 'unknown';
          };

          return {
            id: pool.id || '',
            name: pool.attributes?.name || 'Unknown',
            network: pool.relationships?.network?.data?.id || extractNetworkFromId(pool.id || '') || network,
            address: pool.attributes?.address || '',
            marketCap: parseFloat(pool.attributes?.market_cap_usd || pool.attributes?.fdv_usd || '0'),
            volume24h: parseFloat(pool.attributes?.volume_usd?.h24 || '0'),
            priceChange24h: parseFloat(pool.attributes?.price_change_percentage?.h24 || '0')
          };
        } catch (poolError) {
          console.warn('Error parsing pool:', pool, poolError);
          return null;
        }
      }).filter(Boolean) as TrendingPool[];

      setTopPools(pools);
    } catch (err) {
      console.error('Error loading top pools:', err);
      setTopError(err instanceof Error ? err.message : 'Failed to load top pools');
    } finally {
      setTopLoading(false);
    }
  };

  // Search pools by token name (symbol), pool address or token address
  const searchPoolsByToken = async (query: string) => {
    if (!query.trim()) {
      setSearchError('Please enter a token name (symbol), pool address or token address to search');
      return;
    }

    setSearchLoading(true);
    setSearchError(null);

    try {
      // Build URL with optional network parameter
      let url = `https://api.geckoterminal.com/api/v2/search/pools?query=${encodeURIComponent(query.trim())}&page=1`;
      if (networkSelectEnabled && selectedSearchNetwork) {
        url += `&network=${selectedSearchNetwork}`;
      }

      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to search pools: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Search pools API response:', data);

      if (!data || !data.data || !Array.isArray(data.data)) {
        throw new Error('Invalid response format - expected data array');
      }

      const pools: TrendingPool[] = data.data.map((pool: any) => {
        try {
          // Extract network from pool ID (format: network_pooladdress)
          const extractNetworkFromId = (poolId: string): string => {
            const parts = poolId.split('_');
            if (parts.length >= 2) {
              // For IDs like "polygon_pos_0xabc..." return "polygon_pos"
              return parts.slice(0, -1).join('_');
            }
            return 'unknown';
          };

          return {
            id: pool.id || '',
            name: pool.attributes?.name || 'Unknown',
            network: extractNetworkFromId(pool.id || ''),
            address: pool.attributes?.address || '',
            marketCap: parseFloat(pool.attributes?.market_cap_usd || pool.attributes?.fdv_usd || '0'),
            volume24h: parseFloat(pool.attributes?.volume_usd?.h24 || '0'),
            priceChange24h: parseFloat(pool.attributes?.price_change_percentage?.h24 || '0')
          };
        } catch (poolError) {
          console.warn('Error parsing pool:', pool, poolError);
          return null;
        }
      }).filter(Boolean) as TrendingPool[];

      setSearchPools(pools);

      if (pools.length === 0) {
        setSearchError(`No pools found for "${query}"`);
      }
    } catch (err) {
      console.error('Error searching pools:', err);
      setSearchError(err instanceof Error ? err.message : 'Failed to search pools');
    } finally {
      setSearchLoading(false);
    }
  };

  // Handle trending dialog open
  const handleTrendingOpen = () => {
    setTrendingDialogOpen(true);
    setActiveTab('top'); // Default to TOP tab
    setSelectedTopNetwork(params.network); // Set current network as default
  };

  // Handle trending dialog close
  const handleTrendingClose = () => {
    setTrendingDialogOpen(false);
    setTrendingError(null);
    setTopError(null);
    setSearchError(null);
  };

  // Handle tab change
  const handleTabChange = (event: React.SyntheticEvent, newValue: 'top' | 'trending' | 'search') => {
    setActiveTab(newValue);
    // Don't auto-load data, let user click GET button
  };

  // Handle GET button click for top pools
  const handleGetTopPools = () => {
    loadTopPools(selectedTopNetwork);
  };

  // Handle SEARCH button click
  const handleSearchPools = () => {
    searchPoolsByToken(searchQuery);
  };

  // Function to remove percentage part from token name
  const cleanTokenName = (tokenName: string): string => {
    // Remove percentage part like " 0.05%" or " 0.001%" from the end of token name
    return tokenName.replace(/\s+\d+\.?\d*%\s*$/, '').trim();
  };

  // Handle pool selection from top or trending
  const handlePoolSelect = (pool: TrendingPool) => {
    const updatedParams = {
      ...params,
      network: pool.network,
      poolAddress: pool.address
    };
    setParams(updatedParams);

    // Update input values as well
    setInputValues(prev => ({
      ...prev,
      poolAddress: pool.address
    }));

    // Set display name from pool selection, removing percentage part
    const cleanedName = cleanTokenName(pool.name);
    setDisplayName(cleanedName);

    // Notify parent component about parameter changes
    if (onParamsChange) {
      onParamsChange({ ...updatedParams, displayName: cleanedName || 'Token' });
    }

    // Close dialog and generate chart
    setTrendingDialogOpen(false);
    generateChart();
  };

  // Format number for display
  const formatNumber = (num: number): string => {
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
    if (num < 1) {
      // For very small numbers (less than 0.0001), use compact notation
      if (num < 0.0001) {
        // Convert to string and extract significant digits
        const numStr = num.toExponential(10); // Get enough precision
        const [mantissaPart, exponentPart] = numStr.split('e');
        const exponent = Math.abs(parseInt(exponentPart));

        // Extract all significant digits from mantissa (remove decimal point)
        let significantDigits = mantissaPart.replace('.', '').substring(0, 3); // Take first 3 digits total

        // Pad with zeros to ensure consistent length (3 digits)
        significantDigits = significantDigits.padEnd(3, '0');

        // Calculate the number of zeros after decimal point in standard notation
        // For 5.31e-6, we want to show 0.0(4)531, not 0.0(6)531
        // This means we need exponent - 2 (because 0.0X means 2 positions are already shown)
        const zerosAfterDecimal = Math.max(0, exponent - 2);

        // Return in format: 0.0(zerosAfterDecimal)significantDigits
        return `0.0(${zerosAfterDecimal})${significantDigits}`;
      }

      // For small numbers, show enough decimal places to display 0.5% movement
      const minDifference = num * 0.005; // 0.5%
      let decimalPlaces = 0;

      // Find the decimal place where 0.5% movement becomes visible
      if (minDifference > 0) {
        // Calculate how many decimal places we need to represent the 0.5% movement
        decimalPlaces = Math.max(0, -Math.floor(Math.log10(minDifference)) + 1);
      }

      // For small numbers, ensure at least 2 decimal places
      decimalPlaces = Math.max(decimalPlaces, 2);

      // Ensure we don't show more than 6 decimal places for table display
      decimalPlaces = Math.min(decimalPlaces, 6);

      return num.toFixed(decimalPlaces);
    }
    return num.toFixed(2);
  };

  // Render pools table
  const renderPoolsTable = (pools: TrendingPool[], loading: boolean, error: string | null) => {
    if (loading) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <Typography>Loading pools...</Typography>
        </Box>
      );
    }

    if (error) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <Typography color="error">{error}</Typography>
        </Box>
      );
    }

    return (
      <TableContainer sx={{ maxHeight: 400 }}>
        <Table stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell><strong>Token Name</strong></TableCell>
              <TableCell><strong>Network</strong></TableCell>
              <TableCell><strong>Pool Address</strong></TableCell>
              <TableCell align="right"><strong>Market Cap</strong></TableCell>
              <TableCell align="right"><strong>Volume 24h</strong></TableCell>
              <TableCell align="right"><strong>Change 24h</strong></TableCell>
              <TableCell align="center"><strong>Action</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {pools.map((pool) => (
              <TableRow
                key={pool.id}
                hover
                sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
              >
                <TableCell component="th" scope="row">
                  <Typography variant="body2" fontWeight="bold">
                    {cleanTokenName(pool.name)}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" color="text.secondary">
                    {pool.network}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography
                    variant="body2"
                    sx={{
                      fontFamily: 'monospace',
                      fontSize: '0.75rem',
                      maxWidth: '120px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                  >
                    {pool.address}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2">
                    ${formatNumber(pool.marketCap)}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2">
                    ${formatNumber(pool.volume24h)}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography
                    variant="body2"
                    color={pool.priceChange24h >= 0 ? 'success.main' : 'error.main'}
                    fontWeight="bold"
                  >
                    {pool.priceChange24h >= 0 ? '+' : ''}
                    {pool.priceChange24h.toFixed(2)}%
                  </Typography>
                </TableCell>
                <TableCell align="center">
                  <Button
                    variant="contained"
                    size="small"
                    onClick={() => handlePoolSelect(pool)}
                    startIcon={<TrendingUpIcon />}
                  >
                    SELECT
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  const generateChart = async () => {
    setLoading(true);
    setError(null);
    chartPreviewRef.current?.deselectAll(); // Synchronously clear handles
    setSelectedOverlayId(null); // Clear overlay selection handles before generating

    // Basic validation - params should always be valid numbers now
    if (params.numBars <= 0) {
      setError('Number of Bars must be a positive number');
      setLoading(false);
      return;
    }

    if (params.duration <= 0) {
      setError('Duration must be a positive number');
      setLoading(false);
      return;
    }

    try {
      // Resolve bar option
      const intervalKey = normalizeIntervalKey(params.interval);
      const barOption = BAR_OPTIONS[intervalKey];

      // Determine API timeframe and aggregation
      const timeframe = barOption.base; // 'minute' | 'hour' | 'day'
      const aggregate = barOption.aggregate;
      const groupFactor = barOption.group || 1;
      const desiredBarsForFetch = Math.min(params.numBars, 50);
      const fetchLimit = Math.min(1000, desiredBarsForFetch * groupFactor + 5);

      // Get chart data
      let response;
      try {
        response = await fetch(
          `https://api.geckoterminal.com/api/v2/networks/${params.network}/pools/${params.poolAddress}/ohlcv/${timeframe}?aggregate=${aggregate}&limit=${fetchLimit}`,
          {
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            }
          }
        );
      } catch (fetchError) {
        console.error('Network error:', fetchError);
        throw new Error('Could not connect to GeckoTerminal API. Please check your internet connection.');
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData?.errors?.[0]?.title || 'Failed to fetch data');
      }

      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        console.error('Parse error:', parseError);
        throw new Error('Invalid response from GeckoTerminal API');
      }

      if (!data?.data?.attributes?.ohlcv_list) {
        console.error('Invalid data structure:', data);
        throw new Error('Invalid data structure received from API');
      }

      // Calculate time offset for super admin
      const currentTime = Math.floor(Date.now() / 1000);
      let timeOffsetSeconds = 0;

      if (isAdmin) {
        const hours = parseInt(timeOffset.hours) || 0;
        const minutes = parseInt(timeOffset.minutes) || 0;
        timeOffsetSeconds = (hours * 3600) + (minutes * 60);
      }

      const cutoffTime = currentTime - timeOffsetSeconds;

      const bucketSeconds = barOption.seconds;
      const baseBars = data.data.attributes.ohlcv_list
        .sort((a: any[], b: any[]) => a[0] - b[0])
        .map((item: any[]) => [
          parseInt(item[0]),
          parseFloat(item[1]),
          parseFloat(item[2]),
          parseFloat(item[3]),
          parseFloat(item[4]),
          parseFloat(item[5])
        ]);

      // Group base bars into desired bucket size
      const bucketMap = new Map<number, { open: number; high: number; low: number; close: number; volume: number }>();
      for (const bar of baseBars) {
        const ts = bar[0] as number;
        const startTs = Math.floor(ts / bucketSeconds) * bucketSeconds;
        const existing = bucketMap.get(startTs);
        if (!existing) {
          bucketMap.set(startTs, {
            open: bar[1] as number,
            high: bar[2] as number,
            low: bar[3] as number,
            close: bar[4] as number,
            volume: bar[5] as number,
          });
        } else {
          existing.high = Math.max(existing.high, bar[2] as number);
          existing.low = Math.min(existing.low, bar[3] as number);
          existing.close = bar[4] as number;
          existing.volume += (bar[5] as number) || 0;
        }
      }

      let groupedBars = Array.from(bucketMap.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([startTs, v]) => [startTs, v.open, v.high, v.low, v.close, v.volume]);

      // Filter out data points newer than cutoff time (for super admin)
      if (isAdmin && timeOffsetSeconds > 0) {
        groupedBars = groupedBars.filter((item: any[]) => item[0] <= cutoffTime);
      }

      // Take last N bars
      const ohlcvList = groupedBars.slice(-params.numBars);
      setChartData(ohlcvList);
      setIsGenerated(true);

      // Get token information (after chart data is loaded and filtered)
      await fetchTokenInfo(params.poolAddress);

      // Generate Enhanced Chart based on selected type
      if (selectedImage && selectedImage !== 'real_chart') {
        setTimeout(() => {
          handleGenerateEnhancedChart(selectedImage);
        }, 100);
      }
    } catch (err) {
      console.error('Chart generation error:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate chart');
      setIsGenerated(false);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    onExport({ ...params, displayName: getEffectiveDisplayName() });
  };

  const handleAdditionalImageSelect = (image: any) => {
    setSelectedAdditionalImage(image);

    // Проверяем, если это изображение из жанра "signs", открываем редактор текста
    if (image.genre === 'signs') {
      setPendingSignImage(image);
      setSignEditorOpen(true);
      return;
    }

    // Для остальных изображений добавляем их сразу
    addImageAsOverlay(image);
  };

  const addImageAsOverlay = (image: any, customUrl?: string) => {
    // Add overlay centered. Use URL via image.path endpoint
    const baseUrl = process.env.NODE_ENV === 'production' ? window.location.origin : 'http://localhost:3002';
    const url = customUrl || `${baseUrl}${image.path}`;
    const id = `overlay_${image.id}_${Date.now()}`;
    // Place at canvas center (we use current render size: width=1280,height=1280 by default)
    const centerX = 1280 / 2;
    const centerY = 1280 / 2;
    const newItem: OverlayItem = {
      id,
      url,
      x: centerX,
      y: centerY,
      scale: 1.0,
      rotation: 0,
      mirrored: false,
    };
    setOverlays((prev) => [...prev, newItem]);
  };

  const handleSignEditorConfirm = (imageWithText: string) => {
    if (pendingSignImage) {
      addImageAsOverlay(pendingSignImage, imageWithText);
    }
    setSignEditorOpen(false);
    setPendingSignImage(null);
  };

  const handleSignEditorClose = () => {
    setSignEditorOpen(false);
    setPendingSignImage(null);
  };

  const fetchTokenInfo = async (poolAddress: string) => {
    try {
      let response;
      try {
        response = await fetch(
          `https://api.geckoterminal.com/api/v2/networks/${params.network}/pools/${poolAddress}`,
          {
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            }
          }
        );
      } catch (fetchError) {
        console.error('Network error:', fetchError);
        throw new Error('Could not connect to GeckoTerminal API. Please check your internet connection.');
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error('GeckoTerminal response:', errorText);
        throw new Error('Failed to fetch token info');
      }

      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        console.error('Parse error:', parseError);
        throw new Error('Invalid response from GeckoTerminal API');
      }

      const pool = data.data?.attributes;

      if (pool) {
        const tokenName = pool.name.split(' / ')[0];

        // Calculate time offset for super admin
        const currentTime = Math.floor(Date.now() / 1000);
        let timeOffsetSeconds = 0;

        if (isAdmin) {
          const hours = parseInt(timeOffset.hours) || 0;
          const minutes = parseInt(timeOffset.minutes) || 0;
          timeOffsetSeconds = (hours * 3600) + (minutes * 60);
        }

        const cutoffTime = currentTime - timeOffsetSeconds;

        // Calculate price changes based on filtered data if super admin
        let priceChanges = {
          '5m': parseFloat(pool.price_change_percentage?.m5) || 0,
          '1h': parseFloat(pool.price_change_percentage?.h1) || 0,
          '6h': parseFloat(pool.price_change_percentage?.h6) || 0,
          '24h': parseFloat(pool.price_change_percentage?.h24) || 0
        };

        // If super admin and time offset is set, recalculate price changes from chart data
        if (isAdmin && timeOffsetSeconds > 0 && chartData && chartData.length > 0) {
          const currentPrice = chartData[chartData.length - 1][4]; // Last close price

          // Calculate time intervals in seconds
          const intervals = {
            '5m': 5 * 60,
            '1h': 60 * 60,
            '6h': 6 * 60 * 60,
            '24h': 24 * 60 * 60
          };

          // Calculate price changes for each interval
          Object.keys(intervals).forEach(intervalKey => {
            const intervalSeconds = intervals[intervalKey as keyof typeof intervals];
            const targetTime = cutoffTime - intervalSeconds;

            // Find the closest data point to the target time
            let closestPrice = currentPrice;
            let minTimeDiff = Infinity;

            for (let i = chartData.length - 1; i >= 0; i--) {
              const dataTime = chartData[i][0];
              const timeDiff = Math.abs(dataTime - targetTime);

              if (timeDiff < minTimeDiff) {
                minTimeDiff = timeDiff;
                closestPrice = chartData[i][4]; // Close price
              }

              // If we've gone too far back, break
              if (dataTime < targetTime - intervalSeconds) {
                break;
              }
            }

            // Calculate percentage change
            if (closestPrice > 0) {
              const changePercent = ((currentPrice - closestPrice) / closestPrice) * 100;
              priceChanges[intervalKey as keyof typeof priceChanges] = changePercent;
            }
          });
        }

        // Get price from last OHLCV bar (close price) instead of pool API
        let currentPrice = parseFloat(pool.base_token_price_usd) || 0;
        if (chartData && chartData.length > 0) {
          // Use the close price from the last bar in the filtered chart data
          currentPrice = chartData[chartData.length - 1][4]; // Close price is at index 4
        }

        setTokenInfo({
          marketCap: parseFloat(pool.fdv_usd) || 0,
          priceUsd: currentPrice,
          priceChange: priceChanges,
          name: tokenName
        });
      } else {
        console.error('No pool data found:', data);
        throw new Error('No pool data found');
      }
    } catch (err) {
      console.error('Token info error:', err);
    }
  };

  /* eslint-disable react-hooks/exhaustive-deps */
  const chartRef = useRef<HTMLDivElement>(null);
  const chartPreviewRef = useRef<ChartPreviewHandle>(null);

  const handleDownloadPNG = () => {
    if (!chartData) return;

    // Ensure no overlay is selected when downloading - Synchronously
    chartPreviewRef.current?.deselectAll();
    // Also update state to keep UI in sync (async)
    setSelectedOverlayId(null);

    // Определяем, какой график нужно скачать
    let chartCanvas: HTMLCanvasElement | null = null;
    let overlayCanvas: HTMLCanvasElement | null = null;

    if (selectedImage === 'real_chart') {
      chartCanvas = document.getElementById('generated-chart') as HTMLCanvasElement;
    } else if (showEnhancedChart && enhancedChartData) {
      chartCanvas = document.getElementById('enhanced-chart') as HTMLCanvasElement;
    }

    if (chartCanvas) {
      // Находим родительский контейнер с классом chart-preview
      const chartContainer = chartCanvas.closest('.chart-preview');
      if (chartContainer) {
        // Ищем второй canvas (overlay canvas) в том же контейнере
        const canvases = chartContainer.querySelectorAll('canvas');
        if (canvases.length > 1) {
          overlayCanvas = canvases[1] as HTMLCanvasElement;
        }
      }

      // Создаем временный canvas для объединения
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');

      if (!tempCtx) return;

      // Устанавливаем размеры временного canvas
      tempCanvas.width = chartCanvas.width;
      tempCanvas.height = chartCanvas.height;

      // Рисуем основной график
      tempCtx.drawImage(chartCanvas, 0, 0);

      // Если есть overlay canvas с наложенными изображениями, рисуем их поверх
      if (overlayCanvas && overlays && overlays.length > 0) {
        // Копируем содержимое overlay canvas
        tempCtx.drawImage(overlayCanvas, 0, 0);
      }

      // Скачиваем объединенное изображение
      const link = document.createElement('a');
      link.download = 'chart.png';
      link.href = tempCanvas.toDataURL('image/png');
      link.click();
    }
  };

  const handleImportConfig = () => {
    onImport((importedConfig) => {
      // Update parameters from imported configuration
      setParams({
        network: importedConfig.network || defaultParams.network,
        poolAddress: importedConfig.poolAddress || defaultParams.poolAddress,
        duration: importedConfig.duration || defaultParams.duration,
        numBars: importedConfig.numBars || defaultParams.numBars,
        interval: normalizeIntervalKey(importedConfig.interval || defaultParams.interval)
      });
      // Update input values from imported configuration
      setInputValues({
        numBars: (importedConfig.numBars || defaultParams.numBars).toString(),
        duration: (importedConfig.duration || defaultParams.duration).toString(),
        poolAddress: importedConfig.poolAddress || defaultParams.poolAddress
      });
      // Update display name from imported configuration
      setDisplayName(importedConfig.displayName || '');
    });
  };



  const handleImageChange = (event: any) => {
    const newSelectedImage = event.target.value;
    setSelectedImage(newSelectedImage);

    // Найти описание выбранного паттерна
    const selectedOption = IMAGE_OPTIONS.find(opt => opt.value === newSelectedImage);
    if (selectedOption) {
      setPatternDescription(selectedOption.fullDesc);
    }

    // Автоматически генерировать Enhanced Chart при выборе (кроме REAL CHART)
    if (newSelectedImage && newSelectedImage !== 'real_chart' && chartData) {
      setTimeout(() => {
        handleGenerateEnhancedChart(newSelectedImage);
      }, 100);
    } else if (newSelectedImage === 'real_chart') {
      // Скрыть Enhanced Chart для REAL CHART
      setShowEnhancedChart(false);
      setEnhancedChartData(null);
    }
  };

  const handleGenerateEnhancedChart = (imageType?: string) => {
    const imageToUse = imageType || selectedImage;
    if (imageToUse) {
      let enhancedData;

      // Проверяем, является ли это паттерном (все паттерны, кроме прогнозов)
      if (imageToUse.includes('double_bottom') || imageToUse.includes('double_top') ||
        imageToUse.includes('head_shoulders') || imageToUse.includes('inverse_head_shoulders') ||
        imageToUse.includes('triangle') || imageToUse.includes('flag') ||
        imageToUse === 'pennant' || imageToUse === 'channel' ||
        imageToUse.includes('cup_handle') || imageToUse.includes('rounding') ||
        imageToUse === 'diamond' || imageToUse === 'pump_dump' ||
        imageToUse === 'dead_cat_bounce' || imageToUse === 'squeeze' ||
        imageToUse === 'breakout' || imageToUse === 'whale_manipulation' ||
        imageToUse === 'fomo_rally' || imageToUse === 'panic_sell' ||
        imageToUse === 'accumulation') {
        enhancedData = generatePatternData(imageToUse);
      } else {
        enhancedData = generateEnhancedData(imageToUse);
      }

      if (enhancedData) {
        setEnhancedChartData(enhancedData);
        setShowEnhancedChart(true);
      }
    }
  };

  // Функция для генерации данных паттернов разворота
  const generatePatternData = (imageType?: string) => {
    const patternType = imageType || selectedImage;
    const currentTime = Math.floor(Date.now() / 1000);
    const basePrice = 100; // Базовая цена для паттернов

    // Якорные уровни для старта ручки (фиксируются на первом баре ручки)
    let anchorHandleStartLevelBull: number | null = null;
    let anchorHandleStartLevelBear: number | null = null;
    // Трекинг минимума/максимума чашки
    let bullCupMinScale: number | null = null;
    let bearCupMaxScale: number | null = null;

    // Определяем временной интервал на основе выбранного Bar Duration
    const timeInterval = BAR_OPTIONS[normalizeIntervalKey(params.interval)].seconds;

    // Используем количество столбиков из параметров
    const totalBars = params.numBars;
    const patternData: number[][] = [];

    // Генерируем паттерн в зависимости от выбранного типа
    for (let i = 0; i < totalBars; i++) {
      const timestamp = currentTime - (totalBars - i) * timeInterval;
      let open, high, low, close;

      if (patternType === 'double_bottom') {
        // W-образная форма - два минимума с подъемом между ними
        const progress = i / totalBars;
        let wShape;

        if (progress < 0.25) {
          // Первый спуск
          wShape = 1.0 - (progress / 0.25) * 0.4;
        } else if (progress < 0.5) {
          // Подъем между минимумами
          wShape = 0.6 + ((progress - 0.25) / 0.25) * 0.3;
        } else if (progress < 0.75) {
          // Второй спуск
          wShape = 0.9 - ((progress - 0.5) / 0.25) * 0.4;
        } else {
          // Финальный подъем
          wShape = 0.5 + ((progress - 0.75) / 0.25) * 0.5;
        }

        const basePriceForBar = basePrice * wShape;

        // Обеспечиваем непрерывность
        if (i === 0) {
          open = basePriceForBar;
        } else {
          open = patternData[i - 1][4]; // close предыдущего столбика
        }

        close = basePriceForBar;
        high = Math.max(open, close) + Math.random() * basePrice * 0.02;
        low = Math.min(open, close) - Math.random() * basePrice * 0.02;

      } else if (patternType === 'double_top') {
        // M-образная форма - два максимума со спуском между ними
        const progress = i / totalBars;
        let mShape;

        if (progress < 0.25) {
          // Первый подъем
          mShape = 0.8 + (progress / 0.25) * 0.4;
        } else if (progress < 0.5) {
          // Спуск между максимумами
          mShape = 1.2 - ((progress - 0.25) / 0.25) * 0.3;
        } else if (progress < 0.75) {
          // Второй подъем
          mShape = 0.9 + ((progress - 0.5) / 0.25) * 0.4;
        } else {
          // Финальный спуск
          mShape = 1.3 - ((progress - 0.75) / 0.25) * 0.5;
        }

        const basePriceForBar = basePrice * mShape;

        // Обеспечиваем непрерывность
        if (i === 0) {
          open = basePriceForBar;
        } else {
          open = patternData[i - 1][4]; // close предыдущего столбика
        }

        close = basePriceForBar;
        high = Math.max(open, close) + Math.random() * basePrice * 0.02;
        low = Math.min(open, close) - Math.random() * basePrice * 0.02;

      } else if (patternType === 'head_shoulders') {
        // Голова и плечи (медвежий паттерн)
        const progress = i / totalBars;
        let hsShape;

        if (progress < 0.2) {
          // Левое плечо
          hsShape = 0.8 + (progress / 0.2) * 0.2;
        } else if (progress < 0.4) {
          // Спуск к голове
          hsShape = 1.0 - ((progress - 0.2) / 0.2) * 0.1;
        } else if (progress < 0.6) {
          // Голова (максимум)
          hsShape = 0.9 + ((progress - 0.4) / 0.2) * 0.3;
        } else if (progress < 0.8) {
          // Спуск к правому плечу
          hsShape = 1.2 - ((progress - 0.6) / 0.2) * 0.2;
        } else {
          // Правое плечо и спуск
          hsShape = 1.0 - ((progress - 0.8) / 0.2) * 0.4;
        }

        const basePriceForBar = basePrice * hsShape;

        // Обеспечиваем непрерывность
        if (i === 0) {
          open = basePriceForBar;
        } else {
          open = patternData[i - 1][4]; // close предыдущего столбика
        }

        close = basePriceForBar;
        high = Math.max(open, close) + Math.random() * basePrice * 0.02;
        low = Math.min(open, close) - Math.random() * basePrice * 0.02;

      } else if (patternType === 'inverse_head_shoulders') {
        // Перевернутая голова и плечи (бычий паттерн)
        const progress = i / totalBars;
        let ihsShape;

        if (progress < 0.2) {
          // Левое плечо (низ)
          ihsShape = 1.0 - (progress / 0.2) * 0.2;
        } else if (progress < 0.4) {
          // Подъем к голове
          ihsShape = 0.8 + ((progress - 0.2) / 0.2) * 0.1;
        } else if (progress < 0.6) {
          // Голова (минимум)
          ihsShape = 0.9 - ((progress - 0.4) / 0.2) * 0.3;
        } else if (progress < 0.8) {
          // Подъем к правому плечу
          ihsShape = 0.6 + ((progress - 0.6) / 0.2) * 0.2;
        } else {
          // Правое плечо и подъем
          ihsShape = 0.8 + ((progress - 0.8) / 0.2) * 0.4;
        }

        const basePriceForBar = basePrice * ihsShape;

        // Обеспечиваем непрерывность
        if (i === 0) {
          open = basePriceForBar;
        } else {
          open = patternData[i - 1][4]; // close предыдущего столбика
        }

        close = basePriceForBar;
        high = Math.max(open, close) + Math.random() * basePrice * 0.02;
        low = Math.min(open, close) - Math.random() * basePrice * 0.02;

      } else if (patternType === 'triangle_ascending') {
        // Восходящий треугольник
        const progress = i / totalBars;
        const triangleShape = 0.8 + (progress * 0.4);
        const basePriceForBar = basePrice * triangleShape;

        if (i === 0) {
          open = basePriceForBar;
        } else {
          open = patternData[i - 1][4];
        }

        close = basePriceForBar;
        high = Math.max(open, close) + Math.random() * basePrice * 0.02;
        low = Math.min(open, close) - Math.random() * basePrice * 0.02;

      } else if (patternType === 'triangle_descending') {
        // Нисходящий треугольник
        const progress = i / totalBars;
        const triangleShape = 1.2 - (progress * 0.4);
        const basePriceForBar = basePrice * triangleShape;

        if (i === 0) {
          open = basePriceForBar;
        } else {
          open = patternData[i - 1][4];
        }

        close = basePriceForBar;
        high = Math.max(open, close) + Math.random() * basePrice * 0.02;
        low = Math.min(open, close) - Math.random() * basePrice * 0.02;

      } else if (patternType === 'triangle_symmetric') {
        // Симметричный треугольник - сужающийся диапазон цен
        const progress = i / totalBars;

        // Создаем симметричный треугольник с сужающимися границами
        const upperBound = 1.2 - (progress * 0.4); // Верхняя граница снижается
        const lowerBound = 0.8 + (progress * 0.4); // Нижняя граница поднимается

        // Случайная цена внутри сужающегося диапазона
        const triangleShape = lowerBound + Math.random() * (upperBound - lowerBound);
        const basePriceForBar = basePrice * triangleShape;

        if (i === 0) {
          open = basePriceForBar;
        } else {
          open = patternData[i - 1][4];
        }

        close = basePriceForBar;
        high = Math.max(open, close) + Math.random() * basePrice * 0.02;
        low = Math.min(open, close) - Math.random() * basePrice * 0.02;

      } else if (patternType === 'flag_bullish') {
        // Бычий флаг - три этапа: флагшток, флаг, продолжение
        const progress = i / totalBars;
        let flagShape;

        if (progress < 0.3) {
          // Флагшток - сильный рост
          const poleProgress = progress / 0.3;
          flagShape = 0.8 + (poleProgress * 0.4);
        } else if (progress < 0.7) {
          // Флаг - консолидация с небольшими колебаниями
          const flagProgress = (progress - 0.3) / 0.4;
          const baseLevel = 1.2; // Уровень после флагштока
          const oscillation = Math.sin(flagProgress * Math.PI * 3) * 0.05;
          flagShape = baseLevel + oscillation;
        } else {
          // Продолжение роста
          const continuationProgress = (progress - 0.7) / 0.3;
          flagShape = 1.15 + (continuationProgress * 0.3);
        }

        const basePriceForBar = basePrice * flagShape;

        if (i === 0) {
          open = basePriceForBar;
        } else {
          open = patternData[i - 1][4];
        }

        close = basePriceForBar;
        high = Math.max(open, close) + Math.random() * basePrice * 0.02;
        low = Math.min(open, close) - Math.random() * basePrice * 0.02;

      } else if (patternType === 'flag_bearish') {
        // Медвежий флаг - три этапа: флагшток, флаг, продолжение падения
        const progress = i / totalBars;
        let flagShape;

        if (progress < 0.3) {
          // Флагшток - сильное падение
          const poleProgress = progress / 0.3;
          flagShape = 1.2 - (poleProgress * 0.4);
        } else if (progress < 0.7) {
          // Флаг - консолидация с небольшими колебаниями
          const flagProgress = (progress - 0.3) / 0.4;
          const baseLevel = 0.8; // Уровень после флагштока
          const oscillation = Math.sin(flagProgress * Math.PI * 3) * 0.05;
          flagShape = baseLevel + oscillation;
        } else {
          // Продолжение падения
          const continuationProgress = (progress - 0.7) / 0.3;
          flagShape = 0.85 - (continuationProgress * 0.3);
        }

        const basePriceForBar = basePrice * flagShape;

        if (i === 0) {
          open = basePriceForBar;
        } else {
          open = patternData[i - 1][4];
        }

        close = basePriceForBar;
        high = Math.max(open, close) + Math.random() * basePrice * 0.02;
        low = Math.min(open, close) - Math.random() * basePrice * 0.02;

      } else if (patternType === 'pennant') {
        // Вымпел - три этапа: флагшток, вымпел (треугольник), продолжение
        const progress = i / totalBars;
        let pennantShape;

        if (progress < 0.3) {
          // Флагшток - сильный рост
          const poleProgress = progress / 0.3;
          pennantShape = 0.8 + (poleProgress * 0.4);
        } else if (progress < 0.7) {
          // Вымпел - консолидация в форме треугольника
          const pennantProgress = (progress - 0.3) / 0.4;
          const baseLevel = 1.2; // Уровень после флагштока

          // Создаем треугольную форму с сужающимися границами
          const upperBound = 1.35 - (pennantProgress * 0.15); // Верхняя граница снижается
          const lowerBound = 1.05 + (pennantProgress * 0.15); // Нижняя граница поднимается

          // Случайная цена внутри сужающегося диапазона
          pennantShape = lowerBound + Math.random() * (upperBound - lowerBound);
        } else {
          // Продолжение роста
          const continuationProgress = (progress - 0.7) / 0.3;
          pennantShape = 1.15 + (continuationProgress * 0.3);
        }

        const basePriceForBar = basePrice * pennantShape;

        if (i === 0) {
          open = basePriceForBar;
        } else {
          open = patternData[i - 1][4];
        }

        close = basePriceForBar;
        high = Math.max(open, close) + Math.random() * basePrice * 0.02;
        low = Math.min(open, close) - Math.random() * basePrice * 0.02;

      } else if (patternType === 'channel') {
        // Канал - движение внутри параллельных границ
        const progress = i / totalBars;
        let channelShape;

        // Определяем параллельные границы канала
        const upperBound = 1.3; // Верхняя граница канала
        const lowerBound = 0.9; // Нижняя граница канала
        const channelWidth = upperBound - lowerBound;

        // Создаем движение внутри канала с небольшими колебаниями
        const baseLevel = lowerBound + (channelWidth * 0.5); // Центр канала
        const oscillation = Math.sin(progress * Math.PI * 6) * (channelWidth * 0.3); // Колебания внутри канала
        const trend = (progress - 0.5) * (channelWidth * 0.1); // Небольшой тренд

        channelShape = baseLevel + oscillation + trend;

        // Ограничиваем цену границами канала
        channelShape = Math.max(lowerBound, Math.min(upperBound, channelShape));

        const basePriceForBar = basePrice * channelShape;

        if (i === 0) {
          open = basePriceForBar;
        } else {
          open = patternData[i - 1][4];
        }

        close = basePriceForBar;
        high = Math.max(open, close) + Math.random() * basePrice * 0.02;
        low = Math.min(open, close) - Math.random() * basePrice * 0.02;

      } else if (patternType === 'cup_handle_bullish') {
        // Бычья чашка с ручкой: полукруг (чашка), малый полукруг (ручка), брейкаут вверх
        const cupBars = Math.max(6, Math.round(totalBars * 0.6));
        const handleBars = Math.max(4, Math.round(totalBars * 0.25));
        const breakoutBars = Math.max(2, totalBars - cupBars - handleBars);
        const handleStart = cupBars;
        const breakoutStart = cupBars + handleBars;

        let cupShape: number;
        if (i < cupBars) {
          // Чашка — выраженный полукруг вниз
          const t = i / Math.max(1, cupBars - 1); // 0..1
          cupShape = 1.0 - Math.sin(t * Math.PI) * 0.4;
        } else if (i < breakoutStart) {
          // Ручка — малый полукруг вниз, радиус меньше чашки, но столбики видны
          const t = (i - handleStart) / Math.max(1, handleBars - 1); // 0..1
          const baseLevel = 1.0; // стартуем от края чашки
          const amplitude = 0.15; // увеличенная амплитуда для видимости столбиков (меньше 0.4 чашки)
          const semicircle = Math.sin(t * Math.PI); // 0→1→0 - чистый полукруг
          cupShape = baseLevel - amplitude * semicircle;
        } else {
          // Брейкаут вверх — отдельная фаза после завершения полукруга ручки
          const t = (i - breakoutStart) / Math.max(1, breakoutBars - 1); // 0..1
          const handleEndLevel = 1.0; // уровень конца ручки (возврат к краю)
          const breakoutAmplitude = 0.15;
          cupShape = handleEndLevel + t * breakoutAmplitude;
        }

        const basePriceForBar = basePrice * cupShape;

        if (i === 0) {
          open = basePriceForBar;
        } else {
          open = patternData[i - 1][4];
        }

        close = basePriceForBar;
        // Снижаем шум фитилей в ручке и немного в брейкауте
        if (i >= handleStart && i < breakoutStart) {
          high = Math.max(open, close) + Math.random() * basePrice * 0.01;
          low = Math.min(open, close) - Math.random() * basePrice * 0.01;
        } else if (i >= breakoutStart) {
          high = Math.max(open, close) + Math.random() * basePrice * 0.015;
          low = Math.min(open, close) - Math.random() * basePrice * 0.015;
        } else {
          high = Math.max(open, close) + Math.random() * basePrice * 0.02;
          low = Math.min(open, close) - Math.random() * basePrice * 0.02;
        }

      } else if (patternType === 'cup_handle_bearish') {
        // Медвежья чашка с ручкой: полукруг (инвертированная чашка), малый полукруг (ручка), брейкаут вниз
        const cupBars = Math.max(6, Math.round(totalBars * 0.6));
        const handleBars = Math.max(4, Math.round(totalBars * 0.25));
        const breakoutBars = Math.max(2, totalBars - cupBars - handleBars);
        const handleStart = cupBars;
        const breakoutStart = cupBars + handleBars;

        let cupShape: number;
        if (i < cupBars) {
          // Инвертированная чашка — полукруг вверх
          const t = i / Math.max(1, cupBars - 1); // 0..1
          cupShape = 1.0 + Math.sin(t * Math.PI) * 0.4;
        } else if (i < breakoutStart) {
          // Ручка — малый полукруг вверх, радиус меньше чашки, но столбики видны
          const t = (i - handleStart) / Math.max(1, handleBars - 1); // 0..1
          const baseLevel = 1.0; // стартуем от края чашки
          const amplitude = 0.15; // увеличенная амплитуда для видимости столбиков (меньше 0.4 чашки)
          const semicircle = Math.sin(t * Math.PI); // 0→1→0 - чистый полукруг
          cupShape = baseLevel + amplitude * semicircle;
        } else {
          // Брейкаут вниз — отдельная фаза после завершения полукруга ручки
          const t = (i - breakoutStart) / Math.max(1, breakoutBars - 1); // 0..1
          const handleEndLevel = 1.0; // уровень конца ручки (возврат к краю)
          const breakoutAmplitude = 0.15;
          cupShape = handleEndLevel - t * breakoutAmplitude;
        }

        const basePriceForBar = basePrice * cupShape;

        if (i === 0) {
          open = basePriceForBar;
        } else {
          open = patternData[i - 1][4];
        }

        close = basePriceForBar;
        if (i >= handleStart && i < breakoutStart) {
          high = Math.max(open, close) + Math.random() * basePrice * 0.01;
          low = Math.min(open, close) - Math.random() * basePrice * 0.01;
        } else if (i >= breakoutStart) {
          high = Math.max(open, close) + Math.random() * basePrice * 0.015;
          low = Math.min(open, close) - Math.random() * basePrice * 0.015;
        } else {
          high = Math.max(open, close) + Math.random() * basePrice * 0.02;
          low = Math.min(open, close) - Math.random() * basePrice * 0.02;
        }
      } else if (patternType === 'rounding_bottom') {
        // Rounding Bottom: короткий downtrend, полукруг, breakout с разворотом тренда
        const downtrendBars = Math.max(3, Math.round(totalBars * 0.2));
        const roundingBars = Math.max(6, Math.round(totalBars * 0.6));
        const breakoutBars = Math.max(3, totalBars - downtrendBars - roundingBars);
        const roundingStart = downtrendBars;
        const breakoutStart = downtrendBars + roundingBars;

        let roundingShape: number;
        if (i < downtrendBars) {
          // Короткий downtrend
          const t = i / Math.max(1, downtrendBars - 1); // 0..1
          roundingShape = 1.0 - t * 0.2; // спуск с 1.0 до 0.8
        } else if (i < breakoutStart) {
          // Полукруг вниз (закругленное дно)
          const t = (i - roundingStart) / Math.max(1, roundingBars - 1); // 0..1
          const baseLevel = 0.8; // верхний уровень полукруга
          const amplitude = 0.2; // глубина полукруга вниз
          const semicircle = Math.sin(t * Math.PI); // 0→1→0
          roundingShape = baseLevel - amplitude * semicircle; // полукруг вниз
        } else {
          // Breakout и разворот тренда вверх
          const t = (i - breakoutStart) / Math.max(1, breakoutBars - 1); // 0..1
          const startLevel = 0.8; // уровень конца полукруга (возврат к базовому)
          const breakoutAmplitude = 0.3;
          roundingShape = startLevel + t * breakoutAmplitude;
        }

        const basePriceForBar = basePrice * roundingShape;

        if (i === 0) {
          open = basePriceForBar;
        } else {
          open = patternData[i - 1][4];
        }

        close = basePriceForBar;
        // Уменьшаем шум в полукруге для четкости формы
        if (i >= roundingStart && i < breakoutStart) {
          high = Math.max(open, close) + Math.random() * basePrice * 0.015;
          low = Math.min(open, close) - Math.random() * basePrice * 0.015;
        } else {
          high = Math.max(open, close) + Math.random() * basePrice * 0.02;
          low = Math.min(open, close) - Math.random() * basePrice * 0.02;
        }

      } else if (patternType === 'rounding_top') {
        // Rounding Top: короткий uptrend, полукруг вверх, breakout с разворотом тренда вниз
        const uptrendBars = Math.max(3, Math.round(totalBars * 0.2));
        const roundingBars = Math.max(6, Math.round(totalBars * 0.6));
        const breakoutBars = Math.max(3, totalBars - uptrendBars - roundingBars);
        const roundingStart = uptrendBars;
        const breakoutStart = uptrendBars + roundingBars;

        let roundingShape: number;
        if (i < uptrendBars) {
          // Короткий uptrend
          const t = i / Math.max(1, uptrendBars - 1); // 0..1
          roundingShape = 1.0 + t * 0.2; // подъем с 1.0 до 1.2
        } else if (i < breakoutStart) {
          // Полукруг вверх (закругленная вершина)
          const t = (i - roundingStart) / Math.max(1, roundingBars - 1); // 0..1
          const baseLevel = 1.2; // нижний уровень полукруга
          const amplitude = 0.2; // высота полукруга вверх
          const semicircle = Math.sin(t * Math.PI); // 0→1→0
          roundingShape = baseLevel + amplitude * semicircle; // полукруг вверх
        } else {
          // Breakout и разворот тренда вниз
          const t = (i - breakoutStart) / Math.max(1, breakoutBars - 1); // 0..1
          const startLevel = 1.2; // уровень конца полукруга (возврат к базовому)
          const breakoutAmplitude = 0.3;
          roundingShape = startLevel - t * breakoutAmplitude;
        }

        const basePriceForBar = basePrice * roundingShape;

        if (i === 0) {
          open = basePriceForBar;
        } else {
          open = patternData[i - 1][4];
        }

        close = basePriceForBar;
        // Уменьшаем шум в полукруге для четкости формы
        if (i >= roundingStart && i < breakoutStart) {
          high = Math.max(open, close) + Math.random() * basePrice * 0.015;
          low = Math.min(open, close) - Math.random() * basePrice * 0.015;
        } else {
          high = Math.max(open, close) + Math.random() * basePrice * 0.02;
          low = Math.min(open, close) - Math.random() * basePrice * 0.02;
        }

      } else if (patternType === 'diamond') {
        // Diamond: uptrend, увеличивающаяся волатильность, уменьшающаяся волатильность, bearish
        const uptrendBars = Math.max(3, Math.round(totalBars * 0.2));
        const expandingBars = Math.max(4, Math.round(totalBars * 0.3));
        const contractingBars = Math.max(4, Math.round(totalBars * 0.3));
        const bearishBars = Math.max(3, totalBars - uptrendBars - expandingBars - contractingBars);

        const expandingStart = uptrendBars;
        const contractingStart = uptrendBars + expandingBars;
        const bearishStart = uptrendBars + expandingBars + contractingBars;

        let diamondShape: number;
        let volatilityMultiplier = 1.0;

        if (i < uptrendBars) {
          // Uptrend - линейный рост
          const t = i / Math.max(1, uptrendBars - 1); // 0..1
          diamondShape = 1.0 + t * 0.25; // рост с 1.0 до 1.25
          volatilityMultiplier = 1.0; // обычная волатильность
        } else if (i < contractingStart) {
          // Увеличивающаяся волатильность - расширяющийся треугольник
          const t = (i - expandingStart) / Math.max(1, expandingBars - 1); // 0..1
          const baseLevel = 1.25; // держимся на уровне конца uptrend
          const maxAmplitude = 0.2; // максимальная амплитуда колебаний
          const amplitude = maxAmplitude * t; // постепенно увеличивающаяся амплитуда
          const oscillation = Math.sin(t * Math.PI * 6) * amplitude; // частые колебания
          diamondShape = baseLevel + oscillation;
          volatilityMultiplier = 1.0 + t * 1.0; // волатильность увеличивается до 2x
        } else if (i < bearishStart) {
          // Уменьшающаяся волатильность - сужающийся треугольник
          const t = (i - contractingStart) / Math.max(1, contractingBars - 1); // 0..1
          const baseLevel = 1.25; // держимся на том же уровне
          const startAmplitude = 0.2;
          const amplitude = startAmplitude * (1 - t); // уменьшающаяся амплитуда
          const oscillation = Math.sin(t * Math.PI * 6) * amplitude;
          diamondShape = baseLevel + oscillation;
          volatilityMultiplier = 2.0 - t * 1.0; // волатильность уменьшается с 2x до 1x
        } else {
          // Bearish trend - линейное падение
          const t = (i - bearishStart) / Math.max(1, bearishBars - 1); // 0..1
          diamondShape = 1.25 - t * 0.35; // падение с 1.25 до 0.9
          volatilityMultiplier = 1.0; // обычная волатильность
        }

        const basePriceForBar = basePrice * diamondShape;

        if (i === 0) {
          open = basePriceForBar;
        } else {
          open = patternData[i - 1][4];
        }

        close = basePriceForBar;
        // Динамическая волатильность в зависимости от фазы
        const baseVolatility = 0.02;
        high = Math.max(open, close) + Math.random() * basePrice * baseVolatility * volatilityMultiplier;
        low = Math.min(open, close) - Math.random() * basePrice * baseVolatility * volatilityMultiplier;

      } else if (patternType === 'pump_dump') {
        // Pump & Dump - 4 интервала: pump, hype, dump, crash
        const progress = i / totalBars;
        let pumpShape;

        if (progress < 0.25) {
          // 1. Pump - резкий рост
          const pumpProgress = progress / 0.25;
          pumpShape = 1.0 + (pumpProgress * 0.8); // рост с 1.0 до 1.8
        } else if (progress < 0.5) {
          // 2. Hype - быстрый рост до пика с колебаниями
          const hypeProgress = (progress - 0.25) / 0.25;
          const startLevel = 1.8; // уровень после pump
          const endLevel = 2.2; // пик hype
          const growth = startLevel + (hypeProgress * (endLevel - startLevel)); // рост с 1.8 до 2.2
          const oscillation = Math.sin(hypeProgress * Math.PI * 4) * 0.15; // быстрые колебания
          pumpShape = growth + oscillation;
        } else if (progress < 0.75) {
          // 3. Dump - начало падения
          const dumpProgress = (progress - 0.5) / 0.25;
          const startLevel = 2.2; // уровень после hype (новый пик)
          pumpShape = startLevel - (dumpProgress * 0.8); // падение с 2.2 до 1.4
        } else {
          // 4. Crash - обвал
          const crashProgress = (progress - 0.75) / 0.25;
          const startLevel = 1.4; // уровень после dump
          // Используем экспоненциальную функцию для более быстрого падения
          const crashIntensity = Math.pow(crashProgress, 0.4); // усиленное ускорение падения
          pumpShape = startLevel - (crashIntensity * 1.0); // обвал с 1.4 до 0.4
        }

        const basePriceForBar = basePrice * pumpShape;

        if (i === 0) {
          open = basePriceForBar;
        } else {
          open = patternData[i - 1][4];
        }

        close = basePriceForBar;

        // Разная волатильность для каждого интервала pump_dump
        let volatility;
        if (progress < 0.25) {
          // PUMP - низкая волатильность, четкий рост
          volatility = 0.015;
        } else if (progress < 0.5) {
          // HYPE - высокая волатильность, сильные колебания
          volatility = 0.035;
        } else if (progress < 0.75) {
          // DUMP - средняя волатильность, умеренные колебания
          volatility = 0.025;
        } else {
          // CRASH - низкая волатильность, четкое падение
          volatility = 0.02;
        }

        high = Math.max(open, close) + Math.random() * basePrice * volatility;
        low = Math.min(open, close) - Math.random() * basePrice * volatility;

      } else if (patternType === 'dead_cat_bounce') {
        // Dead Cat Bounce
        const progress = i / totalBars;
        let bounceShape;

        if (progress < 0.2) {
          // Падение - нелинейное с ускорением
          const dropProgress = progress / 0.2;
          const dropIntensity = Math.pow(dropProgress, 1.2); // ускорение падения
          bounceShape = 1.0 - (dropIntensity * 0.5);
        } else if (progress < 0.4) {
          // Отскок - параболическая форма с колебаниями
          const bounceProgress = (progress - 0.2) / 0.2;
          const baseLevel = 0.5; // уровень после падения
          const bounceAmplitude = 0.3; // амплитуда отскока

          // Параболическая форма отскока (0→1→0)
          const parabola = 4 * bounceProgress * (1 - bounceProgress);
          // Добавляем небольшие колебания
          const oscillation = Math.sin(bounceProgress * Math.PI * 3) * 0.05;

          bounceShape = baseLevel + (parabola * bounceAmplitude) + oscillation;
        } else {
          // Продолжение падения - нелинейное с отскоками
          const fallProgress = (progress - 0.4) / 0.6;
          const startLevel = 0.8; // уровень после отскока

          // Основное падение с нелинейным ускорением
          const fallIntensity = Math.pow(fallProgress, 1.1);
          const mainDrop = fallIntensity * 0.6;

          // Добавляем небольшие отскоки во время падения
          const bounce = Math.sin(fallProgress * Math.PI * 2) * 0.08;

          bounceShape = startLevel - mainDrop + bounce;
        }

        const basePriceForBar = basePrice * bounceShape;

        if (i === 0) {
          open = basePriceForBar;
        } else {
          open = patternData[i - 1][4];
        }

        close = basePriceForBar;
        high = Math.max(open, close) + Math.random() * basePrice * 0.02;
        low = Math.min(open, close) - Math.random() * basePrice * 0.02;

      } else if (patternType === 'squeeze') {
        // Squeeze - 3 интервала: синусоида с уменьшением амплитуды, провал, резкий рост
        const progress = i / totalBars;
        let squeezeShape;

        if (progress < 0.6) {
          // 1. Синусоида с уменьшением амплитуды
          const squeezeProgress = progress / 0.6;
          const baseLevel = 1.0;
          const startAmplitude = 0.15;
          const endAmplitude = 0.02;
          // Уменьшающаяся амплитуда
          const currentAmplitude = startAmplitude - (squeezeProgress * (startAmplitude - endAmplitude));
          // Увеличивающаяся частота для большего сжатия
          const frequency = 4 + (squeezeProgress * 4); // от 4 до 8
          squeezeShape = baseLevel + Math.sin(squeezeProgress * Math.PI * frequency) * currentAmplitude;
        } else if (progress < 0.75) {
          // 2. Провал вниз (короче)
          const dropProgress = (progress - 0.6) / 0.15;
          const startLevel = 1.0; // уровень после синусоиды
          const dropIntensity = Math.pow(dropProgress, 1.5); // ускоренное падение
          squeezeShape = startLevel - (dropIntensity * 0.3); // провал с 1.0 до 0.7
        } else {
          // 3. Резкий рост (сильнее)
          const riseProgress = (progress - 0.75) / 0.25;
          const startLevel = 0.7; // уровень после провала
          const riseIntensity = Math.pow(riseProgress, 0.6); // еще более быстрый рост
          squeezeShape = startLevel + (riseIntensity * 0.8); // рост с 0.7 до 1.5
        }

        const basePriceForBar = basePrice * squeezeShape;

        if (i === 0) {
          open = basePriceForBar;
        } else {
          open = patternData[i - 1][4];
        }

        close = basePriceForBar;

        // Разная волатильность для каждого интервала
        let volatility;
        if (progress < 0.6) {
          // Синусоида - средняя волатильность
          volatility = 0.02;
        } else if (progress < 0.75) {
          // Провал - низкая волатильность
          volatility = 0.015;
        } else {
          // Рост - высокая волатильность
          volatility = 0.03;
        }

        high = Math.max(open, close) + Math.random() * basePrice * volatility;
        low = Math.min(open, close) - Math.random() * basePrice * volatility;

      } else if (patternType === 'breakout') {
        // Breakout
        const progress = i / totalBars;
        let breakoutShape;

        if (progress < 0.8) {
          // 1. Три экспоненциальных пика с одинаковой амплитудой
          const consolidationProgress = progress / 0.8;
          const baseLevel = 1.0;
          const amplitude = 0.16;

          // Создаем три цикла роста-пика-падения
          let cycleShape = 0;

          if (consolidationProgress < 0.33) {
            // Первый цикл: рост, пик, падение
            const cycle1Progress = consolidationProgress / 0.33;
            if (cycle1Progress < 0.5) {
              // Рост до пика
              cycleShape = (cycle1Progress * 2) * amplitude;
            } else {
              // Падение от пика
              cycleShape = ((1 - (cycle1Progress - 0.5) * 2)) * amplitude;
            }
          } else if (consolidationProgress < 0.67) {
            // Второй цикл: рост, пик, падение
            const cycle2Progress = (consolidationProgress - 0.33) / 0.34;
            if (cycle2Progress < 0.5) {
              // Рост до пика
              cycleShape = (cycle2Progress * 2) * amplitude;
            } else {
              // Падение от пика
              cycleShape = ((1 - (cycle2Progress - 0.5) * 2)) * amplitude;
            }
          } else {
            // Третий цикл: рост, пик, затем сразу рост к прорыву
            const cycle3Progress = (consolidationProgress - 0.67) / 0.33;
            if (cycle3Progress < 0.5) {
              // Рост до пика
              cycleShape = (cycle3Progress * 2) * amplitude;
            } else {
              // После пика сразу рост к прорыву (вместо падения)
              const riseProgress = (cycle3Progress - 0.5) / 0.5;
              cycleShape = amplitude + (riseProgress * 0.2); // рост с пика до +0.2
            }
          }

          breakoutShape = baseLevel + cycleShape;
        } else {
          // 2. Прорыв и резкий рост
          const breakoutProgress = (progress - 0.8) / 0.2;
          const startLevel = 1.36; // уровень после роста третьего цикла (1.0 + 0.16 + 0.2)
          const endLevel = 1.6; // целевой уровень роста

          // Экспоненциальный рост для эффекта "взрыва"
          const growthIntensity = Math.pow(breakoutProgress, 0.6);
          breakoutShape = startLevel + (growthIntensity * (endLevel - startLevel));
        }

        const basePriceForBar = basePrice * breakoutShape;

        if (i === 0) {
          open = basePriceForBar;
        } else {
          open = patternData[i - 1][4];
        }

        close = basePriceForBar;

        // Разная волатильность для каждого интервала breakout
        let volatility;
        if (progress < 0.8) {
          // Консолидация - низкая волатильность
          volatility = 0.015;
        } else {
          // Прорыв - высокая волатильность
          volatility = 0.035;
        }

        high = Math.max(open, close) + Math.random() * basePrice * volatility;
        low = Math.min(open, close) - Math.random() * basePrice * volatility;

      } else if (patternType === 'whale_manipulation') {
        // Whale Manipulation
        const progress = i / totalBars;
        const whaleShape = 1.0 + Math.sin(progress * Math.PI * 3) * 0.3;
        const basePriceForBar = basePrice * whaleShape;

        if (i === 0) {
          open = basePriceForBar;
        } else {
          open = patternData[i - 1][4];
        }

        close = basePriceForBar;
        high = Math.max(open, close) + Math.random() * basePrice * 0.02;
        low = Math.min(open, close) - Math.random() * basePrice * 0.02;

      } else if (patternType === 'fomo_rally') {
        // FOMO Rally
        const progress = i / totalBars;
        const fomoShape = 1.0 + (progress * 0.8);
        const basePriceForBar = basePrice * fomoShape;

        if (i === 0) {
          open = basePriceForBar;
        } else {
          open = patternData[i - 1][4];
        }

        close = basePriceForBar;
        high = Math.max(open, close) + Math.random() * basePrice * 0.02;
        low = Math.min(open, close) - Math.random() * basePrice * 0.02;

      } else if (patternType === 'panic_sell') {
        // Panic Sell
        const progress = i / totalBars;
        const panicShape = 1.0 - (progress * 0.6);
        const basePriceForBar = basePrice * panicShape;

        if (i === 0) {
          open = basePriceForBar;
        } else {
          open = patternData[i - 1][4];
        }

        close = basePriceForBar;
        high = Math.max(open, close) + Math.random() * basePrice * 0.02;
        low = Math.min(open, close) - Math.random() * basePrice * 0.02;

      } else if (patternType === 'accumulation') {
        // Accumulation
        const progress = i / totalBars;
        const accumShape = 0.9 + Math.sin(progress * Math.PI * 4) * 0.15;
        const basePriceForBar = basePrice * accumShape;

        if (i === 0) {
          open = basePriceForBar;
        } else {
          open = patternData[i - 1][4];
        }

        close = basePriceForBar;
        high = Math.max(open, close) + Math.random() * basePrice * 0.02;
        low = Math.min(open, close) - Math.random() * basePrice * 0.02;
      }

      // Защита от нулевой или очень короткой высоты столбиков
      const minBodySize = basePrice * 0.005; // минимум 0.5% от базовой цены
      if (Math.abs(close - open) < minBodySize) {
        // Если тело слишком маленькое, увеличиваем его до минимального размера
        const direction = close >= open ? 1 : -1;
        const midPoint = (open + close) / 2;
        open = midPoint - (minBodySize / 2) * direction;
        close = midPoint + (minBodySize / 2) * direction;
      }

      // Убеждаемся что high >= max(open, close) и low <= min(open, close)
      high = Math.max(high, Math.max(open, close));
      low = Math.min(low, Math.min(open, close));

      patternData.push([timestamp, open, high, low, close]);
    }

    return patternData;
  };

  // Функция для создания расширенных данных с прогнозом (с учетом типа bullish)
  const generateEnhancedData = (imageType?: string) => {
    if (!chartData || chartData.length === 0) return null;

    const forecastType = imageType || selectedImage;
    const currentTime = Math.floor(Date.now() / 1000);
    const currentPrice = chartData[chartData.length - 1][4]; // Последняя цена закрытия

    // Определяем процент изменения в зависимости от типа
    let growthPercentage = 30; // По умолчанию 30% для bullish_30
    let isBearish = false;

    if (forecastType === 'bullish_50') {
      growthPercentage = 50; // 50% для bullish_50
    } else if (forecastType === 'super_bullish') {
      growthPercentage = 100; // 100% для super bullish
    } else if (forecastType === 'rocket') {
      growthPercentage = 500; // 500% для rocket
    } else if (forecastType === 'bearish_30') {
      growthPercentage = 30; // -30% для bearish_30
      isBearish = true;
    } else if (forecastType === 'bearish_50') {
      growthPercentage = 50; // -50% для bearish_50
      isBearish = true;
    } else if (forecastType === 'rug_pull') {
      growthPercentage = 90; // -90% для rug pull
      isBearish = true;
    } else if (forecastType === 'ultra_rug_pull') {
      growthPercentage = 98; // -98% для ultra rug pull
      isBearish = true;
    }

    const targetPrice = isBearish
      ? currentPrice * (1 - growthPercentage / 100)
      : currentPrice * (1 + growthPercentage / 100);

    // Количество дополнительных столбиков (10% от текущих)
    const additionalBars = Math.ceil(chartData.length * 0.1);

    // Определяем временной интервал на основе выбранного Bar Duration
    const timeInterval = BAR_OPTIONS[normalizeIntervalKey(params.interval)].seconds;

    const enhancedData = [...chartData];

    // Добавляем прогнозные данные
    let previousClose = currentPrice; // Начинаем с закрытия последнего реального столбика

    // Рассчитываем общий рост/падение
    const totalGrowth = targetPrice - currentPrice;

    // Создаем массив случайных долей для каждого столбика
    const randomFractions: number[] = [];
    for (let i = 0; i < additionalBars; i++) {
      randomFractions.push(Math.random());
    }

    // Нормализуем доли, чтобы их сумма была равна 1
    const sumFractions = randomFractions.reduce((sum, fraction) => sum + fraction, 0);
    const normalizedFractions = randomFractions.map(fraction => fraction / sumFractions);

    for (let i = 0; i < additionalBars; i++) {
      const timestamp = currentTime + (i + 1) * timeInterval;

      // Рассчитываем рост для текущего столбика
      const currentGrowth = totalGrowth * normalizedFractions[i];

      let open, close;

      if (i === 0) {
        // Первый столбик: открытие точно от закрытия последнего реального
        open = previousClose;
        close = open + currentGrowth;
      } else {
        // Остальные столбики: открытие от закрытия предыдущего
        open = previousClose;
        close = open + currentGrowth;
      }

      // High и Low с небольшими случайными колебаниями
      const priceRange = Math.abs(close - open) * 0.1;
      let high = Math.max(open, close) + Math.random() * priceRange;
      let low = Math.min(open, close) - Math.random() * priceRange;

      // Защита от нулевой или очень короткой высоты столбиков
      const minBodySize = currentPrice * 0.005; // минимум 0.5% от текущей цены
      if (Math.abs(close - open) < minBodySize) {
        // Если тело слишком маленькое, увеличиваем его до минимального размера
        const direction = close >= open ? 1 : -1;
        const midPoint = (open + close) / 2;
        open = midPoint - (minBodySize / 2) * direction;
        close = midPoint + (minBodySize / 2) * direction;
      }

      // Убеждаемся что high >= max(open, close) и low <= min(open, close)
      high = Math.max(high, Math.max(open, close));
      low = Math.min(low, Math.min(open, close));

      enhancedData.push([timestamp, open, high, low, close]);
      previousClose = close; // Обновляем для следующего столбика
    }

    return enhancedData;
  };





  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Generate Chart
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
        <Box sx={{
          width: { xs: '100%', md: isAdmin ? '66%' : '48%' },
          display: 'flex',
          gap: 2,
          alignItems: 'stretch'
        }}>
          <Button
            variant="contained"
            color="primary"
            onClick={handleTrendingOpen}
            startIcon={<TrendingUpIcon />}
            sx={{
              minWidth: 'auto',
              px: 2,
              fontSize: '0.9rem',
              fontWeight: 'bold',
              whiteSpace: 'nowrap'
            }}
          >
            SELECT TOKEN
          </Button>
          <TextField
            label="Display Name"
            placeholder="Tryan"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            sx={{ minWidth: 200, flex: 1 }}
          />
          <FormControl sx={{
            minWidth: 160,
            flex: 1,
            display: isAdmin ? 'flex' : 'none'
          }}>
            <InputLabel>Network</InputLabel>
            <Select
              value={params.network}
              label="Network"
              onChange={(e) => handleParamChange('network', e.target.value)}
            >
              {networks.map((network) => (
                <MenuItem key={network.id} value={network.id}>
                  {network.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
        <Box sx={{
          width: { xs: '100%', md: '32%' },
          display: isAdmin ? 'block' : 'none'
        }}>
          <TextField
            fullWidth
            label="Pool Address"
            value={inputValues.poolAddress}
            onChange={(e) => handleInputChange('poolAddress', e.target.value)}
          />
        </Box>
        <Box sx={{
          width: { xs: '100%', md: '32%' },
          display: isAdmin ? 'block' : 'none'
        }}>
          <TextField
            fullWidth
            type="number"
            label="Autoposting interval (hours)"
            value={inputValues.duration}
            onChange={(e) => handleInputChange('duration', e.target.value)}
          />
        </Box>
        <Box sx={{ width: { xs: '100%', md: isAdmin ? '32%' : '10%' } }}>
          <TextField
            fullWidth
            type="number"
            label="Number of Bars"
            value={inputValues.numBars}
            onChange={(e) => handleInputChange('numBars', e.target.value)}
            inputProps={{ min: 5 }}
          />
        </Box>
        <Box sx={{ width: { xs: '100%', md: isAdmin ? '32%' : '10%' } }}>
          <FormControl fullWidth>
            <InputLabel>Bar Duration</InputLabel>
            <Select
              value={normalizeIntervalKey(params.interval)}
              label="Bar Duration"
              onChange={(e) => handleParamChange('interval', e.target.value)}
            >
              {Object.entries(BAR_OPTIONS).map(([key, opt]) => (
                <MenuItem key={key} value={key}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
        {isAdmin && (
          <>
            <Box sx={{ width: { xs: '100%', md: '16%' } }}>
              <TextField
                fullWidth
                type="number"
                label="Hours Offset"
                value={timeOffset.hours}
                onChange={(e) => setTimeOffset(prev => ({ ...prev, hours: e.target.value }))}
                inputProps={{ min: 0 }}
                helperText="Subtract hours from current time"
              />
            </Box>
            <Box sx={{ width: { xs: '100%', md: '16%' } }}>
              <TextField
                fullWidth
                type="number"
                label="Minutes Offset"
                value={timeOffset.minutes}
                onChange={(e) => setTimeOffset(prev => ({ ...prev, minutes: e.target.value }))}
                inputProps={{ min: 0, max: 59 }}
                helperText="Subtract minutes from current time"
              />
            </Box>
          </>
        )}
      </Box>

      <Box sx={{
        display: 'flex',
        gap: 2,
        justifyContent: 'center',
        mb: 2,
        flexWrap: 'wrap',
        '& > button': {
          minWidth: '200px',
          margin: '4px'
        }
      }}>
        <Button
          variant="contained"
          color="primary"
          onClick={generateChart}
          disabled={loading}
        >
          {loading ? 'Generating...' : 'Generate Chart'}
        </Button>
        <Button
          variant="contained"
          onClick={handleDownloadPNG}
          disabled={!isGenerated || loading}
        >
          Download PNG
        </Button>

        {isAdmin && (
          <>
            <Button
              variant="contained"
              onClick={handleExport}
            >
              Export Configuration
            </Button>
            <Button
              variant="contained"
              onClick={handleImportConfig}
            >
              Import Configuration
            </Button>
          </>
        )}
      </Box>

      {error && (
        <Typography color="error" sx={{ mt: 2 }}>
          {error}
        </Typography>
      )}

      {chartData && (
        <Box sx={{ mt: 4 }}>
          {/* Адаптивная структура: для десктопа - бок о бок, для мобильных - вертикально */}
          <Box sx={{
            display: 'flex',
            flexDirection: { xs: 'column', lg: 'row' },
            gap: 3
          }}>
            {/* Основной блок с графиком */}
            <Box sx={{
              flex: { xs: 'none', lg: 1 },
              minWidth: 0 // Предотвращает переполнение
            }}>
              {/* Выпадающий список с картинками */}
              <Box sx={{ mb: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <FormControl sx={{ minWidth: 200 }}>
                    <InputLabel>Chart Type</InputLabel>
                    <Select
                      value={selectedImage}
                      label="Chart Type"
                      onChange={handleImageChange}
                      renderValue={(selected) => {
                        const option = IMAGE_OPTIONS.find(opt => opt.value === selected);
                        return option ? (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <img
                              src={option.image}
                              alt={option.label}
                              style={{ width: '32px', height: '32px', objectFit: 'contain' }}
                            />
                            <span>{option.label}</span>
                          </Box>
                        ) : 'Select Chart Type';
                      }}
                    >
                      {Object.entries(
                        IMAGE_OPTIONS.reduce((groups, option) => {
                          const group = option.group || 'Other';
                          if (!groups[group]) groups[group] = [];
                          groups[group].push(option);
                          return groups;
                        }, {} as Record<string, typeof IMAGE_OPTIONS>)
                      ).map(([groupName, options]) => [
                        <ListSubheader key={groupName} sx={{
                          fontWeight: 'bold',
                          backgroundColor: '#2c3e50',
                          color: '#ffffff',
                          fontSize: '14px',
                          padding: '8px 16px'
                        }}>
                          {groupName}
                        </ListSubheader>,
                        ...options.map((option) => (
                          <MenuItem
                            key={option.value}
                            value={option.value}
                            title={option.shortDesc}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <img
                                src={option.image}
                                alt={option.label}
                                style={{ width: '64px', height: '64px', objectFit: 'contain' }}
                              />
                              <span>{option.label}</span>
                            </Box>
                          </MenuItem>
                        ))
                      ]).flat()}
                    </Select>
                  </FormControl>
                </Box>

                {/* Описание выбранного паттерна */}
                {patternDescription && selectedImage !== 'real_chart' && (
                  <Box sx={{
                    p: 2,
                    backgroundColor: 'rgba(0, 0, 0, 0.05)',
                    borderRadius: 1,
                    border: '1px solid rgba(0, 0, 0, 0.1)'
                  }}>
                    <Typography variant="h6" color="text.secondary" sx={{ fontSize: '1.2rem' }}>
                      <strong>Pattern Description:</strong> {patternDescription}
                    </Typography>
                  </Box>
                )}
              </Box>

              {/* График - показывается обычный или Enhanced в зависимости от выбора */}
              {selectedImage === 'real_chart' ? (
                <ChartPreview
                  config={{ ...config, displayName: getEffectiveDisplayName() }}
                  data={chartData}
                  tokenInfo={tokenInfo}
                  interval={params.interval}
                  id="generated-chart"
                  tokenName={getEffectiveDisplayName()}
                  isEnhanced={false}
                  overlays={overlays}
                  onOverlaysChange={setOverlays}
                  selectedOverlayId={selectedOverlayId}
                  onSelectOverlay={setSelectedOverlayId}
                  ref={chartPreviewRef}
                />
              ) : (
                showEnhancedChart && enhancedChartData && (
                  <ChartPreview
                    config={{
                      ...config,
                      displayName: getEffectiveDisplayName(),
                      verticalLine: selectedImage.includes('double_bottom') || selectedImage.includes('double_top') ||
                        selectedImage.includes('head_shoulders') || selectedImage.includes('inverse_head_shoulders') ||
                        selectedImage.includes('triangle') || selectedImage.includes('flag') ||
                        selectedImage === 'pennant' || selectedImage === 'channel' ||
                        selectedImage.includes('cup_handle') || selectedImage.includes('rounding') ||
                        selectedImage === 'diamond' || selectedImage === 'pump_dump' ||
                        selectedImage === 'dead_cat_bounce' || selectedImage === 'squeeze' ||
                        selectedImage === 'breakout' || selectedImage === 'whale_manipulation' ||
                        selectedImage === 'fomo_rally' || selectedImage === 'panic_sell' ||
                        selectedImage === 'accumulation' ?
                        undefined : {
                          active: true,
                          position: chartData.length - 0.06,
                          style: 'dashed' as const,
                          color: '#ffffe0',
                          width: 2
                        },
                      display: {
                        ...config.display
                        // Use original config settings for showTimeline and showPriceChange
                      }
                    }}
                    data={enhancedChartData}
                    tokenInfo={tokenInfo ? {
                      ...tokenInfo,
                      priceUsd: tokenInfo.priceUsd * (
                        selectedImage === 'rocket' ? 6 :
                          selectedImage === 'super_bullish' ? 2 :
                            selectedImage === 'bullish_50' ? 1.5 :
                              selectedImage === 'bullish_30' ? 1.3 :
                                selectedImage === 'ultra_rug_pull' ? 0.02 :
                                  selectedImage === 'rug_pull' ? 0.1 :
                                    selectedImage === 'bearish_50' ? 0.5 :
                                      selectedImage === 'bearish_30' ? 0.7 : 1
                      ),
                      priceChange: {
                        ...tokenInfo.priceChange,
                        '24h': tokenInfo.priceChange['24h'] + (
                          selectedImage === 'rocket' ? 500 :
                            selectedImage === 'super_bullish' ? 100 :
                              selectedImage === 'bullish_50' ? 50 :
                                selectedImage === 'bullish_30' ? 30 :
                                  selectedImage === 'ultra_rug_pull' ? -98 :
                                    selectedImage === 'rug_pull' ? -90 :
                                      selectedImage === 'bearish_50' ? -50 :
                                        selectedImage === 'bearish_30' ? -30 : 0
                        )
                      }
                    } : null}
                    interval={params.interval}
                    id="enhanced-chart"
                    tokenName={selectedImage.includes('double_bottom') || selectedImage.includes('double_top') ||
                      selectedImage.includes('head_shoulders') || selectedImage.includes('inverse_head_shoulders') ||
                      selectedImage.includes('triangle') || selectedImage.includes('flag') ||
                      selectedImage === 'pennant' || selectedImage === 'channel' ||
                      selectedImage.includes('cup_handle') || selectedImage.includes('rounding') ||
                      selectedImage === 'diamond' || selectedImage === 'pump_dump' ||
                      selectedImage === 'dead_cat_bounce' || selectedImage === 'squeeze' ||
                      selectedImage === 'breakout' || selectedImage === 'whale_manipulation' ||
                      selectedImage === 'fomo_rally' || selectedImage === 'panic_sell' ||
                      selectedImage === 'accumulation' ?
                      'Pattern Chart' : `${getEffectiveDisplayName()} (Enhanced)`}
                    isEnhanced={selectedImage.includes('bullish') || selectedImage.includes('bearish') || selectedImage === 'rug_pull' || selectedImage === 'rocket' || selectedImage === 'ultra_rug_pull'}
                    overlays={overlays}
                    onOverlaysChange={setOverlays}
                    selectedOverlayId={selectedOverlayId}
                    onSelectOverlay={setSelectedOverlayId}
                    ref={chartPreviewRef}
                  />
                )
              )}
            </Box>

            {/* Блок Additional Graphics - справа для десктопа, снизу для мобильных */}
            <Box sx={{
              flex: { xs: 'none', lg: '0 0 400px' }, // Фиксированная ширина для десктопа
              maxWidth: { xs: '100%', lg: '400px' },
              minHeight: { xs: 'auto', lg: '600px' }
            }}>
              <AdditionalGraphics
                onImageSelect={handleAdditionalImageSelect}
                selectedImage={selectedAdditionalImage}
              />
            </Box>
          </Box>
        </Box>
      )}



      {/* Pools dialog with tabs */}
      <Dialog
        open={trendingDialogOpen}
        onClose={handleTrendingClose}
        aria-labelledby="pools-dialog-title"
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle id="pools-dialog-title">
          Pool Selection
          <IconButton
            aria-label="close"
            onClick={handleTrendingClose}
            sx={{
              position: 'absolute',
              right: 8,
              top: 8,
            }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 0 }}>
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs
              value={activeTab}
              onChange={handleTabChange}
              aria-label="pool selection tabs"
              variant="fullWidth"
            >
              <Tab label="TOP" value="top" />
              <Tab label="TRENDING" value="trending" />
              <Tab label="SEARCH" value="search" />
            </Tabs>
          </Box>
          <Box sx={{ p: 2 }}>
            {activeTab === 'top' && (
              <Box>
                <Typography variant="subtitle1" sx={{ mb: 2 }}>
                  Select network to view top pools
                </Typography>
                <Box sx={{
                  display: 'flex',
                  gap: 2,
                  alignItems: 'center',
                  mb: 3,
                  flexWrap: 'wrap'
                }}>
                  <FormControl sx={{ minWidth: 200 }}>
                    <InputLabel>Network</InputLabel>
                    <Select
                      value={selectedTopNetwork}
                      label="Network"
                      onChange={(e) => setSelectedTopNetwork(e.target.value)}
                    >
                      {networks.map((network) => (
                        <MenuItem key={network.id} value={network.id}>
                          {network.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={handleGetTopPools}
                    disabled={topLoading}
                    sx={{ px: 3, py: 1.5 }}
                  >
                    {topLoading ? 'Loading...' : 'GET'}
                  </Button>
                </Box>
                {renderPoolsTable(topPools, topLoading, topError)}
              </Box>
            )}
            {activeTab === 'trending' && (
              <Box>
                <Typography variant="subtitle1" sx={{ mb: 2 }}>
                  Trending pools across all networks
                </Typography>
                <Box sx={{ mb: 3 }}>
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={loadTrendingPools}
                    disabled={trendingLoading}
                    sx={{ px: 3, py: 1.5 }}
                  >
                    {trendingLoading ? 'Loading...' : 'GET TRENDING'}
                  </Button>
                </Box>
                {renderPoolsTable(trendingPools, trendingLoading, trendingError)}
              </Box>
            )}
            {activeTab === 'search' && (
              <Box>
                <Typography variant="subtitle1" sx={{ mb: 2 }}>
                  Search pools by token name (symbol), pool address or token address
                </Typography>
                <Box sx={{
                  display: 'flex',
                  gap: 2,
                  alignItems: 'center',
                  mb: 3,
                  flexWrap: 'wrap'
                }}>
                  <TextField
                    label="Token Name (symbol), Pool Address or Token Address"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="e.g. TRYAN, BTC, ETH"
                    sx={{ minWidth: 200, flex: 1 }}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleSearchPools();
                      }
                    }}
                  />
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={handleSearchPools}
                    disabled={searchLoading}
                    sx={{ px: 3, py: 1.5 }}
                  >
                    {searchLoading ? 'Searching...' : 'SEARCH'}
                  </Button>
                </Box>
                <Box sx={{
                  display: 'flex',
                  gap: 2,
                  alignItems: 'center',
                  mb: 3,
                  flexWrap: 'wrap'
                }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={networkSelectEnabled}
                        onChange={(e) => setNetworkSelectEnabled(e.target.checked)}
                      />
                    }
                    label="Network Select"
                  />
                  <FormControl sx={{ minWidth: 200 }} disabled={!networkSelectEnabled}>
                    <InputLabel>Network</InputLabel>
                    <Select
                      value={selectedSearchNetwork}
                      label="Network"
                      onChange={(e) => setSelectedSearchNetwork(e.target.value)}
                    >
                      {networks.map((network) => (
                        <MenuItem key={network.id} value={network.id}>
                          {network.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>
                {renderPoolsTable(searchPools, searchLoading, searchError)}
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleTrendingClose} variant="outlined">
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Sign Text Editor Dialog */}
      {pendingSignImage && (
        <SignTextEditor
          open={signEditorOpen}
          onClose={handleSignEditorClose}
          onConfirm={handleSignEditorConfirm}
          imagePath={`${process.env.NODE_ENV === 'production' ? window.location.origin : 'http://localhost:3002'}${pendingSignImage.path}`}
          imageName={pendingSignImage.name}
          category={pendingSignImage.class}
        />
      )}

    </Box>
  );
};

export default ChartGenerator; 