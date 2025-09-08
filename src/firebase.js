// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBRmAXUxJNuxNgPwfcGe02BKKdZung_ork",
  authDomain: "fitsense-72c2b.firebaseapp.com",
  projectId: "fitsense-72c2b",
  storageBucket: "fitsense-72c2b.firebasestorage.app",
  messagingSenderId: "120430559154",
  appId: "1:120430559154:web:93e561b935ab0a7fddeeab",
  measurementId: "G-GNZMZGQ468"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);