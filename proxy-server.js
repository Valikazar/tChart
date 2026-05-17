const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');

const app = express();
const PORT = 3001;

// Enable CORS for all routes
app.use(cors());

// Proxy for Rarible API
app.use('/api/rarible', createProxyMiddleware({
  target: 'https://api.rarible.org',
  changeOrigin: true,
  pathRewrite: {
    '^/api/rarible': ''
  },
  onError: (err, req, res) => {
    console.log('Rarible proxy error:', err);
    res.status(500).json({ error: 'Rarible API proxy error' });
  }
}));

// Proxy for OpenSea API
app.use('/api/opensea', createProxyMiddleware({
  target: 'https://api.opensea.io',
  changeOrigin: true,
  pathRewrite: {
    '^/api/opensea': ''
  },
  onError: (err, req, res) => {
    console.log('OpenSea proxy error:', err);
    res.status(500).json({ error: 'OpenSea API proxy error' });
  }
}));

// Proxy for Moralis API
app.use('/api/moralis', createProxyMiddleware({
  target: 'https://deep-index.moralis.io',
  changeOrigin: true,
  pathRewrite: {
    '^/api/moralis': ''
  },
  onError: (err, req, res) => {
    console.log('Moralis proxy error:', err);
    res.status(500).json({ error: 'Moralis API proxy error' });
  }
}));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Proxy server is running' });
});

app.listen(PORT, () => {
  console.log(`Proxy server running on http://localhost:${PORT}`);
  console.log('Available endpoints:');
  console.log(`  - http://localhost:${PORT}/api/rarible`);
  console.log(`  - http://localhost:${PORT}/api/opensea`);
  console.log(`  - http://localhost:${PORT}/api/moralis`);
});

