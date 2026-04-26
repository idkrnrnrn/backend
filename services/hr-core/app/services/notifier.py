def send_clarifying_questions(candidate_email: str, questions: list[str]) -> None:
    # Production: call dedicated notification service (email/chatbot) via queue.
    _ = (candidate_email, questions)
