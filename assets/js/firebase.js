// Firebase initialization (v12.2.1) — تم ضبط الإعدادات بمشروعك
// ملاحظة: حدّث قيمة VAPID_KEY من إعدادات Firebase > Cloud Messaging > Web Push certificates
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js';
import { getMessaging, isSupported } from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-messaging.js';
import { getDatabase } from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js';
import { getAnalytics } from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-analytics.js';

export const firebaseConfig = {
  apiKey: "AIzaSyCkfdSNkWjzVy77FZoUpg6JvTgNt29Pbac",
  authDomain: "scool-49436.firebaseapp.com",
  databaseURL: "https://scool-49436-default-rtdb.firebaseio.com",
  projectId: "scool-49436",
  storageBucket: "scool-49436.firebasestorage.app",
  messagingSenderId: "64670832141",
  appId: "1:64670832141:web:ac1141ad3fc627c11ba744",
  measurementId: "G-K6EPZHKMEH"
};

// ضع المفتاح العمومي (VAPID)
export const VAPID_KEY = 'REPLACE_WITH_YOUR_WEB_PUSH_CERTIFICATE_KEY';

export const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const analytics = (()=>{ try { return getAnalytics(app); } catch { return null; } })();

// Auth: anonymous sign-in to obtain a UID for DB rules
import { getAuth, signInAnonymously } from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js';
export const auth = getAuth(app);
export const userReady = (async () => {
  try {
    if (!auth.currentUser) await signInAnonymously(auth);
    return auth.currentUser;
  } catch (e) {
    console.warn('Auth failed:', e);
    return null;
  }
})();
export async function getUserId() {
  const u = await userReady;
  return u?.uid || 'local-user';
}

// Messaging
export let messaging = null;
(async () => {
  try {
    if (await isSupported()) {
      messaging = getMessaging(app);
      if (typeof navigator !== 'undefined' && navigator.serviceWorker) {
        navigator.serviceWorker.register('/firebase-messaging-sw.js');
        navigator.serviceWorker.register('/service-worker.js');
      }
    }
  } catch (e) {
    console.warn('Messaging not supported or failed:', e);
  }
})();