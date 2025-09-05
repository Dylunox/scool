// إشعار محلي مجدول على نفس الجهاز من الصفحة الرئيسية
// يعتمد على Service Worker لعرض إشعار احترافي

function formatError(msg) {
  alert(msg);
}

async function scheduleNotificationAt(dtString, title, body) {
  try {
    if (!dtString) return formatError('اختر وقت وتاريخ');
    const when = new Date(dtString);
    if (Number.isNaN(when.getTime())) return formatError('وقت/تاريخ غير صالح');
    const ms = when.getTime() - Date.now();
    if (ms < 0) return formatError('الوقت المحدد في الماضي');

    // طلب الإذن إن لزم
    if (Notification.permission !== 'granted') {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') return formatError('تم رفض الإذن بالإشعارات');
    }

    // جدولة عبر setTimeout (تعمل طالما الصفحة/الخدمة نشطة)
    setTimeout(async () => {
      try {
        // تأكد أن Service Worker مسجل
        if (navigator.serviceWorker) {
          const reg = await navigator.serviceWorker.getRegistration();
          if (reg) {
            await reg.showNotification(title || 'تذكير', {
              body: body || 'لا تنسَ مهمتك.',
              icon: '/assets/icons/notification.png',
              badge: '/assets/icons/icon-192.png',
              lang: 'ar',
              dir: 'rtl',
              vibrate: [80, 40, 80],
              requireInteraction: false,
              actions: [
                { action: 'open', title: 'فتح الموقع' },
                { action: 'done', title: 'تم' }
              ],
              data: { createdAt: Date.now() }
            });
          } else {
            // fallback بسيط
            new Notification(title || 'تذكير', { body: body || 'لا تنسَ مهمتك.' });
          }
        } else {
          new Notification(title || 'تذكير', { body: body || 'لا تنسَ مهمتك.' });
        }
      } catch (e) {
        console.warn('فشل إظهار الإشعار:', e);
      }
    }, ms);
  } catch (e) {
    console.warn(e);
    formatError('تعذر جدولة الإشعار');
  }
}

// ربط أزرار المودال
const scheduleBtn = document.getElementById('scheduleNotifyBtn');
if (scheduleBtn) {
  scheduleBtn.addEventListener('click', async () => {
    const when = document.getElementById('notifyWhen')?.value;
    const title = (document.getElementById('notifyTitle')?.value || 'تذكير مهم').trim();
    const body = (document.getElementById('notifyBody')?.value || 'لا تنسَ مهمة المراجعة.').trim();
    await scheduleNotificationAt(when, title, body);
    // أغلق المودال وأكد للمستخدم
    const modalEl = document.getElementById('notifyTestModal');
    if (modalEl) {
      const inst = bootstrap?.Modal?.getOrCreateInstance?.(modalEl);
      inst?.hide();
    }
    alert('تمت جدولة الإشعار بنجاح');
  });
}