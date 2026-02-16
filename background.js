// Background Service Worker for Laneway Extension
// Handles recording state, message passing, cloud uploads, and backend API integration

importScripts('config.js');

// Global state
let recordingState = {
    isRecording: false,
    meetingId: null,
    startTime: null,
    recordingId: null
};

// ─── API Helper ────────────────────────────────────────────────────────────────

/**
 * Call the Laneway backend API with X-API-Key auth and exponential backoff.
 * Reads apiKey and baseUrl from chrome.storage.sync.
 * On persistent failure, queues the request in pendingUploads.
 */
async function callBackendAPI(method, path, body = null) {
    const { laneway_api_key: apiKey, laneway_base_url: baseUrl } =
        await chrome.storage.sync.get(['laneway_api_key', 'laneway_base_url']);

    if (!apiKey) {
        throw new Error('No API key configured');
    }

    const url = `${baseUrl || CONFIG.BACKEND_BASE_URL}${path}`;
    const headers = { 'X-API-Key': apiKey, 'Content-Type': 'application/json' };
    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);

    const MAX_RETRIES = 3;
    let lastError;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
            const response = await fetch(url, options);

            if (response.ok) {
                return await response.json();
            }

            // Don't retry client errors (4xx) except 429
            if (response.status >= 400 && response.status < 500 && response.status !== 429) {
                const errorBody = await response.text().catch(() => '');
                const err = new Error(`API ${response.status}: ${errorBody}`);
                err.status = response.status;
                throw err;
            }

            // Retry on 5xx and 429
            lastError = new Error(`API ${response.status}`);
            lastError.status = response.status;
        } catch (error) {
            if (error.status && error.status >= 400 && error.status < 500 && error.status !== 429) {
                throw error; // Don't retry client errors
            }
            lastError = error;
        }

        // Exponential backoff: 1s, 2s, 4s
        if (attempt < MAX_RETRIES - 1) {
            await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
        }
    }

    // All retries failed — queue for later
    await queuePendingUpload(method, path, body);
    throw lastError;
}

/**
 * Queue a failed API call for retry later.
 */
async function queuePendingUpload(method, path, body) {
    const { pendingUploads = [] } = await chrome.storage.local.get('pendingUploads');
    pendingUploads.push({ method, path, body, queuedAt: Date.now() });
    await chrome.storage.local.set({ pendingUploads });
    console.log('Queued pending upload:', method, path);
}

/**
 * Retry all pending uploads. Called on service worker startup.
 */
async function retryPendingUploads() {
    const { pendingUploads = [] } = await chrome.storage.local.get('pendingUploads');
    if (pendingUploads.length === 0) return;

    console.log(`Retrying ${pendingUploads.length} pending uploads...`);
    const remaining = [];

    for (const item of pendingUploads) {
        try {
            const { laneway_api_key: apiKey, laneway_base_url: baseUrl } =
                await chrome.storage.sync.get(['laneway_api_key', 'laneway_base_url']);

            if (!apiKey) {
                remaining.push(item);
                continue;
            }

            const url = `${baseUrl || CONFIG.BACKEND_BASE_URL}${item.path}`;
            const options = {
                method: item.method,
                headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' }
            };
            if (item.body) options.body = JSON.stringify(item.body);

            const response = await fetch(url, options);
            if (response.ok) {
                console.log('Pending upload succeeded:', item.path);
            } else {
                console.warn('Pending upload still failing:', item.path, response.status);
                remaining.push(item);
            }
        } catch (error) {
            console.warn('Pending upload retry error:', item.path, error.message);
            remaining.push(item);
        }
    }

    await chrome.storage.local.set({ pendingUploads: remaining });
    if (remaining.length > 0) {
        console.log(`${remaining.length} uploads still pending`);
    }
}

// Retry pending uploads on startup
retryPendingUploads();

// ─── Message Listener ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Background received message:', message);

    switch (message.type) {
        case 'START_RECORDING':
            // Handle message from popup (no sender.tab) or content script (has sender.tab)
            if (sender.tab && sender.tab.id) {
                handleStartRecording(message.data, sender.tab.id)
                    .then(sendResponse)
                    .catch(error => sendResponse({ success: false, error: error.message }));
            } else {
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
            return true;

        case 'STOP_RECORDING':
            handleStopRecording(message.data)
                .then(sendResponse)
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true;

        case 'GET_RECORDING_STATE':
            sendResponse({ state: recordingState });
            return false;

        case 'UPLOAD_ANALYTICS':
            handleAnalyticsUpload(message.data)
                .then(sendResponse)
                .catch(error => sendResponse({ error: error.message }));
            return true;

        case 'MEETING_DETECTED':
            handleMeetingDetected(message.data, sender.tab?.id)
                .then(() => sendResponse({ success: true }))
                .catch(err => {
                    console.error('MEETING_DETECTED handler failed:', err);
                    sendResponse({ success: false, error: err.message });
                });
            return true;

        case 'MEETING_ENDED':
            handleMeetingEnded(message.data);
            sendResponse({ success: true });
            return false;

        case 'UPLOAD_COMPLETE':
            handleUploadComplete(message)
                .then(() => {
                    console.log('Post-upload metadata sent');
                    sendResponse({ success: true });
                })
                .catch(err => {
                    console.warn('Post-upload metadata failed:', err.message);
                    sendResponse({ success: false, error: err.message });
                });
            return true;

        case 'PARTICIPANT_DATA':
            handleParticipantDataUpload(message.data)
                .then(result => console.log('Participant data upload result:', result))
                .catch(err => console.error('Participant data upload failed:', err.message));
            sendResponse({ success: true });
            return false;

        case 'RECORDING_FAILED':
            console.error('Recording failed:', message.error);
            recordingState = {
                isRecording: false,
                meetingId: null,
                startTime: null,
                recordingId: null
            };
            chrome.storage.local.set({ recordingState });
            // Revert meeting status from "live" back to "scheduled"
            chrome.storage.local.get(['currentMeetingUid'], (result) => {
                if (result.currentMeetingUid) {
                    callBackendAPI('POST', '/api/ext/recording/cancel', {
                        meeting_uid: result.currentMeetingUid
                    }).then(() => {
                        console.log('Meeting status reverted to scheduled');
                    }).catch(err => console.warn('Could not revert meeting status:', err.message));
                }
            });
            sendResponse({ success: true });
            return false;

        case 'GET_MEETING_TRACKING_STATUS':
            chrome.storage.local.get(['currentMeetingUid'], (result) => {
                sendResponse({
                    isTracked: !!result.currentMeetingUid,
                    meetingUid: result.currentMeetingUid || null
                });
            });
            return true;

        default:
            console.log('Unknown message type:', message.type);
            sendResponse({ success: false, error: 'Unknown message type' });
            return false;
    }
});

// ─── Recording ID ──────────────────────────────────────────────────────────────

function generateRecordingId(meetingId) {
    const sanitized = (meetingId || 'unknown').replace(/[^a-zA-Z0-9-]/g, '-');
    return `recording_${sanitized}_${Date.now()}`;
}

// ─── Meeting Detection & Lookup ────────────────────────────────────────────────

async function handleMeetingDetected(data, tabId) {
    console.log('Meeting detected:', data);

    // Store basic meeting info
    chrome.storage.local.set({
        currentMeeting: {
            meetingId: data.meetingId,
            meetingTitle: data.meetingTitle,
            startTime: Date.now(),
            tabId: tabId,
            meetUrl: data.url
        }
    });

    // Attempt backend lookup
    try {
        const meetLink = data.url || `https://meet.google.com/${data.meetingId}`;
        console.log('Looking up meeting:', meetLink);

        const { laneway_api_key: apiKey, laneway_base_url: baseUrl } =
            await chrome.storage.sync.get(['laneway_api_key', 'laneway_base_url']);
        console.log('API config:', { hasKey: !!apiKey, baseUrl: baseUrl || CONFIG.BACKEND_BASE_URL });

        const result = await callBackendAPI('GET', `/api/ext/meeting/lookup?meet_link=${encodeURIComponent(meetLink)}`);

        // Meeting found — store UID
        const meetingUid = result.meeting_uid || result.uid;
        await chrome.storage.local.set({ currentMeetingUid: meetingUid });
        console.log('Meeting tracked, UID:', meetingUid);

        // Notify popup / content script
        if (tabId) {
            try {
                chrome.tabs.sendMessage(tabId, {
                    type: 'MEETING_TRACKING_STATUS',
                    isTracked: true,
                    meetingUid: meetingUid
                });
            } catch (e) { /* content script may not be listening */ }
        }

    } catch (error) {
        console.error('Meeting lookup error:', error.message, 'status:', error.status);
        await chrome.storage.local.set({ currentMeetingUid: null });

        if (tabId) {
            try {
                chrome.tabs.sendMessage(tabId, {
                    type: 'MEETING_TRACKING_STATUS',
                    isTracked: false,
                    meetingUid: null
                });
            } catch (e) { /* content script may not be listening */ }
        }
    }

    // Check auto-start
    chrome.storage.sync.get([CONFIG.STORAGE_KEYS.SETTINGS], (result) => {
        const settings = result[CONFIG.STORAGE_KEYS.SETTINGS] || {};
        if (settings.autoStart) {
            handleStartRecording({
                meetingId: data.meetingId,
                quality: settings.quality || CONFIG.RECORDING.DEFAULT_QUALITY
            }, tabId);
        }
    });
}

function handleMeetingEnded(data) {
    console.log('Meeting ended:', data);

    if (recordingState.isRecording) {
        handleStopRecording(data);
    }

    // Clear meeting tracking info
    chrome.storage.local.remove(['currentMeeting', 'currentMeetingUid', 'recordingStartTime']);
}

// ─── Recording Start ───────────────────────────────────────────────────────────

async function handleStartRecording(data, tabId) {
    try {
        console.log('Starting recording for tab:', tabId);

        const recordingId = generateRecordingId(data.meetingId);
        let uploadUrl = null;
        let isLocalMode = true;

        if (CONFIG.R2_WORKER_URL && CONFIG.R2_API_KEY) {
            uploadUrl = `${CONFIG.R2_WORKER_URL}/recordings/${recordingId}.webm`;
            isLocalMode = false;
            console.log('Cloud mode: Will upload to R2 Worker');
        } else {
            console.log('Local-only mode: R2 Worker not configured');
        }

        const startedAt = new Date().toISOString();

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

        await chrome.storage.local.set({
            recordingState,
            recordingStartTime: startedAt
        });

        // Send to content script to start MediaRecorder
        chrome.tabs.sendMessage(tabId, {
            type: 'RECORDING_STARTED',
            recordingId: recordingId,
            uploadUrl: uploadUrl,
            apiKey: isLocalMode ? null : CONFIG.R2_API_KEY,
            quality: data.quality,
            isLocalMode: isLocalMode
        });

        // Notify backend: recording started (if meeting is tracked)
        const { currentMeetingUid } = await chrome.storage.local.get('currentMeetingUid');
        if (currentMeetingUid) {
            const { currentMeeting } = await chrome.storage.local.get('currentMeeting');
            const meetLink = (currentMeeting && currentMeeting.meetUrl) ||
                `https://meet.google.com/${data.meetingId}`;

            callBackendAPI('POST', '/api/ext/recording/start', {
                meeting_uid: currentMeetingUid,
                meet_link: meetLink,
                started_at: startedAt
            }).then(() => {
                console.log('Backend notified: recording started');
            }).catch(err => {
                console.warn('Failed to notify backend of recording start:', err.message);
            });
        }

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

// ─── Recording Stop ────────────────────────────────────────────────────────────

async function handleStopRecording(data) {
    try {
        console.log('Stopping recording:', recordingState.recordingId);

        if (!recordingState.isRecording) {
            console.error('No active recording state found');
            throw new Error('No active recording');
        }

        const tabId = recordingState.tabId;
        const recordingId = recordingState.recordingId;
        const startTime = recordingState.startTime;
        const isLocalMode = recordingState.isLocalMode;

        const stoppedAt = new Date().toISOString();
        const durationMs = Date.now() - startTime;
        const durationSeconds = Math.round(durationMs / 1000);

        // Capture meetingUid NOW before it gets cleared by handleMeetingEnded
        const { currentMeetingUid } = await chrome.storage.local.get('currentMeetingUid');
        console.log('Meeting UID at stop time:', currentMeetingUid);

        // Store it separately so handleUploadComplete can use it even after meeting ends
        if (currentMeetingUid) {
            await chrome.storage.local.set({ stoppedMeetingUid: currentMeetingUid });
        }

        // Send stop to content script
        try {
            await chrome.tabs.sendMessage(tabId, {
                type: 'RECORDING_STOPPED',
                recordingId: recordingId
            });
            console.log('Sent stop message to content script');
        } catch (error) {
            console.warn('Could not send stop message to content script:', error.message);
        }

        // Get participant count from content script
        let participantCount = 0;
        try {
            const resp = await chrome.tabs.sendMessage(tabId, { type: 'GET_PARTICIPANTS' });
            if (resp && resp.participants) {
                participantCount = resp.participants.length;
            }
        } catch (e) {
            console.warn('Could not get participant count:', e.message);
        }

        // Notify backend: recording stopped → sets status to "processing"
        if (currentMeetingUid) {
            try {
                await callBackendAPI('POST', '/api/ext/recording/stop', {
                    meeting_uid: currentMeetingUid,
                    stopped_at: stoppedAt,
                    duration: durationSeconds,
                    participant_count: participantCount
                });
                console.log('Backend notified: recording stopped (processing)');
            } catch (err) {
                console.warn('Failed to notify backend of recording stop:', err.message);
            }
        }

        // Store stopped_at for metadata step
        await chrome.storage.local.set({ recordingStoppedAt: stoppedAt });

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

// ─── Post-Upload Metadata ──────────────────────────────────────────────────────

async function handleUploadComplete(message) {
    const recordingId = message.recordingId;
    console.log('Upload complete for:', recordingId);

    // Use stoppedMeetingUid (preserved at stop time) since currentMeetingUid may be cleared
    const stored0 = await chrome.storage.local.get(['stoppedMeetingUid', 'currentMeetingUid']);
    const meetingUid = stored0.stoppedMeetingUid || stored0.currentMeetingUid;
    if (!meetingUid) {
        console.log('Untracked meeting — skipping metadata upload');
        return;
    }

    // Wait a moment for participant data to arrive
    await new Promise(r => setTimeout(r, 1000));

    // Get stored participant data and recording info
    const stored = await chrome.storage.local.get([
        'lastParticipantData',
        'recordingStartTime',
        'recordingStoppedAt'
    ]);

    const participantData = stored.lastParticipantData || {};
    const startTime = stored.recordingStartTime;
    const stoppedAt = stored.recordingStoppedAt;

    // Calculate duration
    let durationSeconds = 0;
    if (startTime && stoppedAt) {
        durationSeconds = Math.round(
            (new Date(stoppedAt).getTime() - new Date(startTime).getTime()) / 1000
        );
    }

    // Build participant_analytics keyed by display name
    const participantAnalytics = {};
    const participants = participantData.participants || participantData.snapshots?.[0]?.participants || [];
    for (const p of participants) {
        participantAnalytics[p.name] = {
            join_time: p.joinTime,
            leave_time: p.leaveTime || null,
            camera_on_duration: Math.round((p.cameraOnDuration || 0) / 1000),
            speaking_duration: calculateSpeakingDuration(p.speakingEvents || []),
            was_muted: p.audioMuted || false
        };
    }

    // Build R2 recording URL
    const recordingUrl = CONFIG.R2_WORKER_URL
        ? `${CONFIG.R2_WORKER_URL}/recordings/${recordingId}.webm`
        : null;

    try {
        await callBackendAPI('POST', '/api/ext/recording/metadata', {
            meeting_uid: meetingUid,
            recording_url: recordingUrl,
            recording_duration: durationSeconds,
            participant_analytics: participantAnalytics
        });
        console.log('Recording metadata sent to backend (completed)');
    } catch (error) {
        console.warn('Failed to send recording metadata:', error.message);
    }

    // Clean up stored data
    chrome.storage.local.remove(['recordingStartTime', 'recordingStoppedAt', 'lastParticipantData', 'stoppedMeetingUid']);
}

/**
 * Sum speaking durations from events array.
 * Each event: { start: timestamp, end: timestamp } or { duration: seconds }
 */
function calculateSpeakingDuration(events) {
    let totalSeconds = 0;
    for (const evt of events) {
        if (evt.duration) {
            totalSeconds += evt.duration;
        } else if (evt.start && evt.end) {
            totalSeconds += Math.round((evt.end - evt.start) / 1000);
        }
    }
    return totalSeconds;
}

// ─── Analytics Upload (D1 Worker only) ─────────────────────────────────────────

async function handleAnalyticsUpload(data) {
    const results = { worker: null };

    // Send to Cloudflare Worker (D1)
    if (CONFIG.R2_WORKER_URL && CONFIG.R2_API_KEY) {
        try {
            const response = await fetch(`${CONFIG.R2_WORKER_URL}/analytics`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': CONFIG.R2_API_KEY
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                console.error(`Worker analytics upload failed: ${response.status}`);
                results.worker = { success: false, status: response.status };
            } else {
                const result = await response.json();
                console.log('Analytics uploaded to Worker:', result);
                results.worker = { success: true };
            }
        } catch (error) {
            console.error('Worker analytics error:', error.message);
            results.worker = { success: false, error: error.message };
        }
    }

    return { success: true, results };
}

// ─── Participant Data Upload (R2 only) ─────────────────────────────────────────

async function handleParticipantDataUpload(data) {
    const results = { worker: null };

    // Store participant data for post-upload metadata
    await chrome.storage.local.set({ lastParticipantData: data });

    // Upload to R2 via Worker
    if (CONFIG.R2_WORKER_URL && CONFIG.R2_API_KEY) {
        try {
            const url = `${CONFIG.R2_WORKER_URL}/participant-data/${data.recordingId}.json`;
            console.log('Uploading participant data to R2:', url);

            const response = await fetch(url, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': CONFIG.R2_API_KEY
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                console.error(`R2 participant data upload failed: ${response.status}`);
                results.worker = { success: false, status: response.status };
            } else {
                const result = await response.json();
                console.log('Participant data uploaded to R2:', result);
                results.worker = { success: true, key: result.key };
            }
        } catch (error) {
            console.error('R2 participant data error:', error.message);
            results.worker = { success: false, error: error.message };
        }
    }

    return { success: true, results };
}

// ─── Tab Navigation Listener ───────────────────────────────────────────────────

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.url && recordingState.isRecording && recordingState.tabId === tabId) {
        if (!changeInfo.url.includes('meet.google.com')) {
            console.log('User left Meet, stopping recording');
            handleStopRecording({ reason: 'user_left_meeting' });
        }
    }
});

// ─── Extension Install ─────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        console.log('Laneway extension installed');
        chrome.tabs.create({ url: 'options.html' });
    }
});

console.log('Laneway background service worker loaded');
