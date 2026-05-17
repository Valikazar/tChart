#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import asyncio
import websockets
import json
import base64
import sys

async def test_websocket_server():
    """Тестирует WebSocket сервер"""
    uri = "ws://localhost:8765"
    
    try:
        print("Подключение к WebSocket серверу...")
        async with websockets.connect(uri) as websocket:
            print("✓ Подключение установлено")
            
            # Тест 1: Получение списка пресетов
            print("\n1. Тестирование получения списка пресетов...")
            await websocket.send(json.dumps({"command": "get_presets"}))
            response = await websocket.recv()
            data = json.loads(response)
            
            if data.get('success'):
                presets = data.get('presets', [])
                print(f"✓ Получено {len(presets)} пресетов")
                
                if presets:
                    print("Доступные пресеты:")
                    for i, preset in enumerate(presets[:5]):  # Показываем первые 5
                        print(f"  {i+1}. {preset['name']} (жанр: {preset['genre']}, теги: {preset['tags']})")
                    
                    # Тест 2: Генерация графика
                    print(f"\n2. Тестирование генерации графика для пресета '{presets[0]['name']}'...")
                    
                    # Используем тестовый адрес пула Polygon
                    test_pool_address = "0x1d734a02ef6e87b83c6a3b847b1e4a2a30a9b9b4"  # Пример адреса
                    
                    chart_request = {
                        "command": "generate_chart",
                        "preset_name": presets[0]['name'],
                        "pool_address": test_pool_address,
                        "num_bars": 15,
                        "network": "polygon_pos",
                        "interval": "hour"
                    }
                    
                    await websocket.send(json.dumps(chart_request))
                    print("Запрос отправлен, ожидание ответа...")
                    
                    response = await websocket.recv()
                    chart_data = json.loads(response)
                    
                    if chart_data.get('success'):
                        print("✓ График успешно создан!")
                        
                        # Сохраняем изображение
                        if 'base64_image' in chart_data:
                            image_data = chart_data['base64_image'].split(',')[1]
                            with open('test_chart.png', 'wb') as f:
                                f.write(base64.b64decode(image_data))
                            print("✓ График сохранен как test_chart.png")
                            
                            # Выводим информацию о токене
                            if 'token_info' in chart_data:
                                token = chart_data['token_info']
                                print(f"✓ Информация о токене:")
                                print(f"  Название: {token.get('name', 'N/A')}")
                                print(f"  Символ: {token.get('symbol', 'N/A')}")
                                print(f"  Цена: ${token.get('priceUsd', 0):.6f}")
                                print(f"  Изменение 24ч: {token.get('priceChange', {}).get('24h', 0):.2f}%")
                    else:
                        print("✗ Ошибка при создании графика:", chart_data.get('error'))
                        
                else:
                    print("Нет доступных пресетов для тестирования")
                    
            else:
                print("✗ Ошибка при получении пресетов:", data.get('error'))
                
            # Тест 3: Неверная команда
            print("\n3. Тестирование обработки неверной команды...")
            await websocket.send(json.dumps({"command": "invalid_command"}))
            response = await websocket.recv()
            data = json.loads(response)
            
            if data.get('type') == 'error':
                print("✓ Ошибка корректно обработана:", data.get('error'))
            else:
                print("✗ Неожиданный ответ на неверную команду")
                
    except websockets.exceptions.ConnectionRefused:
        print("✗ Не удалось подключиться к серверу")
        print("Убедитесь, что WebSocket сервер запущен на порту 8765")
        print("Команда для запуска: python websocket_chart_server.py")
        sys.exit(1)
    except Exception as e:
        print(f"✗ Ошибка тестирования: {e}")
        sys.exit(1)

async def test_chart_generation_with_custom_params():
    """Тестирует генерацию графика с кастомными параметрами"""
    uri = "ws://localhost:8765"
    
    try:
        print("\n=== Тест с кастомными параметрами ===")
        async with websockets.connect(uri) as websocket:
            # Параметры для тестирования
            test_cases = [
                {
                    "name": "Тест с 30 барами",
                    "preset_name": "polmoon",  # Замените на существующий пресет
                    "pool_address": "0x1d734a02ef6e87b83c6a3b847b1e4a2a30a9b9b4",
                    "num_bars": 30,
                    "network": "polygon_pos",
                    "interval": "hour"
                },
                {
                    "name": "Тест с минутным интервалом",
                    "preset_name": "polmoon",
                    "pool_address": "0x1d734a02ef6e87b83c6a3b847b1e4a2a30a9b9b4",
                    "num_bars": 10,
                    "network": "polygon_pos",
                    "interval": "minute"
                }
            ]
            
            for i, test_case in enumerate(test_cases):
                print(f"\n{i+1}. {test_case['name']}...")
                
                chart_request = {
                    "command": "generate_chart",
                    **{k: v for k, v in test_case.items() if k != 'name'}
                }
                
                await websocket.send(json.dumps(chart_request))
                response = await websocket.recv()
                data = json.loads(response)
                
                if data.get('success'):
                    print(f"✓ {test_case['name']} - успешно")
                    
                    # Сохраняем с уникальным именем
                    if 'base64_image' in data:
                        filename = f"test_chart_{i+1}.png"
                        image_data = data['base64_image'].split(',')[1]
                        with open(filename, 'wb') as f:
                            f.write(base64.b64decode(image_data))
                        print(f"  Сохранено как {filename}")
                else:
                    print(f"✗ {test_case['name']} - ошибка: {data.get('error')}")
                    
    except Exception as e:
        print(f"✗ Ошибка при тестировании кастомных параметров: {e}")

if __name__ == "__main__":
    print("=== Тестирование WebSocket Chart Server ===\n")
    
    try:
        # Основные тесты
        asyncio.run(test_websocket_server())
        
        # Дополнительные тесты
        asyncio.run(test_chart_generation_with_custom_params())
        
        print("\n=== Тестирование завершено ===")
        
    except KeyboardInterrupt:
        print("\nТестирование прервано пользователем")
        sys.exit(0) 