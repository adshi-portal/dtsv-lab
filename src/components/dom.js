// Мінімальні DOM-утиліти (замість React: без збірки, працює напряму на GitHub Pages).

/**
 * h('div.card#id', {onclick, class, style, ...attrs}, ...children)
 * children: рядки, числа, вузли, масиви, null/false (ігноруються).
 */
export function h(tag, attrs, ...children) {
  if (attrs === null || typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs)) {
    if (attrs !== undefined && attrs !== null) children.unshift(attrs);
    attrs = {};
  }
  const [, name = 'div', rest = ''] = tag.match(/^([a-z0-9-]*)(.*)$/i);
  const el = document.createElement(name || 'div');
  rest.replace(/([.#])([^.#]+)/g, (_, t, v) => {
    if (t === '.') el.classList.add(v); else el.id = v;
    return '';
  });
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'class') el.classList.add(...String(v).split(/\s+/).filter(Boolean));
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k in el && typeof v !== 'string' && k !== 'list') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  append(el, children);
  return el;
}

export function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

/** Фрагмент HTML (для MathML і заздалегідь підготовленого тексту теорії). */
export function raw(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content;
}

export function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }

export function toast(message, kind = 'info') {
  let box = document.querySelector('.toasts');
  if (!box) { box = h('div.toasts', { role: 'status', 'aria-live': 'polite' }); document.body.append(box); }
  const t = h(`div.toast.toast-${kind}`, message);
  box.append(t);
  setTimeout(() => t.classList.add('out'), 3200);
  setTimeout(() => t.remove(), 3700);
}

/** Модальне вікно; повертає функцію закриття. */
export function modal(title, body, actions = []) {
  const close = () => { overlay.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const overlay = h('div.modal-overlay', { onclick: (e) => { if (e.target === overlay) close(); } },
    h('div.modal', { role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
      h('div.modal-head', h('h2', title), h('button.icon-btn', { onclick: close, 'aria-label': 'Закрити' }, '×')),
      h('div.modal-body', body),
      actions.length ? h('div.modal-actions', actions.map((a) => h(`button.btn${a.primary ? '.btn-primary' : ''}`, {
        onclick: () => { if (a.onClick?.() !== false) close(); },
      }, a.label))) : null,
    ));
  document.body.append(overlay);
  document.addEventListener('keydown', onKey);
  overlay.querySelector('input,select,textarea,button')?.focus();
  return close;
}
