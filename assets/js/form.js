import { saveDailyEntry, addScheduleTask } from './db.js';
import { collectSelectedSubjects } from './subjects.js';

const dailyForm = document.getElementById('dailyForm');
const examTasksDiv = document.getElementById('examTasks');
const addExamTaskBtn = document.getElementById('addExamTask');

function todayId() {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Muscat' }));
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth()+1).padStart(2,'0');
  const dd = String(now.getDate()).padStart(2,'0');
  return `${yyyy}-${mm}-${dd}`;
}

function examTaskTemplate() {
  return `
    <div class="row g-2 align-items-end border rounded p-2">
      <div class="col-12 col-md-3">
        <label class="form-label">المادة</label>
        <input class="form-control exam-subject" placeholder="اسم المادة" />
      </div>
      <div class="col-6 col-md-2">
        <label class="form-label">تاريخ</label>
        <input type="date" class="form-control exam-date" />
      </div>
      <div class="col-6 col-md-2">
        <label class="form-label">ساعات</label>
        <input type="number" class="form-control exam-hours" min="0" step="0.5" />
      </div>
      <div class="col-6 col-md-2">
        <label class="form-label">صفحات</label>
        <input type="number" class="form-control exam-pages" min="0" />
      </div>
      <div class="col-6 col-md-2">
        <button type="button" class="btn btn-outline-danger removeExamTask">حذف</button>
      </div>
    </div>`;
}

addExamTaskBtn?.addEventListener('click', () => {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = examTaskTemplate();
  examTasksDiv.appendChild(wrapper);
});

examTasksDiv?.addEventListener('click', (e) => {
  if (e.target.classList.contains('removeExamTask')) {
    e.target.closest('.row')?.parentElement?.remove();
  }
});

function collectExamTasks() {
  return Array.from(examTasksDiv.querySelectorAll('.row')).map(row => ({
    subjectName: row.querySelector('.exam-subject').value.trim(),
    dueDate: row.querySelector('.exam-date').value,
    requiredHours: Number(row.querySelector('.exam-hours').value || 0),
    pages: Number(row.querySelector('.exam-pages').value || 0),
  })).filter(t => t.subjectName && t.dueDate);
}

function collectPreferences() {
  return {
    reviewTypes: [
      document.getElementById('reviewSolving')?.checked ? 'solving' : null,
      document.getElementById('reviewSummaries')?.checked ? 'summaries' : null,
      document.getElementById('reviewVideos')?.checked ? 'videos' : null,
    ].filter(Boolean)
  };
}

function collectNotifications() {
  return {
    dailyReminder22: document.getElementById('notifDaily22')?.checked || false,
    examReminders: document.getElementById('notifExam')?.checked ? '1d' : 'off',
  };
}

function daysUntil(dateStr) {
  const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Muscat' }));
  const due = new Date(dateStr + 'T00:00:00');
  const ms = due - new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.ceil(ms / (1000*60*60*24));
}

async function generateSchedule(dateId, studied, exams, availableHours) {
  try {
    // 1) اختبارات/واجبات (أولوية قصوى إذا <= 3 أيام)
    for (const ex of exams) {
      const d = daysUntil(ex.dueDate);
      const high = d <= 3;
      const minutes = Math.max(30, Math.round((ex.requiredHours || 0) * 60));
      await addScheduleTask(dateId, {
        subjectId: ex.subjectName,
        subjectName: ex.subjectName,
        pages: ex.pages || 0,
        minutes,
        priority: high ? 'high' : 'med',
        source: 'exam'
      });
    }

    // 2) توزيع الوقت على المواد المدروسة
    const totalMinutes = Math.max(30, Math.round((availableHours || 0) * 60));
    if (studied.length) {
      // أوزان: +1 إذا التركيز <3 أو يوجد صعوبة
      const weights = studied.map(s => 1 + (s.focus < 3 ? 1 : 0) + (s.difficulty ? 1 : 0));
      const sumW = weights.reduce((a,b)=>a+b,0) || studied.length;
      for (let i=0;i<studied.length;i++) {
        const s = studied[i];
        const share = Math.max(15, Math.round(totalMinutes * (weights[i] / sumW)));
        await addScheduleTask(dateId, {
          subjectId: s.subjectId,
          pages: s.pages || 0,
          minutes: share,
          priority: (s.focus < 3 || s.difficulty) ? 'high' : 'low',
          source: 'entry',
          note: s.note || null
        });
      }
    }
  } catch (e) {
    console.error('فشل إنشاء الجدول:', e);
  }
}

dailyForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const subjects = collectSelectedSubjects();
  const availableHours = Number(document.getElementById('availableHours').value);
  const exams = collectExamTasks();
  const preferences = collectPreferences();
  const notifications = collectNotifications();

  const payload = { studied: subjects, availableHours, examTasks: exams, preferences, notifications };
  const dateId = todayId();
  await saveDailyEntry(dateId, payload);
  await generateSchedule(dateId, subjects, exams, availableHours);
  // انتقال لصفحة الجدول
  window.location.href = 'schedule.html';
});