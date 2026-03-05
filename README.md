# Laneway Bee - Google Meet Recording Extension

Auto-record Google Meet audio & video, upload to cloud storage, transcribe sessions, analyze content, and track participant engagement.

## Features

- **One-Click Recording** - Record Google Meet audio/video with a single click
- **Local Download** - Recordings always saved to your Downloads folder as a backup
- **Cloud Upload** - Automatic upload to Cloudflare R2 via a Worker proxy
- **Participant Tracking** - Track participants, camera usage, speaking time, and engagement
- **Meeting Tracking** - Auto-detects and matches meetings against scheduled events in the Laneway backend
- **Analytics** - Participant analytics sent to the Laneway backend after each recording
- **Privacy-First** - No data sent anywhere by default without an API key configured

## Installation

1. Clone or download this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" (top right)
4. Click "Load unpacked" and select the project folder
5. Extension icon appears in the toolbar
6. Right-click the icon → **Options** to configure your API key

## How to Use

1. **Join a Google Meet** - Navigate to `https://meet.google.com` and join a meeting
2. **Click the Laneway Bee extension icon** in the Chrome toolbar
3. **Click "Start Recording"**
4. **Select "Chrome Tab"** in the screen picker dialog
5. **Check "Share tab audio"** - Without this, your recording will have no audio
6. **Click "Share"** - Recording starts immediately
7. **Click "Stop Recording"** when done - File downloads automatically and uploads to R2 (if configured)

### Recording Output

- Format: WebM (VP9 video + Opus audio)
- Location: Downloads folder + R2 cloud (if R2 API key is configured)
- Filename: `recording_<meeting-id>_<timestamp>.webm`

## Project Structure

```
laneway-extension/
├── manifest.json          # Extension configuration (MV3)
├── background.js          # Service worker (state, messaging, backend API calls)
├── content-script.js      # Google Meet integration (MediaRecorder, UI, upload)
├── config.js              # R2 Worker URL, default settings
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
│   ├── worker.js          # Cloudflare Worker for R2 upload proxy + D1 analytics
│   └── wrangler.toml      # Worker deployment config
└── backend/               # Local backend (dev/self-hosted — see below)
    ├── main.py            # FastAPI application
    ├── start.py           # Startup script
    ├── database.py        # SQLite utilities
    ├── requirements.txt   # Python dependencies
    ├── api/
    │   ├── auth.py        # Authentication endpoints
    │   ├── recordings.py  # Recording management
    │   ├── absences.py    # Absence notifications
    │   └── analytics.py   # Analytics endpoints
    └── database/
        └── schema.sql     # Database schema (laneway.db is auto-created)
```

## Settings

Right-click the extension icon → **Options**:

| Setting | Description |
|---|---|
| **API Key** | Laneway backend API key — enables meeting tracking, cloud storage metadata, and analytics. Get it from your Laneway dashboard under Settings > API Keys. |
| **Backend URL** | Laneway backend URL. Defaults to the hosted production server. |
| **R2 Worker API Key** | Required for cloud recording uploads. Without this, recordings save locally only. |
| **Default Recording Quality** | `Audio Only`, `720p`, or `1080p` |

Use **Test Connection** to verify that your API key and backend URL are working.

## Cloud Upload (Cloudflare R2)

Recordings are uploaded to Cloudflare R2 via a Cloudflare Worker proxy. The Worker also stores participant analytics in Cloudflare D1.

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
3. Update `config.js` with your Worker URL:
   ```js
   R2_WORKER_URL: 'https://laneway-r2-upload.<your-subdomain>.workers.dev',
   ```
4. Set the matching key in extension Options → **R2 Worker API Key**

### Worker Endpoints

| Endpoint | Description |
|---|---|
| `PUT /recordings/<key>` | Upload a recording blob to R2 |
| `PUT /participant-data/<key>` | Upload participant JSON to R2 |
| `GET /participant-data/<key>` | Retrieve participant JSON from R2 |
| `GET /list` | List all recordings in the R2 bucket |
| `POST /analytics` | Store an analytics snapshot in D1 |
| `GET /analytics/meetings` | List all meetings with snapshot counts |
| `GET /analytics/meetings/:id` | Get all snapshots for a meeting |

## Backend API

The extension communicates with the Laneway backend (hosted at `https://laneway-meeting-management.onrender.com` by default) using `X-API-Key` authentication.

### Extension Endpoints Used

| Endpoint | Description |
|---|---|
| `GET /api/ext/meeting/lookup?meet_link=<url>` | Look up a scheduled meeting by Meet link |
| `POST /api/ext/recording/start` | Notify backend that recording has started |
| `POST /api/ext/recording/stop` | Notify backend that recording has stopped |
| `POST /api/ext/recording/cancel` | Revert meeting status if recording fails |
| `POST /api/ext/recording/metadata` | Send final recording URL and participant analytics |

### Meeting Tracking Flow

1. Extension detects a Google Meet URL → sends `MEETING_DETECTED` to background worker
2. Background looks up the meeting via `/api/ext/meeting/lookup`
3. If found, stores the `meeting_uid` and notifies the popup
4. On recording start/stop, the backend is notified and meeting status is updated
5. After the recording uploads to R2, metadata and participant analytics are sent to the backend

## Local Backend (Self-Hosted / Dev)

The `backend/` folder contains a local FastAPI server for development or self-hosting. It is **not required** if you use the hosted backend.

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
3. Server runs at `http://localhost:8000` (API docs at `http://localhost:8000/docs`)
4. Set the backend URL in extension Options to `http://localhost:8000`

### Database

SQLite database is auto-created at `backend/database/laneway.db` when the server starts.

- **DB Browser for SQLite** - https://sqlitebrowser.org (recommended GUI)
- **VS Code** - Install "SQLite Viewer" extension, then open the `.db` file
- **CLI** - `sqlite3 backend/database/laneway.db`

To reset the database, delete `laneway.db` and restart the server.

## Troubleshooting

| Issue | Solution |
|---|---|
| No audio in recording | Check "Share tab audio" in the screen picker dialog |
| "Start Recording" doesn't work | Make sure you're in an active meeting, not the lobby |
| Error starting tab capture | Select "Chrome Tab" (not "Entire Screen") in the picker |
| Recording not uploading to R2 | Ensure R2 Worker API Key is set in Options |
| "Connection successful" but meeting not tracked | Meeting URL may not be registered in the Laneway backend |
| Recording file too large | Change quality to "Audio Only" in Options |
| Invalid API key error | Check your API key in Options; use "Test Connection" to verify |

## Technical Details

- Chrome Extension Manifest V3
- MediaRecorder API for recording (WebM/VP9 + Opus)
- `getDisplayMedia` API for tab capture
- Cloudflare R2 + Worker for cloud storage
- Cloudflare D1 for analytics storage
- FastAPI + SQLite for local/self-hosted backend
