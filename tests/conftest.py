import importlib
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

ROOT_DIR = Path(__file__).resolve().parents[1]
HR_CORE_DIR = ROOT_DIR / "services" / "hr-core"


def _purge_app_modules() -> None:
    for mod_name in list(sys.modules):
        if mod_name == "app" or mod_name.startswith("app."):
            del sys.modules[mod_name]


def _import_service_module(service_dir: Path, module_name: str):
    _purge_app_modules()
    service_dir_str = str(service_dir)
    if service_dir_str in sys.path:
        sys.path.remove(service_dir_str)
    sys.path.insert(0, service_dir_str)
    return importlib.import_module(module_name)


@pytest.fixture
def hr_client(tmp_path, monkeypatch):
    db_path = tmp_path / "hr_test.db"

    monkeypatch.setenv("HR_DATABASE_URL", f"sqlite:///{db_path}")
    monkeypatch.setenv("HR_INVITE_CODE", "TEST-INVITE-CODE")
    monkeypatch.setenv("HR_JWT_SECRET", "test-jwt-secret")
    monkeypatch.setenv("HR_COOKIE_SECURE", "false")

    main_module = _import_service_module(HR_CORE_DIR, "app.main")
    application_service_module = importlib.import_module("app.services.application_service")

    def _fake_screen_resume(self, payload):
        _ = payload
        return SimpleNamespace(
            clarifying_questions=[
                "Расскажите про ваш последний high-load проект.",
                "Как вы валидируете требования перед релизом?",
            ],
            score=78.5,
            score_reasons=["Хороший опыт Python", "Есть опыт production эксплуатации"],
            risks_to_clarify=["Проверить опыт с Kafka"],
        )

    monkeypatch.setattr(application_service_module.LLMClient, "screen_resume", _fake_screen_resume)

    with TestClient(main_module.app) as client:
        yield client
