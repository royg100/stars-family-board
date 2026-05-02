from collections.abc import Iterator

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import settings

connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
engine = create_engine(settings.database_url, connect_args=connect_args, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db() -> Iterator[Session]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _migrate_sqlite_columns() -> None:
    if not settings.database_url.startswith("sqlite"):
        return
    insp = inspect(engine)
    if not insp.has_table("children"):
        return
    cols = {c["name"] for c in insp.get_columns("children")}
    with engine.begin() as conn:
        if "photo_filename" not in cols:
            conn.execute(text("ALTER TABLE children ADD COLUMN photo_filename VARCHAR(255)"))


def init_db() -> None:
    from . import models  # noqa: F401  ensure models are imported
    Base.metadata.create_all(bind=engine)
    _migrate_sqlite_columns()
    settings.uploads_dir.mkdir(parents=True, exist_ok=True)
    (settings.uploads_dir / "children").mkdir(parents=True, exist_ok=True)
