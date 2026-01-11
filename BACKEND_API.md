# Backend API Implementation Guide

This guide shows how to add the required API endpoints to your existing AI agent project.

## Prerequisites

Your existing project should have:
- Flask or FastAPI web framework
- Database (PostgreSQL recommended)
- S3/GCS storage configured
- Your existing transcription & task extraction code

## Option 1: FastAPI Implementation

### 1. Install Dependencies

```bash
pip install fastapi uvicorn python-jose[cryptography] passlib[bcrypt] boto3
```

### 2. Create API Router

Create `api/recordings.py`:

```python
from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel
from typing import Optional, List
import boto3
from datetime import datetime, timedelta
import jwt

router = APIRouter()

# Configuration
SECRET_KEY = "your-secret-key-here"  # Change this!
S3_BUCKET = "your-bucket-name"
AWS_REGION = "us-east-1"

# Initialize S3 client
s3_client = boto3.client('s3', region_name=AWS_REGION)

# Models
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

# Auth dependency
async def get_current_user(authorization: str = Header(None)):
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    token = authorization.split(' ')[1]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        return payload
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

# Endpoints
@router.post("/api/recordings/upload-url", response_model=UploadUrlResponse)
async def get_upload_url(
    request: UploadUrlRequest,
    current_user = Depends(get_current_user)
):
    """
    Generate presigned S3 URL for direct upload from extension
    """
    # Generate unique recording ID
    recording_id = f"recording_{request.meetingId}_{int(datetime.now().timestamp())}"
    
    # S3 key
    s3_key = f"meetings/{datetime.now().strftime('%Y/%m/%d')}/{recording_id}.webm"
    
    # Generate presigned URL (valid for 1 hour)
    presigned_url = s3_client.generate_presigned_url(
        'put_object',
        Params={
            'Bucket': S3_BUCKET,
            'Key': s3_key,
            'ContentType': 'video/webm'
        },
        ExpiresIn=3600
    )
    
    # Store recording metadata in database
    # TODO: Add to your database
    # db.execute(
    #     "INSERT INTO meeting_recordings (id, meeting_id, s3_key, status) VALUES (?, ?, ?, ?)",
    #     (recording_id, request.meetingId, s3_key, 'uploading')
    # )
    
    return UploadUrlResponse(
        uploadUrl=presigned_url,
        recordingId=recording_id
    )


@router.post("/api/recordings/complete")
async def complete_recording(
    request: CompleteRecordingRequest,
    current_user = Depends(get_current_user)
):
    """
    Called when recording upload is complete
    Triggers AI processing pipeline
    """
    # Update database
    # TODO: Update your database
    # db.execute(
    #     "UPDATE meeting_recordings SET status = ?, duration = ?, uploaded_at = ? WHERE id = ?",
    #     ('processing', request.duration, datetime.now(), request.recordingId)
    # )
    
    # Store participant data
    # TODO: Save to your database
    # for participant in request.participants:
    #     db.execute(
    #         "INSERT INTO meeting_participants (...) VALUES (...)",
    #         participant data
    #     )
    
    # Trigger your existing AI processing pipeline
    # This is where you call your existing code
    try:
        # Get S3 URL
        s3_key = f"meetings/{request.recordingId}.webm"  # Adjust based on your storage
        recording_url = f"s3://{S3_BUCKET}/{s3_key}"
        
        # Call your existing functions
        # Import from your existing code:
        # from your_project.transcription import transcribe_video
        # from your_project.task_extraction import extract_tasks
        # from your_project.notion_integration import write_to_notion
        
        # transcript = transcribe_video(recording_url)
        # tasks = extract_tasks(transcript, request.metadata)
        # write_to_notion(tasks, request.metadata['participants'])
        
        # For now, return mock response
        task_count = 5  # Replace with actual task count
        
        return {
            "status": "success",
            "message": "Recording processed successfully",
            "taskCount": task_count
        }
        
    except Exception as e:
        print(f"Error processing recording: {e}")
        raise HTTPException(status_code=500, detail="Processing failed")


@router.post("/api/analytics/upload")
async def upload_analytics(
    data: dict,
    current_user = Depends(get_current_user)
):
    """
    Receive real-time analytics data from extension
    """
    # Store analytics in database
    # TODO: Save to your database
    # db.execute(
    #     "INSERT INTO meeting_analytics (meeting_id, timestamp, data) VALUES (?, ?, ?)",
    #     (data['meetingId'], data['timestamp'], json.dumps(data))
    # )
    
    return {"success": True}


@router.get("/api/analytics/user/{user_id}")
async def get_user_analytics(
    user_id: str,
    current_user = Depends(get_current_user)
):
    """
    Get user's meeting analytics for popup display
    """
    # TODO: Query your database
    # stats = db.execute(
    #     "SELECT COUNT(*) as meetings, AVG(speaking_time) as avg_speaking, AVG(camera_usage) as camera_rate "
    #     "FROM meeting_participants WHERE employee_id = ? AND join_time > ?",
    #     (user_id, datetime.now() - timedelta(days=7))
    # ).fetchone()
    
    # Mock data for now
    return {
        "meetingsThisWeek": 5,
        "avgSpeakingTime": 12,  # minutes
        "cameraUsageRate": 85  # percentage
    }
```

### 3. Create Auth Router

Create `api/auth.py`:

```python
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from passlib.context import CryptContext
import jwt
from datetime import datetime, timedelta

router = APIRouter()

SECRET_KEY = "your-secret-key-here"  # Change this!
ALGORITHM = "HS256"
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class LoginRequest(BaseModel):
    email: str
    password: str

class LoginResponse(BaseModel):
    token: str
    userId: str

@router.post("/api/auth/login", response_model=LoginResponse)
async def login(request: LoginRequest):
    """
    Authenticate user and return JWT token
    """
    # TODO: Query your database for user
    # user = db.execute(
    #     "SELECT id, email, password_hash FROM employees WHERE email = ?",
    #     (request.email,)
    # ).fetchone()
    
    # For demo purposes - REPLACE WITH REAL AUTH
    if request.email == "demo@laneway.com" and request.password == "demo123":
        user_id = "user_123"
        
        # Create JWT token
        token_data = {
            "sub": user_id,
            "email": request.email,
            "exp": datetime.utcnow() + timedelta(days=30)
        }
        token = jwt.encode(token_data, SECRET_KEY, algorithm=ALGORITHM)
        
        return LoginResponse(
            token=token,
            userId=user_id
        )
    else:
        raise HTTPException(status_code=401, detail="Invalid credentials")
```

### 4. Create Absence Router

Create `api/absences.py`:

```python
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

router = APIRouter()

class AbsenceRequest(BaseModel):
    meeting_id: str
    employee_id: str
    reason: str
    absence_type: str
    expected_duration: Optional[str] = 'all_meeting'
    alternative_contact_id: Optional[str] = None

@router.post("/api/absences/notify")
async def notify_absence(
    absence: AbsenceRequest,
    current_user = Depends(get_current_user)
):
    """
    Employee submits absence notification
    """
    # TODO: Save to database
    # absence_id = db.execute(
    #     "INSERT INTO meeting_absences (meeting_id, employee_id, reason, absence_type, informed_at) "
    #     "VALUES (?, ?, ?, ?, ?)",
    #     (absence.meeting_id, absence.employee_id, absence.reason, absence.absence_type, datetime.now())
    # ).lastrowid
    
    # TODO: Send notification to meeting organizer
    # send_email_notification(meeting_organizer, absence)
    
    return {
        "id": "absence_123",
        "status": "success",
        "message": "Absence notification sent"
    }


@router.get("/api/absences/meeting/{meeting_id}")
async def get_meeting_absences(meeting_id: str):
    """
    Get all absences for a meeting (called by extension when meeting starts)
    """
    # TODO: Query database
    # absences = db.execute(
    #     "SELECT * FROM meeting_absences WHERE meeting_id = ?",
    #     (meeting_id,)
    # ).fetchall()
    
    # Mock data
    return {
        "meeting_id": meeting_id,
        "absences": [
            {
                "employee_name": "John Doe",
                "employee_email": "john@company.com",
                "department": "Engineering",
                "reason": "Doctor appointment",
                "absence_type": "sick",
                "informed_at": datetime.now().isoformat(),
                "expected_duration": "first_30min"
            }
        ],
        "total_absences": 1
    }


@router.post("/api/absences/mark-shown")
async def mark_absences_shown(data: dict):
    """
    Mark absences as displayed in meeting
    """
    # TODO: Update database
    # db.execute(
    #     "UPDATE meeting_absences SET shown_in_meeting = TRUE WHERE id IN (?)",
    #     (data['absence_ids'],)
    # )
    
    return {"success": True}
```

### 5. Main App Setup

Update your main app file (e.g., `main.py` or `app.py`):

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api import recordings, auth, absences

app = FastAPI(title="Laneway Backend API")

# Enable CORS for Chrome extension
app.add_middleware(
    CORSMiddleware,
    allow_origins=["chrome-extension://*"],  # Allow all Chrome extensions
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router)
app.include_router(recordings.router)
app.include_router(absences.router)

# Your existing routes
# ... existing code ...

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000)
```

## Option 2: Flask Implementation

If you're using Flask, here's the equivalent:

```python
from flask import Flask, request, jsonify
from flask_cors import CORS
import jwt
import boto3
from datetime import datetime, timedelta

app = Flask(__name__)
CORS(app)  # Enable CORS

SECRET_KEY = "your-secret-key"
s3_client = boto3.client('s3')

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.json
    # Authenticate user
    # ... auth logic ...
    token = jwt.encode({
        'sub': user_id,
        'exp': datetime.utcnow() + timedelta(days=30)
    }, SECRET_KEY)
    return jsonify({'token': token, 'userId': user_id})

@app.route('/api/recordings/upload-url', methods=['POST'])
def get_upload_url():
    # Verify auth token
    token = request.headers.get('Authorization', '').split(' ')[1]
    # ... generate presigned URL ...
    return jsonify({'uploadUrl': url, 'recordingId': recording_id})

# ... other endpoints ...
```

## Database Schema

Add these tables to your existing database:

```sql
-- Meeting recordings
CREATE TABLE meeting_recordings (
    id VARCHAR PRIMARY KEY,
    meeting_id VARCHAR,
    s3_key VARCHAR,
    status VARCHAR,  -- 'uploading', 'processing', 'completed'
    duration INTEGER,
    uploaded_at TIMESTAMP,
    processed_at TIMESTAMP
);

-- Meeting participants (enhanced from your existing table)
CREATE TABLE meeting_participants (
    id UUID PRIMARY KEY,
    meeting_id VARCHAR,
    employee_id VARCHAR,
    join_time TIMESTAMP,
    leave_time TIMESTAMP,
    camera_on_duration INTEGER,
    speaking_duration INTEGER,
    engagement_score FLOAT
);

-- Meeting absences
CREATE TABLE meeting_absences (
    id UUID PRIMARY KEY,
    meeting_id VARCHAR,
    employee_id VARCHAR,
    reason TEXT,
    absence_type VARCHAR,
    informed_at TIMESTAMP,
    shown_in_meeting BOOLEAN DEFAULT FALSE
);
```

## Testing

Test your API endpoints:

```bash
# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "demo@laneway.com", "password": "demo123"}'

# Get upload URL
curl -X POST http://localhost:5000/api/recordings/upload-url \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"meetingId": "test-123", "estimatedSize": 1000000, "format": "webm-audio"}'
```

## Deployment

1. Deploy to your preferred platform (AWS, GCP, Heroku, etc.)
2. Update `config.js` in the extension with your production URL
3. Ensure HTTPS is enabled
4. Configure CORS to allow your extension

## Integration with Existing Code

The key is in the `complete_recording` endpoint. This is where you call your existing functions:

```python
# In complete_recording endpoint
from your_existing_project.transcription import transcribe_video
from your_existing_project.task_extraction import extract_tasks
from your_existing_project.notion_sync import write_to_notion

# When recording completes
transcript = transcribe_video(recording_url)
tasks = extract_tasks(transcript)
write_to_notion(tasks, metadata)
```

Your existing pipeline remains unchanged - you're just adding an API layer on top!
