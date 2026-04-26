import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config/env.js";
import type { ScreeningRequest } from "../src/domain/types.js";
import { buildApp } from "../src/http/app.js";
import type { LLMClient } from "../src/services/llmClient.js";

const fakeLlmClient: LLMClient = {
  async screenResume(_payload: ScreeningRequest) {
    return {
      clarifyingQuestions: ["Расскажите про high-load проект.", "Как валидируете требования?"],
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
    llmClient: fakeLlmClient
  });
}

async function login(app: Awaited<ReturnType<typeof makeApp>>, idx: number) {
  const email = `hr${idx}@example.com`;
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
  title: "Senior Python Engineer",
  location: "Remote, EU",
  role: "Backend",
  mandatory_requirements: ["Python", "FastAPI", "PostgreSQL"],
  optional_requirements: ["Kubernetes", "Kafka", "English B2"],
  work_schedule: "Full-time",
  salary_format: "Gross, EUR",
  candidate_tone: "zoomer",
  apply_url: "https://jobs.example.com/python-senior"
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

  it("creates application, stores screening result, answers and stage updates", async () => {
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
        candidate_email: "candidate@example.com",
        resume_text:
          "I have 5 years of backend experience with production APIs, PostgreSQL, Docker and Kubernetes at scale."
      }
    });

    expect(application.statusCode).toBe(201);
    expect(application.json().stage).toBe("questions_sent");
    expect(application.json().score).toBe(78.5);

    const answered = await app.inject({
      method: "PATCH",
      url: `/api/v1/applications/${application.json().id}/answers`,
      cookies: { hr_access_token: cookie },
      payload: { answers: { q1: "answer1" } }
    });
    expect(answered.statusCode).toBe(200);
    expect(answered.json().stage).toBe("in_review");

    const staged = await app.inject({
      method: "PATCH",
      url: `/api/v1/applications/${application.json().id}/stage`,
      cookies: { hr_access_token: cookie },
      payload: { stage: "chat_not_joined" }
    });
    expect(staged.statusCode).toBe(200);
    expect(staged.json().stage).toBe("chat_not_joined");
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
        candidate_email: "candidate@example.com",
        resume_text: "Python ".repeat(30)
      }
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ detail: "Vacancy not found" });
  });
});
