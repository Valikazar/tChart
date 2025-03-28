"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const chartRenderer_1 = require("../utils/chartRenderer");
const app = (0, express_1.default)();
const port = process.env.PORT || 3001;
// Настройка CORS и JSON
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: '50mb' }));
// Основной эндпоинт для генерации графика
app.post('/generate', async (req, res) => {
    try {
        const { config, data, tokenInfo, interval, width, height } = req.body;
        // Проверка обязательных параметров
        if (!config || !data) {
            return res.status(400).json({
                error: 'Missing required parameters: config and data'
            });
        }
        // Генерация графика
        const imageData = await (0, chartRenderer_1.renderChart)({
            config: config,
            data,
            tokenInfo,
            interval,
            width,
            height
        });
        // Отправка результата
        res.json({
            success: true,
            image: imageData.split(',')[1]
        });
    }
    catch (error) {
        console.error('Error generating chart:', error);
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Failed to generate chart',
            details: error instanceof Error ? error.stack : undefined
        });
    }
});
// Эндпоинт для проверки работоспособности сервера
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});
// Запуск сервера
app.listen(port, () => {
    console.log(`Chart generation server running at http://localhost:${port}`);
    console.log('Available endpoints:');
    console.log('- POST /generate - Generate chart');
    console.log('- GET /health - Check server health');
});
