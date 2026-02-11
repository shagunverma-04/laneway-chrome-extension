// Options page JavaScript

document.addEventListener('DOMContentLoaded', loadSettings);
document.getElementById('save-btn').addEventListener('click', saveSettings);

// Load saved settings
async function loadSettings() {
    try {
        const result = await chrome.storage.sync.get(['laneway_backend_url', 'laneway_default_quality']);

        document.getElementById('backend-url').value = result.laneway_backend_url || 'http://localhost:5000';
        document.getElementById('default-quality').value = result.laneway_default_quality || 'audio-only';

        console.log('Settings loaded:', result);
    } catch (error) {
        console.error('Error loading settings:', error);
        showStatus('Failed to load settings', 'error');
    }
}

// Save settings
async function saveSettings() {
    try {
        const backendUrl = document.getElementById('backend-url').value.trim();
        const defaultQuality = document.getElementById('default-quality').value;

        // Validate URL if provided
        if (backendUrl) {
            try {
                new URL(backendUrl);
            } catch (e) {
                showStatus('Invalid URL format. Please enter a valid URL or leave empty.', 'error');
                return;
            }
        }

        await chrome.storage.sync.set({
            laneway_backend_url: backendUrl,
            laneway_default_quality: defaultQuality
        });

        console.log('Settings saved:', { backendUrl, defaultQuality });
        showStatus('✓ Settings saved successfully!', 'success');

        // Hide status after 3 seconds
        setTimeout(() => {
            document.getElementById('status').style.display = 'none';
        }, 3000);

    } catch (error) {
        console.error('Error saving settings:', error);
        showStatus('Failed to save settings', 'error');
    }
}

// Show status message
function showStatus(message, type) {
    const statusEl = document.getElementById('status');
    statusEl.textContent = message;
    statusEl.className = `status ${type}`;
    statusEl.style.display = 'block';
}
