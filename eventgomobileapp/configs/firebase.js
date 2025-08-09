import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import '@react-native-firebase/app';
import Constants from 'expo-constants';

const {
  FIREBASE_API_KEY,
  FIREBASE_AUTH_DOMAIN,
  FIREBASE_PROJECT_ID,
  FIREBASE_STORAGE_BUCKET,
  FIREBASE_MESSAGING_SENDER_ID,
  FIREBASE_APP_ID,
  FIREBASE_MEASUREMENT_ID,
  FIREBASE_DATABASE_URL,
} = Constants.expoConfig?.extra || {};

const firebaseConfig = {
  apiKey: FIREBASE_API_KEY || "your-api-key",
  authDomain: FIREBASE_AUTH_DOMAIN || "your-project.firebaseapp.com",
  projectId: FIREBASE_PROJECT_ID || "your-project-id",
  storageBucket: FIREBASE_STORAGE_BUCKET || "your-project.firebasestorage.app",
  messagingSenderId: FIREBASE_MESSAGING_SENDER_ID || "123456789",
  appId: FIREBASE_APP_ID || "1:123456789:web:abcdef",
  measurementId: FIREBASE_MEASUREMENT_ID || "G-ABCDEF",
  databaseURL: FIREBASE_DATABASE_URL || "https://your-project.firebaseio.com/",
};

// Khởi tạo Firebase App nếu chưa được khởi tạo
let app;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp(); // Nếu đã khởi tạo thì lấy app hiện tại
}

// Khởi tạo Firebase services
const db = getDatabase(app);

console.log('📱 Firebase initialized successfully');

export { db, app };