import React from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Paper, Typography } from '@mui/material';

const Web3Profile: React.FC = () => {
  return (
    <Paper sx={{ p: 3, maxWidth: 400, margin: '0 auto', mt: 4 }}>
      <Typography variant="h5" gutterBottom>
        Web3 Profile
      </Typography>
      <ConnectButton
        showBalance={true}
        accountStatus={{
          smallScreen: 'avatar',
          largeScreen: 'full',
        }}
        chainStatus={{
          smallScreen: 'icon',
          largeScreen: 'full',
        }}
        label="Connect Wallet"
      />
    </Paper>
  );
};

export default Web3Profile; 