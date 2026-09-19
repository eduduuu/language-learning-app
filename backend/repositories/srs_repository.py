from typing import List, Dict, Any, Optional
from datetime import datetime, timezone

from core.supabase import supabase


class SRSRepository:

    @staticmethod
    def get_due_or_new_cards(
        user_id: str,
        language: str,
        limit: int
    ) -> List[Dict[str, Any]]:

        now = datetime.now(timezone.utc).isoformat()

        response = (
            supabase.table("srs_cards")
            .select("*")
            .eq("user_id", user_id)
            .eq("language", language)
            .lte("next_review_date", now)
            .limit(limit)
            .execute()
        )

        return response.data or []

    @staticmethod
    def get_words_from_book_pages(
        book_id: str,
        start_page: int,
        end_page: int
    ) -> List[str]:

        response = (
            supabase.table("book_pages")
            .select("vocabulary")
            .eq("book_id", book_id)
            .gte("page_number", start_page)
            .lte("page_number", end_page)
            .execute()
        )

        unique_words = set()

        for row in response.data or []:
            unique_words.update(
                row.get("vocabulary", [])
            )

        return list(unique_words)

    @staticmethod
    def get_card(
        user_id: str,
        word: str,
        language: str
    ) -> Optional[Dict[str, Any]]:

        response = (
            supabase.table("srs_cards")
            .select("*")
            .eq("user_id", user_id)
            .eq("word", word)
            .eq("language", language)
            .execute()
        )

        return response.data[0] if response.data else None

    @staticmethod
    def get_cards_by_words(
        user_id: str,
        language: str,
        words: List[str]
    ) -> List[Dict[str, Any]]:

        if not words:
            return []

        response = (
            supabase.table("srs_cards")
            .select("*")
            .eq("user_id", user_id)
            .eq("language", language)
            .execute()
        )

        word_set = set(words)

        return [
            card
            for card in (response.data or [])
            if card.get("word") in word_set
        ]

    @staticmethod
    def upsert_fsrs_card(
        user_id: str,
        word: str,
        language: str,
        state: int,
        difficulty: float,
        stability: float,
        reps: int,
        lapses: int,
        next_review_date: datetime
    ) -> Dict[str, Any]:

        data = {
            "user_id": user_id,
            "word": word,
            "language": language,
            "state": state,
            "difficulty": difficulty,
            "stability": stability,
            "reps": reps,
            "lapses": lapses,
            "last_reviewed": datetime.now(
                timezone.utc
            ).isoformat(),
            "next_review_date": next_review_date.isoformat(),
        }

        response = (
            supabase
            .table("srs_cards")
            .upsert(
                data,
                on_conflict="user_id,word,language"
            )
            .execute()
        )

        return response.data[0]

    # ========================================================
    # NEW: Create a brand-new SRS card
    # ========================================================

    @staticmethod
    def create_new_card(
        user_id: str,
        word: str,
        language: str
    ) -> Dict[str, Any]:

        # Do not create duplicates.
        existing = SRSRepository.get_card(
            user_id=user_id,
            word=word,
            language=language
        )

        if existing:
            return existing

        now = datetime.now(timezone.utc)

        data = {
            "user_id": user_id,
            "word": word,
            "language": language,

            # FSRS New state
            "state": 0,

            # These are initialized by the FSRS Card defaults.
            "difficulty": 0.0,
            "stability": 0.0,

            "reps": 0,
            "lapses": 0,

            # It has never been reviewed.
            "last_reviewed": None,

            # New cards are immediately available
            # for the first review.
            "next_review_date": now.isoformat(),
        }

        response = (
            supabase
            .table("srs_cards")
            .insert(data)
            .execute()
        )

        if not response.data:
            raise RuntimeError(
                "Failed to create SRS card."
            )

        return response.data[0]

    # ========================================================
    # NEW: Get every SRS card for the current user
    # ========================================================

    @staticmethod
    def get_all_cards(
        user_id: str,
        language: str
    ) -> List[Dict[str, Any]]:

        response = (
            supabase
            .table("srs_cards")
            .select("*")
            .eq("user_id", user_id)
            .eq("language", language)
            .order(
                "next_review_date",
                desc=False
            )
            .execute()
        )

        return response.data or []

    @staticmethod
    def get_user_vocabulary(
        user_id: str,
        language: str
    ) -> List[Dict[str, Any]]:

        response = (
            supabase
            .table("srs_cards")
            .select("word, state")
            .eq("user_id", user_id)
            .eq("language", language)
            .execute()
        )

        return response.data or []