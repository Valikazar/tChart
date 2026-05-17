import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  FormControlLabel
} from '@mui/material';

interface SignTextEditorProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (imageWithText: string) => void;
  imagePath: string;
  imageName: string;
  category: string;
}

const SignTextEditor: React.FC<SignTextEditorProps> = ({
  open,
  onClose,
  onConfirm,
  imagePath,
  imageName,
  category
}) => {
  const [text, setText] = useState('');
  const [textColor, setTextColor] = useState('#000000');
  const [fontFamily, setFontFamily] = useState('Arial');
  const [loading, setLoading] = useState(true);
  const [maskError, setMaskError] = useState(false);
  const [showMask, setShowMask] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const maskRef = useRef<HTMLImageElement | null>(null);

  // List of available fonts (from main application - Text Settings)
  const availableFonts = [
    'Arial',
    'Rich Eatin', 
    'Computer Speak',
    'Idealist Sans',
    'Komi',
    'Blogger Sans',
    'CRYSTAL',
    'GetVoIP Grotesque',
    'ROBOTECH GP',
    'Anita Semi-square',
    'Garoa Hacker Clube',
    'Anarchy Sans',
    'Keenton',
    'Audiowide',
    'Glitch Goblin',
    'Gridtile',
    'Harry P',
    'Home Video',
    'LIBRARY 3 AM',
    'Lofty Goals',
    'MatrixType',
    'Minecraft',
    'Mountain King',
    'New Walt Disney UI',
    'Pixelated Elegance',
    'Procrastinating Pixie',
    'Roblox Font',
    'RO twimch',
    'Ryga',
    'Sparky Stones',
    'Star Jedi Hollow',
    'Super Crafty',
    'Super Funky',
    'Super Mystery',
    'Super Shiny',
    'Taurus Mono Outline',
    'Wkwk',
    'X Company'
  ];

  // Load image and mask
  useEffect(() => {
    if (!open) return;

    setLoading(true);
    setMaskError(false);

    const loadImages = async () => {
      try {
        // Load main image
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = imagePath;
        await new Promise((resolve, reject) => {
          img.onload = () => {
            console.log('Main image loaded:', img.width, 'x', img.height);
            resolve(true);
          };
          img.onerror = (err) => {
            console.error('Error loading main image:', err);
            reject(err);
          };
        });
        imageRef.current = img;

        // Load mask
        const baseUrl = process.env.NODE_ENV === 'production' 
          ? window.location.origin 
          : 'http://localhost:3002';
        const mask = new Image();
        mask.crossOrigin = 'anonymous';
        mask.src = `${baseUrl}/api/image-mask/${category}/${imageName}`;
        
        let maskLoaded = false;
        await new Promise((resolve) => {
          mask.onload = () => {
            console.log('Mask loaded:', mask.width, 'x', mask.height);
            if (mask.width > 0 && mask.height > 0) {
              maskLoaded = true;
              maskRef.current = mask;
            } else {
              console.warn('Mask has invalid dimensions');
              setMaskError(true);
            }
            resolve(true);
          };
          mask.onerror = () => {
            console.warn('Mask not found, will use full image area');
            setMaskError(true);
            resolve(true);
          };
        });

        setLoading(false);
        // Small delay before rendering to allow canvas to initialize
        setTimeout(() => {
          renderCanvas();
        }, 100);
      } catch (error) {
        console.error('Error loading images:', error);
        setLoading(false);
      }
    };

    loadImages();
  }, [open, imagePath, imageName, category]);

  // Redraw canvas when text, color, font or mask mode changes
  useEffect(() => {
    if (!loading && imageRef.current) {
      renderCanvas();
    }
  }, [text, textColor, fontFamily, showMask, loading]);

  // Function to display mask on canvas
  const renderMaskCanvas = () => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    const mask = maskRef.current;
    
    if (!canvas || !img || img.width === 0 || img.height === 0) {
      console.warn('Canvas или изображение не готовы или не полностью загружены');
      return;
    }
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = img.width;
    canvas.height = img.height;
    
    if (showMask && mask && mask.width > 0 && mask.height > 0) {
      // Show mask
      ctx.drawImage(mask, 0, 0);
    } else {
      // Show main image
      ctx.drawImage(img, 0, 0);
    }
  };

  // Check: text should not overlap non-white areas of mask (brightness tolerance 30)
  const isTextWithinWhiteMask = (
    fontSize: number,
    lines: string[],
    textArea: { x: number; y: number; width: number; height: number }
  ): boolean => {
    if (!maskRef.current) return true; // если маски нет — считаем, что всё ок

    const mask = maskRef.current;
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return true;

    tempCanvas.width = mask.width;
    tempCanvas.height = mask.height;
    if (tempCanvas.width === 0 || tempCanvas.height === 0) return true;

    tempCtx.drawImage(mask, 0, 0);
    const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
    const pixels = imageData.data;

    tempCtx.font = `bold ${fontSize}px "${fontFamily}"`;

    const lineHeight = fontSize * 1.2;
    const totalHeight = lines.length * lineHeight;
    const startY = textArea.y + (textArea.height - totalHeight) / 2 + lineHeight / 2;

    // Sampling step for speed (more frequent for accuracy)
    const step = Math.max(1, Math.floor(fontSize / 16));
    const whiteTolerance = 20; // reduced brightness tolerance
    const requiredWhiteRatio = 0.98; // increased required ratio of white pixels in text area

    for (let index = 0; index < lines.length; index++) {
      const line = lines[index];
      const y = startY + index * lineHeight;
      const x = textArea.x + textArea.width / 2;

      const metrics = tempCtx.measureText(line);
      const textWidth = metrics.width;
      const textHeight = fontSize * 1.2;

      const padding = Math.max(2, Math.floor(fontSize * 0.08)); // increased padding
      const startX = Math.max(0, Math.floor(x - textWidth / 2 - padding));
      const endX = Math.min(tempCanvas.width, Math.ceil(x + textWidth / 2 + padding));
      const startYpx = Math.max(0, Math.floor(y - textHeight / 2 - padding));
      const endYpx = Math.min(tempCanvas.height, Math.ceil(y + textHeight / 2 + padding));

      let totalSamples = 0;
      let whiteSamples = 0;

      for (let py = startYpx; py < endYpx; py += step) {
        for (let px = startX; px < endX; px += step) {
          const idx = (py * tempCanvas.width + px) * 4;
          const r = pixels[idx];
          const g = pixels[idx + 1];
          const b = pixels[idx + 2];
          const alpha = pixels[idx + 3];

          totalSamples++;

          // Allow only white (with tolerance) and non-transparent mask area
          const isWhite = alpha > 128 && r >= 255 - whiteTolerance && g >= 255 - whiteTolerance && b >= 255 - whiteTolerance;
          if (isWhite) whiteSamples++;
        }
      }

      const whiteRatio = totalSamples > 0 ? whiteSamples / totalSamples : 0;
      if (whiteRatio < requiredWhiteRatio) return false;
    }

    return true;
  };

  // Function to get text area bounds from mask
  const getTextBounds = (): { x: number; y: number; width: number; height: number } | null => {
    if (!maskRef.current) return null;

    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return null;

    tempCanvas.width = maskRef.current.width;
    tempCanvas.height = maskRef.current.height;
    
    // Проверяем, что размеры валидные
    if (tempCanvas.width === 0 || tempCanvas.height === 0) {
      console.warn('Mask has invalid dimensions:', tempCanvas.width, tempCanvas.height);
      return null;
    }
    
    tempCtx.drawImage(maskRef.current, 0, 0);

    const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
    const pixels = imageData.data;

    let minX = tempCanvas.width;
    let minY = tempCanvas.height;
    let maxX = 0;
    let maxY = 0;

    // Ищем непрозрачные пиксели в маске
    for (let y = 0; y < tempCanvas.height; y++) {
      for (let x = 0; x < tempCanvas.width; x++) {
        const idx = (y * tempCanvas.width + x) * 4;
        const alpha = pixels[idx + 3];
        
        if (alpha > 128) { // Порог прозрачности
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (maxX > minX && maxY > minY) {
      return {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY
      };
    }

    return null;
  };

  // Render canvas with text
  const renderCanvas = () => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) {
      console.warn('Canvas or image not ready');
      return;
    }

    // Check that image is fully loaded
    if (img.width === 0 || img.height === 0) {
      console.warn('Image not fully loaded yet');
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas dimensions
    canvas.width = img.width;
    canvas.height = img.height;

    // Draw image or mask depending on mode
    if (showMask && maskRef.current && maskRef.current.width > 0 && maskRef.current.height > 0) {
      ctx.drawImage(maskRef.current, 0, 0);
    } else {
      ctx.drawImage(img, 0, 0);
    }

    if (!text) return;

    // Get text area bounds
    const bounds = getTextBounds();
    const textArea = bounds || {
      x: img.width * 0.1,
      y: img.height * 0.3,
      width: img.width * 0.8,
      height: img.height * 0.4
    };

    // Configure text
    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Split text into lines by newlines from text field
    const lines = text.split('\n').filter(line => line.trim() !== '');
    
    if (lines.length === 0) return;
    
    // Find maximum font size for all lines
    // Start with more aggressive size
    let fontSize = Math.min(textArea.height / lines.length, textArea.width / Math.max(...lines.map(line => line.length)) * 2.5);
    let bestFontSize = 10;
    
    // Binary search for optimal font size
    let minFontSize = 8;
    // Increase maximum size for more aggressive search
    let maxFontSize = Math.min(textArea.height / lines.length, textArea.width / Math.max(...lines.map(line => line.length)) * 4);
    
    for (let attempts = 0; attempts < 60; attempts++) {
      ctx.font = `bold ${fontSize}px "${fontFamily}"`;
      
      // Check if each line fits by width
      const allLinesFit = lines.every(line => {
        const metrics = ctx.measureText(line);
        return metrics.width <= textArea.width * 0.95; // Small margin
      });
      
      // Check if all text fits by height
      const lineHeight = fontSize * 1.2;
      const totalHeight = lines.length * lineHeight;
      const fitsHeight = totalHeight <= textArea.height * 0.95; // Small margin
      
      // Check that text is in white area of mask (if mask exists)
      const fitsMask = isTextWithinWhiteMask(fontSize, lines, textArea);
      
      if (allLinesFit && fitsHeight && fitsMask) {
        bestFontSize = fontSize;
        minFontSize = fontSize;
        fontSize = (fontSize + maxFontSize) / 2;
      } else {
        maxFontSize = fontSize;
        fontSize = (minFontSize + fontSize) / 2;
      }
      
      // If difference becomes very small, stop
      if (maxFontSize - minFontSize < 0.1) {
        break;
      }
    }
    
    // Use best found size
    fontSize = bestFontSize;
    ctx.font = `bold ${fontSize}px "${fontFamily}"`;
    
    // Calculate positions for centering all lines
    const lineHeight = fontSize * 1.2;
    const totalHeight = lines.length * lineHeight;
    const startY = textArea.y + (textArea.height - totalHeight) / 2 + lineHeight / 2;
    
    // Draw each line
    lines.forEach((line, index) => {
      const y = startY + index * lineHeight;
      const x = textArea.x + textArea.width / 2;
      
      // Ensure text is centered precisely
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      // Add outline for better readability
      ctx.strokeStyle = textColor === '#FFFFFF' ? '#000000' : '#FFFFFF';
      ctx.lineWidth = Math.max(2, fontSize / 20);
      ctx.strokeText(line, x, y);
      
      ctx.fillText(line, x, y);
    });
  };

  const handleConfirm = () => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;

    // Create temporary canvas for saving main image with text
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;

    tempCanvas.width = img.width;
    tempCanvas.height = img.height;
    
    // Always draw main image
    tempCtx.drawImage(img, 0, 0);
    
    if (text) {
      // Get text area bounds
      const bounds = getTextBounds();
      const textArea = bounds || {
        x: img.width * 0.1,
        y: img.height * 0.3,
        width: img.width * 0.8,
        height: img.height * 0.4
      };

      tempCtx.fillStyle = textColor;
      tempCtx.textAlign = 'center';
      tempCtx.textBaseline = 'middle';

      // Split text into lines by newlines from text field
      const lines = text.split('\n').filter(line => line.trim() !== '');
      
      if (lines.length > 0) {
        // Find maximum font size for all lines
        let fontSize = Math.min(textArea.height / lines.length, textArea.width / Math.max(...lines.map(line => line.length)) * 2.5);
        let bestFontSize = 10;
        
        // Binary search for optimal font size
        let minFontSize = 8;
        let maxFontSize = Math.min(textArea.height / lines.length, textArea.width / Math.max(...lines.map(line => line.length)) * 4);
        
        for (let attempts = 0; attempts < 60; attempts++) {
          tempCtx.font = `bold ${fontSize}px "${fontFamily}"`;
          
          // Check if each line fits by width
          const allLinesFit = lines.every(line => {
            const metrics = tempCtx.measureText(line);
            return metrics.width <= textArea.width * 0.95;
          });
          
          // Check if all text fits by height
          const lineHeight = fontSize * 1.2;
          const totalHeight = lines.length * lineHeight;
          const fitsHeight = totalHeight <= textArea.height * 0.95;
          
          // Check that text is in white area of mask (if mask exists)
          const fitsMask = isTextWithinWhiteMask(fontSize, lines, textArea);
          
          if (allLinesFit && fitsHeight && fitsMask) {
            bestFontSize = fontSize;
            minFontSize = fontSize;
            fontSize = (fontSize + maxFontSize) / 2;
          } else {
            maxFontSize = fontSize;
            fontSize = (minFontSize + fontSize) / 2;
          }
          
          if (maxFontSize - minFontSize < 0.1) {
            break;
          }
        }
        
        fontSize = bestFontSize;
        tempCtx.font = `bold ${fontSize}px "${fontFamily}"`;
        
        // Calculate positions for centering all lines
        const lineHeight = fontSize * 1.2;
        const totalHeight = lines.length * lineHeight;
        const startY = textArea.y + (textArea.height - totalHeight) / 2 + lineHeight / 2;
        
        // Draw each line
        lines.forEach((line, index) => {
          const y = startY + index * lineHeight;
          const x = textArea.x + textArea.width / 2;
          
          // Ensure text is centered precisely
          tempCtx.textAlign = 'center';
          tempCtx.textBaseline = 'middle';
          
          // Add outline for better readability
          tempCtx.strokeStyle = textColor === '#FFFFFF' ? '#000000' : '#FFFFFF';
          tempCtx.lineWidth = Math.max(2, fontSize / 20);
          tempCtx.strokeText(line, x, y);
          
          tempCtx.fillText(line, x, y);
        });
      }
    }

    // Convert temporary canvas to base64
    const imageWithText = tempCanvas.toDataURL('image/png');
    onConfirm(imageWithText);
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="lg"
      fullWidth
    >
      <DialogTitle>Add Text to Sign</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, minHeight: 400 }}>
          {/* Text input */}
          <TextField
            label="Text"
            multiline
            rows={4}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Enter text for the sign"
            fullWidth
          />

          {/* Canvas preview */}
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            bgcolor: 'grey.100',
            borderRadius: 1,
            position: 'relative',
            minHeight: 300,
            width: '100%'
          }}>
            {loading ? (
              <CircularProgress />
            ) : (
              <canvas
                ref={canvasRef}
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain'
                }}
              />
            )}
          </Box>

          {/* Controls row */}
          <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
            <FormControl sx={{ minWidth: 200 }} size="small">
              <InputLabel>Font</InputLabel>
              <Select
                value={fontFamily}
                label="Font"
                onChange={(e) => setFontFamily(e.target.value)}
                MenuProps={{
                  PaperProps: {
                    style: {
                      maxHeight: 300,
                    },
                  },
                }}
                sx={{
                  fontFamily: fontFamily,
                  fontSize: '14px'
                }}
              >
                {availableFonts.map((font) => (
                  <MenuItem
                    key={font}
                    value={font}
                    sx={{
                      fontFamily: font,
                      fontSize: '14px'
                    }}
                  >
                    {font}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Box sx={{ minWidth: 200 }}>
              <Typography variant="body2" sx={{ mb: 1 }}>
                Text Color
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <input
                  type="color"
                  value={textColor}
                  onChange={(e) => setTextColor(e.target.value)}
                  style={{ width: 60, height: 40, cursor: 'pointer' }}
                />
                <TextField
                  value={textColor}
                  onChange={(e) => setTextColor(e.target.value)}
                  size="small"
                  sx={{ flex: 1 }}
                />
              </Box>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', minWidth: 150 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={showMask}
                    onChange={(e) => setShowMask(e.target.checked)}
                    disabled={maskError}
                  />
                }
                label="Show Mask"
              />
            </Box>
          </Box>

          {maskError && (
            <Typography variant="caption" color="warning.main">
              Mask not found, using full image
            </Typography>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button 
          onClick={handleConfirm} 
          variant="contained" 
          disabled={loading || !text.trim()}
        >
          Add
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SignTextEditor;

