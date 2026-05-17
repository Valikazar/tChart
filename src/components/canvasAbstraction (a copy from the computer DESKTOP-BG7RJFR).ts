// canvasAbstraction.ts

// Universal type for image
export type UniversalImage = HTMLImageElement | import('canvas').Image;

// Universal type for canvas - extends to include CanvasImageSource compatibility
export type UniversalCanvas = HTMLCanvasElement | import('canvas').Canvas;

// Universal type for ImageData - handles both DOM and node-canvas versions
// Note: node-canvas ImageData doesn't have colorSpace, but we'll handle this with type assertions
export type UniversalImageData = ImageData | import('canvas').ImageData;

// Universal type for context - union of both context types
// Both DOM and node-canvas contexts have setLineDash, lineJoin, and lineCap
export type UniversalCanvasContext = 
  | CanvasRenderingContext2D 
  | import('canvas').CanvasRenderingContext2D;

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

// Type assertion helpers to fix TypeScript compatibility issues
export function asCanvasImageSource(canvas: UniversalCanvas): CanvasImageSource {
  return canvas as any as CanvasImageSource;
}

export function asImageData(imageData: UniversalImageData): ImageData {
  return imageData as any as ImageData;
}