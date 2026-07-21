export function initials(name) {
  return (name || '').split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase();
}

export function parseCsvRows(text) {
  return text
    .trim()
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line) => line.split(',').map((cell) => cell.trim()));
}

export function escapeCsvCell(str) {
  if (str === null || str === undefined) return '';
  return '"' + String(str).replace(/"/g, '""') + '"';
}

// pg returns DATE columns as a UTC timestamp at local midnight, so slicing the raw ISO
// string can land on the wrong calendar day once the UTC offset rolls it back/forward —
// read the date through local Date components instead.
export function formatDateOnly(value) {
  if (!value) return '';
  const d = new Date(value);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const DUE_SOON_WINDOW_DAYS = 2;

// null when the task has no due date, is closed, or isn't due soon; otherwise 'overdue' or 'soon'
// (due today or within DUE_SOON_WINDOW_DAYS).
export function getTaskUrgency(dueDate, status) {
  if (!dueDate || status === 'closed') return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const diffDays = Math.round((due - today) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 'overdue';
  if (diffDays <= DUE_SOON_WINDOW_DAYS) return 'soon';
  return null;
}
