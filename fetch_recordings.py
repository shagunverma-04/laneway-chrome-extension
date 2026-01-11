"""
Laneway Recording Fetcher
Fetches recordings from Laneway backend and processes them
Run this daily via cron to process new recordings
"""

import requests
import os
from datetime import datetime, timedelta
from pathlib import Path
import json

# Configuration
LANEWAY_API = os.getenv('LANEWAY_API_URL', 'http://localhost:5000')
RECORDINGS_DIR = Path(__file__).parent / 'recordings'
PROCESSED_FILE = Path(__file__).parent / 'processed_recordings.json'

def load_processed_recordings():
    """Load list of already processed recording IDs"""
    if PROCESSED_FILE.exists():
        with open(PROCESSED_FILE, 'r') as f:
            return set(json.load(f))
    return set()

def save_processed_recording(recording_id):
    """Mark a recording as processed"""
    processed = load_processed_recordings()
    processed.add(recording_id)
    with open(PROCESSED_FILE, 'w') as f:
        json.dump(list(processed), f, indent=2)

def fetch_recordings():
    """Fetch all recordings from Laneway API"""
    try:
        response = requests.get(f"{LANEWAY_API}/api/recordings/list")
        response.raise_for_status()
        return response.json()['recordings']
    except Exception as e:
        print(f"❌ Error fetching recordings: {e}")
        return []

def download_recording(download_url, recording_key):
    """Download a recording from R2"""
    try:
        # Extract recording ID from key
        recording_id = recording_key.split('/')[-1].replace('.webm', '')
        
        # Create recordings directory
        RECORDINGS_DIR.mkdir(exist_ok=True)
        
        # Download file
        print(f"📥 Downloading: {recording_id}")
        response = requests.get(download_url, stream=True)
        response.raise_for_status()
        
        # Save to disk
        filename = RECORDINGS_DIR / f"{recording_id}.webm"
        with open(filename, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        
        print(f"✅ Downloaded: {filename} ({os.path.getsize(filename)} bytes)")
        return str(filename)
        
    except Exception as e:
        print(f"❌ Error downloading {recording_key}: {e}")
        return None

def process_recording(filename):
    """
    Process a recording (transcribe, extract tasks, etc.)
    This is where you integrate with your AI agent
    """
    print(f"\n🤖 Processing: {filename}")
    
    # TODO: Integrate with your transcription agent
    # Example:
    # from your_ai_agent import transcribe, extract_tasks
    # transcript = transcribe(filename)
    # tasks = extract_tasks(transcript)
    # sync_to_notion(tasks)
    
    # For now, just print
    print(f"   ⏳ Transcription would happen here...")
    print(f"   ⏳ Task extraction would happen here...")
    print(f"   ⏳ Notion sync would happen here...")
    
    return True

def main():
    """Main function to fetch and process recordings"""
    print("\n" + "="*60)
    print("🎯 Laneway Recording Processor")
    print("="*60)
    print(f"📅 {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
    
    # Load already processed recordings
    processed = load_processed_recordings()
    print(f"📊 Already processed: {len(processed)} recordings")
    
    # Fetch all recordings
    print(f"\n🔍 Fetching recordings from {LANEWAY_API}...")
    recordings = fetch_recordings()
    
    if not recordings:
        print("⚠️  No recordings found")
        return
    
    print(f"📊 Found {len(recordings)} total recordings")
    
    # Filter out already processed
    new_recordings = [
        r for r in recordings 
        if r['key'] not in processed
    ]
    
    print(f"🆕 New recordings to process: {len(new_recordings)}")
    
    if not new_recordings:
        print("✅ All recordings already processed!")
        return
    
    # Process each new recording
    for i, recording in enumerate(new_recordings, 1):
        print(f"\n{'='*60}")
        print(f"Processing {i}/{len(new_recordings)}")
        print(f"{'='*60}")
        
        # Download
        filename = download_recording(
            recording['download_url'],
            recording['key']
        )
        
        if not filename:
            continue
        
        # Process
        success = process_recording(filename)
        
        if success:
            # Mark as processed
            save_processed_recording(recording['key'])
            print(f"✅ Completed: {recording['key']}")
        else:
            print(f"❌ Failed: {recording['key']}")
    
    print(f"\n{'='*60}")
    print(f"✅ Processing complete!")
    print(f"{'='*60}\n")

if __name__ == "__main__":
    main()
