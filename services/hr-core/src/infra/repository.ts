import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import type { Application, HRUser, Vacancy } from "../domain/types.js";

export interface Repository {
  initialize(): Promise<void>;
  createUser(input: Omit<HRUser, "id" | "createdAt">): Promise<HRUser>;
  findUserById(id: string): Promise<HRUser | null>;
  findUserByEmail(email: string): Promise<HRUser | null>;
  findUserByLogin(login: string): Promise<HRUser | null>;
  createVacancy(input: Omit<Vacancy, "id" | "createdAt" | "updatedAt">): Promise<Vacancy>;
  listVacancies(limit: number, offset: number): Promise<Vacancy[]>;
  findVacancyById(id: string): Promise<Vacancy | null>;
  createApplication(input: Omit<Application, "id" | "createdAt" | "updatedAt">): Promise<Application>;
  listApplications(limit: number, offset: number): Promise<Application[]>;
  findApplicationById(id: string): Promise<Application | null>;
  updateApplication(id: string, patch: Partial<Omit<Application, "id" | "createdAt">>): Promise<Application | null>;
}

const seededVacancies: Vacancy[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    title: "Старший Python-разработчик",
    description:
      "Ищем сильного backend-инженера в команду платформы. Нужно проектировать и развивать высоконагруженные сервисы на Python, улучшать производительность API и участвовать в технических решениях по архитектуре.",
    location: "Удаленно, Россия",
    role: "Бэкенд-разработка",
    mandatoryRequirements: ["Python", "FastAPI", "PostgreSQL"],
    optionalRequirements: ["Kubernetes", "Kafka", "Английский B2"],
    workSchedule: "Полный день",
    salaryFormat: "320 000-420 000 RUB/month",
    candidateTone: "zoomer",
    applyUrl: "https://nl.ourelephant.ru/jobs/python-senior",
    createdAt: "2026-01-10T08:00:00.000Z",
    updatedAt: "2026-01-10T08:00:00.000Z"
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    title: "Фронтенд-разработчик",
    description:
      "Нужен frontend-инженер, который поможет развивать кабинет HR и внутренние инструменты рекрутинга. Важно уметь делать аккуратные интерфейсы, держать качество кода и думать о скорости работы продукта.",
    location: "Москва, гибрид",
    role: "Фронтенд-разработка",
    mandatoryRequirements: ["TypeScript", "React", "Testing Library"],
    optionalRequirements: ["Next.js", "Дизайн-системы", "Storybook"],
    workSchedule: "Полный день",
    salaryFormat: "220 000-300 000 RUB/month",
    candidateTone: "neutral",
    applyUrl: "https://nl.ourelephant.ru/jobs/frontend-middle",
    createdAt: "2026-01-11T09:30:00.000Z",
    updatedAt: "2026-01-11T09:30:00.000Z"
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    title: "DevOps-инженер",
    description:
      "Ищем инженера инфраструктуры для развития CI/CD, Terraform-модулей и observability-платформы. Роль предполагает плотную работу с командами разработки и ответственность за надежность production-среды.",
    location: "Удаленно, Россия",
    role: "Инфраструктура",
    mandatoryRequirements: ["AWS", "Terraform", "CI/CD"],
    optionalRequirements: ["Kubernetes", "Prometheus", "Grafana"],
    workSchedule: "Гибкий график",
    salaryFormat: "280 000-380 000 RUB/month",
    candidateTone: "boomer",
    applyUrl: "https://nl.ourelephant.ru/jobs/devops-engineer",
    createdAt: "2026-01-12T07:45:00.000Z",
    updatedAt: "2026-01-12T07:45:00.000Z"
  }
];

const seededApplications: Application[] = [
  {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    vacancyId: "11111111-1111-4111-8111-111111111111",
    candidateEmail: "alina.petrenko@nl.ourelephant.ru",
    stage: "in_review",
    resumeText:
      "Python backend-разработчик с 6 годами опыта в финтехе. Разрабатывала сервисы на FastAPI, оптимизировала запросы PostgreSQL и запускала асинхронные пайплайны обработки данных.",
    answers: {
      q1: "Вела миграцию с монолита на сервисную архитектуру без простоя.",
      q2: "Работала с Kubernetes в production около трех лет."
    },
    candidateProfile: {
      seniority: "senior",
      primary_stack: ["Python", "FastAPI", "PostgreSQL"]
    },
    clarifyingQuestions: [
      "Опишите ваш опыт с high-load API на FastAPI.",
      "Какие подходы к оптимизации PostgreSQL вы применяли?"
    ],
    score: 84,
    scoreReasons: ["Сильный backend-опыт", "Подтверждена работа с PostgreSQL"],
    risksToClarify: ["Уточнить уровень разговорного английского"],
    createdAt: "2026-01-13T10:00:00.000Z",
    updatedAt: "2026-01-14T12:15:00.000Z"
  },
  {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    vacancyId: "22222222-2222-4222-8222-222222222222",
    candidateEmail: "mark.richter@nl.ourelephant.ru",
    stage: "questions_sent",
    resumeText:
      "Frontend-разработчик с 4 годами опыта в React и TypeScript. Фокусируется на доступности, производительности и создании переиспользуемых UI-компонентов.",
    answers: {},
    candidateProfile: {
      seniority: "middle",
      primary_stack: ["TypeScript", "React"]
    },
    clarifyingQuestions: [
      "Расскажите о вашем опыте построения дизайн-систем.",
      "Какие метрики производительности вы обычно улучшаете?"
    ],
    score: 76,
    scoreReasons: ["Уверенный React/TypeScript профиль", "Хороший фокус на пользовательском опыте"],
    risksToClarify: ["Проверить практический опыт с Next.js"],
    createdAt: "2026-01-15T09:20:00.000Z",
    updatedAt: "2026-01-15T09:20:00.000Z"
  },
  {
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    vacancyId: "33333333-3333-4333-8333-333333333333",
    candidateEmail: "dmitry.sokolov@nl.ourelephant.ru",
    stage: "interview",
    resumeText:
      "DevOps-инженер с 8 годами опыта в AWS, Terraform и автоматизации CI/CD. Разворачивал стек наблюдаемости на Prometheus и Grafana и строил процессы эксплуатации production.",
    answers: {
      q1: "Собрал переиспользуемые Terraform-модули для 20+ команд.",
      q2: "Проектировал дашборды и алерты для инцидент-менеджмента."
    },
    candidateProfile: {
      seniority: "senior",
      primary_stack: ["AWS", "Terraform", "CI/CD"]
    },
    clarifyingQuestions: [
      "Как вы проектировали процессы релизов в CI/CD?",
      "Какие практики SRE применяли в продакшене?"
    ],
    score: 89,
    scoreReasons: ["Сильный DevOps/SRE опыт", "Хорошая экспертиза в observability"],
    risksToClarify: ["Проверить готовность к ночным on-call сменам"],
    createdAt: "2026-01-16T11:05:00.000Z",
    updatedAt: "2026-01-17T14:30:00.000Z"
  }
];

export class InMemoryRepository implements Repository {
  private users = new Map<string, HRUser>();
  private vacancies = new Map<string, Vacancy>();
  private applications = new Map<string, Application>();

  constructor(options: { seedDemoData?: boolean } = {}) {
    if (options.seedDemoData ?? true) {
      this.seedDemoData();
    }
  }

  async initialize(): Promise<void> {}

  private seedDemoData() {
    for (const vacancy of seededVacancies) {
      this.vacancies.set(vacancy.id, vacancy);
    }
    for (const application of seededApplications) {
      this.applications.set(application.id, application);
    }
  }

  async createUser(input: Omit<HRUser, "id" | "createdAt">): Promise<HRUser> {
    const user: HRUser = {
      ...input,
      id: randomUUID(),
      createdAt: new Date().toISOString()
    };
    this.users.set(user.id, user);
    return user;
  }

  async findUserById(id: string): Promise<HRUser | null> {
    return this.users.get(id) ?? null;
  }

  async findUserByEmail(email: string): Promise<HRUser | null> {
    return [...this.users.values()].find((user) => user.email === email) ?? null;
  }

  async findUserByLogin(login: string): Promise<HRUser | null> {
    return [...this.users.values()].find((user) => user.login === login) ?? null;
  }

  async createVacancy(input: Omit<Vacancy, "id" | "createdAt" | "updatedAt">): Promise<Vacancy> {
    const now = new Date().toISOString();
    const vacancy: Vacancy = {
      ...input,
      id: randomUUID(),
      createdAt: now,
      updatedAt: now
    };
    this.vacancies.set(vacancy.id, vacancy);
    return vacancy;
  }

  async listVacancies(limit: number, offset: number): Promise<Vacancy[]> {
    return [...this.vacancies.values()].slice(offset, offset + limit);
  }

  async findVacancyById(id: string): Promise<Vacancy | null> {
    return this.vacancies.get(id) ?? null;
  }

  async createApplication(input: Omit<Application, "id" | "createdAt" | "updatedAt">): Promise<Application> {
    const now = new Date().toISOString();
    const application: Application = {
      ...input,
      id: randomUUID(),
      createdAt: now,
      updatedAt: now
    };
    this.applications.set(application.id, application);
    return application;
  }

  async listApplications(limit: number, offset: number): Promise<Application[]> {
    return [...this.applications.values()].slice(offset, offset + limit);
  }

  async findApplicationById(id: string): Promise<Application | null> {
    return this.applications.get(id) ?? null;
  }

  async updateApplication(
    id: string,
    patch: Partial<Omit<Application, "id" | "createdAt">>
  ): Promise<Application | null> {
    const current = this.applications.get(id);
    if (!current) return null;

    const updated: Application = {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString()
    };
    this.applications.set(id, updated);
    return updated;
  }
}

export class PostgresRepository implements Repository {
  constructor(private readonly pool: Pool) {}

  async initialize(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS hr_users (
        id UUID PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        login TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL
      );

      CREATE TABLE IF NOT EXISTS vacancies (
        id UUID PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        location TEXT NOT NULL,
        role TEXT NOT NULL,
        mandatory_requirements JSONB NOT NULL,
        optional_requirements JSONB NOT NULL,
        work_schedule TEXT NOT NULL,
        salary_format TEXT NOT NULL,
        candidate_tone TEXT NOT NULL,
        apply_url TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      );

      CREATE TABLE IF NOT EXISTS applications (
        id UUID PRIMARY KEY,
        vacancy_id UUID NOT NULL REFERENCES vacancies(id) ON DELETE CASCADE,
        candidate_email TEXT NOT NULL,
        stage TEXT NOT NULL,
        resume_text TEXT NOT NULL,
        answers JSONB NOT NULL,
        candidate_profile JSONB NULL,
        clarifying_questions JSONB NOT NULL,
        score DOUBLE PRECISION NULL,
        score_reasons JSONB NOT NULL,
        risks_to_clarify JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      );
    `);

    await this.pool.query(`
      ALTER TABLE vacancies
      ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';
    `);

    await this.pool.query(`
      ALTER TABLE applications
      ADD COLUMN IF NOT EXISTS candidate_profile JSONB NULL;
    `);

    const vacancyCount = Number((await this.pool.query("SELECT COUNT(*)::int AS count FROM vacancies")).rows[0].count);
    if (vacancyCount === 0) {
      for (const vacancy of seededVacancies) {
        await this.insertVacancy(vacancy);
      }
    }

    const applicationCount = Number(
      (await this.pool.query("SELECT COUNT(*)::int AS count FROM applications")).rows[0].count
    );
    if (applicationCount === 0) {
      for (const application of seededApplications) {
        await this.insertApplication(application);
      }
    }
  }

  async createUser(input: Omit<HRUser, "id" | "createdAt">): Promise<HRUser> {
    const user: HRUser = {
      ...input,
      id: randomUUID(),
      createdAt: new Date().toISOString()
    };
    await this.pool.query(
      `INSERT INTO hr_users (id, email, login, password_hash, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [user.id, user.email, user.login, user.passwordHash, user.createdAt]
    );
    return user;
  }

  async findUserById(id: string): Promise<HRUser | null> {
    const row = (await this.pool.query("SELECT * FROM hr_users WHERE id = $1", [id])).rows[0];
    return row ? mapUserRow(row) : null;
  }

  async findUserByEmail(email: string): Promise<HRUser | null> {
    const row = (await this.pool.query("SELECT * FROM hr_users WHERE email = $1", [email])).rows[0];
    return row ? mapUserRow(row) : null;
  }

  async findUserByLogin(login: string): Promise<HRUser | null> {
    const row = (await this.pool.query("SELECT * FROM hr_users WHERE login = $1", [login])).rows[0];
    return row ? mapUserRow(row) : null;
  }

  async createVacancy(input: Omit<Vacancy, "id" | "createdAt" | "updatedAt">): Promise<Vacancy> {
    const now = new Date().toISOString();
    const vacancy: Vacancy = {
      ...input,
      id: randomUUID(),
      createdAt: now,
      updatedAt: now
    };
    await this.insertVacancy(vacancy);
    return vacancy;
  }

  async listVacancies(limit: number, offset: number): Promise<Vacancy[]> {
    const rows = (
      await this.pool.query("SELECT * FROM vacancies ORDER BY created_at ASC LIMIT $1 OFFSET $2", [limit, offset])
    ).rows;
    return rows.map(mapVacancyRow);
  }

  async findVacancyById(id: string): Promise<Vacancy | null> {
    const row = (await this.pool.query("SELECT * FROM vacancies WHERE id = $1", [id])).rows[0];
    return row ? mapVacancyRow(row) : null;
  }

  async createApplication(input: Omit<Application, "id" | "createdAt" | "updatedAt">): Promise<Application> {
    const now = new Date().toISOString();
    const application: Application = {
      ...input,
      id: randomUUID(),
      createdAt: now,
      updatedAt: now
    };
    await this.insertApplication(application);
    return application;
  }

  async listApplications(limit: number, offset: number): Promise<Application[]> {
    const rows = (
      await this.pool.query("SELECT * FROM applications ORDER BY created_at ASC LIMIT $1 OFFSET $2", [limit, offset])
    ).rows;
    return rows.map(mapApplicationRow);
  }

  async findApplicationById(id: string): Promise<Application | null> {
    const row = (await this.pool.query("SELECT * FROM applications WHERE id = $1", [id])).rows[0];
    return row ? mapApplicationRow(row) : null;
  }

  async updateApplication(
    id: string,
    patch: Partial<Omit<Application, "id" | "createdAt">>
  ): Promise<Application | null> {
    const current = await this.findApplicationById(id);
    if (!current) return null;

    const updated: Application = {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString()
    };

    await this.pool.query(
      `UPDATE applications
       SET vacancy_id = $2,
           candidate_email = $3,
           stage = $4,
           resume_text = $5,
           answers = $6,
           candidate_profile = $7,
           clarifying_questions = $8,
           score = $9,
           score_reasons = $10,
           risks_to_clarify = $11,
           updated_at = $12
       WHERE id = $1`,
      [
        updated.id,
        updated.vacancyId,
        updated.candidateEmail,
        updated.stage,
        updated.resumeText,
        JSON.stringify(updated.answers),
        updated.candidateProfile === null ? null : JSON.stringify(updated.candidateProfile),
        JSON.stringify(updated.clarifyingQuestions),
        updated.score,
        JSON.stringify(updated.scoreReasons),
        JSON.stringify(updated.risksToClarify),
        updated.updatedAt
      ]
    );

    return updated;
  }

  private async insertVacancy(vacancy: Vacancy): Promise<void> {
    await this.pool.query(
      `INSERT INTO vacancies (
         id, title, description, location, role, mandatory_requirements, optional_requirements,
         work_schedule, salary_format, candidate_tone, apply_url, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       ON CONFLICT (id) DO NOTHING`,
      [
        vacancy.id,
        vacancy.title,
        vacancy.description,
        vacancy.location,
        vacancy.role,
        JSON.stringify(vacancy.mandatoryRequirements),
        JSON.stringify(vacancy.optionalRequirements),
        vacancy.workSchedule,
        vacancy.salaryFormat,
        vacancy.candidateTone,
        vacancy.applyUrl,
        vacancy.createdAt,
        vacancy.updatedAt
      ]
    );
  }

  private async insertApplication(application: Application): Promise<void> {
    await this.pool.query(
      `INSERT INTO applications (
         id, vacancy_id, candidate_email, stage, resume_text, answers,
         candidate_profile, clarifying_questions, score, score_reasons, risks_to_clarify, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       ON CONFLICT (id) DO NOTHING`,
      [
        application.id,
        application.vacancyId,
        application.candidateEmail,
        application.stage,
        application.resumeText,
        JSON.stringify(application.answers),
        application.candidateProfile === null ? null : JSON.stringify(application.candidateProfile),
        JSON.stringify(application.clarifyingQuestions),
        application.score,
        JSON.stringify(application.scoreReasons),
        JSON.stringify(application.risksToClarify),
        application.createdAt,
        application.updatedAt
      ]
    );
  }
}

function mapUserRow(row: Record<string, unknown>): HRUser {
  return {
    id: String(row.id),
    email: String(row.email),
    login: String(row.login),
    passwordHash: String(row.password_hash),
    createdAt: new Date(String(row.created_at)).toISOString()
  };
}

function mapVacancyRow(row: Record<string, unknown>): Vacancy {
  return {
    id: String(row.id),
    title: String(row.title),
    description: String(row.description),
    location: String(row.location),
    role: String(row.role),
    mandatoryRequirements: row.mandatory_requirements as string[],
    optionalRequirements: row.optional_requirements as string[],
    workSchedule: String(row.work_schedule),
    salaryFormat: String(row.salary_format),
    candidateTone: row.candidate_tone as Vacancy["candidateTone"],
    applyUrl: String(row.apply_url),
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString()
  };
}

function mapApplicationRow(row: Record<string, unknown>): Application {
  return {
    id: String(row.id),
    vacancyId: String(row.vacancy_id),
    candidateEmail: String(row.candidate_email),
    stage: row.stage as Application["stage"],
    resumeText: String(row.resume_text),
    answers: row.answers as Record<string, string>,
    candidateProfile: (row.candidate_profile as Record<string, unknown> | null) ?? null,
    clarifyingQuestions: row.clarifying_questions as string[],
    score: row.score === null ? null : Number(row.score),
    scoreReasons: row.score_reasons as string[],
    risksToClarify: row.risks_to_clarify as string[],
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString()
  };
}
