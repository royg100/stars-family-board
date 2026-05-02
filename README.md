# לוח הכוכבים ⭐

אפליקציית web לניהול לוח כוכבי התנהגות לילדים, עם backend ב-Python ו-frontend ב-HTML+JavaScript.

## מבנה הפרויקט

```
Stars/
├── backend/                  # FastAPI + SQLAlchemy + SQLite
│   ├── app/
│   │   ├── main.py           # נקודת כניסה, מסלולים, lifespan
│   │   ├── config.py         # הגדרות (env / .env)
│   │   ├── db.py             # engine, session, Base
│   │   ├── models.py         # Family, User, Child, StarEvent, AuditLog
│   │   ├── schemas.py        # Pydantic in/out
│   │   ├── security.py       # bcrypt + session tokens
│   │   ├── deps.py           # current_user / require_admin / require_roles
│   │   ├── audit.py          # רישום פעולות
│   │   └── routers/
│   │       ├── auth.py       # /api/auth/*
│   │       ├── users.py      # /api/users/*
│   │       ├── children.py   # /api/children/*
│   │       └── stars.py      # /api/children/{id}/stars, /api/week-reset
│   ├── scripts/
│   │   └── migrate_legacy.py # ייבוא מ-stars_data.json הישן
│   └── requirements.txt
├── frontend/
│   ├── login.html, index.html, admin.html
│   └── static/
│       ├── css/app.css
│       └── js/api.js, ui.js, login.js, board.js, admin.js
├── legacy/                   # הקוד הישן (tkinter, Flask, Netlify) — לארכיון
├── run.bat / run.sh          # הפעלה מהירה
└── README.md
```

## הפעלה

### 1. התקנת תלויות

```bash
cd backend
pip install -r requirements.txt
```

### 2. ייבוא נתונים מהגרסה הישנה (אופציונלי)

אם יש לכם קובץ `legacy/stars_data.json` עם ילדים מהאפליקציה הישנה:

```bash
cd backend
python -m scripts.migrate_legacy --family-name "משפחת כהן" --admin-password "סיסמה_חזקה"
```

זה יוצר משפחה, מנהל ראשי בשם `admin`, ומייבא את כל הילדים שהיו בקובץ הישן.

### 3. הפעלה

```bash
# Windows
run.bat

# macOS / Linux
./run.sh

# או ידנית
cd backend
python -m app.main
```

השרת יעלה על http://localhost:8765.

* אם אין משפחות במערכת — הדף הראשי יציג טופס יצירת משפחה ראשונה (היוצר הופך למנהל).
* אחרת — מסך התחברות.

### 4. הגדרות אופציונליות

יוצרים `backend/.env`:

```
STARS_SECRET_KEY=מחרוזת-אקראית-ארוכה-מאוד-לפרודקשן
STARS_DATABASE_URL=sqlite:///stars.db
STARS_PORT=8765
STARS_COOKIE_SECURE=false
```

לפרודקשן (HTTPS) — כדאי `STARS_COOKIE_SECURE=true` ו-`STARS_SECRET_KEY` חזק.

## תפקידים והרשאות

| תפקיד    | רואה ילדים | משנה כוכבים | מוסיף/מוחק ילדים | מנהל משתמשים |
|----------|-----------|-------------|------------------|---------------|
| `admin`  | ✓ הכל     | ✓           | ✓                | ✓             |
| `parent` | ✓ הכל     | ✓           | ✓                | ✗             |
| `child`  | רק את עצמו | ✗           | ✗                | ✗             |

* כל פעולה רגישה נרשמת ב-`audit_log`.
* שינוי כוכבים נשמר כ-`StarEvent` (היסטוריה מלאה זמינה דרך כפתור "היסטוריה" ליד כל ילד).
* "איפוס שבוע" מתעד רישום שלילי מתאים לכל ילד לפני האיפוס.
* לא ניתן למחוק את המנהל האחרון או להוריד אותו מהרשאת admin.

## API עיקרי

| Endpoint                            | Method | תיאור                                       |
|-------------------------------------|--------|---------------------------------------------|
| `/api/auth/register`                | POST   | יצירת משפחה ראשונה + מנהל                   |
| `/api/auth/login`                   | POST   | התחברות                                     |
| `/api/auth/logout`                  | POST   | יציאה                                       |
| `/api/auth/me`                      | GET    | פרטי משתמש מחובר                            |
| `/api/auth/families/lookup`         | GET    | רשימת משפחות (לבחירה במסך login)             |
| `/api/users`                        | GET    | משתמשי המשפחה                                |
| `/api/users`                        | POST   | יצירת משתמש (admin)                          |
| `/api/users/{id}`                   | PATCH  | עדכון משתמש                                  |
| `/api/users/{id}`                   | DELETE | מחיקה (admin)                                |
| `/api/children`                     | GET    | רשימת ילדים (מסונן לפי תפקיד)                |
| `/api/children`                     | POST   | הוספת ילד (parent/admin)                     |
| `/api/children/{id}`                | PATCH  | שינוי שם                                     |
| `/api/children/{id}`                | DELETE | מחיקה                                        |
| `/api/children/{id}/stars`          | POST   | `{delta, reason?}` — שינוי כוכבים            |
| `/api/children/{id}/events`         | GET    | היסטוריה                                     |
| `/api/week-reset`                   | POST   | `{confirm: true}` — איפוס שבועי              |

תיעוד אינטראקטיבי (Swagger UI) זמין ב-http://localhost:8765/docs.

## מה השתנה לעומת הגרסה הישנה

- **הסרה:** האפליקציה השולחנית עם tkinter (`stars_app.py`) — עברה ל-`legacy/`. ה-web עובד בכל דפדפן וגם נייד.
- **הסרה:** קובץ JSON משותף יחיד עם token גלובלי. הוחלף בנתוני SQLite + משתמשים אמיתיים.
- **הסרה:** משתמשים שמורים ב-localStorage בדפדפן. הם עכשיו ב-DB עם סיסמה מגובבת ב-bcrypt.
- **הוספה:** היסטוריית כוכבים, audit log, תפקידים/הרשאות, ניהול משתמשים, dashboard מוביל.

קבצי הגרסה הישנה נשמרו ב-`legacy/` ולא נמחקו.
