# 📊 Viewing Analytics Data

## Quick View: Extension Popup

Your extension popup shows real-time stats:
- **Meetings This Week**: Total meetings attended
- **Avg Speaking Time**: Average time you speak in meetings
- **Camera Usage**: Percentage of time with camera on

## Detailed View: Database

All analytics are stored in SQLite database at:
```
backend/database/laneway.db
```

### Method 1: Using DB Browser (Recommended)

1. **Download DB Browser for SQLite** (free):
   - https://sqlitebrowser.org/dl/

2. **Open the database**:
   - File → Open Database
   - Navigate to: `backend/database/laneway.db`

3. **View Tables**:
   - `meeting_participants` - Participant behavior data
   - `meeting_recordings` - Recording metadata
   - `absences` - Absence notifications

### Method 2: Using Python Script

Create a simple viewer script:

```python
# view_analytics.py
import sqlite3
import json
from datetime import datetime

# Connect to database
conn = sqlite3.connect('backend/database/laneway.db')
cursor = conn.cursor()

# View recent participants
print("\n📊 RECENT MEETING PARTICIPANTS")
print("=" * 80)
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

for row in cursor.fetchall():
    print(f"\n👤 {row[0]}")
    print(f"   Meeting: {row[1]}")
    print(f"   Joined: {row[2]}")
    print(f"   Camera On: {row[3]}ms")
    print(f"   Speaking: {row[4]}ms")
    print(f"   Engagement: {row[5]}")

# View recordings
print("\n\n🎥 RECORDINGS")
print("=" * 80)
cursor.execute("""
    SELECT id, meeting_id, status, duration, processed_at
    FROM meeting_recordings
    ORDER BY processed_at DESC
    LIMIT 5
""")

for row in cursor.fetchall():
    print(f"\n📹 {row[0]}")
    print(f"   Meeting: {row[1]}")
    print(f"   Status: {row[2]}")
    print(f"   Duration: {row[3]}ms")
    print(f"   Processed: {row[4]}")

conn.close()
```

**Run it:**
```bash
cd backend
python view_analytics.py
```

### Method 3: Using SQL Queries

Open a Python shell in the backend directory:

```bash
cd backend
python
```

Then run:

```python
import sqlite3

# Connect
conn = sqlite3.connect('database/laneway.db')
cursor = conn.cursor()

# Get all participants
cursor.execute("SELECT * FROM meeting_participants")
participants = cursor.fetchall()
print(f"Total participants tracked: {len(participants)}")

# Get all recordings
cursor.execute("SELECT * FROM meeting_recordings")
recordings = cursor.fetchall()
print(f"Total recordings: {len(recordings)}")

# Get analytics for a specific user
cursor.execute("""
    SELECT 
        COUNT(*) as meeting_count,
        AVG(speaking_duration) as avg_speaking,
        AVG(camera_on_duration) as avg_camera
    FROM meeting_participants
    WHERE employee_email = 'demo@laneway.com'
""")
stats = cursor.fetchone()
print(f"Your stats: {stats}")

conn.close()
```

## Method 4: API Endpoints

You can also access analytics via the API:

### Get User Analytics:
```bash
curl http://localhost:5000/api/analytics/user/demo-user-123 \
  -H "Authorization: Bearer demo-token"
```

### View in Browser:
Open: http://localhost:5000/docs

This shows the FastAPI interactive docs where you can:
1. See all available endpoints
2. Try them out directly
3. View responses

## Creating a Dashboard (Optional)

Want a visual dashboard? Create a simple HTML page:

```html
<!-- dashboard.html -->
<!DOCTYPE html>
<html>
<head>
    <title>Laneway Analytics Dashboard</title>
    <style>
        body { font-family: Arial; padding: 20px; background: #1a1a1a; color: #fff; }
        .stat-card { background: #2a2a2a; padding: 20px; margin: 10px; border-radius: 8px; }
        .stat-value { font-size: 48px; font-weight: bold; color: #4CAF50; }
        .stat-label { font-size: 14px; color: #888; }
    </style>
</head>
<body>
    <h1>📊 Laneway Analytics</h1>
    
    <div id="stats"></div>

    <script>
        async function loadStats() {
            const response = await fetch('http://localhost:5000/api/analytics/user/demo-user-123', {
                headers: {
                    'Authorization': 'Bearer demo-token'
                }
            });
            const data = await response.json();
            
            document.getElementById('stats').innerHTML = `
                <div class="stat-card">
                    <div class="stat-value">${data.meetingsThisWeek || 0}</div>
                    <div class="stat-label">Meetings This Week</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${data.avgSpeakingTime || 0}m</div>
                    <div class="stat-label">Avg Speaking Time</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${data.cameraUsageRate || 0}%</div>
                    <div class="stat-label">Camera Usage</div>
                </div>
            `;
        }
        
        loadStats();
        setInterval(loadStats, 30000); // Refresh every 30s
    </script>
</body>
</html>
```

Save this and open in your browser!

## What Analytics Are Collected

Based on your backend logs, the extension is tracking:

1. **Meeting Participation**:
   - Join/leave times
   - Meeting duration
   - Participant count

2. **Engagement Metrics**:
   - Camera on/off duration
   - Audio muted/unmuted
   - Speaking time (when implemented)

3. **Recording Data**:
   - Recording start/stop times
   - File size
   - Processing status

## Next Steps

1. **View the data** using one of the methods above
2. **Create visualizations** (charts, graphs)
3. **Export reports** (CSV, PDF)
4. **Set up alerts** (low engagement, etc.)

---

**Quick Start**: Download DB Browser for SQLite and open `backend/database/laneway.db` to see all your data! 📊
