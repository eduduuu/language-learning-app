from fastapi import APIRouter, Depends
from typing import Optional

from core.auth import get_current_user
from repositories.reading_progress_repository import ReadingProgressRepository

router = APIRouter(
    prefix="/api/v1/reading",
    tags=["Reading Progress"]
)


@router.get("/books/{book_id}/progress")
async def get_reading_progress(
    book_id: str,
    user_id: str = Depends(get_current_user)
):
    progress = ReadingProgressRepository.get(
        user_id,
        book_id
    )

    if not progress:
        return None

    return progress


@router.put("/books/{book_id}/progress")
async def save_reading_progress(
    book_id: str,
    chapter_key: str,
    paragraph_index: int,
    user_id: str = Depends(get_current_user)
):
    return ReadingProgressRepository.upsert(
        user_id=user_id,
        book_id=book_id,
        chapter_key=chapter_key,
        paragraph_index=paragraph_index
    )

