import os

DATABASE_URL = os.getenv("HR_DATABASE_URL", "sqlite:///./hr.db")
LLM_BASE_URL = os.getenv("HR_LLM_BASE_URL", "http://localhost:8001")
LLM_TIMEOUT_SECONDS = float(os.getenv("HR_LLM_TIMEOUT_SECONDS", "10"))
