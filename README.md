# HR Cloud-Native Platform

Production-oriented skeleton of a high-load HR platform with modular microservices in Python.

## Services

- `hr-core`: vacancies + applications lifecycle, candidate screening orchestration.
- `llm-screening`: AI service that returns clarifying questions and initial scoring.

## Quick start

```bash
docker compose up --build
```

Then open:

- HR Core API: http://localhost:8000/docs
- LLM Screening API: http://localhost:8001/docs

## Main flow

1. HR creates vacancy in `hr-core`.
2. Candidate submits application with resume text.
3. `hr-core` calls `llm-screening`.
4. Candidate receives clarifying questions (stubbed notifier), application gets score/reasons/risks.
