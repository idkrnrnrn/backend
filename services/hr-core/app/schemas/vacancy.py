from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field, HttpUrl

from app.models.vacancy import CandidateTone


class VacancyCreate(BaseModel):
    title: str = Field(min_length=2, max_length=255)
    location: str = Field(min_length=2, max_length=255)
    role: str = Field(min_length=2, max_length=255)
    mandatory_requirements: list[str] = Field(default_factory=list)
    optional_requirements: list[str] = Field(default_factory=list)
    work_schedule: str = Field(min_length=2, max_length=255)
    salary_format: str = Field(min_length=2, max_length=255)
    candidate_tone: CandidateTone
    apply_url: HttpUrl


class VacancyRead(BaseModel):
    id: UUID
    title: str
    location: str
    role: str
    mandatory_requirements: list[str]
    optional_requirements: list[str]
    work_schedule: str
    salary_format: str
    candidate_tone: CandidateTone
    apply_url: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
