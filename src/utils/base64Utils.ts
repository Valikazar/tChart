/**
 * Утилиты для работы с base64 изображениями
 */

/**
 * Конвертирует URL изображения в base64 с поддержкой разных форматов
 */
export const urlToBase64 = async (url: string, outputFormat: 'jpeg' | 'png' = 'png', quality: number = 0.8): Promise<string> => {
  try {
    // Проверяем, является ли URL уже base64
    if (url.startsWith('data:image/')) {
      return url;
    }

    // Если URL пустой или это относительный путь без домена
    if (!url || (!url.startsWith('http') && !url.startsWith('/') && !url.startsWith('pic/'))) {
      return url;
    }

    // Формируем полный URL если это относительный путь
    let fullUrl = url;
    if (url.startsWith('pic/') || url.startsWith('/pic/')) {
      const baseUrl = process.env.NODE_ENV === 'production' 
        ? window.location.origin 
        : 'http://localhost:3000';
      fullUrl = `${baseUrl}/${url.startsWith('/') ? url.slice(1) : url}`;
    }

    const response = await fetch(fullUrl);
    if (!response.ok) {
      console.warn(`Failed to fetch image: ${fullUrl}`);
      return url; // Возвращаем оригинальный URL если не удалось загрузить
    }

    const blob = await response.blob();
    
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        try {
          // Создаем canvas для конвертации
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            console.warn(`Cannot get canvas context for: ${fullUrl}`);
            resolve(url);
            return;
          }
          
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          
          // Для JPEG заливаем белым фоном (так как JPEG не поддерживает прозрачность)
          if (outputFormat === 'jpeg') {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          }
          
          // Рисуем изображение
          ctx.drawImage(img, 0, 0);
          
          // Конвертируем в нужный формат
          const mimeType = outputFormat === 'jpeg' ? 'image/jpeg' : 'image/png';
          const base64Result = outputFormat === 'jpeg' 
            ? canvas.toDataURL(mimeType, quality)
            : canvas.toDataURL(mimeType);
            
          resolve(base64Result);
        } catch (error) {
          console.warn(`Error in canvas conversion for: ${fullUrl}`, error);
          resolve(url);
        }
      };
      
      img.onerror = () => {
        console.warn(`Failed to load image: ${fullUrl}`);
        resolve(url);
      };
      
      // Создаем URL для загрузки blob как изображения
      const imageUrl = URL.createObjectURL(blob);
      
      // Переопределяем обработчик чтобы очистить URL после загрузки
      const originalOnLoad = img.onload;
      img.onload = function() {
        URL.revokeObjectURL(imageUrl);
        if (originalOnLoad) originalOnLoad.call(this);
      };
      
      img.src = imageUrl;
    });
  } catch (error) {
    console.warn(`Error converting URL to base64: ${url}`, error);
    return url; // Возвращаем оригинальный URL при ошибке
  }
};

/**
 * Конвертирует все URL изображений в объекте конфигурации в base64
 * background изображения конвертируются в JPEG, остальные в PNG
 */
export const convertConfigToBase64 = async (config: any): Promise<any> => {
  const convertedConfig = JSON.parse(JSON.stringify(config)); // Глубокое копирование

  /**
   * Рекурсивно обходит объект и конвертирует все найденные URL в base64
   */
  const convertUrlsRecursively = async (obj: any, path: string[] = []): Promise<void> => {
    if (typeof obj === 'object' && obj !== null) {
      for (const key in obj) {
        const currentPath = [...path, key];
        
        if (typeof obj[key] === 'string' && key === 'url') {
          // Определяем формат на основе пути в конфигурации
          // background изображения конвертируем в JPEG
          const isBackgroundImage = path.includes('background') || 
                                   path.some(p => p.toLowerCase().includes('background'));
          
          const format = isBackgroundImage ? 'jpeg' : 'png';
          const quality = isBackgroundImage ? 0.85 : 0.8;
          
          console.log(`Converting ${currentPath.join('.')} to ${format.toUpperCase()}:`, obj[key]);
          
          // Конвертируем URL в base64
          obj[key] = await urlToBase64(obj[key], format, quality);
        } else if (typeof obj[key] === 'object') {
          // Рекурсивно обрабатываем вложенные объекты
          await convertUrlsRecursively(obj[key], currentPath);
        }
      }
    }
  };

  await convertUrlsRecursively(convertedConfig);
  return convertedConfig;
};

/**
 * Проверяет, является ли строка base64 изображением
 */
export const isBase64Image = (str: string): boolean => {
  return str.startsWith('data:image/');
};

/**
 * Получает размер base64 строки в байтах
 */
export const getBase64Size = (base64String: string): number => {
  if (!base64String.startsWith('data:')) {
    return 0;
  }
  
  const base64Data = base64String.split(',')[1];
  if (!base64Data) {
    return 0;
  }
  
  // Base64 кодирование увеличивает размер на ~33%
  // Плюс нужно учесть padding символы
  const padding = (base64Data.match(/=/g) || []).length;
  return Math.floor((base64Data.length * 3) / 4) - padding;
};

/**
 * Получает общий размер всех изображений в конфигурации
 */
export const getConfigImagesSize = (config: any): { totalSize: number; imageCount: number; jpegCount: number; pngCount: number } => {
  let totalSize = 0;
  let imageCount = 0;
  let jpegCount = 0;
  let pngCount = 0;

  const calculateSizeRecursively = (obj: any, path: string[] = []): void => {
    if (typeof obj === 'object' && obj !== null) {
      for (const key in obj) {
        const currentPath = [...path, key];
        
        if (typeof obj[key] === 'string' && key === 'url' && isBase64Image(obj[key])) {
          totalSize += getBase64Size(obj[key]);
          imageCount++;
          
          // Определяем тип изображения по MIME типу
          if (obj[key].startsWith('data:image/jpeg')) {
            jpegCount++;
          } else if (obj[key].startsWith('data:image/png')) {
            pngCount++;
          }
        } else if (typeof obj[key] === 'object') {
          calculateSizeRecursively(obj[key], currentPath);
        }
      }
    }
  };

  calculateSizeRecursively(config);
  
  return { totalSize, imageCount, jpegCount, pngCount };
};

/**
 * Форматирует размер в человекочитаемый формат
 */
export const formatSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}; 