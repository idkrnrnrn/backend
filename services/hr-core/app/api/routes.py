from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import ACCESS_COOKIE_NAME, get_current_hr
from app.core.config import COOKIE_SECURE, JWT_EXPIRE_MINUTES
from app.core.security import create_access_token
from app.db.session import get_db
from app.models.application import Application, ApplicationStage
from app.models.hr_user import HRUser
from app.models.vacancy import Vacancy
from app.schemas.application import (
    ApplicationAnswersUpdate,
    ApplicationCreate,
    ApplicationRead,
    ApplicationStageUpdate,
)
from app.schemas.auth import HRLoginRequest, HRRegisterRequest, HRUserRead
from app.schemas.vacancy import VacancyCreate, VacancyRead
from app.services.application_service import ApplicationService
from app.services.auth_service import authenticate_hr, register_hr

auth_router = APIRouter(prefix="/auth", tags=["auth"])
router = APIRouter(tags=["platform"], dependencies=[Depends(get_current_hr)])


@auth_router.post("/register", response_model=HRUserRead, status_code=status.HTTP_201_CREATED)
def register(payload: HRRegisterRequest, db: Session = Depends(get_db)) -> HRUser:
    return register_hr(db, payload)


@auth_router.post("/login", response_model=HRUserRead)
def login(payload: HRLoginRequest, response: Response, db: Session = Depends(get_db)) -> HRUser:
    user = authenticate_hr(db, payload)
    token = create_access_token(user.id)
    response.set_cookie(
        key=ACCESS_COOKIE_NAME,
        value=token,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="lax",
        max_age=JWT_EXPIRE_MINUTES * 60,
    )
    return user


@auth_router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response) -> None:
    response.delete_cookie(key=ACCESS_COOKIE_NAME)


@auth_router.get("/me", response_model=HRUserRead)
def me(current_user: HRUser = Depends(get_current_hr)) -> HRUser:
    return current_user


@router.post("/vacancies", response_model=VacancyRead, status_code=status.HTTP_201_CREATED)
def create_vacancy(payload: VacancyCreate, db: Session = Depends(get_db)) -> Vacancy:
    vacancy_data = payload.model_dump()
    vacancy_data["apply_url"] = str(payload.apply_url)
    vacancy = Vacancy(**vacancy_data)
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


@router.patch("/applications/{application_id}/stage", response_model=ApplicationRead)
def update_application_stage(
    application_id: UUID,
    payload: ApplicationStageUpdate,
    db: Session = Depends(get_db),
) -> Application:
    application = db.get(Application, application_id)
    if application is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")

    application.stage = payload.stage.value
    db.commit()
    db.refresh(application)
    return application
