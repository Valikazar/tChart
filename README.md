# Chart Constructor

Tool for creating and configuring cryptocurrency charts.

## Chart Generation

The library provides a flexible chart generation system using the standard Canvas API. The standard chart size is a square 1280x1280.

## Components

### ChartPreview Component

The main component for rendering charts with full control over appearance and behavior:

```tsx
import ChartPreview from './components/ChartPreview';

<ChartPreview
  config={config}
  data={data}
  tokenInfo={tokenInfo}
  interval="hour"
  width={1280}
  height={1280}
  isPreview={false}
/>
```

### AdaptiveChartContainer Component

A wrapper component that automatically adjusts the chart size to its container:

```tsx
import AdaptiveChartContainer from './components/AdaptiveChartContainer';

<AdaptiveChartContainer
  config={config}
  data={data}
  tokenInfo={tokenInfo}
  preserveAspectRatio={true} // Whether to maintain a 1:1 aspect ratio
  minHeight={400} // Minimum container height
  isPreview={false} // Whether to show preview mode
/>
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

### Configuration Format

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

### Features

1. Automatic scaling based on the number of bars and chart size
2. Support for custom bar styles (colors, borders, images)
3. Configurable display options (token name, market cap, price changes)
4. Enhanced text readability with shadows
5. Support for background images and overlays
6. Timeline display with automatic formatting
7. Price change indicators with color coding
8. Adaptive sizing with aspect ratio preservation option

### Technical Notes

1. Uses standard browser Canvas API for rendering
2. All chart components are fully configurable
3. Supports both static and responsive layouts
4. Optimized for performance with double buffering
5. Handles window resize events automatically
6. Supports both preview and full modes

## New: Adaptive Charts

The library now supports adaptive charts that automatically adjust to their container size, which significantly improves display across various devices and screen resolutions. Adaptive charts prevent overlapping with other UI elements (like accordions).

### Improved Information Display

* The current price and min/max prices are now displayed in the top right corner of the chart for better visibility
* All text elements (timeline labels, price changes) have enhanced shadows instead of semi-transparent backgrounds, which significantly improves their readability when using background images
* Price changes are always displayed on top of other chart elements, preventing them from being obscured by background images and overlays

## Notes

1. The library uses the standard browser Canvas API for rendering
2. All chart components are fully configurable
3. The same API works across all environments - no need to change your code
4. The library is optimized for performance with double buffering
5. All text elements have enhanced shadows for better readability 