/**
 * Netlify build: writes frontend/_redirects + frontend/static/js/site-config.js
 *
 * אתר יעד: https://stars-family-board.netlify.app
 *
 * ב-Netlify → Site configuration → Environment variables:
 *
 * 1) מומלץ — פרוקסי (אותו מקור, עוגיות עובדות בלי CORS בדפדפן):
 *    STARS_BACKEND_URL = https://<הכתובת-הציבורית-של-שרת-Python>
 *    (בלי / בסוף; למשל https://stars-api.railway.app)
 *
 * 2) אם אין פרוקסי — הדפדפן קורא ישירות ל-API (צריך CORS בשרת, ראה backend/.env.example):
 *    STARS_PUBLIC_API_URL = https://<אותו-שרת-Python>
 *
 * בשרת Python (.env): STARS_CORS_ALLOW_ORIGINS=https://stars-family-board.netlify.app
 * ו־STARS_COOKIE_SECURE=true כשה-API ב-HTTPS.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const frontend = path.join(root, 'frontend');
const outRedirects = path.join(frontend, '_redirects');
const outSiteConfig = path.join(frontend, 'static', 'js', 'site-config.js');

const backend = (process.env.STARS_BACKEND_URL || '').trim().replace(/\/$/, '');
const publicApi = (process.env.STARS_PUBLIC_API_URL || '').trim().replace(/\/$/, '');

const lines = [];

if (backend) {
  lines.push('# Proxied to FastAPI (STARS_BACKEND_URL)');
  lines.push(`/api/* ${backend}/api/:splat 200`);
  lines.push(`/media/* ${backend}/media/:splat 200`);
  lines.push('');
}

// העתקות לתיקיות — Netlify מגיש קבצים אמיתיים ב־/login, /board, /admin (גם כש-rewrite נכשל)
function copyPage(srcFile, dirName) {
  const src = path.join(frontend, srcFile);
  const destDir = path.join(frontend, dirName);
  const dest = path.join(destDir, 'index.html');
  if (!fs.existsSync(src)) {
    // eslint-disable-next-line no-console
    console.warn(`[netlify] missing source file, skip: ${src}`);
    return;
  }
  fs.mkdirSync(destDir, { recursive: true });
  fs.copyFileSync(src, dest);
}

copyPage('login.html', 'login');
copyPage('index.html', 'board');
copyPage('admin.html', 'admin');

lines.push('# Friendly URLs — גם לקבצים בתיקיות (login/index.html וכו׳)');
lines.push('/login /login/index.html 200');
lines.push('/login/ /login/index.html 200');
lines.push('/board /board/index.html 200');
lines.push('/board/ /board/index.html 200');
lines.push('/admin /admin/index.html 200');
lines.push('/admin/ /admin/index.html 200');
lines.push('/ /login.html 200');

fs.mkdirSync(frontend, { recursive: true });
fs.writeFileSync(outRedirects, `${lines.join('\n')}\n`, 'utf8');

// פרוקסי = אותו דומיין Netlify; אין צורך בבסיס חיצוני ל-fetch
let apiBase = '';
if (!backend && publicApi) {
  apiBase = publicApi;
}

const cfg = `// נוצר אוטומטית ב-Netlify — אל תערוך ידנית בפריסה
window.STARS_API_BASE = ${JSON.stringify(apiBase)};
`;
fs.mkdirSync(path.dirname(outSiteConfig), { recursive: true });
fs.writeFileSync(outSiteConfig, cfg, 'utf8');

// eslint-disable-next-line no-console
console.log(
  `[netlify] _redirects → ${path.relative(root, outRedirects)}`,
  backend ? `proxy ${backend}` : '(הוסיפו STARS_BACKEND_URL)',
);
// eslint-disable-next-line no-console
console.log(
  `[netlify] site-config.js → STARS_API_BASE=${apiBase ? JSON.stringify(apiBase) : "'' (פרוקסי או ברירת מחדל)"}`,
);
// eslint-disable-next-line no-console
console.log('[netlify] copied login/, board/, admin/ index pages');
