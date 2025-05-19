import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

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

// try {
//   if (!firebase.apps.length) {
//     firebase.initializeApp(firebaseConfig);
//   }
// } catch (error) {
//   console.error('Lỗi khởi tạo Firebase:', error);
// }

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export { db };