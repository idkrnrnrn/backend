import cookie from "@fastify/cookie";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import { ZodError } from "zod";
import type { AppConfig } from "../config/env.js";
import { AppError } from "../domain/errors.js";
import {
  answersUpdateSchema,
  applicationCreateSchema,
  loginSchema,
  registerSchema,
  stageUpdateSchema,
  vacancyCreateSchema
} from "../domain/schemas.js";
import { applicationStages, candidateTones, type HRUser } from "../domain/types.js";
import { InMemoryRepository } from "../infra/repository.js";
import { ApplicationService } from "../services/applicationService.js";
import { AuthService } from "../services/authService.js";
import { HttpLLMClient, type LLMClient } from "../services/llmClient.js";
import { presentApplication, presentUser, presentVacancy } from "./presenters.js";

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
    clarifying_questions: { type: "array", items: { type: "string" } },
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

export type BuildAppOptions = {
  config: AppConfig;
  repo?: InMemoryRepository;
  llmClient?: LLMClient;
};

export async function buildApp(options: BuildAppOptions) {
  const app = Fastify({ logger: false });
  const repo = options.repo ?? new InMemoryRepository();
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

    void reply.status(500).send({ detail: "Internal server error" });
  });

  async function requireAuth(request: FastifyRequest, _reply: FastifyReply) {
    request.currentUser = authService.getUserFromToken(request.cookies[authService.cookieName()]);
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
    const vacancy = repo.createVacancy({
      title: payload.title,
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
    return repo.listVacancies(limit, offset).map(presentVacancy);
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
    const vacancy = repo.findVacancyById(vacancyId);
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
    const application = repo.findApplicationById(applicationId);
    if (!application) throw new AppError(404, "Application not found");
    return presentApplication(application);
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
    const application = repo.updateApplication(applicationId, {
      answers: payload.answers,
      stage: "in_review"
    });
    if (!application) throw new AppError(404, "Application not found");
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
    const application = repo.updateApplication(applicationId, { stage: payload.stage });
    if (!application) throw new AppError(404, "Application not found");
    return presentApplication(application);
    }
  );

  return app;
}
