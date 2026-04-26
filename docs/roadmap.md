# Roadmap to production scale

1. Replace sync HTTP call to LLM with async pipeline:
- `application.created` -> Kafka
- screening worker consumes, writes result, emits `screening.completed`

2. Add outbox + idempotency keys:
- `idempotency_key` on `POST /applications`
- outbox relay for reliable event publication

3. Introduce notification service:
- email/chat channels
- retry + dead-letter queues

4. Strengthen data layer:
- PostgreSQL migrations (Alembic)
- read replicas for heavy recruiter dashboards
- partition `applications` by month/tenant

5. Security and enterprise:
- OIDC RBAC roles (`hr_admin`, `recruiter`, `hiring_manager`)
- encrypted PII fields
- immutable audit logs

6. SRE baseline:
- OpenTelemetry traces
- SLO alerting
- canary deployments + auto rollback
