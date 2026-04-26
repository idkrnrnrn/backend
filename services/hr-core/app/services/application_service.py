from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.application import Application, ApplicationStage
from app.models.vacancy import Vacancy
from app.schemas.application import ApplicationCreate
from app.schemas.screening import ScreeningRequest
from app.services.llm_client import LLMClient
from app.services.notifier import send_clarifying_questions


class ApplicationService:
    def __init__(self, llm_client: LLMClient | None = None) -> None:
        self.llm_client = llm_client or LLMClient()

    def create_application(self, db: Session, payload: ApplicationCreate) -> Application:
        vacancy = db.get(Vacancy, payload.vacancy_id)
        if vacancy is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vacancy not found")

        application = Application(
            vacancy_id=payload.vacancy_id,
            candidate_email=str(payload.candidate_email),
            resume_text=payload.resume_text,
            stage=ApplicationStage.NEW.value,
        )
        db.add(application)
        db.flush()

        screening = self.llm_client.screen_resume(
            ScreeningRequest(
                resume_text=payload.resume_text,
                mandatory_requirements=vacancy.mandatory_requirements,
                optional_requirements=vacancy.optional_requirements,
            )
        )

        application.clarifying_questions = screening.clarifying_questions
        application.score = screening.score
        application.score_reasons = screening.score_reasons
        application.risks_to_clarify = screening.risks_to_clarify
        application.stage = ApplicationStage.QUESTIONS_SENT.value

        send_clarifying_questions(str(payload.candidate_email), screening.clarifying_questions)

        db.commit()
        db.refresh(application)
        return application
