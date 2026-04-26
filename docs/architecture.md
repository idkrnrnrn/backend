# Architecture (Staff/Principal level draft)

## Goals

- Millions of users
- Horizontal scalability
- High availability (multi-AZ)
- Fault tolerance and graceful degradation
- Modular architecture and bounded contexts
- AI/LLM integration for candidate screening

## Domain model

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
- `stage` (`new`, `questions_sent`, `in_review`, `interview`, `rejected`, `hired`)
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
2. **hr-core service** (implemented skeleton)
   - Vacancy catalog
   - Applications state machine
   - LLM orchestration trigger
3. **llm-screening service** (implemented skeleton)
   - Resume analysis
   - Clarifying questions generation
   - Initial score and risk reasons
4. **notification service** (future)
   - Email/SMS/Telegram dispatch with retries
5. **analytics service** (future)
   - Funnel, conversion, SLA, recruiter performance

## Data and reliability patterns

- PostgreSQL as source of truth (partitioning + read replicas)
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

- JWT/OIDC
- PII encryption at rest
- Secrets in Vault/KMS
- Audit trail for recruiter actions
- GDPR/152-FZ style retention policies configurable per tenant

## Observability

- OpenTelemetry traces, logs, metrics
- Correlation IDs across services
- RED + USE dashboards
- Alerting for queue lag, LLM timeout/error spikes, DB saturation

## API contracts (implemented)

- `POST /api/v1/vacancies`
- `GET /api/v1/vacancies`
- `GET /api/v1/vacancies/{vacancy_id}`
- `POST /api/v1/applications`
- `GET /api/v1/applications/{application_id}`
- `PATCH /api/v1/applications/{application_id}/answers`
