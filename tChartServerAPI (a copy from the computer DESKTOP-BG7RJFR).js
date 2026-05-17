// Простой API-сервер для рендеринга графиков
const express = require('express');
const bodyParser = require('body-parser');
// Импортируем адаптер для ts-node
require('ts-node').register({ transpileOnly: true });
// Импортируем адаптер для универсального рендерера
const { renderChart, createDemoData, createDemoTokenInfo } = require('./chartRendererAdapter');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const port = process.env.PORT || 3001;

// Создаем папку для временных изображений, если её нет
const imagesDir = '/home/ubuntu/tchart/img/temp';
if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
}

// Хранилище для отслеживания файлов и их времени создания
const fileRegistry = new Map(); // filename -> { createdAt, accessed }

// Настройка middleware
app.use(bodyParser.json({ limit: '50mb' }));

// Middleware для отслеживания обращений к изображениям
app.use('/temp', (req, res, next) => {
    const filename = path.basename(req.path);
    
    if (fileRegistry.has(filename)) {
        const fileInfo = fileRegistry.get(filename);
        fileInfo.accessed = true;
        fileInfo.lastAccess = Date.now();
        console.log(`Файл ${filename} был запрошен, но не удален после скачивания`);
    }
    
    next();
});

// Статические файлы для временных изображений
app.use('/temp', express.static(imagesDir));
app.use('/fonts', express.static(path.join(__dirname, '..', 'fonts')));

// Функция для определения базового URL
function getBaseUrl(req) {
    // Проверяем наличие заголовков X-Forwarded-* для работы за прокси
    const protocol = req.get('X-Forwarded-Proto') || req.protocol;
    const host = req.get('X-Forwarded-Host') || req.get('host');
    const prefix = req.get('X-Forwarded-Prefix') || '';
    
    // Если мы за прокси и путь начинается с /chartapi в Nginx, 
    // возвращаем полный URL
    if (prefix) {
        return `${protocol}://${host}${prefix}`;
    }
    
    // Иначе возвращаем обычный URL
    return `${protocol}://${host}`;
}

// Добавляем корневой маршрут для проверки работоспособности сервера
app.get('/', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'Сервер API рендеринга графиков работает. Используйте POST /render для создания графиков.',
        endpoints: {
            'GET /': 'Информация о сервере',
            'POST /render': 'Рендеринг графика (config или configName, format: png/jpg)',
            'DELETE /cleanup': 'Очистка старых изображений'
        }
    });
});

// Эндпоинт для рендеринга графика
app.post('/render', async (req, res) => {
    try {
        const { config, configName, data, tokenInfo, interval, width, height, separateBars, format, tokenName } = req.body;
        
        let chartConfig;
        
        // Если передан configName, загружаем конфигурацию из файла
        if (configName) {
            const configPath = path.join(__dirname, '..', 'pic', 'presets', `${configName}.json`);
            
            // Проверяем существование файла
            if (!fs.existsSync(configPath)) {
                return res.status(400).json({ 
                    error: 'Файл конфигурации не найден', 
                    message: `Файл ${configName}.json не существует в папке pic/presets/` 
                });
            }
            
            try {
                const configData = fs.readFileSync(configPath, 'utf8');
                chartConfig = JSON.parse(configData);
            } catch (parseError) {
                return res.status(400).json({ 
                    error: 'Ошибка при чтении файла конфигурации', 
                    message: parseError.message 
                });
            }
        } else if (config) {
            // Используем переданную конфигурацию
            chartConfig = config;
        } else {
            return res.status(400).json({ error: 'Отсутствует конфигурация графика. Укажите либо config, либо configName' });
        }
        
        // Удаляем fontData из конфигурации, если он есть
        if (chartConfig.fontData) {
            delete chartConfig.fontData;
        }

        // Если передано имя токена в запросе, оно имеет приоритет над пресетом
        if (tokenName && typeof tokenName === 'string') {
            if (!chartConfig.display) chartConfig.display = {};
            chartConfig.displayName = tokenName;
        }
        
        // Используем переданные данные или демо-данные
        const chartData = data || createDemoData(24);
        const chartTokenInfo = tokenInfo || createDemoTokenInfo();
        
        // Определяем приоритет interval: сначала из запроса, затем из конфигурации, затем по умолчанию
        console.log('🔍 DEBUG: interval from request =', interval);
        console.log('🔍 DEBUG: chartConfig.interval =', chartConfig.interval);
        console.log('🔍 DEBUG: chartConfig.duration =', chartConfig.duration);
        console.log('🔍 DEBUG: chartConfig.numBars =', chartConfig.numBars);
        const finalInterval = interval || chartConfig.interval || '1h';
        console.log('🔍 DEBUG: finalInterval =', finalInterval);
        
        // Определяем формат изображения (png по умолчанию)
        const imageFormat = format && ['png', 'jpg', 'jpeg'].includes(format.toLowerCase()) ? format.toLowerCase() : 'png';
        const fileExtension = imageFormat === 'jpg' || imageFormat === 'jpeg' ? 'jpg' : 'png';
        console.log('🔍 DEBUG: imageFormat =', imageFormat, ', fileExtension =', fileExtension);
        
        // Если запрошены отдельные столбики
        if (separateBars) {
            console.log('Начинаем рендеринг отдельных столбиков...');
            
            const result = await renderChart({
                config: chartConfig,
                data: chartData,
                tokenInfo: chartTokenInfo,
                interval: finalInterval,
                width: width || 1280,
                height: height || 1280,
                separateBars: true,
                format: imageFormat
            });
            
            if (!result.success) {
                return res.status(500).json({ 
                    error: 'Ошибка при рендеринге отдельных столбиков', 
                    message: result.error 
                });
            }
            
            console.log(`Сгенерированы отдельные столбики: ${result.barCount} столбиков + 1 фон`);
            
            // Регистрируем все файлы для отслеживания
            const allFilenames = [result.backgroundFilename, ...result.barFilenames];
            allFilenames.forEach(filename => {
                fileRegistry.set(filename, {
                    createdAt: Date.now(),
                    accessed: false,
                    lastAccess: null
                });
            });
            
            // Формируем URL для доступа к файлам
            const baseUrl = getBaseUrl(req);
            const backgroundUrl = `${baseUrl}/temp/${result.backgroundFilename}`;
            const barUrls = result.barFilenames.map(filename => `${baseUrl}/temp/${filename}`);
            
            // Возвращаем результат
            res.json({
                success: true,
                separateBars: true,
                backgroundUrl,
                barUrls,
                barCount: result.barCount,
                backgroundFilename: result.backgroundFilename,
                barFilenames: result.barFilenames
            });
        } else {
            // Обычный рендеринг одного файла
        const outputFilename = `chart_${uuidv4()}.${fileExtension}`;
        const outputPath = path.join(imagesDir, outputFilename);
        
        console.log('Начинаем рендеринг графика...');
        
        // Рендерим график
        const result = await renderChart({
            config: chartConfig,
            data: chartData,
            tokenInfo: chartTokenInfo,
            interval: finalInterval,
            width: width || 1280,
            height: height || 1280,
            outputPath,
            format: imageFormat
        });
        
        console.log(`График успешно сгенерирован: ${outputPath}`);
        
        // Регистрируем файл для отслеживания
        fileRegistry.set(outputFilename, {
            createdAt: Date.now(),
            accessed: false,
            lastAccess: null
        });
        
        // Формируем URL для доступа к изображению
        const baseUrl = getBaseUrl(req);
        const imageUrl = `${baseUrl}/temp/${outputFilename}`;
        
        // Возвращаем результат
        res.json({
            success: true,
            imageUrl,
            base64: result.base64,
            size: result.buffer.length,
            filename: outputFilename,
            format: imageFormat
        });
        }
        
    } catch (error) {
        console.error('Ошибка рендеринга:', error);
        res.status(500).json({ 
            error: 'Ошибка при рендеринге графика', 
            message: error.message 
        });
    }
});

// Эндпоинт для очистки старых изображений (опционально)
app.delete('/cleanup', (req, res) => {
    try {
        const files = fs.readdirSync(imagesDir);
        const now = Date.now();
        let deletedCount = 0;
        
        // Удаляем файлы старше 1 часа
        files.forEach(file => {
            const filePath = path.join(imagesDir, file);
            const stats = fs.statSync(filePath);
            const fileAge = now - stats.mtimeMs;
            
            // Если файл старше 1 часа (3600000 мс)
            if (fileAge > 3600000) {
                fs.unlinkSync(filePath);
                deletedCount++;
            }
        });
        
        res.json({ success: true, deletedCount });
    } catch (error) {
        console.error('Ошибка при очистке:', error);
        res.status(500).json({ error: 'Ошибка при очистке старых изображений' });
    }
});

// Запуск сервера
app.listen(port, () => {
    console.log(`Сервер API рендеринга графиков запущен на порту ${port}`);
    console.log(`Откройте http://localhost:${port}/ в браузере для тестирования`);
});

// Функция для периодической очистки старых изображений
function cleanupOldImages() {
    try {
        const now = Date.now();
        let deletedCount = 0;
        
        // Удаляем файлы старше 5 минут (300000 мс)
        for (const [filename, fileInfo] of fileRegistry.entries()) {
            const fileAge = now - fileInfo.createdAt;
            
            // Если файл старше 5 минут
            if (fileAge > 300000) {
                const filePath = path.join(imagesDir, filename);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                    deletedCount++;
                }
                fileRegistry.delete(filename);
            }
        }
        
        if (deletedCount > 0) {
            console.log(`Очищено ${deletedCount} старых изображений`);
        }
    } catch (error) {
        console.error('Ошибка при автоматической очистке:', error);
    }
}

// Запускаем очистку каждые 5 минут
setInterval(cleanupOldImages, 600000); 