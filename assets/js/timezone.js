// أدوات توقيت آسيا/مسقط
export function nowInOman() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Muscat' }));
}

export function formatDateId(d = nowInOman()) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,'0');
  const dd = String(d.getDate()).padStart(2,'0');
  return `${yyyy}-${mm}-${dd}`;
}

export function rangeDays(start, end) {
  const out = [];
  const cur = new Date(start);
  while (cur <= end) {
    out.push(new Date(cur));
    cur.setDate(cur.getDate()+1);
  }
  return out;
}