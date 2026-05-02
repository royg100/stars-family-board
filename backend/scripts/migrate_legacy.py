"""
Import data from the legacy stars_data.json file into the new SQLite database.

Usage:
    python -m scripts.migrate_legacy --family-name "משפחה" --admin-username admin --admin-password "סיסמה"
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.db import SessionLocal, init_db  # noqa: E402
from app.models import Child, Family, Role, User  # noqa: E402
from app.security import hash_password  # noqa: E402

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
LEGACY_FILE = PROJECT_ROOT / "legacy" / "stars_data.json"


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--family-name", default="משפחה")
    p.add_argument("--admin-username", default="admin")
    p.add_argument("--admin-display-name", default="מנהל")
    p.add_argument("--admin-password", required=True)
    p.add_argument("--source", default=str(LEGACY_FILE))
    args = p.parse_args()

    src = Path(args.source)
    legacy: dict[str, int] = {}
    if src.is_file():
        try:
            raw = json.loads(src.read_text(encoding="utf-8"))
            legacy = {str(k): int(v) for k, v in raw.items()}
            print(f"Loaded {len(legacy)} kids from {src}")
        except (json.JSONDecodeError, ValueError) as e:
            print(f"Could not read legacy file: {e}", file=sys.stderr)
    else:
        print(f"No legacy file at {src} — creating empty family.")

    init_db()
    db = SessionLocal()
    try:
        family = Family(name=args.family_name)
        db.add(family)
        db.flush()

        admin = User(
            family_id=family.id,
            username=args.admin_username,
            display_name=args.admin_display_name,
            password_hash=hash_password(args.admin_password),
            role=Role.admin,
        )
        db.add(admin)

        for name, stars in legacy.items():
            db.add(Child(family_id=family.id, name=name, stars=max(0, stars)))

        db.commit()
        print(f"Created family id={family.id} '{family.name}' with admin '{admin.username}' and {len(legacy)} children.")
        return 0
    except Exception as e:
        db.rollback()
        print(f"Migration failed: {e}", file=sys.stderr)
        return 1
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
