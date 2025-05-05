
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
// Import Functions if needed later: import { getFunctions } from "firebase/functions";

// Ensure environment variables are set up in a real project
// Example using process.env (requires configuration, e.g., with .env.local and next.config.js)
const firebaseConfig = {
  apiKey: "AIzaSyDh4DEMftlxrU708lu0GDzQqw8iB4SINLw",
  authDomain: "taxi-4cd78.firebaseapp.com",
  projectId: "taxi-4cd78",
  storageBucket: "taxi-4cd78.firebasestorage.app",
  messagingSenderId: "190447657622",
  appId: "1:190447657622:web:ea6f542b74aafae05c58b7",
  measurementId: "G-48G6DLSZJV"
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
