#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import json
import telebot
import logging
import time
import threading
import requests.exceptions
from datetime import datetime, timedelta
from telebot.types import Message
from telebot.apihelper import ApiException
from chart_generator import (
    load_config, fetch_grouped_ohlcv, fetch_pool_info, render_chart,
    get_next_random_preset, load_preset_config, merge_preset_with_group_config
)
from settings_manager import SettingsManager, SUPER_USER_ID
from db_manager import db_manager

class TaskManager:
    """Manager for managing scheduled tasks"""
    def __init__(self):
        self._tasks = {}
        self._lock = threading.RLock()
    
    def schedule_task(self, group_id, delay, target_func, *args):
        """Schedule task for group"""
        # Convert group_id to string type for consistency
        group_id = str(group_id)
        
        with self._lock:
            logger.debug(f"=== SCHEDULING TASK FOR GROUP {group_id} ===")
            logger.debug(f"Tasks before cleanup: {list(self._tasks.keys())}")
            
            # RADICAL: first cancel ALL tasks for group
            self._hard_cancel_group_tasks(group_id)
            
            logger.debug(f"Tasks after hard cancel: {list(self._tasks.keys())}")
            
            # Additional check - ensure group is not in dictionary
            if group_id in self._tasks:
                logger.warning(f"Group {group_id} still in tasks after cancellation, force removing")
                del self._tasks[group_id]
            
            logger.debug(f"Tasks after final check: {list(self._tasks.keys())}")
            
            # Create new task
            timer = threading.Timer(delay, self._task_wrapper, args=(group_id, target_func, args))
            timer.start_time = time.time()
            timer.interval = delay
            timer.group_id = group_id
            timer.start()
            
            # Save task with group in string format
            self._tasks[group_id] = timer
            
            logger.debug(f"Tasks after adding new task: {list(self._tasks.keys())}")
            logger.info(f"Scheduled task for group {group_id} in {delay/3600:.2f} hours")
            logger.debug(f"TaskManager now has {len(self._tasks)} tasks")
            logger.debug(f"=== END SCHEDULING FOR GROUP {group_id} ===")
    
    def _hard_cancel_group_tasks(self, group_id):
        """Hard cancel ALL tasks for group"""
        # Convert group_id to string type
        group_id = str(group_id)
        logger.debug(f"Hard cancel called for group {group_id}")
        
        # First cancel task if it exists
        if group_id in self._tasks:
            task = self._tasks[group_id]
            logger.debug(f"Hard cancelling task for group {group_id}")
            if task and hasattr(task, 'cancel'):
                try:
                    task.cancel()
                    logger.debug(f"Task for group {group_id} cancelled successfully")
                except Exception as e:
                    logger.warning(f"Error cancelling task for group {group_id}: {e}")
            # Remove from dictionary
            del self._tasks[group_id]
            logger.debug(f"Removed group {group_id} from tasks dictionary")
        else:
            logger.debug(f"No existing task found for group {group_id}")
        
        # Additional check: find all tasks with same group_id (in case of error)
        keys_to_remove = []
        for key, task in self._tasks.items():
            if str(key) == str(group_id) or (hasattr(task, 'group_id') and str(task.group_id) == str(group_id)):
                logger.debug(f"Found task with matching group_id: {key}")
                keys_to_remove.append(key)
                if task and hasattr(task, 'cancel'):
                    try:
                        task.cancel()
                        logger.debug(f"Cancelled task {key}")
                    except Exception as e:
                        logger.debug(f"Error cancelling task {key}: {e}")
        
        for key in keys_to_remove:
            if key in self._tasks:
                del self._tasks[key]
                logger.debug(f"Additional cleanup: removed {key} from tasks")
    
    def _task_wrapper(self, group_id, target_func, args):
        """Wrapper for executing task with automatic cleanup"""
        # Convert group_id to string type
        group_id = str(group_id)
        try:
            logger.debug(f"Executing scheduled task for group {group_id}")
            target_func(*args)
        except Exception as e:
            logger.error(f"Error in task execution for group {group_id}: {e}")
        finally:
            # DO NOT automatically remove recurring tasks here!
            # Recurring tasks (auto_post_chart) will reschedule themselves
            # Only one-time tasks should be removed here
            # Task removal is handled in schedule_task() when cancelling old tasks
            logger.debug(f"Task wrapper completed for group {group_id} (task kept for rescheduling)")
    
    def cancel_task(self, group_id):
        """Cancel task for group"""
        group_id = str(group_id)
        with self._lock:
            self._hard_cancel_group_tasks(group_id)
    
    def cancel_all_tasks(self):
        """Cancel all tasks"""
        with self._lock:
            logger.debug(f"Cancelling all {len(self._tasks)} tasks")
            for group_id in list(self._tasks.keys()):
                self._hard_cancel_group_tasks(str(group_id))
            # Additional cleanup
            self._tasks.clear()
            logger.debug("All tasks cancelled and dictionary cleared")
    
    def get_active_tasks(self):
        """Get list of active tasks without duplicates"""
        with self._lock:
            # First clean inactive tasks
            self._cleanup_dead_tasks()
            
            # Create active tasks dictionary, ensuring uniqueness
            active_tasks = {}
            
            for group_id, task in list(self._tasks.items()):
                group_id = str(group_id)  # Convert to string
                if task and task.is_alive():
                    try:
                        next_run = task.start_time + task.interval
                        # Check for duplicates and take only first found task
                        if group_id not in active_tasks:
                            active_tasks[group_id] = next_run
                        else:
                            # If duplicate found, cancel current task
                            logger.error(f"DUPLICATE FOUND for group {group_id}! Cancelling duplicate task.")
                            task.cancel()
                            del self._tasks[group_id]
                    except AttributeError:
                        logger.warning(f"Task for group {group_id} missing attributes, removing")
                        if hasattr(task, 'cancel'):
                            task.cancel()
                        del self._tasks[group_id]
                else:
                    # Remove dead tasks
                    logger.debug(f"Removing dead task for group {group_id}")
                    del self._tasks[group_id]
            
            return active_tasks
    
    def _cleanup_dead_tasks(self):
        """Clean up dead tasks"""
        dead_groups = []
        for group_id, task in self._tasks.items():
            if not task or not task.is_alive():
                dead_groups.append(group_id)
        
        for group_id in dead_groups:
            logger.debug(f"Cleaning up dead task for group {group_id}")
            del self._tasks[group_id]
    
    def get_task_count(self):
        """Get number of active tasks"""
        with self._lock:
            self._cleanup_dead_tasks()
            return len(self._tasks)

# Logging setup
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Get script directory path
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

# Load bot configuration
try:
    config_path = os.path.join(SCRIPT_DIR, 'config_bot_tg.json')
    with open(config_path, 'r', encoding='utf-8') as f:
        bot_config = json.load(f)
    
    BOT_TOKEN = bot_config.get('bot_token')
    if not BOT_TOKEN:
        raise ValueError("Bot token not found in configuration")
except Exception as e:
    logger.error(f"Error loading bot configuration: {e}")
    exit(1)

# Bot initialization with custom retry settings
bot = telebot.TeleBot(BOT_TOKEN)

# Create folder for group configurations
GROUPS_DIR = os.path.join(SCRIPT_DIR, 'groups')

# Task manager for scheduled tasks
task_manager = TaskManager()

# Retry settings
MAX_RETRIES = 3
RETRY_DELAY = 5  # seconds
NETWORK_ERRORS = (
    requests.exceptions.ReadTimeout,
    requests.exceptions.ConnectTimeout,
    requests.exceptions.ConnectionError,
    requests.exceptions.HTTPError,
    ApiException
)

def retry_on_network_error(func):
    """Decorator for retrying functions on network errors"""
    def wrapper(*args, **kwargs):
        retries = 0
        while retries < MAX_RETRIES:
            try:
                return func(*args, **kwargs)
            except NETWORK_ERRORS as e:
                retries += 1
                if retries == MAX_RETRIES:
                    logger.error(f"Failed after {MAX_RETRIES} retries: {e}")
                    raise
                logger.warning(f"Network error: {e}. Retry {retries}/{MAX_RETRIES} in {RETRY_DELAY} seconds...")
                time.sleep(RETRY_DELAY)
    return wrapper

def print_active_tasks():
    """Prints list of active tasks to log"""
    logger.debug("=== Active scheduled tasks ===")
    
    # Force cleanup duplicates before output
    active_tasks = task_manager.get_active_tasks()
    
    # Check for duplicates
    seen_groups = set()
    duplicates_found = False
    
    if active_tasks:
        for group_id, next_run_time in active_tasks.items():
            if group_id in seen_groups:
                logger.error(f"DUPLICATE DETECTED: Group {group_id} has multiple tasks!")
                duplicates_found = True
                # Force cancel duplicate
                task_manager.cancel_task(group_id)
            seen_groups.add(group_id)
            
            next_run_dt = datetime.fromtimestamp(next_run_time)
            logger.debug(f"Group {group_id}: next run at {next_run_dt}")
    else:
        logger.debug("No active tasks")
    
    if duplicates_found:
        logger.error("DUPLICATE TASKS DETECTED! Force cancelling duplicates.")
        # Re-get active tasks after cleanup
        active_tasks = task_manager.get_active_tasks()
        logger.debug(f"After cleanup: {len(active_tasks)} tasks remain")
    
    logger.debug(f"Total tasks: {len(active_tasks)}")
    logger.debug("===")

def reschedule_task_callback(group_id, config):
    """Callback function for rescheduling tasks when settings change"""
    try:
        logger.info(f"RESCHEDULE_CALLBACK: Called for group {group_id}")
        
        # Get duration from database
        group_data = db_manager.get_group_data(group_id)
        duration = group_data.get('duration', 0)
        
        if duration <= 0:
            # Cancel task if duration is 0 or negative
            logger.info(f"RESCHEDULE_CALLBACK: Cancelling task for group {group_id} (duration: {duration})")
            task_manager.cancel_task(group_id)
            return
            
        # Cancel existing task first
        logger.info(f"RESCHEDULE_CALLBACK: Cancelling existing task for group {group_id}")
        task_manager.cancel_task(group_id)
        
        # Schedule new task with updated settings
        logger.info(f"RESCHEDULE_CALLBACK: Scheduling new task for group {group_id} with duration {duration}h")
        schedule_next_post(group_id)
        
        logger.info(f"RESCHEDULE_CALLBACK: Task rescheduled successfully for group {group_id}")
        
    except Exception as e:
        logger.error(f"RESCHEDULE_CALLBACK: Error for group {group_id}: {e}")
        logger.exception(f"RESCHEDULE_CALLBACK: Full traceback for group {group_id}:")
        raise

# Initialize settings manager with reschedule callback
settings_manager = SettingsManager(bot, GROUPS_DIR, reschedule_task_callback)

def schedule_next_post(group_id):
    """Schedule next automatic post for the group"""
    try:
        logger.debug(f"SCHEDULE_NEXT_POST: Starting for group {group_id}")
        
        # Validate group_id
        try:
            int(group_id)
        except ValueError:
            logger.error(f"Invalid group ID format in schedule_next_post: {group_id}")
            return
        
        # Get duration and last_poster_time from database
        group_data = db_manager.get_group_data(group_id)
        duration = group_data.get('duration', 0)
        last_poster_time = group_data.get('last_poster_time', 0)
        
        # Migration check: if duration is 0 in DB, check JSON config (for existing groups)
        if duration == 0:
            config = settings_manager.load_group_config(group_id)
            if config:
                json_duration = config.get('duration', 0)
                if json_duration > 0:
                    logger.info(f"Migrating duration from JSON to DB for group {group_id}: {json_duration} hours")
                    db_manager.set_duration(group_id, json_duration)
                    duration = json_duration
        
        if duration <= 0:
            return
        
        # Calculate next post time
        current_time = time.time()
        if last_poster_time == 0:
            next_post_time = current_time
        else:
            next_post_time = last_poster_time + (duration * 3600)
            
            # If next_post_time is in the past, schedule for the next interval
            if next_post_time < current_time:
                hours_passed = (current_time - last_poster_time) / 3600
                intervals_passed = int(hours_passed / duration)
                next_post_time = last_poster_time + ((intervals_passed + 1) * duration * 3600)
        
        delay = max(0, next_post_time - current_time)
        
        # Schedule next post using TaskManager
        task_manager.schedule_task(group_id, delay, auto_post_chart, group_id)
        
        logger.info(f"SCHEDULE_NEXT_POST: Scheduled next post for group {group_id} in {delay/3600:.2f} hours")
        print_active_tasks()  # Print list of active tasks
        logger.debug(f"SCHEDULE_NEXT_POST: Completed successfully for group {group_id}")
    except Exception as e:
        logger.error(f"SCHEDULE_NEXT_POST: Error for group {group_id}: {e}")
        logger.exception(f"SCHEDULE_NEXT_POST: Full traceback for group {group_id}:")

@retry_on_network_error
def auto_post_chart(group_id):
    """Automatically post chart for the group"""
    try:
        logger.info(f"=== AUTO_POST_CHART STARTED for group {group_id} ===")
        
        # Check validity of group ID
        try:
            chat_id = int(group_id)
        except ValueError:
            logger.error(f"Invalid group ID format: {group_id}")
            return
            
        config = settings_manager.load_group_config(group_id)
        if not config:
            logger.error(f"Failed to load config for group {group_id}")
            return
            
        # Create a fake message object for generate_chart
        class FakeMessage:
            def __init__(self, chat_id):
                self.chat = type('obj', (object,), {'id': chat_id, 'type': 'group'})
                self.chat_id = chat_id
                self.message_id = 0
        
        fake_msg = FakeMessage(chat_id)
        
        # Call generate_chart with is_auto=True (this prevents duplicate scheduling)
        generate_chart(fake_msg, is_auto=True)
        
        # ALWAYS schedule next post after auto posting, regardless of success/failure
        # This ensures tasks are never lost due to errors
        logger.info(f"AUTO_POST_CHART: Scheduling next post for group {group_id}")
        schedule_next_post(group_id)
        logger.info(f"AUTO_POST_CHART: Next post scheduled successfully for group {group_id}")
        
    except Exception as e:
        logger.error(f"Error in auto_post_chart for group {group_id}: {e}")

def initialize_scheduled_tasks():
    """Initialize scheduled tasks for all groups on bot startup"""
    try:
        logger.info("Starting initialization of scheduled tasks...")
        
        # Clear existing tasks
        task_count = task_manager.get_task_count()
        logger.info(f"Clearing {task_count} existing tasks from memory")
        task_manager.cancel_all_tasks()
        
        # Counter for created tasks
        task_counter = 0
        
        for filename in os.listdir(GROUPS_DIR):
            if not filename.endswith('.json'):
                continue
                
            # Skip backup files
            if filename.startswith('.backup_'):
                logger.debug(f"Skipping backup file: {filename}")
                continue
                
            try:
                # Extract group ID from filename
                group_id = filename[:-5]  # Remove .json
                
                # Check that group ID is a number
                if not group_id.startswith('-') and not group_id.isdigit():
                    logger.warning(f"Invalid group ID format in filename: {filename}")
                    continue
                    
                config = settings_manager.load_group_config(group_id)
                # Get duration from database
                group_data = db_manager.get_group_data(group_id)
                duration = group_data.get('duration', 0)
                
                # Migration: if values are default in DB but exist in JSON config, migrate them
                if config:
                    json_duration = config.get('duration', 0)
                    json_last_poster_time = config.get('last_poster_time', 0)
                    json_random_chart = config.get('random_chart', False)
                    json_free = config.get('free', False)
                    
                    # Migrate duration if needed
                    if duration == 0 and json_duration > 0:
                        logger.info(f"Migrating duration from JSON to DB for group {group_id}: {json_duration} hours")
                        db_manager.set_duration(group_id, json_duration)
                        duration = json_duration
                    
                    # Migrate last_poster_time if needed (and if DB has 0)
                    if json_last_poster_time > 0 and group_data.get('last_poster_time', 0) == 0:
                        logger.info(f"Migrating last_poster_time from JSON to DB for group {group_id}: {json_last_poster_time}")
                        db_manager.set_last_poster_time(group_id, json_last_poster_time)
                    
                    # Migrate random_chart if needed
                    if not group_data.get('random_chart', False) and json_random_chart:
                        logger.info(f"Migrating random_chart from JSON to DB for group {group_id}: {json_random_chart}")
                        db_manager.set_random_chart(group_id, json_random_chart)
                    
                    # Migrate free if needed
                    if not group_data.get('free', False) and json_free:
                        logger.info(f"Migrating free from JSON to DB for group {group_id}: {json_free}")
                        db_manager.set_free(group_id, json_free)
                    
                    # Migrate minimal_duration if needed
                    json_minimal_duration = config.get('minimal_duration', 2)
                    if group_data.get('minimal_duration', 2) == 2 and json_minimal_duration != 2:
                        logger.info(f"Migrating minimal_duration from JSON to DB for group {group_id}: {json_minimal_duration}")
                        db_manager.set_minimal_duration(group_id, json_minimal_duration)
                
                if duration > 0:
                    logger.info(f"Creating scheduled task for group {group_id} with duration {duration} hours")
                    schedule_next_post(group_id)
                    task_counter += 1
                else:
                    logger.debug(f"Skipping group {group_id}: duration is 0 or config not found")
            except ValueError as e:
                logger.warning(f"Invalid group configuration file: {filename}. Error: {e}")
                continue
            except Exception as e:
                logger.error(f"Error processing group file {filename}: {e}")
                continue
        
        logger.info(f"Initialization complete. Created {task_counter} scheduled tasks.")
        # Print list of active tasks after initialization
        print_active_tasks()
    except Exception as e:
        logger.error(f"Error initializing scheduled tasks: {e}")

@bot.message_handler(commands=['start', 'help'])
@retry_on_network_error
def send_welcome(message: Message):
    """Command handler for /start and /help"""
    if message.chat.type == 'private':
        user_id = message.from_user.id
        logger.info(f"User {user_id} requested groups list")
        
        # Get admin groups and log the result
        keyboard, text = settings_manager.create_group_menu(user_id)
        logger.info(f"Result for user {user_id}: {text}")
        
        # Add Help button
        help_keyboard = telebot.types.InlineKeyboardMarkup()
        help_keyboard.add(telebot.types.InlineKeyboardButton(
            text="📚 Help",
            url="https://tchart.xyz/help.html"
        ))
        
        welcome_text = (
            "🤖 Welcome to tChart Bot!\n\n"
            "This bot creates beautiful cryptocurrency charts with real-time data from various networks. "
            "Features include:\n"
            "• Real-time beautiful price charts\n"
            "• Multiple timeframe support\n"
            "• Customizable design\n"
            "• Automatic posting\n\n"
            "🌐 Visit our website: https://tchart.xyz\n\n"
        )
        
        try:
            if keyboard:
                # Add Help button to existing keyboard
                keyboard.add(telebot.types.InlineKeyboardButton(
                    text="📚 Help",
                    url="https://tchart.xyz/help.html"
                ))
                bot.send_message(message.chat.id, welcome_text + text, reply_markup=keyboard)
            else:
                # Send welcome message with help button
                bot.reply_to(
                    message, 
                    welcome_text + "You don't have any groups configured with this bot yet. "
                    "Add the bot to a group as an admin to start using it!",
                    reply_markup=help_keyboard
                )
        except ApiException as api_err:
            if "not enough rights" in str(api_err):
                logger.warning(f"Bot has no rights to send welcome message to user {user_id}")
            else:
                logger.error(f"Error sending welcome message: {api_err}")
                raise
    else:
        # In group chats send brief greeting and button to go to DM
        try:
            bot_username = bot.get_me().username
            help_keyboard = telebot.types.InlineKeyboardMarkup()
            help_keyboard.add(telebot.types.InlineKeyboardButton(
                text="📚 Help",
                url="https://tchart.xyz/help.html"
            ))
            help_keyboard.add(telebot.types.InlineKeyboardButton(
                text="🤖 Chat with Bot",
                url=f"https://t.me/{bot_username}?start=from_group"
            ))
            
            bot.reply_to(message, 
                        "👋 Hi! I'm a bot for generating cryptocurrency charts.\n"
                        "Add me to a group and use the /chart command to display a chart.",
                        reply_markup=help_keyboard)
        except ApiException as api_err:
            if "not enough rights" in str(api_err):
                logger.warning(f"Bot has no rights to send help message in group {message.chat.id}")
            else:
                logger.error(f"Error sending help message in group: {api_err}")
                raise

@bot.message_handler(content_types=['new_chat_members'])
@retry_on_network_error
def handle_new_chat_member(message: Message):
    """Handler for new chat member event"""
    try:
        for new_member in message.new_chat_members:
            if new_member.id == bot.get_me().id:
                group_id = message.chat.id
                group_name = message.chat.title
                
                if not settings_manager.load_group_config(group_id):
                    settings_manager.create_default_config(group_id, group_name)
                    
                    try:
                        bot.send_message(
                            message.chat.id,
                            f"👋 Thanks for adding me to the group!\n"
                            f"I've created a settings file for this group.\n"
                            f"Use the /chart command to display a chart."
                        )
                    except ApiException as api_err:
                        if "not enough rights" in str(api_err):
                            logger.warning(f"Bot has no rights to send welcome message in group {group_id}")
                        else:
                            logger.error(f"Error sending welcome message in group {group_id}: {api_err}")
                            raise
                else:
                    try:
                        bot.send_message(
                            message.chat.id,
                            f"👋 Glad to be back in this group!\n"
                            f"Use the /chart command to display a chart."
                        )
                    except ApiException as api_err:
                        if "not enough rights" in str(api_err):
                            logger.warning(f"Bot has no rights to send welcome back message in group {group_id}")
                        else:
                            logger.error(f"Error sending welcome back message in group {group_id}: {api_err}")
                            raise
                break
    except Exception as e:
        logger.error(f"Error handling new chat member: {e}")

@bot.message_handler(commands=['chart'])
@retry_on_network_error
def generate_chart(message: Message, is_auto=False):
    """Handler for /chart command"""
    try:
        if not is_auto and message.chat.type not in ['group', 'supergroup']:
            bot.reply_to(message, "This command only works in groups!")
            return
        
        group_id = message.chat.id
        
        config = settings_manager.load_group_config(group_id)
        if not config:
            config = settings_manager.create_default_config(group_id, message.chat.title)
            if not config:
                if not is_auto:
                    try:
                        bot.reply_to(message, "Failed to create group configuration. Try again later.")
                    except ApiException as api_err:
                        if "not enough rights" in str(api_err):
                            logger.warning(f"Bot has no rights to send messages in group {group_id}")
                            return
                        raise
                return
        
        # Get free status from database
        group_data_free = db_manager.get_group_data(group_id)
        use_free = group_data_free.get('free', False)
        
        # Set free in config for rendering (this ensures watermark display)
        config['free'] = use_free
        
        current_time = time.time()
        # Get last_poster_time from database (with migration from JSON if needed)
        group_data = db_manager.get_group_data(group_id)
        last_poster_time = group_data.get('last_poster_time', 0)
        
        # Migration check: if last_poster_time is 0 in DB, check JSON config (for existing groups)
        if last_poster_time == 0 and config:
            json_last_poster_time = config.get('last_poster_time', 0)
            if json_last_poster_time > 0:
                logger.info(f"Migrating last_poster_time from JSON to DB for group {group_id}: {json_last_poster_time}")
                db_manager.set_last_poster_time(group_id, json_last_poster_time)
                last_poster_time = json_last_poster_time
        # Get minimal_duration from database
        group_data_min = db_manager.get_group_data(group_id)
        minimal_duration = group_data_min.get('minimal_duration', 2)
        
        # Migration: if minimal_duration is default in DB but exists in JSON config, migrate it
        if config:
            json_minimal_duration = config.get('minimal_duration', 2)
            if minimal_duration == 2 and json_minimal_duration != 2:
                logger.info(f"Migrating minimal_duration from JSON to DB for group {group_id}: {json_minimal_duration}")
                db_manager.set_minimal_duration(group_id, json_minimal_duration)
                minimal_duration = json_minimal_duration
        
        # Check minimal duration between posts only for manual requests
        if not is_auto and minimal_duration > 0:
            time_since_last = current_time - last_poster_time
            if time_since_last < minimal_duration * 3600:
                remaining_time = int((minimal_duration * 3600 - time_since_last) / 60)
                try:
                    bot.reply_to(message, f"⏳ Next post will be available in {remaining_time} minutes")
                except ApiException as api_err:
                    if "not enough rights" in str(api_err):
                        logger.warning(f"Bot has no rights to send messages in group {group_id}")
                        return
                    raise
                return
        
        status_message = None
        if not is_auto:
            try:
                status_message = bot.reply_to(message, "🔄 Generating chart...")
            except ApiException as api_err:
                if "not enough rights" in str(api_err):
                    logger.warning(f"Bot has no rights to send messages in group {group_id}. Continuing without status message.")
                    # Continue without status message for auto posts
                else:
                    raise
        
        output_file = f"chart_{group_id}_{message.message_id}.jpg"
        
        # Get random_chart and free from database (with migration from JSON if needed)
        group_data = db_manager.get_group_data(group_id)
        use_random_chart = group_data.get('random_chart', False)
        use_free = group_data.get('free', False)
        
        # Migration: if random_chart or free is False in DB but exists in JSON config, migrate it
        if config:
            json_random_chart = config.get('random_chart', False)
            json_free = config.get('free', False)
            
            if not use_random_chart and json_random_chart:
                logger.info(f"Migrating random_chart from JSON to DB for group {group_id}: {json_random_chart}")
                db_manager.set_random_chart(group_id, json_random_chart)
                use_random_chart = json_random_chart
            
            if not use_free and json_free:
                logger.info(f"Migrating free from JSON to DB for group {group_id}: {json_free}")
                db_manager.set_free(group_id, json_free)
                use_free = json_free
        
        logger.info(f"Group {group_id}: random_chart = {use_random_chart}, free = {use_free} (from DB)")
        final_config = config
        updated_config = config  # Will contain used_presets if random chart is used
        
        if use_random_chart:
            logger.info(f"Random chart enabled for group {group_id}, selecting next preset...")
            try:
                # Get next preset in round-robin fashion
                logger.info(f"Calling get_next_random_preset for group {group_id}")
                preset_name, updated_config = get_next_random_preset(config, script_dir=SCRIPT_DIR)
                logger.info(f"get_next_random_preset returned: preset_name={preset_name}, updated_config keys: {list(updated_config.keys())[:10]}")
                
                if preset_name:
                    logger.info(f"✅ Selected preset: {preset_name}")
                    
                    # Load preset configuration
                    logger.info(f"Loading preset configuration for '{preset_name}'...")
                    preset_config = load_preset_config(preset_name, script_dir=SCRIPT_DIR)
                    
                    if preset_config:
                        logger.info(f"✅ Preset '{preset_name}' loaded successfully")
                        logger.info(f"Preset config keys: {list(preset_config.keys())[:15]}")
                        logger.info(f"Preset network: {preset_config.get('network')}, poolAddress: {preset_config.get('poolAddress')}")
                        
                        # Merge preset with group config (preset settings take priority)
                        final_config = merge_preset_with_group_config(preset_config, updated_config)
                        logger.info(f"✅ Preset '{preset_name}' merged with group config")
                        logger.info(f"FINAL CONFIG - network: {final_config.get('network')}, poolAddress: {final_config.get('poolAddress')}, interval: {final_config.get('interval')}")
                        logger.info(f"PRESET CONFIG - network: {preset_config.get('network')}, poolAddress: {preset_config.get('poolAddress')}, interval: {preset_config.get('interval')}")
                        logger.info(f"GROUP CONFIG - network: {config.get('network')}, poolAddress: {config.get('poolAddress')}, interval: {config.get('interval')}")
                    else:
                        logger.error(f"❌ Failed to load preset '{preset_name}', using group config")
                        final_config = updated_config
                else:
                    logger.error("❌ No preset selected by get_next_random_preset, using group config")
                    final_config = updated_config
            except Exception as e:
                logger.error(f"❌ Error using random chart: {e}")
                logger.exception("Full traceback:")
                # Fall back to regular config if random chart fails
                final_config = config
                updated_config = config
        else:
            logger.debug(f"Random chart disabled for group {group_id}, using group config")
        
        network = final_config.get("network", "polygon_pos")
        pool_address = final_config.get("poolAddress")
        interval = final_config.get("interval", "1h")
        
        if not pool_address:
            error_msg = "⚠️ Pool address not specified in configuration! Update the configuration file."
            if status_message:
                try:
                    bot.edit_message_text(error_msg, message.chat.id, status_message.message_id)
                except ApiException as api_err:
                    if "not enough rights" in str(api_err):
                        logger.warning(f"Bot has no rights to edit messages in group {group_id}")
                    else:
                        logger.error(f"Error editing status message: {api_err}")
            else:
                logger.error(f"Pool address not specified for group {group_id}")
            return
        
        ohlcv_data = fetch_grouped_ohlcv(network, pool_address, interval, final_config.get("numBars", 20))
        if not ohlcv_data:
            error_msg = "⚠️ Failed to get chart data. Check settings and API availability."
            if status_message:
                try:
                    bot.edit_message_text(error_msg, message.chat.id, status_message.message_id)
                except ApiException as api_err:
                    if "not enough rights" in str(api_err):
                        logger.warning(f"Bot has no rights to edit messages in group {group_id}")
                    else:
                        logger.error(f"Error editing status message: {api_err}")
            else:
                logger.error(f"Failed to get chart data for group {group_id}")
            return
        
        token_info = fetch_pool_info(network, pool_address)
        if not token_info:
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
        
        logger.info(f"[RENDER] Rendering chart for group {group_id}")
        logger.info(f"[RENDER] Final config - Network: {final_config.get('network')}, poolAddress: {final_config.get('poolAddress')}, interval: {final_config.get('interval')}")
        logger.debug(f"[RENDER] Final config keys (first 15): {list(final_config.keys())[:15]}")
        if use_random_chart:
            logger.info(f"[RENDER] Random chart is ENABLED - should use preset settings")
        else:
            logger.info(f"[RENDER] Random chart is DISABLED - using group config")
        
        if render_chart(final_config, ohlcv_data, token_info, output_file):
            try:
                with open(output_file, 'rb') as photo:
                    bot.send_photo(message.chat.id, photo)
                
                # Save last_poster_time to database
                db_manager.set_last_poster_time(group_id, current_time)
                
                # If random chart was used, save group metadata (not preset settings)
                if use_random_chart:
                    if 'random_chart_used_presets' in updated_config:
                        config['random_chart_used_presets'] = updated_config['random_chart_used_presets']
                    settings_manager.save_group_config(group_id, config)
                else:
                    settings_manager.save_group_config(group_id, config)
                
                # Schedule next post ONLY for manual posts (auto posts are handled in auto_post_chart)
                # Check duration from database
                group_data = db_manager.get_group_data(group_id)
                if group_data.get('duration', 0) > 0 and not is_auto:
                    schedule_next_post(group_id)
                
                if status_message:
                    try:
                        bot.delete_message(message.chat.id, status_message.message_id)
                    except ApiException as api_err:
                        if "not enough rights" in str(api_err):
                            logger.warning(f"Bot has no rights to delete messages in group {group_id}")
                        else:
                            logger.error(f"Error deleting status message: {api_err}")
                
                try:
                    os.remove(output_file)
                    logger.info(f"File {output_file} deleted")
                except Exception as e:
                    logger.error(f"Error deleting file {output_file}: {e}")
                    
            except ApiException as api_err:
                if "not enough rights" in str(api_err):
                    logger.error(f"Bot has no rights to send photos in group {group_id}")
                    if status_message:
                        try:
                            bot.edit_message_text(
                                "⚠️ Bot doesn't have permission to send images in this chat. Please grant the bot permission to send messages and media.",
                                message.chat.id,
                                status_message.message_id
                            )
                        except ApiException:
                            logger.warning(f"Could not even edit status message in group {group_id}")
                else:
                    raise
        else:
            error_msg = "⚠️ Failed to generate chart. Check settings and API availability."
            if status_message:
                try:
                    bot.edit_message_text(error_msg, message.chat.id, status_message.message_id)
                except ApiException as api_err:
                    if "not enough rights" in str(api_err):
                        logger.warning(f"Bot has no rights to edit messages in group {group_id}")
                    else:
                        logger.error(f"Error editing status message: {api_err}")
            else:
                logger.error(f"Failed to generate chart for group {group_id}")
            
    except Exception as e:
        logger.error(f"Error generating chart: {e}")
        if not is_auto:
            try:
                bot.reply_to(message, f"⚠️ An error occurred while generating the chart: {str(e)}")
            except ApiException as api_err:
                if "not enough rights" in str(api_err):
                    logger.warning(f"Bot has no rights to send error message in group {group_id}")
                else:
                    logger.error(f"Error sending error message: {api_err}")
            except Exception:
                logger.error("Could not send error message to user")

@bot.callback_query_handler(func=lambda call: call.data.startswith('group_'))
def handle_group_selection(call):
    """Handler for group selection"""
    settings_manager.handle_group_selection(call)

@bot.callback_query_handler(func=lambda call: call.data.startswith('import_'))
def handle_import_config(call):
    """Handler for configuration import"""
    settings_manager.handle_import_config(call)

@bot.callback_query_handler(func=lambda call: call.data.startswith('duration_'))
def handle_duration_setting(call):
    """Handler for duration setting"""
    settings_manager.handle_duration_setting(call)

@bot.callback_query_handler(func=lambda call: call.data.startswith('web_edit_'))
def handle_web_edit(call):
    """Handler for web editing"""
    settings_manager.handle_web_edit(call)

@bot.callback_query_handler(func=lambda call: call.data.startswith('min_duration_'))
def handle_min_duration_setting(call):
    """Handler for minimal duration setting (superuser only)"""
    settings_manager.handle_min_duration_setting(call)

@bot.callback_query_handler(func=lambda call: call.data.startswith('free_status_'))
def handle_free_status(call):
    """Handler for free status (superuser only)"""
    settings_manager.handle_free_status(call)

@bot.callback_query_handler(func=lambda call: call.data.startswith('set_free_'))
def handle_set_free_status(call):
    """Handler for setting free status (superuser only)"""
    settings_manager.handle_set_free_status(call)

@bot.callback_query_handler(func=lambda call: call.data.startswith('random_chart_status_'))
def handle_random_chart_status(call):
    """Handler for random chart status (superuser only)"""
    settings_manager.handle_random_chart_status(call)

@bot.callback_query_handler(func=lambda call: call.data.startswith('set_random_chart_'))
def handle_set_random_chart(call):
    """Handler for setting random chart status (superuser only)"""
    settings_manager.handle_set_random_chart(call)

@bot.message_handler(commands=['test_api'])
def test_api_command(message: Message):
    """Command to test API connectivity"""
    try:
        try:
            bot.reply_to(message, "Testing API connection...")
        except ApiException as api_err:
            if "not enough rights" in str(api_err):
                logger.warning(f"Bot has no rights to send test message to user {message.from_user.id}")
                return
            raise
        
        # Create test data
        group_id = "test_api"
        admin_id = message.from_user.id
        
        # Check if configuration exists, if not - create it
        config = settings_manager.load_group_config(group_id)
        if not config:
            try:
                bot.send_message(message.chat.id, "Creating test configuration...")
            except ApiException as api_err:
                if "not enough rights" in str(api_err):
                    logger.warning(f"Bot has no rights to send config creation message to user {message.from_user.id}")
                    return
                raise
                    
            config = settings_manager.create_default_config(group_id, "Test API Group")
            if not config:
                try:
                    bot.reply_to(message, "❌ Failed to create test configuration!")
                except ApiException as api_err:
                    if "not enough rights" in str(api_err):
                        logger.warning(f"Bot has no rights to send error message to user {message.from_user.id}")
                    else:
                        logger.error(f"Error sending error message: {api_err}")
                return
        
        # Get access token
        token, url = settings_manager.get_access_token(group_id, admin_id)
        
        if token and url:
            # Create keyboard with editor open button
            keyboard = telebot.types.InlineKeyboardMarkup()
            keyboard.add(telebot.types.InlineKeyboardButton(
                text="🌐 Open Web Editor",
                url=url
            ))
            
            try:
                bot.send_message(
                    message.chat.id,
                    f"✅ API connection successful!\nToken: {token[:10]}...\nGroup ID: {group_id}\nClick the button below to open the web editor.",
                    reply_markup=keyboard
                )
            except ApiException as api_err:
                if "not enough rights" in str(api_err):
                    logger.warning(f"Bot has no rights to send success message to user {message.from_user.id}")
                else:
                    logger.error(f"Error sending success message: {api_err}")
                    raise
        else:
            try:
                bot.reply_to(message, f"❌ Failed to connect to API. Check server logs. Group ID: {group_id}")
            except ApiException as api_err:
                if "not enough rights" in str(api_err):
                    logger.warning(f"Bot has no rights to send API failure message to user {message.from_user.id}")
                else:
                    logger.error(f"Error sending API failure message: {api_err}")
    except Exception as e:
        logger.error(f"Error testing API: {e}")
        logger.exception("Full exception details:")
        try:
            bot.reply_to(message, f"❌ An error occurred: {str(e)}")
        except ApiException as api_err:
            if "not enough rights" in str(api_err):
                logger.warning(f"Bot has no rights to send exception message to user {message.from_user.id}")
            else:
                logger.error(f"Error sending exception message: {api_err}")

@bot.message_handler(commands=['allmenu'])
def all_groups_menu(message: Message):
    """Command to show all groups for superuser"""
    try:
        # Check if user is superuser
        if message.from_user.username != SUPER_USER_ID:
            try:
                bot.reply_to(message, "❌ This command is only available to the superuser.")
            except ApiException as api_err:
                if "not enough rights" in str(api_err):
                    logger.warning(f"Bot has no rights to send superuser error to user {message.from_user.id}")
                else:
                    logger.error(f"Error sending superuser error: {api_err}")
            return
            
        try:
            bot.reply_to(message, "🔍 Fetching list of all groups...")
        except ApiException as api_err:
            if "not enough rights" in str(api_err):
                logger.warning(f"Bot has no rights to send fetching message to superuser {message.from_user.id}")
                return
            raise
        
        # Get list of all groups (for superuser, admin check is skipped)
        admin_groups = settings_manager.get_user_admin_groups(message.from_user.id)
        
        if not admin_groups:
            try:
                bot.reply_to(message, "⚠️ No groups found.")
            except ApiException as api_err:
                if "not enough rights" in str(api_err):
                    logger.warning(f"Bot has no rights to send no groups message to superuser {message.from_user.id}")
                else:
                    logger.error(f"Error sending no groups message: {api_err}")
            return
            
        # Create group selection menu
        keyboard, text = settings_manager.create_group_menu(message.from_user.id)
        
        if keyboard:
            try:
                bot.send_message(
                    message.chat.id,
                    f"👑 Superuser access: {len(admin_groups)} groups found.\nSelect a group to configure:",
                    reply_markup=keyboard
                )
            except ApiException as api_err:
                if "not enough rights" in str(api_err):
                    logger.warning(f"Bot has no rights to send groups list to superuser {message.from_user.id}")
                else:
                    logger.error(f"Error sending groups list: {api_err}")
        else:
            try:
                bot.reply_to(message, f"⚠️ {text}")
            except ApiException as api_err:
                if "not enough rights" in str(api_err):
                    logger.warning(f"Bot has no rights to send groups text to superuser {message.from_user.id}")
                else:
                    logger.error(f"Error sending groups text: {api_err}")
    except Exception as e:
        logger.error(f"Error in all_groups_menu: {e}")
        logger.exception("Full exception details:")
        try:
            bot.reply_to(message, f"❌ An error occurred: {str(e)}")
        except ApiException as api_err:
            if "not enough rights" in str(api_err):
                logger.warning(f"Bot has no rights to send allmenu exception to superuser {message.from_user.id}")
            else:
                logger.error(f"Error sending allmenu exception: {api_err}")

@bot.message_handler(commands=['tasks'])
def show_active_tasks(message: Message):
    """Command to show active tasks for superuser"""
    try:
        # Check if user is superuser
        if message.from_user.username != SUPER_USER_ID:
            try:
                bot.reply_to(message, "❌ This command is only available to the superuser.")
            except ApiException as api_err:
                if "not enough rights" in str(api_err):
                    logger.warning(f"Bot has no rights to send superuser error to user {message.from_user.id}")
                else:
                    logger.error(f"Error sending superuser error: {api_err}")
            return
            
        active_tasks = task_manager.get_active_tasks()
        
        if not active_tasks:
            try:
                bot.reply_to(message, "📝 No active scheduled tasks found.")
            except ApiException as api_err:
                if "not enough rights" in str(api_err):
                    logger.warning(f"Bot has no rights to send no tasks message to superuser {message.from_user.id}")
                else:
                    logger.error(f"Error sending no tasks message: {api_err}")
            return
            
        response = "📋 Active scheduled tasks:\n\n"
        for group_id, next_run_time in active_tasks.items():
            next_run_dt = datetime.fromtimestamp(next_run_time)
            time_until = next_run_dt - datetime.now()
            
            hours = int(time_until.total_seconds() // 3600)
            minutes = int((time_until.total_seconds() % 3600) // 60)
            
            # Load group configuration for additional info
            config = settings_manager.load_group_config(group_id)
            group_name = "Unknown Group"
            duration = "N/A"
            min_duration = "N/A"
            
            # Get duration from database
            group_data = db_manager.get_group_data(group_id)
            db_duration = group_data.get('duration', 0)
            
            if config:
                # Group name is stored in 'name' field, not 'group_name'
                group_name = config.get('name', f'Group {group_id}')
                duration = f"{db_duration}h" if db_duration > 0 else "N/A"
                min_duration = f"{config.get('minimal_duration', 2)}h"
                
                # Try to get actual group name from Telegram API if available
                try:
                    chat = bot.get_chat(group_id)
                    if chat.title and chat.title != group_name:
                        group_name = chat.title
                        # Update config with new name
                        config['name'] = group_name
                        settings_manager.save_group_config(group_id, config)
                except Exception:
                    # If we can't get chat info, use stored name
                    pass
            
            # Truncate group name if too long
            if len(group_name) > 30:
                group_name = group_name[:27] + "..."
            
            response += f"🔸 **{group_name}** (ID: {group_id})\n"
            response += f"   📊 Duration: {duration} | Min: {min_duration}\n"
            response += f"   ⏰ Next run: {next_run_dt.strftime('%Y-%m-%d %H:%M:%S')}\n"
            response += f"   ⏱️ Time until: {hours}h {minutes}m\n\n"
        
        response += f"📈 Total active tasks: {len(active_tasks)}"
        
        try:
            bot.reply_to(message, response)
        except ApiException as api_err:
            if "not enough rights" in str(api_err):
                logger.warning(f"Bot has no rights to send tasks list to superuser {message.from_user.id}")
            else:
                logger.error(f"Error sending tasks list: {api_err}")
        
        # Also print to log for debugging
        print_active_tasks()
        
    except Exception as e:
        logger.error(f"Error in show_active_tasks: {e}")
        logger.exception("Full exception details:")
        try:
            bot.reply_to(message, f"❌ An error occurred: {str(e)}")
        except ApiException as api_err:
            if "not enough rights" in str(api_err):
                logger.warning(f"Bot has no rights to send tasks exception to superuser {message.from_user.id}")
            else:
                logger.error(f"Error sending tasks exception: {api_err}")


@bot.message_handler(commands=['cleantasks'])
def clean_all_tasks(message: Message):
    """Command to clean all tasks for superuser"""
    try:
        # Check if user is superuser
        if message.from_user.username != SUPER_USER_ID:
            try:
                bot.reply_to(message, "❌ This command is only available to the superuser.")
            except ApiException as api_err:
                if "not enough rights" in str(api_err):
                    logger.warning(f"Bot has no rights to send superuser error to user {message.from_user.id}")
                else:
                    logger.error(f"Error sending superuser error: {api_err}")
            return
            
        old_count = task_manager.get_task_count()
        task_manager.cancel_all_tasks()
        
        try:
            bot.reply_to(message, f"✅ Cleared {old_count} scheduled tasks.\nBot will reinitialize tasks on next restart.")
        except ApiException as api_err:
            if "not enough rights" in str(api_err):
                logger.warning(f"Bot has no rights to send clean tasks result to superuser {message.from_user.id}")
            else:
                logger.error(f"Error sending clean tasks result: {api_err}")
        
        logger.info(f"Superuser {message.from_user.username} cleared all {old_count} tasks")
        
    except Exception as e:
        logger.error(f"Error in clean_all_tasks: {e}")
        logger.exception("Full exception details:")
        try:
            bot.reply_to(message, f"❌ An error occurred: {str(e)}")
        except ApiException as api_err:
            if "not enough rights" in str(api_err):
                logger.warning(f"Bot has no rights to send cleantasks exception to superuser {message.from_user.id}")
            else:
                logger.error(f"Error sending cleantasks exception: {api_err}")

@bot.my_chat_member_handler()
def handle_my_chat_member(message: Message):
    """Handler for bot status changes in groups"""
    settings_manager.handle_bot_status_change(message)

@bot.message_handler(content_types=['document'])
def handle_document(message: Message):
    """Handler for document messages (including JSON files)"""
    try:
        logger.info(f"Received document: {message.document.file_name} from user {message.from_user.id} in chat {message.chat.id}")
        
        # Check if the file is a JSON file
        if message.document.file_name.endswith('.json'):
            logger.info("JSON file detected, checking for pending import operations")
            
            # Try to find a group ID that this user might be trying to import for
            user_id = message.from_user.id
            admin_groups = settings_manager.get_user_admin_groups(user_id)
            
            # If user is admin in only one group, use that group ID
            if len(admin_groups) == 1:
                group_id = admin_groups[0]['id']
                logger.info(f"User is admin in only one group, using group_id: {group_id}")
                settings_manager.process_import_file(message, group_id)
            elif len(admin_groups) > 1:
                # If user is admin in multiple groups, ask them to specify which group
                logger.info(f"User is admin in multiple groups: {[g['id'] for g in admin_groups]}")
                
                # Create keyboard with group selection
                keyboard = telebot.types.InlineKeyboardMarkup()
                for group in admin_groups:
                    keyboard.add(telebot.types.InlineKeyboardButton(
                        text=f"{group['name']} ({group['id']})",
                        callback_data=f"import_json_{group['id']}"
                    ))
                
                try:
                    bot.send_message(
                        message.chat.id,
                        "Please select the group to import settings for:",
                        reply_markup=keyboard
                    )
                except ApiException as api_err:
                    if "not enough rights" in str(api_err):
                        logger.warning(f"Bot has no rights to send group selection message to user {message.from_user.id}")
                    else:
                        logger.error(f"Error sending group selection message: {api_err}")
                        raise
            else:
                logger.warning(f"User {user_id} is not an admin in any group")
                try:
                    bot.reply_to(message, "You don't have admin rights in any group.")
                except ApiException as api_err:
                    if "not enough rights" in str(api_err):
                        logger.warning(f"Bot has no rights to send admin rights message to user {message.from_user.id}")
                    else:
                        logger.error(f"Error sending admin rights message: {api_err}")
        
        # Documents are processed via register_next_step_handler in settings_manager.py
        # This handler is only needed for logging and fallback processing
    except Exception as e:
        logger.error(f"Error handling document: {e}")
        try:
            bot.reply_to(message, f"❌ Error processing document: {str(e)}")
        except ApiException as api_err:
            if "not enough rights" in str(api_err):
                logger.warning(f"Bot has no rights to send document error message to user {message.from_user.id}")
            else:
                logger.error(f"Error sending document error message: {api_err}")

@bot.callback_query_handler(func=lambda call: call.data.startswith('import_json_'))
def handle_import_json_selection(call):
    """Handler for JSON import group selection"""
    try:
        logger.info(f"JSON import group selection: {call.data}")
        group_id = call.data.split('_')[2]
        
        # Get the last message from the user with a document
        chat_id = call.message.chat.id
        user_id = call.from_user.id
        
        bot.answer_callback_query(call.id, "Processing your request...")
        try:
            bot.edit_message_text(
                f"Processing JSON import for group {group_id}. Please wait...",
                chat_id,
                call.message.message_id
            )
        except ApiException as api_err:
            if "not enough rights" in str(api_err):
                logger.warning(f"Bot has no rights to edit processing message for user {user_id}")
            else:
                logger.error(f"Error editing processing message: {api_err}")
                raise
        
        # Find the most recent message with a JSON document from this user
        messages = bot.get_updates()
        json_message = None
        
        for update in reversed(messages):
            if hasattr(update, 'message') and update.message and \
               update.message.from_user.id == user_id and \
               hasattr(update.message, 'document') and update.message.document and \
               update.message.document.file_name.endswith('.json'):
                json_message = update.message
                break
        
        if json_message:
            logger.info(f"Found JSON message: {json_message.document.file_name}")
            settings_manager.process_import_file(json_message, group_id)
            
            # Delete the selection message
            try:
                bot.delete_message(chat_id, call.message.message_id)
            except ApiException as api_err:
                if "not enough rights" in str(api_err):
                    logger.warning(f"Bot has no rights to delete selection message for user {user_id}")
                else:
                    logger.error(f"Error deleting selection message: {api_err}")
        else:
            logger.warning("No recent JSON message found")
            try:
                bot.edit_message_text(
                    "No JSON file found. Please upload the file again.",
                    chat_id,
                    call.message.message_id
                )
            except ApiException as api_err:
                if "not enough rights" in str(api_err):
                    logger.warning(f"Bot has no rights to edit no file message for user {user_id}")
                else:
                    logger.error(f"Error editing no file message: {api_err}")
    except Exception as e:
        logger.error(f"Error handling JSON import selection: {e}")
        bot.answer_callback_query(call.id, "An error occurred while processing your request")

# Initialize scheduled tasks on bot startup
initialize_scheduled_tasks()

# Create main bot menu (command buttons)
@retry_on_network_error
def setup_bot_commands():
    """Configure bot commands menu"""
    try:
        # Commands for private chats
        bot.set_my_commands([
            telebot.types.BotCommand('start', 'Start the bot')
        ], scope=telebot.types.BotCommandScopeAllPrivateChats())
        
        # Commands for group chats
        bot.set_my_commands([
            telebot.types.BotCommand('help', 'Get help and set up'),
            telebot.types.BotCommand('chart', 'Generate a chart')
        ], scope=telebot.types.BotCommandScopeAllGroupChats())
        
        logger.info("Bot commands menu has been configured")
    except Exception as e:
        logger.error(f"Error configuring bot commands: {e}")

if __name__ == "__main__":
    logger.info("Bot started...")
    
    while True:
        try:
            # Configure bot commands menu
            setup_bot_commands()
            
            # Start bot with error handling
            bot.polling(none_stop=True, interval=3, timeout=30)
        except NETWORK_ERRORS as e:
            logger.error(f"Network error in bot operation: {e}")
            # Cancel all scheduled tasks before restart
            task_manager.cancel_all_tasks()
            # Reinitialize scheduled tasks
            initialize_scheduled_tasks()
            # Wait before reconnecting
            time.sleep(RETRY_DELAY)
            continue
        except Exception as e:
            logger.error(f"Critical error in bot operation: {e}")
            # Cancel all scheduled tasks on exit
            task_manager.cancel_all_tasks()
            break  # Exit on non-network errors 