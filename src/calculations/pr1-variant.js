// ПР1. Генерація відтворюваних індивідуальних варіантів.
// Варіант № 0 — приклад методичних вказівок без змін; решта — модельні.

import { createRng, makeVariantId } from './rng.js';
import { computeBayes } from './bayes.js';
import { GUIDE_EXAMPLE, MODEL_OBJECTS } from '../data/pr1-objects.js';

const SUB = ['₁', '₂', '₃', '₄', '₅', '₆'];
const r05 = (x) => Math.round(x * 20) / 20;

/** Розбиває 1 − pNormal на k частин, кратних 0,05, кожна ≥ 0,05. */
function splitRemainder(rng, units, k) {
  const parts = Array(k).fill(1);
  for (let left = units - k; left > 0; left--) parts[rng.int(0, k - 1)]++;
  return parts.map((u) => u / 20);
}

function labelStates(states) { return states.map((s, i) => `D${SUB[i]} — ${s}`); }
function labelFeatures(fs) { return fs.map((s, i) => `k${SUB[i]} — ${s}`); }

export function guideVariant() {
  return {
    id: 'PR1-МВ-ПРИКЛАД',
    number: 0,
    modelled: false,
    object: GUIDE_EXAMPLE.name,
    source: GUIDE_EXAMPLE.source,
    states: GUIDE_EXAMPLE.states.slice(),
    features: GUIDE_EXAMPLE.features.slice(),
    priors: GUIDE_EXAMPLE.priors.slice(),
    featureProbs: GUIDE_EXAMPLE.featureProbs.map((r) => r.slice()),
    observed: GUIDE_EXAMPLE.observed.slice(),
    threshold: GUIDE_EXAMPLE.threshold,
  };
}

/**
 * @param {string} id ідентифікатор варіанта (PR1-XXXXXXX); той самий id → той самий варіант
 */
export function generateVariant(id, number = 1) {
  if (number === 0) return guideVariant();
  const rng = createRng(id);
  for (let attempt = 0; attempt < 500; attempt++) {
    const obj = rng.pick(MODEL_OBJECTS);
    const n = obj.states.length;
    const m = rng.int(2, Math.min(3, obj.features.length));
    const featIdx = rng.shuffle([...obj.features.keys()]).slice(0, m).sort((a, b) => a - b);

    // Апріорні: нормальний стан (останній) — 0,50…0,85; решта ділять залишок кратно 0,05.
    const pNormal = r05(0.5 + 0.05 * rng.int(0, 7));
    const priors = [...splitRemainder(rng, Math.round((1 - pNormal) * 20), n - 1), pNormal];

    // Діагностична матриця: для несправностей 0,10…0,90; для норми 0,00…0,20.
    const featureProbs = Array.from({ length: n }, (_, i) => featIdx.map(() => (
      i === n - 1 ? r05(0.05 * rng.int(0, 4)) : r05(0.1 + 0.05 * rng.int(0, 16))
    )));
    const observed = featIdx.map(() => rng.next() < 0.6);
    const threshold = rng.pick([0.6, 0.7, 0.8]);

    const v = {
      id, number, modelled: true,
      object: obj.name,
      source: 'Модельний варіант (згенеровано системою за ідентифікатором)',
      states: labelStates(obj.states),
      features: labelFeatures(featIdx.map((k) => obj.features[k])),
      priors, featureProbs, observed, threshold,
    };
    if (isGradable(v)) return v;
  }
  return guideVariant(); // теоретично недосяжно; гарантує коректний варіант
}

/** Варіант придатний для оцінювання: P(K*) > 0, сума апріорних = 1, однозначний максимум. */
export function isGradable(v) {
  try {
    const r = computeBayes(v);
    return Math.abs(v.priors.reduce((a, b) => a + b, 0) - 1) < 1e-9 && r.margin >= 0.03 && r.evidence > 1e-6
      && Math.abs(r.posteriors[r.best] - v.threshold) >= 0.02;
  } catch {
    return false;
  }
}

export function variantFor(profile, number, mode = 'self') {
  if (number === 0) return guideVariant();
  const tag = mode === 'control' ? `К${number}` : String(number);
  const id = makeVariantId(1, profile?.group ?? '', profile?.name ?? '', tag);
  return generateVariant(id, number);
}
