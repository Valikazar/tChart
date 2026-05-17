interface ImageDimensions {
  width: number;
  height: number;
}

export const processImage = async (
  file: File,
  type: 'background' | 'bar' | 'body',
  maxWidth: number,
  category?: string
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      let { width, height } = img;
      const originalRatio = width / height;

      if (type === 'background') {
        // For background: scale by the smaller side
        const minSide = Math.min(width, height);
        const scale = maxWidth / minSide;
        
        // Calculate new dimensions while maintaining proportions
        const newWidth = Math.round(width * scale);
        const newHeight = Math.round(height * scale);
        
        // Set canvas size to maxWidth
        canvas.width = maxWidth;
        canvas.height = maxWidth;
        
        // Calculate offsets for centering
        const offsetX = (newWidth - maxWidth) / 2;
        const offsetY = (newHeight - maxWidth) / 2;
        
        // Draw image with offset for centering
        ctx.drawImage(
          img,
          -offsetX,
          -offsetY,
          newWidth,
          newHeight
        );
      } else {
        // For bars: keep existing logic
        if (width <= maxWidth) {
          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0);
        } else {
          height = Math.round(maxWidth / originalRatio);
          canvas.width = maxWidth;
          canvas.height = height;
          ctx.drawImage(img, 0, 0, maxWidth, height);
        }
      }

      try {
        // Определяем формат в зависимости от категории
        let imageFormat: 'image/jpeg' | 'image/png';
        let quality: number;
      
        // bg категория и пресеты всегда JPG, остальные (center, topbot, body) всегда PNG
        if (category === 'bg' || type === 'background' || category === 'presets') {
          imageFormat = 'image/jpeg';
          quality = 0.85; // Высокое качество для JPEG
        } else {
          imageFormat = 'image/png';
          quality = 0.8; // PNG качество
        }
      
        // Получаем данные в нужном формате
        const dataUrl = canvas.toDataURL(imageFormat, quality);
      
        // Проверяем корректность формата
        const expectedPrefix = `data:${imageFormat};base64,`;
        if (!dataUrl.startsWith(expectedPrefix)) {
          console.error('Unexpected image format in dataURL:', dataUrl.substring(0, 30) + '...');
          reject(new Error(`Failed to create ${imageFormat} format`));
          return;
        }
        
        // Проверка размера данных
        if (dataUrl.length < 100) {
          console.error('Image data suspiciously small:', dataUrl.length);
          reject(new Error('Image data too small, likely corrupted'));
          return;
        }
        
        // Проверка, что данные после префикса не пустые
        const base64Data = dataUrl.replace(expectedPrefix, '');
        if (!base64Data || base64Data.length < 10) {
          console.error('Base64 data is empty or too small');
          reject(new Error('Empty or corrupted image data'));
          return;
        }
        
        console.log(`Successfully created ${imageFormat} image, size ~${Math.round(dataUrl.length / 1024)}KB`);
        resolve(dataUrl);
      } catch (error) {
        console.error('Error generating image data:', error);
        reject(new Error('Failed to generate image data'));
      }
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
};

export const processBackgroundImage = (file: File): Promise<string> => {
  return processImage(file, 'background', 1280);
};

export const processBarImage = (file: File, category?: string): Promise<string> => {
  return processImage(file, 'bar', 128, category);
};

export const processBodyImage = (file: File, category?: string): Promise<string> => {
  return processImage(file, 'body', 64, category);
}; 