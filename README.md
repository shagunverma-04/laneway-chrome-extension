# Laneway - Google Meet Recording Extension

Record Google Meet sessions with audio and video. Download recordings locally for transcription and analysis.

## Features

- **One-Click Recording** - Record Google Meet audio/video with one click
- **Local Storage** - Recordings saved directly to your Downloads folder
- **Participant Tracking** - Track camera usage and engagement (optional)
- **Optional Backend** - Connect to your own backend for cloud storage and analytics
- **Privacy-First** - No data sent anywhere by default, you control everything

## Installation

### From Chrome Web Store
1. Visit the Chrome Web Store
2. Click "Add to Chrome"
3. Done! No configuration needed.

### Manual Installation (Developer Mode)
1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" (top right)
4. Click "Load unpacked"
5. Select the `laneway-extension` folder
6. Extension icon appears in toolbar

## How to Use

### Step-by-Step Recording Instructions

1. **Go to Google Meet** - Navigate to `https://meet.google.com` and join any meeting
2. **Wait until you're in the meeting** - You must be in the actual meeting (not the lobby/waiting room)
3. **Click the Laneway extension icon** - In your Chrome toolbar (top right)
4. **Click "Start Recording"** - The blue button in the popup
5. **A screen picker dialog will appear** - This is a Chrome permission dialog
6. **Select "Chrome Tab"** - Choose the tab option (not "Entire Screen" or "Window")
7. **IMPORTANT: Check "Share tab audio"** - This checkbox is at the bottom of the dialog. Without this, your recording will have no audio!
8. **Click "Share"** - Recording starts immediately
9. **You'll see a recording indicator** - A red dot appears showing recording is active
10. **Click "Stop Recording"** when done - Recording automatically downloads to your Downloads folder

### Recording Output
- File format: WebM (VP9 video + Opus audio)
- Location: Your Downloads folder
- Filename: `laneway-recording-[id]-[timestamp].webm`

## Testing Instructions for Chrome Web Store Reviewers

### Prerequisites
- Google Chrome browser
- Access to Google Meet (any Google account works)

### Test Procedure

**Step 1: Install the Extension**
- Load the extension in Chrome (via Web Store or developer mode)

**Step 2: Join a Google Meet**
- Go to https://meet.google.com
- Create a new meeting or join an existing one
- Wait until you are fully inside the meeting (you should see the video/audio controls at the bottom)

**Step 3: Start Recording**
- Click the Laneway extension icon in the Chrome toolbar
- The popup will show "In Meeting" status
- Click the "Start Recording" button

**Step 4: Grant Permissions (Critical)**
- A Chrome screen picker dialog will appear
- Select the **"Chrome Tab"** option
- **Check the "Share tab audio" checkbox** (this is essential for audio capture)
- Click "Share"

**Step 5: Verify Recording**
- The popup will show a red recording indicator
- A timer will count up showing elapsed time
- You can speak or play audio in the meeting to test audio capture

**Step 6: Stop and Save**
- Click "Stop Recording" in the popup
- The recording will automatically download to your Downloads folder
- Open the downloaded .webm file to verify it has both video and audio

### Troubleshooting for Reviewers

| Issue | Solution |
|-------|----------|
| "Start Recording" button doesn't work | Make sure you're in an active meeting, not the lobby |
| No audio in recording | You must check "Share tab audio" in the screen picker |
| Extension doesn't detect meeting | Refresh the Google Meet page and try again |
| Recording file is empty | Ensure you recorded for at least 5-10 seconds |

### What the Extension Does NOT Require
- No account creation needed
- No backend server needed
- No external services needed
- Works completely offline after installation

### Demo Credentials (Optional Backend)
If testing with the optional backend server:
- **Email:** demo@laneway.com
- **Password:** demo123

## Settings

Access settings by right-clicking the extension icon and selecting "Options"

### Available Settings
- **Backend URL** - Optional backend server URL (leave empty for local-only mode)
- **Recording Quality** - Audio-only, 720p, or 1080p
- **Auto-start** - Automatically start recording when joining meetings
- **Participant Tracking** - Enable/disable participant analytics

## Privacy & Security

- **Local-first** - Recordings saved to your device by default
- **No tracking** - We don't collect any analytics or usage data
- **No external servers** - Works completely offline
- **You control your data** - All recordings stay on your device
- **Optional backend** - You choose if/when to use cloud features

## Project Structure

```
laneway-extension/
├── manifest.json          # Extension configuration
├── background.js          # Service worker
├── content-script.js      # Google Meet integration
├── config.js              # Configuration defaults
├── options.html           # Settings page
├── options.js             # Settings logic
├── popup/
│   ├── popup.html         # Extension UI popup
│   ├── popup.js           # Popup logic
│   └── popup.css          # Popup styling
├── styles/
│   └── content.css        # Injected styles
├── icons/                 # Extension icons
└── backend/               # Optional backend (separate)
```

## Optional Backend Configuration

Want cloud storage, analytics, or team features? You can optionally configure a backend server:

1. Right-click the extension icon and select "Options"
2. Enter your backend URL (e.g., `https://your-backend.com`)
3. Click "Save Settings"

See `backend/README.md` for backend setup instructions.

## Troubleshooting

### "No audio in recording"
Make sure to check the "Share tab audio" checkbox when selecting the tab to share.

### "Error starting tab capture"
1. Make sure you're in an active Google Meet meeting (not the lobby)
2. Select "Chrome Tab" (not "Entire Screen")
3. Check "Share tab audio"
4. Click "Share"

### "Extension not working"
1. Go to `chrome://extensions/`
2. Find "Laneway Meeting Recorder"
3. Click the reload icon
4. Try again

### "Recording file is too large"
Change recording quality to "Audio Only" in settings.

## License

MIT License

## Technical Details

- Built with Chrome Extension Manifest V3
- Uses MediaRecorder API for recording
- Uses getDisplayMedia API for screen/tab capture
- Optional backend powered by Cloudflare R2 / Google Drive
