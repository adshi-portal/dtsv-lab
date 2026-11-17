import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeBayes, validateInput, workingTable, probsFromCounts, updateMatrix, sweep, setPrior, BayesInputError,
} from '../src/calculations/bayes.js';
import { GUIDE_EXAMPLE } from '../src/data/pr1-objects.js';

const near = (a, b, eps = 1e-4) => assert.ok(Math.abs(a - b) <= eps, `${a} ≉ ${b}`);
const base = { priors: GUIDE_EXAMPLE.priors, featureProbs: GUIDE_EXAMPLE.featureProbs };

test('МВ с. 8: обидві ознаки виявлені → P(D/k1k2) = (0,0909; 0,9091; 0)', () => {
  const r = computeBayes({ ...base, observed: [true, true] });
  near(r.posteriors[0], 0.0909); near(r.posteriors[1], 0.9091); near(r.posteriors[2], 0);
  near(r.evidence, 0.033, 1e-12);
  assert.equal(r.best, 1);
});

test('МВ с. 9: ¬k1 k2 → (0,1237; 0,4639; 0,4124), у МВ 0,12; 0,46; 0,41', () => {
  const r = computeBayes({ ...base, observed: [false, true] });
  near(r.posteriors[0], 0.1237); near(r.posteriors[1], 0.4639); near(r.posteriors[2], 0.4124);
  near(r.joints[0], 0.012, 1e-12); near(r.joints[1], 0.045, 1e-12); near(r.joints[2], 0.04, 1e-12);
});

test('МВ с. 9: ¬k1 ¬k2 → D3 = 0,912 (у МВ помилково 0,92, суперечність П1)', () => {
  const r = computeBayes({ ...base, observed: [false, false] });
  near(r.posteriors[0], 0.0336); near(r.posteriors[1], 0.0540); near(r.posteriors[2], 0.9124);
  assert.notEqual(Math.round(r.posteriors[2] * 100) / 100, 0.92);
});

test('МВ ПР3 с. 12–13 (виправлено, П3): (0,140; 0,698; 0,163)', () => {
  const r = computeBayes({ priors: [0.1, 0.2, 0.7], featureProbs: [[0.3, 0.4], [0.5, 0.6], [0.1, 0.2]], observed: [true, true] });
  near(r.posteriors[0], 0.1395); near(r.posteriors[1], 0.6977); near(r.posteriors[2], 0.1628);
});

test('формула (13): сума апостеріорних = 1 для всіх 4 реалізацій', () => {
  for (const obs of [[1, 1], [1, 0], [0, 1], [0, 0]]) {
    const r = computeBayes({ ...base, observed: obs.map(Boolean) });
    near(r.posteriorSum, 1, 1e-12);
  }
});

test('робоча таблиця: відсутня ознака → 1 − P(k/D)', () => {
  const t = workingTable([[0.2, 0.3]], [false, true]);
  near(t[0][0], 0.8, 1e-12); near(t[0][1], 0.3, 1e-12);
});

test('поріг (19)–(20): прийняття і відмова від розпізнавання', () => {
  const r1 = computeBayes({ ...base, observed: [false, true], threshold: 0.7 });
  assert.equal(r1.accepted, false); // max 0,464 < 0,7
  const r2 = computeBayes({ ...base, observed: [true, true], threshold: 0.7 });
  assert.equal(r2.accepted, true);
  const r3 = computeBayes({ ...base, observed: [true, true], threshold: 0.03 / 0.033 });
  assert.equal(r3.accepted, true, 'рівність порогу — діагноз приймається (≥)');
});

test('граничний випадок: P(K*) = 0 → зрозуміла помилка, без NaN', () => {
  assert.throws(
    () => computeBayes({ priors: [0.5, 0.5], featureProbs: [[0, 1], [0, 1]], observed: [true, true] }),
    (e) => e instanceof BayesInputError && e.code === 'zero-evidence',
  );
});

test('граничний випадок: детермінувальна ознака дає апостеріорну 1', () => {
  const r = computeBayes({ priors: [0.5, 0.5], featureProbs: [[1], [0]], observed: [true] });
  near(r.posteriors[0], 1, 1e-12);
});

test('некоректні дані: сума апріорних ≠ 1, ймовірності поза [0;1], NaN, розміри', () => {
  assert.ok(validateInput({ priors: [0.5, 0.6], featureProbs: [[0.1], [0.2]], observed: [true] }).length);
  assert.ok(validateInput({ priors: [0.5, 0.5], featureProbs: [[1.2], [0.2]], observed: [true] }).length);
  assert.ok(validateInput({ priors: [0.5, NaN], featureProbs: [[0.1], [0.2]], observed: [true] }).length);
  assert.ok(validateInput({ priors: [0.5, 0.5], featureProbs: [[0.1, 0.2], [0.2]], observed: [true, true] }).length);
  assert.ok(validateInput({ priors: [1], featureProbs: [[0.1]], observed: [true] }).length);
  assert.throws(() => computeBayes({ priors: [0.5, 0.6], featureProbs: [[0.1], [0.2]], observed: [true] }), BayesInputError);
});

test('формули (3)–(5): ймовірності за частотами', () => {
  const r = probsFromCounts({ N: 100, Ni: [5, 15, 80], Nij: [[1, 2], [6, 7], [0, 4]] });
  near(r.priors[1], 0.15, 1e-12); near(r.featureProbs[1][0], 0.4, 1e-12); near(r.featureMarginals[0], 0.07, 1e-12);
  assert.throws(() => probsFromCounts({ N: 10, Ni: [5, 6], Nij: [[1], [1]] }));
});

test('формули (16)–(17): уточнення матриці; форма МВ не нормована, узгоджена — нормована', () => {
  const counts = { N: 100, Ni: [5, 15, 80], Nij: [[1, 2], [6, 8], [0, 4]] };
  const u = updateMatrix(counts, 1, [true, false]);
  near(u.priorsSum, 1, 1e-12);
  near(u.priors[1], 16 / 101, 1e-12); near(u.priors[0], 5 / 101, 1e-12);
  // МВ (17): (6+1)/(15+2), (9+0)/(15+2) → сума 16/17
  near(u.guide[0].pYes, 7 / 17, 1e-12); near(u.guide[0].sum, 16 / 17, 1e-12);
  // узгоджена: (6+1)/16, (9)/16 → сума 1
  near(u.normalized[0].pYes, 7 / 16, 1e-12); near(u.normalized[0].sum, 1, 1e-12);
  near(u.normalized[1].pNo, (7 + 1) / 16, 1e-12);
  assert.deepEqual(u.newCounts.Ni, [5, 16, 80]);
  assert.deepEqual(u.newCounts.Nij[1], [7, 8]);
});

test('дослідження: setPrior зберігає суму 1, sweep дає монотонну залежність від P(D1)', () => {
  const p = setPrior([0.05, 0.15, 0.8], 0, 0.3);
  near(p.reduce((a, b) => a + b, 0), 1, 1e-12);
  const s = sweep({ ...base, observed: [true, true] }, { type: 'prior', i: 0 }, 21);
  assert.equal(s.xs.length, 21);
  for (let k = 1; k < 21; k++) assert.ok(s.series[0][k] >= s.series[0][k - 1] - 1e-12);
  near(s.series[0][20], 1, 1e-12);
});
