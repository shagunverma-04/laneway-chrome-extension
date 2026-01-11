"""
Analytics API endpoints
"""

from fastapi import APIRouter, HTTPException, Header
from datetime import datetime, timedelta
import json

from api.auth import verify_token
from database import execute_query, execute_insert

router = APIRouter()

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
