import React, { useState, useEffect } from 'react';
import { Container, Typography, Box, Button, CircularProgress, Alert, Paper, Link, Divider } from '@mui/material';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract, useChainId, useSwitchChain } from 'wagmi';
import { formatEther } from 'viem';
import { polygonAmoy } from 'wagmi/chains';
import PageHeader from './PageHeader';
import ContractArtifact from '../abi/tChartXYZ.json';

// Address from deployment
const CONTRACT_ADDRESS = "0xDc9ACf48589D228DBD09f596F7F2cff0AF6427cF";

const NFTPage: React.FC = () => {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const [isMinting, setIsMinting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [activeNftId, setActiveNftId] = useState<number | null>(() => {
    const saved = localStorage.getItem('pendingNftId');
    return saved ? parseInt(saved) : null;
  });
  const [mintedNft, setMintedNft] = useState<{ name: string; image: string } | null>(null);

  // Sync activeNftId to localStorage
  useEffect(() => {
    if (activeNftId !== null) {
      localStorage.setItem('pendingNftId', activeNftId.toString());
    } else {
      localStorage.removeItem('pendingNftId');
    }
  }, [activeNftId]);

  // Helper to convert ipfs:// to gateway URL
  const getGatewayUrl = (ipfsUri: string) => {
    if (!ipfsUri) return "";
    const hash = ipfsUri.replace("ipfs://", "");
    return `https://gateway.pinata.cloud/ipfs/${hash}`;
  };

  // Автоматическое переключение сети при входе на вкладку
  useEffect(() => {
    if (isConnected && chainId !== polygonAmoy.id && switchChain) {
      console.log(`Switching to ${polygonAmoy.name}...`);
      switchChain({ chainId: polygonAmoy.id });
    }
  }, [isConnected, chainId, switchChain]);

  // Чтение цены из контракта
  const { data: mintPrice, isError: isReadError } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: ContractArtifact.abi,
    functionName: 'mintPriceNative',
  });

  // Хук для записи в контракт
  const { writeContract, data: hash, error: writeError, isPending: isWritePending } = useWriteContract();

  // Ожидание транзакции
  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash });

  const handleMint = async () => {
    if (!address) return;
    setIsMinting(true);
    setApiError(null);
    setSuccessMsg(null);

    try {
      // 1. Получаем подпись от API сервера
      console.log("Requesting signature for:", address);
      const response = await fetch('/api/nft/sign-mint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userAddress: address })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Server signing failed');
      }

      const { tokenURI, nonce, signature, nftId } = data;
      console.log("Got signature:", { tokenURI, nonce, nftId });
      setActiveNftId(nftId);

      // 2. Отправляем транзакцию
      writeContract({
        address: CONTRACT_ADDRESS,
        abi: ContractArtifact.abi,
        functionName: 'mintWithNative',
        args: [tokenURI, nonce, signature],
        value: mintPrice ? BigInt(mintPrice.toString()) : 0n,
        gas: 300000n, // Manually set gas limit to avoid Amoy estimation issues
        maxPriorityFeePerGas: 30000000000n, // 30 Gwei - meets Amoy's minimum requirement
        maxFeePerGas: 50000000000n // 50 Gwei
      });

      // Note: isMinting set to false when writeContract succeeds or fails via effects, 
      // but strictly writeContract is async void, so we rely on status flags.

    } catch (err: any) {
      console.error(err);
      setApiError(err.message || "Minting process failed");
      setIsMinting(false);
    }
  };

  // Effect to stop loading spinner if user rejects wallet or error occurs
  useEffect(() => {
    if (writeError) {
      setIsMinting(false);
    }
  }, [writeError]);

  // Effect on success
  useEffect(() => {
    console.log("🔄 [NFT] Confirmation State:", { isConfirmed, activeNftId, hash, successMsg });

    // Only run if confirmed AND we have an ID AND we haven't shown success yet
    if (isConfirmed && activeNftId !== null && !successMsg) {
      const finalize = async () => {
        console.log(`🏁 [NFT] Transaction confirmed for ID: ${activeNftId}. Finalising on server...`);
        try {
          const response = await fetch('/api/nft/confirm-mint', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nftId: activeNftId, txHash: hash })
          });
          const confirmationData = await response.json();
          console.log("🏁 [NFT] Server confirmation response:", confirmationData);

          if (confirmationData.success && confirmationData.tokenURI) {
            console.log("🖼️ [NFT] Fetching metadata from:", confirmationData.tokenURI);
            try {
              const metaRes = await fetch(getGatewayUrl(confirmationData.tokenURI));
              const metadata = await metaRes.json();
              console.log("💎 [NFT] Metadata loaded:", metadata);
              setMintedNft({
                name: metadata.name,
                image: getGatewayUrl(metadata.image)
              });
            } catch (metaErr) {
              console.error("❌ [NFT] Failed to fetch metadata:", metaErr);
            }
          }

          setIsMinting(false);
          setSuccessMsg("NFT Successfully Minted!");
          // Clear the pending ID after successful finalization
          setActiveNftId(null);
        } catch (e) {
          console.error("❌ [NFT] Finalization failed:", e);
          setIsMinting(false);
        }
      };
      finalize();
    }
  }, [isConfirmed, activeNftId, hash, successMsg]);

  return (
    <Container maxWidth="xl" sx={{ transform: { lg: 'scale(0.8)', md: 'none', xs: 'none' }, transformOrigin: 'top center' }}>
      <PageHeader />
      <Divider sx={{ my: 1 }} />

      <Box sx={{ py: 4 }}>
        <Typography variant="h3" align="center" gutterBottom sx={{ fontWeight: 'bold', mb: 4 }}>
          Mint tChart NFT
        </Typography>

        <Paper elevation={3} sx={{ p: { xs: 2, sm: 5 }, borderRadius: 4, maxWidth: 600, mx: 'auto', textAlign: 'center' }}>
          <Box
            sx={{
              width: '100%',
              aspectRatio: '1 / 1',
              bgcolor: '#1a1a1a',
              borderRadius: 2,
              mb: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              position: 'relative'
            }}
          >
            <img
              src={mintedNft ? mintedNft.image : "/mystery_box.png"}
              alt={mintedNft ? mintedNft.name : "Mystery NFT"}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                opacity: 1, // Full opacity for the beautiful box
                transition: 'all 0.5s ease-in-out'
              }}
              onError={(e) => {
                console.error("🖼️ [NFT] Image failed to load:", e.currentTarget.src);
                e.currentTarget.style.display = 'none';
              }}
            />
            {mintedNft && (
              <Box sx={{
                position: 'absolute',
                bottom: 0,
                width: '100%',
                bgcolor: 'rgba(0,0,0,0.7)',
                py: 1,
                backdropFilter: 'blur(4px)'
              }}>
                <Typography variant="subtitle1" sx={{ color: 'white', fontWeight: 'bold' }}>
                  {mintedNft.name}
                </Typography>
              </Box>
            )}
          </Box>

          <Typography variant="h4" gutterBottom>
            {mintPrice !== undefined
              ? (Number(mintPrice) === 0 ? "FREE" : `${formatEther(mintPrice as bigint)} POL`)
              : "Loading..."}
          </Typography>

          <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
            Get your unique tChart configuration NFT. Only on Polygon Amoy.
          </Typography>

          {!isConnected ? (
            <Alert severity="warning" sx={{ justifyContent: 'center' }}>
              Please connect your wallet (top right button) to mint.
            </Alert>
          ) : chainId !== polygonAmoy.id ? (
            <Box>
              <Alert severity="error" sx={{ mb: 2, justifyContent: 'center' }}>
                Wrong Network! Please switch to Polygon Amoy.
              </Alert>
              <Button
                variant="outlined"
                onClick={() => switchChain?.({ chainId: polygonAmoy.id })}
                sx={{ borderRadius: 50 }}
              >
                Switch to Amoy
              </Button>
            </Box>
          ) : (
            <Button
              variant="contained"
              size="large"
              onClick={handleMint}
              disabled={isMinting || isWritePending || isConfirming}
              sx={{
                py: 1.5,
                px: 6,
                fontSize: '1.2rem',
                borderRadius: 50,
                textTransform: 'none',
                boxShadow: '0 4px 14px 0 rgba(0,118,255,0.39)'
              }}
            >
              {isMinting || isWritePending ? <CircularProgress size={24} color="inherit" /> :
                isConfirming ? "Confirming..." : "Mint Now"}
            </Button>
          )}

          <Box sx={{ mt: 3, minHeight: 60 }}>
            {apiError && (
              <Alert severity="warning" sx={{ mt: 1 }}>
                {apiError === 'No NFTs available to mint'
                  ? "All currently available NFTs are reserved. Please wait 10 minutes or try again later."
                  : apiError}
              </Alert>
            )}

            {writeError && (
              <Alert severity="error" sx={{ '& .MuiAlert-message': { width: '100%' } }}>
                <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                  Wallet Error: {writeError.message.split('\n')[0]}
                </Typography>
                <Typography variant="caption" display="block" sx={{ mt: 1, color: 'text.secondary' }}>
                  Pro tip: If "Internal JSON-RPC error" persists, try to <b>Reset Account</b> in MetaMask (Settings → Advanced → Clear activity tab data).
                </Typography>
                <Box component="pre" sx={{
                  fontSize: '0.65rem',
                  mt: 1,
                  whiteSpace: 'pre-wrap',
                  maxHeight: 150,
                  overflow: 'auto',
                  bgcolor: 'rgba(0,0,0,0.2)',
                  p: 1,
                  borderRadius: 1,
                  textAlign: 'left'
                }}>
                  {JSON.stringify(writeError, (key, value) => typeof value === 'bigint' ? value.toString() : value, 2)}
                </Box>
              </Alert>
            )}

            {hash && (
              <Alert severity="info" sx={{ mt: 1, wordBreak: 'break-all' }}>
                Tx Sent: <Link href={`https://amoy.polygonscan.com/tx/${hash}`} target="_blank">{hash}</Link>
              </Alert>
            )}

            {successMsg && (
              <Alert severity="success" sx={{ mt: 1 }}>
                {successMsg}
              </Alert>
            )}
          </Box>
        </Paper>

        <Box sx={{ mt: 4, pt: 2, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <Typography variant="overline" sx={{ color: 'text.disabled', mb: 1, display: 'block' }}>
            Debug & Verification Tools (Amoy Testnet)
          </Typography>

          <Box sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
            gap: 2,
            textAlign: 'left'
          }}>
            <Link
              href={`https://testnet.rarible.com/collection/polygon/${CONTRACT_ADDRESS}/items`}
              target="_blank"
              sx={{ color: 'primary.main', textDecoration: 'none', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 1 }}
            >
              🖼️ Rarible Marketplace
            </Link>

            <Link
              href={`https://www.okx.com/web3/marketplace/nft/collection/amoy/${CONTRACT_ADDRESS}`}
              target="_blank"
              sx={{ color: 'primary.main', textDecoration: 'none', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 1 }}
            >
              💎 OKX Marketplace
            </Link>

            <Link
              href={`https://www.oklink.com/amoy/address/${CONTRACT_ADDRESS}`}
              target="_blank"
              sx={{ color: 'primary.main', textDecoration: 'none', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 1 }}
            >
              🔗 OKLink Explorer (Stable)
            </Link>

            <Link
              href={`https://amoy.polygonscan.com/address/${CONTRACT_ADDRESS}`}
              target="_blank"
              sx={{ color: 'primary.main', textDecoration: 'none', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 1 }}
            >
              🔍 Polygonscan Contract
            </Link>
          </Box>

          <Typography variant="caption" sx={{ mt: 2, display: 'block', color: 'text.secondary', fontStyle: 'italic', lineHeight: 1.4 }}>
            Note: Amoy testnet indexers (Rarible/OKX) may take 5-15 minutes to show new NFTs.
            Use OKLink or Polygonscan for instant blockchain verification.
          </Typography>
        </Box>

        <Typography variant="caption" display="block" align="center" sx={{ mt: 3, color: 'text.disabled', opacity: 0.5 }}>
          Contract: {CONTRACT_ADDRESS}
        </Typography>
      </Box>
    </Container>
  );
};

export default NFTPage;
