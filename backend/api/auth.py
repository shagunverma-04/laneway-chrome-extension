"""
Firebase Authentication API endpoints
Replaces the JWT-based authentication with Firebase
"""

from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
import firebase_admin
from firebase_admin import credentials, auth
import os

router = APIRouter()

# Initialize Firebase Admin SDK
# You'll need to download your Firebase service account key
# and place it in backend/firebase-credentials.json
firebase_cred_path = os.path.join(os.path.dirname(__file__), '..', 'firebase-credentials.json')

if os.path.exists(firebase_cred_path):
    try:
        cred = credentials.Certificate(firebase_cred_path)
        firebase_admin.initialize_app(cred)
        print("✅ Firebase Admin SDK initialized")
    except Exception as e:
        print(f"⚠️  Firebase initialization failed: {e}")
        print("   Using fallback authentication")
else:
    print("⚠️  Firebase credentials not found at:", firebase_cred_path)
    print("   Using fallback demo authentication")

class LoginRequest(BaseModel):
    email: str
    password: str

class FirebaseTokenRequest(BaseModel):
    idToken: str  # Firebase ID token from client

class LoginResponse(BaseModel):
    token: str
    userId: str
    email: str

@router.post("/api/auth/login", response_model=LoginResponse)
async def login(request: LoginRequest):
    """
    Demo login endpoint - for development only
    In production, use Firebase Authentication on the client side
    """
    # Demo credentials for testing
    if request.email == "demo@laneway.com" and request.password == "demo123":
        return LoginResponse(
            token="demo-token-12345",  # In production, this would be a Firebase token
            userId="demo-user-123",
            email=request.email
        )
    else:
        raise HTTPException(status_code=401, detail="Invalid credentials")

@router.post("/api/auth/verify-token")
async def verify_firebase_token(request: FirebaseTokenRequest):
    """
    Verify Firebase ID token from Chrome extension
    This is the recommended approach for production
    """
    try:
        # Verify the Firebase ID token
        decoded_token = auth.verify_id_token(request.idToken)
        user_id = decoded_token['uid']
        email = decoded_token.get('email', '')
        
        return {
            "userId": user_id,
            "email": email,
            "verified": True
        }
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")

def verify_token(authorization: str):
    """
    Verify token - works with both demo tokens and Firebase tokens
    """
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    token = authorization.split(' ')[1]
    
    # For demo mode
    if token == "demo-token-12345":
        return {
            "sub": "demo-user-123",
            "email": "demo@laneway.com"
        }
    
    # For Firebase tokens
    try:
        decoded_token = auth.verify_id_token(token)
        return {
            "sub": decoded_token['uid'],
            "email": decoded_token.get('email', '')
        }
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid token")
