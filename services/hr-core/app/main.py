from fastapi import FastAPI

from app.api.routes import auth_router, router
from app.db.session import create_db

app = FastAPI(title="HR Core", version="0.2.0")
app.include_router(auth_router, prefix="/api/v1")
app.include_router(router, prefix="/api/v1")


@app.on_event("startup")
def on_startup() -> None:
    create_db()


@app.get("/health/live")
def live() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/health/ready")
def ready() -> dict[str, str]:
    return {"status": "ready"}
