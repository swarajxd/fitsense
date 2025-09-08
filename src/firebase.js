// src/firebase.js
// Replace the firebaseConfig values with your project's config (you already have them).
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyBRmAXUxJNuxNgPwfcGe02BKKdZung_ork",
  authDomain: "fitsense-72c2b.firebaseapp.com",
  projectId: "fitsense-72c2b",
  storageBucket: "fitsense-72c2b.appspot.com", // usually ends with .appspot.com — adjust if your console shows different
  messagingSenderId: "120430559154",
  appId: "1:120430559154:web:93e561b935ab0a7fddeeab",
  measurementId: "G-GNZMZGQ468"
};

// initialize app
const app = initializeApp(firebaseConfig);

// optional analytics (won't break if not used)
try { getAnalytics(app); } catch (e) { /* ignore in dev */ }

// export named instances used in app
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;
