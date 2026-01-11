# LANEWAY CHROME EXTENSION - Master Development Prompt

## Project Overview
Build a Chrome extension called "Laneway" that records Google Meet sessions, captures participant behavioral data, and uploads recordings to cloud storage for automated processing by an existing AI agent.

## Core Requirements

### 1. CHROME EXTENSION STRUCTURE (Manifest V3)
Create a Chrome extension with:

**manifest.json:**
- Permissions: `tabCapture`, `storage`, `tabs`, `activeTab`, `desktopCapture`
- Host permissions: `https://meet.google.com/*`
- Background service worker
- Content script for Google Meet pages
- Popup UI for controls

**File Structure:**
```
laneway-extension/
├── manifest.json
├── background.js (service worker)
├── content-script.js (injected into Meet)
├── popup/
│   ├── popup.html
│   ├── popup.js
│   └── popup.css
├── recorder/
│   ├── recorder.js (MediaRecorder logic)
│   └── uploader.js (S3/GCS upload)
├── analytics/
│   └── tracker.js (behavioral data collection)
├── config.js (API keys, storage config)
└── icons/
```

### 2. RECORDING FUNCTIONALITY

**Requirements:**
- Detect when user is on a Google Meet call
- Show recording indicator in Meet UI
- Capture audio + video streams using `chrome.tabCapture`
- Option to record audio-only (default) or audio+video
- Use MediaRecorder API with VP9/H.264 codec
- Stream recording in chunks (5-minute segments) to avoid memory issues

**Recording Controls:**
- Start/Stop recording button in popup
- Auto-start option (with consent confirmation)
- Quality selector: Low (audio-only), Medium (720p), High (1080p)
- Status indicator: Recording time, file size estimate

**Code Template for Recorder:**
```javascript
// recorder.js
class MeetingRecorder {
  constructor() {
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.startTime = null;
    this.meetingId = null;
  }

  async startRecording(audioOnly = true) {
    // Get tab media stream
    // Initialize MediaRecorder with chunks
    // Set up 5-minute chunk intervals
    // Upload chunks progressively to cloud storage
  }

  stopRecording() {
    // Finalize recording
    // Upload remaining chunks
    // Send metadata to backend
  }
}
```

### 3. BEHAVIORAL DATA COLLECTION

**Track the following in real-time:**
- Meeting start/end time
- Participant list (scrape from Meet UI)
- For each participant:
  - Join time, leave time
  - Camera on/off status (with timestamps)
  - Audio muted/unmuted status
  - Active speaker detection (visual cues from Meet UI)
  
**Implementation:**
- Use MutationObserver to watch Google Meet DOM
- Track participants container: `[data-participant-id]` elements
- Monitor video tiles for camera status
- Track audio indicators for speaking activity
- Store data in Chrome local storage temporarily
- Upload to backend API every 30 seconds

**Data Schema:**
```javascript
{
  meetingId: "unique-meeting-id",
  meetingTitle: "extracted-from-meet-url-or-title",
  startTime: "2025-01-05T10:00:00Z",
  endTime: "2025-01-05T11:00:00Z",
  participants: [
    {
      name: "John Doe",
      email: "john@company.com", // if detectable
      joinTime: "2025-01-05T10:00:00Z",
      leaveTime: "2025-01-05T11:00:00Z",
      cameraOnDuration: 1800, // seconds
      speakingEvents: [
        { start: "10:05:00", end: "10:07:30" }
      ]
    }
  ],
  recordingUrl: "s3://bucket/meetings/2025-01-05-meeting-id.webm"
}
```

### 4. CLOUD UPLOAD SYSTEM

**Storage Options:**
- AWS S3 with presigned URLs
- Google Cloud Storage
- Use chunked multipart upload for large files

**Upload Flow:**
1. Extension requests upload URL from your backend API
2. Backend generates presigned URL and returns it
3. Extension uploads directly to S3/GCS (client-side)
4. On completion, extension notifies backend with metadata
5. Backend triggers AI processing pipeline

**Uploader Code Template:**
```javascript
// uploader.js
class CloudUploader {
  async requestUploadUrl(meetingId, fileSize) {
    // Call your backend API: POST /api/recordings/upload-url
    // Returns: { uploadUrl, recordingId }
  }

  async uploadChunk(uploadUrl, chunk, partNumber) {
    // Upload chunk using fetch with PUT
    // Return etag for multipart completion
  }

  async completeUpload(meetingId, recordingId, metadata) {
    // Notify backend: POST /api/recordings/complete
    // Include all behavioral metadata
  }
}
```

### 5. USER INTERFACE

**Popup UI (popup.html):**
- Meeting status: "No active meeting" / "In meeting"
- Recording status with time elapsed
- Start/Stop recording button
- Settings:
  - Recording quality (audio-only, 720p, 1080p)
  - Auto-start recording toggle
  - Participant tracking toggle
- Link to view analytics dashboard
- Login/auth status

**In-Meet Indicator (Content Script):**
- Inject a small badge in Meet UI showing "🔴 Recording"
- Respect Google Meet's UI design patterns

### 6. BACKEND API INTEGRATION

**Your extension needs these API endpoints from your AI agent backend:**
```
POST /api/auth/login
- Authenticate extension user
- Return JWT token

POST /api/recordings/upload-url
- Request: { meetingId, estimatedSize, format }
- Response: { uploadUrl, recordingId }

POST /api/recordings/complete
- Request: { recordingId, meetingId, metadata, participants }
- Triggers AI processing pipeline
- Response: { status, taskCount }

GET /api/analytics/user/{userId}
- Get user's meeting analytics
- For popup display
```

### 7. CONNECTING TO YOUR EXISTING AI AGENT

**Backend Setup (in your AI agent project):**

1. **Add API endpoints** (above) to receive uploads
2. **S3 Event Trigger:**
```python
# When extension uploads to S3, trigger your existing pipeline
# AWS Lambda example:
def lambda_handler(event, context):
    recording_url = event['Records'][0]['s3']['object']['key']
    meeting_metadata = fetch_metadata_from_db(recording_url)
    
    # Call your existing AI agent functions:
    transcribe_video(recording_url)
    extract_tasks(transcript, meeting_metadata)
    write_to_notion(tasks, departments)
    calculate_analytics(meeting_metadata)
```

3. **Database Schema Addition:**
```sql
-- Add to your existing database
CREATE TABLE meeting_recordings (
  id UUID PRIMARY KEY,
  meeting_id VARCHAR,
  recording_url TEXT,
  upload_time TIMESTAMP,
  processed BOOLEAN DEFAULT FALSE
);

CREATE TABLE meeting_participants (
  id UUID PRIMARY KEY,
  meeting_id UUID REFERENCES meeting_recordings(id),
  employee_id UUID REFERENCES employees(id),
  join_time TIMESTAMP,
  leave_time TIMESTAMP,
  camera_on_duration INTEGER,
  speaking_duration INTEGER,
  engagement_score FLOAT
);
```

### 8. SECURITY & PRIVACY

**Implement:**
- User authentication (OAuth or JWT)
- Encrypted storage of API keys in extension
- Clear consent flow before first recording
- Visual recording indicator always visible
- GDPR-compliant data handling
- Option to exclude specific participants from tracking
- Secure transmission (HTTPS only)

**Consent Flow:**
1. First time: Show modal explaining what's recorded
2. Require explicit "I Consent" button click
3. Show recording indicator in all meetings
4. Allow per-meeting opt-out

### 9. ANALYTICS & REPORTING

**Extension should send data for:**
- Daily upload of participant analytics to your backend
- Your backend generates weekly/monthly reports
- Extension popup can show personal stats (meetings attended, speaking time)

**Backend Processing:**
```python
# In your AI agent, add:
def generate_weekly_report(user_id, week):
    meetings = get_meetings_for_week(user_id, week)
    analytics = {
        'total_meetings': len(meetings),
        'total_duration': sum(m.duration for m in meetings),
        'avg_speaking_time': calculate_avg_speaking(meetings),
        'camera_usage_rate': calculate_camera_rate(meetings),
        'engagement_score': calculate_engagement(meetings)
    }
    create_notion_page("Weekly Report", analytics)
```

### 10. DEVELOPMENT PRIORITIES

**Phase 1: MVP**
- Basic recording functionality (audio-only)
- Upload to S3 with metadata
- Trigger existing AI pipeline
- Simple popup UI

**Phase 2: Behavioral Tracking**
- Participant detection
- Camera/audio status tracking
- Basic analytics collection

**Phase 3: Advanced Features**
- Speaker diarization integration
- Real-time engagement scoring
- Weekly report generation
- Team analytics dashboard

## Technical Stack Recommendations

**Extension:**
- Vanilla JavaScript (no framework needed for extension)
- Tailwind CSS (via CDN) for popup styling

**Backend Integration:**
- REST API with JWT auth
- AWS SDK for S3 operations
- PostgreSQL for metadata storage

**Testing:**
- Load extension in Chrome developer mode
- Test with real Google Meet calls
- Monitor console for errors
- Test upload with various file sizes

## Key Implementation Notes

1. **Chrome Extension runs entirely in browser** - it's just a data collector
2. **Your AI agent remains unchanged** - just add API endpoints to receive data
3. **Connection via cloud storage** - S3 is the handoff point
4. **Metadata in database** - both extension and agent read/write to shared DB
5. **Processing happens in your existing pipeline** - extension doesn't do AI work

## Success Criteria

Extension should:
✅ Record meetings without user needing to manually export
✅ Upload directly to cloud storage
✅ Automatically trigger your AI agent processing
✅ Track participant behavior accurately
✅ Not crash or slow down Google Meet
✅ Handle network interruptions gracefully
✅ Provide clear user feedback on recording status

---

Build this extension as a separate Git repository, but configure it to communicate with your existing AI agent backend through the API endpoints specified above.
```

---

## How to Connect the Two Projects

### Project Structure:
```
your-workspace/
├── laneway-ai-agent/          # Your existing project
│   ├── transcription/
│   ├── task_extraction/
│   ├── notion_integration/
│   └── api/                   # ADD THIS - API endpoints
│       ├── recordings.py
│       ├── analytics.py
│       └── auth.py
│
└── laneway-chrome-extension/  # New project
    ├── manifest.json
    ├── background.js
    └── ...
    
### 11. ABSENCE MANAGEMENT SYSTEM

## Overview
Allow employees to inform in advance if they cannot attend scheduled meetings. Display absence notifications in Google Meet UI and include in reports.

## Architecture Components

### A. ABSENCE NOTIFICATION FLOW
```
Employee → Absence Form (Web/Extension/Slack) → Backend API → Database
                                                      ↓
Chrome Extension ← Fetch Absences ← Meeting Starts
       ↓
Display in Meet UI + Send to Analytics
       ↓
Include in Reports (Weekly/Monthly)
```

### B. DATABASE SCHEMA

Add these tables to your existing database:
```sql
-- Scheduled meetings table
CREATE TABLE scheduled_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id VARCHAR UNIQUE, -- Google Meet ID or Calendar Event ID
  meeting_title VARCHAR(500),
  scheduled_start TIMESTAMP NOT NULL,
  scheduled_end TIMESTAMP,
  organizer_id UUID REFERENCES employees(id),
  calendar_event_id VARCHAR, -- Google Calendar Event ID
  created_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_scheduled_start (scheduled_start)
);

-- Expected participants
CREATE TABLE meeting_participants_expected (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID REFERENCES scheduled_meetings(id),
  employee_id UUID REFERENCES employees(id),
  department_id UUID REFERENCES departments(id),
  is_required BOOLEAN DEFAULT TRUE, -- required vs optional attendee
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(meeting_id, employee_id)
);

-- Absence notifications
CREATE TABLE meeting_absences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID REFERENCES scheduled_meetings(id),
  employee_id UUID REFERENCES employees(id),
  reason TEXT NOT NULL,
  informed_at TIMESTAMP DEFAULT NOW(),
  notified_organizer BOOLEAN DEFAULT FALSE,
  shown_in_meeting BOOLEAN DEFAULT FALSE, -- tracked by extension
  absence_type VARCHAR(50), -- 'sick', 'vacation', 'conflict', 'emergency', 'other'
  expected_duration VARCHAR(100), -- 'all_meeting', 'first_30min', 'joining_late'
  alternative_contact UUID REFERENCES employees(id), -- who to contact instead
  created_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_meeting_absence (meeting_id, employee_id)
);

-- Attendance tracking (enhanced)
CREATE TABLE meeting_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID REFERENCES scheduled_meetings(id),
  employee_id UUID REFERENCES employees(id),
  join_time TIMESTAMP,
  leave_time TIMESTAMP,
  camera_on_duration INTEGER DEFAULT 0,
  speaking_duration INTEGER DEFAULT 0,
  engagement_score FLOAT,
  was_absent BOOLEAN DEFAULT FALSE,
  absence_id UUID REFERENCES meeting_absences(id), -- link to absence if informed
  status VARCHAR(50), -- 'attended', 'absent_informed', 'absent_uninformed', 'late'
  created_at TIMESTAMP DEFAULT NOW()
);
```

### C. BACKEND API ENDPOINTS

Add these endpoints to your AI agent backend:
```python
# api/absences.py

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from datetime import datetime
from typing import Optional

router = APIRouter()

class AbsenceRequest(BaseModel):
    meeting_id: str  # Google Meet ID or Calendar Event ID
    employee_id: str
    reason: str
    absence_type: str  # 'sick', 'vacation', 'conflict', 'emergency', 'other'
    expected_duration: Optional[str] = 'all_meeting'
    alternative_contact_id: Optional[str] = None

class AbsenceResponse(BaseModel):
    id: str
    status: str
    message: str

@router.post("/api/absences/notify", response_model=AbsenceResponse)
async def notify_absence(absence: AbsenceRequest, current_user = Depends(get_current_user)):
    """
    Employee submits absence notification for a meeting
    """
    # Validate meeting exists
    meeting = db.query(ScheduledMeeting).filter(
        ScheduledMeeting.meeting_id == absence.meeting_id
    ).first()
    
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    # Check if meeting hasn't happened yet
    if meeting.scheduled_start < datetime.utcnow():
        raise HTTPException(
            status_code=400, 
            detail="Cannot notify absence for past meetings"
        )
    
    # Create absence record
    absence_record = MeetingAbsence(
        meeting_id=meeting.id,
        employee_id=absence.employee_id,
        reason=absence.reason,
        absence_type=absence.absence_type,
        expected_duration=absence.expected_duration,
        alternative_contact=absence.alternative_contact_id,
        informed_at=datetime.utcnow()
    )
    db.add(absence_record)
    db.commit()
    
    # Notify meeting organizer
    await notify_organizer(meeting.organizer_id, absence_record)
    
    # Send to Slack/Email if integrated
    await send_absence_notification(meeting, absence_record)
    
    return AbsenceResponse(
        id=str(absence_record.id),
        status="success",
        message=f"Absence notification sent for {meeting.meeting_title}"
    )


@router.get("/api/absences/meeting/{meeting_id}")
async def get_meeting_absences(meeting_id: str):
    """
    Get all absence notifications for a specific meeting
    Chrome extension calls this when meeting starts
    """
    absences = db.query(MeetingAbsence).join(
        Employee
    ).filter(
        MeetingAbsence.meeting_id == meeting_id
    ).all()
    
    return {
        "meeting_id": meeting_id,
        "absences": [
            {
                "employee_name": a.employee.name,
                "employee_email": a.employee.email,
                "department": a.employee.department.name,
                "reason": a.reason,
                "absence_type": a.absence_type,
                "informed_at": a.informed_at.isoformat(),
                "expected_duration": a.expected_duration,
                "alternative_contact": a.alternative_contact.name if a.alternative_contact else None
            }
            for a in absences
        ],
        "total_absences": len(absences)
    }


@router.get("/api/absences/upcoming")
async def get_upcoming_absences(employee_id: Optional[str] = None):
    """
    Get upcoming absences for an employee or all employees
    Used for dashboard display
    """
    query = db.query(MeetingAbsence).join(
        ScheduledMeeting
    ).filter(
        ScheduledMeeting.scheduled_start > datetime.utcnow()
    )
    
    if employee_id:
        query = query.filter(MeetingAbsence.employee_id == employee_id)
    
    absences = query.order_by(ScheduledMeeting.scheduled_start).all()
    
    return {
        "upcoming_absences": [
            {
                "meeting_title": a.meeting.meeting_title,
                "meeting_time": a.meeting.scheduled_start.isoformat(),
                "employee_name": a.employee.name,
                "reason": a.reason,
                "absence_type": a.absence_type
            }
            for a in absences
        ]
    }


@router.post("/api/meetings/sync-calendar")
async def sync_google_calendar(current_user = Depends(get_current_user)):
    """
    Sync upcoming meetings from Google Calendar
    Creates scheduled_meetings records
    """
    # Use Google Calendar API to fetch upcoming meetings
    calendar_service = get_google_calendar_service(current_user)
    
    events = calendar_service.events().list(
        calendarId='primary',
        timeMin=datetime.utcnow().isoformat() + 'Z',
        maxResults=50,
        singleEvents=True,
        orderBy='startTime'
    ).execute()
    
    synced_meetings = []
    for event in events.get('items', []):
        # Only sync if it's a Google Meet meeting
        if 'hangoutLink' in event:
            meeting = create_or_update_scheduled_meeting(event)
            synced_meetings.append(meeting)
    
    return {
        "status": "success",
        "synced_count": len(synced_meetings),
        "meetings": synced_meetings
    }
```

### D. CHROME EXTENSION UPDATES

#### 1. Add Absence Display in Content Script
```javascript
// content-script.js - Add to existing file

class AbsenceManager {
  constructor() {
    this.absences = [];
    this.meetingId = this.extractMeetingId();
  }

  extractMeetingId() {
    // Extract meeting ID from Google Meet URL
    const url = window.location.href;
    const match = url.match(/meet\.google\.com\/([a-z-]+)/);
    return match ? match[1] : null;
  }

  async fetchAbsences() {
    if (!this.meetingId) return;

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/absences/meeting/${this.meetingId}`,
        {
          headers: {
            'Authorization': `Bearer ${await getAuthToken()}`
          }
        }
      );

      const data = await response.json();
      this.absences = data.absences || [];
      
      if (this.absences.length > 0) {
        this.displayAbsences();
        this.markAsShown();
      }
    } catch (error) {
      console.error('Failed to fetch absences:', error);
    }
  }

  displayAbsences() {
    // Create absence notification banner in Google Meet UI
    const banner = this.createAbsenceBanner();
    
    // Insert at top of Google Meet interface
    const meetContainer = document.querySelector('[data-meeting-title]') 
      || document.querySelector('.KUfYIc'); // Meet's main container
    
    if (meetContainer) {
      meetContainer.insertAdjacentElement('afterbegin', banner);
    }
  }

  createAbsenceBanner() {
    const banner = document.createElement('div');
    banner.id = 'laneway-absence-banner';
    banner.style.cssText = `
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      margin: 10px;
      font-family: 'Google Sans', Arial, sans-serif;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      animation: slideDown 0.3s ease-out;
    `;

    const title = document.createElement('div');
    title.style.cssText = `
      font-weight: 600;
      font-size: 14px;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
    `;
    title.innerHTML = `
      <span style="margin-right: 8px;">ℹ️</span>
      ${this.absences.length} team member${this.absences.length > 1 ? 's' : ''} 
      ${this.absences.length > 1 ? 'are' : 'is'} absent
    `;

    const absenceList = document.createElement('div');
    absenceList.style.cssText = `
      font-size: 13px;
      line-height: 1.6;
    `;

    this.absences.forEach(absence => {
      const item = document.createElement('div');
      item.style.cssText = `
        background: rgba(255,255,255,0.15);
        padding: 8px 12px;
        border-radius: 6px;
        margin-bottom: 6px;
        backdrop-filter: blur(10px);
      `;
      
      const reasonIcon = this.getReasonIcon(absence.absence_type);
      
      item.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: start;">
          <div style="flex: 1;">
            <strong>${absence.employee_name}</strong> 
            <span style="opacity: 0.9;">(${absence.department})</span>
            <div style="margin-top: 4px; opacity: 0.95;">
              ${reasonIcon} ${absence.reason}
            </div>
            ${absence.expected_duration !== 'all_meeting' ? 
              `<div style="font-size: 11px; margin-top: 4px; opacity: 0.8;">
                Duration: ${absence.expected_duration}
              </div>` : ''
            }
            ${absence.alternative_contact ? 
              `<div style="font-size: 11px; margin-top: 4px; opacity: 0.8;">
                Contact: ${absence.alternative_contact}
              </div>` : ''
            }
          </div>
          <div style="font-size: 11px; opacity: 0.7; margin-left: 12px; white-space: nowrap;">
            Informed ${this.formatTime(absence.informed_at)}
          </div>
        </div>
      `;
      
      absenceList.appendChild(item);
    });

    banner.appendChild(title);
    banner.appendChild(absenceList);

    // Add close button
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '✕';
    closeBtn.style.cssText = `
      position: absolute;
      top: 10px;
      right: 10px;
      background: rgba(255,255,255,0.2);
      border: none;
      color: white;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      cursor: pointer;
      font-size: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    closeBtn.onclick = () => banner.remove();
    banner.appendChild(closeBtn);

    return banner;
  }

  getReasonIcon(absenceType) {
    const icons = {
      'sick': '🤒',
      'vacation': '🏖️',
      'conflict': '📅',
      'emergency': '🚨',
      'other': '📝'
    };
    return icons[absenceType] || '📝';
  }

  formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffHours = (now - date) / (1000 * 60 * 60);

    if (diffHours < 1) return 'just now';
    if (diffHours < 24) return `${Math.floor(diffHours)}h ago`;
    if (diffHours < 48) return 'yesterday';
    return date.toLocaleDateString();
  }

  async markAsShown() {
    // Mark absences as shown in the meeting
    await fetch(`${API_BASE_URL}/api/absences/mark-shown`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${await getAuthToken()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        meeting_id: this.meetingId,
        absence_ids: this.absences.map(a => a.id)
      })
    });
  }
}

// Initialize when meeting starts
const absenceManager = new AbsenceManager();
window.addEventListener('load', () => {
  setTimeout(() => absenceManager.fetchAbsences(), 2000);
});
```

#### 2. Add Absence Form in Popup
```javascript
// popup/popup.js - Add absence notification UI

function renderAbsenceForm(meeting) {
  const formHTML = `
    <div id="absence-form" style="margin-top: 20px; padding: 15px; background: #f5f5f5; border-radius: 8px;">
      <h3 style="margin: 0 0 12px 0; font-size: 14px;">Cannot attend this meeting?</h3>
      
      <select id="absence-type" style="width: 100%; padding: 8px; margin-bottom: 10px; border-radius: 4px; border: 1px solid #ddd;">
        <option value="">Select reason type</option>
        <option value="sick">Sick Leave</option>
        <option value="vacation">Vacation</option>
        <option value="conflict">Schedule Conflict</option>
        <option value="emergency">Emergency</option>
        <option value="other">Other</option>
      </select>

      <textarea 
        id="absence-reason" 
        placeholder="Explain your absence (will be shown to team)..." 
        style="width: 100%; padding: 8px; min-height: 60px; border-radius: 4px; border: 1px solid #ddd; font-family: inherit; resize: vertical;"
      ></textarea>

      <select id="absence-duration" style="width: 100%; padding: 8px; margin: 10px 0; border-radius: 4px; border: 1px solid #ddd;">
        <option value="all_meeting">Entire Meeting</option>
        <option value="first_30min">First 30 minutes</option>
        <option value="joining_late">Joining Late</option>
      </select>

      <button 
        id="submit-absence" 
        style="width: 100%; padding: 10px; background: #667eea; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 600;"
      >
        Notify Team
      </button>

      <div id="absence-status" style="margin-top: 10px; font-size: 12px; text-align: center;"></div>
    </div>
  `;

  document.getElementById('meeting-controls').insertAdjacentHTML('beforeend', formHTML);

  document.getElementById('submit-absence').addEventListener('click', submitAbsence);
}

async function submitAbsence() {
  const type = document.getElementById('absence-type').value;
  const reason = document.getElementById('absence-reason').value;
  const duration = document.getElementById('absence-duration').value;
  const statusDiv = document.getElementById('absence-status');

  if (!type || !reason.trim()) {
    statusDiv.innerHTML = '<span style="color: red;">Please select type and provide reason</span>';
    return;
  }

  statusDiv.innerHTML = '<span style="color: #666;">Sending...</span>';

  try {
    const meetingId = await getCurrentMeetingId();
    const userId = await getCurrentUserId();

    const response = await fetch(`${API_BASE_URL}/api/absences/notify`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${await getAuthToken()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        meeting_id: meetingId,
        employee_id: userId,
        reason: reason.trim(),
        absence_type: type,
        expected_duration: duration
      })
    });

    if (response.ok) {
      statusDiv.innerHTML = '<span style="color: green;">✓ Team notified successfully</span>';
      document.getElementById('absence-reason').value = '';
      
      // Optionally close popup after 2 seconds
      setTimeout(() => window.close(), 2000);
    } else {
      throw new Error('Failed to submit absence');
    }
  } catch (error) {
    statusDiv.innerHTML = '<span style="color: red;">Failed to send notification</span>';
    console.error('Absence submission error:', error);
  }
}
```

### E. REPORT INTEGRATION

Update your report generation to include absence data:
```python
# reports.py - Add to your AI agent

def generate_weekly_report(user_id=None, department_id=None, week_start=None):
    """
    Generate weekly meeting report with absence tracking
    """
    if not week_start:
        week_start = datetime.now() - timedelta(days=7)
    
    week_end = week_start + timedelta(days=7)
    
    # Get all meetings in the week
    meetings = db.query(ScheduledMeeting).filter(
        ScheduledMeeting.scheduled_start >= week_start,
        ScheduledMeeting.scheduled_start < week_end
    ).all()
    
    report_data = {
        "week": week_start.strftime("%Y-W%U"),
        "total_meetings": len(meetings),
        "meetings": []
    }
    
    for meeting in meetings:
        # Get attendance data
        attendees = db.query(MeetingAttendance).filter(
            MeetingAttendance.meeting_id == meeting.id
        ).all()
        
        # Get absences (both informed and uninformed)
        informed_absences = db.query(MeetingAbsence).filter(
            MeetingAbsence.meeting_id == meeting.id
        ).all()
        
        # Get expected participants
        expected = db.query(MeetingParticipantsExpected).filter(
            MeetingParticipantsExpected.meeting_id == meeting.id
        ).all()
        
        # Calculate uninformed absences
        attended_ids = {a.employee_id for a in attendees}
        informed_absent_ids = {a.employee_id for a in informed_absences}
        expected_ids = {e.employee_id for e in expected}
        
        uninformed_absent_ids = expected_ids - attended_ids - informed_absent_ids
        
        meeting_report = {
            "title": meeting.meeting_title,
            "date": meeting.scheduled_start.isoformat(),
            "duration": calculate_duration(meeting),
            "attendance": {
                "expected": len(expected),
                "attended": len(attendees),
                "attendance_rate": (len(attendees) / len(expected) * 100) if expected else 0
            },
            "absences": {
                "informed": [
                    {
                        "employee": a.employee.name,
                        "department": a.employee.department.name,
                        "reason": a.reason,
                        "type": a.absence_type,
                        "informed_at": a.informed_at.isoformat()
                    }
                    for a in informed_absences
                ],
                "uninformed": [
                    {
                        "employee": db.query(Employee).get(emp_id).name,
                        "department": db.query(Employee).get(emp_id).department.name
                    }
                    for emp_id in uninformed_absent_ids
                ]
            },
            "engagement": {
                "avg_camera_usage": calculate_avg_camera(attendees),
                "avg_speaking_time": calculate_avg_speaking(attendees),
                "top_contributors": get_top_contributors(attendees, limit=3)
            }
        }
        
        report_data["meetings"].append(meeting_report)
    
    # Generate summary statistics
    report_data["summary"] = {
        "total_informed_absences": sum(len(m["absences"]["informed"]) for m in report_data["meetings"]),
        "total_uninformed_absences": sum(len(m["absences"]["uninformed"]) for m in report_data["meetings"]),
        "avg_attendance_rate": calculate_avg_attendance(report_data["meetings"]),
        "most_common_absence_reason": get_most_common_absence_type(meetings)
    }
    
    # Write to Notion
    create_notion_report(report_data)
    
    return report_data


def create_notion_report(report_data):
    """
    Create formatted report in Notion with absence information
    """
    notion_client = get_notion_client()
    
    # Create page content with rich formatting
    blocks = [
        {
            "object": "block",
            "type": "heading_1",
            "heading_1": {
                "rich_text": [{"text": {"content": f"Weekly Meeting Report - {report_data['week']}"}}]
            }
        },
        {
            "object": "block",
            "type": "callout",
            "callout": {
                "rich_text": [{
                    "text": {
                        "content": f"📊 {report_data['total_meetings']} meetings | "
                                   f"✅ {report_data['summary']['avg_attendance_rate']:.1f}% attendance | "
                                   f"📝 {report_data['summary']['total_informed_absences']} informed absences"
                    }
                }],
                "icon": {"emoji": "📈"}
            }
        }
    ]
    
    # Add absence summary if any
    if report_data['summary']['total_informed_absences'] > 0:
        blocks.append({
            "object": "block",
            "type": "heading_2",
            "heading_2": {
                "rich_text": [{"text": {"content": "Absence Summary"}}]
            }
        })
    
    # Add each meeting with absences
    for meeting in report_data["meetings"]:
        meeting_blocks = create_meeting_section_with_absences(meeting)
        blocks.extend(meeting_blocks)
    
    # Create the page
    notion_client.pages.create(
        parent={"database_id": NOTION_REPORTS_DB_ID},
        properties={
            "Title": {"title": [{"text": {"content": f"Week {report_data['week']}"}}]},
            "Date": {"date": {"start": report_data["meetings"][0]["date"] if report_data["meetings"] else None}},
            "Attendance Rate": {"number": report_data["summary"]["avg_attendance_rate"]}
        },
        children=blocks
    )


def create_meeting_section_with_absences(meeting):
    """
    Create Notion blocks for a single meeting including absence info
    """
    blocks = [
        {
            "object": "block",
            "type": "heading_3",
            "heading_3": {
                "rich_text": [{"text": {"content": meeting["title"]}}]
            }
        }
    ]
    
    # Add absence information if any
    if meeting["absences"]["informed"] or meeting["absences"]["uninformed"]:
        absence_text = "**Absences:**\n"
        
        if meeting["absences"]["informed"]:
            absence_text += "\n*Informed:*\n"
            for absence in meeting["absences"]["informed"]:
                icon = get_absence_icon(absence["type"])
                absence_text += f"• {absence['employee']} ({absence['department']}) - {icon} {absence['reason']}\n"
        
        if meeting["absences"]["uninformed"]:
            absence_text += "\n*Uninformed:*\n"
            for absence in meeting["absences"]["uninformed"]:
                absence_text += f"• {absence['employee']} ({absence['department']}) ⚠️\n"
        
        blocks.append({
            "object": "block",
            "type": "paragraph",
            "paragraph": {
                "rich_text": [{"text": {"content": absence_text}}]
            }
        })
    
    return blocks
```

### F. NOTIFICATION SYSTEM

Add email/Slack notifications when absence is reported:
```python
# notifications.py

async def notify_organizer(organizer_id, absence_record):
    """
    Notify meeting organizer when someone reports absence
    """
    organizer = db.query(Employee).get(organizer_id)
    meeting = absence_record.meeting
    employee = absence_record.employee
    
    # Email notification
    send_email(
        to=organizer.email,
        subject=f"Absence Notification: {meeting.meeting_title}",
        body=f"""
        Hi {organizer.name},
        
        {employee.name} has informed they cannot attend the meeting:
        
        Meeting: {meeting.meeting_title}
        Time: {meeting.scheduled_start.strftime('%B %d at %I:%M %p')}
        
        Reason: {absence_record.reason}
        Type: {absence_record.absence_type}
        Duration: {absence_record.expected_duration}
        
        {f"Alternative contact: {absence_record.alternative_contact.name}" if absence_record.alternative_contact else ""}
        
        This notification will also appear in the meeting when it starts.
        
        Best regards,
        Laneway Meeting System
        """
    )
    
    # Slack notification (if integrated)
    if organizer.slack_user_id:
        send_slack_message(
            user_id=organizer.slack_user_id,
            message=f"📅 *Absence notification*\n"
                    f"{employee.name} won't attend: _{meeting.meeting_title}_\n"
                    f"Reason: {absence_record.reason}"
        )
```

### G. ABSENCE SUBMISSION OPTIONS

Provide multiple ways for employees to submit absences:

**Option 1: Chrome Extension Popup** (already covered above)

**Option 2: Slack Bot Command**
```
/laneway-absent [meeting-name] [reason]
Example: /laneway-absent "Q1 Planning" "Doctor appointment, will join 30min late"
```

**Option 3: Web Dashboard**
- Create a simple web interface at `app.laneway.com/absences`
- List upcoming meetings
- Click "Notify Absence" button
- Fill form similar to extension popup

**Option 4: Email Integration**
```
To: absences@laneway.com
Subject: Absence - [Meeting Name]
Body: [Reason for absence]
```
Parse email and create absence record automatically.

### H. ANALYTICS ENHANCEMENT

Track absence patterns in analytics:
```python
# analytics.py

def calculate_absence_metrics(employee_id, time_period):
    """
    Calculate absence-related metrics for an employee
    """
    absences = db.query(MeetingAbsence).filter(
        MeetingAbsence.employee_id == employee_id,
        MeetingAbsence.informed_at >= time_period.start,
        MeetingAbsence.informed_at < time_period.end
    ).all()
    
    return {
        "total_absences": len(absences),
        "informed_absence_rate": calculate_informed_rate(employee_id, time_period),
        "most_common_reason": get_most_common_reason(absences),
        "absence_by_type": group_by_type(absences),
        "advance_notice_avg": calculate_avg_notice_time(absences)  # hours before meeting
    }
```

## Implementation Checklist

### Backend (AI Agent):
- [ ] Add database tables (scheduled_meetings, meeting_absences, etc.)
- [ ] Implement `/api/absences/*` endpoints
- [ ] Add Google Calendar sync functionality
- [ ] Update report generation to include absences
- [ ] Set up email/Slack notifications
- [ ] Create absence analytics functions

### Chrome Extension:
- [ ] Add AbsenceManager class to content script
- [ ] Create absence display banner UI
- [ ] Add absence form to popup
- [ ] Fetch and display absences when meeting starts
- [ ] Test absence notifications in live meetings

### Testing:
- [ ] Submit absence through extension → verify appears in database
- [ ] Start meeting → verify absence banner shows
- [ ] Generate report → verify absences included
- [ ] Test email/Slack notifications
- [ ] Test late/early absence submissions