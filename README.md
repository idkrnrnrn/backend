# HR Cloud-Native Platform

Production-oriented skeleton of a high-load HR platform with modular microservices in Python.

## Services

- `hr-core`: HR auth, vacancies + applications lifecycle, candidate screening orchestration.
- `llm-screening`: AI service that returns clarifying questions and initial scoring.

## Quick start

```bash
docker compose up --build
```

Then open:

- HR Core API: http://localhost:8888/docs
- LLM Screening API: http://localhost:8001/docs

## Authentication

1. Register HR via `POST /api/v1/auth/register` with:
- `email`
- `login`
- `password`
- `invite_code`
2. Login via `POST /api/v1/auth/login`.
3. JWT is stored in HttpOnly cookie `hr_access_token`.
4. Access to all platform endpoints is allowed only after login.

Default invite code (for local): `HR-INVITE-2026`.

## Main flow

1. HR creates vacancy in `hr-core`.
2. Candidate submits application with resume text.
3. `hr-core` calls `llm-screening`.
4. Candidate receives clarifying questions (stubbed notifier), application gets score/reasons/risks.
5. HR tracks application stage (`chat_not_joined`, `questions_unanswered`, `in_review`, etc.).
