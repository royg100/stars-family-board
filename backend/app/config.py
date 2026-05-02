from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent
PROJECT_DIR = BACKEND_DIR.parent
FRONTEND_DIR = PROJECT_DIR / "frontend"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BACKEND_DIR / ".env", env_prefix="STARS_", extra="ignore")

    secret_key: str = "change-me-in-production-please-use-a-long-random-string"
    database_url: str = f"sqlite:///{BACKEND_DIR / 'stars.db'}"
    uploads_dir: Path = BACKEND_DIR / "uploads"
    max_child_photo_bytes: int = 2_000_000
    session_cookie_name: str = "stars_session"
    session_max_age_days: int = 30
    cookie_secure: bool = False
    host: str = "0.0.0.0"
    port: int = 8765
    # Comma-separated browser origins allowed to call the API with cookies (e.g. Netlify URL).
    cors_allow_origins: str = ""


settings = Settings()
