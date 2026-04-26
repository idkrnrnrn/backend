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

    const screening = await this.llmClient.screenResume({
      resumeText: input.resumeText,
      mandatoryRequirements: vacancy.mandatoryRequirements,
      optionalRequirements: vacancy.optionalRequirements
    });

    return await this.repo.createApplication({
      vacancyId: input.vacancyId,
      candidateEmail: input.candidateEmail,
      stage: "questions_sent",
      resumeText: input.resumeText,
      answers: {},
      clarifyingQuestions: screening.clarifyingQuestions,
      score: screening.score,
      scoreReasons: screening.scoreReasons,
      risksToClarify: screening.risksToClarify
    });
  }
}
