from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.application import Application
from app.models.application import ApplicationStage
from app.models.vacancy import Vacancy
from app.schemas.application import ApplicationAnswersUpdate, ApplicationCreate, ApplicationRead
from app.schemas.vacancy import VacancyCreate, VacancyRead
from app.services.application_service import ApplicationService

router = APIRouter()


@router.post("/vacancies", response_model=VacancyRead, status_code=status.HTTP_201_CREATED)
def create_vacancy(payload: VacancyCreate, db: Session = Depends(get_db)) -> Vacancy:
    vacancy = Vacancy(**payload.model_dump(), apply_url=str(payload.apply_url))
    db.add(vacancy)
    db.commit()
    db.refresh(vacancy)
    return vacancy


@router.get("/vacancies", response_model=list[VacancyRead])
def list_vacancies(
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> list[Vacancy]:
    return list(db.scalars(select(Vacancy).offset(offset).limit(limit)))


@router.get("/vacancies/{vacancy_id}", response_model=VacancyRead)
def get_vacancy(vacancy_id: UUID, db: Session = Depends(get_db)) -> Vacancy:
    vacancy = db.get(Vacancy, vacancy_id)
    if vacancy is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vacancy not found")
    return vacancy


@router.post("/applications", response_model=ApplicationRead, status_code=status.HTTP_201_CREATED)
def create_application(payload: ApplicationCreate, db: Session = Depends(get_db)) -> Application:
    service = ApplicationService()
    return service.create_application(db, payload)


@router.get("/applications/{application_id}", response_model=ApplicationRead)
def get_application(application_id: UUID, db: Session = Depends(get_db)) -> Application:
    application = db.get(Application, application_id)
    if application is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")
    return application


@router.patch("/applications/{application_id}/answers", response_model=ApplicationRead)
def update_application_answers(
    application_id: UUID,
    payload: ApplicationAnswersUpdate,
    db: Session = Depends(get_db),
) -> Application:
    application = db.get(Application, application_id)
    if application is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")

    application.answers = payload.answers
    application.stage = ApplicationStage.IN_REVIEW.value
    db.commit()
    db.refresh(application)
    return application
