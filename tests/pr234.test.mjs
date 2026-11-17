import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeRisk, riskSweep, switchPoint, RiskInputError } from '../src/calculations/risk.js';
import { computeLikelihood, mlSampleSizeExperiment, normalPdf } from '../src/calculations/likelihood.js';
import { computeMinErrors, bayesErrorRate, alarmMissRates, sampleTraining, confusionOnSample, allRealizations } from '../src/calculations/minerrors.js';
import { variantPR2, variantPR3, variantPR4, guideVariantPR2, guideVariantPR3, guideVariantPR4, posteriorsPR2 } from '../src/calculations/variants-234.js';
import { computeBayes } from '../src/calculations/bayes.js';

const near = (a, b, eps = 1e-4) => assert.ok(Math.abs(a - b) <= eps, `${a} ≉ ${b}`);

test('ПР2, МВ с. 11 (виправлено, П18): R = (1,9; 0,7; 1,1), рішення D₂', () => {
  const v = guideVariantPR2();
  const r = computeRisk(v.losses, v.posteriorsGiven);
  near(r.risks[0], 1.9, 1e-12); near(r.risks[1], 0.7, 1e-12); near(r.risks[2], 1.1, 1e-12);
  assert.equal(r.best, 1);
});

test('ПР2: одинична матриця втрат (0 на діагоналі, 1 поза нею) дає те саме рішення, що й МАР', () => {
  const p = [0.15, 0.25, 0.6];
  const L = [[0, 1, 1], [1, 0, 1], [1, 1, 0]];
  assert.equal(computeRisk(L, p).best, 2);
  near(computeRisk(L, p).risks[2], 0.4, 1e-12);
});

test('ПР2: некоректні дані — від’ємні втрати, неквадратна матриця, сума ≠ 1', () => {
  assert.throws(() => computeRisk([[0, -1], [1, 0]], [0.5, 0.5]), RiskInputError);
  assert.throws(() => computeRisk([[0, 1]], [0.5, 0.5]), RiskInputError);
  assert.throws(() => computeRisk([[0, 1], [1, 0]], [0.5, 0.6]), RiskInputError);
});

test('ПР2: ризик лінійно залежить від λ; точка перемикання існує', () => {
  const v = guideVariantPR2();
  const s = riskSweep(v.losses, v.posteriorsGiven, { i: 1, j: 0 }, 0, 10, 11);
  near(s.series[1][10] - s.series[1][0], 10 * 0.2, 1e-12);
  const sp = switchPoint(v.losses, v.posteriorsGiven, { i: 1, j: 2 }, 0, 20);
  assert.ok(sp && sp.from === 1);
});

test('ПР3, МВ с. 15: L = (0,12; 0,30; 0,02), рішення D₂; ln L', () => {
  const r = computeLikelihood(guideVariantPR3());
  near(r.likelihoods[0], 0.12, 1e-12); near(r.likelihoods[1], 0.30, 1e-12); near(r.likelihoods[2], 0.02, 1e-12);
  assert.equal(r.best, 1);
  near(r.logLikelihoods[1], Math.log(0.3), 1e-12);
});

test('ПР3: ln 0 = −∞ без NaN; усі нулі — зрозуміла помилка', () => {
  const r = computeLikelihood({ featureProbs: [[0, 0.5], [0.5, 0.5]], observed: [true, true] });
  assert.equal(r.logLikelihoods[0], -Infinity); assert.equal(r.best, 1);
  assert.throws(() => computeLikelihood({ featureProbs: [[0], [0]], observed: [true] }));
});

test('ПР3: модельний експеримент — точність зростає з обсягом вибірки, відтворюваний', () => {
  const a = mlSampleSizeExperiment({ means: [10, 11, 12], sigma: 1.5, nValues: [1, 5, 25], trials: 600, seed: 's' });
  const b = mlSampleSizeExperiment({ means: [10, 11, 12], sigma: 1.5, nValues: [1, 5, 25], trials: 600, seed: 's' });
  assert.deepEqual(a, b);
  assert.ok(a.pCorrect[0] < a.pCorrect[1] && a.pCorrect[1] < a.pCorrect[2]);
  assert.ok(a.pCorrect[2] > 0.9);
  near(normalPdf(0, 0, 1), 0.398942, 1e-6);
});

test('ПР4, МВ с. 13 (виправлено): (0,140; 0,698; 0,163), Pпом = 0,302', () => {
  const r = computeMinErrors(guideVariantPR4());
  near(r.posteriors[0], 0.1395); near(r.posteriors[1], 0.6977); near(r.posteriors[2], 0.1628);
  near(r.pError, 0.3023); assert.equal(r.best, 1);
});

test('ПР4: МАР мінімізує середню ймовірність помилки (будь-яке інше правило не краще)', () => {
  const v = guideVariantPR4();
  const pe = bayesErrorRate(v);
  // правило «завжди найімовірніший апріорі стан» дає 1 − 0,7 = 0,3
  assert.ok(pe <= 0.3 + 1e-12);
  // перевірка: Σ_K P(K) = 1
  const tot = allRealizations(2).reduce((a, obs) => a + computeBayes({ ...v, observed: obs }).evidence, 0);
  near(tot, 1, 1e-12);
});

test('ПР4: хибна тривога зростає, пропуск зменшується зі зростанням порогу', () => {
  const v = guideVariantPR4();
  const a = alarmMissRates(v, 0.2); const b = alarmMissRates(v, 0.95);
  assert.ok(b.alarm >= a.alarm && b.miss <= a.miss);
  const z = alarmMissRates(v, 0); near(z.alarm, 0, 1e-12); near(z.miss, 1, 1e-12);
  const o = alarmMissRates(v, 1.0001); near(o.alarm, 1, 1e-12); near(o.miss, 0, 1e-12);
});

test('ПР4: навчальна вибірка — оцінки збігаються з істинними при великому N', () => {
  const v = guideVariantPR4();
  const s = sampleTraining(v, 20000, 'x');
  near(s.estimate.priors[2], 0.7, 0.02); near(s.estimate.featureProbs[1][1], 0.6, 0.03);
  const c = confusionOnSample(v, 500, 0.5, 'y');
  assert.equal(c.TP + c.FP + c.TN + c.FN, 500);
});

test('варіанти ПР2–ПР4: відтворювані та коректні (по 300)', () => {
  const p = { name: 'Тест Тестович', group: 'ПМ-1' };
  for (let k = 1; k <= 300; k++) {
    const v2 = variantPR2(p, k); assert.deepEqual(v2, variantPR2(p, k));
    const r2 = computeRisk(v2.losses, posteriorsPR2(v2)); assert.ok(r2.margin >= 0.05);
    v2.losses.forEach((r, i) => assert.equal(r[i], 0));
    const v3 = variantPR3(p, k); const r3 = computeLikelihood(v3); assert.ok(r3.ratio >= 1.1);
    assert.ok(r3.logLikelihoods.every(Number.isFinite));
    const v4 = variantPR4(p, k); assert.ok(computeMinErrors(v4).margin >= 0.03);
  }
  assert.notEqual(variantPR2(p, 1, 'control').id, variantPR2(p, 1, 'self').id);
});
