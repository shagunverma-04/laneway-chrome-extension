"""
Cloudflare R2 Storage Module
Handles upload/download of meeting recordings
"""

import boto3
from botocore.client import Config
import os
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv()

class R2Storage:
    """Cloudflare R2 storage client"""
    
    def __init__(self):
        """Initialize R2 client"""
        self.client = boto3.client(
            's3',
            endpoint_url=os.getenv('R2_ENDPOINT'),
            aws_access_key_id=os.getenv('R2_ACCESS_KEY_ID'),
            aws_secret_access_key=os.getenv('R2_SECRET_ACCESS_KEY'),
            config=Config(signature_version='s3v4'),
            region_name='auto'
        )
        self.bucket_name = os.getenv('R2_BUCKET_NAME', 'laneway-recordings')
    
    def generate_upload_url(self, recording_id, expires_in=3600):
        """
        Generate presigned URL for uploading a recording
        
        Args:
            recording_id: Unique recording identifier
            expires_in: URL expiration time in seconds (default 1 hour)
            
        Returns:
            tuple: (upload_url, storage_key)
        """
        key = f"recordings/{recording_id}.webm"
        
        try:
            url = self.client.generate_presigned_url(
                'put_object',
                Params={
                    'Bucket': self.bucket_name,
                    'Key': key,
                    'ContentType': 'video/webm'
                },
                ExpiresIn=expires_in
            )
            
            return url, key
        except Exception as e:
            print(f"Error generating upload URL: {e}")
            # Fallback to local storage
            return f"local://recordings/{recording_id}.webm", key
    
    def generate_download_url(self, key, expires_in=3600):
        """
        Generate presigned URL for downloading a recording
        
        Args:
            key: Storage key of the recording
            expires_in: URL expiration time in seconds
            
        Returns:
            str: Download URL
        """
        try:
            url = self.client.generate_presigned_url(
                'get_object',
                Params={
                    'Bucket': self.bucket_name,
                    'Key': key
                },
                ExpiresIn=expires_in
            )
            
            return url
        except Exception as e:
            print(f"Error generating download URL: {e}")
            return None
    
    def list_recordings(self, prefix='recordings/', max_keys=1000):
        """
        List all recordings in the bucket
        
        Args:
            prefix: Key prefix to filter recordings
            max_keys: Maximum number of recordings to return
            
        Returns:
            list: List of recording metadata
        """
        try:
            response = self.client.list_objects_v2(
                Bucket=self.bucket_name,
                Prefix=prefix,
                MaxKeys=max_keys
            )
            
            recordings = []
            for obj in response.get('Contents', []):
                recordings.append({
                    'key': obj['Key'],
                    'size': obj['Size'],
                    'last_modified': obj['LastModified'].isoformat(),
                    'download_url': self.generate_download_url(obj['Key'])
                })
            
            return recordings
        except Exception as e:
            print(f"Error listing recordings: {e}")
            return []
    
    def delete_recording(self, key):
        """
        Delete a recording from storage
        
        Args:
            key: Storage key of the recording
            
        Returns:
            bool: True if successful, False otherwise
        """
        try:
            self.client.delete_object(
                Bucket=self.bucket_name,
                Key=key
            )
            return True
        except Exception as e:
            print(f"Error deleting recording: {e}")
            return False
    
    def get_recording_metadata(self, key):
        """
        Get metadata for a recording
        
        Args:
            key: Storage key of the recording
            
        Returns:
            dict: Recording metadata
        """
        try:
            response = self.client.head_object(
                Bucket=self.bucket_name,
                Key=key
            )
            
            return {
                'size': response['ContentLength'],
                'last_modified': response['LastModified'].isoformat(),
                'content_type': response['ContentType']
            }
        except Exception as e:
            print(f"Error getting metadata: {e}")
            return None
