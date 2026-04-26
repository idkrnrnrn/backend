export type AppConfig = {
  port: number;
  inviteCode: string;
  jwtSecret: string;
  jwtExpiresInSeconds: number;
  cookieSecure: boolean;
  llmBaseUrl: string;
  databaseUrl: string;
};

export function loadConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    port: Number(process.env.PORT ?? "8000"),
    inviteCode: process.env.HR_INVITE_CODE ?? "HR-INVITE-2026",
    jwtSecret: process.env.HR_JWT_SECRET ?? "change-me-in-production",
    jwtExpiresInSeconds: Number(process.env.HR_JWT_EXPIRE_SECONDS ?? "7200"),
    cookieSecure: (process.env.HR_COOKIE_SECURE ?? "false").toLowerCase() === "true",
    llmBaseUrl: process.env.HR_LLM_BASE_URL ?? "http://127.0.0.1:3000",
    databaseUrl: process.env.HR_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/hr",
    ...overrides
  };
}
