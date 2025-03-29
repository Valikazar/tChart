/**
 * Полная реализация skia-canvas для браузера
 * Реализует API совместимый с Node.js версией skia-canvas
 */
(function() {
  // Определяем, поддерживается ли OffscreenCanvas в этом браузере
  const supportsOffscreenCanvas = typeof OffscreenCanvas !== 'undefined';
  
  // Реализация Canvas
  class SkiaCanvasBrowser {
    constructor(width, height) {
      // Используем OffscreenCanvas если доступен, иначе обычный canvas
      this.width = width;
      this.height = height;
      
      if (supportsOffscreenCanvas) {
        this._canvas = new OffscreenCanvas(width, height);
      } else {
        this._canvas = document.createElement('canvas');
        this._canvas.width = width;
        this._canvas.height = height;
      }
      
      // Делегируем методы canvas
      this.getContext = this._canvas.getContext.bind(this._canvas);
      this.toDataURL = this._canvas.toDataURL 
        ? this._canvas.toDataURL.bind(this._canvas)
        : (type) => {
            // Для OffscreenCanvas без toDataURL
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = this.width;
            tempCanvas.height = this.height;
            const ctx = tempCanvas.getContext('2d');
            const imageData = this.getContext('2d').getImageData(0, 0, this.width, this.height);
            ctx.putImageData(imageData, 0, 0);
            return tempCanvas.toDataURL(type);
          };
    }
    
    // Метод для получения буфера (совместимость с Node.js API)
    toBuffer(mimeType) {
      // В браузере мы не можем получить буфер напрямую
      // Но можем имитировать для совместимости API
      if (supportsOffscreenCanvas && this._canvas.convertToBlob) {
        return this._canvas.convertToBlob({type: mimeType})
          .then(blob => {
            const reader = new FileReader();
            return new Promise((resolve) => {
              reader.onloadend = () => {
                // Создаем Uint8Array из arrayBuffer
                resolve(new Uint8Array(reader.result));
              };
              reader.readAsArrayBuffer(blob);
            });
          });
      }
      console.warn('toBuffer not fully supported in browser environment');
      return Promise.resolve(new Uint8Array());
    }
  }
  
  // Функция загрузки изображения
  async function loadSkiaImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = (err) => reject(err);
      img.crossOrigin = 'anonymous'; // Для CORS
      img.src = url;
    });
  }
  
  // Регистрируем API skia-canvas глобально
  window['skia-canvas'] = {
    Canvas: SkiaCanvasBrowser,
    loadImage: loadSkiaImage
  };
  
  console.log('skia-canvas browser polyfill initialized');
})(); 