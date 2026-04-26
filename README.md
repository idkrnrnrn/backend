# HR Cloud-Native Platform

Production-oriented skeleton of a high-load HR platform in TypeScript.

## Services

- `hr-core`: HR auth, vacancies + applications lifecycle, candidate screening orchestration.

The LLM screening service is external to this repository. `hr-core` calls it through `HR_LLM_BASE_URL`.
For local non-Docker runs the default is `http://127.0.0.1:3000`.
For Docker Compose we point to `http://host.docker.internal:3000`, because `127.0.0.1` inside the container is the container itself.

## Quick start

```bash
docker compose up --build
```

Then open:

- HR Core API: http://localhost:8888/docs

## Authentication

1. Register HR via `POST /api/v1/auth/register` with:
- `email`
- `login`
- `password`
- `invite_code`
2. Registration immediately stores JWT in HttpOnly cookie `hr_access_token`.
3. You can also login later via `POST /api/v1/auth/login`.
4. Access to all platform endpoints is allowed only after login.

Default invite code (for local): `HR-INVITE-2026`.

Data is persisted in PostgreSQL. In Docker Compose the database is mounted to a named volume, so users, vacancies, and applications survive container restarts.

## Demo data

`hr-core` starts with preloaded demo data in PostgreSQL:

- Vacancies:
	- `11111111-1111-4111-8111-111111111111` (Старший Python-разработчик)
	- `22222222-2222-4222-8222-222222222222` (Фронтенд-разработчик)
	- `33333333-3333-4333-8333-333333333333` (DevOps-инженер)
- Applications:
	- `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa`
	- `bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb`
	- `cccccccc-cccc-4ccc-8ccc-cccccccccccc`

These records are inserted on first database initialization and persist in PostgreSQL between restarts.

## Main flow

1. HR creates vacancy in `hr-core`.
2. Candidate submits application with resume text.
3. `hr-core` calls `POST /api/prepare-screening` on the external LLM service with vacancy + resume text.
4. The LLM returns structured `profile` and `questions[]`; `hr-core` stores both inside the application.
5. After candidate answers clarifying questions, `hr-core` calls `POST /api/rank-candidate` and updates score/reasons/risks.
6. HR tracks application stage (`chat_not_joined`, `questions_unanswered`, `in_review`, etc.).

## Tests

```bash
cd services/hr-core
npm install
npm test
```
