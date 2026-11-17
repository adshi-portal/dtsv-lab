// Звіт про виконання практичної роботи (13 розділів за ТЗ, п. 9).
// PDF — через «Друк → Зберегти як PDF» браузера: коректна кирилиця і векторні формули/графіки.
import { h, raw, clear } from '../components/dom.js';
import { F, sym } from '../components/math.js';
import { COURSE, MODES } from '../data/course.js';
import { lastAttempt, getWork } from '../data/store.js';
import { computeBayes } from '../calculations/bayes.js';
import { fmt, fmtFixed, parseNumber } from '../calculations/numeric.js';
import { summarize, verdictText } from '../calculations/grading.js';
import { barChart } from '../visualization/charts.js';
import { META, QUESTIONS } from '../modules/pr1-bayes/content.js';
import { buildSteps, checkStep, sub } from '../modules/pr1-bayes/steps.js';
import { analysisText } from '../modules/pr1-bayes/view.js';

const short = (s) => s.split(' — ')[0];
const STATUS = { ok: '✓', carried: '≈', wrong: '✗', empty: '—' };

function rsec(no, title, ...body) { return h('section.r-sec', h('h2', `${no}. ${title}`), ...body); }

export function renderReport(root, n) {
  clear(root);
  const a = n === 1 ? lastAttempt(1) : null;
  if (!a) {
    root.append(h('div.page', h('a.back', { href: '#home' }, '← На головну'), h('h1', 'Звіт недоступний'),
      h('p', 'Звіт формується після завершення практичної роботи в режимі «Покроковий тренажер», «Самостійне виконання» або «Контроль».'),
      h('a.btn.btn-primary', { href: '#pr1-step' }, 'Перейти до ПР № 1')));
    return;
  }
  const v = a.variant;
  const r = computeBayes(v);
  const questions = QUESTIONS.filter((q) => a.questions.includes(q.id));
  const { steps } = buildSteps(v, questions);
  const sm = summarize(a.steps, 1);
  const modeTitle = MODES.find((m) => m.id === a.mode)?.title ?? a.mode;
  const date = new Date(a.date);
  const follow = a.mode !== 'step';

  const calcRows = [];
  for (const s of steps.filter((x) => x.kind === 'numbers')) {
    const res = checkStep(v, r, s, a.answers, { followThrough: follow });
    s.fields.forEach((f) => {
      const label = f.key.startsWith('t') ? sym.realized(f.i + 1, f.j + 1, v.observed[f.j])
        : f.key === 'e' ? sym.evidence() : { l: sym.like, j: sym.joint, p: sym.post }[f.key[0]](f.i + 1);
      const st = res.status[f.key];
      calcRows.push(h(`tr.st-${st}`, h('td', s.title), h('td', raw(label)), h('td.num', Number.isFinite(parseNumber(a.answers[f.key])) ? String(a.answers[f.key]).replace('.', ',') : '—'),
        h('td.num', fmtFixed(f.ref, 4)), h('td.center', STATUS[st])));
    });
  }
  const choiceRows = steps.filter((x) => x.kind === 'choice').flatMap((s) => s.questions.map((q) => {
    const ans = a.answers[`${s.id}:${q.id}`];
    const ok = Number(ans) === q.correct;
    return h(`tr.st-${ok ? 'ok' : 'wrong'}`, h('td', q.prompt), h('td', ans !== undefined ? q.options[Number(ans)] : '—'), h('td.center', ok ? '✓' : '✗'));
  }));

  const conclusion = a.conclusion?.trim();
  const doc = h('article.report',
    h('header.r-head',
      h('div', COURSE.university), h('div', COURSE.faculty), h('div', COURSE.department),
      h('div.r-title', 'ЗВІТ'), h('div', `про виконання практичної роботи № 1 з дисципліни «${COURSE.title}»`)),
    rsec(1, 'Назва практичної роботи', h('p', META.title)),
    rsec(2, 'Студент', h('table.r-kv', h('tr', h('th', 'ПІБ'), h('td', a.profile.name)), h('tr', h('th', 'Група'), h('td', a.profile.group)))),
    rsec(3, 'Варіант', h('table.r-kv',
      h('tr', h('th', 'Номер'), h('td', `№ ${v.number}`)), h('tr', h('th', 'Ідентифікатор'), h('td', h('code', v.id))),
      h('tr', h('th', 'Режим'), h('td', modeTitle)), h('tr', h('th', 'Дані'), h('td', v.modelled ? 'модельні (згенеровані системою за ідентифікатором)' : 'приклад методичних вказівок')))),
    rsec(4, 'Мета роботи', h('p', META.goal)),
    rsec(5, 'Теоретичні відомості', h('p', 'Метод Байєса дозволяє за апріорними ймовірностями технічних станів P(Dᵢ) та діагностичною матрицею ймовірностей ознак P(kⱼ/Dᵢ) обчислити апостеріорні ймовірності станів P(Dᵢ/K*) після обстеження за комплексом ознак K*. Для діагностично незалежних ознак ймовірність комплексу дорівнює добутку ймовірностей фактичних реалізацій ознак; для відсутньої ознаки використовується 1 − P(kⱼ/Dᵢ). Об’єкт відносять до стану з найбільшою апостеріорною ймовірністю, якщо вона не менша за поріг розпізнавання Pₗ; інакше рішення не приймається і потрібна додаткова інформація.')),
    rsec(6, 'Вихідні дані',
      h('p', `Об’єкт: ${v.object}.`),
      h('ul.r-list', v.states.map((s) => h('li', s)), v.features.map((f) => h('li', f))),
      h('table.r-table', h('thead', h('tr', h('th', 'Стан'), ...v.features.map((f) => h('th', `P(${short(f)}/Dᵢ)`)), h('th', 'P(Dᵢ)'))),
        h('tbody', v.states.map((s, i) => h('tr', h('th', short(s)), ...v.featureProbs[i].map((p) => h('td.num', fmt(p, 2))), h('td.num', fmt(v.priors[i], 2)))))),
      h('p', `Результат обстеження K*: ${v.observed.map((o, j) => (o ? `k${sub(j)} виявлено` : `k${sub(j)} відсутня`)).join('; ')}. Поріг розпізнавання Pₗ = ${fmt(v.threshold, 2)}.`)),
    rsec(7, 'Формули', h('div.r-formulas', raw(F.realized), raw(F.product), raw(F.jointK), raw(F.evidence), raw(F.posterior), raw(F.normPost), raw(F.rule), raw(F.threshold))),
    rsec(8, 'Послідовність розрахунків',
      h('p.small', 'Позначки: ✓ — правильно; ≈ — правильна дія на власних хибних попередніх даних; ✗ — помилка; — — не заповнено.'),
      h('table.r-table', h('thead', h('tr', h('th', 'Крок'), h('th', 'Величина'), h('th', 'Значення студента'), h('th', 'Еталон'), h('th', ''))), h('tbody', calcRows)),
      h('table.r-table', h('thead', h('tr', h('th', 'Вибір формул, інтерпретація, рішення, контрольні запитання'), h('th', 'Відповідь студента'), h('th', ''))), h('tbody', choiceRows))),
    rsec(9, 'Таблиця результатів', h('table.r-table',
      h('thead', h('tr', h('th', 'Стан'), h('th', 'P(Dᵢ)'), h('th', 'P(K*/Dᵢ)'), h('th', 'P(DᵢK*)'), h('th', 'P(Dᵢ/K*)'))),
      h('tbody', v.states.map((s, i) => h(`tr${i === r.best ? '.best-row' : ''}`, h('th', short(s)), h('td.num', fmt(v.priors[i], 2)), h('td.num', fmtFixed(r.likelihoods[i], 4)), h('td.num', fmtFixed(r.joints[i], 4)), h('td.num', fmtFixed(r.posteriors[i], 4))))),
      h('tfoot', h('tr', h('th', 'Σ'), h('td.num', '1'), h('td'), h('td.num', `P(K*) = ${fmtFixed(r.evidence, 4)}`), h('td.num', fmtFixed(r.posteriorSum, 4)))))),
    rsec(10, 'Графіки', h('div.r-chart', barChart({ title: 'Ймовірності станів до та після обстеження', categories: v.states.map(short),
      series: [{ name: 'апріорна P(Dᵢ)', values: v.priors, className: 'prior' }, { name: 'апостеріорна P(Dᵢ/K*)', values: r.posteriors, className: 'post' }], threshold: v.threshold }))),
    rsec(11, 'Аналіз результатів', h('ul', analysisText(v, r).map((t) => h('li', t)))),
    rsec(12, 'Висновки', conclusion ? h('p', conclusion) : h('p', h('i', 'Висновок студента не сформульовано. Автоматичний висновок: '), analysisText(v, r).slice(-1)[0])),
    rsec(13, 'Результат автоматичного оцінювання',
      h('table.r-table', h('thead', h('tr', h('th', 'Критерій'), h('th', 'Вага, %'), h('th', 'Набрано'))),
        h('tbody', Object.values(sm.byCat).map((c) => h('tr', h('td', c.title), h('td.num', fmt(c.weight, 0)), h('td.num', fmt(c.earned, 1))))),
        h('tfoot', h('tr', h('th', 'Разом'), h('td.num', '100'), h('td.num', h('b', `${fmt(sm.percent, 1)} % — ${sm.ects}`))))),
      h('p', verdictText(sm.percent), ` Еквівалент у шкалі РПНД: ${fmt(sm.points, 2)} з ${fmt(sm.maxPoints, 2)} б.`),
      h('p.small', `Використано підказок: ${a.steps.reduce((x, s) => x + (s.hints || 0), 0)}; показано розв’язків: ${a.steps.filter((s) => s.revealed).length}. Спроб цієї роботи: ${getWork(1).attempts.length}.`),
      h('p.small', `Дата і час: ${date.toLocaleString('uk-UA')}. Код перевірки цілісності: `, h('code', a.code)),
      h('div.signs', h('div', 'Виконав(ла): ____________ ', a.profile.name), h('div', `Перевірив: ____________ ${COURSE.teacher.split(',')[0]}`))),
  );

  root.append(h('div.report-toolbar.no-print',
    h('a.btn.btn-ghost', { href: '#pr1-' + a.mode }, '← Повернутися до роботи'),
    h('button.btn.btn-primary', { onclick: () => window.print() }, 'Друк / Зберегти у PDF'),
    h('span.muted.small', 'У вікні друку оберіть «Зберегти як PDF». Якщо вікно не відкрилось (вбудований перегляд claude.ai блокує друк), відкрийте систему з GitHub Pages або локального сервера.')), doc);
}
