import { api, apiUrl, canEditStars, canManageUsers, isChild, roleLabel } from './api.js';
import { el, clear, toast, confirmDialog, promptDialog, spawnFloater, confettiBurst } from './ui.js';

const root = document.getElementById('app');

const state = {
  me: null,
  family: null,
  children: [],
  prizes: [],
  redemptions: [],
};

async function bootstrap() {
  try {
    const r = await api.me();
    state.me = r.user;
    state.family = r.family;
  } catch {
    location.href = '/login';
    return;
  }
  await loadBoardData();
  render();
}

async function refreshChildren() {
  try {
    state.children = await api.listChildren();
  } catch (err) {
    toast(err.detail || 'שגיאה בטעינת הילדים', 'error');
    state.children = [];
  }
}

async function refreshPrizes() {
  try {
    state.prizes = await api.listPrizes();
  } catch (err) {
    toast(err.detail || 'שגיאה בטעינת הפרסים', 'error');
    state.prizes = [];
  }
}

async function refreshRedemptions() {
  try {
    state.redemptions = await api.listRedemptions(25);
  } catch {
    state.redemptions = [];
  }
}

async function loadBoardData() {
  await Promise.all([refreshChildren(), refreshPrizes(), refreshRedemptions()]);
}

function render() {
  clear(root);
  root.appendChild(el('div', { class: 'space-y-6 pop' },
    renderHeader(),
    renderLeaderboard(),
    renderChildList(),
    renderPrizesSection(),
    renderFooter(),
  ));
}

function renderHeader() {
  const userInfo = el('div', { class: 'flex items-center gap-2 flex-wrap' },
    el('span', { class: 'text-sm text-stone-600' }, state.family.name),
    el('span', { class: 'text-stone-300' }, '·'),
    el('span', { class: 'text-sm font-bold text-stone-900' }, state.me.display_name),
    el('span', { class: `role-badge ${state.me.role}` }, roleLabel(state.me.role)),
  );

  const navBtns = el('div', { class: 'flex gap-2 flex-wrap' });
  if (canManageUsers(state.me)) {
    navBtns.appendChild(el('a', { href: '/admin', class: 'btn btn-ghost' }, 'ניהול'));
  }
  navBtns.appendChild(el('button', {
    class: 'btn btn-ghost',
    onClick: async () => { await api.logout(); location.href = '/login'; },
  }, 'יציאה'));

  return el('header', { class: 'flex flex-wrap gap-3 items-start justify-between' },
    el('div', {},
      el('h1', { class: 'text-3xl sm:text-4xl font-extrabold tracking-tight flex items-center gap-2' },
        el('span', { class: 'select-none' }, '⭐'),
        el('span', { class: 'bg-gradient-to-l from-orange-600 to-orange-500 bg-clip-text text-transparent' }, 'לוח הכוכבים'),
      ),
      userInfo,
    ),
    navBtns,
  );
}

function renderLeaderboard() {
  if (state.children.length === 0) return el('div');
  const sorted = [...state.children].sort((a, b) => b.stars - a.stars);
  const top = sorted.slice(0, 3);
  const podiumClasses = ['podium-1', 'podium-2', 'podium-3'];
  return el('div', { class: 'surface p-5 sm:p-6' },
    el('h2', { class: 'text-lg font-extrabold text-stone-900 mb-4' }, 'מובילים'),
    el('div', { class: 'grid grid-cols-3 gap-3' },
      ...top.map((c, i) => el('div', { class: `${podiumClasses[i]} p-4 text-center` },
        el('div', { class: 'text-2xl mb-1' }, ['🥇', '🥈', '🥉'][i]),
        renderAvatarThumb(c, 'w-12 h-12 mx-auto mb-2 rounded-xl text-lg'),
        el('div', { class: 'font-extrabold text-stone-900 truncate' }, c.name),
        el('div', { class: 'text-orange-700 font-bold' }, `⭐ ${c.stars}`),
      )),
    ),
  );
}

function avatarUrl(child) {
  if (!child.photo_url) return null;
  const q = child._photoV != null ? `?v=${child._photoV}` : '';
  return apiUrl(child.photo_url) + q;
}

function renderAvatarThumb(child, sizeClass) {
  const url = avatarUrl(child);
  if (url) {
    return el('img', {
      src: url,
      alt: '',
      class: `${sizeClass} object-cover border-2 border-orange-200 shadow-sm`,
      loading: 'lazy',
    });
  }
  const initial = (child.name && child.name.charAt(0)) || '?';
  return el('div', {
    class: `${sizeClass} rounded-xl bg-gradient-to-br from-orange-100 to-amber-100 border-2 border-orange-200 flex items-center justify-center font-extrabold text-orange-800 shadow-sm`,
  }, initial);
}

function renderChildList() {
  if (state.children.length === 0) {
    return el('div', { class: 'surface p-10 text-center text-stone-600' },
      el('p', { class: 'text-lg' }, isChild(state.me)
        ? 'הילד שלך לא מקושר עדיין — בקש/י מההורים לקשר.'
        : 'אין עדיין ילדים ברשימה.'),
      canEditStars(state.me) ? el('button', {
        class: 'btn btn-primary mt-4',
        onClick: addChild,
      }, '➕ הוספת ילד ראשון') : null,
    );
  }

  const list = el('div', { class: 'space-y-3' },
    ...state.children.map(renderChildRow));
  return list;
}

function renderChildRow(child) {
  const editable = canEditStars(state.me);

  const stars = el('div', { class: 'text-2xl font-extrabold text-orange-600' }, `⭐ ${child.stars}`);
  const nameLbl = el('div', { class: 'text-xl font-extrabold text-stone-900 truncate' }, child.name);

  async function changeStars(delta, btn) {
    btn.disabled = true;
    try {
      const updated = await api.changeStars(child.id, delta);
      const idx = state.children.findIndex(c => c.id === child.id);
      if (idx >= 0) state.children[idx] = updated;
      stars.textContent = `⭐ ${updated.stars}`;
      const rect = btn.getBoundingClientRect();
      spawnFloater((delta > 0 ? '+' : '') + delta, rect.left + rect.width / 2, rect.top);
      if (delta > 0 && updated.stars > 0 && updated.stars % 10 === 0) confettiBurst();
      // Re-sort if needed
      state.children.sort((a, b) => b.stars - a.stars);
      render();
    } catch (err) {
      toast(err.detail || 'שגיאה', 'error');
    } finally {
      btn.disabled = false;
    }
  }

  const minusBtn = editable ? el('button', {
    class: 'btn btn-pop',
    style: { width: '70px', height: '70px', borderRadius: '50%', background: '#dc2626', color: '#fff', fontSize: '32px', fontWeight: '800', border: '3px solid #991b1b' },
    onClick: (e) => changeStars(-1, e.currentTarget),
  }, '−') : null;

  const plusBtn = editable ? el('button', {
    class: 'btn btn-pop',
    style: { width: '70px', height: '70px', borderRadius: '50%', background: '#16a34a', color: '#fff', fontSize: '32px', fontWeight: '800', border: '3px solid #15803d' },
    onClick: (e) => changeStars(1, e.currentTarget),
  }, '+') : null;

  const editBtn = editable ? el('button', {
    class: 'text-xs text-stone-500 hover:text-stone-800 font-semibold',
    onClick: async () => {
      const newName = await promptDialog('שם חדש לילד', child.name);
      if (!newName || newName === child.name) return;
      try {
        await api.updateChild(child.id, { name: newName });
        await refreshChildren();
        render();
      } catch (err) { toast(err.detail || 'שגיאה', 'error'); }
    },
  }, 'עריכה') : null;

  const deleteBtn = editable ? el('button', {
    class: 'text-xs text-red-500 hover:text-red-700 font-semibold',
    onClick: async () => {
      if (!await confirmDialog(`למחוק את ${child.name}?`)) return;
      try {
        await api.deleteChild(child.id);
        await refreshChildren();
        render();
      } catch (err) { toast(err.detail || 'שגיאה', 'error'); }
    },
  }, 'מחיקה') : null;

  const historyBtn = el('button', {
    class: 'text-xs text-orange-700 hover:text-orange-900 font-semibold',
    onClick: () => showHistory(child),
  }, 'היסטוריה');

  const photoInput = el('input', {
    type: 'file',
    accept: 'image/jpeg,image/png,image/webp',
    class: 'sr-only',
    'aria-hidden': 'true',
    tabIndex: -1,
  });
  photoInput.addEventListener('change', async () => {
    const f = photoInput.files && photoInput.files[0];
    photoInput.value = '';
    if (!f) return;
    try {
      const updated = await api.uploadChildPhoto(child.id, f);
      updated._photoV = Date.now();
      const idx = state.children.findIndex(c => c.id === child.id);
      if (idx >= 0) state.children[idx] = updated;
      render();
      toast('התמונה נשמרה', 'success');
    } catch (err) {
      toast(err.detail || 'שגיאה בהעלאה', 'error');
    }
  });

  const photoBtn = editable ? el('button', {
    class: 'text-xs text-stone-500 hover:text-stone-800 font-semibold',
    type: 'button',
    onClick: () => photoInput.click(),
  }, '📷 תמונה') : null;

  const removePhotoBtn = editable && child.photo_url ? el('button', {
    class: 'text-xs text-stone-400 hover:text-stone-700 font-semibold',
    type: 'button',
    onClick: async () => {
      if (!await confirmDialog(`להסיר את התמונה של ${child.name}?`)) return;
      try {
        const updated = await api.deleteChildPhoto(child.id);
        updated._photoV = Date.now();
        const idx = state.children.findIndex(c => c.id === child.id);
        if (idx >= 0) state.children[idx] = updated;
        render();
      } catch (err) { toast(err.detail || 'שגיאה', 'error'); }
    },
  }, 'הסר תמונה') : null;

  const actions = el('div', { class: 'flex flex-wrap gap-x-3 gap-y-1 mt-1' },
    historyBtn, photoBtn, removePhotoBtn, editBtn, deleteBtn,
  );

  const avatarCol = el('div', { class: 'flex flex-col items-center shrink-0' },
    renderAvatarThumb(child, 'w-16 h-16 rounded-2xl text-xl'),
    photoInput,
  );

  return el('div', { class: 'surface p-4 flex items-center gap-3 card-hover' },
    minusBtn,
    avatarCol,
    el('div', { class: 'flex-1 min-w-0 text-right' }, nameLbl, stars, actions),
    plusBtn,
  );
}

async function showHistory(child) {
  let events;
  try { events = await api.listEvents(child.id, 30); }
  catch (err) { toast(err.detail || 'שגיאה', 'error'); return; }

  const overlay = el('div', {
    class: 'fixed inset-0 z-[70] flex items-center justify-center bg-stone-900/40 p-4',
    onClick: (ev) => { if (ev.target === overlay) overlay.remove(); },
  });
  const list = events.length === 0
    ? el('p', { class: 'text-stone-500 text-center py-8' }, 'אין עדיין היסטוריה')
    : el('ul', { class: 'space-y-2 max-h-96 overflow-y-auto scroll-fade' },
        ...events.map(ev => el('li', { class: 'flex justify-between items-center surface-tight p-3 text-sm' },
          el('span', { class: ev.delta > 0 ? 'text-green-700 font-bold' : 'text-red-700 font-bold' },
            (ev.delta > 0 ? '+' : '') + ev.delta + ' ⭐'),
          el('span', { class: 'text-stone-500 text-xs' }, new Date(ev.created_at).toLocaleString('he-IL')),
        )),
      );
  const card = el('div', { class: 'modal-shell rounded-3xl p-6 max-w-md w-full pop' },
    el('h3', { class: 'text-xl font-extrabold mb-4' }, `היסטוריה — ${child.name}`),
    list,
    el('div', { class: 'flex justify-end mt-5' },
      el('button', { class: 'btn btn-ghost', onClick: () => overlay.remove() }, 'סגירה'),
    ),
  );
  overlay.appendChild(card);
  document.body.appendChild(overlay);
}

function renderPrizesSection() {
  const headerRow = el('div', { class: 'flex flex-wrap items-center justify-between gap-3 mb-4' },
    el('h2', { class: 'text-xl font-extrabold text-stone-900' }, '🎁 פרסים'),
    canEditStars(state.me)
      ? el('button', {
        class: 'btn btn-ghost text-sm tap-target',
        onClick: addPrize,
      }, '➕ פרס חדש')
      : null,
  );

  const prizeCards = state.prizes.length === 0
    ? el('p', { class: 'text-stone-500 text-sm text-center py-4' },
        canEditStars(state.me) ? 'הגדירו פרסים כדי שהילדים ידעו למה לכוון.' : 'עדיין אין פרסים.')
    : el('div', { class: 'space-y-2' },
        ...state.prizes.map((p) => {
          const hasEligible = state.children.some(c => c.stars >= p.cost_stars);
          const redeemBtn = canEditStars(state.me)
            ? el('button', {
              class: 'btn btn-primary text-sm py-2 px-4 shrink-0',
              disabled: !hasEligible,
              onClick: () => openRedeemDialog(p),
            }, 'מימוש')
            : null;
          const del = canEditStars(state.me)
            ? el('button', {
              class: 'text-xs text-red-500 font-semibold shrink-0',
              onClick: async () => {
                if (!await confirmDialog(`למחוק את הפרס "${p.name}"?`)) return;
                try {
                  await api.deletePrize(p.id);
                  await refreshPrizes();
                  render();
                } catch (err) { toast(err.detail || 'שגיאה', 'error'); }
              },
            }, 'מחק')
            : null;
          return el('div', { class: 'surface p-4 flex flex-wrap items-center gap-3 justify-between card-hover' },
            el('div', { class: 'min-w-0 flex-1 text-right' },
              el('div', { class: 'font-bold text-lg text-stone-900 truncate' }, p.name),
              el('div', { class: 'text-orange-700 font-bold text-sm' }, `${p.cost_stars} ⭐`),
            ),
            el('div', { class: 'flex items-center gap-2' }, redeemBtn, del),
          );
        }),
      );

  const redeemStrip = state.redemptions.length === 0 ? null : el('div', { class: 'mt-5 pt-4 border-t border-stone-200' },
    el('h3', { class: 'text-sm font-extrabold text-stone-700 mb-2' }, 'מימושים אחרונים'),
    el('ul', { class: 'space-y-1.5 max-h-40 overflow-y-auto text-sm text-stone-600' },
      ...state.redemptions.map(r => el('li', { class: 'flex justify-between gap-2' },
        el('span', { class: 'truncate' }, `${r.child_name} — ${r.prize_name}`),
        el('span', { class: 'text-stone-400 shrink-0 text-xs' },
          new Date(r.created_at).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' })),
      )),
    ),
  );

  return el('div', { class: 'surface p-5 sm:p-6' },
    headerRow,
    prizeCards,
    redeemStrip,
  );
}

async function addPrize() {
  const name = await promptDialog('שם הפרס (אפשר אימוג׳י)');
  if (!name) return;
  const costStr = await promptDialog('מחיר בכוכבים', '10');
  if (costStr == null) return;
  const cost = parseInt(costStr, 10);
  if (!Number.isFinite(cost) || cost < 1) {
    toast('מחיר לא תקין', 'error');
    return;
  }
  try {
    await api.createPrize(name, cost);
    await refreshPrizes();
    render();
  } catch (err) {
    toast(err.detail || 'שגיאה', 'error');
  }
}

function openRedeemDialog(prize) {
  const eligible = state.children.filter(c => c.stars >= prize.cost_stars);
  if (eligible.length === 0) {
    toast('אף ילד לא צבר מספיק כוכבים', 'info');
    return;
  }
  const overlay = el('div', {
    class: 'fixed inset-0 z-[70] flex items-center justify-center bg-stone-900/40 p-4',
    onClick: (ev) => { if (ev.target === overlay) overlay.remove(); },
  });
  const pickChild = async (child) => {
    overlay.remove();
    try {
      const updated = await api.redeemPrize(prize.id, child.id);
      const idx = state.children.findIndex(c => c.id === child.id);
      if (idx >= 0) state.children[idx] = updated;
      state.children.sort((a, b) => b.stars - a.stars);
      await refreshRedemptions();
      render();
      confettiBurst(28);
      toast(`מימשתם: ${prize.name}`, 'success');
    } catch (err) {
      toast(err.detail || 'שגיאה', 'error');
    }
  };
  const list = el('div', { class: 'space-y-2 max-h-80 overflow-y-auto mt-2' },
    ...eligible.map(c => el('button', {
      class: 'w-full flex items-center gap-3 p-3 rounded-2xl bg-stone-50 hover:bg-white border-2 border-stone-200 text-right btn-pop',
      onClick: () => pickChild(c),
    },
      renderAvatarThumb(c, 'w-11 h-11 rounded-xl text-lg shrink-0'),
      el('div', { class: 'flex-1 min-w-0' },
        el('div', { class: 'font-bold text-stone-900' }, c.name),
        el('div', { class: 'text-orange-600 text-sm font-bold' },
          `${c.stars} ⟶ ${c.stars - prize.cost_stars}`),
      ),
    )),
  );
  const card = el('div', { class: 'modal-shell rounded-3xl p-6 max-w-md w-full pop' },
    el('h3', { class: 'text-xl font-extrabold mb-1' }, `מימוש: ${prize.name}`),
    el('p', { class: 'text-stone-600 text-sm mb-3' }, `עלות ${prize.cost_stars} ⭐ — בחרו את הילד/ה:`),
    list,
    el('div', { class: 'flex justify-end mt-5' },
      el('button', { class: 'btn btn-ghost', onClick: () => overlay.remove() }, 'ביטול'),
    ),
  );
  overlay.appendChild(card);
  document.body.appendChild(overlay);
}

function renderFooter() {
  if (!canEditStars(state.me)) return el('div');
  return el('div', { class: 'flex flex-col sm:flex-row gap-3 pt-2' },
    el('button', { class: 'btn btn-primary flex-1 tap-target text-lg', onClick: addChild }, '➕ הוסף ילד'),
    el('button', { class: 'btn btn-ghost flex-1 tap-target', onClick: weekReset }, '🔄 איפוס שבוע'),
  );
}

async function addChild() {
  const name = await promptDialog('שם הילד/ה');
  if (!name) return;
  try {
    await api.createChild(name);
    await loadBoardData();
    render();
  } catch (err) {
    toast(err.detail || 'שגיאה בהוספה', 'error');
  }
}

async function weekReset() {
  if (!await confirmDialog('לאפס את כל הכוכבים של כל הילדים ל-0?')) return;
  try {
    await api.weekReset();
    await loadBoardData();
    render();
    toast('הכל אופס', 'success');
  } catch (err) {
    toast(err.detail || 'שגיאה', 'error');
  }
}

bootstrap();
