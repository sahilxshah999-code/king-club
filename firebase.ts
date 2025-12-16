import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyBhVf-1TAUNy7w2oghN7hVWnZhphIyal7Y",
  authDomain: "raja-club.firebaseapp.com",
  databaseURL: "https://raja-club-default-rtdb.firebaseio.com",
  projectId: "raja-club",
  storageBucket: "raja-club.firebasestorage.app",
  messagingSenderId: "381449220338",
  appId: "1:381449220338:web:3d5e9f9313287b3d75606b",
  measurementId: "G-RLV1HSZXNQ"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);
export const googleProvider = new GoogleAuthProvider();
