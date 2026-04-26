from fastapi import HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.config import HR_INVITE_CODE
from app.core.security import hash_password, verify_password
from app.models.hr_user import HRUser
from app.schemas.auth import HRLoginRequest, HRRegisterRequest


def register_hr(db: Session, payload: HRRegisterRequest) -> HRUser:
    if payload.invite_code != HR_INVITE_CODE:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid invitation code")

    existing = db.scalar(
        select(HRUser).where(or_(HRUser.email == str(payload.email).lower(), HRUser.login == payload.login))
    )
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User with this email or login already exists")

    user = HRUser(
        email=str(payload.email).lower(),
        login=payload.login,
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def authenticate_hr(db: Session, payload: HRLoginRequest) -> HRUser:
    email = str(payload.email).lower()
    user = db.scalar(select(HRUser).where(HRUser.email == email))
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    return user
