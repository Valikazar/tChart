# WebSocket Chart Server

WebSocket сервер для работы с графиками, который предоставляет API для получения списка пресетов и генерации графиков в формате base64.

## Возможности

- Получение списка одобренных пресетов из базы данных
- Генерация графиков на основе пресетов
- Кэширование запросов к CoinGecko API (2 минуты)
- Возврат изображений в формате base64
- Асинхронная обработка запросов

## Установка

1. Установите зависимости:
```bash
pip install -r websocket_requirements.txt
```

2. Настройте переменные окружения для базы данных:
```bash
export MARIA_HOST=localhost
export MARIA_USER=root
export MARIA_PASSWORD=root
export MARIA_DB=tchart
export MARIA_PORT=3306
```

3. Убедитесь, что сервер API (port 3001) запущен:
```bash
node tChartServerAPI.js
```

## Запуск

```bash
python websocket_chart_server.py
```

Сервер будет доступен по адресу `ws://localhost:8765`

## API Команды

### Получение списка пресетов

**Запрос:**
```json
{
  "command": "get_presets"
}
```

**Ответ:**
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

### Генерация графика

**Запрос:**
```json
{
  "command": "generate_chart",
  "preset_name": "polmoon",
  "pool_address": "0x1234567890abcdef1234567890abcdef12345678",
  "num_bars": 20,
  "network": "polygon_pos",
  "interval": "hour"
}
```

**Ответ:**
```json
{
  "type": "chart_generated",
  "success": true,
  "base64_image": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
  "token_info": {
    "name": "PolygonMoon",
    "symbol": "PMOON",
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

## Параметры запроса генерации

- `preset_name` (обязательный) - имя пресета из базы данных
- `pool_address` (обязательный) - адрес ликвидности
- `num_bars` (опциональный, по умолчанию 20) - количество свечей
- `network` (опциональный, по умолчанию "polygon_pos") - сеть блокчейна
- `interval` (опциональный, по умолчанию "hour") - интервал времени

## Кэширование

Сервер кэширует запросы к CoinGecko API на 2 минуты. Если запрос к той же паре (network:pool_address:interval) был сделан менее 2 минут назад, будут использованы кэшированные данные.

## Поддерживаемые сети

- `polygon_pos` - Polygon
- `ethereum` - Ethereum
- `bsc` - Binance Smart Chain
- `arbitrum` - Arbitrum
- `optimism` - Optimism
- И другие сети, поддерживаемые GeckoTerminal API

## Интервалы времени

- `minute` - 1 минута
- `hour` - 1 час
- `day` - 1 день

## Обработка ошибок

При возникновении ошибок сервер возвращает сообщение в формате:
```json
{
  "type": "error",
  "success": false,
  "error": "Описание ошибки"
}
```

## Примеры использования

### JavaScript клиент

```javascript
const ws = new WebSocket('ws://localhost:8765');

ws.onopen = function() {
  // Получить список пресетов
  ws.send(JSON.stringify({command: 'get_presets'}));
};

ws.onmessage = function(event) {
  const data = JSON.parse(event.data);
  
  if (data.type === 'presets_list') {
    console.log('Пресеты:', data.presets);
    
    // Генерировать график
    ws.send(JSON.stringify({
      command: 'generate_chart',
      preset_name: data.presets[0].name,
      pool_address: '0x1234567890abcdef1234567890abcdef12345678',
      num_bars: 25
    }));
  }
  
  if (data.type === 'chart_generated') {
    console.log('График создан:', data.base64_image);
    // Показать изображение в img элементе
    document.getElementById('chart').src = data.base64_image;
  }
};
```

### Python клиент

```python
import asyncio
import websockets
import json

async def test_client():
    uri = "ws://localhost:8765"
    async with websockets.connect(uri) as websocket:
        # Получить пресеты
        await websocket.send(json.dumps({"command": "get_presets"}))
        response = await websocket.recv()
        data = json.loads(response)
        
        if data['success']:
            print(f"Доступно пресетов: {len(data['presets'])}")
            
            # Генерировать график
            await websocket.send(json.dumps({
                "command": "generate_chart",
                "preset_name": data['presets'][0]['name'],
                "pool_address": "0x1234567890abcdef1234567890abcdef12345678",
                "num_bars": 30
            }))
            
            response = await websocket.recv()
            chart_data = json.loads(response)
            
            if chart_data['success']:
                print("График успешно создан!")
                # Сохранить base64 в файл
                import base64
                image_data = chart_data['base64_image'].split(',')[1]
                with open('chart.png', 'wb') as f:
                    f.write(base64.b64decode(image_data))

asyncio.run(test_client())
```

## Логирование

Сервер ведет подробные логи всех операций:
- Подключения/отключения клиентов
- Обработка команд
- Кэширование данных
- Ошибки и исключения

## Производительность

- Асинхронная обработка запросов
- Кэширование API запросов
- Автоматическое удаление временных файлов
- Пул соединений с базой данных

## Требования

- Python 3.7+
- MariaDB/MySQL база данных
- Запущенный API сервер (port 3001)
- Доступ к интернету для запросов к CoinGecko API 