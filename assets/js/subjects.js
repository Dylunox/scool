import { ensureDefaultSubjects, listSubjects, addSubject, removeSubject, renameSubject } from './db.js';

const subjectsContainer = document.getElementById('subjectsContainer');
const subjectsList = document.getElementById('subjectsList');
const addSubjectBtn = document.getElementById('addSubjectBtn');
const newSubjectName = document.getElementById('newSubjectName');

function subjectCheckboxTemplate(s, checked = false) {
  const id = `sub-${s.id}`;
  return `
    <div class="col-12 col-md-6">
      <div class="border rounded p-2">
        <div class="form-check">
          <input class="form-check-input subject-check" type="checkbox" value="${s.id}" id="${id}" ${checked ? 'checked' : ''}>
          <label class="form-check-label" for="${id}">${s.name}</label>
        </div>
        <div class="row mt-2 g-2">
          <div class="col-4">
            <input class="form-control form-control-sm pages" type="number" min="0" placeholder="صفحات" />
          </div>
          <div class="col-4">
            <input class="form-control form-control-sm focus" type="number" min="1" max="5" step="1" value="3" placeholder="تركيز (1-5)" />
          </div>
          <div class="col-4">
            <input class="form-control form-control-sm difficulty" type="text" placeholder="صعوبة؟" />
          </div>
          <div class="col-12">
            <textarea class="form-control form-control-sm note" rows="2" placeholder="ملاحظات (اختياري)"></textarea>
          </div>
        </div>
      </div>
    </div>`;
}

function subjectListItemTemplate(s) {
  return `
    <li class="list-group-item d-flex justify-content-between align-items-center">
      <div class="d-flex align-items-center flex-grow-1">
        <input class="form-control form-control-sm w-50 me-2 subject-name" data-id="${s.id}" value="${s.name}">
        ${s.isDefault ? '<span class="badge bg-light text-dark me-2">أساسية</span>' : ''}
      </div>
      <div class="btn-group">
        <button class="btn btn-sm btn-outline-primary rename" data-id="${s.id}">تعديل</button>
        <button class="btn btn-sm btn-outline-danger remove" data-id="${s.id}">حذف</button>
      </div>
    </li>`
}

async function renderSubjects() {
  try {
    await ensureDefaultSubjects();
    const subjects = await listSubjects();
    // لا نعرض شيئًا في الرئيسية حتى يختار المستخدم المواد من النافذة المنبثقة
    subjectsContainer.innerHTML = '<div class="text-muted">اختر المواد لليوم من الزر أعلاه.</div>';
    // قائمة الإدارة تظل كما هي
    subjectsList.innerHTML = subjects.length
      ? subjects.map(subjectListItemTemplate).join('')
      : '<li class="list-group-item text-muted">لا توجد مواد بعد.</li>';
  } catch (e) {
    console.error('فشل تحميل المواد:', e);
    subjectsContainer.innerHTML = '<div class="text-danger">تعذر تحميل المواد. تأكد من إعداد Firebase/Firestore.</div>';
    subjectsList.innerHTML = '<li class="list-group-item text-danger">تعذر تحميل المواد.</li>';
  }
}

async function handleAddSubject() {
  const name = (newSubjectName?.value || '').trim();
  if (!name) {
    alert('اكتب اسم المادة أولًا');
    return;
  }
  try {
    console.debug('إضافة مادة:', name);
    // تعطيل الزر مؤقتًا لتفادي النقرات المتكررة
    addSubjectBtn?.setAttribute('disabled', 'true');
    await addSubject(name);
    newSubjectName.value = '';
    await renderSubjects();
  } catch (e) {
    console.error('فشل إضافة المادة:', e);
    alert('تعذر إضافة المادة. راجع Console لمعرفة السبب.');
  } finally {
    addSubjectBtn?.removeAttribute('disabled');
  }
}

// ربط أساسي بالزر
addSubjectBtn?.addEventListener('click', handleAddSubject);



subjectsList?.addEventListener('click', async (e) => {
  const t = e.target;
  if (t.classList.contains('remove')) {
    await removeSubject(t.dataset.id);
    await renderSubjects();
  } else if (t.classList.contains('rename')) {
    const item = t.closest('li');
    const input = item.querySelector('.subject-name');
    await renameSubject(t.dataset.id, input.value.trim());
    await renderSubjects();
  }
});

// نافذة منبثقة لاختيار مواد اليوم
const pickSubjectsContainer = document.getElementById('pickSubjectsContainer');
const applyPickedSubjectsBtn = document.getElementById('applyPickedSubjects');

async function renderPickModal() {
  const subjects = await listSubjects();
  pickSubjectsContainer.innerHTML = subjects.map(s => `
    <div class="col-12 col-md-6">
      <div class="border rounded p-2 d-flex align-items-center justify-content-between">
        <div class="form-check">
          <input class="form-check-input pick-check" type="checkbox" value="${s.id}" id="pick-${s.id}">
          <label class="form-check-label" for="pick-${s.id}">${s.name}</label>
        </div>
      </div>
    </div>`).join('');
}

document.addEventListener('shown.bs.modal', (e) => {
  if (e.target && e.target.id === 'pickSubjectsModal') renderPickModal();
});

applyPickedSubjectsBtn?.addEventListener('click', async () => {
  const picks = Array.from(pickSubjectsContainer.querySelectorAll('.pick-check:checked'))
    .map(cb => cb.value);
  const subjects = await listSubjects();
  const chosen = subjects.filter(s => picks.includes(s.id));
  // ارسم فقط المواد التي تم اختيارها الآن في الصفحة الرئيسية
  subjectsContainer.innerHTML = chosen.length
    ? chosen.map(s => subjectCheckboxTemplate(s, true)).join('')
    : '<div class="text-muted">لم يتم اختيار مواد.</div>';
});

// عند تحميل الصفحة
renderSubjects();

export function collectSelectedSubjects() {
  const boxes = Array.from(document.querySelectorAll('.subject-check'));
  return boxes.filter(b => b.checked).map(b => {
    const card = b.closest('.border');
    return {
      subjectId: b.value,
      pages: Number(card.querySelector('.pages').value || 0),
      focus: Number(card.querySelector('.focus').value || 3),
      difficulty: (card.querySelector('.difficulty').value || '').trim() || null,
      note: (card.querySelector('.note')?.value || '').trim() || null,
    };
  });
}