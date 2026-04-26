# Architecture (Staff/Principal level draft)

## Goals

- Millions of users
- Horizontal scalability
- High availability (multi-AZ)
- Fault tolerance and graceful degradation
- Modular architecture and bounded contexts
- AI/LLM integration for candidate screening

## Domain model

### HRUser

- `id`
- `email`
- `login`
- `password_hash`
- `created_at`

### Vacancy

- `id`
- `title`
- `location`
- `role`
- `mandatory_requirements[]`
- `optional_requirements[]`
- `work_schedule`
- `salary_format`
- `candidate_tone` (`zoomer`, `boomer`, `neutral`)
- `apply_url`
- `created_at`, `updated_at`

### Application

- `id`
- `vacancy_id`
- `candidate_email`
- `stage` (`new`, `questions_sent`, `chat_not_joined`, `questions_unanswered`, `in_review`, `interview`, `rejected`, `hired`)
- `resume_text`
- `answers` (Q/A map)
- `score` (0-100)
- `score_reasons[]`
- `risks_to_clarify[]`
- `clarifying_questions[]`
- `created_at`, `updated_at`

## Service decomposition

1. **API Gateway / BFF**
- AuthN/AuthZ
- Rate limiting
- Request routing
2. **hr-core service** (implemented TypeScript skeleton)
- HR authentication
- Vacancy catalog (shared for all authenticated HR)
- Applications state machine
- LLM orchestration trigger
3. **llm-screening service** (external service, owned by another team)
- Resume analysis
- Clarifying questions generation
- Initial score and risk reasons
4. **notification service** (future)
- Email/SMS/Telegram dispatch with retries
5. **analytics service** (future)
- Funnel, conversion, SLA, recruiter performance

## Data and reliability patterns

- PostgreSQL as production source of truth (partitioning + read replicas)
- Redis for cache and short-lived state
- Kafka for async events (`application.created`, `screening.completed`)
- Outbox pattern for exactly-once-ish event publication
- Idempotency keys on critical write endpoints
- Retry with exponential backoff + DLQ for failed deliveries

## Scalability strategy

- Stateless services, autoscaling via HPA/KEDA
- Separate read/write workloads
- Per-tenant sharding option (enterprise mode)
- Async processing for expensive LLM and notifications
- Circuit breaker around LLM dependency

## HA / DR

- Multi-AZ deployment
- Rolling + canary deploys
- RPO/RTO targets with PITR backups
- Health probes (`/health/live`, `/health/ready`)
- SLO/SLI: p95 latency, error rate, screening turnaround time

## Security

- Login via `email + password`
- Registration controlled by invitation code
- JWT in HttpOnly cookie
- Mandatory auth for all platform endpoints
- PII encryption at rest
- Secrets in Vault/KMS
- Audit trail for recruiter actions

## Observability

- OpenTelemetry traces, logs, metrics
- Correlation IDs across services
- RED + USE dashboards
- Alerting for queue lag, LLM timeout/error spikes, DB saturation

## API contracts (implemented)

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`
- `POST /api/v1/vacancies`
- `GET /api/v1/vacancies`
- `GET /api/v1/vacancies/{vacancy_id}`
- `POST /api/v1/applications`
- `GET /api/v1/applications/{application_id}`
- `PATCH /api/v1/applications/{application_id}/answers`
- `PATCH /api/v1/applications/{application_id}/stage`
