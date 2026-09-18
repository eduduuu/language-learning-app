from typing import List, Dict, Any
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
    def create_book(user_id: str, title: str, language: str) -> Dict[str, Any]:
        response = supabase.table("books").insert({
            "user_id": user_id,
            "title": title,
            "language": language
        }).execute()
        return response.data[0]

    @staticmethod
    def create_book_pages(pages_data: List[Dict[str, Any]]) -> None:
        supabase.table("book_pages").insert(pages_data).execute()

    @staticmethod
    def list_user_books(user_id: str) -> List[Dict[str, Any]]:
        response = supabase.table("books").select("*").eq("user_id", user_id).order("created_at", desc=True).execute()
        return response.data

    @staticmethod
    def delete_book(user_id: str, book_id: str) -> bool:
        response = supabase.table("books").delete().eq("id", book_id).eq("user_id", user_id).execute()
        return len(response.data) > 0