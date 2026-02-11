"""
Analytics API endpoints
"""

from fastapi import APIRouter, HTTPException, Header, Query
from datetime import datetime, timedelta
from typing import Optional
import json

from api.auth import verify_token
from database import execute_query, execute_insert

router = APIRouter()


@router.get("/api/analytics/meetings")
async def get_all_meetings():
    """
    List all meetings with participant summary (no auth required for local use)
    """
    rows = execute_query(
        """SELECT DISTINCT meeting_id,
                  MIN(timestamp) as first_seen,
                  MAX(timestamp) as last_seen,
                  COUNT(*) as snapshot_count
           FROM meeting_analytics
           GROUP BY meeting_id
           ORDER BY MAX(timestamp) DESC"""
    )
    meetings = []
    for r in rows:
        meetings.append({
            "meetingId": r["meeting_id"],
            "firstSeen": r["first_seen"],
            "lastSeen": r["last_seen"],
            "snapshotCount": r["snapshot_count"]
        })
    return {"meetings": meetings, "total": len(meetings)}


@router.get("/api/analytics/meetings/{meeting_id}")
async def get_meeting_analytics(meeting_id: str, latest: bool = Query(True, description="If true, return only the latest snapshot")):
    """
    Get analytics for a specific meeting. Returns participants with join times, camera, audio status.
    """
    if latest:
        rows = execute_query(
            "SELECT * FROM meeting_analytics WHERE meeting_id = ? ORDER BY timestamp DESC LIMIT 1",
            (meeting_id,)
        )
    else:
        rows = execute_query(
            "SELECT * FROM meeting_analytics WHERE meeting_id = ? ORDER BY timestamp DESC",
            (meeting_id,)
        )

    if not rows:
        raise HTTPException(status_code=404, detail="Meeting not found")

    snapshots = []
    for r in rows:
        data = json.loads(r["data"])
        snapshots.append({
            "id": r["id"],
            "meetingId": r["meeting_id"],
            "timestamp": r["timestamp"],
            "participantCount": len(data.get("participants", [])),
            "participants": data.get("participants", [])
        })

    return {"meetingId": meeting_id, "snapshots": snapshots}


@router.post("/api/analytics/upload")
async def upload_analytics(
    data: dict,
    authorization: str = Header(None)
):
    """
    Receive real-time analytics data from extension
    """
    # Verify authentication
    user = verify_token(authorization)
    
    # Store analytics snapshot
    import uuid
    analytics_id = str(uuid.uuid4())
    
    execute_insert(
        "INSERT INTO meeting_analytics (id, meeting_id, timestamp, data) VALUES (?, ?, ?, ?)",
        (
            analytics_id,
            data.get('meetingId'),
            datetime.fromtimestamp(data.get('timestamp', 0) / 1000).isoformat(),
            json.dumps(data)
        )
    )
    
    return {"success": True}

@router.get("/api/analytics/user/{user_id}")
async def get_user_analytics(
    user_id: str,
    authorization: str = Header(None)
):
    """
    Get user's meeting analytics for popup display
    """
    # Verify authentication
    user = verify_token(authorization)
    
    # Get stats from last 7 days
    week_ago = (datetime.now() - timedelta(days=7)).isoformat()
    
    # Count meetings this week
    meetings = execute_query(
        """SELECT COUNT(DISTINCT meeting_id) as count 
           FROM meeting_participants 
           WHERE employee_id = ? AND join_time > ?""",
        (user_id, week_ago)
    )
    meetings_count = meetings[0]['count'] if meetings else 0
    
    # Calculate average speaking time
    speaking_stats = execute_query(
        """SELECT AVG(speaking_duration) as avg_speaking 
           FROM meeting_participants 
           WHERE employee_id = ? AND join_time > ?""",
        (user_id, week_ago)
    )
    avg_speaking = speaking_stats[0]['avg_speaking'] if speaking_stats and speaking_stats[0]['avg_speaking'] else 0
    avg_speaking_minutes = int(avg_speaking / 60) if avg_speaking else 0
    
    # Calculate camera usage rate
    camera_stats = execute_query(
        """SELECT 
            AVG(CAST(camera_on_duration AS FLOAT) / NULLIF((julianday(leave_time) - julianday(join_time)) * 86400, 0)) as camera_rate
           FROM meeting_participants 
           WHERE employee_id = ? AND join_time > ? AND leave_time IS NOT NULL""",
        (user_id, week_ago)
    )
    camera_rate = camera_stats[0]['camera_rate'] if camera_stats and camera_stats[0]['camera_rate'] else 0
    camera_percentage = int(camera_rate * 100) if camera_rate else 0
    
    return {
        "meetingsThisWeek": meetings_count,
        "avgSpeakingTime": avg_speaking_minutes,
        "cameraUsageRate": camera_percentage
    }
