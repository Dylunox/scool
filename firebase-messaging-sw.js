/*
  FCM Service Worker (v12.2.1)
  - يجب أن يكون في جذر النطاق
  - تم ضبط إعدادات Firebase لمشروعك
*/
importScripts('https://www.gstatic.com/firebasejs/12.2.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.2.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyCkfdSNkWjzVy77FZoUpg6JvTgNt29Pbac",
  authDomain: "scool-49436.firebaseapp.com",
  projectId: "scool-49436",
  messagingSenderId: "64670832141",
  appId: "1 :64670832141:web:ac1141ad3fc627c11ba744"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(({ notification }) => {
  if (!notification) return;
  self.registration.showNotification(notification.title || 'تنبيه', {
    body: notification.body || '',
    icon: '/assets/icons/notification.png',
    dir: 'rtl',
    lang: 'ar'
  });
});