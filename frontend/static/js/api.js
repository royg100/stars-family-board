// Thin wrapper around fetch for the Stars API.
// All endpoints use httpOnly cookies — no tokens in JS.
//
// אם הממשק מוצג מכתובת אחרת מה־API (למשל Netlify), לפני טעינת המודולים:
//   <script>window.STARS_API_BASE = "https://your-backend.example.com"</script>
// ובשרת: STARS_CORS_ALLOW_ORIGINS=https://your-frontend.netlify.app

class ApiError extends Error {
  constructor(status, detail, body) {
    super(detail || `HTTP ${status}`);
    this.status = status;
    this.detail = detail;
    this.body = body;
  }
}

function getApiBase() {
  if (typeof window === 'undefined') return '';
  const b = window.STARS_API_BASE;
  if (b == null || String(b).trim() === '') return '';
  return String(b).trim().replace(/\/$/, '');
}

/** מחזיר true כשה־API בכתובת שונה מהדף (נדרש credentials: include + CORS בשרת). */
function isCrossOriginApi() {
  const base = getApiBase();
  if (!base || typeof window === 'undefined') return false;
  try {
    const withScheme =
      base.startsWith('http://') || base.startsWith('https://') ? base : `http://${base}`;
    const apiOrigin = new URL(withScheme).origin;
    return apiOrigin !== window.location.origin;
  } catch {
    return false;
  }
}

function fetchCredentials() {
  return isCrossOriginApi() ? 'include' : 'same-origin';
}

/**
 * נתיב מלא ל־API או למדיה. אם כבר URL מלא — מחזיר כמו שהוא.
 */
export function apiUrl(path) {
  if (!path || path.startsWith('http://') || path.startsWith('https://')) return path;
  if (!path.startsWith('/')) return path;
  const base = getApiBase();
  return base ? base + path : path;
}

function parseErrorDetail(res, payload, status) {
  const rawDetail = (payload && typeof payload === 'object') ? payload.detail : null;
  let detail;
  if (typeof rawDetail === 'string') detail = rawDetail;
  else if (Array.isArray(rawDetail)) {
    detail = rawDetail.map(formatValidationError).join(' · ');
  } else if (rawDetail && typeof rawDetail === 'object') detail = JSON.stringify(rawDetail);
  else if (status === 404 && typeof payload === 'string' && /not\s*found/i.test(payload.slice(0, 800))) {
    detail = 'לא נמצא שרת API בכתובת הזו. פתחו את האפליקציה דרך אותו שרת של ה־Python (למשל http://127.0.0.1:8765/board), או הגדירו window.STARS_API_BASE לכתובת השרת.';
  } else detail = res.statusText || `שגיאה ${status}`;
  return detail;
}

async function request(method, path, body) {
  const url = apiUrl(path);
  const opts = {
    method,
    credentials: fetchCredentials(),
    headers: { 'Accept': 'application/json' },
  };
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(url, opts);
  if (res.status === 204) return null;
  const text = await res.text();
  let payload = null;
  if (text) {
    try { payload = JSON.parse(text); }
    catch { payload = text; }
  }
  if (!res.ok) {
    throw new ApiError(res.status, parseErrorDetail(res, payload, res.status), payload);
  }
  return payload;
}

async function requestMultipart(method, path, formData) {
  const url = apiUrl(path);
  const res = await fetch(url, {
    method,
    credentials: fetchCredentials(),
    body: formData,
    headers: { Accept: 'application/json' },
  });
  const text = await res.text();
  let payload = null;
  if (text) {
    try { payload = JSON.parse(text); }
    catch { payload = text; }
  }
  if (!res.ok) {
    throw new ApiError(res.status, parseErrorDetail(res, payload, res.status), payload);
  }
  return payload;
}

const FIELD_HE = {
  family_name: 'שם משפחה',
  admin_username: 'שם משתמש',
  admin_display_name: 'שם להצגה',
  admin_password: 'סיסמה',
  username: 'שם משתמש',
  password: 'סיסמה',
  display_name: 'שם להצגה',
  name: 'שם',
  cost_stars: 'מחיר בכוכבים',
  delta: 'שינוי',
  family_id: 'משפחה',
  role: 'תפקיד',
};

function formatValidationError(e) {
  const field = Array.isArray(e.loc) ? e.loc.filter(p => p !== 'body').join('.') : '';
  const fieldHe = FIELD_HE[field] || field;
  let msg = e.msg || '';
  const ctx = e.ctx || {};
  if (e.type === 'string_too_short') msg = `חייב להכיל לפחות ${ctx.min_length} תווים`;
  else if (e.type === 'string_too_long') msg = `מקסימום ${ctx.max_length} תווים`;
  else if (e.type === 'missing') msg = 'שדה חובה';
  else if (e.type === 'string_pattern_mismatch') msg = 'תווים לא חוקיים';
  else if (e.type === 'int_parsing' || e.type === 'int_type') msg = 'חייב להיות מספר';
  else if (e.type === 'value_error') msg = (e.msg || 'ערך לא תקין').replace(/^value error,?\s*/i, '');
  return fieldHe ? `${fieldHe}: ${msg}` : msg;
}

export const api = {
  ApiError,
  // Auth
  me: () => request('GET', '/api/auth/me'),
  login: (family_id, username, password) =>
    request('POST', '/api/auth/login', { family_id, username, password }),
  register: (payload) => request('POST', '/api/auth/register', payload),
  logout: () => request('POST', '/api/auth/logout'),
  listFamilies: () => request('GET', '/api/auth/families/lookup'),

  // Users
  listUsers: () => request('GET', '/api/users'),
  createUser: (payload) => request('POST', '/api/users', payload),
  updateUser: (id, payload) => request('PATCH', `/api/users/${id}`, payload),
  deleteUser: (id) => request('DELETE', `/api/users/${id}`),

  // Children
  listChildren: () => request('GET', '/api/children'),
  createChild: (name) => request('POST', '/api/children', { name }),
  updateChild: (id, payload) => request('PATCH', `/api/children/${id}`, payload),
  deleteChild: (id) => request('DELETE', `/api/children/${id}`),
  uploadChildPhoto: (childId, file) => {
    const fd = new FormData();
    fd.append('file', file);
    return requestMultipart('POST', `/api/children/${childId}/photo`, fd);
  },
  deleteChildPhoto: (childId) => request('DELETE', `/api/children/${childId}/photo`),

  // Prizes
  listPrizes: () => request('GET', '/api/prizes'),
  createPrize: (name, costStars) => request('POST', '/api/prizes', { name, cost_stars: costStars }),
  updatePrize: (id, payload) => request('PATCH', `/api/prizes/${id}`, payload),
  deletePrize: (id) => request('DELETE', `/api/prizes/${id}`),
  redeemPrize: (prizeId, childId) =>
    request('POST', `/api/prizes/${prizeId}/redeem`, { child_id: childId }),
  listRedemptions: (limit = 40) =>
    request('GET', `/api/prizes/redemptions?limit=${limit}`),

  // Stars
  changeStars: (childId, delta, reason) =>
    request('POST', `/api/children/${childId}/stars`, { delta, reason: reason || null }),
  listEvents: (childId, limit = 50) =>
    request('GET', `/api/children/${childId}/events?limit=${limit}`),
  weekReset: () => request('POST', '/api/week-reset', { confirm: true }),
};

export function isAdmin(user) { return user && user.role === 'admin'; }
export function isParent(user) { return user && user.role === 'parent'; }
export function isChild(user) { return user && user.role === 'child'; }
export function canEditStars(user) { return isAdmin(user) || isParent(user); }
export function canManageUsers(user) { return isAdmin(user); }

export function roleLabel(role) {
  if (role === 'admin') return 'מנהל';
  if (role === 'parent') return 'הורה';
  if (role === 'child') return 'ילד/ה';
  return role;
}
