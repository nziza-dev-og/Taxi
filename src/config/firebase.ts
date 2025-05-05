
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
// Import Functions if needed later: import { getFunctions } from "firebase/functions";

// Ensure environment variables are set up in a real project
// Example using process.env (requires configuration, e.g., with .env.local and next.config.js)
const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "YOUR_API_KEY", // Replace with your actual key or env variable
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "YOUR_AUTH_DOMAIN",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "YOUR_PROJECT_ID",
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "YOUR_STORAGE_BUCKET",
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "YOUR_MESSAGING_SENDER_ID",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "YOUR_APP_ID",
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "YOUR_MEASUREMENT_ID" // Optional
};

// Basic validation
if (firebaseConfig.apiKey === "YOUR_API_KEY") {
    console.warn("Firebase API Key is not configured. Please set NEXT_PUBLIC_FIREBASE_API_KEY environment variable.");
}
if (firebaseConfig.projectId === "YOUR_PROJECT_ID") {
     console.warn("Firebase Project ID is not configured. Please set NEXT_PUBLIC_FIREBASE_PROJECT_ID environment variable.");
}


// Initialize Firebase
let app;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
// const functions = getFunctions(app); // Initialize Functions if needed

export { app, auth, db, storage }; // Add 'functions' if initialized
