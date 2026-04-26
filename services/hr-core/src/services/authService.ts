import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { AppConfig } from "../config/env.js";
import { AppError } from "../domain/errors.js";
import { ACCESS_COOKIE_NAME, type HRUser } from "../domain/types.js";
import type { InMemoryRepository } from "../infra/repository.js";

type JwtPayload = {
  sub: string;
};

export class AuthService {
  constructor(
    private readonly repo: InMemoryRepository,
    private readonly config: AppConfig
  ) {}

  async register(input: { email: string; login: string; password: string; invite_code: string }): Promise<HRUser> {
    if (input.invite_code !== this.config.inviteCode) {
      throw new AppError(403, "Invalid invitation code");
    }

    if (this.repo.findUserByEmail(input.email) || this.repo.findUserByLogin(input.login)) {
      throw new AppError(409, "User with this email or login already exists");
    }

    const passwordHash = await bcrypt.hash(input.password, 12);
    return this.repo.createUser({
      email: input.email,
      login: input.login,
      passwordHash
    });
  }

  async authenticate(input: { email: string; password: string }): Promise<HRUser> {
    const user = this.repo.findUserByEmail(input.email);
    if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
      throw new AppError(401, "Invalid email or password");
    }
    return user;
  }

  createAccessToken(user: HRUser): string {
    return jwt.sign({ sub: user.id } satisfies JwtPayload, this.config.jwtSecret, {
      expiresIn: this.config.jwtExpiresInSeconds
    });
  }

  getUserFromToken(token: string | undefined): HRUser {
    if (!token) {
      throw new AppError(401, "Not authenticated");
    }

    try {
      const payload = jwt.verify(token, this.config.jwtSecret) as JwtPayload;
      const user = this.repo.findUserById(payload.sub);
      if (!user) {
        throw new AppError(401, "User not found");
      }
      return user;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(401, "Invalid token");
    }
  }

  cookieOptions() {
    return {
      httpOnly: true,
      secure: this.config.cookieSecure,
      sameSite: "lax" as const,
      path: "/",
      maxAge: this.config.jwtExpiresInSeconds
    };
  }

  cookieName(): typeof ACCESS_COOKIE_NAME {
    return ACCESS_COOKIE_NAME;
  }
}
