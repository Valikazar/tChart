# Массовая генерация графиков

## Описание

Система поддерживает массовую генерацию графиков для всех одобренных пресетов. Это позволяет быстро создать графики для всех доступных стилей с одними и теми же данными.

## Способы использования

### 1. Через WebSocket API

Отправьте команду через WebSocket:

```json
{
    "command": "generate_all_charts",
    "pool_address": "0x1d734a02ef6e87b83c6a3b847b1e4a2a30a9b9b4",
    "num_bars": 20,
    "network": "polygon_pos",
    "interval": "hour",
    "token_name": "My Custom Token",
    "output_dir": "d:\\temp\\charts",
    "clear_directory": true
}
```

**Параметры:**
- `pool_address` (обязательный) - адрес пула ликвидности
- `num_bars` (опциональный, по умолчанию 20) - количество свечей
- `network` (опциональный, по умолчанию "polygon_pos") - сеть блокчейна
- `interval` (опциональный, по умолчанию "hour") - интервал времени
- `token_name` (опциональный) - название токена для подмены displayName в пресетах
- `output_dir` (опциональный, по умолчанию "d:\\temp\\charts") - папка для сохранения
- `clear_directory` (опциональный, по умолчанию false) - очистить папку перед генерацией

### 2. Через командную строку

Используйте отдельный скрипт `batch_chart_generator.py`:

```bash
# Базовое использование
python batch_chart_generator.py 0x1d734a02ef6e87b83c6a3b847b1e4a2a30a9b9b4

# С дополнительными параметрами
python save_batch_chart_generator.py 0x1d734a02ef6e87b83c6a3b847b1e4a2a30a9b9b4 \
    --num-bars 30 \
    --network polygon_pos \
    --interval hour \
    --token-name "My Custom Token" \
    --output-dir "d:\\temp\\charts" \
    --clear
```

**Параметры командной строки:**
- `pool_address` - адрес пула (обязательный)
- `--num-bars, -n` - количество баров (по умолчанию 20)
- `--network, -net` - сеть (по умолчанию polygon_pos)
- `--interval, -i` - интервал (по умолчанию hour)
- `--token-name, -t` - название токена для подмены displayName
- `--output-dir, -o` - папка сохранения (по умолчанию d:\\temp\\charts)
- `--clear, -c` - очистить папку перед генерацией

### 3. Через веб-интерфейс

Откройте `websocket_test.html` в браузере и используйте кнопку "Создать все графики".

## Процесс генерации

### WebSocket API

При использовании WebSocket API вы получите следующие сообщения о прогрессе:

1. **directory_cleared** - очистка директории (если включена)
```json
{
    "type": "directory_cleared",
    "message": "Каталог d:\\temp\\charts очищен"
}
```

2. **directory_clear_error** - ошибка очистки директории
```json
{
    "type": "directory_clear_error",
    "error": "Ошибка очистки каталога: Permission denied"
}
```

3. **generation_started** - начало процесса
```json
{
    "type": "generation_started",
    "success": true,
    "total_presets": 15,
    "message": "Начинаем генерацию 15 графиков..."
}
```

2. **fetching_data** - получение данных
```json
{
    "type": "fetching_data",
    "message": "Получаем данные OHLCV..."
}
```

3. **generation_progress** - прогресс генерации
```json
{
    "type": "generation_progress",
    "current": 5,
    "total": 15,
    "preset_name": "polmoon",
    "message": "Генерируем график 5/15: polmoon"
}
```

4. **chart_saved** - успешное сохранение
```json
{
    "type": "chart_saved",
    "preset_name": "polmoon",
    "filename": "polmoon_20231201_143022.png",
    "path": "d:\\temp\\charts\\polmoon_20231201_143022.png",
    "generation_time": 1.23,
    "success": true
}
```

5. **chart_failed** - ошибка генерации
```json
{
    "type": "chart_failed",
    "preset_name": "broken_preset",
    "error": "Ошибка при генерации графика",
    "generation_time": 0.45
}
```

8. **generation_completed** - завершение процесса
```json
{
    "type": "generation_completed",
    "success": true,
    "total_presets": 15,
    "successful_count": 13,
    "failed_count": 2,
    "total_time": 45.23,
    "output_directory": "d:\\temp\\charts",
    "message": "Генерация завершена! Успешно: 13, Ошибок: 2, Общее время: 45.23с"
}
```

### Командная строка

При использовании скрипта командной строки вы увидите подробный вывод в консоли:

```
🎨 Batch Chart Generator
==================================================
🚀 Начинаем массовую генерацию графиков...
📊 Адрес пула: 0x1d734a02ef6e87b83c6a3b847b1e4a2a30a9b9b4
📈 Количество баров: 20
🌐 Сеть: polygon_pos
⏰ Интервал: hour
🏷️ Token Name: My Custom Token
📁 Папка сохранения: d:\temp\charts
--------------------------------------------------
✓ Директория создана/проверена: d:\temp\charts
✓ Получено 15 одобренных пресетов
📋 Найдено 15 пресетов для обработки
📡 Получаем данные OHLCV...
📡 Получаем информацию о токене...
✓ Данные получены успешно
   Токен: PolygonMoon (PMOON)
   Цена: $0.001234
   Изменение 24ч: +12.40%

🎨 Начинаем генерацию графиков...
--------------------------------------------------
[ 1/15] Обрабатываем пресет: polmoon
   🏷️ Подменен displayName на: My Custom Token
   ✅ Сохранен: polmoon_20231201_143022.png (1.23с)
[ 2/15] Обрабатываем пресет: gator
   🏷️ Подменен displayName на: My Custom Token
   ✅ Сохранен: gator_20231201_143023.png (0.98с)
...

==================================================
📊 ИТОГОВАЯ СТАТИСТИКА
==================================================
📋 Всего пресетов: 15
✅ Успешно сгенерировано: 13
❌ Ошибок: 2
⏱️ Общее время выполнения: 45.23 секунд
📁 Папка с результатами: d:\temp\charts

🎉 Генерация завершена успешно!
📂 Откройте папку d:\temp\charts для просмотра результатов
```

## Подмена названия токена

Система поддерживает подмену поля `displayName` в пресетах на пользовательское название токена. Это позволяет создавать графики с кастомными названиями токенов.

### Использование

**WebSocket API:**
```json
{
    "command": "generate_all_charts",
    "pool_address": "0x1d734a02ef6e87b83c6a3b847b1e4a2a30a9b9b4",
    "token_name": "My Custom Token",
    ...
}
```

**Командная строка:**
```bash
python save_batch_chart_generator.py 0x1d734a02ef6e87b83c6a3b847b1e4a2a30a9b9b4 --token-name "My Custom Token"
```

**Веб-интерфейс:**
Введите название токена в поле "Token Name" перед генерацией.

### Принцип работы

1. Если параметр `token_name` передан и не пустой, система подменяет поле `displayName` в конфигурации каждого пресета
2. Подмена происходит только если поле `displayName` существует в пресете
3. В логах отображается информация о подмене для каждого пресета

## Именование файлов

Файлы сохраняются в формате:
```
{preset_name}_{timestamp}.png
```

Примеры:
- `polmoon_20231201_143022.png`
- `gator_20231201_143023.png`
- `spice_20231201_143024.png`

## Кэширование

Система использует кэширование данных OHLCV и информации о токене. Если данные для той же пары (сеть:адрес:интервал) были запрошены менее 2 минут назад, будут использованы кэшированные данные, что значительно ускоряет процесс.

## Обработка ошибок

### Типичные ошибки:

1. **Конфигурация пресета не найдена**
   - Файл `.json` пресета отсутствует в папке `pic/presets/`
   - Решение: проверьте наличие файла конфигурации

2. **Ошибка получения данных OHLCV**
   - Неверный адрес пула
   - Сеть не поддерживается GeckoTerminal API
   - Проблемы с интернет-соединением

3. **Ошибка генерации графика**
   - Проблемы с API сервером (порт 3001)
   - Ошибки в конфигурации пресета
   - Проблемы с изображениями или шрифтами

## Производительность

### Время выполнения:
- **1 пресет**: ~2-3 секунды
- **10 пресетов**: ~20-30 секунд
- **50 пресетов**: ~2-3 минуты

### Факторы, влияющие на скорость:
- Количество пресетов
- Наличие кэшированных данных
- Скорость интернет-соединения
- Производительность сервера API

## Примеры использования

### Генерация для тестового токена:
```bash
python batch_chart_generator.py 0x1d734a02ef6e87b83c6a3b847b1e4a2a30a9b9b4
```

### Генерация с кастомными параметрами:
```bash
python batch_chart_generator.py 0x1d734a02ef6e87b83c6a3b847b1e4a2a30a9b9b4 \
    --num-bars 50 \
    --network ethereum \
    --interval day \
    --output-dir "c:\\charts\\ethereum"
```

### Генерация через WebSocket (JavaScript):
```javascript
ws.send(JSON.stringify({
    command: 'generate_all_charts',
    pool_address: '0x1d734a02ef6e87b83c6a3b847b1e4a2a30a9b9b4',
    num_bars: 30,
    network: 'polygon_pos',
    interval: 'hour',
    output_dir: 'd:\\temp\\charts'
}));
```

## Мониторинг

Для мониторинга процесса генерации:

1. **WebSocket API**: отслеживайте сообщения о прогрессе
2. **Командная строка**: следите за выводом в консоли
3. **Файловая система**: проверяйте создание файлов в реальном времени
4. **Логи**: все операции записываются в логи сервера

## Автоматизация

Можно автоматизировать процесс генерации:

### Планировщик задач Windows:
```batch
@echo off
cd /d "d:\YandexDisk\Projects\Bots\xyz\bot"
python batch_chart_generator.py 0x1d734a02ef6e87b83c6a3b847b1e4a2a30a9b9b4
```

### Cron (Linux/Mac):
```bash
# Генерация каждый час
0 * * * * cd /path/to/bot && python batch_chart_generator.py 0x1d734a02ef6e87b83c6a3b847b1e4a2a30a9b9b4
```

### PowerShell скрипт:
```powershell
# Генерация с уведомлением
$result = python batch_chart_generator.py 0x1d734a02ef6e87b83c6a3b847b1e4a2a30a9b9b4
if ($LASTEXITCODE -eq 0) {
    Write-Host "Генерация завершена успешно"
} else {
    Write-Host "Ошибка при генерации"
}
``` 