import React from 'react';
import { WagmiConfig, createConfig, http } from 'wagmi';
import { polygon, mainnet, polygonAmoy } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { getDefaultWallets, RainbowKitProvider } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';

const { connectors } = getDefaultWallets({
  appName: 'tChart Constructor',
  projectId: '687afc513cc1863648304e19c502ecbb',
});

const wagmiConfig = createConfig({
  connectors,
  chains: [polygon, mainnet, polygonAmoy],
  transports: {
    [polygon.id]: http('https://polygon-rpc.com'),
    [mainnet.id]: http('https://cloudflare-eth.com'),
    [polygonAmoy.id]: http('https://rpc-amoy.polygon.technology'),
  },
  ssr: false,
});

const queryClient = new QueryClient();

interface Web3ProviderProps {
  children: React.ReactNode;
}

const Web3Provider: React.FC<Web3ProviderProps> = ({ children }) => {
  return (
    <WagmiConfig config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiConfig>
  );
};

export default Web3Provider;


