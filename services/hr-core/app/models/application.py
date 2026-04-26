import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import DateTime, Float, ForeignKey, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import JSON

from app.db.session import Base


class ApplicationStage(StrEnum):
    NEW = "new"
    QUESTIONS_SENT = "questions_sent"
    CHAT_NOT_JOINED = "chat_not_joined"
    QUESTIONS_UNANSWERED = "questions_unanswered"
    IN_REVIEW = "in_review"
    INTERVIEW = "interview"
    REJECTED = "rejected"
    HIRED = "hired"


class Application(Base):
    __tablename__ = "applications"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vacancy_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("vacancies.id"), nullable=False)
    candidate_email: Mapped[str] = mapped_column(String(255), nullable=False)
    stage: Mapped[str] = mapped_column(String(50), default=ApplicationStage.NEW.value, nullable=False)
    resume_text: Mapped[str] = mapped_column(Text, nullable=False)
    answers: Mapped[dict[str, str]] = mapped_column(JSON, default=dict, nullable=False)
    clarifying_questions: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    score: Mapped[float | None] = mapped_column(Float, nullable=True)
    score_reasons: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    risks_to_clarify: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
