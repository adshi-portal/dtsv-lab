// ПР1. Опис кроків виконання і логіка перевірки (без DOM — тестується окремо).
import { computeBayes, workingTable } from '../../calculations/bayes.js';
import { parseNumber, withinTolerance, fmt, sum } from '../../calculations/numeric.js';
import { POLICY } from '../../calculations/grading.js';
import { FORMULA_CHOICES } from './content.js';

const SUBS = ['₁', '₂', '₃', '₄', '₅'];
export const sub = (i) => SUBS[i] ?? String(i + 1);

/**
 * Кроки ПР1. Ваги дають 100 % (див. специфікацію, розд. 4).
 * kind: 'numbers' — числові поля; 'choice' — вибір варіанта(ів).
 */
export function buildSteps(v, questions) {
  const n = v.priors.length;
  const m = v.observed.length;
  const r = computeBayes(v);
  const steps = [
    {
      id: 'table', title: 'Робоча таблиця ймовірностей реалізацій ознак', category: 'data', weight: 15, kind: 'numbers',
      task: 'Заповніть робочу таблицю P(kⱼ*/Dᵢ): для виявленої ознаки — P(kⱼ/Dᵢ), для відсутньої — 1 − P(kⱼ/Dᵢ).',
      formulaRefs: ['notK', 'realized'],
      fields: Array.from({ length: n }, (_, i) => Array.from({ length: m }, (_, j) => ({
        key: `t${i}_${j}`, i, j, ref: r.table[i][j],
      }))).flat(),
      hint: 'Подивіться на реалізацію K*: якщо ознаку kⱼ не виявлено, потрібна ймовірність її відсутності P(¬kⱼ/Dᵢ) = 1 − P(kⱼ/Dᵢ).',
    },
    {
      id: 'formula', title: 'Вибір розрахункових формул', category: 'formulas', weight: 10, kind: 'choice',
      task: 'Оберіть формули, за якими виконується розрахунок.',
      questions: FORMULA_CHOICES,
      hint: 'Ознаки діагностично незалежні; апостеріорна ймовірність має враховувати і апріорну ймовірність, і нормування на P(K*).',
    },
    {
      id: 'like', title: 'Ймовірності комплексу ознак P(K*/Dᵢ)', category: 'calc', weight: 10, kind: 'numbers',
      task: 'Обчисліть P(K*/Dᵢ) для кожного стану за формулою (10).', formulaRefs: ['product'],
      fields: r.likelihoods.map((ref, i) => ({ key: `l${i}`, i, ref })),
      hint: 'Перемножте значення робочої таблиці в рядку Dᵢ.',
    },
    {
      id: 'joint', title: 'Спільні ймовірності P(DᵢK*)', category: 'calc', weight: 8, kind: 'numbers',
      task: 'Обчисліть P(DᵢK*) = P(Dᵢ)·P(K*/Dᵢ) за формулою (14).', formulaRefs: ['jointK'],
      fields: r.joints.map((ref, i) => ({ key: `j${i}`, i, ref })),
      hint: 'Помножте P(K*/Dᵢ) на апріорну ймовірність P(Dᵢ) з діагностичної матриці.',
    },
    {
      id: 'evidence', title: 'Ймовірність комплексу ознак P(K*)', category: 'calc', weight: 5, kind: 'numbers',
      task: 'Обчисліть P(K*) як суму спільних ймовірностей (формула 11).', formulaRefs: ['evidence'],
      fields: [{ key: 'e', ref: r.evidence }],
      hint: 'Додайте всі P(DᵢK*), отримані на попередньому кроці.',
    },
    {
      id: 'post', title: 'Апостеріорні ймовірності P(Dᵢ/K*)', category: 'calc', weight: 12, kind: 'numbers',
      task: 'Обчисліть P(Dᵢ/K*) = P(DᵢK*)/P(K*) (формула 15) і перевірте, що їх сума дорівнює 1 (формула 13).', formulaRefs: ['posterior'],
      fields: r.posteriors.map((ref, i) => ({ key: `p${i}`, i, ref })),
      hint: 'Поділіть кожну спільну ймовірність на P(K*). Сума результатів має дорівнювати 1.',
    },
    {
      id: 'diag', title: 'Найбільш імовірний стан', category: 'interpret', weight: 10, kind: 'choice',
      task: 'Який стан об’єкта найбільш імовірний за вирішальним правилом (18)?',
      questions: [{
        id: 'best', prompt: 'Найбільш імовірний стан:', options: v.states, correct: r.best,
        explain: `Найбільша апостеріорна ймовірність: P(D${sub(r.best)}/K*) = ${fmt(r.posteriors[r.best], 4)}.`,
      }],
      hint: 'Порівнюйте апостеріорні, а не апріорні ймовірності.',
    },
    {
      id: 'decision', title: 'Рішення про діагноз', category: 'decision', weight: 10, kind: 'choice',
      task: `Поріг розпізнавання Pₗ = ${fmt(v.threshold, 2)}. Яке технічне рішення слід прийняти (формули 19–20)?`,
      questions: [{
        id: 'acc', prompt: 'Рішення:', options: [
          `Діагноз D${sub(r.best)} прийнято: P(D${sub(r.best)}/K*) ≥ Pₗ, об’єкт направляють на відповідне обслуговування / ремонт`,
          `Відмова від розпізнавання: P(D${sub(r.best)}/K*) < Pₗ, потрібне додаткове обстеження (нові ознаки)`,
        ], correct: r.accepted ? 0 : 1,
        explain: `P(D${sub(r.best)}/K*) = ${fmt(r.posteriors[r.best], 4)} ${r.accepted ? '≥' : '<'} Pₗ = ${fmt(v.threshold, 2)}.`,
      }],
      hint: 'Порівняйте найбільшу апостеріорну ймовірність із порогом Pₗ.',
    },
  ];
  if (questions?.length) {
    steps.push({
      id: 'questions', title: 'Контрольні запитання', category: 'questions', weight: 20, kind: 'choice',
      task: 'Дайте відповіді на контрольні запитання.', questions,
      hint: null,
    });
  }
  return { steps, result: r };
}

/** Значення, яких очікувало б правильне продовження ВЛАСНИХ даних студента (follow-through). */
function ownExpectations(v, answers) {
  const n = v.priors.length;
  const m = v.observed.length;
  const val = (k) => parseNumber(answers[k]);
  const table = Array.from({ length: n }, (_, i) => Array.from({ length: m }, (_, j) => val(`t${i}_${j}`)));
  const like = table.map((row) => row.reduce((a, b) => a * b, 1));
  const likeS = Array.from({ length: n }, (_, i) => val(`l${i}`));
  const joint = likeS.map((l, i) => v.priors[i] * l);
  const jointS = Array.from({ length: n }, (_, i) => val(`j${i}`));
  const evid = sum(jointS);
  const evidS = val('e');
  const post = jointS.map((j) => j / evidS);
  return { l: like, j: joint, e: evid, p: post };
}

/** Діагностика типових помилок: повертає пояснення українською. */
function explainField(v, r, field, value) {
  const { key } = field;
  const t = (x) => withinTolerance(value, x);
  if (key.startsWith('t')) {
    const { i, j } = field;
    const p = v.featureProbs[i][j];
    if (!v.observed[j] && t(p)) return `Ознаку k${sub(j)} не виявлено: потрібно P(¬k${sub(j)}/D${sub(i)}) = 1 − ${fmt(p, 2)} = ${fmt(1 - p, 2)}.`;
    if (v.observed[j] && t(1 - p) && p !== 0.5) return `Ознаку k${sub(j)} виявлено: береться P(k${sub(j)}/D${sub(i)}) = ${fmt(p, 2)} без змін.`;
    return `Перевірте значення з діагностичної матриці для D${sub(i)} і ознаки k${sub(j)}.`;
  }
  if (key.startsWith('l')) {
    const { i } = field;
    if (t(sum(r.table[i]))) return 'Ви додали ймовірності; для незалежних ознак їх перемножують (формула 10).';
    if (t(v.featureProbs[i].reduce((a, b) => a * b, 1))) return 'Для відсутньої ознаки потрібно брати 1 − P(kⱼ/Dᵢ), а не P(kⱼ/Dᵢ).';
    if (t(r.joints[i])) return 'Це вже спільна ймовірність P(DᵢK*): на цьому кроці апріорну ймовірність ще не враховують.';
    return `Перемножте значення рядка D${sub(i)} робочої таблиці.`;
  }
  if (key.startsWith('j')) {
    const { i } = field;
    if (t(r.likelihoods[i])) return `Не враховано апріорну ймовірність: P(D${sub(i)}K*) = P(D${sub(i)}) · P(K*/D${sub(i)}) (формула 14).`;
    if (t(r.posteriors[i])) return 'Це апостеріорна ймовірність; на цьому кроці потрібна спільна ймовірність без ділення на P(K*).';
    return `P(D${sub(i)}K*) = ${fmt(v.priors[i], 2)} · P(K*/D${sub(i)}).`;
  }
  if (key === 'e') {
    if (t(sum(r.likelihoods))) return 'P(K*) — сума добутків P(Dₛ)·P(K*/Dₛ), а не сума P(K*/Dₛ) (формула 11).';
    if (t(1)) return 'P(K*) — ймовірність появи саме цього комплексу ознак; вона, як правило, менша за 1.';
    return 'Додайте всі спільні ймовірності P(DᵢK*).';
  }
  if (key.startsWith('p')) {
    const { i } = field;
    if (t(r.joints[i])) return 'Не виконано нормування: спільну ймовірність потрібно поділити на P(K*) (формула 15).';
    const lsum = sum(r.likelihoods);
    if (lsum > 0 && t(r.likelihoods[i] / lsum)) return 'Не враховано апріорні ймовірності P(Dᵢ) — це результат методу максимальної правдоподібності, а не Байєса.';
    if (t(r.likelihoods[i])) return 'Це правдоподібність P(K*/Dᵢ), а не апостеріорна ймовірність.';
    if (t(v.priors[i])) return 'Це апріорна ймовірність: результати обстеження не враховано.';
    return `P(D${sub(i)}/K*) = P(D${sub(i)}K*) / P(K*).`;
  }
  return '';
}

/**
 * Перевіряє числовий крок.
 * @param followThrough зараховувати правильну дію на власних хибних даних (режими «Самостійне», «Контроль»)
 * @returns {{status: Record<string,'ok'|'carried'|'wrong'|'empty'>, messages: Record<string,string>, fraction:number, allOk:boolean}}
 */
export function checkNumbers(v, r, step, answers, { followThrough = false } = {}) {
  const own = followThrough ? ownExpectations(v, answers) : null;
  const status = {}; const messages = {};
  let credit = 0;
  for (const f of step.fields) {
    const value = parseNumber(answers[f.key]);
    if (!Number.isFinite(value)) { status[f.key] = 'empty'; messages[f.key] = 'Введіть число (десятковий роздільник — кома або крапка).'; continue; }
    if (withinTolerance(value, f.ref)) { status[f.key] = 'ok'; credit += 1; continue; }
    if (own) {
      const prefix = f.key[0];
      const ownVal = prefix === 'e' ? own.e : own[prefix]?.[f.i];
      if (Number.isFinite(ownVal) && withinTolerance(value, ownVal)) {
        status[f.key] = 'carried';
        messages[f.key] = 'Дія виконана правильно, але на основі вашого хибного значення з попереднього кроку.';
        credit += POLICY.carriedFactor;
        continue;
      }
    }
    status[f.key] = 'wrong';
    messages[f.key] = explainField(v, r, f, value);
  }
  const fraction = step.fields.length ? credit / step.fields.length : 0;
  return { status, messages, fraction, allOk: Object.values(status).every((s) => s === 'ok') };
}

export function checkChoice(step, answers) {
  const status = {}; const messages = {};
  let ok = 0;
  for (const q of step.questions) {
    const a = answers[`${step.id}:${q.id}`];
    if (a === undefined || a === null || a === '') { status[q.id] = 'empty'; messages[q.id] = 'Оберіть відповідь.'; continue; }
    if (Number(a) === q.correct) { status[q.id] = 'ok'; ok++; } else { status[q.id] = 'wrong'; messages[q.id] = q.explain; }
  }
  const fraction = step.questions.length ? ok / step.questions.length : 0;
  return { status, messages, fraction, allOk: ok === step.questions.length };
}

export function checkStep(v, r, step, answers, opts) {
  return step.kind === 'numbers' ? checkNumbers(v, r, step, answers, opts) : checkChoice(step, answers);
}

/** Відповіді, що заповнюють крок правильними значеннями (для «Показати відповідь»). */
export function solutionFor(step) {
  const a = {};
  if (step.kind === 'numbers') step.fields.forEach((f) => { a[f.key] = fmt(f.ref, 4); });
  else step.questions.forEach((q) => { a[`${step.id}:${q.id}`] = String(q.correct); });
  return a;
}

export function tableForReport(v, r) {
  return { table: workingTable(v.featureProbs, v.observed), ...r };
}
