"""
Absence management API endpoints
"""

from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import uuid

from api.auth import verify_token
from database import execute_query, execute_insert

router = APIRouter()

class AbsenceRequest(BaseModel):
    meeting_id: str
    employee_id: str
    reason: str
    absence_type: str
    expected_duration: Optional[str] = 'all_meeting'

@router.post("/api/absences/notify")
async def notify_absence(
    absence: AbsenceRequest,
    authorization: str = Header(None)
):
    """
    Employee submits absence notification
    """
    # Verify authentication
    user = verify_token(authorization)
    
    # Get employee details
    employees = execute_query(
        "SELECT full_name, email, department FROM employees WHERE id = ?",
        (absence.employee_id,)
    )
    
    employee_name = employees[0]['full_name'] if employees else 'Unknown'
    employee_email = employees[0]['email'] if employees else ''
    department = employees[0]['department'] if employees else ''
    
    # Create absence record
    absence_id = str(uuid.uuid4())
    execute_insert(
        """INSERT INTO meeting_absences 
        (id, meeting_id, employee_id, employee_name, employee_email, department, 
         reason, absence_type, expected_duration, informed_at) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            absence_id,
            absence.meeting_id,
            absence.employee_id,
            employee_name,
            employee_email,
            department,
            absence.reason,
            absence.absence_type,
            absence.expected_duration,
            datetime.now().isoformat()
        )
    )
    
    # TODO: Send notification to meeting organizer
    # send_email_notification(meeting_organizer, absence)
    
    return {
        "id": absence_id,
        "status": "success",
        "message": "Absence notification sent successfully"
    }

@router.get("/api/absences/meeting/{meeting_id}")
async def get_meeting_absences(meeting_id: str):
    """
    Get all absences for a meeting
    Called by extension when meeting starts
    """
    absences = execute_query(
        """SELECT employee_name, employee_email, department, reason, 
                  absence_type, informed_at, expected_duration 
           FROM meeting_absences 
           WHERE meeting_id = ? AND shown_in_meeting = 0""",
        (meeting_id,)
    )
    
    absence_list = [
        {
            "employee_name": row['employee_name'],
            "employee_email": row['employee_email'],
            "department": row['department'],
            "reason": row['reason'],
            "absence_type": row['absence_type'],
            "informed_at": row['informed_at'],
            "expected_duration": row['expected_duration']
        }
        for row in absences
    ]
    
    return {
        "meeting_id": meeting_id,
        "absences": absence_list,
        "total_absences": len(absence_list)
    }

@router.post("/api/absences/mark-shown")
async def mark_absences_shown(data: dict):
    """
    Mark absences as displayed in meeting
    """
    meeting_id = data.get('meeting_id')
    
    if not meeting_id:
        raise HTTPException(status_code=400, detail="meeting_id is required")
    
    execute_query(
        "UPDATE meeting_absences SET shown_in_meeting = 1 WHERE meeting_id = ?",
        (meeting_id,)
    )
    
    return {"success": True}
