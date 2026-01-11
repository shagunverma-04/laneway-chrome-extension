// Configuration for API endpoints and cloud storage
const CONFIG = {
  // Backend API Configuration
  API_BASE_URL: 'http://localhost:5000', // Change to your deployed backend URL
  
  // Cloud Storage Configuration
  STORAGE_PROVIDER: 'S3', // 'S3' or 'GCS'
  
  // Recording Settings
  RECORDING: {
    DEFAULT_QUALITY: 'audio-only', // 'audio-only', '720p', '1080p'
    CHUNK_DURATION: 5 * 60 * 1000, // 5 minutes in milliseconds
    AUTO_START: false,
    TRACK_PARTICIPANTS: true
  },
  
  // Analytics Settings
  ANALYTICS: {
    UPLOAD_INTERVAL: 30 * 1000, // 30 seconds
    TRACK_CAMERA: true,
    TRACK_AUDIO: true,
    TRACK_SPEAKING: true
  },
  
  // Storage Keys
  STORAGE_KEYS: {
    AUTH_TOKEN: 'laneway_auth_token',
    USER_ID: 'laneway_user_id',
    USER_EMAIL: 'laneway_user_email',
    SETTINGS: 'laneway_settings',
    MEETING_DATA: 'laneway_meeting_data'
  }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
}
