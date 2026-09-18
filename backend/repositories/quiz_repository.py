from typing import Dict, Any
from core.supabase import supabase

class QuizRepository:
    @staticmethod
    def create_quiz_log(
        user_id: str,
        theme: str,
        language: str,
        complexity: int,
        is_correct: bool
    ) -> Dict[str, Any]:
        data = {
            "user_id": user_id,
            "theme": theme,
            "language": language,
            "complexity": complexity,
            "is_correct": is_correct
        }
        response = supabase.table("quiz_logs").insert(data).execute()
        return response.data[0]