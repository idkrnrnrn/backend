import { randomUUID } from "node:crypto";
import cookie from "@fastify/cookie";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import { Pool } from "pg";
import { ZodError } from "zod";
import type { AppConfig } from "../config/env.js";
import { AppError } from "../domain/errors.js";
import {
  buildBootstrap,
  buildDomainVacancyFromFrontend,
  frontendStageToLegacyStage,
  parseFrontendVacancyInput,
  presentFrontendCandidateSummary,
  presentFrontendVacancy
} from "../domain/frontend.js";
import {
  answersUpdateSchema,
  applicationCreateSchema,
  loginSchema,
  registerSchema,
  stageUpdateSchema,
  vacancyCreateSchema
} from "../domain/schemas.js";
import { applicationStages, candidateTones, type HRUser } from "../domain/types.js";
import { InMemoryRepository, PostgresRepository, type Repository } from "../infra/repository.js";
import { ApplicationService } from "../services/applicationService.js";
import { AuthService } from "../services/authService.js";
import { HttpLLMClient, type LLMClient } from "../services/llmClient.js";
import { presentApplication, presentUser, presentVacancy } from "./presenters.js";
import {
  frontendCandidateStages,
  screeningSessionCompletedSchema,
  screeningSessionDraftSchema,
  screeningSessionPreparedSchema,
  type FrontendCandidateStage
} from "../frontend/contracts.js";

declare module "fastify" {
  interface FastifyRequest {
    currentUser?: HRUser;
  }
}

const errorResponseSchema = {
  type: "object",
  properties: {
    detail: {}
  }
} as const;

const userResponseSchema = {
  type: "object",
  required: ["id", "email", "login", "created_at"],
  properties: {
    id: { type: "string", format: "uuid" },
    email: { type: "string", format: "email" },
    login: { type: "string" },
    created_at: { type: "string", format: "date-time" }
  }
} as const;

const vacancyResponseSchema = {
  type: "object",
  required: [
    "id",
    "title",
    "description",
    "location",
    "role",
    "mandatory_requirements",
    "optional_requirements",
    "work_schedule",
    "salary_format",
    "candidate_tone",
    "apply_url",
    "created_at",
    "updated_at"
  ],
  properties: {
    id: { type: "string", format: "uuid" },
    title: { type: "string" },
    description: { type: "string" },
    location: { type: "string" },
    role: { type: "string" },
    mandatory_requirements: { type: "array", items: { type: "string" } },
    optional_requirements: { type: "array", items: { type: "string" } },
    work_schedule: { type: "string" },
    salary_format: { type: "string" },
    candidate_tone: { type: "string", enum: [...candidateTones] },
    apply_url: { type: "string", format: "uri" },
    created_at: { type: "string", format: "date-time" },
    updated_at: { type: "string", format: "date-time" }
  }
} as const;

const applicationResponseSchema = {
  type: "object",
  required: [
    "id",
    "vacancy_id",
    "candidate_email",
    "stage",
    "resume_text",
    "answers",
    "candidate_profile",
    "clarifying_questions",
    "score",
    "score_reasons",
    "risks_to_clarify",
    "created_at",
    "updated_at"
  ],
  properties: {
    id: { type: "string", format: "uuid" },
    vacancy_id: { type: "string", format: "uuid" },
    candidate_email: { type: "string", format: "email" },
    stage: { type: "string", enum: [...applicationStages] },
    resume_text: { type: "string" },
    answers: { type: "object", additionalProperties: { type: "string" } },
    candidate_profile: { anyOf: [{ type: "object", additionalProperties: true }, { type: "null" }] },
    clarifying_questions: {
      type: "array",
      items: {
        type: "object",
        required: ["id", "text"],
        properties: {
          id: { type: "string" },
          text: { type: "string" },
          signal: { type: "string" },
          type: { type: "string" },
          options: { type: "array", items: { type: "string" } }
        }
      }
    },
    score: { anyOf: [{ type: "number" }, { type: "null" }] },
    score_reasons: { type: "array", items: { type: "string" } },
    risks_to_clarify: { type: "array", items: { type: "string" } },
    created_at: { type: "string", format: "date-time" },
    updated_at: { type: "string", format: "date-time" }
  }
} as const;

const registerBodySchema = {
  type: "object",
  required: ["email", "login", "password", "invite_code"],
  properties: {
    email: { type: "string", format: "email" },
    login: { type: "string", minLength: 3, maxLength: 100 },
    password: { type: "string", minLength: 8, maxLength: 128 },
    invite_code: { type: "string", minLength: 4, maxLength: 128 }
  }
} as const;

const loginBodySchema = {
  type: "object",
  required: ["email", "password"],
  properties: {
    email: { type: "string", format: "email" },
    password: { type: "string", minLength: 8, maxLength: 128 }
  }
} as const;

const vacancyBodySchema = {
  type: "object",
  required: [
    "title",
    "description",
    "location",
    "role",
    "mandatory_requirements",
    "optional_requirements",
    "work_schedule",
    "salary_format",
    "candidate_tone",
    "apply_url"
  ],
  properties: {
    title: { type: "string", minLength: 2, maxLength: 255 },
    description: { type: "string", minLength: 20, maxLength: 4000 },
    location: { type: "string", minLength: 2, maxLength: 255 },
    role: { type: "string", minLength: 2, maxLength: 255 },
    mandatory_requirements: {
      type: "array",
      items: { type: "string" }
    },
    optional_requirements: {
      type: "array",
      items: { type: "string" }
    },
    work_schedule: { type: "string", minLength: 2, maxLength: 255 },
    salary_format: { type: "string", minLength: 2, maxLength: 255 },
    candidate_tone: { type: "string", enum: [...candidateTones] },
    apply_url: { type: "string", format: "uri" }
  }
} as const;

const applicationBodySchema = {
  type: "object",
  required: ["vacancy_id", "candidate_email", "resume_text"],
  properties: {
    vacancy_id: { type: "string", format: "uuid" },
    candidate_email: { type: "string", format: "email" },
    resume_text: {
      type: "string",
      minLength: 100
    }
  }
} as const;

const answersBodySchema = {
  type: "object",
  required: ["answers"],
  properties: {
    answers: {
      type: "object",
      additionalProperties: { type: "string" }
    }
  }
} as const;

const stageBodySchema = {
  type: "object",
  required: ["stage"],
  properties: {
    stage: { type: "string", enum: [...applicationStages] }
  }
} as const;

const listVacanciesQuerySchema = {
  type: "object",
  properties: {
    limit: { type: "integer", minimum: 1, maximum: 100, default: 50 },
    offset: { type: "integer", minimum: 0, default: 0 }
  }
} as const;

const frontendVacancyBodySchema = {
  type: "object",
  required: ["title", "description"],
  properties: {
    title: { type: "string", minLength: 2, maxLength: 255 },
    description: { type: "string", minLength: 2, maxLength: 4000 },
    responsibilities: { type: "string" },
    mustHaves: { type: "string" },
    niceToHaves: { type: "string" },
    stopFactors: { type: "string" },
    conditions: { type: "string" },
    status: { type: "string", enum: ["Active", "Closed"] },
    weights: {
      type: "object",
      properties: {
        experience: { type: "number" },
        skills: { type: "number" },
        schedule: { type: "number" },
        location: { type: "number" },
        motivation: { type: "number" },
        readiness: { type: "number" },
        communication: { type: "number" }
      }
    }
  }
} as const;

const frontendScreeningDraftBodySchema = {
  type: "object",
  required: ["vacancyId", "resumeText"],
  properties: {
    vacancyId: { type: "string" },
    resumeText: { type: "string", minLength: 1 },
    resumeFileName: { anyOf: [{ type: "string" }, { type: "null" }] },
    resumeFileSizeBytes: { anyOf: [{ type: "integer" }, { type: "null" }] }
  }
} as const;

const frontendPreparedBodySchema = {
  type: "object",
  required: ["candidateProfile", "clarifyingQuestions"],
  properties: {
    candidateProfile: { anyOf: [{ type: "object", additionalProperties: true }, { type: "null" }] },
    resumeText: { type: "string" },
    clarifyingQuestions: {
      type: "array",
      items: {
        type: "object",
        required: ["id", "text"],
        properties: {
          id: { type: "string" },
          text: { type: "string" },
          signal: { type: "string" },
          type: { type: "string" },
          options: { type: "array", items: { type: "string" } }
        }
      }
    }
  }
} as const;

const frontendCompletedBodySchema = {
  type: "object",
  required: ["answers", "rankResult"],
  properties: {
    answers: { type: "object", additionalProperties: { type: "string" } },
    signals: { anyOf: [{ type: "object", additionalProperties: true }, { type: "null" }] },
    rankResult: { type: "object", additionalProperties: true }
  }
} as const;

const frontendStageBodySchema = {
  type: "object",
  required: ["stage"],
  properties: {
    stage: { type: "string", enum: [...frontendCandidateStages] }
  }
} as const;

const vacancyParamsSchema = {
  type: "object",
  required: ["vacancyId"],
  properties: {
    vacancyId: { type: "string", format: "uuid" }
  }
} as const;

const applicationParamsSchema = {
  type: "object",
  required: ["applicationId"],
  properties: {
    applicationId: { type: "string", format: "uuid" }
  }
} as const;

const resumeParamsSchema = {
  type: "object",
  required: ["resumeId"],
  properties: {
    resumeId: { type: "string", format: "uuid" }
  }
} as const;

export type BuildAppOptions = {
  config: AppConfig;
  repo?: Repository;
  llmClient?: LLMClient;
};

export async function buildApp(options: BuildAppOptions) {
  const app = Fastify({ logger: false });
  const repo =
    options.repo ??
    new PostgresRepository(
      new Pool({
        connectionString: options.config.databaseUrl
      })
    );
  await repo.initialize();
  const authService = new AuthService(repo, options.config);
  const llmClient = options.llmClient ?? new HttpLLMClient(options.config);
  const applicationService = new ApplicationService(repo, llmClient);

  await app.register(cookie);
  await app.register(swagger, {
    openapi: {
      info: {
        title: "HR Core",
        version: "0.1.0"
      },
      components: {
        securitySchemes: {
          cookieAuth: {
            type: "apiKey",
            in: "cookie",
            name: "hr_access_token"
          }
        }
      }
    }
  });
  await app.register(swaggerUi, { routePrefix: "/docs" });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof AppError) {
      void reply.status(error.statusCode).send({ detail: error.message });
      return;
    }

    if (error instanceof ZodError) {
      void reply.status(422).send({ detail: error.flatten() });
      return;
    }

    console.error("Unhandled app error", error);
    void reply.status(500).send({ detail: "Internal server error" });
  });

  async function requireAuth(request: FastifyRequest, _reply: FastifyReply) {
    request.currentUser = await authService.getUserFromToken(request.cookies[authService.cookieName()]);
  }

  async function requireFrontendAccess(request: FastifyRequest, reply: FastifyReply) {
    if (options.config.frontendGuestMode) {
      return;
    }

    return requireAuth(request, reply);
  }

  app.get(
    "/health/live",
    {
      schema: {
        tags: ["health"],
        response: { 200: { type: "object", properties: { status: { type: "string" } } } }
      }
    },
    async () => ({ status: "ok" })
  );
  app.get(
    "/health/ready",
    {
      schema: {
        tags: ["health"],
        response: { 200: { type: "object", properties: { status: { type: "string" } } } }
      }
    },
    async () => ({ status: "ready" })
  );

  app.post(
    "/api/v1/auth/register",
    {
      schema: {
        tags: ["auth"],
        body: registerBodySchema,
        response: { 201: userResponseSchema, 403: errorResponseSchema, 409: errorResponseSchema }
      }
    },
    async (request, reply) => {
      const payload = registerSchema.parse(request.body);
      const user = await authService.register(payload);
      const token = authService.createAccessToken(user);
      reply.setCookie(authService.cookieName(), token, authService.cookieOptions());
      return reply.status(201).send(presentUser(user));
    }
  );

  app.post(
    "/api/v1/auth/login",
    {
      schema: {
        tags: ["auth"],
        body: loginBodySchema,
        response: { 200: userResponseSchema, 401: errorResponseSchema }
      }
    },
    async (request, reply) => {
      const payload = loginSchema.parse(request.body);
      const user = await authService.authenticate(payload);
      const token = authService.createAccessToken(user);
      reply.setCookie(authService.cookieName(), token, authService.cookieOptions());
      return presentUser(user);
    }
  );

  app.post(
    "/api/v1/auth/logout",
    {
      preHandler: requireAuth,
      schema: {
        tags: ["auth"],
        security: [{ cookieAuth: [] }],
        response: { 204: { type: "null" }, 401: errorResponseSchema }
      }
    },
    async (_request, reply) => {
      reply.clearCookie(authService.cookieName(), { path: "/" });
      return reply.status(204).send();
    }
  );

  app.get(
    "/api/v1/auth/me",
    {
      preHandler: requireAuth,
      schema: {
        tags: ["auth"],
        security: [{ cookieAuth: [] }],
        response: { 200: userResponseSchema, 401: errorResponseSchema }
      }
    },
    async (request) => presentUser(request.currentUser!)
  );

  app.post(
    "/api/v1/vacancies",
    {
      preHandler: requireAuth,
      schema: {
        tags: ["vacancies"],
        security: [{ cookieAuth: [] }],
        body: vacancyBodySchema,
        response: { 201: vacancyResponseSchema, 401: errorResponseSchema }
      }
    },
    async (request, reply) => {
    const payload = vacancyCreateSchema.parse(request.body);
      const vacancy = await repo.createVacancy({
        title: payload.title,
        description: payload.description,
        responsibilities: "",
        mustHaves: payload.mandatory_requirements.map((item) => `- ${item}`).join("\n"),
        niceToHaves: payload.optional_requirements.map((item) => `- ${item}`).join("\n"),
        stopFactors: "",
        conditions: [payload.work_schedule, payload.location, payload.salary_format].join("\n"),
        weights: {
          experience: 30,
          skills: 25,
          schedule: 10,
          location: 10,
          motivation: 10,
          readiness: 10,
          communication: 5
        },
        status: "Active",
        location: payload.location,
      role: payload.role,
      mandatoryRequirements: payload.mandatory_requirements,
      optionalRequirements: payload.optional_requirements,
      workSchedule: payload.work_schedule,
      salaryFormat: payload.salary_format,
      candidateTone: payload.candidate_tone,
      applyUrl: payload.apply_url
    });
    return reply.status(201).send(presentVacancy(vacancy));
    }
  );

  app.get(
    "/api/v1/vacancies",
    {
      preHandler: requireAuth,
      schema: {
        tags: ["vacancies"],
        security: [{ cookieAuth: [] }],
        querystring: listVacanciesQuerySchema,
        response: { 200: { type: "array", items: vacancyResponseSchema }, 401: errorResponseSchema }
      }
    },
    async (request) => {
    const query = request.query as { limit?: string; offset?: string };
    const limit = Math.min(Math.max(Number(query.limit ?? "50"), 1), 100);
    const offset = Math.max(Number(query.offset ?? "0"), 0);
    return (await repo.listVacancies(limit, offset)).map(presentVacancy);
    }
  );

  app.get(
    "/api/v1/vacancies/:vacancyId",
    {
      preHandler: requireAuth,
      schema: {
        tags: ["vacancies"],
        security: [{ cookieAuth: [] }],
        params: vacancyParamsSchema,
        response: { 200: vacancyResponseSchema, 401: errorResponseSchema, 404: errorResponseSchema }
      }
    },
    async (request) => {
    const { vacancyId } = request.params as { vacancyId: string };
    const vacancy = await repo.findVacancyById(vacancyId);
    if (!vacancy) throw new AppError(404, "Vacancy not found");
    return presentVacancy(vacancy);
    }
  );

  app.post(
    "/api/v1/applications",
    {
      preHandler: requireAuth,
      schema: {
        tags: ["applications"],
        security: [{ cookieAuth: [] }],
        body: applicationBodySchema,
        response: { 201: applicationResponseSchema, 401: errorResponseSchema, 404: errorResponseSchema }
      }
    },
    async (request, reply) => {
    const payload = applicationCreateSchema.parse(request.body);
    const application = await applicationService.createApplication({
      vacancyId: payload.vacancy_id,
      candidateEmail: payload.candidate_email,
      resumeText: payload.resume_text
    });
    return reply.status(201).send(presentApplication(application));
    }
  );

  app.get(
    "/api/frontend/v1/bootstrap",
    {
      preHandler: requireFrontendAccess,
      schema: {
        tags: ["frontend"],
        response: { 200: { type: "object", additionalProperties: true }, 401: errorResponseSchema }
      }
    },
    async () => {
      const vacancies = await repo.listVacancies(1000, 0);
      const applications = await repo.listApplications(1000, 0);
      return buildBootstrap(vacancies, applications);
    }
  );

  app.post(
    "/api/frontend/v1/vacancies",
    {
      preHandler: requireFrontendAccess,
      schema: {
        tags: ["frontend"],
        body: frontendVacancyBodySchema,
        response: { 201: { type: "object", additionalProperties: true }, 401: errorResponseSchema }
      }
    },
    async (request, reply) => {
      const payload = parseFrontendVacancyInput(request.body);
      const vacancy = await repo.createVacancy(buildDomainVacancyFromFrontend(payload));
      return reply.status(201).send(presentFrontendVacancy(vacancy));
    }
  );

  app.get(
    "/api/frontend/v1/vacancies/:vacancyId",
    {
      preHandler: requireFrontendAccess,
      schema: {
        tags: ["frontend"],
        params: vacancyParamsSchema,
        response: { 200: { type: "object", additionalProperties: true }, 401: errorResponseSchema, 404: errorResponseSchema }
      }
    },
    async (request) => {
      const { vacancyId } = request.params as { vacancyId: string };
      const vacancy = await repo.findVacancyById(vacancyId);
      if (!vacancy) throw new AppError(404, "Vacancy not found");
      return presentFrontendVacancy(vacancy);
    }
  );

  app.get(
    "/api/frontend/v1/candidates",
    {
      preHandler: requireFrontendAccess,
      schema: {
        tags: ["frontend"],
        response: { 200: { type: "array", items: { type: "object", additionalProperties: true } }, 401: errorResponseSchema }
      }
    },
    async (request) => {
      const query = request.query as { vacancyId?: string };
      const applications = await repo.listApplications(1000, 0);
      const vacancies = new Map((await repo.listVacancies(1000, 0)).map((vacancy) => [vacancy.id, vacancy]));

      return applications
        .filter((application) => !query.vacancyId || application.vacancyId === query.vacancyId)
        .map((application) => {
          const vacancy = vacancies.get(application.vacancyId);
          return vacancy ? presentFrontendCandidateSummary(application, vacancy) : null;
        })
        .filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null);
    }
  );

  app.post(
    "/api/frontend/v1/screening-sessions",
    {
      preHandler: requireFrontendAccess,
      schema: {
        tags: ["frontend"],
        body: frontendScreeningDraftBodySchema,
        response: { 201: { type: "object", additionalProperties: true }, 401: errorResponseSchema, 404: errorResponseSchema }
      }
    },
    async (request, reply) => {
      const payload = screeningSessionDraftSchema.parse(request.body);
      const vacancy = await repo.findVacancyById(payload.vacancyId);
      if (!vacancy) throw new AppError(404, "Vacancy not found");

      const application = await repo.createApplication({
        vacancyId: payload.vacancyId,
        candidateEmail: `candidate-${randomUUID()}@screenr.local`,
        stage: "new",
        resumeText: payload.resumeText,
        resumeFileName: payload.resumeFileName ?? null,
        resumeFileSizeBytes: payload.resumeFileSizeBytes ?? null,
        answers: {},
        candidateProfile: null,
        clarifyingQuestions: [],
        screeningSignals: null,
        rankResult: null,
        score: null,
        scoreReasons: [],
        risksToClarify: []
      });

      return reply.status(201).send(presentFrontendCandidateSummary(application, vacancy));
    }
  );

  app.get(
    "/api/v1/applications",
    {
      preHandler: requireAuth,
      schema: {
        tags: ["applications"],
        security: [{ cookieAuth: [] }],
        querystring: listVacanciesQuerySchema,
        response: { 200: { type: "array", items: applicationResponseSchema }, 401: errorResponseSchema }
      }
    },
    async (request) => {
      const query = request.query as { limit?: string; offset?: string };
      const limit = Math.min(Math.max(Number(query.limit ?? "50"), 1), 100);
      const offset = Math.max(Number(query.offset ?? "0"), 0);
      return (await repo.listApplications(limit, offset)).map(presentApplication);
    }
  );

  app.get(
    "/api/v1/applications/resumes/:resumeId",
    {
      preHandler: requireAuth,
      schema: {
        tags: ["applications"],
        security: [{ cookieAuth: [] }],
        params: resumeParamsSchema,
        response: { 200: applicationResponseSchema, 401: errorResponseSchema, 404: errorResponseSchema }
      }
    },
    async (request) => {
      const { resumeId } = request.params as { resumeId: string };
      const application = await repo.findApplicationById(resumeId);
      if (!application) throw new AppError(404, "Application not found");
      return presentApplication(application);
    }
  );

  app.get(
    "/api/v1/applications/:applicationId",
    {
      preHandler: requireAuth,
      schema: {
        tags: ["applications"],
        security: [{ cookieAuth: [] }],
        params: applicationParamsSchema,
        response: { 200: applicationResponseSchema, 401: errorResponseSchema, 404: errorResponseSchema }
      }
    },
    async (request) => {
    const { applicationId } = request.params as { applicationId: string };
    const application = await repo.findApplicationById(applicationId);
    if (!application) throw new AppError(404, "Application not found");
    return presentApplication(application);
    }
  );

  app.patch(
    "/api/frontend/v1/screening-sessions/:applicationId/prepared",
    {
      preHandler: requireFrontendAccess,
      schema: {
        tags: ["frontend"],
        params: applicationParamsSchema,
        body: frontendPreparedBodySchema,
        response: { 200: { type: "object", additionalProperties: true }, 401: errorResponseSchema, 404: errorResponseSchema }
      }
    },
    async (request) => {
      const { applicationId } = request.params as { applicationId: string };
      const payload = screeningSessionPreparedSchema.parse(request.body);
      const current = await repo.findApplicationById(applicationId);
      if (!current) throw new AppError(404, "Application not found");
      const vacancy = await repo.findVacancyById(current.vacancyId);
      if (!vacancy) throw new AppError(404, "Vacancy not found");

      const updated = await repo.updateApplication(applicationId, {
        resumeText: payload.resumeText ?? current.resumeText,
        candidateProfile: payload.candidateProfile,
        clarifyingQuestions: payload.clarifyingQuestions,
        stage: "questions_sent"
      });
      if (!updated) throw new AppError(404, "Application not found");

      return presentFrontendCandidateSummary(updated, vacancy);
    }
  );

  app.patch(
    "/api/frontend/v1/screening-sessions/:applicationId/completed",
    {
      preHandler: requireFrontendAccess,
      schema: {
        tags: ["frontend"],
        params: applicationParamsSchema,
        body: frontendCompletedBodySchema,
        response: { 200: { type: "object", additionalProperties: true }, 401: errorResponseSchema, 404: errorResponseSchema }
      }
    },
    async (request) => {
      const { applicationId } = request.params as { applicationId: string };
      const payload = screeningSessionCompletedSchema.parse(request.body);
      const current = await repo.findApplicationById(applicationId);
      if (!current) throw new AppError(404, "Application not found");
      const vacancy = await repo.findVacancyById(current.vacancyId);
      if (!vacancy) throw new AppError(404, "Vacancy not found");

      const updated = await repo.updateApplication(applicationId, {
        answers: payload.answers,
        screeningSignals: payload.signals ?? null,
        rankResult: payload.rankResult,
        score: payload.rankResult.finalScore,
        scoreReasons: payload.rankResult.topAdvantages,
        risksToClarify: payload.rankResult.topConcerns,
        stage: "in_review"
      });
      if (!updated) throw new AppError(404, "Application not found");

      return presentFrontendCandidateSummary(updated, vacancy);
    }
  );

  app.patch(
    "/api/frontend/v1/candidates/:applicationId/stage",
    {
      preHandler: requireFrontendAccess,
      schema: {
        tags: ["frontend"],
        params: applicationParamsSchema,
        body: frontendStageBodySchema,
        response: { 200: { type: "object", additionalProperties: true }, 401: errorResponseSchema, 404: errorResponseSchema }
      }
    },
    async (request) => {
      const { applicationId } = request.params as { applicationId: string };
      const payload = request.body as { stage: FrontendCandidateStage };
      const current = await repo.findApplicationById(applicationId);
      if (!current) throw new AppError(404, "Application not found");
      const vacancy = await repo.findVacancyById(current.vacancyId);
      if (!vacancy) throw new AppError(404, "Vacancy not found");

      const updated = await repo.updateApplication(applicationId, {
        stage: frontendStageToLegacyStage(payload.stage)
      });
      if (!updated) throw new AppError(404, "Application not found");

      return presentFrontendCandidateSummary(updated, vacancy);
    }
  );

  app.patch(
    "/api/v1/applications/:applicationId/answers",
    {
      preHandler: requireAuth,
      schema: {
        tags: ["applications"],
        security: [{ cookieAuth: [] }],
        params: applicationParamsSchema,
        body: answersBodySchema,
        response: { 200: applicationResponseSchema, 401: errorResponseSchema, 404: errorResponseSchema }
      }
    },
    async (request) => {
    const { applicationId } = request.params as { applicationId: string };
    const payload = answersUpdateSchema.parse(request.body);
    const application = await applicationService.submitAnswers(applicationId, payload.answers);
    return presentApplication(application);
    }
  );

  app.patch(
    "/api/v1/applications/:applicationId/stage",
    {
      preHandler: requireAuth,
      schema: {
        tags: ["applications"],
        security: [{ cookieAuth: [] }],
        params: applicationParamsSchema,
        body: stageBodySchema,
        response: { 200: applicationResponseSchema, 401: errorResponseSchema, 404: errorResponseSchema }
      }
    },
    async (request) => {
    const { applicationId } = request.params as { applicationId: string };
    const payload = stageUpdateSchema.parse(request.body);
    const application = await repo.updateApplication(applicationId, { stage: payload.stage });
    if (!application) throw new AppError(404, "Application not found");
    return presentApplication(application);
    }
  );

  return app;
}
