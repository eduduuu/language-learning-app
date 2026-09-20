from typing import List, Dict, Any, Optional
from datetime import datetime, timezone, timedelta

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

    @staticmethod
    def get_learned_words(
        user_id: str,
        language: str
    ):
        response = supabase.table("srs_cards") \
            .select("word,state") \
            .eq("user_id", user_id) \
            .eq("language", language) \
            .execute()

        return response.data or []

    @staticmethod
    def get_book_vocabulary(
        book_id: str,
        start_page: int | None = None,
        end_page: int | None = None
    ):
        query = supabase.table("book_pages") \
            .select("vocabulary,page_number") \
            .eq("book_id", book_id)

        if start_page is not None:
            query = query.gte(
                "page_number",
                start_page
            )

        if end_page is not None:
            query = query.lte(
                "page_number",
                end_page
            )

        response = query.execute()

        vocabulary = set()

        for page in response.data or []:
            for word in page.get("vocabulary", []):
                vocabulary.add(word)

        return vocabulary

    @staticmethod
    def record_word_lookup(
        user_id: str,
        word: str,
        language: str = "japanese"
    ) -> Dict[str, Any]:
        now = datetime.now(timezone.utc).isoformat()
        try:
            existing = (
                supabase.table("word_lookups")
                .select("*")
                .eq("user_id", user_id)
                .eq("word", word)
                .eq("language", language)
                .execute()
            )
            if existing.data:
                current_count = existing.data[0].get("lookup_count", 1)
                updated = (
                    supabase.table("word_lookups")
                    .update({
                        "lookup_count": current_count + 1,
                        "last_looked_up_at": now
                    })
                    .eq("id", existing.data[0]["id"])
                    .execute()
                )
                return updated.data[0] if updated.data else existing.data[0]

            created = (
                supabase.table("word_lookups")
                .insert({
                    "user_id": user_id,
                    "word": word,
                    "language": language,
                    "lookup_count": 1,
                    "first_looked_up_at": now,
                    "last_looked_up_at": now
                })
                .execute()
            )
            return created.data[0] if created.data else {"lookup_count": 1}
        except Exception as e:
            # Non-blocking telemetry
            return {"lookup_count": 1, "error": str(e)}

    @staticmethod
    def update_card_status(
        user_id: str,
        word: str,
        language: str = "japanese",
        state: Optional[int] = None,
        next_review_date: Optional[datetime] = None,
        reps: Optional[int] = None,
        stability: Optional[float] = None,
        difficulty: Optional[float] = None,
        lapses: Optional[int] = None,
    ) -> Optional[Dict[str, Any]]:
        updates: Dict[str, Any] = {}
        if state is not None:
            updates["state"] = state
        if next_review_date is not None:
            updates["next_review_date"] = next_review_date.isoformat()
        if reps is not None:
            updates["reps"] = reps
        if stability is not None:
            updates["stability"] = stability
        if difficulty is not None:
            updates["difficulty"] = difficulty
        if lapses is not None:
            updates["lapses"] = lapses

        if not updates:
            return SRSRepository.get_card(user_id, word, language)

        response = (
            supabase.table("srs_cards")
            .update(updates)
            .eq("user_id", user_id)
            .eq("word", word)
            .eq("language", language)
            .execute()
        )
        return response.data[0] if response.data else None

    @staticmethod
    def delete_card(
        user_id: str,
        word: str,
        language: str = "japanese"
    ) -> bool:
        response = (
            supabase.table("srs_cards")
            .delete()
            .eq("user_id", user_id)
            .eq("word", word)
            .eq("language", language)
            .execute()
        )
        return bool(response.data)

    @staticmethod
    def bulk_action(
        user_id: str,
        words: List[str],
        language: str = "japanese",
        action: str = "mark_new",
        target_date: Optional[datetime] = None
    ) -> int:
        if not words:
            return 0

        now = datetime.now(timezone.utc)

        if action == "delete":
            res = (
                supabase.table("srs_cards")
                .delete()
                .eq("user_id", user_id)
                .eq("language", language)
                .in_("word", words)
                .execute()
            )
            return len(res.data or [])

        updates: Dict[str, Any] = {}
        if action == "mark_new":
            updates = {
                "state": 0,
                "reps": 0,
                "lapses": 0,
                "difficulty": 0.0,
                "stability": 0.0,
                "next_review_date": now.isoformat()
            }
        elif action == "mark_mastered":
            updates = {
                "state": 2,
                "reps": 3,
                "difficulty": 1.0,
                "stability": 30.0,
                "next_review_date": (now + timedelta(days=30)).isoformat()
            }
        elif action == "reschedule":
            due = target_date or now
            updates = {
                "next_review_date": due.isoformat()
            }

        if not updates:
            return 0

        res = (
            supabase.table("srs_cards")
            .update(updates)
            .eq("user_id", user_id)
            .eq("language", language)
            .in_("word", words)
            .execute()
        )
        return len(res.data or [])

    @staticmethod
    def bulk_upsert_cards(
        user_id: str,
        cards: List[Dict[str, Any]],
        language: str = "japanese",
        import_progress: bool = False
    ) -> int:
        if not cards:
            return 0

        now = datetime.now(timezone.utc)
        count = 0

        for item in cards:
            word = item.get("word", "").strip()
            if not word:
                continue

            if import_progress and item.get("next_review_date"):
                due_val = item["next_review_date"]
                due_str = due_val.isoformat() if hasattr(due_val, "isoformat") else str(due_val)
                state_val = item.get("state", 0)
                reps_val = item.get("reps", 0)
                lapses_val = item.get("lapses", 0)
                stability_val = item.get("stability", 0.0)
                diff_val = item.get("difficulty", 0.0)
            else:
                due_str = now.isoformat()
                state_val = 0
                reps_val = 0
                lapses_val = 0
                stability_val = 0.0
                diff_val = 0.0

            payload = {
                "user_id": user_id,
                "word": word,
                "language": language,
                "state": state_val,
                "difficulty": diff_val,
                "stability": stability_val,
                "reps": reps_val,
                "lapses": lapses_val,
                "next_review_date": due_str,
            }

            try:
                existing = SRSRepository.get_card(user_id, word, language)
                if existing:
                    supabase.table("srs_cards").update(payload).eq("id", existing["id"]).execute()
                else:
                    supabase.table("srs_cards").insert(payload).execute()
                count += 1
            except Exception:
                continue

        return count