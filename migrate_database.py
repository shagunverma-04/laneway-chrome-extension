"""
Database migration: Add storage_key column to meeting_recordings table
"""

import sqlite3
import os

# Database path
DB_PATH = os.path.join(os.path.dirname(__file__), 'backend', 'database', 'laneway.db')

def migrate():
    """Add storage_key column if it doesn't exist"""
    
    print("\n" + "="*60)
    print("DATABASE MIGRATION")
    print("="*60)
    print(f"Database: {DB_PATH}\n")
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # Check if column exists
        cursor.execute("PRAGMA table_info(meeting_recordings)")
        columns = [col[1] for col in cursor.fetchall()]
        
        if 'storage_key' in columns:
            print("✅ storage_key column already exists")
        else:
            print("➕ Adding storage_key column...")
            cursor.execute("ALTER TABLE meeting_recordings ADD COLUMN storage_key TEXT")
            conn.commit()
            print("✅ storage_key column added successfully")
        
        print("\n" + "="*60)
        print("MIGRATION COMPLETE")
        print("="*60 + "\n")
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
