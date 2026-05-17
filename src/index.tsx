import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import theme from './theme';

// Ленивая загрузка тяжелых компонентов и Web3 провайдера
console.log('🚀 [CLIENT] React app initialization started');
console.log('⏱️  [CLIENT] Loading core modules...');
const coreLoadStart = performance.now();

const App = lazy(() => {
  console.log('⏱️  [CLIENT] Loading App component...');
  return import('./App');
});

const NFTPage = lazy(() => {
  console.log('⏱️  [CLIENT] Loading NFTPage...');
  return import('./components/NFTPage');
});

const Web3Provider = lazy(() => {
  console.log('⏱️  [CLIENT] Loading Web3Provider (Wagmi, RainbowKit)...');
  return import('./components/Web3Provider');
});

console.log(`✅ [CLIENT] Core modules loaded in ${(performance.now() - coreLoadStart).toFixed(2)}ms`);

// Компонент загрузки
const LoadingScreen = () => (
  <div style={{
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    backgroundColor: '#121212',
    color: '#fff',
    fontFamily: 'Arial, sans-serif',
    fontSize: '18px'
  }}>
    <div>
      <div style={{ marginBottom: '20px', textAlign: 'center' }}>⏳ Loading...</div>
    </div>
  </div>
);

console.log('⏱️  [CLIENT] Creating React root...');
const rootStartTime = performance.now();
const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
console.log(`✅ [CLIENT] React root created in ${(performance.now() - rootStartTime).toFixed(2)}ms`);

console.log('⏱️  [CLIENT] Starting React render...');
const renderStartTime = performance.now();
root.render(
  <React.StrictMode>
    <Suspense fallback={<LoadingScreen />}>
      <Web3Provider>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <Router>
            <Routes>
              <Route path="/" element={<App />} />
              <Route path="/nft" element={<NFTPage />} />
            </Routes>
          </Router>
        </ThemeProvider>
      </Web3Provider>
    </Suspense>
  </React.StrictMode>
);
console.log(`✅ [CLIENT] React render started in ${(performance.now() - renderStartTime).toFixed(2)}ms`);
console.log(`🎉 [CLIENT] Initial bundle loaded in ${performance.now().toFixed(2)}ms`); 