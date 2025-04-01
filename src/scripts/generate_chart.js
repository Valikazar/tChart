const fs = require('fs');
const path = require('path');

// Импортируем модуль chartRendererUniversal
const { renderChart } = require(path.join(__dirname, '..', 'utils', 'chartRendererUniversal'));

async function main() {
    if (process.argv.length !== 4) {
        console.error('Usage: node generate_chart.js <data.json> <output.png>');
        process.exit(1);
    }

    const dataPath = process.argv[2];
    const outputPath = process.argv[3];

    try {
        // Читаем данные из JSON файла
        const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

        // Генерируем график
        const result = await renderChart({
            config: data.config,
            data: data.data,
            tokenInfo: data.tokenInfo,
            outputPath: outputPath,
            width: 1280,
            height: 1280
        });

        console.log('Chart generated successfully');
    } catch (error) {
        console.error('Error generating chart:', error);
        process.exit(1);
    }
}

main(); 