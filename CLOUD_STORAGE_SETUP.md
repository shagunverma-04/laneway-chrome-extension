# ☁️ Cloud Storage Setup for Recordings

## Free Cloud Storage Options

### Option 1: Google Cloud Storage (Recommended) ✅

**Why Google Cloud Storage:**
- ✅ **FREE**: 5 GB free storage
- ✅ **Fast**: Best for Google Meet recordings
- ✅ **Easy**: Simple API
- ✅ **Reliable**: 99.9% uptime
- ✅ **Integration**: Works well with Google services

**Free Tier:**
- 5 GB storage
- 5,000 Class A operations/month
- 50,000 Class B operations/month
- Perfect for meeting recordings!

### Option 2: AWS S3 (Alternative)

**Free Tier:**
- 5 GB storage
- 20,000 GET requests
- 2,000 PUT requests
- Good but more complex setup

### Option 3: Cloudflare R2 (Best Value!)

**Why Cloudflare R2:**
- ✅ **FREE**: 10 GB storage
- ✅ **NO EGRESS FEES**: Free downloads!
- ✅ **S3-compatible**: Easy to use
- ✅ **Fast**: Global CDN

**Free Tier:**
- 10 GB storage/month
- 1 million Class A operations
- 10 million Class B operations
- **No egress fees** (huge advantage!)

## Recommended: Cloudflare R2

I recommend **Cloudflare R2** because:
1. More free storage (10 GB vs 5 GB)
2. No download fees (AWS/GCS charge for downloads)
3. S3-compatible (easy to integrate)
4. Fast global network

---

# 🔧 Setup Guide: Cloudflare R2

## Step 1: Create Cloudflare Account

1. Go to https://dash.cloudflare.com/sign-up
2. Sign up (free account)
3. Verify email

## Step 2: Create R2 Bucket

1. In Cloudflare dashboard, click **R2**
2. Click **Create bucket**
3. Name: `laneway-recordings`
4. Location: **Automatic** (or closest to you)
5. Click **Create bucket**

## Step 3: Get API Credentials

1. In R2 dashboard, click **Manage R2 API Tokens**
2. Click **Create API token**
3. Token name: `laneway-backend`
4. Permissions:
   - ✅ **Object Read & Write**
   - ✅ **Bucket Read**
5. Click **Create API token**
6. **SAVE THESE** (you won't see them again!):
   - Access Key ID
   - Secret Access Key
   - Endpoint URL

## Step 4: Configure Backend

Create `.env` file in your backend folder:

```bash
# backend/.env

# Cloudflare R2 Configuration
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key_id
R2_SECRET_ACCESS_KEY=your_secret_access_key
R2_BUCKET_NAME=laneway-recordings
R2_ENDPOINT=https://your_account_id.r2.cloudflarestorage.com

# API Configuration
API_BASE_URL=http://localhost:5000
```

## Step 5: Install Dependencies

```bash
cd backend
pip install boto3 python-dotenv
```

## Step 6: Create Storage Module

Create `backend/storage/r2_storage.py`:

```python
import boto3
from botocore.client import Config
import os
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv()

class R2Storage:
    def __init__(self):
        self.client = boto3.client(
            's3',
            endpoint_url=os.getenv('R2_ENDPOINT'),
            aws_access_key_id=os.getenv('R2_ACCESS_KEY_ID'),
            aws_secret_access_key=os.getenv('R2_SECRET_ACCESS_KEY'),
            config=Config(signature_version='s3v4'),
            region_name='auto'
        )
        self.bucket_name = os.getenv('R2_BUCKET_NAME')
    
    def generate_upload_url(self, recording_id, expires_in=3600):
        """Generate presigned URL for uploading"""
        key = f"recordings/{recording_id}.webm"
        
        url = self.client.generate_presigned_url(
            'put_object',
            Params={
                'Bucket': self.bucket_name,
                'Key': key,
                'ContentType': 'video/webm'
            },
            ExpiresIn=expires_in
        )
        
        return url, key
    
    def generate_download_url(self, key, expires_in=3600):
        """Generate presigned URL for downloading"""
        url = self.client.generate_presigned_url(
            'get_object',
            Params={
                'Bucket': self.bucket_name,
                'Key': key
            },
            ExpiresIn=expires_in
        )
        
        return url
    
    def list_recordings(self, prefix='recordings/'):
        """List all recordings"""
        response = self.client.list_objects_v2(
            Bucket=self.bucket_name,
            Prefix=prefix
        )
        
        recordings = []
        for obj in response.get('Contents', []):
            recordings.append({
                'key': obj['Key'],
                'size': obj['Size'],
                'last_modified': obj['LastModified'],
                'download_url': self.generate_download_url(obj['Key'])
            })
        
        return recordings
    
    def delete_recording(self, key):
        """Delete a recording"""
        self.client.delete_object(
            Bucket=self.bucket_name,
            Key=key
        )
```

## Step 7: Update Backend API

Update `backend/api/recordings.py`:

```python
from storage.r2_storage import R2Storage

# Initialize storage
storage = R2Storage()

@router.post("/upload-url")
async def get_upload_url(request: Request):
    """Generate presigned URL for uploading recording"""
    data = await request.json()
    recording_id = f"recording_{data['meetingId']}_{int(time.time())}"
    
    # Generate upload URL
    upload_url, key = storage.generate_upload_url(recording_id)
    
    # Save to database
    db = get_db()
    cursor = db.cursor()
    cursor.execute("""
        INSERT INTO meeting_recordings 
        (id, meeting_id, storage_key, status, created_at)
        VALUES (?, ?, ?, 'uploading', ?)
    """, (recording_id, data['meetingId'], key, datetime.now().isoformat()))
    db.commit()
    
    return {
        "uploadUrl": upload_url,
        "recordingId": recording_id,
        "storageKey": key
    }

@router.get("/list")
async def list_recordings():
    """List all recordings from R2"""
    recordings = storage.list_recordings()
    return {"recordings": recordings}

@router.get("/download/{recording_id}")
async def get_download_url(recording_id: str):
    """Get download URL for a recording"""
    db = get_db()
    cursor = db.cursor()
    cursor.execute(
        "SELECT storage_key FROM meeting_recordings WHERE id = ?",
        (recording_id,)
    )
    result = cursor.fetchone()
    
    if not result:
        raise HTTPException(status_code=404, detail="Recording not found")
    
    download_url = storage.generate_download_url(result[0])
    return {"downloadUrl": download_url}
```

---

# 🤖 Connecting to Your AI Transcription Agent

## Architecture

```
┌─────────────────────┐
│  Chrome Extension   │
│  (Records Meeting)  │
└──────────┬──────────┘
           │ Upload
           ▼
┌─────────────────────┐
│   Cloudflare R2     │
│  (Cloud Storage)    │
└──────────┬──────────┘
           │ Download
           ▼
┌─────────────────────┐
│  AI Agent (Cron)    │
│  (Transcription)    │
└─────────────────────┘
```

## Step 1: Create Shared API

Your AI agent needs to:
1. Check for new recordings daily
2. Download them from R2
3. Transcribe them
4. Extract tasks
5. Mark as processed

## Step 2: Create Cron Job in AI Agent

Create `ai_agent/fetch_recordings.py`:

```python
import requests
import os
from datetime import datetime, timedelta
import whisper
from dotenv import load_dotenv

load_dotenv()

LANEWAY_API = os.getenv('LANEWAY_API_URL', 'http://localhost:5000')

def fetch_new_recordings():
    """Fetch recordings from last 24 hours"""
    response = requests.get(f"{LANEWAY_API}/api/recordings/list")
    recordings = response.json()['recordings']
    
    # Filter recordings from last 24 hours
    yesterday = datetime.now() - timedelta(days=1)
    new_recordings = [
        r for r in recordings 
        if r['last_modified'] > yesterday
    ]
    
    return new_recordings

def download_recording(download_url, recording_id):
    """Download recording from R2"""
    response = requests.get(download_url, stream=True)
    
    filename = f"recordings/{recording_id}.webm"
    os.makedirs('recordings', exist_ok=True)
    
    with open(filename, 'wb') as f:
        for chunk in response.iter_content(chunk_size=8192):
            f.write(chunk)
    
    return filename

def transcribe_recording(filename):
    """Transcribe using Whisper"""
    model = whisper.load_model("base")
    result = model.transcribe(filename)
    return result['text']

def process_daily_recordings():
    """Main function to process recordings"""
    print("🔍 Fetching new recordings...")
    recordings = fetch_new_recordings()
    
    print(f"📊 Found {len(recordings)} new recordings")
    
    for recording in recordings:
        print(f"\n📥 Processing: {recording['key']}")
        
        # Download
        filename = download_recording(
            recording['download_url'],
            recording['key']
        )
        
        # Transcribe
        transcript = transcribe_recording(filename)
        
        # Save transcript
        with open(f"{filename}.txt", 'w') as f:
            f.write(transcript)
        
        print(f"✅ Transcribed: {len(transcript)} characters")
        
        # TODO: Extract tasks, sync to Notion, etc.

if __name__ == "__main__":
    process_daily_recordings()
```

## Step 3: Set Up Daily Cron

### On Windows (Task Scheduler):

1. Open Task Scheduler
2. Create Basic Task
3. Name: "Laneway Daily Processing"
4. Trigger: Daily at 2 AM
5. Action: Start a program
6. Program: `python`
7. Arguments: `C:\path\to\ai_agent\fetch_recordings.py`

### On Linux/Mac (crontab):

```bash
# Run daily at 2 AM
0 2 * * * cd /path/to/ai_agent && python fetch_recordings.py
```

---

# 📋 Complete Integration Checklist

## Backend Setup:
- [ ] Create Cloudflare R2 account
- [ ] Create bucket: `laneway-recordings`
- [ ] Get API credentials
- [ ] Create `.env` file with credentials
- [ ] Install `boto3` and `python-dotenv`
- [ ] Create `storage/r2_storage.py`
- [ ] Update `api/recordings.py`
- [ ] Test upload URL generation

## AI Agent Setup:
- [ ] Create `fetch_recordings.py`
- [ ] Install dependencies (`requests`, `whisper`)
- [ ] Set `LANEWAY_API_URL` in `.env`
- [ ] Test manual run
- [ ] Set up daily cron job
- [ ] Monitor logs

## Testing:
- [ ] Record a test meeting
- [ ] Check R2 bucket (file should appear)
- [ ] Run AI agent manually
- [ ] Verify recording downloads
- [ ] Verify transcription works
- [ ] Check cron job runs automatically

---

**Next Steps**: 
1. Set up Cloudflare R2 (10 min)
2. Update backend code (15 min)
3. Create AI agent integration (20 min)
4. Test end-to-end (10 min)

Total time: ~1 hour to full integration! 🚀
