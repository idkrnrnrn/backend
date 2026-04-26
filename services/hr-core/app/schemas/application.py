from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field

from app.models.application import ApplicationStage


class ApplicationCreate(BaseModel):
    vacancy_id: UUID
    candidate_email: EmailStr
    resume_text: str = Field(min_length=100)


class ApplicationRead(BaseModel):
    id: UUID
    vacancy_id: UUID
    candidate_email: EmailStr
    stage: str
    resume_text: str
    answers: dict[str, str]
    clarifying_questions: list[str]
    score: float | None
    score_reasons: list[str]
    risks_to_clarify: list[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ApplicationAnswersUpdate(BaseModel):
    answers: dict[str, str]


class ApplicationStageUpdate(BaseModel):
    stage: ApplicationStage
