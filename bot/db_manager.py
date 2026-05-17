#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import logging
import pymysql
from contextlib import contextmanager

logger = logging.getLogger(__name__)

class DatabaseManager:
    """Менеджер для синхронной работы с базой данных MariaDB для телеграм бота"""
    
    def __init__(self):
        self.config = {
            'host': os.environ.get('MARIA_HOST', '127.0.0.1'),
            'user': os.environ.get('MARIA_USER', 'root'),
            'password': os.environ.get('MARIA_PASSWORD', 'root'),
            'database': os.environ.get('MARIA_DB', 'tchart'),
            'port': int(os.environ.get('MARIA_PORT', '3306')),
            'charset': 'utf8mb4',
            'autocommit': True,
            'cursorclass': pymysql.cursors.DictCursor
        }
        self._pool = None
        self._ensure_table_exists()
        self._migrate_columns()
    
    def _get_connection(self):
        """Получить соединение с базой данных"""
        try:
            return pymysql.connect(**self.config)
        except Exception as e:
            logger.error(f"Error connecting to database: {e}")
            raise
    
    @contextmanager
    def _get_cursor(self):
        """Контекстный менеджер для работы с курсором"""
        conn = self._get_connection()
        try:
            cursor = conn.cursor()
            yield cursor
            conn.commit()
        except Exception as e:
            conn.rollback()
            logger.error(f"Database error: {e}")
            raise
        finally:
            cursor.close()
            conn.close()
    
    def _ensure_table_exists(self):
        """Создать таблицу tg_groups если её нет"""
        try:
            with self._get_cursor() as cursor:
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS tg_groups (
                        group_id VARCHAR(64) PRIMARY KEY,
                        last_poster_time INT DEFAULT 0,
                        duration FLOAT DEFAULT 0,
                        random_chart BOOLEAN DEFAULT FALSE,
                        free BOOLEAN DEFAULT FALSE,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                        INDEX idx_group_id (group_id)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                """)
                logger.info("tg_groups table ensured")
                    
        except Exception as e:
            logger.error(f"Error creating tg_groups table: {e}")
    
    def _migrate_columns(self):
        """Добавить недостающие колонки в существующую таблицу (миграция)"""
        try:
            with self._get_cursor() as cursor:
                # Проверяем и добавляем random_chart
                try:
                    cursor.execute("SHOW COLUMNS FROM tg_groups LIKE 'random_chart'")
                    if not cursor.fetchone():
                        cursor.execute("ALTER TABLE tg_groups ADD COLUMN random_chart BOOLEAN DEFAULT FALSE")
                        logger.info("✅ Added random_chart column to tg_groups table")
                    else:
                        logger.debug("Column random_chart already exists")
                except Exception as e:
                    logger.warning(f"Error checking/adding random_chart column: {e}")
                
                # Проверяем и добавляем free
                try:
                    cursor.execute("SHOW COLUMNS FROM tg_groups LIKE 'free'")
                    if not cursor.fetchone():
                        cursor.execute("ALTER TABLE tg_groups ADD COLUMN free BOOLEAN DEFAULT FALSE")
                        logger.info("✅ Added free column to tg_groups table")
                    else:
                        logger.debug("Column free already exists")
                except Exception as e:
                    logger.warning(f"Error checking/adding free column: {e}")
        except Exception as e:
            logger.error(f"Error during column migration: {e}")
    
    def get_group_data(self, group_id):
        """Получить данные группы (last_poster_time, duration, random_chart, free)"""
        group_id_str = str(group_id)
        try:
            with self._get_cursor() as cursor:
                cursor.execute(
                    "SELECT last_poster_time, duration, random_chart, free FROM tg_groups WHERE group_id = %s",
                    (group_id_str,)
                )
                result = cursor.fetchone()
                if result:
                    return {
                        'last_poster_time': result.get('last_poster_time', 0),
                        'duration': result.get('duration', 0),
                        'random_chart': bool(result.get('random_chart', False)),
                        'free': bool(result.get('free', False))
                    }
                else:
                    # Если записи нет, создаём её с дефолтными значениями
                    self.set_group_data(group_id_str, 0, 0, False, False)
                    return {'last_poster_time': 0, 'duration': 0, 'random_chart': False, 'free': False}
        except Exception as e:
            logger.error(f"Error getting group data for {group_id}: {e}")
            return {'last_poster_time': 0, 'duration': 0, 'random_chart': False, 'free': False}
    
    def set_last_poster_time(self, group_id, last_poster_time):
        """Установить last_poster_time для группы"""
        group_id_str = str(group_id)
        try:
            with self._get_cursor() as cursor:
                cursor.execute("""
                    INSERT INTO tg_groups (group_id, last_poster_time)
                    VALUES (%s, %s)
                    ON DUPLICATE KEY UPDATE
                        last_poster_time = VALUES(last_poster_time)
                """, (group_id_str, int(last_poster_time)))
                logger.debug(f"Set last_poster_time={last_poster_time} for group {group_id_str}")
        except Exception as e:
            logger.error(f"Error setting last_poster_time for {group_id}: {e}")
    
    def set_duration(self, group_id, duration):
        """Установить duration для группы"""
        group_id_str = str(group_id)
        try:
            with self._get_cursor() as cursor:
                cursor.execute("""
                    INSERT INTO tg_groups (group_id, duration)
                    VALUES (%s, %s)
                    ON DUPLICATE KEY UPDATE
                        duration = VALUES(duration)
                """, (group_id_str, float(duration)))
                logger.debug(f"Set duration={duration} for group {group_id_str}")
        except Exception as e:
            logger.error(f"Error setting duration for {group_id}: {e}")
    
    def set_random_chart(self, group_id, random_chart):
        """Установить random_chart для группы"""
        group_id_str = str(group_id)
        try:
            with self._get_cursor() as cursor:
                cursor.execute("""
                    INSERT INTO tg_groups (group_id, random_chart)
                    VALUES (%s, %s)
                    ON DUPLICATE KEY UPDATE
                        random_chart = VALUES(random_chart)
                """, (group_id_str, bool(random_chart)))
                logger.debug(f"Set random_chart={random_chart} for group {group_id_str}")
        except Exception as e:
            logger.error(f"Error setting random_chart for {group_id}: {e}")
    
    def set_free(self, group_id, free):
        """Установить free для группы"""
        group_id_str = str(group_id)
        try:
            with self._get_cursor() as cursor:
                cursor.execute("""
                    INSERT INTO tg_groups (group_id, free)
                    VALUES (%s, %s)
                    ON DUPLICATE KEY UPDATE
                        free = VALUES(free)
                """, (group_id_str, bool(free)))
                logger.debug(f"Set free={free} for group {group_id_str}")
        except Exception as e:
            logger.error(f"Error setting free for {group_id}: {e}")
    
    def set_group_data(self, group_id, last_poster_time=None, duration=None, random_chart=None, free=None):
        """Установить данные группы (один или несколько параметров)"""
        group_id_str = str(group_id)
        try:
            with self._get_cursor() as cursor:
                # Build update query dynamically based on what's provided
                updates = []
                insert_fields = []
                insert_values = []
                
                if last_poster_time is not None:
                    updates.append("last_poster_time = %s")
                    insert_fields.append("last_poster_time")
                    insert_values.append(int(last_poster_time))
                
                if duration is not None:
                    updates.append("duration = %s")
                    insert_fields.append("duration")
                    insert_values.append(float(duration))
                
                if random_chart is not None:
                    updates.append("random_chart = %s")
                    insert_fields.append("random_chart")
                    insert_values.append(bool(random_chart))
                
                if free is not None:
                    updates.append("free = %s")
                    insert_fields.append("free")
                    insert_values.append(bool(free))
                
                if not updates:
                    return
                
                # Build values list: insert values + group_id (twice for INSERT and UPDATE)
                all_values = [group_id_str] + insert_values + insert_values
                
                query = f"""
                    INSERT INTO tg_groups (group_id, {', '.join(insert_fields)})
                    VALUES (%s, {', '.join(['%s'] * len(insert_values))})
                    ON DUPLICATE KEY UPDATE
                        {', '.join(updates)}
                """
                
                cursor.execute(query, all_values)
                logger.debug(f"Updated group data for {group_id_str}")
        except Exception as e:
            logger.error(f"Error setting group data for {group_id}: {e}")

# Глобальный экземпляр менеджера БД
db_manager = DatabaseManager()

