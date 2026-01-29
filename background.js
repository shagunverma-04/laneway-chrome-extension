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
            const url = result.laneway_backend_url || CONFIG.API_BASE_URL || '';
            resolve(url);
        });
    });
}

// Helper: Generate local recording ID
function generateLocalRecordingId() {
    return 'local-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
}

// Handle recording start
async function handleStartRecording(data, tabId) {
    try {
        console.log('Starting recording for tab:', tabId);

        let recordingId;
        let uploadUrl = null;

        // Check if backend is configured
        const backendUrl = await getBackendUrl();

        if (backendUrl) {
            // Backend mode - request upload URL from backend
            try {
                const authToken = await getAuthToken();
                const uploadUrlResponse = await fetch(`${backendUrl}/api/recordings/upload-url`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${authToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        meetingId: data.meetingId,
                        estimatedSize: data.estimatedSize || 100000000, // 100MB default
                        format: data.quality === 'audio-only' ? 'webm-audio' : 'webm-video'
                    })
                });

                if (uploadUrlResponse.ok) {
                    const response = await uploadUrlResponse.json();
                    uploadUrl = response.uploadUrl;
                    recordingId = response.recordingId;
                    console.log('Backend mode: Got upload URL from backend');
                } else {
                    // Backend returned error, fall back to local mode
                    console.warn('Backend returned error, falling back to local mode');
                    recordingId = generateLocalRecordingId();
                }
            } catch (backendError) {
                // Backend fetch failed, fall back to local mode
                console.warn('Backend unavailable, falling back to local mode:', backendError.message);
                recordingId = generateLocalRecordingId();
            }
        } else {
            // Local-only mode - no backend configured
            console.log('Local-only mode: No backend configured');
            recordingId = generateLocalRecordingId();
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
            isLocalMode: !uploadUrl
        };

        // Save state to storage
        await chrome.storage.local.set({ recordingState });

        // Send message to content script to start recording
        // The content script will handle getting the media stream
        chrome.tabs.sendMessage(tabId, {
            type: 'RECORDING_STARTED',
            recordingId: recordingId,
            uploadUrl: uploadUrl,
            quality: data.quality,
            isLocalMode: !uploadUrl
        });

        return {
            success: true,
            recordingId: recordingId,
            message: uploadUrl ? 'Recording started (cloud mode)' : 'Recording started (local mode)'
        };

    } catch (error) {
        console.error('Error starting recording:', error);
        // Provide more helpful error messages
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

        // Wait a bit for the content script to process and save/upload
        await new Promise(resolve => setTimeout(resolve, 2000));

        let taskCount = 0;

        // Only notify backend if not in local mode
        if (!isLocalMode) {
            const backendUrl = await getBackendUrl();
            if (backendUrl) {
                try {
                    const authToken = await getAuthToken();
                    const completeResponse = await fetch(`${backendUrl}/api/recordings/complete`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${authToken}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            recordingId: recordingId,
                            meetingId: meetingId,
                            metadata: data.metadata || {},
                            participants: data.participants || [],
                            duration: Date.now() - startTime
                        })
                    });

                    if (completeResponse.ok) {
                        const result = await completeResponse.json();
                        console.log('Recording completed on backend:', result);
                        taskCount = result.taskCount || 0;
                    } else {
                        console.warn('Backend returned error when completing recording');
                    }
                } catch (backendError) {
                    console.warn('Could not notify backend:', backendError.message);
                }
            }
        } else {
            console.log('Local mode: Recording saved to Downloads folder');
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
            message: isLocalMode ? 'Recording saved to Downloads' : 'Recording stopped and uploaded',
            taskCount: taskCount
        };

    } catch (error) {
        console.error('Error stopping recording:', error);
        throw error;
    }
}

// Start MediaRecorder with the captured stream
async function startMediaRecorder(stream, recordingId, uploadUrl) {
    try {
        const options = {
            mimeType: 'video/webm;codecs=vp9,opus',
            videoBitsPerSecond: 2500000
        };

        const mediaRecorder = new MediaRecorder(stream, options);
        const recordedChunks = [];

        mediaRecorder.ondataavailable = (event) => {
            if (event.data && event.data.size > 0) {
                recordedChunks.push(event.data);
                console.log('Recorded chunk:', event.data.size, 'bytes');
            }
        };

        mediaRecorder.onstop = async () => {
            console.log('MediaRecorder stopped, uploading...');

            if (recordedChunks.length > 0) {
                const blob = new Blob(recordedChunks, { type: 'video/webm' });
                console.log('Total recording size:', blob.size, 'bytes');

                // For now, just log the blob
                // In production, you would upload to S3/GCS using the uploadUrl
                // await uploadRecording(blob, uploadUrl);
            }

            // Stop all tracks
            stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.onerror = (event) => {
            console.error('MediaRecorder error:', event.error);
        };

        // Start recording, request data every 10 seconds
        mediaRecorder.start(10000);

        // Store the recorder in state
        recordingState.mediaRecorder = mediaRecorder;
        recordingState.recordedChunks = recordedChunks;

        console.log('MediaRecorder started successfully');

    } catch (error) {
        console.error('Failed to start MediaRecorder:', error);
        throw error;
    }
}

// Upload recording to cloud storage
async function uploadRecording(blob, uploadUrl) {
    try {
        // This would upload to S3/GCS in production
        // For local development, we'll skip the actual upload
        console.log('Would upload', blob.size, 'bytes to:', uploadUrl);

        // Example S3 upload:
        // const response = await fetch(uploadUrl, {
        //     method: 'PUT',
        //     body: blob,
        //     headers: {
        //         'Content-Type': 'video/webm'
        //     }
        // });

        return { success: true };
    } catch (error) {
        console.error('Upload error:', error);
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
