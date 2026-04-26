import { randomUUID } from "node:crypto";
import type { Application, HRUser, Vacancy } from "../domain/types.js";

export class InMemoryRepository {
  private users = new Map<string, HRUser>();
  private vacancies = new Map<string, Vacancy>();
  private applications = new Map<string, Application>();

  createUser(input: Omit<HRUser, "id" | "createdAt">): HRUser {
    const user: HRUser = {
      ...input,
      id: randomUUID(),
      createdAt: new Date().toISOString()
    };
    this.users.set(user.id, user);
    return user;
  }

  findUserById(id: string): HRUser | null {
    return this.users.get(id) ?? null;
  }

  findUserByEmail(email: string): HRUser | null {
    return [...this.users.values()].find((user) => user.email === email) ?? null;
  }

  findUserByLogin(login: string): HRUser | null {
    return [...this.users.values()].find((user) => user.login === login) ?? null;
  }

  createVacancy(input: Omit<Vacancy, "id" | "createdAt" | "updatedAt">): Vacancy {
    const now = new Date().toISOString();
    const vacancy: Vacancy = {
      ...input,
      id: randomUUID(),
      createdAt: now,
      updatedAt: now
    };
    this.vacancies.set(vacancy.id, vacancy);
    return vacancy;
  }

  listVacancies(limit: number, offset: number): Vacancy[] {
    return [...this.vacancies.values()].slice(offset, offset + limit);
  }

  findVacancyById(id: string): Vacancy | null {
    return this.vacancies.get(id) ?? null;
  }

  createApplication(input: Omit<Application, "id" | "createdAt" | "updatedAt">): Application {
    const now = new Date().toISOString();
    const application: Application = {
      ...input,
      id: randomUUID(),
      createdAt: now,
      updatedAt: now
    };
    this.applications.set(application.id, application);
    return application;
  }

  findApplicationById(id: string): Application | null {
    return this.applications.get(id) ?? null;
  }

  updateApplication(id: string, patch: Partial<Omit<Application, "id" | "createdAt">>): Application | null {
    const current = this.applications.get(id);
    if (!current) return null;

    const updated: Application = {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString()
    };
    this.applications.set(id, updated);
    return updated;
  }
}
