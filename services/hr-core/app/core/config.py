import os

DATABASE_URL = os.getenv("HR_DATABASE_URL", "sqlite:///./hr.db")
LLM_BASE_URL = os.getenv("HR_LLM_BASE_URL", "http://localhost:8001")
LLM_TIMEOUT_SECONDS = float(os.getenv("HR_LLM_TIMEOUT_SECONDS", "10"))

HR_INVITE_CODE = os.getenv("HR_INVITE_CODE", "HR-INVITE-2026")
JWT_SECRET = os.getenv("HR_JWT_SECRET", "change-me-in-production")
JWT_ALGORITHM = os.getenv("HR_JWT_ALGORITHM", "HS256")
JWT_EXPIRE_MINUTES = int(os.getenv("HR_JWT_EXPIRE_MINUTES", "120"))
COOKIE_SECURE = os.getenv("HR_COOKIE_SECURE", "false").lower() == "true"
