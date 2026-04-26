import httpx

from app.core.config import LLM_BASE_URL, LLM_TIMEOUT_SECONDS
from app.schemas.screening import ScreeningRequest, ScreeningResult


class LLMClient:
    def __init__(self, base_url: str = LLM_BASE_URL, timeout_seconds: float = LLM_TIMEOUT_SECONDS) -> None:
        self.base_url = base_url.rstrip("/")
        self.timeout_seconds = timeout_seconds

    def screen_resume(self, payload: ScreeningRequest) -> ScreeningResult:
        with httpx.Client(timeout=self.timeout_seconds) as client:
            response = client.post(f"{self.base_url}/v1/screen", json=payload.model_dump())
            response.raise_for_status()
            return ScreeningResult(**response.json())
