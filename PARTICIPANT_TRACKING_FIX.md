# Participant Tracking Fix

## Problem Identified

Your participant tracking system was not working because:

1. ✅ **Participants ARE being tracked** in `content-script.js` (stored in `meetingState.participants`)
2. ❌ **Empty participant array** was being sent when stopping recording (`popup.js` line 237)
3. ❌ **Content script was never asked** to provide the participant data
4. ❌ **Backend received empty list** and stored nothing in the database

## Solution Implemented

### 1. Content Script Enhancement (`content-script.js`)

Added a new message handler `GET_PARTICIPANTS` that returns the tracked participant data:

```javascript
case 'GET_PARTICIPANTS':
    // Return participant data for recording completion
    const participants = Array.from(meetingState.participants.values()).map(p => ({
        id: p.id,
        name: p.name,
        email: p.email || null,
        joinTime: p.joinTime,
        cameraOn: p.cameraOn,
        audioMuted: p.audioMuted,
        cameraOnDuration: p.cameraOnDuration,
        speakingEvents: p.speakingEvents || []
    }));
    console.log('Returning participant data:', participants.length, 'participants');
    sendResponse({ participants });
    break;
```

### 2. Popup Script Enhancement (`popup.js`)

Modified the stop recording flow to:
1. Request participant data from content script
2. Pass it to background script
3. Background script sends it to backend API

```javascript
// First, get participant data from content script
let participants = [];
try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url && tab.url.includes('meet.google.com')) {
        const participantResponse = await chrome.tabs.sendMessage(tab.id, { 
            type: 'GET_PARTICIPANTS' 
        });
        if (participantResponse && participantResponse.participants) {
            participants = participantResponse.participants;
            console.log('Retrieved participant data:', participants.length, 'participants');
        }
    }
} catch (participantError) {
    console.warn('Could not retrieve participant data:', participantError);
}

const response = await chrome.runtime.sendMessage({
    type: 'STOP_RECORDING',
    data: {
        metadata: currentState.meetingInfo,
        participants: participants  // Now contains actual participant data!
    }
});
```

## How to Test

### Step 1: Reload the Extension

1. Open Chrome and go to `chrome://extensions/`
2. Find "Laneway" extension
3. Click the **Reload** button (🔄)

### Step 2: Join a Test Meeting

1. Go to Google Meet and join a meeting with multiple participants (at least 2-3 people)
2. Make sure you're actually IN the meeting (not in the lobby)

### Step 3: Start Recording

1. Click the Laneway extension icon
2. Click "Start Recording"
3. Let it record for at least 30 seconds while participants are visible

### Step 4: Stop Recording

1. Click "Stop Recording"
2. Check the browser console for logs:
   - Should see: `"Returning participant data: X participants"`
   - Should see: `"Retrieved participant data: X participants"`

### Step 5: Verify in Database

Run the analytics viewer:

```bash
python view_analytics.py
```

You should now see participant names listed under the **👥 PARTICIPANTS** section!

## What Data is Tracked

For each participant, the system tracks:

- **Name**: Extracted from Google Meet UI
- **Join Time**: When they joined the meeting
- **Camera Status**: Whether camera is on/off
- **Audio Status**: Whether they're muted
- **Camera Duration**: Total time with camera on (in milliseconds)
- **Speaking Events**: Array of speaking activity (for future engagement scoring)

## Expected Output

After recording a meeting with 17 participants, you should see:

```
👥 PARTICIPANTS
--------------------------------------------------------------------------------

👤 John Doe
   Meeting: sgg-aeoy-gwc
   Joined: 2026-01-12T15:45:00
   Camera On: 5.2 min
   Speaking: 2.1 min
   Engagement: 0.75

👤 Jane Smith
   Meeting: sgg-aeoy-gwc
   Joined: 2026-01-12T15:45:30
   Camera On: 4.8 min
   Speaking: 1.5 min
   Engagement: 0.68

... (15 more participants)
```

## Troubleshooting

### If participants still don't show up:

1. **Check browser console** (F12) for errors
2. **Verify content script is loaded**: Look for "Laneway content script loaded" in console
3. **Check participant detection**: Look for "Participant joined: [name]" messages
4. **Verify database schema**: Make sure `meeting_participants` table exists

### Common Issues:

**Issue**: "No participants tracked yet"
- **Cause**: Extension not properly reloaded
- **Fix**: Go to `chrome://extensions/` and click Reload

**Issue**: Participant count shows in UI but not in database
- **Cause**: Backend API not running
- **Fix**: Start backend with `python backend/start.py`

**Issue**: Only seeing 1-2 participants instead of 17
- **Cause**: Google Meet's participant panel needs to be opened
- **Fix**: Click the "People" button in Google Meet to show all participants

## Database Schema

Participants are stored in the `meeting_participants` table:

```sql
CREATE TABLE meeting_participants (
    id TEXT PRIMARY KEY,
    meeting_id TEXT NOT NULL,
    employee_id TEXT,
    employee_name TEXT,
    employee_email TEXT,
    join_time TEXT,
    leave_time TEXT,
    camera_on_duration INTEGER DEFAULT 0,
    speaking_duration INTEGER DEFAULT 0,
    engagement_score REAL DEFAULT 0.0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

## Next Steps

Once participant tracking is working, you can:

1. **Match participants to employees**: Cross-reference with `employees.json`
2. **Calculate engagement scores**: Based on camera time, speaking time, etc.
3. **Generate reports**: Who attended, who was engaged, etc.
4. **Track absences**: Compare expected vs actual attendees
