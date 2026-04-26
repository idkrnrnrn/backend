export type AppConfig = {
  port: number;
  inviteCode: string;
  jwtSecret: string;
  jwtExpiresInSeconds: number;
  cookieSecure: boolean;
  allowedOrigins: string[];
  llmBaseUrl: string;
  databaseUrl: string;
  frontendGuestMode: boolean;
};

export function loadConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    port: Number(process.env.PORT ?? "8000"),
    inviteCode: process.env.HR_INVITE_CODE ?? "HR-INVITE-2026",
    jwtSecret: process.env.HR_JWT_SECRET ?? "change-me-in-production",
    jwtExpiresInSeconds: Number(process.env.HR_JWT_EXPIRE_SECONDS ?? "7200"),
    cookieSecure: (process.env.HR_COOKIE_SECURE ?? "false").toLowerCase() === "true",
    allowedOrigins: parseAllowedOrigins(process.env.HR_ALLOWED_ORIGINS),
    llmBaseUrl: process.env.HR_LLM_BASE_URL ?? "http://127.0.0.1:3000",
    databaseUrl: process.env.HR_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/hr",
    frontendGuestMode: (process.env.HR_FRONTEND_GUEST_MODE ?? "false").toLowerCase() === "true",
    ...overrides
  };
}

function parseAllowedOrigins(value: string | undefined) {
  if (!value) {
    return [
      "https://nl.ourelephant.ru",
      "http://localhost:5173",
      "http://127.0.0.1:5173"
    ];
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
