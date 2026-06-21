// Brain Fry — мелкие утилиты.

export function randInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}
export function chance(p) { return Math.random() < p; }
export function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

export function uid() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
}

// «200.50», «50000», «1984» — форматирование для показа ответа на «Пропустить».
export function formatMoney(units, sub, hasCents) {
  if (!hasCents) return String(units);
  return units + "." + String(sub).padStart(2, "0");
}
