# Laneway Chrome Extension - Installation & Setup Guide

## Overview
Laneway is a Chrome extension that records Google Meet sessions, tracks participant behavior, and automatically uploads recordings to your AI processing pipeline for transcription, task extraction, and Notion integration.

## Features
- 🎥 **Automatic Meeting Recording** - Record audio/video from Google Meet
- 👥 **Participant Tracking** - Monitor camera usage, speaking time, and engagement
- ☁️ **Cloud Upload** - Direct upload to S3/GCS for processing
- 🤖 **AI Integration** - Connects to your existing AI agent for transcription & task extraction
- 📊 **Analytics Dashboard** - View meeting statistics and insights
- 📝 **Absence Management** - Notify team when you can't attend meetings

## Installation

### 1. Load Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right corner)
3. Click **Load unpacked**
4. Select the `laneway-extension` folder
5. The Laneway icon should appear in your extensions toolbar

### 2. Configure Backend API

The extension requires a backend API to handle uploads and processing. Update the API URL in `config.js`:

```javascript
const CONFIG = {
  API_BASE_URL: 'https://your-backend-url.com', // Change this!
  // ... other settings
};
```

### 3. Set Up Backend Endpoints

Your backend needs these endpoints:

#### Authentication
- `POST /api/auth/login` - User login
  - Request: `{ email, password }`
  - Response: `{ token, userId }`

#### Recording Management
- `POST /api/recordings/upload-url` - Get presigned upload URL
  - Request: `{ meetingId, estimatedSize, format }`
  - Response: `{ uploadUrl, recordingId }`

- `POST /api/recordings/complete` - Notify recording completion
  - Request: `{ recordingId, meetingId, metadata, participants, duration }`
  - Response: `{ status, taskCount }`

#### Analytics
- `POST /api/analytics/upload` - Upload participant analytics
  - Request: `{ meetingId, timestamp, participants[] }`
  - Response: `{ success }`

- `GET /api/analytics/user/:userId` - Get user statistics
  - Response: `{ meetingsThisWeek, avgSpeakingTime, cameraUsageRate }`

#### Absence Management
- `POST /api/absences/notify` - Submit absence notification
  - Request: `{ meeting_id, employee_id, reason, absence_type, expected_duration }`
  - Response: `{ id, status, message }`

- `GET /api/absences/meeting/:meetingId` - Get absences for meeting
  - Response: `{ absences[] }`

- `POST /api/absences/mark-shown` - Mark absences as displayed
  - Request: `{ meeting_id, absence_ids[] }`

## Usage

### First Time Setup

1. Click the Laneway extension icon
2. Log in with your credentials
3. Configure your recording preferences:
   - Recording quality (audio-only recommended)
   - Auto-start recording (optional)
   - Participant tracking (enabled by default)

### Recording a Meeting

1. Join a Google Meet call
2. Click the Laneway extension icon
3. Click **Start Recording**
4. The recording indicator will appear in the Meet window
5. Click **Stop Recording** when done

### Reporting Absence

1. Before a scheduled meeting, click the Laneway icon
2. Scroll to "Cannot Attend?" section
3. Select reason type and provide explanation
4. Click **Notify Team**
5. Your team will see the notification when the meeting starts

## Architecture

```
┌─────────────────┐
│  Chrome Ext     │
│  (Frontend)     │
└────────┬────────┘
         │
         ├─ Records Meeting (MediaRecorder API)
         ├─ Tracks Participants (DOM Observers)
         └─ Uploads to Cloud (S3/GCS)
         │
         ▼
┌─────────────────┐
│  Backend API    │
│  (Your Server)  │
└────────┬────────┘
         │
         ├─ Receives Metadata
         ├─ Triggers Processing
         └─ Stores Analytics
         │
         ▼
┌─────────────────┐
│  AI Agent       │
│  (Existing)     │
└────────┬────────┘
         │
         ├─ Transcribes Audio
         ├─ Extracts Tasks
         ├─ Writes to Notion
         └─ Generates Reports
```

## File Structure

```
laneway-extension/
├── manifest.json              # Extension configuration
├── config.js                  # API & settings configuration
├── background.js              # Service worker (handles recording state)
├── content-script.js          # Injected into Meet (tracks participants)
├── popup/
│   ├── popup.html            # Extension popup UI
│   ├── popup.css             # Popup styles
│   └── popup.js              # Popup logic
├── styles/
│   └── content.css           # Styles injected into Meet
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

## Connecting to Your Existing AI Agent

### Option 1: Add API Layer to Existing Project

Add these routes to your current Flask/FastAPI app:

```python
# In your existing AI agent project
from fastapi import APIRouter, Depends
from your_existing_code import transcribe_video, extract_tasks, write_to_notion

router = APIRouter()

@router.post("/api/recordings/complete")
async def handle_recording_complete(data: RecordingData):
    # Trigger your existing pipeline
    transcript = transcribe_video(data.recording_url)
    tasks = extract_tasks(transcript)
    write_to_notion(tasks, data.metadata)
    
    return {"status": "success", "taskCount": len(tasks)}
```

### Option 2: Use Webhooks/Events

Configure S3 to trigger your existing Lambda/Cloud Function when a recording is uploaded:

```python
# AWS Lambda handler
def lambda_handler(event, context):
    recording_url = event['Records'][0]['s3']['object']['key']
    
    # Call your existing functions
    process_meeting_recording(recording_url)
```

## Security & Privacy

- ✅ User authentication required
- ✅ Encrypted API communication (HTTPS)
- ✅ Clear recording indicator always visible
- ✅ Consent flow on first use
- ✅ Secure token storage in Chrome sync storage
- ⚠️ **Important**: Always inform meeting participants they're being recorded

## Troubleshooting

### Extension Not Loading
- Ensure all files are in the correct directory structure
- Check Chrome DevTools console for errors
- Verify manifest.json is valid JSON

### Recording Not Starting
- Check that you have `tabCapture` permission
- Ensure you're on an active Google Meet call
- Verify backend API is accessible
- Check browser console for error messages

### Upload Failing
- Verify backend API URL in `config.js`
- Check authentication token is valid
- Ensure S3/GCS credentials are configured on backend
- Check network tab in DevTools for failed requests

### Participant Tracking Not Working
- Google Meet's DOM structure may change
- Check content script console for errors
- Update selectors in `content-script.js` if needed

## Development

### Testing Locally

1. Make changes to extension files
2. Go to `chrome://extensions/`
3. Click reload icon on Laneway extension
4. Test in a Google Meet call

### Debugging

- **Background Script**: `chrome://extensions/` → Laneway → "service worker" link
- **Content Script**: Open DevTools on Meet page, check Console
- **Popup**: Right-click extension icon → "Inspect popup"

## Next Steps

1. ✅ Install extension in Chrome
2. ✅ Configure backend API URL
3. ✅ Implement backend endpoints
4. ✅ Connect to your existing AI agent
5. ✅ Test with a real Google Meet call
6. ✅ Deploy backend to production
7. ✅ Update API URL to production endpoint

## Support

For issues or questions:
- Check the troubleshooting section above
- Review Chrome extension console logs
- Verify backend API is responding correctly
- Ensure all required permissions are granted

## License

This extension is designed to work with your existing AI meeting processing pipeline.
