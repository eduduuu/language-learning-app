import random

from datetime import datetime, timezone
from typing import List, Dict, Any

from fastapi import HTTPException
from fsrs import Scheduler, Card, Rating, State

from core.llm.groq_adapter import GroqAdapter

from repositories.srs_repository import SRSRepository

from schemas.vocabulary import (
    EnrichBookSentenceResponse,
    VocabGenerateRequest,
    VocabCardResponse,
    VocabBookContextResponse,
    WordDetail,
    TranslateSentenceResponse,
)


# ============================================================
# Standard fallback vocabulary lists for JLPT levels
# ============================================================

JLPT_FALLBACK_VOCAB = {
    "N5": [
        "食べる",
        "飲む",
        "本",
        "学校",
        "友だち",
        "行く",
        "見る",
        "時間",
    ],
    "N4": [
        "準備",
        "約束",
        "案内",
        "経験",
        "説明",
        "急ぐ",
        "興味",
        "計画",
    ],
    "N3": [
        "影響",
        "解決",
        "結果",
        "発展",
        "努力",
        "批判",
        "管理",
        "期待",
    ],
    "N2": [
        "維持",
        "考慮",
        "傾向",
        "分析",
        "把握",
        "実施",
        "構造",
        "評価",
    ],
    "N1": [
        "誇張",
        "躊躇",
        "変革",
        "概念",
        "矛盾",
        "示唆",
        "掌握",
        "喚起",
    ],
}


class SRSService:

    def __init__(self):
        self.llm = GroqAdapter()
        self.fsrs = Scheduler(
            maximum_interval=365
        )

    # ========================================================
    # Generate vocabulary card
    # ========================================================

    async def generate_vocab_card(
        self,
        user_id: str,
        req: VocabGenerateRequest
    ):
        words_to_use: List[str] = []

        # ====================================================
        # 1. SELECT WORDS
        # ====================================================

        if req.mode == "books":

            if not req.book_id:
                raise HTTPException(
                    status_code=400,
                    detail="book_id is required."
                )

            extracted = SRSRepository.get_words_from_book_pages(
                str(req.book_id),
                req.start_page or 1,
                req.end_page or 10
            )

            if not extracted:
                raise HTTPException(
                    status_code=404,
                    detail="No vocabulary found in the selected pages."
                )

            existing_cards = (
                SRSRepository.get_cards_by_words(
                    user_id,
                    req.language,
                    extracted
                )
            )

            existing_map = {
                card["word"]: card
                for card in existing_cards
            }

            new_words = []
            due_words = []

            now = datetime.now(timezone.utc)

            for word in extracted:

                if word not in existing_map:
                    new_words.append(word)

                else:
                    due_date = datetime.fromisoformat(
                        existing_map[word]["next_review_date"]
                        .replace("Z", "+00:00")
                    )

                    if due_date <= now:
                        due_words.append(word)

            random.shuffle(new_words)
            random.shuffle(due_words)

            # Prioritize due words.
            while len(words_to_use) < req.target_vocab_count:

                if due_words:
                    words_to_use.append(
                        due_words.pop(0)
                    )

                elif new_words:
                    words_to_use.append(
                        new_words.pop(0)
                    )

                else:
                    break

        else:

            level_words = list(
                JLPT_FALLBACK_VOCAB.get(
                    req.jlpt_level,
                    JLPT_FALLBACK_VOCAB["N5"]
                )
            )

            random.shuffle(level_words)

            words_to_use = level_words[
                :req.target_vocab_count
            ]

        if not words_to_use:
            raise HTTPException(
                status_code=404,
                detail="No vocabulary found."
            )

        # ====================================================
        # 2. BOOK SENTENCE MODE
        #
        # The actual sentence remains in the browser.
        # We only return the selected vocabulary here.
        # ====================================================

        if req.sentence_mode == "book":

            if req.mode != "books":
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Book sentence mode requires "
                        "mode='books'."
                    )
                )

            return VocabBookContextResponse(
                words=words_to_use,
                book_id=str(req.book_id)
            )

        # ====================================================
        # 3. AI SENTENCE MODE
        # ====================================================

        prompt = (
            f"Write 1 {req.language} sentence using "
            f"EXACTLY these target words: "
            f"{', '.join(words_to_use)}.\n\n"

            f"Rules:\n"

            f"1. Length: exactly or close to "
            f"{req.sentence_max_words} words.\n"

            f"2. Kanji density "
            f"(0=all hiragana, 1=kanji heavy): "
            f"{req.kanji_density}\n"

            f"3. Never convert the target words "
            f"to hiragana. Keep their kanji.\n"

            f"4. 'conjugated_word' MUST be the exact "
            f"substring used in the sentence.\n"

            f"5. 'reading' should include kanji, "
            f"hiragana, and romaji.\n"

            f"6. The 'word_details' array MUST ONLY "
            f"contain the requested target words: "
            f"{', '.join(words_to_use)}.\n"

            f"7. 'meaning' should be a concise English "
            f"meaning of the target vocabulary.\n"

            f"8. 'translation' should be a natural "
            f"English translation of the complete sentence."
        )

        schema = {
            "sentence": "string",
            "translation": "string",
            "word_details": [
                {
                    "base_word": "string",
                    "conjugated_word": "string",
                    "reading": "string",
                    "meaning": "string",
                }
            ],
        }

        llm_res = await self.llm.generate_json(
            prompt,
            schema
        )

        return VocabCardResponse(
            words=words_to_use,
            sentence=llm_res.get(
                "sentence",
                ""
            ),
            translation=llm_res.get(
                "translation",
                ""
            ),
            word_details=llm_res.get(
                "word_details",
                []
            )
        )

    # ========================================================
    # Enrich a sentence from a local EPUB
    # ========================================================

    async def enrich_book_sentence(
        self,
        user_id: str,
        sentence: str,
        words: List[str]
    ) -> EnrichBookSentenceResponse:

        sentence = sentence.strip()

        if not sentence:
            raise HTTPException(
                status_code=400,
                detail="Sentence cannot be empty."
            )

        clean_words = [
            word.strip()
            for word in words
            if word and word.strip()
        ]

        if not clean_words:
            raise HTTPException(
                status_code=400,
                detail="At least one vocabulary word is required."
            )

        target_words = ", ".join(
            clean_words
        )

        prompt = (
            "Analyze the following Japanese sentence for a "
            "Japanese language learner.\n\n"

            f"Japanese sentence:\n"
            f"{sentence}\n\n"

            f"Target vocabulary:\n"
            f"{target_words}\n\n"

            "Return:\n"
            "1. A natural English translation of the COMPLETE "
            "Japanese sentence.\n"
            "2. Details ONLY for the target vocabulary.\n\n"

            "Rules:\n"
            "- Do not rewrite or modify the Japanese sentence.\n"
            "- The translation must translate the complete "
            "sentence, not only the target word.\n"
            "- base_word must be the dictionary/base form.\n"
            "- conjugated_word must be the exact form appearing "
            "in the Japanese sentence.\n"
            "- reading must contain the Japanese reading and "
            "romaji when appropriate.\n"
            "- meaning must be a concise English meaning "
            "appropriate for this sentence.\n"
            "- Do not add unrelated vocabulary.\n"
        )

        schema = {
            "translation": "string",
            "word_details": [
                {
                    "base_word": "string",
                    "conjugated_word": "string",
                    "reading": "string",
                    "meaning": "string",
                }
            ],
        }

        llm_res = await self.llm.generate_json(
            prompt,
            schema
        )

        return EnrichBookSentenceResponse(
            translation=llm_res.get(
                "translation",
                ""
            ),
            word_details=llm_res.get(
                "word_details",
                []
            )
        )

    # ========================================================
    # Translate a sentence from the reader
    # ========================================================

    async def translate_sentence(
        self,
        user_id: str,
        sentence: str,
        language: str
    ) -> TranslateSentenceResponse:

        sentence = sentence.strip()

        if not sentence:
            raise HTTPException(
                status_code=400,
                detail="Sentence cannot be empty."
            )

        if language == "japanese":

            prompt = (
                "Translate the following Japanese sentence into "
                "natural English for a language learner.\n\n"

                f"Japanese:\n"
                f"{sentence}\n\n"

                "Rules:\n"
                "- Translate the COMPLETE sentence.\n"
                "- Preserve the meaning and tone.\n"
                "- Do not add explanations.\n"
                "- Return only the translation in the JSON field."
            )

        else:

            prompt = (
                "Translate the following English sentence into "
                "natural Japanese for a language learner.\n\n"

                f"English:\n"
                f"{sentence}\n\n"

                "Rules:\n"
                "- Translate the COMPLETE sentence.\n"
                "- Preserve the meaning and tone.\n"
                "- Do not add explanations.\n"
                "- Return only the translation in the JSON field."
            )

        schema = {
            "translation": "string"
        }

        llm_res = await self.llm.generate_json(
            prompt,
            schema
        )

        return TranslateSentenceResponse(
            translation=llm_res.get(
                "translation",
                ""
            )
        )

    # ========================================================
    # Process SRS review
    # ========================================================

    def process_review(
        self,
        user_id: str,
        word: str,
        language: str,
        rating: str
    ) -> Dict[str, Any]:

        existing_card = SRSRepository.get_card(
            user_id,
            word,
            language
        )

        rating_map = {
            "very_hard": Rating.Again,
            "hard": Rating.Hard,
            "ok": Rating.Good,
            "good": Rating.Good,
        }

        fsrs_rating = rating_map.get(
            rating,
            Rating.Good
        )

        if existing_card:

            card = Card(
                state=State(
                    existing_card.get(
                        "state",
                        0
                    )
                ),
                difficulty=existing_card.get(
                    "difficulty",
                    0.0
                ),
                stability=existing_card.get(
                    "stability",
                    0.0
                ),
                due=datetime.fromisoformat(
                    existing_card.get(
                        "next_review_date"
                    ).replace(
                        "Z",
                        "+00:00"
                    )
                )
            )

            current_reps = existing_card.get(
                "reps",
                0
            )

            current_lapses = existing_card.get(
                "lapses",
                0
            )

        else:

            card = Card()

            current_reps = 0
            current_lapses = 0

        now = datetime.now(timezone.utc)

        scheduled_card, review_log = (
            self.fsrs.review_card(
                card,
                fsrs_rating,
                review_datetime=now
            )
        )

        new_reps = current_reps + 1

        new_lapses = (
            current_lapses
            + (
                1
                if fsrs_rating == Rating.Again
                else 0
            )
        )

        return SRSRepository.upsert_fsrs_card(
            user_id=user_id,
            word=word,
            language=language,
            state=int(
                scheduled_card.state
            ),
            difficulty=scheduled_card.difficulty,
            stability=scheduled_card.stability,
            reps=new_reps,
            lapses=new_lapses,
            next_review_date=scheduled_card.due
        )

    # ========================================================
    # Add SRS card
    # ========================================================

    def add_card(
        self,
        user_id: str,
        word: str,
        language: str
    ) -> Dict[str, Any]:

        word = word.strip()

        if not word:
            raise HTTPException(
                status_code=400,
                detail="Word cannot be empty."
            )

        return SRSRepository.create_new_card(
            user_id=user_id,
            word=word,
            language=language
        )

    # ========================================================
    # Book mastery
    # ========================================================

    def get_book_mastery(
        self,
        user_id: str,
        book_id: str,
        language: str
    ):
        book_words = (
            SRSRepository.get_book_vocabulary(
                book_id
            )
        )

        cards = (
            SRSRepository.get_learned_words(
                user_id,
                language
            )
        )

        learned_words = {
            card["word"]
            for card in cards
            if card.get("state") == 2
        }

        learned_in_book = (
            book_words & learned_words
        )

        total = len(book_words)
        learned = len(learned_in_book)

        percentage = (
            round(
                (learned / total) * 100,
                1
            )
            if total > 0
            else 0
        )

        return {
            "book_id": book_id,
            "total_words": total,
            "learned_words": learned,
            "mastery_percent": percentage,
        }