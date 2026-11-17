// ПР2. Метод мінімального ризику (МВ, с. 10–11, формули 21–22). Чисті функції.
import { sum } from './numeric.js';

export class RiskInputError extends Error {}

/**
 * @param losses λ[i][j] — втрати, якщо прийнято рішення Dᵢ, а дійсний стан Dⱼ (n×n, ≥ 0)
 * @param posteriors P(Dⱼ/K*), сума 1
 * @returns {{risks:number[], best:number, margin:number}}
 *   R(Dᵢ/K*) = Σⱼ λᵢⱼ P(Dⱼ/K*) (21); рішення — мінімальний ризик (22)
 */
export function computeRisk(losses, posteriors) {
  const n = posteriors.length;
  const errs = [];
  if (n < 2) errs.push('Потрібно щонайменше два стани.');
  if (!Array.isArray(losses) || losses.length !== n || losses.some((r) => !Array.isArray(r) || r.length !== n)) errs.push(`Матриця втрат має бути квадратною ${n}×${n}.`);
  else losses.forEach((r, i) => r.forEach((x, j) => { if (!Number.isFinite(x) || x < 0) errs.push(`λ${i + 1}${j + 1} має бути невід’ємним числом.`); }));
  posteriors.forEach((p, j) => { if (!Number.isFinite(p) || p < 0 || p > 1) errs.push(`P(D${j + 1}/K*) поза [0; 1].`); });
  if (Math.abs(sum(posteriors) - 1) > 1e-6) errs.push(`Сума апостеріорних ймовірностей має дорівнювати 1, зараз ${sum(posteriors).toFixed(4)}.`);
  if (errs.length) throw new RiskInputError(errs.join(' '));
  const risks = losses.map((row) => row.reduce((a, l, j) => a + l * posteriors[j], 0));
  let best = 0;
  risks.forEach((r, i) => { if (r < risks[best]) best = i; });
  const sorted = risks.slice().sort((a, b) => a - b);
  return { risks, best, margin: sorted[1] - sorted[0] };
}

/** Як змінюються ризики, коли одна втрата λᵢⱼ пробігає [from; to]. */
export function riskSweep(losses, posteriors, cell, from = 0, to = 10, steps = 101) {
  const xs = []; const series = losses.map(() => []);
  for (let k = 0; k < steps; k++) {
    const x = from + ((to - from) * k) / (steps - 1);
    const L = losses.map((r) => r.slice());
    L[cell.i][cell.j] = x;
    const { risks } = computeRisk(L, posteriors);
    xs.push(x); risks.forEach((r, i) => series[i].push(r));
  }
  return { xs, series };
}

/** Точка перемикання рішення: найменше λ на [from; to], за якого оптимальне рішення змінюється (або null). */
export function switchPoint(losses, posteriors, cell, from = 0, to = 20) {
  const sw = riskSweep(losses, posteriors, cell, from, to, 2001);
  const bestAt = (k) => sw.series.reduce((b, s, i) => (s[k] < sw.series[b][k] ? i : b), 0);
  const b0 = bestAt(0);
  for (let k = 1; k < sw.xs.length; k++) if (bestAt(k) !== b0) return { x: sw.xs[k], from: b0, to: bestAt(k) };
  return null;
}
