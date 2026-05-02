import { api, canManageUsers, roleLabel } from './api.js';
import { el, clear, toast, confirmDialog } from './ui.js';

const root = document.getElementById('app');
const state = { me: null, family: null, users: [], children: [] };

async function bootstrap() {
  try {
    const r = await api.me();
    state.me = r.user;
    state.family = r.family;
  } catch {
    location.href = '/login';
    return;
  }
  if (!canManageUsers(state.me)) {
    toast('רק מנהלים יכולים לגשת לדף זה', 'error');
    setTimeout(() => location.href = '/board', 1500);
    return;
  }
  await refresh();
  render();
}

async function refresh() {
  try {
    const [users, children] = await Promise.all([api.listUsers(), api.listChildren()]);
    state.users = users;
    state.children = children;
  } catch (err) {
    toast(err.detail || 'שגיאה בטעינה', 'error');
  }
}

function render() {
  clear(root);
  root.appendChild(el('div', { class: 'space-y-6 pop' },
    renderHeader(),
    renderUserSection(),
    renderChildSection(),
  ));
}

function renderHeader() {
  return el('header', { class: 'flex flex-wrap items-center justify-between gap-3' },
    el('div', {},
      el('h1', { class: 'text-3xl font-extrabold' }, '⚙️ ניהול'),
      el('p', { class: 'text-sm text-stone-600' }, state.family.name),
    ),
    el('div', { class: 'flex gap-2' },
      el('a', { href: '/board', class: 'btn btn-ghost' }, '← ללוח'),
      el('button', {
        class: 'btn btn-ghost',
        onClick: async () => { await api.logout(); location.href = '/login'; },
      }, 'יציאה'),
    ),
  );
}

function renderUserSection() {
  return el('section', { class: 'surface p-5 sm:p-6' },
    el('h2', { class: 'text-xl font-extrabold mb-4' }, 'משתמשים'),
    el('div', { class: 'space-y-3' }, ...state.users.map(renderUserRow)),
    renderAddUserForm(),
  );
}

function renderUserRow(user) {
  const isMe = user.id === state.me.id;
  const linkedChild = state.children.find(c => c.id === user.linked_child_id);

  return el('div', { class: 'surface-tight p-3 flex flex-wrap items-center gap-3' },
    el('div', { class: 'flex-1 min-w-[180px]' },
      el('div', { class: 'font-bold text-stone-900' },
        user.display_name,
        isMe ? el('span', { class: 'text-xs text-stone-500 mr-2' }, '(אני)') : null,
      ),
      el('div', { class: 'text-xs text-stone-500 font-mono' }, user.username),
      linkedChild ? el('div', { class: 'text-xs text-orange-700 mt-1' }, `מקושר ל: ${linkedChild.name}`) : null,
    ),
    el('span', { class: `role-badge ${user.role}` }, roleLabel(user.role)),
    el('div', { class: 'flex gap-2' },
      el('button', { class: 'btn btn-ghost text-xs', onClick: () => editUser(user) }, 'עריכה'),
      isMe ? null : el('button', {
        class: 'btn btn-danger text-xs',
        onClick: async () => {
          if (!await confirmDialog(`למחוק את ${user.display_name}?`)) return;
          try { await api.deleteUser(user.id); await refresh(); render(); toast('נמחק', 'success'); }
          catch (err) { toast(err.detail || 'שגיאה', 'error'); }
        },
      }, 'מחיקה'),
    ),
  );
}

function renderAddUserForm() {
  const username = el('input', { class: 'input', type: 'text', placeholder: 'שם משתמש (אנגלית)' });
  const display = el('input', { class: 'input', type: 'text', placeholder: 'שם להצגה' });
  const password = el('input', { class: 'input', type: 'password', placeholder: 'סיסמה (לפחות 6)' });
  const roleSel = el('select', { class: 'input' },
    el('option', { value: 'parent' }, 'הורה'),
    el('option', { value: 'admin' }, 'מנהל'),
    el('option', { value: 'child' }, 'ילד/ה'),
  );
  const linkedSel = el('select', { class: 'input' },
    el('option', { value: '' }, '— ללא קישור —'),
    ...state.children.map(c => el('option', { value: String(c.id) }, c.name)),
  );

  const submit = async () => {
    const payload = {
      username: username.value.trim(),
      display_name: display.value.trim(),
      password: password.value,
      role: roleSel.value,
      linked_child_id: linkedSel.value ? parseInt(linkedSel.value, 10) : null,
    };
    try {
      await api.createUser(payload);
      toast('משתמש נוצר', 'success');
      username.value = display.value = password.value = '';
      linkedSel.value = '';
      await refresh();
      render();
    } catch (err) {
      toast(err.detail || 'שגיאה ביצירה', 'error');
    }
  };

  return el('details', { class: 'mt-4 surface-tight p-4' },
    el('summary', { class: 'font-bold text-orange-700 cursor-pointer' }, '➕ הוספת משתמש'),
    el('div', { class: 'mt-3 grid sm:grid-cols-2 gap-3' },
      el('label', {}, el('span', { class: 'label' }, 'שם משתמש'), username),
      el('label', {}, el('span', { class: 'label' }, 'שם להצגה'), display),
      el('label', {}, el('span', { class: 'label' }, 'סיסמה'), password),
      el('label', {}, el('span', { class: 'label' }, 'תפקיד'), roleSel),
      el('label', { class: 'sm:col-span-2' }, el('span', { class: 'label' }, 'קישור לילד (אופציונלי, רלוונטי לתפקיד "ילד/ה")'), linkedSel),
    ),
    el('button', { class: 'btn btn-primary mt-3', onClick: submit }, 'הוספה'),
  );
}

function editUser(user) {
  const overlay = el('div', {
    class: 'fixed inset-0 z-[70] flex items-center justify-center bg-stone-900/40 p-4',
    onClick: (ev) => { if (ev.target === overlay) overlay.remove(); },
  });
  const display = el('input', { class: 'input', type: 'text', value: user.display_name });
  const password = el('input', { class: 'input', type: 'password', placeholder: 'השאר ריק לא לשנות' });
  const roleSel = el('select', { class: 'input' },
    el('option', { value: 'parent' }, 'הורה'),
    el('option', { value: 'admin' }, 'מנהל'),
    el('option', { value: 'child' }, 'ילד/ה'),
  );
  roleSel.value = user.role;
  const linkedSel = el('select', { class: 'input' },
    el('option', { value: '' }, '— ללא —'),
    ...state.children.map(c => el('option', { value: String(c.id) }, c.name)),
  );
  if (user.linked_child_id) linkedSel.value = String(user.linked_child_id);

  const card = el('div', { class: 'modal-shell rounded-3xl p-6 max-w-md w-full pop space-y-3' },
    el('h3', { class: 'text-xl font-extrabold' }, `עריכת ${user.display_name}`),
    el('label', {}, el('span', { class: 'label' }, 'שם להצגה'), display),
    el('label', {}, el('span', { class: 'label' }, 'תפקיד'), roleSel),
    el('label', {}, el('span', { class: 'label' }, 'קישור לילד'), linkedSel),
    el('label', {}, el('span', { class: 'label' }, 'סיסמה חדשה'), password),
    el('div', { class: 'flex gap-3 justify-end pt-2' },
      el('button', { class: 'btn btn-ghost', onClick: () => overlay.remove() }, 'ביטול'),
      el('button', {
        class: 'btn btn-primary',
        onClick: async () => {
          const payload = {
            display_name: display.value.trim() || null,
            role: roleSel.value || null,
            linked_child_id: linkedSel.value ? parseInt(linkedSel.value, 10) : null,
          };
          if (password.value) payload.password = password.value;
          try {
            await api.updateUser(user.id, payload);
            overlay.remove();
            await refresh();
            render();
            toast('נשמר', 'success');
          } catch (err) {
            toast(err.detail || 'שגיאה', 'error');
          }
        },
      }, 'שמירה'),
    ),
  );
  overlay.appendChild(card);
  document.body.appendChild(overlay);
}

function renderChildSection() {
  return el('section', { class: 'surface p-5 sm:p-6' },
    el('h2', { class: 'text-xl font-extrabold mb-4' }, 'ילדים'),
    el('div', { class: 'space-y-2' }, ...state.children.map(c =>
      el('div', { class: 'surface-tight p-3 flex items-center justify-between' },
        el('div', {},
          el('div', { class: 'font-bold' }, c.name),
          el('div', { class: 'text-xs text-stone-500' }, `⭐ ${c.stars}`),
        ),
        el('button', {
          class: 'btn btn-danger text-xs',
          onClick: async () => {
            if (!await confirmDialog(`למחוק את ${c.name}?`)) return;
            try { await api.deleteChild(c.id); await refresh(); render(); }
            catch (err) { toast(err.detail || 'שגיאה', 'error'); }
          },
        }, 'מחיקה'),
      ),
    )),
    state.children.length === 0
      ? el('p', { class: 'text-stone-500 text-sm' }, 'אין עדיין ילדים. הוסיפו דרך הלוח הראשי.')
      : null,
  );
}

bootstrap();
