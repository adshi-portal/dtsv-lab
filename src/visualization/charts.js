// SVG-графіки без зовнішніх бібліотек: адаптивні (viewBox), друкуються векторно,
// підказки при наведенні; кольори — з CSS-змінних, що забезпечує єдиний стиль.

const NS = 'http://www.w3.org/2000/svg';
const s = (tag, attrs = {}, ...kids) => {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) el.setAttribute(k, v);
  kids.flat().forEach((k) => k !== null && k !== undefined && el.append(k instanceof Node ? k : document.createTextNode(String(k))));
  return el;
};
const dec = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d).replace('.', ',') : '—');

/**
 * Згрупована стовпчикова діаграма.
 * @param {{categories:string[], series:{name:string, values:number[], className:string}[], yMax?:number, title?:string, threshold?:number}} cfg
 */
export function barChart({ categories, series, yMax = 1, title, threshold, digits = 3 }) {
  const W = 640, H = 300, L = 48, R = 12, T = title ? 34 : 14, B = 54;
  const pw = W - L - R, ph = H - T - B;
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img', 'aria-label': title || 'Діаграма' });
  if (title) svg.append(s('text', { x: L, y: 20, class: 'chart-title' }, title));
  for (let k = 0; k <= 5; k++) {
    const y = T + ph - (k / 5) * ph;
    svg.append(s('line', { x1: L, x2: W - R, y1: y, y2: y, class: 'grid' }));
    svg.append(s('text', { x: L - 6, y: y + 4, class: 'tick', 'text-anchor': 'end' }, dec((k / 5) * yMax, 1)));
  }
  const gw = pw / categories.length;
  const bw = Math.min(46, (gw * 0.72) / series.length);
  categories.forEach((c, ci) => {
    const gx = L + ci * gw + (gw - bw * series.length) / 2;
    series.forEach((sr, si) => {
      const val = sr.values[ci];
      const hgt = Number.isFinite(val) ? (Math.max(0, Math.min(val, yMax)) / yMax) * ph : 0;
      const x = gx + si * bw;
      const bar = s('rect', { x: x + 1, y: T + ph - hgt, width: bw - 2, height: Math.max(hgt, 0.5), class: `bar ${sr.className}`, rx: 2 },
        s('title', {}, `${c}: ${sr.name} = ${dec(val, 4)}`));
      svg.append(bar);
      svg.append(s('text', { x: x + bw / 2, y: T + ph - hgt - 5, class: 'bar-label', 'text-anchor': 'middle' }, dec(val, digits)));
    });
    svg.append(s('text', { x: L + ci * gw + gw / 2, y: T + ph + 18, class: 'cat', 'text-anchor': 'middle' }, c));
  });
  if (Number.isFinite(threshold)) {
    const y = T + ph - (threshold / yMax) * ph;
    svg.append(s('line', { x1: L, x2: W - R, y1: y, y2: y, class: 'threshold' }));
    svg.append(s('text', { x: W - R - 4, y: y - 5, class: 'threshold-label', 'text-anchor': 'end' }, `поріг Pₗ = ${dec(threshold, 2)}`));
  }
  svg.append(s('line', { x1: L, x2: W - R, y1: T + ph, y2: T + ph, class: 'axis' }));
  const lg = s('g', { transform: `translate(${L}, ${H - 14})` });
  let lx = 0;
  series.forEach((sr) => {
    lg.append(s('rect', { x: lx, y: -9, width: 12, height: 12, class: `bar ${sr.className}`, rx: 2 }));
    lg.append(s('text', { x: lx + 17, y: 1, class: 'legend' }, sr.name));
    lx += 30 + sr.name.length * 7;
  });
  svg.append(lg);
  return svg;
}

/**
 * Лінійний графік із перехрестям при наведенні.
 * @param {{xs:number[], series:{name:string, values:number[], className:string}[], marker?:number, xLabel:string, yLabel:string, title?:string}} cfg
 */
export function lineChart({ xs, series, marker, xLabel, yLabel, title, yMax = 1 }) {
  const W = 640, H = 320, L = 52, R = 16, T = title ? 34 : 14, B = 66;
  const pw = W - L - R, ph = H - T - B;
  const x0 = xs[0], x1 = xs[xs.length - 1];
  const X = (x) => L + ((x - x0) / (x1 - x0 || 1)) * pw;
  const Y = (y) => T + ph - (Math.max(0, Math.min(y, yMax)) / yMax) * ph;
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart line-chart', role: 'img', 'aria-label': title || yLabel });
  if (title) svg.append(s('text', { x: L, y: 20, class: 'chart-title' }, title));
  for (let k = 0; k <= 5; k++) {
    const yv = (k / 5) * yMax;
    svg.append(s('line', { x1: L, x2: W - R, y1: Y(yv), y2: Y(yv), class: 'grid' }));
    svg.append(s('text', { x: L - 6, y: Y(yv) + 4, class: 'tick', 'text-anchor': 'end' }, dec(yv, 1)));
    const xv = x0 + (k / 5) * (x1 - x0);
    svg.append(s('text', { x: X(xv), y: T + ph + 16, class: 'tick', 'text-anchor': 'middle' }, dec(xv, 1)));
  }
  svg.append(s('line', { x1: L, x2: W - R, y1: T + ph, y2: T + ph, class: 'axis' }));
  svg.append(s('line', { x1: L, x2: L, y1: T, y2: T + ph, class: 'axis' }));
  svg.append(s('text', { x: L + pw / 2, y: T + ph + 34, class: 'axis-label', 'text-anchor': 'middle' }, xLabel));
  svg.append(s('text', { x: 14, y: T + ph / 2, class: 'axis-label', 'text-anchor': 'middle', transform: `rotate(-90 14 ${T + ph / 2})` }, yLabel));
  series.forEach((sr) => {
    let d = ''; let pen = false;
    sr.values.forEach((y, k) => {
      if (!Number.isFinite(y)) { pen = false; return; }
      d += `${pen ? 'L' : 'M'}${X(xs[k]).toFixed(1)},${Y(y).toFixed(1)}`; pen = true;
    });
    svg.append(s('path', { d, class: `line ${sr.className}` }));
  });
  if (Number.isFinite(marker)) {
    svg.append(s('line', { x1: X(marker), x2: X(marker), y1: T, y2: T + ph, class: 'marker' }));
    svg.append(s('text', { x: X(marker) + 4, y: T + 12, class: 'marker-label' }, `поточне ${dec(marker, 2)}`));
  }
  const lg = s('g', { transform: `translate(${L}, ${H - 12})` });
  let lx = 0;
  series.forEach((sr) => {
    lg.append(s('line', { x1: lx, x2: lx + 16, y1: -4, y2: -4, class: `line ${sr.className}` }));
    lg.append(s('text', { x: lx + 21, y: 0, class: 'legend' }, sr.name));
    lx += 34 + sr.name.length * 7;
  });
  svg.append(lg);
  // Перехрестя
  const hover = s('g', { class: 'hover', visibility: 'hidden' });
  const vline = s('line', { y1: T, y2: T + ph, class: 'hover-line' });
  const box = s('rect', { class: 'hover-box', rx: 4, width: 150, height: 18 + series.length * 16 });
  const texts = [s('text', { class: 'hover-text' }), ...series.map(() => s('text', { class: 'hover-text' }))];
  hover.append(vline, box, ...texts);
  svg.append(hover);
  const capture = s('rect', { x: L, y: T, width: pw, height: ph, fill: 'transparent' });
  const move = (evt) => {
    const pt = svg.createSVGPoint();
    const src = evt.touches ? evt.touches[0] : evt;
    pt.x = src.clientX; pt.y = src.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    const xv = x0 + ((p.x - L) / pw) * (x1 - x0);
    let k = 0; let best = Infinity;
    xs.forEach((x, idx) => { const d = Math.abs(x - xv); if (d < best) { best = d; k = idx; } });
    const xx = X(xs[k]);
    vline.setAttribute('x1', xx); vline.setAttribute('x2', xx);
    const bx = xx + 160 > W ? xx - 158 : xx + 8;
    box.setAttribute('x', bx); box.setAttribute('y', T + 4);
    texts[0].setAttribute('x', bx + 6); texts[0].setAttribute('y', T + 18); texts[0].textContent = `${xLabel.split(',')[0]} = ${dec(xs[k], 2)}`;
    series.forEach((sr, i) => {
      texts[i + 1].setAttribute('x', bx + 6); texts[i + 1].setAttribute('y', T + 34 + i * 16);
      texts[i + 1].textContent = `${sr.name}: ${dec(sr.values[k], 3)}`;
    });
    hover.setAttribute('visibility', 'visible');
  };
  capture.addEventListener('mousemove', move);
  capture.addEventListener('touchmove', move, { passive: true });
  capture.addEventListener('mouseleave', () => hover.setAttribute('visibility', 'hidden'));
  svg.append(capture);
  return svg;
}
