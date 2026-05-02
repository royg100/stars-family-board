// Tiny DOM helpers + toast.

export function el(tag, attrs, ...children) {
  const e = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class' || k === 'className') e.className = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
      else if (k.startsWith('on') && typeof v === 'function') {
        e.addEventListener(k.slice(2).toLowerCase(), v);
      } else {
        e.setAttribute(k, v === true ? '' : String(v));
      }
    }
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    e.appendChild(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return e;
}

export function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

let toastTimer = null;
export function toast(message, kind = 'info', ms = 2800) {
  const root = document.getElementById('toast-root') || document.body;
  const t = el('div', { class: `toast ${kind}` }, message);
  root.appendChild(t);
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.remove(), ms);
}

export function confirmDialog(message) {
  return new Promise((resolve) => {
    const overlay = el('div', {
      class: 'fixed inset-0 z-[70] flex items-center justify-center bg-stone-900/40 p-4',
      onClick: (ev) => { if (ev.target === overlay) { overlay.remove(); resolve(false); } },
    });
    const card = el('div', { class: 'modal-shell rounded-3xl p-6 max-w-sm w-full pop' },
      el('p', { class: 'text-stone-900 text-lg font-bold mb-5 leading-snug' }, message),
      el('div', { class: 'flex gap-3 justify-end' },
        el('button', {
          class: 'btn btn-ghost',
          onClick: () => { overlay.remove(); resolve(false); },
        }, 'ביטול'),
        el('button', {
          class: 'btn btn-danger',
          onClick: () => { overlay.remove(); resolve(true); },
        }, 'אישור'),
      ),
    );
    overlay.appendChild(card);
    document.body.appendChild(overlay);
  });
}

export function promptDialog(message, defaultValue = '') {
  return new Promise((resolve) => {
    const overlay = el('div', {
      class: 'fixed inset-0 z-[70] flex items-center justify-center bg-stone-900/40 p-4',
      onClick: (ev) => { if (ev.target === overlay) { overlay.remove(); resolve(null); } },
    });
    const input = el('input', { class: 'input', type: 'text', value: defaultValue });
    const card = el('div', { class: 'modal-shell rounded-3xl p-6 max-w-sm w-full pop' },
      el('p', { class: 'text-stone-900 text-lg font-bold mb-3' }, message),
      input,
      el('div', { class: 'flex gap-3 justify-end mt-5' },
        el('button', { class: 'btn btn-ghost', onClick: () => { overlay.remove(); resolve(null); } }, 'ביטול'),
        el('button', { class: 'btn btn-primary', onClick: () => { overlay.remove(); resolve(input.value.trim()); } }, 'אישור'),
      ),
    );
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    setTimeout(() => input.focus(), 30);
    input.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') { overlay.remove(); resolve(input.value.trim()); }
      if (ev.key === 'Escape') { overlay.remove(); resolve(null); }
    });
  });
}

export function spawnFloater(text, x, y) {
  const f = el('div', { class: 'floater', style: { left: x + 'px', top: y + 'px' } }, text);
  document.body.appendChild(f);
  setTimeout(() => f.remove(), 950);
}

const CONFETTI_COLORS = ['#fb923c', '#f97316', '#fbbf24', '#a78bfa', '#34d399', '#60a5fa', '#f472b6'];
export function confettiBurst(count = 40) {
  for (let i = 0; i < count; i++) {
    const c = el('div', {
      class: 'confetti',
      style: {
        left: (Math.random() * 100) + 'vw',
        background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        animationDelay: (Math.random() * 0.4) + 's',
      },
    });
    document.body.appendChild(c);
    setTimeout(() => c.remove(), 2700);
  }
}
