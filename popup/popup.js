// Backend API URL - can be configured by users if they want backend features
// Leave empty to use extension in local-only mode
let API_BASE_URL = '';

// State
let currentState = {
    isAuthenticated: false,
    isInMeeting: false,
    isRecording: false,
    meetingInfo: null,
    recordingStartTime: null,
    recordingInterval: null
};

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Popup loaded');

    // Load backend URL from storage
    await loadBackendUrl();

    // Check authentication
    await checkAuth();

    // Load settings
    await loadSettings();

    // Get current meeting info
    await updateMeetingStatus();

    // Load user stats
    await loadUserStats();

    // Set up event listeners
    setupEventListeners();

    // Update UI every second
    setInterval(updateUI, 1000);
});

// Load backend URL from storage
async function loadBackendUrl() {
    try {
        const result = await chrome.storage.sync.get(['laneway_backend_url']);
        if (result.laneway_backend_url) {
            API_BASE_URL = result.laneway_backend_url;
            console.log('Backend URL loaded:', API_BASE_URL);
        } else {
            console.log('No backend URL configured - running in local-only mode');
        }
    } catch (error) {
        console.error('Error loading backend URL:', error);
    }
}

// Check authentication status
async function checkAuth() {
    const result = await chrome.storage.sync.get(['laneway_auth_token', 'laneway_user_email', 'laneway_backend_url']);

    // Check if backend is configured
    const hasBackend = result.laneway_backend_url && result.laneway_backend_url.trim() !== '';

    if (result.laneway_auth_token && result.laneway_user_email) {
        // Already authenticated
        currentState.isAuthenticated = true;
        document.getElementById('user-email').textContent = result.laneway_user_email;
        document.getElementById('status-dot').classList.add('online');

        // Show main UI, hide login
        document.getElementById('login-section').style.display = 'none';
        document.getElementById('recording-section').style.display = 'block';
        document.getElementById('stats-section').style.display = hasBackend ? 'block' : 'none';
    } else if (!hasBackend) {
        // No backend configured - auto-authenticate for local mode
        console.log('No backend configured - enabling local mode');
        await chrome.storage.sync.set({
            laneway_auth_token: 'local-mode',
            laneway_user_email: 'Local User',
            laneway_user_id: 'local-user'
        });

        currentState.isAuthenticated = true;
        document.getElementById('user-email').textContent = 'Local Mode';
        document.getElementById('status-dot').classList.add('online');

        // Show main UI, hide login and stats (no stats in local mode)
        document.getElementById('login-section').style.display = 'none';
        document.getElementById('recording-section').style.display = 'block';
        document.getElementById('stats-section').style.display = 'none';
    } else {
        // Backend configured but not authenticated
        currentState.isAuthenticated = false;

        // Show login, hide main UI
        document.getElementById('login-section').style.display = 'block';
        document.getElementById('recording-section').style.display = 'none';
        document.getElementById('stats-section').style.display = 'none';
    }
}

// Load user settings
async function loadSettings() {
    const result = await chrome.storage.sync.get(['laneway_settings']);
    const settings = result.laneway_settings || {};

    // Apply settings to UI
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
        // Get active tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (tab && tab.url && tab.url.includes('meet.google.com')) {
            try {
                // Send message to content script to get meeting info
                const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_MEETING_INFO' });

                if (response && response.isInMeeting) {
                    currentState.isInMeeting = true;
                    currentState.meetingInfo = response;

                    document.getElementById('meeting-status-text').textContent = 'In Meeting';
                    document.getElementById('meeting-icon').textContent = '🎥';
                    document.getElementById('meeting-title').textContent = response.meetingTitle || 'Untitled Meeting';

                    // Show absence section
                    document.getElementById('absence-section').style.display = 'block';
                } else {
                    currentState.isInMeeting = false;
                    document.getElementById('meeting-status-text').textContent = 'Waiting to join...';
                    document.getElementById('meeting-icon').textContent = '⏳';
                    document.getElementById('meeting-title').textContent = 'Join the meeting to start recording';
                    document.getElementById('absence-section').style.display = 'none';
                }
            } catch (contentScriptError) {
                // Content script not loaded yet (e.g., in lobby or page just loaded)
                console.log('Content script not ready:', contentScriptError.message);
                currentState.isInMeeting = false;
                document.getElementById('meeting-status-text').textContent = 'In Lobby';
                document.getElementById('meeting-icon').textContent = '🚪';
                document.getElementById('meeting-title').textContent = 'Join the meeting to start recording';
                document.getElementById('absence-section').style.display = 'none';
            }
        } else {
            currentState.isInMeeting = false;
            document.getElementById('meeting-status-text').textContent = 'Not on Google Meet';
            document.getElementById('meeting-icon').textContent = '📅';
            document.getElementById('meeting-title').textContent = '';
            document.getElementById('absence-section').style.display = 'none';
        }

        // Get recording state from background
        const recordingState = await chrome.runtime.sendMessage({ type: 'GET_RECORDING_STATE' });
        if (recordingState && recordingState.state && recordingState.state.isRecording) {
            currentState.isRecording = true;
            currentState.recordingStartTime = recordingState.state.startTime;
            updateRecordingUI(true);
        } else {
            currentState.isRecording = false;
            updateRecordingUI(false);
        }

    } catch (error) {
        console.error('Error updating meeting status:', error);
        // Show a generic error state
        currentState.isInMeeting = false;
        document.getElementById('meeting-status-text').textContent = 'Error detecting meeting';
        document.getElementById('meeting-icon').textContent = '⚠️';
    }

    // Update guidance section based on current state
    updateGuidanceSection();
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

    // Update guidance visibility
    updateGuidanceSection();
}

// Update guidance section based on current state
function updateGuidanceSection() {
    const guidanceSection = document.getElementById('guidance-section');
    if (!guidanceSection) return;

    // Hide guidance when recording
    if (currentState.isRecording) {
        guidanceSection.classList.add('hidden');
        return;
    }

    guidanceSection.classList.remove('hidden');

    // Update step states
    const step1 = document.getElementById('step-1');
    const step2 = document.getElementById('step-2');

    // Reset all steps
    document.querySelectorAll('.guidance-steps .step').forEach(step => {
        step.classList.remove('completed', 'active');
    });

    if (currentState.isInMeeting) {
        // Step 1 completed, step 2 is active
        step1.classList.add('completed');
        step2.classList.add('active');
    } else {
        // Step 1 is active
        step1.classList.add('active');
    }
}

// Update UI periodically
function updateUI() {
    // Update recording time
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

    // Absence form
    document.getElementById('submit-absence-btn').addEventListener('click', handleAbsenceSubmit);

    // Login
    document.getElementById('login-btn').addEventListener('click', handleLogin);

    // Footer links
    document.getElementById('dashboard-link').addEventListener('click', (e) => {
        e.preventDefault();
        if (API_BASE_URL) {
            chrome.tabs.create({ url: `${API_BASE_URL}/dashboard` });
        } else {
            alert('Backend URL not configured. Please configure your backend URL in extension settings.');
        }
    });

    document.getElementById('logout-link').addEventListener('click', (e) => {
        e.preventDefault();
        handleLogout();
    });
}

// Handle record toggle
async function handleRecordToggle() {
    if (!currentState.isAuthenticated) {
        showMessage('login-status', 'Please log in first', 'error');
        return;
    }

    if (!currentState.isInMeeting) {
        alert('You must be in a Google Meet meeting to start recording');
        return;
    }

    const recordBtn = document.getElementById('record-btn');
    recordBtn.disabled = true; // Prevent double-clicks

    try {
        if (currentState.isRecording) {
            // Stop recording
            console.log('Stopping recording...');

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
                    participants: participants
                }
            });

            // Always reset state when stopping, even if there's an error
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

        // If we were trying to stop and it failed, still reset the UI
        if (currentState.isRecording) {
            currentState.isRecording = false;
            currentState.recordingStartTime = null;
            updateRecordingUI(false);
        }
    } finally {
        recordBtn.disabled = false;
    }
}

// Handle absence submission
async function handleAbsenceSubmit() {
    const type = document.getElementById('absence-type').value;
    const reason = document.getElementById('absence-reason').value.trim();
    const duration = document.getElementById('absence-duration').value;

    if (!type || !reason) {
        showMessage('absence-status', 'Please select type and provide reason', 'error');
        return;
    }

    if (!currentState.meetingInfo) {
        showMessage('absence-status', 'No active meeting found', 'error');
        return;
    }

    try {
        if (!API_BASE_URL) {
            showMessage('absence-status', 'Backend not configured. Recording works without backend.', 'info');
            return;
        }

        showMessage('absence-status', 'Sending notification...', 'info');

        const authToken = await getAuthToken();
        const userId = await getUserId();

        const response = await fetch(`${API_BASE_URL}/api/absences/notify`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                meeting_id: currentState.meetingInfo.meetingId,
                employee_id: userId,
                reason: reason,
                absence_type: type,
                expected_duration: duration
            })
        });

        if (response.ok) {
            showMessage('absence-status', '✓ Team notified successfully', 'success');

            // Clear form
            document.getElementById('absence-type').value = '';
            document.getElementById('absence-reason').value = '';
            document.getElementById('absence-duration').value = 'all_meeting';

            // Close popup after 2 seconds
            setTimeout(() => window.close(), 2000);
        } else {
            throw new Error('Failed to submit absence');
        }
    } catch (error) {
        console.error('Error submitting absence:', error);
        showMessage('absence-status', 'Failed to send notification', 'error');
    }
}

// Handle login
async function handleLogin() {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    if (!email || !password) {
        showMessage('login-status', 'Please enter email and password', 'error');
        return;
    }

    try {
        if (!API_BASE_URL) {
            showMessage('login-status', 'Backend not configured. Extension works in local-only mode.', 'info');
            // Auto-login in local mode
            await chrome.storage.sync.set({
                laneway_auth_token: 'local-mode',
                laneway_user_email: email || 'local@user.com',
                laneway_user_id: 'local-user'
            });
            setTimeout(() => window.location.reload(), 1000);
            return;
        }

        showMessage('login-status', 'Logging in...', 'info');

        const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        if (response.ok) {
            const data = await response.json();

            // Save auth token and user info
            await chrome.storage.sync.set({
                laneway_auth_token: data.token,
                laneway_user_email: email,
                laneway_user_id: data.userId
            });

            showMessage('login-status', 'Login successful!', 'success');

            // Reload popup
            setTimeout(() => window.location.reload(), 1000);
        } else {
            throw new Error('Invalid credentials');
        }
    } catch (error) {
        console.error('Login error:', error);
        showMessage('login-status', 'Login failed. Please check your credentials.', 'error');
    }
}

// Handle logout
async function handleLogout() {
    await chrome.storage.sync.remove(['laneway_auth_token', 'laneway_user_email', 'laneway_user_id']);
    window.location.reload();
}

// Load user stats
async function loadUserStats() {
    if (!currentState.isAuthenticated) {
        return;
    }

    try {
        if (!API_BASE_URL) {
            // Show default values in local mode
            document.getElementById('meetings-count').textContent = '-';
            document.getElementById('speaking-time').textContent = '-';
            document.getElementById('camera-usage').textContent = '-';
            return;
        }

        const authToken = await getAuthToken();
        const userId = await getUserId();

        const response = await fetch(`${API_BASE_URL}/api/analytics/user/${userId}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (response.ok) {
            const stats = await response.json();

            document.getElementById('meetings-count').textContent = stats.meetingsThisWeek || 0;
            document.getElementById('speaking-time').textContent = `${stats.avgSpeakingTime || 0}m`;
            document.getElementById('camera-usage').textContent = `${stats.cameraUsageRate || 0}%`;
        }
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// Helper: Get auth token
async function getAuthToken() {
    const result = await chrome.storage.sync.get(['laneway_auth_token']);
    return result.laneway_auth_token || '';
}

// Helper: Get user ID
async function getUserId() {
    const result = await chrome.storage.sync.get(['laneway_user_id']);
    return result.laneway_user_id || '';
}

// Helper: Show message
function showMessage(elementId, message, type) {
    const element = document.getElementById(elementId);
    element.textContent = message;
    element.className = `status-message ${type}`;
    element.style.display = 'block';

    if (type === 'success') {
        setTimeout(() => {
            element.style.display = 'none';
        }, 3000);
    }
}

console.log('Popup script loaded');
