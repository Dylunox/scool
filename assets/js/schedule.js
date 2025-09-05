import { listScheduleTasks, setTaskCompleted, addScheduleTask, listLateTasks, removeLateTask, listSubjects, getDailyEntry, saveDailyEntry } from './db.js';
import { nowInOman, formatDateId } from './timezone.js';
import { copyText, tableToText } from './copy.js';
import { getAllDailyEntries } from './db.js';
import { PomodoroTimer } from './pomodoro.js';

const scheduleDate = document.getElementById('scheduleDate');
// سنجلب dailyPending/dailyCompleted داخل loadAndRender لضمان الإشارة لأحدث العناصر بعد أي استبدال
const pendingCount = document.getElementById('pendingCount');
const completedCount = document.getElementById('completedCount');
const copyScheduleBtn = document.getElementById('copyScheduleBtn');

function humanDate(d) {
  return d.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}
function dayName(d){
  return d.toLocaleDateString('ar-EG', { weekday: 'long' });
}

function renderItem(t, subjectNameMap, currentDateId) {
  const isCompleted = t.status === 'completed';
  const classes = ['card-task', 'p-2'];
  if (t.source === 'late') classes.push('late');
  if (isCompleted) classes.push('completed');
  
  // تحديد المهام المتأخرة - المهام التي أنشئت قبل اليوم الحالي ولم تكتمل
  const taskDate = t.originalDateId || currentDateId;
  const isLate = !isCompleted && taskDate < currentDateId;
  if (isLate) classes.push('late');
  
  const name = t.subjectName || subjectNameMap.get(t.subjectId) || t.subjectId || 'بدون اسم';
  const lateLabel = isLate ? '<span class="badge bg-danger ms-2">متأخر</span>' : '';
  
  return `
    <div class="${classes.join(' ')}" data-id="${t.id}">
      <div class="d-flex justify-content-between align-items-center">
        <div>
          <div class="title">${name} ${lateLabel}</div>
          <div class="small text-muted">صفحات: ${t.pages || 0}</div>
        </div>
        <div class="text-end">
          <div class="badge bg-light text-dark mb-1">${t.minutes || 0} د</div>
          <div class="d-flex gap-2 align-items-center">
            <label class="form-check small mb-0">
              <input type="checkbox" class="form-check-input complete" ${isCompleted ? 'checked' : ''}>
              <span class="ms-1">تم</span>
            </label>
            ${isCompleted ? '<button class="btn btn-sm btn-outline-danger ms-2 undo">إلغاء</button>' : 
              '<button class="btn btn-sm start-study-btn ms-2 start-pomodoro" title="بدء جلسة مراجعة">🍅 مراجعة</button>'}
          </div>
        </div>
      </div>
      ${t.note ? `<div class="mt-1 small text-muted">ملاحظة: ${t.note}</div>` : ''}
    </div>`;
}

async function loadAndRender() {
  const today = nowInOman();
  const dateId = formatDateId(today);
  scheduleDate.textContent = `جدول يوم ${humanDate(today)}`;

  // اجلب الحاويات كل مرة لضمان أن المراجع ليست لعناصر قديمة خارج DOM
  const pendingWrap = document.getElementById('dailyPending');
  const completedWrap = document.getElementById('dailyCompleted');
  const todayNameEl = document.getElementById('todayName');
  const upcomingWrap = document.getElementById('upcomingExams');

  const tasks = await listScheduleTasks(dateId);
  
  // جمع المهام غير المكتملة من الأيام السابقة للعرض فقط
  const allEntries = await getAllDailyEntries();
  const lateTasks = [];
  
  for (const [entryDateId, entry] of Object.entries(allEntries)) {
    if (entryDateId < dateId) { // يوم سابق
      const oldTasks = await listScheduleTasks(entryDateId);
      const incompleteTasks = oldTasks.filter(t => t.status !== 'completed');
      
      // إضافة التاريخ الأصلي للمهام المتأخرة
      incompleteTasks.forEach(task => {
        lateTasks.push({
          ...task,
          originalDateId: task.originalDateId || entryDateId,
          id: `late_${entryDateId}_${task.id}` // معرف فريد للمهام المتأخرة
        });
      });
    }
  }
  
  // دمج المهام الحالية مع المهام المتأخرة
  const allTasks = [...tasks, ...lateTasks];
  
  const subs = await listSubjects();
  const subjectNameMap = new Map(subs.map(s => [s.id, s.name]));
  const pending = allTasks.filter(t => t.status !== 'completed');
  const completed = allTasks.filter(t => t.status === 'completed');

  pendingWrap.innerHTML = pending.map(t => renderItem(t, subjectNameMap, dateId)).join('') || '<div class="text-muted">لا توجد مهام حالية.</div>';
  completedWrap.innerHTML = completed.map(t => renderItem(t, subjectNameMap, dateId)).join('') || '<div class="text-muted">لا يوجد إنجازات بعد.</div>';
  pendingCount.textContent = pending.length;
  completedCount.textContent = completed.length;

  // عرض يوم اليوم وجمع جميع الامتحانات/واجبات القريبة من جميع الأيام
  todayNameEl.textContent = `اليوم: ${dayName(today)}`;
  
  // جمع جميع الاختبارات من جميع الأيام (استخدام نفس متغير allEntries)
  const allExams = [];
  const todayDate = new Date(today);
  
  Object.entries(allEntries).forEach(([entryDateId, entry]) => {
    if (entry.examTasks && Array.isArray(entry.examTasks)) {
      entry.examTasks.forEach(exam => {
        if (exam.dueDate) {
          const examDate = new Date(exam.dueDate + 'T00:00:00');
          // عرض الاختبارات للأسبوعين القادمين فقط
          const daysDiff = Math.ceil((examDate - todayDate) / (1000 * 60 * 60 * 24));
          if (daysDiff >= 0 && daysDiff <= 14) {
            allExams.push({
              ...exam,
              originalDateId: entryDateId,
              daysDiff
            });
          }
        }
      });
    }
  });
  
  // ترتيب الاختبارات حسب التاريخ
  const exams = allExams.sort((a,b) => {
    const ad = new Date(a.dueDate||'9999-12-31');
    const bd = new Date(b.dueDate||'9999-12-31');
    return ad - bd;
  });
  upcomingWrap.innerHTML = exams.length
    ? exams.map((ex, idx) => {
        const due = ex.dueDate ? new Date(ex.dueDate + 'T00:00:00') : null;
        const dName = due ? due.toLocaleDateString('ar-EG', { weekday: 'long' }) : '-';
        const daysLeft = ex.daysDiff;
        const urgencyClass = daysLeft <= 3 ? 'text-danger' : daysLeft <= 7 ? 'text-warning' : 'text-muted';
        const urgencyText = daysLeft === 0 ? 'اليوم' : daysLeft === 1 ? 'غداً' : `خلال ${daysLeft} أيام`;
        
        return `
        <div class="card-task p-2" data-ex-idx="${idx}" data-original-date="${ex.originalDateId}">
          <div class="d-flex justify-content-between align-items-center">
            <div>
              <div class="title">${ex.subjectName}</div>
              <div class="small text-muted">تاريخ: ${ex.dueDate || '-'} (${dName}) — صفحات: ${ex.pages || 0}</div>
              <div class="small ${urgencyClass} fw-bold">${urgencyText}</div>
            </div>
            <div class="btn-group">
              <button class="btn btn-sm btn-outline-primary edit-ex">تعديل</button>
              <button class="btn btn-sm btn-outline-danger del-ex">حذف</button>
            </div>
          </div>
          <div class="mt-1"><span class="badge bg-light text-dark">${ex.requiredHours||0} س</span></div>
        </div>`;
      }).join('')
    : '<div class="text-muted">لا توجد اختبارات/واجبات قريبة.</div>';

  // تفويض الأحداث لحاويات القوائم
  function bindContainer(container) {
    container.addEventListener('change', async (e) => {
      const card = e.target.closest('.card-task');
      if (!card) return;
      if (e.target.classList.contains('complete')) {
        const id = card.dataset.id;
        const checked = e.target.checked;
        if (checked) {
          // تأثير انفجار قبل إعادة التحميل
          card.classList.add('explode');
          setTimeout(() => card.classList.remove('explode'), 450);
        }
        
        // التعامل مع المهام المتأخرة
        if (id.startsWith('late_')) {
          const [, originalDateId, originalId] = id.split('_');
          await setTaskCompleted(originalDateId, originalId, checked);
        } else {
          await setTaskCompleted(dateId, id, checked);
        }
        await loadAndRender();
      }
    });
    container.addEventListener('click', async (e) => {
      const card = e.target.closest('.card-task');
      if (!card) return;
      if (e.target.classList.contains('undo')) {
        const id = card.dataset.id;
        
        // التعامل مع المهام المتأخرة
        if (id.startsWith('late_')) {
          const [, originalDateId, originalId] = id.split('_');
          await setTaskCompleted(originalDateId, originalId, false);
        } else {
          await setTaskCompleted(dateId, id, false);
        }
        await loadAndRender();
      }
    });
    
    // إضافة event listener لأزرار بدء المراجعة
    container.addEventListener('click', async (e) => {
      if (e.target.classList.contains('start-pomodoro')) {
        const card = e.target.closest('.card-task');
        if (!card) return;
        
        const taskId = card.dataset.id;
        // البحث في المهام المحلية أولاً، ثم في المهام المتأخرة
        let task = tasks.find(t => t.id === taskId);
        if (!task && taskId.startsWith('late_')) {
          // للمهام المتأخرة، نأخذ البيانات من card نفسه
          const titleElement = card.querySelector('.title');
          const taskName = titleElement ? titleElement.textContent.replace('متأخر', '').trim() : 'مهمة';
          const minutesElement = card.querySelector('.badge');
          const minutes = minutesElement ? parseInt(minutesElement.textContent) || 25 : 25;
          
          task = {
            id: taskId,
            subjectName: taskName,
            minutes: minutes,
            originalDateId: taskId.split('_')[1]
          };
        }
        
        if (task) {
          showPomodoroSetupModal(task);
        }
      }
    });
  }

  // لإزالة أي مستمعات قديمة، نستبدل العنصر ثم نربط
  const newPending = pendingWrap.cloneNode(true);
  const newCompleted = completedWrap.cloneNode(true);
  pendingWrap.parentNode.replaceChild(newPending, pendingWrap);
  completedWrap.parentNode.replaceChild(newCompleted, completedWrap);

  bindContainer(document.getElementById('dailyPending'));
  bindContainer(document.getElementById('dailyCompleted'));

  // تعديل/حذف عناصر الاختبارات
  upcomingWrap?.addEventListener('click', async (e) => {
    const card = e.target.closest('.card-task');
    if (!card) return;
    const idx = Number(card.dataset.exIdx);
    const originalDateId = card.dataset.originalDate;
    
    if (!originalDateId) return;
    
    const targetEntry = await getDailyEntry(originalDateId) || { examTasks: [] };
    const list = targetEntry.examTasks || [];
    
    // البحث عن الاختبار الصحيح في القائمة الأصلية
    const currentExam = exams[idx];
    const listIdx = list.findIndex(ex => 
      ex.subjectName === currentExam.subjectName && 
      ex.dueDate === currentExam.dueDate
    );
    
    if (listIdx === -1) return;

    // حذف
    if (e.target.classList.contains('del-ex')) {
      list.splice(listIdx, 1);
      await saveDailyEntry(originalDateId, { ...targetEntry, examTasks: list });
      await loadAndRender();
      return;
    }

    // تعديل
    if (e.target.classList.contains('edit-ex')) {
      const item = list[listIdx];
      const subj = document.getElementById('examSubjInput');
      const date = document.getElementById('examDateInput');
      const hrs = document.getElementById('examHoursInput');
      const pgs = document.getElementById('examPagesInput');
      subj.value = item.subjectName || '';
      date.value = item.dueDate || '';
      hrs.value = item.requiredHours || 0;
      pgs.value = item.pages || 0;

      const saveBtn = document.getElementById('saveExamBtn');
      const modalEl = document.getElementById('editExamModal');
      const bsModal = bootstrap.Modal.getOrCreateInstance(modalEl);
      bsModal.show();

      const onSave = async () => {
        item.subjectName = subj.value.trim();
        item.dueDate = date.value;
        item.requiredHours = Number(hrs.value || 0);
        item.pages = Number(pgs.value || 0);
        await saveDailyEntry(originalDateId, { ...targetEntry, examTasks: list });
        saveBtn.removeEventListener('click', onSave);
        bsModal.hide();
        await loadAndRender();
      };
      saveBtn.addEventListener('click', onSave, { once: true });
    }
  });

  // اختبار إرسال إشعار محلي (تنبيه Notification API)
  const testBtn = document.getElementById('testNotificationBtn');
  testBtn?.addEventListener('click', () => {
    const modalEl = document.getElementById('notifyTestModal');
    bootstrap.Modal.getOrCreateInstance(modalEl).show();
  });

  const scheduleBtn = document.getElementById('scheduleNotifyBtn');
  scheduleBtn?.addEventListener('click', async () => {
    const when = document.getElementById('notifyWhen').value;
    const title = (document.getElementById('notifyTitle').value || 'تذكير مهم').trim();
    const body = (document.getElementById('notifyBody').value || 'لا تنسَ مهمتك.').trim();
    if (!when) { alert('اختر وقت وتاريخ'); return; }

    // طلب الإذن
    if (Notification.permission !== 'granted') {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { alert('تم رفض الإذن بالإشعارات'); return; }
    }

    const trigger = new Date(when).getTime();
    const now = Date.now();
    const delay = Math.max(0, trigger - now);

    // جدولة عبر setTimeout داخل الصفحة (سيعمل طالما الصفحة/Service Worker نشطين)
    setTimeout(async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          // إشعار احترافي
          await reg.showNotification(title, {
            body,
            icon: '/assets/icons/notification.png',
            badge: '/assets/icons/icon-192.png',
            lang: 'ar',
            dir: 'rtl',
            vibrate: [60, 40, 60],
            requireInteraction: false,
            actions: [
              { action: 'open', title: 'فتح التطبيق' },
              { action: 'done', title: 'تم' }
            ],
            data: { autoDelete: true, createdAt: Date.now() }
          });
        } else {
          new Notification(title, { body });
        }
      } catch (e) {
        console.warn('فشل إظهار الإشعار:', e);
      }
    }, delay);

    // إغلاق المودال
    bootstrap.Modal.getOrCreateInstance(document.getElementById('notifyTestModal')).hide();
    alert('تمت جدولة الإشعار بنجاح');
  });

  copyScheduleBtn?.addEventListener('click', async () => {
    const lines = allTasks.map(t => {
      const isLate = t.originalDateId && t.originalDateId < dateId && t.status !== 'completed';
      const status = t.status === 'completed' ? 'مكتمل' : (isLate ? 'متأخر' : 'غير مكتمل');
      return `${t.subjectName || t.subjectId} - ${t.minutes || 0}د - صفحات:${t.pages || 0} - ${status}`;
    });
    await copyText(lines.join('\n'));
  }, { once: true });
}

// دالة عرض نافذة إعداد Pomodoro
function showPomodoroSetupModal(task) {
  // إزالة أي نافذة موجودة
  const existingModal = document.getElementById('pomodoroSetupModal');
  if (existingModal) {
    existingModal.remove();
  }
  
  const modal = document.createElement('div');
  modal.id = 'pomodoroSetupModal';
  modal.className = 'modal fade';
  modal.setAttribute('tabindex', '-1');
  
  const taskName = task.subjectName || task.subjectId || 'مهمة';
  const suggestedTime = Math.max(25, Math.ceil((task.minutes || 25) / 25) * 25); // اقتراح وقت بناءً على الوقت المقدر
  
  modal.innerHTML = `
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content" style="border-radius: 1rem; border: none; box-shadow: 0 20px 40px rgba(0,0,0,0.3);">
        <div class="modal-header" style="background: linear-gradient(135deg, #4f46e5, #7c3aed); color: white; border-radius: 1rem 1rem 0 0;">
          <h5 class="modal-title">🍅 إعداد جلسة المراجعة</h5>
          <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
        </div>
        <div class="modal-body" style="padding: 2rem;">
          <div class="mb-3">
            <h6 class="fw-bold text-primary mb-2">📚 المهمة:</h6>
            <p class="fs-5 mb-3">${taskName}</p>
          </div>
          
          <div class="mb-4">
            <label class="form-label fw-bold">⏱️ مدة المراجعة (بالدقائق):</label>
            <div class="row g-2">
              <div class="col-3">
                <button class="btn btn-outline-primary w-100 time-preset" data-time="15">15</button>
              </div>
              <div class="col-3">
                <button class="btn btn-outline-primary w-100 time-preset" data-time="25">25</button>
              </div>
              <div class="col-3">
                <button class="btn btn-outline-primary w-100 time-preset" data-time="45">45</button>
              </div>
              <div class="col-3">
                <button class="btn btn-outline-primary w-100 time-preset" data-time="60">60</button>
              </div>
            </div>
            <div class="mt-3">
              <input type="range" class="form-range" id="studyTimeRange" min="5" max="120" value="${suggestedTime}" step="5">
              <div class="d-flex justify-content-between text-muted small">
                <span>5 د</span>
                <span id="selectedTime" class="fw-bold text-primary fs-6">${suggestedTime} دقيقة</span>
                <span>120 د</span>
              </div>
            </div>
          </div>
          
          <div class="alert alert-info d-flex align-items-center" style="border-radius: 0.75rem;">
            <div>
              <i class="bi bi-info-circle me-2"></i>
              <strong>نظام Pomodoro:</strong> ستحصل على راحة 10 دقائق بعد انتهاء الوقت المحدد
            </div>
          </div>
          
          <div class="mb-3">
            <h6 class="fw-bold">📊 إحصائيات اليوم:</h6>
            <div id="dailyStats" class="row g-2 text-center"></div>
          </div>
        </div>
        <div class="modal-footer" style="border: none; padding: 1rem 2rem 2rem;">
          <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">إلغاء</button>
          <button type="button" class="btn btn-primary btn-lg" id="startPomodoroBtn" style="border-radius: 50px;">
            🍅 بدء المراجعة
          </button>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // ربط الأحداث
  const timeRange = modal.querySelector('#studyTimeRange');
  const selectedTimeDisplay = modal.querySelector('#selectedTime');
  const timePresets = modal.querySelectorAll('.time-preset');
  const startBtn = modal.querySelector('#startPomodoroBtn');
  const dailyStatsContainer = modal.querySelector('#dailyStats');
  
  // تحديث عرض الوقت المختار
  function updateSelectedTime() {
    const time = timeRange.value;
    selectedTimeDisplay.textContent = `${time} دقيقة`;
    
    // إزالة active من جميع الأزرار المحددة مسبقاً
    timePresets.forEach(btn => btn.classList.remove('btn-primary', 'btn-outline-primary'));
    timePresets.forEach(btn => btn.classList.add('btn-outline-primary'));
    
    // تفعيل الزر المطابق إن وجد
    const matchingBtn = Array.from(timePresets).find(btn => btn.dataset.time === time);
    if (matchingBtn) {
      matchingBtn.classList.remove('btn-outline-primary');
      matchingBtn.classList.add('btn-primary');
    }
  }
  
  // أحداث تغيير الوقت
  timeRange.addEventListener('input', updateSelectedTime);
  
  timePresets.forEach(btn => {
    btn.addEventListener('click', () => {
      timeRange.value = btn.dataset.time;
      updateSelectedTime();
    });
  });
  
  // عرض الإحصائيات اليومية
  const stats = PomodoroTimer.getTodayStats();
  dailyStatsContainer.innerHTML = `
    <div class="col-3">
      <div class="bg-primary text-white rounded p-2">
        <div class="fs-4 fw-bold">${stats.sessionsCount}</div>
        <small>جلسات</small>
      </div>
    </div>
    <div class="col-3">
      <div class="bg-success text-white rounded p-2">
        <div class="fs-4 fw-bold">${stats.completedCount}</div>
        <small>مكتملة</small>
      </div>
    </div>
    <div class="col-3">
      <div class="bg-info text-white rounded p-2">
        <div class="fs-4 fw-bold">${stats.totalStudyTime}</div>
        <small>دقيقة</small>
      </div>
    </div>
    <div class="col-3">
      <div class="bg-warning text-white rounded p-2">
        <div class="fs-4 fw-bold">${stats.currentStreak}</div>
        <small>أيام متتالية</small>
      </div>
    </div>
  `;
  
  // بدء الـ Pomodoro
  startBtn.addEventListener('click', () => {
    const studyTime = parseInt(timeRange.value);
    const bsModal = bootstrap.Modal.getInstance(modal);
    bsModal.hide();
    
    // بدء جلسة Pomodoro
    window.pomodoroTimer.startSession(task, studyTime);
  });
  
  // عرض النافذة
  const bsModal = new bootstrap.Modal(modal);
  bsModal.show();
  
  // تحديث العرض الأولي
  updateSelectedTime();
  
  // تنظيف عند إغلاق النافذة
  modal.addEventListener('hidden.bs.modal', () => {
    modal.remove();
  });
}

// جعل الدوال متاحة عالمياً للـ Pomodoro Timer
window.setTaskCompleted = setTaskCompleted;
window.loadAndRender = loadAndRender;

loadAndRender();