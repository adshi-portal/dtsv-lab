// Відтворювані варіанти ПР2–ПР4. Варіант № 0 — приклад МВ; решта — модельні,
// побудовані на каталозі об'єктів ПР1 (той самий генератор діагностичних матриць).
import { generateVariant } from './pr1-variant.js';
import { makeVariantId, createRng } from './rng.js';
import { computeBayes } from './bayes.js';
import { computeRisk } from './risk.js';
import { computeLikelihood } from './likelihood.js';

const GTE = ['D₁ — несправність паливного регулятора', 'D₂ — збільшення радіального зазору в турбіні', 'D₃ — нормальний стан двигуна'];
const GTE_F = ['k₁ — підвищення температури газу за турбіною більше ніж на 50 °C', 'k₂ — збільшення часу виходу на максимальну частоту обертання більше ніж на 5 с'];

function idFor(work, profile, number, mode) {
  return makeVariantId(work, profile?.group ?? '', profile?.name ?? '', mode === 'control' ? `К${number}` : String(number));
}

// ───────────── ПР2 ─────────────
export function guideVariantPR2() {
  return {
    id: 'PR2-МВ-ПРИКЛАД', number: 0, modelled: false, source: 'Методичні вказівки, ПР2, с. 10–11, табл. 3',
    object: 'Газотурбінний двигун', states: GTE.slice(), features: [], posteriorsGiven: [0.2, 0.5, 0.3],
    losses: [[0, 2, 3], [2, 0, 1], [3, 1, 0]],
  };
}

export function lossesFor(rng, n) {
  const N = n - 1; // останній — нормальний стан
  return Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => {
    if (i === j) return 0;
    if (i === N) return rng.int(5, 10);   // прийнято «норма», а насправді дефект — пропуск дефекту
    if (j === N) return rng.int(1, 3);    // прийнято дефект, а насправді норма — хибна тривога
    return rng.int(1, 4);                 // переплутано дефекти
  }));
}

export function variantPR2(profile, number, mode = 'self') {
  if (number === 0) return guideVariantPR2();
  const id = idFor(2, profile, number, mode);
  for (let k = 0; k < 300; k++) {
    const base = generateVariant(`${id}#${k}`, number);
    const rng = createRng(`${id}|losses|${k}`);
    const losses = lossesFor(rng, base.priors.length);
    const post = computeBayes(base).posteriors;
    const rr = computeRisk(losses, post);
    if (rr.margin >= 0.05) return { ...base, id, losses, threshold: undefined };
  }
  return guideVariantPR2();
}

export function posteriorsPR2(v) { return v.posteriorsGiven ?? computeBayes(v).posteriors; }

// ───────────── ПР3 ─────────────
export function guideVariantPR3() {
  return {
    id: 'PR3-МВ-ПРИКЛАД', number: 0, modelled: false, source: 'Методичні вказівки, «ПР4» (за РПНД — ПР3), с. 14–15, табл. 4',
    object: 'Газотурбінний двигун', states: GTE.slice(), features: GTE_F.slice(),
    featureProbs: [[0.3, 0.4], [0.5, 0.6], [0.1, 0.2]], observed: [true, true],
    priors: [0.1, 0.2, 0.7], priorsNote: 'апріорні ймовірності для порівняння — з табл. 5 МВ (той самий двигун)',
  };
}

export function variantPR3(profile, number, mode = 'self') {
  if (number === 0) return guideVariantPR3();
  const id = idFor(3, profile, number, mode);
  for (let k = 0; k < 300; k++) {
    const b = generateVariant(`${id}#${k}`, number);
    const flat = b.featureProbs.flat();
    if (flat.some((p) => p <= 0 || p >= 1)) continue; // без нульових правдоподібностей (ln 0)
    const r = computeLikelihood(b);
    if (r.ratio >= 1.1) return { ...b, id, threshold: undefined };
  }
  return guideVariantPR3();
}

// ───────────── ПР4 ─────────────
export function guideVariantPR4() {
  return {
    id: 'PR4-МВ-ПРИКЛАД', number: 0, modelled: false, source: 'Методичні вказівки, «ПР3» (за РПНД — ПР4), с. 12–13, табл. 5',
    object: 'Газотурбінний двигун', states: GTE.slice(), features: GTE_F.slice(),
    priors: [0.1, 0.2, 0.7], featureProbs: [[0.3, 0.4], [0.5, 0.6], [0.1, 0.2]], observed: [true, true],
  };
}

export function variantPR4(profile, number, mode = 'self') {
  if (number === 0) return guideVariantPR4();
  const id = idFor(4, profile, number, mode);
  const b = generateVariant(id, number);
  return { ...b, id, threshold: undefined };
}
