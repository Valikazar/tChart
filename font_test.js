const { createCanvas, registerFont } = require('canvas');
const fs = require('fs');
const path = require('path');
const fontkit = require('fontkit');

const fontsDir = path.join(__dirname, 'fonts');
const testText = 'Hello World 12345';

if (!fs.existsSync(fontsDir)) {
  console.error('Папка fonts не найдена!');
  process.exit(1);
}

fs.readdirSync(fontsDir).forEach(file => {
  if (!file.match(/\.(ttf|otf)$/i)) return;
  const fontPath = path.join(fontsDir, file);
  let familyName = null;
  try {
    const font = fontkit.openSync(fontPath);
    familyName = font.familyName;
    registerFont(fontPath, { family: familyName });
    console.log(`Зарегистрирован: "${familyName}" из файла ${file}`);
  } catch (e) {
    console.warn(`Ошибка для ${file}: ${e.message}`);
    return;
  }

  const canvas = createCanvas(400, 100);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, 400, 100);
  ctx.fillStyle = '#000';
  ctx.font = `40px "${familyName}"`;
  ctx.fillText(testText, 10, 50);

  // Сравниваем ширину с Arial
  const widthCustom = ctx.measureText(testText).width;
  ctx.font = '40px Arial';
  const widthArial = ctx.measureText(testText).width;

  console.log(`"${familyName}": ширина=${widthCustom}, Arial=${widthArial}, разница=${widthCustom - widthArial}`);

  // Сохраняем картинку для визуальной проверки
  const outName = `test_${familyName.replace(/[^a-z0-9]/gi, '_')}.png`;
  fs.writeFileSync(outName, canvas.toBuffer('image/png'));
  console.log(`PNG сохранён: ${outName}`);
}); 