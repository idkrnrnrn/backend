# API examples

## Create vacancy

```bash
curl -X POST http://localhost:8888/api/v1/vacancies \
  -H "Content-Type: application/json" \
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

## Submit answers to clarifying questions

```bash
curl -X PATCH http://localhost:8888/api/v1/applications/<APPLICATION_ID>/answers \
  -H "Content-Type: application/json" \
  -d '{
    "answers": {
      "Опишите ваш практический опыт с требованием: FastAPI.": "2+ years, designed APIs and auth.",
      "Какой у вас уровень английского и опыт коммуникации в международной команде?": "Upper-Intermediate, daily standups."
    }
  }'
```
