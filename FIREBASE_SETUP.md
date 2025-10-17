# Firebase Setup Guide

## The Error You're Seeing
The `auth/configuration-not-found` error means that either:
1. The Firebase project doesn't exist
2. Email/Password authentication is not enabled in your Firebase project
3. The configuration credentials are incorrect

## How to Fix This

### Step 1: Create a Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project" or "Add project"
3. Enter a project name (e.g., "tansam-dashboard")
4. Follow the setup wizard

### Step 2: Enable Authentication
1. In your Firebase project, go to **Authentication** in the left sidebar
2. Click **Get started**
3. Go to the **Sign-in method** tab
4. Enable **Email/Password** authentication
5. Click **Save**

### Step 3: Get Your Configuration
1. Go to **Project Settings** (gear icon)
2. Scroll down to **Your apps** section
3. Click **Add app** > **Web app** (</>) icon
4. Register your app with a nickname
5. Copy the `firebaseConfig` object

### Step 4: Update Your Configuration
Replace the placeholder values in `src/firebase.js` with your actual Firebase config:

```javascript
const firebaseConfig = {
  apiKey: "your-actual-api-key",
  authDomain: "your-project-id.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project-id.firebasestorage.app",
  messagingSenderId: "your-messaging-sender-id",
  appId: "your-app-id"
};
```

### Step 5: Enable Firestore (Optional)
If you want to store user data:
1. Go to **Firestore Database** in the left sidebar
2. Click **Create database**
3. Choose **Start in test mode** (for development)
4. Select a location for your database

## Alternative: Use Demo Mode
If you want to test the app without setting up Firebase, you can use the demo authentication mode by setting `DEMO_MODE=true` in your environment.
