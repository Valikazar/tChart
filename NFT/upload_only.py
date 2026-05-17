import json
import os
import sys
import requests
import pymysql
from dotenv import load_dotenv

# Path configuration
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
# Loading .env from current directory (NFT/.env)
dotenv_path = os.path.join(SCRIPT_DIR, '.env')
load_dotenv(dotenv_path)

# Pinata configuration from .env
PINATA_API_KEY = os.getenv("PINATA_API_KEY")
PINATA_SECRET = os.getenv("PINATA_SECRET_API_KEY")

# DB Configuration - loading from ROOT .env for database credentials
load_dotenv(os.path.join(SCRIPT_DIR, '..', '.env'), override=False)

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

def ensure_table_exists():
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS nfts (
                    id INT PRIMARY KEY,
                    token_uri VARCHAR(255) NOT NULL,
                    is_minted BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
    finally:
        conn.close()

def pin_json(json_data, name):
    url = "https://api.pinata.cloud/pinning/pinJSONToIPFS"
    headers = {
        "pinata_api_key": PINATA_API_KEY.strip('"'), 
        "pinata_secret_api_key": PINATA_SECRET.strip('"'),
        "Content-Type": "application/json"
    }
    payload = {"pinataContent": json_data, "pinataMetadata": {"name": name}}
    res = requests.post(url, headers=headers, json=payload)
    if res.status_code != 200:
        print(f"❌ Pinata Error ({res.status_code}): {res.text}")
    res.raise_for_status()
    return res.json()["IpfsHash"]

def pin_file(file_path):
    url = "https://api.pinata.cloud/pinning/pinFileToIPFS"
    headers = {
        "pinata_api_key": PINATA_API_KEY.strip('"'), 
        "pinata_secret_api_key": PINATA_SECRET.strip('"')
    }
    with open(file_path, 'rb') as f:
        files = {'file': (os.path.basename(file_path), f)}
        res = requests.post(url, headers=headers, files=files)
    if res.status_code != 200:
        print(f"❌ Pinata Error ({res.status_code}): {res.text}")
    res.raise_for_status()
    return res.json()["IpfsHash"]

def add_to_db(nft_number, ipfs_hash):
    ensure_table_exists()
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            # Check for duplicate
            cursor.execute("SELECT 1 FROM nfts WHERE id = %s", (nft_number,))
            if cursor.fetchone():
                print(f"⚠️ NFT #{nft_number} already in DB. Updating record...")
                cursor.execute(
                    "UPDATE nfts SET token_uri = %s WHERE id = %s",
                    (f"ipfs://{ipfs_hash}", nft_number)
                )
                return

            # Insert new record
            token_uri = f"ipfs://{ipfs_hash}"
            cursor.execute(
                "INSERT INTO nfts (id, token_uri, is_minted) VALUES (%s, %s, FALSE)",
                (nft_number, token_uri)
            )
            print(f"💾 Added NFT #{nft_number} to MariaDB table 'nfts'")
    except Exception as e:
        print(f"❌ Database error: {e}")
    finally:
        conn.close()

def main():
    if len(sys.argv) < 2:
        print("Usage:")
        print("  python upload_only.py <nft_number>  - Upload specific NFT")
        print("  python upload_only.py --all         - Upload all .webp files in NFT/ directory")
        sys.exit(1)
    
    # Check Pinata keys
    if not PINATA_API_KEY or not PINATA_SECRET:
        print(f"❌ Error: PINATA_API_KEY or PINATA_SECRET_API_KEY not found in {dotenv_path}")
        sys.exit(1)
    
    clean_key = PINATA_API_KEY.strip('"')
    print(f"🔑 Using API Key: {clean_key[:4]}...{clean_key[-4:]}")

    try:
        ensure_table_exists()
    except Exception as e:
        print(f"❌ Could not connect to database: {e}")
        sys.exit(1)

    assets_dir = os.path.join(SCRIPT_DIR, 'NFT')
    
    if sys.argv[1] == '--all':
        print("🚀 Starting bulk upload of all assets...")
        files = [f for f in os.listdir(assets_dir) if f.endswith('.webp')]
        files.sort()
        
        if not files:
            print(f"⚠️ No .webp files found in {assets_dir}")
            return

        print(f"📦 Found {len(files)} assets to process.")
        for filename in files:
            nft_id = filename.replace('.webp', '')
            process_single_nft(nft_id, assets_dir)
    else:
        nft_num = sys.argv[1].zfill(4) 
        process_single_nft(nft_num, assets_dir)

def process_single_nft(nft_id, assets_dir):
    img_path = os.path.join(assets_dir, f"{nft_id}.webp")
    json_path = os.path.join(assets_dir, f"{nft_id}.json")

    # Verify files exist
    if not os.path.exists(img_path):
        print(f"❌ Error: Image file not found at {img_path}")
        return
    if not os.path.exists(json_path):
        print(f"❌ Error: Metadata file not found at {json_path}")
        return

    print(f"\n📤 Processing NFT #{nft_id}...")
    try:
        img_hash = pin_file(img_path)
        print(f"✅ Image pinned: ipfs://{img_hash}")
        
        with open(json_path, 'r', encoding='utf-8') as f:
            meta = json.load(f)
        meta['image'] = f"ipfs://{img_hash}"
        
        meta_hash = pin_json(meta, f"{nft_id}.json")
        print(f"✅ Metadata pinned: ipfs://{meta_hash}")
        
        add_to_db(int(nft_id), meta_hash)
        print(f"✨ NFT #{nft_id} complete! (ipfs://{meta_hash})")
    except Exception as e:
        print(f"❌ Failed to process NFT #{nft_id}: {e}")

if __name__ == "__main__":
    main()
