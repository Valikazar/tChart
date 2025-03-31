#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Генератор графиков криптовалютных пар на основе данных GeckoTerminal

Этот скрипт получает данные OHLCV (Open, High, Low, Close, Volume) для указанной криптовалютной пары 
с API GeckoTerminal и генерирует график с использованием функции renderChart из проекта. 
График сохраняется в формате PNG.

Использование:
    python chart-generator.py path/to/config.json [--output output.png]

Аргументы:
    config_file - путь к файлу конфигурации в формате JSON
    --output, -o - путь для сохранения сгенерированного графика (по умолчанию: chart.png)

Пример конфигурационного файла:
{
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
  "upBar": {
    "color": "#26a69a"
  },
  "downBar": {
    "color": "#ef5350"
  },
  "network": "polygon_pos",
  "poolAddress": "0xa030be97a53d6462c675962fec3eafbe53b8bb6c",
  "numBars": 20,
  "interval": "hour"
}

Требования:
1. Установленный Node.js
2. Установленный пакет skia-canvas для Node.js: npm install skia-canvas
3. Python библиотеки: requests

Автор: [Ваше имя]
Дата: [Дата создания]
"""

import argparse
import json
import os
import requests
import sys
import subprocess
import base64
from pathlib import Path

# Константы
DEFAULT_WIDTH = 1280
DEFAULT_HEIGHT = 1280
OUTPUT_FORMAT = 'png'

def load_config(config_path):
    """Загрузка конфигурации из JSON-файла"""
    try:
        with open(config_path, 'r', encoding='utf-8') as file:
            return json.load(file)
    except Exception as e:
        print(f"Ошибка при загрузке конфигурации: {e}")
        sys.exit(1)

def fetch_data_from_geckoterminal(config):
    """Получение данных из GeckoTerminal API"""
    # Получаем настройки из конфигурации
    network = config.get('network', 'polygon_pos')
    pool_address = config.get('poolAddress', '')
    interval = config.get('interval', 'hour')
    
    if not pool_address:
        print("Ошибка: не указан адрес пула в конфигурации")
        sys.exit(1)
    
    # Формируем URL для запроса OHLCV данных
    ohlcv_url = f"https://api.geckoterminal.com/api/v2/networks/{network}/pools/{pool_address}/ohlcv/{interval}"
    
    # Формируем URL для запроса информации о токене
    token_info_url = f"https://api.geckoterminal.com/api/v2/networks/{network}/pools/{pool_address}"
    
    try:
        # Запрос OHLCV данных
        ohlcv_response = requests.get(ohlcv_url)
        ohlcv_data = ohlcv_response.json()
        
        if 'errors' in ohlcv_data:
            print(f"Ошибка при получении OHLCV данных: {ohlcv_data['errors']}")
            sys.exit(1)
        
        # Получаем свечи из ответа API
        ohlcv_list = ohlcv_data.get('data', {}).get('attributes', {}).get('ohlcv_list', [])
        
        # Ограничиваем количество баров, если указано в конфигурации
        num_bars = config.get('numBars', len(ohlcv_list))
        ohlcv_list = ohlcv_list[:num_bars]
        
        # Запрос информации о токене
        token_response = requests.get(token_info_url)
        token_data = token_response.json()
        
        if 'errors' in token_data:
            print(f"Ошибка при получении информации о токене: {token_data['errors']}")
            sys.exit(1)
        
        # Формируем структуру TokenInfo
        token_attributes = token_data.get('data', {}).get('attributes', {})
        base_token_info = token_data.get('data', {}).get('relationships', {}).get('base_token', {}).get('data', {})
        
        token_info = {
            'marketCap': float(token_attributes.get('fdv_usd', 0)),
            'priceUsd': float(token_attributes.get('base_token_price_usd', 0)),
            'priceChange': {
                '5m': float(token_attributes.get('price_change_percentage', {}).get('m5', 0)),
                '1h': float(token_attributes.get('price_change_percentage', {}).get('h1', 0)),
                '6h': float(token_attributes.get('price_change_percentage', {}).get('h6', 0)),
                '24h': float(token_attributes.get('price_change_percentage', {}).get('h24', 0))
            },
            'name': base_token_info.get('id', '').split('_')[-1]
        }
        
        return {
            'ohlcv_data': ohlcv_list,
            'token_info': token_info,
            'interval': interval
        }
        
    except requests.RequestException as e:
        print(f"Ошибка соединения с GeckoTerminal API: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"Произошла ошибка: {e}")
        sys.exit(1)

def save_temp_json_for_node(data, config, output_path):
    """Сохраняет временный JSON файл для передачи в Node.js скрипт"""
    temp_data = {
        'config': config,
        'data': data['ohlcv_data'],
        'tokenInfo': data['token_info'],
        'interval': data['interval'],
        'width': DEFAULT_WIDTH,
        'height': DEFAULT_HEIGHT,
        'outputPath': output_path
    }
    
    temp_file_path = 'temp_chart_data.json'
    with open(temp_file_path, 'w', encoding='utf-8') as file:
        json.dump(temp_data, file, ensure_ascii=False, indent=2)
    
    return temp_file_path

def create_node_script():
    """Создает временный Node.js скрипт для вызова функции renderChart"""
    script_content = r"""
const fs = require('fs');
const path = require('path');

// Загружаем данные из временного файла
const inputData = JSON.parse(fs.readFileSync('temp_chart_data.json', 'utf8'));

async function main() {
    try {
        // Убедимся, что skia-canvas установлен
        try {
            require('skia-canvas');
        } catch (e) {
            console.error('Ошибка: skia-canvas не установлен. Установите его: npm install skia-canvas');
            process.exit(1);
        }

        // Используем существующий JavaScript файл chartRenderer.js вместо TypeScript
        const { renderChart } = require('./src/utils/chartRenderer.js');
        
        // Вызываем функцию renderChart
        const result = await renderChart({
            config: inputData.config,
            data: inputData.data,
            tokenInfo: inputData.tokenInfo,
            interval: inputData.interval,
            width: inputData.width,
            height: inputData.height
        });
        
        // Сохраняем результат в виде Base64
        if (result) {
            // Если результат - строка в формате base64
            let base64Data = result;
            if (typeof result === 'object' && result.base64) {
                base64Data = result.base64;
            }
            
            // Удаляем префикс data:image/png;base64, если он есть
            base64Data = base64Data.replace(/^data:image\/png;base64,/, '');
            
            fs.writeFileSync('chart_base64.txt', base64Data);
            
            // Если есть буфер и outputPath, сохраняем файл напрямую
            if (result.buffer && inputData.outputPath) {
                fs.writeFileSync(inputData.outputPath, result.buffer);
                console.log('График успешно сгенерирован и сохранен напрямую в файл');
            } else {
                console.log('График успешно сгенерирован и сохранен в base64');
            }
        }
    } catch (error) {
        console.error('Ошибка при генерации графика:', error);
        process.exit(1);
    }
}

main();
"""
    
    script_path = 'generate_chart.js'
    with open(script_path, 'w', encoding='utf-8') as file:
        file.write(script_content)
    
    return script_path

def run_node_script(script_path):
    """Запускает Node.js скрипт"""
    try:
        result = subprocess.run(['node', script_path], 
                              check=True, 
                              capture_output=True, 
                              text=True, 
                              encoding='utf-8')
        print(result.stdout)
        return True
    except subprocess.CalledProcessError as e:
        print(f"Ошибка при выполнении Node.js скрипта: {e}")
        print(f"Вывод скрипта: {e.stdout}")
        print(f"Ошибка скрипта: {e.stderr}")
        return False

def save_chart_from_base64(output_path):
    """Сохраняет изображение из Base64 данных"""
    try:
        # Проверяем, существует ли файл уже (мог быть сохранен напрямую)
        if os.path.exists(output_path):
            print(f"Файл уже существует: {output_path}")
            return
            
        with open('chart_base64.txt', 'r') as file:
            base64_data = file.read().strip()
        
        binary_data = base64.b64decode(base64_data)
        
        with open(output_path, 'wb') as file:
            file.write(binary_data)
        
        print(f"График успешно сохранен в {output_path}")
    except Exception as e:
        print(f"Ошибка при сохранении изображения: {e}")
    finally:
        # Удаляем временные файлы
        for temp_file in ['temp_chart_data.json', 'chart_base64.txt', 'generate_chart.js']:
            if os.path.exists(temp_file):
                os.remove(temp_file)

def main():
    # Создаем парсер аргументов командной строки
    parser = argparse.ArgumentParser(description='Генератор графиков на основе данных GeckoTerminal')
    parser.add_argument('config_file', help='Путь к файлу конфигурации JSON')
    parser.add_argument('--output', '-o', default='chart.png', help='Путь для сохранения сгенерированного графика')
    
    args = parser.parse_args()
    
    # Преобразуем пути в абсолютные
    config_path = os.path.abspath(args.config_file)
    output_path = os.path.abspath(args.output)
    
    # Создаем директорию для выходного файла, если её нет
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    # Загружаем конфигурацию
    config = load_config(config_path)
    
    # Получаем данные из GeckoTerminal
    data = fetch_data_from_geckoterminal(config)
    
    # Сохраняем данные во временный JSON файл
    temp_json_path = save_temp_json_for_node(data, config, output_path)
    
    # Создаем Node.js скрипт
    node_script_path = create_node_script()
    
    # Запускаем Node.js скрипт
    success = run_node_script(node_script_path)
    
    if success:
        # Сохраняем изображение из Base64
        save_chart_from_base64(output_path)

if __name__ == "__main__":
    main() 