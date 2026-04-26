import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config/env.js";
import { buildApp } from "../src/http/app.js";
import { InMemoryRepository } from "../src/infra/repository.js";

describe("OpenAPI docs", () => {
  it("exposes request bodies, params, query and cookie auth in Swagger", async () => {
    const app = await buildApp({
      config: loadConfig({
        inviteCode: "TEST-INVITE-CODE",
        jwtSecret: "test-secret",
        cookieSecure: false
      }),
      repo: new InMemoryRepository({ seedDemoData: true })
    });
    await app.ready();

    const document = app.swagger();

    expect(document.components?.securitySchemes?.cookieAuth).toEqual({
      type: "apiKey",
      in: "cookie",
      name: "hr_access_token"
    });
    expect(document.paths["/api/v1/auth/register"].post.requestBody).toBeDefined();
    expect(document.paths["/api/v1/vacancies"].post.requestBody).toBeDefined();
    expect(document.paths["/api/v1/vacancies"].get.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "limit", in: "query" }),
        expect.objectContaining({ name: "offset", in: "query" })
      ])
    );
    expect(document.paths["/api/v1/applications"].post.requestBody).toBeDefined();
    expect(document.paths["/api/v1/applications"].get.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "limit", in: "query" }),
        expect.objectContaining({ name: "offset", in: "query" })
      ])
    );
    expect(document.paths["/api/v1/applications/resumes/{resumeId}"].get.parameters).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: "resumeId", in: "path" })])
    );
    expect(document.paths["/api/v1/applications/{applicationId}/stage"].patch.requestBody).toBeDefined();
    expect(document.paths["/api/v1/applications/{applicationId}/stage"].patch.parameters).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: "applicationId", in: "path" })])
    );
  });
});
