from typing import Dict, Any
from core.llm.groq_adapter import GroqAdapter
from schemas.quiz import QuizGenerateRequest, QuizQuestionResponse

class QuizService:
    def __init__(self):
        self.llm = GroqAdapter()

    async def generate_quiz(self, req: QuizGenerateRequest) -> QuizQuestionResponse:
        prompt = (
            f"Generate a single multiple-choice grammar quiz question for learning {req.language}.\n"
            f"Topic/Theme: {req.theme}\n"
            f"Complexity level: {req.complexity} out of 5.\n"
            f"Provide exactly 4 options, state the zero-indexed integer of the correct option (0, 1, 2, or 3), "
            f"and give a concise explanation."
        )

        schema = {
            "question": "string",
            "options": ["string", "string", "string", "string"],
            "correct_option_index": 0,
            "explanation": "string"
        }

        res = await self.llm.generate_json(prompt, schema)

        return QuizQuestionResponse(
            question=res.get("question", ""),
            options=res.get("options", []),
            correct_option_index=int(res.get("correct_option_index", 0)),
            explanation=res.get("explanation", "")
        )