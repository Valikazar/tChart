// canvasAbstraction.ts

// Universal type for image
export type UniversalImage = HTMLImageElement | import('canvas').Image;

// Universal type for canvas - extends to include CanvasImageSource compatibility
export type UniversalCanvas = HTMLCanvasElement | import('canvas').Canvas;

// Universal type for ImageData - handles both DOM and node-canvas versions
export type UniversalImageData = ImageData | import('canvas').ImageData;

// Universal type for context - extends to include all common properties
export interface UniversalCanvasContext extends CanvasRenderingContext2D {
  // Properties that exist on both DOM and node-canvas contexts
  setLineDash(segments: number[]): void;
  lineJoin: CanvasLineJoin;
  lineCap: CanvasLineCap;
  // Ensure drawImage accepts UniversalCanvas
  drawImage(image: CanvasImageSource | UniversalCanvas, dx: number, dy: number): void;
  drawImage(image: CanvasImageSource | UniversalCanvas, dx: number, dy: number, dWidth: number, dHeight: number): void;
  drawImage(image: CanvasImageSource | UniversalCanvas, sx: number, sy: number, sWidth: number, sHeight: number, dx: number, dy: number, dWidth: number, dHeight: number): void;
  // Ensure putImageData accepts UniversalImageData
  putImageData(imagedata: UniversalImageData, dx: number, dy: number, dirtyX?: number, dirtyY?: number, dirtyWidth?: number, dirtyHeight?: number): void;
}

// Function to create canvas
export const createUniversalCanvas = (width: number, height: number): UniversalCanvas => {
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  } else {
    const { createCanvas } = require('canvas');
    return createCanvas(width, height);
  }
};

// Function to load image
export const loadUniversalImage = async (url: string): Promise<UniversalImage> => {
  if (typeof document !== 'undefined') {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  } else {
    const { loadImage } = require('canvas');
    return loadImage(url);
  }
};

// Cache for images
export const imageCache = new Map<string, UniversalImage>();
export const hueImageCache = new Map<string, UniversalCanvas>();