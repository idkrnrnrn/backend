export const ACCESS_COOKIE_NAME = "hr_access_token";

export const candidateTones = ["zoomer", "boomer", "neutral"] as const;
export type CandidateTone = (typeof candidateTones)[number];

export const applicationStages = [
  "new",
  "questions_sent",
  "chat_not_joined",
  "questions_unanswered",
  "in_review",
  "interview",
  "rejected",
  "hired"
] as const;
export type ApplicationStage = (typeof applicationStages)[number];

export type HRUser = {
  id: string;
  email: string;
  login: string;
  passwordHash: string;
  createdAt: string;
};

export type Vacancy = {
  id: string;
  title: string;
  description: string;
  location: string;
  role: string;
  mandatoryRequirements: string[];
  optionalRequirements: string[];
  workSchedule: string;
  salaryFormat: string;
  candidateTone: CandidateTone;
  applyUrl: string;
  createdAt: string;
  updatedAt: string;
};

export type Application = {
  id: string;
  vacancyId: string;
  candidateEmail: string;
  stage: ApplicationStage;
  resumeText: string;
  answers: Record<string, string>;
  candidateProfile: Record<string, unknown> | null;
  clarifyingQuestions: string[];
  score: number | null;
  scoreReasons: string[];
  risksToClarify: string[];
  createdAt: string;
  updatedAt: string;
};

export type ScreeningQuestion = {
  id: string;
  text: string;
};

export type PrepareScreeningRequest = {
  vacancy: Vacancy;
  resumeText: string;
};

export type PrepareScreeningResult = {
  candidateProfile: Record<string, unknown> | null;
  clarifyingQuestions: string[];
};

export type RankCandidateRequest = {
  vacancy: Vacancy;
  candidateProfile: Record<string, unknown> | null;
  clarifyingQuestions: ScreeningQuestion[];
  answers: Record<string, string>;
};

export type RankCandidateResult = {
  score: number;
  scoreReasons: string[];
  risksToClarify: string[];
};
