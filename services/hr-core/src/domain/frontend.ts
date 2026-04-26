import {
  frontendDashboardBootstrapSchema,
  frontendVacancyInputSchema,
  joinMultilineField,
  splitMultilineField,
  type FrontendCandidateStage,
  type FrontendCandidateSummary,
  type FrontendDashboardBootstrap,
  type FrontendVacancy,
  type FrontendVacancyInput,
  type FrontendVacancyWeights
} from "../frontend/contracts.js";
import type { Application, ApplicationStage, Vacancy } from "./types.js";

export const DEFAULT_FRONTEND_WEIGHTS: FrontendVacancyWeights = {
  experience: 30,
  skills: 25,
  schedule: 10,
  location: 10,
  motivation: 10,
  readiness: 10,
  communication: 5
};

export function parseFrontendVacancyInput(input: unknown): FrontendVacancyInput {
  return frontendVacancyInputSchema.parse(input);
}

export function presentFrontendVacancy(vacancy: Vacancy): FrontendVacancy {
  return {
    id: vacancy.id,
    title: vacancy.title,
    description: vacancy.description,
    responsibilities: vacancy.responsibilities,
    mustHaves: vacancy.mustHaves,
    niceToHaves: vacancy.niceToHaves,
    stopFactors: vacancy.stopFactors,
    conditions: vacancy.conditions,
    weights: vacancy.weights,
    status: vacancy.status,
    updatedAt: vacancy.updatedAt
  };
}

export function presentFrontendCandidateSummary(
  application: Application,
  vacancy: Vacancy
): FrontendCandidateSummary {
  const profile = toRecord(application.candidateProfile);
  const primaryExperience = firstWorkExperience(profile);
  const name = deriveCandidateName(application, profile);

  return {
    id: application.id,
    vacancyId: application.vacancyId,
    name,
    role: deriveRole(profile, primaryExperience, vacancy),
    company: deriveCompany(primaryExperience),
    experience: deriveExperience(profile, primaryExperience),
    matchScore: deriveMatchScore(application),
    stage: legacyStageToFrontendStage(application.stage),
    createdAt: application.createdAt,
    updatedAt: application.updatedAt
  };
}

export function buildFrontendVacancyFromLegacy(
  vacancy: Omit<
    Vacancy,
    | "responsibilities"
    | "mustHaves"
    | "niceToHaves"
    | "stopFactors"
    | "conditions"
    | "weights"
    | "status"
  >
): Vacancy {
  const conditions = compactMultiline([
    vacancy.workSchedule,
    vacancy.location,
    vacancy.salaryFormat
  ]);

  return {
    ...vacancy,
    responsibilities: "",
    mustHaves: joinMultilineField(vacancy.mandatoryRequirements),
    niceToHaves: joinMultilineField(vacancy.optionalRequirements),
    stopFactors: "",
    conditions,
    weights: DEFAULT_FRONTEND_WEIGHTS,
    status: "Active"
  };
}

export function buildDomainVacancyFromFrontend(
  input: FrontendVacancyInput
): Omit<Vacancy, "id" | "createdAt" | "updatedAt"> {
  const conditionLines = splitMultilineField(input.conditions);

  return {
    title: input.title,
    description: input.description,
    responsibilities: input.responsibilities,
    mustHaves: input.mustHaves,
    niceToHaves: input.niceToHaves,
    stopFactors: input.stopFactors,
    conditions: input.conditions,
    weights: input.weights,
    status: input.status,
    location: firstMatchingLine(conditionLines, /(remote|hybrid|office|location|warsaw|moscow|europe|poland|cet|gmt|utc)/i)
      ?? firstNonEmpty(conditionLines)
      ?? "Not specified",
    role: input.title,
    mandatoryRequirements: splitMultilineField(input.mustHaves),
    optionalRequirements: splitMultilineField(input.niceToHaves),
    workSchedule:
      firstMatchingLine(conditionLines, /(full-time|part-time|schedule|hours|shift|on-call|core collaboration)/i)
      ?? firstNonEmpty(conditionLines)
      ?? "Not specified",
    salaryFormat:
      firstMatchingLine(
        conditionLines,
        /(salary|\$|\beur\b|\busd\b|\brub\b|\bpln\b|compensation)/i
      )
      ?? "Not specified",
    candidateTone: "neutral",
    applyUrl: "https://screenr.local/apply"
  };
}

export function legacyStageToFrontendStage(stage: ApplicationStage): FrontendCandidateStage {
  if (
    stage === "new" ||
    stage === "questions_sent" ||
    stage === "chat_not_joined" ||
    stage === "questions_unanswered"
  ) {
    return "New";
  }

  if (stage === "in_review") return "Screened";
  if (stage === "interview") return "Interview";
  if (stage === "hired") return "Offer";
  return "Archived";
}

export function frontendStageToLegacyStage(stage: FrontendCandidateStage): ApplicationStage {
  if (stage === "New") return "new";
  if (stage === "Screened") return "in_review";
  if (stage === "Interview") return "interview";
  if (stage === "Offer") return "hired";
  return "rejected";
}

export function buildBootstrap(
  vacancies: Vacancy[],
  applications: Application[]
): FrontendDashboardBootstrap {
  const vacancyMap = new Map(vacancies.map((vacancy) => [vacancy.id, vacancy]));
  const candidates = applications
    .map((application) => {
      const vacancy = vacancyMap.get(application.vacancyId);
      return vacancy ? presentFrontendCandidateSummary(application, vacancy) : null;
    })
    .filter((candidate): candidate is FrontendCandidateSummary => candidate !== null);

  const payload = {
    vacancies: vacancies.map(presentFrontendVacancy),
    candidates,
    analytics: buildAnalytics(candidates, vacancies)
  };

  return frontendDashboardBootstrapSchema.parse(payload);
}

function buildAnalytics(candidates: FrontendCandidateSummary[], vacancies: Vacancy[]) {
  const stageCounts = {
    New: 0,
    Screened: 0,
    Interview: 0,
    Offer: 0,
    Archived: 0
  } satisfies Record<FrontendCandidateStage, number>;

  for (const candidate of candidates) {
    stageCounts[candidate.stage] += 1;
  }

  const strongMatches = candidates.filter((candidate) => candidate.matchScore >= 90).length;
  const topRoles = roleDistribution(candidates);
  const weights = averageWeights(vacancies);

  return {
    totalCandidates: candidates.length,
    strongMatches,
    toReview: stageCounts.New,
    interviews: stageCounts.Interview,
    offers: stageCounts.Offer,
    pipeline: {
      sourced: candidates.length,
      screened: stageCounts.Screened,
      shortlisted: strongMatches,
      interview: stageCounts.Interview,
      offer: stageCounts.Offer
    },
    matchesOverTime: matchesOverTime(candidates),
    topRoles,
    keySignals: [
      { name: "Experience", value: Math.round(weights.experience) },
      { name: "Skills", value: Math.round(weights.skills) },
      { name: "Schedule fit", value: Math.round(weights.schedule + weights.location + weights.readiness) },
      { name: "Motivation", value: Math.round(weights.motivation) },
      { name: "Communication", value: Math.round(weights.communication) }
    ]
  };
}

function matchesOverTime(candidates: FrontendCandidateSummary[]) {
  const sorted = [...candidates].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const lastItems = sorted.slice(-14);
  return lastItems.map((candidate, index) => ({
    label: formatShortDate(candidate.createdAt, index),
    value: candidate.matchScore
  }));
}

function roleDistribution(candidates: FrontendCandidateSummary[]) {
  const counts = new Map<string, number>();
  for (const candidate of candidates) {
    counts.set(candidate.role, (counts.get(candidate.role) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5)
    .map(([role, count]) => ({ role, count }));
}

function averageWeights(vacancies: Vacancy[]): FrontendVacancyWeights {
  if (vacancies.length === 0) {
    return DEFAULT_FRONTEND_WEIGHTS;
  }

  const total = vacancies.reduce<FrontendVacancyWeights>(
    (acc, vacancy) => ({
      experience: acc.experience + vacancy.weights.experience,
      skills: acc.skills + vacancy.weights.skills,
      schedule: acc.schedule + vacancy.weights.schedule,
      location: acc.location + vacancy.weights.location,
      motivation: acc.motivation + vacancy.weights.motivation,
      readiness: acc.readiness + vacancy.weights.readiness,
      communication: acc.communication + vacancy.weights.communication
    }),
    {
      experience: 0,
      skills: 0,
      schedule: 0,
      location: 0,
      motivation: 0,
      readiness: 0,
      communication: 0
    }
  );

  return {
    experience: total.experience / vacancies.length,
    skills: total.skills / vacancies.length,
    schedule: total.schedule / vacancies.length,
    location: total.location / vacancies.length,
    motivation: total.motivation / vacancies.length,
    readiness: total.readiness / vacancies.length,
    communication: total.communication / vacancies.length
  };
}

function deriveCandidateName(
  application: Application,
  profile: Record<string, unknown>
) {
  const direct = profile.name;
  if (typeof direct === "string" && direct.trim().length > 0) {
    return direct.trim();
  }

  const localPart = application.candidateEmail.split("@")[0] ?? "candidate";
  return localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map(capitalizeWord)
    .join(" ");
}

function deriveRole(
  profile: Record<string, unknown>,
  experience: Record<string, unknown> | null,
  vacancy: Vacancy
) {
  const position = getString(experience?.position);
  if (position) return position;

  const stacks = getStringArray(profile.primary_stack);
  if (stacks.length > 0) {
    return `${stacks.slice(0, 2).join(" / ")} Specialist`;
  }

  const seniority = getString(profile.seniority);
  if (seniority) {
    return `${capitalizeWord(seniority)} ${vacancy.title}`;
  }

  return vacancy.title;
}

function deriveCompany(experience: Record<string, unknown> | null) {
  return getString(experience?.company) ?? "Independent";
}

function deriveExperience(
  profile: Record<string, unknown>,
  experience: Record<string, unknown> | null
) {
  const totalMonths = getNumber(profile.totalExperienceMonths) ?? getNumber(experience?.durationMonths);
  if (typeof totalMonths === "number" && totalMonths > 0) {
    if (totalMonths >= 12) {
      return `${Math.max(1, Math.round(totalMonths / 12))} yrs`;
    }
    return `${totalMonths} mos`;
  }

  const seniority = getString(profile.seniority);
  if (seniority) {
    return `${capitalizeWord(seniority)}`;
  }

  return "N/A";
}

function deriveMatchScore(application: Application) {
  const rankResultScore = getNumber(toRecord(application.rankResult).finalScore);
  if (typeof rankResultScore === "number") return rankResultScore;
  if (typeof application.score === "number") return Math.round(application.score);
  return 0;
}

function firstWorkExperience(profile: Record<string, unknown>) {
  const workExperience = profile.workExperience;
  if (!Array.isArray(workExperience) || workExperience.length === 0) {
    return null;
  }

  const first = workExperience[0];
  return first && typeof first === "object" ? (first as Record<string, unknown>) : null;
}

function compactMultiline(values: Array<string | null | undefined>) {
  return values.filter((value): value is string => Boolean(value && value.trim())).join("\n");
}

function firstMatchingLine(lines: string[], pattern: RegExp) {
  return lines.find((line) => pattern.test(line));
}

function firstNonEmpty(lines: string[]) {
  return lines.find((line) => line.trim().length > 0);
}

function formatShortDate(value: string, fallbackIndex: number) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return `#${fallbackIndex + 1}`;
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric"
  });
}

function capitalizeWord(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function getNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function toRecord(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}
