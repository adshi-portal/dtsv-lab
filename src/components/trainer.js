// Спільний рушій тренажерів ПР2–ПР9: єдина структура з 14 розділів і 5 режимів (ТЗ, пп. 3–4, 8).
// Модуль ПР описує лише предметну частину (див. інтерфейс нижче); інтерфейс, перевірка,
// оцінювання, збереження і звіт однакові для всіх робіт.
//
// Інтерфейс модуля:
// { n, meta:{title, goal, goalSource, outcomes[]}, theory:[{title, html}], formulas: html, legend: [[символ, опис]],
//   questions: [{id, prompt, options[], correct, explain}], guideVariant(), variantFor(profile, number, mode),
//   solve(v) → r, problem(v) → html, dataView(v) → Node, steps(v, r, questions) → Step[], own?(v, answers) → {key: value},
//   chart(v, r) → Node, analysis(v, r) → string[], resultTable(v, r) → Node, learn: {intro, walk(v, r) → [[title, html]], notes[]},
//   research(container, ctx) — власний дослідницький інтерфейс, reportFormulas: html }
// Step: { id, title, category, weight, kind:'numbers'|'choice', task, formulas?, fields?:[{key, label, ref, explain?(x)}],
//   questions?, hint, extension?: true (поза МВ) }

import { h, raw, clear, toast, modal } from './dom.js';
import { MODES, COURSE } from '../data/course.js';
import { getProfile, setProfile, getWork, updateWork, recordAttempt, patchLastAttempt, lastAttempt } from '../data/store.js';
import { parseNumber, withinTolerance, fmt, fmtFixed } from '../calculations/numeric.js';
import { createRng, hashString } from '../calculations/rng.js';
import { stepFactor, summarize, verdictText, POLICY } from '../calculations/grading.js';

export function section(no, title, ...body) {
  return h(`section.sec#s${no}`, h('h2.sec-title', h('span.sec-no', String(no)), title), ...body);
}

export function passport(meta) {
  return h('div.passport',
    h('div.pp-row', h('span.pp-k', '1 · Назва'), h('span.pp-v', meta.title)),
    h('div.pp-row', h('span.pp-k', '2 · Мета'), h('span.pp-v', meta.goal, h('span.src', ` (${meta.goalSource})`))),
    h('div.pp-row', h('span.pp-k', '3 · Результати'), h('ul.pp-v.outcomes', meta.outcomes.map((o) => h('li', o)))));
}

function theorySec(mod, open) {
  return section(4, 'Теоретичні відомості', ...mod.theory.map((t, k) => h('details.theory', { open: open && k < 3 }, h('summary', t.title), h('div.theory-body', raw(t.html)))));
}

function formulaSec(mod) {
  return section(5, 'Основні формули та позначення', h('div.formula-grid', raw(mod.formulas)),
    h('dl.legend-list', mod.legend.flatMap(([k, v]) => [h('dt', raw(k)), h('dd', v)])));
}

function variantBadge(v) {
  return v.modelled ? h('span.badge.model', 'Модельні дані') : h('span.badge.official', 'Дані МВ');
}

// ───────────── перевірка ─────────────

export function checkNumbers(step, answers, own, follow) {
  const status = {}; const messages = {}; let credit = 0;
  for (const f of step.fields) {
    const x = parseNumber(answers[f.key]);
    if (!Number.isFinite(x)) { status[f.key] = 'empty'; messages[f.key] = 'Введіть число (кома або крапка).'; continue; }
    if (withinTolerance(x, f.ref, f.tol)) { status[f.key] = 'ok'; credit += 1; continue; }
    const o = follow && own ? own[f.key] : undefined;
    if (Number.isFinite(o) && withinTolerance(x, o, f.tol)) {
      status[f.key] = 'carried'; credit += POLICY.carriedFactor;
      messages[f.key] = 'Дія виконана правильно, але на основі вашого хибного значення з попереднього кроку.';
      continue;
    }
    status[f.key] = 'wrong';
    messages[f.key] = f.explain?.(x) || `${stripTags(f.label)}: перевірте розрахунок.`;
  }
  return { status, messages, fraction: step.fields.length ? credit / step.fields.length : 0, allOk: Object.values(status).every((s) => s === 'ok') };
}

export function checkChoice(step, answers) {
  const status = {}; const messages = {}; let ok = 0;
  for (const q of step.questions) {
    const a = answers[`${step.id}:${q.id}`];
    if (a === undefined || a === '') { status[q.id] = 'empty'; messages[q.id] = 'Оберіть відповідь.'; continue; }
    if (Number(a) === q.correct) { status[q.id] = 'ok'; ok++; } else { status[q.id] = 'wrong'; messages[q.id] = q.explain; }
  }
  return { status, messages, fraction: step.questions.length ? ok / step.questions.length : 0, allOk: ok === step.questions.length };
}

const stripTags = (s) => String(s).replace(/<[^>]+>/g, '');

export function checkAny(mod, v, step, answers, follow) {
  return step.kind === 'numbers' ? checkNumbers(step, answers, follow ? mod.own?.(v, answers) : null, follow) : checkChoice(step, answers);
}

export function solutionFor(step) {
  const a = {};
  if (step.kind === 'numbers') step.fields.forEach((f) => { a[f.key] = fmt(f.ref, f.digits ?? 4); });
  else step.questions.forEach((q) => { a[`${step.id}:${q.id}`] = String(q.correct); });
  return a;
}

// ───────────── введення ─────────────

function numberInput(key, state, disabled, label) {
  return h('input.num-in', { type: 'text', inputMode: 'decimal', autocomplete: 'off', spellcheck: false, value: state.answers[key] ?? '', 'aria-label': stripTags(label || key), disabled, dataset: { key }, oninput: (e) => { state.answers[key] = e.target.value; } });
}

function fieldsView(step, state, disabled) {
  if (step.grid) {
    const { rows, cols, key } = step.grid;
    return h('div.table-wrap', h('table.data.input-table',
      h('thead', h('tr', h('th', ''), cols.map((c) => h('th', raw(c))))),
      h('tbody', rows.map((r, i) => h('tr', h('th', raw(r)), cols.map((_, j) => h('td', numberInput(key(i, j), state, disabled, `${r} ${cols[j]}`))))))));
  }
  return h('div.field-list', step.fields.map((f) => h('label.field', h('span.f-label', raw(f.label)), numberInput(f.key, state, disabled, f.label))));
}

function choiceView(step, state, disabled) {
  return h('div.choices', step.questions.map((q) => h('fieldset.q', { dataset: { q: q.id } }, h('legend', q.prompt),
    q.options.map((o, k) => h('label.opt', h('input', { type: 'radio', name: `${step.id}:${q.id}`, value: String(k), disabled, checked: state.answers[`${step.id}:${q.id}`] === String(k), onchange: () => { state.answers[`${step.id}:${q.id}`] = String(k); } }), o)),
    h('div.fb'))));
}

function paintFeedback(card, step, res) {
  const box = card.querySelector('.step-msg'); clear(box);
  if (step.kind === 'numbers') {
    step.fields.forEach((f) => {
      const inp = card.querySelector(`[data-key="${f.key}"]`); if (!inp) return;
      inp.classList.remove('ok', 'bad', 'carried', 'empty');
      const st = res.status[f.key];
      inp.classList.add(st === 'ok' ? 'ok' : st === 'carried' ? 'carried' : st === 'empty' ? 'empty' : 'bad');
      inp.title = res.messages[f.key] || '';
    });
    if (res.allOk) box.append(h('div.fb.ok', 'Усі значення правильні.'));
    else [...new Set(Object.values(res.messages).filter(Boolean))].slice(0, 6).forEach((m) => box.append(h('div.fb.bad', m)));
  } else {
    step.questions.forEach((q) => {
      const fs = card.querySelector(`[data-q="${q.id}"]`); const fb = fs.querySelector('.fb'); const st = res.status[q.id];
      fs.classList.remove('ok', 'bad'); fs.classList.add(st === 'ok' ? 'ok' : 'bad');
      fb.className = `fb ${st === 'ok' ? 'ok' : 'bad'}`; fb.textContent = st === 'ok' ? 'Правильно.' : res.messages[q.id];
      if (st !== 'ok' && st !== 'empty') fs.querySelectorAll('label.opt')[q.correct]?.classList.add('correct-opt');
    });
  }
}

function pickQuestions(mod, v, mode) {
  if (mode !== 'control') return mod.questions.slice(0, 5);
  return createRng(`${v.id}|questions`).shuffle(mod.questions).slice(0, 5);
}

function needProfile(onDone) {
  const name = h('input', { type: 'text', placeholder: 'Прізвище Ім’я По батькові', autocomplete: 'name' });
  const group = h('input', { type: 'text', placeholder: 'Наприклад, 1ПМ-23б' });
  return h('div.card.profile-form', h('p', 'Індивідуальний варіант формується за вашими ПІБ і групою.'),
    h('label', 'ПІБ студента', name), h('label', 'Академічна група', group),
    h('button.btn.btn-primary', { onclick: () => {
      if (name.value.trim().split(/\s+/).length < 2 || !group.value.trim()) { toast('Вкажіть прізвище, ім’я та групу.', 'error'); return; }
      setProfile({ name: name.value.trim(), group: group.value.trim() }); onDone();
    } }, 'Зберегти й отримати варіант'));
}

// ───────────── режим «Навчання» ─────────────

function renderLearn(main, mod) {
  const v = mod.guideVariant();
  const r = mod.solve(v);
  const walk = mod.learn.walk(v, r);
  let shown = 1;
  const list = h('ol.walk');
  const chartBox = h('div.chart-box');
  const next = h('button.btn', { onclick: () => { shown = Math.min(shown + 1, walk.length); paint(); } }, 'Наступний крок →');
  const all = h('button.btn.btn-ghost', { onclick: () => { shown = walk.length; paint(); } }, 'Показати всі');
  function paint() {
    clear(list); walk.slice(0, shown).forEach(([t, b]) => list.append(h('li', h('b', t), h('div', raw(b)))));
    next.disabled = shown >= walk.length;
    clear(chartBox); if (shown >= walk.length - 1) chartBox.append(mod.chart(v, r));
    else chartBox.append(h('p.muted', 'Графік з’явиться наприкінці розбору.'));
  }
  paint();
  const quiz = h('div.selfcheck', mod.questions.map((q) => {
    const fb = h('div.fb');
    return h('fieldset.q', h('legend', q.prompt), q.options.map((o, k) => h('label.opt', h('input', { type: 'radio', name: `learn-${q.id}`, onchange: () => { fb.className = `fb ${k === q.correct ? 'ok' : 'bad'}`; fb.textContent = (k === q.correct ? 'Правильно. ' : 'Неправильно. ') + q.explain; } }), o)), fb);
  }));
  main.append(h('div.card', passport(mod.meta)), theorySec(mod, true), formulaSec(mod),
    section(6, `Постановка задачі (приклад МВ)`, h('div.prose', raw(mod.learn.intro))),
    section(7, 'Варіант', h('p', variantBadge(v), ` ${v.source}. Розбір не оцінюється; індивідуальний варіант — у режимі «Покроковий тренажер».`)),
    section(8, 'Вихідні дані', mod.dataView(v)),
    section(9, 'Покроковий розрахунок', list, h('div.row', next, all)),
    section(10, 'Візуалізація', chartBox),
    section(11, 'Аналіз результатів', mod.resultTable(v, r), h('ul', mod.analysis(v, r).map((t) => h('li', t))),
      ...(mod.learn.notes || []).map((n) => h('div.note.warn', raw(n)))),
    section(12, 'Контрольні запитання (самоперевірка)', h('p.muted', 'Запитання з методичних вказівок; варіанти відповідей — за змістом МВ.'), quiz),
    section(13, 'Перевірка виконання', h('p', 'У режимі «Навчання» оцінка не ставиться.')),
    section(14, 'Звіт', h('p', 'Звіт формується після покрокового, самостійного або контрольного виконання.')));
}

// ───────────── оцінювані режими ─────────────

function renderGraded(main, mode, rerender, mod) {
  const W = mod.n;
  const profile = getProfile();
  const head = [h('div.card', passport(mod.meta)), theorySec(mod, false), formulaSec(mod)];
  if (!profile) { main.append(...head, section(7, 'Вибір варіанта', needProfile(rerender))); return; }
  const work = getWork(W);
  const number = mode === 'control' ? (work.controlNumber || 1) : (work.variantNumber || 1);
  const v = mod.variantFor(profile, number, mode);
  const r = mod.solve(v);
  const questions = pickQuestions(mod, v, mode);
  const steps = mod.steps(v, r, questions);
  const state = { answers: {}, step: {}, submitted: false, conclusion: '' };
  steps.forEach((s) => { state.step[s.id] = { attempts: 0, hints: 0, done: false, revealed: false, earned: 0 }; });

  const go = (num) => { updateWork(W, mode === 'control' ? { controlNumber: num } : { variantNumber: Math.max(1, num) }); rerender(); };
  const variantSec = section(7, 'Вибір варіанта',
    h('div.variant-bar',
      h('div', h('div.muted', 'Студент'), h('b', profile.name), ' · ', profile.group, h('button.link', { onclick: () => { setProfile(null); rerender(); } }, 'змінити')),
      h('div', h('div.muted', 'Варіант'), h('b', `№ ${number}`), ' · ', h('code', v.id)), h('div', variantBadge(v)),
      mode === 'control' ? null : h('div.row', h('button.btn.btn-ghost', { onclick: () => go(number - 1), disabled: number <= 1 }, '← Попередній'), h('button.btn.btn-ghost', { onclick: () => go(number + 1) }, 'Новий варіант →'))),
    h('p.muted.small', 'Варіант відтворюється за ідентифікатором. ', v.modelled ? 'Числові значення модельні (не статистика реальних об’єктів).' : ''));

  const stepsBox = h('div.steps'); const cards = [];
  const chartBox = h('div.chart-box'); const analysisBox = h('div'); const resultBox = h('div'); const reportBox = h('div');
  const locked = (idx) => mode === 'step' && idx > 0 && !steps.slice(0, idx).every((s) => state.step[s.id].done);

  function card(step, idx) {
    const st = state.step[step.id];
    const dis = state.submitted || st.done || locked(idx);
    const c = h(`div.step-card${st.done ? '.done' : ''}${locked(idx) ? '.locked' : ''}`, { dataset: { step: step.id } },
      h('div.step-head', h('span.step-no', String(idx + 1)), h('h3', step.title, step.extension ? h('span.badge.model.ext', 'поза МВ') : null), h('span.weight', `${step.weight} %`)),
      h('p.task', raw(step.task)), step.formulas ? h('div.mini-formulas', raw(step.formulas)) : null,
      step.kind === 'numbers' ? fieldsView(step, state, dis) : choiceView(step, state, dis), h('div.step-msg'));
    if (mode === 'step' && !locked(idx) && !st.done) {
      const hb = h('div.hint-box');
      c.append(hb, h('div.row',
        h('button.btn.btn-primary', { onclick: () => onCheck(step, c) }, 'Перевірити крок'),
        step.hint ? h('button.btn.btn-ghost', { onclick: () => { if (hb.childNodes.length) return; st.hints++; hb.append(h('div.hint', h('b', 'Підказка: '), raw(step.hint), h('span.muted', ` (−${POLICY.hintPenalty * 100} % ваги кроку)`))); } }, 'Підказка') : null,
        st.attempts >= 2 ? h('button.btn.btn-ghost.danger', { onclick: () => { Object.assign(state.answers, solutionFor(step)); st.done = true; st.revealed = true; st.earned = 0; paint(); after(); } }, 'Показати розв’язок (0 балів за крок)') : null));
    }
    if (st.done && mode === 'step') c.append(h('div.step-score', st.revealed ? 'Розв’язок показано системою: 0 %' : `Зараховано ${fmt(st.earned, 1)} з ${step.weight} (спроб: ${st.attempts}, підказок: ${st.hints})`));
    return c;
  }
  function paint() {
    clear(stepsBox); cards.length = 0;
    steps.forEach((s, i) => { const c = card(s, i); cards.push(c); stepsBox.append(c); });
    if (mode !== 'step' && !state.submitted) stepsBox.append(h('div.submit-bar', h('p', mode === 'control' ? 'Контроль: одна спроба, без підказок.' : 'Перевірка всієї роботи. Правильна дія на ваших власних хибних даних зараховується на 75 %.'),
      h('button.btn.btn-primary.big', { onclick: submitAll }, mode === 'control' ? 'Завершити контроль' : 'Перевірити роботу')));
  }
  function onCheck(step, c) {
    const st = state.step[step.id];
    const res = checkAny(mod, v, step, state.answers, false);
    if (Object.values(res.status).some((x) => x === 'empty')) { paintFeedback(c, step, res); toast('Заповніть усі поля кроку.', 'error'); return; }
    st.attempts++; paintFeedback(c, step, res);
    if (res.allOk) { st.done = true; st.earned = step.weight * stepFactor(st); toast('Крок виконано правильно.', 'ok'); setTimeout(() => { paint(); after(); }, 650); }
    else if (st.attempts === 2) { paint(); paintFeedback(stepsBox.querySelector(`[data-step="${step.id}"]`), step, res); }
  }
  function submitAll() {
    const empty = steps.some((s) => Object.values(checkAny(mod, v, s, state.answers, true).status).includes('empty'));
    const run = () => {
      state.submitted = true; paint();
      steps.forEach((s, i) => {
        const res = checkAny(mod, v, s, state.answers, true); const st = state.step[s.id];
        st.done = true; st.attempts = 1; st.earned = s.weight * res.fraction;
        paintFeedback(cards[i], s, res); cards[i].append(h('div.step-score', `Зараховано ${fmt(st.earned, 1)} з ${s.weight}`));
      });
      after(true);
    };
    if (empty) modal('Не всі поля заповнені', h('p', 'Порожні поля буде оцінено як невиконані. Завершити перевірку?'), [{ label: 'Повернутися' }, { label: 'Завершити', primary: true, onClick: run }]);
    else if (mode === 'control') modal('Завершити контроль?', h('p', 'Відповіді буде перевірено й зафіксовано.'), [{ label: 'Скасувати' }, { label: 'Завершити', primary: true, onClick: run }]);
    else run();
  }
  const allDone = () => steps.every((s) => state.step[s.id].done);
  function after(final = false) {
    [chartBox, analysisBox, resultBox, reportBox].forEach(clear);
    const vizReady = state.submitted || steps.filter((s) => s.category === 'calc').every((s) => state.step[s.id].done);
    chartBox.append(vizReady ? mod.chart(v, r) : h('p.muted', 'Графік з’явиться після виконання розрахункових кроків.'));
    if (!allDone()) {
      resultBox.append(h('p.muted', mode === 'step' ? 'Оцінка з’явиться після виконання всіх кроків.' : 'Натисніть «Перевірити роботу» після заповнення всіх кроків.'));
      reportBox.append(h('p.muted', 'Звіт стане доступним після завершення роботи.'));
      return;
    }
    const ta = h('textarea', { rows: 4, placeholder: 'Сформулюйте власний висновок (включається у звіт).', oninput: (e) => { state.conclusion = e.target.value; } });
    analysisBox.append(mod.resultTable(v, r), h('h3', 'Автоматичний аналіз'), h('ul', mod.analysis(v, r).map((t) => h('li', t))), h('h3', 'Висновок студента'), ta);
    const graded = steps.map((s) => ({ id: s.id, title: s.title, category: s.category, weight: s.weight, earned: Math.round(state.step[s.id].earned * 100) / 100, attempts: state.step[s.id].attempts, hints: state.step[s.id].hints, revealed: state.step[s.id].revealed }));
    const sm = summarize(graded, W);
    resultBox.append(
      h('div.score-hero', h('div.score-big', `${fmt(sm.percent, 1)} %`), h('div', h('b', `Оцінка ${sm.ects}`), h('div', verdictText(sm.percent)), h('div.muted.small', `Еквівалент у шкалі РПНД: ${fmt(sm.points, 2)} з ${fmt(sm.maxPoints, 2)} б.`))),
      h('div.table-wrap', h('table.data', h('thead', h('tr', h('th', 'Критерій'), h('th', 'Вага'), h('th', 'Набрано'))), h('tbody', Object.values(sm.byCat).map((c) => h('tr', h('td', c.title), h('td.num', fmt(c.weight, 0)), h('td.num', fmt(c.earned, 1))))))));
    if (!state.saved) {
      const snap = { mode, date: new Date().toISOString(), profile, variant: v, answers: { ...state.answers }, steps: graded, percent: sm.percent, ects: sm.ects, questions: questions.map((q) => q.id), conclusion: '' };
      snap.code = hashString(`${v.id}|${mode}|${sm.percent}|${snap.date}|${JSON.stringify(snap.answers)}`).toString(36).toUpperCase().padStart(7, '0');
      recordAttempt(W, snap); state.saved = snap;
    }
    reportBox.append(h('p', 'Звіт містить 13 розділів: вихідні дані, формули, послідовність розрахунків, таблиці, графік, аналіз, висновки й результат оцінювання.'),
      h('div.row', h('a.btn.btn-primary', { href: `#report-${W}`, onclick: () => patchLastAttempt(W, { conclusion: state.conclusion }) }, 'Сформувати звіт'),
        h('button.btn.btn-ghost', { onclick: () => go(number + 1) }, mode === 'control' ? 'Нова контрольна спроба' : 'Виконати новий варіант')));
    if (final) document.getElementById('s13')?.scrollIntoView({ behavior: 'smooth' });
  }
  paint(); after();
  main.append(...head,
    section(6, 'Постановка діагностичної задачі', h('div.prose', raw(mod.problem(v)))), variantSec,
    section(8, 'Вихідні дані', mod.dataView(v)),
    section(9, mode === 'step' ? 'Покрокове виконання розрахунків' : 'Виконання розрахунків', stepsBox),
    section(10, 'Інтерактивна візуалізація', chartBox), section(11, 'Аналіз отриманих результатів', analysisBox),
    section(12, 'Контрольні запитання', h('p.muted', mode === 'control' ? '5 запитань обрано випадково для вашого варіанта — останній крок у розділі 9.' : 'Контрольні запитання з МВ — останній крок у розділі 9.')),
    section(13, 'Перевірка виконання', resultBox), section(14, 'Формування звіту', reportBox));
}

// ───────────── дослідження ─────────────

function renderResearch(main, mod) {
  const box = h('div.research');
  main.append(h('div.card', passport(mod.meta)), theorySec(mod, false), formulaSec(mod), box);
  mod.research(box, { section, profile: getProfile(), work: getWork(mod.n) });
}

// ───────────── оболонка роботи ─────────────

export function renderWork(root, mode, rerender, mod) {
  clear(root);
  const tabs = h('nav.mode-tabs', { 'aria-label': 'Режими роботи' }, MODES.map((m, k) => h(`a.mode-tab${m.id === mode ? '.active' : ''}`, { href: `#pr${mod.n}-${m.id}`, title: m.hint }, h('span.mt-no', `${k + 1}`), m.title)));
  const toc = h('nav.toc', { 'aria-label': 'Розділи роботи' }, h('div.toc-title', 'Розділи'),
    ['Назва, мета, результати', 'Теорія', 'Формули', 'Постановка задачі', 'Варіант', 'Вихідні дані', 'Розрахунок', 'Візуалізація', 'Аналіз', 'Контрольні запитання', 'Перевірка', 'Звіт']
      .map((t, k) => h('a', { href: `#s${k + 3}`, onclick: (e) => { e.preventDefault(); document.getElementById(k === 0 ? 'top' : `s${k + 3}`)?.scrollIntoView({ behavior: 'smooth' }); } }, t)));
  const main = h('div.work-main');
  root.append(h('div.work-head#top', h('a.back', { href: '#home' }, '← Усі практичні роботи'), h('div.work-kicker', `Практична робота № ${mod.n}`), h('h1', mod.meta.title), tabs, h('p.mode-hint', MODES.find((m) => m.id === mode)?.hint)),
    h('div.work-layout', toc, main));
  if (mode === 'learn') renderLearn(main, mod);
  else if (mode === 'research') renderResearch(main, mod);
  else renderGraded(main, mode, rerender, mod);
  if (getWork(mod.n).status === 'new') updateWork(mod.n, { status: 'progress' });
}

// ───────────── звіт ─────────────

const MARK = { ok: '✓', carried: '≈', wrong: '✗', empty: '—' };

export function renderModuleReport(root, mod) {
  clear(root);
  const a = lastAttempt(mod.n);
  if (!a) {
    root.append(h('div.page', h('a.back', { href: '#home' }, '← На головну'), h('h1', 'Звіт недоступний'), h('p', 'Звіт формується після завершення роботи в оцінюваному режимі.'), h('a.btn.btn-primary', { href: `#pr${mod.n}-step` }, `Перейти до ПР № ${mod.n}`)));
    return;
  }
  const v = a.variant; const r = mod.solve(v);
  const qs = mod.questions.filter((q) => a.questions.includes(q.id));
  const steps = mod.steps(v, r, qs);
  const sm = summarize(a.steps, mod.n);
  const follow = a.mode !== 'step';
  const own = follow ? mod.own?.(v, a.answers) : null;
  const rows = []; const crow = [];
  steps.forEach((s) => {
    if (s.kind === 'numbers') {
      const res = checkNumbers(s, a.answers, own, follow);
      s.fields.forEach((f) => rows.push(h(`tr.st-${res.status[f.key]}`, h('td', s.title), h('td', raw(f.label)), h('td.num', a.answers[f.key] ? String(a.answers[f.key]).replace('.', ',') : '—'), h('td.num', fmtFixed(f.ref, f.digits ?? 4)), h('td.center', MARK[res.status[f.key]]))));
    } else s.questions.forEach((q) => { const ans = a.answers[`${s.id}:${q.id}`]; const ok = Number(ans) === q.correct; crow.push(h(`tr.st-${ok ? 'ok' : 'wrong'}`, h('td', q.prompt), h('td', ans !== undefined ? q.options[Number(ans)] : '—'), h('td.center', ok ? '✓' : '✗'))); });
  });
  const rs = (no, t, ...b) => h('section.r-sec', h('h2', `${no}. ${t}`), ...b);
  const modeTitle = MODES.find((m) => m.id === a.mode)?.title ?? a.mode;
  root.append(h('div.report-toolbar.no-print', h('a.btn.btn-ghost', { href: `#pr${mod.n}-${a.mode}` }, '← Повернутися до роботи'), h('button.btn.btn-primary', { onclick: () => window.print() }, 'Друк / Зберегти у PDF'),
    h('span.muted.small', 'У вікні друку оберіть «Зберегти як PDF». Якщо вікно не відкрилось (вбудований перегляд), відкрийте систему з GitHub Pages або локального сервера.')),
  h('article.report',
    h('header.r-head', h('div', COURSE.university), h('div', COURSE.faculty), h('div', COURSE.department), h('div.r-title', 'ЗВІТ'), h('div', `про виконання практичної роботи № ${mod.n} з дисципліни «${COURSE.title}»`)),
    rs(1, 'Назва практичної роботи', h('p', mod.meta.title)),
    rs(2, 'Студент', h('table.r-kv', h('tr', h('th', 'ПІБ'), h('td', a.profile.name)), h('tr', h('th', 'Група'), h('td', a.profile.group)))),
    rs(3, 'Варіант', h('table.r-kv', h('tr', h('th', 'Номер'), h('td', `№ ${v.number}`)), h('tr', h('th', 'Ідентифікатор'), h('td', h('code', v.id))), h('tr', h('th', 'Режим'), h('td', modeTitle)), h('tr', h('th', 'Дані'), h('td', v.modelled ? 'модельні (згенеровані системою за ідентифікатором)' : 'приклад методичних вказівок')))),
    rs(4, 'Мета роботи', h('p', mod.meta.goal)),
    rs(5, 'Теоретичні відомості', h('p', mod.reportTheory)),
    rs(6, 'Вихідні дані', h('div.prose', raw(mod.problem(v))), mod.dataView(v)),
    rs(7, 'Формули', h('div.r-formulas', raw(mod.formulas))),
    rs(8, 'Послідовність розрахунків', h('p.small', 'Позначки: ✓ — правильно; ≈ — правильна дія на власних хибних попередніх даних; ✗ — помилка; — — не заповнено.'),
      h('table.r-table', h('thead', h('tr', h('th', 'Крок'), h('th', 'Величина'), h('th', 'Значення студента'), h('th', 'Еталон'), h('th', ''))), h('tbody', rows)),
      h('table.r-table', h('thead', h('tr', h('th', 'Вибір формул, інтерпретація, рішення, контрольні запитання'), h('th', 'Відповідь'), h('th', ''))), h('tbody', crow))),
    rs(9, 'Таблиця результатів', mod.resultTable(v, r)),
    rs(10, 'Графіки', h('div.r-chart', mod.chart(v, r))),
    rs(11, 'Аналіз результатів', h('ul', mod.analysis(v, r).map((t) => h('li', t)))),
    rs(12, 'Висновки', a.conclusion?.trim() ? h('p', a.conclusion) : h('p', h('i', 'Висновок студента не сформульовано. Автоматичний висновок: '), mod.analysis(v, r).slice(-1)[0])),
    rs(13, 'Результат автоматичного оцінювання',
      h('table.r-table', h('thead', h('tr', h('th', 'Критерій'), h('th', 'Вага, %'), h('th', 'Набрано'))), h('tbody', Object.values(sm.byCat).map((c) => h('tr', h('td', c.title), h('td.num', fmt(c.weight, 0)), h('td.num', fmt(c.earned, 1))))),
        h('tfoot', h('tr', h('th', 'Разом'), h('td.num', fmt(sm.total, 0)), h('td.num', h('b', `${fmt(sm.percent, 1)} % — ${sm.ects}`))))),
      h('p', verdictText(sm.percent), ` Еквівалент у шкалі РПНД: ${fmt(sm.points, 2)} з ${fmt(sm.maxPoints, 2)} б.`),
      h('p.small', `Використано підказок: ${a.steps.reduce((x, s) => x + (s.hints || 0), 0)}; показано розв’язків: ${a.steps.filter((s) => s.revealed).length}. Спроб цієї роботи: ${getWork(mod.n).attempts.length}.`),
      h('p.small', `Дата і час: ${new Date(a.date).toLocaleString('uk-UA')}. Код перевірки цілісності: `, h('code', a.code)),
      h('div.signs', h('div', 'Виконав(ла): ____________ ', a.profile.name), h('div', `Перевірив: ____________ ${COURSE.teacher.split(',')[0]}`)))));
}

// ───────────── допоміжне для модулів ─────────────

export const SUB = ['₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉'];
export const sub = (i) => SUB[i] ?? String(i + 1);
export const short = (s) => String(s).split(' — ')[0];
export { fmt, fmtFixed };

/** Слайдер для дослідницьких режимів. */
export function slider(label, value, onInput, { min = 0, max = 1, step = 0.01, digits = 2 } = {}) {
  const out = h('output', fmtFixed(value, digits));
  return h('label.slider', h('span.sl-label', raw(label)), h('input', { type: 'range', min, max, step, value, oninput: (e) => { const x = Number(e.target.value); out.textContent = fmtFixed(x, digits); onInput(x); } }), out);
}

/** Загальні формули-вибори для кроку «Вибір формул». */
export function formulaStep(questions, hint) {
  return { id: 'formula', title: 'Вибір розрахункових формул', category: 'formulas', weight: 10, kind: 'choice', task: 'Оберіть формули, за якими виконується розрахунок.', questions, hint };
}

export function questionsStep(questions) {
  return { id: 'questions', title: 'Контрольні запитання', category: 'questions', weight: 20, kind: 'choice', task: 'Дайте відповіді на контрольні запитання (з методичних вказівок).', questions, hint: null };
}
