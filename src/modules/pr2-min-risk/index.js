// ПР2. Метод мінімального ризику (МВ, с. 10–11).
import { h, raw, clear, toast } from '../../components/dom.js';
import { section, sub, short, fmt, fmtFixed, slider, formulaStep, questionsStep } from '../../components/trainer.js';
import { barChart, lineChart } from '../../visualization/charts.js';
import { computeBayes, setPrior } from '../../calculations/bayes.js';
import { computeRisk, riskSweep, switchPoint } from '../../calculations/risk.js';
import { variantPR2, guideVariantPR2, posteriorsPR2 } from '../../calculations/variants-234.js';
import { parseNumber } from '../../calculations/numeric.js';
import { getWork } from '../../data/store.js';

const P = (i) => `P(D<sub>${i + 1}</sub>/K*)`;
const R = (i) => `R(D<sub>${i + 1}</sub>/K*)`;
const L = (i, j) => `λ<sub>${i + 1}${j + 1}</sub>`;

const formulas = `
<div class="formula"><span class="ftext">R(D<sub>i</sub>/K*) = Σ<sub>j=1</sub><sup>n</sup> λ<sub>ij</sub> · P(D<sub>j</sub>/K*)</span><span class="formula-no">(21)</span></div>
<div class="formula"><span class="ftext">K* ∈ D<sub>i</sub>, якщо R(D<sub>i</sub>/K*) = min<sub>1≤k≤n</sub> R(D<sub>k</sub>/K*)</span><span class="formula-no">(22)</span></div>
<div class="formula"><span class="ftext">P(D<sub>j</sub>/K*) = P(D<sub>j</sub>)P(K*/D<sub>j</sub>) / Σ<sub>s</sub> P(D<sub>s</sub>)P(K*/D<sub>s</sub>)</span><span class="formula-no">(12)</span></div>`;

const theory = [
  { title: 'Суть методу', html: `<p>Метод мінімального ризику заснований на ймовірностях діагнозів, що визначаються за формулою Байєса, і використовується в задачах класифікації об'єктів. Його мета — зменшення середнього ризику, пов'язаного з помилками діагностики.</p><p>Функція ризику R(D<sub>i</sub>/K*) показує втрати, що виникають при віднесенні об'єкта до діагнозу D<sub>i</sub>, коли він насправді може належати до діагнозу D<sub>j</sub>:</p>${formulas.split('</div>')[0]}</div><p>де λ<sub>ij</sub> — втрати, якщо прийнято рішення D<sub>i</sub>, а дійсний стан D<sub>j</sub>; P(D<sub>j</sub>/K*) — ймовірність стану D<sub>j</sub> за наявного комплексу ознак.</p>` },
  { title: 'Вирішальне правило', html: `<p>Рішення приймається за умовою мінімуму ризику (22). Цей критерій відповідає правилу (18) методу Байєса, якщо всі помилки однаково «коштують» (λ<sub>ij</sub> = 1 при i ≠ j, λ<sub>ii</sub> = 0). Коли втрати залежать від конкретної пари станів D<sub>i</sub> і D<sub>j</sub>, критерій мінімального ризику дозволяє приймати більш зважені рішення.</p>` },
  { title: 'Матриця втрат', html: `<p>Матриця λ<sub>ij</sub> формується з техніко-економічних міркувань. Зазвичай λ<sub>ii</sub> = 0 (правильне рішення не дає втрат); найбільші втрати — у <b>пропуску дефекту</b> (рішення «норма», коли є дефект: аварія, брак), менші — у <b>хибній тривозі</b> (рішення «дефект» за нормального стану: зайве обслуговування, простій).</p>` },
];

const questions = [
  { id: 'q1', prompt: 'У чому полягає суть методу мінімального ризику?', options: ['Обирається діагноз з мінімальним середнім ризиком (очікуваними втратами) з урахуванням ймовірностей станів і вартості помилок', 'Обирається діагноз з максимальною апріорною ймовірністю', 'Обирається діагноз з максимальною правдоподібністю P(K*/Dᵢ)', 'Обирається діагноз з найменшими втратами λᵢᵢ'], correct: 0, explain: 'R(Dᵢ/K*) = Σ λᵢⱼP(Dⱼ/K*) — середні втрати рішення Dᵢ; обирається мінімум (22).' },
  { id: 'q2', prompt: 'Як формується матриця втрат?', options: ['λᵢⱼ — втрати від рішення Dᵢ, коли дійсний стан Dⱼ; на діагоналі зазвичай 0, поза нею — вартість відповідної помилки', 'λᵢⱼ — ймовірності переходу зі стану Dᵢ у стан Dⱼ', 'λᵢⱼ = P(Dᵢ)·P(Dⱼ)', 'λᵢⱼ — кількість об’єктів зі станом Dᵢ'], correct: 0, explain: 'Матриця втрат задає наслідки кожної пари «рішення — дійсний стан».' },
  { id: 'q3', prompt: 'Як розраховується ризик для стану Dᵢ?', options: ['R(Dᵢ/K*) = Σⱼ λᵢⱼ P(Dⱼ/K*)', 'R(Dᵢ/K*) = λᵢᵢ P(Dᵢ/K*)', 'R(Dᵢ/K*) = Σⱼ λⱼᵢ P(Dᵢ)', 'R(Dᵢ/K*) = 1 − P(Dᵢ/K*)'], correct: 0, explain: 'Формула (21): сума добутків рядка i матриці втрат на апостеріорні ймовірності станів.' },
  { id: 'q4', prompt: 'У яких випадках метод мінімального ризику ефективніший за метод Байєса?', options: ['Коли наслідки різних помилок неоднакові (пропуск дефекту значно дорожчий за хибну тривогу)', 'Коли всі помилки однаково небезпечні', 'Коли немає апріорної інформації', 'Коли ознак лише дві'], correct: 0, explain: 'За рівних втрат обидва методи дають однакове рішення; перевага — при неоднаковій значущості помилок.' },
  { id: 'q5', prompt: 'Як впливає вибір матриці втрат на прийняття рішення?', options: ['Збільшення втрат від помилки зміщує рішення в бік її уникнення; при певному значенні λ оптимальне рішення змінюється', 'Не впливає — рішення визначають лише ймовірності', 'Впливають лише діагональні елементи', 'Збільшення всіх λ у k разів змінює рішення'], correct: 0, explain: 'Ризики лінійні за λ: зміна одного λᵢⱼ змінює R(Dᵢ) і може змінити мінімум. Множення всієї матриці на k рішення не змінює.' },
];

function lossesText(v) {
  const N = v.states.length - 1;
  const parts = [];
  v.losses.forEach((row, i) => row.forEach((l, j) => {
    if (i === j) return;
    const kind = i === N ? 'пропуск дефекту' : j === N ? 'хибна тривога' : 'помилкове розпізнавання дефекту';
    parts.push(`рішення ${short(v.states[i])} при дійсному стані ${short(v.states[j])} (${kind}) — <b>${l}</b>`);
  }));
  return `Правильні рішення втрат не дають. Втрати від помилкових рішень, ум. од.: ${parts.join('; ')}.`;
}

function solve(v) {
  const post = posteriorsPR2(v);
  const bayes = v.posteriorsGiven ? null : computeBayes(v);
  const rr = computeRisk(v.losses, post);
  let mapBest = 0; post.forEach((p, i) => { if (p > post[mapBest]) mapBest = i; });
  return { ...rr, posteriors: post, bayes, mapBest };
}

function dataView(v) {
  const parts = [h('ul.legend-states', v.states.map((s) => h('li', s)), (v.features || []).map((f) => h('li.feat', f)))];
  if (v.posteriorsGiven) {
    parts.push(h('div.table-wrap', h('table.data', h('thead', h('tr', v.states.map((_, i) => h('th', raw(P(i)))))), h('tbody', h('tr', v.posteriorsGiven.map((p) => h('td.num', fmt(p, 2))))))),
      h('p.muted.small', 'Апостеріорні ймовірності задано в МВ за даними обстеження.'));
  } else {
    parts.push(h('div.table-wrap', h('table.data',
      h('thead', h('tr', h('th', 'Стан'), v.features.map((f) => h('th', `P(${short(f)}/Dᵢ)`)), h('th', 'P(Dᵢ)'))),
      h('tbody', v.states.map((s, i) => h('tr', h('th', short(s)), v.featureProbs[i].map((p) => h('td.num', fmt(p, 2))), h('td.num', fmt(v.priors[i], 2))))),
      h('tfoot', h('tr', h('th', 'K*'), v.observed.map((o, j) => h('td', o ? `k${sub(j)} є` : `k${sub(j)} немає`)), h('td', ''))))));
  }
  parts.push(h('p', raw(lossesText(v))));
  return h('div', parts);
}

function steps(v, r, qs) {
  const n = v.states.length;
  const list = [
    { id: 'losses', title: 'Матриця втрат', category: 'data', weight: 15, kind: 'numbers',
      task: 'Сформуйте матрицю втрат λ<sub>ij</sub> (рядок — прийняте рішення D<sub>i</sub>, стовпець — дійсний стан D<sub>j</sub>) за умовою задачі.',
      grid: { rows: v.states.map((s, i) => `рішення D<sub>${i + 1}</sub>`), cols: v.states.map((s, j) => `дійсний D<sub>${j + 1}</sub>`), key: (i, j) => `l${i}_${j}` },
      fields: Array.from({ length: n * n }, (_, k) => { const i = Math.floor(k / n); const j = k % n; return { key: `l${i}_${j}`, label: L(i, j), ref: v.losses[i][j], digits: 0,
        explain: (x) => (x === v.losses[j][i] && i !== j ? `${L(i, j)}: ви переплутали рядок і стовпець — рядок означає прийняте рішення, стовпець — дійсний стан.` : `${L(i, j)}: рішення D${sub(i)} при дійсному D${sub(j)} — ${i === j ? 'правильне рішення, втрат немає' : 'див. умову задачі'}.`) }; }),
      hint: 'На діагоналі (правильні рішення) — нулі. Рядок — рішення, стовпець — дійсний стан.' },
    formulaStep([
      { id: 'f1', prompt: 'За якою формулою обчислюють ризик рішення Dᵢ?', options: ['R(Dᵢ/K*) = Σⱼ λᵢⱼ·P(Dⱼ/K*) (21)', 'R(Dᵢ/K*) = Σⱼ λⱼᵢ·P(Dᵢ/K*)', 'R(Dᵢ/K*) = λᵢᵢ·P(Dᵢ/K*)', 'R(Dᵢ/K*) = Σⱼ λᵢⱼ·P(Dⱼ)'], correct: 0, explain: 'Рядок i матриці втрат множиться на вектор апостеріорних ймовірностей.' },
      { id: 'f2', prompt: 'Яке рішення приймається?', options: ['Діагноз з мінімальним ризиком (22)', 'Діагноз з максимальним ризиком', 'Діагноз з максимальною апріорною ймовірністю', 'Діагноз з мінімальною сумою рядка матриці втрат'], correct: 0, explain: 'Умова (22): мінімум середнього ризику.' },
    ], 'Ризик — це середні (очікувані) втрати рішення з урахуванням того, наскільки ймовірний кожен дійсний стан.'),
  ];
  if (!v.posteriorsGiven) list.push({ id: 'post', title: 'Апостеріорні ймовірності за формулою Байєса', category: 'calc', weight: 20, kind: 'numbers',
    task: 'Обчисліть P(D<sub>j</sub>/K*) за узагальненою формулою Байєса (як у ПР1).', formulas: formulas.split('</div>')[2] + '</div>',
    fields: r.posteriors.map((p, i) => ({ key: `p${i}`, label: P(i), ref: p, explain: (x) => (Math.abs(x - v.priors[i]) < 0.002 ? 'Це апріорна ймовірність: результати обстеження не враховано.' : `Обчисліть P(D${sub(i)}K*)/P(K*); для відсутньої ознаки беріть 1 − P(k/D).`) })),
    hint: 'P(K*/Dᵢ) — добуток ймовірностей фактичних реалізацій ознак; P(Dᵢ/K*) = P(Dᵢ)P(K*/Dᵢ)/ΣP(Dₛ)P(K*/Dₛ).' });
  list.push(
    { id: 'risk', title: 'Ризики рішень', category: 'calc', weight: v.posteriorsGiven ? 35 : 25, kind: 'numbers', task: 'Обчисліть ризик кожного рішення за формулою (21).', formulas: formulas.split('</div>')[0] + '</div>',
      fields: r.risks.map((x, i) => ({ key: `r${i}`, label: R(i), ref: x,
        explain: (y) => (Math.abs(y - v.losses.reduce((a, row, k) => a + row[i] * r.posteriors[k], 0)) < 0.002 ? 'Ви множили стовпець, а не рядок матриці втрат: R(Dᵢ) використовує λᵢⱼ — втрати рішення Dᵢ.' : `R(D${sub(i)}/K*) = ${v.losses[i].map((l, j) => `${l}·${fmt(r.posteriors[j], 3)}`).join(' + ')}.`) })),
      hint: 'Помножте кожен елемент рядка i матриці втрат на ймовірність відповідного дійсного стану і додайте.' },
    { id: 'best', title: 'Оптимальне рішення', category: 'interpret', weight: 10, kind: 'choice', task: 'Яке рішення оптимальне за критерієм мінімального ризику?',
      questions: [{ id: 'b', prompt: 'Оптимальне рішення:', options: v.states, correct: r.best, explain: `Мінімальний ризик: R(D${sub(r.best)}/K*) = ${fmt(r.risks[r.best], 3)}.` }], hint: 'Обирається мінімальний, а не максимальний ризик.' },
    { id: 'cmp', title: 'Порівняння з методом Байєса', category: 'decision', weight: 10, kind: 'choice', task: `За методом Байєса (максимум апостеріорної ймовірності) було б обрано ${short(v.states[r.mapBest])}. Як співвідносяться рішення?`,
      questions: [{ id: 'c', prompt: 'Висновок:', options: ['Рішення збігаються: врахування вартості помилок не змінило діагноз', 'Рішення різні: через неоднакову вартість помилок оптимально обрати менш імовірний, але «безпечніший» діагноз'], correct: r.best === r.mapBest ? 0 : 1,
        explain: r.best === r.mapBest ? 'Мінімум ризику і максимум ймовірності вказують на той самий стан.' : `Байєс: ${short(v.states[r.mapBest])}; мінімальний ризик: ${short(v.states[r.best])}.` }], hint: 'Порівняйте стан з максимальною P(Dⱼ/K*) і стан з мінімальним R.' },
    questionsStep(qs));
  return list;
}

function own(v, a) {
  const n = v.states.length; const num = (k) => parseNumber(a[k]);
  const L2 = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => num(`l${i}_${j}`)));
  const post = v.posteriorsGiven ?? Array.from({ length: n }, (_, i) => num(`p${i}`));
  const o = {};
  L2.forEach((row, i) => { o[`r${i}`] = row.reduce((s, l, j) => s + l * post[j], 0); });
  return o;
}

function chart(v, r) {
  const ymax = Math.max(1, Math.ceil(Math.max(...r.risks) * 1.15));
  return barChart({ title: 'Ризики рішень R(Dᵢ/K*)', categories: v.states.map(short), yMax: ymax, digits: 3,
    series: [{ name: 'ризик рішення', values: r.risks, className: 'post' }, { name: 'P(Dᵢ/K*) × ' + ymax, values: r.posteriors.map((p) => p * ymax), className: 'prior' }] });
}

function resultTable(v, r) {
  return h('div.table-wrap', h('table.data', h('thead', h('tr', h('th', 'Стан / рішення'), h('th', raw('P(D<sub>j</sub>/K*)')), h('th', raw('R(D<sub>i</sub>/K*)')))),
    h('tbody', v.states.map((s, i) => h(`tr${i === r.best ? '.best-row' : ''}`, h('th', short(s)), h('td.num', fmtFixed(r.posteriors[i], 4)), h('td.num', fmtFixed(r.risks[i], 4)))))));
}

function analysis(v, r) {
  const out = [`Мінімальний ризик має рішення ${v.states[r.best]}: R = ${fmt(r.risks[r.best], 3)} ум. од.`];
  out.push(r.best === r.mapBest ? `Воно збігається з рішенням за методом Байєса (найбільша апостеріорна ймовірність ${fmt(r.posteriors[r.mapBest], 3)}).`
    : `За методом Байєса було б обрано ${short(v.states[r.mapBest])} (P = ${fmt(r.posteriors[r.mapBest], 3)}), але через вищу вартість помилок оптимальним є ${short(v.states[r.best])}.`);
  out.push(`Різниця між двома найменшими ризиками — ${fmt(r.margin, 3)} ум. од.${r.margin < 0.2 ? ': рішення чутливе до оцінки втрат, їх варто уточнити.' : '.'}`);
  const alt = r.risks.map((x, i) => i).filter((i) => i !== r.best).sort((a, b) => r.risks[a] - r.risks[b])[0];
  const cells = v.losses[r.best].map((_, j) => j).filter((j) => j !== r.best);
  for (const j of cells) {
    const sp = switchPoint(v.losses, r.posteriors, { i: r.best, j }, 0, 30);
    if (sp) { out.push(`Якщо втрати λ${sub(r.best)}${sub(j)} зростуть з ${v.losses[r.best][j]} до ${fmt(sp.x, 2)}, оптимальним стане рішення ${short(v.states[sp.to])}.`); break; }
  }
  if (alt === undefined) out.push('');
  out.push(`Висновок: діагноз ${short(v.states[r.best])} забезпечує найменші очікувані втрати за заданої матриці втрат.`);
  return out.filter(Boolean);
}

function research(box, ctx) {
  const { section: sec } = ctx;
  const presets = [{ id: 'g', label: 'Приклад МВ', make: guideVariantPR2 }];
  if (ctx.profile) presets.push({ id: 'm', label: 'Мій поточний варіант', make: () => variantPR2(ctx.profile, getWork(2).variantNumber || 1) });
  let v; let post; let losses; let cell = { i: 1, j: 0 };
  const ctr = h('div.controls'); const out = h('div'); const sw = h('div');
  function load(p) { v = p.make(); post = posteriorsPR2(v).slice(); losses = v.losses.map((r) => r.slice()); cell = { i: v.states.length - 1, j: 0 }; paintCtr(); compute(); }
  function paintCtr() {
    clear(ctr);
    const n = v.states.length;
    ctr.append(h('label.inline', 'Об’єкт: ', h('select', { onchange: (e) => load(presets.find((p) => p.id === e.target.value)) }, presets.map((p) => h('option', { value: p.id, selected: p.make().id === v.id }, p.label)))),
      h('h3', 'Апостеріорні ймовірності станів'), h('p.muted.small', 'Решта перерозподіляються пропорційно, сума = 1.'),
      ...post.map((p, i) => slider(P(i), p, (x) => { setPrior(post, i, x); syncPost(); compute(); })),
      h('h3', 'Матриця втрат λᵢⱼ (рядок — рішення, стовпець — дійсний стан)'),
      h('div.table-wrap', h('table.data.input-table', h('thead', h('tr', h('th', ''), v.states.map((_, j) => h('th', raw(`D<sub>${j + 1}</sub>`))))),
        h('tbody', losses.map((row, i) => h('tr', h('th', raw(`рішення D<sub>${i + 1}</sub>`)), row.map((l, j) => h('td', h('input.num-in', { type: 'number', min: 0, step: 0.5, value: l, oninput: (e) => { const x = Number(e.target.value); if (Number.isFinite(x) && x >= 0) { losses[i][j] = x; compute(); } } })))))))),
      h('label.inline', 'Досліджувана втрата: ', h('select', { onchange: (e) => { const [a, b] = e.target.value.split(':').map(Number); cell = { i: a, j: b }; compute(); } },
        losses.flatMap((row, i) => row.map((_, j) => (i === j ? null : h('option', { value: `${i}:${j}`, selected: i === cell.i && j === cell.j }, `λ${sub(i)}${sub(j)} — рішення ${short(v.states[i])} при ${short(v.states[j])}`))).filter(Boolean)))));
    void n;
  }
  function syncPost() { ctr.querySelectorAll('.slider').forEach((s, i) => { s.querySelector('input').value = post[i]; s.querySelector('output').textContent = fmtFixed(post[i], 2); }); }
  function compute() {
    clear(out); clear(sw);
    let r;
    try { const rr = computeRisk(losses, post); let mb = 0; post.forEach((p, i) => { if (p > post[mb]) mb = i; }); r = { ...rr, posteriors: post, mapBest: mb }; }
    catch (e) { out.append(h('div.note.error', e.message)); return; }
    const vv = { ...v, losses };
    out.append(...[h('div.decision.acc', `Оптимальне рішення: ${v.states[r.best]} (R = ${fmt(r.risks[r.best], 3)})`),
      r.best !== r.mapBest ? h('p.note.warn', `Метод Байєса обрав би ${short(v.states[r.mapBest])}: рішення різняться через вартість помилок.`) : null,
      resultTable(vv, r), chart(vv, r)].filter(Boolean));
    const max = Math.max(10, losses[cell.i][cell.j] * 2);
    const s = riskSweep(losses, post, cell, 0, max, 101);
    const ymax = Math.max(1, Math.ceil(Math.max(...s.series.flat())));
    const sp = switchPoint(losses, post, cell, 0, max);
    sw.append(lineChart({ xs: s.xs, series: v.states.map((st, i) => ({ name: `R(${short(st)})`, values: s.series[i], className: `s${i + 1}` })), marker: losses[cell.i][cell.j], xLabel: `λ${sub(cell.i)}${sub(cell.j)}, ум. од.`, yLabel: 'ризик', yMax: ymax, title: 'Залежність ризиків від вартості помилкового рішення' }),
      h('p', sp ? `Рішення змінюється з ${short(v.states[sp.from])} на ${short(v.states[sp.to])} при λ${sub(cell.i)}${sub(cell.j)} ≈ ${fmt(sp.x, 2)}.` : `На проміжку [0; ${fmt(max, 0)}] оптимальне рішення не змінюється.`));
  }
  box.append(sec(6, 'Постановка дослідницької задачі', h('p', 'Змінюйте ймовірності станів і вартість помилкових рішень. Спостерігайте, коли метод мінімального ризику обирає інше рішення, ніж метод Байєса.')),
    h('div.research-grid', sec(8, 'Параметри', ctr), sec(9, 'Ризики і рішення', out)),
    sec(10, 'Чутливість рішення до матриці втрат', sw));
  load(presets[0]);
  void toast;
}

export const PR2 = {
  n: 2,
  meta: { title: 'Застосування методу мінімального ризику для оцінки технічного стану', goal: 'Вивчення методу мінімального ризику для діагностики технічного стану об’єктів.', goalSource: 'МВ, ПР2, с. 10',
    outcomes: ['РН1 — оцінювати технічний стан з урахуванням ймовірностей станів і наслідків помилок.', 'Формувати матрицю втрат за техніко-економічними умовами.', 'Обчислювати ризики рішень (21) і обирати рішення з мінімальним ризиком (22).', 'РН14 — обґрунтовувати вибір між методом Байєса і методом мінімального ризику.'] },
  theory, formulas, legend: [['λ<sub>ij</sub>', 'втрати від рішення Dᵢ, коли дійсний стан Dⱼ'], ['R(D<sub>i</sub>/K*)', 'ризик (середні втрати) рішення Dᵢ'], ['P(D<sub>j</sub>/K*)', 'апостеріорна ймовірність стану Dⱼ']],
  questions, guideVariant: guideVariantPR2, variantFor: variantPR2, solve, dataView, steps, own, chart, resultTable, analysis, research,
  problem: (v) => `Об'єкт діагностування — <b>${v.object}</b>. Можливі стани: ${v.states.map((s) => `<i>${s}</i>`).join('; ')}. `
    + (v.posteriorsGiven ? `За даними обстеження апостеріорні ймовірності станів: ${v.posteriorsGiven.map((p, i) => `P(D${sub(i)}/K*) = ${fmt(p, 2)}`).join(', ')}. ` : `Обстеження проведено за ознаками ${v.features.map(short).join(', ')}; результат K* і діагностична матриця — у вихідних даних. `)
    + `${lossesText(v)} Сформуйте матрицю втрат, обчисліть ризики рішень і прийміть рішення за методом мінімального ризику.`,
  learn: {
    intro: '<p>Діагностується газотурбінний двигун (стани D₁ — несправність паливного регулятора, D₂ — збільшення радіального зазору, D₃ — норма). Втрати задано табл. 3 МВ, апостеріорні ймовірності за даними обстеження: P(D₁/K*) = 0,2; P(D₂/K*) = 0,5; P(D₃/K*) = 0,3.</p>',
    walk: (v, r) => [
      ['Крок 1. Матриця втрат', 'λ = [[0, 2, 3], [2, 0, 1], [3, 1, 0]]: рядок — рішення, стовпець — дійсний стан.'],
      ['Крок 2. Ризики за (21)', v.losses.map((row, i) => `R(D${sub(i)}/K*) = ${row.map((l, j) => `${l}·${fmt(r.posteriors[j], 1)}`).join(' + ')} = <b>${fmt(r.risks[i], 2)}</b>`).join('<br>')],
      ['Крок 3. Рішення за (22)', `Мінімальний ризик — D₂ (0,7): оптимальне рішення — збільшення радіального зазору.`],
      ['Крок 4. Порівняння з Байєсом', `Найбільша апостеріорна ймовірність теж у D₂ (0,5) — рішення збігаються.`],
    ],
    notes: ['<b>Примітка до МВ (П18).</b> У МВ R(D₁/K*) = 0·0,2 + 2·0,5 + 3·0,3 = 2,1; правильний результат — <b>1,9</b>. Рішення D₂ не змінюється.'],
  },
  reportTheory: 'Метод мінімального ризику враховує неоднакову вартість помилок діагностики. Ризик рішення Dᵢ — середні втрати R(Dᵢ/K*) = Σⱼ λᵢⱼ P(Dⱼ/K*), де λᵢⱼ — втрати від рішення Dᵢ при дійсному стані Dⱼ, а P(Dⱼ/K*) — апостеріорні ймовірності за формулою Байєса. Обирається рішення з мінімальним ризиком; за одиничної матриці втрат воно збігається з рішенням методу Байєса.',
};
