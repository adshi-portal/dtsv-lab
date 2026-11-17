// ПР3 (за РПНД; у МВ — ПР4). Метод максимальної правдоподібності (МВ, с. 14–15).
import { h, raw, clear } from '../../components/dom.js';
import { sub, short, fmt, fmtFixed, slider, formulaStep, questionsStep } from '../../components/trainer.js';
import { barChart, lineChart } from '../../visualization/charts.js';
import { computeLikelihood, mlSampleSizeExperiment } from '../../calculations/likelihood.js';
import { computeBayes } from '../../calculations/bayes.js';
import { variantPR3, guideVariantPR3 } from '../../calculations/variants-234.js';
import { parseNumber } from '../../calculations/numeric.js';
import { getWork } from '../../data/store.js';

const Lb = (i) => `P(K*/D<sub>${i + 1}</sub>)`;
const lnL = (i) => `ln P(K*/D<sub>${i + 1}</sub>)`;
const formulas = `
<div class="formula"><span class="ftext">K* ∈ D<sub>i</sub>, якщо P(K*/D<sub>i</sub>) = max<sub>1≤k≤n</sub> P(K*/D<sub>k</sub>)</span><span class="formula-no">(24)</span></div>
<div class="formula"><span class="ftext">P(K*/D<sub>i</sub>) = P(k<sub>1</sub>*/D<sub>i</sub>) · P(k<sub>2</sub>*/D<sub>i</sub>) · … · P(k<sub>m</sub>*/D<sub>i</sub>)</span><span class="formula-no">(25)</span></div>
<div class="formula"><span class="ftext">ln L(D<sub>i</sub>) = Σ<sub>j</sub> ln P(k<sub>j</sub>*/D<sub>i</sub>)</span><span class="formula-no">ТЗ</span></div>`;
const F = formulas.split('</div>').map((x) => `${x}</div>`);

const theory = [
  { title: 'Суть методу', html: `<p>Метод найбільшої (максимальної) правдоподібності заснований на визначенні діагнозу, який з найбільшою ймовірністю пояснює результати обстеження. Його використовують, коли <b>немає апріорної інформації</b> про ймовірності станів (діагнозів) об'єкта.</p><p>Нехай D<sub>1</sub>, …, D<sub>n</sub> — можливі стани, K* — виявлений комплекс ознак. Ймовірність появи K* за умови, що об'єкт перебуває у стані D<sub>i</sub>, — P(K*/D<sub>i</sub>) (правдоподібність стану). Рішення:</p>${F[0]}` },
  { title: 'Незалежні ознаки', html: `<p>У більшості практичних задач комплекс K* включає кілька незалежних ознак k<sub>1</sub>, …, k<sub>m</sub>, тоді</p>${F[1]}<p>де k<sub>j</sub>* — конкретна реалізація ознаки: для виявленої ознаки береться P(k<sub>j</sub>/D<sub>i</sub>), для відсутньої — 1 − P(k<sub>j</sub>/D<sub>i</sub>).</p>` },
  { title: 'Логарифмічна форма (розширення ТЗ)', html: `<p>Добуток багатьох ймовірностей швидко стає дуже малим числом. Тому на практиці порівнюють логарифми правдоподібності — логарифм монотонний, і максимум не змінюється:</p>${F[2]}<p>Ln L ≤ 0; чим ближче до нуля, тим правдоподібніший стан. Якщо хоч одна ймовірність дорівнює 0, ln L = −∞: стан повністю виключається.</p>` },
  { title: 'Зв’язок з методом Байєса', html: '<p>Метод Байєса максимізує P(D<sub>i</sub>)·P(K*/D<sub>i</sub>). Якщо апріорні ймовірності рівні, обидва методи дають однакове рішення. Якщо ж один стан апріорі значно ймовірніший (наприклад, нормальний), метод правдоподібності може обрати інший діагноз, ніж Байєс.</p>' },
];

const questions = [
  { id: 'q1', prompt: 'У чому полягає суть методу найбільшої правдоподібності?', options: ['Обирається стан, який з найбільшою ймовірністю пояснює виявлений комплекс ознак: max P(K*/Dᵢ)', 'Обирається стан з найбільшою апріорною ймовірністю', 'Обирається стан з мінімальним ризиком', 'Обирається стан з найбільшою апостеріорною ймовірністю'], correct: 0, explain: 'Правило (24): максимум P(K*/Dᵢ).' },
  { id: 'q2', prompt: 'Як розраховується ймовірність появи комплексу ознак?', options: ['Для незалежних ознак — добуток ймовірностей фактичних реалізацій ознак (25)', 'Як сума ймовірностей ознак', 'Як максимум ймовірностей ознак', 'P(K*/Dᵢ) = P(Dᵢ)·ΣP(kⱼ/Dᵢ)'], correct: 0, explain: 'Формула (25).' },
  { id: 'q3', prompt: 'У яких випадках метод найбільшої правдоподібності є ефективним?', options: ['Коли немає надійної апріорної інформації про ймовірності станів або вони близькі', 'Коли один зі станів апріорі значно ймовірніший', 'Коли помилки мають різну вартість', 'Лише для однієї ознаки'], correct: 0, explain: 'Метод не потребує P(Dᵢ); при рівних апріорних збігається з Байєсом.' },
  { id: 'q4', prompt: 'Як впливає кількість ознак на точність діагностики?', options: ['Збільшення кількості незалежних інформативних ознак (обсягу спостережень) підвищує ймовірність правильного рішення', 'Не впливає', 'Будь-яке збільшення кількості ознак знижує точність', 'Точність залежить лише від апріорних ймовірностей'], correct: 0, explain: 'Кожна незалежна ознака додає інформацію; див. модельний експеримент у режимі «Дослідження».' },
  { id: 'q5', prompt: 'Чи можна застосовувати метод, якщо ознаки мають залежність?', options: ['Так, але тоді P(K*/Dᵢ) треба обчислювати через умовні ймовірності (ланцюгове правило), а не простий добуток; добуток дає наближений результат', 'Ні, за жодних умов', 'Так, формула (25) залишається точною', 'Лише якщо ознак дві'], correct: 0, explain: 'Формула (25) точна лише для незалежних ознак; для залежних — P(K*/Dᵢ) = P(k₁/Dᵢ)P(k₂/k₁,Dᵢ)… (формула 9 ПР1).' },
];

function solve(v) {
  const r = computeLikelihood(v);
  const bayes = v.priors ? computeBayes({ ...v, threshold: 0 }) : null;
  return { ...r, bayes };
}

function dataView(v) {
  return h('div', h('ul.legend-states', v.states.map((s) => h('li', s)), v.features.map((f) => h('li.feat', f))),
    h('div.table-wrap', h('table.data', h('thead', h('tr', h('th', 'Стан'), v.features.map((f) => h('th', `P(${short(f)}/Dᵢ)`)))),
      h('tbody', v.states.map((s, i) => h('tr', h('th', short(s)), v.featureProbs[i].map((p) => h('td.num', fmt(p, 2)))))),
      h('tfoot', h('tr', h('th', 'K*'), v.observed.map((o, j) => h('td', o ? `k${sub(j)} є` : `k${sub(j)} немає`)))))),
    v.priors ? h('p.muted.small', `Для порівняння з методом Байєса: P(Dᵢ) = (${v.priors.map((p) => fmt(p, 2)).join('; ')})${v.priorsNote ? ` — ${v.priorsNote}` : ''}. У методі правдоподібності вони не використовуються.`) : null);
}

function steps(v, r, qs) {
  const n = v.states.length; const m = v.observed.length;
  const realized = (o, j) => (o ? `P(k<sub>${j + 1}</sub>/D)` : `P(¬k<sub>${j + 1}</sub>/D)`);
  return [
    { id: 'table', title: 'Таблиця ймовірностей реалізацій ознак', category: 'data', weight: 15, kind: 'numbers', task: 'Заповніть P(k<sub>j</sub>*/D<sub>i</sub>) для виявленого комплексу ознак.',
      grid: { rows: v.states.map(short), cols: v.observed.map(realized), key: (i, j) => `t${i}_${j}` },
      fields: Array.from({ length: n * m }, (_, k) => { const i = Math.floor(k / m); const j = k % m; const p = v.featureProbs[i][j]; return { key: `t${i}_${j}`, label: `${realized(v.observed[j], j)} для D<sub>${i + 1}</sub>`, ref: v.observed[j] ? p : 1 - p,
        explain: (x) => (!v.observed[j] && Math.abs(x - p) < 0.002 ? `Ознаку k${sub(j)} не виявлено: потрібно 1 − ${fmt(p, 2)} = ${fmt(1 - p, 2)}.` : `Перевірте значення з таблиці для D${sub(i)}, k${sub(j)}.`) }; }),
      hint: 'Для відсутньої ознаки — 1 − P(kⱼ/Dᵢ).' },
    formulaStep([
      { id: 'f1', prompt: 'Як обчислити P(K*/Dᵢ) для незалежних ознак?', options: ['Добуток P(kⱼ*/Dᵢ) за всіма ознаками (25)', 'Сума P(kⱼ/Dᵢ)', 'P(Dᵢ)·∏P(kⱼ/Dᵢ)', 'max P(kⱼ*/Dᵢ)'], correct: 0, explain: 'Формула (25).' },
      { id: 'f2', prompt: 'Чи використовуються апріорні ймовірності P(Dᵢ) у методі?', options: ['Ні — рішення приймається за максимумом P(K*/Dᵢ) (24)', 'Так — P(Dᵢ)·P(K*/Dᵢ)', 'Так — для нормування', 'Так — як поріг рішення'], correct: 0, explain: 'Метод застосовують саме тоді, коли апріорної інформації немає.' },
    ], 'Метод правдоподібності не потребує апріорних ймовірностей.'),
    { id: 'like', title: 'Правдоподібності станів P(K*/Dᵢ)', category: 'calc', weight: 25, kind: 'numbers', task: 'Обчисліть P(K*/D<sub>i</sub>) за формулою (25).', formulas: F[1],
      fields: r.likelihoods.map((x, i) => ({ key: `l${i}`, label: Lb(i), ref: x, explain: (y) => (Math.abs(y - v.featureProbs[i].reduce((a, b) => a * b, 1)) < 0.0015 && v.observed.some((o) => !o) ? 'Для відсутньої ознаки потрібно 1 − P(kⱼ/Dᵢ).' : Math.abs(y - r.table[i].reduce((a, b) => a + b, 0)) < 0.002 ? 'Ймовірності незалежних ознак перемножують, а не додають.' : `Перемножте рядок D${sub(i)} таблиці.`) })),
      hint: 'Перемножте значення рядка Dᵢ з кроку 1.' },
    { id: 'log', title: 'Логарифмічна функція правдоподібності', category: 'calc', weight: 10, kind: 'numbers', extension: true, task: 'Обчисліть ln P(K*/D<sub>i</sub>) (натуральний логарифм).', formulas: F[2],
      fields: r.logLikelihoods.map((x, i) => ({ key: `g${i}`, label: lnL(i), ref: x, tol: { abs: 0.01, rel: 0.005 }, explain: (y) => (Math.abs(y - Math.log10(r.likelihoods[i])) < 0.01 ? 'Потрібен натуральний логарифм ln, а не десятковий lg.' : y > 0 ? 'ln ймовірності не може бути додатним.' : `ln ${fmt(r.likelihoods[i], 4)} = ?`) })),
      hint: 'ln L = Σ ln P(kⱼ*/Dᵢ) = ln від результату кроку 3. Значення від’ємні.' },
    { id: 'best', title: 'Найбільш правдоподібний стан', category: 'interpret', weight: 10, kind: 'choice', task: 'Який стан найбільш правдоподібний за правилом (24)?',
      questions: [{ id: 'b', prompt: 'Стан:', options: v.states, correct: r.best, explain: `Максимальна правдоподібність: P(K*/D${sub(r.best)}) = ${fmt(r.likelihoods[r.best], 4)}.` }], hint: 'Порівнюйте P(K*/Dᵢ) (або ln L — максимум той самий).' },
    { id: 'cmp', title: 'Порівняння з методом Байєса', category: 'decision', weight: 10, kind: 'choice',
      task: `Якби були відомі апріорні ймовірності P(D<sub>i</sub>) = (${v.priors.map((p) => fmt(p, 2)).join('; ')}), за Байєсом було б обрано ${short(v.states[r.bayes.best])}. Висновок:`,
      questions: [{ id: 'c', prompt: 'Висновок:', options: ['Рішення методів збігаються', 'Рішення різні: апріорна ймовірність одного зі станів суттєво змінює діагноз — за наявності надійних P(Dᵢ) слід застосовувати метод Байєса'], correct: r.best === r.bayes.best ? 0 : 1,
        explain: `Правдоподібність: ${short(v.states[r.best])}; Байєс: ${short(v.states[r.bayes.best])}.` }], hint: 'Порівняйте стан з максимальним P(K*/Dᵢ) зі станом, обраним за Байєсом.' },
    questionsStep(qs),
  ];
}

function own(v, a) {
  const n = v.states.length; const m = v.observed.length; const o = {};
  for (let i = 0; i < n; i++) {
    let prod = 1; for (let j = 0; j < m; j++) prod *= parseNumber(a[`t${i}_${j}`]);
    o[`l${i}`] = prod; o[`g${i}`] = Math.log(parseNumber(a[`l${i}`]));
  }
  return o;
}

function chart(v, r) {
  const ymax = Math.min(1, Math.ceil(Math.max(...r.likelihoods) * 12) / 10) || 1;
  const series = [{ name: 'правдоподібність P(K*/Dᵢ)', values: r.likelihoods, className: 'post' }];
  return barChart({ title: 'Правдоподібності станів', categories: v.states.map(short), series, yMax: ymax, digits: 4 });
}

function resultTable(v, r) {
  return h('div.table-wrap', h('table.data', h('thead', h('tr', h('th', 'Стан'), h('th', 'P(K*/Dᵢ)'), h('th', 'ln P(K*/Dᵢ)'), v.priors ? h('th', 'P(Dᵢ/K*) за Байєсом') : null)),
    h('tbody', v.states.map((s, i) => h(`tr${i === r.best ? '.best-row' : ''}`, h('th', short(s)), h('td.num', fmtFixed(r.likelihoods[i], 4)), h('td.num', Number.isFinite(r.logLikelihoods[i]) ? fmtFixed(r.logLikelihoods[i], 4) : '−∞'), r.bayes ? h('td.num', fmtFixed(r.bayes.posteriors[i], 4)) : null)))));
}

function analysis(v, r) {
  const out = [`Найбільш правдоподібний стан — ${v.states[r.best]}: P(K*/D${sub(r.best)}) = ${fmt(r.likelihoods[r.best], 4)}.`];
  out.push(`Він пояснює виявлений комплекс ознак у ${Number.isFinite(r.ratio) ? fmt(r.ratio, 2) : '∞'} раза краще за наступний за правдоподібністю стан${r.ratio < 1.5 ? ' — перевага невелика, бажано залучити додаткові ознаки' : ''}.`);
  if (r.bayes) out.push(r.bayes.best === r.best ? `Метод Байєса з апріорними ймовірностями дає те саме рішення (P = ${fmt(r.bayes.posteriors[r.best], 3)}).` : `З урахуванням апріорних ймовірностей метод Байєса обрав би ${short(v.states[r.bayes.best])} (P = ${fmt(r.bayes.posteriors[r.bayes.best], 3)}): апріорна інформація змінює діагноз.`);
  out.push(`Висновок: за методом найбільшої правдоподібності об’єкт відносимо до стану ${short(v.states[r.best])}.`);
  return out;
}

function research(box, ctx) {
  const { section: sec } = ctx;
  const presets = [{ id: 'g', label: 'Приклад МВ', make: guideVariantPR3 }];
  if (ctx.profile) presets.push({ id: 'm', label: 'Мій поточний варіант', make: () => variantPR3(ctx.profile, getWork(3).variantNumber || 1) });
  let v;
  const ctr = h('div.controls'); const out = h('div');
  const load = (p) => { v = p.make(); v = { ...v, featureProbs: v.featureProbs.map((r) => r.slice()), observed: v.observed.slice() }; paint(); compute(); };
  function paint() {
    clear(ctr);
    ctr.append(h('label.inline', 'Об’єкт: ', h('select', { onchange: (e) => load(presets.find((p) => p.id === e.target.value)) }, presets.map((p) => h('option', { value: p.id }, p.label)))),
      h('h3', 'Ймовірності ознак P(kⱼ/Dᵢ)'),
      ...v.featureProbs.map((row, i) => h('div.ms-row', h('b', short(v.states[i])), row.map((p, j) => slider(`P(k<sub>${j + 1}</sub>/D<sub>${i + 1}</sub>)`, p, (x) => { v.featureProbs[i][j] = x; compute(); })))),
      h('h3', 'Результат обстеження K*'), h('div.row', v.observed.map((o, j) => h('label.toggle', h('input', { type: 'checkbox', checked: o, onchange: (e) => { v.observed[j] = e.target.checked; compute(); } }), ` ${v.features[j]}`))));
  }
  function compute() {
    clear(out);
    let r; try { r = solve(v); } catch (e) { out.append(h('div.note.error', e.message)); return; }
    out.append(h('div.decision.acc', `Найбільш правдоподібний стан: ${v.states[r.best]}`), resultTable(v, r), chart(v, r), h('ul', analysis(v, r).map((t) => h('li', t))));
  }
  // Модельний експеримент: обсяг вибірки
  const exp = h('div'); let sigma = 1.2; const means = [2.8, 3.4, 4.0];
  const runExp = () => {
    clear(exp);
    const nValues = Array.from({ length: 30 }, (_, k) => k + 1);
    const res = mlSampleSizeExperiment({ means, sigma, nValues, trials: 450, seed: `pr3|${sigma}` });
    exp.append(lineChart({ xs: nValues, series: [{ name: 'P(правильне рішення)', values: res.pCorrect, className: 's3' }], xLabel: 'обсяг вибірки n, вимірювань', yLabel: 'ймовірність', title: 'Вплив обсягу вибірки на ймовірність правильного діагнозу' }),
      h('p', `При n = 1: ${fmt(res.pCorrect[0], 2)}; n = 10: ${fmt(res.pCorrect[9], 2)}; n = 30: ${fmt(res.pCorrect[29], 2)}.`));
  };
  box.append(sec(6, 'Постановка дослідницької задачі', h('p', 'Змінюйте ймовірності ознак і результат обстеження та простежте, як змінюється найбільш правдоподібний стан. У модельному експерименті оцініть, як обсяг вибірки впливає на точність рішення.')),
    h('div.research-grid', sec(8, 'Параметри', ctr), sec(9, 'Розрахунок', out)),
    sec(10, 'Модельний експеримент: обсяг вибірки (розширення ТЗ, поза МВ)',
      h('p', 'Діагностичний параметр — СКЗ віброшвидкості, мм/с, розподілений нормально: D₁ (знос) — μ = 2,8; D₂ (дисбаланс) — μ = 3,4; D₃ (дефект підшипника) — μ = 4,0; спільне σ. Для кожного n система моделює 450 обстежень і рахує частку правильних рішень за max Σ ln f(xₖ/Dᵢ). Дані модельні.'),
      slider('σ, мм/с', sigma, (x) => { sigma = x; runExp(); }, { min: 0.2, max: 3, step: 0.1, digits: 1 }), exp));
  load(presets[0]); runExp();
}

export const PR3 = {
  n: 3,
  meta: { title: 'Використання методу максимальної правдоподібності для визначення технічного стану', goal: 'Вивчення методу найбільшої правдоподібності для діагностики технічного стану об’єктів.', goalSource: 'МВ, «ПР4» (за РПНД — ПР3), с. 14',
    outcomes: ['РН1 — визначати технічний стан за правдоподібністю результатів обстеження без апріорної інформації.', 'Обчислювати P(K*/Dᵢ) для незалежних ознак (25) і логарифмічну правдоподібність.', 'Приймати рішення за правилом (24) і порівнювати його з рішенням методу Байєса.', 'Оцінювати вплив обсягу вибірки на точність діагнозу.'] },
  theory, formulas, legend: [['P(K*/D<sub>i</sub>)', 'правдоподібність стану Dᵢ — ймовірність появи K* у цьому стані'], ['k<sub>j</sub>*', 'реалізація ознаки (є / немає)'], ['ln L', 'логарифмічна функція правдоподібності']],
  questions, guideVariant: guideVariantPR3, variantFor: variantPR3, solve, dataView, steps, own, chart, resultTable, analysis, research,
  problem: (v) => `Об'єкт — <b>${v.object}</b>. Стани: ${v.states.map((s) => `<i>${s}</i>`).join('; ')}. Обстеження за ознаками ${v.features.map((f) => `<i>${f}</i>`).join('; ')}; ${v.observed.map((o, j) => (o ? `k${sub(j)} виявлено` : `k${sub(j)} відсутня`)).join(', ')}. Апріорних даних про ймовірності станів немає. Визначте стан за методом найбільшої правдоподібності.`,
  learn: {
    intro: '<p>Об\'єкт (газотурбінний двигун) може перебувати в станах D₁ — несправність паливного регулятора, D₂ — збільшення радіального зазору, D₃ — норма. Ознаки: k₁ — підвищення температури більше ніж на 50 °C; k₂ — збільшення часу виходу на максимальну частоту більше ніж на 5 с. Ймовірності — табл. 4 МВ. Виявлено обидві ознаки.</p>',
    walk: (v, r) => [
      ['Крок 1. Таблиця', 'Обидві ознаки виявлено, тому беруться P(k₁/Dᵢ) і P(k₂/Dᵢ) з табл. 4.'],
      ['Крок 2. Правдоподібності за (25)', v.states.map((_, i) => `P(K*/D${sub(i)}) = ${fmt(v.featureProbs[i][0], 1)} · ${fmt(v.featureProbs[i][1], 1)} = <b>${fmt(r.likelihoods[i], 2)}</b>`).join('<br>')],
      ['Крок 3. ln L (розширення ТЗ)', v.states.map((_, i) => `ln P(K*/D${sub(i)}) = ${fmt(r.logLikelihoods[i], 3)}`).join('<br>')],
      ['Крок 4. Рішення за (24)', 'Максимум — D₂ (0,30): найправдоподібніший стан — збільшення радіального зазору.'],
    ],
    notes: [],
  },
  reportTheory: 'Метод найбільшої правдоподібності відносить об’єкт до стану, який з найбільшою ймовірністю пояснює виявлений комплекс ознак: max P(K*/Dᵢ). Для незалежних ознак P(K*/Dᵢ) — добуток ймовірностей фактичних реалізацій ознак. Метод не потребує апріорних ймовірностей станів; при рівних апріорних він збігається з методом Байєса.',
};
