// بسيط للتخزين المؤقت للأصول الثابتة
const CACHE = 'study-site-v5';
const ASSETS = [
  '/',
  '/index.html',
  '/schedule.html',
  '/homr.html',
  '/assets/css/styles.css',
  '/assets/css/pomodoro.css',
  '/assets/js/firebase.js',
  '/assets/js/db.js',
  '/assets/js/subjects.js',
  '/assets/js/form.js',
  '/assets/js/timezone.js',
  '/assets/js/copy.js',
  '/assets/js/schedule.js',
  '/assets/js/achievements.js',
  '/assets/js/notifications.js',
  '/assets/js/notify-local.js',
  '/assets/js/pomodoro.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    Promise.all([
      // تنظيف Cache القديم
      caches.keys().then(keys => 
        Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
      ),
      // تنظيف الإشعارات القديمة (أكثر من ساعة)
      self.registration.getNotifications().then(notifications => {
        const hour = 60 * 60 * 1000;
        notifications.forEach(notification => {
          if (notification.data && notification.data.timestamp) {
            if (Date.now() - notification.data.timestamp > hour) {
              notification.close();
            }
          }
        });
      })
    ])
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then(res => res || fetch(e.request))
  );
});

// إشعارات Pomodoro
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  
  if (e.action === 'open') {
    e.waitUntil(
      clients.openWindow('/schedule.html')
    );
  } else if (e.action === 'done') {
    // لا نحتاج لفعل شيء
  } else {
    // النقر على الإشعار نفسه
    e.waitUntil(
      clients.openWindow('/schedule.html')
    );
  }
});

// رسائل من الصفحة الرئيسية
self.addEventListener('message', (e) => {
  if (e.data.type === 'POMODORO_NOTIFICATION') {
    const { title, body, icon, badge } = e.data;
    
    self.registration.showNotification(title, {
      body,
      icon: icon || '/assets/icons/icon-192.png',
      badge: badge || '/assets/icons/notification.png',
      lang: 'ar',
      dir: 'rtl',
      vibrate: [200, 100, 200],
      requireInteraction: true,
      actions: [
        { action: 'open', title: 'فتح التطبيق' },
        { action: 'done', title: 'تم' }
      ],
      data: { type: 'pomodoro', timestamp: Date.now() }
    });
  }
});