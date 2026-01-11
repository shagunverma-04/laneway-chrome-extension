# 🔊 How to Capture Audio - IMPORTANT!

## The Issue

When you use Chrome's screen sharing picker, **audio is NOT included by default**!

You must **manually check the "Share tab audio" checkbox** in the picker dialog.

## How to Record WITH Audio

### Step-by-Step:

1. **Click "Start Recording"** in the extension

2. **Chrome shows picker**: "Choose what to share"

3. **Select "Chrome Tab"** (not "Entire Screen")

4. **Select your Google Meet tab**

5. **⚠️ IMPORTANT**: Check the **"Share tab audio"** checkbox!
   - Look for a checkbox at the bottom of the picker
   - It says "Share tab audio" or "Share audio"
   - **YOU MUST CHECK THIS BOX!**

6. **Click "Share"**

7. **Recording starts with audio!** ✅

## Visual Guide

```
┌─────────────────────────────────────┐
│  Choose what to share               │
├─────────────────────────────────────┤
│                                     │
│  ○ Entire Screen                    │
│  ● Chrome Tab  ← SELECT THIS        │
│  ○ Window                           │
│                                     │
│  [Google Meet Tab Preview]          │
│                                     │
│  ☑ Share tab audio  ← CHECK THIS!  │
│                                     │
│         [Cancel]  [Share]           │
└─────────────────────────────────────┘
```

## What Happens If You Forget

If you forget to check "Share tab audio", the extension will:

1. Detect no audio track
2. Show a warning: "⚠️ No audio detected!"
3. Ask if you want to continue without audio
4. You can:
   - Click **Cancel** → Stop and try again
   - Click **OK** → Record without audio (not recommended!)

## Verifying Audio is Captured

After clicking "Share", check the console (F12):

**✅ Good (with audio):**
```
✅ Got media stream: MediaStream
   Audio tracks: 1
   Video tracks: 1
✅ Audio track found: [tab audio label]
```

**❌ Bad (no audio):**
```
✅ Got media stream: MediaStream
   Audio tracks: 0  ← NO AUDIO!
   Video tracks: 1
⚠️ No audio track detected!
```

## Why This Happens

Chrome's `getDisplayMedia()` API requires **explicit user permission** to capture tab audio. This is a security feature to prevent websites from secretly recording your audio.

## Alternative: Audio-Only Mode

If you only want audio (no video), you can:

1. Select "Audio Only" mode in the extension settings (if available)
2. OR still use "Chrome Tab" but the video won't be recorded

## Testing Your Recording

After recording, play the .webm file and check:
- ✅ Can you hear the audio?
- ✅ Can you see the video?

If no audio:
- You forgot to check "Share tab audio"
- Try again and remember to check the box!

## Quick Checklist

Before recording:
- [ ] Open Google Meet
- [ ] Click "Start Recording"
- [ ] Select "Chrome Tab"
- [ ] Select Google Meet tab
- [ ] **☑ Check "Share tab audio"** ← MOST IMPORTANT!
- [ ] Click "Share"
- [ ] Verify console shows "Audio tracks: 1"

---

**Remember**: Always check "Share tab audio" in the picker! 🔊
