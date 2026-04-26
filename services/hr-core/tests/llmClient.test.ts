import { afterEach, describe, expect, it, vi } from "vitest";
import { loadConfig } from "../src/config/env.js";
import type { Vacancy } from "../src/domain/types.js";
import { HttpLLMClient } from "../src/services/llmClient.js";

const vacancy: Vacancy = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "Старший Python-разработчик",
  description:
    "Ищем backend-инженера для развития высоконагруженной HR-платформы. Нужно проектировать API, оптимизировать производительность и участвовать в архитектурных решениях команды.",
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
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("HttpLLMClient", () => {
  it("sends prepare-screening payload in the documented format and preserves structured questions", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("http://127.0.0.1:3000/api/prepare-screening");
      expect(init?.method).toBe("POST");
      expect(init?.headers).toEqual({ "content-type": "application/json" });

      const body = JSON.parse(String(init?.body));
      expect(body).toEqual({
        vacancy: {
          id: vacancy.id,
          title: vacancy.title,
          description: vacancy.description,
          mustHave: vacancy.mandatoryRequirements,
          niceToHave: vacancy.optionalRequirements,
          responsibilities: [],
          schedule: vacancy.workSchedule,
          location: vacancy.location,
          salary: vacancy.salaryFormat,
          weights: {
            experience: 0.25,
            skills: 0.3,
            schedule: 0.3,
            motivation: 0.15
          },
          dealBreakers: []
        },
        pdfText: "resume text"
      });

      return new Response(
        JSON.stringify({
          profile: {
            candidateId: "candidate_1",
            location: "Москва",
            schedulePreferences: "2/2"
          },
          questions: [
            {
              id: "cashier_experience_check",
              text: "Есть ли у вас опыт работы с кассой?",
              signal: "skills_match",
              type: "single_choice",
              options: ["Да", "Нет, но готов(а) обучиться"]
            }
          ]
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" }
        }
      );
    });

    vi.stubGlobal("fetch", fetchMock);

    const client = new HttpLLMClient(
      loadConfig({
        llmBaseUrl: "http://127.0.0.1:3000"
      })
    );

    const result = await client.prepareScreening({
      vacancy,
      resumeText: "resume text"
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      candidateProfile: {
        candidateId: "candidate_1",
        location: "Москва",
        schedulePreferences: "2/2"
      },
      clarifyingQuestions: [
        {
          id: "cashier_experience_check",
          text: "Есть ли у вас опыт работы с кассой?",
          signal: "skills_match",
          type: "single_choice",
          options: ["Да", "Нет, но готов(а) обучиться"]
        }
      ]
    });
  });

  it("sends rank-candidate payload with stored profile/questions and extracts score, reasons and risks", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("http://127.0.0.1:3000/api/rank-candidate");
      expect(init?.method).toBe("POST");

      const body = JSON.parse(String(init?.body));
      expect(body).toEqual({
        vacancy: {
          id: vacancy.id,
          title: vacancy.title,
          description: vacancy.description,
          mustHave: vacancy.mandatoryRequirements,
          niceToHave: vacancy.optionalRequirements,
          responsibilities: [],
          schedule: vacancy.workSchedule,
          location: vacancy.location,
          salary: vacancy.salaryFormat,
          weights: {
            experience: 0.25,
            skills: 0.3,
            schedule: 0.3,
            motivation: 0.15
          },
          dealBreakers: []
        },
        profile: {
          candidateId: "candidate_1",
          availability: "со следующей недели"
        },
        questions: [
          {
            questionId: "cashier_experience_check",
            text: "Есть ли у вас опыт работы с кассой?"
          }
        ],
        answers: [
          {
            questionId: "cashier_experience_check",
            answer: "Нет, но готов(а) обучиться"
          }
        ]
      });

      return new Response(
        JSON.stringify({
          signals: {
            candidateId: "candidate_1",
            mustHave: {
              passed: true,
              failedReasons: []
            },
            strengths: ["Есть опыт работы с клиентами"],
            concerns: ["Нет подтвержденного опыта работы с кассой"],
            missingInfo: []
          },
          rankResult: {
            candidateId: "candidate_1",
            finalScore: 74,
            topAdvantages: ["Есть опыт работы с клиентами", "Готова к сменному графику"],
            topConcerns: ["Нет подтвержденного опыта работы с кассой"],
            missingInfo: [],
            hrExplanation: "Score 74..."
          }
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" }
        }
      );
    });

    vi.stubGlobal("fetch", fetchMock);

    const client = new HttpLLMClient(
      loadConfig({
        llmBaseUrl: "http://127.0.0.1:3000"
      })
    );

    const result = await client.rankCandidate({
      vacancy,
      candidateProfile: {
        candidateId: "candidate_1",
        availability: "со следующей недели"
      },
      clarifyingQuestions: [
        {
          id: "cashier_experience_check",
          text: "Есть ли у вас опыт работы с кассой?",
          signal: "skills_match",
          type: "single_choice",
          options: ["Да", "Нет, но готов(а) обучиться"]
        }
      ],
      answers: {
        cashier_experience_check: "Нет, но готов(а) обучиться"
      }
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      score: 74,
      scoreReasons: ["Есть опыт работы с клиентами", "Готова к сменному графику"],
      risksToClarify: ["Нет подтвержденного опыта работы с кассой"]
    });
  });
});
