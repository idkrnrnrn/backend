from fastapi import APIRouter

from app.schemas.screening import ScreeningRequest, ScreeningResponse
from app.services.screening_engine import ScreeningEngine

router = APIRouter(prefix="/v1")
engine = ScreeningEngine()


@router.post("/screen", response_model=ScreeningResponse)
def screen(payload: ScreeningRequest) -> ScreeningResponse:
    return engine.run(payload)
