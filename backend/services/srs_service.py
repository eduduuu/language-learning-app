import math
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Tuple
from fastapi import HTTPException, status

from core.llm.groq_adapter import GroqAdapter
from repositories.srs_repository import SRSRepository
from schemas.vocabulary import VocabGenerateRequest, VocabCardResponse

# Standard fallback vocabulary lists for JLPT levels
JLPT_FALLBACK_VOCAB = {
    "N5": ["食べる", "飲む", "本", "学校", "友だち", "行く", "見る", "時間"],
    "N4": ["準備", "約束", "案内", "経験", "説明", "急ぐ", "興味", "計画"],
    "N3": ["影響", "解決", "結果", "発展", "努力", "批判", "管理", "期待"],
    "N2": ["維持", "考慮", "傾向", "分析", "把握", "実施", "構造", "評価"],
    "N1": ["誇張", "躊躇", "変革", "概念", "矛盾", "示唆", "掌握", "喚起"],
}

class SRSService:
    def __init__(self):
        self.llm = GroqAdapter()

    def calculate_sm2(
        self,
        rating: str,
        current_interval: int,
        current_ease: float,
        current_step: int
    ) -> Tuple[int, float, int, datetime]:
        """Calculates next interval, ease factor, step count, and review date based on rating."""
        # Convert rating to quality score (0-4 scale)
        quality_map = {"very_hard": 1, "hard": 2, "ok": 3, "good": 4}
        q = quality_map.get(rating, 3)

        # Calculate new Ease Factor
        new_ease = current_ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
        new_ease = max(1.3, round(new_ease, 2))

        if q < 3:  # Failed/Hard
            new_step = 0
            new_interval = 1
        else:  # Passed
            new_step = current_step + 1
            if new_step == 1:
                new_interval = 1
            elif new_step == 2:
                new_interval = 6
            else:
                new_interval = math.ceil(current_interval * new_ease)

        next_date = datetime.now(timezone.utc) + timedelta(days=new_interval)
        return new_interval, new_ease, new_step, next_date

    async def generate_vocab_card(self, user_id: str, req: VocabGenerateRequest) -> VocabCardResponse:
        # 1. Fetch vocabulary words based on mode
        words_to_use: List[str] = []

        if req.mode == "books":
            if not req.book_id:
                raise HTTPException(status_code=400, detail="book_id is required for 'books' mode.")
            extracted = SRSRepository.get_words_from_book_pages(
                str(req.book_id), req.start_page, req.end_page
            )
            words_to_use = extracted[: req.target_vocab_count]
        else:
            level_words = JLPT_FALLBACK_VOCAB.get(req.jlpt_level, JLPT_FALLBACK_VOCAB["N5"])
            words_to_use = level_words[: req.target_vocab_count]

        if not words_to_use:
            raise HTTPException(
                status_code=status.HTTP_44_NOT_FOUND if hasattr(status, 'HTTP_44_NOT_FOUND') else 404,
                detail="No vocabulary found for the specified parameters."
            )

        # 2. Build LLM prompt
        prompt = (
            f"Generate 1 natural practice sentence in {req.language} containing these exact words: {', '.join(words_to_use)}.\n"
            f"Constraints:\n"
            f"- Maximum sentence length: {req.sentence_max_words} words.\n"
            f"- Kanji density ratio (0=all hiragana, 1=kanji heavy): {req.kanji_density}\n"
            f"Return JSON with format:\n"
            f'{{"sentence": "...", "translation": "...", "reading_notes": "..."}}'
        )

        schema = {
            "sentence": "string",
            "translation": "string",
            "reading_notes": "string"
        }

        # 3. Call LLM
        llm_res = await self.llm.generate_json(prompt, schema)

        return VocabCardResponse(
            words=words_to_use,
            sentence=llm_res.get("sentence", ""),
            translation=llm_res.get("translation", ""),
            reading_notes=llm_res.get("reading_notes", "")
        )

    def process_review(self, user_id: str, word: str, language: str, rating: str) -> Dict[str, Any]:
        existing_card = SRSRepository.get_card(user_id, word, language)

        if existing_card:
            c_interval = existing_card.get("interval", 0)
            c_ease = existing_card.get("ease_factor", 2.5)
            c_step = existing_card.get("step_count", 0)
        else:
            c_interval, c_ease, c_step = 0, 2.5, 0

        new_interval, new_ease, new_step, next_date = self.calculate_sm2(
            rating, c_interval, c_ease, c_step
        )

        return SRSRepository.upsert_card(
            user_id=user_id,
            word=word,
            language=language,
            interval=new_interval,
            ease_factor=new_ease,
            step_count=new_step,
            next_review_date=next_date
        )