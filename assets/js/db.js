// Realtime Database CRUD helpers
import { db, getUserId } from './firebase.js';
import { ref, get, set, push, update, remove, child } from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js';

async function uid() { return await getUserId(); }

// لم نعد نضيف مواد افتراضية — دالة فارغة للحفاظ على التوافق مع الاستدعاءات
export async function ensureDefaultSubjects() { return; }

// إصلاح شامل للبيانات (بدون إنشاء مواد جديدة تلقائيًا)
export async function repairUserData() {
  const id = await uid();
  const base = ref(db, `users/${id}`);
  const subsRef = child(base, 'subjects');
  const subsSnap = await get(subsRef);
  const byName = new Map();
  const updates = {};
  if (subsSnap.exists()) {
    subsSnap.forEach(s => {
      const data = s.val() || {};
      const nm = (data.name || '').trim();
      if (!nm) { updates[`subjects/${s.key}`] = null; return; }
      if (byName.has(nm)) { updates[`subjects/${s.key}`] = null; }
      else {
        byName.set(nm, s.key);
        updates[`subjects/${s.key}/active`] = typeof data.active === 'boolean' ? data.active : true;
        updates[`subjects/${s.key}/createdAt`] = data.createdAt || Date.now();
      }
    });
  }
  if (Object.keys(updates).length) await update(base, updates);

  // entries: تأكيد وجود updatedAt
  const entriesSnap = await get(child(base, 'entries'));
  if (entriesSnap.exists()) {
    const entUpdates = {};
    entriesSnap.forEach(e => {
      const data = e.val() || {};
      if (!data.updatedAt) entUpdates[`entries/${e.key}/updatedAt`] = Date.now();
    });
    if (Object.keys(entUpdates).length) await update(base, entUpdates);
  }

  // late_tasks: تأكيد createdAt
  const lateSnap = await get(child(base, 'late_tasks'));
  if (lateSnap.exists()) {
    const ltUpdates = {};
    lateSnap.forEach(t => {
      const data = t.val() || {};
      if (!data.createdAt) ltUpdates[`late_tasks/${t.key}/createdAt`] = Date.now();
    });
    if (Object.keys(ltUpdates).length) await update(base, ltUpdates);
  }
}

export async function listSubjects() {
  const id = await uid();
  const snap = await get(ref(db, `users/${id}/subjects`));
  if (!snap.exists()) return [];
  const obj = snap.val() || {};
  return Object.entries(obj).map(([id, data]) => ({ id, ...(data || {}) }));
}

export async function addSubject(name) {
  const id = await uid();
  const base = ref(db, `users/${id}/subjects`);
  const k = push(base).key;
  await set(ref(db, `users/${id}/subjects/${k}`), { name, active: true, createdAt: Date.now() });
}

export async function renameSubject(idKey, name) {
  const uidVal = await uid();
  await update(ref(db, `users/${uidVal}/subjects/${idKey}`), { name });
}

export async function removeSubject(idKey) {
  const uidVal = await uid();
  await remove(ref(db, `users/${uidVal}/subjects/${idKey}`));
}

export async function getDailyEntry(dateId) {
  const uidVal = await uid();
  const snap = await get(ref(db, `users/${uidVal}/entries/${dateId}`));
  return snap.exists() ? snap.val() : null;
}

export async function saveDailyEntry(dateId, payload) {
  const uidVal = await uid();
  await set(ref(db, `users/${uidVal}/entries/${dateId}`), { ...payload, updatedAt: Date.now() });
}

export async function addScheduleTask(dateId, task) {
  const uidVal = await uid();
  const k = push(ref(db, `users/${uidVal}/schedule/${dateId}/tasks`)).key;
  await set(ref(db, `users/${uidVal}/schedule/${dateId}/tasks/${k}`), { 
    ...task, 
    status: 'pending', 
    createdAt: Date.now(),
    originalDateId: dateId  // حفظ التاريخ الأصلي لتحديد المهام المتأخرة
  });
  return { id: k };
}

export async function listScheduleTasks(dateId) {
  const uidVal = await uid();
  const snap = await get(ref(db, `users/${uidVal}/schedule/${dateId}/tasks`));
  if (!snap.exists()) return [];
  const val = snap.val() || {};
  // تحويل صريح لكائن إلى مصفوفة لضمان إعادة كل العناصر
  return Object.entries(val).map(([id, data]) => ({ id, ...(data || {}) }));
}

export async function setTaskCompleted(dateId, taskId, completed, completedPages = null) {
  const uidVal = await uid();
  await update(ref(db, `users/${uidVal}/schedule/${dateId}/tasks/${taskId}`), {
    status: completed ? 'completed' : 'pending',
    completedPages: completed ? completedPages : null
  });
}

export async function addLateTask(task) {
  const uidVal = await uid();
  const k = push(ref(db, `users/${uidVal}/late_tasks`)).key;
  await set(ref(db, `users/${uidVal}/late_tasks/${k}`), { ...task, createdAt: Date.now() });
  return { id: k };
}

export async function listLateTasks() {
  const uidVal = await uid();
  const snap = await get(ref(db, `users/${uidVal}/late_tasks`));
  if (!snap.exists()) return [];
  const out = [];
  snap.forEach(s => out.push({ id: s.key, ...s.val() }));
  return out;
}

export async function removeLateTask(idKey) {
  const uidVal = await uid();
  await remove(ref(db, `users/${uidVal}/late_tasks/${idKey}`));
}

export async function saveToken(token) {
  const uidVal = await uid();
  await set(ref(db, `users/${uidVal}/tokens/${token}`), { platform: 'web', createdAt: Date.now() });
}

export async function getAllDailyEntries() {
  const uidVal = await uid();
  const snap = await get(ref(db, `users/${uidVal}/entries`));
  if (!snap.exists()) return {};
  return snap.val() || {};
}