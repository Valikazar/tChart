# Chart Constructor

Инструмент для создания и настройки графиков криптовалют.

## Новая функциональность: Универсальная генерация графиков

Теперь вы можете генерировать графики как в браузере, так и в Node.js без браузера, с помощью единой универсальной функции. Стандартный размер графиков - квадратный 1280x1280.

## Новое: Адаптивные графики

Библиотека теперь поддерживает адаптивные графики, которые автоматически подстраиваются под размер контейнера, что значительно улучшает отображение на различных устройствах и разрешениях экрана. Адаптивные графики предотвращают перекрытие с другими элементами UI (например, аккордеонами).

### Улучшенное отображение информации

* Текущая цена и min/max цены теперь отображаются в правом верхнем углу графика для лучшей видимости
* Все текстовые элементы (временные метки, изменения цены) имеют усиленные тени вместо полупрозрачных фонов, что значительно улучшает их читаемость при использовании фоновых изображений
* Изменения цены (price change) всегда отображаются поверх других элементов графика, что предотвращает их перекрытие фоновыми изображениями и оверлеями

### Использование компонента AdaptiveChartContainer

```tsx
import AdaptiveChartContainer from './components/AdaptiveChartContainer';

// В вашем компоненте:
<AdaptiveChartContainer
  config={config}
  data={data}
  tokenInfo={tokenInfo}
  preserveAspectRatio={true} // Сохранять ли соотношение сторон 1:1
  minHeight={400} // Минимальная высота контейнера
  showDownloadButton={true} // Показывать ли кнопку скачивания
/>
```

Также доступны низкоуровневые функции для более гибкой настройки:

```tsx
import { renderAdaptiveChart, setupResizeObserver } from './utils/adaptiveChartRenderer';

// В вашем компоненте с useRef и useEffect:
const containerRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  if (containerRef.current && data) {
    const renderChart = async () => {
      await renderAdaptiveChart({
        config,
        data,
        container: containerRef.current!,
        preserveAspectRatio: true
      });
    };
    
    renderChart();
    
    // Автоматическое обновление при изменении размера
    const cleanup = setupResizeObserver(containerRef.current, renderChart);
    return cleanup;
  }
}, [data, config]);

// В JSX:
<div ref={containerRef} style={{ width: '100%', minHeight: '400px' }}></div>
```

### Установка

```bash
# Устанавливаем зависимости
npm install

# Устанавливаем skia-canvas (для режима без браузера)
npm install skia-canvas
```

### Пример использования в коде

#### Режим без браузера (Node.js)

```typescript
import { generateChartImage } from './utils/generateChartImage';
import defaultConfig from './config/defaultChartConfig';

// Данные OHLCV
const data = [
  [1617235200, 100, 120, 90, 110, 1000], // [timestamp, open, high, low, close, volume]
  [1617321600, 110, 130, 100, 120, 1200],
  // ...
];

// Генерация и сохранение графика
generateChartImage({
  config: defaultConfig,
  data,
  outputPath: 'output/chart.png'
})
.then(result => {
  console.log('График сохранен:', result.filePath);
  console.log('Base64 строка:', result.base64);
})
.catch(error => {
  console.error('Ошибка:', error);
});
```

#### Режим браузера

```typescript
import { generateChartImage } from './utils/generateChartImage';
import defaultConfig from './config/defaultChartConfig';

// Данные OHLCV
const data = [
  [1617235200, 100, 120, 90, 110, 1000],
  [1617321600, 110, 130, 100, 120, 1200],
  // ...
];

// Использование существующего canvas
const canvas = document.getElementById('my-chart-canvas') as HTMLCanvasElement;

// Устанавливаем размеры canvas (стандарт 1280x1280)
canvas.width = 1280;
canvas.height = 1280;

// Генерация графика в браузере
generateChartImage({
  config: defaultConfig,
  data,
  canvas,
  // width и height можно не указывать - по умолчанию 1280x1280
})
.then(result => {
  // Canvas уже содержит нарисованный график
  // Также можно использовать base64 для создания изображения
  const img = document.createElement('img');
  img.src = result.base64;
  document.body.appendChild(img);
})
.catch(error => {
  console.error('Ошибка:', error);
});
```

### Прямое использование функции renderChart

Вы также можете использовать базовую функцию renderChart напрямую:

```typescript
import { renderChart } from './utils/chartRendererNode';

// ...

// Получаем или создаем элемент canvas
const canvas = document.getElementById('my-canvas') as HTMLCanvasElement;
canvas.width = 1280;
canvas.height = 1280;

// Вызываем функцию рендеринга
const result = await renderChart({
  config,
  data,
  // width и height по умолчанию 1280x1280
  // В браузере:
  canvas
  // В Node.js:
  // outputPath: 'path/to/save/image.png'
});

// В браузере: result.canvas и result.base64
// В Node.js: result.buffer, result.base64
```

### Использование CLI-утилиты

В проект добавлена CLI-утилита для генерации графиков из командной строки:

```bash
# Запуск через npm script
npm run generate-chart -- --config examples/config.json --data examples/data.json --output output/chart.png

# Или напрямую через ts-node
npx ts-node src/cli/generateChart.ts --config examples/config.json --data examples/data.json --output output/chart.png
```

### Параметры CLI

```
--config <путь>   Путь к JSON-файлу с конфигурацией графика
--data <путь>     Путь к JSON-файлу с данными OHLCV
--output <путь>   Путь для сохранения изображения (по умолчанию: chart.png)
--width <число>   Ширина графика в пикселях (по умолчанию: 1280)
--height <число>  Высота графика в пикселях (по умолчанию: 1280)
--interval <тип>  Интервал для временных отметок (hour, day) (по умолчанию: hour)
--help, -h        Показать справку
```

### Формат данных

Данные должны быть в формате OHLCV:

```json
[
  [timestamp, open, high, low, close, volume],
  ...
]
```

Или в формате объектов:

```json
[
  {
    "timestamp": 1617235200,
    "open": 100,
    "high": 120,
    "low": 90,
    "close": 110,
    "volume": 1000
  },
  ...
]
```

### Формат конфигурации

Пример структуры конфигурации:

```json
{
  "background": {
    "color": "#0C0E16",
    "image": null
  },
  "font": {
    "family": "Arial",
    "size": 20,
    "color": "#FFFFFF"
  },
  "upBar": {
    "color": "#00FF00",
    "lineColor": "#00FF00",
    "lineWidth": 1,
    "borderColor": "#22FF22",
    "borderWidth": 1,
    "borderStyle": "outside",
    "body": null
  },
  "downBar": {
    "color": "#FF0000",
    "lineColor": "#FF0000",
    "lineWidth": 1,
    "borderColor": "#FF2222",
    "borderWidth": 1,
    "borderStyle": "outside",
    "body": null
  },
  "display": {
    "showTokenName": true,
    "showMarketCap": true,
    "showPrice": true,
    "showPriceChange": false,
    "showMinMax": true,
    "showTimeline": true
  }
}
```

## Примечания

1. Для работы в режиме Node.js требуется установленная библиотека skia-canvas
2. В браузере функция использует стандартный HTML5 Canvas API
3. Можно передать существующий canvas или получить новый для встраивания в DOM
4. На Windows может потребоваться установить дополнительные зависимости для работы skia-canvas 