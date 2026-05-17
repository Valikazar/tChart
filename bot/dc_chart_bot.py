#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import json
import discord
import logging
import time
import asyncio
import threading
import requests.exceptions
from datetime import datetime, timedelta
from discord.ext import commands, tasks
from chart_generator import load_config, fetch_grouped_ohlcv, fetch_pool_info, render_chart
from dc_settings_manager import SettingsManager, SUPER_USER_ID
from db_manager import db_manager

class TaskManager:
    """Менеджер для управления запланированными задачами"""
    def __init__(self):
        self._tasks = {}
        self._lock = threading.RLock()
        self._main_loop = None  # Сохранение ссылки на основной event loop
    
    def set_main_loop(self, loop):
        """Устанавливает основной event loop"""
        self._main_loop = loop
        logger.debug(f"Main event loop set: {loop}")
    
    def schedule_task(self, guild_id, delay, target_func, *args):
        """Запланировать задачу для сервера"""
        # Приводим guild_id к строковому типу для консистентности
        guild_id = str(guild_id)
        
        with self._lock:
            logger.debug(f"=== SCHEDULING TASK FOR GUILD {guild_id} ===")
            logger.debug(f"Tasks before cleanup: {list(self._tasks.keys())}")
            
            # РАДИКАЛЬНО: сначала отменяем ВСЕ задачи для сервера
            self._hard_cancel_guild_tasks(guild_id)
            
            logger.debug(f"Tasks after hard cancel: {list(self._tasks.keys())}")
            
            # Дополнительная проверка - убеждаемся, что сервера нет в словаре
            if guild_id in self._tasks:
                logger.warning(f"Guild {guild_id} still in tasks after cancellation, force removing")
                del self._tasks[guild_id]
            
            logger.debug(f"Tasks after final check: {list(self._tasks.keys())}")
            
            # Создаем новую задачу
            timer = threading.Timer(delay, self._task_wrapper, args=(guild_id, target_func, args))
            timer.start_time = time.time()
            timer.interval = delay
            timer.guild_id = guild_id
            timer.start()
            
            # Сохраняем задачу с сервером в виде строки
            self._tasks[guild_id] = timer
            
            logger.debug(f"Tasks after adding new task: {list(self._tasks.keys())}")
            logger.info(f"Scheduled task for guild {guild_id} in {delay/3600:.2f} hours")
            logger.debug(f"TaskManager now has {len(self._tasks)} tasks")
            logger.debug(f"=== END SCHEDULING FOR GUILD {guild_id} ===")
    
    def _hard_cancel_guild_tasks(self, guild_id):
        """Жестко отменить ВСЕ задачи для сервера"""
        # Приводим guild_id к строковому типу
        guild_id = str(guild_id)
        logger.debug(f"Hard cancel called for guild {guild_id}")
        
        # Сначала отменяем задачу если она есть
        if guild_id in self._tasks:
            task = self._tasks[guild_id]
            logger.debug(f"Hard cancelling task for guild {guild_id}")
            if task and hasattr(task, 'cancel'):
                try:
                    task.cancel()
                    logger.debug(f"Task for guild {guild_id} cancelled successfully")
                except Exception as e:
                    logger.warning(f"Error cancelling task for guild {guild_id}: {e}")
            # Удаляем из словаря
            del self._tasks[guild_id]
            logger.debug(f"Removed guild {guild_id} from tasks dictionary")
        else:
            logger.debug(f"No existing task found for guild {guild_id}")
        
        # Дополнительная проверка: ищем все задачи с таким же guild_id (на случай ошибки)
        keys_to_remove = []
        for key, task in self._tasks.items():
            if str(key) == str(guild_id) or (hasattr(task, 'guild_id') and str(task.guild_id) == str(guild_id)):
                logger.debug(f"Found task with matching guild_id: {key}")
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
    
    def _task_wrapper(self, guild_id, target_func, args):
        """Обертка для выполнения задачи с автоматической очисткой"""
        # Приводим guild_id к строковому типу
        guild_id = str(guild_id)
        try:
            logger.debug(f"Executing scheduled task for guild {guild_id}")
            
            # Проверяем, что у нас есть ссылка на основной event loop
            if self._main_loop is None:
                logger.error(f"Main event loop not set! Cannot execute task for guild {guild_id}")
                return
                
            # Используем основной event loop для выполнения асинхронной функции
            if self._main_loop.is_running():
                logger.debug(f"Main loop is running, executing task for guild {guild_id}")
                future = asyncio.run_coroutine_threadsafe(target_func(*args), self._main_loop)
                try:
                    future.result(timeout=30)  # 30 секунд таймаут
                    logger.debug(f"Task for guild {guild_id} completed successfully")
                except Exception as e:
                    logger.error(f"Error waiting for task result for guild {guild_id}: {e}")
                    logger.exception("Task execution error:")
            else:
                logger.error(f"Main event loop is not running for guild {guild_id}")
        except Exception as e:
            logger.error(f"Error in task execution for guild {guild_id}: {e}")
            logger.exception("Task wrapper error:")
        finally:
            # Автоматически удаляем задачу после выполнения
            with self._lock:
                if guild_id in self._tasks:
                    del self._tasks[guild_id]
                    logger.debug(f"Task for guild {guild_id} completed and removed")
    
    def cancel_task(self, guild_id):
        """Отменить задачу для сервера"""
        guild_id = str(guild_id)
        with self._lock:
            self._hard_cancel_guild_tasks(guild_id)
    
    def cancel_all_tasks(self):
        """Отменить все задачи"""
        with self._lock:
            logger.debug(f"Cancelling all {len(self._tasks)} tasks")
            for guild_id in list(self._tasks.keys()):
                self._hard_cancel_guild_tasks(str(guild_id))
            # Дополнительная очистка
            self._tasks.clear()
            logger.debug("All tasks cancelled and dictionary cleared")
    
    def get_active_tasks(self):
        """Получить список активных задач без дубликатов"""
        with self._lock:
            # Сначала очищаем неактивные задачи
            self._cleanup_dead_tasks()
            
            # Создаем словарь активных задач, гарантируя уникальность
            active_tasks = {}
            
            for guild_id, task in list(self._tasks.items()):
                guild_id = str(guild_id)  # Приводим к строке
                if task and task.is_alive():
                    try:
                        next_run = task.start_time + task.interval
                        # Проверяем на дубликаты и берем только первую найденную задачу
                        if guild_id not in active_tasks:
                            active_tasks[guild_id] = next_run
                        else:
                            # Если дубликат найден, отменяем текущую задачу
                            logger.error(f"DUPLICATE FOUND for guild {guild_id}! Cancelling duplicate task.")
                            task.cancel()
                            del self._tasks[guild_id]
                    except AttributeError:
                        logger.warning(f"Task for guild {guild_id} missing attributes, removing")
                        if hasattr(task, 'cancel'):
                            task.cancel()
                        del self._tasks[guild_id]
                else:
                    # Удаляем мертвые задачи
                    logger.debug(f"Removing dead task for guild {guild_id}")
                    del self._tasks[guild_id]
            
            return active_tasks
    
    def _cleanup_dead_tasks(self):
        """Очистить мертвые задачи"""
        dead_guilds = []
        for guild_id, task in self._tasks.items():
            if not task or not task.is_alive():
                dead_guilds.append(guild_id)
        
        for guild_id in dead_guilds:
            logger.debug(f"Cleaning up dead task for guild {guild_id}")
            del self._tasks[guild_id]
    
    def get_task_count(self):
        """Получить количество активных задач"""
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
    config_path = os.path.join(SCRIPT_DIR, 'dc_config_bot.json')
    with open(config_path, 'r', encoding='utf-8') as f:
        bot_config = json.load(f)
    
    BOT_TOKEN = bot_config.get('bot_token')
    APPLICATION_ID = bot_config.get('application_id')
    if not BOT_TOKEN:
        raise ValueError("Bot token not found in configuration")
except Exception as e:
    logger.error(f"Error loading bot configuration: {e}")
    exit(1)

# Bot initialization
intents = discord.Intents.default()
intents.message_content = True
intents.guilds = True
intents.members = True

bot = commands.Bot(command_prefix='!', intents=intents, application_id=APPLICATION_ID)

# Create folder for guild configurations
GUILDS_DIR = os.path.join(SCRIPT_DIR, 'dc_groups')
settings_manager = SettingsManager(bot, GUILDS_DIR)

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
    discord.errors.HTTPException
)

def retry_on_network_error(func):
    """Decorator for retrying functions on network errors"""
    async def wrapper(*args, **kwargs):
        retries = 0
        while retries < MAX_RETRIES:
            try:
                return await func(*args, **kwargs)
            except NETWORK_ERRORS as e:
                retries += 1
                if retries == MAX_RETRIES:
                    logger.error(f"Failed after {MAX_RETRIES} retries: {e}")
                    raise
                logger.warning(f"Network error: {e}. Retry {retries}/{MAX_RETRIES} in {RETRY_DELAY} seconds...")
                await asyncio.sleep(RETRY_DELAY)
    return wrapper

def print_active_tasks():
    """Выводит список активных задач в лог"""
    logger.debug("=== Active scheduled tasks ===")
    
    # Принудительно очищаем дубликаты перед выводом
    active_tasks = task_manager.get_active_tasks()
    
    # Проверяем на дубликаты
    seen_guilds = set()
    duplicates_found = False
    
    if active_tasks:
        for guild_id, next_run_time in active_tasks.items():
            if guild_id in seen_guilds:
                logger.error(f"DUPLICATE DETECTED: Guild {guild_id} has multiple tasks!")
                duplicates_found = True
                # Принудительно отменяем дубликат
                task_manager.cancel_task(guild_id)
            seen_guilds.add(guild_id)
            
            next_run_dt = datetime.fromtimestamp(next_run_time)
            logger.debug(f"Guild {guild_id}: next run at {next_run_dt}")
    else:
        logger.debug("No active tasks")
    
    if duplicates_found:
        logger.error("DUPLICATE TASKS DETECTED! Force cancelling duplicates.")
        # Повторно получаем активные задачи после очистки
        active_tasks = task_manager.get_active_tasks()
        logger.debug(f"After cleanup: {len(active_tasks)} tasks remain")
    
    logger.debug(f"Total tasks: {len(active_tasks)}")
    logger.debug("===")

def schedule_next_post(guild_id, config):
    """Schedule next automatic post for the guild"""
    try:
        # Validate guild_id
        try:
            int(guild_id)
        except ValueError:
            logger.error(f"Invalid guild ID format in schedule_next_post: {guild_id}")
            return
            
        duration = config.get('duration', 0)
        last_poster_time = config.get('last_poster_time', 0)
        
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
        task_manager.schedule_task(guild_id, delay, auto_post_chart, guild_id)
        
        logger.info(f"Scheduled next post for guild {guild_id} in {delay/3600:.2f} hours")
        print_active_tasks()  # Выводим список активных задач
    except Exception as e:
        logger.error(f"Error in schedule_next_post for guild {guild_id}: {e}")

@retry_on_network_error
async def auto_post_chart(guild_id):
    """Automatically post chart for the guild"""
    try:
        logger.info(f"=== AUTO_POST_CHART STARTED for guild {guild_id} ===")
        
        # Проверяем валидность ID сервера
        try:
            guild_id_int = int(guild_id)
        except ValueError:
            logger.error(f"Invalid guild ID format: {guild_id}")
            return
            
        config = settings_manager.load_guild_config(guild_id)
        if not config:
            logger.error(f"Failed to load config for guild {guild_id}")
            return
            
        logger.info(f"Config loaded for guild {guild_id}, duration: {config.get('duration', 0)}")
        
        # Get guild and find a channel to post in
        guild = bot.get_guild(guild_id_int)
        if not guild:
            logger.error(f"Guild {guild_id} not found")
            return
        
        logger.info(f"Guild {guild_id} found: {guild.name}")
        
        # Find channel for posting
        channel = None
        
        # Check if specific channel is configured
        auto_post_channel_id = config.get('auto_post_channel_id')
        if auto_post_channel_id:
            channel = guild.get_channel(auto_post_channel_id)
            if channel and channel.permissions_for(guild.me).send_messages:
                logger.info(f"Using configured auto-posting channel: {channel.name} (ID: {channel.id})")
            else:
                logger.warning(f"Configured channel {auto_post_channel_id} not found or no permissions, falling back to first available")
                channel = None
        
        # If no specific channel configured or channel not available, find first suitable channel
        if not channel:
            for ch in guild.text_channels:
                if ch.permissions_for(guild.me).send_messages:
                    channel = ch
                    break
        
        if not channel:
            logger.error(f"No suitable channel found in guild {guild_id}")
            return
        
        logger.info(f"Selected channel for auto-posting: {channel.name} (ID: {channel.id})")
        
        logger.info(f"Calling generate_chart_for_channel for guild {guild_id}")
        await generate_chart_for_channel(channel, is_auto=True)
        
        logger.info(f"Chart posted successfully for guild {guild_id}")
        
        # Schedule next post (task is automatically removed after completion)
        logger.info(f"Scheduling next post for guild {guild_id}")
        schedule_next_post(guild_id, config)
        
        logger.info(f"=== AUTO_POST_CHART COMPLETED for guild {guild_id} ===")
        
    except Exception as e:
        logger.error(f"Error in auto_post_chart for guild {guild_id}: {e}")
        logger.exception("Full traceback:")

def initialize_scheduled_tasks():
    """Initialize scheduled tasks for all guilds on bot startup"""
    try:
        logger.info("Starting initialization of scheduled tasks...")
        
        # Очищаем существующие задачи
        task_count = task_manager.get_task_count()
        logger.info(f"Clearing {task_count} existing tasks from memory")
        task_manager.cancel_all_tasks()
        
        # Counter for created tasks
        task_counter = 0
        
        for filename in os.listdir(GUILDS_DIR):
            if not filename.endswith('.json'):
                continue
                
            # Пропускаем файлы резервных копий
            if filename.startswith('.backup_'):
                logger.debug(f"Skipping backup file: {filename}")
                continue
                
            try:
                # Извлекаем ID сервера из имени файла
                guild_id = filename[:-5]  # Remove .json
                
                # Проверяем, что ID сервера является числом
                if not guild_id.isdigit():
                    logger.warning(f"Invalid guild ID format in filename: {filename}")
                    continue
                    
                config = settings_manager.load_guild_config(guild_id)
                if config and config.get('duration', 0) > 0:
                    logger.info(f"Creating scheduled task for guild {guild_id} with duration {config.get('duration')} hours")
                    schedule_next_post(guild_id, config)
                    task_counter += 1
                else:
                    logger.debug(f"Skipping guild {guild_id}: duration is 0 or config not found")
            except ValueError as e:
                logger.warning(f"Invalid guild configuration file: {filename}. Error: {e}")
                continue
            except Exception as e:
                logger.error(f"Error processing guild file {filename}: {e}")
                continue
        
        logger.info(f"Initialization complete. Created {task_counter} scheduled tasks.")
        # Выводим список активных задач после инициализации
        print_active_tasks()
    except Exception as e:
        logger.error(f"Error initializing scheduled tasks: {e}")

@bot.event
async def on_ready():
    """Event handler for when bot is ready"""
    logger.info(f'{bot.user} has connected to Discord!')
    
    # Устанавливаем основной event loop в TaskManager
    loop = asyncio.get_running_loop()
    task_manager.set_main_loop(loop)
    logger.info(f"Set main event loop for TaskManager: {loop}")
    
    # Sync slash commands
    try:
        synced = await bot.tree.sync()
        logger.info(f"Synced {len(synced)} command(s)")
    except Exception as e:
        logger.error(f"Failed to sync commands: {e}")
    
    # Initialize scheduled tasks
    initialize_scheduled_tasks()

@bot.tree.command(name="help", description="Show help and settings")
async def help_command(interaction: discord.Interaction):
    """Slash command for /help"""
    await send_welcome(interaction)

@retry_on_network_error
async def send_welcome(interaction: discord.Interaction):
    """Send welcome message"""
    if isinstance(interaction.channel, discord.DMChannel):
        # Private message
        user_id = interaction.user.id
        logger.info(f"User {user_id} requested guilds list")
        
        # Get admin guilds and log the result
        embed, admin_guilds = settings_manager.create_guild_menu_embed(user_id)
        logger.info(f"Result for user {user_id}: found {len(admin_guilds) if admin_guilds else 0} guilds")
        
        welcome_embed = discord.Embed(
            title="🤖 Welcome to tChart Bot!",
            description=(
                "This bot creates beautiful cryptocurrency charts with real-time data from various networks.\n\n"
                "**Features:**\n"
                "• Beautiful real-time price charts\n"
                "• Multiple timeframe support\n"
                "• Customizable design\n"
                "• Automatic posting\n\n"
                "🌐 Visit our website: https://tchart.xyz"
            ),
            color=0x00ff00
        )
        
        view = discord.ui.View()
        view.add_item(discord.ui.Button(
            label="📚 Help",
            url="https://tchart.xyz/help.html"
        ))
        
        if embed:
            await interaction.response.send_message(embed=welcome_embed, view=view)
            await interaction.followup.send(embed=embed)
        else:
            welcome_embed.add_field(
                name="ℹ️ Information",
                value="You don't have any configured servers with this bot yet. Add the bot to a server as an administrator to start using it!",
                inline=False
            )
            await interaction.response.send_message(embed=welcome_embed, view=view)
    else:
        # Guild message
        embed = discord.Embed(
            title="👋 Hello!",
            description=(
                "I'm a bot for creating cryptocurrency charts.\n"
                "Use the `/chart` command to display a chart."
            ),
            color=0x00ff00
        )
        
        view = discord.ui.View()
        view.add_item(discord.ui.Button(
            label="📚 Help",
            url="https://tchart.xyz/help.html"
        ))
        view.add_item(discord.ui.Button(
            label="🤖 Chat with bot",
            url=f"https://discord.com/users/{bot.user.id}"
        ))
        
        await interaction.response.send_message(embed=embed, view=view)

@bot.event
async def on_guild_join(guild):
    """Event handler for when bot joins a guild"""
    try:
        guild_id = guild.id
        guild_name = guild.name
        
        if not settings_manager.load_guild_config(guild_id):
            settings_manager.create_default_config(guild_id, guild_name)
            
            # Find a suitable channel to send welcome message
            channel = None
            for ch in guild.text_channels:
                if ch.permissions_for(guild.me).send_messages:
                    channel = ch
                    break
            
            if channel:
                embed = discord.Embed(
                    title="👋 Thank you for adding me to your server!",
                    description=(
                        f"I've created a configuration file for this server.\n"
                        f"Use the `/chart` command to display a chart."
                    ),
                    color=0x00ff00
                )
                await channel.send(embed=embed)
    except Exception as e:
        logger.error(f"Error handling guild join: {e}")

@bot.tree.command(name="chart", description="Create a cryptocurrency chart")
async def chart_command(interaction: discord.Interaction):
    """Slash command for /chart"""
    await generate_chart_interaction(interaction, is_auto=False)

@retry_on_network_error
async def generate_chart_interaction(interaction: discord.Interaction, is_auto=False):
    """Generate chart from interaction"""
    try:
        if not is_auto and isinstance(interaction.channel, discord.DMChannel):
            await interaction.response.send_message("This command only works on servers!")
            return
        
        guild_id = interaction.guild_id
        
        config = settings_manager.load_guild_config(guild_id)
        if not config:
            config = settings_manager.create_default_config(guild_id, interaction.guild.name)
            if not config:
                if not is_auto:
                    await interaction.response.send_message("Failed to create server configuration. Please try again later.")
                return
        
        # Set free parameter to false for bot generation
        config['free'] = False
        
        current_time = time.time()
        last_poster_time = config.get('last_poster_time', 0)
        minimal_duration = config.get('minimal_duration', 0.02)  # Default 0.02 hours
        
        # Check minimal duration between posts only for manual requests
        if not is_auto and minimal_duration > 0:
            time_since_last = current_time - last_poster_time
            if time_since_last < minimal_duration * 3600:
                remaining_time = int((minimal_duration * 3600 - time_since_last) / 60)
                await interaction.response.send_message(f"⏳ Next post will be available in {remaining_time} minutes")
                return
        
        if not is_auto:
            await interaction.response.send_message("🔄 Creating chart...")
        
        output_file = f"chart_{guild_id}_{int(time.time())}.png"
        
        network = config.get("network", "polygon_pos")
        pool_address = config.get("poolAddress")
        interval = config.get("interval", "1h")
        
        if not pool_address:
            content = "⚠️ Pool address is not specified in configuration! Please update the configuration file."
            if not is_auto:
                await interaction.edit_original_response(content=content)
            return
        
        ohlcv_data = fetch_grouped_ohlcv(network, pool_address, interval, config.get("numBars", 20))
        if not ohlcv_data:
            content = "⚠️ Failed to get chart data. Please check settings and API availability."
            if not is_auto:
                await interaction.edit_original_response(content=content)
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
        
        if render_chart(config, ohlcv_data, token_info, output_file):
            file = discord.File(output_file, filename="tChart.XYZ.png")
            
            if is_auto:
                # For auto posts, send to the channel directly
                channel = interaction.channel if hasattr(interaction, 'channel') else interaction
                await channel.send(file=file)
            else:
                await interaction.edit_original_response(content="", attachments=[file])
            
            config['last_poster_time'] = current_time
            settings_manager.save_guild_config(guild_id, config)
            
            # Reschedule the task only for manual posts (not auto posts)
            if not is_auto and config.get('duration', 0) > 0:
                schedule_next_post(guild_id, config)
            
            try:
                os.remove(output_file)
                logger.info(f"File {output_file} deleted")
            except Exception as e:
                logger.error(f"Error deleting file {output_file}: {e}")
        else:
            content = "⚠️ Failed to create chart. Please check settings and API availability."
            if not is_auto:
                await interaction.edit_original_response(content=content)
    except Exception as e:
        logger.error(f"Error generating chart: {e}")
        if not is_auto:
            try:
                await interaction.response.send_message(f"⚠️ An error occurred while creating the chart: {str(e)}")
            except:
                pass

async def generate_chart_for_channel(channel, is_auto=True):
    """Generate chart for specific channel (used for auto posting)"""
    try:
        guild_id = channel.guild.id
        
        config = settings_manager.load_guild_config(guild_id)
        if not config:
            logger.error(f"No config found for guild {guild_id}")
            return
        
        # Установить параметр free равным false для генерации из бота
        config['free'] = False
        
        current_time = time.time()
        
        output_file = f"chart_{guild_id}_{int(time.time())}.png"
        
        network = config.get("network", "polygon_pos")
        pool_address = config.get("poolAddress")
        interval = config.get("interval", "1h")
        
        if not pool_address:
            logger.error(f"Pool address not specified for guild {guild_id}")
            return
        
        ohlcv_data = fetch_grouped_ohlcv(network, pool_address, interval, config.get("numBars", 20))
        if not ohlcv_data:
            logger.error(f"Failed to get OHLCV data for guild {guild_id}")
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
        
        if render_chart(config, ohlcv_data, token_info, output_file):
            file = discord.File(output_file, filename="tChart.XYZ.png")
            await channel.send(file=file)
            
            config['last_poster_time'] = current_time
            settings_manager.save_guild_config(guild_id, config)
            
            try:
                os.remove(output_file)
                logger.info(f"File {output_file} deleted")
            except Exception as e:
                logger.error(f"Error deleting file {output_file}: {e}")
        else:
            logger.error(f"Failed to render chart for guild {guild_id}")
    except Exception as e:
        logger.error(f"Error in generate_chart_for_channel: {e}")

@bot.tree.command(name="settings", description="Bot settings (administrators only)")
@discord.app_commands.default_permissions(administrator=True)
async def settings_command(interaction: discord.Interaction):
    """Settings command for admins"""
    try:
        user_id = interaction.user.id
        admin_guilds = settings_manager.get_user_admin_guilds(user_id)
        
        if not admin_guilds:
            await interaction.response.send_message("You don't have administrator rights on any server.", ephemeral=True)
            return
        
        # If user has only one server, show settings directly
        if len(admin_guilds) == 1:
            guild_id = admin_guilds[0]['id']
            embed = settings_manager.create_settings_embed(guild_id, interaction.user)
            view = SettingsView(guild_id, interaction.user)
            await interaction.response.send_message(embed=embed, view=view, ephemeral=True)
            return
        
        # If user has multiple servers, show server selection menu
        embed = discord.Embed(
            title="🛠️ Select server for configuration",
            description="Choose a server to configure:",
            color=0x00ff00
        )
        
        view = ServerSelectionView(admin_guilds, interaction.user)
        await interaction.response.send_message(embed=embed, view=view, ephemeral=True)
        
    except Exception as e:
        logger.error(f"Error in settings command: {e}")
        await interaction.response.send_message(f"An error occurred: {str(e)}", ephemeral=True)

class ServerSelectionView(discord.ui.View):
    """View for server selection with Select Menu"""
    def __init__(self, admin_guilds, user):
        super().__init__(timeout=300)
        self.admin_guilds = admin_guilds
        self.user = user
        
        # Create select menu options
        options = []
        for guild in admin_guilds[:25]:  # Discord limit is 25 options
            options.append(discord.SelectOption(
                label=guild['name'][:100],  # Discord limit is 100 chars
                description=f"Server ID: {guild['id']}"[:100],
                value=guild['id']
            ))
        
        # Add select menu to view
        self.add_item(ServerSelectMenu(options, self.user))

class ServerSelectMenu(discord.ui.Select):
    """Select menu for choosing a server"""
    def __init__(self, options, user):
        super().__init__(
            placeholder="Choose a server to configure...",
            options=options,
            min_values=1,
            max_values=1
        )
        self.user = user
    
    async def callback(self, interaction: discord.Interaction):
        guild_id = self.values[0]
        
        # Create settings embed and view for selected server
        embed = settings_manager.create_settings_embed(guild_id, self.user)
        view = SettingsView(guild_id, self.user)
        
        await interaction.response.edit_message(embed=embed, view=view)

class SettingsView(discord.ui.View):
    """View for settings buttons"""
    def __init__(self, guild_id, user):
        super().__init__(timeout=300)
        self.guild_id = guild_id
        self.user = user
        
        # Добавляем основные кнопки
        self.add_item(DurationButton())
        self.add_item(WebEditorButton(guild_id))
        self.add_item(AutoPostChannelButton(guild_id))
        
        # Добавляем кнопки суперпользователя только если это суперпользователь
        if str(user.display_name) == SUPER_USER_ID or str(user.global_name) == SUPER_USER_ID:
            self.add_item(ImportJSONButton(guild_id))
            self.add_item(MinimalDurationButton(guild_id))
            self.add_item(FreeStatusButton(guild_id))

class DurationButton(discord.ui.Button):
    def __init__(self):
        super().__init__(label="⏱️ Auto-posting interval", style=discord.ButtonStyle.primary, row=0)
    
    async def callback(self, interaction: discord.Interaction):
        # Получаем guild_id из view
        view = self.view
        modal = DurationModal(view.guild_id)
        await interaction.response.send_modal(modal)

class WebEditorButton(discord.ui.Button):
    def __init__(self, guild_id):
        super().__init__(label="🌐 Web editor", style=discord.ButtonStyle.secondary, row=0)
        self.guild_id = guild_id
    
    async def callback(self, interaction: discord.Interaction):
        token, url = settings_manager.get_access_token(self.guild_id, interaction.user.id)
        
        if token and url:
            view = discord.ui.View()
            view.add_item(discord.ui.Button(
                label="🌐 Open web editor",
                url=url
            ))
            
            await interaction.response.send_message(
                "Click the button below to open the web editor.\nThe link will be valid for 1 hour.",
                view=view,
                ephemeral=True
            )
        else:
            await interaction.response.send_message(
                f"❌ Failed to create web editor link for server {self.guild_id}. Please try again later.",
                ephemeral=True
            )

class AutoPostChannelButton(discord.ui.Button):
    def __init__(self, guild_id):
        super().__init__(label="📢 Auto-posting channel", style=discord.ButtonStyle.secondary, row=0)
        self.guild_id = guild_id
    
    async def callback(self, interaction: discord.Interaction):
        # Получаем сервер для проверки каналов
        guild = bot.get_guild(int(self.guild_id))
        if not guild:
            await interaction.response.send_message("❌ Server not found", ephemeral=True)
            return
            
        # Получаем список текстовых каналов, где бот может отправлять сообщения
        available_channels = []
        for channel in guild.text_channels:
            if channel.permissions_for(guild.me).send_messages:
                available_channels.append(channel)
        
        if not available_channels:
            await interaction.response.send_message("❌ No available channels for auto-posting", ephemeral=True)
            return
        
        # Показываем меню выбора канала
        view = ChannelSelectionView(self.guild_id, available_channels)
        
        config = settings_manager.load_guild_config(self.guild_id)
        current_channel_id = config.get('auto_post_channel_id') if config else None
        current_channel_name = "Not set"
        
        if current_channel_id:
            current_channel = guild.get_channel(current_channel_id)
            if current_channel:
                current_channel_name = f"#{current_channel.name}"
        
        embed = discord.Embed(
            title="📢 Select Auto-posting Channel",
            description=f"Current: {current_channel_name}\n\nSelect a channel for automatic chart posting:",
            color=0x00ff00
        )
        
        await interaction.response.send_message(embed=embed, view=view, ephemeral=True)

class ChannelSelectionView(discord.ui.View):
    """View for channel selection"""
    def __init__(self, guild_id, available_channels):
        super().__init__(timeout=300)
        self.guild_id = guild_id
        
        # Create select menu options
        options = []
        
        # Add "disable" option
        options.append(discord.SelectOption(
            label="🚫 Disable auto-posting",
            description="Turn off automatic posting",
            value="disable"
        ))
        
        # Add channel options (max 24 because we have one disable option)
        for channel in available_channels[:24]:
            options.append(discord.SelectOption(
                label=f"#{channel.name}",
                description=f"Channel ID: {channel.id}",
                value=str(channel.id)
            ))
        
        # Add select menu to view
        self.add_item(ChannelSelectMenu(options, self.guild_id))

class ChannelSelectMenu(discord.ui.Select):
    """Select menu for choosing a channel"""
    def __init__(self, options, guild_id):
        super().__init__(
            placeholder="Choose a channel for auto-posting...",
            options=options,
            min_values=1,
            max_values=1
        )
        self.guild_id = guild_id
    
    async def callback(self, interaction: discord.Interaction):
        selected_value = self.values[0]
        
        config = settings_manager.load_guild_config(self.guild_id)
        if not config:
            config = settings_manager.create_default_config(self.guild_id)
        
        if selected_value == "disable":
            config['auto_post_channel_id'] = None
            message = "✅ Auto-posting disabled"
        else:
            channel_id = int(selected_value)
            config['auto_post_channel_id'] = channel_id
            
            # Get channel name for confirmation
            guild = bot.get_guild(int(self.guild_id))
            if guild:
                channel = guild.get_channel(channel_id)
                channel_name = f"#{channel.name}" if channel else f"Channel {channel_id}"
                message = f"✅ Auto-posting channel set to {channel_name}"
            else:
                message = f"✅ Auto-posting channel set to ID {channel_id}"
        
        if settings_manager.save_guild_config(self.guild_id, config):
            await interaction.response.send_message(message, ephemeral=True)
        else:
            await interaction.response.send_message("❌ Failed to save settings", ephemeral=True)

class ImportJSONButton(discord.ui.Button):
    def __init__(self, guild_id):
        super().__init__(label="📥 Import JSON", style=discord.ButtonStyle.success, row=1)
        self.guild_id = guild_id
    
    async def callback(self, interaction: discord.Interaction):
        # Проверка прав суперпользователя
        if not (str(interaction.user.display_name) == SUPER_USER_ID or str(interaction.user.global_name) == SUPER_USER_ID):
            await interaction.response.send_message("❌ This function is only available to superuser.", ephemeral=True)
            return
            
        await interaction.response.send_message(
            "📁 Please upload a JSON configuration file in this private chat.",
            ephemeral=True
        )
        
        # Сохраняем информацию о pending import для данного пользователя
        settings_manager.pending_imports[interaction.user.id] = self.guild_id

class MinimalDurationButton(discord.ui.Button):
    def __init__(self, guild_id):
        super().__init__(label="⚙️ Minimal Duration", style=discord.ButtonStyle.success, row=1)
        self.guild_id = guild_id
    
    async def callback(self, interaction: discord.Interaction):
        # Проверка прав суперпользователя
        if not (str(interaction.user.display_name) == SUPER_USER_ID or str(interaction.user.global_name) == SUPER_USER_ID):
            await interaction.response.send_message("❌ This function is only available to superuser.", ephemeral=True)
            return
            
        modal = MinimalDurationModal(self.guild_id)
        await interaction.response.send_modal(modal)

class FreeStatusButton(discord.ui.Button):
    def __init__(self, guild_id):
        super().__init__(label="🔓 Free Status", style=discord.ButtonStyle.success, row=1)
        self.guild_id = guild_id
    
    async def callback(self, interaction: discord.Interaction):
        # Проверка прав суперпользователя
        if not (str(interaction.user.display_name) == SUPER_USER_ID or str(interaction.user.global_name) == SUPER_USER_ID):
            await interaction.response.send_message("❌ This function is only available to superuser.", ephemeral=True)
            return
            
        config = settings_manager.load_guild_config(self.guild_id)
        if not config:
            config = settings_manager.create_default_config(self.guild_id)
        
        # Переключаем free статус
        current_free = config.get('free', False)
        new_free = not current_free
        config['free'] = new_free
        
        if settings_manager.save_guild_config(self.guild_id, config):
            status_text = "enabled" if new_free else "disabled"
            await interaction.response.send_message(
                f"✅ Free mode {status_text} for server {self.guild_id}",
                ephemeral=True
            )
        else:
            await interaction.response.send_message("❌ Failed to save settings", ephemeral=True)

class DurationModal(discord.ui.Modal):
    """Modal for duration input"""
    def __init__(self, guild_id):
        super().__init__(title="Auto-posting interval")
        self.guild_id = guild_id
    
    duration_input = discord.ui.TextInput(
        label="Interval in hours (0 to disable)",
        placeholder="Enter number of hours...",
        max_length=10
    )
    
    async def on_submit(self, interaction: discord.Interaction):
        try:
            duration = float(self.duration_input.value)
            if duration < 0:
                raise ValueError("Interval cannot be negative")
            
            # Convert to integer if the value is a whole number
            if duration.is_integer():
                duration = int(duration)
        except ValueError:
            await interaction.response.send_message("Please enter a valid number", ephemeral=True)
            return

        config = settings_manager.load_guild_config(self.guild_id)
        if not config:
            config = settings_manager.create_default_config(self.guild_id)

        config['duration'] = duration

        if settings_manager.save_guild_config(self.guild_id, config):
            # Cancel existing task and reschedule if duration > 0
            task_manager.cancel_task(self.guild_id)
            
            if duration > 0:
                logger.info(f"Rescheduling auto-posting for guild {self.guild_id} with new duration {duration} hours")
                schedule_next_post(self.guild_id, config)
                await interaction.response.send_message(f"✅ Auto-posting interval set to {duration} hours and task rescheduled", ephemeral=True)
            else:
                await interaction.response.send_message(f"✅ Auto-posting disabled for this server", ephemeral=True)
        else:
            await interaction.response.send_message("❌ Failed to save settings", ephemeral=True)

class MinimalDurationModal(discord.ui.Modal):
    """Modal for minimal duration input (superuser only)"""
    def __init__(self, guild_id):
        super().__init__(title="Minimal Duration Setting")
        self.guild_id = guild_id
    
    min_duration_input = discord.ui.TextInput(
        label="Minimal interval in hours",
        placeholder="Enter minimum hours between posts...",
        max_length=10
    )
    
    async def on_submit(self, interaction: discord.Interaction):
        # Проверка прав суперпользователя
        if not (str(interaction.user.display_name) == SUPER_USER_ID or str(interaction.user.global_name) == SUPER_USER_ID):
            await interaction.response.send_message("❌ This function is only available to superuser.", ephemeral=True)
            return
            
        try:
            min_duration = float(self.min_duration_input.value)
            if min_duration < 0:
                raise ValueError("Interval cannot be negative")
            
            # Convert to integer if the value is a whole number
            if min_duration.is_integer():
                min_duration = int(min_duration)
        except ValueError:
            await interaction.response.send_message("Please enter a valid number", ephemeral=True)
            return

        config = settings_manager.load_guild_config(self.guild_id)
        if not config:
            config = settings_manager.create_default_config(self.guild_id)

        config['minimal_duration'] = min_duration

        if settings_manager.save_guild_config(self.guild_id, config):
            await interaction.response.send_message(f"✅ Minimal interval between posts set to {min_duration} hours", ephemeral=True)
        else:
            await interaction.response.send_message("❌ Failed to save settings", ephemeral=True)

@bot.event
async def on_guild_remove(guild):
    """Handler for when bot is removed from guild"""
    try:
        guild_id = str(guild.id)
        config_path = os.path.join(GUILDS_DIR, f"{guild_id}.json")
        if os.path.exists(config_path):
            try:
                os.remove(config_path)
                logger.info(f"Configuration file deleted for guild {guild_id}")
            except Exception as e:
                logger.error(f"Error deleting configuration file for guild {guild_id}: {e}")
    except Exception as e:
        logger.error(f"Error handling guild removal: {e}")

@bot.event
async def on_message(message):
    """Handler for messages - used for JSON file import"""
    try:
        # Ignore messages from the bot itself
        if message.author.bot:
            return
        
        # Process only direct messages with attachments
        if isinstance(message.channel, discord.DMChannel) and message.attachments:
            user_id = message.author.id
            
            # Check if user has pending JSON import
            if user_id in settings_manager.pending_imports:
                guild_id = settings_manager.pending_imports[user_id]
                
                # Check if the attached file is JSON
                for attachment in message.attachments:
                    if attachment.filename.endswith('.json'):
                        try:
                            # Download and read the JSON file
                            json_content = await attachment.read()
                            json_text = json_content.decode('utf-8')
                            
                            # Process the import
                            result = settings_manager.process_json_import(
                                user_id, guild_id, json_text, message.author
                            )
                            
                            await message.reply(result)
                            return
                            
                        except Exception as e:
                            logger.error(f"Error processing JSON file: {e}")
                            await message.reply(f"❌ Error processing JSON file: {str(e)}")
                            return
                
                # If no JSON file found
                await message.reply("❌ Please upload a JSON file for configuration import.")
    
    except Exception as e:
        logger.error(f"Error in on_message handler: {e}")

if __name__ == "__main__":
    logger.info("Discord bot started...")
    
    try:
        bot.run(BOT_TOKEN)
    except Exception as e:
        logger.error(f"Critical error in bot operation: {e}")
        # Cancel all scheduled tasks on exit
        task_manager.cancel_all_tasks() 