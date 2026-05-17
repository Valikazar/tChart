const fs = require('fs');
const path = require('path');
const fontkit = require('fontkit');
const { registerFont } = require('canvas');

const fontsDir = path.join(__dirname);
const fontFiles = fs.readdirSync(fontsDir).filter(file => file.endsWith('.ttf') || file.endsWith('.otf'));

console.log('Автоматическая регистрация шрифтов с Family Name через fontkit:');

const registered = [];

fontFiles.forEach(fontFile => {
  const fontPath = path.join(fontsDir, fontFile);
  let familyName = null;
  let variants = [];
  try {
    const font = fontkit.openSync(fontPath);
    familyName = font.familyName;
    if (familyName) {
      registerFont(fontPath, { family: familyName });
      console.log(`✓ Family Name: "${familyName}" зарегистрирован для ${fontFile}`);
    }
  } catch (e) {
    console.warn(`Не удалось получить Family Name для ${fontFile}: ${e.message}`);
  }

  // Дополнительно регистрируем с базовым именем файла и вариантами
  const baseName = path.basename(fontFile, path.extname(fontFile));
  variants = [
    baseName,
    baseName.replace(/[-_]/g, ' '),
    baseName.replace(/[-_]/g, ''),
    baseName.toLowerCase(),
    baseName.toUpperCase(),
  ];
  const uniqueVariants = [...new Set([familyName, ...variants])].filter(Boolean);
  uniqueVariants.forEach(variant => {
    try {
      registerFont(fontPath, { family: variant });
      if (variant !== familyName) {
        console.log(`  + Вариант: "${variant}" зарегистрирован для ${fontFile}`);
      }
    } catch (e) {
      // ignore
    }
  });

  registered.push({
    file: fontFile,
    familyName,
    variants: uniqueVariants
  });
});

fs.writeFileSync(path.join(fontsDir, 'registered_fonts.json'), JSON.stringify(registered, null, 2), 'utf8');
console.log('Регистрация завершена! Информация сохранена в registered_fonts.json'); 