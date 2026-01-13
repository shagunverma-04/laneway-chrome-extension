"""
Cloudflare R2 Cleanup Script
Automatically deletes recordings older than 2 weeks to stay within 10 GB free tier
Run this daily via cron job
"""

import os
from datetime import datetime, timedelta
from pathlib import Path
from dotenv import load_dotenv
import sys

# Add backend to path
sys.path.append(str(Path(__file__).parent / 'backend'))

from storage.r2_storage import R2Storage

load_dotenv()

# Configuration
RETENTION_DAYS = 14  # Keep recordings for 2 weeks
DRY_RUN = False  # Set to True to see what would be deleted without actually deleting

def cleanup_old_recordings():
    """Delete recordings older than RETENTION_DAYS"""
    
    print("\n" + "="*60)
    print("🧹 Laneway R2 Cleanup Script")
    print("="*60)
    print(f"📅 {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"⏰ Retention period: {RETENTION_DAYS} days")
    print(f"🔍 Mode: {'DRY RUN (no deletions)' if DRY_RUN else 'LIVE (will delete)'}")
    print("="*60 + "\n")
    
    # Initialize R2 storage
    try:
        storage = R2Storage()
        print("✅ Connected to R2 storage\n")
    except Exception as e:
        print(f"❌ Failed to connect to R2: {e}")
        return
    
    # Get all recordings
    print("📊 Fetching recordings from R2...")
    recordings = storage.list_recordings()
    
    if not recordings:
        print("ℹ️  No recordings found in bucket")
        return
    
    print(f"✅ Found {len(recordings)} total recordings\n")
    
    # Calculate cutoff date
    cutoff_date = datetime.now() - timedelta(days=RETENTION_DAYS)
    print(f"🗓️  Cutoff date: {cutoff_date.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"   (Recordings before this will be deleted)\n")
    
    # Find old recordings
    old_recordings = []
    total_size = 0
    old_size = 0
    
    for recording in recordings:
        # Parse last modified date
        last_modified = datetime.fromisoformat(recording['last_modified'].replace('Z', '+00:00'))
        
        # Convert to naive datetime for comparison
        last_modified = last_modified.replace(tzinfo=None)
        
        total_size += recording['size']
        
        if last_modified < cutoff_date:
            old_recordings.append(recording)
            old_size += recording['size']
    
    # Display summary
    print("="*60)
    print("📈 SUMMARY")
    print("="*60)
    print(f"Total recordings: {len(recordings)}")
    print(f"Total size: {format_bytes(total_size)}")
    print(f"\nOld recordings (>{RETENTION_DAYS} days): {len(old_recordings)}")
    print(f"Size to be freed: {format_bytes(old_size)}")
    print(f"Remaining after cleanup: {format_bytes(total_size - old_size)}")
    print("="*60 + "\n")
    
    if not old_recordings:
        print("✅ No old recordings to delete!")
        return
    
    # Show recordings to be deleted
    print("🗑️  RECORDINGS TO BE DELETED:")
    print("-" * 60)
    for i, rec in enumerate(old_recordings, 1):
        last_modified = datetime.fromisoformat(rec['last_modified'].replace('Z', '+00:00'))
        age_days = (datetime.now() - last_modified.replace(tzinfo=None)).days
        
        print(f"{i}. {rec['name']}")
        print(f"   Size: {format_bytes(rec['size'])}")
        print(f"   Age: {age_days} days old")
        print(f"   Modified: {last_modified.strftime('%Y-%m-%d %H:%M:%S')}")
        print()
    
    # Delete recordings
    if DRY_RUN:
        print("🔍 DRY RUN MODE - No files were deleted")
        print("   Set DRY_RUN = False to actually delete files")
    else:
        print("🗑️  Deleting old recordings...")
        deleted_count = 0
        failed_count = 0
        
        for rec in old_recordings:
            try:
                storage.delete_recording(rec['key'])
                deleted_count += 1
                print(f"   ✅ Deleted: {rec['name']}")
            except Exception as e:
                failed_count += 1
                print(f"   ❌ Failed to delete {rec['name']}: {e}")
        
        print(f"\n{'='*60}")
        print(f"✅ Cleanup complete!")
        print(f"   Deleted: {deleted_count} recordings")
        print(f"   Failed: {failed_count} recordings")
        print(f"   Freed: {format_bytes(old_size)}")
        print(f"{'='*60}\n")

def format_bytes(bytes):
    """Format bytes to human readable format"""
    for unit in ['B', 'KB', 'MB', 'GB']:
        if bytes < 1024.0:
            return f"{bytes:.2f} {unit}"
        bytes /= 1024.0
    return f"{bytes:.2f} TB"

if __name__ == "__main__":
    cleanup_old_recordings()
