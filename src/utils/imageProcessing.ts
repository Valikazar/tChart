interface ImageDimensions {
  width: number;
  height: number;
}

export const processImage = async (
  file: File,
  type: 'background' | 'bar' | 'body',
  maxWidth: number
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
        // Для фона: масштабируем по меньшей стороне
        const minSide = Math.min(width, height);
        const scale = maxWidth / minSide;
        
        // Вычисляем новые размеры с сохранением пропорций
        const newWidth = Math.round(width * scale);
        const newHeight = Math.round(height * scale);
        
        // Устанавливаем размер холста равным maxWidth
        canvas.width = maxWidth;
        canvas.height = maxWidth;
        
        // Вычисляем смещения для центрирования
        const offsetX = (newWidth - maxWidth) / 2;
        const offsetY = (newHeight - maxWidth) / 2;
        
        // Рисуем изображение с учетом смещения для центрирования
        ctx.drawImage(
          img,
          -offsetX,
          -offsetY,
          newWidth,
          newHeight
        );
      } else {
        // Для баров: оставляем существующую логику
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

      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
};

export const processBackgroundImage = (file: File): Promise<string> => {
  return processImage(file, 'background', 1280);
};

export const processBarImage = (file: File): Promise<string> => {
  return processImage(file, 'bar', 128);
};

export const processBodyImage = (file: File): Promise<string> => {
  return processImage(file, 'body', 64);
}; 