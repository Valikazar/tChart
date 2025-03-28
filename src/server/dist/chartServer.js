"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const chartRenderer_1 = require("../utils/chartRenderer");
const app = (0, express_1.default)();
app.use(express_1.default.json());
const PORT = process.env.PORT || 3001;
app.post('/generate-chart', async (req, res) => {
    try {
        const { config, data, tokenInfo, interval, width, height } = req.body;
        // Проверяем наличие обязательных параметров
        if (!config || !data) {
            return res.status(400).json({ error: 'Missing required parameters: config and data' });
        }
        // Генерируем график
        const chartImage = await (0, chartRenderer_1.renderChart)({
            config: config,
            data,
            tokenInfo,
            interval,
            width,
            height
        });
        // Отправляем результат
        res.json({ success: true, image: chartImage });
    }
    catch (error) {
        console.error('Error generating chart:', error);
        res.status(500).json({ error: 'Failed to generate chart' });
    }
});
app.listen(PORT, () => {
    console.log(`Chart generation server running on port ${PORT}`);
});
