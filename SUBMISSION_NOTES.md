# Chrome Web Store Submission Notes

## Version 1.0.0 - Policy Compliance Update

### Changes Made to Address Rejection

**Previous Rejection Reason:** "Functionality providing through localhost"

**Resolution:**
1. **Removed all hardcoded localhost references** from the extension code
2. **Made backend URL optional and user-configurable** through extension settings
3. **Core functionality works independently** without requiring any backend server

### How the Extension Works Now

#### Local-Only Mode (Default)
- Extension works out of the box without any configuration
- Recordings are saved directly to the user's Downloads folder
- No backend server required
- No external dependencies

#### Optional Backend Mode
- Users can optionally configure a backend URL in extension settings
- Backend features include:
  - Cloud storage integration
  - Team analytics
  - Absence notifications
- Backend configuration is completely optional

### Testing Instructions for Reviewers

#### Basic Recording (No Backend Required)
1. Install the extension
2. Navigate to any Google Meet meeting (https://meet.google.com/xxx-xxxx-xxx)
3. Join the meeting
4. Click the Laneway extension icon
5. Click "Start Recording"
6. Select "Chrome Tab" in the screen picker
7. **Important:** Check "Share tab audio" checkbox
8. Click "Share"
9. Recording starts - you'll see a recording indicator
10. Click "Stop Recording" when done
11. Recording is automatically downloaded to Downloads folder

#### Optional Backend Configuration
1. Right-click extension icon → "Options"
2. Enter backend URL (optional)
3. Save settings
4. Backend features will now be available

### Files Modified

1. **manifest.json**
   - Updated description to focus on core functionality
   - Added options_page for settings

2. **config.js**
   - Removed hardcoded localhost URL
   - Changed to empty default

3. **content-script.js**
   - Removed hardcoded localhost URL
   - Changed to empty default

4. **popup/popup.js**
   - Removed hardcoded localhost URL
   - Added backend URL loading from storage
   - Added graceful handling when backend is not configured
   - Backend features show helpful messages when URL not set

5. **options.html** (NEW)
   - Settings page for optional backend configuration
   - Clear messaging that backend is optional

6. **options.js** (NEW)
   - Handles saving/loading backend URL from storage

### Permissions Justification

- **tabCapture**: Required to capture Google Meet tab audio/video
- **storage**: Required to save user settings and preferences
- **tabs**: Required to detect Google Meet tabs
- **activeTab**: Required to interact with active Google Meet tab
- **desktopCapture**: Required for screen/tab capture functionality

### Host Permissions Justification

- **https://meet.google.com/\***: Extension only works on Google Meet pages

### Privacy & Data Handling

- All recordings are saved locally to user's device
- No data is sent to external servers unless user configures backend
- No analytics or tracking
- No personal data collection
- User has full control over their recordings

### Single Purpose Statement

This extension serves a single purpose: **Record Google Meet sessions with audio and video, and save them locally for later transcription and analysis.**

### Demo Credentials

Not applicable - extension works without login in local-only mode.

For backend features (optional):
- Users must set up their own backend server
- No demo credentials provided as backend is optional

---

## Additional Notes

- Extension is fully functional without any external dependencies
- Backend server is completely optional
- All core features work in local-only mode
- No localhost or external server required for basic operation
- Complies with Chrome Web Store policies regarding remote code and localhost dependencies
