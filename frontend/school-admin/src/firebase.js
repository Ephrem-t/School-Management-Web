
// firebase.js
import { initializeApp, getApps, getApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage"; // <-- ADD THIS

const firebaseConfig = {
  apiKey: "AIzaSyCMkZr4Xz204NjvETje-Rhznf6ECDYiEnE",                      // e.g., "AIzaSyA..."
  authDomain: "ethiostore-17d9f.firebaseapp.com",   // your project auth domain
  databaseURL: "https://ethiostore-17d9f-default-rtdb.firebaseio.com", // Realtime DB URL
  projectId: "ethiostore-17d9f",               // your project ID
  storageBucket: "ethiostore-17d9f.appspot.com",
  messagingSenderId: "964518277159",
  appId: "1:964518277159:web:9404cace890edf88961e02"
};

// Only initialize if no apps exist
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Realtime Database
export const db = getDatabase(app);

// Firestore
export const firestore = getFirestore(app);

export const storage = getStorage(app);
export default app;

