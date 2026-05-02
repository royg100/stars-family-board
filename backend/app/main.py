from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .config import FRONTEND_DIR, settings
from .db import init_db
from .routers import auth, children, prizes, stars, users


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


app = FastAPI(title="Stars Behavior Board", version="2.0.0", lifespan=lifespan)

_cors = [o.strip() for o in settings.cors_allow_origins.split(",") if o.strip()]
if _cors:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_cors,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(children.router)
app.include_router(prizes.router)
app.include_router(stars.router)


@app.get("/healthz")
def health() -> dict[str, str]:
    return {"status": "ok"}


if FRONTEND_DIR.is_dir():

    @app.get("/")
    def root() -> FileResponse:
        return FileResponse(FRONTEND_DIR / "login.html")

    @app.get("/login")
    @app.get("/login.html")
    def login_page() -> FileResponse:
        return FileResponse(FRONTEND_DIR / "login.html")

    @app.get("/board")
    @app.get("/index.html")
    def board_page() -> FileResponse:
        return FileResponse(FRONTEND_DIR / "index.html")

    @app.get("/admin")
    @app.get("/admin.html")
    def admin_page() -> FileResponse:
        return FileResponse(FRONTEND_DIR / "admin.html")


# Mounts last so they do not shadow API / HTML routes.
_children_media = settings.uploads_dir / "children"
_children_media.mkdir(parents=True, exist_ok=True)
app.mount("/media/children", StaticFiles(directory=_children_media), name="media_children")

if FRONTEND_DIR.is_dir():
    app.mount("/static", StaticFiles(directory=FRONTEND_DIR / "static"), name="static")


def run() -> None:
    import uvicorn

    uvicorn.run("app.main:app", host=settings.host, port=settings.port, reload=False)


if __name__ == "__main__":
    run()
