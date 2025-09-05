import { listScheduleTasks, listLateTasks, addScheduleTask, removeLateTask, listSubjects, setTaskCompleted } from './db.js';
import { nowInOman, formatDateId, rangeDays } from './timezone.js';
import { copyText, achievementsToText } from './copy.js';

const achDailyContainer = document.getElementById('achDailyContainer');
const achWeeklyContainer = document.getElementById('achWeeklyContainer');
const achMonthlyContainer = document.getElementById('achMonthlyContainer');
const copyAchievementsBtn = document.getElementById('copyAchievementsBtn');

function makeCard(subjectNameMap) {
  return function card(item) {
    const isPending = item.status !== 'completed';
    const name = item.subjectName || subjectNameMap.get(item.subjectId) || item.subjectId || 'بدون اسم';
    return `
      <div class="card-task ${isPending ? 'late' : 'completed'}" data-id="${item.id}" data-dateid="${item.date}">
        <div class="d-flex justify-content-between align-items-center">
          <div class="title">${name}</div>
          <div class="badge bg-light text-dark">${item.pages || 0} صفحة</div>
        </div>
        <div class="small text-muted">${item.date} — الحالة: ${isPending ? 'غير مكتمل' : 'مكتمل'}</div>
        ${isPending ? '<div class="mt-2 d-flex gap-2"><button class="btn btn-danger-soft btn-sm addToday">لليوم</button></div>' : ''}
      </div>`;
  }
}

async function gather(rangeStart, rangeEnd) {
  const dates = rangeDays(rangeStart, rangeEnd).map(d => formatDateId(d));
  const all = [];
  for (const d of dates) {
    const tasks = await listScheduleTasks(d);
    for (const t of tasks) all.push({ ...t, date: d });
  }
  return all;
}

async function render() {
  const today = nowInOman();
  const todayId = formatDateId(today);

  const subjects = await listSubjects();
  const subjectNameMap = new Map(subjects.map(s => [s.id, s.name]));
  const card = makeCard(subjectNameMap);

  // يومي
  const daily = await listScheduleTasks(todayId);
  achDailyContainer.innerHTML = daily.map(t => card({ ...t, date: todayId })).join('');

  // أسبوعي (الأحد إلى السبت)
  const day = today.getDay();
  const sunday = new Date(today); sunday.setDate(today.getDate() - day);
  const saturday = new Date(sunday); saturday.setDate(sunday.getDate() + 6);
  const weekly = await gather(sunday, saturday);
  achWeeklyContainer.innerHTML = weekly.map(card).join('');

  // شهري
  const first = new Date(today.getFullYear(), today.getMonth(), 1);
  const last = new Date(today.getFullYear(), today.getMonth()+1, 0);
  const monthly = await gather(first, last);
  achMonthlyContainer.innerHTML = monthly.map(card).join('');

  // أحداث: تم / إضافة لليوم
  [achDailyContainer, achWeeklyContainer, achMonthlyContainer].forEach(container => {
    container.addEventListener('click', async (e) => {
      const wrap = e.target.closest('.card-task');
      if (!wrap) return;
      const date = wrap.dataset.dateid;
      const id = wrap.dataset.id;

      if (e.target.closest('.completeNow')) {
        await setTaskCompleted(date, id, true);
        // تأثير بسيط بصري
        wrap.classList.add('completed');
        wrap.classList.add('completed-anim');
        setTimeout(() => wrap.classList.remove('completed-anim'), 600);
        await render();
        return;
      }

      if (e.target.closest('.addToday')) {
        const src = [...daily, ...weekly, ...monthly].find(x => x.id === id && (x.date === date || !x.date));
        if (!src) return;
        await addScheduleTask(todayId, { subjectId: src.subjectId, subjectName: src.subjectName, pages: src.pages, minutes: src.minutes, source: 'late' });
        const late = await listLateTasks();
        const same = late.find(l => (l.subjectId === src.subjectId) && (l.pages === src.pages));
        if (same) await removeLateTask(same.id);
        await render();
      }
    });
  });

  // نسخ السجل
  copyAchievementsBtn?.addEventListener('click', async () => {
    const all = [
      ...daily.map(t => ({ ...t, date: todayId })),
      ...weekly,
      ...monthly,
    ];
    await copyText(achievementsToText(all));
  });
}

render();