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
