// ПР3. Метод максимальної (найбільшої) правдоподібності (МВ, с. 14–15, формули 24–25).
import { workingTable, BayesInputError } from './bayes.js';
import { mulberry32, hashString } from './rng.js';

/**
 * L(Dᵢ) = P(K* | Dᵢ) = Πⱼ P(kⱼ* | Dᵢ) (25); ln L(Dᵢ) = Σⱼ ln P(kⱼ* | Dᵢ); рішення — max L (24).
 * Апріорні ймовірності НЕ використовуються.
 */
export function computeLikelihood({ featureProbs, observed }) {
  if (!Array.isArray(featureProbs) || featureProbs.length < 2) throw new BayesInputError('invalid', 'Потрібно щонайменше два стани.');
  featureProbs.forEach((row, i) => {
    if (row.length !== observed.length) throw new BayesInputError('invalid', `Рядок D${i + 1} має містити ${observed.length} значень.`);
    row.forEach((p, j) => { if (!Number.isFinite(p) || p < 0 || p > 1) throw new BayesInputError('invalid', `P(k${j + 1}/D${i + 1}) поза [0; 1].`); });
  });
  const table = workingTable(featureProbs, observed);
  const likelihoods = table.map((r) => r.reduce((a, b) => a * b, 1));
  const logLikelihoods = table.map((r) => r.reduce((a, b) => a + (b > 0 ? Math.log(b) : -Infinity), 0));
  let best = 0;
  likelihoods.forEach((l, i) => { if (l > likelihoods[best]) best = i; });
  if (likelihoods[best] <= 0) throw new BayesInputError('zero-evidence', 'Жоден стан не пояснює таку реалізацію ознак (усі правдоподібності дорівнюють 0).');
  const sorted = likelihoods.slice().sort((a, b) => b - a);
  return { table, likelihoods, logLikelihoods, best, ratio: sorted[1] > 0 ? sorted[0] / sorted[1] : Infinity };
}

export function normalPdf(x, mu, sigma) {
  const z = (x - mu) / sigma;
  return Math.exp(-0.5 * z * z) / (sigma * Math.sqrt(2 * Math.PI));
}

/** Стандартна нормальна випадкова величина (Бокс–Мюллер) з детермінованого генератора. */
export function gaussian(next) {
  let u = 0; while (u === 0) u = next();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * next());
}

/**
 * МОДЕЛЬНИЙ експеримент (розширення ТЗ): вплив обсягу вибірки n на ймовірність правильного рішення
 * за максимальною правдоподібністю. Стан Dᵢ ↔ параметр x ~ N(μᵢ, σ). Для кожного n — trials повторень.
 */
export function mlSampleSizeExperiment({ means, sigma, nValues, trials = 400, seed = 'ml' }) {
  const next = mulberry32(hashString(String(seed)));
  const pCorrect = nValues.map((n) => {
    let ok = 0;
    for (let t = 0; t < trials; t++) {
      const truth = t % means.length;
      const xs = Array.from({ length: n }, () => means[truth] + sigma * gaussian(next));
      const lls = means.map((mu) => xs.reduce((a, x) => a + Math.log(normalPdf(x, mu, sigma)), 0));
      let best = 0; lls.forEach((l, i) => { if (l > lls[best]) best = i; });
      if (best === truth) ok++;
    }
    return ok / trials;
  });
  return { nValues, pCorrect };
}
