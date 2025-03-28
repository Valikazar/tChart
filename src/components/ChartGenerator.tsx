import React, { useState, useEffect } from 'react';
import { Box, Grid, TextField, Select, MenuItem, Button, FormControl, InputLabel, Typography } from '@mui/material';
import { Network, ChartGeneratorParams, TokenInfo, ChartConfig } from '../types';
import ChartPreview from './ChartPreview';
import { generateData } from '../utils/dataGenerator';

interface ChartGeneratorProps {
  config: ChartConfig;
  onExport: (params: { network: string; poolAddress: string; duration: number; numBars: number; interval: string }) => void;
  onImport: (onImportComplete: (config: ChartConfig) => void) => void;
}

const intervals = {
  'minute': '5M',
  'hour': '1H',
  'day': '1D'
};

const defaultParams: ChartGeneratorParams = {
  network: 'polygon_pos',
  poolAddress: '0xa030be97a53d6462c675962fec3eafbe53b8bb6c',
  duration: 24,
  numBars: 20,
  interval: 'hour'
};

const ChartGenerator: React.FC<ChartGeneratorProps> = ({ config, onExport, onImport }) => {
  const [networks, setNetworks] = useState<Network[]>([]);
  const [params, setParams] = useState<ChartGeneratorParams>(defaultParams);
  const [chartData, setChartData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [data, setData] = useState<any[]>([]);
  const [isGenerated, setIsGenerated] = useState(false);

  // Загружаем список сетей при монтировании
  useEffect(() => {
    const fetchNetworks = async () => {
      try {
        const response = await fetch('https://api.geckoterminal.com/api/v2/networks');
        if (!response.ok) throw new Error('Failed to fetch networks');
        const data = await response.json();
        const networksList = data.data
          .map((network: any) => ({
            id: network.id,
            name: network.attributes.name
          }))
          .sort((a: Network, b: Network) => a.name.localeCompare(b.name));
        
        setNetworks(networksList);
        // Устанавливаем Polygon POS как сеть по умолчанию после загрузки списка
        const polygonNetwork = networksList.find(n => n.id === 'polygon_pos');
        if (polygonNetwork) {
          setParams(prev => ({ ...prev, network: polygonNetwork.id }));
        }
      } catch (err) {
        console.error('Failed to load networks:', err);
        setError('Failed to load networks');
      }
    };

    fetchNetworks();
  }, []);

  const handleParamChange = (param: keyof ChartGeneratorParams, value: string | number) => {
    setParams(prev => ({
      ...prev,
      [param]: typeof value === 'string' && param === 'numBars' ? parseInt(value) || 20 : value
    }));
  };

  const generateChart = async () => {
    setLoading(true);
    setError(null);
    try {
      // Получаем данные графика
      let response;
      try {
        response = await fetch(
          `https://api.geckoterminal.com/api/v2/networks/${params.network}/pools/${params.poolAddress}/ohlcv/${params.interval}`,
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

      const ohlcvList = data.data.attributes.ohlcv_list
        .sort((a, b) => a[0] - b[0])
        .map((item: any[]) => [
          item[0],
          parseFloat(item[1]),
          parseFloat(item[2]),
          parseFloat(item[3]),
          parseFloat(item[4]),
          parseFloat(item[5])
        ])
        .slice(-params.numBars);
      setChartData(ohlcvList);
      setIsGenerated(true);

      // Получаем информацию о токене
      await fetchTokenInfo(params.poolAddress);
    } catch (err) {
      console.error('Chart generation error:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate chart');
      setIsGenerated(false);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    onExport(params);
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
        setTokenInfo({
          marketCap: parseFloat(pool.fdv_usd) || 0,
          priceUsd: parseFloat(pool.base_token_price_usd) || 0,
          priceChange: {
            '5m': parseFloat(pool.price_change_percentage?.m5) || 0,
            '1h': parseFloat(pool.price_change_percentage?.h1) || 0,
            '6h': parseFloat(pool.price_change_percentage?.h6) || 0,
            '24h': parseFloat(pool.price_change_percentage?.h24) || 0
          },
          name: tokenName
        });
      } else {
        console.error('No pool data found:', data);
        throw new Error('No pool data found');
      }
    } catch (err) {
      console.error('Token info error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch token info');
    }
  };

  const handleGenerate = () => {
    const newData = generateData(20);
    setData(newData);
    setIsGenerated(true);
  };

  const handleDownloadPNG = () => {
    if (!chartData) return;
    
    const chartCanvas = document.getElementById('generated-chart') as HTMLCanvasElement;
    if (chartCanvas) {
      const link = document.createElement('a');
      link.download = 'chart.png';
      link.href = chartCanvas.toDataURL('image/png');
      link.click();
    }
  };

  const handleImportConfig = () => {
    onImport((importedConfig) => {
      // Обновляем параметры из импортированной конфигурации
      setParams({
        network: importedConfig.network || defaultParams.network,
        poolAddress: importedConfig.poolAddress || defaultParams.poolAddress,
        duration: importedConfig.duration || defaultParams.duration,
        numBars: importedConfig.numBars || defaultParams.numBars,
        interval: importedConfig.interval || defaultParams.interval
      });
    });
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Generate Chart
      </Typography>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <FormControl fullWidth>
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
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Pool Address"
            value={params.poolAddress}
            onChange={(e) => handleParamChange('poolAddress', e.target.value)}
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <TextField
            fullWidth
            type="number"
            label="Duration (hours)"
            value={params.duration}
            onChange={(e) => handleParamChange('duration', parseInt(e.target.value))}
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <TextField
            fullWidth
            type="number"
            label="Number of Bars"
            value={params.numBars}
            onChange={(e) => handleParamChange('numBars', parseInt(e.target.value))}
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <FormControl fullWidth>
            <InputLabel>Interval</InputLabel>
            <Select
              value={params.interval}
              label="Interval"
              onChange={(e) => handleParamChange('interval', e.target.value)}
            >
              {Object.entries(intervals).map(([value, label]) => (
                <MenuItem key={value} value={value}>
                  {label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
      </Grid>

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
      </Box>

      {error && (
        <Typography color="error" sx={{ mt: 2 }}>
          {error}
        </Typography>
      )}

      {chartData && (
        <Box sx={{ mt: 4 }}>
          <ChartPreview 
            config={config} 
            data={chartData}
            tokenInfo={tokenInfo}
            interval={params.interval}
            id="generated-chart"
            tokenName={params.poolAddress.split('/')[0]}
          />
        </Box>
      )}
    </Box>
  );
};

export default ChartGenerator; 