// Збереження профілю і результатів у localStorage браузера студента.
// Сховище локальне: результати не передаються на сервер (система статична, для GitHub Pages).

const KEY = 'dtsv-lab-v1';

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || '{}');
    return { profile: s.profile || null, works: s.works || {} };
  } catch {
    return { profile: null, works: {} };
  }
}

let state = load();

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* приватний режим — працюємо в пам'яті */ }
}

export function getProfile() { return state.profile; }
export function setProfile(p) { state.profile = p; save(); }

/** Запис по роботі: {status, bestPercent, attempts[], variantNumber} */
export function getWork(n) {
  return state.works[n] || { status: 'new', bestPercent: null, attempts: [], variantNumber: 1 };
}

export function updateWork(n, patch) {
  state.works[n] = { ...getWork(n), ...patch };
  save();
  return state.works[n];
}

export function recordAttempt(n, attempt) {
  const w = getWork(n);
  const attempts = [...w.attempts, attempt].slice(-20);
  const graded = attempt.mode === 'control' || attempt.mode === 'self' || attempt.mode === 'step';
  const best = graded ? Math.max(w.bestPercent ?? 0, attempt.percent) : w.bestPercent;
  const status = attempt.mode === 'control' && attempt.percent >= 60 ? 'done' : (w.status === 'done' ? 'done' : 'progress');
  return updateWork(n, { attempts, bestPercent: best, status });
}

export function lastAttempt(n) {
  const a = getWork(n).attempts;
  return a.length ? a[a.length - 1] : null;
}

export function resetAll() { state = { profile: state.profile, works: {} }; save(); }

/** Доповнює останню спробу (напр., висновком студента перед формуванням звіту). */
export function patchLastAttempt(n, patch) {
  const w = getWork(n);
  if (!w.attempts.length) return null;
  const attempts = w.attempts.slice();
  attempts[attempts.length - 1] = { ...attempts[attempts.length - 1], ...patch };
  updateWork(n, { attempts });
  return attempts[attempts.length - 1];
}
