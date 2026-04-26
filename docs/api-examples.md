# API examples

## Register HR

```bash
curl -i -X POST http://localhost:8888/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "hr@nl.ourelephant.ru",
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
    "email": "hr@nl.ourelephant.ru",
    "password": "StrongPass123"
  }'
```

## Create vacancy (requires auth cookie)

```bash
curl -X POST http://localhost:8888/api/v1/vacancies \
  -H "Content-Type: application/json" \
  -H "Cookie: hr_access_token=<JWT>" \
  -d '{
    "title": "Старший Python-разработчик",
    "description": "Ищем backend-инженера для развития высоконагруженной HR-платформы. Нужно проектировать API, оптимизировать производительность и участвовать в архитектурных решениях команды.",
    "location": "Удаленно, Россия",
    "role": "Бэкенд-разработка",
    "mandatory_requirements": ["Python", "FastAPI", "PostgreSQL"],
    "optional_requirements": ["Kubernetes", "Kafka", "Английский B2"],
    "work_schedule": "Полный день",
    "salary_format": "320 000-420 000 RUB/month",
    "candidate_tone": "zoomer",
    "apply_url": "https://nl.ourelephant.ru/jobs/python-senior"
  }'
```

## Create application

```bash
curl -X POST http://localhost:8888/api/v1/applications \
  -H "Content-Type: application/json" \
  -H "Cookie: hr_access_token=<JWT>" \
  -d '{
    "vacancy_id": "<VACANCY_ID>",
    "candidate_email": "candidate@nl.ourelephant.ru",
    "resume_text": "У меня 5 лет опыта в Python backend-разработке. Делал high-load API на FastAPI и PostgreSQL, работал с Docker и Kubernetes и снижал p95 latency в production."
  }'
```

Response includes:

- `stage`
- `candidate_profile`
- `clarifying_questions[]` with `id`, `text`, optional `signal/type/options`
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

## List all applications (candidates)

```bash
curl -X GET "http://localhost:8888/api/v1/applications?limit=10&offset=0" \
  -H "Cookie: hr_access_token=<JWT>"
```

## Get application by resume ID

```bash
curl -X GET http://localhost:8888/api/v1/applications/resumes/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa \
  -H "Cookie: hr_access_token=<JWT>"
```

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
