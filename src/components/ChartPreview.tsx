// ChartPreview.tsx
import React, { useEffect, useRef, useMemo, useState, useImperativeHandle, forwardRef } from 'react';
import { Box, Typography, useTheme, useMediaQuery } from '@mui/material';
import { ChartConfig, OverlayItem } from './types';
import { drawChart } from './drawChart';
import { createUniversalCanvas } from './canvasAbstraction';

// Demo data
const DEMO_DATA = Array.from({ length: 24 }, (_, i) => {
  const now = Math.floor(Date.now() / 1000);
  const timestamp = now - (24 - i) * 3600;
  const basePrice = 135.0;
  const volatility = 0.00000050;
  const open = basePrice + (Math.random() - 0.5) * volatility;
  const close = basePrice + (Math.random() - 0.5) * volatility;
  const high = Math.max(open, close) + Math.random() * volatility * 0.5;
  const low = Math.min(open, close) - Math.random() * volatility * 0.5;
  return [timestamp, open, high, low, close];
});

const DEMO_TOKEN_INFO = {
  priceUsd: 135.0,
  marketCap: 999000,
  priceChange: {
    '5m': 3.14,
    '1h': -6.66,
    '6h': 0.00,
    '24h': 15.75,
  },
  name: 'Token',
};



interface ChartPreviewProps {
  config: ChartConfig;
  data?: any[];
  tokenInfo?: {
    priceUsd: number;
    marketCap: number;
    priceChange: {
      '5m': number;
      '1h': number;
      '6h': number;
      '24h': number;
    };
    name?: string;
  } | null;
  interval?: string;
  width?: number;
  height?: number;
  id?: string;
  tokenName?: string;
  isPreview?: boolean;
  showTokenInfo?: boolean;
  isEnhanced?: boolean;
  overlays?: OverlayItem[];
  onOverlaysChange?: (items: OverlayItem[]) => void;
  selectedOverlayId?: string | null;
  onSelectOverlay?: (id: string | null) => void;
}

export interface ChartPreviewHandle {
  deselectAll: () => void;
}

const ChartPreview = React.forwardRef<ChartPreviewHandle, ChartPreviewProps>(({
  config,
  data,
  tokenInfo,
  interval = 'hour',
  width = 1280,
  height = 1280,
  id = 'chart-canvas',
  tokenName,
  isPreview = false,
  showTokenInfo = true,
  isEnhanced = false,
  overlays = [],
  onOverlaysChange,
  selectedOverlayId,
  onSelectOverlay,
}, ref) => {
  const theme = useTheme();
  // On desktop (md and up), use smaller handles (2.5), otherwise use larger (5.0)
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));

  // UI handle scaling
  const HANDLE_SCALE = isDesktop ? 2.5 : 5.0;
  const HANDLE_RADIUS = 16 * HANDLE_SCALE;
  const HANDLE_FONT_PX = Math.round(22 * HANDLE_SCALE);
  const HANDLE_STROKE = Math.max(2, Math.round(2 * HANDLE_SCALE));
  const HIT_RADIUS = 18 * HANDLE_SCALE;
  const chartData = useMemo(() => (isPreview || !data || data.length === 0) ? DEMO_DATA : data, [data, isPreview]);
  const chartTokenInfo = useMemo(() => (isPreview || !tokenInfo) ? DEMO_TOKEN_INFO : tokenInfo, [tokenInfo, isPreview]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number>();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Overlay interaction state
  const imagesCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const selectedIdRef = useRef<string | null>(null);

  // Sync selectedIdRef with prop if provided
  useEffect(() => {
    if (selectedOverlayId !== undefined) {
      selectedIdRef.current = selectedOverlayId;
      drawOverlays();
    }
  }, [selectedOverlayId]);

  const dragModeRef = useRef<'move' | 'scale' | 'rotate' | 'none'>('none');
  const dragStartRef = useRef<{ x: number; y: number; item?: OverlayItem; angle?: number; dist?: number } | null>(null);

  useImperativeHandle(ref, () => ({
    deselectAll: () => {
      selectedIdRef.current = null;
      if (onSelectOverlay) onSelectOverlay(null); // Keep parent in sync
      drawOverlays();
    }
  }));

  useEffect(() => {
    if (!canvasRef.current || (!isPreview && (!data || data.length === 0))) {
      setIsLoading(false);
      return;
    }

    const canvas = canvasRef.current!;
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    // Сохраняем текущую конфигурацию в data-атрибуте canvas
    try {
      canvas.dataset.config = JSON.stringify(config);
    } catch (e) {
      console.error('Error saving config to canvas dataset:', e);
    }

    animationFrameRef.current = requestAnimationFrame(() => {
      drawChart({
        canvas,
        config,
        data: chartData,
        tokenInfo: chartTokenInfo,
        interval,
        width,
        height,
        tokenName,
        isEnhanced,
      })
        .then(() => setIsLoading(false))
        .catch((err) => {
          console.error('Error rendering chart:', err);
          setError(err instanceof Error ? err.message : 'Error rendering chart');
          setIsLoading(false);
        });
    });

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [config, chartData, chartTokenInfo, interval, width, height, tokenName, isPreview, isEnhanced]);

  // Load overlay images lazily
  useEffect(() => {
    if (!overlays) return;
    const cache = imagesCacheRef.current;
    overlays.forEach((item) => {
      if (!cache.has(item.id)) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          item.naturalWidth = img.naturalWidth;
          item.naturalHeight = img.naturalHeight;
          drawOverlays();
        };
        img.src = item.url;
        cache.set(item.id, img);
      }
    });
    // Cleanup missing
    Array.from(cache.keys()).forEach((key) => {
      if (!overlays.find(o => o.id === key)) {
        cache.delete(key);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overlays]);

  // Draw overlays on separate canvas
  const drawOverlays = () => {
    const oCanvas = overlayCanvasRef.current;
    if (!oCanvas) return;
    const ctx = oCanvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, oCanvas.width, oCanvas.height);
    if (!overlays) return;
    const cache = imagesCacheRef.current;
    overlays.forEach((item) => {
      const img = cache.get(item.id);
      if (!img) return;
      const iw = (item.naturalWidth || img.naturalWidth);
      const ih = (item.naturalHeight || img.naturalHeight);
      ctx.save();
      ctx.translate(item.x, item.y);
      // Mirror strictly in screen horizontal axis first
      if (item.mirrored) {
        ctx.scale(-1, 1);
      }
      // Then apply rotation (invert sign for mirrored so visual direction matches frame)
      const rot = (item.rotation || 0);
      ctx.rotate(item.mirrored ? -rot : rot);
      const s = (item.scale || 1);
      ctx.scale(s, s);
      ctx.drawImage(img, -iw / 2, -ih / 2, iw, ih);
      ctx.restore();

      // If selected, draw bounding box and handles
      if (selectedIdRef.current === item.id) {
        // Compute transformed corners to screen to draw handles
        const corners = [
          { hx: -1, hy: -1 }, // tl
          { hx: 1, hy: -1 },  // tr
          { hx: -1, hy: 1 },  // bl
          { hx: 1, hy: 1 },   // br
        ].map(({ hx, hy }) => {
          // Use absolute scale for handle positions so UI does not mirror
          const sx = item.x + (Math.cos(item.rotation || 0) * hx * (iw / 2) - Math.sin(item.rotation || 0) * hy * (ih / 2)) * Math.abs(item.scale || 1);
          const sy = item.y + (Math.sin(item.rotation || 0) * hx * (iw / 2) + Math.cos(item.rotation || 0) * hy * (ih / 2)) * Math.abs(item.scale || 1);
          return { x: sx, y: sy };
        });
        // Draw bounding polyline
        ctx.save();
        ctx.strokeStyle = '#00E5FF';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(corners[0].x, corners[0].y);
        ctx.lineTo(corners[1].x, corners[1].y);
        ctx.lineTo(corners[3].x, corners[3].y);
        ctx.lineTo(corners[2].x, corners[2].y);
        ctx.closePath();
        ctx.stroke();
        // Handles: tl(delete), tr(rotate), bl(duplicate), br(scale), center(mirror)
        const drawHandle = (p: { x: number; y: number }, icon: string, color: string) => {
          const r = HANDLE_RADIUS;
          // Background circle
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = HANDLE_STROKE;
          ctx.stroke();

          // Draw icon - larger and black, perfectly centered
          ctx.fillStyle = '#000';
          ctx.font = `bold ${HANDLE_FONT_PX}px Arial`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          // Fine-tune vertical centering for better visual alignment
          ctx.fillText(icon, p.x, p.y + 1);
        };
        drawHandle(corners[0], '×', '#ff5252'); // delete
        drawHandle(corners[1], '↻', '#ffd740'); // rotate
        drawHandle(corners[2], '⧉', '#69f0ae'); // duplicate
        drawHandle(corners[3], '⤡', '#40c4ff'); // scale
        // center mirror at bottom center, slightly below the image boundary
        const bottomMid = {
          x: (corners[2].x + corners[3].x) / 2,
          y: (corners[2].y + corners[3].y) / 2,
        };
        const centerVec = {
          x: bottomMid.x - item.x,
          y: bottomMid.y - item.y,
        };
        const vecLen = Math.hypot(centerVec.x, centerVec.y) || 1;
        const nx = centerVec.x / vecLen;
        const ny = centerVec.y / vecLen;
        // place slightly outside (below) the bottom edge
        const extra = HANDLE_RADIUS + 6;
        const mirrorPos = { x: bottomMid.x + nx * extra, y: bottomMid.y + ny * extra };
        drawHandle(mirrorPos, '↔', '#b388ff');
        ctx.restore();
      }
    });
  };

  // Redraw overlays when dependencies change
  useEffect(() => {
    drawOverlays();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height]);

  // Hit testing helpers
  const hitTest = (px: number, py: number) => {
    if (!overlays) return { item: null as OverlayItem | null, hit: 'none' as 'none' | 'move' | 'scale' | 'rotate' | 'delete' | 'mirror' | 'duplicate' };
    // iterate from top-most (last)
    for (let i = overlays.length - 1; i >= 0; i--) {
      const item = overlays[i];
      const img = imagesCacheRef.current.get(item.id);
      if (!img) continue;
      const iw = (item.naturalWidth || img.naturalWidth);
      const ih = (item.naturalHeight || img.naturalHeight);
      // compute handle positions
      const corners = [
        { key: 'delete' as const, hx: -1, hy: -1 },
        { key: 'rotate' as const, hx: 1, hy: -1 },
        { key: 'duplicate' as const, hx: -1, hy: 1 },
        { key: 'scale' as const, hx: 1, hy: 1 },
      ].map(({ key, hx, hy }) => {
        // Use absolute scale for handle positions so UI does not mirror
        const sx = item.x + (Math.cos(item.rotation || 0) * hx * (iw / 2) - Math.sin(item.rotation || 0) * hy * (ih / 2)) * Math.abs(item.scale || 1);
        const sy = item.y + (Math.sin(item.rotation || 0) * hx * (iw / 2) + Math.cos(item.rotation || 0) * hy * (ih / 2)) * Math.abs(item.scale || 1);
        return { key, x: sx, y: sy };
      });
      // center mirror at bottom center with offset below the image boundary
      const bottomMid = {
        x: (corners[2].x + corners[3].x) / 2,
        y: (corners[2].y + corners[3].y) / 2,
      };
      const centerVec = { x: bottomMid.x - item.x, y: bottomMid.y - item.y };
      const vecLen = Math.hypot(centerVec.x, centerVec.y) || 1;
      const nx = centerVec.x / vecLen;
      const ny = centerVec.y / vecLen;
      const extra = HANDLE_RADIUS + 6;
      const mirror = { key: 'mirror' as const, x: bottomMid.x + nx * extra, y: bottomMid.y + ny * extra };
      const inCircle = (cx: number, cy: number, r = HIT_RADIUS) => (px - cx) * (px - cx) + (py - cy) * (py - cy) <= r * r;
      const handle = [...corners, mirror].find(h => inCircle(h.x, h.y));
      if (handle) {
        return { item, hit: handle.key };
      }
      // test body (convert to local space). Mirror must be undone in screen X before rotation.
      let sx = px - item.x;
      let sy = py - item.y;
      if (item.mirrored) {
        sx = -sx; // undo horizontal flip done before rotation
      }
      const cos = Math.cos(-(item.rotation || 0));
      const sin = Math.sin(-(item.rotation || 0));
      const lx = (cos * sx - sin * sy) / Math.abs(item.scale || 1);
      const ly = (sin * sx + cos * sy) / Math.abs(item.scale || 1);
      if (lx >= -iw / 2 && lx <= iw / 2 && ly >= -ih / 2 && ly <= ih / 2) {
        return { item, hit: 'move' };
      }
    }
    return { item: null, hit: 'none' };
  };

  // Pointer events
  useEffect(() => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const toCanvasCoords = (e: MouseEvent | TouchEvent) => {
      const rect = canvas.getBoundingClientRect();
      let clientX: number; let clientY: number;
      if (e instanceof TouchEvent) {
        const t = e.touches[0] || e.changedTouches[0];
        clientX = t.clientX; clientY = t.clientY;
      } else {
        clientX = (e as MouseEvent).clientX; clientY = (e as MouseEvent).clientY;
      }
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
    };
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (!overlays) return;
      // Clear any stale drag state to avoid previous tool interference
      dragModeRef.current = 'none';
      dragStartRef.current = null;
      const { x, y } = toCanvasCoords(e);
      const { item, hit } = hitTest(x, y);
      if (!item || hit === 'none') {
        selectedIdRef.current = null;
        if (onSelectOverlay) onSelectOverlay(null);
        drawOverlays();
        return;
      }
      selectedIdRef.current = item.id;
      if (onSelectOverlay) onSelectOverlay(item.id);
      dragModeRef.current = hit === 'move' ? 'move' : hit === 'scale' ? 'scale' : hit === 'rotate' ? 'rotate' : 'none';
      // For direct-action handles we do not initialize drag
      if (dragModeRef.current !== 'none') {
        dragStartRef.current = { x, y, item: { ...item } };
      }
      if (hit === 'delete') {
        const next = overlays.filter(o => o.id !== item.id);
        onOverlaysChange && onOverlaysChange(next);
        selectedIdRef.current = null;
        if (onSelectOverlay) onSelectOverlay(null);
        dragModeRef.current = 'none';
        drawOverlays();
        e.preventDefault();
        return;
      } else if (hit === 'mirror') {
        // toggle mirrored and commit immediately
        const next = overlays.map(o => o.id === item.id ? { ...o, mirrored: !o.mirrored } : o);
        onOverlaysChange && onOverlaysChange(next);
        dragModeRef.current = 'none';
        drawOverlays();
        e.preventDefault();
        return;
      } else if (hit === 'duplicate') {
        const copy: OverlayItem = { ...item, id: `${item.id}_copy_${Date.now()}`, x: item.x + 20, y: item.y + 20 };
        onOverlaysChange && onOverlaysChange([...(overlays || []), copy]);
        dragModeRef.current = 'none';
        drawOverlays();
        e.preventDefault();
        return;
      }
      drawOverlays();
      e.preventDefault();
    };
    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!overlays) return;
      if (!dragStartRef.current || dragModeRef.current === 'none') return;
      const { x, y } = toCanvasCoords(e);
      const start = dragStartRef.current;
      const idx = overlays.findIndex(o => o.id === selectedIdRef.current);
      if (idx < 0) return;
      const current = overlays[idx];
      if (dragModeRef.current === 'move') {
        const dx = x - start.x; const dy = y - start.y;
        const next = overlays.slice();
        next[idx] = {
          ...current,
          mirrored: current.mirrored ?? start.item!.mirrored ?? false,
          x: (start.item!.x + dx),
          y: (start.item!.y + dy)
        };
        onOverlaysChange && onOverlaysChange(next);
      } else if (dragModeRef.current === 'scale') {
        const dx = x - current.x; const dy = y - current.y;
        const dist = Math.hypot(dx, dy);
        const sdx = start.x - current.x; const sdy = start.y - current.y;
        const sdist = Math.hypot(sdx, sdy) || 1;
        const factor = (dist / sdist);
        const next = overlays.slice();
        next[idx] = {
          ...current,
          mirrored: current.mirrored ?? start.item!.mirrored ?? false,
          scale: Math.max(0.05, (start.item!.scale || 1) * factor)
        };
        onOverlaysChange && onOverlaysChange(next);
      } else if (dragModeRef.current === 'rotate') {
        // Rotation delta follows pointer; drawing logic handles mirrored visual direction
        const angle = Math.atan2(y - current.y, x - current.x);
        const sangle = Math.atan2(start.y - current.y, start.x - current.x);
        const delta = angle - sangle;
        const next = overlays.slice();
        next[idx] = {
          ...current,
          mirrored: current.mirrored ?? start.item!.mirrored ?? false,
          rotation: (start.item!.rotation || 0) + delta
        };
        onOverlaysChange && onOverlaysChange(next);
      }
      drawOverlays();
      e.preventDefault();
    };
    const onUp = () => {
      dragModeRef.current = 'none';
      dragStartRef.current = null;
      // ensure overlay redraw post interaction
      drawOverlays();
    };
    canvas.addEventListener('mousedown', onDown);
    canvas.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    canvas.addEventListener('touchstart', onDown, { passive: false } as any);
    canvas.addEventListener('touchmove', onMove, { passive: false } as any);
    window.addEventListener('touchend', onUp);
    return () => {
      canvas.removeEventListener('mousedown', onDown);
      canvas.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      canvas.removeEventListener('touchstart', onDown as any);
      canvas.removeEventListener('touchmove', onMove as any);
      window.removeEventListener('touchend', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overlays, onOverlaysChange]);

  return (
    <Box className="chart-preview" sx={{ position: 'relative', width: '100%', maxWidth: `${width}px` }}>
      {error && <div className="error">Error: {error}</div>}
      <canvas
        ref={canvasRef}
        id={id}
        width={width}
        height={height}
        style={{ display: 'block', maxWidth: '100%', height: 'auto' }}
      />
      <canvas
        ref={overlayCanvasRef}
        width={width}
        height={height}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          pointerEvents: 'auto',
          display: 'block',
          maxWidth: '100%',
          height: 'auto'
        }}
        onContextMenu={(e) => e.preventDefault()}
      />
    </Box>
  );
});

export default ChartPreview;