#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import asyncio
import websockets
import json
import logging
import os
import time
from datetime import datetime, timedelta
import aiomysql
import aiofiles
from typing import Dict, Optional, Any
from chart_generator import (
    fetch_geckoterminal_ohlcv,
    fetch_pool_info,
    render_chart,
    process_font_data
)

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class CacheManager:
    """Менеджер кэша для запросов к CoinGecko API"""
    def __init__(self):
        self.cache: Dict[str, Dict[str, Any]] = {}
        self.cache_ttl = 120  # 2 минуты в секундах
    
    def get_cache_key(self, network: str, pool_address: str, interval: str) -> str:
        """Создает ключ для кэша"""
        return f"{network}:{pool_address}:{interval}"
    
    def get_cached_data(self, cache_key: str) -> Optional[Dict[str, Any]]:
        """Получает данные из кэша если они еще актуальны"""
        if cache_key in self.cache:
            cached_item = self.cache[cache_key]
            if time.time() - cached_item['timestamp'] < self.cache_ttl:
                logger.info(f"Используем кэшированные данные для {cache_key}")
                return {
                    'ohlcv_data': cached_item['ohlcv_data'],
                    'token_info': cached_item['token_info']
                }
        return None
    
    def set_cached_data(self, cache_key: str, ohlcv_data: list, token_info: dict):
        """Сохраняет данные в кэш"""
        self.cache[cache_key] = {
            'timestamp': time.time(),
            'ohlcv_data': ohlcv_data,
            'token_info': token_info
        }
        logger.info(f"Данные сохранены в кэш для {cache_key}")

class DatabaseManager:
    """Менеджер для работы с базой данных MariaDB"""
    def __init__(self):
        self.pool = None
        self.config = {
            'host': os.environ.get('MARIA_HOST', '127.0.0.1'),
            'user': os.environ.get('MARIA_USER', 'root'),
            'password': os.environ.get('MARIA_PASSWORD', 'root'),
            'db': os.environ.get('MARIA_DB', 'tchart'),
            'port': int(os.environ.get('MARIA_PORT', '3306')),
            'charset': 'utf8mb4',
            'autocommit': True
        }
    
    async def connect(self):
        """Подключение к базе данных"""
        try:
            self.pool = await aiomysql.create_pool(**self.config)
            logger.info("Подключение к базе данных MariaDB успешно")
        except Exception as e:
            logger.error(f"Ошибка подключения к базе данных: {e}")
            raise
    
    async def close(self):
        """Закрытие подключения к базе данных"""
        if self.pool:
            self.pool.close()
            await self.pool.wait_closed()
            logger.info("Подключение к базе данных закрыто")
    
    async def get_approved_presets(self) -> list:
        """Получает список одобренных пресетов"""
        try:
            async with self.pool.acquire() as conn:
                async with conn.cursor() as cursor:
                    await cursor.execute(
                        "SELECT * FROM presets WHERE approved = TRUE ORDER BY created_at DESC"
                    )
                    rows = await cursor.fetchall()
                    
                    # Получаем описания колонок
                    column_names = [desc[0] for desc in cursor.description]
                    
                    # Преобразуем в список словарей
                    presets = []
                    for row in rows:
                        preset = dict(zip(column_names, row))
                        
                        # Конвертируем datetime в строку
                        if preset.get('created_at'):
                            if hasattr(preset['created_at'], 'isoformat'):
                                preset['created_at'] = preset['created_at'].isoformat()
                            else:
                                preset['created_at'] = str(preset['created_at'])
                            
                        # Парсим теги если они есть
                        if preset.get('tags'):
                            try:
                                preset['tags'] = json.loads(preset['tags'])
                            except:
                                preset['tags'] = []
                        else:
                            preset['tags'] = []
                            presets.append(preset)
                    
                    logger.info(f"Получено {len(presets)} одобренных пресетов")
                    return presets
        except Exception as e:
            logger.error(f"Ошибка при получении пресетов: {e}")
            return []
    
    async def get_preset_config(self, preset_name: str) -> Optional[dict]:
        """Получает конфигурацию пресета по имени"""
        try:
            # Путь к файлу конфигурации
            config_path = os.path.join(
                os.path.dirname(__file__), 
                '..', 'pic', 'presets', f'{preset_name}.json'
            )
            
            if os.path.exists(config_path):
                async with aiofiles.open(config_path, 'r', encoding='utf-8') as f:
                    content = await f.read()
                    return json.loads(content)
            else:
                logger.warning(f"Файл конфигурации не найден: {config_path}")
                    return None
        except Exception as e:
            logger.error(f"Ошибка при чтении конфигурации пресета {preset_name}: {e}")
            return None

class WebSocketChartServer:
    """WebSocket сервер для работы с графиками"""
    def __init__(self, host='localhost', port=8765):
        self.host = host
        self.port = port
        self.db_manager = DatabaseManager()
        self.cache_manager = CacheManager()
        self.connected_clients = set()
    
    async def start(self):
        """Запуск сервера"""
        await self.db_manager.connect()
        logger.info(f"Запуск WebSocket сервера на {self.host}:{self.port}")
        
        async with websockets.serve(self.handle_client, self.host, self.port):
            await asyncio.Future()  # Бесконечное ожидание
    
    async def handle_client(self, websocket):
        """Обработчик подключения клиента"""
        self.connected_clients.add(websocket)
        client_address = websocket.remote_address
        logger.info(f"Клиент подключен: {client_address}")
        
        try:
            async for message in websocket:
                await self.process_message(websocket, message)
        except websockets.exceptions.ConnectionClosed:
            logger.info(f"Клиент отключен: {client_address}")
        except Exception as e:
            logger.error(f"Ошибка при обработке клиента {client_address}: {e}")
        finally:
            self.connected_clients.discard(websocket)
    
    async def process_message(self, websocket, message):
        """Обработка сообщения от клиента"""
        try:
            data = json.loads(message)
            command = data.get('command')
            
            if command == 'get_presets':
                await self.handle_get_presets(websocket)
            elif command == 'generate_chart':
                await self.handle_generate_chart(websocket, data)
            elif command == 'generate_all_charts':
                await self.handle_generate_all_charts(websocket, data)
            else:
                await self.send_error(websocket, f"Неизвестная команда: {command}")
                     except json.JSONDecodeError:
            await self.send_error(websocket, "Некорректный JSON")
        except Exception as e:
            logger.error(f"Ошибка при обработке сообщения: {e}")
            await self.send_error(websocket, f"Ошибка сервера: {str(e)}")
    
    async def handle_get_presets(self, websocket):
        """Обработчик команды получения списка пресетов"""
        try:
            presets = await self.db_manager.get_approved_presets()
            
            response = {
                'type': 'presets_list',
                'success': True,
                'presets': presets
            }
            
            await websocket.send(json.dumps(response))
            logger.info(f"Отправлен список пресетов: {len(presets)} элементов")
        
        except Exception as e:
            logger.error(f"Ошибка при получении списка пресетов: {e}")
            await self.send_error(websocket, f"Ошибка при получении пресетов: {str(e)}")
    
    async def handle_generate_chart(self, websocket, data):
        """Обработчик команды генерации графика"""
        try:
            # Извлекаем параметры из веб-формы
            preset_name = data.get('preset_name')
            pool_address = data.get('pool_address')
            num_bars = data.get('num_bars', 20)
            network = data.get('network', 'polygon_pos')
            interval = data.get('interval', 'hour')
            token_name = data.get('token_name', '')
            separate_bars = data.get('separate_bars', False)
            show_market_cap = data.get('show_market_cap', True)
            
            if not preset_name or not pool_address:
                await self.send_error(websocket, "Требуются параметры: preset_name и pool_address")
                return
            
            # Получаем конфигурацию пресета
            config = await self.db_manager.get_preset_config(preset_name)
            if not config:
                await self.send_error(websocket, f"Пресет '{preset_name}' не найден")
                return
            
            # Обновляем конфигурацию с переданными параметрами из веб-формы
            config['network'] = network
            config['poolAddress'] = pool_address
            config['numBars'] = num_bars
            config['interval'] = interval
            
            # Обновляем настройку показа Market Cap
            if 'display' not in config:
                config['display'] = {}
            config['display']['showMarketCap'] = show_market_cap
            
            # Подменяем displayName если передан token_name
            if token_name and token_name.strip():
                if 'displayName' in config:
                    config['displayName'] = token_name.strip()
                logger.info(f"Подменен displayName на: {token_name}")
            
            # Обрабатываем данные шрифта
            config = process_font_data(config)
            
            # Проверяем кэш
            cache_key = self.cache_manager.get_cache_key(network, pool_address, interval)
            cached_data = self.cache_manager.get_cached_data(cache_key)
            
            if cached_data:
                ohlcv_data = cached_data['ohlcv_data']
                token_info = cached_data['token_info']
            else:
                # Получаем данные из API
                    ohlcv_data = fetch_geckoterminal_ohlcv(network, pool_address, interval)
                if not ohlcv_data:
                    await self.send_error(websocket, "Не удалось получить данные OHLCV")
                    return
                
                token_info = fetch_pool_info(network, pool_address)
                if not token_info:
                    await self.send_error(websocket, "Не удалось получить информацию о токене")
                    return
                
                # Сохраняем в кэш
                self.cache_manager.set_cached_data(cache_key, ohlcv_data, token_info)
            
            # Сортируем данные по времени
            ohlcv_data.sort(key=lambda x: x[0])
            
            # Берем последние num_bars баров
            if num_bars > 0 and len(ohlcv_data) > num_bars:
                ohlcv_data = ohlcv_data[-num_bars:]
            
            if separate_bars:
                # Генерация отдельных столбиков
                await websocket.send(json.dumps({
                    'type': 'generation_progress',
                    'message': 'Генерируем отдельные столбики...'
                }))
                
                # Создаем директорию для отдельных файлов
                output_dir = os.path.join(
                    os.path.dirname(__file__), 
                    '..', 'generated_images', 'separate_bars'
                )
                os.makedirs(output_dir, exist_ok=True)
                
                # Применяем ту же обработку конфигурации, что и в render_chart
                import copy
                config_copy = copy.deepcopy(config)
                
                # Убедимся, что параметр free существует и имеет правильное значение
                if 'free' not in config_copy or config_copy['free'] is None:
                    config_copy['free'] = False
                
                # Удаляем поля шрифта как в render_chart
                if 'font' in config_copy:
                    if 'path' in config_copy['font']:
                        del config_copy['font']['path']
                        logger.info("Удалено поле path из конфигурации шрифта")
                    if 'originalFamily' in config_copy['font']:
                        del config_copy['font']['originalFamily']
                        logger.info("Удалено поле originalFamily из конфигурации шрифта")
                
                logger.info(f"Финальная конфигурация шрифта: {config_copy.get('font', {})}")
                logger.info(f"Значение параметра free: {config_copy.get('free', False)}")
                
                # Подготавливаем данные для API запроса с правильной обработкой
                api_request = {
                    'config': config_copy,
                    'data': ohlcv_data,
                    'tokenInfo': token_info,
                    'interval': interval,
                    'width': 1280,
                    'height': 1280,
                    'separateBars': True
                }
                
                # Вызываем API сервер через HTTP запрос
                import requests
                try:
                    api_response = requests.post('http://localhost:3001/render', 
                                               json=api_request, 
                                               timeout=60)
                    
                    if api_response.status_code == 200:
                        result = api_response.json()
                        
                        if result.get('success') and result.get('separateBars'):
                            # Перемещаем файлы из generated_images в целевую папку
                            generated_images_dir = os.path.join(
                                os.path.dirname(__file__), 
                                '..', 'generated_images'
                            )
                            preset_dir = output_dir
                            os.makedirs(preset_dir, exist_ok=True)
                            import shutil
                            moved_files = []
                            
                            # Фон
                            bg_src = os.path.join(generated_images_dir, result['backgroundFilename'])
                            bg_dst = os.path.join(preset_dir, f"background_{preset_name}.png")
                            if os.path.exists(bg_src):
                                shutil.move(bg_src, bg_dst)
                            
                            # Столбики
                            for j, bar_filename in enumerate(result['barFilenames']):
                                bar_src = os.path.join(generated_images_dir, bar_filename)
                                bar_dst = os.path.join(preset_dir, f"bar_{j+1}_{preset_name}.png")
                                if os.path.exists(bar_src):
                                    shutil.move(bar_src, bar_dst)
                                    moved_files.append(f"bar_{j+1}_{preset_name}.png")
                            
                            # CSV
                            csv_src = os.path.join(generated_images_dir, 'bars_types.csv')
                            csv_dst = os.path.join(preset_dir, 'bars_types.csv')
                            if os.path.exists(csv_src):
                                shutil.move(csv_src, csv_dst)
                            
                            response = {
                                'type': 'chart_generated_separate',
                                'success': True,
                                'bar_count': result.get('barCount'),
                                'background_filename': f"background_{preset_name}.png",
                                'bar_filenames': moved_files,
                                'token_info': token_info,
                                'output_directory': preset_dir,
                                'csv_filename': 'bars_types.csv'
                            }
                            await websocket.send(json.dumps(response))
                            logger.info(f"Отдельные столбики успешно сгенерированы: {result.get('barCount')} файлов + 1 фон + CSV в {preset_dir}")
                        else:
                            await self.send_error(websocket, f"Ошибка API: {result.get('message', 'Неизвестная ошибка')}")
                        else:
                        await self.send_error(websocket, f"Ошибка API сервера: {api_response.status_code}")
                        
                except requests.RequestException as e:
                    logger.error(f"Ошибка при обращении к API серверу: {e}")
                    await self.send_error(websocket, f"Ошибка связи с API сервером: {str(e)}")
                    
                        else:
                # Обычная генерация одного файла
                    output_filename = f"chart_{int(time.time())}.png"
                output_path = os.path.join(
                    os.path.dirname(__file__), 
                    '..', 'generated_images', output_filename
                )
                os.makedirs(os.path.dirname(output_path), exist_ok=True)
                success = render_chart(config, ohlcv_data, token_info, output_path)
                if success:
                    import base64
                    with open(output_path, 'rb') as f:
                        image_data = f.read()
                        base64_image = base64.b64encode(image_data).decode('utf-8')
                    os.remove(output_path)
                    response = {
                        'type': 'chart_generated',
                        'success': True,
                        'base64_image': f"data:image/png;base64,{base64_image}",
                        'token_info': token_info
                    }
                    await websocket.send(json.dumps(response))
                    logger.info(f"График успешно сгенерирован для пресета '{preset_name}'")
                else:
                    await self.send_error(websocket, "Ошибка при генерации графика")
                     except Exception as e:
                logger.error(f"Ошибка при генерации графика: {e}")
                await self.send_error(websocket, f"Ошибка при генерации графика: {str(e)}")
    
    async def handle_generate_all_charts(self, websocket, data):
        """Обработчик команды генерации всех графиков"""
        try:
                # Извлекаем параметры из веб-формы
                pool_address = data.get('pool_address')
                num_bars = data.get('num_bars', 20)
                network = data.get('network', 'polygon_pos')
                interval = data.get('interval', 'hour')
                token_name = data.get('token_name', '')
                output_dir = data.get('output_dir', 'd:\\temp\\charts')
                clear_directory = data.get('clear_directory', False)
                separate_bars = data.get('separate_bars', False)
                show_market_cap = data.get('show_market_cap', True)
            
                if not pool_address:
                await self.send_error(websocket, "Требуется параметр: pool_address")
                return
            
                # Очищаем директорию если требуется
                if clear_directory and os.path.exists(output_dir):
                try:
                    import shutil
                    shutil.rmtree(output_dir)
                    logger.info(f"Директория очищена: {output_dir}")
                    await websocket.send(json.dumps({
                        'type': 'directory_cleared',
                        'message': f'Каталог {output_dir} очищен'
                    }))
                except Exception as e:
                    logger.error(f"Ошибка при очистке директории {output_dir}: {e}")
                    await websocket.send(json.dumps({
                        'type': 'directory_clear_error',
                        'error': f'Ошибка очистки каталога: {str(e)}'
                    }))
            
            # Создаем директорию если не существует
            os.makedirs(output_dir, exist_ok=True)
            
            # Получаем все одобренные пресеты
            presets = await self.db_manager.get_approved_presets()
            if not presets:
                await self.send_error(websocket, "Нет доступных пресетов")
                return
            
            # Отправляем начальное сообщение
            await websocket.send(json.dumps({
                'type': 'generation_started',
                'success': True,
                'total_presets': len(presets),
                'message': f'Начинаем генерацию {len(presets)} графиков{"с отдельными столбиками" if separate_bars else ""}...'
            }))
            
            # Проверяем кэш для данных
            cache_key = self.cache_manager.get_cache_key(network, pool_address, interval)
            cached_data = self.cache_manager.get_cached_data(cache_key)
            
            if cached_data:
                ohlcv_data = cached_data['ohlcv_data']
                token_info = cached_data['token_info']
                logger.info(f"Используем кэшированные данные для {cache_key}")
            else:
                # Получаем данные из API
                    await websocket.send(json.dumps({
                    'type': 'fetching_data',
                    'message': 'Получаем данные OHLCV...'
                }))
                
                ohlcv_data = fetch_geckoterminal_ohlcv(network, pool_address, interval)
                if not ohlcv_data:
                    await self.send_error(websocket, "Не удалось получить данные OHLCV")
                    return
                
                await websocket.send(json.dumps({
                    'type': 'fetching_data',
                    'message': 'Получаем информацию о токене...'
                }))
                
                token_info = fetch_pool_info(network, pool_address)
                if not token_info:
                    await self.send_error(websocket, "Не удалось получить информацию о токене")
                    return
                
                # Сохраняем в кэш
                self.cache_manager.set_cached_data(cache_key, ohlcv_data, token_info)
            
            # Сортируем данные по времени
            ohlcv_data.sort(key=lambda x: x[0])
            
            # Берем последние num_bars баров
            if num_bars > 0 and len(ohlcv_data) > num_bars:
                ohlcv_data = ohlcv_data[-num_bars:]
            
            # Генерируем графики для каждого пресета
            successful_count = 0
            failed_count = 0
            start_time_total = time.time()
            
            for i, preset in enumerate(presets):
                start_time_preset = time.time()
                try:
                    # Отправляем прогресс
                    await websocket.send(json.dumps({
                        'type': 'generation_progress',
                        'current': i + 1,
                        'total': len(presets),
                        'preset_name': preset['name'],
                        'message': f'Генерируем график {i+1}/{len(presets)}: {preset["name"]}{"с отдельными столбиками" if separate_bars else ""}'
                    }))
                    
                    # Получаем конфигурацию пресета
                    config = await self.db_manager.get_preset_config(preset['name'])
                    if not config:
                        logger.warning(f"Конфигурация пресета '{preset['name']}' не найдена")
                        failed_count += 1
                        continue
                    
                    # Обновляем конфигурацию с переданными параметрами из веб-формы
                    config['network'] = network
                    config['poolAddress'] = pool_address
                    config['numBars'] = num_bars
                    config['interval'] = interval
                    
                    # Обновляем настройку показа Market Cap
                    if 'display' not in config:
                        config['display'] = {}
                    config['display']['showMarketCap'] = show_market_cap
                    
                    # Подменяем displayName если передан token_name
                    if token_name and token_name.strip():
                        if 'displayName' in config:
                            config['displayName'] = token_name.strip()
                    
                    # Обрабатываем данные шрифта
                    config = process_font_data(config)
                    
                    if separate_bars:
                        # Генерация отдельных столбиков для каждого пресета
                        import requests
                        try:
                            # Применяем ту же обработку конфигурации, что и в render_chart
                            import copy
                            config_copy = copy.deepcopy(config)
                            
                            # Убедимся, что параметр free существует и имеет правильное значение
                            if 'free' not in config_copy or config_copy['free'] is None:
                                config_copy['free'] = False
                            
                            # Удаляем поля шрифта как в render_chart
                            if 'font' in config_copy:
                                if 'path' in config_copy['font']:
                                    del config_copy['font']['path']
                                    logger.info(f"Удалено поле path для пресета {preset['name']}")
                                if 'originalFamily' in config_copy['font']:
                                    del config_copy['font']['originalFamily']
                                    logger.info(f"Удалено поле originalFamily для пресета {preset['name']}")
                            
                            api_request = {
                                'config': config_copy,
                                'data': ohlcv_data,
                                'tokenInfo': token_info,
                                'interval': interval,
                                'width': 1280,
                                'height': 1280,
                                'separateBars': True
                            }
                            
                            api_response = requests.post('http://localhost:3001/render', 
                                                       json=api_request, 
                                                       timeout=60)
                            if api_response.status_code == 200:
                                result = api_response.json()
                                if result.get('success') and result.get('separateBars'):
                                    generated_images_dir = os.path.join(
                                        os.path.dirname(__file__), 
                                        '..', 'generated_images'
                                    )
                                    preset_dir = os.path.join(output_dir, preset['name'])
                                    os.makedirs(preset_dir, exist_ok=True)
                                    import shutil
                                    moved_files = []
                                    bg_src = os.path.join(generated_images_dir, result['backgroundFilename'])
                                    bg_dst = os.path.join(preset_dir, f"background_{preset['name']}.png")
                                    if os.path.exists(bg_src):
                                        shutil.move(bg_src, bg_dst)
                                    for j, bar_filename in enumerate(result['barFilenames']):
                                        bar_src = os.path.join(generated_images_dir, bar_filename)
                                        bar_dst = os.path.join(preset_dir, f"bar_{j+1}_{preset['name']}.png")
                                        if os.path.exists(bar_src):
                                            shutil.move(bar_src, bar_dst)
                                            moved_files.append(f"bar_{j+1}_{preset['name']}.png")
                                    # CSV
                                    csv_src = os.path.join(generated_images_dir, 'bars_types.csv')
                                    csv_dst = os.path.join(preset_dir, 'bars_types.csv')
                                    if os.path.exists(csv_src):
                                        shutil.move(csv_src, csv_dst)
                                    successful_count += 1
                                    end_time_preset = time.time()
                                    preset_time = end_time_preset - start_time_preset
                                    await websocket.send(json.dumps({
                                        'type': 'chart_saved',
                                        'preset_name': preset['name'],
                                        'filename': f"{preset['name']} (отдельные столбики)",
                                        'path': preset_dir,
                                        'generation_time': round(preset_time, 2),
                                        'success': True,
                                        'separate_bars': True,
                                        'bar_count': len(moved_files),
                                        'files_created': moved_files + [f"background_{preset['name']}.png", 'bars_types.csv']
                                    }))
                                    logger.info(f"Отдельные столбики сохранены в {preset_dir} (время: {preset_time:.2f}с)")
                                else:
                                    failed_count += 1
                                        end_time_preset = time.time()
                                    preset_time = end_time_preset - start_time_preset
                                    await websocket.send(json.dumps({
                                        'type': 'chart_failed',
                                        'preset_name': preset['name'],
                                        'error': f"API ошибка: {result.get('message', 'Неизвестная ошибка')}",
                                        'generation_time': round(preset_time, 2)
                                    }))
                            else:
                                failed_count += 1
                                    end_time_preset = time.time()
                                preset_time = end_time_preset - start_time_preset
                                await websocket.send(json.dumps({
                                    'type': 'chart_failed',
                                    'preset_name': preset['name'],
                                    'error': f'API сервер ошибка: {api_response.status_code}',
                                    'generation_time': round(preset_time, 2)
                                }))
                        except requests.RequestException as e:
                            failed_count += 1
                            end_time_preset = time.time()
                            preset_time = end_time_preset - start_time_preset
                            logger.error(f"Ошибка при обращении к API серверу для пресета '{preset['name']}': {e}")
                            await websocket.send(json.dumps({
                                'type': 'chart_failed',
                                'preset_name': preset['name'],
                                'error': f'Ошибка API: {str(e)}',
                                'generation_time': round(preset_time, 2)
                            }))
                    else:
                        # Обычная генерация одного файла для каждого пресета
                            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
                        filename = f"{preset['name']}_{timestamp}.png"
                        output_path = os.path.join(output_dir, filename)
                        os.makedirs(output_dir, exist_ok=True)
                        success = render_chart(config, ohlcv_data, token_info, output_path)
                        if success:
                            successful_count += 1
                            end_time_preset = time.time()
                            preset_time = end_time_preset - start_time_preset
                            logger.info(f"График сохранен: {output_path} (время: {preset_time:.2f}с)")
                            await websocket.send(json.dumps({
                                'type': 'chart_saved',
                                'preset_name': preset['name'],
                                'filename': filename,
                                'path': output_path,
                                'generation_time': round(preset_time, 2),
                                'success': True
                            }))
                        else:
                            failed_count += 1
                                end_time_preset = time.time()
                            preset_time = end_time_preset - start_time_preset
                            logger.error(f"Ошибка при генерации графика для пресета '{preset['name']}' (время: {preset_time:.2f}с)")
                            await websocket.send(json.dumps({
                                'type': 'chart_failed',
                                'preset_name': preset['name'],
                                'error': 'Ошибка при генерации графика',
                                'generation_time': round(preset_time, 2)
                            }))
                
                except Exception as e:
                    failed_count += 1
                    end_time_preset = time.time()
                    preset_time = end_time_preset - start_time_preset
                    logger.error(f"Ошибка при обработке пресета '{preset['name']}': {e} (время: {preset_time:.2f}с)")
                    
                    await websocket.send(json.dumps({
                        'type': 'chart_failed',
                        'preset_name': preset['name'],
                        'error': str(e),
                        'generation_time': round(preset_time, 2)
                    }))
            
            # Отправляем финальный отчет
            end_time_total = time.time()
            total_time = end_time_total - start_time_total
            
            await websocket.send(json.dumps({
                'type': 'generation_completed',
                'success': True,
                'total_presets': len(presets),
                'successful_count': successful_count,
                'failed_count': failed_count,
                'total_time': round(total_time, 2),
                'output_directory': output_dir,
                'separate_bars': separate_bars,
                'message': f'Генерация завершена! Успешно: {successful_count}, Ошибок: {failed_count}, Общее время: {total_time:.2f}с'
            }))
            
            logger.info(f"Массовая генерация завершена. Успешно: {successful_count}, Ошибок: {failed_count}, Общее время: {total_time:.2f}с")
        
        except Exception as e:
            logger.error(f"Ошибка при массовой генерации графиков: {e}")
            await self.send_error(websocket, f"Ошибка при массовой генерации: {str(e)}")
    
    async def send_error(self, websocket, error_message):
        """Отправляет сообщение об ошибке клиенту"""
        response = {
            'type': 'error',
            'success': False,
            'error': error_message
        }
        await websocket.send(json.dumps(response))
    
    async def stop(self):
        """Остановка сервера"""
        await self.db_manager.close()
        logger.info("WebSocket сервер остановлен")

async def main():
    """Главная функция"""
    server = WebSocketChartServer()
    try:
        await server.start()
    except KeyboardInterrupt:
        logger.info("Получен сигнал остановки")
    except Exception as e:
        logger.error(f"Критическая ошибка: {e}")
    finally:
        await server.stop()

if __name__ == "__main__":
    asyncio.run(main()) 