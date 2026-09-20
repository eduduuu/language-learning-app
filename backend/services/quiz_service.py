from typing import Dict, Any, Optional
from core.llm.groq_adapter import GroqAdapter
from core.grammar import get_grammar_engine
from schemas.quiz import (
    QuizGenerateRequest,
    QuizQuestionResponse,
    QuizClozeRequest,
    QuizClozeResponse
)
from repositories.quiz_repository import QuizRepository

class QuizService:
    def __init__(self):
        self.llm = GroqAdapter()

    async def generate_quiz(
        self,
        req: QuizGenerateRequest,
        user_id: Optional[str] = None
    ) -> QuizQuestionResponse:
        # 1. Check pre-seeded database question bank first (filtering out already answered questions)
        preseeded = QuizRepository.get_preseeded_question(
            user_id=user_id,
            topic_id=req.topic_id,
            theme=req.theme,
            language=req.language
        )
        if preseeded:
            return QuizQuestionResponse(
                id=preseeded.get("id"),
                question=preseeded["question"],
                options=preseeded["options"],
                correct_option_index=preseeded["correct_option_index"],
                explanation=preseeded["explanation"],
                topic_id=preseeded.get("topic_id"),
                rule_explanation=preseeded.get("rule_explanation"),
                source="preseeded"
            )

        # 2. Check modular OOP rule engine for deterministic question (0 LLM cost)
        engine = get_grammar_engine(req.language)
        rule_question = engine.generate_rule_question(req.theme, req.complexity)
        if rule_question:
            return QuizQuestionResponse(
                question=rule_question["question"],
                options=rule_question["options"],
                correct_option_index=rule_question["correct_option_index"],
                explanation=rule_question["explanation"],
                source="rule_engine"
            )

        # 3. Fallback to LLM if pre-seeded bank is exhausted or custom theme requested
        if req.use_preseeded_only:
            # Fall back to a default rule question instead of failing
            fallback = engine.generate_rule_question("verbs", req.complexity)
            if fallback:
                return QuizQuestionResponse(
                    question=fallback["question"],
                    options=fallback["options"],
                    correct_option_index=fallback["correct_option_index"],
                    explanation=fallback["explanation"],
                    source="rule_engine"
                )

        prompt = (
            f"Generate a single multiple-choice grammar quiz question for learning {req.language}.\n"
            f"Topic/Theme: {req.theme}\n"
            f"Complexity level: {req.complexity} out of 5.\n"
            f"Provide exactly 4 options, state the zero-indexed integer of the correct option (0, 1, 2, or 3), "
            f"and give a concise pedagogical explanation."
        )

        schema = {
            "question": "string",
            "options": ["string", "string", "string", "string"],
            "correct_option_index": 0,
            "explanation": "string"
        }

        try:
            res = await self.llm.generate_json(prompt, schema)
            q_text = res.get("question", "")
            opts = res.get("options", [])
            correct_idx = int(res.get("correct_option_index", 0))
            expl = res.get("explanation", "")

            # Save the newly generated question into the database so it can be tracked and won't be repeated
            new_id = QuizRepository.save_generated_question(
                topic_id=req.topic_id,
                language=req.language,
                question=q_text,
                options=opts,
                correct_option_index=correct_idx,
                explanation=expl,
                complexity=req.complexity
            )

            return QuizQuestionResponse(
                id=new_id,
                question=q_text,
                options=opts,
                correct_option_index=correct_idx,
                explanation=expl,
                topic_id=req.topic_id,
                source="llm"
            )
        except Exception as e:
            print(f"LLM quiz generation failed: {e}. Falling back to rule engine.")
            fallback = engine.generate_rule_question("verbs", req.complexity)
            if fallback:
                return QuizQuestionResponse(
                    question=fallback["question"],
                    options=fallback["options"],
                    correct_option_index=fallback["correct_option_index"],
                    explanation=fallback["explanation"],
                    source="rule_engine"
                )
            raise e

    async def generate_cloze(self, req: QuizClozeRequest) -> QuizClozeResponse:
        engine = get_grammar_engine(req.language)
        cloze = engine.generate_sentence_cloze(req.sentence)
        if cloze:
            return QuizClozeResponse(
                question=cloze["question"],
                options=cloze["options"],
                correct_option_index=cloze["correct_option_index"],
                explanation=cloze["explanation"],
                masked_target=cloze.get("masked_target")
            )

        # Fallback if sentence has no recognized particle pattern
        return QuizClozeResponse(
            question=f"文中の助詞に注目してください：\n\n{req.sentence}",
            options=["に", "で", "を", "へ"],
            correct_option_index=0,
            explanation="文脈に応じた助詞の使い分けを確認しましょう。"
        )