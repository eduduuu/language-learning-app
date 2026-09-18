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
    def upsert_card(
        user_id: str,
        word: str,
        language: str,
        interval: int,
        ease_factor: float,
        step_count: int,
        next_review_date: datetime
    ) -> Dict[str, Any]:
        data = {
            "user_id": user_id,
            "word": word,
            "language": language,
            "interval": interval,
            "ease_factor": ease_factor,
            "step_count": step_count,
            "last_reviewed": datetime.now(timezone.utc).isoformat(),
            "next_review_date": next_review_date.isoformat(),
        }
        response = supabase.table("srs_cards").upsert(data, on_conflict="user_id, word, language").execute()
        return response.data[0]