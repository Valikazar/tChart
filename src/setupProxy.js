const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  console.log('Setting up proxy middleware for React development server');
  
  // Proxy API requests to the backend server
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://localhost:3002',
      changeOrigin: true,
    })
  );
}; 