# TChart Chart Generator

## Description

This script is designed for generating cryptocurrency charts using data obtained from the GeckoTerminal API. The script sends data to a local API server, which renders the chart using the chartRendererUniversal.js module.

The project also includes an image server to provide various chart elements via API.

## Requirements

- Python 3.6+
- Node.js
- Installed Python packages:
  - requests
  - argparse
- Installed Node.js packages:
  - express
  - body-parser
  - skia-canvas
  - uuid
  - cors
  - morgan

## Installation

1. Ensure that Python and Node.js are installed
2. Install the required Python packages:
   ```
   pip install requests
   ```
3. Install the required Node.js packages:
   ```
   npm install
   ```

## Usage

### Starting the Rendering Server

Before using the script, you need to start the API server for rendering:

```
npm start
```

or

```
node tChartServerAPI.js
```

The server will be available at http://localhost:3001

### Starting the Image Server

To start the image server, use:

```
npm run image-server
```

or

```
node imageServer.js
```

The image server will be available at http://localhost:3003

### Running the Chart Generator

```
python chart_generator.py <path_to_configuration_file.json> [--output filename.png]
```

Arguments:
- `<path_to_configuration_file.json>` - path to the JSON file with chart configuration
- `--output`, `-o` - path to save the generated chart (by default, the name with the current date and time is used)

### Configuration File Format

```json
{
  "background": {
    "color": "#000000",
    "opacity": 0.5,
    "image": {
      "url": "",
      "scale": 1,
      "offsetX": 0,
      "offsetY": 0
    }
  },
  "overlay": {
    "color": "#000000"
  },
  "font": {
    "family": "Arial",
    "size": 40,
    "color": "#ffffff"
  },
  "upBar": {
    "color": "#26a69a",
    "lineWidth": 1
  },
  "downBar": {
    "color": "#ef5350",
    "lineWidth": 1
  },
  "candle": {
    "color": "#00ff00",
    "lineWidth": 1
  },
  "knife": {
    "color": "#FF0700",
    "lineWidth": 1
  },
  "network": "polygon_pos",
  "poolAddress": "0xa030be97a53d6462c675962fec3eafbe53b8bb6c",
  "duration": 4,
  "numBars": 20,
  "interval": "hour"
}
```

## Example Usage

Create a configuration file with your chart parameters, for example `config.json`, and run:

```
python chart_generator.py config.json --output chart.png
```

## Important Configuration Parameters

- `network` - blockchain network (e.g., polygon_pos, ethereum)
- `poolAddress` - token pool address
- `interval` - data interval (hour, day, week, month)
- `upBar`, `downBar`, `candle`, `knife` - settings for displaying bars on the chart

## Additional Information

For more detailed information about the image server, see [README_image_server.md](README_image_server.md).

# tChartBot for Telegram

A Telegram bot that generates cryptocurrency charts on the `/chart` command in groups.

## Features

- Automatic creation of individual settings for each group
- Chart generation based on data from the GeckoTerminal API
- Sending charts as images to Telegram groups

## Installation and Setup

### Requirements

- Python 3.7+
- Installed and running chart rendering server (tChartServerAPI.js)

### Installing Dependencies

```bash
pip install -r requirements.txt
```

### Setup

1. Create a bot in Telegram via [@BotFather](https://t.me/BotFather) and get the bot token
2. Add the token to the `config_bot_tg.json` file:

```json
{
    "bot_token": "YOUR_BOT_TOKEN"
}
```

3. Ensure that the chart rendering server is running:

```bash
node tChartServerAPI.js
```

### Running the Bot

```bash
python tg_chart_bot.py
```

## Usage

1. Add the bot to a group
2. The bot will automatically create a configuration file for the group in the `groups` folder
3. Use the `/chart` command in the group to generate a chart

## Configuration

A separate configuration file in JSON format is created for each group in the `groups` folder. The file name corresponds to the group ID.

Main configuration parameters:

- `poolAddress` - token pool address for display
- `network` - blockchain network (e.g., "polygon_pos", "ethereum")
- `interval` - data interval (e.g., "hour", "day")
- `numBars` - number of candles on the chart

## Troubleshooting

- Ensure that the chart rendering server is running on port 3001
- Check file creation permissions in the `groups` folder
- Ensure that the bot has permission to send messages in the group 