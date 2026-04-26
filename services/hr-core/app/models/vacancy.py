import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import DateTime, Enum, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import JSON

from app.db.session import Base


class CandidateTone(StrEnum):
    ZOOMER = "zoomer"
    BOOMER = "boomer"
    NEUTRAL = "neutral"


class Vacancy(Base):
    __tablename__ = "vacancies"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    location: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(255), nullable=False)
    mandatory_requirements: Mapped[list[str]] = mapped_column(JSON, nullable=False)
    optional_requirements: Mapped[list[str]] = mapped_column(JSON, nullable=False)
    work_schedule: Mapped[str] = mapped_column(String(255), nullable=False)
    salary_format: Mapped[str] = mapped_column(String(255), nullable=False)
    candidate_tone: Mapped[CandidateTone] = mapped_column(Enum(CandidateTone), nullable=False)
    apply_url: Mapped[str] = mapped_column(String(500), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
