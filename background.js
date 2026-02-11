// Background Service Worker for Laneway Extension
// Handles recording state, message passing, and cloud uploads

importScripts('config.js');

// Global state
let recordingState = {
    isRecording: false,
    meetingId: null,
    startTime: null,
    recordingId: null
};

// Listen for messages from content script and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Background received message:', message);

    switch (message.type) {
        case 'START_RECORDING':
            // Handle message from popup (no sender.tab) or content script (has sender.tab)
            if (sender.tab && sender.tab.id) {
                // Message from content script
                handleStartRecording(message.data, sender.tab.id)
                    .then(sendResponse)
                    .catch(error => sendResponse({ success: false, error: error.message }));
            } else {
                // Message from popup - need to get active tab
                chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                    if (tabs[0]) {
                        handleStartRecording(message.data, tabs[0].id)
                            .then(sendResponse)
                            .catch(error => sendResponse({ success: false, error: error.message }));
                    } else {
                        sendResponse({ success: false, error: 'No active tab found' });
                    }
                });
            }
            return true; // Keep channel open for async response

        case 'STOP_RECORDING':
            handleStopRecording(message.data)
                .then(sendResponse)
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true;

        case 'GET_RECORDING_STATE':
            sendResponse({ state: recordingState });
            return false; // Synchronous response

        case 'UPLOAD_ANALYTICS':
            handleAnalyticsUpload(message.data)
                .then(sendResponse)
                .catch(error => sendResponse({ error: error.message }));
            return true;

        case 'MEETING_DETECTED':
            handleMeetingDetected(message.data, sender.tab.id);
            sendResponse({ success: true });
            return false; // Synchronous response

        case 'MEETING_ENDED':
            handleMeetingEnded(message.data);
            sendResponse({ success: true });
            return false; // Synchronous response

        case 'UPLOAD_COMPLETE':
            // Handled by the listener in handleStopRecording
            console.log('Upload complete for:', message.recordingId);
            sendResponse({ success: true });
            return false;

        case 'PARTICIPANT_DATA':
            handleParticipantDataUpload(message.data)
                .then(result => console.log('Participant data upload result:', result))
                .catch(err => console.error('Participant data upload failed:', err.message));
            sendResponse({ success: true });
            return false;

        case 'RECORDING_FAILED':
            console.error('Recording failed:', message.error);
            // Reset recording state
            recordingState = {
                isRecording: false,
                meetingId: null,
                startTime: null,
                recordingId: null
            };
            chrome.storage.local.set({ recordingState });
            sendResponse({ success: true });
            return false;

        default:
            console.log('Unknown message type:', message.type);
            sendResponse({ success: false, error: 'Unknown message type' });
            return false;
    }
});

// Helper: Get backend URL from storage or config
async function getBackendUrl() {
    return new Promise((resolve) => {
        chrome.storage.sync.get(['laneway_backend_url'], (result) => {
            const url = result.laneway_backend_url || '';
            resolve(url);
        });
    });
}

// Helper: Generate recording ID using meeting ID
function generateRecordingId(meetingId) {
    const sanitized = (meetingId || 'unknown').replace(/[^a-zA-Z0-9-]/g, '-');
    return `recording_${sanitized}_${Date.now()}`;
}

// Handle recording start
async function handleStartRecording(data, tabId) {
    try {
        console.log('Starting recording for tab:', tabId);

        const recordingId = generateRecordingId(data.meetingId);
        let uploadUrl = null;
        let isLocalMode = true;

        // Build Worker upload URL if R2 Worker is configured
        if (CONFIG.R2_WORKER_URL && CONFIG.R2_API_KEY) {
            uploadUrl = `${CONFIG.R2_WORKER_URL}/recordings/${recordingId}.webm`;
            isLocalMode = false;
            console.log('Cloud mode: Will upload to R2 Worker');
        } else {
            console.log('Local-only mode: R2 Worker not configured');
        }

        // Update recording state BEFORE sending to content script
        recordingState = {
            isRecording: true,
            meetingId: data.meetingId,
            startTime: Date.now(),
            recordingId: recordingId,
            uploadUrl: uploadUrl,
            quality: data.quality,
            tabId: tabId,
            isLocalMode: isLocalMode
        };

        // Save state to storage
        await chrome.storage.local.set({ recordingState });

        // Send message to content script to start recording
        chrome.tabs.sendMessage(tabId, {
            type: 'RECORDING_STARTED',
            recordingId: recordingId,
            uploadUrl: uploadUrl,
            apiKey: isLocalMode ? null : CONFIG.R2_API_KEY,
            quality: data.quality,
            isLocalMode: isLocalMode
        });

        return {
            success: true,
            recordingId: recordingId,
            message: uploadUrl ? 'Recording started (cloud mode)' : 'Recording started (local mode)'
        };

    } catch (error) {
        console.error('Error starting recording:', error);
        if (error.message.includes('Cannot capture a tab with a streaming media source')) {
            throw new Error('Cannot record this tab. Please try refreshing the Google Meet page and try again.');
        } else if (error.message.includes('Extension has not been invoked')) {
            throw new Error('Please click the extension icon and try again.');
        }
        throw error;
    }
}

// Handle recording stop
async function handleStopRecording(data) {
    try {
        console.log('Stopping recording:', recordingState.recordingId);

        if (!recordingState.isRecording) {
            console.error('No active recording state found');
            throw new Error('No active recording');
        }

        const tabId = recordingState.tabId;
        const recordingId = recordingState.recordingId;
        const meetingId = recordingState.meetingId;
        const startTime = recordingState.startTime;
        const isLocalMode = recordingState.isLocalMode;

        // Send message to content script to stop the MediaRecorder
        try {
            await chrome.tabs.sendMessage(tabId, {
                type: 'RECORDING_STOPPED',
                recordingId: recordingId
            });
            console.log('Sent stop message to content script');
        } catch (error) {
            console.warn('Could not send stop message to content script:', error.message);
        }

        // Wait for content script to finish uploading (up to 60s for large files)
        await new Promise((resolve) => {
            const timeout = setTimeout(() => {
                console.warn('Upload completion timed out after 60s, proceeding');
                chrome.runtime.onMessage.removeListener(listener);
                resolve();
            }, 60000);

            function listener(msg) {
                if (msg.type === 'UPLOAD_COMPLETE' && msg.recordingId === recordingId) {
                    console.log('Upload complete signal received');
                    clearTimeout(timeout);
                    chrome.runtime.onMessage.removeListener(listener);
                    resolve();
                }
            }

            chrome.runtime.onMessage.addListener(listener);
        });

        if (isLocalMode) {
            console.log('Local mode: Recording saved to Downloads folder');
        } else {
            console.log('Cloud mode: Recording uploaded to R2');
        }

        // Reset recording state
        recordingState = {
            isRecording: false,
            meetingId: null,
            startTime: null,
            recordingId: null,
            mediaRecorder: null,
            tabId: null,
            isLocalMode: false
        };

        await chrome.storage.local.set({ recordingState });

        return {
            success: true,
            message: isLocalMode ? 'Recording saved to Downloads' : 'Recording stopped and uploaded'
        };

    } catch (error) {
        console.error('Error stopping recording:', error);
        throw error;
    }
}

// Handle analytics data upload
async function handleAnalyticsUpload(data) {
    try {
        // Check if backend is configured
        const backendUrl = await getBackendUrl();
        if (!backendUrl) {
            // No backend configured, skip analytics upload
            console.log('Local mode: Skipping analytics upload');
            return { success: true, skipped: true };
        }

        const authToken = await getAuthToken();

        const response = await fetch(`${backendUrl}/api/analytics/upload`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            throw new Error('Failed to upload analytics');
        }

        return { success: true };

    } catch (error) {
        console.error('Error uploading analytics:', error);
        // Don't throw - analytics upload failures shouldn't break the extension
        return { success: false, error: error.message };
    }
}

// Handle participant data upload to R2
async function handleParticipantDataUpload(data) {
    if (!CONFIG.R2_WORKER_URL || !CONFIG.R2_API_KEY) {
        console.log('R2 not configured, skipping participant data upload');
        return { success: false, skipped: true };
    }

    const url = `${CONFIG.R2_WORKER_URL}/participant-data/${data.recordingId}.json`;
    console.log('Uploading participant data to:', url);

    const response = await fetch(url, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'X-API-Key': CONFIG.R2_API_KEY
        },
        body: JSON.stringify(data)
    });

    if (!response.ok) {
        throw new Error(`Participant data upload failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    console.log('Participant data uploaded successfully:', result);
    return { success: true, key: result.key };
}

// Handle meeting detection
function handleMeetingDetected(data, tabId) {
    console.log('Meeting detected:', data);

    // Store meeting info
    chrome.storage.local.set({
        currentMeeting: {
            meetingId: data.meetingId,
            meetingTitle: data.meetingTitle,
            startTime: Date.now(),
            tabId: tabId
        }
    });

    // Check if auto-start is enabled
    chrome.storage.sync.get([CONFIG.STORAGE_KEYS.SETTINGS], (result) => {
        const settings = result[CONFIG.STORAGE_KEYS.SETTINGS] || {};
        if (settings.autoStart) {
            // Auto-start recording
            handleStartRecording({
                meetingId: data.meetingId,
                quality: settings.quality || CONFIG.RECORDING.DEFAULT_QUALITY
            }, tabId);
        }
    });
}

// Handle meeting end
function handleMeetingEnded(data) {
    console.log('Meeting ended:', data);

    // If recording is active, stop it
    if (recordingState.isRecording) {
        handleStopRecording(data);
    }

    // Clear meeting info
    chrome.storage.local.remove('currentMeeting');
}

// Helper: Get auth token from storage (returns empty string if not found)
async function getAuthToken() {
    return new Promise((resolve) => {
        chrome.storage.sync.get([CONFIG.STORAGE_KEYS.AUTH_TOKEN], (result) => {
            const token = result[CONFIG.STORAGE_KEYS.AUTH_TOKEN] || '';
            resolve(token);
        });
    });
}

// Listen for tab updates to detect when user navigates away from Meet
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.url && recordingState.isRecording && recordingState.tabId === tabId) {
        // User navigated away from Meet while recording
        if (!changeInfo.url.includes('meet.google.com')) {
            console.log('User left Meet, stopping recording');
            handleStopRecording({ reason: 'user_left_meeting' });
        }
    }
});

// Listen for extension installation
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        console.log('Laneway extension installed');
        // Open welcome page or setup
        chrome.tabs.create({ url: 'popup/popup.html' });
    }
});

console.log('Laneway background service worker loaded');
