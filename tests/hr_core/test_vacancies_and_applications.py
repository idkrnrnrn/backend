def register_and_login(client, idx: int) -> None:
    email = f"hr{idx}@example.com"
    login = f"hr_{idx}"
    password = "StrongPass123"

    reg = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "login": login,
            "password": password,
            "invite_code": "TEST-INVITE-CODE",
        },
    )
    assert reg.status_code == 201

    auth = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert auth.status_code == 200


def create_vacancy_payload():
    return {
        "title": "Senior Python Engineer",
        "location": "Remote, EU",
        "role": "Backend",
        "mandatory_requirements": ["Python", "FastAPI", "PostgreSQL"],
        "optional_requirements": ["Kubernetes", "Kafka", "English B2"],
        "work_schedule": "Full-time",
        "salary_format": "Gross, EUR",
        "candidate_tone": "zoomer",
        "apply_url": "https://jobs.example.com/python-senior",
    }


def test_any_authenticated_hr_can_see_all_vacancies(hr_client):
    register_and_login(hr_client, 1)

    created = hr_client.post("/api/v1/vacancies", json=create_vacancy_payload())
    assert created.status_code == 201
    vacancy_id = created.json()["id"]

    hr_client.post("/api/v1/auth/logout")

    register_and_login(hr_client, 2)

    listed = hr_client.get("/api/v1/vacancies")
    assert listed.status_code == 200
    assert any(v["id"] == vacancy_id for v in listed.json())

    fetched = hr_client.get(f"/api/v1/vacancies/{vacancy_id}")
    assert fetched.status_code == 200
    assert fetched.json()["title"] == "Senior Python Engineer"


def test_application_flow_with_scoring_answers_and_stage_updates(hr_client):
    register_and_login(hr_client, 3)

    vacancy = hr_client.post("/api/v1/vacancies", json=create_vacancy_payload())
    assert vacancy.status_code == 201
    vacancy_id = vacancy.json()["id"]

    resume_text = (
        "I have 5 years of Python backend experience. "
        "Built APIs with FastAPI and PostgreSQL, used Docker and Kubernetes in production, "
        "and optimized p95 latency by 30% across services."
    )

    app_create = hr_client.post(
        "/api/v1/applications",
        json={
            "vacancy_id": vacancy_id,
            "candidate_email": "candidate@example.com",
            "resume_text": resume_text,
        },
    )
    assert app_create.status_code == 201

    app_data = app_create.json()
    app_id = app_data["id"]

    assert app_data["stage"] == "questions_sent"
    assert app_data["score"] == 78.5
    assert len(app_data["clarifying_questions"]) >= 1
    assert len(app_data["score_reasons"]) >= 1
    assert len(app_data["risks_to_clarify"]) >= 1

    answers_update = hr_client.patch(
        f"/api/v1/applications/{app_id}/answers",
        json={"answers": {"q1": "answer1", "q2": "answer2"}},
    )
    assert answers_update.status_code == 200
    assert answers_update.json()["stage"] == "in_review"
    assert answers_update.json()["answers"]["q1"] == "answer1"

    stage_update = hr_client.patch(
        f"/api/v1/applications/{app_id}/stage",
        json={"stage": "chat_not_joined"},
    )
    assert stage_update.status_code == 200
    assert stage_update.json()["stage"] == "chat_not_joined"

    stage_update_2 = hr_client.patch(
        f"/api/v1/applications/{app_id}/stage",
        json={"stage": "questions_unanswered"},
    )
    assert stage_update_2.status_code == 200
    assert stage_update_2.json()["stage"] == "questions_unanswered"


def test_application_creation_fails_for_unknown_vacancy(hr_client):
    register_and_login(hr_client, 4)

    response = hr_client.post(
        "/api/v1/applications",
        json={
            "vacancy_id": "00000000-0000-0000-0000-000000000000",
            "candidate_email": "candidate@example.com",
            "resume_text": "Python " * 30,
        },
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Vacancy not found"
