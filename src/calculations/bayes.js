// ПР1. Метод Байєса — чисті функції без DOM.
// Номери формул відповідають методичним вказівкам до практичних робіт (МВ), с. 4–9.

import { sum, argMax } from './numeric.js';

const EPS = 1e-9;

export class BayesInputError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

/**
 * Перевірка вихідних даних.
 * @param {{priors:number[], featureProbs:number[][], observed:boolean[]}} input
 *   priors[i] = P(Di); featureProbs[i][j] = P(kj/Di); observed[j] — чи виявлено ознаку kj.
 * @returns {string[]} перелік помилок українською (порожній — дані коректні)
 */
export function validateInput({ priors, featureProbs, observed }) {
  const errors = [];
  if (!Array.isArray(priors) || priors.length < 2) {
    errors.push('Потрібно щонайменше два можливі стани (діагнози).');
    return errors;
  }
  const n = priors.length;
  priors.forEach((p, i) => {
    if (!Number.isFinite(p)) errors.push(`P(D${i + 1}) не є числом.`);
    else if (p < 0 || p > 1) errors.push(`P(D${i + 1}) = ${p} поза межами [0; 1].`);
  });
  const s = sum(priors.filter(Number.isFinite));
  if (Math.abs(s - 1) > 1e-6) {
    errors.push(`Сума апріорних ймовірностей має дорівнювати 1 (формула 8), зараз ${s.toFixed(4)}.`);
  }
  if (!Array.isArray(featureProbs) || featureProbs.length !== n) {
    errors.push('Діагностична матриця має містити рядок для кожного діагнозу.');
    return errors;
  }
  const m = observed?.length ?? 0;
  if (m < 1) errors.push('Потрібна щонайменше одна діагностична ознака.');
  featureProbs.forEach((row, i) => {
    if (!Array.isArray(row) || row.length !== m) {
      errors.push(`Рядок D${i + 1} діагностичної матриці має містити ${m} значень.`);
      return;
    }
    row.forEach((p, j) => {
      if (!Number.isFinite(p)) errors.push(`P(k${j + 1}/D${i + 1}) не є числом.`);
      else if (p < 0 || p > 1) errors.push(`P(k${j + 1}/D${i + 1}) = ${p} поза межами [0; 1].`);
    });
  });
  return errors;
}

/** P(kj* | Di): ймовірність фактичної реалізації ознаки (с. 6–7 МВ, P(¬k/D) = 1 − P(k/D)). */
export function realizedProb(p, present) {
  return present ? p : 1 - p;
}

/** Робоча таблиця P(kj* | Di) для заданої реалізації K*. */
export function workingTable(featureProbs, observed) {
  return featureProbs.map((row) => row.map((p, j) => realizedProb(p, observed[j])));
}

/**
 * Повний розрахунок за узагальненою формулою Байєса.
 * Формули: (10) P(K* | Di) = Π P(kj* | Di); (14) P(DiK*) = P(Di)P(K* | Di);
 * (11) P(K*) = Σ P(DsK*); (15) P(Di | K*) = P(DiK*)/P(K*); (18)–(20) рішення з порогом.
 */
export function computeBayes({ priors, featureProbs, observed, threshold = 0 }) {
  const errors = validateInput({ priors, featureProbs, observed });
  if (errors.length) throw new BayesInputError('invalid', errors.join(' '));

  const table = workingTable(featureProbs, observed);
  const likelihoods = table.map((row) => row.reduce((a, b) => a * b, 1));
  const joints = likelihoods.map((l, i) => priors[i] * l);
  const evidence = sum(joints);
  if (evidence <= EPS) {
    throw new BayesInputError(
      'zero-evidence',
      'P(K*) = 0: за цієї діагностичної матриці така комбінація ознак неможлива для жодного стану. Перевірте вихідні дані або реалізацію ознак.',
    );
  }
  const posteriors = joints.map((j) => j / evidence);
  const best = argMax(posteriors);
  const sorted = posteriors.slice().sort((a, b) => b - a);
  const accepted = posteriors[best] >= threshold - EPS;
  return {
    table,
    likelihoods,
    joints,
    evidence,
    posteriors,
    posteriorSum: sum(posteriors),
    best,
    margin: sorted[0] - (sorted[1] ?? 0),
    tie: sorted.length > 1 && Math.abs(sorted[0] - sorted[1]) < 1e-12,
    threshold,
    accepted,
  };
}

/** Ймовірності за статистичними даними: (3) P(Di) = Ni/N, (4) P(kj/Di) = Nij/Ni, (5) P(kj) = Nj/N. */
export function probsFromCounts({ N, Ni, Nij }) {
  if (!(N > 0)) throw new BayesInputError('invalid', 'Загальна кількість об\'єктів N має бути додатною.');
  if (sum(Ni) !== N) throw new BayesInputError('invalid', `Сума Ni (${sum(Ni)}) не дорівнює N (${N}).`);
  const priors = Ni.map((x) => x / N);
  const featureProbs = Nij.map((row, i) => row.map((x) => {
    if (x > Ni[i]) throw new BayesInputError('invalid', `Nij не може перевищувати Ni для D${i + 1}.`);
    return Ni[i] > 0 ? x / Ni[i] : 0;
  }));
  const m = Nij[0].length;
  const featureMarginals = Array.from({ length: m }, (_, j) => sum(Nij.map((r) => r[j])) / N);
  return { priors, featureProbs, featureMarginals };
}

/**
 * Уточнення діагностичної матриці після надходження нового об'єкта з діагнозом Dμ (с. 7 МВ).
 * (16) P(Di) = Ni/(N+1), i ≠ μ;  P(Dμ) = (Nμ+1)/(N+1).
 * (17) МВ: P(kjs | Dμ) = (Njs + δsr)/(Nμ + mj) — сума за s ≠ 1 (див. суперечність П2);
 *      узгоджена форма: (Njs + δsr)/(Nμ + 1) — сума за s = 1.
 * Ознаки двоградаційні: s = 1 — ознака є, s = 2 — ознаки немає (mj = 2).
 * @param counts {N, Ni, Nij} — Nij[i][j] = кількість об'єктів з Di, у яких виявлено kj.
 * @param mu індекс діагнозу нового об'єкта; present[j] — реалізація ознак у нового об'єкта.
 */
export function updateMatrix({ N, Ni, Nij }, mu, present) {
  const priors = Ni.map((x, i) => (i === mu ? x + 1 : x) / (N + 1));
  const Nmu = Ni[mu];
  const variants = {};
  for (const [key, denomOf] of [['guide', (mj) => Nmu + mj], ['normalized', () => Nmu + 1]]) {
    const rows = Nij[mu].map((nYes, j) => {
      const nNo = Nmu - nYes;
      const mj = 2;
      const d = denomOf(mj);
      const pYes = (nYes + (present[j] ? 1 : 0)) / d;
      const pNo = (nNo + (present[j] ? 0 : 1)) / d;
      return { pYes, pNo, sum: pYes + pNo };
    });
    variants[key] = rows;
  }
  const newCounts = {
    N: N + 1,
    Ni: Ni.map((x, i) => (i === mu ? x + 1 : x)),
    Nij: Nij.map((row, i) => (i === mu ? row.map((x, j) => x + (present[j] ? 1 : 0)) : row.slice())),
  };
  return { priors, priorsSum: sum(priors), guide: variants.guide, normalized: variants.normalized, newCounts };
}

/**
 * Дослідження чутливості: як змінюються апостеріорні ймовірності, коли один параметр
 * пробігає [0; 1]. Для апріорної ймовірності решта апріорних перенормовуються пропорційно.
 * @param param {type:'prior', i} | {type:'feature', i, j}
 */
export function sweep(input, param, steps = 101) {
  const xs = [];
  const series = input.priors.map(() => []);
  for (let s = 0; s < steps; s++) {
    const x = s / (steps - 1);
    const next = withParam(input, param, x);
    xs.push(x);
    let post = null;
    try { post = computeBayes(next).posteriors; } catch { post = null; }
    series.forEach((arr, i) => arr.push(post ? post[i] : NaN));
  }
  return { xs, series };
}

export function withParam(input, param, x) {
  const priors = input.priors.slice();
  const featureProbs = input.featureProbs.map((r) => r.slice());
  if (param.type === 'prior') setPrior(priors, param.i, x);
  else featureProbs[param.i][param.j] = x;
  return { ...input, priors, featureProbs };
}

/** Встановлює P(Di) = x, решту масштабує пропорційно, щоб сума залишилась 1. */
export function setPrior(priors, i, x) {
  const rest = sum(priors) - priors[i];
  const n = priors.length;
  priors[i] = x;
  for (let k = 0; k < n; k++) {
    if (k === i) continue;
    priors[k] = rest > EPS ? (priors[k] / rest) * (1 - x) : (1 - x) / (n - 1);
  }
  return priors;
}
