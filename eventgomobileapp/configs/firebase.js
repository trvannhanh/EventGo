import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';
// Import React Native Firebase for native initialization
import '@react-native-firebase/app';
// Bỏ import messaging vì gây lỗi trên Android Expo Dev Client
// import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { Platform } from 'react-native';

const firebaseConfig = {
  apiKey: "AIzaSyC4KemmGTSgAAJGeZi81vH4Qxws8NB4rK0",
  authDomain: "eventchat-faf4d.firebaseapp.com",
  projectId: "eventchat-faf4d",
  storageBucket: "eventchat-faf4d.firebasestorage.app",
  messagingSenderId: "578223076146",
  appId: "1:578223076146:web:bd88142a666bbbdcd79d2b",
  measurementId: "G-5PEV08B6LD",
  databaseURL: "https://eventchat-faf4d-default-rtdb.firebaseio.com/"
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

// Initialize React Native Firebase (native side) automatically when imported
console.log('📱 Firebase initialized successfully');

export { db, app };