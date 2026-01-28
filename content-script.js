// Content Script - Injected into Google Meet pages
// Handles meeting detection, participant tracking, and UI injection

console.log('Laneway content script loaded');

// Import config (will be available from manifest)
// Backend URL can be configured in extension settings
const API_BASE_URL = ''; // Configure in extension settings if using backend features

// State management
let meetingState = {
    meetingId: null,
    meetingTitle: null,
    isInMeeting: false,
    participants: new Map(),
    analyticsInterval: null,
    recorder: null,
    absenceManager: null
};

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

    // Initialize absence manager after a delay to ensure class is loaded
    setTimeout(() => {
        try {
            meetingState.absenceManager = new AbsenceManager();

            // Check for absences after initialization
            if (meetingState.isInMeeting) {
                meetingState.absenceManager.fetchAbsences();
            }
        } catch (error) {
            console.error('Failed to initialize AbsenceManager:', error);
        }
    }, 1000);
}

// Detect if we're in an active meeting
function detectMeeting() {
    const url = window.location.href;
    const meetingMatch = url.match(/meet\.google\.com\/([a-z-]+)/);

    if (meetingMatch) {
        const meetingId = meetingMatch[1];

        // Check if we're actually in the meeting (not just the lobby)
        // We'll be aggressive here - if you're on a meeting URL and see ANY meeting controls,
        // we'll consider you "in the meeting" even if the "ready" dialog is showing

        // Check for bottom control bar (always present)
        const hasControlBar = document.querySelector('[data-meeting-controls]') !== null ||
            document.querySelector('[role="toolbar"]') !== null ||
            document.querySelector('.VfPpkd-Bz112c-LgbsSe') !== null; // Material button

        // Check for specific controls
        const hasMicButton = document.querySelector('[aria-label*="microphone"]') !== null ||
            document.querySelector('[aria-label*="Microphone"]') !== null ||
            document.querySelector('[data-is-muted]') !== null;

        const hasCameraButton = document.querySelector('[aria-label*="camera"]') !== null ||
            document.querySelector('[aria-label*="Camera"]') !== null;

        const hasEndCallButton = document.querySelector('[aria-label*="Leave call"]') !== null ||
            document.querySelector('[aria-label*="leave"]') !== null ||
            document.querySelector('[aria-label*="end"]') !== null;

        // Check for meeting container
        const hasMeetingContainer = document.querySelector('.KUfYIc') !== null ||
            document.querySelector('[data-meeting-title]') !== null;

        // If we have ANY of these indicators, we're in a meeting
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

            console.log('✅ Meeting detected:', { meetingId, meetingTitle });

            // Notify background script
            chrome.runtime.sendMessage({
                type: 'MEETING_DETECTED',
                data: {
                    meetingId: meetingId,
                    meetingTitle: meetingTitle,
                    url: url
                }
            }).catch(err => console.log('Background not ready:', err));

            // Start analytics tracking
            startAnalyticsTracking();

            // Inject recording indicator
            injectRecordingIndicator();
        } else {
            console.log('❌ In Google Meet lobby, waiting to join...');
            meetingState.isInMeeting = false;
            meetingState.meetingId = meetingId;
            meetingState.meetingTitle = null;

            // Set up a retry mechanism to check again in 2 seconds
            setTimeout(() => {
                if (!meetingState.isInMeeting) {
                    console.log('🔄 Retrying meeting detection...');
                    detectMeeting();
                }
            }, 2000);
        }
    }
}

// Extract meeting title from page
function extractMeetingTitle() {
    // Try multiple selectors
    const titleSelectors = [
        '[data-meeting-title]',
        '.u6vdEc',
        'div[jsname="r4nke"]'
    ];

    for (const selector of titleSelectors) {
        const element = document.querySelector(selector);
        if (element && element.textContent.trim()) {
            return element.textContent.trim();
        }
    }

    return 'Untitled Meeting';
}

// Set up observer to detect when meeting starts/ends
function setupMeetingObserver() {
    const observer = new MutationObserver((mutations) => {
        // Check if we're still in a meeting
        const inMeeting = document.querySelector('[data-meeting-title]') !== null ||
            document.querySelector('.KUfYIc') !== null;

        if (!inMeeting && meetingState.isInMeeting) {
            // Meeting ended
            handleMeetingEnd();
        } else if (inMeeting && !meetingState.isInMeeting) {
            // Meeting started
            detectMeeting();
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}

// Set up observer to track participants
function setupParticipantObserver() {
    const observer = new MutationObserver((mutations) => {
        if (meetingState.isInMeeting) {
            updateParticipantList();
        }
    });

    // Observe the participants panel
    const observeTarget = document.body;
    observer.observe(observeTarget, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['data-participant-id', 'data-requested-participant-id']
    });
}

// Update participant list
function updateParticipantList() {
    // Find participant elements
    const participantElements = document.querySelectorAll('[data-participant-id], [jsname="V3kXXb"]');

    participantElements.forEach(element => {
        const participantId = element.getAttribute('data-participant-id') ||
            element.getAttribute('data-requested-participant-id') ||
            generateParticipantId(element);

        const participantName = extractParticipantName(element);

        if (participantId && participantName) {
            if (!meetingState.participants.has(participantId)) {
                // New participant joined
                const participant = {
                    id: participantId,
                    name: participantName,
                    joinTime: Date.now(),
                    leaveTime: null,
                    cameraOn: isParticipantCameraOn(element),
                    audioMuted: isParticipantMuted(element),
                    speakingEvents: [],
                    cameraOnDuration: 0,
                    lastCameraCheck: Date.now()
                };

                meetingState.participants.set(participantId, participant);
                console.log('Participant joined:', participantName);
            } else {
                // Update existing participant
                const participant = meetingState.participants.get(participantId);
                const cameraOn = isParticipantCameraOn(element);
                const audioMuted = isParticipantMuted(element);

                // Track camera duration
                if (participant.cameraOn && cameraOn) {
                    const duration = Date.now() - participant.lastCameraCheck;
                    participant.cameraOnDuration += duration;
                }

                participant.cameraOn = cameraOn;
                participant.audioMuted = audioMuted;
                participant.lastCameraCheck = Date.now();
            }
        }
    });
}

// Extract participant name from element
function extractParticipantName(element) {
    const nameSelectors = [
        '.zWGUib',
        '[data-self-name]',
        'div[jsname="YheHge"]'
    ];

    for (const selector of nameSelectors) {
        const nameElement = element.querySelector(selector);
        if (nameElement && nameElement.textContent.trim()) {
            return nameElement.textContent.trim().replace(' (You)', '');
        }
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
    // Look for video element or camera indicator
    const hasVideo = element.querySelector('video') !== null;
    const cameraOffIcon = element.querySelector('[data-icon="camera_off"]');
    return hasVideo && !cameraOffIcon;
}

// Check if participant is muted
function isParticipantMuted(element) {
    const mutedIcon = element.querySelector('[data-icon="mic_off"]');
    return mutedIcon !== null;
}

// Start analytics tracking
function startAnalyticsTracking() {
    if (meetingState.analyticsInterval) {
        clearInterval(meetingState.analyticsInterval);
    }

    // Upload analytics every 30 seconds
    meetingState.analyticsInterval = setInterval(() => {
        uploadAnalytics();
    }, 30000);
}

// Upload analytics data
async function uploadAnalytics() {
    const analyticsData = {
        meetingId: meetingState.meetingId,
        timestamp: Date.now(),
        participants: Array.from(meetingState.participants.values()).map(p => ({
            id: p.id,
            name: p.name,
            joinTime: p.joinTime,
            cameraOn: p.cameraOn,
            audioMuted: p.audioMuted,
            cameraOnDuration: p.cameraOnDuration,
            speakingEvents: p.speakingEvents
        }))
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

    // Stop analytics tracking
    if (meetingState.analyticsInterval) {
        clearInterval(meetingState.analyticsInterval);
        meetingState.analyticsInterval = null;
    }

    // Upload final analytics
    uploadAnalytics();

    // Notify background
    chrome.runtime.sendMessage({
        type: 'MEETING_ENDED',
        data: {
            meetingId: meetingState.meetingId,
            participants: Array.from(meetingState.participants.values())
        }
    });

    // Reset state
    meetingState.participants.clear();
}

// Inject recording indicator
function injectRecordingIndicator() {
    // Check if already injected
    if (document.getElementById('laneway-recording-indicator')) {
        return;
    }

    const indicator = document.createElement('div');
    indicator.id = 'laneway-recording-indicator';
    indicator.className = 'laneway-indicator';
    indicator.style.display = 'none'; // Hidden by default
    indicator.innerHTML = `
    <div class="laneway-indicator-content">
      <span class="laneway-recording-dot"></span>
      <span class="laneway-recording-text">Recording</span>
      <span class="laneway-recording-time" id="laneway-recording-time">00:00</span>
    </div>
  `;

    // Insert into Meet UI
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
            break;

        case 'RECORDING_STOPPED':
            handleRecordingStopped(message);
            break;

        case 'GET_MEETING_INFO':
            sendResponse({
                meetingId: meetingState.meetingId,
                meetingTitle: meetingState.meetingTitle,
                isInMeeting: meetingState.isInMeeting,
                participantCount: meetingState.participants.size
            });
            break;

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
    }
    return true; // Keep message channel open for async responses
});

// Handle recording started
async function handleRecordingStarted(message) {
    console.log('Recording started:', message);

    try {
        // Use getDisplayMedia to capture the tab/screen
        // Request both video and audio explicitly
        const constraints = {
            video: message.quality !== 'audio-only' ? {
                displaySurface: "browser",
                width: { ideal: 1920 },
                height: { ideal: 1080 }
            } : false,
            audio: {
                echoCancellation: false,  // Disable to get raw audio
                noiseSuppression: false,  // Disable to get raw audio
                autoGainControl: false,   // Disable to get raw audio
                sampleRate: 48000         // Higher sample rate for better quality
            }
        };

        console.log('Requesting display media with constraints:', constraints);

        // Use getDisplayMedia
        const displayStream = await navigator.mediaDevices.getDisplayMedia(constraints);
        console.log('✅ Got display stream:', displayStream);
        console.log('   Audio tracks:', displayStream.getAudioTracks().length);
        console.log('   Video tracks:', displayStream.getVideoTracks().length);

        // Check if audio is present
        const hasAudio = displayStream.getAudioTracks().length > 0;
        const hasVideo = displayStream.getVideoTracks().length > 0;

        if (!hasAudio) {
            console.warn('⚠️ No audio track detected from display!');
            console.log('🔊 Attempting to capture system audio...');

            try {
                // Try to get system audio via second getDisplayMedia call
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
                    console.log('✅ Got system audio stream!');

                    // Combine video from display and audio from system
                    const combinedStream = new MediaStream();
                    displayStream.getVideoTracks().forEach(track => combinedStream.addTrack(track));
                    audioStream.getAudioTracks().forEach(track => combinedStream.addTrack(track));

                    const recorder = new MeetingRecorder(combinedStream, message.recordingId, message.uploadUrl);
                    await recorder.startRecording();

                    meetingState.recorder = {
                        isRecording: true,
                        startTime: Date.now(),
                        recordingId: message.recordingId,
                        mediaRecorder: recorder,
                        streams: [displayStream, audioStream]
                    };

                    console.log('✅ Recording with system audio');

                    // Show recording indicator and skip to end
                    updateRecordingIndicator(true);
                    const recordingTimer = setInterval(() => {
                        if (meetingState.recorder && meetingState.recorder.isRecording) {
                            const duration = Math.floor((Date.now() - meetingState.recorder.startTime) / 1000);
                            updateRecordingIndicator(true, duration);
                        } else {
                            clearInterval(recordingTimer);
                        }
                    }, 1000);

                    return; // Exit early, recording started successfully
                }
            } catch (audioError) {
                console.warn('⚠️ System audio capture failed:', audioError.message);
            }

            console.log('🎤 Attempting to capture microphone audio as fallback...');

            try {
                // Try to get microphone audio as fallback
                const micStream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true
                    }
                });

                console.log('✅ Got microphone audio as fallback');

                // Combine video from display and audio from microphone
                const combinedStream = new MediaStream();

                // Add video tracks from display
                displayStream.getVideoTracks().forEach(track => {
                    combinedStream.addTrack(track);
                });

                // Add audio tracks from microphone
                micStream.getAudioTracks().forEach(track => {
                    combinedStream.addTrack(track);
                });

                // Use combined stream
                const recorder = new MeetingRecorder(combinedStream, message.recordingId, message.uploadUrl);
                await recorder.startRecording();

                // Store recorder state
                meetingState.recorder = {
                    isRecording: true,
                    startTime: Date.now(),
                    recordingId: message.recordingId,
                    mediaRecorder: recorder,
                    streams: [displayStream, micStream]  // Keep references to stop later
                };

                console.log('✅ Recording with microphone audio (tab audio not available)');

            } catch (micError) {
                console.error('❌ Failed to get microphone audio:', micError);

                const continueAnyway = confirm(
                    '⚠️ No audio available!\n\n' +
                    'Tab audio: Not shared\n' +
                    'Microphone: Permission denied\n\n' +
                    'Continue recording without audio?'
                );

                if (!continueAnyway) {
                    displayStream.getTracks().forEach(track => track.stop());
                    throw new Error('Recording cancelled - no audio');
                }

                // Record without audio
                const recorder = new MeetingRecorder(displayStream, message.recordingId, message.uploadUrl);
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
            console.log('✅ Audio track found:', displayStream.getAudioTracks()[0].label);
            console.log('   Audio settings:', displayStream.getAudioTracks()[0].getSettings());

            // Create and start the recorder with tab audio
            const recorder = new MeetingRecorder(displayStream, message.recordingId, message.uploadUrl);
            await recorder.startRecording();

            // Store recorder state
            meetingState.recorder = {
                isRecording: true,
                startTime: Date.now(),
                recordingId: message.recordingId,
                mediaRecorder: recorder,
                streams: [displayStream]
            };
        }

        if (!hasVideo && message.quality !== 'audio-only') {
            console.warn('⚠️ No video track detected!');
        }

        // Show recording indicator
        updateRecordingIndicator(true);

        // Update recording time every second
        const recordingTimer = setInterval(() => {
            if (meetingState.recorder && meetingState.recorder.isRecording) {
                const duration = Math.floor((Date.now() - meetingState.recorder.startTime) / 1000);
                updateRecordingIndicator(true, duration);
            } else {
                clearInterval(recordingTimer);
            }
        }, 1000);

    } catch (error) {
        console.error('❌ Failed to start recording:', error);

        // Show user-friendly error message
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

        // Notify background that recording failed
        chrome.runtime.sendMessage({
            type: 'RECORDING_FAILED',
            error: error.message
        });
    }
}

// Handle recording stopped
function handleRecordingStopped(message) {
    console.log('Recording stopped:', message);

    if (meetingState.recorder) {
        // Stop the actual MediaRecorder if it exists
        if (meetingState.recorder.mediaRecorder) {
            meetingState.recorder.mediaRecorder.stopRecording();
        }

        // Stop all streams (display and microphone if used)
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
    }

    updateRecordingIndicator(false);
}

// Meeting Recorder Class
class MeetingRecorder {
    constructor(stream, recordingId, uploadUrl) {
        this.stream = stream;
        this.recordingId = recordingId;
        this.uploadUrl = uploadUrl;
        this.mediaRecorder = null;
        this.recordedChunks = [];
        this.startTime = null;
        this.isRecording = false;
        this.chunkNumber = 0;
    }

    async startRecording() {
        try {
            const options = {
                mimeType: 'video/webm;codecs=vp9,opus',
                videoBitsPerSecond: 2500000
            };

            this.mediaRecorder = new MediaRecorder(this.stream, options);
            this.startTime = Date.now();
            this.isRecording = true;

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    this.recordedChunks.push(event.data);
                    console.log(`📹 Chunk ${this.recordedChunks.length}: ${event.data.size} bytes`);
                } else {
                    console.warn('⚠️ Empty chunk received');
                }
            };

            this.mediaRecorder.onstop = () => {
                console.log('🛑 MediaRecorder stopped, total chunks:', this.recordedChunks.length);
                this.uploadChunks();
            };

            this.mediaRecorder.onerror = (event) => {
                console.error('❌ MediaRecorder error:', event.error);
                alert('Recording error: ' + event.error);
            };

            // Request data every 5 minutes (or when stopped)
            this.mediaRecorder.start(5 * 60 * 1000);

            console.log('✅ MediaRecorder started successfully');
            console.log('   MIME type:', options.mimeType);
            console.log('   State:', this.mediaRecorder.state);

        } catch (error) {
            console.error('❌ Failed to start MediaRecorder:', error);
            throw error;
        }
    }

    stopRecording() {
        console.log('🛑 Stopping recording...');

        if (this.mediaRecorder && this.isRecording) {
            console.log('   Current state:', this.mediaRecorder.state);
            console.log('   Chunks collected so far:', this.recordedChunks.length);

            this.mediaRecorder.stop();
            this.stream.getTracks().forEach(track => {
                track.stop();
                console.log('   Stopped track:', track.kind);
            });
            this.isRecording = false;
            console.log('✅ MediaRecorder stopped');
        } else {
            console.warn('⚠️ No active recording to stop');
        }
    }

    async uploadChunks() {
        console.log('uploadChunks called, chunks:', this.recordedChunks.length);

        if (this.recordedChunks.length === 0) {
            console.warn('⚠️ No chunks to upload!');
            alert('No recording data captured. Try recording for at least 5 seconds.');
            return;
        }

        const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
        console.log('✅ Recording blob created:', blob.size, 'bytes');

        if (blob.size === 0) {
            console.error('❌ Blob is empty!');
            alert('Recording failed - no data captured');
            return;
        }

        // Download locally for now (development mode)
        try {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = `laneway-recording-${this.recordingId}-${Date.now()}.webm`;
            document.body.appendChild(a);

            console.log('📥 Triggering download:', a.download);
            a.click();

            // Show user notification
            alert(`Recording saved! Check your Downloads folder for:\n${a.download}`);

            // Clean up
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                console.log('✅ Download cleanup complete');
            }, 100);

            console.log('✅ Recording downloaded locally as:', a.download);
        } catch (downloadError) {
            console.error('❌ Download error:', downloadError);
            alert('Failed to download recording: ' + downloadError.message);
        }

        try {
            // Also try to upload to cloud storage if URL is provided
            if (this.uploadUrl && !this.uploadUrl.startsWith('local://')) {
                console.log('☁️ Uploading to cloud:', this.uploadUrl);
                const response = await fetch(this.uploadUrl, {
                    method: 'PUT',
                    body: blob,
                    headers: {
                        'Content-Type': 'video/webm'
                    }
                });

                if (response.ok) {
                    console.log('✅ Recording uploaded to cloud successfully');
                    this.recordedChunks = [];
                } else {
                    console.error('❌ Failed to upload recording:', response.statusText);
                }
            } else {
                console.log('ℹ️ Skipping cloud upload (local mode)');
            }

        } catch (error) {
            console.error('❌ Error uploading recording:', error);
        }
    }
}

// Absence Manager Class
class AbsenceManager {
    constructor() {
        this.absences = [];
        this.meetingId = this.extractMeetingId();
    }

    extractMeetingId() {
        const url = window.location.href;
        const match = url.match(/meet\.google\.com\/([a-z-]+)/);
        return match ? match[1] : null;
    }

    async fetchAbsences() {
        if (!this.meetingId) return;

        try {
            const authToken = await this.getAuthToken();

            const response = await fetch(
                `${API_BASE_URL}/api/absences/meeting/${this.meetingId}`,
                {
                    headers: {
                        'Authorization': `Bearer ${authToken}`
                    }
                }
            );

            if (!response.ok) {
                console.error('Failed to fetch absences:', response.statusText);
                return;
            }

            const data = await response.json();
            this.absences = data.absences || [];

            if (this.absences.length > 0) {
                this.displayAbsences();
                this.markAsShown();
            }
        } catch (error) {
            console.error('Failed to fetch absences:', error);
        }
    }

    async getAuthToken() {
        return new Promise((resolve) => {
            chrome.storage.sync.get(['laneway_auth_token'], (result) => {
                resolve(result.laneway_auth_token || '');
            });
        });
    }

    displayAbsences() {
        // Remove existing banner if any
        const existingBanner = document.getElementById('laneway-absence-banner');
        if (existingBanner) {
            existingBanner.remove();
        }

        const banner = this.createAbsenceBanner();

        // Insert at top of Google Meet interface
        const meetContainer = document.querySelector('.KUfYIc') || document.body;
        meetContainer.insertAdjacentElement('afterbegin', banner);
    }

    createAbsenceBanner() {
        const banner = document.createElement('div');
        banner.id = 'laneway-absence-banner';
        banner.className = 'laneway-absence-banner';

        const title = document.createElement('div');
        title.className = 'laneway-absence-title';
        title.innerHTML = `
      <span class="laneway-absence-icon">ℹ️</span>
      ${this.absences.length} team member${this.absences.length > 1 ? 's' : ''} 
      ${this.absences.length > 1 ? 'are' : 'is'} absent
    `;

        const absenceList = document.createElement('div');
        absenceList.className = 'laneway-absence-list';

        this.absences.forEach(absence => {
            const item = document.createElement('div');
            item.className = 'laneway-absence-item';

            const reasonIcon = this.getReasonIcon(absence.absence_type);

            item.innerHTML = `
        <div class="laneway-absence-content">
          <div class="laneway-absence-main">
            <strong>${absence.employee_name}</strong> 
            <span class="laneway-absence-dept">(${absence.department})</span>
            <div class="laneway-absence-reason">
              ${reasonIcon} ${absence.reason}
            </div>
            ${absence.expected_duration !== 'all_meeting' ?
                    `<div class="laneway-absence-duration">
                Duration: ${absence.expected_duration}
              </div>` : ''
                }
            ${absence.alternative_contact ?
                    `<div class="laneway-absence-contact">
                Contact: ${absence.alternative_contact}
              </div>` : ''
                }
          </div>
          <div class="laneway-absence-time">
            Informed ${this.formatTime(absence.informed_at)}
          </div>
        </div>
      `;

            absenceList.appendChild(item);
        });

        banner.appendChild(title);
        banner.appendChild(absenceList);

        // Add close button
        const closeBtn = document.createElement('button');
        closeBtn.className = 'laneway-absence-close';
        closeBtn.innerHTML = '✕';
        closeBtn.onclick = () => banner.remove();
        banner.appendChild(closeBtn);

        return banner;
    }

    getReasonIcon(absenceType) {
        const icons = {
            'sick': '🤒',
            'vacation': '🏖️',
            'conflict': '📅',
            'emergency': '🚨',
            'other': '📝'
        };
        return icons[absenceType] || '📝';
    }

    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diffHours = (now - date) / (1000 * 60 * 60);

        if (diffHours < 1) return 'just now';
        if (diffHours < 24) return `${Math.floor(diffHours)}h ago`;
        if (diffHours < 48) return 'yesterday';
        return date.toLocaleDateString();
    }

    async markAsShown() {
        try {
            const authToken = await this.getAuthToken();

            await fetch(`${API_BASE_URL}/api/absences/mark-shown`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    meeting_id: this.meetingId,
                    absence_ids: this.absences.map(a => a.id)
                })
            });
        } catch (error) {
            console.error('Failed to mark absences as shown:', error);
        }
    }
}

console.log('Laneway content script initialized');
