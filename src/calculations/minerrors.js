// ПР4. Метод мінімальної кількості помилкових рішень (МВ, с. 12–13, формули 26–28).
// Ядро — максимум апостеріорної ймовірності; розширення (модельне) — навчальна вибірка,
// хибна тривога й пропуск дефекту залежно від порогу.
import { computeBayes, probsFromCounts } from './bayes.js';
import { mulberry32, hashString } from './rng.js';

/** Ядро МВ + ймовірність помилкового рішення для даної реалізації: 1 − max P(Dᵢ/K*). */
export function computeMinErrors(v) {
  const r = computeBayes({ ...v, threshold: 0 });
  return { ...r, pError: 1 - r.posteriors[r.best] };
}

/** Усі 2^m реалізації двоградаційних ознак. */
export function allRealizations(m) {
  const out = [];
  for (let mask = 0; mask < 2 ** m; mask++) out.push(Array.from({ length: m }, (_, j) => !(mask & (1 << (m - 1 - j)))));
  return out;
}

const pK = (row, obs) => row.reduce((a, p, j) => a * (obs[j] ? p : 1 - p), 1);

/**
 * Середня ймовірність помилки правила МАР за всіма реалізаціями: Pпом = Σ_K P(K)·(1 − max P(D/K)).
 * Це мінімально можлива ймовірність помилки для даної діагностичної матриці.
 */
export function bayesErrorRate(v) {
  let pe = 0;
  for (const obs of allRealizations(v.observed.length)) {
    const joints = v.priors.map((p, i) => p * pK(v.featureProbs[i], obs));
    const e = joints.reduce((a, b) => a + b, 0);
    if (e > 0) pe += e - Math.max(...joints);
  }
  return pe;
}

/**
 * Дві групи: «норма» (останній стан) і «дефект» (решта). Рішення «дефект», якщо P(норма/K*) < t.
 * Повертає точні ймовірності хибної тривоги α(t) та пропуску дефекту β(t).
 */
export function alarmMissRates(v, t) {
  const n = v.priors.length; const N = n - 1;
  let fa = 0; let miss = 0;
  const pDef = v.priors.slice(0, N).reduce((a, b) => a + b, 0);
  for (const obs of allRealizations(v.observed.length)) {
    const joints = v.priors.map((p, i) => p * pK(v.featureProbs[i], obs));
    const e = joints.reduce((a, b) => a + b, 0);
    if (e <= 0) continue;
    const pNormPost = joints[N] / e;
    const sayDefect = pNormPost < t;
    if (sayDefect) fa += pK(v.featureProbs[N], obs);
    else for (let i = 0; i < N; i++) miss += (v.priors[i] / pDef) * pK(v.featureProbs[i], obs);
  }
  return { alarm: fa, miss };
}

/** МОДЕЛЬНА навчальна вибірка з N об'єктів, згенерована з «істинної» матриці варіанта. */
export function sampleTraining(v, N, seed) {
  const next = mulberry32(hashString(String(seed)));
  const n = v.priors.length; const m = v.observed.length;
  const Ni = Array(n).fill(0); const Nij = Array.from({ length: n }, () => Array(m).fill(0));
  const cum = v.priors.reduce((acc, p) => { acc.push((acc.at(-1) ?? 0) + p); return acc; }, []);
  for (let k = 0; k < N; k++) {
    const u = next();
    let i = cum.findIndex((c) => u < c); if (i < 0) i = n - 1;
    Ni[i]++;
    for (let j = 0; j < m; j++) if (next() < v.featureProbs[i][j]) Nij[i][j]++;
  }
  return { N, Ni, Nij, estimate: probsFromCounts({ N, Ni, Nij }) };
}

/** Матриця помилок «дефект/норма» на МОДЕЛЬНІЙ контрольній вибірці для порогу t. */
export function confusionOnSample(v, N, t, seed) {
  const next = mulberry32(hashString(String(seed)));
  const n = v.priors.length; const m = v.observed.length; const NORM = n - 1;
  const cum = v.priors.reduce((acc, p) => { acc.push((acc.at(-1) ?? 0) + p); return acc; }, []);
  const c = { TP: 0, FP: 0, TN: 0, FN: 0 };
  for (let k = 0; k < N; k++) {
    const u = next();
    let i = cum.findIndex((x) => u < x); if (i < 0) i = n - 1;
    const obs = Array.from({ length: m }, (_, j) => next() < v.featureProbs[i][j]);
    const joints = v.priors.map((p, s) => p * pK(v.featureProbs[s], obs));
    const e = joints.reduce((a, b) => a + b, 0);
    const sayDefect = e > 0 ? joints[NORM] / e < t : true;
    const isDefect = i !== NORM;
    if (isDefect && sayDefect) c.TP++; else if (!isDefect && sayDefect) c.FP++; else if (!isDefect) c.TN++; else c.FN++;
  }
  return c;
}
