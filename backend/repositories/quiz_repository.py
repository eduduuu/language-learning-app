from typing import Dict, Any, List, Optional
import random
from core.supabase import supabase

class QuizRepository:
    @staticmethod
    def create_quiz_log(
        user_id: str,
        theme: str,
        language: str,
        complexity: int,
        is_correct: bool,
        question_id: Optional[str] = None
    ) -> Dict[str, Any]:
        data = {
            "user_id": user_id,
            "theme": theme,
            "language": language,
            "complexity": complexity,
            "is_correct": is_correct
        }
        if question_id:
            data["question_id"] = question_id
        response = supabase.table("quiz_logs").insert(data).execute()
        return response.data[0]

    @staticmethod
    def get_grammar_topics(language: str = "japanese") -> List[Dict[str, Any]]:
        try:
            res = (
                supabase.table("grammar_topics")
                .select("*")
                .eq("language", language)
                .order("level")
                .order("category")
                .execute()
            )
            return res.data or []
        except Exception as e:
            print(f"Failed to fetch grammar topics: {e}")
            return []

    @staticmethod
    def get_preseeded_question(
        user_id: Optional[str] = None,
        topic_id: Optional[str] = None,
        theme: Optional[str] = None,
        language: str = "japanese"
    ) -> Optional[Dict[str, Any]]:
        try:
            # 1. Get IDs of questions already answered by this user
            answered_ids = set()
            if user_id:
                try:
                    answered_res = (
                        supabase.table("quiz_logs")
                        .select("question_id")
                        .eq("user_id", user_id)
                        .not_.is_("question_id", "null")
                        .execute()
                    )
                    for r in (answered_res.data or []):
                        qid = r.get("question_id")
                        if qid:
                            answered_ids.add(qid)
                except Exception as e:
                    print(f"Failed to query answered question IDs: {e}")

            # 2. Query questions for this topic or language
            query = supabase.table("grammar_questions").select("*, grammar_topics(title, rule_explanation)")
            if topic_id:
                query = query.eq("topic_id", topic_id)
            elif language:
                query = query.eq("language", language)

            res = query.limit(50).execute()
            items = res.data or []

            if not items and theme:
                # Try finding topic matching theme
                topic_res = (
                    supabase.table("grammar_topics")
                    .select("id")
                    .ilike("title", f"%{theme}%")
                    .limit(1)
                    .execute()
                )
                if topic_res.data:
                    tid = topic_res.data[0]["id"]
                    res2 = supabase.table("grammar_questions").select("*, grammar_topics(title, rule_explanation)").eq("topic_id", tid).execute()
                    items = res2.data or []

            # 3. Filter out questions already answered by this user
            available = [q for q in items if q["id"] not in answered_ids]

            # If all preseeded questions for this topic have been answered, return None so LLM generates a fresh one!
            if not available:
                return None

            chosen = random.choice(available)
            topic_info = chosen.get("grammar_topics") or {}
            return {
                "id": chosen["id"],
                "question": chosen["question"],
                "options": chosen["options"],
                "correct_option_index": chosen["correct_option_index"],
                "explanation": chosen["explanation"],
                "topic_id": chosen.get("topic_id"),
                "rule_explanation": topic_info.get("rule_explanation"),
                "source": "preseeded"
            }
        except Exception as e:
            print(f"Failed to fetch preseeded question: {e}")
            return None

    @staticmethod
    def save_generated_question(
        topic_id: Optional[str],
        language: str,
        question: str,
        options: List[str],
        correct_option_index: int,
        explanation: str,
        complexity: int = 1
    ) -> Optional[str]:
        try:
            data = {
                "language": language,
                "question": question,
                "options": options,
                "correct_option_index": correct_option_index,
                "explanation": explanation,
                "complexity": complexity,
                "is_preseeded": False
            }
            if topic_id:
                data["topic_id"] = topic_id
            res = supabase.table("grammar_questions").insert(data).execute()
            if res.data:
                return res.data[0]["id"]
            return None
        except Exception as e:
            print(f"Failed to save generated question: {e}")
            return None

    @staticmethod
    def get_weak_topics(user_id: str, threshold: float = 70.0) -> List[Dict[str, Any]]:
        try:
            res = supabase.table("quiz_logs").select("*").eq("user_id", user_id).execute()
            quizzes = res.data or []
            if not quizzes:
                return []

            theme_stats: Dict[str, Dict[str, Any]] = {}
            for q in quizzes:
                t = q.get("theme", "General")
                if t not in theme_stats:
                    theme_stats[t] = {"total": 0, "correct": 0}
                theme_stats[t]["total"] += 1
                if q.get("is_correct"):
                    theme_stats[t]["correct"] += 1

            # Fetch topics to enrich with rule explanations
            topics_res = supabase.table("grammar_topics").select("title, rule_explanation").execute()
            topics_map = {t["title"]: t.get("rule_explanation") for t in (topics_res.data or [])}

            weak: List[Dict[str, Any]] = []
            for t, stats in theme_stats.items():
                if stats["total"] >= 2: # At least 2 attempts
                    acc = round((stats["correct"] / stats["total"]) * 100, 1)
                    if acc <= threshold:
                        # Attempt to find rule explanation
                        rule = topics_map.get(t)
                        if not rule:
                            for title, r in topics_map.items():
                                if t.lower() in title.lower() or title.lower() in t.lower():
                                    rule = r
                                    break

                        weak.append({
                            "theme": t,
                            "total": stats["total"],
                            "correct": stats["correct"],
                            "accuracy": acc,
                            "rule_explanation": rule
                        })

            # Sort by accuracy ascending (lowest first)
            weak.sort(key=lambda x: x["accuracy"])
            return weak[:5]
        except Exception as e:
            print(f"Failed to get weak topics: {e}")
            return []