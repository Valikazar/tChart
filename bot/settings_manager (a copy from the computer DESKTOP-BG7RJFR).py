#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import json
import logging
import telebot
import requests
from telebot.types import Message, InlineKeyboardMarkup, InlineKeyboardButton, CallbackQuery

logger = logging.getLogger(__name__)

# Import database manager (conditional to avoid errors if module doesn't exist)
try:
    from db_manager import db_manager
    DB_AVAILABLE = True
except ImportError:
    logger.warning("db_manager module not found, database features will be disabled")
    DB_AVAILABLE = False
    db_manager = None

# Base URL of web editor
WEB_EDITOR_URL = "https://tchart.xyz"
# Base URL of API
API_URL = "http://localhost:3002"

# Full URL for token API access
ACCESS_TOKEN_URL = f"{API_URL}/api/access-token"

# ID суперпользователя
SUPER_USER_ID = "Valikazar"

# Определяем глобальные переменные для совместимости с JSON
true = True
false = False

class SettingsManager:
    def __init__(self, bot, groups_dir, reschedule_callback=None):
        self.bot = bot
        self.groups_dir = groups_dir
        self.reschedule_callback = reschedule_callback
        # Directory where the script is located
        self.script_dir = os.path.dirname(os.path.abspath(__file__))
        if not os.path.exists(groups_dir):
            os.makedirs(groups_dir)

    def load_group_config(self, group_id):
        """Load group configuration"""
        config_path = os.path.join(self.groups_dir, f"{group_id}.json")
        if os.path.exists(config_path):
            try:
                with open(config_path, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception as e:
                logger.error(f"Error loading configuration for group {group_id}: {e}")
        return None

    def save_group_config(self, group_id, config):
        """Save group configuration (removes duration, last_poster_time, random_chart, free as they're in DB)"""
        try:
            # Remove fields that are stored in DB from config before saving to JSON
            config_copy = json.loads(json.dumps(config))  # Deep copy
            db_fields = ['duration', 'last_poster_time', 'minimal_duration', 'random_chart', 'free']
            for field in db_fields:
                if field in config_copy:
                    del config_copy[field]
            
            config_path = os.path.join(self.groups_dir, f"{group_id}.json")
            with open(config_path, 'w', encoding='utf-8') as f:
                json.dump(config_copy, f, indent=2, ensure_ascii=False)
            return True
        except Exception as e:
            logger.error(f"Error saving configuration for group {group_id}: {e}")
            return False

    def create_default_config(self, group_id, group_name=""):
        """Create default configuration for a group"""
        try:
            empty_config_path = os.path.join(self.script_dir, 'empty.json')
            if not os.path.exists(empty_config_path):
                # If empty.json file doesn't exist, create base configuration programmatically
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
                    "numBars": 20,
                    "interval": "hour"
                }
            else:
                with open(empty_config_path, 'r', encoding='utf-8') as f:
                    config = json.load(f)
            
            # Don't set last_poster_time in JSON (it's in DB)
            
            if self.save_group_config(group_id, config):
                logger.info(f"Created configuration for group {group_id}")
                return config
        except Exception as e:
            logger.error(f"Error creating configuration for group {group_id}: {e}")
        return None

    def get_user_admin_groups(self, user_id):
        """Get list of groups where user is admin"""
        admin_groups = []
        
        logger.info(f"Checking groups in directory: {self.groups_dir}")
        
        if not os.path.exists(self.groups_dir):
            logger.error(f"Directory {self.groups_dir} does not exist")
            return admin_groups
            
        # Check if user is superuser
        is_superuser = False
        try:
            user = self.bot.get_chat(user_id)
            if user and user.username == SUPER_USER_ID:
                is_superuser = True
                logger.info(f"User {user_id} identified as superuser {SUPER_USER_ID}")
        except Exception as e:
            logger.info(f"Could not verify if user {user_id} is superuser: {e}")
            
        for filename in os.listdir(self.groups_dir):
            # Skip backup files that start with ".backup_"
            if filename.startswith('.backup_'):
                logger.info(f"Skipping backup file: {filename}")
                continue
                
            if filename.endswith('.json'):
                try:
                    # Get group ID from filename (without .json extension)
                    group_id = int(filename[:-5])
                    logger.info(f"Processing group: {group_id}")
                    
                    # Load group configuration
                    config_path = os.path.join(self.groups_dir, filename)
                    try:
                        with open(config_path, 'r', encoding='utf-8') as f:
                            config = json.load(f)
                        logger.info(f"Successfully loaded config for group {group_id}")
                    except Exception as e:
                        logger.error(f"Error loading config for group {group_id}: {e}")
                        continue
                    
                    # If user is superuser, skip admin rights check
                    if is_superuser:
                        try:
                            # Try to get group name
                            try:
                                chat = self.bot.get_chat(group_id)
                                group_name = chat.title
                                logger.info(f"Superuser access: Found group name: {group_name}")
                            except Exception as e:
                                logger.warning(f"Superuser access: Could not get group {group_id}: {e}")
                                group_name = f"Group {group_id}"
                            
                            # Add group to list
                            admin_groups.append({
                                'id': str(group_id),
                                'name': group_name
                            })
                            logger.info(f"Superuser access: Added group {group_id} to admin groups list")
                        except Exception as e:
                            logger.error(f"Superuser access: Error processing group {group_id}: {e}")
                            continue
                    else:
                        # For regular users - check admin rights
                        try:
                            logger.info(f"Checking admin rights for user {user_id} in group {group_id}")
                            try:
                                chat_member = self.bot.get_chat_member(group_id, user_id)
                                if chat_member.status in ['administrator', 'creator']:
                                    
                                    # Get group name
                                    try:
                                        chat = self.bot.get_chat(group_id)
                                        group_name = chat.title if chat.title else f"Group {group_id}"
                                        logger.info(f"Found group name: {group_name}")
                                    except Exception as e:
                                        logger.warning(f"Could not get group name for {group_id}: {e}")
                                        group_name = f"Group {group_id}"
                                    
                                    # Add group to list
                                    admin_groups.append({
                                        'id': str(group_id),
                                        'name': group_name
                                    })
                                    logger.info(f"Added group {group_id} to admin groups list")
                                else:
                                    logger.info(f"User {user_id} is not admin in group {group_id}, status: {chat_member.status}")
                            except Exception as e:
                                logger.warning(f"Error checking admin status for group {group_id}: {e}")
                                continue
                        except Exception as e:
                            logger.error(f"Error checking admin status for group {group_id}: {e}")
                            continue
                        
                except Exception as e:
                    logger.error(f"Error processing group file {filename}: {e}")
                    continue
        
        logger.info(f"Found {len(admin_groups)} admin groups for user {user_id}")
        return admin_groups

    def create_group_menu(self, user_id):
        """Create group selection menu"""
        admin_groups = self.get_user_admin_groups(user_id)
        if not admin_groups:
            return None, "You don't have admin rights in any group."

        keyboard = InlineKeyboardMarkup()
        for group in admin_groups:
            keyboard.add(InlineKeyboardButton(
                text=f"{group['name']} ({group['id']})",
                callback_data=f"group_{group['id']}"
            ))

        return keyboard, "Select a group to configure:"

    def create_settings_menu(self, group_id, user=None):
        """Create settings menu for a group"""
        config = self.load_group_config(group_id)
        
        keyboard = InlineKeyboardMarkup()
        
        # Показываем кнопку импорта только суперпользователю
        if user and user.username == SUPER_USER_ID:
            keyboard.add(InlineKeyboardButton(
                text="📥 Import settings from JSON",
                callback_data=f"import_{group_id}"
            ))
        
        # Показываем текущее значение duration в скобках (из БД)
        current_duration = 0
        current_random_chart = False
        current_free = False
        if DB_AVAILABLE:
            group_data = db_manager.get_group_data(group_id)
            current_duration = group_data.get('duration', 0)
            current_random_chart = group_data.get('random_chart', False)
            current_free = group_data.get('free', False)
        keyboard.add(InlineKeyboardButton(
            text=f"⏱️ Set auto-post interval ({current_duration} h)",
            callback_data=f"duration_{group_id}"
        ))
        
        keyboard.add(InlineKeyboardButton(
            text="🌐 Edit in web interface",
            callback_data=f"web_edit_{group_id}"
        ))
        
        # Добавляем кнопку Help
        keyboard.add(InlineKeyboardButton(
            text="📚 Help",
            url="https://tchart.xyz/help.html"
        ))
        
        # Добавляем кнопки для суперпользователя, если это он
        if user and user.username == SUPER_USER_ID:
            # Get minimal_duration, free and random_chart from DB
            if DB_AVAILABLE:
                group_data = db_manager.get_group_data(group_id)
                current_min_duration = group_data.get('minimal_duration', 2)
                current_free = group_data.get('free', False)
                current_random_chart = group_data.get('random_chart', False)
            else:
                current_min_duration = config.get("minimal_duration", 2)
                current_free = config.get("free", False)
                current_random_chart = config.get("random_chart", False)
            
            keyboard.add(InlineKeyboardButton(
                text=f"⚙️ Edit minimal_duration ({current_min_duration} h)",
                callback_data=f"min_duration_{group_id}"
            ))
            
            current_free_text = "Yes" if current_free else "No"
            keyboard.add(InlineKeyboardButton(
                text=f"🔓 Change free status ({current_free_text})",
                callback_data=f"free_status_{group_id}"
            ))
            
            current_random_chart_text = "Yes" if current_random_chart else "No"
            keyboard.add(InlineKeyboardButton(
                text=f"🎲 Random chart ({current_random_chart_text})",
                callback_data=f"random_chart_status_{group_id}"
            ))
        
        return keyboard

    def handle_group_selection(self, call: CallbackQuery):
        """Handle group selection"""
        try:
            group_id = call.data.split('_')[1]
            keyboard = self.create_settings_menu(group_id, call.from_user)
            
            self.bot.edit_message_text(
                f"Settings for group {group_id}",
                call.message.chat.id,
                call.message.message_id,
                reply_markup=keyboard
            )
        except Exception as e:
            logger.error(f"Error handling group selection: {e}")
            self.bot.answer_callback_query(call.id, "An error occurred while processing the request")

    def handle_import_config(self, call: CallbackQuery):
        """Handle configuration import"""
        try:
            # Проверка прав суперпользователя
            if call.from_user.username != SUPER_USER_ID:
                self.bot.answer_callback_query(call.id, "❌ You don't have permission to import settings")
                return
                
            logger.info(f"Import config requested by user {call.from_user.id}")
            group_id = call.data.split('_')[1]
            logger.info(f"Group ID for import: {group_id}")
            
            self.bot.edit_message_text(
                "Send a JSON file with settings",
                call.message.chat.id,
                call.message.message_id
            )
            logger.info(f"Registering next step handler for message ID {call.message.message_id}")
            self.bot.register_next_step_handler(call.message, self.process_import_file, group_id)
            logger.info(f"Next step handler registered successfully")
        except Exception as e:
            logger.error(f"Error handling import configuration: {e}", exc_info=True)
            self.bot.answer_callback_query(call.id, "An error occurred while processing the request")

    def process_import_file(self, message: Message, group_id):
        """Process import file"""
        try:
            # Проверка прав суперпользователя
            if message.from_user.username != SUPER_USER_ID:
                self.bot.reply_to(message, "❌ You don't have permission to import settings")
                return
                
            logger.info(f"Starting import file processing for group {group_id}")
            
            # First check if a file exists
            if not message.document:
                logger.warning(f"No document found in message from user {message.from_user.id}")
                self.bot.reply_to(message, "Please upload a configuration file")
                return
            
            logger.info(f"Processing document: {message.document.file_name}, file ID: {message.document.file_id}")
            
            if not message.document.file_name.endswith('.json'):
                logger.warning(f"Invalid file extension for document: {message.document.file_name}")
                self.bot.reply_to(message, "Please upload a file with a .json extension")
                return
            
            # Download file
            try:
                logger.info(f"Getting file info for file ID: {message.document.file_id}")
                file_info = self.bot.get_file(message.document.file_id)
                logger.info(f"File path: {file_info.file_path}")
                
                logger.info(f"Downloading file from path: {file_info.file_path}")
                downloaded_file = self.bot.download_file(file_info.file_path)
                logger.info(f"File downloaded successfully, size: {len(downloaded_file)} bytes")
                
                # Parse JSON
                try:
                    logger.info("Parsing JSON content")
                    imported_data = json.loads(downloaded_file.decode('utf-8'))
                    logger.info(f"JSON parsed successfully, keys: {list(imported_data.keys())}")
                except json.JSONDecodeError as e:
                    logger.error(f"Invalid JSON format: {e}")
                    self.bot.reply_to(message, "Invalid JSON format")
                    return
            except Exception as e:
                logger.error(f"Error downloading or parsing file: {e}", exc_info=True)
                self.bot.reply_to(message, f"❌ Error downloading or parsing file: {str(e)}")
                return
            
            # Load existing config
            logger.info(f"Loading existing configuration for group {group_id}")
            config = self.load_group_config(group_id)
            if not config:
                logger.info(f"No existing configuration found for group {group_id}, creating default")
                config = self.create_default_config(group_id)
            
            # Create a backup of existing configuration
            try:
                import time
                backup_path = os.path.join(self.groups_dir, f".backup_{group_id}_{int(time.time())}.json")
                logger.info(f"Creating backup at {backup_path}")
                with open(backup_path, 'w', encoding='utf-8') as f:
                    json.dump(config, f, indent=2, ensure_ascii=False)
                logger.info("Backup created successfully")
            except Exception as e:
                logger.error(f"Error creating backup: {e}", exc_info=True)
            
            # Preserve critical fields (some are in DB, some in JSON)
            from db_manager import db_manager
            group_data = db_manager.get_group_data(group_id)
            minimal_duration = group_data.get('minimal_duration', 2)
            free = group_data.get('free', False)
            # Also check JSON for migration
            json_minimal_duration = config.get('minimal_duration', 2)
            if json_minimal_duration != 2 and minimal_duration == 2:
                minimal_duration = json_minimal_duration
                db_manager.set_minimal_duration(group_id, json_minimal_duration)
            json_free = config.get('free', False)
            if json_free and not free:
                free = json_free
                db_manager.set_free(group_id, json_free)
            
            logger.info(f"Current minimal_duration: {minimal_duration} (from DB)")
            logger.info(f"Current free setting: {free} (from DB)")
            
            # Handle duration from imported data - save to DB, not JSON
            imported_duration = imported_data.get('duration')
            if imported_duration is not None and DB_AVAILABLE:
                try:
                    duration_value = float(imported_duration)
                    if duration_value >= 0:
                        db_manager.set_duration(group_id, duration_value)
                        logger.info(f"Imported duration {duration_value} saved to database")
                except (ValueError, TypeError) as e:
                    logger.warning(f"Invalid duration value in import: {e}")
            
            # Update configuration with imported data
            logger.info("Updating configuration with imported data")
            for key in imported_data:
                # Проверка на специальные поля, которые может редактировать только суперпользователь
                if key in ['minimal_duration', 'free'] and message.from_user.username != SUPER_USER_ID:
                    logger.warning(f"User {message.from_user.username} tried to modify {key}, but only {SUPER_USER_ID} can do that")
                    continue
                
                # Handle DB fields - save to DB instead of JSON
                if key == 'minimal_duration':
                    if imported_data[key] is not None and message.from_user.username == SUPER_USER_ID:
                        db_manager.set_minimal_duration(group_id, imported_data[key])
                        logger.info(f"Set minimal_duration in DB: {imported_data[key]}")
                    continue
                elif key == 'free':
                    if imported_data[key] is not None and message.from_user.username == SUPER_USER_ID:
                        db_manager.set_free(group_id, imported_data[key])
                        logger.info(f"Set free in DB: {imported_data[key]}")
                    continue
                
                # Skip fields that should not be in JSON
                if key in ['last_poster_time', 'duration']:
                    logger.info(f"Skipping field that should be in DB: {key}")
                    continue
                
                # Добавляем или обновляем ключ (включая новые ключи как doji, highLowLines, borders)
                config[key] = imported_data[key]
                logger.info(f"Updated key: {key}")
            
            # Make sure to preserve network, poolAddress, numBars, interval, doji, highLowLines, borders, displayName
            # if they exist in the imported configuration (duration is handled separately above)
            logger.info("Updating core configuration settings")
            for key in ['network', 'poolAddress', 'numBars', 'interval', 'doji', 'highLowLines', 'borders', 'displayName']:
                if key in imported_data:
                    config[key] = imported_data[key]
                    logger.info(f"Updated core setting: {key} to {imported_data[key]}")
            
            # Remove DB fields from config (they're in DB)
            db_fields = ['duration', 'last_poster_time', 'minimal_duration', 'free']
            for field in db_fields:
                if field in config:
                    del config[field]
            
            # Если пользователь не суперпользователь, восстанавливаем только minimal_duration (free is in DB)
            if message.from_user.username != SUPER_USER_ID:
                # minimal_duration is now in DB, so we don't restore it to JSON
                pass
            
            logger.info(f"Saving updated configuration for group {group_id}")
            if self.save_group_config(group_id, config):
                logger.info("Configuration saved successfully")
                self.bot.reply_to(message, "✅ Configuration successfully imported")
            else:
                logger.error("Failed to save configuration")
                self.bot.reply_to(message, "❌ Failed to save imported configuration")
            
        except Exception as e:
            logger.error(f"Error processing import file: {e}", exc_info=True)
            self.bot.reply_to(message, f"❌ Error importing configuration: {str(e)}")

    def handle_duration_setting(self, call: CallbackQuery):
        """Handle duration setting"""
        try:
            group_id = call.data.split('_')[1]
            self.bot.edit_message_text(
                "Enter auto-post interval in hours (0 to disable):",
                call.message.chat.id,
                call.message.message_id
            )
            self.bot.register_next_step_handler(call.message, self.process_duration_input, group_id)
        except Exception as e:
            logger.error(f"Error handling duration setting: {e}")
            self.bot.answer_callback_query(call.id, "An error occurred while processing the request")

    def process_duration_input(self, message: Message, group_id):
        """Process duration input"""
        try:
            try:
                duration = float(message.text)
                if duration < 0:
                    raise ValueError("Interval cannot be negative")
                
                # Convert to integer if the value is a whole number
                if duration.is_integer():
                    duration = int(duration)
            except ValueError:
                self.bot.reply_to(message, "Please enter a valid number")
                return

            config = self.load_group_config(group_id)
            if not config:
                config = self.create_default_config(group_id)

            # Save duration to database instead of JSON
            if DB_AVAILABLE:
                db_manager.set_duration(group_id, duration)
            else:
                # Fallback to JSON if DB not available
                config['duration'] = duration
                if not self.save_group_config(group_id, config):
                    self.bot.reply_to(message, "❌ Failed to save settings")
                    return
            
            # Save config without duration (it's in DB now)
            if 'duration' in config:
                del config['duration']
            if 'last_poster_time' in config:
                del config['last_poster_time']
            self.save_group_config(group_id, config)

            self.bot.reply_to(message, f"✅ Auto-post interval set to {duration} hours")
            
            # Reschedule tasks if callback is available
            if self.reschedule_callback and duration > 0:
                try:
                    self.reschedule_callback(group_id, config)
                    self.bot.send_message(message.chat.id, "🔄 Task schedule updated")
                except Exception as e:
                    logger.error(f"Error rescheduling task for group {group_id}: {e}")
                    self.bot.send_message(message.chat.id, "⚠️ Schedule updated, but task rescheduling failed")
            elif self.reschedule_callback and duration == 0:
                try:
                    # Cancel task if duration is 0
                    self.reschedule_callback(group_id, None)
                    self.bot.send_message(message.chat.id, "🛑 Auto-posting disabled, task cancelled")
                except Exception as e:
                    logger.error(f"Error cancelling task for group {group_id}: {e}")
            
            # Возвращаем меню настроек
            keyboard = self.create_settings_menu(group_id, message.from_user)
            
            self.bot.send_message(
                message.chat.id,
                f"Settings for group {group_id}",
                reply_markup=keyboard
            )
        except Exception as e:
            logger.error(f"Error processing duration input: {e}")
            self.bot.reply_to(message, f"❌ Error processing interval: {str(e)}")

    def get_access_token(self, group_id, admin_id):
        """Request access token from API server"""
        try:
            logger.info(f"Requesting access token for group {group_id} and admin {admin_id}")
            logger.info(f"API URL: {ACCESS_TOKEN_URL}")
            
            request_data = {"groupId": group_id, "adminId": admin_id}
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
                url = f"{WEB_EDITOR_URL}/?config={group_id}&token={token}"
                
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

    def handle_web_edit(self, call: CallbackQuery):
        """Handle web editing request"""
        try:
            # Split callback_data by '_' character
            parts = call.data.split('_')
            
            # Check that we have at least 3 parts: 'web', 'edit', 'group_id'
            if len(parts) < 3:
                self.bot.send_message(
                    call.message.chat.id,
                    "❌ Invalid data format for web editing"
                )
                return
            
            # Extract group ID, everything after 'web_edit_'
            prefix_length = len("web_edit_")
            group_id = call.data[prefix_length:]
            
            logger.info(f"Web edit requested for group ID: {group_id}")
            user_id = call.from_user.id
            
            self.bot.answer_callback_query(call.id, "Generating web editor link...")
            
            token, url = self.get_access_token(group_id, user_id)
            
            if token and url:
                # Create keyboard with button to open editor
                keyboard = InlineKeyboardMarkup()
                keyboard.add(InlineKeyboardButton(
                    text="🌐 Open Web Editor",
                    url=url
                ))
                
                self.bot.send_message(
                    call.message.chat.id,
                    "Click the button below to open the web editor.\n"
                    "The link will be valid for 1 hour.",
                    reply_markup=keyboard
                )
            else:
                self.bot.send_message(
                    call.message.chat.id,
                    f"❌ Failed to generate web editor link for group {group_id}. Please try again later."
                )
        except Exception as e:
            logger.error(f"Error handling web edit request: {e}")
            logger.exception("Full exception details:")
            self.bot.send_message(
                call.message.chat.id,
                "❌ An error occurred while processing your request."
            )

    def handle_bot_status_change(self, message: Message):
        """Handle bot status changes in groups"""
        try:
            # Check if this is a group/supergroup
            if message.chat.type not in ['group', 'supergroup']:
                return

            group_id = str(message.chat.id)
            new_status = message.new_chat_member.status

            # If bot was removed from group
            if new_status == 'left' or new_status == 'kicked':
                config_path = os.path.join(self.groups_dir, f"{group_id}.json")
                if os.path.exists(config_path):
                    try:
                        os.remove(config_path)
                        logger.info(f"Configuration file deleted for group {group_id}")
                    except Exception as e:
                        logger.error(f"Error deleting configuration file for group {group_id}: {e}")

        except Exception as e:
            logger.error(f"Error handling bot status change: {e}")
            
    def handle_min_duration_setting(self, call: CallbackQuery):
        """Handle minimal duration setting (for superuser only)"""
        try:
            # Проверка прав суперпользователя
            if call.from_user.username != SUPER_USER_ID:
                self.bot.answer_callback_query(call.id, "❌ You don't have permission to edit this parameter")
                return
                
            group_id = call.data.split('_')[2]  # min_duration_groupid
            self.bot.edit_message_text(
                "Enter the minimum interval between posts (in hours):",
                call.message.chat.id,
                call.message.message_id
            )
            self.bot.register_next_step_handler(call.message, self.process_min_duration_input, group_id)
        except Exception as e:
            logger.error(f"Error handling minimal duration setting: {e}")
            self.bot.answer_callback_query(call.id, "An error occurred while processing the request")
    
    def process_min_duration_input(self, message: Message, group_id):
        """Process minimal duration input (for superuser only)"""
        try:
            # Проверка прав суперпользователя
            if message.from_user.username != SUPER_USER_ID:
                self.bot.reply_to(message, "❌ You don't have permission to edit this parameter")
                return
                
            try:
                min_duration = float(message.text)
                if min_duration < 0:
                    raise ValueError("Interval cannot be negative")
                
                # Convert to integer if the value is a whole number
                if min_duration.is_integer():
                    min_duration = int(min_duration)
            except ValueError:
                self.bot.reply_to(message, "Please enter a valid number")
                return

            config = self.load_group_config(group_id)
            if not config:
                config = self.create_default_config(group_id)

            # Save minimal_duration to database instead of JSON
            if DB_AVAILABLE:
                db_manager.set_minimal_duration(group_id, min_duration)
            else:
                # Fallback to JSON if DB not available
                config['minimal_duration'] = min_duration
            
            # Remove minimal_duration from config before saving to JSON
            if 'minimal_duration' in config:
                del config['minimal_duration']

            if self.save_group_config(group_id, config):
                self.bot.reply_to(message, f"✅ The minimum interval between posts is set to {min_duration} hours")
                
                # Возвращаем меню настроек
                keyboard = self.create_settings_menu(group_id, message.from_user)
                
                # Добавляем кнопки для суперпользователя
                # Get minimal_duration and free from database
                if DB_AVAILABLE:
                    group_data = db_manager.get_group_data(group_id)
                    current_min_duration = group_data.get("minimal_duration", 2)
                    current_free = group_data.get("free", False)
                else:
                    current_min_duration = config.get("minimal_duration", 2)
                    current_free = config.get("free", False)
                keyboard.add(InlineKeyboardButton(
                    text=f"⚙️ Edit minimal_duration ({current_min_duration} h)",
                    callback_data=f"min_duration_{group_id}"
                ))
                
                current_free_text = "Yes" if current_free else "No"
                keyboard.add(InlineKeyboardButton(
                    text=f"🔓 Change free status ({current_free_text})",
                    callback_data=f"free_status_{group_id}"
                ))
                
                self.bot.send_message(
                    message.chat.id,
                    f"Settings for group {group_id}",
                    reply_markup=keyboard
                )
            else:
                self.bot.reply_to(message, "❌ Failed to save settings")
        except Exception as e:
            logger.error(f"Error processing minimal duration input: {e}")
            self.bot.reply_to(message, f"❌ Error processing interval: {str(e)}")
    
    def handle_free_status(self, call: CallbackQuery):
        """Handle free status setting (for superuser only)"""
        try:
            # Проверка прав суперпользователя
            if call.from_user.username != SUPER_USER_ID:
                self.bot.answer_callback_query(call.id, "❌ You don't have permission to edit this parameter")
                return
                
            group_id = call.data.split('_')[2]  # free_status_groupid
            config = self.load_group_config(group_id)
            if not config:
                config = self.create_default_config(group_id)
                
            current_status = config.get('free', False)
            
            # Создаем клавиатуру с кнопками выбора
            keyboard = InlineKeyboardMarkup()
            keyboard.add(
                InlineKeyboardButton(
                    text="✅ Enable free mode",
                    callback_data=f"set_free_{group_id}_true"
                )
            )
            keyboard.add(
                InlineKeyboardButton(
                    text="❌ Disable free mode",
                    callback_data=f"set_free_{group_id}_false"
                )
            )
            
            self.bot.edit_message_text(
                f"Current free mode status: {'Enabled' if current_status else 'Disabled'}\n"
                f"Select a new status:",
                call.message.chat.id,
                call.message.message_id,
                reply_markup=keyboard
            )
        except Exception as e:
            logger.error(f"Error handling free status setting: {e}")
            self.bot.answer_callback_query(call.id, "An error occurred while processing the request")
    
    def handle_set_free_status(self, call: CallbackQuery):
        """Handle setting free status (for superuser only)"""
        try:
            # Проверка прав суперпользователя
            if call.from_user.username != SUPER_USER_ID:
                self.bot.answer_callback_query(call.id, "❌ You don't have permission to edit this parameter")
                return
                
            # Формат callback_data: set_free_groupid_value
            parts = call.data.split('_')
            group_id = parts[2]
            free_value = parts[3].lower() == 'true'
            
            config = self.load_group_config(group_id)
            if not config:
                config = self.create_default_config(group_id)
            
            # Save free to database instead of JSON
            if DB_AVAILABLE:
                db_manager.set_free(group_id, free_value)
            else:
                # Fallback to JSON if DB not available
                config['free'] = free_value
            
            # Remove free and random_chart from config before saving to JSON
            if 'free' in config:
                del config['free']
            if 'random_chart' in config:
                del config['random_chart']
            
            if self.save_group_config(group_id, config):
                status_text = "enabled" if free_value else "disabled"
                self.bot.answer_callback_query(call.id, f"✅ Free mode {status_text} for group {group_id}")
                
                # Возвращаем меню настроек
                keyboard = self.create_settings_menu(group_id, call.from_user)
                
                # Добавляем кнопки для суперпользователя
                # Get minimal_duration and free from database
                if DB_AVAILABLE:
                    group_data = db_manager.get_group_data(group_id)
                    current_min_duration = group_data.get("minimal_duration", 2)
                    current_free = group_data.get("free", False)
                else:
                    current_min_duration = config.get("minimal_duration", 2)
                    current_free = config.get("free", False)
                keyboard.add(InlineKeyboardButton(
                    text=f"⚙️ Edit minimal_duration ({current_min_duration} h)",
                    callback_data=f"min_duration_{group_id}"
                ))
                
                current_free_text = "Yes" if current_free else "No"
                keyboard.add(InlineKeyboardButton(
                    text=f"🔓 Change free status ({current_free_text})",
                    callback_data=f"free_status_{group_id}"
                ))
                
                self.bot.edit_message_text(
                    f"Settings for group {group_id}",
                    call.message.chat.id,
                    call.message.message_id,
                    reply_markup=keyboard
                )
            else:
                self.bot.edit_message_text(
                    "❌ Failed to save settings",
                    call.message.chat.id,
                    call.message.message_id
                )
        except Exception as e:
            logger.error(f"Error setting free status: {e}")
            self.bot.answer_callback_query(call.id, "An error occurred while processing the request")
    
    def handle_random_chart_status(self, call: CallbackQuery):
        """Handle random chart status setting (for superuser only)"""
        try:
            # Проверка прав суперпользователя
            if call.from_user.username != SUPER_USER_ID:
                self.bot.answer_callback_query(call.id, "❌ You don't have permission to edit this parameter")
                return
                
            group_id = call.data.split('_')[3]  # random_chart_status_groupid
            config = self.load_group_config(group_id)
            if not config:
                config = self.create_default_config(group_id)
            
            # Get random_chart status from database
            current_status = False
            if DB_AVAILABLE:
                group_data = db_manager.get_group_data(group_id)
                current_status = group_data.get('random_chart', False)
            else:
                current_status = config.get('random_chart', False)
            
            # Создаем клавиатуру с кнопками выбора
            keyboard = InlineKeyboardMarkup()
            keyboard.add(
                InlineKeyboardButton(
                    text="✅ Enable random chart",
                    callback_data=f"set_random_chart_{group_id}_true"
                )
            )
            keyboard.add(
                InlineKeyboardButton(
                    text="❌ Disable random chart",
                    callback_data=f"set_random_chart_{group_id}_false"
                )
            )
            
            self.bot.edit_message_text(
                f"Current random chart status: {'Enabled' if current_status else 'Disabled'}\n"
                f"Select a new status:",
                call.message.chat.id,
                call.message.message_id,
                reply_markup=keyboard
            )
        except Exception as e:
            logger.error(f"Error handling random chart status setting: {e}")
            self.bot.answer_callback_query(call.id, "An error occurred while processing the request")
    
    def handle_set_random_chart(self, call: CallbackQuery):
        """Handle setting random chart status (for superuser only)"""
        try:
            # Проверка прав суперпользователя
            if call.from_user.username != SUPER_USER_ID:
                self.bot.answer_callback_query(call.id, "❌ You don't have permission to edit this parameter")
                return
                
            # Формат callback_data: set_random_chart_groupid_value
            parts = call.data.split('_')
            group_id = parts[3]
            random_chart_value = parts[4].lower() == 'true'
            
            config = self.load_group_config(group_id)
            if not config:
                config = self.create_default_config(group_id)
            
            # Save random_chart to database instead of JSON
            if DB_AVAILABLE:
                db_manager.set_random_chart(group_id, random_chart_value)
            else:
                # Fallback to JSON if DB not available
                config['random_chart'] = random_chart_value
            
            # If disabling random chart, clear used presets list
            if not random_chart_value:
                if 'random_chart_used_presets' in config:
                    del config['random_chart_used_presets']
            
            # Remove random_chart and free from config before saving to JSON
            if 'random_chart' in config:
                del config['random_chart']
            if 'free' in config:
                del config['free']
            
            if self.save_group_config(group_id, config):
                status_text = "enabled" if random_chart_value else "disabled"
                self.bot.answer_callback_query(call.id, f"✅ Random chart {status_text} for group {group_id}")
                
                # Возвращаем меню настроек
                keyboard = self.create_settings_menu(group_id, call.from_user)
                
                self.bot.edit_message_text(
                    f"Settings for group {group_id}",
                    call.message.chat.id,
                    call.message.message_id,
                    reply_markup=keyboard
                )
            else:
                self.bot.edit_message_text(
                    "❌ Failed to save settings",
                    call.message.chat.id,
                    call.message.message_id
                )
        except Exception as e:
            logger.error(f"Error setting random chart status: {e}")
            self.bot.answer_callback_query(call.id, "An error occurred while processing the request") 