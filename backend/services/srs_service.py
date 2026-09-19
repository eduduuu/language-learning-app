import random
from datetime import datetime, timezone
from typing import List, Dict, Any
from fastapi import HTTPException, status
from fsrs import Scheduler, Card, Rating, State
from core.llm.gemini_adapter import GeminiAdapter

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
        #self.llm = GroqAdapter()
        self.llm = GeminiAdapter()
        self.fsrs = Scheduler()
        self.fsrs = Scheduler(maximum_interval=365)

    async def generate_vocab_card(self, user_id: str, req: VocabGenerateRequest) -> VocabCardResponse:
        words_to_use: List[str] = []

        if req.mode == "books":
            if not req.book_id:
                raise HTTPException(status_code=400, detail="book_id is required.")
            
            # 1. Get raw vocab from book pages
            extracted = SRSRepository.get_words_from_book_pages(
                str(req.book_id), req.start_page, req.end_page
            )
            
            # 2. Fetch existing cards to separate New vs Due
            existing_cards = SRSRepository.get_cards_by_words(user_id, req.language, extracted)
            existing_map = {card["word"]: card for card in existing_cards}

            new_words = []
            due_words = []
            now = datetime.now(timezone.utc)

            for word in extracted:
                if word not in existing_map:
                    new_words.append(word)
                else:
                    # Check if due for review
                    due_date = datetime.fromisoformat(existing_map[word]["next_review_date"].replace('Z', '+00:00'))
                    if due_date <= now:
                        due_words.append(word)

            # 3. SHUFFLE to prevent the same words from appearing repeatedly
            random.shuffle(new_words)
            random.shuffle(due_words)

            # 4. Mix Anki-style (Prioritize due words, backfill with new words)
            while len(words_to_use) < req.target_vocab_count:
                if due_words and len(words_to_use) % 2 == 0:
                    words_to_use.append(due_words.pop(0))
                elif new_words:
                    words_to_use.append(new_words.pop(0))
                elif due_words:
                    words_to_use.append(due_words.pop(0))
                else:
                    break
        else:
            level_words = JLPT_FALLBACK_VOCAB.get(req.jlpt_level, JLPT_FALLBACK_VOCAB["N5"])
            random.shuffle(level_words) # Shuffle JLPT words too
            words_to_use = level_words[: req.target_vocab_count]

        if not words_to_use:
            raise HTTPException(status_code=404, detail="No vocabulary found.")

        # 2. Build LLM prompt with strict structural instructions
        prompt = (
            f"Write 1 {req.language} sentence using EXACTLY these words: {', '.join(words_to_use)}.\n"
            f"Rules:\n"
            f"1. Length: exactly or close to {req.sentence_max_words} words.\n"
            f"2. Kanji density (0=all hiragana, 1=kanji heavy): {req.kanji_density}\n"
            f"3. CRITICAL: Never convert the target words to hiragana in the sentence. Keep their kanji.\n"
            f"4. 'conjugated_word' MUST be the exact substring used in the sentence so it can be highlighted.\n"
            f"5. 'reading' should include kanji, hiragana, and romaji."
            f"6. CRITICAL: The 'word_details' array MUST ONLY contain the {len(words_to_use)} target word(s) requested ({', '.join(words_to_use)}). Do not analyze or extract any other words from the sentence."
        )

        # Update the schema passed to GroqAdapter
        schema = {
            "sentence": "string",
            "translation": "string",
            "word_details": [
                {
                    "base_word": "string",
                    "conjugated_word": "string",
                    "reading": "string",
                    "meaning": "string"
                }
            ]
        }

        # 3. Call LLM
        llm_res = await self.llm.generate_json(prompt, schema)

        return VocabCardResponse(
            words=words_to_use,
            sentence=llm_res.get("sentence", ""),
            translation=llm_res.get("translation", ""),
            word_details=llm_res.get("word_details", [])
        )

    def process_review(self, user_id: str, word: str, language: str, rating: str) -> Dict[str, Any]:
        existing_card = SRSRepository.get_card(user_id, word, language)

        # Map frontend string to FSRS Rating Enum
        rating_map = {
            "very_hard": Rating.Again,
            "hard": Rating.Hard,
            "ok": Rating.Good,
            "good": Rating.Good
        }
        fsrs_rating = rating_map.get(rating, Rating.Good)

        # Initialize FSRS Card (Only pass core fields recognized by the new version)
        if existing_card:
            card = Card(
                state=State(existing_card.get("state", 0)),
                difficulty=existing_card.get("difficulty", 0.0),
                stability=existing_card.get("stability", 0.0),
                due=datetime.fromisoformat(existing_card.get("next_review_date").replace('Z', '+00:00'))
            )
            current_reps = existing_card.get("reps", 0)
            current_lapses = existing_card.get("lapses", 0)
        else:
            card = Card()
            current_reps = 0
            current_lapses = 0

        # Calculate next states using the Scheduler API
        now = datetime.now(timezone.utc)
        scheduled_card, review_log = self.fsrs.review_card(card, fsrs_rating, review_datetime=now)

        # Manually track Anki stats since py-fsrs Card removed them
        new_reps = current_reps + 1
        new_lapses = current_lapses + (1 if fsrs_rating == Rating.Again else 0)

        return SRSRepository.upsert_fsrs_card(
            user_id=user_id,
            word=word,
            language=language,
            state=int(scheduled_card.state),
            difficulty=scheduled_card.difficulty,
            stability=scheduled_card.stability,
            reps=new_reps,
            lapses=new_lapses,
            next_review_date=scheduled_card.due
        )