// Спільні числові утиліти: розбір чисел, допуски, округлення.

/** Розбирає число, введене студентом: кома або крапка, пробіли ігноруються. */
export function parseNumber(raw) {
  if (raw === null || raw === undefined) return NaN;
  const s = String(raw).trim().replace(/\s+/g, '').replace(',', '.');
  if (s === '' || !/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s)) return NaN;
  return Number(s);
}

/** Допуск перевірки: абсолютний 0.0015 або 1 % відносного — що більше. */
export function withinTolerance(value, reference, { abs = 0.0015, rel = 0.01 } = {}) {
  if (!Number.isFinite(value) || !Number.isFinite(reference)) return false;
  return Math.abs(value - reference) <= Math.max(abs, rel * Math.abs(reference));
}

export function round(x, digits = 4) {
  const k = 10 ** digits;
  return Math.round(x * k) / k;
}

/** Форматування для українського інтерфейсу: десяткова кома. */
export function fmt(x, digits = 4) {
  if (!Number.isFinite(x)) return '—';
  const r = round(x, digits);
  return r.toFixed(digits).replace(/\.?0+$/, (m) => (m.startsWith('.') ? '' : m)).replace('.', ',');
}

export function fmtFixed(x, digits = 4) {
  if (!Number.isFinite(x)) return '—';
  return x.toFixed(digits).replace('.', ',');
}

export function sum(arr) { return arr.reduce((a, b) => a + b, 0); }

export function argMax(arr) {
  let best = 0;
  for (let i = 1; i < arr.length; i++) if (arr[i] > arr[best]) best = i;
  return best;
}
