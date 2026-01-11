# Firebase Authentication Setup Guide

## Option 1: Demo Mode (Current - No Setup Required)

The backend is currently running in **demo mode** with these credentials:
- **Email**: demo@laneway.com
- **Password**: demo123

This works without any Firebase setup and is perfect for testing!

## Option 2: Firebase Authentication (Production)

For production use with real authentication:

### 1. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or select existing one
3. Enable **Authentication** → **Email/Password** sign-in method

### 2. Get Service Account Key

1. In Firebase Console, go to **Project Settings** → **Service Accounts**
2. Click **Generate New Private Key**
3. Save the JSON file as `backend/firebase-credentials.json`

### 3. Get Firebase Config for Extension

1. In Firebase Console, go to **Project Settings** → **General**
2. Scroll to "Your apps" and click the web icon `</>`
3. Copy the Firebase configuration object

### 4. Update Chrome Extension

Add Firebase to your extension's `popup.html`:

```html
<!-- Add before closing </body> tag -->
<script src="https://www.gstatic.com/firebasejs/9.x.x/firebase-app.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.x.x/firebase-auth.js"></script>
```

Update `popup.js` to use Firebase:

```javascript
// Initialize Firebase
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  // ... other config
};

firebase.initializeApp(firebaseConfig);

// Login function
async function handleLogin() {
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  
  try {
    // Sign in with Firebase
    const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
    
    // Get ID token
    const idToken = await userCredential.user.getIdToken();
    
    // Store token
    await chrome.storage.sync.set({
      laneway_auth_token: idToken,
      laneway_user_email: userCredential.user.email,
      laneway_user_id: userCredential.user.uid
    });
    
    showMessage('login-status', 'Login successful!', 'success');
    setTimeout(() => window.location.reload(), 1000);
  } catch (error) {
    showMessage('login-status', error.message, 'error');
  }
}
```

### 5. Benefits of Firebase Auth

✅ **Secure** - Industry-standard authentication
✅ **Easy** - No password hashing needed
✅ **Features** - Email verification, password reset, OAuth providers
✅ **Scalable** - Handles millions of users
✅ **Free** - Generous free tier

## Current Setup

The backend currently supports **both** authentication methods:
- Demo mode (no Firebase needed)
- Firebase tokens (when you're ready)

You can switch to Firebase anytime without changing the backend!
