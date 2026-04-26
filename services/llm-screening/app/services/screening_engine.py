import re

from app.schemas.screening import ScreeningRequest, ScreeningResponse


class ScreeningEngine:
    KEYWORDS = {
        "python": ["python", "fastapi", "django", "flask", "asyncio"],
        "data": ["sql", "postgres", "spark", "airflow", "pandas"],
        "devops": ["kubernetes", "docker", "terraform", "ci/cd", "prometheus"],
    }

    def run(self, payload: ScreeningRequest) -> ScreeningResponse:
        text = payload.resume_text.lower()
        score = 40.0
        reasons: list[str] = []
        risks: list[str] = []

        mandatory_hits = self._count_hits(payload.mandatory_requirements, text)
        optional_hits = self._count_hits(payload.optional_requirements, text)

        if payload.mandatory_requirements:
            ratio = mandatory_hits / max(1, len(payload.mandatory_requirements))
            score += ratio * 40
            reasons.append(f"Покрытие обязательных требований: {mandatory_hits}/{len(payload.mandatory_requirements)}")
            if ratio < 0.6:
                risks.append("Недостаточное покрытие обязательных требований")

        if payload.optional_requirements:
            ratio = optional_hits / max(1, len(payload.optional_requirements))
            score += ratio * 20
            reasons.append(f"Покрытие желательных требований: {optional_hits}/{len(payload.optional_requirements)}")

        seniority_signal = self._infer_seniority(text)
        reasons.append(f"Оценка seniority сигнала: {seniority_signal}")
        if seniority_signal == "junior":
            risks.append("Проверить глубину опыта в production")

        questions = self._build_questions(payload, text)
        score = max(0.0, min(100.0, round(score, 2)))

        return ScreeningResponse(
            clarifying_questions=questions,
            score=score,
            score_reasons=reasons,
            risks_to_clarify=risks,
        )

    def _count_hits(self, requirements: list[str], text: str) -> int:
        hits = 0
        for req in requirements:
            req_norm = req.strip().lower()
            if not req_norm:
                continue
            if req_norm in text:
                hits += 1
                continue

            for kw_list in self.KEYWORDS.values():
                if req_norm in kw_list and any(kw in text for kw in kw_list):
                    hits += 1
                    break
        return hits

    def _infer_seniority(self, text: str) -> str:
        years = [int(num) for num in re.findall(r"(\\d+)\\+?\\s*(?:years|лет|год)", text)]
        max_years = max(years) if years else 0
        if max_years >= 6:
            return "senior"
        if max_years >= 3:
            return "middle"
        return "junior"

    def _build_questions(self, payload: ScreeningRequest, text: str) -> list[str]:
        questions: list[str] = []

        missing_mandatory = [req for req in payload.mandatory_requirements if req.lower() not in text]
        for req in missing_mandatory[:3]:
            questions.append(f"Опишите ваш практический опыт с требованием: {req}.")

        if "kubernetes" not in text and any("k8s" in req.lower() or "kubernetes" in req.lower() for req in payload.optional_requirements):
            questions.append("Есть ли у вас опыт эксплуатации Kubernetes в production?")

        if "english" not in text and "англий" not in text:
            questions.append("Какой у вас уровень английского и опыт коммуникации в международной команде?")

        if not questions:
            questions.append("Какие достижения в последних проектах вы считаете ключевыми для этой роли?")

        return questions
