# Script for chart-constructor API server deployment
# Creating an archive with necessary files

# Node.js 18 compatibility notice
Write-Host "==============================" -ForegroundColor Cyan
Write-Host "Chart Constructor Deployment" -ForegroundColor Cyan
Write-Host "Node.js 18 Compatible Version" -ForegroundColor Cyan
Write-Host "Unified Dependencies Architecture" -ForegroundColor Cyan
Write-Host "==============================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Architecture: Single node_modules in parent directory" -ForegroundColor Yellow
Write-Host "No duplication: jsbot/ uses parent dependencies" -ForegroundColor Yellow
Write-Host ""

# Load environment variables from .env file if it exists
if (Test-Path ".env") {
    Get-Content ".env" | Where-Object { $_ -match '=' -and $_ -notmatch '^#' } | ForEach-Object {
        $name, $value = $_ -split '=', 2
        $name = $name.Trim()
        $value = $value.Trim()
        # Set environment variable dynamically
        Set-Item -Path "env:$name" -Value $value
    }
}

# Setting up connection parameters
$serverIP = "23.94.168.19"
$sshPort = "2022"
$password = if ($env:SERVER_PASSWORD) { $env:SERVER_PASSWORD } else { "YOUR_SERVER_PASSWORD" }
$chartRemoteDir = "/home/ubuntu/tchart"
$serverRemoteDir = "/home/ubuntu/tchart_service"
$serverAppName = "tchart-server"

# Export connection variables to global scope for the helper function
$global:serverIP = $serverIP
$global:sshPort = $sshPort
$global:password = $password

# Bot tokens for replacement
$deployToken = if ($env:TELEGRAM_DEPLOY_TOKEN) { $env:TELEGRAM_DEPLOY_TOKEN } else { "YOUR_TELEGRAM_DEPLOY_TOKEN" }
$productionToken = if ($env:TELEGRAM_PRODUCTION_TOKEN) { $env:TELEGRAM_PRODUCTION_TOKEN } else { "YOUR_TELEGRAM_PRODUCTION_TOKEN" }

# Discord bot tokens
$discordDeployToken = if ($env:DISCORD_DEPLOY_TOKEN) { $env:DISCORD_DEPLOY_TOKEN } else { "YOUR_DISCORD_DEPLOY_TOKEN" }
$discordProductionToken = if ($env:DISCORD_PRODUCTION_TOKEN) { $env:DISCORD_PRODUCTION_TOKEN } else { "YOUR_DISCORD_PRODUCTION_TOKEN" }
$discordApplicationId = if ($env:DISCORD_APPLICATION_ID) { $env:DISCORD_APPLICATION_ID } else { "YOUR_DISCORD_APPLICATION_ID" }


# Function to replace bot token in config file
function Replace-BotToken {
    param (
        [string]$configPath,
        [string]$newToken
    )
    
    try {
        $config = Get-Content $configPath -Raw | ConvertFrom-Json
        $config.bot_token = $newToken
        $config | ConvertTo-Json -Depth 10 | Set-Content $configPath -Force
        Write-Host "Bot token replaced successfully in $configPath" -ForegroundColor Green
    }
    catch {
        Write-Host "Error replacing bot token in $configPath : $_" -ForegroundColor Red
    }
}

# Function to replace Discord bot token and application ID
function Replace-DiscordBotToken {
    param (
        [string]$configPath,
        [string]$newToken,
        [string]$newApplicationId
    )
    
    try {
        $config = Get-Content $configPath -Raw | ConvertFrom-Json
        $config.bot_token = $newToken
        $config.application_id = $newApplicationId
        $config | ConvertTo-Json -Depth 10 | Set-Content $configPath -Force
        Write-Host "Discord bot token and application ID replaced successfully in $configPath" -ForegroundColor Green
    }
    catch {
        Write-Host "Error replacing Discord bot token in $configPath : $_" -ForegroundColor Red
    }
}

# Function to upload file with retry logic
function Upload-WithRetry {
    param (
        [string]$SourcePath,
        [string]$DestinationPath,
        [int]$MaxRetries = 3,
        [int]$RetryDelaySeconds = 5
    )

    $retryCount = 0
    $success = $false

    do {
        if ($retryCount -gt 0) {
            Write-Host "Retry attempt $retryCount of $MaxRetries..." -ForegroundColor Yellow
            Start-Sleep -Seconds $RetryDelaySeconds
        }

        Write-Host "Uploading $SourcePath to server (Attempt $($retryCount + 1))..." -ForegroundColor Cyan
        
        # Use global variables for connection details
        pscp -P $global:sshPort -pw $global:password $SourcePath "root@${global:serverIP}:$DestinationPath"

        if ($LASTEXITCODE -eq 0) {
            $success = $true
            Write-Host "Upload successful!" -ForegroundColor Green
        }
        else {
            Write-Host "Upload failed with exit code $LASTEXITCODE" -ForegroundColor Red
            $retryCount++
        }

    } while (-not $success -and $retryCount -lt $MaxRetries)

    if (-not $success) {
        throw "Failed to upload $SourcePath after $MaxRetries attempts"
    }
}

# Function to download file with retry logic
function Download-WithRetry {
    param (
        [string]$RemotePath,
        [string]$LocalPath,
        [int]$MaxRetries = 3,
        [int]$RetryDelaySeconds = 5
    )

    $retryCount = 0
    $success = $false

    do {
        if ($retryCount -gt 0) {
            Write-Host "Retry attempt $retryCount of $MaxRetries..." -ForegroundColor Yellow
            Start-Sleep -Seconds $RetryDelaySeconds
        }

        Write-Host "Downloading $RemotePath from server (Attempt $($retryCount + 1))..." -ForegroundColor Cyan
        
        # Use global variables for connection details
        pscp -P $global:sshPort -pw $global:password "root@${global:serverIP}:$RemotePath" $LocalPath

        if ($LASTEXITCODE -eq 0) {
            $success = $true
            Write-Host "Download successful!" -ForegroundColor Green
        }
        else {
            Write-Host "Download failed with exit code $LASTEXITCODE" -ForegroundColor Red
            $retryCount++
        }

    } while (-not $success -and $retryCount -lt $MaxRetries)

    if (-not $success) {
        throw "Failed to download $RemotePath after $MaxRetries attempts"
    }
}

# Function to install Node dependencies on server
function Install-NodeDependencies {
    Write-Host "Installing Node.js dependencies on server..." -ForegroundColor Cyan
    
    # Check if remote directory exists and create it if needed
    Write-Host "Checking remote directory..." -ForegroundColor Cyan
    plink -ssh -P $sshPort root@$serverIP -pw $password "mkdir -p $serverRemoteDir"
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Error creating remote directory: $serverRemoteDir" -ForegroundColor Red
        return
    }
    
    # Update Node.js to version 18
    Write-Host "Updating Node.js to version 18..." -ForegroundColor Cyan
    $nodeUpdateCmd = @"
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash - && 
sudo apt-get install -y nodejs && 
node --version && 
npm --version
"@
    plink -ssh -P $sshPort root@$serverIP -pw $password $nodeUpdateCmd
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Warning: Could not update Node.js to version 18" -ForegroundColor Yellow
    }
    else {
        Write-Host "Node.js 18 installed successfully" -ForegroundColor Green
    }
    
    # Install system dependencies for canvas and Node.js 18
    Write-Host "Installing system dependencies for canvas module and Node.js 18..." -ForegroundColor Cyan
    $systemDepsCmd = @"
apt-get update && 
apt-get install -y build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev python3-dev pkg-config libpixman-1-dev libcairo-gobject2 libgirepository1.0-dev
"@
    plink -ssh -P $sshPort root@$serverIP -pw $password $systemDepsCmd
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Warning: Could not install all system dependencies" -ForegroundColor Yellow
    }
    
    # Copy package.json to server if it exists locally
    if (Test-Path "package.json") {
        Write-Host "Uploading package.json..." -ForegroundColor Cyan
        pscp -P $sshPort -pw $password "package.json" "root@${serverIP}:$serverRemoteDir/"
        
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Error uploading package.json" -ForegroundColor Red
            return
        }
    }
    else {
        Write-Host "Warning: package.json not found locally" -ForegroundColor Yellow
    }
    
    # Remove node_modules and package-lock.json to ensure clean install
    Write-Host "Removing old node_modules and package-lock.json..." -ForegroundColor Cyan
    plink -ssh -P $sshPort root@$serverIP -pw $password "cd $serverRemoteDir && rm -rf node_modules package-lock.json"
    
    # Clean npm cache for Node.js 18 compatibility
    Write-Host "Cleaning npm cache..." -ForegroundColor Cyan
    plink -ssh -P $sshPort root@$serverIP -pw $password "cd $serverRemoteDir && npm cache clean --force"
    
    # Install dependencies with legacy peer deps for compatibility
    Write-Host "Installing dependencies with Node.js 18 compatibility..." -ForegroundColor Cyan
    plink -ssh -P $sshPort root@$serverIP -pw $password "cd $serverRemoteDir && npm install --legacy-peer-deps --verbose"
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Error installing Node.js dependencies with --legacy-peer-deps, trying --force..." -ForegroundColor Yellow
        plink -ssh -P $sshPort root@$serverIP -pw $password "cd $serverRemoteDir && npm install --force --verbose"
        
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Error installing Node.js dependencies" -ForegroundColor Red
            return
        }
    }
    
    # Explicitly install and rebuild canvas module for Node.js 18
    Write-Host "Installing canvas module for Node.js 18..." -ForegroundColor Cyan
    $canvasInstallCmd = @"
cd $serverRemoteDir && 
npm uninstall canvas && 
npm install canvas --build-from-source --legacy-peer-deps
"@
    plink -ssh -P $sshPort root@$serverIP -pw $password $canvasInstallCmd
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Warning: Error installing canvas module, trying rebuild..." -ForegroundColor Yellow
        
        # Try general rebuild for Node.js 18
        Write-Host "Trying general rebuild for Node.js 18..." -ForegroundColor Yellow
        plink -ssh -P $sshPort root@$serverIP -pw $password "cd $serverRemoteDir && npm rebuild --verbose"
        
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Error rebuilding native modules for Node.js 18" -ForegroundColor Red
            Write-Host "Manual steps may be required on the server:" -ForegroundColor Yellow
            Write-Host "1. ssh root@$serverIP -p $sshPort" -ForegroundColor Yellow
            Write-Host "2. cd $serverRemoteDir" -ForegroundColor Yellow
            Write-Host "3. npm uninstall canvas" -ForegroundColor Yellow
            Write-Host "4. apt-get update && apt-get install -y build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev python3-dev" -ForegroundColor Yellow
            Write-Host "5. npm install canvas --build-from-source --legacy-peer-deps" -ForegroundColor Yellow
            return
        }
    }
    
    # Verify canvas module installation with Node.js 18
    Write-Host "Verifying canvas module installation with Node.js 18..." -ForegroundColor Cyan
    $verifyScript = "const { createCanvas } = require('canvas'); console.log('Canvas module loaded successfully with Node.js ' + process.version);"
    plink -ssh -P $sshPort root@$serverIP -pw $password "cd $serverRemoteDir && echo `"$verifyScript`" > verify-canvas.js && node verify-canvas.js && rm verify-canvas.js"
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Warning: Canvas module verification failed" -ForegroundColor Yellow
    }
    else {
        Write-Host "Canvas module verification successful with Node.js 18" -ForegroundColor Green
    }
    
    # Display Node.js and npm versions
    Write-Host "Checking final Node.js and npm versions..." -ForegroundColor Cyan
    plink -ssh -P $sshPort root@$serverIP -pw $password "node --version && npm --version"
    
    Write-Host "Node.js 18 dependencies installed and rebuilt successfully!" -ForegroundColor Green
}

# Function to deploy React application
function Deploy-ReactApp {
    # Check local Node.js version
    Write-Host "Checking local Node.js version..." -ForegroundColor Cyan
    try {
        $nodeVersion = node --version
        Write-Host "Local Node.js version: $nodeVersion" -ForegroundColor Green
        
        # Parse version number
        $versionNumber = [version]($nodeVersion -replace 'v', '' -split '\.' | ForEach-Object { [int]$_ })
        if ($versionNumber.Major -lt 18) {
            Write-Host "Warning: Local Node.js version is less than 18. Consider upgrading for best compatibility." -ForegroundColor Yellow
        }
    }
    catch {
        Write-Host "Warning: Could not check local Node.js version" -ForegroundColor Yellow
    }

    # Update networks data before building
    Write-Host "Updating networks data..." -ForegroundColor Cyan
    npm run update-networks
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Error updating networks data" -ForegroundColor Red
        return
    }

    # Preparing files for deployment
    Write-Host "Building React application with Node.js 18 compatibility..." -ForegroundColor Cyan
    
    # Clean install for better compatibility
    Write-Host "Cleaning npm cache for optimal build..." -ForegroundColor Cyan
    npm cache clean --force
    
    # Build with legacy peer deps if needed
    npm run build
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Build failed, trying with legacy peer deps..." -ForegroundColor Yellow
        $env:NODE_OPTIONS = "--legacy-peer-deps"
        npm run build
        Remove-Item Env:NODE_OPTIONS -ErrorAction SilentlyContinue
        
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Error building React application" -ForegroundColor Red
            return
        }
    }
    
    # Clear previous archive if exists
    Write-Host "Creating archive for deployment..." -ForegroundColor Cyan
    Remove-Item -Path "build.zip" -Force -ErrorAction SilentlyContinue
    
    # Add delay to let system release files
    Write-Host "Waiting 5 seconds for file system to release build files..." -ForegroundColor Yellow
    Start-Sleep -Seconds 5
    
    # Create archive with all build files
    try {
        # Use 7zip for compression if available (fewer problems with long names)
        if (Get-Command "7z" -ErrorAction SilentlyContinue) {
            Write-Host "Using 7zip for compression..." -ForegroundColor Cyan
            & 7z a -tzip build.zip ".\build\*" -r
        }
        else {
            # Traditional PowerShell approach
            Compress-Archive -Path ".\build\*" -DestinationPath "build.zip" -Force
        }
        
        if (-not (Test-Path "build.zip")) {
            throw "Failed to create build.zip"
        }
    }
    catch {
        Write-Host "Error creating archive: $_" -ForegroundColor Red
        Write-Host "Trying alternative approach..." -ForegroundColor Yellow
        
        # Alternative approach - using tar through WSL if available
        if (Get-Command "wsl" -ErrorAction SilentlyContinue) {
            Write-Host "Using WSL tar for compression..." -ForegroundColor Cyan
            wsl tar -czf build.tar.gz -C build .
            if (Test-Path "build.tar.gz") {
                $archivePath = "build.tar.gz"
                $isGzipArchive = $true
            }
            else {
                Write-Host "Failed to create archive using alternative methods" -ForegroundColor Red
                return
            }
        }
        else {
            Write-Host "No alternative compression methods available" -ForegroundColor Red
            return
        }
    }
    
    $archivePath = if ($isGzipArchive) { "build.tar.gz" } else { "build.zip" }
    $extractCmd = if ($isGzipArchive) {
        "mkdir -p $chartRemoteDir && tar -xzf $chartRemoteDir/$archivePath -C $chartRemoteDir && rm $chartRemoteDir/$archivePath"
    }
    else {
        "find $chartRemoteDir/ -type f -not -name 'build.zip' -delete && unzip -o $chartRemoteDir/build.zip -d $chartRemoteDir/ && rm $chartRemoteDir/build.zip"
    }
    
    # Upload archive to server with retry
    try {
        Upload-WithRetry -SourcePath $archivePath -DestinationPath "$chartRemoteDir/"
    }
    catch {
        Write-Host "Error uploading archive to server: $_" -ForegroundColor Red
        return
    }
    
    # Extract files on server and clean up
    Write-Host "Extracting files on server..." -ForegroundColor Cyan
    plink -ssh -P $sshPort root@$serverIP -pw $password $extractCmd
    
    # Clean up local archive
    Remove-Item -Path $archivePath -Force -ErrorAction SilentlyContinue
    
    Write-Host "React application deployed successfully!" -ForegroundColor Green
}

# Function to deploy bot files (both Telegram and Discord)
function Deploy-BotFiles {
    Write-Host "Preparing bot files for deployment (Telegram and Discord)..." -ForegroundColor Cyan
    
    # Check if remote directory exists and create it if needed
    Write-Host "Checking remote directory..." -ForegroundColor Cyan
    plink -ssh -P $sshPort root@$serverIP -pw $password "mkdir -p $serverRemoteDir/bot"
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Error creating remote directory: $serverRemoteDir/bot" -ForegroundColor Red
        return
    }
    
    # Replace tokens with deployment versions
    Write-Host "Replacing bot tokens with deployment versions..." -ForegroundColor Cyan
    Replace-BotToken -configPath ".\bot\config_bot_tg.json" -newToken $deployToken
    Replace-DiscordBotToken -configPath ".\bot\dc_config_bot.json" -newToken $discordDeployToken -newApplicationId $discordApplicationId
    
    # Create temporary directory for bot files
    $tempBotDir = ".\deploy\bot_temp"
    if (Test-Path $tempBotDir) {
        Remove-Item -Path $tempBotDir -Recurse -Force
    }
    New-Item -Path $tempBotDir -ItemType Directory -Force | Out-Null
    
    # Copy all bot files including Discord bot files, explicitly excluding groups, dc_groups and __pycache__
    Get-ChildItem -Path ".\bot\" -File | Where-Object { 
        $_.Name -ne "groups" -and $_.Name -ne "dc_groups" 
    } | ForEach-Object {
        Copy-Item -Path $_.FullName -Destination "$tempBotDir\" -Force
        Write-Host "Copied file: $($_.Name)" -ForegroundColor DarkGray
    }
    
    # Copy directories excluding groups, dc_groups and __pycache__
    Get-ChildItem -Path ".\bot\" -Directory | Where-Object { 
        $_.Name -ne "groups" -and $_.Name -ne "dc_groups" -and $_.Name -ne "__pycache__" 
    } | ForEach-Object {
        Copy-Item -Path $_.FullName -Destination "$tempBotDir\$($_.Name)" -Recurse -Force
        Write-Host "Copied directory: $($_.Name)" -ForegroundColor DarkGray
    }
    
    # Create deploy directory if it doesn't exist
    if (-not (Test-Path ".\deploy")) {
        New-Item -Path ".\deploy" -ItemType Directory -Force | Out-Null
    }
    
    # Create archive with bot files
    Write-Host "Creating bot files archive..." -ForegroundColor Cyan
    $botArchive = ".\deploy\bot_files.zip"
    Remove-Item -Path $botArchive -Force -ErrorAction SilentlyContinue
    
    try {
        if (Get-Command "7z" -ErrorAction SilentlyContinue) {
            & 7z a -tzip $botArchive "$tempBotDir\*" -r
        }
        else {
            # Add extra delay before using Compress-Archive
            Write-Host "Waiting additional 2 seconds before compression..." -ForegroundColor Yellow
            Start-Sleep -Seconds 2
            
            Compress-Archive -Path "$tempBotDir\*" -DestinationPath $botArchive -Force
        }
    }
    catch {
        Write-Host "Error creating bot archive: $_" -ForegroundColor Red
        Remove-Item -Path $tempBotDir -Recurse -Force -ErrorAction SilentlyContinue
        return
    }
    
    # Restore original tokens
    Write-Host "Restoring original bot tokens..." -ForegroundColor Cyan
    Replace-BotToken -configPath ".\bot\config_bot_tg.json" -newToken $productionToken
    Replace-DiscordBotToken -configPath ".\bot\dc_config_bot.json" -newToken $discordProductionToken -newApplicationId $discordApplicationId
    
    # Clean up temporary directory
    Remove-Item -Path $tempBotDir -Recurse -Force -ErrorAction SilentlyContinue
    
    # Upload archive to server with retry
    try {
        Upload-WithRetry -SourcePath $botArchive -DestinationPath "$serverRemoteDir/"
    }
    catch {
        Write-Host "Error uploading bot files to server: $_" -ForegroundColor Red
        return
    }
    
    # Delete local archive
    Remove-Item -Path $botArchive -Force -ErrorAction SilentlyContinue
    
    # Create enhanced package.json for server with Discord dependencies
    Write-Host "Creating server package.json with Discord dependencies for Node.js 18..." -ForegroundColor Cyan
    $serverPackageJson = @"
{
  "name": "tchart-server",
  "version": "1.0.0",
  "description": "tChart Server API with Telegram and Discord bots",
  "main": "server.js",
  "engines": {
    "node": ">=18.0.0",
    "npm": ">=9.0.0"
  },
  "scripts": {
    "start": "node server.js",
    "start-tg-bot": "cd bot && python3 tg_chart_bot.py",
    "start-dc-bot": "cd bot && python3 dc_chart_bot.py"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "mysql2": "^3.14.1",
    "unique-names-generator": "^4.7.1",
    "morgan": "^1.10.0",
    "canvas": "^2.11.2",
    "axios": "^1.8.4",
    "ethers": "^6.14.1",
    "dotenv": "^16.4.5",
    "ts-node": "^10.9.2",
    "typescript": "^5.3.3",
    "uuid": "^11.1.0",
    "fontkit": "^2.0.4",
    "body-parser": "^1.20.2"
  }
}
"@
    
    # Save server package.json to temporary file
    $tempPackageJson = ".\server_package.json"
    $serverPackageJson | Out-File -FilePath $tempPackageJson -Encoding UTF8
    
    # Upload server package.json
    pscp -P $sshPort -pw $password $tempPackageJson "root@${serverIP}:$serverRemoteDir/package.json"
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Error uploading server package.json" -ForegroundColor Red
        Remove-Item -Path $tempPackageJson -Force -ErrorAction SilentlyContinue
        return
    }
    
    # Clean up temporary file
    Remove-Item -Path $tempPackageJson -Force -ErrorAction SilentlyContinue
    Write-Host "Server package.json uploaded successfully" -ForegroundColor Green
    
    # Upload server.js file
    Write-Host "Uploading server.js to server..." -ForegroundColor Cyan
    pscp -P $sshPort -pw $password "server.js" "root@${serverIP}:$serverRemoteDir/"
    
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Error uploading server.js to server" -ForegroundColor Red
        return
    }

    # Upload .env file
    if (Test-Path ".env") {
        Write-Host "Uploading .env file to server..." -ForegroundColor Cyan
        pscp -P $sshPort -pw $password ".env" "root@${serverIP}:$serverRemoteDir/"
        
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Error uploading .env file" -ForegroundColor Red
            return
        }
        Write-Host ".env file uploaded successfully" -ForegroundColor Green
    }
    else {
        Write-Host "Warning: .env file not found locally, server might fail to start if env vars are missing" -ForegroundColor Yellow
    }
    
    # Install server dependencies
    Write-Host "Installing server dependencies (npm install)..." -ForegroundColor Cyan
    plink -ssh -P $sshPort root@$serverIP -pw $password "cd $serverRemoteDir && npm install --legacy-peer-deps"
    
    # Extract archive on server
    Write-Host "Extracting bot files on server..." -ForegroundColor Cyan
    $serverCmd = "cd $serverRemoteDir && mkdir -p bot && find bot/ -maxdepth 1 ! -name 'groups' ! -name 'dc_groups' ! -name 'bot' -exec rm -rf {} + && unzip -o bot_files.zip -d bot/ && rm bot_files.zip"
    
    plink -ssh -P $sshPort root@$serverIP -pw $password $serverCmd
    
    # Install Python dependencies for both bots
    Write-Host "Installing Python dependencies for both bots..." -ForegroundColor Cyan
    $installPythonDeps = @"
cd $serverRemoteDir/bot && 
pip3 install -r dc_requirements.txt && 
echo 'Discord bot dependencies installed' &&
pip3 install python-telegram-bot==13.7 requests python-dotenv Pillow &&
echo 'Telegram bot dependencies installed'
"@
    plink -ssh -P $sshPort root@$serverIP -pw $password $installPythonDeps
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Warning: Some Python dependencies may not have installed correctly" -ForegroundColor Yellow
    }
    else {
        Write-Host "Python dependencies installed successfully" -ForegroundColor Green
    }
    
    # Create PM2 ecosystem file for all services (unified architecture)
    Write-Host "Creating PM2 ecosystem file for all services (unified architecture)..." -ForegroundColor Cyan
    Write-Host "Services: telegram-bot, discord-bot, tchart-server, tchart-api" -ForegroundColor Yellow
    $ecosystemConfig = @"
module.exports = {
  apps: [
    {
      name: 'telegram-bot',
      script: 'tg_chart_bot.py',
      cwd: '$serverRemoteDir/bot',
      interpreter: 'python3',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'discord-bot',
      script: 'dc_chart_bot.py',
      cwd: '$serverRemoteDir/bot',
      interpreter: 'python3',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: '$serverAppName',
      script: 'server.js',
      cwd: '$serverRemoteDir',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3002
      }
    },
    {
      name: 'tchart-api',
      script: 'jsbot/tChartServerAPI.js',
      cwd: '$serverRemoteDir',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      }
    }
  ]
};
"@
    
    # Save ecosystem config to temporary file
    $tempEcosystem = ".\ecosystem.config.js"
    $ecosystemConfig | Out-File -FilePath $tempEcosystem -Encoding UTF8
    
    # Upload ecosystem config
    pscp -P $sshPort -pw $password $tempEcosystem "root@${serverIP}:$serverRemoteDir/"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "PM2 ecosystem config uploaded successfully" -ForegroundColor Green
    }
    else {
        Write-Host "Warning: Could not upload PM2 ecosystem config" -ForegroundColor Yellow
    }
    
    # Clean up temporary file
    Remove-Item -Path $tempEcosystem -Force -ErrorAction SilentlyContinue
    
    # Restart ALL services to ensure everything is reloaded
    Write-Host "Restarting all services..." -ForegroundColor Cyan
    plink -ssh -P $sshPort root@$serverIP -pw $password "cd $serverRemoteDir && pm2 restart tchart-api && pm2 restart $serverAppName"
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Warning: There was an issue restarting some services" -ForegroundColor Yellow
        Write-Host "Trying to start services using ecosystem config..." -ForegroundColor Cyan
        plink -ssh -P $sshPort root@$serverIP -pw $password "cd $serverRemoteDir && pm2 start ecosystem.config.js"
    }
    else {
        Write-Host "All services restarted successfully" -ForegroundColor Green
    }
    
    # Restart server application and start bot services
    Write-Host "Managing PM2 bot services..." -ForegroundColor Cyan
    $pm2Commands = @"
cd $serverRemoteDir &&
pm2 delete telegram-bot discord-bot tchart-api tchart-server 2>/dev/null || true &&
pm2 start ecosystem.config.js &&
pm2 save &&
pm2 list
"@
    plink -ssh -P $sshPort root@$serverIP -pw $password $pm2Commands
    
    # Display running services
    Write-Host "Checking PM2 services status:" -ForegroundColor Cyan
    plink -ssh -P $sshPort root@$serverIP -pw $password "pm2 list | cat"
    
    # Cleanup local temporary files
    Remove-Item -Path $botArchive -Force -ErrorAction SilentlyContinue
    Remove-Item -Path "$tempBotDir" -Recurse -Force -ErrorAction SilentlyContinue
    
    Write-Host "Bot files, server.js, and PM2 services deployed successfully!" -ForegroundColor Green
}

# Function to sync pic folder with server
function Sync-PicFolder {
    Write-Host "Synchronizing pic folder with server..." -ForegroundColor Cyan
    Write-Host "This will delete local pic folder and download from server (via Archive)" -ForegroundColor Yellow
    
    # Confirm action
    $confirm = Read-Host "Are you sure you want to delete local pic folder and download from server? (y/N)"
    if ($confirm -ne "y" -and $confirm -ne "Y") {
        Write-Host "Operation cancelled by user" -ForegroundColor Yellow
        return
    }
    
    # Check if remote pic directory exists
    Write-Host "Checking if pic directory exists on server..." -ForegroundColor Cyan
    plink -ssh -P $sshPort root@$serverIP -pw $password "test -d $serverRemoteDir/pic && echo 'exists' || echo 'not_exists'"
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Error checking remote pic directory" -ForegroundColor Red
        return
    }

    # Remove local pic directory if exists
    if (Test-Path ".\pic") {
        Write-Host "Removing local pic directory..." -ForegroundColor Cyan
        Remove-Item -Path ".\pic" -Recurse -Force
        Write-Host "Local pic directory removed" -ForegroundColor Green
    }
    
    # Create local pic directory
    New-Item -Path ".\pic" -ItemType Directory -Force | Out-Null
    
    # Archive on server
    Write-Host "Creating archive on server..." -ForegroundColor Cyan
    $archiveName = "pic_backup.zip"
    
    # Check for zip and install if needed, then zip the folder
    $zipCmd = "cd $serverRemoteDir && if ! command -v zip > /dev/null; then echo 'Installing zip...'; apt-get update && apt-get install -y zip; fi && zip -r $archiveName pic"
    
    plink -ssh -P $sshPort root@$serverIP -pw $password $zipCmd
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Error creating archive on server" -ForegroundColor Red
        Write-Host "Attempting legacy download method..." -ForegroundColor Yellow
        
        # Fallback to old method if zip fails
        pscp -P $sshPort -pw $password -r "root@${serverIP}:$serverRemoteDir/pic/*" ".\pic\"
        return
    }
    
    # Download archive
    try {
        Download-WithRetry -RemotePath "$serverRemoteDir/$archiveName" -LocalPath ".\"
    }
    catch {
        Write-Host "Error downloading archive: $_" -ForegroundColor Red
        return
    }
    
    # Extract locally
    Write-Host "Extracting archive..." -ForegroundColor Cyan
    try {
        if (Get-Command "7z" -ErrorAction SilentlyContinue) {
            & 7z x -y ".\$archiveName"
        }
        else {
            Expand-Archive -Path ".\$archiveName" -DestinationPath ".\" -Force
        }
        Write-Host "Extraction successful" -ForegroundColor Green
    }
    catch {
        Write-Host "Error extracting archive: $_" -ForegroundColor Red
    }
    
    # Cleanup
    Write-Host "Cleaning up..." -ForegroundColor Cyan
    Remove-Item -Path ".\$archiveName" -Force -ErrorAction SilentlyContinue
    plink -ssh -P $sshPort root@$serverIP -pw $password "rm $serverRemoteDir/$archiveName"
    
    # Show downloaded structure
    if (Test-Path ".\pic") {
        Write-Host "Pic folder downloaded successfully from server!" -ForegroundColor Green
        Get-ChildItem -Path ".\pic" -Directory | ForEach-Object {
            $subItems = Get-ChildItem -Path $_.FullName -Recurse | Measure-Object
            Write-Host "  $($_.Name): $($subItems.Count) items" -ForegroundColor DarkGray
        }
    }
    else {
        Write-Host "Warning: Pic folder appears empty" -ForegroundColor Yellow
    }
}

# Function to sync database with server
function Sync-Database {
    Write-Host "Synchronizing database with server..." -ForegroundColor Cyan
    Write-Host "This will clear local database and download from server" -ForegroundColor Yellow
    
    # Confirm action
    $confirm = Read-Host "Are you sure you want to clear local database and download from server? (y/N)"
    if ($confirm -ne "y" -and $confirm -ne "Y") {
        Write-Host "Operation cancelled by user" -ForegroundColor Yellow
        return
    }
    
    # Database configuration
    $dbHost = "127.0.0.1"
    $dbUser = "root"
    $dbPassword = "root"
    $dbName = "tchart"
    $dbPort = "3306"
    
    # Check database connection and allow configuration
    Write-Host "Checking local database connection..." -ForegroundColor Cyan
    
    # First find MariaDB/MySQL client for connection test
    $mariadbPaths = @(
        "C:\Program Files\MariaDB 12.1\bin\",
        "C:\Program Files\MariaDB 12.0\bin\",
        "C:\Program Files\MariaDB 11.7\bin\",
        "C:\Program Files\MariaDB 11.6\bin\",
        "C:\Program Files\MariaDB 11.5\bin\",
        "C:\Program Files\MariaDB 11.4\bin\",
        "C:\Program Files\MariaDB 11.3\bin\",
        "C:\Program Files\MariaDB 11.2\bin\",
        "C:\Program Files\MariaDB 11.1\bin\",
        "C:\Program Files\MariaDB 11.0\bin\",
        "C:\Program Files\MariaDB 10.11\bin\",
        "C:\Program Files\MariaDB 10.10\bin\",
        "C:\Program Files\MariaDB 10.9\bin\",
        "C:\Program Files\MariaDB 10.8\bin\",
        "C:\Program Files\MariaDB 10.7\bin\",
        "C:\Program Files\MariaDB 10.6\bin\",
        "C:\Program Files\MariaDB 10.5\bin\",
        "C:\Program Files\MariaDB 10.4\bin\",
        "C:\Program Files\MySQL\MySQL Server 8.0\bin\",
        "C:\Program Files\MySQL\MySQL Server 5.7\bin\",
        "C:\xampp\mysql\bin\"
    )
    
    $testClient = $null
    foreach ($path in $mariadbPaths) {
        if (Test-Path "$path\mariadb.exe") {
            $testClient = "$path\mariadb.exe"
            break
        }
        elseif (Test-Path "$path\mysql.exe") {
            $testClient = "$path\mysql.exe"
            break
        }
    }
    
    if (-not $testClient) {
        # Try system PATH - actually test if mysql exists
        try {
            $null = Get-Command "mysql" -ErrorAction Stop
            $testClient = "mysql"
        }
        catch {
            $testClient = $null
        }
    }
    
    if ($testClient) {
        try {
            $connectionTest = & $testClient --host=$dbHost --port=$dbPort --user=$dbUser --password=$dbPassword -e "SELECT 1;" 2>&1
            
            if ($LASTEXITCODE -ne 0) {
                Write-Host "Database connection failed: $connectionTest" -ForegroundColor Red
                Write-Host "Please configure your local MariaDB/MySQL connection:" -ForegroundColor Yellow
                
                $configureDb = Read-Host "Do you want to configure database connection? (y/N)"
                if ($configureDb -eq "y" -or $configureDb -eq "Y") {
                    $dbHost = Read-Host "Database host (default: 127.0.0.1)" 
                    if ([string]::IsNullOrWhiteSpace($dbHost)) { $dbHost = "127.0.0.1" }
                    
                    $dbPort = Read-Host "Database port (default: 3306)"
                    if ([string]::IsNullOrWhiteSpace($dbPort)) { $dbPort = "3306" }
                    
                    $dbUser = Read-Host "Database user (default: root)"
                    if ([string]::IsNullOrWhiteSpace($dbUser)) { $dbUser = "root" }
                    
                    $dbPassword = Read-Host "Database password" -AsSecureString
                    $dbPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($dbPassword))
                    
                    Write-Host "Testing new connection..." -ForegroundColor Cyan
                    $connectionTest = & $testClient --host=$dbHost --port=$dbPort --user=$dbUser --password=$dbPassword -e "SELECT 1;" 2>&1
                    
                    if ($LASTEXITCODE -ne 0) {
                        Write-Host "Database connection still failed: $connectionTest" -ForegroundColor Red
                        Write-Host "Please ensure MariaDB/MySQL is running and credentials are correct" -ForegroundColor Yellow
                        return
                    }
                }
                else {
                    Write-Host "Database connection required. Operation cancelled." -ForegroundColor Yellow
                    Write-Host "To install MariaDB/MySQL on Windows:" -ForegroundColor Cyan
                    Write-Host "1. Download MariaDB from https://mariadb.org/download/" -ForegroundColor DarkGray
                    Write-Host "2. Or use XAMPP: https://www.apachefriends.org/" -ForegroundColor DarkGray
                    Write-Host "3. Or use Docker: docker run --name mariadb -e MYSQL_ROOT_PASSWORD=root -p 3306:3306 -d mariadb:latest" -ForegroundColor DarkGray
                    return
                }
            }
            
            Write-Host "Database connection successful!" -ForegroundColor Green
        }
        catch {
            Write-Host "Error testing database connection: $_" -ForegroundColor Red
            Write-Host "MariaDB/MySQL client not found or not working properly" -ForegroundColor Yellow
            Write-Host "To install MariaDB/MySQL on Windows:" -ForegroundColor Cyan
            Write-Host "1. Download MariaDB from https://mariadb.org/download/" -ForegroundColor DarkGray
            Write-Host "2. Or use XAMPP: https://www.apachefriends.org/" -ForegroundColor DarkGray
            Write-Host "3. Or use Docker: docker run --name mariadb -e MYSQL_ROOT_PASSWORD=root -p 3306:3306 -d mariadb:latest" -ForegroundColor DarkGray
            return
        }
    }
    else {
        Write-Host "No MariaDB/MySQL client found for connection test" -ForegroundColor Red
        Write-Host "Please install MariaDB/MySQL first" -ForegroundColor Yellow
        Write-Host "To install MariaDB/MySQL on Windows:" -ForegroundColor Cyan
        Write-Host "1. Download MariaDB from https://mariadb.org/download/" -ForegroundColor DarkGray
        Write-Host "2. Or use XAMPP: https://www.apachefriends.org/" -ForegroundColor DarkGray
        Write-Host "3. Or use Docker: docker run --name mariadb -e MYSQL_ROOT_PASSWORD=root -p 3306:3306 -d mariadb:latest" -ForegroundColor DarkGray
        return
    }
    
    # Check if MariaDB/MySQL tools are available locally
    Write-Host "Checking if MariaDB/MySQL tools are available..." -ForegroundColor Cyan
    
    # Try to find MariaDB/MySQL binaries
    $mariadbPaths = @(
        "C:\Program Files\MariaDB 12.1\bin\",
        "C:\Program Files\MariaDB 12.0\bin\",
        "C:\Program Files\MariaDB 11.7\bin\",
        "C:\Program Files\MariaDB 11.6\bin\",
        "C:\Program Files\MariaDB 11.5\bin\",
        "C:\Program Files\MariaDB 11.4\bin\",
        "C:\Program Files\MariaDB 11.3\bin\",
        "C:\Program Files\MariaDB 11.2\bin\",
        "C:\Program Files\MariaDB 11.1\bin\",
        "C:\Program Files\MariaDB 11.0\bin\",
        "C:\Program Files\MariaDB 10.11\bin\",
        "C:\Program Files\MariaDB 10.10\bin\",
        "C:\Program Files\MariaDB 10.9\bin\",
        "C:\Program Files\MariaDB 10.8\bin\",
        "C:\Program Files\MariaDB 10.7\bin\",
        "C:\Program Files\MariaDB 10.6\bin\",
        "C:\Program Files\MariaDB 10.5\bin\",
        "C:\Program Files\MariaDB 10.4\bin\",
        "C:\Program Files\MySQL\MySQL Server 8.0\bin\",
        "C:\Program Files\MySQL\MySQL Server 5.7\bin\",
        "C:\xampp\mysql\bin\"
    )
    
    $mariadbDump = $null
    $mariadbClient = $null
    
    foreach ($path in $mariadbPaths) {
        if (Test-Path "$path\mariadb-dump.exe") {
            $mariadbDump = "$path\mariadb-dump.exe"
            $mariadbClient = "$path\mariadb.exe"
            Write-Host "Found MariaDB tools in: $path" -ForegroundColor Green
            break
        }
        elseif (Test-Path "$path\mysqldump.exe") {
            $mariadbDump = "$path\mysqldump.exe"
            $mariadbClient = "$path\mysql.exe"
            Write-Host "Found MySQL tools in: $path" -ForegroundColor Green
            break
        }
    }
    
    if (-not $mariadbDump) {
        # Try system PATH - actually test if tools exist
        try {
            $null = Get-Command "mysqldump" -ErrorAction Stop
            $null = Get-Command "mysql" -ErrorAction Stop
            $mariadbDump = "mysqldump"
            $mariadbClient = "mysql"
            Write-Host "MariaDB/MySQL tools found in system PATH" -ForegroundColor Green
        }
        catch {
            Write-Host "MariaDB/MySQL tools not found locally" -ForegroundColor Yellow
            Write-Host "Local database operations require MariaDB/MySQL client tools" -ForegroundColor Yellow
            Write-Host "To install MariaDB/MySQL on Windows:" -ForegroundColor Cyan
            Write-Host "1. Download MariaDB from https://mariadb.org/download/" -ForegroundColor DarkGray
            Write-Host "2. Or use XAMPP: https://www.apachefriends.org/" -ForegroundColor DarkGray
            Write-Host "3. Or use Docker: docker run --name mariadb -e MYSQL_ROOT_PASSWORD=root -p 3306:3306 -d mariadb:latest" -ForegroundColor DarkGray
        }
    }
    
    # Create backup directory if it doesn't exist
    $backupDir = ".\db_backup"
    if (-not (Test-Path $backupDir)) {
        New-Item -Path $backupDir -ItemType Directory -Force | Out-Null
    }
    
    # Create backup of current local database (if exists)
    Write-Host "Creating backup of current local database..." -ForegroundColor Cyan
    $backupFile = "$backupDir\local_backup_$(Get-Date -Format 'yyyyMMdd_HHmmss').sql"
    
    if ($mariadbDump) {
        try {
            # Use the found MariaDB/MySQL dump tool
            & $mariadbDump --host=$dbHost --port=$dbPort --user=$dbUser --password=$dbPassword --databases $dbName --result-file=$backupFile 2>$null
            if ($LASTEXITCODE -eq 0) {
                Write-Host "Local database backup created: $backupFile" -ForegroundColor Green
            }
            else {
                Write-Host "Could not create local backup (database might not exist or be empty)" -ForegroundColor Yellow
            }
        }
        catch {
            Write-Host "Could not create local backup" -ForegroundColor Yellow
        }
    }
    else {
        Write-Host "No MariaDB/MySQL tools found, skipping local backup" -ForegroundColor Yellow
    }
    
    # Drop and recreate local database
    Write-Host "Clearing local database..." -ForegroundColor Cyan
    
    if ($mariadbClient) {
        try {
            # First check if database exists
            $dbExists = & $mariadbClient --host=$dbHost --port=$dbPort --user=$dbUser --password=$dbPassword -e "SHOW DATABASES LIKE '$dbName';" 2>$null
            
            if ($LASTEXITCODE -eq 0 -and $dbExists) {
                Write-Host "Dropping existing database..." -ForegroundColor Cyan
                & $mariadbClient --host=$dbHost --port=$dbPort --user=$dbUser --password=$dbPassword -e "DROP DATABASE $dbName;" 2>$null
            }
            
            Write-Host "Creating database..." -ForegroundColor Cyan
            & $mariadbClient --host=$dbHost --port=$dbPort --user=$dbUser --password=$dbPassword -e "CREATE DATABASE $dbName;" 2>$null
            
            if ($LASTEXITCODE -eq 0) {
                Write-Host "Local database cleared and recreated" -ForegroundColor Green
            }
            else {
                Write-Host "Error clearing local database" -ForegroundColor Red
                return
            }
        }
        catch {
            Write-Host "Error clearing local database: $_" -ForegroundColor Red
            return
        }
    }
    else {
        Write-Host "No MariaDB/MySQL client found, cannot clear local database" -ForegroundColor Red
        Write-Host "Local database operations require MariaDB/MySQL client tools to be installed" -ForegroundColor Yellow
        Write-Host "To install MariaDB/MySQL on Windows:" -ForegroundColor Cyan
        Write-Host "1. Download MariaDB from https://mariadb.org/download/" -ForegroundColor DarkGray
        Write-Host "2. Or use XAMPP: https://www.apachefriends.org/" -ForegroundColor DarkGray
        Write-Host "3. Or use Docker: docker run --name mariadb -e MYSQL_ROOT_PASSWORD=root -p 3306:3306 -d mariadb:latest" -ForegroundColor DarkGray
        Write-Host "After installation, make sure to add the bin directory to your system PATH" -ForegroundColor Yellow
        return
    }
    
    # Create database dump on server
    Write-Host "Creating database dump on server..." -ForegroundColor Cyan
    $serverDumpCmd = @"
cd $serverRemoteDir && 
mysqldump -h 127.0.0.1 -P 3306 -u root -proot tchart > server_dump.sql && 
echo 'Database dump created on server'
"@
    plink -ssh -P $sshPort root@$serverIP -pw $password $serverDumpCmd
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Error creating database dump on server" -ForegroundColor Red
        return
    }
    
    # Download database dump from server
    Write-Host "Downloading database dump from server..." -ForegroundColor Cyan
    $serverDumpFile = "server_dump.sql"
    pscp -P $sshPort -pw $password "root@${serverIP}:$serverRemoteDir/$serverDumpFile" ".\$serverDumpFile"
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Error downloading database dump from server" -ForegroundColor Red
        return
    }
    
    # Import database dump to local database
    Write-Host "Importing database dump to local database..." -ForegroundColor Cyan
    
    if ($mariadbClient) {
        try {
            # Use the found MariaDB/MySQL client for import with PowerShell-compatible redirection
            Get-Content $serverDumpFile | & $mariadbClient --host=$dbHost --port=$dbPort --user=$dbUser --password=$dbPassword $dbName
            if ($LASTEXITCODE -eq 0) {
                Write-Host "Database imported successfully!" -ForegroundColor Green
            }
            else {
                Write-Host "Error importing database" -ForegroundColor Red
                return
            }
        }
        catch {
            Write-Host "Error importing database: $_" -ForegroundColor Red
            return
        }
    }
    else {
        Write-Host "No MariaDB/MySQL client found, cannot import database" -ForegroundColor Red
        Write-Host "The database dump has been downloaded but cannot be imported without MariaDB/MySQL client tools" -ForegroundColor Yellow
        Write-Host "Dump file location: .\$serverDumpFile" -ForegroundColor Cyan
        Write-Host "To install MariaDB/MySQL on Windows:" -ForegroundColor Cyan
        Write-Host "1. Download MariaDB from https://mariadb.org/download/" -ForegroundColor DarkGray
        Write-Host "2. Or use XAMPP: https://www.apachefriends.org/" -ForegroundColor DarkGray
        Write-Host "3. Or use Docker: docker run --name mariadb -e MYSQL_ROOT_PASSWORD=root -p 3306:3306 -d mariadb:latest" -ForegroundColor DarkGray
        Write-Host "After installation, you can import the dump manually using:" -ForegroundColor Yellow
        Write-Host "  mysql -u root -p tchart < $serverDumpFile" -ForegroundColor DarkGray
        return
    }
    
    # Clean up server dump file
    Write-Host "Cleaning up server dump file..." -ForegroundColor Cyan
    plink -ssh -P $sshPort root@$serverIP -pw $password "cd $serverRemoteDir && rm -f $serverDumpFile"
    
    # Clean up local dump file
    Remove-Item -Path ".\$serverDumpFile" -Force -ErrorAction SilentlyContinue
    
    # Verify database import
    Write-Host "Verifying database import..." -ForegroundColor Cyan
    
    if ($mariadbClient) {
        try {
            $tables = & $mariadbClient --host=$dbHost --port=$dbPort --user=$dbUser --password=$dbPassword $dbName -e "SHOW TABLES;" 2>$null
            if ($LASTEXITCODE -eq 0) {
                Write-Host "Database verification successful!" -ForegroundColor Green
                Write-Host "Tables in database:" -ForegroundColor Cyan
                $tables | ForEach-Object { Write-Host "  $_" -ForegroundColor DarkGray }
            }
            else {
                Write-Host "Database verification failed" -ForegroundColor Red
            }
        }
        catch {
            Write-Host "Database verification failed: $_" -ForegroundColor Red
        }
    }
    else {
        Write-Host "No MariaDB/MySQL client found, skipping verification" -ForegroundColor Yellow
    }
    
    Write-Host "Database synchronization completed!" -ForegroundColor Green
}

# Function to sync NFT files (incremental upload)
function Sync-NFT {
    Write-Host "Synchronizing NFT environment and assets..." -ForegroundColor Cyan
    
    $localNftBaseDir = Join-Path (Get-Location) "NFT"
    if (-not (Test-Path $localNftBaseDir)) {
        Write-Host "Error: Local NFT directory not found at $localNftBaseDir" -ForegroundColor Red
        return
    }

    # Phase 1: Sync Environment (Scripts, .env, etc.)
    # We pack everything in NFT/ EXCEPT the NFT/NFT/ subfolder (which contains large assets)
    Write-Host "Phase 1: Synchronizing NFT environment (scripts, configs)..." -ForegroundColor Cyan
    $tempEnvDir = ".\deploy\nft_env_temp"
    if (Test-Path $tempEnvDir) { Remove-Item -Path $tempEnvDir -Recurse -Force }
    New-Item -Path $tempEnvDir -ItemType Directory -Force | Out-Null

    # Copy files from NFT/ root
    Get-ChildItem -Path $localNftBaseDir -File | ForEach-Object {
        Copy-Item -Path $_.FullName -Destination $tempEnvDir -Force
    }

    # Copy directories from NFT/ EXCEPT 'NFT' (assets)
    Get-ChildItem -Path $localNftBaseDir -Directory | Where-Object { $_.Name -ne "NFT" -and $_.Name -ne "__pycache__" } | ForEach-Object {
        Copy-Item -Path $_.FullName -Destination (Join-Path $tempEnvDir $_.Name) -Recurse -Force
    }

    $envArchive = ".\deploy\nft_env.zip"
    Remove-Item -Path $envArchive -Force -ErrorAction SilentlyContinue

    try {
        if (Get-Command "7z" -ErrorAction SilentlyContinue) {
            & 7z a -tzip $envArchive "$tempEnvDir\*" -r
        }
        else {
            Compress-Archive -Path "$tempEnvDir\*" -DestinationPath $envArchive -Force
        }
    }
    catch {
        Write-Host "Error creating NFT environment archive: $_" -ForegroundColor Red
        return
    }

    Write-Host "Uploading NFT environment to server..." -ForegroundColor Cyan
    try {
        plink -ssh -P $sshPort root@$serverIP -pw $password "mkdir -p $serverRemoteDir/NFT"
        Upload-WithRetry -SourcePath $envArchive -DestinationPath "$serverRemoteDir/NFT/"
        plink -ssh -P $sshPort root@$serverIP -pw $password "cd $serverRemoteDir/NFT && unzip -o nft_env.zip && rm nft_env.zip"
    }
    catch {
        Write-Host "Error uploading NFT environment" -ForegroundColor Red
        return
    }
    Remove-Item -Path $tempEnvDir -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item -Path $envArchive -Force -ErrorAction SilentlyContinue

    # Phase 2: Sync Assets (Incremental)
    Write-Host "Phase 2: Synchronizing NFT assets (incremental)..." -ForegroundColor Cyan
    $localAssetsDir = Join-Path $localNftBaseDir "NFT"
    $remoteAssetsDir = "$serverRemoteDir/NFT/NFT"

    if (Test-Path $localAssetsDir) {
        Write-Host "Collecting remote file list from $remoteAssetsDir..." -ForegroundColor Cyan
        
        # Get list of files already on server
        $remoteFilesRaw = plink -ssh -P $sshPort root@$serverIP -pw $password "mkdir -p $remoteAssetsDir && ls -1 $remoteAssetsDir"
        $remoteFiles = @()
        if ($remoteFilesRaw) {
            $remoteFiles = $remoteFilesRaw -split "`n" | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne "" }
        }

        Write-Host "Checking for new assets to upload..." -ForegroundColor Cyan
        $localFiles = Get-ChildItem -Path $localAssetsDir -File
        $assetsToUpload = @()

        foreach ($file in $localFiles) {
            if (-not ($remoteFiles -contains $file.Name)) {
                $assetsToUpload += $file
            }
        }

        if ($assetsToUpload.Count -gt 0) {
            Write-Host "Found $($assetsToUpload.Count) new assets to upload." -ForegroundColor Yellow
            
            $tempAssetsDir = ".\deploy\nft_assets_temp"
            if (Test-Path $tempAssetsDir) { Remove-Item -Path $tempAssetsDir -Recurse -Force }
            New-Item -Path $tempAssetsDir -ItemType Directory -Force | Out-Null
            
            foreach ($file in $assetsToUpload) {
                Copy-Item -Path $file.FullName -Destination $tempAssetsDir -Force
            }

            $assetsArchive = ".\deploy\nft_assets.zip"
            Remove-Item -Path $assetsArchive -Force -ErrorAction SilentlyContinue

            try {
                if (Get-Command "7z" -ErrorAction SilentlyContinue) {
                    & 7z a -tzip $assetsArchive "$tempAssetsDir\*"
                }
                else {
                    Compress-Archive -Path "$tempAssetsDir\*" -DestinationPath $assetsArchive -Force
                }
                
                Upload-WithRetry -SourcePath $assetsArchive -DestinationPath "$serverRemoteDir/"
                plink -ssh -P $sshPort root@$serverIP -pw $password "unzip -o $serverRemoteDir/nft_assets.zip -d $remoteAssetsDir/ && rm $serverRemoteDir/nft_assets.zip"
            }
            catch {
                Write-Host "Error uploading NFT assets: $_" -ForegroundColor Red
            }
            Remove-Item -Path $tempAssetsDir -Recurse -Force -ErrorAction SilentlyContinue
            Remove-Item -Path $assetsArchive -Force -ErrorAction SilentlyContinue
            Write-Host "NFT assets synchronization completed. $($assetsToUpload.Count) files added." -ForegroundColor Green
        }
        else {
            Write-Host "No new assets found." -ForegroundColor Green
        }
    }

    Write-Host "Restarting server to apply new signer/environment..." -ForegroundColor Cyan
    plink -ssh -P $sshPort root@$serverIP -pw $password "pm2 restart $serverAppName --update-env && pm2 list | cat"

    Write-Host "All NFT synchronization tasks completed!" -ForegroundColor Green
}

# Function to deploy TChart API
function Deploy-TChartAPI {
    Write-Host "Preparing TChartServerAPI deployment (unified architecture)..." -ForegroundColor Cyan
    Write-Host "Note: Using shared Node.js dependencies from parent directory" -ForegroundColor Yellow
    Write-Host "No duplication: jsbot/ will use parent node_modules" -ForegroundColor Yellow
    
    # Run build.js to compile necessary files
    Write-Host "Running build.js to compile files..." -ForegroundColor Cyan
    node build.js
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Error executing build.js" -ForegroundColor Red
        return
    }
    
    # Verify that compilation produced the JS file
    if (!(Test-Path ".\dist\drawChart.js")) {
        Write-Host "Critical error: dist\drawChart.js was not generated by build.js!" -ForegroundColor Red
        Write-Host "Deployment aborted." -ForegroundColor Red
        return
    }
    
    Write-Host "Successfully compiled TypeScript files" -ForegroundColor Green
    
    # Create temporary directory for TChart API files
    $tempApiDir = ".\deploy\tchart_api_temp"
    if (Test-Path $tempApiDir) {
        Remove-Item -Path $tempApiDir -Recurse -Force
    }
    New-Item -Path $tempApiDir -ItemType Directory -Force | Out-Null
    
    # Create dist subfolder in temp directory
    New-Item -Path "$tempApiDir\dist" -ItemType Directory -Force | Out-Null
    
    # Create fonts subfolder in temp directory
    New-Item -Path "$tempApiDir\fonts" -ItemType Directory -Force | Out-Null
    
    # Copy files to temporary directory
    Write-Host "Copying files to temporary folder..." -ForegroundColor Cyan
    
    # Copy tChartServerAPI.js file
    Copy-Item -Path "tChartServerAPI.js" -Destination "$tempApiDir\" -Force
    
    # Copy chartRendererAdapter.js file
    Copy-Item -Path "chartRendererAdapter.js" -Destination "$tempApiDir\" -Force
    
    # Copy compiled files from dist directory
    if (Test-Path ".\dist") {
        Copy-Item -Path ".\dist\*" -Destination "$tempApiDir\dist\" -Force -Recurse
        Write-Host "Copied compiled files from dist directory" -ForegroundColor Green
    }
    else {
        Write-Host "Warning: dist directory not found" -ForegroundColor Yellow
    }
    
    # Copy fonts
    if (Test-Path ".\fonts") {
        Copy-Item -Path ".\fonts\*" -Destination "$tempApiDir\fonts\" -Force -Recurse
        Write-Host "Copied fonts directory" -ForegroundColor Green
    }
    else {
        Write-Host "Warning: fonts directory not found" -ForegroundColor Yellow
    }
    
    # Note: Not copying package.json as we use the shared one from parent directory
    Write-Host "Using shared package.json from parent directory (no duplication)" -ForegroundColor Green
    
    # Create deploy directory if it doesn't exist
    if (-not (Test-Path ".\deploy")) {
        New-Item -Path ".\deploy" -ItemType Directory -Force | Out-Null
    }
    
    # Add a pause to allow file handles to be released
    Write-Host "Waiting for file handles to be released (5 seconds)..." -ForegroundColor Yellow
    Start-Sleep -Seconds 5
    
    # Archive all files
    Write-Host "Creating archive for TChartServerAPI files..." -ForegroundColor Cyan
    $apiArchive = ".\deploy\tchart_api_files.zip"
    Remove-Item -Path $apiArchive -Force -ErrorAction SilentlyContinue
    
    try {
        if (Get-Command "7z" -ErrorAction SilentlyContinue) {
            Write-Host "Using 7zip for compression..." -ForegroundColor Cyan
            & 7z a -tzip $apiArchive "$tempApiDir\*" -r
        }
        else {
            Write-Host "Using PowerShell compression..." -ForegroundColor Cyan
            # Add additional delay for PowerShell compression
            Write-Host "Adding extra delay for PowerShell compression (2 seconds)..." -ForegroundColor Yellow
            Start-Sleep -Seconds 2
            Compress-Archive -Path "$tempApiDir\*" -DestinationPath $apiArchive -Force
        }
    }
    catch {
        Write-Host "Error creating archive: $_" -ForegroundColor Red
        # Cleanup
        Remove-Item -Path "$tempApiDir" -Recurse -Force -ErrorAction SilentlyContinue
        return
    }
    
    # Check if remote directory exists and create it if needed - MOVED AFTER ARCHIVE CREATION
    Write-Host "Checking remote directory..." -ForegroundColor Cyan
    plink -ssh -P $sshPort root@$serverIP -pw $password "mkdir -p $serverRemoteDir"
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Error creating remote directory: $serverRemoteDir" -ForegroundColor Red
        # Cleanup
        Remove-Item -Path $apiArchive -Force -ErrorAction SilentlyContinue
        Remove-Item -Path "$tempApiDir" -Recurse -Force -ErrorAction SilentlyContinue
        return
    }
    
    # Upload archive to server
    Write-Host "Uploading TChartServerAPI files to server..." -ForegroundColor Cyan
    pscp -P $sshPort -pw $password $apiArchive "root@${serverIP}:$serverRemoteDir/"
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Error uploading TChartServerAPI files to server" -ForegroundColor Red
        # Cleanup
        Remove-Item -Path $apiArchive -Force -ErrorAction SilentlyContinue
        Remove-Item -Path "$tempApiDir" -Recurse -Force -ErrorAction SilentlyContinue
        return
    }
    
    # Remove old jsbot directory, extract archive and cleanup on server
    Write-Host "Extracting TChartServerAPI files on server..." -ForegroundColor Cyan
    $serverCmd = "cd $serverRemoteDir && rm -rf jsbot && mkdir -p jsbot && unzip -o tchart_api_files.zip -d jsbot/ && rm tchart_api_files.zip"
    plink -ssh -P $sshPort root@$serverIP -pw $password $serverCmd
    
    # Note: Dependencies are already installed in parent directory ($serverRemoteDir)
    # No need to install them separately in jsbot directory
    Write-Host "Using Node.js dependencies from parent directory..." -ForegroundColor Cyan
    
    # Check if the files were extracted successfully
    Write-Host "Verifying deployment..." -ForegroundColor Cyan
    $verifyCmd = "ls -la $serverRemoteDir/jsbot/dist/ && echo 'Node.js version:' && node --version && echo 'Parent node_modules exists:' && ls -la $serverRemoteDir/node_modules/ | head -5"
    plink -ssh -P $sshPort root@$serverIP -pw $password $verifyCmd
    
    # Restart ALL services to ensure everything is reloaded
    Write-Host "Restarting all services with fresh environment..." -ForegroundColor Cyan
    plink -ssh -P $sshPort root@$serverIP -pw $password "cd $serverRemoteDir && pm2 restart tchart-api --update-env && pm2 restart $serverAppName --update-env"
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Warning: There was an issue restarting some services" -ForegroundColor Yellow
        Write-Host "Trying to start services using ecosystem config..." -ForegroundColor Cyan
        plink -ssh -P $sshPort root@$serverIP -pw $password "cd $serverRemoteDir && pm2 start ecosystem.config.js"
    }
    else {
        Write-Host "All services restarted successfully" -ForegroundColor Green
    }
    
    # Display running services
    Write-Host "Checking PM2 services status:" -ForegroundColor Cyan
    plink -ssh -P $sshPort root@$serverIP -pw $password "pm2 list | cat"
    
    # Cleanup local temporary files
    Remove-Item -Path $apiArchive -Force -ErrorAction SilentlyContinue
    Remove-Item -Path "$tempApiDir" -Recurse -Force -ErrorAction SilentlyContinue
    
    Write-Host "TChartServerAPI deployed successfully!" -ForegroundColor Green
}

# Function to performs a full reset of NFTs (Clear DB + Re-upload all)
function Reset-NFTs {
    Write-Host "Starting FULL NFT RESET (DB Truncate + Re-upload)..." -ForegroundColor Red
    
    # 1. Truncate Table
    Write-Host "Truncating remote table 'nfts'..." -ForegroundColor Yellow
    plink -ssh -P $sshPort root@$serverIP -pw $password "mariadb -u root -p'root' -e 'TRUNCATE TABLE tchart.nfts;'"
    
    # 2. Sync Files (Environment & Assets)
    Sync-NFT
    
    # 3. Run Re-upload script for all assets on server
    Write-Host "Running re-upload script for all assets on server..." -ForegroundColor Cyan
    plink -ssh -P $sshPort root@$serverIP -pw $password "cd $serverRemoteDir/NFT && python3 upload_only.py --all"
    
    Write-Host "FULL NFT RESET COMPLETED!" -ForegroundColor Green
}

# Choose what to deploy
$deployChoice = Read-Host "What would you like to deploy? 
1. React application (build) - Node.js 18 compatible
2. Bot files and server.js (Telegram + Discord) - Node.js 18 compatible
3. TChart API files - Node.js 18 compatible
4. Install/Update Node.js 18 dependencies
5. Everything (includes both bots) - Full Node.js 18 deployment
6. Install Python dependencies for bots only
7. Sync pic folder (delete local and download from server)
8. Sync database (clear local and download from server)
9. Sync NFT files (only new files)
10. FULL NFT RESET (Clear DB and Re-upload all to Pinata)
Enter number (1-10)"

switch ($deployChoice) {
    "1" {
        Deploy-ReactApp
    }
    "2" {
        Deploy-BotFiles
    }
    "3" {
        Deploy-TChartAPI
    }
    "4" {
        Install-NodeDependencies
    }
    "5" {
        Install-NodeDependencies
        Deploy-ReactApp
        Deploy-BotFiles
        Deploy-TChartAPI
    }
    "6" {
        Write-Host "Installing Python dependencies for both bots..." -ForegroundColor Cyan
        $installPythonDeps = @"
cd $serverRemoteDir/bot && 
pip3 install -r dc_requirements.txt && 
echo 'Discord bot dependencies installed' &&
pip3 install python-telegram-bot==13.7 requests python-dotenv Pillow &&
echo 'Telegram bot dependencies installed'
"@
        plink -ssh -P $sshPort root@$serverIP -pw $password $installPythonDeps
        
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Warning: Some Python dependencies may not have installed correctly" -ForegroundColor Yellow
        }
        else {
            Write-Host "Python dependencies installed successfully" -ForegroundColor Green
        }
    }
    "7" {
        Sync-PicFolder
    }
    "8" {
        Sync-Database
    }
    "9" {
        Sync-NFT
    }
    "10" {
        Reset-NFTs
    }
    default {
        Write-Host "Invalid choice. Please enter a number from 1 to 10." -ForegroundColor Red
    }
}

Write-Host "Deployment completed!" -ForegroundColor Green 