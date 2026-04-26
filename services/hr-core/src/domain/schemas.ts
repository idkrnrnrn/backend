import { z } from "zod";
import { applicationStages, candidateTones } from "./types.js";

export const registerSchema = z.object({
  email: z.string().email().transform((value) => value.toLowerCase()),
  login: z.string().min(3).max(100),
  password: z.string().min(8).max(128),
  invite_code: z.string().min(4).max(128)
});

export const loginSchema = z.object({
  email: z.string().email().transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(128)
});

export const vacancyCreateSchema = z.object({
  title: z.string().min(2).max(255),
  description: z.string().min(20).max(4000),
  location: z.string().min(2).max(255),
  role: z.string().min(2).max(255),
  mandatory_requirements: z.array(z.string()).default([]),
  optional_requirements: z.array(z.string()).default([]),
  work_schedule: z.string().min(2).max(255),
  salary_format: z.string().min(2).max(255),
  candidate_tone: z.enum(candidateTones),
  apply_url: z.string().url()
});

export const applicationCreateSchema = z.object({
  vacancy_id: z.string().uuid(),
  candidate_email: z.string().email().transform((value) => value.toLowerCase()),
  resume_text: z.string().min(100)
});

export const answersUpdateSchema = z.object({
  answers: z.record(z.string())
});

export const stageUpdateSchema = z.object({
  stage: z.enum(applicationStages)
});
