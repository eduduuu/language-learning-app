from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from core.auth import get_current_user
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
    user_id: str = Depends(get_current_user),
):
    """Register metadata/vocabulary for an EPUB already parsed in the browser.

    The EPUB binary is intentionally not accepted here.
    """
    return epub_service.register_local_book(user_id, request)


@router.get("/books", response_model=List[BookResponse])
async def list_books(user_id: str = Depends(get_current_user)):
    return BookRepository.list_user_books(user_id)


@router.delete("/books/{book_id}", response_model=BookDeleteResponse)
async def delete_book(book_id: UUID, user_id: str = Depends(get_current_user)):
    deleted = BookRepository.delete_book(user_id, str(book_id))
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Book not found or unauthorized",
        )
    return BookDeleteResponse(message="Book deleted successfully", book_id=book_id)

