#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import asyncio
import os
import json
import time
from datetime import datetime
import aiomysql
import aiofiles
from chart_generator import (
    fetch_grouped_ohlcv,
    fetch_pool_info,
    render_chart,
    process_font_data
)

class BatchChartGenerator:
    """Генератор для массового создания графиков всех пресетов"""
    
    def __init__(self):
        self.config = {
            'host': os.environ.get('MARIA_HOST', '127.0.0.1'),
            'user': os.environ.get('MARIA_USER', 'root'),
            'password': os.environ.get('MARIA_PASSWORD', 'root'),
            'db': os.environ.get('MARIA_DB', 'tchart'),
            'port': int(os.environ.get('MARIA_PORT', '3306')),
            'charset': 'utf8mb4',
            'autocommit': True
        }
        self.pool = None
    
    async def connect_db(self):
        """Подключение к базе данных"""
        try:
            self.pool = await aiomysql.create_pool(**self.config)
            print("✓ Подключение к базе данных MariaDB успешно")
        except Exception as e:
            print(f"✗ Ошибка подключения к базе данных: {e}")
            raise
    
    async def close_db(self):
        """Закрытие подключения к базе данных"""
        if self.pool:
            self.pool.close()
            await self.pool.wait_closed()
            print("✓ Подключение к базе данных закрыто")
    
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
                    
                    print(f"✓ Получено {len(presets)} одобренных пресетов")
                    return presets
        except Exception as e:
            print(f"✗ Ошибка при получении пресетов: {e}")
            return []
    
    async def get_preset_config(self, preset_name: str):
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
                print(f"⚠ Файл конфигурации не найден: {config_path}")
                return None
        except Exception as e:
            print(f"✗ Ошибка при чтении конфигурации пресета {preset_name}: {e}")
            return None
    
    async def generate_all_charts(self, pool_address, num_bars=20, network='polygon_pos', 
                                 interval='1h', token_name='', output_dir='d:\\temp\\charts', clear_directory=False):
        """Генерирует графики для всех пресетов"""
        
        print(f"🚀 Начинаем массовую генерацию графиков...")
        print(f"📊 Адрес пула: {pool_address}")
        print(f"📈 Количество баров: {num_bars}")
        print(f"🌐 Сеть: {network}")
        print(f"⏰ Интервал: {interval}")
        if token_name:
            print(f"🏷️ Token Name: {token_name}")
        print(f"📁 Папка сохранения: {output_dir}")
        print("-" * 50)
        
        # Очищаем директорию если требуется
        if clear_directory and os.path.exists(output_dir):
            try:
                import shutil
                shutil.rmtree(output_dir)
                print(f"🗑️ Директория очищена: {output_dir}")
            except Exception as e:
                print(f"❌ Ошибка при очистке директории {output_dir}: {e}")
        
        # Создаем директорию если не существует
        os.makedirs(output_dir, exist_ok=True)
        print(f"✓ Директория создана/проверена: {output_dir}")
        
        # Получаем все одобренные пресеты
        presets = await self.get_approved_presets()
        if not presets:
            print("✗ Нет доступных пресетов")
            return
        
        print(f"📋 Найдено {len(presets)} пресетов для обработки")
        
        # Получаем данные OHLCV
        print("📡 Получаем данные OHLCV...")
        ohlcv_data = fetch_grouped_ohlcv(network, pool_address, interval, num_bars)
        if not ohlcv_data:
            print("✗ Не удалось получить данные OHLCV")
            return
        
        print("📡 Получаем информацию о токене...")
        token_info = fetch_pool_info(network, pool_address)
        if not token_info:
            print("✗ Не удалось получить информацию о токене")
            return
        
        print(f"✓ Данные получены успешно")
        print(f"   Токен: {token_info.get('name', 'Unknown')} ({token_info.get('symbol', '???')})")
        print(f"   Цена: ${token_info.get('priceUsd', 0):.6f}")
        print(f"   Изменение 24ч: {token_info.get('priceChange', {}).get('24h', 0):.2f}%")
        
        # Данные уже сгруппированы и обрезаны fetch_grouped_ohlcv
        
        # Генерируем графики для каждого пресета
        successful_count = 0
        failed_count = 0
        start_time_total = time.time()
        
        print("\n🎨 Начинаем генерацию графиков...")
        print("-" * 50)
        
        for i, preset in enumerate(presets):
            start_time_preset = time.time()
            try:
                print(f"[{i+1:2d}/{len(presets)}] Обрабатываем пресет: {preset['name']}")
                
                # Получаем конфигурацию пресета
                config = await self.get_preset_config(preset['name'])
                if not config:
                    print(f"   ⚠ Пропускаем - конфигурация не найдена")
                    failed_count += 1
                    continue
                
                # Обновляем конфигурацию с переданными параметрами
                config['network'] = network
                config['poolAddress'] = pool_address
                config['numBars'] = num_bars
                config['interval'] = interval
                
                # Подменяем displayName если передан token_name
                if token_name and token_name.strip():
                    if 'displayName' in config:
                        config['displayName'] = token_name.strip()
                        print(f"   🏷️ Подменен displayName на: {token_name}")
                
                # Обрабатываем данные шрифта
                config = process_font_data(config)
                
                # Генерируем имя файла
                timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
                filename = f"{preset['name']}_{timestamp}.png"
                output_path = os.path.join(output_dir, filename)
                
                # Генерируем график
                success = render_chart(config, ohlcv_data, token_info, output_path)
                
                if success:
                    successful_count += 1
                    end_time_preset = time.time()
                    preset_time = end_time_preset - start_time_preset
                    print(f"   ✅ Сохранен: {filename} ({preset_time:.2f}с)")
                else:
                    failed_count += 1
                    end_time_preset = time.time()
                    preset_time = end_time_preset - start_time_preset
                    print(f"   ❌ Ошибка генерации ({preset_time:.2f}с)")
                
            except Exception as e:
                failed_count += 1
                end_time_preset = time.time()
                preset_time = end_time_preset - start_time_preset
                print(f"   ❌ Ошибка: {str(e)} ({preset_time:.2f}с)")
        
        # Выводим итоговую статистику
        end_time_total = time.time()
        total_duration = end_time_total - start_time_total
        
        print("\n" + "=" * 50)
        print("📊 ИТОГОВАЯ СТАТИСТИКА")
        print("=" * 50)
        print(f"📋 Всего пресетов: {len(presets)}")
        print(f"✅ Успешно сгенерировано: {successful_count}")
        print(f"❌ Ошибок: {failed_count}")
        print(f"⏱️ Общее время выполнения: {total_duration:.2f} секунд")
        print(f"📁 Папка с результатами: {output_dir}")
        
        if successful_count > 0:
            print(f"\n🎉 Генерация завершена успешно!")
            print(f"📂 Откройте папку {output_dir} для просмотра результатов")
        else:
            print(f"\n⚠ Не удалось сгенерировать ни одного графика")
    
    async def run(self, pool_address, num_bars=20, network='polygon_pos', 
                  interval='hour', token_name='', output_dir='d:\\temp\\charts', clear_directory=False):
        """Запуск генератора"""
        try:
            await self.connect_db()
            await self.generate_all_charts(pool_address, num_bars, network, interval, token_name, output_dir, clear_directory)
        except Exception as e:
            print(f"✗ Критическая ошибка: {e}")
        finally:
            await self.close_db()

def main():
    """Главная функция"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Массовая генерация графиков для всех пресетов")
    parser.add_argument("pool_address", help="Адрес пула ликвидности")
    parser.add_argument("--num-bars", "-n", type=int, default=20, help="Количество баров (по умолчанию: 20)")
    parser.add_argument("--network", "-net", default="polygon_pos", help="Сеть (по умолчанию: polygon_pos)")
    parser.add_argument("--interval", "-i", default="hour", help="Интервал (по умолчанию: hour)")
    parser.add_argument("--token-name", "-t", default="", help="Название токена для подмены displayName")
    parser.add_argument("--output-dir", "-o", default="d:\\temp\\charts", help="Папка для сохранения (по умолчанию: d:\\temp\\charts)")
    parser.add_argument("--clear", "-c", action="store_true", help="Очистить папку перед генерацией")
    
    args = parser.parse_args()
    
    # Проверяем адрес пула
    if not args.pool_address.startswith('0x'):
        print("✗ Ошибка: адрес пула должен начинаться с 0x")
        return
    
    print("🎨 Batch Chart Generator")
    print("=" * 50)
    
    # Запускаем генератор
    generator = BatchChartGenerator()
    asyncio.run(generator.run(
        pool_address=args.pool_address,
        num_bars=args.num_bars,
        network=args.network,
        interval=args.interval,
        token_name=args.token_name,
        output_dir=args.output_dir,
        clear_directory=args.clear
    ))

if __name__ == "__main__":
    main() 