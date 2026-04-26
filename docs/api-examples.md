# API examples

## Register HR

```bash
curl -i -X POST http://localhost:8888/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "hr@example.com",
    "login": "hr_lead",
    "password": "StrongPass123",
    "invite_code": "HR-INVITE-2026"
  }'
```

Registration response already sets `hr_access_token` cookie.

## Login HR (JWT cookie)

```bash
curl -i -X POST http://localhost:8888/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "hr@example.com",
    "password": "StrongPass123"
  }'
```

## Create vacancy (requires auth cookie)

```bash
curl -X POST http://localhost:8888/api/v1/vacancies \
  -H "Content-Type: application/json" \
  -H "Cookie: hr_access_token=<JWT>" \
  -d '{
    "title": "Senior Python Engineer",
    "location": "Remote, EU",
    "role": "Backend",
    "mandatory_requirements": ["Python", "FastAPI", "PostgreSQL"],
    "optional_requirements": ["Kubernetes", "Kafka", "English B2"],
    "work_schedule": "Full-time",
    "salary_format": "Gross, EUR",
    "candidate_tone": "zoomer",
    "apply_url": "https://jobs.example.com/python-senior"
  }'
```

## Create application

```bash
curl -X POST http://localhost:8888/api/v1/applications \
  -H "Content-Type: application/json" \
  -H "Cookie: hr_access_token=<JWT>" \
  -d '{
    "vacancy_id": "<VACANCY_ID>",
    "candidate_email": "candidate@example.com",
    "resume_text": "I have 5 years of Python backend experience. Built high-load APIs with FastAPI and PostgreSQL, worked on async processing, Docker and Kubernetes, and improved p95 latency by 35% in production."
  }'
```

Response includes:

- `stage`
- `clarifying_questions[]`
- `score`
- `score_reasons[]`
- `risks_to_clarify[]`

## List preloaded vacancies

```bash
curl -X GET "http://localhost:8888/api/v1/vacancies?limit=10&offset=0" \
  -H "Cookie: hr_access_token=<JWT>"
```

Preloaded vacancy IDs:

- `11111111-1111-4111-8111-111111111111`
- `22222222-2222-4222-8222-222222222222`
- `33333333-3333-4333-8333-333333333333`

## Get preloaded application by ID

```bash
curl -X GET http://localhost:8888/api/v1/applications/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa \
  -H "Cookie: hr_access_token=<JWT>"
```

Other preloaded application IDs:

- `bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb`
- `cccccccc-cccc-4ccc-8ccc-cccccccccccc`

## Submit answers to clarifying questions

```bash
curl -X PATCH http://localhost:8888/api/v1/applications/<APPLICATION_ID>/answers \
  -H "Content-Type: application/json" \
  -H "Cookie: hr_access_token=<JWT>" \
  -d '{
    "answers": {
      "Опишите ваш практический опыт с требованием: FastAPI.": "2+ years, designed APIs and auth.",
      "Какой у вас уровень английского и опыт коммуникации в международной команде?": "Upper-Intermediate, daily standups."
    }
  }'
```

## Update application stage manually

```bash
curl -X PATCH http://localhost:8888/api/v1/applications/<APPLICATION_ID>/stage \
  -H "Content-Type: application/json" \
  -H "Cookie: hr_access_token=<JWT>" \
  -d '{
    "stage": "chat_not_joined"
  }'
```

Available stages:

- `new`
- `questions_sent`
- `chat_not_joined`
- `questions_unanswered`
- `in_review`
- `interview`
- `rejected`
- `hired`
