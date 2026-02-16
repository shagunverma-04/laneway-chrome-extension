// Popup script for Laneway Extension

// State
let currentState = {
    isAuthenticated: false,
    isInMeeting: false,
    isRecording: false,
    isTracked: false,
    meetingInfo: null,
    recordingStartTime: null
};

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Popup loaded');

    // Check if API key is configured
    await checkAuth();

    // Load settings
    await loadSettings();

    // Get current meeting info
    await updateMeetingStatus();

    // Set up event listeners
    setupEventListeners();

    // Update UI every second
    setInterval(updateUI, 1000);
});

// Check authentication (API key configured)
async function checkAuth() {
    const result = await chrome.storage.sync.get(['laneway_api_key', 'laneway_base_url']);

    if (result.laneway_api_key) {
        currentState.isAuthenticated = true;
        document.getElementById('user-email').textContent = 'Connected';
        document.getElementById('status-dot').classList.add('online');
    } else {
        // No API key — still allow local recording
        currentState.isAuthenticated = true; // Always allow recording
        document.getElementById('user-email').textContent = 'Local Mode';
        document.getElementById('status-dot').classList.add('online');
    }

    // Always show recording section
    document.getElementById('recording-section').style.display = 'block';
}

// Load user settings
async function loadSettings() {
    const result = await chrome.storage.sync.get(['laneway_settings']);
    const settings = result.laneway_settings || {};

    document.getElementById('quality-select').value = settings.quality || 'audio-only';
    document.getElementById('auto-start-toggle').checked = settings.autoStart || false;
    document.getElementById('participant-tracking-toggle').checked = settings.trackParticipants !== false;
}

// Save settings
async function saveSettings() {
    const settings = {
        quality: document.getElementById('quality-select').value,
        autoStart: document.getElementById('auto-start-toggle').checked,
        trackParticipants: document.getElementById('participant-tracking-toggle').checked
    };

    await chrome.storage.sync.set({ laneway_settings: settings });
    console.log('Settings saved:', settings);
}

// Update meeting status
async function updateMeetingStatus() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (tab && tab.url && tab.url.includes('meet.google.com')) {
            try {
                const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_MEETING_INFO' });

                if (response && response.isInMeeting) {
                    currentState.isInMeeting = true;
                    currentState.meetingInfo = response;

                    document.getElementById('meeting-status-text').textContent = 'In Meeting';
                    document.getElementById('meeting-icon').textContent = '🎥';
                    document.getElementById('meeting-title').textContent = response.meetingTitle || 'Untitled Meeting';

                    // Show tracked/untracked badge
                    updateTrackingBadge(response.isTracked);
                } else {
                    currentState.isInMeeting = false;
                    document.getElementById('meeting-status-text').textContent = 'Waiting to join...';
                    document.getElementById('meeting-icon').textContent = '⏳';
                    document.getElementById('meeting-title').textContent = 'Join the meeting to start recording';
                    hideTrackingBadge();
                }
            } catch (contentScriptError) {
                console.log('Content script not ready:', contentScriptError.message);
                currentState.isInMeeting = false;
                document.getElementById('meeting-status-text').textContent = 'In Lobby';
                document.getElementById('meeting-icon').textContent = '🚪';
                document.getElementById('meeting-title').textContent = 'Join the meeting to start recording';
                hideTrackingBadge();
            }
        } else {
            currentState.isInMeeting = false;
            document.getElementById('meeting-status-text').textContent = 'Not on Google Meet';
            document.getElementById('meeting-icon').textContent = '📅';
            document.getElementById('meeting-title').textContent = '';
            hideTrackingBadge();
        }

        // Also check tracking status from background
        try {
            const trackingStatus = await chrome.runtime.sendMessage({ type: 'GET_MEETING_TRACKING_STATUS' });
            if (trackingStatus && currentState.isInMeeting) {
                currentState.isTracked = trackingStatus.isTracked;
                updateTrackingBadge(trackingStatus.isTracked);
            }
        } catch (e) {
            console.log('Could not get tracking status:', e.message);
        }

        // Get recording state from background
        try {
            const recordingState = await chrome.runtime.sendMessage({ type: 'GET_RECORDING_STATE' });
            if (recordingState && recordingState.state && recordingState.state.isRecording) {
                currentState.isRecording = true;
                currentState.recordingStartTime = recordingState.state.startTime;
                updateRecordingUI(true);
            } else {
                currentState.isRecording = false;
                updateRecordingUI(false);
            }
        } catch (bgError) {
            console.log('Could not get recording state from background:', bgError.message);
            currentState.isRecording = false;
            updateRecordingUI(false);
        }

    } catch (error) {
        console.error('Error updating meeting status:', error);
        currentState.isInMeeting = false;
        document.getElementById('meeting-status-text').textContent = 'Error detecting meeting';
        document.getElementById('meeting-icon').textContent = '⚠️';
    }
}

// Update tracking badge display
function updateTrackingBadge(isTracked) {
    const badge = document.getElementById('tracking-badge');
    if (badge) {
        badge.style.display = 'inline-block';
        if (isTracked) {
            badge.textContent = 'Tracked';
            badge.style.background = 'rgba(16, 185, 129, 0.2)';
            badge.style.color = '#10b981';
            badge.style.border = '1px solid #10b981';
        } else {
            badge.textContent = 'Untracked';
            badge.style.background = 'rgba(156, 163, 175, 0.2)';
            badge.style.color = '#9ca3af';
            badge.style.border = '1px solid #9ca3af';
        }
        badge.style.padding = '2px 8px';
        badge.style.borderRadius = '10px';
        badge.style.fontSize = '11px';
        badge.style.fontWeight = '600';
        badge.style.marginTop = '4px';
    }
}

function hideTrackingBadge() {
    const badge = document.getElementById('tracking-badge');
    if (badge) {
        badge.style.display = 'none';
    }
}

// Update recording UI
function updateRecordingUI(isRecording) {
    const recordBtn = document.getElementById('record-btn');
    const recordingDot = document.getElementById('recording-dot');
    const recordingText = document.getElementById('recording-text');

    if (isRecording) {
        recordBtn.classList.remove('btn-primary');
        recordBtn.classList.add('btn-danger');
        recordBtn.querySelector('.btn-icon').textContent = '⏹';
        recordBtn.querySelector('.btn-text').textContent = 'Stop Recording';

        recordingDot.classList.add('active');
        recordingText.textContent = 'Recording';
    } else {
        recordBtn.classList.remove('btn-danger');
        recordBtn.classList.add('btn-primary');
        recordBtn.querySelector('.btn-icon').textContent = '⏺';
        recordBtn.querySelector('.btn-text').textContent = 'Start Recording';

        recordingDot.classList.remove('active');
        recordingText.textContent = 'Not Recording';
    }
}

// Update UI periodically
function updateUI() {
    if (currentState.isRecording && currentState.recordingStartTime) {
        const elapsed = Date.now() - currentState.recordingStartTime;
        const hours = Math.floor(elapsed / 3600000);
        const minutes = Math.floor((elapsed % 3600000) / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);

        const timeString = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        document.getElementById('recording-time').textContent = timeString;
    } else {
        document.getElementById('recording-time').textContent = '00:00:00';
    }
}

// Set up event listeners
function setupEventListeners() {
    // Record button
    document.getElementById('record-btn').addEventListener('click', handleRecordToggle);

    // Settings changes
    document.getElementById('quality-select').addEventListener('change', saveSettings);
    document.getElementById('auto-start-toggle').addEventListener('change', saveSettings);
    document.getElementById('participant-tracking-toggle').addEventListener('change', saveSettings);

    // Settings link
    document.getElementById('settings-link').addEventListener('click', (e) => {
        e.preventDefault();
        chrome.runtime.openOptionsPage();
    });
}

// Handle record toggle
async function handleRecordToggle() {
    if (!currentState.isInMeeting) {
        alert('You must be in a Google Meet meeting to start recording');
        return;
    }

    const recordBtn = document.getElementById('record-btn');
    recordBtn.disabled = true;

    try {
        if (currentState.isRecording) {
            // Stop recording
            console.log('Stopping recording...');

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
                    participants: participants
                }
            });

            currentState.isRecording = false;
            currentState.recordingStartTime = null;
            updateRecordingUI(false);

            if (response && response.success) {
                alert(response.message || 'Recording stopped! Check your Downloads folder.');
            } else {
                console.warn('Stop recording response:', response);
                alert('Recording stopped. Check your Downloads folder for the file.');
            }
        } else {
            // Start recording
            console.log('Starting recording...');
            const quality = document.getElementById('quality-select').value;

            const response = await chrome.runtime.sendMessage({
                type: 'START_RECORDING',
                data: {
                    meetingId: currentState.meetingInfo.meetingId,
                    quality: quality
                }
            });

            if (response && response.success) {
                currentState.isRecording = true;
                currentState.recordingStartTime = Date.now();
                updateRecordingUI(true);
                console.log('Recording started:', response.message);
            } else {
                const errorMsg = response?.error || 'Failed to start recording. Make sure you are in an active meeting.';
                throw new Error(errorMsg);
            }
        }
    } catch (error) {
        console.error('Error toggling recording:', error);
        alert('Error: ' + error.message);

        if (currentState.isRecording) {
            currentState.isRecording = false;
            currentState.recordingStartTime = null;
            updateRecordingUI(false);
        }
    } finally {
        recordBtn.disabled = false;
    }
}

console.log('Popup script loaded');
