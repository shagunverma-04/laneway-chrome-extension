"""
Laneway Analytics Viewer
View meeting analytics from the database
"""

import sqlite3
from datetime import datetime
from pathlib import Path
import os

# Database path - works from project root
DB_PATH = Path(__file__).parent / 'backend' / 'database' / 'laneway.db'

# Alternative: use absolute path
if not DB_PATH.exists():
    DB_PATH = Path(os.getcwd()) / 'backend' / 'database' / 'laneway.db'

def view_analytics():
    """Display analytics from the database"""
    
    if not DB_PATH.exists():
        print(f"\n❌ Database not found at: {DB_PATH}")
        print(f"   Current directory: {os.getcwd()}")
        print(f"   Looking for: backend/database/laneway.db")
        return
    
    print("\n" + "="*80)
    print("📊 LANEWAY ANALYTICS DASHBOARD")
    print("="*80)
    
    # Connect to database
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # 1. Meeting Recordings
    print("\n🎥 RECORDINGS")
    print("-" * 80)
    cursor.execute("""
        SELECT id, meeting_id, status, duration, processed_at
        FROM meeting_recordings
        ORDER BY processed_at DESC
        LIMIT 10
    """)
    
    recordings = cursor.fetchall()
    if recordings:
        for rec in recordings:
            rec_id, meeting_id, status, duration, processed_at = rec
            duration_sec = (duration or 0) / 1000
            print(f"\n📹 Recording: {rec_id[:30]}...")
            print(f"   Meeting ID: {meeting_id}")
            print(f"   Status: {status}")
            print(f"   Duration: {duration_sec:.1f}s")
            print(f"   Processed: {processed_at or 'Not yet'}")
    else:
        print("   No recordings yet")
    
    # 2. Meeting Participants
    print("\n\n👥 PARTICIPANTS")
    print("-" * 80)
    cursor.execute("""
        SELECT 
            employee_name,
            meeting_id,
            join_time,
            camera_on_duration,
            speaking_duration,
            engagement_score
        FROM meeting_participants
        ORDER BY join_time DESC
        LIMIT 10
    """)
    
    participants = cursor.fetchall()
    if participants:
        for p in participants:
            name, meeting_id, join_time, camera_dur, speak_dur, engagement = p
            camera_min = (camera_dur or 0) / 60000
            speak_min = (speak_dur or 0) / 60000
            
            print(f"\n👤 {name}")
            print(f"   Meeting: {meeting_id}")
            print(f"   Joined: {join_time}")
            print(f"   Camera On: {camera_min:.1f} min")
            print(f"   Speaking: {speak_min:.1f} min")
            print(f"   Engagement: {engagement:.2f}")
    else:
        print("   No participants tracked yet")
    
    # 3. Absences
    print("\n\n📅 ABSENCES")
    print("-" * 80)
    cursor.execute("""
        SELECT 
            employee_name,
            meeting_id,
            reason,
            absence_type,
            informed_at
        FROM absences
        ORDER BY informed_at DESC
        LIMIT 5
    """)
    
    absences = cursor.fetchall()
    if absences:
        for absence in absences:
            name, meeting_id, reason, abs_type, informed_at = absence
            print(f"\n🚫 {name}")
            print(f"   Meeting: {meeting_id}")
            print(f"   Type: {abs_type}")
            print(f"   Reason: {reason}")
            print(f"   Informed: {informed_at}")
    else:
        print("   No absences recorded")
    
    # 4. Summary Stats
    print("\n\n📈 SUMMARY STATISTICS")
    print("-" * 80)
    
    # Total recordings
    cursor.execute("SELECT COUNT(*) FROM meeting_recordings")
    total_recordings = cursor.fetchone()[0]
    print(f"   Total Recordings: {total_recordings}")
    
    # Total participants
    cursor.execute("SELECT COUNT(*) FROM meeting_participants")
    total_participants = cursor.fetchone()[0]
    print(f"   Total Participants Tracked: {total_participants}")
    
    # Total absences
    cursor.execute("SELECT COUNT(*) FROM absences")
    total_absences = cursor.fetchone()[0]
    print(f"   Total Absences: {total_absences}")
    
    # Average engagement
    cursor.execute("SELECT AVG(engagement_score) FROM meeting_participants WHERE engagement_score > 0")
    avg_engagement = cursor.fetchone()[0]
    if avg_engagement:
        print(f"   Average Engagement Score: {avg_engagement:.2f}")
    
    print("\n" + "="*80)
    print("✅ Analytics loaded successfully!")
    print("="*80 + "\n")
    
    conn.close()

if __name__ == "__main__":
    try:
        view_analytics()
    except Exception as e:
        print(f"\n❌ Error: {e}")
        print("Make sure the database exists at: backend/database/laneway.db")
