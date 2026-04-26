from fastapi import FastAPI

from app.api.routes import router

app = FastAPI(title="LLM Screening", version="0.1.0")
app.include_router(router)


@app.get("/health/live")
def live() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/health/ready")
def ready() -> dict[str, str]:
    return {"status": "ready"}
