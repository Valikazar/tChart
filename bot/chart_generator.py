#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import json
import argparse
import requests
import os
import base64
from datetime import datetime
import sys

def load_config(config_path):
    """Loading configuration from JSON file"""
    try:
        with open(config_path, 'r', encoding='utf-8') as f:
            config = json.load(f)
        return config
    except Exception as e:
        print(f"Error loading configuration: {e}")
        sys.exit(1)

def normalize_interval_key(interval_key):
    if not interval_key:
        return '1h'
    # Backward compat
    if interval_key == 'minute':
        return '5m'
    if interval_key == 'hour':
        return '1h'
    if interval_key == 'day':
        return '1d'
    return interval_key


# Mapping to GeckoTerminal base timeframe and aggregate, with grouping
BAR_OPTIONS = {
    # minute?aggregate=1 -> 1m base, group 5 => 5m
    '5m':  { 'base': 'minute', 'aggregate': 1,  'seconds': 5 * 60,           'group': 5 },
    # minute?aggregate=5 -> 5m base, group 3 => 15m
    '15m': { 'base': 'minute', 'aggregate': 5,  'seconds': 15 * 60,          'group': 3 },
    # minute?aggregate=15 -> 15m base, group 2 => 30m
    '30m': { 'base': 'minute', 'aggregate': 15, 'seconds': 30 * 60,          'group': 2 },
    # minute?aggregate=15 -> 15m base, group 4 => 1h
    '1h':  { 'base': 'minute', 'aggregate': 15, 'seconds': 60 * 60,          'group': 4 },
    # hour?aggregate=1 -> 1h base, group 4 => 4h
    '4h':  { 'base': 'hour',   'aggregate': 1,  'seconds': 4 * 60 * 60,      'group': 4 },
    # hour?aggregate=12 -> 12h base, group 2 => 1d
    '1d':  { 'base': 'hour',   'aggregate': 12, 'seconds': 24 * 60 * 60,     'group': 2 },
    # day -> 1d base, group 3/7/30 => 3d/1w/1M
    '3d':  { 'base': 'day',    'aggregate': 1,  'seconds': 3 * 24 * 60 * 60, 'group': 3 },
    '1w':  { 'base': 'day',    'aggregate': 1,  'seconds': 7 * 24 * 60 * 60, 'group': 7 },
    '1M':  { 'base': 'day',    'aggregate': 1,  'seconds': 30 * 24 * 60 * 60,'group': 30 },  # approximate month
}


def fetch_grouped_ohlcv(network, pool_address, desired_interval_key, desired_num_bars):
    """Fetch GeckoTerminal OHLCV using supported timeframe+aggregate and group into desired buckets."""
    key = normalize_interval_key(desired_interval_key)
    if key not in BAR_OPTIONS:
        print(f"Unsupported interval '{desired_interval_key}', fallback to 1h")
        key = '1h'
    opt = BAR_OPTIONS[key]

    base = opt['base']
    aggregate = opt['aggregate']
    group = opt.get('group', 1)

    # Compute limit based on grouping and max 50 bars
    max_bars = min(desired_num_bars if desired_num_bars > 0 else 50, 50)
    fetch_limit = min(1000, max_bars * group + 5)

    url = (
        f"https://api.geckoterminal.com/api/v2/networks/{network}/pools/{pool_address}/ohlcv/{base}"
        f"?aggregate={aggregate}&limit={fetch_limit}"
    )

    try:
        response = requests.get(url)
        response.raise_for_status()
        data = response.json()

        if 'data' not in data or 'attributes' not in data['data'] or 'ohlcv_list' not in data['data']['attributes']:
            print("Invalid OHLCV data format from GeckoTerminal API")
            return None

        # Normalize base bars
        base_bars = [
            [
                int(item[0]),
                float(item[1]),
                float(item[2]),
                float(item[3]),
                float(item[4]),
                float(item[5])
            ]
            for item in data['data']['attributes']['ohlcv_list']
        ]
        base_bars.sort(key=lambda x: x[0])

        # Group into desired buckets
        bucket_seconds = opt['seconds']
        bucket_map = {}
        for ts, o, h, l, c, v in base_bars:
            start_ts = (ts // bucket_seconds) * bucket_seconds
            if start_ts not in bucket_map:
                bucket_map[start_ts] = {
                    'open': o,
                    'high': h,
                    'low': l,
                    'close': c,
                    'volume': v or 0.0,
                }
            else:
                b = bucket_map[start_ts]
                b['high'] = max(b['high'], h)
                b['low'] = min(b['low'], l)
                b['close'] = c
                b['volume'] = (b['volume'] or 0.0) + (v or 0.0)

        grouped = [
            [ts, b['open'], b['high'], b['low'], b['close'], b['volume']]
            for ts, b in sorted(bucket_map.items(), key=lambda kv: kv[0])
        ]

        if desired_num_bars > 0 and len(grouped) > desired_num_bars:
            grouped = grouped[-desired_num_bars:]

        return grouped
    except Exception as e:
        print(f"Error fetching/grouping OHLCV data: {e}")
        return None

def safe_float(value, default=0.0):
    """Safely convert value to float, return default if conversion fails"""
    if value is None:
        return default
    try:
        return float(value)
    except (ValueError, TypeError):
        return default

def fetch_pool_info(network, pool_address):
    """Fetching pool information from GeckoTerminal API"""
    url = f"https://api.geckoterminal.com/api/v2/networks/{network}/pools/{pool_address}"
    
    try:
        response = requests.get(url)
        response.raise_for_status()
        data = response.json()
        
        if 'data' in data and 'attributes' in data['data'] and 'relationships' in data['data']:
            # Extracting main token information
            price_changes = data['data']['attributes'].get('price_change_percentage', {})
            
            # Converting keys from GeckoTerminal API to format expected by chartRendererServer.js
            # Using safe_float to ensure all values are valid numbers
            formatted_price_change = {
                '5m': safe_float(price_changes.get('m5', 0)),
                '1h': safe_float(price_changes.get('h1', 0)),
                '6h': safe_float(price_changes.get('h6', 0)),
                '24h': safe_float(price_changes.get('h24', 0))
            }
            
            # Getting token name from pool name (format is usually "TOKEN / CURRENCY")
            token_name = data['data']['attributes'].get('name', '').split(' / ')[0]
            
            # If token name is empty, use id from base_token
            if not token_name:
                token_name = data['data']['relationships']['base_token']['data']['id'].split('_')[-1]
            
            # Getting market cap from fdv_usd instead of market_cap_usd
            # Ensure it's always a valid number
            market_cap_raw = data['data']['attributes'].get('fdv_usd')
            market_cap = safe_float(market_cap_raw, 0.0)
            
            # Safely get volume - ensure it's a number
            volume_usd = data['data']['attributes'].get('volume_usd', {})
            volume = safe_float(volume_usd.get('h24') if isinstance(volume_usd, dict) else volume_usd, 0.0)
            
            # Safely get price - ensure it's a number
            price_raw = data['data']['attributes'].get('base_token_price_usd')
            price = safe_float(price_raw, 0.0)
            
            token_info = {
                "name": token_name,
                "symbol": data['data']['relationships']['base_token']['data'].get('type', '???'),
                "priceUsd": price,
                "marketCap": market_cap,
                "priceChange": formatted_price_change,
                "volume": volume
            }
            
            print(f"[DEBUG] Token info prepared: price={price}, marketCap={market_cap}, volume={volume}")
            return token_info
        else:
            print("Invalid pool data format from GeckoTerminal API")
            return None
    except Exception as e:
        print(f"Error fetching pool information: {e}")
        import traceback
        traceback.print_exc()
        return None

def get_available_presets(server_url="http://localhost:3001/configs"):
    """Get list of available presets from API server"""
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        logger.info(f"Fetching presets from API: {server_url}")
        response = requests.get(server_url, timeout=5)
        
        if response.status_code == 404:
            logger.error(f"❌ API endpoint not found (404): {server_url}")
            logger.error("Please check that tChartServerAPI.js is running and the /configs endpoint is available")
            return []
        
        response.raise_for_status()
        result = response.json()
        
        if result.get("success", False) and "configs" in result:
            presets = result["configs"]
            logger.info(f"✅ Retrieved {len(presets)} available presets from API: {presets}")
            return presets
        else:
            logger.error(f"❌ API response error: {result.get('error', 'Unknown error')}")
            logger.error(f"Full API response: {result}")
            return []
    except requests.exceptions.ConnectionError as e:
        logger.error(f"❌ Cannot connect to API server at {server_url}")
        logger.error("Please check that tChartServerAPI.js is running on port 3001")
        return []
    except Exception as e:
        logger.error(f"❌ Error fetching presets from API: {e}")
        logger.exception("Full traceback:")
        return []

def load_preset_config(preset_name, script_dir=None):
    """
    Load preset configuration from file system.
    Tries multiple paths to find the preset file.
    """
    import logging
    logger = logging.getLogger(__name__)
    
    if script_dir is None:
        script_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Try different possible paths
    possible_paths = [
        os.path.join(script_dir, '..', 'pic', 'presets', f'{preset_name}.json'),
        os.path.join(script_dir, 'pic', 'presets', f'{preset_name}.json'),
        os.path.join(os.path.dirname(script_dir), 'pic', 'presets', f'{preset_name}.json'),
    ]
    
    logger.info(f"Attempting to load preset '{preset_name}' from script_dir: {script_dir}")
    logger.info(f"Script dir absolute path: {os.path.abspath(script_dir)}")
    for preset_path in possible_paths:
        preset_path = os.path.normpath(preset_path)
        preset_path_abs = os.path.abspath(preset_path)
        logger.info(f"Checking path: {preset_path} (absolute: {preset_path_abs})")
        if os.path.exists(preset_path):
            try:
                with open(preset_path, 'r', encoding='utf-8') as f:
                    preset_config = json.load(f)
                    logger.info(f"Successfully loaded preset '{preset_name}' from {preset_path}")
                    return preset_config
            except Exception as e:
                logger.error(f"Error loading preset from {preset_path}: {e}")
                continue
    
    logger.error(f"Preset file '{preset_name}.json' not found in any of the expected locations: {possible_paths}")
    return None

def merge_preset_with_group_config(preset_config, group_config):
    """
    Merge preset configuration with group configuration.
    Preset config parameters (network, poolAddress, etc.) are used as primary.
    Only group-specific tracking fields are preserved from group config.
    """
    # Create a deep copy of preset config - this is the primary config
    merged_config = json.loads(json.dumps(preset_config))
    
    # Preserve only group-specific tracking fields (not the actual settings)
    # Note: last_poster_time and duration are now stored in database, not in config
    if 'random_chart_used_presets' in group_config:
        merged_config['random_chart_used_presets'] = group_config['random_chart_used_presets']
    
    return merged_config

def get_next_random_preset(config, server_url="http://localhost:3001/configs", script_dir=None):
    """
    Get next preset in round-robin fashion.
    Returns preset name and updates config with used presets.
    """
    # Get available presets from API
    available_presets = get_available_presets(server_url)
    
    import logging
    logger = logging.getLogger(__name__)
    
    if not available_presets:
        logger.warning("No presets available from API, returning None")
        return None, config
    
    # Initialize used presets list if not exists
    if 'random_chart_used_presets' not in config:
        config['random_chart_used_presets'] = []
    
    used_presets = config['random_chart_used_presets']
    
    # Filter out presets that no longer exist in available presets
    used_presets = [p for p in used_presets if p in available_presets]
    
    # Find next unused preset
    unused_presets = [p for p in available_presets if p not in used_presets]
    
    if not unused_presets:
        # All presets have been used, reset and start over
        logger.info("All presets have been used, resetting cycle")
        used_presets = []
        unused_presets = available_presets
    
    # Select next preset (first unused)
    selected_preset = unused_presets[0]
    
    # Mark as used
    used_presets.append(selected_preset)
    config['random_chart_used_presets'] = used_presets
    
    logger.info(f"Selected preset: {selected_preset} (used: {len(used_presets)}/{len(available_presets)})")
    logger.debug(f"Available presets: {available_presets}")
    logger.debug(f"Used presets: {used_presets}")
    logger.debug(f"Unused presets: {unused_presets}")
    
    return selected_preset, config

def render_chart(config, ohlcv_data, token_info, output_path, config_name=None):
    """Sending data to API server for rendering
    
    Args:
        config: Configuration dictionary (optional if config_name is provided)
        ohlcv_data: OHLCV data
        token_info: Token information
        output_path: Path to save output file
        config_name: Optional preset name to use instead of config
    """
    # Using API server that now uses drawChart.ts
    server_url = "http://localhost:3001/render"
    
    # Нормализуем интервал для передачи в API
    raw_interval = config.get("interval", "hour") if config else "hour"
    normalized_interval = normalize_interval_key(raw_interval)
    
    # Build payload
    payload = {
        "data": ohlcv_data,
        "tokenInfo": token_info,
        "interval": normalized_interval,
        "width": 1280,
        "height": 1280,
        "format": "jpg"  # Используем JPEG с высоким качеством
    }
    
    import logging
    logger = logging.getLogger(__name__)
    
    # If config_name is provided, use it; otherwise use config
    if config_name:
        payload["configName"] = config_name
        logger.info(f"[RENDER] Using preset by name: {config_name}")
    else:
        # Creating a copy of configuration to avoid modifying the original
        config_copy = json.loads(json.dumps(config))
        
        logger.debug(f"[RENDER] Using full config. Network: {config_copy.get('network')}, poolAddress: {config_copy.get('poolAddress')}")
        logger.debug(f"[RENDER] Font configuration before sending to server: {config_copy.get('font', {})}")
        
        # Убедимся, что параметр free существует и имеет правильное значение
        # Если не указан, или None, установим его в False по умолчанию
        if 'free' not in config_copy or config_copy['free'] is None:
            config_copy['free'] = False
        
        # Removing font-related fields as they already exist on the server
        if 'path' in config_copy.get('font', {}):
            del config_copy['font']['path']
            print("[DEBUG] Removed path field from font configuration")
        if 'originalFamily' in config_copy.get('font', {}):
            del config_copy['font']['originalFamily']
            print("[DEBUG] Removed originalFamily field from font configuration")
        
        print("[DEBUG] Final font configuration:", config_copy.get('font', {}))
        print("[DEBUG] Free parameter value:", config_copy.get('free', False))
        
        payload["config"] = config_copy
    
    try:
        response = requests.post(server_url, json=payload)
        response.raise_for_status()
        result = response.json()
        
        if result.get("success", False):
            # Saving base64 to file
            if "base64" in result:
                # Определяем тип изображения из base64 префикса
                base64_prefix = result["base64"].split(",")[0]
                base64_data = result["base64"].split(",")[1]  # Removing data:image/...;base64, prefix
                image_data = base64.b64decode(base64_data)
                
                with open(output_path, "wb") as f:
                    f.write(image_data)
                
                print(f"Chart successfully saved to {output_path}")
                print(f"Image URL on server: {result.get('imageUrl', 'unavailable')}")
                return True
        else:
            print(f"Rendering error: {result.get('error', 'Unknown error')}")
            return False
    except Exception as e:
        print(f"Error connecting to rendering server: {e}")
        return False

def process_font_data(config):
    """Processes font data from configuration"""
    try:
        # Ensure there is a font field in the configuration
        if 'font' not in config:
            config['font'] = {
                'family': 'Arial',
                'size': 40,
                'color': '#ffffff'
            }
            print("[DEBUG] Created default font configuration:", config['font'])
        else:
            print("[DEBUG] Loaded font configuration:", config['font'])
        
        return config
    except Exception as e:
        print(f"Error processing font data: {e}")
        return config

def main():
    parser = argparse.ArgumentParser(description="Chart generator using GeckoTerminal data")
    parser.add_argument("config_file", help="Path to JSON configuration file", nargs='?', default="7.json")
    parser.add_argument("--output", "-o", help="Path to save output file", 
                        default=f"chart_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png")
    args = parser.parse_args()
    
    # Loading configuration
    config = load_config(args.config_file)
    
    # Process font data if present
    config = process_font_data(config)
    
    # Get parameters from configuration
    network = config.get("network", "polygon_pos")
    pool_address = config.get("poolAddress")
    interval = config.get("interval", "1h")
    num_bars = config.get("numBars", 20)  # Get number of bars from configuration
    
    print(f"Using configuration: {args.config_file}")
    print(f"Using network: {network}")
    print(f"Pool address: {pool_address}")
    print(f"Interval: {interval}")
    print(f"Number of bars: {num_bars}")
    print(f"Font: {config['font']['family']}")
    
    if not pool_address:
        print("Error: pool address is missing in configuration")
        sys.exit(1)
    
    # Check if server is running
    try:
        requests.get("http://localhost:3001/", timeout=3)
        print("API server is available. Starting chart generation...")
    except requests.exceptions.ConnectionError:
        print("WARNING: API server is not available on port 3001.")
        print("Make sure you have started the server with the command: node tChartServerAPI.js")
        sys.exit(1)
    except requests.exceptions.Timeout:
        print("WARNING: API server is not responding (timeout).")
        print("Ensure the server is not overloaded and is functioning correctly.")
        sys.exit(1)
    except Exception as e:
        print(f"Warning: Could not check server availability: {e}")
        print("Attempting to continue...")
    
    # Fetch OHLCV data (mapped + grouped to desired interval)
    ohlcv_data = fetch_grouped_ohlcv(network, pool_address, interval, num_bars)
    if not ohlcv_data:
        print("Failed to fetch OHLCV data. Exiting program.")
        sys.exit(1)
    
    # Sort data by time (first element in each array is timestamp)
    ohlcv_data.sort(key=lambda x: x[0])
    
    # Already sliced to desired num_bars in fetch_grouped_ohlcv
    
    # Ensure bars are in correct order (ascending time)
    # The newest bar should be last (rightmost on the chart)
    if ohlcv_data and len(ohlcv_data) > 1:
        if ohlcv_data[0][0] > ohlcv_data[-1][0]:
            # If data is in reverse order, reverse it
            ohlcv_data.reverse()
            print("Data sorted in chronological order (newest on the right)")
    
    # Fetch pool/token information
    token_info = fetch_pool_info(network, pool_address)
    if not token_info:
        print("Failed to fetch token information. Continuing without token info.")
        token_info = {
            "name": "Unknown Token",
            "symbol": "???",
            "priceUsd": 0.0,
            "marketCap": 0.0,
            "priceChange": {
                "5m": 0.0,
                "1h": 0.0,
                "6h": 0.0,
                "24h": 0.0
            },
            "volume": 0.0
        }
    
    # Generate chart
    if render_chart(config, ohlcv_data, token_info, args.output):
        print("Chart successfully generated!")
    else:
        print("Failed to generate chart.")
        sys.exit(1)

if __name__ == "__main__":
    main() 