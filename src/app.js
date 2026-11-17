// Головний модуль: маршрутизація (hash-router — сумісний з GitHub Pages), головна сторінка,
// довідник формул, методичні рекомендації.
import { h, raw, clear, modal, toast } from './components/dom.js';
import { F } from './components/math.js';
import { COURSE, WORKS, MODES } from './data/course.js';
import { getProfile, setProfile, getWork, resetAll } from './data/store.js';
import { renderPR1 } from './modules/pr1-bayes/view.js';
import { renderReport } from './reports/report.js';
import { MODULES } from './modules/registry.js';
import { renderWork, renderModuleReport } from './components/trainer.js';
import { POLICY } from './calculations/grading.js';

const app = document.getElementById('app');

function header() {
  return h('header.site-head',
    h('a.brand', { href: '#home' }, h('span.brand-mark', 'ДТСВ'), h('span.brand-text', h('b', 'Інтерактивна лабораторія'), h('small', 'діагностики технологічних систем'))),
    h('nav.site-nav', h('a', { href: '#home' }, 'Роботи'), h('a', { href: '#formulas' }, 'Довідник формул'), h('a', { href: '#guide' }, 'Методичні рекомендації')));
}

function footer() {
  return h('footer.site-foot', h('div', `${COURSE.university} · ${COURSE.department}`),
    h('div', 'Навчальна система, версія 0.2 (готово: ПР № 1–4). Результати зберігаються лише у вашому браузері.'));
}

function profileEditor(onSave) {
  const p = getProfile() || {};
  const name = h('input', { type: 'text', value: p.name || '', placeholder: 'Прізвище Ім’я По батькові' });
  const group = h('input', { type: 'text', value: p.group || '', placeholder: 'Академічна група' });
  modal('Профіль студента', h('div.form', h('label', 'ПІБ', name), h('label', 'Група', group),
    h('p.muted.small', 'Від ПІБ і групи залежать індивідуальні варіанти. Після зміни профілю варіанти будуть іншими.')), [
    { label: 'Скасувати' },
    { label: 'Зберегти', primary: true, onClick: () => {
      if (name.value.trim().split(/\s+/).length < 2 || !group.value.trim()) { toast('Вкажіть прізвище, ім’я та групу.', 'error'); return false; }
      setProfile({ name: name.value.trim(), group: group.value.trim() }); onSave(); return true;
    } },
  ]);
}

function home() {
  const p = getProfile();
  const rows = WORKS.map((w) => ({ w, s: getWork(w.n) }));
  const done = rows.filter((x) => x.s.status === 'done').length;
  const avail = WORKS.filter((w) => w.ready).length;
  const scored = rows.filter((x) => x.s.bestPercent !== null);
  const avg = scored.length ? scored.reduce((a, x) => a + x.s.bestPercent, 0) / scored.length : null;

  const cards = rows.map(({ w, s }) => {
    const chip = !w.ready ? h('span.chip.plan', 'етап 5 — у розробці')
      : s.status === 'done' ? h('span.chip.done', 'зараховано') : s.status === 'progress' ? h('span.chip.prog', 'розпочато') : h('span.chip.new', 'не розпочато');
    const bar = h('div.mini-bar', h('span', { style: { width: `${s.bestPercent ?? 0}%` } }));
    const inner = [
      h('div.card-top', h('span.card-no', `ПР ${w.n}`), chip),
      h('h3', w.title),
      h('div.card-meta', w.topic, w.ready ? ` · ${MODES.length} режимів` : ''),
      w.ready ? h('div.card-progress', bar, h('span', s.bestPercent !== null ? `найкраще ${String(s.bestPercent).replace('.', ',')} %` : '—')) : null,
    ];
    return w.ready ? h('a.work-card.ready', { href: `#pr${w.n}-learn` }, ...inner) : h('div.work-card.planned', { 'aria-disabled': 'true' }, ...inner);
  });

  clear(app).append(header(), h('main.home',
    h('section.hero',
      h('div.hero-text',
        h('div.kicker', `${COURSE.university} · ${COURSE.department}`),
        h('h1', 'Інтерактивна лабораторія діагностики технологічних систем'),
        h('p.lead', `Тренажери практичних робіт з дисципліни «${COURSE.title}».`),
        h('p', 'Система веде від теорії до рішення: постановка діагностичної задачі → вихідні дані → розрахунок → аналіз → рішення → оцінювання → звіт. Кожна робота має п’ять режимів: навчання, покроковий тренажер, самостійне виконання, дослідження й контроль.'),
        h('dl.course-facts',
          h('dt', 'Викладач'), h('dd', COURSE.teacher),
          h('dt', 'Спеціальність'), h('dd', COURSE.specialty),
          h('dt', 'Освітня програма'), h('dd', COURSE.program),
          h('dt', 'Обсяг'), h('dd', COURSE.semester))),
      h('aside.student-card',
        h('div.sc-title', 'Мій навчальний прогрес'),
        p ? [h('div.sc-name', p.name), h('div.muted', p.group)] : h('p.muted', 'Профіль не заповнено — варіанти завдань індивідуалізуються за ПІБ і групою.'),
        h('button.btn.btn-ghost.small', { onclick: () => profileEditor(home) }, p ? 'Змінити профіль' : 'Заповнити профіль'),
        h('div.sc-stats',
          h('div', h('b', `${done}/9`), h('span', 'зараховано')),
          h('div', h('b', avg !== null ? `${Math.round(avg)} %` : '—'), h('span', 'середній бал')),
          h('div', h('b', `${avail}/9`), h('span', 'доступно'))),
        h('div.progress-9', rows.map(({ w, s }) => h(`span.p9.${s.status}${w.ready ? '' : '.na'}`, { title: `ПР ${w.n}: ${s.bestPercent ?? '—'} %` }, String(w.n)))),
        h('button.link.small', { onclick: () => modal('Скинути результати?', h('p', 'Буде видалено всі збережені спроби в цьому браузері. Профіль залишиться.'), [{ label: 'Скасувати' }, { label: 'Скинути', primary: true, onClick: () => { resetAll(); home(); } }]) }, 'Скинути результати'))),
    h('section.works', h('h2', 'Практичні роботи'), h('div.works-grid', cards)),
    h('section.quick',
      h('a.quick-card', { href: '#formulas' }, h('b', 'Довідник формул'), h('span', 'Позначення і формули методичних вказівок')),
      h('a.quick-card', { href: '#guide' }, h('b', 'Методичні рекомендації'), h('span', 'Як працювати з тренажерами, як оцінюється робота')),
      h('a.quick-card', { href: 'docs/specyfikatsiia.html', target: '_blank', rel: 'noopener' }, h('b', 'Для викладача'), h('span', 'Математична специфікація і перелік суперечностей у матеріалах'))),
  ), footer());
}

function formulas() {
  const others = [
    ['ПР 2. Мінімальний ризик', 'R(Dᵢ/K*) = Σⱼ λᵢⱼ P(Dⱼ/K*)  (21);   K* ∈ Dᵢ, якщо R(Dᵢ/K*) = min R(Dₖ/K*)  (22)'],
    ['ПР 3. Максимальна правдоподібність', 'K* ∈ Dᵢ, якщо P(K*/Dᵢ) = max P(K*/Dₖ)  (24);   P(K*/Dᵢ) = P(k₁*/Dᵢ)·…·P(kₘ*/Dᵢ)  (25)'],
    ['ПР 4. Мінімальна кількість помилкових рішень', 'K* ∈ Dᵢ, якщо P(Dᵢ/K*) = max P(Dₖ/K*)  (26)'],
    ['ПР 5. Логічні методи', 'умови виду Xᵢ > a, Xᵢ ≤ a, Xᵢ ∈ [a; b]; правило: якщо умова₁ ∧ умова₂, то Y = 1'],
    ['ПР 6. Нейман–Пірсон', 'A = k·P₂;   ∫ₓ₀^∞ f(x/D₁)dx = A;   β = ∫₋∞^ₓ₀ f(x/D₂)dx;   f(x) = exp(−(x−μ)²/2σ²)/(σ√(2π))'],
    ['ПР 7. Інформаційні методи', 'zᵢ = (xᵢ − x̄)/s;   x̄ = Σxᵢ/n;   s² = Σ(xᵢ − x̄)²/(n − 1);   межі x̄ ± 3s;   r = Σ(x−x̄)(y−ȳ)/((n−1)sₓs_y);   H = −Σ pᵢ log₂ pᵢ'],
    ['ПР 8. Ефективність методів', 'Accuracy = (TP+TN)/(TP+TN+FP+FN);  Recall = TP/(TP+FN);  Precision = TP/(TP+FP);  Specificity = TN/(TN+FP);  F1 = 2PR/(P+R)'],
    ['ПР 9. Надійність', 'T̂ = Σtᵢ/n;   λ = 1/T̂;   P(t) = e^(−λt);   f(t) = λe^(−λt);   послідовне з’єднання P = ΠPᵢ;   резервування P = 1 − Π(1 − Pᵢ)'],
  ];
  clear(app).append(header(), h('main.page',
    h('h1', 'Довідник формул'),
    h('p.muted', 'Номери формул відповідають методичним вказівкам до практичних робіт ДТСВ.'),
    h('h2', 'ПР 1. Метод Байєса'),
    h('div.formula-list', ['bayesSimple', 'prior', 'featureGivenD', 'featureMarg', 'bayesComplex', 'normPrior', 'indep', 'evidence', 'bayesGeneral', 'normPost', 'jointK', 'posterior', 'notK', 'updPrior', 'updFeature', 'updFeatureFixed', 'rule', 'threshold', 'refuse'].map((k) => raw(F[k]))),
    h('p.small.muted', 'Формула (17′) — узгоджена форма (17) з нормуванням, прийнята в системі (специфікація, суперечність П2).'),
    h('h2', 'Інші практичні роботи'),
    h('dl.formula-text', others.flatMap(([t, f]) => [h('dt', t), h('dd', f)])),
  ), footer());
}

function guide() {
  clear(app).append(header(), h('main.page.prose',
    h('h1', 'Методичні рекомендації до роботи з лабораторією'),
    h('h2', 'Рекомендована послідовність'),
    h('ol',
      h('li', h('b', 'Навчання.'), ' Прочитайте теорію і пройдіть розібраний приклад з методичних вказівок крок за кроком. Дайте відповіді на запитання самоперевірки.'),
      h('li', h('b', 'Покроковий тренажер.'), ' Отримайте індивідуальний варіант і виконайте розрахунок. Кожен крок перевіряється одразу; система пояснює типові помилки.'),
      h('li', h('b', 'Дослідження.'), ' Змінюйте вихідні дані й простежте, як вони впливають на діагноз. Це готує до відповідей на контрольні запитання.'),
      h('li', h('b', 'Самостійне виконання.'), ' Новий варіант без підказок, перевірка в кінці.'),
      h('li', h('b', 'Контроль.'), ' Контрольний варіант, одна спроба, випадкові контрольні запитання. За результатом формується звіт для викладача.')),
    h('h2', 'Як оцінюється робота'),
    h('table.data', h('thead', h('tr', h('th', 'Критерій'), h('th', 'Вага'))), h('tbody',
      [['Правильність вихідних даних (робоча таблиця)', 15], ['Вибір формул', 10], ['Точність розрахунків', 35], ['Інтерпретація результатів', 10], ['Обґрунтованість технічного рішення', 10], ['Контрольні запитання', 20]]
        .map(([a, b]) => h('tr', h('td', a), h('td.num', `${b} %`))))),
    h('ul',
      h('li', `У покроковому режимі кожна підказка знімає ${POLICY.hintPenalty * 100} % ваги кроку; крок, виконаний з другої спроби, оцінюється в 50 %, з третьої і далі — у 25 %; показаний системою розв’язок — 0.`),
      h('li', 'У самостійному режимі і контролі правильна дія, виконана на ваших власних хибних даних попереднього кроку, зараховується на 75 % — оцінюється послідовність виконання, а не лише кінцева відповідь.'),
      h('li', 'Числа можна вводити з комою або крапкою. Приймається округлення до трьох знаків після коми (допуск 0,0015 або 1 %).'),
      h('li', 'Рівень засвоєння визначається за шкалою робочої програми: 90–100 % — A, 82–89 — B, 75–81 — C, 64–74 — D, 60–63 — E, менше 60 — FX/F.')),
    h('h2', 'Звіт'),
    h('p', 'Після завершення роботи натисніть «Сформувати звіт», а потім «Друк / Зберегти у PDF». Звіт містить вихідні дані, формули, послідовність ваших розрахунків з позначкою правильності, таблиці, графік, аналіз, висновки й результат оцінювання. Код перевірки цілісності дозволяє викладачу виявити зміни, внесені у звіт вручну.'),
    h('h2', 'Академічна доброчесність'),
    h('p', 'Варіант формується за вашими ПІБ і групою, тому готові відповіді іншого студента не підходять до вашого варіанта. Контрольний варіант відрізняється від тренувальних.'),
    h('h2', 'Збереження результатів'),
    h('p', 'Результати зберігаються в пам’яті вашого браузера (localStorage) і нікуди не передаються. У режимі «інкогніто» вони зникнуть після закриття вікна. Для здачі роботи використовуйте PDF-звіт.'),
  ), footer());
}

function planned(n) {
  const w = WORKS.find((x) => x.n === n);
  clear(app).append(header(), h('main.page', h('a.back', { href: '#home' }, '← Усі роботи'), h('h1', `ПР № ${n}`), h('p', w?.title ?? ''),
    h('p', 'Тренажер цієї роботи реалізується на етапі 5 (наступна партія: ПР № 5–9).')), footer());
}

function route() {
  // Маршрути — прості якорі (#pr1-step, #report-1, #formulas): сумісні з GitHub Pages і вбудованим переглядом.
  const hash = (location.hash || '#home').slice(1);
  window.scrollTo(0, 0);
  let m = hash.match(/^pr(\d)(?:-(\w+))?$/);
  if (m) {
    const n = Number(m[1]);
    if (n === 1) {
      const mode = MODES.some((x) => x.id === m[2]) ? m[2] : 'learn';
      clear(app).append(header());
      const root = h('main.work');
      app.append(root, footer());
      const rerender = () => { renderPR1(root, mode, rerender); };
      rerender();
      return;
    }
    if (MODULES[n]) {
      const mode = MODES.some((x) => x.id === m[2]) ? m[2] : 'learn';
      clear(app).append(header());
      const root = h('main.work');
      app.append(root, footer());
      const rerender = () => { renderWork(root, mode, rerender, MODULES[n]); };
      rerender();
      return;
    }
    planned(n); return;
  }
  m = hash.match(/^report-(\d)$/);
  if (m) { clear(app).append(header()); const root = h('main.page.report-page'); app.append(root); const rn = Number(m[1]); if (MODULES[rn]) renderModuleReport(root, MODULES[rn]); else renderReport(root, rn); return; }
  if (hash === 'formulas') return formulas();
  if (hash === 'guide') return guide();
  if (/^s\d+$|^top$/.test(hash)) return;
  return home();
}

window.addEventListener('hashchange', route);
route();
