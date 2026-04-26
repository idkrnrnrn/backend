from sqlalchemy import create_engine
from sqlalchemy.orm import Session, declarative_base, sessionmaker

from app.core.config import DATABASE_URL

Base = declarative_base()

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)


def create_db() -> None:
    from app.models.application import Application  # noqa: F401
    from app.models.vacancy import Vacancy  # noqa: F401

    Base.metadata.create_all(bind=engine)


def get_db():
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()
