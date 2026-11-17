import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateVariant, guideVariant, isGradable, variantFor } from '../src/calculations/pr1-variant.js';
import { makeVariantId, hashString, mulberry32 } from '../src/calculations/rng.js';
import { computeBayes } from '../src/calculations/bayes.js';
import { summarize, stepFactor, levelOf } from '../src/calculations/grading.js';
import { parseNumber, withinTolerance, fmt } from '../src/calculations/numeric.js';

test('генератор: однаковий id → однаковий варіант (відтворюваність)', () => {
  const a = generateVariant('PR1-TEST123', 3);
  const b = generateVariant('PR1-TEST123', 3);
  assert.deepEqual(a, b);
  assert.notDeepEqual(generateVariant('PR1-TEST124', 3), a);
});

test('ідентифікатор не залежить від регістру та зайвих пробілів', () => {
  assert.equal(makeVariantId(1, 'ПМ-23б', 'Іваненко  Петро', 2), makeVariantId(1, ' пм-23б ', 'іваненко петро', 2));
  assert.notEqual(makeVariantId(1, 'ПМ-23б', 'Іваненко Петро', 2), makeVariantId(1, 'ПМ-23б', 'Іваненко Петро', 3));
});

test('2000 варіантів: усі математично коректні й придатні для оцінювання', () => {
  for (let k = 0; k < 2000; k++) {
    const v = generateVariant(`PR1-${k}`, k + 1);
    assert.ok(v.modelled);
    const s = v.priors.reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(s - 1) < 1e-9, `сума апріорних ${s}`);
    v.priors.forEach((p) => assert.ok(p >= 0.05 - 1e-12 && p <= 0.95));
    v.featureProbs.flat().forEach((p) => assert.ok(p >= 0 && p <= 1));
    assert.equal(v.featureProbs[0].length, v.features.length);
    assert.equal(v.priors.length, v.states.length);
    const r = computeBayes(v);
    assert.ok(r.evidence > 0 && r.margin >= 0.03);
    assert.ok(isGradable(v));
  }
});

test('варіант 0 — точний приклад МВ', () => {
  const v = guideVariant();
  assert.equal(v.modelled, false);
  assert.deepEqual(v.priors, [0.05, 0.15, 0.8]);
  assert.deepEqual(variantFor({ name: 'X', group: 'Y' }, 0), v);
});

test('контрольний варіант відрізняється від варіанта самостійної роботи з тим самим номером', () => {
  const p = { name: 'Петренко Ольга', group: 'ПМ-23' };
  assert.notEqual(variantFor(p, 1, 'self').id, variantFor(p, 1, 'control').id);
});

test('PRNG: mulberry32 у [0,1), hash стабільний', () => {
  const r = mulberry32(hashString('abc'));
  for (let i = 0; i < 1000; i++) { const x = r(); assert.ok(x >= 0 && x < 1); }
  assert.equal(hashString('abc'), 440920331);
});

test('розбір введених чисел: кома, крапка, пробіли, сміття', () => {
  assert.equal(parseNumber('0,091'), 0.091);
  assert.equal(parseNumber(' 0.5 '), 0.5);
  assert.equal(parseNumber('.25'), 0.25);
  assert.ok(Number.isNaN(parseNumber('')));
  assert.ok(Number.isNaN(parseNumber('abc')));
  assert.ok(Number.isNaN(parseNumber('0,1,2')));
  assert.ok(Number.isNaN(parseNumber('1/3')));
});

test('допуск: округлення до 3 знаків приймається, грубе — ні', () => {
  assert.ok(withinTolerance(0.091, 0.0909));
  assert.ok(withinTolerance(0.909, 0.90909));
  assert.ok(!withinTolerance(0.1, 0.0909));
  assert.ok(withinTolerance(0, 0));
  assert.ok(!withinTolerance(NaN, 0));
  assert.equal(fmt(0.09090909, 4), '0,0909');
});

test('оцінювання: штрафи за підказки й повторні спроби, рівні РПНД', () => {
  assert.equal(stepFactor({ attempts: 1, hints: 0 }), 1);
  assert.equal(stepFactor({ attempts: 2, hints: 0 }), 0.5);
  assert.equal(stepFactor({ attempts: 1, hints: 1 }), 0.75);
  assert.equal(stepFactor({ attempts: 5, hints: 3 }), 0);
  assert.equal(stepFactor({ attempts: 1, hints: 0, revealed: true }), 0);
  const s = summarize([
    { category: 'calc', weight: 50, earned: 50 },
    { category: 'questions', weight: 50, earned: 40 },
  ]);
  assert.equal(s.percent, 90); assert.equal(s.ects, 'A');
  assert.equal(s.maxPoints, 6.25); assert.equal(summarize([{ category: 'calc', weight: 1, earned: 1 }], 7).maxPoints, 6);
  assert.equal([1, 2, 3, 4].reduce((a) => a + 6.25, 0) + [5, 6, 7, 8, 9].reduce((a) => a + 6, 0), 55);
  assert.equal(levelOf(89.9).ects, 'B'); assert.equal(levelOf(60).ects, 'E'); assert.equal(levelOf(59).ects, 'FX'); assert.equal(levelOf(34).ects, 'F');
});
