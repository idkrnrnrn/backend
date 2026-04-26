from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class HRRegisterRequest(BaseModel):
    email: EmailStr
    login: str = Field(min_length=3, max_length=100)
    password: str = Field(min_length=8, max_length=128)
    invite_code: str = Field(min_length=4, max_length=128)


class HRLoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class HRUserRead(BaseModel):
    id: UUID
    email: EmailStr
    login: str
    created_at: datetime

    model_config = {"from_attributes": True}
