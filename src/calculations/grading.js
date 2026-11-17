// Єдина система оцінювання для всіх тренажерів.
// Оцінюється не лише кінцева відповідь, а й кожен крок виконання.

export const CATEGORIES = {
  data: 'Правильність вихідних даних',
  formulas: 'Вибір формул',
  calc: 'Точність розрахунків',
  interpret: 'Інтерпретація результатів',
  decision: 'Обґрунтованість технічного рішення',
  questions: 'Контрольні запитання',
};

/** Коефіцієнти для покрокового режиму. */
export const POLICY = {
  hintPenalty: 0.25,       // кожна підказка знімає 25 % ваги кроку
  retryFactors: [1, 0.5, 0.25], // 1-ша спроба, 2-га, 3-тя і далі
  revealedFactor: 0,       // відповідь показано системою
  carriedFactor: 0.75,     // правильна дія на власних хибних попередніх даних
};

/** Рівні за шкалою РПНД ДТСВ (розд. 13 і 15). */
export function levelOf(percent) {
  if (percent >= 90) return { ects: 'A', level: 'IV — високий (творчий)' };
  if (percent >= 82) return { ects: 'B', level: 'III — достатній (конструктивний)' };
  if (percent >= 75) return { ects: 'C', level: 'III — достатній (конструктивний)' };
  if (percent >= 64) return { ects: 'D', level: 'II — середній (репродуктивний)' };
  if (percent >= 60) return { ects: 'E', level: 'II — середній (репродуктивний)' };
  if (percent >= 35) return { ects: 'FX', level: 'I — низький' };
  return { ects: 'F', level: 'I — низький' };
}

/**
 * Бали за роботу в шкалі РПНД (рішення до суперечності С6):
 * модуль 1 — 25 б. на ПР1–ПР4 (по 6,25), модуль 2 — 30 б. на ПР5–ПР9 (по 6), разом 55.
 */
export function maxPointsFor(work) { return work >= 1 && work <= 4 ? 6.25 : 6; }

/** Множник кроку в покроковому режимі. */
export function stepFactor({ attempts, hints, revealed }) {
  if (revealed) return POLICY.revealedFactor;
  const base = POLICY.retryFactors[Math.min(Math.max(attempts, 1) - 1, POLICY.retryFactors.length - 1)];
  return Math.max(0, base - POLICY.hintPenalty * hints);
}

/**
 * Підсумок: steps = [{id, title, category, weight, earned}] → відсотки за категоріями й загалом.
 */
export function summarize(steps, work = 1) {
  const byCat = {};
  for (const s of steps) {
    const c = byCat[s.category] || (byCat[s.category] = { title: CATEGORIES[s.category], weight: 0, earned: 0 });
    c.weight += s.weight;
    c.earned += s.earned;
  }
  const total = steps.reduce((a, s) => a + s.weight, 0);
  const earned = steps.reduce((a, s) => a + s.earned, 0);
  const percent = total > 0 ? Math.round((earned / total) * 1000) / 10 : 0;
  const maxPoints = maxPointsFor(work);
  return { byCat, total, earned, percent, maxPoints, points: Math.round(percent * maxPoints) / 100, ...levelOf(percent) };
}

export function verdictText(percent) {
  const { ects, level } = levelOf(percent);
  if (percent >= 90) return `Рівень ${level} (${ects}). Методику засвоєно повністю, розрахунки та рішення обґрунтовані.`;
  if (percent >= 75) return `Рівень ${level} (${ects}). Методику засвоєно, є окремі неточності — перегляньте пояснення до помилок.`;
  if (percent >= 60) return `Рівень ${level} (${ects}). Основні положення засвоєно, але є помилки, що свідчать про недостатнє знання теорії. Рекомендовано повторити режим «Покроковий тренажер».`;
  return `Рівень ${level} (${ects}). Роботу не зараховано. Опрацюйте теорію в режимі «Навчання» і виконайте покроковий тренажер ще раз.`;
}
