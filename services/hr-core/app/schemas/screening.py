from pydantic import BaseModel


class ScreeningRequest(BaseModel):
    resume_text: str
    mandatory_requirements: list[str]
    optional_requirements: list[str]


class ScreeningResult(BaseModel):
    clarifying_questions: list[str]
    score: float
    score_reasons: list[str]
    risks_to_clarify: list[str]
