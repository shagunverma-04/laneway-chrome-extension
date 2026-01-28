# 🎥 Laneway - Google Meet Recording Extension

> Record Google Meet sessions with audio and video. Download recordings locally for transcription and analysis.

[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-blue)](https://chrome.google.com)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-green)](https://developer.chrome.com/docs/extensions/mv3/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## ✨ Features

- 🎙️ **One-Click Recording** - Record Google Meet audio/video with one click
- 💾 **Local Storage** - Recordings saved directly to your Downloads folder
- 📊 **Participant Tracking** - Track camera usage and engagement (optional)
- ☁️ **Optional Backend** - Connect to your own backend for cloud storage and analytics
- 🔒 **Privacy-First** - No data sent anywhere by default, you control everything

## 🚀 Quick Start

### Installation

#### From Chrome Web Store (Recommended)
1. Visit the [Chrome Web Store](https://chrome.google.com/webstore) (link coming soon)
2. Click "Add to Chrome"
3. Done! No configuration needed.

#### Manual Installation (Developer Mode)
1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" (top right)
4. Click "Load unpacked"
5. Select the `laneway-extension` folder
6. Extension icon appears in toolbar!

### Basic Usage (No Setup Required)

1. **Join a Google Meet** - Navigate to any Google Meet meeting
2. **Click the Laneway icon** - In your Chrome toolbar
3. **Click "Start Recording"** - In the popup
4. **Select "Chrome Tab"** - In the screen picker dialog
5. **✅ Check "Share tab audio"** - This is important for audio!
6. **Click "Share"** - Recording starts
7. **Click "Stop Recording"** - When you're done
8. **Find your recording** - Check your Downloads folder!

That's it! No backend server, no configuration, no hassle.

## ⚙️ Optional Configuration

### Backend Server (Optional)

Want cloud storage, analytics, or team features? You can optionally configure a backend server:

1. **Right-click the extension icon** → "Options"
2. **Enter your backend URL** (e.g., `https://your-backend.com`)
3. **Click "Save Settings"**
4. **Done!** Backend features are now enabled.

**Backend features include:**
- Cloud storage (Cloudflare R2, Google Drive, S3)
- Team analytics and insights
- Absence notifications
- Task extraction and Notion sync

See [BACKEND_SETUP.md](BACKEND_SETUP.md) for backend setup instructions.

## 📖 How It Works

### Local-Only Mode (Default)

```
┌─────────────────────┐
│  Chrome Extension   │
│  - Captures Meeting │
│  - Records A/V      │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Downloads Folder   │
│  - Local Storage    │
│  - Your Control     │
└─────────────────────┘
```

### With Optional Backend

```
┌─────────────────────┐
│  Chrome Extension   │
│  - Captures Meeting │
│  - Records A/V      │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Your Backend       │
│  - Cloud Storage    │
│  - Analytics        │
│  - AI Processing    │
└─────────────────────┘
```

## 🔧 Settings

Access settings by right-clicking the extension icon → "Options"

### Available Settings

- **Backend URL** - Optional backend server URL
- **Recording Quality** - Audio-only, 720p, or 1080p
- **Auto-start** - Automatically start recording when joining meetings
- **Participant Tracking** - Enable/disable participant analytics

## 📁 Project Structure

```
laneway-extension/
├── manifest.json              # Extension configuration
├── background.js              # Service worker
├── content-script.js          # Google Meet integration
├── config.js                  # Configuration defaults
├── options.html               # Settings page
├── options.js                 # Settings logic
├── popup/                     # Extension UI
│   ├── popup.html
│   ├── popup.js
│   └── popup.css
├── styles/                    # Stylesheets
│   └── content.css
├── icons/                     # Extension icons
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── backend/                   # Optional backend (separate)
    └── ... (see BACKEND_SETUP.md)
```

## 🔒 Privacy & Security

- ✅ **Local-first** - Recordings saved to your device by default
- ✅ **No tracking** - We don't collect any analytics or usage data
- ✅ **No external servers** - Works completely offline
- ✅ **You control your data** - All recordings stay on your device
- ✅ **Optional backend** - You choose if/when to use cloud features
- ✅ **Open source** - Review the code yourself

## 🆘 Troubleshooting

### "No audio in recording"

**Solution:** Make sure to check the "Share tab audio" checkbox when selecting the tab to share!

### "Error starting tab capture"

**Solution:** 
1. Make sure you're in an active Google Meet meeting (not the lobby)
2. Select "Chrome Tab" (not "Entire Screen")
3. Check "Share tab audio"
4. Click "Share"

### "Extension not working"

**Solution:**
1. Go to `chrome://extensions/`
2. Find "Laneway Meeting Recorder"
3. Click the reload icon (🔄)
4. Try again

### "Recording file is too large"

**Solution:** Change recording quality to "Audio Only" in settings:
1. Right-click extension icon → "Options"
2. Select "Audio Only" for recording quality
3. Save settings

## 🤝 Contributing

Contributions welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) first.

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with Chrome Extension Manifest V3
- Uses MediaRecorder API for recording
- Optional backend powered by Cloudflare R2 / Google Drive

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/laneway-extension/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/laneway-extension/discussions)

---

**Made with ❤️ for better meeting productivity**

**Note:** This extension works completely standalone without any backend server. Backend integration is optional and only needed for advanced features like cloud storage and analytics.