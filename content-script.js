// Content Script - Injected into Google Meet pages
// Handles meeting detection, participant tracking, and UI injection

console.log('Laneway content script loaded');

// Snapshot of participants preserved across meeting-end race conditions
let lastParticipantSnapshot = [];

// Convert a Date to Asia/Kolkata ISO string (UTC+5:30 fixed offset)
function toKolkataISO(date) {
    const d = date instanceof Date ? date : new Date(date);
    const utc = d.getTime();
    const kolkata = new Date(utc + (5.5 * 60 * 60 * 1000));
    const iso = kolkata.toISOString().replace('Z', '+05:30');
    return iso;
}

// Get only the direct text content of an element (not nested children)
function getDirectTextContent(element) {
    let text = '';
    for (const node of element.childNodes) {
        if (node.nodeType === Node.TEXT_NODE) {
            text += node.textContent;
        }
    }
    return text.trim();
}

// State management
let meetingState = {
    meetingId: null,
    meetingTitle: null,
    isInMeeting: false,
    participants: new Map(),
    analyticsInterval: null,
    speakingInterval: null,
    recorder: null,
    isTracked: false,
    meetingUid: null
};

// R2 config passed from background via RECORDING_STARTED message
let r2Config = { workerUrl: null, apiKey: null };

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    initialize();
}

function initialize() {
    console.log('Initializing Laneway in Google Meet');

    // Detect if we're in a meeting
    detectMeeting();

    // Set up observers
    setupMeetingObserver();
    setupParticipantObserver();
}

// Detect if we're in an active meeting
function detectMeeting() {
    const url = window.location.href;
    const meetingMatch = url.match(/meet\.google\.com\/([a-z-]+)/);

    if (meetingMatch) {
        const meetingId = meetingMatch[1];

        const hasControlBar = document.querySelector('[data-meeting-controls]') !== null ||
            document.querySelector('[role="toolbar"]') !== null ||
            document.querySelector('.VfPpkd-Bz112c-LgbsSe') !== null;

        const hasMicButton = document.querySelector('[aria-label*="microphone"]') !== null ||
            document.querySelector('[aria-label*="Microphone"]') !== null ||
            document.querySelector('[data-is-muted]') !== null;

        const hasCameraButton = document.querySelector('[aria-label*="camera"]') !== null ||
            document.querySelector('[aria-label*="Camera"]') !== null;

        const hasEndCallButton = document.querySelector('[aria-label*="Leave call"]') !== null ||
            document.querySelector('[aria-label*="leave"]') !== null ||
            document.querySelector('[aria-label*="end"]') !== null;

        const hasMeetingContainer = document.querySelector('.KUfYIc') !== null ||
            document.querySelector('[data-meeting-title]') !== null;

        const inActiveMeeting = hasControlBar || hasMicButton || hasCameraButton ||
            hasEndCallButton || hasMeetingContainer;

        console.log('Meeting detection:', {
            meetingId,
            hasControlBar,
            hasMicButton,
            hasCameraButton,
            hasEndCallButton,
            hasMeetingContainer,
            inActiveMeeting
        });

        if (inActiveMeeting) {
            const meetingTitle = extractMeetingTitle();

            meetingState.meetingId = meetingId;
            meetingState.meetingTitle = meetingTitle;
            meetingState.isInMeeting = true;

            console.log('Meeting detected:', { meetingId, meetingTitle });

            // Notify background script
            chrome.runtime.sendMessage({
                type: 'MEETING_DETECTED',
                data: {
                    meetingId: meetingId,
                    meetingTitle: meetingTitle,
                    url: url
                }
            }).catch(err => console.log('Background not ready:', err));

            // Do an initial participant scan immediately
            updateParticipantList();

            // Start analytics tracking
            startAnalyticsTracking();

            // Inject recording indicator
            injectRecordingIndicator();
        } else {
            console.log('In Google Meet lobby, waiting to join...');
            meetingState.isInMeeting = false;
            meetingState.meetingId = meetingId;
            meetingState.meetingTitle = null;

            setTimeout(() => {
                if (!meetingState.isInMeeting) {
                    console.log('Retrying meeting detection...');
                    detectMeeting();
                }
            }, 2000);
        }
    }
}

// Extract meeting title from page
function extractMeetingTitle() {
    const dataTitleEl = document.querySelector('[data-meeting-title]');
    if (dataTitleEl) {
        const attrVal = dataTitleEl.getAttribute('data-meeting-title');
        if (attrVal && attrVal.trim()) {
            return attrVal.trim();
        }
        const directText = getDirectTextContent(dataTitleEl);
        if (directText) {
            return directText;
        }
    }

    const titleSelectors = ['.u6vdEc', 'div[jsname="r4nke"]'];
    for (const selector of titleSelectors) {
        const element = document.querySelector(selector);
        if (element) {
            const directText = getDirectTextContent(element);
            if (directText) {
                return directText;
            }
        }
    }

    const urlMatch = window.location.href.match(/meet\.google\.com\/([a-z-]+)/);
    if (urlMatch) {
        return urlMatch[1];
    }

    return 'Untitled Meeting';
}

// Set up observer to detect when meeting starts/ends
function setupMeetingObserver() {
    const observer = new MutationObserver((mutations) => {
        const inMeeting = document.querySelector('[data-meeting-title]') !== null ||
            document.querySelector('.KUfYIc') !== null;

        if (!inMeeting && meetingState.isInMeeting) {
            handleMeetingEnd();
        } else if (inMeeting && !meetingState.isInMeeting) {
            detectMeeting();
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}

// Set up observer to track participants (debounced)
function setupParticipantObserver() {
    let debounceTimer = null;

    const observer = new MutationObserver(() => {
        if (!meetingState.isInMeeting) return;
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            updateParticipantList();
        }, 2000);
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true
    });
}

// Extract short device ID from full participant path
// "spaces/df95N4C32M0B/devices/209" → "209"
function extractDeviceId(fullId) {
    if (!fullId) return null;
    const match = fullId.match(/devices\/(\d+)/);
    return match ? match[1] : fullId;
}

// Gather participants from all available DOM sources
function findParticipantElements() {
    const found = new Map(); // key: participantId, value: { name, element, deviceId }

    // Strategy 1: Video grid tiles (data-participant-id)
    document.querySelectorAll('[data-participant-id]').forEach(el => {
        const fullId = el.getAttribute('data-participant-id');
        const deviceId = extractDeviceId(fullId);
        const name = extractParticipantName(el);
        if (fullId && name) {
            found.set(fullId, { name, element: el, deviceId: deviceId || fullId });
        }
    });

    // Strategy 2: Requested participants
    document.querySelectorAll('[data-requested-participant-id]').forEach(el => {
        const fullId = el.getAttribute('data-requested-participant-id');
        if (found.has(fullId)) return; // already found via strategy 1
        const deviceId = extractDeviceId(fullId);
        const name = extractParticipantName(el);
        if (fullId && name) {
            found.set(fullId, { name, element: el, deviceId: deviceId || fullId });
        }
    });

    // Strategy 3: Self element
    document.querySelectorAll('[data-self-name]').forEach(el => {
        const selfName = el.getAttribute('data-self-name');
        if (selfName && selfName.trim()) {
            const name = selfName.trim().replace(' (You)', '');
            const fullId = el.getAttribute('data-participant-id') ||
                `self_${name.replace(/\s+/g, '_').toLowerCase()}`;
            if (!found.has(fullId)) {
                const deviceId = extractDeviceId(fullId) || fullId;
                found.set(fullId, { name, element: el, deviceId });
            }
        }
    });

    // Strategy 4: Tiles with class oZRSLe (current Google Meet tile class)
    document.querySelectorAll('div.oZRSLe[data-participant-id]').forEach(el => {
        const fullId = el.getAttribute('data-participant-id');
        if (found.has(fullId)) return;
        const deviceId = extractDeviceId(fullId);
        const name = extractParticipantName(el);
        if (fullId && name) {
            found.set(fullId, { name, element: el, deviceId: deviceId || fullId });
        }
    });

    return found;
}

// Update participant list — also tracks leaveTime for participants no longer in DOM
function updateParticipantList() {
    const found = findParticipantElements();

    // Collect currently visible participant IDs
    const visibleIds = new Set();

    for (const [participantId, { name, element, deviceId }] of found) {
        visibleIds.add(participantId);

        if (!meetingState.participants.has(participantId)) {
            // New participant joined
            const now = new Date();
            const nowMs = Date.now();
            const isMuted = isParticipantMuted(element);
            const participant = {
                id: participantId,
                name: name,
                deviceId: deviceId,
                joinTime: toKolkataISO(now),
                leaveTime: null,
                cameraOn: isParticipantCameraOn(element),
                audioMuted: isMuted,
                // If already unmuted on join, start speaking session immediately
                isSpeaking: !isMuted,
                speakingStartTime: !isMuted ? nowMs : null,
                speakingEvents: [],
                cameraOnDuration: 0,
                lastCameraCheck: nowMs
            };

            meetingState.participants.set(participantId, participant);
            console.log('Participant joined:', name, '(device:', deviceId + ', muted:', isMuted + ')');
        } else {
            // Only update leaveTime — audioMuted is owned by checkSpeakingAndCamera
            const participant = meetingState.participants.get(participantId);
            if (participant.leaveTime) {
                participant.leaveTime = null;
                console.log('Participant rejoined:', name, '(device:', deviceId + ')');
            }
        }
    }

    // Mark participants no longer visible as left
    for (const [id, participant] of meetingState.participants) {
        if (!visibleIds.has(id) && !participant.leaveTime) {
            participant.leaveTime = toKolkataISO(new Date());
            console.log('Participant left:', participant.name);
        }
    }

    if (found.size > 0) {
        console.log(`Participant scan: ${found.size} visible, ${meetingState.participants.size} total tracked`);
    }
}

// Extract participant name from element
function extractParticipantName(element) {
    // 1. Check data-self-name attribute directly
    const selfName = element.getAttribute('data-self-name');
    if (selfName && selfName.trim()) {
        return selfName.trim().replace(' (You)', '');
    }

    // 2. Check known name selectors (Google Meet changes these periodically)
    const nameSelectors = [
        '.zWGUib',
        '.cS7aqe',
        '.ZjFb7c',
        '.XEazBc',
        '.EY8ABd',
        '.AEMEYe',
        '[data-self-name]',
        'div[jsname="YheHge"]',
        'div[jsname="V3kXXb"]'
    ];

    for (const selector of nameSelectors) {
        const nameElement = element.querySelector(selector);
        if (nameElement) {
            const attrName = nameElement.getAttribute('data-self-name');
            if (attrName && attrName.trim()) {
                return attrName.trim().replace(' (You)', '');
            }
            const text = getDirectTextContent(nameElement);
            if (text) {
                return text.replace(' (You)', '');
            }
        }
    }

    // 3. Check img alt text
    const img = element.querySelector('img[alt]');
    if (img) {
        const alt = img.getAttribute('alt');
        if (alt && alt.trim() && alt !== 'Avatar') {
            return alt.trim().replace(' (You)', '');
        }
    }

    // 4. Fallback: first line of innerText is the participant name in Google Meet
    const firstLine = (element.innerText || '').split('\n')[0].trim();
    // Filter out Google Material icon text and UI strings
    const iconKeywords = ['zoom_in', 'zoom_out', 'open_in_full', 'close_fullscreen',
        'more_vert', 'more_horiz', 'keep', 'push_pin', 'mic', 'mic_off',
        'videocam', 'videocam_off', 'present_to_all', 'cancel_presentation'];
    if (firstLine && firstLine.length >= 2 && firstLine.length <= 60 &&
        !iconKeywords.includes(firstLine.toLowerCase())) {
        return firstLine.replace(' (You)', '').replace(' (you)', '');
    }

    return null;
}

// Generate participant ID from element
function generateParticipantId(element) {
    const name = extractParticipantName(element);
    return name ? `participant_${name.replace(/\s+/g, '_').toLowerCase()}` : null;
}

// Check if participant camera is on
function isParticipantCameraOn(element) {
    const hasVideo = element.querySelector('video') !== null;
    const cameraOffIcon = element.querySelector('[data-icon="camera_off"]');
    return hasVideo && !cameraOffIcon;
}

// Check if participant is muted
function isParticipantMuted(element) {
    const mutedIcon = element.querySelector('[data-icon="mic_off"]');
    return mutedIcon !== null;
}

// Dedicated 500ms interval for speaking and camera duration tracking
function checkSpeakingAndCamera() {
    if (!meetingState.isInMeeting) return;
    const found = findParticipantElements();
    const now = Date.now();

    for (const [participantId, { element }] of found) {
        const participant = meetingState.participants.get(participantId);
        if (!participant) continue;

        // Camera duration
        const cameraOn = isParticipantCameraOn(element);
        if (participant.cameraOn && cameraOn) {
            participant.cameraOnDuration += now - participant.lastCameraCheck;
        }
        participant.cameraOn = cameraOn;
        participant.lastCameraCheck = now;

        // Speaking events — driven by mic mute state transitions
        const isMuted = isParticipantMuted(element);
        if (participant.audioMuted !== isMuted) {
            if (!isMuted) {
                // Mic just unmuted → speaking started
                participant.isSpeaking = true;
                participant.speakingStartTime = now;
            } else {
                // Mic just muted → speaking ended
                if (participant.isSpeaking && participant.speakingStartTime) {
                    const duration = Math.round((now - participant.speakingStartTime) / 1000);
                    if (duration > 0) {
                        participant.speakingEvents.push({
                            start: participant.speakingStartTime,
                            end: now,
                            duration: duration
                        });
                    }
                }
                participant.isSpeaking = false;
                participant.speakingStartTime = null;
            }
            participant.audioMuted = isMuted;
        }
    }
}

// Start analytics tracking
function startAnalyticsTracking() {
    if (meetingState.analyticsInterval) {
        clearInterval(meetingState.analyticsInterval);
    }
    if (meetingState.speakingInterval) {
        clearInterval(meetingState.speakingInterval);
    }

    updateParticipantList();

    // Fast interval for speaking + camera accuracy
    meetingState.speakingInterval = setInterval(checkSpeakingAndCamera, 500);

    // Slow interval for analytics upload
    meetingState.analyticsInterval = setInterval(() => {
        updateParticipantList();
        uploadAnalytics();
    }, 30000);
}

// Upload analytics data
async function uploadAnalytics() {
    const participants = Array.from(meetingState.participants.values()).map(p => ({
        id: p.id,
        name: p.name,
        deviceId: p.deviceId || p.id,
        joinTime: p.joinTime,
        leaveTime: p.leaveTime,
        cameraOn: p.cameraOn,
        audioMuted: p.audioMuted,
        cameraOnDuration: p.cameraOnDuration,
        speakingEvents: p.speakingEvents
    }));

    const analyticsData = {
        meetingId: meetingState.meetingId,
        timestamp: toKolkataISO(new Date()),
        participantCount: participants.length,
        participants: participants
    };

    try {
        const response = await chrome.runtime.sendMessage({
            type: 'UPLOAD_ANALYTICS',
            data: analyticsData
        });

        console.log('Analytics uploaded:', response);
    } catch (error) {
        console.error('Failed to upload analytics:', error);
    }
}

// Handle meeting end
function handleMeetingEnd() {
    console.log('Meeting ended');

    meetingState.isInMeeting = false;

    if (meetingState.analyticsInterval) {
        clearInterval(meetingState.analyticsInterval);
        meetingState.analyticsInterval = null;
    }
    if (meetingState.speakingInterval) {
        clearInterval(meetingState.speakingInterval);
        meetingState.speakingInterval = null;
    }

    // Finalize any open speaking events
    const endMs = Date.now();
    for (const participant of meetingState.participants.values()) {
        if (participant.isSpeaking && participant.speakingStartTime) {
            const duration = Math.round((endMs - participant.speakingStartTime) / 1000);
            if (duration > 0) {
                participant.speakingEvents.push({
                    start: participant.speakingStartTime,
                    end: endMs,
                    duration: duration
                });
            }
            participant.isSpeaking = false;
            participant.speakingStartTime = null;
        }
    }

    // Set leaveTime for all remaining participants
    const now = toKolkataISO(new Date());
    for (const [id, participant] of meetingState.participants) {
        if (!participant.leaveTime) {
            participant.leaveTime = now;
        }
    }

    // Snapshot participants BEFORE clearing so sendParticipantData can use them
    lastParticipantSnapshot = Array.from(meetingState.participants.values()).map(p => ({
        id: p.id,
        name: p.name,
        deviceId: p.deviceId || p.id,
        joinTime: p.joinTime,
        leaveTime: p.leaveTime,
        cameraOn: p.cameraOn,
        audioMuted: p.audioMuted,
        cameraOnDuration: p.cameraOnDuration,
        speakingEvents: p.speakingEvents || []
    }));

    // Upload final analytics
    uploadAnalytics();

    // Notify background
    chrome.runtime.sendMessage({
        type: 'MEETING_ENDED',
        data: {
            meetingId: meetingState.meetingId,
            participants: lastParticipantSnapshot
        }
    }).catch(err => console.log('Could not notify background of meeting end:', err));

    // Only clear participants if no recording is active
    const isRecording = meetingState.recorder && meetingState.recorder.isRecording;
    if (!isRecording) {
        meetingState.participants.clear();
    }
}

// Inject recording indicator
function injectRecordingIndicator() {
    if (document.getElementById('laneway-recording-indicator')) {
        return;
    }

    const indicator = document.createElement('div');
    indicator.id = 'laneway-recording-indicator';
    indicator.className = 'laneway-indicator';
    indicator.style.display = 'none';
    indicator.innerHTML = `
    <div class="laneway-indicator-content">
      <span class="laneway-recording-dot"></span>
      <span class="laneway-recording-text">Recording</span>
      <span class="laneway-recording-time" id="laneway-recording-time">00:00</span>
    </div>
  `;

    const meetContainer = document.querySelector('.KUfYIc') || document.body;
    meetContainer.insertAdjacentElement('afterbegin', indicator);
}

// Show/hide recording indicator
function updateRecordingIndicator(isRecording, duration = 0) {
    const indicator = document.getElementById('laneway-recording-indicator');
    if (indicator) {
        indicator.style.display = isRecording ? 'block' : 'none';

        if (isRecording && duration > 0) {
            const minutes = Math.floor(duration / 60);
            const seconds = duration % 60;
            const timeElement = document.getElementById('laneway-recording-time');
            if (timeElement) {
                timeElement.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
            }
        }
    }
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Content script received message:', message);

    switch (message.type) {
        case 'RECORDING_STARTED':
            handleRecordingStarted(message);
            sendResponse({ success: true });
            return false;

        case 'RECORDING_STOPPED':
            handleRecordingStopped(message);
            sendResponse({ success: true });
            return false;

        case 'GET_MEETING_INFO':
            sendResponse({
                meetingId: meetingState.meetingId,
                meetingTitle: meetingState.meetingTitle,
                isInMeeting: meetingState.isInMeeting,
                participantCount: meetingState.participants.size,
                isTracked: meetingState.isTracked,
                meetingUid: meetingState.meetingUid
            });
            return false;

        case 'GET_PARTICIPANTS':
            const participants = Array.from(meetingState.participants.values()).map(p => ({
                id: p.id,
                name: p.name,
                deviceId: p.deviceId || p.id,
                joinTime: p.joinTime,
                leaveTime: p.leaveTime,
                cameraOn: p.cameraOn,
                audioMuted: p.audioMuted,
                cameraOnDuration: p.cameraOnDuration,
                speakingEvents: p.speakingEvents || []
            }));
            console.log('Returning participant data:', participants.length, 'participants');
            sendResponse({ participants });
            return false;

        case 'MEETING_TRACKING_STATUS':
            meetingState.isTracked = message.isTracked;
            meetingState.meetingUid = message.meetingUid;
            console.log('Meeting tracking status:', message.isTracked ? 'Tracked' : 'Untracked');
            sendResponse({ success: true });
            return false;

        default:
            sendResponse({ success: false, error: 'Unknown message type' });
            return false;
    }
});

// Handle recording started
async function handleRecordingStarted(message) {
    console.log('Recording started:', message);

    // Store R2 config for direct participant data upload from content script
    if (message.uploadUrl && message.apiKey) {
        r2Config.workerUrl = message.uploadUrl.replace(/\/recordings\/.*$/, '');
        r2Config.apiKey = message.apiKey;
    }

    try {
        const isAudioOnly = message.quality === 'audio-only';

        const constraints = {
            video: {
                displaySurface: "browser",
                width: isAudioOnly ? { ideal: 640 } : { ideal: 1920 },
                height: isAudioOnly ? { ideal: 480 } : { ideal: 1080 }
            },
            audio: {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false,
                sampleRate: 48000
            }
        };

        console.log('Requesting display media with constraints:', constraints);

        const displayStream = await navigator.mediaDevices.getDisplayMedia(constraints);
        console.log('Got display stream:', displayStream);
        console.log('   Audio tracks:', displayStream.getAudioTracks().length);
        console.log('   Video tracks:', displayStream.getVideoTracks().length);

        const hasAudio = displayStream.getAudioTracks().length > 0;
        const hasVideo = displayStream.getVideoTracks().length > 0;

        if (!hasAudio) {
            console.warn('No audio track detected from display!');
            console.log('Attempting to capture system audio...');

            try {
                const audioStream = await navigator.mediaDevices.getDisplayMedia({
                    video: false,
                    audio: {
                        echoCancellation: false,
                        noiseSuppression: false,
                        autoGainControl: false,
                        sampleRate: 48000
                    }
                });

                if (audioStream.getAudioTracks().length > 0) {
                    console.log('Got system audio stream!');

                    const combinedStream = new MediaStream();
                    displayStream.getVideoTracks().forEach(track => combinedStream.addTrack(track));
                    audioStream.getAudioTracks().forEach(track => combinedStream.addTrack(track));

                    const recorder = new MeetingRecorder(combinedStream, message.recordingId, message.uploadUrl, isAudioOnly, message.apiKey);
                    await recorder.startRecording();

                    meetingState.recorder = {
                        isRecording: true,
                        startTime: Date.now(),
                        recordingId: message.recordingId,
                        mediaRecorder: recorder,
                        streams: [displayStream, audioStream]
                    };

                    console.log('Recording with system audio');

                    updateRecordingIndicator(true);
                    const recordingTimer = setInterval(() => {
                        if (meetingState.recorder && meetingState.recorder.isRecording) {
                            const duration = Math.floor((Date.now() - meetingState.recorder.startTime) / 1000);
                            updateRecordingIndicator(true, duration);
                        } else {
                            clearInterval(recordingTimer);
                        }
                    }, 1000);

                    return;
                }
            } catch (audioError) {
                console.warn('System audio capture failed:', audioError.message);
            }

            console.log('Attempting to capture microphone audio as fallback...');

            try {
                const micStream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true
                    }
                });

                console.log('Got microphone audio as fallback');

                const combinedStream = new MediaStream();

                displayStream.getVideoTracks().forEach(track => {
                    combinedStream.addTrack(track);
                });

                micStream.getAudioTracks().forEach(track => {
                    combinedStream.addTrack(track);
                });

                const recorder = new MeetingRecorder(combinedStream, message.recordingId, message.uploadUrl, isAudioOnly, message.apiKey);
                await recorder.startRecording();

                meetingState.recorder = {
                    isRecording: true,
                    startTime: Date.now(),
                    recordingId: message.recordingId,
                    mediaRecorder: recorder,
                    streams: [displayStream, micStream]
                };

                console.log('Recording with microphone audio (tab audio not available)');

            } catch (micError) {
                console.error('Failed to get microphone audio:', micError);

                const continueAnyway = confirm(
                    'No audio available!\n\n' +
                    'Tab audio: Not shared\n' +
                    'Microphone: Permission denied\n\n' +
                    'Continue recording without audio?'
                );

                if (!continueAnyway) {
                    displayStream.getTracks().forEach(track => track.stop());
                    throw new Error('Recording cancelled - no audio');
                }

                const recorder = new MeetingRecorder(displayStream, message.recordingId, message.uploadUrl, isAudioOnly, message.apiKey);
                await recorder.startRecording();

                meetingState.recorder = {
                    isRecording: true,
                    startTime: Date.now(),
                    recordingId: message.recordingId,
                    mediaRecorder: recorder,
                    streams: [displayStream]
                };
            }
        } else {
            console.log('Audio track found:', displayStream.getAudioTracks()[0].label);
            console.log('Audio settings:', displayStream.getAudioTracks()[0].getSettings());

            const recorder = new MeetingRecorder(displayStream, message.recordingId, message.uploadUrl, isAudioOnly, message.apiKey);
            await recorder.startRecording();

            meetingState.recorder = {
                isRecording: true,
                startTime: Date.now(),
                recordingId: message.recordingId,
                mediaRecorder: recorder,
                streams: [displayStream]
            };
        }

        if (!hasVideo && message.quality !== 'audio-only') {
            console.warn('No video track detected!');
        }

        updateRecordingIndicator(true);

        const recordingTimer = setInterval(() => {
            if (meetingState.recorder && meetingState.recorder.isRecording) {
                const duration = Math.floor((Date.now() - meetingState.recorder.startTime) / 1000);
                updateRecordingIndicator(true, duration);
            } else {
                clearInterval(recordingTimer);
            }
        }, 1000);

    } catch (error) {
        console.error('Failed to start recording:', error);

        let errorMessage = 'Failed to start recording: ';
        if (error.name === 'NotAllowedError') {
            errorMessage += 'Permission denied. Please allow screen sharing.';
        } else if (error.name === 'NotFoundError') {
            errorMessage += 'No screen/tab selected.';
        } else if (error.message === 'Recording cancelled - no audio') {
            errorMessage = 'Recording cancelled. Remember to check "Share tab audio" next time!';
        } else {
            errorMessage += error.message;
        }

        alert(errorMessage);

        chrome.runtime.sendMessage({
            type: 'RECORDING_FAILED',
            error: error.message
        }).catch(err => console.log('Could not notify background of recording failure:', err));
    }
}

// Handle recording stopped
function handleRecordingStopped(message) {
    console.log('Recording stopped:', message);

    if (meetingState.recorder) {
        const recordingId = meetingState.recorder.recordingId;
        const startTime = meetingState.recorder.startTime;
        const duration = Date.now() - startTime;

        if (meetingState.recorder.mediaRecorder) {
            meetingState.recorder.mediaRecorder.stopRecording();
        }

        if (meetingState.recorder.streams) {
            meetingState.recorder.streams.forEach(stream => {
                stream.getTracks().forEach(track => {
                    track.stop();
                    console.log('   Stopped track:', track.kind, track.label);
                });
            });
        }

        meetingState.recorder.isRecording = false;
        meetingState.recorder = null;

        sendParticipantData(recordingId, duration);
    }

    updateRecordingIndicator(false);
}

// Gather and send participant data to background script
function sendParticipantData(recordingId, duration) {
    // Set leaveTime for participants still present
    const now = toKolkataISO(new Date());
    const nowMs = Date.now();

    // Finalize any open speaking events before sending
    for (const participant of meetingState.participants.values()) {
        if (participant.isSpeaking && participant.speakingStartTime) {
            const secs = Math.round((nowMs - participant.speakingStartTime) / 1000);
            if (secs > 0) {
                participant.speakingEvents.push({
                    start: participant.speakingStartTime,
                    end: nowMs,
                    duration: secs
                });
            }
            participant.isSpeaking = false;
            participant.speakingStartTime = null;
        }
    }

    // Use live map first; fall back to snapshot if map was already cleared
    let participants = Array.from(meetingState.participants.values()).map(p => ({
        id: p.id,
        name: p.name,
        deviceId: p.deviceId || p.id,
        joinTime: p.joinTime,
        leaveTime: p.leaveTime || now,
        cameraOn: p.cameraOn,
        audioMuted: p.audioMuted,
        cameraOnDuration: p.cameraOnDuration,
        speakingEvents: p.speakingEvents || []
    }));

    if (participants.length === 0 && lastParticipantSnapshot.length > 0) {
        console.log('Live participant map empty, using snapshot');
        participants = lastParticipantSnapshot;
    }

    const snapshotId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const payload = {
        meetingId: meetingState.meetingId,
        meetingTitle: meetingState.meetingTitle || 'Untitled Meeting',
        recordingId: recordingId,
        recordedAt: toKolkataISO(new Date()),
        duration: duration,
        participants: participants,
        snapshots: [{
            id: snapshotId,
            timestamp: toKolkataISO(new Date()),
            participantCount: participants.length,
            participants: participants
        }]
    };

    console.log('Sending participant data:', participants.length, 'participants');

    // Upload participant JSON directly to R2 from content script (avoids service worker termination)
    if (r2Config.workerUrl && r2Config.apiKey) {
        const url = `${r2Config.workerUrl}/participant-data/${recordingId}.json`;
        console.log('Uploading participant data to R2 from content script:', url);
        fetch(url, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': r2Config.apiKey
            },
            body: JSON.stringify(payload)
        }).then(res => {
            if (res.ok) {
                console.log('Participant data uploaded to R2 successfully');
            } else {
                console.error('Participant data R2 upload failed:', res.status);
            }
        }).catch(err => console.error('Participant data R2 upload error:', err.message));
    }

    // Also notify background to store for metadata flow
    chrome.runtime.sendMessage({
        type: 'PARTICIPANT_DATA',
        data: payload
    }).catch(err => console.warn('Could not send participant data to background:', err.message));
}

// Meeting Recorder Class
class MeetingRecorder {
    constructor(stream, recordingId, uploadUrl, isAudioOnly = false, apiKey = null) {
        this.stream = stream;
        this.recordingId = recordingId;
        this.uploadUrl = uploadUrl;
        this.isAudioOnly = isAudioOnly;
        this.apiKey = apiKey;
        this.mediaRecorder = null;
        this.recordedChunks = [];
        this.startTime = null;
        this.isRecording = false;
        this.chunkNumber = 0;
    }

    async startRecording() {
        try {
            let options;
            if (this.isAudioOnly) {
                options = {
                    mimeType: 'video/webm;codecs=vp9,opus',
                    videoBitsPerSecond: 100000,
                    audioBitsPerSecond: 128000
                };
            } else {
                options = {
                    mimeType: 'video/webm;codecs=vp9,opus',
                    videoBitsPerSecond: 2500000
                };
            }

            if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                console.warn('VP9 not supported, falling back to VP8');
                options.mimeType = 'video/webm;codecs=vp8,opus';
            }

            this.mediaRecorder = new MediaRecorder(this.stream, options);
            this.startTime = Date.now();
            this.isRecording = true;

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    this.recordedChunks.push(event.data);
                    console.log(`Chunk ${this.recordedChunks.length}: ${event.data.size} bytes`);
                } else {
                    console.warn('Empty chunk received');
                }
            };

            this.mediaRecorder.onstop = async () => {
                console.log('MediaRecorder stopped, total chunks:', this.recordedChunks.length);
                await this.uploadChunks();
                try {
                    await chrome.runtime.sendMessage({
                        type: 'UPLOAD_COMPLETE',
                        recordingId: this.recordingId
                    });
                } catch (e) {
                    console.warn('Could not notify background of upload completion:', e.message);
                }
            };

            this.mediaRecorder.onerror = (event) => {
                console.error('MediaRecorder error:', event.error);
                alert('Recording error: ' + event.error);
            };

            this.mediaRecorder.start(5 * 60 * 1000);

            console.log('MediaRecorder started successfully');
            console.log('   MIME type:', options.mimeType);
            console.log('   State:', this.mediaRecorder.state);

        } catch (error) {
            console.error('Failed to start MediaRecorder:', error);
            throw error;
        }
    }

    stopRecording() {
        console.log('Stopping recording...');

        if (this.mediaRecorder && this.isRecording) {
            console.log('   Current state:', this.mediaRecorder.state);
            console.log('   Chunks collected so far:', this.recordedChunks.length);

            this.mediaRecorder.stop();
            this.stream.getTracks().forEach(track => {
                track.stop();
                console.log('   Stopped track:', track.kind);
            });
            this.isRecording = false;
            console.log('MediaRecorder stopped');
        } else {
            console.warn('No active recording to stop');
        }
    }

    async uploadChunks() {
        console.log('uploadChunks called, chunks:', this.recordedChunks.length);

        if (this.recordedChunks.length === 0) {
            console.warn('No chunks to upload!');
            alert('No recording data captured. Try recording for at least 5 seconds.');
            return;
        }

        const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
        console.log('Recording blob created:', blob.size, 'bytes');

        if (blob.size === 0) {
            console.error('Blob is empty!');
            alert('Recording failed - no data captured');
            return;
        }

        // Try cloud upload first if configured
        if (this.uploadUrl) {
            const maxRetries = 2;
            let uploaded = false;

            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                    console.log(`Uploading to cloud (attempt ${attempt}/${maxRetries}):`, this.uploadUrl);
                    const headers = { 'Content-Type': 'video/webm' };
                    if (this.apiKey) {
                        headers['X-API-Key'] = this.apiKey;
                    }
                    const response = await fetch(this.uploadUrl, {
                        method: 'PUT',
                        body: blob,
                        headers: headers
                    });

                    if (response.ok) {
                        console.log('Recording uploaded to cloud successfully');
                        this.recordedChunks = [];
                        uploaded = true;
                        break;
                    } else {
                        console.error(`Cloud upload attempt ${attempt} failed:`, response.status, response.statusText);
                    }
                } catch (error) {
                    console.error(`Cloud upload attempt ${attempt} error:`, error.message);
                }

                if (attempt < maxRetries) {
                    await new Promise(r => setTimeout(r, 2000));
                }
            }

            if (uploaded) {
                alert('Recording uploaded to cloud successfully!');
                return;
            }

            console.warn('Cloud upload failed, falling back to local download');
        }

        // Local download (fallback if cloud fails, or if no upload URL configured)
        try {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = `${this.recordingId}.webm`;
            document.body.appendChild(a);

            console.log('Triggering local download:', a.download);
            a.click();

            const reason = this.uploadUrl ? 'Cloud upload failed - saved locally as backup.' : 'Local mode.';
            alert(`Recording saved to Downloads folder.\n${reason}\nFile: ${a.download}`);

            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 100);

            console.log('Recording downloaded locally as:', a.download);
        } catch (downloadError) {
            console.error('Download error:', downloadError);
            alert('Failed to save recording: ' + downloadError.message);
        }
    }
}

console.log('Laneway content script initialized');
