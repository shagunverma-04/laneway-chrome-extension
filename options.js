// Options page JavaScript

document.addEventListener('DOMContentLoaded', loadSettings);
document.getElementById('save-btn').addEventListener('click', saveSettings);
document.getElementById('test-btn').addEventListener('click', testConnection);

// Load saved settings
async function loadSettings() {
    try {
        const result = await chrome.storage.sync.get([
            'laneway_api_key',
            'laneway_base_url',
            'laneway_default_quality'
        ]);

        document.getElementById('api-key').value = result.laneway_api_key || '';
        document.getElementById('backend-url').value = result.laneway_base_url || 'https://laneway-meeting-management.onrender.com';
        document.getElementById('default-quality').value = result.laneway_default_quality || 'audio-only';

        console.log('Settings loaded');
    } catch (error) {
        console.error('Error loading settings:', error);
        showStatus('Failed to load settings', 'error');
    }
}

// Save settings
async function saveSettings() {
    try {
        const apiKey = document.getElementById('api-key').value.trim();
        const baseUrl = document.getElementById('backend-url').value.trim();
        const defaultQuality = document.getElementById('default-quality').value;

        // Validate URL if provided
        if (baseUrl) {
            try {
                new URL(baseUrl);
            } catch (e) {
                showStatus('Invalid URL format. Please enter a valid URL.', 'error');
                return;
            }
        }

        await chrome.storage.sync.set({
            laneway_api_key: apiKey,
            laneway_base_url: baseUrl || 'https://laneway-meeting-management.onrender.com',
            laneway_default_quality: defaultQuality
        });

        console.log('Settings saved');
        showStatus('Settings saved successfully!', 'success');

        setTimeout(() => {
            document.getElementById('status').style.display = 'none';
        }, 3000);

    } catch (error) {
        console.error('Error saving settings:', error);
        showStatus('Failed to save settings', 'error');
    }
}

// Test connection to backend
async function testConnection() {
    const apiKey = document.getElementById('api-key').value.trim();
    const baseUrl = document.getElementById('backend-url').value.trim() || 'https://laneway-meeting-management.onrender.com';

    if (!apiKey) {
        showStatus('Please enter an API key first.', 'error');
        return;
    }

    showStatus('Testing connection...', 'info');

    try {
        const response = await fetch(`${baseUrl}/api/ext/meeting/lookup?meet_link=test`, {
            method: 'GET',
            headers: {
                'X-API-Key': apiKey
            }
        });

        if (response.status === 404) {
            // 404 = valid API key, no meeting found for "test" link (expected)
            showStatus('Connection successful! API key is valid.', 'success');
        } else if (response.status === 401 || response.status === 403) {
            showStatus('Invalid API key. Please check and try again.', 'error');
        } else if (response.ok) {
            // 200 = also fine, key is valid
            showStatus('Connection successful! API key is valid.', 'success');
        } else {
            showStatus(`Unexpected response: ${response.status}. Check your backend URL.`, 'error');
        }
    } catch (error) {
        console.error('Connection test failed:', error);
        showStatus('Could not reach backend. Check the URL and ensure the server is running.', 'error');
    }
}

// Show status message
function showStatus(message, type) {
    const statusEl = document.getElementById('status');
    statusEl.textContent = message;
    statusEl.className = `status ${type}`;
    statusEl.style.display = 'block';
}
