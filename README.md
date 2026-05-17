# Chart Constructor Configuration Server

An Express.js-based server application for managing chart constructor configurations. The server provides an API to retrieve, create, and update chart visualization settings for different groups.

## Project Structure

```
/
├── server.js                    # Main server script
├── build/                       # React application build directory
│   ├── index.html               # Main client application HTML file
│   ├── static/                  # Static application assets
│   └── asset-manifest.json      # Resource manifest
└── bot/
    └── groups/                  # Directory containing group configurations
        └── [groupId].json       # Configuration file for a specific group
```

## Features

### API

The server provides the following API endpoints:

| Endpoint | Method | Description |
|----------|-------|----------|
| `/api/config/:groupId` | GET | Retrieve group configuration by ID and token |
| `/api/access-token` | POST | Generate a temporary access token for the configuration |
| `/api/config/:groupId` | PUT | Update group configuration |

### Access Tokens

API access is secured using temporary tokens:
- Tokens are generated upon requesting `/api/access-token`
- Token lifetime: 1 hour
- Tokens are stored in server memory (for a production application, using Redis or a database is recommended)

### Image Processing

The server handles images within configurations:
- Supports passing images in base64 format
- Automatically optimizes configuration size if it exceeds the limit (1 MB)

### CORS

CORS protection is configured to restrict access:
- Allowed origins: `http://localhost:3002`, `https://tchart.xyz`, `http://tchart.xyz`
- Allowed methods: `GET`, `POST`, `PUT`, `DELETE`, `OPTIONS`

## Running the Server

```bash
# Install dependencies
npm install

# Start the server
node server.js
```

By default, the server runs on port 3002. The port can be customized via the `PORT` environment variable.

## Configuration Format

The chart constructor configuration is stored in JSON format and can contain the following key elements:

- `background` - chart background settings
- `upBar` - bullish (upward) bar settings
- `downBar` - bearish (downward) bar settings
- `candle` - candlestick settings
- `knife` - knife settings

Each element can contain images in either URL or base64 format.

## Requirements

- Node.js 14+
- Express.js
- CORS
- File system access for storing configurations