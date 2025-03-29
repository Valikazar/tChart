import React, { useState, useEffect } from 'react';
import { Box, Container, Grid, Accordion, AccordionSummary, AccordionDetails, Typography } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import AdaptiveChartContainer from '../components/AdaptiveChartContainer';

// Пример конфигурации графика (замените на вашу реальную конфигурацию)
const defaultConfig = {
  background: {
    color: '#0C0E16',
    image: null
  },
  font: {
    family: 'Arial',
    size: 20,
    color: '#FFFFFF'
  },
  upBar: {
    color: '#00FF00',
    lineColor: '#00FF00',
    lineWidth: 1,
    borderColor: '#22FF22',
    borderWidth: 1,
    borderStyle: 'outside',
    body: null
  },
  downBar: {
    color: '#FF0000',
    lineColor: '#FF0000',
    lineWidth: 1,
    borderColor: '#FF2222',
    borderWidth: 1,
    borderStyle: 'outside',
    body: null
  },
  candle: null,
  knife: null,
  display: {
    showTokenName: true,
    showMarketCap: true,
    showPrice: true,
    showPriceChange: false,
    showMinMax: true,
    showTimeline: true
  }
};

// Пример данных OHLCV (замените на ваши реальные данные)
const generateSampleData = () => {
  const data = [];
  const now = Math.floor(Date.now() / 1000);
  const hourInSeconds = 3600;
  
  let price = 1000 + Math.random() * 200;
  
  for (let i = 0; i < 20; i++) {
    const timestamp = now - (20 - i) * hourInSeconds;
    const open = price;
    const change = (Math.random() - 0.5) * 50;
    price += change;
    const close = price;
    const high = Math.max(open, close) + Math.random() * 20;
    const low = Math.min(open, close) - Math.random() * 20;
    const volume = Math.floor(Math.random() * 10000) + 5000;
    
    data.push([timestamp, open, high, low, close, volume]);
  }
  
  return data;
};

// Пример информации о токене
const tokenInfo = {
  name: 'Example Token',
  marketCap: 5200000,
  priceUsd: 0.00012345,
  priceChange: {
    '5m': 1.23,
    '1h': -0.5,
    '6h': 2.34,
    '24h': 5.67
  }
};

/**
 * Example of using the adaptive component for charts
 */
const AdaptiveChartExample: React.FC = () => {
  const [chartData, setChartData] = useState<any[]>([]);
  
  // Загружаем данные при монтировании компонента
  useEffect(() => {
    setChartData(generateSampleData());
  }, []);
  
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>
        Пример адаптивных графиков
      </Typography>
      
      <Grid container spacing={3}>
        {/* Верхний график, занимающий всю ширину */}
        <Grid item xs={12}>
          <Typography variant="h6" gutterBottom>
            Верхний график (адаптивный)
          </Typography>
          <Box 
            sx={{ 
              border: '1px solid #ddd', 
              borderRadius: 1, 
              p: 1,
              mb: 3,
              width: '100%'
            }}
          >
            <AdaptiveChartContainer
              config={defaultConfig}
              data={chartData}
              tokenInfo={tokenInfo}
              preserveAspectRatio={true}
              minHeight={400}
              showDownloadButton={true}
            />
          </Box>
        </Grid>
        
        {/* Аккордионы с содержимым */}
        <Grid item xs={12}>
          <Box sx={{ mb: 3 }}>
            {[1, 2, 3].map((item) => (
              <Accordion key={item}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography>Раздел {item}</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Typography>
                    Lorem ipsum dolor sit amet, consectetur adipiscing elit. Suspendisse
                    malesuada lacus ex, sit amet blandit leo lobortis eget.
                  </Typography>
                </AccordionDetails>
              </Accordion>
            ))}
          </Box>
        </Grid>
        
        {/* Нижний график */}
        <Grid item xs={12}>
          <Typography variant="h6" gutterBottom>
            Нижний график (тоже адаптивный)
          </Typography>
          <Box 
            sx={{ 
              border: '1px solid #ddd', 
              borderRadius: 1, 
              p: 1,
              width: '100%'
            }}
          >
            <AdaptiveChartContainer
              config={defaultConfig}
              data={chartData}
              tokenInfo={tokenInfo}
              preserveAspectRatio={true}
              minHeight={400}
              showDownloadButton={true}
            />
          </Box>
        </Grid>
      </Grid>
    </Container>
  );
};

export default AdaptiveChartExample; 