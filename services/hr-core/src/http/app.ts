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
import type { HRUser } from "../domain/types.js";
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

  app.get("/health/live", async () => ({ status: "ok" }));
  app.get("/health/ready", async () => ({ status: "ready" }));

  app.post("/api/v1/auth/register", async (request, reply) => {
    const payload = registerSchema.parse(request.body);
    const user = await authService.register(payload);
    return reply.status(201).send(presentUser(user));
  });

  app.post("/api/v1/auth/login", async (request, reply) => {
    const payload = loginSchema.parse(request.body);
    const user = await authService.authenticate(payload);
    const token = authService.createAccessToken(user);
    reply.setCookie(authService.cookieName(), token, authService.cookieOptions());
    return presentUser(user);
  });

  app.post("/api/v1/auth/logout", { preHandler: requireAuth }, async (_request, reply) => {
    reply.clearCookie(authService.cookieName(), { path: "/" });
    return reply.status(204).send();
  });

  app.get("/api/v1/auth/me", { preHandler: requireAuth }, async (request) => presentUser(request.currentUser!));

  app.post("/api/v1/vacancies", { preHandler: requireAuth }, async (request, reply) => {
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
  });

  app.get("/api/v1/vacancies", { preHandler: requireAuth }, async (request) => {
    const query = request.query as { limit?: string; offset?: string };
    const limit = Math.min(Math.max(Number(query.limit ?? "50"), 1), 100);
    const offset = Math.max(Number(query.offset ?? "0"), 0);
    return repo.listVacancies(limit, offset).map(presentVacancy);
  });

  app.get("/api/v1/vacancies/:vacancyId", { preHandler: requireAuth }, async (request) => {
    const { vacancyId } = request.params as { vacancyId: string };
    const vacancy = repo.findVacancyById(vacancyId);
    if (!vacancy) throw new AppError(404, "Vacancy not found");
    return presentVacancy(vacancy);
  });

  app.post("/api/v1/applications", { preHandler: requireAuth }, async (request, reply) => {
    const payload = applicationCreateSchema.parse(request.body);
    const application = await applicationService.createApplication({
      vacancyId: payload.vacancy_id,
      candidateEmail: payload.candidate_email,
      resumeText: payload.resume_text
    });
    return reply.status(201).send(presentApplication(application));
  });

  app.get("/api/v1/applications/:applicationId", { preHandler: requireAuth }, async (request) => {
    const { applicationId } = request.params as { applicationId: string };
    const application = repo.findApplicationById(applicationId);
    if (!application) throw new AppError(404, "Application not found");
    return presentApplication(application);
  });

  app.patch("/api/v1/applications/:applicationId/answers", { preHandler: requireAuth }, async (request) => {
    const { applicationId } = request.params as { applicationId: string };
    const payload = answersUpdateSchema.parse(request.body);
    const application = repo.updateApplication(applicationId, {
      answers: payload.answers,
      stage: "in_review"
    });
    if (!application) throw new AppError(404, "Application not found");
    return presentApplication(application);
  });

  app.patch("/api/v1/applications/:applicationId/stage", { preHandler: requireAuth }, async (request) => {
    const { applicationId } = request.params as { applicationId: string };
    const payload = stageUpdateSchema.parse(request.body);
    const application = repo.updateApplication(applicationId, { stage: payload.stage });
    if (!application) throw new AppError(404, "Application not found");
    return presentApplication(application);
  });

  return app;
}
