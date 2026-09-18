from typing import Dict, Any, List
from datetime import datetime, timezone
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
        now = datetime.now(timezone.utc).isoformat()

        # Fetch aggregate counts using head/count requests
        books_res = supabase.table("books").select("id", count="exact").eq("user_id", user_id).execute()
        cards_res = supabase.table("srs_cards").select("id", count="exact").eq("user_id", user_id).execute()
        due_res = supabase.table("srs_cards").select("id", count="exact").eq("user_id", user_id).lte("next_review_date", now).execute()
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

        return {
            "total_books": books_res.count or 0,
            "total_cards": cards_res.count or 0,
            "cards_due_today": due_res.count or 0,
            "quiz_total_attempts": total_quizzes,
            "quiz_accuracy_rate": accuracy,
            "grammar_theme_breakdown": theme_map
        }