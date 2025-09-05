import { messaging, VAPID_KEY } from './firebase.js';
import { saveToken } from './db.js';

async function requestPermissionAndToken() {
  try {
    if (!messaging) return;
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return;
    const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    const { getToken } = await import('https://www.gstatic.com/firebasejs/12.2.1/firebase-messaging.js');
    const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: reg });
    if (token) await saveToken(token);
  } catch (e) { console.warn('Notification permission/token error:', e); }
}

// زر أو حدث تطوعي لاحقًا، يمكن استدعاؤه بعد حفظ الإعدادات
requestPermissionAndToken();

// Toast داخل الصفحة عند استقبال رسالة أثناء فتح الموقع
if (messaging) {
  (async () => {
    const { onMessage } = await import('https://www.gstatic.com/firebasejs/12.2.1/firebase-messaging.js');
    onMessage(messaging, ({ notification }) => {
      if (!notification) return;
      const div = document.createElement('div');
      div.className = 'toast align-items-center text-bg-primary border-0 position-fixed bottom-0 start-0 m-3 show';
      div.style.zIndex = 1080;
      div.innerHTML = `<div class="d-flex"><div class="toast-body">${notification.title || ''} — ${notification.body || ''}</div><button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button></div>`;
      document.body.appendChild(div);
      setTimeout(() => div.remove(), 5000);
    });
  })();
}