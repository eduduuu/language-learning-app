from fastapi import APIRouter, Header

from repositories.reading_progress_repository import (
    ReadingProgressRepository
)

router = APIRouter(
    prefix="/api/v1/reading",
    tags=["Reading Progress"]
)


@router.get(
    "/books/{book_id}/progress"
)
async def get_reading_progress(
    book_id: str,
    x_user_id: str = Header(...)
):
    progress = ReadingProgressRepository.get(
        x_user_id,
        book_id
    )

    if not progress:
        return None

    return progress


@router.put(
    "/books/{book_id}/progress"
)
async def save_reading_progress(
    book_id: str,
    chapter_key: str,
    paragraph_index: int,
    x_user_id: str = Header(...)
):
    return ReadingProgressRepository.upsert(
        user_id=x_user_id,
        book_id=book_id,
        chapter_key=chapter_key,
        paragraph_index=paragraph_index
    )