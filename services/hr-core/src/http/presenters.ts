import type { Application, HRUser, Vacancy } from "../domain/types.js";

export function presentUser(user: HRUser) {
  return {
    id: user.id,
    email: user.email,
    login: user.login,
    created_at: user.createdAt
  };
}

export function presentVacancy(vacancy: Vacancy) {
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
    apply_url: vacancy.applyUrl,
    created_at: vacancy.createdAt,
    updated_at: vacancy.updatedAt
  };
}

export function presentApplication(application: Application) {
  return {
    id: application.id,
    vacancy_id: application.vacancyId,
    candidate_email: application.candidateEmail,
    stage: application.stage,
    resume_text: application.resumeText,
    answers: application.answers,
    candidate_profile: application.candidateProfile,
    clarifying_questions: application.clarifyingQuestions,
    score: application.score,
    score_reasons: application.scoreReasons,
    risks_to_clarify: application.risksToClarify,
    created_at: application.createdAt,
    updated_at: application.updatedAt
  };
}
