export function copyText(text) {
  return navigator.clipboard.writeText(text);
}

export function tableToText(tasks) {
  const lines = [
    'جدول المراجعة:',
    'المادة | الوقت (د) | الصفحات | الحالة',
    '------------------------------------'
  ];
  for (const t of tasks) {
    lines.push(`${t.subjectName || t.subjectId} | ${t.minutes || 0} | ${t.pages || 0} | ${t.status}`);
  }
  return lines.join('\n');
}

export function achievementsToText(items) {
  const lines = [
    'سجل الإنجازات:',
    'المادة | التاريخ | الصفحات | الحالة',
    '------------------------------------'
  ];
  for (const i of items) {
    lines.push(`${i.subjectName || i.subjectId} | ${i.date} | ${i.pages || 0} | ${i.status}`);
  }
  return lines.join('\n');
}