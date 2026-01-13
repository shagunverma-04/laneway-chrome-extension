"""
Quick test to verify participant tracking is working
"""

import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent / 'backend' / 'database' / 'laneway.db'

def test_participant_tracking():
    """Test if participant tracking schema is correct"""
    
    if not DB_PATH.exists():
        print(f"❌ Database not found at: {DB_PATH}")
        return False
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Check if table exists
    cursor.execute("""
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='meeting_participants'
    """)
    
    if not cursor.fetchone():
        print("❌ meeting_participants table does not exist!")
        return False
    
    print("✅ meeting_participants table exists")
    
    # Check schema
    cursor.execute("PRAGMA table_info(meeting_participants)")
    columns = cursor.fetchall()
    
    print("\n📋 Table Schema:")
    for col in columns:
        print(f"   {col[1]} ({col[2]})")
    
    # Count participants
    cursor.execute("SELECT COUNT(*) FROM meeting_participants")
    count = cursor.fetchone()[0]
    
    print(f"\n📊 Current participant count: {count}")
    
    if count > 0:
        # Show sample
        cursor.execute("""
            SELECT employee_name, meeting_id, join_time 
            FROM meeting_participants 
            ORDER BY join_time DESC 
            LIMIT 5
        """)
        
        print("\n👥 Recent participants:")
        for row in cursor.fetchall():
            print(f"   - {row[0]} (Meeting: {row[1]}, Joined: {row[2]})")
    else:
        print("\n⚠️  No participants tracked yet")
        print("\n💡 To fix this:")
        print("   1. Reload the extension in chrome://extensions/")
        print("   2. Join a Google Meet meeting")
        print("   3. Start and stop a recording")
        print("   4. Run this script again")
    
    conn.close()
    return True

if __name__ == "__main__":
    test_participant_tracking()
