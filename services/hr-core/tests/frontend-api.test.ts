import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config/env.js";
import { buildApp } from "../src/http/app.js";
import { InMemoryRepository } from "../src/infra/repository.js";

async function makeApp(frontendGuestMode: boolean) {
  return buildApp({
    config: loadConfig({
      inviteCode: "TEST-INVITE-CODE",
      jwtSecret: "test-secret",
      cookieSecure: false,
      frontendGuestMode,
    }),
    repo: new InMemoryRepository({ seedDemoData: true }),
  });
}

describe("frontend api", () => {
  it("blocks guest access when guest mode is disabled", async () => {
    const app = await makeApp(false);

    const response = await app.inject({
      method: "GET",
      url: "/api/frontend/v1/bootstrap",
    });

    expect(response.statusCode).toBe(401);
  });

  it("returns bootstrap payload with vacancies, candidates, and analytics", async () => {
    const app = await makeApp(true);

    const response = await app.inject({
      method: "GET",
      url: "/api/frontend/v1/bootstrap",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().vacancies.length).toBeGreaterThan(0);
    expect(response.json().candidates.length).toBeGreaterThan(0);
    expect(response.json().analytics.totalCandidates).toBeGreaterThan(0);
  });

  it("creates frontend vacancy and drives screening session lifecycle", async () => {
    const app = await makeApp(true);

    const createdVacancy = await app.inject({
      method: "POST",
      url: "/api/frontend/v1/vacancies",
      payload: {
        title: "Senior React Developer",
        description: "Frontend-owned contract for live integrations.",
        responsibilities: "- Build the dashboard\n- Integrate backend and ML services",
        mustHaves: "- React\n- TypeScript",
        niceToHaves: "- Design systems",
        stopFactors: "- No product ownership",
        conditions: "- Remote across Europe\n- Core collaboration hours: 10:00-16:00 CET",
        status: "Active",
        weights: {
          experience: 30,
          skills: 25,
          schedule: 10,
          location: 10,
          motivation: 10,
          readiness: 10,
          communication: 5,
        },
      },
    });

    expect(createdVacancy.statusCode).toBe(201);
    expect(createdVacancy.json().mustHaves).toContain("React");

    const session = await app.inject({
      method: "POST",
      url: "/api/frontend/v1/screening-sessions",
      payload: {
        vacancyId: createdVacancy.json().id,
        resumeText: "Initial placeholder before PDF text is persisted",
        resumeFileName: "candidate.pdf",
        resumeFileSizeBytes: 2048,
      },
    });

    expect(session.statusCode).toBe(201);
    expect(session.json().stage).toBe("New");

    const prepared = await app.inject({
      method: "PATCH",
      url: `/api/frontend/v1/screening-sessions/${session.json().id}/prepared`,
      payload: {
        resumeText: "Full extracted PDF text",
        candidateProfile: {
          name: "Anna Petrova",
          totalExperienceMonths: 72,
          workExperience: [
            {
              company: "Stripe",
              position: "Senior Platform Engineer",
              durationMonths: 36,
            },
          ],
        },
        clarifyingQuestions: [
          {
            id: "experience",
            text: "Tell us about your most relevant work.",
            signal: "experience_match",
            type: "free_text",
          },
        ],
      },
    });

    expect(prepared.statusCode).toBe(200);
    expect(prepared.json().name).toBe("Anna Petrova");
    expect(prepared.json().stage).toBe("New");

    const completed = await app.inject({
      method: "PATCH",
      url: `/api/frontend/v1/screening-sessions/${session.json().id}/completed`,
      payload: {
        answers: {
          experience: "I shipped recruiter workflow tooling end-to-end.",
        },
        signals: {
          strengths: ["Strong product ownership"],
        },
        rankResult: {
          candidateId: session.json().id,
          finalScore: 91,
          tier: "top_candidate",
          recommendedAction: "invite_to_interview",
          fitSummary: "Excellent fit.",
          topAdvantages: ["Strong product ownership"],
          topConcerns: ["Need to verify timezone overlap"],
          evidence: [
            { label: "Experience", score: 0.95, evidence: "Relevant shipped work" },
          ],
          missingInfo: [],
          possibleAlternativeRoles: [],
          hrExplanation: "High score from strong experience and communication.",
          neutralCandidateReply: "Thanks for your answers.",
        },
      },
    });

    expect(completed.statusCode).toBe(200);
    expect(completed.json().matchScore).toBe(91);
    expect(completed.json().stage).toBe("Screened");

    const staged = await app.inject({
      method: "PATCH",
      url: `/api/frontend/v1/candidates/${session.json().id}/stage`,
      payload: {
        stage: "Interview",
      },
    });

    expect(staged.statusCode).toBe(200);
    expect(staged.json().stage).toBe("Interview");
  });
});
