import { api } from './api.js';
import { el, clear, toast } from './ui.js';

const root = document.getElementById('root');

async function bootstrap() {
  // If already logged in, go straight to the board.
  try {
    await api.me();
    location.href = '/board';
    return;
  } catch { /* not logged in */ }

  let families = [];
  try {
    families = await api.listFamilies();
  } catch (err) {
    families = [];
  }

  if (families.length === 0) {
    renderRegister();
  } else {
    renderLogin(families);
  }
}

function header(subtitle) {
  return el('header', { class: 'mb-8' },
    el('h1', { class: 'text-4xl sm:text-5xl font-extrabold tracking-tight text-stone-900 flex items-center gap-3 leading-none' },
      el('span', { class: 'select-none' }, '⭐'),
      el('span', { class: 'bg-gradient-to-l from-orange-600 to-orange-500 bg-clip-text text-transparent' }, 'לוח הכוכבים'),
    ),
    subtitle ? el('p', { class: 'mt-3 text-stone-600 text-sm sm:text-base' }, subtitle) : null,
  );
}

function renderRegister() {
  clear(root);
  const familyName = el('input', { class: 'input', type: 'text', placeholder: 'למשל: משפחת כהן' });
  const adminUser = el('input', { class: 'input', type: 'text', placeholder: 'שם משתמש (באנגלית)', autocomplete: 'username' });
  const adminDisplay = el('input', { class: 'input', type: 'text', placeholder: 'שם להצגה (למשל: אבא)' });
  const adminPass = el('input', { class: 'input', type: 'password', placeholder: 'לפחות 6 תווים', autocomplete: 'new-password' });

  const submitBtn = el('button', { class: 'btn btn-primary w-full tap-target', onClick: onSubmit }, 'יצירת משפחה והתחלה');

  async function onSubmit() {
    submitBtn.disabled = true;
    try {
      await api.register({
        family_name: familyName.value.trim(),
        admin_username: adminUser.value.trim(),
        admin_display_name: adminDisplay.value.trim(),
        admin_password: adminPass.value,
      });
      toast('נוצרה משפחה חדשה', 'success');
      location.href = '/board';
    } catch (err) {
      toast(err.detail || 'שגיאה ביצירת המשפחה', 'error');
      submitBtn.disabled = false;
    }
  }

  const card = el('div', { class: 'surface p-6 sm:p-7 space-y-4 pop' },
    el('h2', { class: 'text-xl font-extrabold text-stone-900' }, 'משפחה חדשה'),
    el('p', { class: 'text-sm text-stone-600 leading-relaxed' }, 'אין עדיין משפחות במערכת. נתחיל ביצירת משפחה ומנהל ראשי.'),
    el('label', { class: 'block' }, el('span', { class: 'label' }, 'שם המשפחה'), familyName),
    el('label', { class: 'block' }, el('span', { class: 'label' }, 'שם משתמש למנהל'), adminUser),
    el('label', { class: 'block' }, el('span', { class: 'label' }, 'שם להצגה'), adminDisplay),
    el('label', { class: 'block' }, el('span', { class: 'label' }, 'סיסמה'), adminPass),
    submitBtn,
  );

  root.appendChild(el('div', {}, header('יצירת משפחה ראשונה — מי שיוצר הופך למנהל'), card));
}

function renderLogin(families) {
  clear(root);
  const familySel = el('select', { class: 'input' },
    ...families.map(f => el('option', { value: String(f.id) }, f.name))
  );
  const username = el('input', { class: 'input', type: 'text', placeholder: 'שם משתמש', autocomplete: 'username' });
  const password = el('input', { class: 'input', type: 'password', placeholder: 'סיסמה', autocomplete: 'current-password' });

  const loginBtn = el('button', { class: 'btn btn-primary w-full tap-target', onClick: onLogin }, 'כניסה');

  async function onLogin() {
    loginBtn.disabled = true;
    try {
      await api.login(parseInt(familySel.value, 10), username.value.trim(), password.value);
      location.href = '/board';
    } catch (err) {
      toast(err.detail || 'שם משתמש או סיסמה שגויים', 'error');
      loginBtn.disabled = false;
    }
  }

  password.addEventListener('keydown', (e) => { if (e.key === 'Enter') onLogin(); });

  const card = el('div', { class: 'surface p-6 sm:p-7 space-y-4 pop' },
    el('h2', { class: 'text-xl font-extrabold text-stone-900' }, 'כניסה'),
    el('label', { class: 'block' }, el('span', { class: 'label' }, 'משפחה'), familySel),
    el('label', { class: 'block' }, el('span', { class: 'label' }, 'שם משתמש'), username),
    el('label', { class: 'block' }, el('span', { class: 'label' }, 'סיסמה'), password),
    loginBtn,
  );

  const newFamilyToggle = el('details', { class: 'surface-tight p-4 mt-4' },
    el('summary', { class: 'text-sm font-bold text-orange-700' }, 'משפחה חדשה במערכת?'),
    el('div', { class: 'mt-3' },
      el('button', { class: 'btn btn-ghost w-full', onClick: () => renderRegister() }, 'יצירת משפחה חדשה'),
    ),
  );

  root.appendChild(el('div', {}, header('בחרו משפחה והתחברו'), card, newFamilyToggle));
}

bootstrap();
