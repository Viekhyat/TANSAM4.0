// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyA3Jb2Jsnmezqw_r9q4GD3HWG0eGeEc3eA",
  authDomain: "dashboard-383da.firebaseapp.com",
  projectId: "dashboard-383da",
  storageBucket: "dashboard-383da.firebasestorage.app",
  messagingSenderId: "1021214729741",
  appId: "1:1021214729741:web:7a67afd932cb217cf1d744",
  measurementId: "G-7TKZ5FMVEG"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);

// Initialize Analytics (optional)
const analytics = getAnalytics(app);

// Check if we should use demo mode based on Firebase configuration
// This will be updated based on whether auth is actually available
export let DEMO_MODE = false;

export default app;