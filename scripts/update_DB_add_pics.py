#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Скрипт для обновления базы данных images записями из папки pic/add/
Добавляет записи для каждого файла, который не заканчивается на _masked
"""

import os
import sys
import io
from pathlib import Path

# Устанавливаем кодировку UTF-8 для вывода
if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# Импортируем PyMySQL (лучше работает с MariaDB)
import pymysql

# Конфигурация базы данных для MariaDB
DB_CONFIG = {
    'host': '127.0.0.1',
    'user': 'root',
    'password': 'root',
    'database': 'tchart',
    'port': 3306,
    'autocommit': True
}

def get_files_from_add_folder():
    """
    Получает список файлов из папки pic/add/ и её подпапок
    Исключает файлы, заканчивающиеся на _masked
    """
    # Определяем правильный путь к папке pic/add
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    add_folder = project_root / 'pic' / 'add'
    files_data = []
    
    if not add_folder.exists():
        print(f"Папка {add_folder} не найдена!")
        return files_data
    
    # Проходим по всем файлам в папке add и её подпапках
    for file_path in add_folder.rglob('*'):
        if file_path.is_file():
            # Проверяем, что файл не заканчивается на _masked
            if not file_path.stem.endswith('_masked'):
                # Получаем имя подпапки (genre)
                genre = file_path.parent.name if file_path.parent.name != 'add' else 'default'
                
                files_data.append({
                    'name': file_path.stem,  # имя файла без расширения
                    'genre': genre,
                    'file_path': str(file_path)
                })
    
    return files_data

def connect_to_database():
    """Подключается к базе данных MariaDB"""
    try:
        connection = pymysql.connect(
            host=DB_CONFIG['host'],
            user=DB_CONFIG['user'],
            password=DB_CONFIG['password'],
            database=DB_CONFIG['database'],
            port=DB_CONFIG['port'],
            autocommit=True,
            charset='utf8mb4'
        )
        return connection
    except Exception as err:
        print(f"Ошибка подключения к базе данных: {err}")
        return None

def check_table_exists(cursor):
    """Проверяет существование таблицы images"""
    cursor.execute("SHOW TABLES LIKE 'images'")
    return cursor.fetchone() is not None

def create_images_table(cursor):
    """Создает таблицу images если она не существует"""
    create_table_query = """
    CREATE TABLE IF NOT EXISTS images (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        owner VARCHAR(255) NOT NULL,
        approved TINYINT(1) DEFAULT 0,
        class VARCHAR(50),
        genre VARCHAR(100),
        scale DECIMAL(10,2),
        x_offset DECIMAL(10,2),
        y_offset DECIMAL(10,2),
        rotation DECIMAL(10,2),
        overlap DECIMAL(10,2),
        color VARCHAR(50),
        mirrored TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
    """
    cursor.execute(create_table_query)
    print("Таблица images создана или уже существует")

def insert_or_update_image(cursor, image_data):
    """Вставляет или обновляет запись в таблице images"""
    # Проверяем, существует ли уже запись с таким именем
    check_query = "SELECT id FROM images WHERE name = %s"
    cursor.execute(check_query, (image_data['name'],))
    existing_record = cursor.fetchone()
    
    if existing_record:
        # Обновляем существующую запись
        update_query = """
        UPDATE images SET 
            owner = %s, approved = %s, class = %s, genre = %s,
            scale = NULL, x_offset = NULL, y_offset = NULL, 
            rotation = NULL, overlap = NULL, color = NULL, mirrored = 0
        WHERE name = %s
        """
        cursor.execute(update_query, (
            '0xf7427BD018809723e778Be7EaE4FaB6C81474C70', 1, 'add', image_data['genre'], image_data['name']
        ))
        print(f"Обновлена запись: {image_data['name']} (genre: {image_data['genre']})")
    else:
        # Вставляем новую запись
        insert_query = """
        INSERT INTO images (name, owner, approved, class, genre, 
                           scale, x_offset, y_offset, rotation, overlap, color, mirrored)
        VALUES (%s, %s, %s, %s, %s, NULL, NULL, NULL, NULL, NULL, NULL, 0)
        """
        cursor.execute(insert_query, (
            image_data['name'], '0xf7427BD018809723e778Be7EaE4FaB6C81474C70', 1, 'add', image_data['genre']
        ))
        print(f"Добавлена новая запись: {image_data['name']} (genre: {image_data['genre']})")

def main():
    """Основная функция"""
    print("=== Обновление базы данных images из папки pic/add/ ===")
    
    # Получаем список файлов
    files_data = get_files_from_add_folder()
    
    if not files_data:
        print("Не найдено файлов для обработки в папке pic/add/")
        return
    
    print(f"Найдено {len(files_data)} файлов для обработки:")
    for file_data in files_data:
        print(f"  - {file_data['name']} (genre: {file_data['genre']})")
    
    # Подключаемся к базе данных
    connection = connect_to_database()
    if not connection:
        return
    
    try:
        cursor = connection.cursor()
        
        # Проверяем/создаем таблицу
        if not check_table_exists(cursor):
            print("Таблица images не найдена, создаем...")
            create_images_table(cursor)
        else:
            print("Таблица images найдена")
        
        # Обрабатываем каждый файл
        print("\nОбработка файлов...")
        for file_data in files_data:
            insert_or_update_image(cursor, file_data)
        
        # Подтверждаем изменения
        connection.commit()
        print(f"\nУспешно обработано {len(files_data)} файлов!")
        
    except Exception as err:
        print(f"Ошибка при работе с базой данных: {err}")
    finally:
        if connection:
            cursor.close()
            connection.close()
            print("Соединение с базой данных закрыто")

if __name__ == "__main__":
    main()
