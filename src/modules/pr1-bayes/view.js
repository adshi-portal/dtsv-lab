// ПР1. Інтерфейс тренажера: 5 режимів роботи на єдиній структурі з 14 розділів (ТЗ, п. 3).
import { h, raw, clear, toast, modal } from '../../components/dom.js';
import { F, sym } from '../../components/math.js';
import { MODES } from '../../data/course.js';
import { getProfile, setProfile, getWork, updateWork, recordAttempt, patchLastAttempt } from '../../data/store.js';
import { computeBayes, sweep, setPrior, updateMatrix, BayesInputError } from '../../calculations/bayes.js';
import { fmt, fmtFixed } from '../../calculations/numeric.js';
import { createRng, hashString } from '../../calculations/rng.js';
import { stepFactor, summarize, verdictText, CATEGORIES, POLICY } from '../../calculations/grading.js';
import { variantFor, guideVariant } from '../../calculations/pr1-variant.js';
import { barChart, lineChart } from '../../visualization/charts.js';
import { META, THEORY, EXAMPLE_INTRO, EXAMPLE_ERRATA, problemStatement, QUESTIONS } from './content.js';
import { buildSteps, checkStep, solutionFor, sub } from './steps.js';

const WORK = 1;
const SERIES = ['s1', 's2', 's3', 's4'];
const short = (label) => label.split(' — ')[0];

// ───────────────────────────── спільні блоки ─────────────────────────────

function section(no, title, ...body) {
  return h(`section.sec#s${no}`, h('h2.sec-title', h('span.sec-no', String(no)), title), ...body);
}

function passport() {
  return h('div.passport',
    h('div.pp-row', h('span.pp-k', '1 · Назва'), h('span.pp-v', META.title)),
    h('div.pp-row', h('span.pp-k', '2 · Мета'), h('span.pp-v', META.goal, h('span.src', ` (${META.goalSource})`))),
    h('div.pp-row', h('span.pp-k', '3 · Результати'), h('ul.pp-v.outcomes', META.outcomes.map((o) => h('li', o)))),
  );
}

function theory(open) {
  return section(4, 'Теоретичні відомості',
    ...THEORY.map((t, k) => h('details.theory', { open: open && k < 3 }, h('summary', t.title), h('div.theory-body', raw(t.html)))));
}

function formulaCard() {
  return section(5, 'Основні формули та позначення',
    h('div.formula-grid', raw(F.product), raw(F.jointK), raw(F.evidence), raw(F.posterior)), raw(F.rule), raw(F.threshold),
    h('dl.legend-list',
      h('dt', 'Dᵢ'), h('dd', 'i-й можливий технічний стан (діагноз), i = 1…n'),
      h('dt', 'kⱼ, kⱼ*'), h('dd', 'j-та діагностична ознака і її фактична реалізація (є / немає)'),
      h('dt', 'K*'), h('dd', 'реалізація комплексу ознак за результатами обстеження'),
      h('dt', 'P(Dᵢ)'), h('dd', 'апріорна ймовірність стану (до обстеження)'),
      h('dt', 'P(kⱼ/Dᵢ)'), h('dd', 'ймовірність появи ознаки за стану Dᵢ (діагностична матриця)'),
      h('dt', 'P(Dᵢ/K*)'), h('dd', 'апостеріорна ймовірність стану (після обстеження)'),
      h('dt', 'Pₗ'), h('dd', 'поріг розпізнавання — мінімальна ймовірність для прийняття діагнозу'),
    ));
}

function matrixTable(v, { showRealized = false } = {}) {
  const m = v.observed.length;
  return h('div.table-wrap', h('table.data',
    h('thead', h('tr', h('th', 'Стан Dᵢ'), ...Array.from({ length: m }, (_, j) => h('th', raw(sym.feat('i', j + 1)))), h('th', raw(sym.prior('i'))))),
    h('tbody', v.states.map((st, i) => h('tr',
      h('th.state', { title: st }, short(st)),
      ...v.featureProbs[i].map((p) => h('td.num', fmt(p, 2))),
      h('td.num.prior', fmt(v.priors[i], 2)),
    ))),
    showRealized ? h('tfoot', h('tr', h('th', 'K*'), ...v.observed.map((o, j) => h('td.center', o ? h('span.pill.yes', `k${sub(j)} є`) : h('span.pill.no', `k${sub(j)} немає`))), h('td', `Σ = ${fmt(v.priors.reduce((a, b) => a + b, 0), 2)}`))) : null,
  ));
}

function dataSection(v) {
  return section(8, 'Вихідні дані',
    h('p.muted', 'Діагностична матриця P(kⱼ/Dᵢ) і апріорні ймовірності P(Dᵢ) задані варіантом. Ваші вхідні дані — робоча таблиця реалізацій ознак (крок 1).'),
    h('ul.legend-states', v.states.map((s) => h('li', s)), v.features.map((f) => h('li.feat', f))),
    matrixTable(v, { showRealized: true }),
    h('p', 'Поріг розпізнавання: ', raw(sym.Pl()), ` = ${fmt(v.threshold, 2)}`, v.modelled ? '' : h('span.muted', ' (у МВ не задано; прийнято для навчального прикладу)')),
  );
}

function resultChart(v, r) {
  return barChart({
    title: 'Ймовірності станів до та після обстеження',
    categories: v.states.map(short),
    series: [
      { name: 'апріорна P(Dᵢ)', values: v.priors, className: 'prior' },
      { name: 'апостеріорна P(Dᵢ/K*)', values: r.posteriors, className: 'post' },
    ],
    threshold: v.threshold,
  });
}

export function analysisText(v, r) {
  const out = [];
  const b = r.best;
  const pb = r.posteriors[b];
  out.push(`Найбільш імовірний стан об’єкта — ${v.states[b]}: P(D${sub(b)}/K*) = ${fmt(pb, 4)}.`);
  const priorBest = v.priors.indexOf(Math.max(...v.priors));
  if (priorBest !== b) out.push(`До обстеження найімовірнішим був стан D${sub(priorBest)} (P = ${fmt(v.priors[priorBest], 2)}); виявлений комплекс ознак змінив оцінку на користь D${sub(b)}.`);
  v.priors.forEach((p, i) => {
    const q = r.posteriors[i];
    if (q < 1e-12 && p > 0) {
      const j = v.featureProbs[i].findIndex((x, jj) => v.observed[jj] && x === 0);
      out.push(`Стан D${sub(i)} виключено (P = 0)${j >= 0 ? `: ознака k${sub(j)} виявлена, а за цього стану вона не трапляється (P(k${sub(j)}/D${sub(i)}) = 0)` : ''}.`);
    } else if (p > 0) {
      const ratio = q / p;
      if (ratio >= 1.5) out.push(`Ймовірність D${sub(i)} зросла в ${fmt(ratio, 1)} раза (з ${fmt(p, 2)} до ${fmt(q, 3)}).`);
      else if (ratio <= 1 / 1.5) out.push(`Ймовірність D${sub(i)} зменшилась у ${fmt(1 / ratio, 1)} раза (з ${fmt(p, 2)} до ${fmt(q, 3)}).`);
    }
  });
  if (r.margin < 0.15) out.push(`Різниця між двома найбільшими апостеріорними ймовірностями лише ${fmt(r.margin, 3)}: стани важко розрізнити за цими ознаками, для уточнення потрібні додаткові обстеження.`);
  out.push(r.accepted
    ? `Оскільки ${fmt(pb, 3)} ≥ Pₗ = ${fmt(v.threshold, 2)}, за правилом (19) діагноз D${sub(b)} приймається.`
    : `Оскільки ${fmt(pb, 3)} < Pₗ = ${fmt(v.threshold, 2)}, за правилом (20) рішення про діагноз не приймається: потрібна додаткова діагностична інформація.`);
  return out;
}

function needProfile(onDone) {
  const name = h('input', { type: 'text', placeholder: 'Прізвище Ім’я По батькові', autocomplete: 'name', value: getProfile()?.name || '' });
  const group = h('input', { type: 'text', placeholder: 'Наприклад, 1ПМ-23б', value: getProfile()?.group || '' });
  const save = () => {
    if (name.value.trim().split(/\s+/).length < 2 || !group.value.trim()) { toast('Вкажіть прізвище, ім’я та групу.', 'error'); return; }
    setProfile({ name: name.value.trim(), group: group.value.trim() });
    onDone();
  };
  return h('div.card.profile-form',
    h('p', 'Індивідуальний варіант формується за вашими ПІБ і групою. Ті самі дані завжди дають той самий варіант.'),
    h('label', 'ПІБ студента', name), h('label', 'Академічна група', group),
    h('button.btn.btn-primary', { onclick: save }, 'Зберегти й отримати варіант'));
}

// ───────────────────────────── режим «Навчання» ─────────────────────────────

function renderLearn(main) {
  const v = guideVariant();
  const r = computeBayes(v);
  const stepsHtml = [
    ['Крок 1. Робоча таблиця', `Обидві ознаки виявлено (K* = k₁k₂), тому в розрахунок ідуть P(k₁/Dᵢ) і P(k₂/Dᵢ) без змін.`],
    ['Крок 2. P(K*/Dᵢ) за (10)', v.states.map((_, i) => `P(K*/D${sub(i)}) = ${fmt(v.featureProbs[i][0], 2)} · ${fmt(v.featureProbs[i][1], 2)} = ${fmt(r.likelihoods[i], 4)}`).join('<br>')],
    ['Крок 3. P(DᵢK*) за (14)', v.states.map((_, i) => `P(D${sub(i)}K*) = ${fmt(v.priors[i], 2)} · ${fmt(r.likelihoods[i], 4)} = ${fmt(r.joints[i], 4)}`).join('<br>')],
    ['Крок 4. P(K*) за (11)', `P(K*) = ${r.joints.map((x) => fmt(x, 4)).join(' + ')} = ${fmt(r.evidence, 4)}`],
    ['Крок 5. P(Dᵢ/K*) за (15)', v.states.map((_, i) => `P(D${sub(i)}/K*) = ${fmt(r.joints[i], 4)} / ${fmt(r.evidence, 4)} = <b>${fmt(r.posteriors[i], 4)}</b>`).join('<br>') + `<br>Перевірка (13): Σ = ${fmt(r.posteriorSum, 4)}`],
    ['Крок 6. Рішення за (18)–(20)', `Найбільша ймовірність — D₂ (${fmt(r.posteriors[1], 2)}): двигун з імовірністю 0,91 має збільшений радіальний зазор. Оскільки 0,91 ≥ Pₗ = 0,7, діагноз приймається.`],
  ];
  let shown = 1;
  const list = h('ol.walk');
  const next = h('button.btn', { onclick: () => { shown = Math.min(shown + 1, stepsHtml.length); paint(); } }, 'Наступний крок →');
  const all = h('button.btn.btn-ghost', { onclick: () => { shown = stepsHtml.length; paint(); } }, 'Показати всі');
  const chartBox = h('div.chart-box');
  function paint() {
    clear(list);
    stepsHtml.slice(0, shown).forEach(([t, body]) => list.append(h('li', h('b', t), h('div', raw(body)))));
    next.disabled = shown >= stepsHtml.length;
    clear(chartBox);
    if (shown >= 5) chartBox.append(resultChart(v, r));
  }
  paint();

  const realizations = [[true, true], [false, true], [true, false], [false, false]];
  const realTable = h('div.table-wrap', h('table.data',
    h('thead', h('tr', h('th', 'K*'), ...v.states.map((_, i) => h('th', raw(sym.post(i + 1)))), h('th', 'Рішення'))),
    h('tbody', realizations.map((obs) => {
      const rr = computeBayes({ ...v, observed: obs });
      return h('tr', h('th', obs.map((o, j) => (o ? `k${sub(j)}` : `¬k${sub(j)}`)).join(' ')),
        ...rr.posteriors.map((p, i) => h(`td.num${i === rr.best ? '.best' : ''}`, fmtFixed(p, 4))),
        h('td', rr.accepted ? `D${sub(rr.best)}` : 'відмова'));
    }))));

  const quiz = h('div.selfcheck', QUESTIONS.map((q) => {
    const fb = h('div.fb');
    return h('fieldset.q', h('legend', q.prompt), q.options.map((o, k) => h('label.opt', h('input', {
      type: 'radio', name: `learn-${q.id}`, onchange: () => {
        fb.className = `fb ${k === q.correct ? 'ok' : 'bad'}`;
        fb.textContent = (k === q.correct ? 'Правильно. ' : 'Неправильно. ') + q.explain;
      },
    }), o)), fb);
  }));

  main.append(
    h('div.card', passport()),
    theory(true),
    formulaCard(),
    section(6, 'Постановка діагностичної задачі (приклад МВ, с. 8)', h('div.prose', raw(EXAMPLE_INTRO))),
    section(7, 'Варіант', h('p', h('span.badge.official', 'Приклад методичних вказівок'), ' Цей розбір не оцінюється. Для індивідуального варіанта перейдіть у режим «Покроковий тренажер».')),
    dataSection(v),
    section(9, 'Покроковий розрахунок', list, h('div.row', next, all)),
    section(10, 'Візуалізація', chartBox, h('p.muted', 'Діаграма з’являється після кроку 5.')),
    section(11, 'Аналіз результатів',
      h('p', 'Ті самі розрахунки для всіх можливих реалізацій комплексу ознак:'), realTable,
      h('ul', analysisText(v, r).map((t) => h('li', t))),
      h('ul', h('li', 'За наявності обох ознак двигун з імовірністю 0,91 перебуває в стані D₂.'),
        h('li', 'За відсутності обох ознак найбільш імовірний нормальний стан (0,91).'),
        h('li', 'За відсутності k₁ і наявності k₂ ймовірності D₂ і D₃ близькі (0,46 і 0,41), тому потрібні додаткові обстеження.')),
      h('div.note.warn', h('b', 'Примітка до МВ. '), EXAMPLE_ERRATA)),
    section(12, 'Контрольні запитання (самоперевірка)', h('p.muted', 'Запитання складено за змістом МВ, с. 4–9 (у МВ для ПР1 їх немає).'), quiz),
    section(13, 'Перевірка виконання', h('p', 'У режимі «Навчання» оцінка не ставиться.')),
    section(14, 'Звіт', h('p', 'Звіт формується після покрокового, самостійного або контрольного виконання.')),
  );
}

// ───────────────────── режими «Покроковий», «Самостійне», «Контроль» ─────────────────────

function pickQuestions(variant, count) {
  const rng = createRng(`${variant.id}|questions`);
  return rng.shuffle(QUESTIONS).slice(0, count);
}

function numberInput(key, state, disabled) {
  return h('input.num-in', {
    type: 'text', inputMode: 'decimal', autocomplete: 'off', spellcheck: false, value: state.answers[key] ?? '',
    'aria-label': key, disabled, dataset: { key },
    oninput: (e) => { state.answers[key] = e.target.value; },
  });
}

function fieldsView(step, v, state, disabled) {
  const n = v.priors.length;
  if (step.id === 'table') {
    return h('div.table-wrap', h('table.data.input-table',
      h('thead', h('tr', h('th', ''), ...v.observed.map((o, j) => h('th', raw(sym.realized('i', j + 1, o)))))),
      h('tbody', Array.from({ length: n }, (_, i) => h('tr', h('th', short(v.states[i])),
        ...v.observed.map((_, j) => h('td', numberInput(`t${i}_${j}`, state, disabled))))))));
  }
  if (step.id === 'evidence') {
    return h('div.inline-field', raw(sym.evidence()), h('span', ' = '), numberInput('e', state, disabled));
  }
  const symFn = { like: sym.like, joint: sym.joint, post: sym.post }[step.id];
  const prefix = { like: 'l', joint: 'j', post: 'p' }[step.id];
  return h('div.table-wrap', h('table.data.input-table',
    h('thead', h('tr', ...Array.from({ length: n }, (_, i) => h('th', raw(symFn(i + 1)))))),
    h('tbody', h('tr', ...Array.from({ length: n }, (_, i) => h('td', numberInput(`${prefix}${i}`, state, disabled)))))));
}

function choiceView(step, state, disabled) {
  return h('div.choices', step.questions.map((q) => h('fieldset.q', { dataset: { q: q.id } },
    h('legend', q.prompt),
    q.options.map((o, k) => h('label.opt', h('input', {
      type: 'radio', name: `${step.id}:${q.id}`, value: String(k), disabled,
      checked: state.answers[`${step.id}:${q.id}`] === String(k),
      onchange: () => { state.answers[`${step.id}:${q.id}`] = String(k); },
    }), o)),
    h('div.fb'))));
}

function paintFeedback(card, step, res) {
  if (step.kind === 'numbers') {
    step.fields.forEach((f) => {
      const inp = card.querySelector(`[data-key="${f.key}"]`);
      if (!inp) return;
      inp.classList.remove('ok', 'bad', 'carried', 'empty');
      const st = res.status[f.key];
      inp.classList.add(st === 'ok' ? 'ok' : st === 'carried' ? 'carried' : st === 'empty' ? 'empty' : 'bad');
      inp.title = res.messages[f.key] || '';
    });
    const msgs = [...new Set(Object.values(res.messages).filter(Boolean))];
    const box = card.querySelector('.step-msg');
    clear(box);
    if (res.allOk) box.append(h('div.fb.ok', 'Усі значення правильні.'));
    else msgs.forEach((m) => box.append(h('div.fb.bad', m)));
  } else {
    step.questions.forEach((q) => {
      const fs = card.querySelector(`[data-q="${q.id}"]`);
      const fb = fs.querySelector('.fb');
      const st = res.status[q.id];
      fs.classList.remove('ok', 'bad');
      fs.classList.add(st === 'ok' ? 'ok' : 'bad');
      fb.className = `fb ${st === 'ok' ? 'ok' : 'bad'}`;
      fb.textContent = st === 'ok' ? 'Правильно.' : res.messages[q.id];
      if (st !== 'ok') fs.querySelectorAll('label.opt')[q.correct]?.classList.add('correct-opt');
    });
    const box = card.querySelector('.step-msg');
    clear(box);
  }
}

function attemptCode(snapshot) {
  const body = `${snapshot.variant.id}|${snapshot.mode}|${snapshot.percent}|${snapshot.date}|${JSON.stringify(snapshot.answers)}`;
  return hashString(body).toString(36).toUpperCase().padStart(7, '0');
}

function renderGraded(main, mode, rerender) {
  const profile = getProfile();
  const head = [h('div.card', passport()), theory(false), formulaCard()];
  if (!profile) {
    main.append(...head, section(7, 'Вибір варіанта', needProfile(rerender)));
    return;
  }
  const work = getWork(WORK);
  const number = mode === 'control' ? (work.controlNumber || 1) : (work.variantNumber || 1);
  const v = variantFor(profile, number, mode);
  const questions = mode === 'control' ? pickQuestions(v, 5) : QUESTIONS.slice(0, 5);
  const { steps, result: r } = buildSteps(v, questions);
  const state = { answers: {}, step: {}, submitted: false, conclusion: '' };
  steps.forEach((s) => { state.step[s.id] = { attempts: 0, hints: 0, done: false, revealed: false, earned: 0 }; });

  // Розділ 7 — варіант
  const changeNumber = (delta) => {
    if (mode === 'control') updateWork(WORK, { controlNumber: number + 1 });
    else updateWork(WORK, { variantNumber: Math.max(1, number + delta) });
    rerender();
  };
  const variantSec = section(7, 'Вибір варіанта',
    h('div.variant-bar',
      h('div', h('div.muted', 'Студент'), h('b', profile.name), ' · ', profile.group,
        h('button.link', { onclick: () => { setProfile(null); rerender(); } }, 'змінити')),
      h('div', h('div.muted', 'Варіант'), h('b', `№ ${number}`), ' · ', h('code', v.id)),
      h('div', v.modelled ? h('span.badge.model', 'Модельні дані') : h('span.badge.official', 'Дані МВ')),
      mode === 'control' ? null : h('div.row',
        h('button.btn.btn-ghost', { onclick: () => changeNumber(-1), disabled: number <= 1 }, '← Попередній'),
        h('button.btn.btn-ghost', { onclick: () => changeNumber(1) }, 'Новий варіант →')),
    ),
    h('p.muted.small', 'Варіант відтворюється за ідентифікатором: ті самі ПІБ, група й номер завжди дають ті самі вихідні дані. ', v.modelled ? 'Числові значення модельні (не статистика реальних об’єктів).' : ''),
  );

  // Розділ 9 — кроки
  const stepCards = [];
  const stepsBox = h('div.steps');
  const resultBox = h('div');
  const chartBox = h('div.chart-box');
  const analysisBox = h('div');
  const reportBox = h('div');

  const isLocked = (idx) => mode === 'step' && idx > 0 && !steps.slice(0, idx).every((s) => state.step[s.id].done);

  function stepCard(step, idx) {
    const st = state.step[step.id];
    const disabled = state.submitted || st.done || isLocked(idx);
    const card = h(`div.step-card${st.done ? '.done' : ''}${isLocked(idx) ? '.locked' : ''}`, { dataset: { step: step.id } },
      h('div.step-head', h('span.step-no', String(idx + 1)), h('h3', step.title), h('span.weight', `${step.weight} %`)),
      h('p.task', step.task),
      step.formulaRefs ? h('div.mini-formulas', step.formulaRefs.map((k) => raw(F[k]))) : null,
      step.kind === 'numbers' ? fieldsView(step, v, state, disabled) : choiceView(step, state, disabled),
      h('div.step-msg'),
    );
    if (mode === 'step' && !isLocked(idx) && !st.done) {
      const hintBox = h('div.hint-box');
      const actions = h('div.row',
        h('button.btn.btn-primary', { onclick: () => onCheck(step, card) }, 'Перевірити крок'),
        step.hint ? h('button.btn.btn-ghost', {
          onclick: () => {
            if (hintBox.childNodes.length) return;
            st.hints++;
            hintBox.append(h('div.hint', h('b', 'Підказка: '), step.hint, h('span.muted', ` (−${POLICY.hintPenalty * 100} % ваги кроку)`)));
          },
        }, 'Підказка') : null,
        st.attempts >= 2 ? h('button.btn.btn-ghost.danger', { onclick: () => onReveal(step) }, 'Показати розв’язок (0 балів за крок)') : null,
      );
      card.append(hintBox, actions);
    }
    if (st.done && mode === 'step') {
      card.append(h('div.step-score', st.revealed ? 'Розв’язок показано системою: 0 %' : `Зараховано ${fmt(st.earned, 1)} з ${step.weight} (спроб: ${st.attempts}, підказок: ${st.hints})`));
    }
    return card;
  }

  function paintSteps() {
    clear(stepsBox);
    stepCards.length = 0;
    steps.forEach((s, idx) => { const c = stepCard(s, idx); stepCards.push(c); stepsBox.append(c); });
    if (mode !== 'step' && !state.submitted) {
      stepsBox.append(h('div.submit-bar',
        h('p', mode === 'control' ? 'Контроль: одна спроба, без підказок. Після перевірки відповіді не можна змінити.' : 'Перевірка всієї роботи. Правильна дія на ваших власних хибних даних зараховується частково (75 %).'),
        h('button.btn.btn-primary.big', { onclick: onSubmitAll }, mode === 'control' ? 'Завершити контроль' : 'Перевірити роботу')));
    }
  }

  function onCheck(step, card) {
    const st = state.step[step.id];
    const res = checkStep(v, r, step, state.answers);
    if (Object.values(res.status).some((x) => x === 'empty')) { paintFeedback(card, step, res); toast('Заповніть усі поля кроку.', 'error'); return; }
    st.attempts++;
    paintFeedback(card, step, res);
    if (res.allOk) {
      st.done = true;
      st.earned = step.weight * stepFactor(st);
      toast('Крок виконано правильно.', 'ok');
      setTimeout(() => { paintSteps(); afterProgress(); }, 650);
    } else if (st.attempts === 2) {
      paintSteps();
      const c = stepsBox.querySelector(`[data-step="${step.id}"]`);
      paintFeedback(c, step, res);
    }
  }

  function onReveal(step) {
    const st = state.step[step.id];
    Object.assign(state.answers, solutionFor(step));
    st.done = true; st.revealed = true; st.earned = 0;
    paintSteps(); afterProgress();
  }

  function onSubmitAll() {
    const empty = steps.some((s) => {
      const res = checkStep(v, r, s, state.answers, { followThrough: true });
      return Object.values(res.status).some((x) => x === 'empty');
    });
    const doSubmit = () => {
      state.submitted = true;
      paintSteps();
      steps.forEach((s, idx) => {
        const res = checkStep(v, r, s, state.answers, { followThrough: true });
        const st = state.step[s.id];
        st.done = true; st.attempts = 1; st.earned = s.weight * res.fraction;
        paintFeedback(stepCards[idx], s, res);
        stepCards[idx].append(h('div.step-score', `Зараховано ${fmt(st.earned, 1)} з ${s.weight}`));
      });
      afterProgress(true);
    };
    if (empty) {
      modal('Не всі поля заповнені', h('p', 'Порожні поля буде оцінено як невиконані. Завершити перевірку?'),
        [{ label: 'Повернутися' }, { label: 'Завершити', primary: true, onClick: doSubmit }]);
    } else if (mode === 'control') {
      modal('Завершити контроль?', h('p', 'Після підтвердження відповіді буде перевірено й зафіксовано.'),
        [{ label: 'Скасувати' }, { label: 'Завершити', primary: true, onClick: doSubmit }]);
    } else doSubmit();
  }

  function allDone() { return steps.every((s) => state.step[s.id].done); }

  function afterProgress(final = false) {
    const calcDone = ['post'].every((id) => state.step[id].done);
    clear(chartBox); clear(analysisBox); clear(resultBox); clear(reportBox);
    if (calcDone || state.submitted) {
      chartBox.append(resultChart(v, r));
    } else chartBox.append(h('p.muted', 'Діаграма з’явиться після обчислення апостеріорних ймовірностей.'));

    if (allDone()) {
      const items = analysisText(v, r);
      const ta = h('textarea', { rows: 4, placeholder: 'Сформулюйте власний висновок щодо технічного стану об’єкта і рекомендованих дій (включається у звіт).', oninput: (e) => { state.conclusion = e.target.value; } });
      analysisBox.append(h('h3', 'Автоматичний аналіз'), h('ul', items.map((t) => h('li', t))), h('h3', 'Висновок студента'), ta);

      const graded = steps.map((s) => ({ id: s.id, title: s.title, category: s.category, weight: s.weight, earned: Math.round(state.step[s.id].earned * 100) / 100,
        attempts: state.step[s.id].attempts, hints: state.step[s.id].hints, revealed: state.step[s.id].revealed }));
      const sm = summarize(graded, WORK);
      resultBox.append(
        h('div.score-hero', h('div.score-big', `${fmt(sm.percent, 1)} %`), h('div', h('b', `Оцінка ${sm.ects}`), h('div', verdictText(sm.percent)),
          h('div.muted.small', `Еквівалент у шкалі РПНД: ${fmt(sm.points, 2)} з ${fmt(sm.maxPoints, 2)} б. за практичну роботу.`))),
        h('div.table-wrap', h('table.data',
          h('thead', h('tr', h('th', 'Критерій'), h('th', 'Вага'), h('th', 'Набрано'))),
          h('tbody', Object.entries(sm.byCat).map(([, c]) => h('tr', h('td', c.title), h('td.num', fmt(c.weight, 0)), h('td.num', fmt(c.earned, 1))))))),
      );
      const snapshot = {
        mode, date: new Date().toISOString(), profile, variant: v, answers: { ...state.answers }, steps: graded,
        percent: sm.percent, ects: sm.ects, questions: questions.map((q) => q.id), conclusion: '',
      };
      snapshot.code = attemptCode(snapshot);
      if (!state.saved) { recordAttempt(WORK, snapshot); state.saved = snapshot; }
      reportBox.append(
        h('p', 'Звіт містить усі 13 розділів, передбачених ТЗ: вихідні дані, формули, послідовність розрахунків, таблиці, графік, аналіз, висновки й результат оцінювання.'),
        h('div.row',
          h('a.btn.btn-primary', {
            href: '#report-1', onclick: () => { patchLastAttempt(WORK, { conclusion: state.conclusion }); },
          }, 'Сформувати звіт'),
          h('button.btn.btn-ghost', { onclick: () => { if (mode === 'control') updateWork(WORK, { controlNumber: number + 1 }); else updateWork(WORK, { variantNumber: number + 1 }); rerender(); } }, mode === 'control' ? 'Нова контрольна спроба' : 'Виконати новий варіант')),
      );
    } else {
      resultBox.append(h('p.muted', mode === 'step' ? 'Оцінка з’явиться після виконання всіх кроків.' : 'Натисніть «Перевірити роботу» після заповнення всіх кроків.'));
      reportBox.append(h('p.muted', 'Звіт стане доступним після завершення роботи.'));
    }
    if (final) document.getElementById('s13')?.scrollIntoView({ behavior: 'smooth' });
  }

  paintSteps();
  afterProgress();

  main.append(
    ...head,
    section(6, 'Постановка діагностичної задачі', h('div.prose', raw(problemStatement(v)))),
    variantSec,
    dataSection(v),
    section(9, mode === 'step' ? 'Покрокове виконання розрахунків' : 'Виконання розрахунків', stepsBox),
    section(10, 'Інтерактивна візуалізація', chartBox),
    section(11, 'Аналіз отриманих результатів', analysisBox),
    section(12, 'Контрольні запитання', h('p.muted', mode === 'control' ? '5 запитань обрано випадково для вашого варіанта — див. останній крок у розділі 9.' : 'Контрольні запитання — останній крок у розділі 9. Запитання складено за змістом МВ, с. 4–9.')),
    section(13, 'Перевірка виконання', resultBox),
    section(14, 'Формування звіту', reportBox),
  );
}

// ───────────────────────────── режим «Дослідження» ─────────────────────────────

function renderResearch(main) {
  const profile = getProfile();
  const presets = [{ id: 'guide', label: 'Приклад МВ — газотурбінний двигун', make: guideVariant }];
  if (profile) presets.push({ id: 'mine', label: 'Мій поточний варіант', make: () => variantFor(profile, getWork(WORK).variantNumber || 1, 'self') });
  let base = presets[0].make();
  let cur = clone(base);
  let sweepParam = { type: 'prior', i: 0 };
  let counts = null;

  function clone(v) { return { ...v, priors: v.priors.slice(), featureProbs: v.featureProbs.map((r) => r.slice()), observed: v.observed.slice() }; }

  const controls = h('div.controls');
  const out = h('div.research-out');
  const sweepBox = h('div');
  const allBox = h('div');
  const updBox = h('div');

  function slider(label, value, onInput, { min = 0, max = 1, step = 0.01 } = {}) {
    const val = h('output', fmtFixed(value, 2));
    return h('label.slider', h('span.sl-label', raw(label)),
      h('input', { type: 'range', min, max, step, value, oninput: (e) => { const x = Number(e.target.value); val.textContent = fmtFixed(x, 2); onInput(x); } }), val);
  }

  function paintControls() {
    clear(controls);
    const sel = h('select', { onchange: (e) => { base = presets.find((p) => p.id === e.target.value).make(); cur = clone(base); counts = null; paintControls(); compute(); } },
      presets.map((p) => h('option', { value: p.id }, p.label)));
    controls.append(
      h('div.row', h('label.inline', 'Об’єкт: ', sel), h('button.btn.btn-ghost', { onclick: () => { cur = clone(base); counts = null; paintControls(); compute(); } }, 'Скинути зміни')),
      h('p.muted.small', cur.object),
      h('h3', 'Апріорні ймовірності станів'),
      h('p.muted.small', 'Зміна однієї ймовірності пропорційно перерозподіляє решту, щоб сума залишалась 1 (формула 8).'),
      ...cur.priors.map((p, i) => slider(sym.prior(i + 1), p, (x) => { setPrior(cur.priors, i, x); syncPriorSliders(); compute(); })),
      h('h3', 'Точність діагностичного методу — матриця P(kⱼ/Dᵢ)'),
      h('div.matrix-sliders', cur.featureProbs.map((row, i) => h('div.ms-row', h('b', short(cur.states[i])),
        row.map((p, j) => slider(sym.feat(i + 1, j + 1), p, (x) => { cur.featureProbs[i][j] = x; compute(); }))))),
      h('h3', 'Результат обстеження K*'),
      h('div.row', cur.observed.map((o, j) => h('label.toggle', h('input', { type: 'checkbox', checked: o, onchange: (e) => { cur.observed[j] = e.target.checked; compute(); } }), ` ${cur.features[j]}`))),
      h('h3', 'Поріг розпізнавання'),
      slider(sym.Pl(), cur.threshold, (x) => { cur.threshold = x; compute(); }, { min: 0.3, max: 0.99 }),
    );
  }
  function syncPriorSliders() {
    const sl = controls.querySelectorAll('.slider');
    cur.priors.forEach((p, i) => { const inp = sl[i].querySelector('input'); inp.value = p; sl[i].querySelector('output').textContent = fmtFixed(p, 2); });
  }

  function compute() {
    clear(out); clear(sweepBox); clear(allBox);
    let r;
    try { r = computeBayes(cur); } catch (e) {
      out.append(h('div.note.error', e instanceof BayesInputError ? e.message : String(e)));
      return;
    }
    out.append(
      h('div.decision', { class: r.accepted ? 'acc' : 'rej' },
        r.accepted ? `Діагноз: ${cur.states[r.best]} (P = ${fmt(r.posteriors[r.best], 3)} ≥ Pₗ)` : `Відмова від розпізнавання: max P = ${fmt(r.posteriors[r.best], 3)} < Pₗ = ${fmt(cur.threshold, 2)}`),
      h('div.table-wrap', h('table.data',
        h('thead', h('tr', h('th', 'Стан'), h('th', raw(sym.prior('i'))), h('th', raw(sym.like('i'))), h('th', raw(sym.joint('i'))), h('th', raw(sym.post('i'))))),
        h('tbody', cur.states.map((st, i) => h(`tr${i === r.best ? '.best-row' : ''}`, h('th', short(st)),
          h('td.num', fmtFixed(cur.priors[i], 3)), h('td.num', fmtFixed(r.likelihoods[i], 4)), h('td.num', fmtFixed(r.joints[i], 4)), h('td.num', fmtFixed(r.posteriors[i], 4))))),
        h('tfoot', h('tr', h('th', 'Σ'), h('td.num', fmtFixed(cur.priors.reduce((a, b) => a + b, 0), 3)), h('td'), h('td.num', `P(K*) = ${fmtFixed(r.evidence, 4)}`), h('td.num', fmtFixed(r.posteriorSum, 4)))))),
      resultChart(cur, r),
    );
    // Чутливість
    const opts = [
      ...cur.states.map((s, i) => ({ v: `prior:${i}`, label: `P(${short(s)}) — апріорна` })),
      ...cur.states.flatMap((s, i) => cur.features.map((f, j) => ({ v: `feat:${i}:${j}`, label: `P(${short(f)}/${short(s)}) — точність ознаки` }))),
    ];
    const key = sweepParam.type === 'prior' ? `prior:${sweepParam.i}` : `feat:${sweepParam.i}:${sweepParam.j}`;
    const sel = h('select', { onchange: (e) => { const [t, a, b] = e.target.value.split(':'); sweepParam = t === 'prior' ? { type: 'prior', i: +a } : { type: 'feature', i: +a, j: +b }; compute(); } },
      opts.map((o) => h('option', { value: o.v, selected: o.v === key }, o.label)));
    const sw = sweep(cur, sweepParam, 101);
    const marker = sweepParam.type === 'prior' ? cur.priors[sweepParam.i] : cur.featureProbs[sweepParam.i][sweepParam.j];
    sweepBox.append(h('label.inline', 'Параметр, що змінюється: ', sel),
      lineChart({ xs: sw.xs, series: cur.states.map((s, i) => ({ name: short(s), values: sw.series[i], className: SERIES[i] })), marker,
        xLabel: 'значення параметра', yLabel: 'P(Dᵢ/K*)', title: 'Чутливість апостеріорних ймовірностей' }));

    // Усі реалізації
    const m = cur.observed.length;
    const rows = [];
    for (let mask = 0; mask < 2 ** m; mask++) {
      const obs = Array.from({ length: m }, (_, j) => Boolean(mask & (1 << (m - 1 - j)))).map((x) => !x);
      let rr = null; try { rr = computeBayes({ ...cur, observed: obs }); } catch { rr = null; }
      rows.push(h('tr', h('th', obs.map((o, j) => (o ? `k${sub(j)}` : `¬k${sub(j)}`)).join(' ')),
        ...cur.states.map((_, i) => h(`td.num${rr && i === rr.best ? '.best' : ''}`, rr ? fmtFixed(rr.posteriors[i], 3) : '—')),
        h('td.num', rr ? fmtFixed(rr.evidence, 4) : '0'),
        h('td', rr ? (rr.accepted ? short(cur.states[rr.best]) : 'відмова') : 'неможлива')));
    }
    allBox.append(h('p.muted.small', 'P(K*) — частка об’єктів, у яких очікується така реалізація; сума за всіма рядками дорівнює 1.'),
      h('div.table-wrap', h('table.data', h('thead', h('tr', h('th', 'K*'), ...cur.states.map((s) => h('th', short(s))), h('th', 'P(K*)'), h('th', 'Рішення'))), h('tbody', rows))));
  }

  // Уточнення матриці (16)–(17)
  function paintUpdate() {
    clear(updBox);
    const Ninp = h('input.num-in', { type: 'number', min: 10, max: 100000, step: 1, value: counts?.N ?? 100 });
    const mu = h('select', cur.states.map((s, i) => h('option', { value: i }, s)));
    const pres = cur.features.map((f, j) => h('label.toggle', h('input', { type: 'checkbox', dataset: { j } }), ` ${short(f)} виявлено`));
    const res = h('div');
    const run = () => {
      const N = Math.max(10, Math.round(Number(Ninp.value) || 100));
      if (!counts || counts.N !== N) {
        const Ni = cur.priors.map((p) => Math.round(p * N));
        Ni[Ni.length - 1] += N - Ni.reduce((a, b) => a + b, 0);
        const Nij = cur.featureProbs.map((row, i) => row.map((p) => Math.round(p * Ni[i])));
        counts = { N, Ni, Nij };
      }
      const i = Number(mu.value);
      const present = pres.map((l) => l.querySelector('input').checked);
      const u = updateMatrix(counts, i, present);
      clear(res);
      res.append(
        h('div.table-wrap', h('table.data',
          h('thead', h('tr', h('th', 'Величина'), h('th', 'До'), h('th', 'За (16)/(17) МВ'), h('th', 'Узгоджена (17′)'))),
          h('tbody',
            ...cur.states.map((s, k) => h('tr', h('th', `P(${short(s)})`), h('td.num', fmtFixed(counts.Ni[k] / counts.N, 4)), h('td.num', fmtFixed(u.priors[k], 4)), h('td.num', fmtFixed(u.priors[k], 4)))),
            ...cur.features.map((f, j) => h('tr', h('th', `P(${short(f)}/${short(cur.states[i])})`),
              h('td.num', fmtFixed(counts.Ni[i] ? counts.Nij[i][j] / counts.Ni[i] : 0, 4)),
              h('td.num', `${fmtFixed(u.guide[j].pYes, 4)} (Σ градацій = ${fmtFixed(u.guide[j].sum, 4)})`),
              h('td.num', `${fmtFixed(u.normalized[j].pYes, 4)} (Σ = ${fmtFixed(u.normalized[j].sum, 4)})`)))))),
        h('p.muted.small', `Модельні лічильники: N = ${counts.N}, Nᵢ = (${counts.Ni.join('; ')}) отримано округленням поточних ймовірностей.`),
        h('button.btn', {
          onclick: () => {
            cur.priors = u.priors.slice();
            u.normalized.forEach((x, j) => { cur.featureProbs[i][j] = x.pYes; });
            counts = u.newCounts;
            paintControls(); compute(); run();
            toast('Матрицю уточнено за узгодженою формою (17′).', 'ok');
          },
        }, 'Застосувати узгоджену форму до матриці'),
      );
    };
    updBox.append(
      h('p', 'Моделювання надходження нового об’єкта з відомим діагнозом (МВ, с. 7). Показано результат за формулою (17) у поданому в МВ вигляді та за узгодженою формою з нормуванням.'),
      h('div.row', h('label.inline', 'N = ', Ninp), h('label.inline', 'Діагноз нового об’єкта Dμ: ', mu)), h('div.row', pres),
      h('button.btn.btn-primary', { onclick: run }, 'Додати об’єкт'), res);
  }

  paintControls();
  compute();
  paintUpdate();

  main.append(
    h('div.card', passport()),
    theory(false),
    formulaCard(),
    section(6, 'Постановка дослідницької задачі', h('p', 'Змінюйте апріорні ймовірності, точність діагностичного методу (ймовірності ознак) і результат обстеження. Спостерігайте, як змінюються апостеріорні ймовірності і рішення про діагноз. Розрахунки виконуються миттєво, без перезавантаження сторінки.')),
    section(7, 'Вибір об’єкта', h('p.muted', 'Оберіть приклад МВ або свій поточний варіант у панелі нижче.')),
    h('div.research-grid', section(8, 'Параметри', controls), section(9, 'Розрахунок і рішення', out)),
    section(10, 'Чутливість діагнозу до параметрів', sweepBox),
    section(11, 'Аналіз: рішення для всіх реалізацій комплексу ознак', allBox),
    section(12, 'Уточнення діагностичної матриці (формули 16–17)', updBox),
    section(13, 'Перевірка', h('p.muted', 'Дослідницький режим не оцінюється.')),
    section(14, 'Звіт', h('p.muted', 'Звіт формується в режимах «Покроковий тренажер», «Самостійне виконання» і «Контроль».')),
  );
}

// ───────────────────────────── точка входу ─────────────────────────────

export function renderPR1(root, mode, rerender) {
  clear(root);
  const tabs = h('nav.mode-tabs', { 'aria-label': 'Режими роботи' }, MODES.map((m, k) => h(`a.mode-tab${m.id === mode ? '.active' : ''}`, { href: `#pr1-${m.id}`, title: m.hint }, h('span.mt-no', `${k + 1}`), m.title)));
  const toc = h('nav.toc', { 'aria-label': 'Розділи роботи' }, h('div.toc-title', 'Розділи'),
    ['Назва, мета, результати', 'Теорія', 'Формули', 'Постановка задачі', 'Варіант', 'Вихідні дані', 'Розрахунок', 'Візуалізація', 'Аналіз', 'Контрольні запитання', 'Перевірка', 'Звіт']
      .map((t, k) => h('a', { href: `#s${k === 0 ? 'top' : k + 3}`, onclick: (e) => { e.preventDefault(); document.getElementById(k === 0 ? 'top' : `s${k + 3}`)?.scrollIntoView({ behavior: 'smooth' }); } }, t)));
  const main = h('div.work-main');
  const hintText = MODES.find((m) => m.id === mode)?.hint;
  root.append(
    h('div.work-head#top', h('a.back', { href: '#home' }, '← Усі практичні роботи'),
      h('div.work-kicker', 'Практична робота № 1'), h('h1', META.title), tabs, h('p.mode-hint', hintText)),
    h('div.work-layout', toc, main),
  );
  if (mode === 'learn') renderLearn(main);
  else if (mode === 'research') renderResearch(main);
  else renderGraded(main, mode, rerender);
  if (getWork(WORK).status === 'new') updateWork(WORK, { status: 'progress' });
}
