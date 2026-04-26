import { randomUUID } from "node:crypto";
import type { Application, HRUser, Vacancy } from "../domain/types.js";

export class InMemoryRepository {
  private users = new Map<string, HRUser>();
  private vacancies = new Map<string, Vacancy>();
  private applications = new Map<string, Application>();

  constructor(options: { seedDemoData?: boolean } = {}) {
    if (options.seedDemoData ?? true) {
      this.seedDemoData();
    }
  }

  private seedDemoData() {
    const seededVacancies: Vacancy[] = [
      {
        id: "11111111-1111-4111-8111-111111111111",
        title: "Senior Python Engineer",
        location: "Remote, EU",
        role: "Backend",
        mandatoryRequirements: ["Python", "FastAPI", "PostgreSQL"],
        optionalRequirements: ["Kubernetes", "Kafka", "English B2"],
        workSchedule: "Full-time",
        salaryFormat: "Gross, EUR",
        candidateTone: "zoomer",
        applyUrl: "https://jobs.example.com/python-senior",
        createdAt: "2026-01-10T08:00:00.000Z",
        updatedAt: "2026-01-10T08:00:00.000Z"
      },
      {
        id: "22222222-2222-4222-8222-222222222222",
        title: "Middle Frontend Engineer",
        location: "Hybrid, Berlin",
        role: "Frontend",
        mandatoryRequirements: ["TypeScript", "React", "Testing Library"],
        optionalRequirements: ["Next.js", "Design systems", "Storybook"],
        workSchedule: "Full-time",
        salaryFormat: "Net, EUR",
        candidateTone: "neutral",
        applyUrl: "https://jobs.example.com/frontend-middle",
        createdAt: "2026-01-11T09:30:00.000Z",
        updatedAt: "2026-01-11T09:30:00.000Z"
      },
      {
        id: "33333333-3333-4333-8333-333333333333",
        title: "DevOps Engineer",
        location: "Remote, Worldwide",
        role: "Infrastructure",
        mandatoryRequirements: ["AWS", "Terraform", "CI/CD"],
        optionalRequirements: ["Kubernetes", "Prometheus", "Grafana"],
        workSchedule: "Flexible",
        salaryFormat: "Gross, USD",
        candidateTone: "boomer",
        applyUrl: "https://jobs.example.com/devops-engineer",
        createdAt: "2026-01-12T07:45:00.000Z",
        updatedAt: "2026-01-12T07:45:00.000Z"
      }
    ];

    for (const vacancy of seededVacancies) {
      this.vacancies.set(vacancy.id, vacancy);
    }

    const seededApplications: Application[] = [
      {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        vacancyId: "11111111-1111-4111-8111-111111111111",
        candidateEmail: "alina.petrenko@example.com",
        stage: "in_review",
        resumeText:
          "Python backend engineer with 6 years in fintech. Built FastAPI services, optimized PostgreSQL queries and implemented async workers for data pipelines.",
        answers: {
          q1: "Led migration from monolith to services with zero downtime.",
          q2: "Worked with Kubernetes in production for 3 years."
        },
        clarifyingQuestions: [
          "Опишите ваш опыт с high-load API на FastAPI.",
          "Какие подходы к оптимизации PostgreSQL вы применяли?"
        ],
        score: 84,
        scoreReasons: ["Сильный backend опыт", "Подтверждена работа с PostgreSQL"],
        risksToClarify: ["Уточнить уровень разговорного английского"],
        createdAt: "2026-01-13T10:00:00.000Z",
        updatedAt: "2026-01-14T12:15:00.000Z"
      },
      {
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        vacancyId: "22222222-2222-4222-8222-222222222222",
        candidateEmail: "mark.richter@example.com",
        stage: "questions_sent",
        resumeText:
          "Frontend engineer with 4 years of React and TypeScript. Focused on accessibility, performance optimization and reusable UI components.",
        answers: {},
        clarifyingQuestions: [
          "Расскажите о вашем опыте построения дизайн-систем.",
          "Какие метрики производительности вы обычно улучшаете?"
        ],
        score: 76,
        scoreReasons: ["Уверенный React/TypeScript профиль", "Хороший фокус на UX"],
        risksToClarify: ["Проверить практический опыт с Next.js"],
        createdAt: "2026-01-15T09:20:00.000Z",
        updatedAt: "2026-01-15T09:20:00.000Z"
      },
      {
        id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        vacancyId: "33333333-3333-4333-8333-333333333333",
        candidateEmail: "dmitry.sokolov@example.com",
        stage: "interview",
        resumeText:
          "DevOps engineer with 8 years of AWS infrastructure, Terraform modules and CI/CD automation. Implemented observability stack with Prometheus and Grafana.",
        answers: {
          q1: "Built reusable Terraform modules for 20+ teams.",
          q2: "Designed incident response dashboards and alerts."
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

    for (const application of seededApplications) {
      this.applications.set(application.id, application);
    }
  }

  createUser(input: Omit<HRUser, "id" | "createdAt">): HRUser {
    const user: HRUser = {
      ...input,
      id: randomUUID(),
      createdAt: new Date().toISOString()
    };
    this.users.set(user.id, user);
    return user;
  }

  findUserById(id: string): HRUser | null {
    return this.users.get(id) ?? null;
  }

  findUserByEmail(email: string): HRUser | null {
    return [...this.users.values()].find((user) => user.email === email) ?? null;
  }

  findUserByLogin(login: string): HRUser | null {
    return [...this.users.values()].find((user) => user.login === login) ?? null;
  }

  createVacancy(input: Omit<Vacancy, "id" | "createdAt" | "updatedAt">): Vacancy {
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

  listVacancies(limit: number, offset: number): Vacancy[] {
    return [...this.vacancies.values()].slice(offset, offset + limit);
  }

  findVacancyById(id: string): Vacancy | null {
    return this.vacancies.get(id) ?? null;
  }

  createApplication(input: Omit<Application, "id" | "createdAt" | "updatedAt">): Application {
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

  findApplicationById(id: string): Application | null {
    return this.applications.get(id) ?? null;
  }

  updateApplication(id: string, patch: Partial<Omit<Application, "id" | "createdAt">>): Application | null {
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
