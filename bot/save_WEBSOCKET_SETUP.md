# Установка и использование WebSocket Chart Server

## Быстрый старт

### 1. Установка зависимостей

```bash
# Переходим в папку с ботом
cd bot

# Устанавливаем зависимости для WebSocket сервера
pip install -r websocket_requirements.txt
```

### 2. Настройка переменных окружения

```bash
# Windows (PowerShell)
$env:MARIA_HOST="localhost"
$env:MARIA_USER="root"
$env:MARIA_PASSWORD="root"
$env:MARIA_DB="tchart"
$env:MARIA_PORT="3306"

# Linux/Mac
export MARIA_HOST=localhost
export MARIA_USER=root
export MARIA_PASSWORD=root
export MARIA_DB=tchart
export MARIA_PORT=3306
```

### 3. Запуск основного API сервера

```bash
# Из корневой папки проекта
node tChartServerAPI.js
```

### 4. Запуск WebSocket сервера

```bash
# Из папки bot
python websocket_chart_server.py
```

### 5. Тестирование

```bash
# Запуск тестов
python test_websocket_client.py

# Или откройте в браузере
# bot/websocket_test.html
```

## Использование

### Подключение к WebSocket серверу

```javascript
const ws = new WebSocket('ws://localhost:8765');
```

### Получение списка пресетов

```javascript
ws.send(JSON.stringify({
    command: 'get_presets'
}));
```

### Генерация графика

```javascript
ws.send(JSON.stringify({
    command: 'generate_chart',
    preset_name: 'polmoon',
    pool_address: '0x1d734a02ef6e87b83c6a3b847b1e4a2a30a9b9b4',
    num_bars: 20,
    network: 'polygon_pos',
    interval: 'hour'
}));
```

## Структура ответов

### Список пресетов

```json
{
    "type": "presets_list",
    "success": true,
    "presets": [
        {
            "id": 1,
            "name": "preset_name",
            "owner": "0x...",
            "genre": "meme",
            "approved": true,
            "uses": 10,
            "likes": 5,
            "tags": ["crypto", "meme"],
            "created_at": "2023-12-01T12:00:00Z"
        }
    ]
}
```

### Сгенерированный график

```json
{
    "type": "chart_generated",
    "success": true,
    "base64_image": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
    "token_info": {
        "name": "Token Name",
        "symbol": "TKN",
        "priceUsd": 0.001234,
        "marketCap": 1234567,
        "priceChange": {
            "5m": 1.5,
            "1h": -2.3,
            "6h": 5.7,
            "24h": 12.4
        },
        "volume": 987654
    }
}
```

## Кэширование

Система автоматически кэширует запросы к CoinGecko API на 2 минуты. Это означает, что если вы запросите график для той же пары (сеть:адрес:интервал) в течение 2 минут, будут использованы кэшированные данные.

## Поддерживаемые параметры

### Сети (network)
- `polygon_pos` - Polygon (по умолчанию)
- `ethereum` - Ethereum
- `bsc` - Binance Smart Chain
- `arbitrum` - Arbitrum
- `optimism` - Optimism

### Интервалы (interval)
- `minute` - 1 минута
- `hour` - 1 час (по умолчанию)
- `day` - 1 день

### Количество баров (num_bars)
- Минимум: 5
- Максимум: 100
- По умолчанию: 20

## Требования к системе

1. **Python 3.7+** с установленными зависимостями
2. **MariaDB/MySQL** база данных с таблицей `presets`
3. **Node.js** сервер API на порту 3001
4. **Интернет соединение** для запросов к CoinGecko API

## Устранение неполадок

### Ошибка подключения к базе данных

```
Проверьте:
- Запущен ли сервер базы данных
- Правильность настроек подключения
- Существует ли база данных 'tchart'
- Имеет ли пользователь права доступа
```

### Ошибка подключения к API серверу

```
Проверьте:
- Запущен ли сервер на порту 3001
- Доступен ли localhost:3001
- Нет ли конфликтов портов
```

### Ошибка получения данных от CoinGecko

```
Проверьте:
- Подключение к интернету
- Правильность адреса пула
- Поддерживается ли сеть в GeckoTerminal API
```

## Дополнительные возможности

### Логирование

Сервер ведет подробные логи всех операций. Уровень логирования можно изменить в файле `websocket_chart_server.py`:

```python
logging.basicConfig(level=logging.DEBUG)  # Для детального логирования
```

### Настройка кэша

Время жизни кэша можно изменить в классе `CacheManager`:

```python
self.cache_ttl = 300  # 5 минут вместо 2
```

### Настройка портов

Порт WebSocket сервера можно изменить при создании объекта:

```python
server = WebSocketChartServer(host='localhost', port=8080)
```

## Интеграция с другими системами

### Телеграм бот

Добавьте в ваш Телеграм бот:

```python
import websockets
import asyncio
import json

async def get_chart_via_websocket(preset_name, pool_address, num_bars=20):
    uri = "ws://localhost:8765"
    async with websockets.connect(uri) as websocket:
        await websocket.send(json.dumps({
            "command": "generate_chart",
            "preset_name": preset_name,
            "pool_address": pool_address,
            "num_bars": num_bars
        }))
        
        response = await websocket.recv()
        data = json.loads(response)
        
        if data.get('success'):
            return data['base64_image']
        else:
            raise Exception(data.get('error', 'Unknown error'))
```

### Discord бот

Аналогично для Discord бота:

```python
import discord
import websockets
import asyncio
import json
import base64
import io

async def send_chart_to_discord(channel, preset_name, pool_address):
    uri = "ws://localhost:8765"
    async with websockets.connect(uri) as websocket:
        await websocket.send(json.dumps({
            "command": "generate_chart",
            "preset_name": preset_name,
            "pool_address": pool_address
        }))
        
        response = await websocket.recv()
        data = json.loads(response)
        
        if data.get('success'):
            # Конвертируем base64 в файл
            image_data = data['base64_image'].split(',')[1]
            image_bytes = base64.b64decode(image_data)
            
            # Отправляем в Discord
            file = discord.File(io.BytesIO(image_bytes), filename='chart.png')
            await channel.send(file=file)
        else:
            await channel.send(f"Ошибка: {data.get('error')}")
```

## Мониторинг

Для мониторинга работы сервера можно использовать:

1. **Логи** - все операции записываются в консоль
2. **Количество подключений** - отслеживается в `connected_clients`
3. **Статистика кэша** - количество попаданий/промахов

## Масштабирование

Для увеличения производительности:

1. **Увеличьте пул соединений** с базой данных
2. **Используйте Redis** для кэширования вместо памяти
3. **Запустите несколько экземпляров** с балансировщиком нагрузки
4. **Оптимизируйте запросы** к базе данных

## Безопасность

Рекомендации по безопасности:

1. **Используйте HTTPS/WSS** в продакшене
2. **Добавьте аутентификацию** для доступа к API
3. **Ограничьте частоту запросов** (rate limiting)
4. **Валидируйте входные данные** более строго 