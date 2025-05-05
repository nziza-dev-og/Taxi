
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
    apiKey: "AIzaSyDh4DEMftlxrU708lu0GDzQqw8iB4SINLw", // IMPORTANT: Use environment variables for sensitive keys in production!
    authDomain: "taxi-4cd78.firebaseapp.com",
    projectId: "taxi-4cd78",
    storageBucket: "taxi-4cd78.appspot.com", // Corrected storage bucket format
    messagingSenderId: "190447657622",
    appId: "1:190447657622:web:ea6f542b74aafae05c58b7",
    measurementId: "G-48G6DLSZJV"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage };
