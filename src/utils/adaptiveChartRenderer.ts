import { ChartConfig } from '../types';
import { renderChart } from './chartRendererNode';

interface AdaptiveChartOptions {
  config: ChartConfig;
  data: any[];
  tokenInfo?: any;
  interval?: string;
  container: HTMLElement; // HTML-элемент, в котором будет отображаться график
  preserveAspectRatio?: boolean; // Сохранять ли соотношение сторон 1:1
  maxWidth?: number; // Максимальная ширина
  maxHeight?: number; // Максимальная высота
  onRenderComplete?: (result: { canvas: HTMLCanvasElement, base64: string }) => void; // Обратный вызов после завершения рендеринга
}

/**
 * Функция для адаптивного рендеринга графиков
 * Автоматически подстраивает размер графика под размер контейнера
 * Отображает Price и Min/Max значения справа вверху
 * @param options Параметры для адаптивного рендеринга
 * @returns Promise с результатом рендеринга
 */
export async function renderAdaptiveChart(options: AdaptiveChartOptions) {
  const {
    config,
    data,
    tokenInfo,
    interval = 'hour',
    container,
    preserveAspectRatio = true,
    maxWidth = 1280,
    maxHeight = 1280,
    onRenderComplete
  } = options;

  // Keep existing canvas if it exists to prevent flicker
  let canvas = container.querySelector('canvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    container.appendChild(canvas);
  }

  // Устанавливаем начальные размеры
  let containerWidth = container.clientWidth;
  let containerHeight = container.clientHeight;

  // Ограничиваем по максимальным размерам
  containerWidth = Math.min(containerWidth, maxWidth);
  
  // Если нужно сохранить соотношение сторон 1:1
  if (preserveAspectRatio) {
    containerHeight = containerWidth;
  } else {
    containerHeight = Math.min(containerHeight, maxHeight);
  }
  
  // Устанавливаем размеры canvas
  canvas.width = containerWidth;
  canvas.height = containerHeight;
  
  // Применяем стили для адаптивности
  canvas.style.maxWidth = '100%';
  canvas.style.height = 'auto';
  if (preserveAspectRatio) {
    canvas.style.aspectRatio = '1/1';
  }

  try {
    // Рендерим график с адаптивными размерами
    const result = await renderChart({
      config,
      data,
      tokenInfo,
      interval,
      width: containerWidth,
      height: containerHeight,
      canvas
    });

    // Вызываем обратный вызов по завершении, если он указан
    if (onRenderComplete) {
      onRenderComplete({
        canvas: canvas as HTMLCanvasElement,
        base64: result.base64
      });
    }

    return result;
  } catch (error) {
    console.error('Error rendering adaptive chart:', error);
    throw error;
  }
}

/**
 * Функция для обновления размера графика при изменении размера окна
 * @param container Контейнер с графиком
 * @param renderFn Функция рендеринга
 */
export function setupResizeObserver(
  container: HTMLElement,
  renderFn: () => Promise<void>
) {
  // Используем ResizeObserver для отслеживания изменений размера контейнера
  if (typeof ResizeObserver !== 'undefined') {
    const resizeObserver = new ResizeObserver(() => {
      renderFn();
    });
    
    resizeObserver.observe(container);
    
    // Возвращаем функцию очистки
    return () => {
      resizeObserver.disconnect();
    };
  }
  
  // Если ResizeObserver не поддерживается, используем window resize
  const handleResize = () => {
    renderFn();
  };
  
  window.addEventListener('resize', handleResize);
  
  // Возвращаем функцию очистки
  return () => {
    window.removeEventListener('resize', handleResize);
  };
}

/**
 * Component for use in React
 * Usage example:
 * 
 * function YourComponent() {
 *   const containerRef = useRef<HTMLDivElement>(null);
 *   
 *   useEffect(() => {
 *     if (containerRef.current && data) {
 *       // Render chart on initial load
 *       const renderChart = async () => {
 *         await renderAdaptiveChart({
 *           config,
 *           data,
 *           container: containerRef.current!,
 *           preserveAspectRatio: true
 *         });
 *       };
 *       
 *       renderChart();
 *       
 *       // Set up resize handler
 *       const cleanup = setupResizeObserver(containerRef.current, renderChart);
 *       
 *       return cleanup; // Don't forget to call cleanup function on unmount
 *     }
 *   }, [data, config]);
 *   
 *   return (
 *     <div ref={containerRef} style={{ width: '100%', minHeight: '400px' }}></div>
 *   );
 * }
 */ 