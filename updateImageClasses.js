/**
 * Скрипт для обновления классов изображений в базе данных
 * в соответствии с их расположением в каталогах.
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

// Конфигурация базы данных
const mariadbConfig = {
  host: process.env.MARIA_HOST || 'localhost',
  user: process.env.MARIA_USER || 'root',
  password: process.env.MARIA_PASSWORD || 'root',
  database: process.env.MARIA_DB || 'tchart',
  port: process.env.MARIA_PORT ? parseInt(process.env.MARIA_PORT) : 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// Категории для обновления (исключая presets)
const validCategories = ['topbot', 'center', 'body', 'bg'];

// Основная функция
async function updateImageClasses() {
  console.log('Начинаем обновление классов изображений...');
  
  // Подключение к базе данных
  const mariadbPool = await mysql.createPool(mariadbConfig);
  console.log('Подключились к базе данных');
  
  try {
    // Статистика для отчета
    const stats = {
      total: 0,
      updated: 0,
      notFound: 0,
      unchanged: 0,
      byCategory: {}
    };
    
    // Инициализация статистики по категориям
    validCategories.forEach(category => {
      stats.byCategory[category] = {
        found: 0,
        updated: 0
      };
    });
    
    // Обработка каждой категории
    for (const category of validCategories) {
      console.log(`\nОбрабатываем категорию: ${category}`);
      
      // Путь к директории категории
      const categoryDir = path.join(__dirname, 'pic', category);
      
      if (!fs.existsSync(categoryDir)) {
        console.log(`Директория ${categoryDir} не найдена, пропускаем`);
        continue;
      }
      
      // Функция для рекурсивного обхода директории
      const processDirectory = async (dirPath) => {
        // Получаем список файлов в директории
        const items = fs.readdirSync(dirPath);
        
        for (const item of items) {
          const itemPath = path.join(dirPath, item);
          const stat = fs.statSync(itemPath);
          
          if (stat.isDirectory()) {
            // Если это директория, обрабатываем рекурсивно
            await processDirectory(itemPath);
          } else if (stat.isFile()) {
            // Обрабатываем только файлы изображений
            const fileExtension = path.extname(item).toLowerCase();
            if (['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(fileExtension)) {
              // Извлекаем имя файла без расширения
              const filename = path.basename(item, fileExtension);
              
              // Обновляем запись в базе данных
              await updateImageClass(filename, category, mariadbPool, stats);
            }
          }
        }
      };
      
      // Запускаем обработку директории
      await processDirectory(categoryDir);
      console.log(`Обработано в категории ${category}: ${stats.byCategory[category].found} изображений, обновлено: ${stats.byCategory[category].updated}`);
    }
    
    // Выводим итоговую статистику
    console.log('\n--- ИТОГОВАЯ СТАТИСТИКА ---');
    console.log(`Всего обработано: ${stats.total} изображений`);
    console.log(`Обновлено: ${stats.updated} записей`);
    console.log(`Не изменено (класс уже верный): ${stats.unchanged} записей`);
    console.log(`Не найдено в БД: ${stats.notFound} изображений`);
    console.log('По категориям:');
    Object.keys(stats.byCategory).forEach(cat => {
      console.log(`  ${cat}: найдено ${stats.byCategory[cat].found}, обновлено ${stats.byCategory[cat].updated}`);
    });
    
  } catch (error) {
    console.error('Произошла ошибка:', error);
  } finally {
    // Закрываем соединение с базой данных
    if (mariadbPool) {
      await mariadbPool.end();
      console.log('Соединение с базой данных закрыто');
    }
  }
}

// Функция для обновления класса изображения в базе данных
async function updateImageClass(imageName, category, pool, stats) {
  try {
    // Увеличиваем счетчики
    stats.total++;
    stats.byCategory[category].found++;
    
    // Проверяем, существует ли запись для данного изображения
    const [rows] = await pool.query('SELECT * FROM images WHERE name = ?', [imageName]);
    
    if (rows.length === 0) {
      // Изображение не найдено в БД
      console.log(`Изображение ${imageName} не найдено в базе данных`);
      stats.notFound++;
      return;
    }
    
    // Получаем текущую запись
    const image = rows[0];
    
    // Проверяем, нужно ли обновлять класс
    if (image.class === category) {
      // Класс уже верный
      stats.unchanged++;
      return;
    }
    
    // Обновляем класс изображения
    await pool.query('UPDATE images SET class = ? WHERE id = ?', [category, image.id]);
    
    console.log(`Обновлено изображение ${imageName}: класс изменен с "${image.class}" на "${category}"`);
    stats.updated++;
    stats.byCategory[category].updated++;
    
  } catch (error) {
    console.error(`Ошибка при обновлении класса для изображения ${imageName}:`, error);
  }
}

// Запускаем основную функцию
updateImageClasses()
  .then(() => {
    console.log('Скрипт завершен');
    process.exit(0);
  })
  .catch(error => {
    console.error('Критическая ошибка:', error);
    process.exit(1);
  }); 