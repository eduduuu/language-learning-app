from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from core.supabase import supabase

class SRSRepository:
    @staticmethod
    def get_due_or_new_cards(user_id: str, language: str, limit: int) -> List[Dict[str, Any]]:
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
        return response.data

    @staticmethod
    def get_words_from_book_pages(book_id: str, start_page: int, end_page: int) -> List[str]:
        response = (
            supabase.table("book_pages")
            .select("vocabulary")
            .eq("book_id", book_id)
            .gte("page_number", start_page)
            .lte("page_number", end_page)
            .execute()
        )
        unique_words = set()
        for row in response.data:
            unique_words.update(row.get("vocabulary", []))
        return list(unique_words)

    @staticmethod
    def get_card(user_id: str, word: str, language: str) -> Optional[Dict[str, Any]]:
        """Fetches a single SRS card for a specific user and word."""
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
    def get_cards_by_words(user_id: str, language: str, words: List[str]) -> List[Dict[str, Any]]:
        if not words:
            return []
        
        # Fetch all cards for this user and language
        response = (
            supabase.table("srs_cards")
            .select("*")
            .eq("user_id", user_id)
            .eq("language", language)
            .execute()
        )
        
        # Filter the returned cards in memory
        word_set = set(words)
        filtered_cards = [
            card for card in response.data 
            if card.get("word") in word_set
        ]
        
        return filtered_cards

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
            "last_reviewed": datetime.now(timezone.utc).isoformat(),
            "next_review_date": next_review_date.isoformat(),
        }
        # Remove the spaces in the on_conflict string
        response = supabase.table("srs_cards").upsert(data, on_conflict="user_id,word,language").execute()
        return response.data[0]

    @staticmethod
    def get_user_vocabulary(user_id: str, language: str) -> List[Dict[str, Any]]:
        response = (
            supabase.table("srs_cards")
            .select("word, state")
            .eq("user_id", user_id)
            .eq("language", language)
            .execute()
        )
        return response.data or []