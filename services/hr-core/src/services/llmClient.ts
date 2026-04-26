import { z } from "zod";
import type { AppConfig } from "../config/env.js";
import type { ScreeningRequest, ScreeningResult } from "../domain/types.js";

const screeningResultSchema = z.object({
  clarifying_questions: z.array(z.string()),
  score: z.number(),
  score_reasons: z.array(z.string()),
  risks_to_clarify: z.array(z.string())
});

export interface LLMClient {
  screenResume(payload: ScreeningRequest): Promise<ScreeningResult>;
}

export class HttpLLMClient implements LLMClient {
  constructor(private readonly config: AppConfig) {}

  async screenResume(payload: ScreeningRequest): Promise<ScreeningResult> {
    const response = await fetch(`${this.config.llmBaseUrl.replace(/\/$/, "")}/v1/screen`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        resume_text: payload.resumeText,
        mandatory_requirements: payload.mandatoryRequirements,
        optional_requirements: payload.optionalRequirements
      })
    });

    if (!response.ok) {
      throw new Error(`LLM screening failed with status ${response.status}`);
    }

    const parsed = screeningResultSchema.parse(await response.json());
    return {
      clarifyingQuestions: parsed.clarifying_questions,
      score: parsed.score,
      scoreReasons: parsed.score_reasons,
      risksToClarify: parsed.risks_to_clarify
    };
  }
}
