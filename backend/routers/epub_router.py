print("========================================")
print("CONTEXT READER MAIN.PY LOADED")
print("========================================")

from typing import List
from uuid import UUID

from fastapi import APIRouter, Header, HTTPException, status

from schemas.epub import (
    EPUBRegisterRequest,
    EPUBRegisterResponse,
    BookResponse,
    BookDeleteResponse,
)
from services.epub_service import EPUBService
from repositories.book_repository import BookRepository

router = APIRouter(prefix="/api/v1/epub", tags=["EPUB / Local-first"])
epub_service = EPUBService()


@router.post("/register", response_model=EPUBRegisterResponse)
async def register_local_epub(
    request: EPUBRegisterRequest,
    x_user_id: str = Header(..., description="Supabase User UUID"),
):
    """Register metadata/vocabulary for an EPUB already parsed in the browser.

    The EPUB binary is intentionally not accepted here.
    """
    return epub_service.register_local_book(x_user_id, request)


@router.get("/books", response_model=List[BookResponse])
async def list_books(x_user_id: str = Header(...)):
    return BookRepository.list_user_books(x_user_id)


@router.delete("/books/{book_id}", response_model=BookDeleteResponse)
async def delete_book(book_id: UUID, x_user_id: str = Header(...)):
    deleted = BookRepository.delete_book(x_user_id, str(book_id))
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Book not found or unauthorized",
        )
    return BookDeleteResponse(message="Book deleted successfully", book_id=book_id)
