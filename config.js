// Configuration for API endpoints and cloud storage
const CONFIG = {
  // R2 Upload Worker — set this after deploying the Cloudflare Worker
  // e.g. 'https://laneway-r2-upload.<your-subdomain>.workers.dev'
  R2_WORKER_URL: 'https://laneway-r2-upload.laneway-r2-upload.workers.dev',

  // Shared secret that matches the Worker's API_KEY secret
  R2_API_KEY: 'Devlaneway@1234#',

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
