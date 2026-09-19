from pydantic import BaseModel, Field
from typing import List, Optional
from uuid import UUID
from datetime import datetime

class ComprehensionStats(BaseModel):
    total_unique_words: int
    known_words: int
    percentage: float

class EPUBAnalyzeResponse(BaseModel):
    total_range_words: int
    total_book_words: int
    full_book_stats: ComprehensionStats
    range_stats: ComprehensionStats

class BookResponse(BaseModel):
    id: UUID
    user_id: UUID
    title: str
    language: str
    cover_url: Optional[str] = None
    created_at: datetime

class EPUBProcessResponse(BaseModel):
    book_id: UUID
    title: str
    language: str
    pages_processed: int
    total_words_extracted: int

class BookDeleteResponse(BaseModel):
    message: str
    book_id: UUID