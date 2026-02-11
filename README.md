# Laneway - Google Meet Recording Extension

Record Google Meet sessions with audio and video. Recordings are saved locally and optionally uploaded to Cloudflare R2 cloud storage.

## Features

- **One-Click Recording** - Record Google Meet audio/video with one click
- **Local Download** - Recordings always saved to your Downloads folder as backup
- **Cloud Upload** - Automatic upload to Cloudflare R2 via a Worker proxy
- **Participant Tracking** - Track participants, camera usage, and engagement
- **Analytics Backend** - Optional local backend for viewing meeting analytics
- **Privacy-First** - No data sent anywhere by default, you control everything

## Installation

1. Clone or download this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" (top right)
4. Click "Load unpacked" and select the project folder
5. Extension icon appears in the toolbar

## How to Use

1. **Join a Google Meet** - Navigate to `https://meet.google.com` and join a meeting
2. **Click the Laneway extension icon** in the Chrome toolbar
3. **Click "Start Recording"**
4. **Select "Chrome Tab"** in the screen picker dialog
5. **Check "Share tab audio"** - Without this, your recording will have no audio
6. **Click "Share"** - Recording starts immediately
7. **Click "Stop Recording"** when done - File downloads automatically

### Recording Output
- Format: WebM (VP9 video + Opus audio)
- Location: Downloads folder + R2 cloud (if configured)
- Filename: `recording_<meeting-id>_<timestamp>.webm`

## Project Structure

```
laneway-extension/
├── manifest.json          # Extension configuration
├── background.js          # Service worker (state, messaging, R2 upload URL)
├── content-script.js      # Google Meet integration (MediaRecorder, UI, upload)
├── config.js              # R2 Worker URL, API key, settings
├── options.html           # Settings page
├── options.js             # Settings logic
├── popup/
│   ├── popup.html         # Extension popup UI
│   ├── popup.js           # Popup logic
│   └── popup.css          # Popup styling
├── styles/
│   └── content.css        # Injected styles for Meet page
├── fonts/                 # Custom fonts (Clash Display, Satoshi)
├── icons/                 # Extension icons
├── worker/
│   ├── worker.js          # Cloudflare Worker for R2 upload proxy
│   └── wrangler.toml      # Worker deployment config
└── backend/               # Optional analytics backend (see below)
    ├── main.py            # FastAPI application
    ├── start.py           # Startup script
    ├── database.py        # SQLite utilities
    ├── requirements.txt   # Python dependencies
    ├── api/
    │   ├── auth.py        # Authentication endpoints
    │   ├── recordings.py  # Recording management
    │   ├── absences.py    # Absence notifications
    │   └── analytics.py   # Analytics endpoints
    ├── database/
    │   └── schema.sql     # Database schema (laneway.db is auto-created)
    └── storage/
        └── r2_storage.py  # R2 storage client (boto3)
```

## Cloud Upload (Cloudflare R2)

Recordings are uploaded to Cloudflare R2 via a Worker proxy.

### Setup

1. Deploy the Cloudflare Worker:
   ```bash
   cd worker
   npx wrangler@latest deploy
   ```
2. Set the Worker secret:
   ```bash
   npx wrangler@latest secret put API_KEY
   ```
3. Update `config.js` with your Worker URL and matching API key:
   ```js
   R2_WORKER_URL: 'https://laneway-r2-upload.<your-subdomain>.workers.dev',
   R2_API_KEY: 'your-secret-key'
   ```

## Analytics Backend (Optional)

The backend provides meeting analytics via a local FastAPI server with SQLite. It is **not required** for basic recording - the extension works fully without it.

### Setup

1. Install dependencies:
   ```bash
   cd backend
   pip install -r requirements.txt
   ```
2. Start the server:
   ```bash
   python start.py
   ```
3. Server runs at http://localhost:5000 (API docs at http://localhost:5000/docs)
4. Set the backend URL in extension options to `http://localhost:5000`

### API Endpoints

| Endpoint | Description |
|---|---|
| `GET /api/analytics/meetings` | List all meetings with snapshot counts |
| `GET /api/analytics/meetings/{id}` | Participants and details for a meeting |
| `POST /api/analytics/upload` | Upload analytics from extension (auto) |
| `GET /api/analytics/user/{id}` | User stats (meetings, speaking time, camera) |
| `POST /api/auth/login` | Login (demo: `demo@laneway.com` / `demo123`) |

### Database

SQLite database is auto-created at `backend/database/laneway.db` when the server starts. To browse it:
- **DB Browser for SQLite** - https://sqlitebrowser.org (recommended GUI)
- **VS Code** - Install "SQLite Viewer" extension, then open the `.db` file
- **CLI** - `sqlite3 backend/database/laneway.db`

To reset the database, delete `laneway.db` and restart the server.

## Settings

Right-click the extension icon and select "Options":

- **Backend URL** - Optional backend server URL (leave empty for local-only mode)
- **Recording Quality** - Audio-only, 720p, or 1080p

## Troubleshooting

| Issue | Solution |
|---|---|
| No audio in recording | Check "Share tab audio" in the screen picker dialog |
| "Start Recording" doesn't work | Make sure you're in an active meeting, not the lobby |
| Error starting tab capture | Select "Chrome Tab", not "Entire Screen" |
| "Failed to upload analytics" | Backend not running - start it or clear backend URL in options |
| Recording file too large | Change quality to "Audio Only" in settings |

## Technical Details

- Chrome Extension Manifest V3
- MediaRecorder API for recording
- getDisplayMedia API for tab capture
- Cloudflare R2 + Worker for cloud storage
- FastAPI + SQLite for analytics backend
