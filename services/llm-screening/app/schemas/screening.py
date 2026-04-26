from pydantic import BaseModel, Field


class ScreeningRequest(BaseModel):
    resume_text: str = Field(min_length=100)
    mandatory_requirements: list[str] = Field(default_factory=list)
    optional_requirements: list[str] = Field(default_factory=list)


class ScreeningResponse(BaseModel):
    clarifying_questions: list[str]
    score: float
    score_reasons: list[str]
    risks_to_clarify: list[str]
