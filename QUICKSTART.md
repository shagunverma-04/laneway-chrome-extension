# 🚀 Quick Start Guide

Get Laneway up and running in 5 minutes!

## Step 1: Load Extension in Chrome (2 minutes)

1. Open Chrome and navigate to: `chrome://extensions/`
2. Toggle **Developer mode** ON (top-right corner)
3. Click **Load unpacked**
4. Navigate to and select the `laneway-extension` folder
5. ✅ Laneway icon should appear in your Chrome toolbar

## Step 2: Test the Extension (1 minute)

1. Click the Laneway icon in your toolbar
2. You'll see the popup UI (login screen will show since backend isn't connected yet)
3. Join any Google Meet call
4. Click the Laneway icon again - it should detect you're in a meeting

## Step 3: Configure Backend (2 minutes)

### Option A: Quick Test (No Backend)

The extension will work for UI testing without a backend. You can:
- See the popup interface
- View meeting detection
- See the recording controls (won't actually record without backend)

### Option B: Connect to Your Backend

1. Open `config.js`
2. Change line 3:
   ```javascript
   API_BASE_URL: 'http://localhost:5000', // Change to your backend URL
   ```
3. Reload the extension in Chrome

## Step 4: Add Backend Endpoints

Follow `BACKEND_API.md` to add these endpoints to your existing project:

### Minimal Setup (Just to test recording)

```python
# Add to your existing Flask/FastAPI app
from fastapi import FastAPI, Header
import boto3
from datetime import datetime

app = FastAPI()
s3_client = boto3.client('s3')

@app.post("/api/auth/login")
async def login(email: str, password: str):
    # Simple test auth
    if email == "test@test.com" and password == "test":
        return {"token": "test-token-123", "userId": "user-1"}
    return {"error": "Invalid credentials"}, 401

@app.post("/api/recordings/upload-url")
async def get_upload_url(authorization: str = Header(None)):
    # Generate S3 presigned URL
    url = s3_client.generate_presigned_url(
        'put_object',
        Params={'Bucket': 'your-bucket', 'Key': f'test-{datetime.now().timestamp()}.webm'},
        ExpiresIn=3600
    )
    return {"uploadUrl": url, "recordingId": f"rec-{datetime.now().timestamp()}"}

@app.post("/api/recordings/complete")
async def complete_recording(data: dict):
    # Trigger your existing AI pipeline here
    # from your_code import transcribe_video, extract_tasks, write_to_notion
    # transcript = transcribe_video(data['recordingId'])
    # tasks = extract_tasks(transcript)
    # write_to_notion(tasks)
    
    return {"status": "success", "taskCount": 5}
```

Run your backend:
```bash
uvicorn main:app --reload --port 5000
```

## Step 5: Test Recording

1. Join a Google Meet call
2. Click Laneway icon
3. Login with test credentials (test@test.com / test)
4. Click **Start Recording**
5. Recording indicator should appear in Meet
6. Click **Stop Recording**
7. Check your backend logs - should receive the completion request

## 🎉 You're Done!

The extension is now:
- ✅ Loaded in Chrome
- ✅ Detecting Google Meet sessions
- ✅ Recording meetings
- ✅ Uploading to your cloud storage
- ✅ Triggering your AI pipeline

## Next Steps

### Enhance Your Backend

1. **Add Real Authentication**
   - Connect to your user database
   - Implement proper JWT tokens

2. **Connect to Your AI Agent**
   ```python
   # In the complete_recording endpoint
   from your_project.transcription import transcribe_video
   from your_project.tasks import extract_tasks
   from your_project.notion import write_to_notion
   
   transcript = transcribe_video(recording_url)
   tasks = extract_tasks(transcript)
   write_to_notion(tasks, metadata)
   ```

3. **Add Analytics**
   - Implement the analytics endpoints
   - Store participant behavior data
   - Generate weekly reports

4. **Deploy to Production**
   - Deploy backend to AWS/GCP/Heroku
   - Update `config.js` with production URL
   - Enable HTTPS

## Common Issues

### "Not authenticated" error
- Make sure backend is running
- Check API_BASE_URL in config.js
- Verify login credentials

### Recording doesn't start
- Ensure you're on an active Google Meet call
- Check browser console for errors
- Verify backend returns valid upload URL

### Upload fails
- Check S3/GCS credentials on backend
- Verify presigned URL is valid
- Check CORS settings

## Testing Checklist

- [ ] Extension loads without errors
- [ ] Popup UI displays correctly
- [ ] Meeting detection works
- [ ] Login successful
- [ ] Recording starts
- [ ] Recording indicator shows in Meet
- [ ] Recording stops
- [ ] Backend receives completion notification
- [ ] Participant tracking works
- [ ] Analytics uploaded

## Need Help?

1. Check `INSTALLATION.md` for detailed setup
2. Review `BACKEND_API.md` for API implementation
3. Look at browser console for errors
4. Check backend logs for issues

---

**You're ready to automate your meeting workflow! 🚀**
