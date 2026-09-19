from fastapi import APIRouter, UploadFile, File, Form, Header, HTTPException, status
from typing import List
from uuid import UUID

from schemas.epub import EPUBAnalyzeResponse, EPUBProcessResponse, BookResponse, BookDeleteResponse
from services.epub_service import EPUBService
from repositories.book_repository import BookRepository

router = APIRouter(prefix="/api/v1/epub", tags=["EPUB Ingestion"])
epub_service = EPUBService()

@router.post("/process", response_model=EPUBProcessResponse)
async def process_epub(
    file: UploadFile = File(...),
    title: str = Form(...),
    language: str = Form(...),
    start_page: int = Form(1),
    end_page: int = Form(10),
    x_user_id: str = Header(..., description="Supabase User UUID")
):
    if not file.filename.endswith(".epub"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file format. Only .epub files are supported."
        )

    file_bytes = await file.read()
    
    book, pages_count, total_words = epub_service.process_and_store_epub(
        user_id=x_user_id,
        file_bytes=file_bytes,
        title=title,
        language=language.lower(),
        start_page=start_page,
        end_page=end_page
    )

    return EPUBProcessResponse(
        book_id=book["id"],
        title=book["title"],
        language=book["language"],
        pages_processed=pages_count,
        total_words_extracted=total_words
    )

@router.get("/books", response_model=List[BookResponse])
async def list_books(x_user_id: str = Header(...)):
    return BookRepository.list_user_books(x_user_id)

@router.delete("/books/{book_id}", response_model=BookDeleteResponse)
async def delete_book(book_id: UUID, x_user_id: str = Header(...)):
    deleted = BookRepository.delete_book(x_user_id, str(book_id))
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found or unauthorized")
    return BookDeleteResponse(message="Book deleted successfully", book_id=book_id)

@router.post("/analyze", response_model=EPUBAnalyzeResponse)
async def analyze_epub(
    file: UploadFile = File(...),
    language: str = Form("japanese"),
    start_page: int = Form(1),
    end_page: int = Form(10),
    x_user_id: str = Header(..., description="Supabase User UUID")
):
    file_bytes = await file.read()
    return epub_service.analyze_epub(
        user_id=x_user_id,
        file_bytes=file_bytes,
        language=language,
        start_page=start_page,
        end_page=end_page
    )