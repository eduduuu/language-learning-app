from typing import List, Dict, Any, Optional
from core.supabase import supabase


class BookRepository:
    @staticmethod
    def get_user_tier(user_id: str) -> str:
        response = supabase.table("users").select("tier").eq("id", user_id).execute()
        if not response.data:
            return "free"
        return response.data[0].get("tier", "free")

    @staticmethod
    def count_user_books(user_id: str) -> int:
        response = supabase.table("books").select("id", count="exact").eq("user_id", user_id).execute()
        return response.count if response.count is not None else len(response.data)

    @staticmethod
    def create_book(
        user_id: str,
        title: str,
        language: str,
        cover_url: str = None,
        fingerprint: str = None,
    ) -> Dict[str, Any]:
        data = {
            "user_id": user_id,
            "title": title,
            "language": language,
        }
        if cover_url is not None:
            data["cover_url"] = cover_url
        if fingerprint is not None:
            data["fingerprint"] = fingerprint

        response = supabase.table("books").insert(data).execute()
        return response.data[0]

    @staticmethod
    def get_book_by_fingerprint(user_id: str, fingerprint: str) -> Optional[Dict[str, Any]]:
        response = (
            supabase.table("books")
            .select("*")
            .eq("user_id", user_id)
            .eq("fingerprint", fingerprint)
            .limit(1)
            .execute()
        )
        return response.data[0] if response.data else None

    @staticmethod
    def create_book_pages(pages_data: List[Dict[str, Any]]) -> None:
        if pages_data:
            supabase.table("book_pages").insert(pages_data).execute()

    @staticmethod
    def replace_book_pages(book_id: str, pages_data: List[Dict[str, Any]]) -> None:
        # Registration is idempotent. Re-registering the same local book should
        # not duplicate its vocabulary projection.
        supabase.table("book_pages").delete().eq("book_id", book_id).execute()
        if pages_data:
            supabase.table("book_pages").insert(pages_data).execute()

    @staticmethod
    def list_user_books(user_id: str) -> List[Dict[str, Any]]:
        response = (
            supabase.table("books")
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .execute()
        )
        return response.data

    @staticmethod
    def delete_book(user_id: str, book_id: str) -> bool:
        response = (
            supabase.table("books")
            .delete()
            .eq("id", book_id)
            .eq("user_id", user_id)
            .execute()
        )
        return len(response.data) > 0
