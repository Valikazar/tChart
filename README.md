# Chart Constructor

Tool for creating and configuring cryptocurrency charts.

## Chart Generation

You can now generate charts in the browser using the standard Canvas API. The standard chart size is a square 1280x1280.

## New: Adaptive Charts

The library now supports adaptive charts that automatically adjust to their container size, which significantly improves display across various devices and screen resolutions. Adaptive charts prevent overlapping with other UI elements (like accordions).

### Improved Information Display

* The current price and min/max prices are now displayed in the top right corner of the chart for better visibility
* All text elements (timeline labels, price changes) have enhanced shadows instead of semi-transparent backgrounds, which significantly improves their readability when using background images
* Price changes are always displayed on top of other chart elements, preventing them from being obscured by background images and overlays

### Using the AdaptiveChartContainer Component

```tsx
import AdaptiveChartContainer from './components/AdaptiveChartContainer';

// In your component:
<AdaptiveChartContainer
  config={config}
  data={data}
  tokenInfo={tokenInfo}
  preserveAspectRatio={true} // Whether to maintain a 1:1 aspect ratio
  minHeight={400} // Minimum container height
  showDownloadButton={true} // Show download button
/>
```

Low-level functions are also available for more flexible configuration:

```tsx
import { renderAdaptiveChart, setupResizeObserver } from './utils/adaptiveChartRenderer';

// In your component with useRef and useEffect:
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
    
    // Automatic update when size changes
    const cleanup = setupResizeObserver(containerRef.current, renderChart);
    return cleanup;
  }
}, [data, config]);

// In JSX:
<div ref={containerRef} style={{ width: '100%', minHeight: '400px' }}></div>
```

### Installation

```bash
# Install dependencies
npm install
```

### Code Usage Examples

#### Browser Mode

```typescript
import { generateChartImage } from './utils/generateChartImage';
import defaultConfig from './config/defaultChartConfig';

// OHLCV data
const data = [
  [1617235200, 100, 120, 90, 110, 1000],
  [1617321600, 110, 130, 100, 120, 1200],
  // ...
];

// Use existing canvas
const canvas = document.getElementById('my-chart-canvas') as HTMLCanvasElement;

// Set canvas dimensions (standard is 1280x1280)
canvas.width = 1280;
canvas.height = 1280;

// Generate chart in browser
generateChartImage({
  config: defaultConfig,
  data,
  canvas,
  // width and height are optional - default is 1280x1280
})
.then(result => {
  // Canvas already contains the rendered chart
  // You can also use base64 to create an image
  const img = document.createElement('img');
  img.src = result.base64;
  document.body.appendChild(img);
})
.catch(error => {
  console.error('Error:', error);
});
```

### Direct Usage of renderChart Function

You can also use the base renderChart function directly:

```typescript
import { renderChart } from './utils/chartRendererUniversal';

// ...

// Get or create canvas element
const canvas = document.getElementById('my-canvas') as HTMLCanvasElement;
canvas.width = 1280;
canvas.height = 1280;

// Call the rendering function
const result = await renderChart({
  config,
  data,
  // width and height are 1280x1280 by default
  canvas
});

// Result contains: result.canvas and result.base64
```

### Data Format

Data must be in OHLCV format:

```json
[
  [timestamp, open, high, low, close, volume],
  ...
]
```

Or in object format:

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

### Format of Configuration

Example structure of configuration:

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

### Technical Notes

1. The chart renderer uses standard browser Canvas API for rendering
2. All chart components are fully configurable: colors, styles, and more
3. For backend rendering, consider using a headless browser or other server-side image generation libraries

## Notes

1. Both in Node.js and browser environments skia-canvas is used for rendering
2. In browser mode, a polyfill implementation of skia-canvas is provided automatically
3. You should include the skia-canvas-browser.js script before your application code
4. The same API works in both environments - no need to change your code between Node.js and browser
5. On Windows, you may need to install additional dependencies for skia-canvas 