from core.supabase import supabase

class ReadingProgressRepository:

    @staticmethod
    def get(
        user_id: str,
        book_id: str
    ):
        response = supabase.table(
            "reading_progress"
        ).select("*") \
         .eq("user_id", user_id) \
         .eq("book_id", book_id) \
         .maybe_single() \
         .execute()

        return response.data

    @staticmethod
    def upsert(
        user_id: str,
        book_id: str,
        chapter_key: str,
        paragraph_index: int
    ):
        response = supabase.table(
            "reading_progress"
        ).upsert(
            {
                "user_id": user_id,
                "book_id": book_id,
                "chapter_key": chapter_key,
                "paragraph_index": paragraph_index,
                "updated_at": "now()",
            },
            on_conflict="user_id,book_id"
        ).execute()

        return response.data[0]