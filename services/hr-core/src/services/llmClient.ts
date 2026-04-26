import { z } from "zod";
import {
  collapseFrontendWeightsToAgentiki,
  splitMultilineField
} from "../frontend/contracts.js";
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
    profile: z.record(z.string(), z.unknown()).nullable().optional(),
    candidateProfile: z.record(z.string(), z.unknown()).nullable().optional(),
    questions: z.array(z.unknown()).optional(),
    screeningQuestions: z.array(z.unknown()).optional()
  })
  .passthrough();

const rankCandidateResponseSchema = z
  .object({
    signals: z.record(z.string(), z.unknown()).optional().default({}),
    rankResult: z.record(z.string(), z.unknown()).optional().default({})
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
    mustHave:
      splitMultilineField(vacancy.mustHaves).length > 0
        ? splitMultilineField(vacancy.mustHaves)
        : vacancy.mandatoryRequirements,
    niceToHave:
      splitMultilineField(vacancy.niceToHaves).length > 0
        ? splitMultilineField(vacancy.niceToHaves)
        : vacancy.optionalRequirements,
    responsibilities: splitMultilineField(vacancy.responsibilities),
    schedule: vacancy.workSchedule,
    location: vacancy.location,
    salary: vacancy.salaryFormat,
    weights: collapseFrontendWeightsToAgentiki(vacancy.weights),
    dealBreakers: splitMultilineField(vacancy.stopFactors)
  };
}

function normalizeQuestions(items: unknown[]): ScreeningQuestion[] {
  return items
    .map((item, index) => normalizeQuestion(item, index))
    .filter((item): item is ScreeningQuestion => item !== null);
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
      return {
        id,
        text,
        signal: getString(record.signal) ?? undefined,
        type: getString(record.type) ?? undefined,
        options: Array.isArray(record.options)
          ? record.options.filter((option): option is string => typeof option === "string" && option.trim().length > 0)
          : undefined
      };
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

function extractScoreReasons(rankResult: Record<string, unknown>, signals: Record<string, unknown>): string[] {
  return extractStringArray(rankResult.reasons)
    ?? extractStringArray(rankResult.scoreReasons)
    ?? extractStringArray(rankResult.topAdvantages)
    ?? extractStringArray(signals.strengths)
    ?? [];
}

function extractRisks(rankResult: Record<string, unknown>, signals: Record<string, unknown>): string[] {
  return extractStringArray(rankResult.risks)
    ?? extractStringArray(rankResult.risksToClarify)
    ?? extractStringArray(rankResult.topConcerns)
    ?? extractStringArray(signals.concerns)
    ?? extractStringArray(rankResult.missingInfo)
    ?? extractStringArray(signals.missingInfo)
    ?? failedMustHaveReasons(signals.mustHave)
    ?? [];
}

function extractStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function failedMustHaveReasons(value: unknown): string[] | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  return extractStringArray(record.failedReasons);
}

function getString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}
