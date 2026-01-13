"""
Recording management API endpoints
"""

from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import uuid
import sys
from pathlib import Path

# Add parent directory to path to import storage module
sys.path.append(str(Path(__file__).parent.parent))

from api.auth import verify_token
from database import execute_query, execute_insert
from storage.r2_storage import R2Storage

router = APIRouter()

# Initialize R2 storage
try:
    r2_storage = R2Storage()
    print("✅ R2 Storage initialized")
except Exception as e:
    print(f"⚠️ R2 Storage initialization failed: {e}")
    print("   Falling back to local storage")
    r2_storage = None

class UploadUrlRequest(BaseModel):
    meetingId: str
    estimatedSize: int
    format: str

class UploadUrlResponse(BaseModel):
    uploadUrl: str
    recordingId: str

class Participant(BaseModel):
    id: str
    name: str
    email: Optional[str] = None
    joinTime: int
    cameraOn: bool
    audioMuted: bool
    cameraOnDuration: int
    speakingEvents: List[dict]

class CompleteRecordingRequest(BaseModel):
    recordingId: str
    meetingId: str
    metadata: dict
    participants: List[Participant]
    duration: int

@router.post("/api/recordings/upload-url", response_model=UploadUrlResponse)
async def get_upload_url(
    request: UploadUrlRequest,
    authorization: str = Header(None)
):
    """
    Generate presigned upload URL for recording to R2
    """
    # Verify authentication
    user = verify_token(authorization)
    
    # Generate unique recording ID
    recording_id = f"recording_{request.meetingId}_{int(datetime.now().timestamp())}"
    
    # Generate R2 presigned upload URL
    if r2_storage:
        try:
            upload_url, storage_key = r2_storage.generate_upload_url(recording_id)
            print(f"✅ Generated R2 upload URL for {recording_id}")
        except Exception as e:
            print(f"❌ Failed to generate R2 URL: {e}")
            upload_url = f"local://recordings/{recording_id}.webm"
            storage_key = f"recordings/{recording_id}.webm"
    else:
        # Fallback to local storage
        upload_url = f"local://recordings/{recording_id}.webm"
        storage_key = f"recordings/{recording_id}.webm"
    
    # Store recording metadata in database
    execute_insert(
        "INSERT INTO meeting_recordings (id, meeting_id, storage_key, status) VALUES (?, ?, ?, ?)",
        (recording_id, request.meetingId, storage_key, 'uploading')
    )
    
    return UploadUrlResponse(
        uploadUrl=upload_url,
        recordingId=recording_id
    )

@router.post("/api/recordings/complete")
async def complete_recording(
    request: CompleteRecordingRequest,
    authorization: str = Header(None)
):
    """
    Called when recording upload is complete
    This is where you would trigger your AI processing pipeline
    """
    # Verify authentication
    user = verify_token(authorization)
    
    # Update recording status
    execute_query(
        "UPDATE meeting_recordings SET status = ?, duration = ?, processed_at = ? WHERE id = ?",
        ('completed', request.duration, datetime.now().isoformat(), request.recordingId)
    )
    
    # Store participant data
    for participant in request.participants:
        participant_id = str(uuid.uuid4())
        
        # Calculate speaking duration from events
        speaking_duration = sum(
            event.get('duration', 0) 
            for event in participant.speakingEvents 
            if event.get('type') == 'speaking'
        )
        
        execute_insert(
            """INSERT INTO meeting_participants 
            (id, meeting_id, employee_name, employee_email, join_time, 
             camera_on_duration, speaking_duration, engagement_score) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                participant_id,
                request.meetingId,
                participant.name,
                participant.email,
                datetime.fromtimestamp(participant.joinTime / 1000).isoformat(),
                participant.cameraOnDuration,
                speaking_duration,
                0.0  # Calculate engagement score later
            )
        )
    
    # TODO: Trigger your existing AI processing pipeline here
    # Example:
    # from your_ai_agent.transcription import transcribe_video
    # from your_ai_agent.task_extraction import extract_tasks
    # from your_ai_agent.notion_sync import write_to_notion
    # 
    # recording_url = get_recording_url(request.recordingId)
    # transcript = transcribe_video(recording_url)
    # tasks = extract_tasks(transcript)
    # write_to_notion(tasks, request.metadata)
    
    # For now, return mock response
    task_count = 0  # Replace with actual task count from your pipeline
    
    return {
        "status": "success",
        "message": "Recording processed successfully",
        "taskCount": task_count
    }
