import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config/env.js";
import { buildApp } from "../src/http/app.js";
import { InMemoryRepository } from "../src/infra/repository.js";

async function makeApp() {
  const app = await buildApp({
    config: loadConfig({
      inviteCode: "TEST-INVITE-CODE",
      jwtSecret: "test-secret",
      cookieSecure: false
    }),
    repo: new InMemoryRepository({ seedDemoData: true })
  });
  return app;
}

async function register(app: Awaited<ReturnType<typeof makeApp>>, email: string, login: string) {
  return app.inject({
    method: "POST",
    url: "/api/v1/auth/register",
    payload: {
      email,
      login,
      password: "StrongPass123",
      invite_code: "TEST-INVITE-CODE"
    }
  });
}

describe("auth", () => {
  it("requires auth for platform endpoints", async () => {
    const app = await makeApp();

    const response = await app.inject({ method: "GET", url: "/api/v1/vacancies" });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ detail: "Not authenticated" });
  });

  it("registers, logs in, returns current HR and logs out", async () => {
    const app = await makeApp();

    const registered = await register(app, "hr1@example.com", "hr_one");
    expect(registered.statusCode).toBe(201);
    expect(registered.json().email).toBe("hr1@example.com");

    const loggedIn = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        email: "hr1@example.com",
        password: "StrongPass123"
      }
    });
    expect(loggedIn.statusCode).toBe(200);

    const cookie = loggedIn.cookies.find((item) => item.name === "hr_access_token");
    expect(cookie?.httpOnly).toBe(true);

    const me = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      cookies: { hr_access_token: cookie!.value }
    });
    expect(me.statusCode).toBe(200);
    expect(me.json().login).toBe("hr_one");

    const logout = await app.inject({
      method: "POST",
      url: "/api/v1/auth/logout",
      cookies: { hr_access_token: cookie!.value }
    });
    expect(logout.statusCode).toBe(204);
  });

  it("rejects invalid invite code and duplicates", async () => {
    const app = await makeApp();

    const invalidInvite = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        email: "bad@example.com",
        login: "bad_login",
        password: "StrongPass123",
        invite_code: "WRONG"
      }
    });
    expect(invalidInvite.statusCode).toBe(403);

    expect((await register(app, "dup@example.com", "dup_login")).statusCode).toBe(201);
    expect((await register(app, "dup@example.com", "other_login")).statusCode).toBe(409);
    expect((await register(app, "other@example.com", "dup_login")).statusCode).toBe(409);
  });

  it("works with an injected in-memory repository for tests", async () => {
    const app = await makeApp();
    const registered = await register(app, "persist@example.com", "persist_hr");

    expect(registered.statusCode).toBe(201);
  });
});
