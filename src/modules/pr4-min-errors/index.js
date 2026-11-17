// ПР4 (за РПНД; у МВ — ПР3). Метод мінімальної кількості помилкових рішень (МВ, с. 12–13).
import { h, raw, clear } from '../../components/dom.js';
import { sub, short, fmt, fmtFixed, slider, formulaStep, questionsStep } from '../../components/trainer.js';
import { barChart, lineChart } from '../../visualization/charts.js';
import { computeMinErrors, alarmMissRates, sampleTraining, confusionOnSample, bayesErrorRate } from '../../calculations/minerrors.js';
import { computeBayes } from '../../calculations/bayes.js';
import { variantPR4, guideVariantPR4 } from '../../calculations/variants-234.js';
import { parseNumber } from '../../calculations/numeric.js';
import { getWork } from '../../data/store.js';

const formulas = `
<div class="formula"><span class="ftext">K* ∈ D<sub>i</sub>, якщо P(D<sub>i</sub>/K*) = max<sub>1≤k≤n</sub> P(D<sub>k</sub>/K*)</span><span class="formula-no">(26)</span></div>
<div class="formula"><span class="ftext">P(D<sub>i</sub>/K*) = P(K*/D<sub>i</sub>)P(D<sub>i</sub>) / Σ<sub>j</sub> P(K*/D<sub>j</sub>)P(D<sub>j</sub>)</span><span class="formula-no">(27)</span></div>
<div class="formula"><span class="ftext">P(K*/D<sub>i</sub>) = P(k<sub>1</sub>/D<sub>i</sub>) · P(k<sub>2</sub>/D<sub>i</sub>)</span><span class="formula-no">(28)</span></div>
<div class="formula"><span class="ftext">P<sub>пом</sub> = 1 − max<sub>i</sub> P(D<sub>i</sub>/K*)</span><span class="formula-no">—</span></div>`;
const F = formulas.split('</div>').map((x) => `${x}</div>`);

const theory = [
  { title: 'Суть методу', html: `<p>Метод мінімальної кількості помилкових рішень — окремий випадок методу мінімального ризику, коли всі типи помилок рівнозначні за наслідками. Мета — мінімізувати кількість помилкових рішень під час діагностики.</p><p>Ймовірності станів P(D<sub>i</sub>/K*) розраховують за формулою Байєса, а рішення приймають за критерієм максимуму апостеріорної ймовірності:</p>${F[0]}<p>Цей критерій мінімізує кількість помилкових рішень: найбільш імовірний стан має найбільший шанс бути правильним.</p>` },
  { title: 'Розрахунок', html: `${F[1]}${F[2]}<p>Якщо прийняти рішення D<sub>i</sub>, то серед усіх об'єктів з такою самою реалізацією ознак частка помилкових рішень дорівнює 1 − P(D<sub>i</sub>/K*). Вона найменша, коли обрано стан з максимальною апостеріорною ймовірністю:</p>${F[3]}` },
  { title: 'Хибна тривога і пропуск дефекту (розширення ТЗ)', html: '<p>Якщо стани поділити на «норма» і «дефект», можливі два види помилок: <b>хибна тривога</b> (рішення «дефект» за нормального стану) і <b>пропуск дефекту</b> (рішення «норма» за наявності дефекту). Правило «дефект, якщо P(норма/K*) &lt; t» з порогом t = 0,5 близьке до МАР; зміщення порогу зменшує одну помилку ціною збільшення іншої. Матрицю P(k<sub>j</sub>/D<sub>i</sub>) на практиці оцінюють за частотами навчальної вибірки (формули 3–4 ПР1).</p>' },
];

const questions = [
  { id: 'q1', prompt: 'У чому полягає суть методу мінімальної кількості помилкових рішень?', options: ['Об’єкт відносять до стану з максимальною апостеріорною ймовірністю, що мінімізує частку помилкових рішень', 'Обирають стан з мінімальним ризиком за довільної матриці втрат', 'Обирають стан з максимальною апріорною ймовірністю', 'Відмовляються від рішення за будь-якої невизначеності'], correct: 0, explain: 'Критерій (26).' },
  { id: 'q2', prompt: 'Як розраховуються апостеріорні ймовірності станів?', options: ['За формулою Байєса (27): P(K*/Dᵢ)P(Dᵢ)/ΣP(K*/Dⱼ)P(Dⱼ)', 'P(Dᵢ/K*) = P(K*/Dᵢ)', 'P(Dᵢ/K*) = P(Dᵢ)', 'P(Dᵢ/K*) = 1 − P(K*/Dᵢ)'], correct: 0, explain: 'Формула (27).' },
  { id: 'q3', prompt: 'Як критерій мінімальної кількості помилкових рішень пов’язаний з формулою Байєса?', options: ['Він збігається з вирішальним правилом методу Байєса (максимум апостеріорної ймовірності) і є окремим випадком мінімального ризику при рівних втратах', 'Не пов’язаний', 'Він використовує лише апріорні ймовірності', 'Він є методом максимальної правдоподібності'], correct: 0, explain: 'При λᵢⱼ = 1 (i ≠ j) ризик R(Dᵢ/K*) = 1 − P(Dᵢ/K*).' },
  { id: 'q4', prompt: 'Чи є обмеження щодо застосування цього методу?', options: ['Так: він не враховує різну вартість помилок (пропуск дефекту зазвичай дорожчий) і потребує достовірних апріорних та умовних ймовірностей', 'Немає жодних обмежень', 'Застосовується лише для двох станів', 'Застосовується лише для неперервних ознак'], correct: 0, explain: 'Для нерівнозначних помилок застосовують метод мінімального ризику (ПР2) або Неймана–Пірсона (ПР6).' },
  { id: 'q5', prompt: 'У яких випадках метод мінімальної кількості помилкових рішень є оптимальним?', options: ['Коли всі типи помилок рівнозначні за наслідками і відомі ймовірності станів та ознак', 'Коли пропуск дефекту неприпустимий', 'Коли немає апріорних ймовірностей', 'Коли задано допустимий рівень хибної тривоги'], correct: 0, explain: 'Саме тоді мінімальна кількість помилок = мінімальні втрати.' },
];

const solve = (v) => computeMinErrors(v);

function dataView(v) {
  return h('div', h('ul.legend-states', v.states.map((s) => h('li', s)), v.features.map((f) => h('li.feat', f))),
    h('div.table-wrap', h('table.data', h('thead', h('tr', h('th', 'Стан'), v.features.map((f) => h('th', `P(${short(f)}/Dᵢ)`)), h('th', 'P(Dᵢ)'))),
      h('tbody', v.states.map((s, i) => h('tr', h('th', short(s)), v.featureProbs[i].map((p) => h('td.num', fmt(p, 2))), h('td.num', fmt(v.priors[i], 2))))),
      h('tfoot', h('tr', h('th', 'K*'), v.observed.map((o, j) => h('td', o ? `k${sub(j)} є` : `k${sub(j)} немає`)), h('td', ''))))));
}

function steps(v, r, qs) {
  const n = v.states.length; const m = v.observed.length;
  const realized = (o, j) => (o ? `P(k<sub>${j + 1}</sub>/D)` : `P(¬k<sub>${j + 1}</sub>/D)`);
  return [
    { id: 'table', title: 'Таблиця ймовірностей ознак для кожного стану', category: 'data', weight: 15, kind: 'numbers', task: 'Заповніть P(k<sub>j</sub>*/D<sub>i</sub>) для виявленого комплексу ознак.',
      grid: { rows: v.states.map(short), cols: v.observed.map(realized), key: (i, j) => `t${i}_${j}` },
      fields: Array.from({ length: n * m }, (_, k) => { const i = Math.floor(k / m); const j = k % m; const p = v.featureProbs[i][j]; return { key: `t${i}_${j}`, label: `${realized(v.observed[j], j)} для D<sub>${i + 1}</sub>`, ref: v.observed[j] ? p : 1 - p,
        explain: (x) => (!v.observed[j] && Math.abs(x - p) < 0.002 ? `Ознаку k${sub(j)} не виявлено: потрібно 1 − ${fmt(p, 2)}.` : `Перевірте значення для D${sub(i)}, k${sub(j)}.`) }; }),
      hint: 'Для відсутньої ознаки — 1 − P(kⱼ/Dᵢ).' },
    formulaStep([
      { id: 'f1', prompt: 'За яким критерієм приймають рішення?', options: ['Максимум апостеріорної ймовірності P(Dᵢ/K*) (26)', 'Максимум P(K*/Dᵢ)', 'Мінімум P(Dᵢ)', 'Максимум P(Dᵢ)'], correct: 0, explain: 'Критерій (26).' },
      { id: 'f2', prompt: 'Як обчислюють P(Dᵢ/K*)?', options: ['P(K*/Dᵢ)P(Dᵢ) / Σⱼ P(K*/Dⱼ)P(Dⱼ) (27)', 'P(K*/Dᵢ) / P(Dᵢ)', 'P(K*/Dᵢ)P(Dᵢ)', 'Σⱼ P(kⱼ/Dᵢ)'], correct: 0, explain: 'Формула Байєса (27).' },
    ], 'Апостеріорна ймовірність = нормована спільна ймовірність.'),
    { id: 'like', title: 'Ймовірності комплексу ознак P(K*/Dᵢ)', category: 'calc', weight: 10, kind: 'numbers', task: 'Обчисліть P(K*/D<sub>i</sub>) за формулою (28).', formulas: F[2],
      fields: r.likelihoods.map((x, i) => ({ key: `l${i}`, label: `P(K*/D<sub>${i + 1}</sub>)`, ref: x, explain: () => `Перемножте рядок D${sub(i)} таблиці.` })), hint: 'Добуток значень рядка.' },
    { id: 'joint', title: 'Добутки P(K*/Dᵢ)·P(Dᵢ)', category: 'calc', weight: 10, kind: 'numbers', task: 'Обчисліть чисельники формули (27).',
      fields: r.joints.map((x, i) => ({ key: `j${i}`, label: `P(K*/D<sub>${i + 1}</sub>)·P(D<sub>${i + 1}</sub>)`, ref: x, explain: (y) => (Math.abs(y - r.likelihoods[i]) < 0.0015 ? 'Не помножено на апріорну ймовірність P(Dᵢ).' : `${fmt(r.likelihoods[i], 4)} · ${fmt(v.priors[i], 2)}`) })), hint: 'Помножте на P(Dᵢ).' },
    { id: 'post', title: 'Апостеріорні ймовірності P(Dᵢ/K*)', category: 'calc', weight: 15, kind: 'numbers', task: 'Обчисліть P(D<sub>i</sub>/K*) за формулою (27).', formulas: F[1],
      fields: r.posteriors.map((x, i) => ({ key: `p${i}`, label: `P(D<sub>${i + 1}</sub>/K*)`, ref: x, explain: (y) => (Math.abs(y - r.joints[i]) < 0.0015 ? 'Не виконано нормування: поділіть на суму добутків.' : `P(D${sub(i)}/K*) = ${fmt(r.joints[i], 4)} / ${fmt(r.evidence, 4)}`) })), hint: 'Поділіть кожен добуток на їх суму.' },
    { id: 'perr', title: 'Ймовірність помилкового рішення', category: 'calc', weight: 5, kind: 'numbers', task: 'Обчисліть ймовірність того, що рішення за критерієм (26) для цього K* буде помилковим.', formulas: F[3],
      fields: [{ key: 'e', label: 'P<sub>пом</sub>', ref: r.pError, explain: (y) => (Math.abs(y - r.posteriors[r.best]) < 0.0015 ? 'Це ймовірність правильного рішення; помилка — 1 − max P.' : 'Pпом = 1 − max P(Dᵢ/K*).') }], hint: '1 − найбільша апостеріорна ймовірність.' },
    { id: 'best', title: 'Рішення за критерієм (26)', category: 'interpret', weight: 10, kind: 'choice', task: 'У якому стані перебуває об’єкт?',
      questions: [{ id: 'b', prompt: 'Стан:', options: v.states, correct: r.best, explain: `Максимальна P(D${sub(r.best)}/K*) = ${fmt(r.posteriors[r.best], 3)}.` }], hint: 'Максимальна апостеріорна ймовірність.' },
    { id: 'why', title: 'Обґрунтування рішення', category: 'decision', weight: 5, kind: 'choice', task: 'Чому обраний стан мінімізує кількість помилкових рішень?',
      questions: [{ id: 'w', prompt: 'Тому що:', options: [`серед об'єктів з таким K* частка помилок при виборі ${short(v.states[r.best])} мінімальна і дорівнює ${fmt(r.pError, 3)}`, 'цей стан має найбільшу апріорну ймовірність', 'цей стан має найбільшу правдоподібність P(K*/Dᵢ)', 'частка помилок дорівнює нулю'], correct: 0, explain: 'Будь-який інший вибір дає частку помилок 1 − P(Dᵢ/K*) > Pпом.' }], hint: 'Ймовірність помилки при виборі Dᵢ — 1 − P(Dᵢ/K*).' },
    questionsStep(qs),
  ];
}

function own(v, a) {
  const n = v.states.length; const m = v.observed.length; const num = (k) => parseNumber(a[k]); const o = {};
  const js = [];
  for (let i = 0; i < n; i++) {
    let p = 1; for (let j = 0; j < m; j++) p *= num(`t${i}_${j}`);
    o[`l${i}`] = p; o[`j${i}`] = num(`l${i}`) * v.priors[i]; js.push(num(`j${i}`));
  }
  const s = js.reduce((x, y) => x + y, 0);
  js.forEach((x, i) => { o[`p${i}`] = x / s; });
  const ps = Array.from({ length: n }, (_, i) => num(`p${i}`));
  o.e = 1 - Math.max(...ps);
  return o;
}

const chart = (v, r) => barChart({ title: 'Ймовірності станів до та після обстеження', categories: v.states.map(short),
  series: [{ name: 'апріорна P(Dᵢ)', values: v.priors, className: 'prior' }, { name: 'апостеріорна P(Dᵢ/K*)', values: r.posteriors, className: 'post' }] });

function resultTable(v, r) {
  return h('div.table-wrap', h('table.data', h('thead', h('tr', h('th', 'Стан'), h('th', 'P(K*/Dᵢ)'), h('th', 'P(K*/Dᵢ)P(Dᵢ)'), h('th', 'P(Dᵢ/K*)'), h('th', 'Pпом при виборі Dᵢ'))),
    h('tbody', v.states.map((s, i) => h(`tr${i === r.best ? '.best-row' : ''}`, h('th', short(s)), h('td.num', fmtFixed(r.likelihoods[i], 4)), h('td.num', fmtFixed(r.joints[i], 4)), h('td.num', fmtFixed(r.posteriors[i], 4)), h('td.num', fmtFixed(1 - r.posteriors[i], 4)))))));
}

function analysis(v, r) {
  return [
    `За критерієм (26) об’єкт перебуває у стані ${v.states[r.best]}: P = ${fmt(r.posteriors[r.best], 3)}.`,
    `Ймовірність, що це рішення помилкове, — ${fmt(r.pError, 3)}; вибір будь-якого іншого стану дав би більшу частку помилок.`,
    `Середня ймовірність помилки цього правила за всіма можливими реалізаціями ознак (мінімально можлива для даної матриці) — ${fmt(bayesErrorRate(v), 3)}.`,
    r.pError > 0.3 ? 'Ймовірність помилки значна: для підвищення достовірності доцільно залучити додаткові діагностичні ознаки.' : 'Достовірність рішення прийнятна.',
  ];
}

function research(box, ctx) {
  const { section: sec } = ctx;
  const presets = [{ id: 'g', label: 'Приклад МВ', make: guideVariantPR4 }];
  if (ctx.profile) presets.push({ id: 'm', label: 'Мій поточний варіант', make: () => variantPR4(ctx.profile, getWork(4).variantNumber || 1) });
  let v = presets[0].make(); let N = 200; let seed = 1; let t = 0.5;
  const sel = h('select', { onchange: (e) => { v = presets.find((p) => p.id === e.target.value).make(); all(); } }, presets.map((p) => h('option', { value: p.id }, p.label)));
  const train = h('div'); const thr = h('div');
  function paintTrain() {
    clear(train);
    const s = sampleTraining(v, N, `${v.id}|${seed}|${N}`);
    const est = { ...v, priors: s.estimate.priors, featureProbs: s.estimate.featureProbs };
    let rEst = null; try { rEst = computeBayes({ ...est, threshold: 0 }); } catch { rEst = null; }
    const rTrue = computeMinErrors(v);
    train.append(
      h('div.row', slider('N, об’єктів', N, (x) => { N = Math.round(x); paintTrain(); }, { min: 20, max: 2000, step: 10, digits: 0 }), h('button.btn.btn-ghost', { onclick: () => { seed++; paintTrain(); } }, 'Нова вибірка')),
      h('div.table-wrap', h('table.data', h('thead', h('tr', h('th', 'Стан'), h('th', 'Nᵢ'), v.features.map((f) => h('th', `Nᵢⱼ (${short(f)})`)), h('th', 'P̂(Dᵢ) = Nᵢ/N'), v.features.map((f) => h('th', `P̂(${short(f)}/Dᵢ)`)), h('th', 'істинні P(k/Dᵢ)'))),
        h('tbody', v.states.map((st, i) => h('tr', h('th', short(st)), h('td.num', s.Ni[i]), s.Nij[i].map((x) => h('td.num', x)), h('td.num', fmtFixed(s.estimate.priors[i], 3)), s.estimate.featureProbs[i].map((x) => h('td.num', fmtFixed(x, 3))), h('td.num', v.featureProbs[i].map((x) => fmt(x, 2)).join('; '))))))),
      h('p', rEst ? `За оцінками з вибірки рішення: ${short(v.states[rEst.best])} (P = ${fmt(rEst.posteriors[rEst.best], 3)}); за істинною матрицею: ${short(v.states[rTrue.best])} (P = ${fmt(rTrue.posteriors[rTrue.best], 3)}).` : 'За цією вибіркою комплекс ознак K* не спостерігався в жодному стані (P(K*) = 0) — вибірка замала.'),
      h('p.muted.small', 'Дані модельні: вибірку згенеровано з матриці варіанта за формулами (3)–(4) ПР1.'));
  }
  function paintThr() {
    clear(thr);
    const ts = Array.from({ length: 101 }, (_, k) => k / 100);
    const rates = ts.map((x) => alarmMissRates(v, x));
    const cur = alarmMissRates(v, t);
    const c = confusionOnSample(v, 500, t, `${v.id}|test`);
    thr.append(slider('поріг t', t, (x) => { t = x; paintThr(); }),
      h('p', `Рішення «дефект», якщо P(${short(v.states.at(-1))}/K*) < t. Хибна тривога α = ${fmt(cur.alarm, 3)}, пропуск дефекту β = ${fmt(cur.miss, 3)}.`),
      lineChart({ xs: ts, series: [{ name: 'хибна тривога α(t)', values: rates.map((x) => x.alarm), className: 's2' }, { name: 'пропуск дефекту β(t)', values: rates.map((x) => x.miss), className: 's1' }], marker: t, xLabel: 'поріг t', yLabel: 'ймовірність', title: 'Співвідношення помилок двох видів' }),
      h('h3', 'Матриця помилок на модельній контрольній вибірці (500 об’єктів)'),
      h('div.table-wrap', h('table.data', h('thead', h('tr', h('th', ''), h('th', 'Еталон: дефект'), h('th', 'Еталон: норма'))),
        h('tbody', h('tr', h('th', 'Рішення: дефект'), h('td.num', `TP = ${c.TP}`), h('td.num', `FP = ${c.FP}`)), h('tr', h('th', 'Рішення: норма'), h('td.num', `FN = ${c.FN}`), h('td.num', `TN = ${c.TN}`))))),
      h('p', `Кількість помилкових рішень: ${c.FP + c.FN} з 500 (${fmt((c.FP + c.FN) / 5, 1)} %).`));
  }
  function all() { paintTrain(); paintThr(); }
  box.append(sec(6, 'Постановка дослідницької задачі', h('p', 'Дослідіть, як обсяг навчальної вибірки впливає на оцінку діагностичної матриці, і як поріг класифікації змінює співвідношення хибних тривог і пропусків дефекту.'), h('label.inline', 'Об’єкт: ', sel)),
    sec(8, 'Навчальна вибірка і частоти (розширення ТЗ, модельні дані)', train),
    sec(10, 'Пороги класифікації: хибна тривога і пропуск дефекту', thr));
  all();
}

export const PR4 = {
  n: 4,
  meta: { title: 'Оцінка ймовірностей за допомогою методу мінімального числа помилкових рішень', goal: 'Вивчення методу мінімальної кількості помилкових рішень для діагностики технічного стану об’єктів.', goalSource: 'МВ, «ПР3» (за РПНД — ПР4), с. 12',
    outcomes: ['РН1 — оцінювати ймовірності технічних станів і приймати рішення, що мінімізує кількість помилок.', 'Обчислювати апостеріорні ймовірності (27)–(28) і ймовірність помилкового рішення.', 'Розрізняти хибну тривогу і пропуск дефекту та оцінювати вплив порогу на їх співвідношення.', 'Оцінювати ймовірності за частотами навчальної вибірки.'] },
  theory, formulas, legend: [['P(D<sub>i</sub>/K*)', 'апостеріорна ймовірність стану'], ['P<sub>пом</sub>', 'ймовірність помилкового рішення'], ['α, β', 'ймовірності хибної тривоги і пропуску дефекту']],
  questions, guideVariant: guideVariantPR4, variantFor: variantPR4, solve, dataView, steps, own, chart, resultTable, analysis, research,
  problem: (v) => `Об'єкт — <b>${v.object}</b>. Стани: ${v.states.map((s) => `<i>${s}</i>`).join('; ')}. Під час обстеження ${v.observed.map((o, j) => (o ? `виявлено ознаку ${short(v.features[j])}` : `ознака ${short(v.features[j])} відсутня`)).join(', ')}. Обчисліть апостеріорні ймовірності станів і прийміть рішення за критерієм мінімальної кількості помилкових рішень.`,
  learn: {
    intro: '<p>Об\'єкт (газотурбінний двигун) може перебувати в трьох станах: D₁ — несправність паливного регулятора, D₂ — збільшення радіального зазору, D₃ — норма. Перевіряються ознаки k₁ (температура більше ніж на 50 °C) і k₂ (час виходу на максимальну частоту більше ніж на 5 с). Ймовірності — табл. 5 МВ. Виявлено обидві ознаки.</p>',
    walk: (v, r) => [
      ['Крок 1. P(K*/Dᵢ) за (28)', v.states.map((_, i) => `P(K*/D${sub(i)}) = ${fmt(v.featureProbs[i][0], 1)} · ${fmt(v.featureProbs[i][1], 1)} = ${fmt(r.likelihoods[i], 2)}`).join('<br>')],
      ['Крок 2. Знаменник (27)', `Σ = ${r.joints.map((x) => fmt(x, 3)).join(' + ')} = ${fmt(r.evidence, 3)}`],
      ['Крок 3. P(Dᵢ/K*)', v.states.map((_, i) => `P(D${sub(i)}/K*) = ${fmt(r.joints[i], 3)} / ${fmt(r.evidence, 3)} = <b>${fmt(r.posteriors[i], 3)}</b>`).join('<br>')],
      ['Крок 4. Рішення за (26)', `Максимум — D₂ (${fmt(r.posteriors[1], 3)}); ймовірність помилки ${fmt(r.pError, 3)}.`],
    ],
    notes: ['<b>Примітка до МВ (П3).</b> У МВ наведено P(D₁/K*) = 0,08; P(D₂/K*) = 0,68; P(D₃/K*) = 0,24. Точний розрахунок: Σ = 0,012 + 0,060 + 0,014 = 0,086 → <b>0,140; 0,698; 0,163</b>. Рішення D₂ не змінюється.'],
  },
  reportTheory: 'Метод мінімальної кількості помилкових рішень — окремий випадок методу мінімального ризику за рівнозначних помилок. Апостеріорні ймовірності станів обчислюють за формулою Байєса, рішення приймають за максимумом P(Dᵢ/K*). Ймовірність помилкового рішення для даної реалізації ознак 1 − max P(Dᵢ/K*) при цьому мінімальна.',
};
