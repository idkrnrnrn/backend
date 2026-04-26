import { z } from "zod";
import type { AppConfig } from "../config/env.js";
import type {
  PrepareScreeningRequest,
  PrepareScreeningResult,
  RankCandidateRequest,
  RankCandidateResult,
  ScreeningQuestion
} from "../domain/types.js";

const prepareScreeningResponseSchema = z
  .object({
    profile: z.record(z.unknown()).nullable().optional(),
    candidateProfile: z.record(z.unknown()).nullable().optional(),
    questions: z.array(z.unknown()).optional(),
    screeningQuestions: z.array(z.unknown()).optional()
  })
  .passthrough();

const rankCandidateResponseSchema = z
  .object({
    signals: z.array(z.unknown()).optional().default([]),
    rankResult: z.record(z.unknown()).optional().default({})
  })
  .passthrough();

export interface LLMClient {
  prepareScreening(payload: PrepareScreeningRequest): Promise<PrepareScreeningResult>;
  rankCandidate(payload: RankCandidateRequest): Promise<RankCandidateResult>;
}

export class HttpLLMClient implements LLMClient {
  constructor(private readonly config: AppConfig) {}

  async prepareScreening(payload: PrepareScreeningRequest): Promise<PrepareScreeningResult> {
    const response = await fetch(`${this.config.llmBaseUrl.replace(/\/$/, "")}/api/prepare-screening`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        vacancy: presentVacancyForLLM(payload.vacancy),
        pdfText: payload.resumeText
      })
    });

    if (!response.ok) {
      throw new Error(`LLM prepare-screening failed with status ${response.status}`);
    }

    const parsed = prepareScreeningResponseSchema.parse(await response.json());
    return {
      candidateProfile: parsed.profile ?? parsed.candidateProfile ?? null,
      clarifyingQuestions: normalizeQuestions(parsed.questions ?? parsed.screeningQuestions ?? [])
    };
  }

  async rankCandidate(payload: RankCandidateRequest): Promise<RankCandidateResult> {
    const response = await fetch(`${this.config.llmBaseUrl.replace(/\/$/, "")}/api/rank-candidate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        vacancy: presentVacancyForLLM(payload.vacancy),
        profile: payload.candidateProfile ?? {},
        questions: payload.clarifyingQuestions.map((question) => ({
          questionId: question.id,
          text: question.text
        })),
        answers: payload.clarifyingQuestions.map((question) => ({
          questionId: question.id,
          answer: payload.answers[question.id] ?? ""
        }))
      })
    });

    if (!response.ok) {
      throw new Error(`LLM rank-candidate failed with status ${response.status}`);
    }

    const parsed = rankCandidateResponseSchema.parse(await response.json());
    const rankResult = parsed.rankResult;

    return {
      score: extractScore(rankResult),
      scoreReasons: extractScoreReasons(rankResult, parsed.signals),
      risksToClarify: extractRisks(rankResult, parsed.signals)
    };
  }
}

function presentVacancyForLLM(vacancy: PrepareScreeningRequest["vacancy"]) {
  return {
    id: vacancy.id,
    title: vacancy.title,
    description: vacancy.description,
    location: vacancy.location,
    role: vacancy.role,
    mandatory_requirements: vacancy.mandatoryRequirements,
    optional_requirements: vacancy.optionalRequirements,
    work_schedule: vacancy.workSchedule,
    salary_format: vacancy.salaryFormat,
    candidate_tone: vacancy.candidateTone,
    apply_url: vacancy.applyUrl
  };
}

function normalizeQuestions(items: unknown[]): string[] {
  return items
    .map((item, index) => normalizeQuestion(item, index))
    .filter((item): item is ScreeningQuestion => item !== null)
    .map((item) => item.text);
}

function normalizeQuestion(item: unknown, index: number): ScreeningQuestion | null {
  if (typeof item === "string" && item.trim().length > 0) {
    return { id: `q${index + 1}`, text: item };
  }

  if (item && typeof item === "object") {
    const record = item as Record<string, unknown>;
    const id = getString(record.questionId) ?? getString(record.id) ?? `q${index + 1}`;
    const text =
      getString(record.text) ??
      getString(record.question) ??
      getString(record.prompt) ??
      getString(record.title);

    if (text) {
      return { id, text };
    }
  }

  return null;
}

function extractScore(rankResult: Record<string, unknown>): number {
  const candidates = [
    rankResult.score,
    rankResult.totalScore,
    rankResult.finalScore,
    rankResult.rankScore,
    rankResult.percent
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return candidate;
    }
  }

  return 0;
}

function extractScoreReasons(rankResult: Record<string, unknown>, signals: unknown[]): string[] {
  return extractStringArray(rankResult.reasons)
    ?? extractStringArray(rankResult.scoreReasons)
    ?? signals
      .map((signal) => signalToReason(signal, false))
      .filter((item): item is string => item !== null);
}

function extractRisks(rankResult: Record<string, unknown>, signals: unknown[]): string[] {
  return extractStringArray(rankResult.risks)
    ?? extractStringArray(rankResult.risksToClarify)
    ?? signals
      .map((signal) => signalToReason(signal, true))
      .filter((item): item is string => item !== null);
}

function extractStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function signalToReason(signal: unknown, wantRisk: boolean): string | null {
  if (!signal || typeof signal !== "object") return null;
  const record = signal as Record<string, unknown>;
  const kind = getString(record.type)?.toLowerCase() ?? getString(record.kind)?.toLowerCase() ?? "";
  const text =
    getString(record.reason) ??
    getString(record.text) ??
    getString(record.description) ??
    getString(record.message);

  if (!text) return null;
  if (wantRisk) {
    return kind.includes("risk") || kind.includes("clarif") || kind.includes("weak") ? text : null;
  }
  return kind.includes("risk") || kind.includes("clarif") || kind.includes("weak") ? null : text;
}

function getString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}
