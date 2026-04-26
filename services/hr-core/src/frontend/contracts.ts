import { z } from "zod";

export const frontendCandidateStages = [
  "New",
  "Screened",
  "Interview",
  "Offer",
  "Archived",
] as const;

export const frontendVacancyWeightsSchema = z.object({
  experience: z.number(),
  skills: z.number(),
  schedule: z.number(),
  location: z.number(),
  motivation: z.number(),
  readiness: z.number(),
  communication: z.number(),
});

export const frontendVacancyInputSchema = z.object({
  title: z.string().min(2).max(255),
  description: z.string().min(2).max(4000),
  responsibilities: z.string().default(""),
  mustHaves: z.string().default(""),
  niceToHaves: z.string().default(""),
  stopFactors: z.string().default(""),
  conditions: z.string().default(""),
  weights: frontendVacancyWeightsSchema.default({
    experience: 30,
    skills: 25,
    schedule: 10,
    location: 10,
    motivation: 10,
    readiness: 10,
    communication: 5,
  }),
  status: z.enum(["Active", "Closed"]).default("Active"),
});

export const frontendVacancySchema = frontendVacancyInputSchema.extend({
  id: z.string(),
  updatedAt: z.string(),
});

export const frontendCandidateStageSchema = z.enum(frontendCandidateStages);

export const frontendCandidateSummarySchema = z.object({
  id: z.string(),
  vacancyId: z.string(),
  name: z.string(),
  role: z.string(),
  company: z.string(),
  experience: z.string(),
  matchScore: z.number(),
  stage: frontendCandidateStageSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const frontendAnalyticsSchema = z.object({
  totalCandidates: z.number(),
  strongMatches: z.number(),
  toReview: z.number(),
  interviews: z.number(),
  offers: z.number(),
  pipeline: z.object({
    sourced: z.number(),
    screened: z.number(),
    shortlisted: z.number(),
    interview: z.number(),
    offer: z.number(),
  }),
  matchesOverTime: z.array(
    z.object({
      label: z.string(),
      value: z.number(),
    }),
  ),
  topRoles: z.array(
    z.object({
      role: z.string(),
      count: z.number(),
    }),
  ),
  keySignals: z.array(
    z.object({
      name: z.string(),
      value: z.number(),
    }),
  ),
});

export const frontendDashboardBootstrapSchema = z.object({
  vacancies: z.array(frontendVacancySchema),
  candidates: z.array(frontendCandidateSummarySchema),
  analytics: frontendAnalyticsSchema,
});

export const frontendScreeningQuestionSchema = z
  .object({
    id: z.string(),
    text: z.string(),
    signal: z.string().optional(),
    type: z.string().optional(),
    options: z.array(z.string()).optional(),
  })
  .passthrough();

export const frontendCandidateProfileSchema = z
  .object({
    candidateId: z.string().optional(),
    name: z.string().nullable().optional(),
  })
  .passthrough()
  .nullable();

export const screeningSessionDraftSchema = z.object({
  vacancyId: z.string(),
  resumeText: z.string().min(1),
  resumeFileName: z.string().nullable().optional(),
  resumeFileSizeBytes: z.number().int().nonnegative().nullable().optional(),
});

export const screeningSessionPreparedSchema = z.object({
  candidateProfile: frontendCandidateProfileSchema,
  clarifyingQuestions: z.array(frontendScreeningQuestionSchema),
  resumeText: z.string().optional(),
});

export const frontendRankResultSchema = z
  .object({
    candidateId: z.string(),
    finalScore: z.number(),
    tier: z.string(),
    recommendedAction: z.string(),
    fitSummary: z.string(),
    topAdvantages: z.array(z.string()),
    topConcerns: z.array(z.string()),
    evidence: z.array(
      z.object({
        label: z.string(),
        score: z.number(),
        evidence: z.string(),
      }),
    ),
    missingInfo: z.array(z.string()),
    possibleAlternativeRoles: z.array(
      z.object({
        role: z.string(),
        reason: z.string(),
      }),
    ),
    hrExplanation: z.string(),
    neutralCandidateReply: z.string(),
  })
  .passthrough();

export const screeningSessionCompletedSchema = z.object({
  answers: z.record(z.string(), z.string()),
  signals: z.record(z.string(), z.unknown()).nullable().optional(),
  rankResult: frontendRankResultSchema,
});

export type FrontendVacancyWeights = z.infer<typeof frontendVacancyWeightsSchema>;
export type FrontendVacancyInput = z.infer<typeof frontendVacancyInputSchema>;
export type FrontendVacancy = z.infer<typeof frontendVacancySchema>;
export type FrontendCandidateStage = z.infer<typeof frontendCandidateStageSchema>;
export type FrontendCandidateSummary = z.infer<
  typeof frontendCandidateSummarySchema
>;
export type FrontendDashboardBootstrap = z.infer<
  typeof frontendDashboardBootstrapSchema
>;
export type FrontendVacancyStatus = z.infer<typeof frontendVacancySchema>["status"];

export function splitMultilineField(value: string | null | undefined): string[] {
  if (!value) return [];

  return String(value)
    .split("\n")
    .map((item) => item.replace(/^[\-\u2022]\s*/, "").trim())
    .filter(Boolean);
}

export function joinMultilineField(items: string[] | null | undefined): string {
  if (!Array.isArray(items) || items.length === 0) {
    return "";
  }

  return items.map((item) => `- ${String(item).trim()}`).join("\n");
}

export function collapseFrontendWeightsToAgentiki(weights: FrontendVacancyWeights) {
  const total =
    Number(weights.experience) +
    Number(weights.skills) +
    Number(weights.communication) +
    Number(weights.schedule) +
    Number(weights.location) +
    Number(weights.readiness) +
    Number(weights.motivation);

  const safeTotal = total > 0 ? total : 1;

  return normalizeAgentikiWeights({
    experience: Number(weights.experience) / safeTotal,
    skills:
      (Number(weights.skills) + Number(weights.communication)) / safeTotal,
    schedule:
      (Number(weights.schedule) +
        Number(weights.location) +
        Number(weights.readiness)) /
      safeTotal,
    motivation: Number(weights.motivation) / safeTotal,
  });
}

function normalizeAgentikiWeights(weights: {
  experience: number;
  skills: number;
  schedule: number;
  motivation: number;
}) {
  const total =
    Number(weights.experience) +
    Number(weights.skills) +
    Number(weights.schedule) +
    Number(weights.motivation);

  if (total <= 0) {
    return {
      experience: 0.25,
      skills: 0.25,
      schedule: 0.25,
      motivation: 0.25,
    };
  }

  return {
    experience: Number(weights.experience) / total,
    skills: Number(weights.skills) / total,
    schedule: Number(weights.schedule) / total,
    motivation: Number(weights.motivation) / total,
  };
}
