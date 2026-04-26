import { AppError } from "../domain/errors.js";
import type { Application } from "../domain/types.js";
import type { Repository } from "../infra/repository.js";
import type { LLMClient } from "./llmClient.js";

export class ApplicationService {
  constructor(
    private readonly repo: Repository,
    private readonly llmClient: LLMClient
  ) {}

  async createApplication(input: {
    vacancyId: string;
    candidateEmail: string;
    resumeText: string;
  }): Promise<Application> {
    const vacancy = await this.repo.findVacancyById(input.vacancyId);
    if (!vacancy) {
      throw new AppError(404, "Vacancy not found");
    }

    const screening = await this.llmClient.prepareScreening({
      vacancy,
      resumeText: input.resumeText
    });

    return await this.repo.createApplication({
      vacancyId: input.vacancyId,
      candidateEmail: input.candidateEmail,
      stage: "questions_sent",
      resumeText: input.resumeText,
      answers: {},
      candidateProfile: screening.candidateProfile,
      clarifyingQuestions: screening.clarifyingQuestions,
      score: null,
      scoreReasons: [],
      risksToClarify: []
    });
  }

  async submitAnswers(applicationId: string, answers: Record<string, string>): Promise<Application> {
    const application = await this.repo.findApplicationById(applicationId);
    if (!application) {
      throw new AppError(404, "Application not found");
    }

    const vacancy = await this.repo.findVacancyById(application.vacancyId);
    if (!vacancy) {
      throw new AppError(404, "Vacancy not found");
    }

    const clarifyingQuestions = application.clarifyingQuestions.map((question, index) => ({
      id: `q${index + 1}`,
      text: question
    }));

    const ranking = await this.llmClient.rankCandidate({
      vacancy,
      candidateProfile: application.candidateProfile,
      clarifyingQuestions,
      answers
    });

    const updated = await this.repo.updateApplication(applicationId, {
      answers,
      stage: "in_review",
      score: ranking.score,
      scoreReasons: ranking.scoreReasons,
      risksToClarify: ranking.risksToClarify
    });

    if (!updated) {
      throw new AppError(404, "Application not found");
    }

    return updated;
  }
}
