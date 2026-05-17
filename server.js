const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { uniqueNamesGenerator, adjectives, colors, animals } = require('unique-names-generator');
const mysql = require('mysql2/promise');
const morgan = require('morgan');
// --- NFT Signer ---
const { generateMintSignature } = require('./NFT/signer');

console.log('🚀 [INIT] Starting server initialization...');
const startTime = Date.now();

const app = express();
const PORT = process.env.PORT || 3002;

console.log(`⏱️  [INIT] Express app created in ${Date.now() - startTime}ms`);

// Groups configuration directory
const GROUPS_DIR = path.join(__dirname, 'bot', 'groups');
const DC_GROUPS_DIR = path.join(__dirname, 'bot', 'dc_groups'); // Discord groups directory

// Temporary storage for access tokens (in a real application, better to use Redis or DB)
const accessTokens = {};

// CORS setup to allow requests from tchart.xyz
const corsOptions = {
  origin: ['http://localhost:3002', 'http://localhost:3000', 'http://localhost:3003', 'https://tchart.xyz', 'http://tchart.xyz', '*'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true, // Allow credentials (cookies, authorization headers)
  preflightContinue: false,
  optionsSuccessStatus: 204,
  exposedHeaders: ['Content-Disposition', 'Content-Length', 'Content-Type'] // For accessing headers from fetch API
};

console.log(`⏱️  [INIT] Setting up CORS...`);
app.use(cors(corsOptions));
console.log(`⏱️  [INIT] CORS configured in ${Date.now() - startTime}ms`);

// Increase JSON request size limit for handling large configurations
console.log(`⏱️  [INIT] Setting up body parsers...`);
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
console.log(`⏱️  [INIT] Body parsers configured in ${Date.now() - startTime}ms`);

console.log(`⏱️  [INIT] Setting up static file serving for /build...`);
app.use(express.static('build', {
  setHeaders: (res, path, stat) => {
    const fileStartTime = Date.now();
    const fileName = path.split('\\').pop();
    console.log(`📦 [STATIC] Serving file: ${fileName} (${Math.round(stat.size / 1024)}KB)`);
    res.on('finish', () => {
      console.log(`✅ [STATIC] Served ${fileName} in ${Date.now() - fileStartTime}ms`);
    });
  }
})); // Assuming the built React app is in the build directory
console.log(`⏱️  [INIT] Static /build configured in ${Date.now() - startTime}ms`);

console.log(`⏱️  [INIT] Setting up Morgan logger...`);
app.use(morgan('dev')); // Request logging
console.log(`⏱️  [INIT] Morgan configured in ${Date.now() - startTime}ms`);

console.log(`⏱️  [INIT] Setting up static file serving for /pic...`);
app.use('/pic', express.static(path.join(__dirname, 'pic'), {
  setHeaders: (res, filePath, stat) => {
    const fileStartTime = Date.now();
    const fileName = filePath.split('\\').pop();
    console.log(`🖼️  [STATIC/PIC] Serving image: ${fileName} (${Math.round(stat.size / 1024)}KB)`);
    res.on('finish', () => {
      console.log(`✅ [STATIC/PIC] Served ${fileName} in ${Date.now() - fileStartTime}ms`);
    });
  }
})); // Serve static files for images
console.log(`⏱️  [INIT] Static /pic configured in ${Date.now() - startTime}ms`);

// Add middleware for request logging
app.use((req, res, next) => {
  const reqStartTime = Date.now();
  console.log(`📨 [REQUEST] ${req.method} ${req.url} from ${req.headers.origin || 'unknown'}`);

  // Log when response is finished
  res.on('finish', () => {
    const duration = Date.now() - reqStartTime;
    console.log(`✅ [RESPONSE] ${req.method} ${req.url} - ${res.statusCode} (${duration}ms)`);
  });

  next();
});

// --- MariaDB connection ---
const mariadbConfig = {
  host: process.env.MARIA_HOST || '127.0.0.1', // Explicitly use IPv4
  user: process.env.MARIA_USER || 'root',
  password: process.env.MARIA_PASSWORD || 'root', // Update with correct password
  database: process.env.MARIA_DB || 'tchart',
  port: process.env.MARIA_PORT ? parseInt(process.env.MARIA_PORT) : 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

let mariadbPool;
(async () => {
  try {
    console.log(`⏱️  [DB] Connecting to MariaDB at ${mariadbConfig.host}:${mariadbConfig.port}...`);
    const dbStartTime = Date.now();
    mariadbPool = await mysql.createPool(mariadbConfig);
    console.log(`⏱️  [DB] MariaDB pool created in ${Date.now() - dbStartTime}ms`);

    // Ensure table usernames exists
    console.log(`⏱️  [DB] Creating/checking usernames table...`);
    const usernamesTableStart = Date.now();
    await mariadbPool.query(`
      CREATE TABLE IF NOT EXISTS usernames (
        address VARCHAR(64) PRIMARY KEY,
        username VARCHAR(64) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log(`⏱️  [DB] Usernames table ready in ${Date.now() - usernamesTableStart}ms`);

    // Ensure table presets exists
    console.log(`⏱️  [DB] Creating/checking presets table...`);
    const presetsTableStart = Date.now();
    await mariadbPool.query(`
      CREATE TABLE IF NOT EXISTS presets (
        id INT AUTO_INCREMENT PRIMARY KEY,
        owner VARCHAR(64) NOT NULL,
        name VARCHAR(64) NOT NULL,
        genre VARCHAR(32) NOT NULL,
        approved BOOLEAN DEFAULT FALSE,
        public BOOLEAN DEFAULT FALSE,
        uses INT DEFAULT 0,
        tags TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_owner_name (owner, name)
      )
    `);
    console.log(`⏱️  [DB] Presets table ready in ${Date.now() - presetsTableStart}ms`);

    // Ensure table preset_likes exists for tracking individual user likes
    console.log(`⏱️  [DB] Creating/checking preset_likes table...`);
    const presetLikesTableStart = Date.now();
    await mariadbPool.query(`
    CREATE TABLE IF NOT EXISTS preset_likes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      preset_id INT NOT NULL,
      user_address VARCHAR(64) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_preset_user (preset_id, user_address),
      FOREIGN KEY (preset_id) REFERENCES presets(id) ON DELETE CASCADE
    )
  `);
    console.log(`⏱️  [DB] Preset_likes table ready in ${Date.now() - presetLikesTableStart}ms`);

    // Add public column if it doesn't exist (migration)
    try {
      console.log(`⏱️  [DB] Checking public column migration...`);
      await mariadbPool.query(`
      ALTER TABLE presets ADD COLUMN public BOOLEAN DEFAULT FALSE
    `);
      console.log('✅ [DB] Added public column to presets table');
    } catch (e) {
      // Column already exists, ignore error
      if (!e.message.includes('Duplicate column name')) {
        console.error('❌ [DB] Error adding public column:', e);
      }
    }

    // Add autopost_title and autopost_text columns to subreddit_settings if they don't exist (migration)
    try {
      console.log(`⏱️  [DB] Checking autopost_title column migration...`);
      await mariadbPool.query(`
      ALTER TABLE subreddit_settings ADD COLUMN autopost_title VARCHAR(500) DEFAULT NULL
    `);
      console.log('✅ [DB] Added autopost_title column to subreddit_settings table');
    } catch (e) {
      // Column already exists, ignore error
      if (!e.message.includes('Duplicate column name')) {
        console.error('❌ [DB] Error adding autopost_title column:', e);
      }
    }

    try {
      console.log(`⏱️  [DB] Checking autopost_text column migration...`);
      await mariadbPool.query(`
      ALTER TABLE subreddit_settings ADD COLUMN autopost_text TEXT DEFAULT NULL
    `);
      console.log('✅ [DB] Added autopost_text column to subreddit_settings table');
    } catch (e) {
      // Column already exists, ignore error
      if (!e.message.includes('Duplicate column name')) {
        console.error('❌ [DB] Error adding autopost_text column:', e);
      }
    }

    // Ensure table images exists
    console.log(`⏱️  [DB] Creating/checking images table...`);
    const imagesTableStart = Date.now();
    await mariadbPool.query(`
    CREATE TABLE IF NOT EXISTS images (
      id INT AUTO_INCREMENT PRIMARY KEY,
      owner VARCHAR(64) NOT NULL,
      name VARCHAR(64) NOT NULL,
      class VARCHAR(32) NOT NULL,
      genre VARCHAR(64),
      approved BOOLEAN DEFAULT FALSE,
      uses INT DEFAULT 0,
      scale DECIMAL(5,2),
      x_offset INT,
      y_offset INT,
      rotation INT,
      overlap INT,
      color VARCHAR(16),
      mirrored BOOLEAN DEFAULT FALSE,
      tags TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_owner_name_class (owner, name, class)
    )
  `);
    console.log(`⏱️  [DB] Images table ready in ${Date.now() - imagesTableStart}ms`);

    // Ensure table subreddit_settings exists (simplified version)
    try {
      console.log(`⏱️  [DB] Creating/checking subreddit_settings table...`);
      const subredditTableStart = Date.now();
      await mariadbPool.query(`
      CREATE TABLE IF NOT EXISTS subreddit_settings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        subreddit VARCHAR(100) NOT NULL,
        user_address VARCHAR(64) NOT NULL,
        settings TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
      console.log(`⏱️  [DB] Subreddit_settings table ready in ${Date.now() - subredditTableStart}ms`);

      // Add unique constraint separately
      try {
        await mariadbPool.query(`
        ALTER TABLE subreddit_settings 
        ADD CONSTRAINT unique_subreddit_user UNIQUE (subreddit, user_address)
      `);
        console.log('✅ Unique constraint added successfully');
      } catch (e) {
        if (e.message.includes('Duplicate key name')) {
          console.log('ℹ️ Unique constraint already exists');
        } else {
          console.error('❌ Error adding unique constraint:', e.message);
        }
      }

      // Add indexes separately
      try {
        await mariadbPool.query(`CREATE INDEX idx_subreddit ON subreddit_settings (subreddit)`);
        console.log('✅ Index idx_subreddit created successfully');
      } catch (e) {
        if (e.message.includes('Duplicate key name')) {
          console.log('ℹ️ Index idx_subreddit already exists');
        } else {
          console.error('❌ Error creating index idx_subreddit:', e.message);
        }
      }

      try {
        await mariadbPool.query(`CREATE INDEX idx_user ON subreddit_settings (user_address)`);
        console.log('✅ Index idx_user created successfully');
      } catch (e) {
        if (e.message.includes('Duplicate key name')) {
          console.log('ℹ️ Index idx_user already exists');
        } else {
          console.error('❌ Error creating index idx_user:', e.message);
        }
      }

      try {
        await mariadbPool.query(`CREATE INDEX idx_updated_at ON subreddit_settings (updated_at)`);
        console.log('✅ Index idx_updated_at created successfully');
      } catch (e) {
        if (e.message.includes('Duplicate key name')) {
          console.log('ℹ️ Index idx_updated_at already exists');
        } else {
          console.error('❌ Error creating index idx_updated_at:', e.message);
        }
      }

    } catch (error) {
      console.error('❌ [DB] Error creating subreddit_settings table:', error);
      throw error;
    }

    // Ensure table nfts exists
    console.log(`⏱️  [DB] Creating/checking nfts table...`);
    const nftsTableStart = Date.now();
    await mariadbPool.query(`
      CREATE TABLE IF NOT EXISTS nfts (
        id INT PRIMARY KEY,
        token_uri VARCHAR(255) NOT NULL,
        is_minted TINYINT DEFAULT 0,
        reserved_at TIMESTAMP NULL,
        reserved_by VARCHAR(64) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Ensure new columns exist for existing tables
    try {
      await mariadbPool.query("ALTER TABLE nfts ADD COLUMN IF NOT EXISTS reserved_at TIMESTAMP NULL");
      await mariadbPool.query("ALTER TABLE nfts ADD COLUMN IF NOT EXISTS reserved_by VARCHAR(64) NULL");
      await mariadbPool.query("ALTER TABLE nfts MODIFY COLUMN is_minted TINYINT DEFAULT 0");
    } catch (e) {
      console.log("ℹ️ Columns in nfts table already exists or modified");
    }

    // CLEANUP: Reset stale reservations (older than 15 mins) on startup
    await mariadbPool.query("UPDATE nfts SET is_minted = 0, reserved_at = NULL, reserved_by = NULL WHERE is_minted = 2 AND reserved_at < DATE_SUB(NOW(), INTERVAL 15 MINUTE)");
    console.log("🧹 [DB] Stale NFT reservations cleared on startup");

    console.log(`⏱️  [DB] Nfts table ready in ${Date.now() - nftsTableStart}ms`);

    console.log(`✅ [DB] All database tables initialized successfully in ${Date.now() - dbStartTime}ms`);
    console.log(`🎉 [INIT] Server initialization completed in ${Date.now() - startTime}ms`);

  } catch (error) {
    console.error('❌ [DB] Fatal error during database initialization:', error);
    process.exit(1);
  }
})();

// --- Username API with MariaDB ---
// Get all usernames (for frontend)
app.get('/api/usernames.json', async (req, res) => {
  try {
    const [rows] = await mariadbPool.query('SELECT address, username FROM usernames');
    const map = {};
    rows.forEach(row => { map[row.address] = row.username; });
    res.json(map);
  } catch (e) {
    res.status(500).json({ error: 'DB error' });
  }
});

// Generate unique nickname considering DB
async function generateUniqueNicknameMaria() {
  let nickname;
  let tries = 0;
  let exists = true;
  while (exists && tries < 20) {
    nickname = uniqueNamesGenerator({
      dictionaries: [adjectives, colors, animals],
      separator: '-',
      style: 'lowerCase',
    });
    const [rows] = await mariadbPool.query('SELECT 1 FROM usernames WHERE username = ?', [nickname]);
    exists = rows.length > 0;
    tries++;
  }
  return nickname;
}

app.get('/api/generate-nickname', async (req, res) => {
  try {
    const nickname = await generateUniqueNicknameMaria();
    res.json({ nickname });
  } catch (e) {
    res.status(500).json({ error: 'DB error' });
  }
});

app.post('/api/user-set-username', async (req, res) => {
  const { address, username } = req.body;
  if (!address) return res.status(400).json({ error: 'No address' });
  if (!username) return res.status(400).json({ error: 'No username' });
  try {
    // Check uniqueness
    const [rows] = await mariadbPool.query('SELECT 1 FROM usernames WHERE username = ?', [username]);
    if (rows.length > 0) {
      return res.status(409).json({ error: 'Username already taken' });
    }
    // Insert or update
    await mariadbPool.query(
      'INSERT INTO usernames (address, username) VALUES (?, ?) ON DUPLICATE KEY UPDATE username = VALUES(username)',
      [address, username]
    );
    res.json({ success: true, username });
  } catch (e) {
    res.status(500).json({ error: 'DB error' });
  }
});

// Automatic registration of new user with random name generation
app.post('/api/user-auto-register', async (req, res) => {
  const { address } = req.body;
  if (!address) return res.status(400).json({ error: 'No address' });

  try {
    // Check if user with this address already exists
    const [existingRows] = await mariadbPool.query('SELECT username FROM usernames WHERE address = ?', [address]);

    if (existingRows.length > 0) {
      // User already exists, return current name
      return res.json({ success: true, username: existingRows[0].username, alreadyExists: true });
    }

    // Generate unique name for new user
    const username = await generateUniqueNicknameMaria();

    // Insert new user
    await mariadbPool.query(
      'INSERT INTO usernames (address, username) VALUES (?, ?)',
      [address, username]
    );

    console.log(`Auto-registered new user: ${address} with username: ${username}`);
    res.json({ success: true, username, alreadyExists: false });
  } catch (e) {
    console.error('Error in auto-register:', e);
    res.status(500).json({ error: 'DB error' });
  }
});

// Endpoint for getting configuration by group ID and token
app.get('/api/config/:groupId', (req, res) => {
  try {
    console.log('GET /api/config/:groupId request received:', req.params);
    const { groupId } = req.params;
    const { token } = req.query;

    // Token validation check
    if (!token || !accessTokens[groupId] || accessTokens[groupId].token !== token) {
      console.log('Unauthorized access attempt:', { groupId, token });
      return res.status(403).json({ error: 'Unauthorized access' });
    }

    // Token expiration check
    if (accessTokens[groupId].expires < Date.now()) {
      console.log('Token expired for groupId:', groupId);
      delete accessTokens[groupId];
      return res.status(403).json({ error: 'Token expired' });
    }

    // Read configuration file
    const configPath = findConfigPath(groupId);
    if (!configPath) {
      console.log('Configuration not found at path:', configPath);
      return res.status(404).json({ error: 'Configuration not found' });
    }

    const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    console.log('Configuration successfully returned for groupId:', groupId);
    res.json(configData);
  } catch (error) {
    console.error('Error getting configuration:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Endpoint for creating configuration access token
app.post('/api/access-token', (req, res) => {
  try {
    console.log('POST /api/access-token request received:', req.body);
    const { groupId, adminId } = req.body;

    // Here should be admin rights check, but skipped for simplification

    // Read configuration file to check existence
    const configPath = findConfigPath(groupId);
    if (!configPath) {
      console.log('Configuration not found at path:', configPath);
      return res.status(404).json({ error: 'Configuration not found' });
    }

    // Token generation
    const token = crypto.randomBytes(32).toString('hex');

    // Save token with 1 hour lifetime
    accessTokens[groupId] = {
      token,
      expires: Date.now() + 3600000, // 1 hour in milliseconds
      adminId
    };

    console.log('Access token created for groupId:', groupId);
    res.json({
      token,
      url: `${req.protocol}://${req.get('host')}/?config=${groupId}&token=${token}`
    });
  } catch (error) {
    console.error('Error creating access token:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Function for processing base64 images
function processBase64Images(config) {
  // Copy configuration for safe modification
  const processedConfig = JSON.parse(JSON.stringify(config));

  // Process background image
  if (processedConfig.background && processedConfig.background.image && processedConfig.background.image.url) {
    if (processedConfig.background.image.url.startsWith('data:')) {
      console.log('Processing background image in base64 format');
      // Keep base64 as it's already compressed on client
    }
  }

  // Process bar images
  ['upBar', 'downBar', 'candle', 'knife'].forEach(barType => {
    if (processedConfig[barType]) {
      ['top', 'body', 'bottom', 'center'].forEach(partType => {
        if (processedConfig[barType][partType] && processedConfig[barType][partType].url) {
          if (processedConfig[barType][partType].url.startsWith('data:')) {
            console.log(`Processing ${barType}.${partType} image in base64 format`);
            // Keep base64 as it's already compressed on client
          }
        }
      });
    }
  });

  return processedConfig;
}

// Endpoint for updating group configuration
app.put('/api/config/:groupId', (req, res) => {
  try {
    console.log('PUT /api/config/:groupId request received:', req.params);
    const { groupId } = req.params;
    const { token, config } = req.body;

    // Token validation check
    if (!token || !accessTokens[groupId] || accessTokens[groupId].token !== token) {
      console.log('Unauthorized access attempt:', { groupId, token });
      return res.status(403).json({ error: 'Unauthorized access' });
    }

    // Token expiration check
    if (accessTokens[groupId].expires < Date.now()) {
      console.log('Token expired for groupId:', groupId);
      delete accessTokens[groupId];
      return res.status(403).json({ error: 'Token expired' });
    }

    // Configuration presence check
    if (!config) {
      return res.status(400).json({ error: 'No configuration provided' });
    }

    // Read current configuration file
    const configPath = findConfigPath(groupId);
    if (!configPath) {
      console.log('Configuration not found at path:', configPath);
      return res.status(404).json({ error: 'Configuration not found' });
    }

    // Read existing configuration to preserve critical fields
    let existingConfig = {};
    try {
      const existingConfigData = fs.readFileSync(configPath, 'utf8');
      existingConfig = JSON.parse(existingConfigData);
    } catch (err) {
      console.log('Could not read existing config, will create new one');
    }

    // Preserve critical fields from existing configuration
    const preservedFields = {
      last_poster_time: existingConfig.last_poster_time || 0,
      auto_post_channel_id: existingConfig.auto_post_channel_id,
      minimal_duration: existingConfig.minimal_duration || 0.02,
      free: existingConfig.free || false
    };

    console.log('Preserving critical fields:', preservedFields);

    // Process base64 images
    const processedConfig = processBase64Images(config);

    // Merge processed config with preserved fields
    Object.assign(processedConfig, preservedFields);

    console.log('Final config with preserved fields:', {
      last_poster_time: processedConfig.last_poster_time,
      auto_post_channel_id: processedConfig.auto_post_channel_id,
      minimal_duration: processedConfig.minimal_duration,
      free: processedConfig.free
    });

    // Check processed configuration size
    const configSize = JSON.stringify(processedConfig).length;
    console.log(`Processed configuration size: ${configSize} bytes`);

    // If size is too large, remove all base64 data
    if (configSize > 1024 * 1024) { // More than 1 MB
      console.log('Configuration size too large, removing all base64 data');
      // Remove large image URLs in base64 format
      if (processedConfig.background.image && processedConfig.background.image.url && processedConfig.background.image.url.startsWith('data:')) {
        processedConfig.background.image.url = '';
      }

      // Clear large URLs in bar configurations
      ['upBar', 'downBar', 'candle', 'knife'].forEach((barType) => {
        const bar = processedConfig[barType];
        ['top', 'body', 'bottom', 'center'].forEach((partType) => {
          const part = bar[partType];
          if (part && part.url && part.url.startsWith('data:')) {
            part.url = '';
          }
        });
      });
    }

    // Write updated configuration to file
    fs.writeFileSync(configPath, JSON.stringify(processedConfig, null, 2), 'utf8');

    console.log('Configuration successfully updated for groupId:', groupId);
    res.json({ success: true, message: 'Configuration updated successfully' });
  } catch (error) {
    console.error('Error updating configuration:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- Presets API ---
const SUPREME_ADMIN = '0xf7427BD018809723e778Be7EaE4FaB6C81474C70';
const PRESETS_DIR = path.join(__dirname, 'pic', 'presets');

// Create presets directory if it doesn't exist
if (!fs.existsSync(PRESETS_DIR)) {
  console.log('Creating presets directory:', PRESETS_DIR);
  fs.mkdirSync(PRESETS_DIR, { recursive: true });
}

// Remove old creators directory if it exists to avoid duplication
const CREATORS_DIR = path.join(__dirname, 'pic', 'presets', 'creators');
if (fs.existsSync(CREATORS_DIR)) {
  console.log('Removing creators directory:', CREATORS_DIR);
  try {
    fs.rmSync(CREATORS_DIR, { recursive: true, force: true });
    console.log('Creators directory removed');
  } catch (err) {
    console.error('Failed to remove creators directory:', err);
  }
}

// Get presets list (filtering by owner/approved)
app.get('/api/presets-list', async (req, res) => {
  const { address, public, user_address } = req.query;
  try {
    let query = 'SELECT p.* FROM presets p';
    let params = [];

    if (public === 'true') {
      // Public presets (only approved)
      query += ' WHERE p.approved = TRUE';
    } else if (address) {
      if (address === SUPREME_ADMIN) {
        // For superadmin show all presets without filtering
      } else {
        // For regular user - own presets and approved presets from other users
        query += ' WHERE (p.owner = ? OR p.approved = TRUE)';
        params.push(address);
      }
    } else {
      // If address not specified, return only approved presets
      query += ' WHERE p.approved = TRUE';
    }

    const [rows] = await mariadbPool.query(query, params);

    // Count likes from preset_likes table for each preset
    if (rows.length > 0) {
      const presetIds = rows.map(row => row.id);
      const placeholders = presetIds.map(() => '?').join(',');
      const [likesRows] = await mariadbPool.query(
        `SELECT preset_id, COUNT(*) as count FROM preset_likes WHERE preset_id IN (${placeholders}) GROUP BY preset_id`,
        presetIds
      );
      const likesMap = new Map(likesRows.map(row => [row.preset_id, row.count]));
      rows.forEach(row => {
        row.likes = likesMap.get(row.id) || 0;
      });
    }

    // If user_address is provided, check which presets are liked by this user
    if (user_address && rows.length > 0) {
      const presetIds = rows.map(row => row.id);
      const placeholders = presetIds.map(() => '?').join(',');

      const [likeRows] = await mariadbPool.query(
        `SELECT preset_id FROM preset_likes WHERE preset_id IN (${placeholders}) AND user_address = ?`,
        [...presetIds, user_address]
      );

      const likedPresetIds = new Set(likeRows.map(row => row.preset_id));

      // Add liked status to each preset
      rows.forEach(preset => {
        preset.user_liked = likedPresetIds.has(preset.id);
      });
    }

    console.log(`Preset list request. Found ${rows.length} presets.`);
    res.json(rows);
  } catch (e) {
    console.error('Error getting presets:', e);
    res.status(500).json({ error: 'DB error' });
  }
});

// Create new preset
app.post('/api/presets-create', async (req, res) => {
  const { owner, genre, name, imageBase64, config, tags } = req.body;
  if (!owner || !genre || !name || !imageBase64) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Check valid characters in preset name (only Latin letters, numbers, hyphens and underscores)
  const nameRegex = /^[a-zA-Z0-9_-]+$/;
  if (!nameRegex.test(name)) {
    return res.status(400).json({
      error: 'Preset name can only contain Latin letters, numbers, hyphens and underscores'
    });
  }

  // Check name length
  if (name.length > 32) {
    return res.status(400).json({
      error: 'Preset name cannot be longer than 32 characters'
    });
  }

  // Use checked name as safe
  const safeName = name;
  try {
    // Check existence
    const [rows] = await mariadbPool.query('SELECT 1 FROM presets WHERE owner = ? AND name = ?', [owner, safeName]);
    if (rows.length > 0) {
      return res.status(409).json({ error: 'Preset with this name already exists' });
    }

    // Process tags
    let tagsString = null;
    if (tags && Array.isArray(tags) && tags.length > 0) {
      // Clean tags from empty and convert to lowercase
      const cleanTags = tags
        .filter(tag => tag && typeof tag === 'string' && tag.trim().length > 0)
        .map(tag => tag.trim().toLowerCase())
        .slice(0, 10); // Limit to maximum 10 tags

      if (cleanTags.length > 0) {
        tagsString = JSON.stringify(cleanTags);
      }
    }

    // Save preset image in JPEG format (already resized on client to 200x200)
    const presetImgPath = path.join(PRESETS_DIR, `${safeName}.jpg`);
    const base64Data = imageBase64.replace(/^data:image\/[^;]+;base64,/, '');

    try {
      // Save image directly (it's already resized and converted to JPEG on client)
      fs.writeFileSync(presetImgPath, base64Data, 'base64');
      console.log(`Preset image saved as JPEG: ${presetImgPath}`);
    } catch (saveError) {
      console.error('Error saving preset image:', saveError);
      throw new Error('Failed to save preset image');
    }

    // Save JSON with configuration
    if (config) {
      const presetConfigPath = path.join(PRESETS_DIR, `${safeName}.json`);
      fs.writeFileSync(presetConfigPath, JSON.stringify(config, null, 2), 'utf8');
      console.log(`Saved config with size: ${JSON.stringify(config).length} bytes`);
    }

    // Save record in DB with tags
    const [result] = await mariadbPool.query(
      'INSERT INTO presets (owner, name, genre, approved, public, uses, tags) VALUES (?, ?, ?, FALSE, FALSE, 0, ?)',
      [owner, safeName, genre, tagsString]
    );

    console.log(`Preset saved: ${safeName} by ${owner}${tagsString ? ` with tags: ${tagsString}` : ''}`);
    res.json({ success: true, id: result.insertId, name: safeName });
  } catch (e) {
    console.error('Error saving preset:', e);
    res.status(500).json({ error: 'DB error' });
  }
});

// Approve preset (only for superadmin)
app.post('/api/presets-approve', async (req, res) => {
  const { id, admin } = req.body;
  if (admin !== SUPREME_ADMIN) return res.status(403).json({ error: 'Forbidden' });
  try {
    await mariadbPool.query('UPDATE presets SET approved = TRUE WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'DB error' });
  }
});

// Unapprove preset (only for superadmin)
app.post('/api/presets-unapprove', async (req, res) => {
  const { id, admin } = req.body;
  if (admin !== SUPREME_ADMIN) return res.status(403).json({ error: 'Forbidden' });
  try {
    await mariadbPool.query('UPDATE presets SET approved = FALSE WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'DB error' });
  }
});

// Approve image (only for superadmin)
app.post('/api/images-approve', async (req, res) => {
  const { id, admin } = req.body;
  if (admin !== SUPREME_ADMIN) return res.status(403).json({ error: 'Forbidden' });
  try {
    await mariadbPool.query('UPDATE images SET approved = TRUE WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'DB error' });
  }
});

// Change preset public status (only owner can make their preset public)
app.post('/api/presets-toggle-public', async (req, res) => {
  const { id, owner } = req.body;
  if (!owner) return res.status(400).json({ error: 'Owner address required' });

  try {
    // Check that preset belongs to user
    const [rows] = await mariadbPool.query('SELECT owner, public FROM presets WHERE id = ?', [id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Preset not found' });
    }

    const preset = rows[0];

    // Check access rights (only owner can change public status)
    if (preset.owner !== owner) {
      return res.status(403).json({ error: 'Only preset owner can change public status' });
    }

    // Toggle public status
    const newPublicStatus = !preset.public;
    await mariadbPool.query('UPDATE presets SET public = ? WHERE id = ?', [newPublicStatus, id]);

    res.json({ success: true, public: newPublicStatus });
  } catch (e) {
    console.error('Error toggling preset public status:', e);
    res.status(500).json({ error: 'DB error' });
  }
});

// Toggle preset like (add/remove like)
app.post('/api/presets-toggle-like', async (req, res) => {
  const { preset_id, user_address } = req.body;

  if (!preset_id || !user_address) {
    return res.status(400).json({ error: 'Missing preset_id or user_address' });
  }

  try {
    // Check if preset exists
    const [presetRows] = await mariadbPool.query('SELECT id FROM presets WHERE id = ?', [preset_id]);
    if (presetRows.length === 0) {
      return res.status(404).json({ error: 'Preset not found' });
    }

    // Check if user already liked this preset
    const [likeRows] = await mariadbPool.query(
      'SELECT id FROM preset_likes WHERE preset_id = ? AND user_address = ?',
      [preset_id, user_address]
    );

    if (likeRows.length > 0) {
      // User already liked - remove like
      await mariadbPool.query(
        'DELETE FROM preset_likes WHERE preset_id = ? AND user_address = ?',
        [preset_id, user_address]
      );

      // Count likes from preset_likes table
      const [countRows] = await mariadbPool.query('SELECT COUNT(*) as count FROM preset_likes WHERE preset_id = ?', [preset_id]);
      const likesCount = countRows[0]?.count || 0;

      res.json({
        success: true,
        liked: false,
        likes: likesCount,
        message: 'Like removed'
      });
    } else {
      // User hasn't liked - add like
      await mariadbPool.query(
        'INSERT INTO preset_likes (preset_id, user_address) VALUES (?, ?)',
        [preset_id, user_address]
      );

      // Count likes from preset_likes table
      const [countRows] = await mariadbPool.query('SELECT COUNT(*) as count FROM preset_likes WHERE preset_id = ?', [preset_id]);
      const likesCount = countRows[0]?.count || 0;

      res.json({
        success: true,
        liked: true,
        likes: likesCount,
        message: 'Like added'
      });
    }
  } catch (e) {
    console.error('Error toggling preset like:', e);
    res.status(500).json({ error: 'DB error' });
  }
});

// Get user's liked presets
app.get('/api/user-liked-presets/:address', async (req, res) => {
  const { address } = req.params;

  try {
    const [rows] = await mariadbPool.query(`
      SELECT p.*, pl.created_at as liked_at 
      FROM presets p 
      INNER JOIN preset_likes pl ON p.id = pl.preset_id 
      WHERE pl.user_address = ? 
      ORDER BY pl.created_at DESC
    `, [address]);

    // Parse tags for each preset
    const presets = rows.map(preset => ({
      ...preset,
      tags: preset.tags ? JSON.parse(preset.tags) : []
    }));

    res.json({ success: true, presets });
  } catch (e) {
    console.error('Error getting user liked presets:', e);
    res.status(500).json({ error: 'DB error' });
  }
});

// Check if user liked specific preset
app.get('/api/preset-liked/:preset_id/:user_address', async (req, res) => {
  const { preset_id, user_address } = req.params;

  try {
    const [rows] = await mariadbPool.query(
      'SELECT id FROM preset_likes WHERE preset_id = ? AND user_address = ?',
      [preset_id, user_address]
    );

    res.json({
      success: true,
      liked: rows.length > 0
    });
  } catch (e) {
    console.error('Error checking preset like status:', e);
    res.status(500).json({ error: 'DB error' });
  }
});

// Legacy endpoint for backward compatibility
app.post('/api/presets-like', async (req, res) => {
  const { id } = req.body;
  try {
    // Count likes from preset_likes table
    const [countRows] = await mariadbPool.query('SELECT COUNT(*) as count FROM preset_likes WHERE preset_id = ?', [id]);
    const likesCount = countRows[0]?.count || 0;
    res.json({ success: true, likes: likesCount });
  } catch (e) {
    res.status(500).json({ error: 'DB error' });
  }
});

// Increment preset usage counter
app.post('/api/presets-use', async (req, res) => {
  const { id } = req.body;
  try {
    await mariadbPool.query('UPDATE presets SET uses = uses + 1 WHERE id = ?', [id]);
    const [rows] = await mariadbPool.query('SELECT uses FROM presets WHERE id = ?', [id]);
    res.json({ success: true, uses: rows[0]?.uses || 0 });
  } catch (e) {
    console.error('Error updating preset uses count:', e);
    res.status(500).json({ error: 'DB error' });
  }
});

// Update existing preset
app.post('/api/presets-update', async (req, res) => {
  const { id, owner, genre, name, imageBase64, config, tags } = req.body;
  if (!id || !owner || !genre || !name || !imageBase64) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Check valid characters in preset name (only Latin letters, numbers, hyphens and underscores)
  const nameRegex = /^[a-zA-Z0-9_-]+$/;
  if (!nameRegex.test(name)) {
    return res.status(400).json({
      error: 'Preset name can only contain Latin letters, numbers, hyphens and underscores'
    });
  }

  // Проверка длины имени
  if (name.length > 32) {
    return res.status(400).json({
      error: 'Preset name cannot be longer than 32 characters'
    });
  }

  try {
    // Проверяем, что пресет существует и принадлежит пользователю
    const [rows] = await mariadbPool.query('SELECT owner, name, approved FROM presets WHERE id = ?', [id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Preset not found' });
    }

    const preset = rows[0];
    const isAdmin = owner === SUPREME_ADMIN;

    // Проверяем права доступа
    // Суперюзер может редактировать любые пресеты, владелец - только свои
    if (!isAdmin && preset.owner !== owner) {
      return res.status(403).json({ error: 'Only preset owner can update preset' });
    }

    // Обработка тегов
    let tagsString = null;
    if (tags && Array.isArray(tags) && tags.length > 0) {
      // Очищаем теги от пустых и приводим к нижнему регистру
      const cleanTags = tags
        .filter(tag => tag && typeof tag === 'string' && tag.trim().length > 0)
        .map(tag => tag.trim().toLowerCase())
        .slice(0, 10); // Ограничиваем максимум 10 тегами

      if (cleanTags.length > 0) {
        tagsString = JSON.stringify(cleanTags);
      }
    }

    // Используем новое имя или оставляем старое
    const finalName = name;

    // Если имя пресета изменилось, нужно переименовать файлы
    const oldName = preset.name;
    const nameChanged = oldName !== finalName;

    // Обновляем изображение пресета в формате JPEG
    const presetImgPath = path.join(PRESETS_DIR, `${finalName}.jpg`);
    const base64Data = imageBase64.replace(/^data:image\/[^;]+;base64,/, '');

    try {
      // Сохраняем новое изображение
      fs.writeFileSync(presetImgPath, base64Data, 'base64');
      console.log(`Updated preset image: ${presetImgPath}`);

      // Если имя изменилось, удаляем старые файлы
      if (nameChanged) {
        const oldImgPath = path.join(PRESETS_DIR, `${oldName}.jpg`);
        const oldPngPath = path.join(PRESETS_DIR, `${oldName}.png`); // На случай старого формата

        try {
          if (fs.existsSync(oldImgPath)) {
            fs.unlinkSync(oldImgPath);
            console.log(`Deleted old image: ${oldImgPath}`);
          }
          if (fs.existsSync(oldPngPath)) {
            fs.unlinkSync(oldPngPath);
            console.log(`Deleted old PNG image: ${oldPngPath}`);
          }
        } catch (deleteError) {
          console.error('Error deleting old image files:', deleteError);
        }
      }
    } catch (saveError) {
      console.error('Error saving preset image:', saveError);
      throw new Error('Failed to save preset image');
    }

    // Обновляем JSON с конфигурацией
    if (config) {
      const presetConfigPath = path.join(PRESETS_DIR, `${finalName}.json`);
      fs.writeFileSync(presetConfigPath, JSON.stringify(config, null, 2), 'utf8');
      console.log(`Updated config with size: ${JSON.stringify(config).length} bytes`);

      // Если имя изменилось, удаляем старый файл конфигурации
      if (nameChanged) {
        const oldConfigPath = path.join(PRESETS_DIR, `${oldName}.json`);
        try {
          if (fs.existsSync(oldConfigPath)) {
            fs.unlinkSync(oldConfigPath);
            console.log(`Deleted old config: ${oldConfigPath}`);
          }
        } catch (deleteError) {
          console.error('Error deleting old config file:', deleteError);
        }
      }
    }

    // Обновляем запись в БД
    // Для суперюзера: не меняем владельца, если пресет уже существует
    // Для обычного пользователя: обновляем как обычно
    const updateOwner = isAdmin ? preset.owner : owner; // Сохраняем оригинального владельца для суперюзера

    await mariadbPool.query(
      'UPDATE presets SET owner = ?, name = ?, genre = ?, tags = ? WHERE id = ?',
      [updateOwner, finalName, genre, tagsString, id]
    );

    console.log(`Preset updated: ${finalName} (ID: ${id}) by ${owner} (original owner: ${updateOwner})${tagsString ? ` with tags: ${tagsString}` : ''}`);
    res.json({ success: true, message: 'Preset updated successfully' });
  } catch (e) {
    console.error('Error updating preset:', e);
    res.status(500).json({ error: 'DB error' });
  }
});

// Удаление пресета (владелец может удалить неопубликованный пресет, админ может удалить любой)
app.post('/api/presets-delete', async (req, res) => {
  const { id, owner } = req.body;
  if (!owner) return res.status(400).json({ error: 'Owner address required' });

  try {
    // Проверяем, что пресет существует
    const [rows] = await mariadbPool.query('SELECT owner, name, approved, public FROM presets WHERE id = ?', [id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Preset not found' });
    }

    const preset = rows[0];
    const isAdmin = owner === SUPREME_ADMIN;

    // Проверяем права доступа
    if (!isAdmin && preset.owner !== owner) {
      return res.status(403).json({ error: 'Only preset owner can delete preset' });
    }

    // Проверяем, что пресет не опубликован (только для обычных пользователей)
    if (!isAdmin && (preset.approved || preset.public)) {
      return res.status(403).json({ error: 'Cannot delete published preset' });
    }

    // Удаляем файлы с диска
    const presetName = preset.name;
    const configPath = path.join(__dirname, 'pic', 'presets', `${presetName}.json`);
    const jpgPath = path.join(__dirname, 'pic', 'presets', `${presetName}.jpg`);
    const pngPath = path.join(__dirname, 'pic', 'presets', `${presetName}.png`);

    // Удаляем файлы если они существуют
    try {
      if (fs.existsSync(configPath)) {
        fs.unlinkSync(configPath);
        console.log(`Deleted config file: ${configPath}`);
      }
      if (fs.existsSync(jpgPath)) {
        fs.unlinkSync(jpgPath);
        console.log(`Deleted image file: ${jpgPath}`);
      }
      if (fs.existsSync(pngPath)) {
        fs.unlinkSync(pngPath);
        console.log(`Deleted image file: ${pngPath}`);
      }
    } catch (fileError) {
      console.error('Error deleting preset files:', fileError);
      // Продолжаем выполнение, даже если не удалось удалить файлы
    }

    // Удаляем запись из БД
    await mariadbPool.query('DELETE FROM presets WHERE id = ?', [id]);

    console.log(`Preset deleted: ${presetName} (ID: ${id}) by ${owner}`);
    res.json({ success: true, message: 'Preset deleted successfully' });
  } catch (e) {
    console.error('Error deleting preset:', e);
    res.status(500).json({ error: 'DB error' });
  }
});

// Удаление изображения (владелец может удалить неопубликованное изображение, админ может удалить любое)
app.post('/api/images-delete', async (req, res) => {
  const { id, owner } = req.body;
  if (!owner) return res.status(400).json({ error: 'Owner address required' });

  try {
    // Проверяем, что изображение существует
    const [rows] = await mariadbPool.query('SELECT owner, name, class, genre, approved FROM images WHERE id = ?', [id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Image not found' });
    }

    const image = rows[0];
    const isAdmin = owner === SUPREME_ADMIN;

    // Проверяем права доступа
    if (!isAdmin && image.owner !== owner) {
      return res.status(403).json({ error: 'Only image owner can delete image' });
    }

    // Проверяем, что изображение не опубликовано (только для обычных пользователей)
    if (!isAdmin && image.approved) {
      return res.status(403).json({ error: 'Cannot delete published image' });
    }

    // Удаляем файлы с диска
    const imageName = image.name;
    const imageClass = image.class;
    const imageGenre = image.genre;

    // Определяем расширение файла в зависимости от категории
    let fileExtension;
    if (imageClass === 'bg') {
      fileExtension = '.jpg';
    } else if (['center', 'topbot', 'body'].includes(imageClass)) {
      fileExtension = '.png';
    } else {
      fileExtension = '.png'; // По умолчанию PNG для других категорий
    }

    // Пути к файлам (в жанровой папке и в корневой)
    const genrePath = imageGenre ? path.join(__dirname, 'pic', imageClass, imageGenre, `${imageName}${fileExtension}`) : null;
    const rootPath = path.join(__dirname, 'pic', imageClass, `${imageName}${fileExtension}`);

    // Удаляем файлы если они существуют
    try {
      if (genrePath && fs.existsSync(genrePath)) {
        fs.unlinkSync(genrePath);
        console.log(`Deleted image file: ${genrePath}`);
      } else if (fs.existsSync(rootPath)) {
        fs.unlinkSync(rootPath);
        console.log(`Deleted image file: ${rootPath}`);
      }
    } catch (fileError) {
      console.error('Error deleting image files:', fileError);
      // Продолжаем выполнение, даже если не удалось удалить файлы
    }

    // Удаляем запись из БД
    await mariadbPool.query('DELETE FROM images WHERE id = ?', [id]);

    console.log(`Image deleted: ${imageName} (ID: ${id}) by ${owner}`);
    res.json({ success: true, message: 'Image deleted successfully' });
  } catch (e) {
    console.error('Error deleting image:', e);
    res.status(500).json({ error: 'DB error' });
  }
});

// Получить конфигурацию пресета по ID или имени
app.get('/api/preset/:id', async (req, res) => {
  const { id } = req.params;

  try {
    console.log(`Preset request by ID/name: "${id}"`);

    // Query preset information from DB
    // First try to find by name, then by ID
    let [rows] = await mariadbPool.query('SELECT * FROM presets WHERE name = ?', [id]);

    // If not found by name and id is a pure number, try to find by ID
    if (rows.length === 0 && /^\d+$/.test(id)) {
      [rows] = await mariadbPool.query('SELECT * FROM presets WHERE id = ?', [parseInt(id)]);
    }

    if (rows.length === 0) {
      console.log(`Preset not found: ${id}`);
      return res.status(404).json({ success: false, error: 'Preset not found' });
    }

    const preset = rows[0];

    // Path to configuration file
    const presetPath = path.join(__dirname, 'pic', 'presets', `${preset.name}.json`);

    if (fs.existsSync(presetPath)) {
      console.log(`Found configuration file: ${presetPath}`);
      const presetConfig = JSON.parse(fs.readFileSync(presetPath, 'utf8'));

      // Parse tags if they exist
      let parsedTags = [];
      if (preset.tags) {
        try {
          parsedTags = JSON.parse(preset.tags);
        } catch (e) {
          console.error('Error parsing tags:', e);
        }
      }

      // Count likes from preset_likes table
      const [likesRows] = await mariadbPool.query('SELECT COUNT(*) as count FROM preset_likes WHERE preset_id = ?', [preset.id]);
      const likesCount = likesRows[0]?.count || 0;

      return res.json({
        success: true,
        config: presetConfig,
        preset: {
          id: preset.id,
          name: preset.name,
          owner: preset.owner,
          genre: preset.genre,
          approved: preset.approved,
          uses: preset.uses,
          likes: likesCount,
          tags: parsedTags
        }
      });
    } else {
      console.log(`Configuration file not found for preset: ${preset.name}`);
      return res.status(404).json({ success: false, error: 'Preset config file not found' });
    }
  } catch (error) {
    console.error(`Ошибка при чтении пресета ${id}:`, error);
    res.status(500).json({ success: false, error: 'Error reading preset' });
  }
});

// Получить изображение пресета
app.get('/api/preset-image/:id', async (req, res) => {
  const { id } = req.params;

  try {
    console.log(`Preset image request by ID/name: "${id}"`);

    // Query preset information from DB
    // First try to find by name, then by ID
    let [rows] = await mariadbPool.query('SELECT * FROM presets WHERE name = ?', [id]);

    // If not found by name and id is a pure number, try to find by ID
    if (rows.length === 0 && /^\d+$/.test(id)) {
      [rows] = await mariadbPool.query('SELECT * FROM presets WHERE id = ?', [parseInt(id)]);
    }

    if (rows.length === 0) {
      console.log(`Preset not found: ${id}`);
      return res.status(404).send('Preset not found');
    }

    const preset = rows[0];

    // Check for JPG (new format) or PNG (old format for compatibility)
    const jpgPath = path.join(__dirname, 'pic', 'presets', `${preset.name}.jpg`);
    const pngPath = path.join(__dirname, 'pic', 'presets', `${preset.name}.png`);

    if (fs.existsSync(jpgPath)) {
      return res.sendFile(jpgPath);
    } else if (fs.existsSync(pngPath)) {
      return res.sendFile(pngPath);
    } else {
      console.log(`Image file not found for preset: ${preset.name}`);
      return res.status(404).send('Preset image not found');
    }
  } catch (error) {
    console.error(`Ошибка при чтении изображения пресета ${id}:`, error);
    res.status(500).send('Error reading preset image');
  }
});

// Получить все изображения (для админа)
app.get('/api/all-images', async (req, res) => {
  try {
    const { approved, limit, offset } = req.query;

    let query = 'SELECT * FROM images';
    const params = [];
    const conditions = [];

    // Фильтрация по статусу одобрения
    if (approved === 'true') {
      conditions.push('approved = TRUE');
    } else if (approved === 'false') {
      conditions.push('approved = FALSE');
    }

    // Добавление условий в запрос
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    // Сортировка по дате создания (самые новые сверху)
    query += ' ORDER BY created_at DESC';

    // Добавление лимита и смещения для пагинации
    if (limit && !isNaN(parseInt(limit))) {
      query += ' LIMIT ?';
      params.push(parseInt(limit));

      if (offset && !isNaN(parseInt(offset))) {
        query += ' OFFSET ?';
        params.push(parseInt(offset));
      }
    }

    const [images] = await mariadbPool.query(query, params);

    // Получение общего количества изображений для пагинации
    let countQuery = 'SELECT COUNT(*) as total FROM images';
    if (conditions.length > 0) {
      countQuery += ' WHERE ' + conditions.join(' AND ');
    }

    const [countResult] = await mariadbPool.query(countQuery, []);
    const totalCount = countResult[0].total;

    // Формируем результат
    const result = {
      images: images.map(image => ({
        id: image.id,
        name: image.name,
        class: image.class,
        genre: image.genre,
        owner: image.owner,
        approved: !!image.approved,
        uses: image.uses,
        scale: image.scale,
        x_offset: image.x_offset,
        y_offset: image.y_offset,
        rotation: image.rotation,
        overlap: image.overlap,
        color: image.color,
        mirrored: !!image.mirrored,
        tags: image.tags ? JSON.parse(image.tags) : [],
        created_at: image.created_at,
        image_url: `/api/image/${image.class}/${image.name}`
      })),
      pagination: {
        total: totalCount,
        limit: limit ? parseInt(limit) : null,
        offset: offset ? parseInt(offset) : 0
      }
    };

    res.json(result);
  } catch (error) {
    console.error('Error fetching all images:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Получить изображения пользователя
app.get('/api/user-images', async (req, res) => {
  try {
    const { owner, approved, limit, offset } = req.query;

    if (!owner) {
      return res.status(400).json({ error: 'Owner address required' });
    }

    let query = 'SELECT * FROM images WHERE owner = ?';
    const params = [owner];

    // Фильтрация по статусу одобрения
    if (approved === 'true') {
      query += ' AND approved = TRUE';
    } else if (approved === 'false') {
      query += ' AND approved = FALSE';
    }

    // Сортировка по дате создания (самые новые сверху)
    query += ' ORDER BY created_at DESC';

    // Добавление лимита и смещения для пагинации
    if (limit && !isNaN(parseInt(limit))) {
      query += ' LIMIT ?';
      params.push(parseInt(limit));

      if (offset && !isNaN(parseInt(offset))) {
        query += ' OFFSET ?';
        params.push(parseInt(offset));
      }
    }

    const [images] = await mariadbPool.query(query, params);

    // Получение общего количества изображений для пагинации
    let countQuery = 'SELECT COUNT(*) as total FROM images WHERE owner = ?';
    const countParams = [owner];

    if (approved === 'true') {
      countQuery += ' AND approved = TRUE';
    } else if (approved === 'false') {
      countQuery += ' AND approved = FALSE';
    }

    const [countResult] = await mariadbPool.query(countQuery, countParams);
    const totalCount = countResult[0].total;

    // Формируем результат
    const result = {
      images: images.map(image => ({
        id: image.id,
        name: image.name,
        class: image.class,
        genre: image.genre,
        owner: image.owner,
        approved: !!image.approved,
        uses: image.uses,
        scale: image.scale,
        x_offset: image.x_offset,
        y_offset: image.y_offset,
        rotation: image.rotation,
        overlap: image.overlap,
        color: image.color,
        mirrored: !!image.mirrored,
        tags: image.tags ? JSON.parse(image.tags) : [],
        created_at: image.created_at,
        image_url: `/api/image/${image.class}/${image.name}`
      })),
      pagination: {
        total: totalCount,
        limit: limit ? parseInt(limit) : null,
        offset: offset ? parseInt(offset) : 0
      }
    };

    res.json(result);
  } catch (error) {
    console.error('Error fetching user images:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Получить полный список пресетов с информацией
app.get('/api/presets', async (req, res) => {
  try {
    const { approved, owner, limit, offset, tags, public: publicFilter, user_address } = req.query;
    let query = 'SELECT p.* FROM presets p';
    const params = [];
    const conditions = [];

    // Фильтрация по approval status
    if (approved === 'true') {
      conditions.push('p.approved = TRUE');
    } else if (approved === 'false') {
      conditions.push('p.approved = FALSE');
    }

    // Фильтрация по публичности
    if (publicFilter === 'true') {
      conditions.push('p.public = TRUE');
    } else if (publicFilter === 'false') {
      conditions.push('p.public = FALSE');
    }

    // Фильтрация по владельцу
    if (owner) {
      conditions.push('p.owner = ?');
      params.push(owner);
    }

    // Фильтрация по тегам
    if (tags) {
      const searchTags = Array.isArray(tags) ? tags : [tags];
      const tagConditions = [];

      searchTags.forEach(tag => {
        if (tag && typeof tag === 'string') {
          tagConditions.push('JSON_CONTAINS(LOWER(p.tags), JSON_QUOTE(LOWER(?)))');
          params.push(tag.trim());
        }
      });

      if (tagConditions.length > 0) {
        conditions.push(`(${tagConditions.join(' OR ')})`);
      }
    }

    // Добавление условий в запрос
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    // Сортировка по дате создания (самые новые сверху)
    query += ' ORDER BY p.created_at DESC';

    // Добавление лимита и смещения для пагинации
    if (limit && !isNaN(parseInt(limit))) {
      query += ' LIMIT ?';
      params.push(parseInt(limit));

      if (offset && !isNaN(parseInt(offset))) {
        query += ' OFFSET ?';
        params.push(parseInt(offset));
      }
    }

    const [presets] = await mariadbPool.query(query, params);

    // Count likes from preset_likes table for all presets at once
    if (presets.length > 0) {
      const presetIds = presets.map(preset => preset.id);
      const placeholders = presetIds.map(() => '?').join(',');
      const [likesRows] = await mariadbPool.query(
        `SELECT preset_id, COUNT(*) as count FROM preset_likes WHERE preset_id IN (${placeholders}) GROUP BY preset_id`,
        presetIds
      );
      const likesMap = new Map(likesRows.map(row => [row.preset_id, row.count]));
      presets.forEach(preset => {
        preset.likes = likesMap.get(preset.id) || 0;
      });
    }

    // If user_address is provided, check which presets are liked by this user
    if (user_address && presets.length > 0) {
      const presetIds = presets.map(preset => preset.id);
      const placeholders = presetIds.map(() => '?').join(',');

      const [likeRows] = await mariadbPool.query(
        `SELECT preset_id FROM preset_likes WHERE preset_id IN (${placeholders}) AND user_address = ?`,
        [...presetIds, user_address]
      );

      const likedPresetIds = new Set(likeRows.map(row => row.preset_id));

      // Add liked status to each preset
      presets.forEach(preset => {
        preset.user_liked = likedPresetIds.has(preset.id);
      });
    }

    // Получение общего количества пресетов для пагинации
    let countQuery = 'SELECT COUNT(*) as total FROM presets p';
    if (conditions.length > 0) {
      countQuery += ' WHERE ' + conditions.join(' AND ');
    }

    const [countResult] = await mariadbPool.query(countQuery, params.slice(0, conditions.length));
    const totalCount = countResult[0].total;

    // Формируем результат
    const result = {
      presets: presets.map(preset => ({
        id: preset.id,
        name: preset.name,
        owner: preset.owner,
        genre: preset.genre,
        approved: !!preset.approved,
        public: !!preset.public,
        uses: preset.uses,
        likes: preset.likes || 0,
        user_liked: preset.user_liked || false,
        tags: preset.tags ? JSON.parse(preset.tags) : [],
        created_at: preset.created_at,
        image_url: `/api/preset-image/${preset.name}`
      })),
      pagination: {
        total: totalCount,
        limit: limit ? parseInt(limit) : null,
        offset: offset ? parseInt(offset) : 0
      }
    };

    res.json(result);
  } catch (error) {
    console.error('Error fetching presets:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Получить все пресеты конкретного создателя (включая неопубликованные)
app.get('/api/creator-presets/:address', async (req, res) => {
  try {
    const { address } = req.params;
    const { limit, offset, user_address } = req.query;

    if (!address) {
      return res.status(400).json({ error: 'Creator address required' });
    }

    console.log(`Request for presets by creator: ${address}`);

    let query = 'SELECT p.* FROM presets p WHERE p.owner = ?';
    const params = [address];

    // Сортировка по дате создания (самые новые сверху)
    query += ' ORDER BY p.created_at DESC';

    // Добавление лимита и смещения для пагинации
    if (limit && !isNaN(parseInt(limit))) {
      query += ' LIMIT ?';
      params.push(parseInt(limit));

      if (offset && !isNaN(parseInt(offset))) {
        query += ' OFFSET ?';
        params.push(parseInt(offset));
      }
    }

    const [presets] = await mariadbPool.query(query, params);

    // Count likes from preset_likes table for all presets at once
    if (presets.length > 0) {
      const presetIds = presets.map(preset => preset.id);
      const placeholders = presetIds.map(() => '?').join(',');
      const [likesRows] = await mariadbPool.query(
        `SELECT preset_id, COUNT(*) as count FROM preset_likes WHERE preset_id IN (${placeholders}) GROUP BY preset_id`,
        presetIds
      );
      const likesMap = new Map(likesRows.map(row => [row.preset_id, row.count]));
      presets.forEach(preset => {
        preset.likes = likesMap.get(preset.id) || 0;
      });
    }

    // If user_address is provided, check which presets are liked by this user
    if (user_address && presets.length > 0) {
      const presetIds = presets.map(preset => preset.id);
      const placeholders = presetIds.map(() => '?').join(',');

      const [likeRows] = await mariadbPool.query(
        `SELECT preset_id FROM preset_likes WHERE preset_id IN (${placeholders}) AND user_address = ?`,
        [...presetIds, user_address]
      );

      const likedPresetIds = new Set(likeRows.map(row => row.preset_id));

      // Add liked status to each preset
      presets.forEach(preset => {
        preset.user_liked = likedPresetIds.has(preset.id);
      });
    }

    // Получение общего количества пресетов создателя для пагинации
    const [countResult] = await mariadbPool.query('SELECT COUNT(*) as total FROM presets WHERE owner = ?', [address]);
    const totalCount = countResult[0].total;

    // Формируем результат
    const result = {
      creator: address,
      presets: presets.map(preset => ({
        id: preset.id,
        name: preset.name,
        owner: preset.owner,
        genre: preset.genre,
        approved: !!preset.approved,
        public: !!preset.public,
        uses: preset.uses,
        likes: preset.likes || 0,
        user_liked: preset.user_liked || false,
        tags: preset.tags ? JSON.parse(preset.tags) : [],
        created_at: preset.created_at,
        image_url: `/api/preset-image/${preset.name}`
      })),
      pagination: {
        total: totalCount,
        limit: limit ? parseInt(limit) : null,
        offset: offset ? parseInt(offset) : 0
      }
    };

    console.log(`Found ${presets.length} presets for creator ${address}`);
    res.json(result);
  } catch (error) {
    console.error('Error fetching creator presets:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// --- Эндпоинты для работы с изображениями ---

// API для получения изображений по категории
app.get('/api/images/:category', async (req, res) => {
  const { category } = req.params;
  const { tags } = req.query;
  const validCategories = ['body', 'center', 'topbot', 'bg', 'presets', 'add'];

  // Проверяем валидность категории
  if (!validCategories.includes(category)) {
    console.error(`Category ${category} not found. Available: ${validCategories.join(', ')}`);
    return res.status(400).json({
      error: `Invalid category '${category}'. Available: ${validCategories.join(', ')}`,
      categories: validCategories
    });
  }

  try {
    console.log(`Request for images in category ${category}`);

    // Для пресетов используем логику получения из таблицы presets
    if (category === 'presets') {
      let query = 'SELECT * FROM presets WHERE approved = TRUE';
      let params = [];

      // Фильтрация по тегам для пресетов
      if (tags) {
        const searchTags = Array.isArray(tags) ? tags : [tags];
        const tagConditions = [];

        searchTags.forEach(tag => {
          if (tag && typeof tag === 'string') {
            tagConditions.push('JSON_CONTAINS(LOWER(tags), JSON_QUOTE(LOWER(?)))');
            params.push(tag.trim());
          }
        });

        if (tagConditions.length > 0) {
          query += ` AND (${tagConditions.join(' OR ')})`;
        }
      }

      const [presets] = await mariadbPool.query(query, params);
      console.log(`Found ${presets.length} approved presets in DB`);

      // Count likes from preset_likes table for all presets at once
      if (presets.length > 0) {
        const presetIds = presets.map(preset => preset.id);
        const placeholders = presetIds.map(() => '?').join(',');
        const [likesRows] = await mariadbPool.query(
          `SELECT preset_id, COUNT(*) as count FROM preset_likes WHERE preset_id IN (${placeholders}) GROUP BY preset_id`,
          presetIds
        );
        const likesMap = new Map(likesRows.map(row => [row.preset_id, row.count]));
        presets.forEach(preset => {
          preset.likes = likesMap.get(preset.id) || 0;
        });
      }

      // Формируем результат в том же формате, что и для других категорий
      const presetsMap = { '': [] };

      // Добавляем каждый пресет в результат
      for (const preset of presets) {
        presetsMap[''].push({
          filename: `${preset.name}.jpg`, // Новый формат JPEG
          path: `/api/preset-image/${preset.name}`, // Путь к изображению через API
          id: preset.id,
          name: preset.name,
          owner: preset.owner,
          genre: preset.genre,
          uses: preset.uses,
          likes: preset.likes || 0,
          tags: preset.tags ? JSON.parse(preset.tags) : []
        });
      }

      return res.json({ images: presetsMap });
    }

    // Для обычных изображений используем таблицу images
    let query = 'SELECT * FROM images WHERE approved = TRUE AND class = ?';
    let params = [category];

    // Фильтрация по тегам для изображений
    if (tags) {
      const searchTags = Array.isArray(tags) ? tags : [tags];
      const tagConditions = [];

      searchTags.forEach(tag => {
        if (tag && typeof tag === 'string') {
          tagConditions.push('JSON_CONTAINS(LOWER(tags), JSON_QUOTE(LOWER(?)))');
          params.push(tag.trim());
        }
      });

      if (tagConditions.length > 0) {
        query += ` AND (${tagConditions.join(' OR ')})`;
      }
    }

    const [images] = await mariadbPool.query(query, params);

    console.log(`Found ${images.length} images for category ${category} in images table`);

    if (images.length === 0) {
      // Если изображений в БД не найдено, возвращаем пустой результат
      console.log(`No images found for category ${category} in DB`);
      return res.json({ images: {} });
    }

    // Группируем изображения по жанрам
    const imagesMap = {};

    for (const image of images) {
      // Определяем подкатегорию (жанр)
      const subCategory = image.genre || '';

      // Инициализируем массив для текущей подкатегории, если его нет
      if (!imagesMap[subCategory]) {
        imagesMap[subCategory] = [];
      }

      // Определяем расширение файла в зависимости от категории
      let fileExtension;
      if (category === 'bg') {
        fileExtension = '.jpg';
      } else if (['center', 'topbot', 'body', 'add'].includes(category)) {
        fileExtension = '.png';
      } else {
        fileExtension = '.png'; // По умолчанию PNG для других категорий
      }

      // Добавляем информацию об изображении и все его параметры из БД
      imagesMap[subCategory].push({
        filename: `${image.name}${fileExtension}`,
        path: `/api/image/${category}/${image.name}`,
        id: image.id,
        name: image.name,
        genre: image.genre,
        class: image.class,
        // Добавляем все параметры изображения для автоматического применения в UI
        scale: image.scale,
        x_offset: image.x_offset,
        y_offset: image.y_offset,
        rotation: image.rotation,
        overlap: image.overlap,
        color: image.color,
        mirrored: image.mirrored ? true : false,
        // Добавляем теги
        tags: image.tags ? JSON.parse(image.tags) : [],
        // Добавляем флаг, указывающий, что у изображения есть параметры из БД
        has_params: !!(image.scale || image.x_offset || image.y_offset || image.rotation || image.overlap || image.color || image.mirrored)
      });
    }

    console.log(`Created ${Object.keys(imagesMap).length} image groups`);
    return res.json({ images: imagesMap });

  } catch (error) {
    console.error(`Error retrieving images for category ${category}:`, error);
    return res.status(500).json({ error: `Error retrieving images for category ${category}` });
  }
});

// API для получения изображения по его имени и категории
app.get('/api/image/:category/:name', async (req, res) => {
  const { category, name } = req.params;

  try {
    console.log(`Image request ${name} from category ${category}`);

    // First check if there's a record of this image in DB
    const [images] = await mariadbPool.query(
      'SELECT * FROM images WHERE name = ? AND class = ?',
      [name, category]
    );

    if (images.length > 0) {
      // If image found in DB, increment usage counter
      await mariadbPool.query(
        'UPDATE images SET uses = uses + 1 WHERE id = ?',
        [images[0].id]
      );
      console.log(`Incremented usage counter for image ${name}`);
    }

    // Определяем расширение файла в зависимости от категории
    let targetExtension;
    if (category === 'bg') {
      targetExtension = '.jpg';
    } else if (['center', 'topbot', 'body', 'add'].includes(category)) {
      targetExtension = '.png';
    } else {
      targetExtension = '.png'; // По умолчанию PNG для других категорий
    }

    let filePath = null;

    // Если есть информация о изображении в БД и указан жанр, ищем строго в подкаталоге жанра
    if (images.length > 0 && images[0].genre) {
      const genrePath = path.join(__dirname, 'pic', category, images[0].genre, `${name}${targetExtension}`);
      if (fs.existsSync(genrePath)) {
        filePath = genrePath;
      }
    }

    // Если не найден в жанровом подкаталоге или жанр не указан, проверяем корневой каталог
    if (!filePath) {
      const rootPath = path.join(__dirname, 'pic', category, `${name}${targetExtension}`);
      if (fs.existsSync(rootPath)) {
        filePath = rootPath;
      }
    }

    if (filePath) {
      return res.sendFile(filePath);
    } else {
      console.log(`Image ${name}${targetExtension} in category ${category} not found`);
      return res.status(404).send('Image not found');
    }
  } catch (error) {
    console.error(`Ошибка при поиске изображения ${name} в категории ${category}:`, error);
    res.status(500).send('Error finding image');
  }
});

// API для получения маски изображения (для текстовых знаков)
app.get('/api/image-mask/:category/:name', async (req, res) => {
  const { category, name } = req.params;

  try {
    console.log(`Image mask request ${name} from category ${category}`);

    // Проверяем, что это изображение из БД
    const [images] = await mariadbPool.query(
      'SELECT * FROM images WHERE name = ? AND class = ?',
      [name, category]
    );

    // Определяем расширение файла
    let targetExtension;
    if (category === 'bg') {
      targetExtension = '.jpg';
    } else if (['center', 'topbot', 'body', 'add'].includes(category)) {
      targetExtension = '.png';
    } else {
      targetExtension = '.png';
    }

    // Формируем имя файла маски (добавляем _masked перед расширением)
    const maskName = `${name}_masked`;
    let maskPath = null;

    // Если есть информация о изображении в БД и указан жанр, ищем маску в подкаталоге жанра
    if (images.length > 0 && images[0].genre) {
      const genreMaskPath = path.join(__dirname, 'pic', category, images[0].genre, `${maskName}${targetExtension}`);
      if (fs.existsSync(genreMaskPath)) {
        maskPath = genreMaskPath;
      }
    }

    // Если не найдена в жанровом подкаталоге, проверяем корневой каталог
    if (!maskPath) {
      const rootMaskPath = path.join(__dirname, 'pic', category, `${maskName}${targetExtension}`);
      if (fs.existsSync(rootMaskPath)) {
        maskPath = rootMaskPath;
      }
    }

    if (maskPath) {
      console.log(`Found mask: ${maskPath}`);
      return res.sendFile(maskPath);
    } else {
      console.log(`Mask ${maskName}${targetExtension} in category ${category} not found`);
      return res.status(404).send('Mask not found');
    }
  } catch (error) {
    console.error(`Ошибка при поиске маски ${name} в категории ${category}:`, error);
    res.status(500).send('Error finding mask');
  }
});

// API для получения детальной информации об изображении и его параметров
app.get('/api/image-info/:category/:name', async (req, res) => {
  const { category, name } = req.params;

  try {
    console.log(`Image information request ${name} from category ${category}`);

    // Check if there's a record of this image in DB
    const [images] = await mariadbPool.query(
      'SELECT * FROM images WHERE name = ? AND class = ?',
      [name, category]
    );

    if (images.length === 0) {
      console.log(`Image information ${name} not found in DB`);
      return res.status(404).json({
        success: false,
        error: 'Image information not found in database'
      });
    }

    // Возвращаем параметры изображения
    const image = images[0];
    return res.json({
      success: true,
      image: {
        id: image.id,
        name: image.name,
        class: image.class,
        genre: image.genre,
        approved: !!image.approved,
        uses: image.uses,
        // Параметры для автоматического применения в UI
        scale: image.scale,
        x_offset: image.x_offset,
        y_offset: image.y_offset,
        rotation: image.rotation,
        overlap: image.overlap,
        color: image.color,
        mirrored: image.mirrored ? true : false
      }
    });

  } catch (error) {
    console.error(`Ошибка при получении информации об изображении ${name}:`, error);
    res.status(500).json({
      success: false,
      error: 'Error retrieving image information'
    });
  }
});

// API для сохранения изображения в галерею
app.post('/api/save-to-gallery', async (req, res) => {
  const {
    name,           // Image name
    category,       // Category (body/center/topbot/bg)
    genre,          // Genre/style
    owner,          // Owner address (wallet)
    imageBase64,    // Image in base64 format
    // Image parameters
    scale,
    x_offset,
    y_offset,
    rotation,
    overlap,
    color,
    mirrored,
    force_overwrite, // Flag for force overwrite (for superuser)
    tags            // Tags array
  } = req.body;

  try {
    console.log(`Request to save image ${name} to category ${category}, genre ${genre}`);

    // Debug output for parameters
    console.log('Image parameters received in detail:', {
      scale: scale !== undefined ? scale : 'undefined',
      x_offset: x_offset !== undefined ? x_offset : 'undefined',
      y_offset: y_offset !== undefined ? y_offset : 'undefined',
      rotation: rotation !== undefined ? rotation : 'undefined',
      overlap: overlap !== undefined ? overlap : 'undefined',
      mirrored: mirrored !== undefined ? mirrored : 'undefined',
      color: color || 'undefined'
    });

    // Check required parameters
    if (!name || !category || !genre || !owner || !imageBase64) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters'
      });
    }

    // Safe filename (without special characters)
    const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32);

    // Check if image with this name already exists in this category
    const [existingImages] = await mariadbPool.query(
      'SELECT * FROM images WHERE name = ? AND class = ?',
      [safeName, category]
    );

    // If image already exists
    if (existingImages.length > 0) {
      const existingImage = existingImages[0];

      // Check if it belongs to current user
      if (existingImage.owner !== owner && owner !== SUPREME_ADMIN && !force_overwrite) {
        return res.status(403).json({
          success: false,
          error: 'An image with this name already exists and belongs to another user'
        });
      }
    }

    // Prepare path for saving
    const categoryDir = path.join(__dirname, 'pic', category);
    let targetDir;

    // If genre is specified, create corresponding subdirectory
    if (genre) {
      targetDir = path.join(categoryDir, genre);

      // Create directory if it doesn't exist
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
    } else {
      targetDir = categoryDir;
    }

    // Определяем расширение файла в зависимости от категории
    let fileExtension;
    if (category === 'bg') {
      fileExtension = '.jpg';
    } else if (['center', 'topbot', 'body', 'add'].includes(category)) {
      fileExtension = '.png';
    } else {
      fileExtension = '.png'; // По умолчанию PNG для других категорий
    }

    // Path to image file
    const imagePath = path.join(targetDir, `${safeName}${fileExtension}`);

    // Обрабатываем данные Base64
    let base64Data = imageBase64;

    try {
      // Более подробное логирование полученных данных для отладки
      console.log(`Image data received: ${imageBase64.substring(0, 50)}...`);
      console.log(`Data length: ${imageBase64.length} chars`);

      // Проверка, имеет ли строка заголовок data:image
      const isDataUrl = imageBase64.startsWith('data:image/');
      console.log(`Is data URL: ${isDataUrl}`);

      // Если это data URL, извлекаем тип MIME для информации
      let mimeType = 'unknown';
      if (isDataUrl) {
        const mimeMatch = imageBase64.match(/^data:([^;]+);/);
        mimeType = mimeMatch ? mimeMatch[1] : 'unknown';
        console.log(`Detected MIME type: ${mimeType}`);
      }

      // Если строка не начинается с data:image/, значит что-то не так с форматом
      if (!isDataUrl) {
        console.log('Warning: Image data is not in valid data URL format');
        return res.status(400).json({
          success: false,
          error: 'Invalid image format: expected data:image/* format'
        });
      }

      // Удаляем заголовок data URL, независимо от формата
      base64Data = imageBase64.replace(/^data:image\/[a-zA-Z0-9]+;base64,/, '');
      console.log(`Base64 data length after header removal: ${base64Data.length} chars`);

      // Проверяем, можно ли декодировать base64
      const testBuffer = Buffer.from(base64Data, 'base64');
      if (testBuffer.length === 0) {
        console.log('Error: Zero-length buffer after base64 decoding');
        throw new Error('Zero-length buffer after base64 decoding');
      }

      console.log(`Successfully decoded base64 data, buffer length: ${testBuffer.length} bytes`);

      // Проверяем, начинается ли буфер с PNG сигнатуры (89 50 4E 47)
      const hasPngSignature = testBuffer.length >= 8 &&
        testBuffer[0] === 0x89 && testBuffer[1] === 0x50 &&
        testBuffer[2] === 0x4E && testBuffer[3] === 0x47 &&
        testBuffer[4] === 0x0D && testBuffer[5] === 0x0A &&
        testBuffer[6] === 0x1A && testBuffer[7] === 0x0A;

      console.log(`Has PNG signature: ${hasPngSignature}`);

      // Если нет сигнатуры PNG, выводим предупреждение, но продолжаем
      if (!hasPngSignature) {
        console.log('Warning: Data does not have a PNG signature. This might cause issues with the image.');

        // Здесь можно было бы добавить конвертацию в PNG через внешнюю библиотеку,
        // но это потребует установки зависимостей (sharp, imagemagick)
      }

      // Сохраняем файл
      console.log(`Saving image to: ${imagePath}`);
      fs.writeFileSync(imagePath, testBuffer);

      console.log(`File saved with size: ${testBuffer.length} bytes`);
    } catch (err) {
      console.error('Error decoding base64 or saving image:', err);
      return res.status(400).json({
        success: false,
        error: 'Invalid image data format'
      });
    }

    // Prepare data for DB
    const imageData = {
      name: safeName,
      class: category,
      genre: genre,
      owner: owner,
      approved: owner === SUPREME_ADMIN ? 1 : 0, // Auto-approve for superadmin
      uses: 0,
      scale: scale !== undefined ? scale : null,
      x_offset: x_offset !== undefined ? x_offset : null,
      y_offset: y_offset !== undefined ? y_offset : null,
      rotation: rotation !== undefined ? rotation : null,
      overlap: overlap !== undefined ? overlap : null,
      color: color || null,
      mirrored: mirrored ? 1 : 0,
      tags: null
    };

    // Обработка тегов
    if (tags && Array.isArray(tags) && tags.length > 0) {
      // Очищаем теги от пустых и приводим к нижнему регистру
      const cleanTags = tags
        .filter(tag => tag && typeof tag === 'string' && tag.trim().length > 0)
        .map(tag => tag.trim().toLowerCase())
        .slice(0, 10); // Ограничиваем максимум 10 тегами

      if (cleanTags.length > 0) {
        imageData.tags = JSON.stringify(cleanTags);
      }
    }

    // If image already existed, update record
    if (existingImages.length > 0) {
      const existingId = existingImages[0].id;

      // Create SQL update query
      let updateQuery = 'UPDATE images SET ';
      const updateValues = [];
      const updateFields = [];

      // Add fields for update
      Object.entries(imageData).forEach(([key, value]) => {
        if (value !== undefined) {
          updateFields.push(`${key} = ?`);
          updateValues.push(value);
        }
      });

      updateQuery += updateFields.join(', ');
      updateQuery += ' WHERE id = ?';
      updateValues.push(existingId);

      // Execute update query
      await mariadbPool.query(updateQuery, updateValues);
      console.log(`Updated DB record for image ID: ${existingId}`);

      return res.json({
        success: true,
        message: 'Image updated successfully',
        image_id: existingId,
        overwritten: true
      });
    } else {
      // Create new record
      // Create SQL insert query
      const fields = Object.keys(imageData).join(', ');
      const placeholders = Object.keys(imageData).map(() => '?').join(', ');
      const insertQuery = `INSERT INTO images (${fields}) VALUES (${placeholders})`;

      // Execute insert query
      const [result] = await mariadbPool.query(insertQuery, Object.values(imageData));
      console.log(`Created new DB record for image: ${result.insertId}`);

      return res.json({
        success: true,
        message: 'Image saved successfully',
        image_id: result.insertId,
        overwritten: false
      });
    }
  } catch (error) {
    console.error(`Error saving image ${name}:`, error);
    res.status(500).json({
      success: false,
      error: 'Error saving image'
    });
  }
});

// API для получения списка доступных жанров/стилей
app.get('/api/genres', async (req, res) => {
  try {
    // List of all categories
    const categories = ['body', 'center', 'topbot', 'bg', 'add'];

    const allGenres = {};

    // For each category, get available genres from directories
    for (const category of categories) {
      const categoryDir = path.join(__dirname, 'pic', category);

      // Инициализируем пустой массив для категории
      if (!allGenres[category]) {
        allGenres[category] = [];
      }

      if (fs.existsSync(categoryDir)) {
        // Get subdirectories (genres)
        const dirGenres = fs.readdirSync(categoryDir)
          .filter(item => fs.statSync(path.join(categoryDir, item)).isDirectory());

        // Add unique directory genres to the list
        dirGenres.forEach(genre => {
          if (!allGenres[category].includes(genre)) {
            allGenres[category].push(genre);
          }
        });
      }
    }

    // Additionally get unique genres from the database
    const [dbGenres] = await mariadbPool.query('SELECT DISTINCT genre, class FROM images WHERE genre IS NOT NULL AND genre != ""');

    // Add genres from db that are missing in the file system
    dbGenres.forEach(item => {
      const { genre, class: category } = item;
      if (categories.includes(category)) {
        // Инициализируем массив для категории, если он еще не создан
        if (!allGenres[category]) {
          allGenres[category] = [];
        }

        if (!allGenres[category].includes(genre)) {
          allGenres[category].push(genre);
        }
      }
    });

    // Sort genres alphabetically
    for (const category in allGenres) {
      allGenres[category].sort();
    }

    res.json({
      success: true,
      genres: allGenres
    });
  } catch (error) {
    console.error('Error retrieving genres list:', error);
    res.status(500).json({
      success: false,
      error: 'Error retrieving genres'
    });
  }
});

// API для получения жанров пресетов
app.get('/api/preset-genres', async (req, res) => {
  try {
    // Получаем уникальные жанры из таблицы пресетов
    const [presetGenres] = await mariadbPool.query('SELECT DISTINCT genre FROM presets WHERE genre IS NOT NULL AND genre != ""');

    // Извлекаем только жанры в массив
    const genres = presetGenres.map(row => row.genre);

    // Сортируем жанры по алфавиту
    genres.sort();

    console.log('Loaded preset genres from database:', genres);

    res.json({
      success: true,
      genres: genres
    });
  } catch (error) {
    console.error('Error retrieving preset genres:', error);
    res.status(500).json({
      success: false,
      error: 'Error retrieving preset genres'
    });
  }
});

// API для получения всех доступных тегов
app.get('/api/tags', async (req, res) => {
  try {
    const { type } = req.query; // 'presets', 'images' или не указан для всех

    let allTags = new Set();

    // Получаем теги из пресетов
    if (!type || type === 'presets') {
      const [presetTags] = await mariadbPool.query('SELECT tags FROM presets WHERE tags IS NOT NULL AND approved = TRUE');
      presetTags.forEach(row => {
        if (row.tags) {
          try {
            const tags = JSON.parse(row.tags);
            if (Array.isArray(tags)) {
              tags.forEach(tag => allTags.add(tag.toLowerCase()));
            }
          } catch (e) {
            console.error('Error parsing preset tags:', row.tags);
          }
        }
      });
    }

    // Получаем теги из изображений
    if (!type || type === 'images') {
      const [imageTags] = await mariadbPool.query('SELECT tags FROM images WHERE tags IS NOT NULL AND approved = TRUE');
      imageTags.forEach(row => {
        if (row.tags) {
          try {
            const tags = JSON.parse(row.tags);
            if (Array.isArray(tags)) {
              tags.forEach(tag => allTags.add(tag.toLowerCase()));
            }
          } catch (e) {
            console.error('Error parsing image tags:', row.tags);
          }
        }
      });
    }

    // Конвертируем Set в отсортированный массив
    const sortedTags = Array.from(allTags).sort();

    res.json({
      success: true,
      tags: sortedTags,
      count: sortedTags.length
    });
  } catch (error) {
    console.error('Error retrieving tags:', error);
    res.status(500).json({
      success: false,
      error: 'Error retrieving tags'
    });
  }
});

// --- Subreddit Settings API ---

// Temporary endpoint to create table manually
app.post('/api/create-subreddit-settings-table', async (req, res) => {
  try {
    console.log('🔧 Manual table creation requested');

    // Create table
    await mariadbPool.query(`
      CREATE TABLE IF NOT EXISTS subreddit_settings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        subreddit VARCHAR(100) NOT NULL,
        user_address VARCHAR(64) NOT NULL,
        settings TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Table subreddit_settings created');

    // Add unique constraint
    try {
      await mariadbPool.query(`
        ALTER TABLE subreddit_settings 
        ADD CONSTRAINT unique_subreddit_user UNIQUE (subreddit, user_address)
      `);
      console.log('✅ Unique constraint added');
    } catch (e) {
      if (e.message.includes('Duplicate key name')) {
        console.log('ℹ️ Unique constraint already exists');
      } else {
        console.error('❌ Error adding unique constraint:', e.message);
      }
    }

    res.json({
      success: true,
      message: 'Table subreddit_settings created successfully'
    });

  } catch (error) {
    console.error('❌ Error creating table:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create table: ' + error.message
    });
  }
});

// Simple table without unique constraint for testing
app.post('/api/create-simple-subreddit-settings-table', async (req, res) => {
  try {
    console.log('🔧 Simple table creation requested');

    // Drop existing table first
    try {
      await mariadbPool.query(`DROP TABLE IF EXISTS subreddit_settings`);
      console.log('✅ Existing table dropped');
    } catch (e) {
      console.log('ℹ️ No existing table to drop');
    }

    // Create simple table without unique constraint
    await mariadbPool.query(`
      CREATE TABLE subreddit_settings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        subreddit VARCHAR(100) NOT NULL,
        user_address VARCHAR(64) NOT NULL,
        settings TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Simple table subreddit_settings created');

    res.json({
      success: true,
      message: 'Simple table subreddit_settings created successfully'
    });

  } catch (error) {
    console.error('❌ Error creating simple table:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create simple table: ' + error.message
    });
  }
});

// Save subreddit settings (global for subreddit)
app.post('/api/save-subreddit-settings', async (req, res) => {
  try {
    const { subreddit, settings, autopostTitle, autopostText } = req.body;

    console.log(`💾 Saving subreddit settings for ${subreddit}`);

    // Validation
    if (!subreddit || !settings) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: subreddit, settings'
      });
    }

    // Validate subreddit name format (allow letters, numbers, underscores, hyphens, dots)
    if (!/^[a-zA-Z0-9_.-]+$/.test(subreddit)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid subreddit name format'
      });
    }

    // Validate settings is an object
    if (typeof settings !== 'object' || settings === null) {
      return res.status(400).json({
        success: false,
        error: 'Settings must be a valid JSON object'
      });
    }

    // Check settings size (limit to 1MB)
    const settingsSize = JSON.stringify(settings).length;
    if (settingsSize > 1024 * 1024) {
      return res.status(400).json({
        success: false,
        error: 'Settings too large (max 1MB)'
      });
    }

    // Save settings (global for subreddit)
    console.log('💾 Attempting to save settings to database...');
    console.log('📊 Data:', { subreddit, settingsSize: JSON.stringify(settings).length });

    // First, try to delete existing record for this subreddit
    try {
      await mariadbPool.query(`
        DELETE FROM subreddit_settings 
        WHERE subreddit = ?
      `, [subreddit]);
      console.log('✅ Existing record deleted (if any)');
    } catch (e) {
      console.log('ℹ️ No existing record to delete or error:', e.message);
    }

    // Then insert new record
    const [result] = await mariadbPool.query(`
      INSERT INTO subreddit_settings (subreddit, user_address, settings, autopost_title, autopost_text) 
      VALUES (?, ?, ?, ?, ?)
    `, [subreddit, 'global', JSON.stringify(settings), autopostTitle || null, autopostText || null]);

    console.log('✅ Database query executed successfully, insertId:', result.insertId);

    console.log(`✅ Settings saved for ${subreddit}`);

    res.json({
      success: true,
      message: 'Settings saved successfully',
      subreddit: subreddit,
      settings_size: settingsSize
    });

  } catch (error) {
    console.error('❌ Error saving subreddit settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save settings'
    });
  }
});

// Load subreddit settings (global for subreddit)
app.get('/api/load-subreddit-settings', async (req, res) => {
  try {
    const { subreddit } = req.query;

    console.log(`📖 Loading subreddit settings for ${subreddit}`);

    // Validation
    if (!subreddit) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameter: subreddit'
      });
    }

    // Validate subreddit name format
    if (!/^[a-zA-Z0-9_.-]+$/.test(subreddit)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid subreddit name format'
      });
    }

    // Query settings from database
    console.log('📖 Attempting to load settings from database...');
    console.log('📊 Query params:', { subreddit });

    const [rows] = await mariadbPool.query(`
      SELECT settings, autopost_title, autopost_text, created_at, updated_at 
      FROM subreddit_settings 
      WHERE subreddit = ?
    `, [subreddit]);

    console.log('✅ Database query executed successfully, found rows:', rows.length);

    if (rows.length === 0) {
      console.log(`📭 No settings found for ${subreddit}`);
      return res.json({
        success: true,
        found: false,
        message: 'No settings found for this subreddit'
      });
    }

    const settingsData = rows[0];
    let parsedSettings;

    try {
      parsedSettings = JSON.parse(settingsData.settings);
    } catch (parseError) {
      console.error('❌ Error parsing settings JSON:', parseError);
      return res.status(500).json({
        success: false,
        error: 'Failed to parse settings data'
      });
    }

    console.log(`✅ Settings loaded for ${subreddit}`);

    res.json({
      success: true,
      found: true,
      subreddit: subreddit,
      settings: parsedSettings,
      autopostTitle: settingsData.autopost_title || '',
      autopostText: settingsData.autopost_text || '',
      created_at: settingsData.created_at,
      updated_at: settingsData.updated_at
    });

  } catch (error) {
    console.error('❌ Error loading subreddit settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load settings'
    });
  }
});

// Cleanup old subreddit settings
app.post('/api/cleanup-old-settings', async (req, res) => {
  try {
    const { days_old = 30, admin_key } = req.body;

    console.log(`🧹 Starting cleanup of subreddit settings older than ${days_old} days`);

    // Basic admin key validation (in production, use proper authentication)
    const ADMIN_CLEANUP_KEY = process.env.ADMIN_CLEANUP_KEY || 'tchart_cleanup_2024';
    if (admin_key !== ADMIN_CLEANUP_KEY) {
      return res.status(403).json({
        success: false,
        error: 'Invalid admin key for cleanup operation'
      });
    }

    // Validate days_old parameter
    const daysOld = parseInt(days_old);
    if (isNaN(daysOld) || daysOld < 1 || daysOld > 365) {
      return res.status(400).json({
        success: false,
        error: 'Invalid days_old parameter (must be between 1 and 365)'
      });
    }

    // Calculate cutoff date
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    // Count records to be deleted
    const [countRows] = await mariadbPool.query(`
      SELECT COUNT(*) as count 
      FROM subreddit_settings 
      WHERE updated_at < ?
    `, [cutoffDate]);

    const recordsToDelete = countRows[0].count;

    if (recordsToDelete === 0) {
      console.log(`✅ No old settings found to cleanup`);
      return res.json({
        success: true,
        message: 'No old settings found to cleanup',
        deleted_count: 0,
        cutoff_date: cutoffDate.toISOString()
      });
    }

    // Delete old records
    const [deleteResult] = await mariadbPool.query(`
      DELETE FROM subreddit_settings 
      WHERE updated_at < ?
    `, [cutoffDate]);

    const deletedCount = deleteResult.affectedRows;

    console.log(`✅ Cleanup completed: deleted ${deletedCount} old settings records`);

    res.json({
      success: true,
      message: `Cleanup completed successfully`,
      deleted_count: deletedCount,
      cutoff_date: cutoffDate.toISOString(),
      days_old: daysOld
    });

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cleanup old settings'
    });
  }
});

// Get all subreddit settings for a user (admin function)
app.get('/api/user-subreddit-settings', async (req, res) => {
  try {
    const { user_address, limit = 50, offset = 0 } = req.query;

    if (!user_address) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameter: user_address'
      });
    }

    // Validate user address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(user_address)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid user address format'
      });
    }

    const limitNum = parseInt(limit);
    const offsetNum = parseInt(offset);

    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      return res.status(400).json({
        success: false,
        error: 'Invalid limit parameter (must be between 1 and 100)'
      });
    }

    if (isNaN(offsetNum) || offsetNum < 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid offset parameter (must be >= 0)'
      });
    }

    // Query user's subreddit settings
    const [rows] = await mariadbPool.query(`
      SELECT subreddit, settings, created_at, updated_at 
      FROM subreddit_settings 
      WHERE user_address = ? 
      ORDER BY updated_at DESC 
      LIMIT ? OFFSET ?
    `, [user_address, limitNum, offsetNum]);

    // Get total count
    const [countRows] = await mariadbPool.query(`
      SELECT COUNT(*) as total 
      FROM subreddit_settings 
      WHERE user_address = ?
    `, [user_address]);

    const totalCount = countRows[0].total;

    // Parse settings for each record
    const settingsList = rows.map(row => {
      let parsedSettings;
      try {
        parsedSettings = JSON.parse(row.settings);
      } catch (parseError) {
        console.error('Error parsing settings for subreddit:', row.subreddit, parseError);
        parsedSettings = {};
      }

      return {
        subreddit: row.subreddit,
        settings: parsedSettings,
        created_at: row.created_at,
        updated_at: row.updated_at
      };
    });

    console.log(`📋 Retrieved ${settingsList.length} subreddit settings for user ${user_address}`);

    res.json({
      success: true,
      user_address: user_address,
      settings: settingsList,
      pagination: {
        total: totalCount,
        limit: limitNum,
        offset: offsetNum,
        has_more: (offsetNum + limitNum) < totalCount
      }
    });

  } catch (error) {
    console.error('❌ Error getting user subreddit settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user settings'
    });
  }
});

// --- Reddit Devvit Integration API ---

// Temporary image storage directory for Reddit uploads
const TEMP_IMAGES_DIR = '/home/ubuntu/tchart/img';

// Create temp images directory if it doesn't exist
if (!fs.existsSync(TEMP_IMAGES_DIR)) {
  console.log('Creating temp images directory:', TEMP_IMAGES_DIR);
  fs.mkdirSync(TEMP_IMAGES_DIR, { recursive: true });
}

// API для временной загрузки изображений для Reddit Devvit
app.post('/api/upload-temp-image', async (req, res) => {
  try {
    const { imageData, source, temporary, metadata } = req.body;

    console.log('📤 Temp image upload request from:', source);
    console.log('📋 Metadata:', metadata);
    console.log('📊 Image data length:', imageData?.length || 0);

    // Валидация входных данных
    if (!imageData) {
      return res.status(400).json({
        success: false,
        error: 'Image data is required'
      });
    }

    if (typeof imageData !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Image data must be a base64 string'
      });
    }

    // Проверяем, что это валидный base64 data URL
    if (!imageData.startsWith('data:image/')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid image format. Expected data:image/* format'
      });
    }

    // Генерируем уникальное имя файла
    const timestamp = Date.now();
    const randomId = crypto.randomBytes(8).toString('hex');
    const fileName = `temp_${timestamp}_${randomId}.png`;
    const filePath = path.join(TEMP_IMAGES_DIR, fileName);

    try {
      // Извлекаем base64 данные
      const base64Data = imageData.replace(/^data:image\/[^;]+;base64,/, '');

      // Проверяем валидность base64
      const buffer = Buffer.from(base64Data, 'base64');
      if (buffer.length === 0) {
        throw new Error('Invalid base64 data');
      }

      // Сохраняем временный файл
      fs.writeFileSync(filePath, buffer);

      console.log(`✅ Temp image saved: ${fileName} (${buffer.length} bytes)`);

      // Создаем URL для доступа к изображению
      const imageUrl = `${req.protocol}://${req.get('host')}/img/${fileName}`;

      // Планируем удаление файла через 1 час (для временных загрузок)
      if (temporary) {
        setTimeout(() => {
          try {
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
              console.log(`🗑️ Deleted temp image: ${fileName}`);
            }
          } catch (deleteError) {
            console.error('Error deleting temp image:', deleteError);
          }
        }, 60 * 60 * 1000); // 1 час
      }

      res.json({
        success: true,
        imageUrl: imageUrl,
        fileName: fileName,
        message: 'Image uploaded successfully'
      });

    } catch (saveError) {
      console.error('❌ Error saving temp image:', saveError);
      res.status(500).json({
        success: false,
        error: 'Failed to save image'
      });
    }

  } catch (error) {
    console.error('❌ Error in upload-temp-image endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// API для получения временных изображений
app.get('/img/:fileName', (req, res) => {
  try {
    const { fileName } = req.params;

    // Валидация имени файла (только разрешенные символы)
    if (!/^temp_\d+_[a-f0-9]{16}\.png$/.test(fileName)) {
      return res.status(400).send('Invalid file name');
    }

    const filePath = path.join(TEMP_IMAGES_DIR, fileName);

    if (!fs.existsSync(filePath)) {
      console.log(`📷 Temp image not found: ${fileName}`);
      return res.status(404).send('Image not found');
    }

    // Устанавливаем правильные заголовки
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Кэш на 1 час
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Отправляем файл
    res.sendFile(filePath);
    console.log(`📷 Served temp image: ${fileName}`);

  } catch (error) {
    console.error('Error serving temp image:', error);
    res.status(500).send('Internal server error');
  }
});

// API для получения временных изображений из Redis (для Devvit)
app.get('/api/temp-image/:imageKey', async (req, res) => {
  try {
    const { imageKey } = req.params;

    console.log(`📷 Request for temp image from Redis: ${imageKey}`);

    // Валидация ключа изображения
    if (!/^temp_image_\d+_[a-z0-9]+$/.test(imageKey)) {
      return res.status(400).send('Invalid image key');
    }

    // Здесь нужно подключиться к Redis, но у нас нет Redis в этом сервере
    // Поэтому мы будем возвращать ошибку или заглушку
    console.log(`❌ Redis not available in this server for key: ${imageKey}`);
    return res.status(404).send('Redis not available on this server');

  } catch (error) {
    console.error('Error serving temp image from Redis:', error);
    res.status(500).send('Internal server error');
  }
});

// Очистка старых временных файлов при запуске сервера
function cleanupOldTempImages() {
  try {
    if (!fs.existsSync(TEMP_IMAGES_DIR)) {
      return;
    }

    const files = fs.readdirSync(TEMP_IMAGES_DIR);
    const now = Date.now();
    let deletedCount = 0;

    files.forEach(fileName => {
      if (fileName.startsWith('temp_')) {
        const filePath = path.join(TEMP_IMAGES_DIR, fileName);
        const stats = fs.statSync(filePath);
        const fileAge = now - stats.mtime.getTime();

        // Удаляем файлы старше 2 часов
        if (fileAge > 2 * 60 * 60 * 1000) {
          try {
            fs.unlinkSync(filePath);
            deletedCount++;
          } catch (deleteError) {
            console.error(`Error deleting old temp file ${fileName}:`, deleteError);
          }
        }
      }
    });

    if (deletedCount > 0) {
      console.log(`🧹 Cleaned up ${deletedCount} old temp images`);
    }
  } catch (error) {
    console.error('Error during temp images cleanup:', error);
  }
}

// Запускаем очистку при старте
cleanupOldTempImages();

// Периодическая очистка каждый час
setInterval(cleanupOldTempImages, 60 * 60 * 1000);

// --- React frontend catch-all ---
// Изменяем порядок маршрутов - catch-all должен быть ПОСЛЕДНИМ
// и не перехватывать запросы к API

// --- NFT Minting API ---
app.post('/api/nft/sign-mint', async (req, res) => {
  try {
    const { userAddress } = req.body;
    if (!userAddress) return res.status(400).json({ error: 'Missing userAddress' });

    console.log(`📝 [NFT] Signing mint request for ${userAddress}`);

    // 1. Check if user ALREADY has an active reservation
    console.log(`⏱️  [NFT] Checking for existing reservation for ${userAddress}...`);
    const [existing] = await mariadbPool.query(
      `SELECT id, token_uri FROM nfts 
       WHERE is_minted = 2 AND reserved_by = ? 
       AND reserved_at > DATE_SUB(NOW(), INTERVAL 10 MINUTE) 
       LIMIT 1`,
      [userAddress]
    );

    let nftItem;
    if (existing.length > 0) {
      nftItem = existing[0];
      console.log(`ℹ️  [NFT] Reusing existing reservation for NFT #${nftItem.id}`);
    } else {
      // Find new available NFT
      const [available] = await mariadbPool.query(
        `SELECT id, token_uri FROM nfts 
         WHERE is_minted = 0 
         AND (reserved_at IS NULL OR reserved_at < DATE_SUB(NOW(), INTERVAL 10 MINUTE)) 
         ORDER BY RAND() LIMIT 1`
      );

      if (available.length === 0) {
        console.log(`⚠️  [NFT] No available NFTs to mint for ${userAddress}`);
        return res.status(404).json({ error: 'No NFTs available to mint' });
      }
      nftItem = available[0];
    }
    const tokenURI = nftItem.token_uri;

    console.log(`🔏 [NFT] Data for signing:`);
    console.log(`   - User: ${userAddress}`);
    console.log(`   - URI:  ${tokenURI}`);
    console.log(`   - Contract: ${process.env.CONTRACT_ADDRESS}`);

    // Generate signature
    const result = await generateMintSignature(userAddress, tokenURI);

    if (result.success) {
      // Mark as PENDING (2) and set reservation
      await mariadbPool.query(
        'UPDATE nfts SET is_minted = 2, reserved_at = NOW(), reserved_by = ? WHERE id = ?',
        [userAddress, nftItem.id]
      );

      console.log(`✅ [NFT] Signed NFT #${nftItem.id} for ${userAddress} (Status: PENDING)`);
      res.json({
        ...result.data,
        nftId: nftItem.id
      });
    } else {
      console.error("❌ [NFT] Sign error:", result.error);
      res.status(500).json({ error: 'Signing failed' });
    }
  } catch (e) {
    console.error("❌ [NFT] API error:", e);
    res.status(500).json({ error: 'Internal error' });
  }
});

// Endpoint to finalize minting after blockchain confirmation
app.post('/api/nft/confirm-mint', async (req, res) => {
  try {
    const { nftId, txHash } = req.body;
    if (!nftId) {
      console.warn("⚠️ [NFT] confirm-mint called without nftId");
      return res.status(400).json({ error: 'Missing nftId' });
    }

    console.log(`🏁 [NFT] Finalising mint for NFT #${nftId}. Transaction: ${txHash || 'UNKNOWN'}`);

    await mariadbPool.query(
      'UPDATE nfts SET is_minted = 1 WHERE id = ?',
      [nftId]
    );

    // Fetch token_uri to return to frontend
    const [result] = await mariadbPool.query(
      'SELECT token_uri FROM nfts WHERE id = ?',
      [nftId]
    );

    res.json({
      success: true,
      tokenURI: result.length > 0 ? result[0].token_uri : null
    });
  } catch (e) {
    console.error("❌ [NFT] Confirmation error:", e);
    res.status(500).json({ error: 'Confirmation failed' });
  }
});

// Root route
app.get('/', (req, res) => {
  const routeStartTime = Date.now();
  console.log(`📄 [ROUTE] Serving root / with query params:`, req.query);
  res.sendFile(path.join(__dirname, 'build', 'index.html'), (err) => {
    if (err) {
      console.error('❌ [ROUTE] Error serving index.html:', err);
    } else {
      console.log(`✅ [ROUTE] Served / in ${Date.now() - routeStartTime}ms`);
    }
  });
});

// Обязательно ограничиваем маршрут, чтобы он не перехватывал /api/*
app.get(/^(?!\/api\/).+$/, (req, res) => {
  const routeStartTime = Date.now();
  console.log(`📄 [ROUTE] Serving frontend route: ${req.url}`);
  res.sendFile(path.join(__dirname, 'build', 'index.html'), (err) => {
    if (err) {
      console.error(`❌ [ROUTE] Error serving ${req.url}:`, err);
    } else {
      console.log(`✅ [ROUTE] Served ${req.url} in ${Date.now() - routeStartTime}ms`);
    }
  });
});

// Start server
console.log(`⏱️  [SERVER] Starting HTTP server on port ${PORT}...`);
const serverStartTime = Date.now();

app.listen(PORT, () => {
  console.log(`✅ [SERVER] Server started on port ${PORT} in ${Date.now() - serverStartTime}ms`);
  console.log(`🌐 [SERVER] Total startup time: ${Date.now() - startTime}ms`);
  console.log(`🔗 [SERVER] API available at: http://localhost:${PORT}/api/images/:category`);
  console.log(`📁 [SERVER] Groups directory: ${GROUPS_DIR}`);

  // Check groups directory existence
  if (!fs.existsSync(GROUPS_DIR)) {
    console.log('⚠️  [SERVER] WARNING: Groups directory does not exist!');
    try {
      fs.mkdirSync(GROUPS_DIR, { recursive: true });
      console.log('✅ [SERVER] Created groups directory');
    } catch (err) {
      console.error('❌ [SERVER] Failed to create groups directory:', err);
    }
  } else {
    // Show list of configuration files
    const files = fs.readdirSync(GROUPS_DIR);
    console.log(`📋 [SERVER] Available group configurations: ${files.length} files`);
  }
});

// Function to find configuration file in both directories
function findConfigPath(groupId) {
  const telegramPath = path.join(GROUPS_DIR, `${groupId}.json`);
  const discordPath = path.join(DC_GROUPS_DIR, `${groupId}.json`);

  if (fs.existsSync(telegramPath)) {
    return telegramPath;
  } else if (fs.existsSync(discordPath)) {
    return discordPath;
  }
  return null;
} 