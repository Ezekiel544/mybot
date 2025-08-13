// firebase.js
import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyC4gsiyGOMWS3KMy9jNa792KsHfkKn2qIc",
  authDomain: "mybot-acca8.firebaseapp.com",
  projectId: "mybot-acca8",
  storageBucket: "mybot-acca8.firebasestorage.app",
  messagingSenderId: "139244095455",
  appId: "1:139244095455:web:2ceadef26bb12dcf39666a"
};

// Initialize Firebase only if it hasn't been initialized yet
if (!getApps().length) {
  initializeApp(firebaseConfig);
}

// Firestore instance
export const db = getFirestore();

// Default export for flexibility
export default db;
