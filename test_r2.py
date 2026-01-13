"""
Quick test script to check R2 bucket contents
"""

from backend.storage.r2_storage import R2Storage

# Initialize R2
storage = R2Storage()

# List recordings
recordings = storage.list_recordings()

# Display results
print("\n" + "="*50)
print("R2 BUCKET TEST")
print("="*50)
print(f"\nBucket: {storage.bucket_name}")
print(f"Total recordings: {len(recordings)}")

if recordings:
    print("\nRecordings found:")
    for i, rec in enumerate(recordings, 1):
        size_mb = rec['size'] / (1024 * 1024)
        print(f"\n{i}. {rec['name']}")
        print(f"   Size: {size_mb:.2f} MB")
        print(f"   Modified: {rec['last_modified']}")
else:
    print("\nNo recordings found yet.")
    print("Make a test recording to see it appear here!")

print("\n" + "="*50 + "\n")
