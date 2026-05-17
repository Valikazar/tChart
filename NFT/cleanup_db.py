import pymysql
import os
from dotenv import load_dotenv

# Path configuration
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
# Loading root .env for database credentials
load_dotenv(os.path.join(SCRIPT_DIR, '..', '.env'))

DB_HOST = os.getenv('MARIA_HOST', '127.0.0.1')
DB_USER = os.getenv('MARIA_USER', 'root')
DB_PASSWORD = os.getenv('MARIA_PASSWORD', 'root')
DB_NAME = os.getenv('MARIA_DB', 'tchart')
DB_PORT = int(os.getenv('MARIA_PORT', 3306))

def get_db_connection():
    return pymysql.connect(
        host=DB_HOST,
        user=DB_USER,
        password=DB_PASSWORD,
        database=DB_NAME,
        port=DB_PORT,
        cursorclass=pymysql.cursors.DictCursor,
        autocommit=True
    )

def main():
    print(f"🧹 Clearing table 'nfts' in database '{DB_NAME}'...")
    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            cursor.execute("TRUNCATE TABLE nfts")
        conn.close()
        print("✅ Database table 'nfts' cleared successfully.")
    except Exception as e:
        print(f"❌ Error clearing database: {e}")

if __name__ == "__main__":
    main()
