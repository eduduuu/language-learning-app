from typing import Dict, Any, List, Set
from datetime import datetime, timezone, timedelta
from core.supabase import supabase

class AnalyticsRepository:
    @staticmethod
    def get_user_settings(user_id: str) -> Dict[str, Any]:
        res = supabase.table("users").select("*").eq("id", user_id).execute()
        if res.data:
            return res.data[0]
        # Return fallback if profile was created manually
        return {"id": user_id, "tier": "free", "max_new_cards_per_day": 20}

    @staticmethod
    def update_user_settings(user_id: str, max_new_cards: int) -> Dict[str, Any]:
        res = supabase.table("users").update({
            "max_new_cards_per_day": max_new_cards
        }).eq("id", user_id).execute()
        return res.data[0]

    @staticmethod
    def get_analytics_metrics(user_id: str) -> Dict[str, Any]:
        now_dt = datetime.now(timezone.utc)
        now = now_dt.isoformat()

        # Fetch aggregate counts
        books_res = supabase.table("books").select("id", count="exact").eq("user_id", user_id).execute()
        cards_res = supabase.table("srs_cards").select("id", count="exact").eq("user_id", user_id).execute()
        due_res = supabase.table("srs_cards").select("id", count="exact").eq("user_id", user_id).lte("next_review_date", now).execute()
        mastered_res = supabase.table("srs_cards").select("id", count="exact").eq("user_id", user_id).gte("reps", 3).execute()
        quizzes_res = supabase.table("quiz_logs").select("*").eq("user_id", user_id).execute()

        quizzes = quizzes_res.data or []
        total_quizzes = len(quizzes)
        correct_quizzes = sum(1 for q in quizzes if q.get("is_correct"))
        accuracy = round((correct_quizzes / total_quizzes * 100), 2) if total_quizzes > 0 else 0.0

        # Theme accuracy breakdown
        theme_map: Dict[str, Dict[str, Any]] = {}
        for q in quizzes:
            t = q.get("theme", "General")
            if t not in theme_map:
                theme_map[t] = {"total": 0, "correct": 0, "accuracy": 0.0}
            theme_map[t]["total"] += 1
            if q.get("is_correct"):
                theme_map[t]["correct"] += 1

        for t, val in theme_map.items():
            val["accuracy"] = round((val["correct"] / val["total"]) * 100, 2)

        # Calculate daily activity streak from reviews and quizzes
        active_dates: Set[str] = set()
        for q in quizzes:
            created_at = q.get("created_at")
            if created_at:
                active_dates.add(str(created_at)[:10])

        reviewed_cards = (
            supabase.table("srs_cards")
            .select("last_reviewed")
            .eq("user_id", user_id)
            .not_.is_("last_reviewed", "null")
            .execute()
        )
        for c in (reviewed_cards.data or []):
            last_rev = c.get("last_reviewed")
            if last_rev:
                active_dates.add(str(last_rev)[:10])

        streak = 0
        curr_date = now_dt.date()
        if curr_date.isoformat() not in active_dates:
            curr_date = curr_date - timedelta(days=1)

        while curr_date.isoformat() in active_dates:
            streak += 1
            curr_date = curr_date - timedelta(days=1)

        return {
            "total_books": books_res.count or 0,
            "total_cards": cards_res.count or 0,
            "cards_due_today": due_res.count or 0,
            "words_mastered": mastered_res.count or 0,
            "current_streak": streak,
            "quiz_total_attempts": total_quizzes,
            "quiz_accuracy_rate": accuracy,
            "grammar_theme_breakdown": theme_map
        }