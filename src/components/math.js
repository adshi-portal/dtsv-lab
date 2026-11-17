// Формули у MathML (нативно в сучасних браузерах, без зовнішніх бібліотек).
// Номери в дужках — номери формул методичних вказівок до ПР1.

const mi = (s) => `<mi>${s}</mi>`;
const mo = (s) => `<mo>${s}</mo>`;
const mn = (s) => `<mn>${s}</mn>`;
const sub = (b, i) => `<msub>${mi(b)}${typeof i === 'number' ? mn(i) : mi(i)}</msub>`;
const Ks = `<msup>${mi('K')}${mo('*')}</msup>`;
const ksj = `<msubsup>${mi('k')}${mi('j')}${mo('*')}</msubsup>`;
const ps = (c) => `<mo stretchy="false">${c}</mo>`;
const P = (...inner) => `${mi('P')}${ps('(')}${inner.join('')}${ps(')')}`;
const cond = (a, b) => P(a, ps('/'), b);
const frac = (a, b) => `<mfrac><mrow>${a}</mrow><mrow>${b}</mrow></mfrac>`;
const sumN = (idx, body, from = '1', to = 'n') => `<munderover>${mo('∑')}<mrow>${mi(idx)}${mo('=')}${mn(from)}</mrow>${mi(to)}</munderover>${body}`;
const prod = (idx, body) => `<munder>${mo('∏')}${mi(idx)}</munder>${body}`;

export function block(body, label) {
  return `<div class="formula"><math display="block"><mrow>${body}</mrow></math>${label ? `<span class="formula-no">(${label})</span>` : ''}</div>`;
}
export function inline(body) { return `<math><mrow>${body}</mrow></math>`; }

export const F = {
  joint: block(`${P(sub('D', 'i'), sub('k', 'j'))}${mo('=')}${P(sub('D', 'i'))}${cond(sub('k', 'j'), sub('D', 'i'))}${mo('=')}${P(sub('k', 'j'))}${cond(sub('D', 'i'), sub('k', 'j'))}`, 1),
  bayesSimple: block(`${cond(sub('D', 'i'), sub('k', 'j'))}${mo('=')}${frac(cond(sub('k', 'j'), sub('D', 'i')) + P(sub('D', 'i')), P(sub('k', 'j')))}`, 2),
  prior: block(`${P(sub('D', 'i'))}${mo('=')}${frac(sub('N', 'i'), mi('N'))}`, 3),
  featureGivenD: block(`${cond(sub('k', 'j'), sub('D', 'i'))}${mo('=')}${frac(`<msub>${mi('N')}<mrow>${mi('i')}${mi('j')}</mrow></msub>`, sub('N', 'i'))}`, 4),
  featureMarg: block(`${P(sub('k', 'j'))}${mo('=')}${frac(sub('N', 'j'), mi('N'))}`, 5),
  bayesComplex: block(`${cond(sub('D', 'i'), Ks)}${mo('=')}${frac(P(sub('D', 'i')) + cond(Ks, sub('D', 'i')), P(Ks))}`, 7),
  normPrior: block(`${sumN('i', P(sub('D', 'i')))}${mo('=')}${mn(1)}`, 8),
  indep: block(`${cond(Ks, sub('D', 'i'))}${mo('=')}${cond(`<msubsup>${mi('k')}${mn(1)}${mo('*')}</msubsup>`, sub('D', 'i'))}${cond(`<msubsup>${mi('k')}${mn(2)}${mo('*')}</msubsup>`, sub('D', 'i'))}${mo('…')}${cond(`<msubsup>${mi('k')}${mi('m')}${mo('*')}</msubsup>`, sub('D', 'i'))}`, 10),
  evidence: block(`${P(Ks)}${mo('=')}${sumN('s', P(sub('D', 's')) + cond(Ks, sub('D', 's')))}`, 11),
  bayesGeneral: block(`${cond(sub('D', 'i'), Ks)}${mo('=')}${frac(P(sub('D', 'i')) + cond(Ks, sub('D', 'i')), sumN('s', P(sub('D', 's')) + cond(Ks, sub('D', 's'))))}`, 12),
  normPost: block(`${sumN('i', cond(sub('D', 'i'), Ks))}${mo('=')}${mn(1)}`, 13),
  jointK: block(`${P(sub('D', 'i'), Ks)}${mo('=')}${P(sub('D', 'i'))}${cond(Ks, sub('D', 'i'))}`, 14),
  posterior: block(`${cond(sub('D', 'i'), Ks)}${mo('=')}${frac(P(sub('D', 'i'), Ks), sumN('s', P(sub('D', 's'), Ks)))}`, 15),
  notK: block(`${cond(`${mo('¬')}${sub('k', 'j')}`, sub('D', 'i'))}${mo('=')}${mn(1)}${mo('−')}${cond(sub('k', 'j'), sub('D', 'i'))}`),
  realized: block(`${cond(ksj, sub('D', 'i'))}${mo('=')}<mrow>${mo('{')}<mtable columnalign="left"><mtr><mtd>${cond(sub('k', 'j'), sub('D', 'i'))}${mo(',')}<mtext>&nbsp;якщо ознаку виявлено</mtext></mtd></mtr><mtr><mtd>${mn(1)}${mo('−')}${cond(sub('k', 'j'), sub('D', 'i'))}${mo(',')}<mtext>&nbsp;якщо ознаки немає</mtext></mtd></mtr></mtable></mrow>`),
  product: block(`${cond(Ks, sub('D', 'i'))}${mo('=')}${prod('j', cond(ksj, sub('D', 'i')))}`, 10),
  updPrior: block(`${P(sub('D', 'i'))}${mo('=')}${frac(sub('N', 'i'), `${mi('N')}${mo('+')}${mn(1)}`)}${mo(',')}<mspace width="1em"/>${mo('(')}${mi('i')}${mo('≠')}${mi('μ')}${mo(')')}${mo(';')}<mspace width="1em"/>${P(sub('D', 'μ'))}${mo('=')}${frac(`${sub('N', 'μ')}${mo('+')}${mn(1)}`, `${mi('N')}${mo('+')}${mn(1)}`)}`, 16),
  updFeature: block(`${cond(`<msub>${mi('k')}<mrow>${mi('j')}${mi('s')}</mrow></msub>`, sub('D', 'μ'))}${mo('=')}${frac(`<msub>${mi('N')}<mrow>${mi('j')}${mi('s')}</mrow></msub>${mo('+')}<msub>${mi('δ')}<mrow>${mi('s')}${mi('r')}</mrow></msub>`, `${sub('N', 'μ')}${mo('+')}${sub('m', 'j')}`)}`, 17),
  updFeatureFixed: block(`${cond(`<msub>${mi('k')}<mrow>${mi('j')}${mi('s')}</mrow></msub>`, sub('D', 'μ'))}${mo('=')}${frac(`<msub>${mi('N')}<mrow>${mi('j')}${mi('s')}</mrow></msub>${mo('+')}<msub>${mi('δ')}<mrow>${mi('s')}${mi('r')}</mrow></msub>`, `${sub('N', 'μ')}${mo('+')}${mn(1)}`)}`, '17′'),
  rule: block(`${Ks}${mo('∈')}${sub('D', 'i')}${mo(',')}<mspace width="0.6em"/><mtext>якщо</mtext><mspace width="0.6em"/>${cond(sub('D', 'i'), Ks)}${mo('&gt;')}${cond(sub('D', 'j'), Ks)}${mo(',')}<mspace width="0.6em"/>${mo('(')}${mi('j')}${mo('≠')}${mi('i')}${mo(')')}`, 18),
  threshold: block(`${cond(sub('D', 'i'), Ks)}${mo('≥')}${sub('P', 'i')}`, 19),
  refuse: block(`${cond(sub('D', 'i'), Ks)}${mo('&lt;')}${sub('P', 'i')}<mspace width="0.6em"/>${mo('⇒')}<mspace width="0.6em"/><mtext>відмова від розпізнавання</mtext>`, 20),
};

/** Позначення для таблиць і полів введення (inline MathML). */
export const sym = {
  prior: (i) => inline(P(sub('D', i))),
  feat: (i, j) => inline(cond(sub('k', j), sub('D', i))),
  realized: (i, j, present) => inline(cond(present ? sub('k', j) : `${mo('¬')}${sub('k', j)}`, sub('D', i))),
  like: (i) => inline(cond(Ks, sub('D', i))),
  joint: (i) => inline(P(sub('D', i), Ks)),
  evidence: () => inline(P(Ks)),
  post: (i) => inline(cond(sub('D', i), Ks)),
  D: (i) => inline(sub('D', i)),
  k: (j, present = true) => inline(present ? sub('k', j) : `${mo('¬')}${sub('k', j)}`),
  Pl: () => inline(sub('P', 'l')),
  Ks: () => inline(Ks),
};
