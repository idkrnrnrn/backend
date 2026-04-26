import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config/env.js";
import { buildApp } from "../src/http/app.js";
import { InMemoryRepository } from "../src/infra/repository.js";
import type { LLMClient } from "../src/services/llmClient.js";

const fakeLlmClient: LLMClient = {
  async prepareScreening(_payload) {
    return {
      candidateProfile: {
        seniority: "senior",
        skills: ["Python", "PostgreSQL"]
      },
      clarifyingQuestions: ["Расскажите про high-load проект.", "Как валидируете требования?"]
    };
  },
  async rankCandidate(_payload) {
    return {
      score: 78.5,
      scoreReasons: ["Хороший опыт Python", "Есть production опыт"],
      risksToClarify: ["Проверить Kafka"]
    };
  }
};

async function makeApp() {
  return buildApp({
    config: loadConfig({
      inviteCode: "TEST-INVITE-CODE",
      jwtSecret: "test-secret",
      cookieSecure: false
    }),
    repo: new InMemoryRepository({ seedDemoData: true }),
    llmClient: fakeLlmClient
  });
}

async function login(app: Awaited<ReturnType<typeof makeApp>>, idx: number) {
  const email = `hr${idx}@nl.ourelephant.ru`;
  await app.inject({
    method: "POST",
    url: "/api/v1/auth/register",
    payload: {
      email,
      login: `hr_${idx}`,
      password: "StrongPass123",
      invite_code: "TEST-INVITE-CODE"
    }
  });
  const response = await app.inject({
    method: "POST",
    url: "/api/v1/auth/login",
    payload: { email, password: "StrongPass123" }
  });
  return response.cookies.find((item) => item.name === "hr_access_token")!.value;
}

const vacancyPayload = {
  title: "Старший Python-разработчик",
  description:
    "Ищем backend-инженера для развития высоконагруженной HR-платформы. Нужно проектировать API, оптимизировать производительность и участвовать в архитектурных решениях команды.",
  location: "Удаленно, Россия",
  role: "Бэкенд-разработка",
  mandatory_requirements: ["Python", "FastAPI", "PostgreSQL"],
  optional_requirements: ["Kubernetes", "Kafka", "Английский B2"],
  work_schedule: "Полный день",
  salary_format: "320 000-420 000 RUB/month",
  candidate_tone: "zoomer",
  apply_url: "https://nl.ourelephant.ru/jobs/python-senior"
};

describe("vacancies and applications", () => {
  it("lets any authenticated HR see all vacancies", async () => {
    const app = await makeApp();
    const firstCookie = await login(app, 1);

    const created = await app.inject({
      method: "POST",
      url: "/api/v1/vacancies",
      cookies: { hr_access_token: firstCookie },
      payload: vacancyPayload
    });
    expect(created.statusCode).toBe(201);

    const secondCookie = await login(app, 2);
    const listed = await app.inject({
      method: "GET",
      url: "/api/v1/vacancies",
      cookies: { hr_access_token: secondCookie }
    });
    expect(listed.statusCode).toBe(200);
    expect(listed.json()).toEqual(expect.arrayContaining([expect.objectContaining({ id: created.json().id })]));
  });

  it("creates application, stores screening questions, reranks after answers and stage updates", async () => {
    const app = await makeApp();
    const cookie = await login(app, 3);

    const vacancy = await app.inject({
      method: "POST",
      url: "/api/v1/vacancies",
      cookies: { hr_access_token: cookie },
      payload: vacancyPayload
    });

    const application = await app.inject({
      method: "POST",
      url: "/api/v1/applications",
      cookies: { hr_access_token: cookie },
      payload: {
        vacancy_id: vacancy.json().id,
        candidate_email: "candidate@nl.ourelephant.ru",
        resume_text:
          "У меня 5 лет опыта в backend-разработке, работал с production API, PostgreSQL, Docker и Kubernetes, занимался оптимизацией производительности сервисов."
      }
    });

    expect(application.statusCode).toBe(201);
    expect(application.json().stage).toBe("questions_sent");
    expect(application.json().score).toBe(null);
    expect(application.json().score_reasons).toEqual([]);
    expect(application.json().risks_to_clarify).toEqual([]);

    const answered = await app.inject({
      method: "PATCH",
      url: `/api/v1/applications/${application.json().id}/answers`,
      cookies: { hr_access_token: cookie },
      payload: { answers: { q1: "answer1" } }
    });
    expect(answered.statusCode).toBe(200);
    expect(answered.json().stage).toBe("in_review");
    expect(answered.json().score).toBe(78.5);
    expect(answered.json().score_reasons).toEqual(["Хороший опыт Python", "Есть production опыт"]);
    expect(answered.json().risks_to_clarify).toEqual(["Проверить Kafka"]);

    const staged = await app.inject({
      method: "PATCH",
      url: `/api/v1/applications/${application.json().id}/stage`,
      cookies: { hr_access_token: cookie },
      payload: { stage: "chat_not_joined" }
    });
    expect(staged.statusCode).toBe(200);
    expect(staged.json().stage).toBe("chat_not_joined");
  });

  it("lists all applications and returns application by resume id", async () => {
    const app = await makeApp();
    const cookie = await login(app, 5);

    const applications = await app.inject({
      method: "GET",
      url: "/api/v1/applications?limit=10&offset=0",
      cookies: { hr_access_token: cookie }
    });
    expect(applications.statusCode).toBe(200);
    expect(applications.json()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          candidate_email: "alina.petrenko@nl.ourelephant.ru",
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
        })
      ])
    );

    const applicationByResume = await app.inject({
      method: "GET",
      url: "/api/v1/applications/resumes/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      cookies: { hr_access_token: cookie }
    });
    expect(applicationByResume.statusCode).toBe(200);
    expect(applicationByResume.json().candidate_email).toBe("alina.petrenko@nl.ourelephant.ru");
    expect(applicationByResume.json().id).toBe("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  });

  it("returns 404 when creating application for unknown vacancy", async () => {
    const app = await makeApp();
    const cookie = await login(app, 4);

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/applications",
      cookies: { hr_access_token: cookie },
      payload: {
        vacancy_id: "00000000-0000-0000-0000-000000000000",
        candidate_email: "candidate@nl.ourelephant.ru",
        resume_text: "Python ".repeat(30)
      }
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ detail: "Vacancy not found" });
  });
});
