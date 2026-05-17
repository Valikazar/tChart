#!/bin/bash
set -e

echo "Starting server configuration..."

cd /root/tchart_service

echo "Extracting archives..."
unzip -o build.zip -d /var/www/tchart/ > /dev/null || true
unzip -o bot.zip -d bot/ > /dev/null || true
unzip -o pic.zip -d pic/ > /dev/null || true
unzip -o nft.zip -d NFT/ > /dev/null || true

echo "Moving backend files..."
mv server_package.json package.json || true
mkdir -p jsbot
mv tChartServerAPI.js jsbot/ || true
mv chartRendererAdapter.js jsbot/ || true
cp -r bot/fonts jsbot/ 2>/dev/null || true

echo "Setting up database..."
mysql -e "CREATE DATABASE IF NOT EXISTS tchart;"
mysql tchart < local_tchart.sql

echo "Installing Node dependencies..."
npm install --legacy-peer-deps
npm uninstall canvas
npm install canvas --build-from-source --legacy-peer-deps

echo "Installing Python dependencies..."
cd bot
pip3 install -r dc_requirements.txt --break-system-packages || true
pip3 install python-telegram-bot==13.7 requests python-dotenv Pillow --break-system-packages || true
cd ..

echo "Setting up Nginx..."
cp nginx.conf /etc/nginx/sites-available/tchart || true
ln -sf /etc/nginx/sites-available/tchart /etc/nginx/sites-enabled/ || true
rm -f /etc/nginx/sites-enabled/default || true
systemctl restart nginx || true

echo "Starting PM2 processes..."
pm2 start ecosystem.config.js || true
pm2 save || true

echo "Configuration complete!"
pm2 status
