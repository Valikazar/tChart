#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import json
import logging
import discord
import requests
from discord.ext import commands
from db_manager import db_manager

logger = logging.getLogger(__name__)

# Base URL of web editor
WEB_EDITOR_URL = "https://tchart.xyz"
# Base URL of API
API_URL = "http://localhost:3002"

# Full URL for token API access
ACCESS_TOKEN_URL = f"{API_URL}/api/access-token"

# ID суперпользователя
SUPER_USER_ID = "valikazar"

# Определяем глобальные переменные для совместимости с JSON
true = True
false = False

class SettingsManager:
    def __init__(self, bot, guilds_dir):
        self.bot = bot
        self.guilds_dir = guilds_dir
        # Directory where the script is located
        self.script_dir = os.path.dirname(os.path.abspath(__file__))
        if not os.path.exists(guilds_dir):
            os.makedirs(guilds_dir)
        # Dictionary to track pending JSON imports
        self.pending_imports = {}

    def load_guild_config(self, guild_id):
        """Load guild configuration"""
        config_path = os.path.join(self.guilds_dir, f"{guild_id}.json")
        if os.path.exists(config_path):
            try:
                with open(config_path, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception as e:
                logger.error(f"Error loading configuration for guild {guild_id}: {e}")
        return None

    def save_guild_config(self, guild_id, config):
        """Save guild configuration"""
        try:
            config_path = os.path.join(self.guilds_dir, f"{guild_id}.json")
            with open(config_path, 'w', encoding='utf-8') as f:
                json.dump(config, f, indent=2, ensure_ascii=False)
            return True
        except Exception as e:
            logger.error(f"Error saving configuration for guild {guild_id}: {e}")
            return False

    def create_default_config(self, guild_id, guild_name=""):
        """Create default configuration for a guild"""
        try:
            empty_config_path = os.path.join(self.script_dir, 'dc_empty.json')
            if not os.path.exists(empty_config_path):
                # If dc_empty.json file doesn't exist, create base configuration programmatically
                config = {
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
                    "upBar": {
                        "color": "#26a69a"
                    },
                    "downBar": {
                        "color": "#ef5350"
                    },
                    "candle": {
                        "color": "#00ff00"
                    },
                    "knife": {
                        "color": "#FF0700"
                    },
                    "doji": {
                        "color": "#FFFF00",
                        "active": False
                    },
                    "highLowLines": {
                        "lineWidth": 1,
                        "upBar": {
                            "lineColor": "#26a69a"
                        },
                        "downBar": {
                            "lineColor": "#ef5350"
                        },
                        "candle": {
                            "lineColor": "#00ff00"
                        },
                        "knife": {
                            "lineColor": "#FF0700"
                        },
                        "doji": {
                            "lineColor": "#FFFF00"
                        }
                    },
                    "borders": {
                        "borderWidth": 0,
                          "topBevel": 0,
                          "bottomBevel": 0,
                          "topRound": True,
                          "bottomRound": True,
                          "borderSides": {
                            "top": True,
                            "bottom": True,
                            "left": True,
                            "right": True
                        },
                        "upBar": {
                            "borderColor": "#FFFFFF"
                        },
                        "downBar": {
                            "borderColor": "#FFFFFF"
                        },
                        "candle": {
                            "borderColor": "#FFFFFF"
                        },
                        "knife": {
                            "borderColor": "#FFFFFF"
                        },
                        "doji": {
                        "borderColor": "#FFFFFF"
                        }
                    },
                    "font": {
                        "family": "Arial",
                        "size": 40,
                        "color": "#ffffff"
                    },
                    "display": {
                        "showMarketCap": True,
                        "showPrice": True,
                        "showTimeline": True,
                        "showPriceChange": True,
                        "showTokenName": True,
                        "showMinMax": True
                    },
                    "network": "polygon_pos",
                    "poolAddress": "0xA030BE97a53d6462C675962feC3EaFbE53b8bb6C",
                    "duration": 4,
                    "numBars": 20,
                    "interval": "hour"
                }
            else:
                with open(empty_config_path, 'r', encoding='utf-8') as f:
                    config = json.load(f)
            
            config['last_poster_time'] = 0
            
            if self.save_guild_config(guild_id, config):
                logger.info(f"Created configuration for guild {guild_id}")
                return config
        except Exception as e:
            logger.error(f"Error creating configuration for guild {guild_id}: {e}")
        return None

    def get_user_admin_guilds(self, user_id):
        """Get list of guilds where user is admin"""
        admin_guilds = []
        
        logger.info(f"Checking guilds in directory: {self.guilds_dir}")
        
        if not os.path.exists(self.guilds_dir):
            logger.error(f"Directory {self.guilds_dir} does not exist")
            return admin_guilds
            
        # Проверяем, является ли пользователь суперпользователем
        is_superuser = False
        try:
            user = self.bot.get_user(user_id)
            # Проверяем как display_name, так и global_name для поддержки разных версий Discord
            if user and (str(user.display_name) == SUPER_USER_ID or str(user.global_name) == SUPER_USER_ID):
                is_superuser = True
                logger.info(f"User {user_id} identified as superuser {SUPER_USER_ID}")
                logger.debug(f"User details - display_name: {user.display_name}, global_name: {user.global_name}")
        except Exception as e:
            logger.info(f"Could not verify if user {user_id} is superuser: {e}")
            
        for filename in os.listdir(self.guilds_dir):
            # Пропускаем файлы бэкапов, которые начинаются с ".backup_"
            if filename.startswith('.backup_'):
                logger.info(f"Skipping backup file: {filename}")
                continue
                
            if filename.endswith('.json'):
                try:
                    # Get guild ID from filename (without .json extension)
                    guild_id = int(filename[:-5])
                    logger.info(f"Processing guild: {guild_id}")
                    
                    # Load guild configuration
                    config_path = os.path.join(self.guilds_dir, filename)
                    try:
                        with open(config_path, 'r', encoding='utf-8') as f:
                            config = json.load(f)
                        logger.info(f"Successfully loaded config for guild {guild_id}")
                    except Exception as e:
                        logger.error(f"Error loading config for guild {guild_id}: {e}")
                        continue
                    
                    # Если пользователь - суперпользователь, пропускаем проверку на права администратора
                    if is_superuser:
                        try:
                            # Пытаемся получить имя гильдии
                            guild = self.bot.get_guild(guild_id)
                            if guild:
                                guild_name = guild.name
                                logger.info(f"Superuser access: Found guild name: {guild_name}")
                            else:
                                logger.warning(f"Superuser access: Could not get guild {guild_id}")
                                guild_name = f"Guild {guild_id}"
                            
                            # Добавляем гильдию в список
                            admin_guilds.append({
                                'id': str(guild_id),
                                'name': guild_name
                            })
                            logger.info(f"Superuser access: Added guild {guild_id} to admin guilds list")
                        except Exception as e:
                            logger.error(f"Superuser access: Error processing guild {guild_id}: {e}")
                            continue
                    else:
                        # Для обычных пользователей - проверяем права администратора
                        try:
                            logger.info(f"Checking admin rights for user {user_id} in guild {guild_id}")
                            guild = self.bot.get_guild(guild_id)
                            if not guild:
                                logger.warning(f"Guild {guild_id} not found in bot's memory cache, skipping")
                                continue
                                
                            member = guild.get_member(user_id)
                            if not member:
                                logger.info(f"User {user_id} is not in guild {guild_id}")
                                continue
                                
                            logger.info(f"User {user_id} permissions in guild {guild_id}: administrator={member.guild_permissions.administrator}")
                            
                            if member.guild_permissions.administrator or guild.owner_id == user_id:
                                guild_name = guild.name if guild.name else f"Guild {guild_id}"
                                logger.info(f"Found guild name: {guild_name}")
                                
                                # Add guild to the list
                                admin_guilds.append({
                                    'id': str(guild_id),
                                    'name': guild_name
                                })
                                logger.info(f"Added guild {guild_id} to admin guilds list")
                        except Exception as e:
                            logger.error(f"Error checking admin status for guild {guild_id}: {e}")
                            continue
                        
                except ValueError as e:
                    logger.warning(f"Invalid guild ID format in filename: {filename}. Error: {e}")
                    continue
                except Exception as e:
                    logger.error(f"Error processing guild file {filename}: {e}")
                    continue
        
        logger.info(f"Found {len(admin_guilds)} admin guilds for user {user_id}")
        return admin_guilds

    def create_guild_menu_embed(self, user_id):
        """Create guild selection menu embed"""
        admin_guilds = self.get_user_admin_guilds(user_id)
        if not admin_guilds:
            return None, "You don't have administrator rights on any server."

        embed = discord.Embed(
            title="🛠️ Select server for configuration",
            color=0x00ff00
        )
        
        guild_list = ""
        for i, guild in enumerate(admin_guilds, 1):
            guild_list += f"{i}. **{guild['name']}** (ID: {guild['id']})\n"
        
        embed.description = guild_list
        embed.set_footer(text="Use /settings <number> command to configure server")
        
        return embed, admin_guilds

    def create_settings_embed(self, guild_id, user=None):
        """Create settings menu embed for a guild"""
        config = self.load_guild_config(guild_id)
        
        embed = discord.Embed(
            title=f"⚙️ Server settings {guild_id}",
            color=0x00ff00
        )
        
        # Show current settings
        current_duration = config.get("duration", 0)
        embed.add_field(
            name="📅 Auto-posting",
            value=f"Interval: {current_duration} h",
            inline=True
        )
        
        # Show auto-posting channel
        auto_post_channel_id = config.get("auto_post_channel_id")
        if auto_post_channel_id:
            try:
                guild = self.bot.get_guild(int(guild_id))
                if guild:
                    channel = guild.get_channel(auto_post_channel_id)
                    channel_name = f"#{channel.name}" if channel else f"ID: {auto_post_channel_id}"
                else:
                    channel_name = f"ID: {auto_post_channel_id}"
            except:
                channel_name = f"ID: {auto_post_channel_id}"
        else:
            channel_name = "Auto-select"
        
        embed.add_field(
            name="📢 Auto-post channel",
            value=channel_name,
            inline=True
        )
        
        pool_address = config.get("poolAddress", "Not set")
        embed.add_field(
            name="🏊 Pool",
            value=f"Address: {pool_address[:10]}..." if len(pool_address) > 10 else pool_address,
            inline=True
        )
        
        network = config.get("network", "polygon_pos")
        embed.add_field(
            name="🌐 Network",
            value=network,
            inline=True
        )
        
        # Add superuser buttons
        if user and (str(user.display_name) == SUPER_USER_ID or str(user.global_name) == SUPER_USER_ID):
            current_min_duration = config.get("minimal_duration", 0.02)
            current_free = "Yes" if config.get("free", False) else "No"
            embed.add_field(
                name="⚙️ Superuser settings",
                value=f"Min. interval: {current_min_duration} h\nFree mode: {current_free}",
                inline=False
            )
        
        embed.set_footer(text="Use corresponding commands to change settings")
        
        return embed

    def get_access_token(self, guild_id, admin_id):
        """Request access token from API server"""
        try:
            logger.info(f"Requesting access token for guild {guild_id} and admin {admin_id}")
            logger.info(f"API URL: {ACCESS_TOKEN_URL}")
            
            request_data = {"groupId": str(guild_id), "adminId": str(admin_id)}
            logger.info(f"Request data: {request_data}")
            
            response = requests.post(
                ACCESS_TOKEN_URL,
                json=request_data,
                timeout=10
            )
            
            logger.info(f"Response status code: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                logger.info(f"Successfully received token and URL")
                
                # Get token from response
                token = data.get('token')
                
                # Create URL with public domain instead of localhost
                url = f"{WEB_EDITOR_URL}/?config={guild_id}&token={token}"
                
                return token, url
            else:
                logger.error(f"Failed to get access token: {response.status_code}")
                if hasattr(response, 'text'):
                    logger.error(f"Response text: {response.text}")
                return None, None
        except Exception as e:
            logger.error(f"Error requesting access token: {e}")
            logger.exception("Full exception details:")
            return None, None

    async def process_import_file(self, attachment, guild_id, user):
        """Process import file from Discord attachment"""
        try:
            # Check superuser permissions
            if user.name != SUPER_USER_ID:
                return "❌ You don't have permission to import settings"
                
            logger.info(f"Starting import file processing for guild {guild_id}")
            
            if not attachment.filename.endswith('.json'):
                logger.warning(f"Invalid file extension for attachment: {attachment.filename}")
                return "Please upload a file with .json extension"
            
            # Download file
            try:
                logger.info(f"Downloading attachment: {attachment.filename}")
                file_data = await attachment.read()
                logger.info(f"File downloaded successfully, size: {len(file_data)} bytes")
                
                # Parse JSON
                try:
                    logger.info("Parsing JSON content")
                    imported_data = json.loads(file_data.decode('utf-8'))
                    logger.info(f"JSON parsed successfully, keys: {list(imported_data.keys())}")
                except json.JSONDecodeError as e:
                    logger.error(f"Invalid JSON format: {e}")
                    return "Invalid JSON format"
            except Exception as e:
                logger.error(f"Error downloading or parsing file: {e}", exc_info=True)
                return f"❌ Error downloading or parsing file: {str(e)}"
            
            # Load existing config
            logger.info(f"Loading existing configuration for guild {guild_id}")
            config = self.load_guild_config(guild_id)
            if not config:
                logger.info(f"No existing configuration found for guild {guild_id}, creating default")
                config = self.create_default_config(guild_id)
            
            # Create a backup of existing configuration
            try:
                import time
                backup_path = os.path.join(self.guilds_dir, f".backup_{guild_id}_{int(time.time())}.json")
                logger.info(f"Creating backup at {backup_path}")
                with open(backup_path, 'w', encoding='utf-8') as f:
                    json.dump(config, f, indent=2, ensure_ascii=False)
                logger.info("Backup created successfully")
            except Exception as e:
                logger.error(f"Error creating backup: {e}", exc_info=True)
            
            # Preserve critical fields
            last_poster_time = config.get('last_poster_time', 0)
            minimal_duration = config.get('minimal_duration', 0.02)
            free = config.get('free', False)
            auto_post_channel_id = config.get('auto_post_channel_id')
            logger.info(f"Preserving last_poster_time: {last_poster_time}")
            logger.info(f"Current minimal_duration: {minimal_duration}")
            logger.info(f"Current free setting: {free}")
            logger.info(f"Preserving auto_post_channel_id: {auto_post_channel_id}")
            
            # Update configuration with imported data
            logger.info("Updating configuration with imported data")
            for key in imported_data:
                # Check for special fields that only superuser can edit
                if key in ['minimal_duration', 'free'] and user.name != SUPER_USER_ID:
                    logger.warning(f"User {user.name} tried to modify {key}, but only {SUPER_USER_ID} can do that")
                    continue
                
                # Skip fields that should be preserved
                if key in ['last_poster_time', 'auto_post_channel_id']:
                    logger.info(f"Skipping preserved field: {key}")
                    continue
                
                # Добавляем или обновляем ключ (включая новые ключи как doji, highLowLines, borders)
                    config[key] = imported_data[key]
                    logger.info(f"Updated key: {key}")
            
            # Make sure to preserve network, poolAddress, duration, numBars, interval, displayName
            # if they exist in the imported configuration
            logger.info("Updating core configuration settings")
            for key in ['network', 'poolAddress', 'duration', 'numBars', 'interval', 'displayName']:
                if key in imported_data:
                    config[key] = imported_data[key]
                    logger.info(f"Updated core setting: {key} to {imported_data[key]}")
            
            # Restore preserved fields
            config['last_poster_time'] = last_poster_time
            if auto_post_channel_id is not None:
                config['auto_post_channel_id'] = auto_post_channel_id
                logger.info(f"Restored auto_post_channel_id: {auto_post_channel_id}")
            
            # If user is not superuser, restore minimal_duration and free values
            if user.name != SUPER_USER_ID:
                config['minimal_duration'] = minimal_duration
                config['free'] = free
            
            logger.info(f"Saving updated configuration for guild {guild_id}")
            if self.save_guild_config(guild_id, config):
                logger.info("Configuration saved successfully")
                return "✅ Settings imported successfully"
            else:
                logger.error("Failed to save configuration")
                return "❌ Failed to save imported settings"
            
        except Exception as e:
            logger.error(f"Error processing import file: {e}", exc_info=True)
            return f"❌ Error importing settings: {str(e)}"

    def process_json_import(self, user_id, guild_id, json_content, user):
        """Process JSON import for Discord bot"""
        try:
            # Проверка прав суперпользователя
            if not (str(user.display_name) == SUPER_USER_ID or str(user.global_name) == SUPER_USER_ID):
                logger.warning(f"User {user.display_name} tried to import JSON, but only {SUPER_USER_ID} can do that")
                return "❌ You don't have permission to import settings"
            
            logger.info(f"Starting JSON import for guild {guild_id} by user {user.display_name}")
            
            # Parse JSON content
            try:
                imported_data = json.loads(json_content)
                logger.info(f"Successfully parsed JSON data with {len(imported_data)} keys")
            except json.JSONDecodeError as e:
                logger.error(f"Invalid JSON format: {e}")
                return "❌ Invalid JSON format"
            
            # Load existing configuration
            config = self.load_guild_config(guild_id)
            if not config:
                logger.info(f"No existing configuration found for guild {guild_id}, creating default")
                config = self.create_default_config(guild_id)
            
            # Create a backup of existing configuration
            try:
                import time
                backup_path = os.path.join(self.guilds_dir, f".backup_{guild_id}_{int(time.time())}.json")
                logger.info(f"Creating backup at {backup_path}")
                with open(backup_path, 'w', encoding='utf-8') as f:
                    json.dump(config, f, indent=2, ensure_ascii=False)
                logger.info("Backup created successfully")
            except Exception as e:
                logger.error(f"Error creating backup: {e}", exc_info=True)
            
            # Preserve critical fields
            last_poster_time = config.get('last_poster_time', 0)
            minimal_duration = config.get('minimal_duration', 0.02)
            free = config.get('free', False)
            auto_post_channel_id = config.get('auto_post_channel_id')
            logger.info(f"Preserving last_poster_time: {last_poster_time}")
            logger.info(f"Current minimal_duration: {minimal_duration}")
            logger.info(f"Current free setting: {free}")
            logger.info(f"Preserving auto_post_channel_id: {auto_post_channel_id}")
            
            # Update configuration with imported data
            logger.info("Updating configuration with imported data")
            for key in imported_data:
                # Skip fields that should be preserved
                if key in ['last_poster_time', 'auto_post_channel_id']:
                    logger.info(f"Skipping preserved field: {key}")
                    continue
                    
                # Добавляем или обновляем ключ (включая новые ключи как doji, highLowLines, borders)
                    config[key] = imported_data[key]
                    logger.info(f"Updated key: {key}")
            
            # Make sure to preserve network, poolAddress, duration, numBars, interval, displayName
            # if they exist in the imported configuration
            logger.info("Updating core configuration settings")
            for key in ['network', 'poolAddress', 'duration', 'numBars', 'interval', 'displayName']:
                if key in imported_data:
                    config[key] = imported_data[key]
                    logger.info(f"Updated core setting: {key} to {imported_data[key]}")
            
            # Restore preserved fields
            config['last_poster_time'] = last_poster_time
            if auto_post_channel_id is not None:
                config['auto_post_channel_id'] = auto_post_channel_id
                logger.info(f"Restored auto_post_channel_id: {auto_post_channel_id}")
            
            # For superuser, allow minimal_duration and free changes
            if str(user.display_name) == SUPER_USER_ID or str(user.global_name) == SUPER_USER_ID:
                if 'minimal_duration' in imported_data:
                    config['minimal_duration'] = imported_data['minimal_duration']
                    logger.info(f"Updated minimal_duration to {imported_data['minimal_duration']}")
                if 'free' in imported_data:
                    config['free'] = imported_data['free']
                    logger.info(f"Updated free status to {imported_data['free']}")
            
            logger.info(f"Saving updated configuration for guild {guild_id}")
            if self.save_guild_config(guild_id, config):
                logger.info("Configuration saved successfully")
                # Remove from pending imports
                if user_id in self.pending_imports:
                    del self.pending_imports[user_id]
                return "✅ Settings imported successfully"
            else:
                logger.error("Failed to save configuration")
                return "❌ Failed to save imported settings"
            
        except Exception as e:
            logger.error(f"Error processing JSON import: {e}", exc_info=True)
            return f"❌ Error importing settings: {str(e)}" 