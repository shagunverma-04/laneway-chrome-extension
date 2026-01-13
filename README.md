# 🎥 Laneway - Google Meet Recording & Analytics Extension

> Automatically record Google Meet sessions, track participant behavior, and sync to cloud storage for AI-powered transcription and task extraction.

[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-blue)](https://chrome.google.com)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-green)](https://developer.chrome.com/docs/extensions/mv3/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## ✨ Features

- 🎙️ **Automatic Meeting Recording** - Record Google Meet audio/video with one click
- 📊 **Participant Analytics** - Track camera usage, speaking time, and engagement
- ☁️ **Cloud Storage** - Upload to Google Drive or Cloudflare R2
- 🤖 **AI Integration** - Connect to your transcription/task extraction pipeline
- 📅 **Absence Management** - Display team member absences in meetings
- 🔒 **Secure & Private** - All data encrypted, GDPR compliant

## 🚀 Quick Start

### Prerequisites

- Google Chrome browser
- Python 3.8+ (for backend)
- Cloudflare account (free - sign up at https://dash.cloudflare.com)

### Installation

#### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/laneway-extension.git
cd laneway-extension
```

#### 2. Install Backend Dependencies

```bash
cd backend
pip install -r requirements.txt
```

#### 3. Set Up Cloudflare R2 Storage

Follow the complete guide: [`CLOUD_STORAGE_SETUP.md`](CLOUD_STORAGE_SETUP.md)

**Quick Setup:**
1. Create Cloudflare account (free)
2. Go to R2 → Create bucket: `laneway-recordings`
3. Create API token with R2 permissions
4. Save your credentials

#### 4. Configure Environment

```bash
# Copy example env file
cp backend/.env.example backend/.env

# Edit .env with your R2 credentials
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_BUCKET_NAME=laneway-recordings
R2_ENDPOINT=https://your_account_id.r2.cloudflarestorage.com
```

#### 5. Start Backend Server

```bash
python backend/start.py
```

Server will start at `http://localhost:5000`

#### 6. Load Extension in Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select the `laneway-extension` folder
5. Extension icon should appear in toolbar!

## 📖 Usage

### Recording a Meeting

1. **Join a Google Meet**
2. **Click the Laneway extension icon**
3. **Click "Start Recording"**
4. **Chrome will show a picker** - Select "Chrome Tab"
5. **Select your Google Meet tab**
6. **✅ Check "Share tab audio"** (important!)
7. **Click "Share"**
8. **Recording starts!** 🎥

### Stopping Recording

1. **Click extension icon**
2. **Click "Stop Recording"**
3. **File automatically uploads** to cloud storage
4. **Check your Downloads folder** for local copy

### Viewing Analytics

```bash
# Run analytics viewer
python view_analytics.py
```

Or check your Google Drive "Laneway Recordings" folder!

## 🏗️ Architecture

```
┌─────────────────────┐
│  Chrome Extension   │
│  - Records Meeting  │
│  - Tracks Analytics │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Backend API        │
│  - Flask/FastAPI    │
│  - SQLite Database  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Cloudflare R2      │
│  - 10 GB Free       │
│  - S3-Compatible    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  AI Agent (Daily)   │
│  - Transcription    │
│  - Task Extraction  │
│  - Notion Sync      │
└─────────────────────┘
```

## 📁 Project Structure

```
laneway-extension/
├── manifest.json              # Extension configuration
├── background.js              # Service worker
├── content-script.js          # Google Meet integration
├── popup/                     # Extension UI
│   ├── popup.html
│   ├── popup.js
│   └── popup.css
├── backend/                   # API server
│   ├── start.py              # Server entry point
│   ├── api/                  # API endpoints
│   │   ├── recordings.py
│   │   ├── analytics.py
│   │   └── absences.py
│   ├── storage/              # Cloud storage modules
│   │   ├── google_drive_storage.py
│   │   └── r2_storage.py
│   └── database/             # SQLite database
│       └── laneway.db
├── fetch_recordings.py        # AI agent integration
├── view_analytics.py          # Analytics viewer
└── docs/                      # Documentation
    ├── GOOGLE_DRIVE_SETUP.md
    ├── CLOUD_STORAGE_SETUP.md
    └── AUDIO_CAPTURE_GUIDE.md
```

## 🔧 Configuration

### Extension Settings

Open the extension popup to configure:

- **Recording Quality**: Audio-only, 720p, 1080p
- **Auto-start**: Automatically start recording when joining meetings
- **Analytics**: Enable/disable participant tracking

### Backend Configuration

Edit `backend/.env`:

```env
# API Settings
API_BASE_URL=http://localhost:5000
PORT=5000

# Cloudflare R2 Storage
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key_id
R2_SECRET_ACCESS_KEY=your_secret_access_key
R2_BUCKET_NAME=laneway-recordings
R2_ENDPOINT=https://your_account_id.r2.cloudflarestorage.com

# Database
DATABASE_PATH=backend/database/laneway.db
```

## 🤖 AI Agent Integration

Connect your existing transcription/task extraction pipeline:

### 1. Daily Fetch Script

```bash
# Set environment variable
export LANEWAY_API_URL=http://localhost:5000

# Run daily (or set up cron)
python fetch_recordings.py
```

### 2. Integrate with Your AI Agent

Edit `fetch_recordings.py`:

```python
def process_recording(filename):
    # Import your AI agent
    from your_agent import transcribe, extract_tasks, sync_to_notion
    
    # Transcribe
    transcript = transcribe(filename)
    
    # Extract tasks
    tasks = extract_tasks(transcript)
    
    # Sync to Notion
    sync_to_notion(tasks)
    
    return True
```

### 3. Set Up Cron Job

**Windows (Task Scheduler):**
- Run `fetch_recordings.py` daily at 2 AM

**Linux/Mac (crontab):**
```bash
0 2 * * * cd /path/to/laneway-extension && python fetch_recordings.py
```

## 📊 Database Schema

```sql
-- Recordings
CREATE TABLE meeting_recordings (
    id TEXT PRIMARY KEY,
    meeting_id TEXT,
    storage_key TEXT,
    status TEXT,
    duration INTEGER,
    created_at TEXT,
    processed_at TEXT
);

-- Participants
CREATE TABLE meeting_participants (
    id TEXT PRIMARY KEY,
    meeting_id TEXT,
    employee_name TEXT,
    employee_email TEXT,
    join_time TEXT,
    camera_on_duration INTEGER,
    speaking_duration INTEGER,
    engagement_score REAL
);

-- Absences
CREATE TABLE absences (
    id TEXT PRIMARY KEY,
    meeting_id TEXT,
    employee_name TEXT,
    reason TEXT,
    absence_type TEXT,
    informed_at TEXT
);
```

## 🔒 Security & Privacy

- ✅ **Encrypted transmission** (HTTPS only)
- ✅ **Secure authentication** (JWT tokens)
- ✅ **GDPR compliant** (data retention policies)
- ✅ **User consent** (explicit recording indicator)
- ✅ **Private storage** (your own cloud account)

## 🆘 Troubleshooting

### "Error starting tab capture"

**Solution**: Make sure to select "Chrome Tab" and check "Share tab audio" in the picker dialog.

See: [`AUDIO_CAPTURE_GUIDE.md`](AUDIO_CAPTURE_GUIDE.md)

### "No audio in recording"

**Solution**: You forgot to check "Share tab audio" checkbox!

### "Backend not responding"

```bash
# Check if backend is running
curl http://localhost:5000/health

# Restart backend
python backend/start.py
```

### "Extension not loading"

1. Go to `chrome://extensions/`
2. Click reload (🔄) on Laneway extension
3. Check for errors in console

## 📚 Documentation

- [Cloudflare R2 Setup](CLOUD_STORAGE_SETUP.md) - Complete R2 setup guide
- [Audio Capture Guide](AUDIO_CAPTURE_GUIDE.md) - How to capture audio properly
- [View Analytics](VIEW_ANALYTICS.md) - How to view analytics data
- [AI Agent Integration](CLOUD_STORAGE_SETUP.md#connecting-to-your-ai-transcription-agent) - Connect your AI pipeline

## 🛣️ Roadmap

- [x] Basic recording functionality
- [x] Cloud storage integration (Drive + R2)
- [x] Participant tracking
- [x] Analytics dashboard
- [x] AI agent integration
- [ ] Real-time transcription
- [ ] Speaker diarization
- [ ] Automatic task extraction
- [ ] Notion integration
- [ ] Slack notifications
- [ ] Team analytics dashboard

## 💰 Cost

### Free Tier (Cloudflare R2)

- **10 GB** free storage/month
- **1 million** Class A operations (uploads)
- **10 million** Class B operations (downloads)
- **Zero egress fees** (downloads are FREE!)

**Estimated Usage:**
- ~100 hours of meetings
- Completely free for most users!

### Paid Tier (if you exceed free tier)

- **Storage**: $0.015/GB/month
- **Class A operations**: $4.50 per million
- **Class B operations**: $0.36 per million
- **No egress fees!**

**Example Cost:**
- 100 GB storage = ~$1.50/month
- Still cheaper than competitors!

## 🤝 Contributing

Contributions welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) first.

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with Chrome Extension Manifest V3
- Uses MediaRecorder API for recording
- Powered by Google Drive API / Cloudflare R2
- Backend: Flask/FastAPI + SQLite

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/laneway-extension/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/laneway-extension/discussions)
- **Email**: support@laneway.app

---

**Made with ❤️ for better meeting productivity**

**Demo Credentials:**
- Email: `demo@laneway.com`
- Password: `demo123`