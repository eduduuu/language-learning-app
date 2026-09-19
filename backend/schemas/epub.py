from datetime import datetime
from typing import List, Optional, Literal
from uuid import UUID
from pydantic import BaseModel, Field


class VocabularyItem(BaseModel):
    lemma: str = Field(min_length=1, max_length=200)
    surface: Optional[str] = Field(default=None, max_length=200)
    occurrences: int = Field(default=1, ge=1)


class EPUBRegisterUnit(BaseModel):
    # A local reader can map chapters/sections to these stable learning units.
    unit_number: int = Field(ge=1)
    vocabulary: List[VocabularyItem] = Field(default_factory=list, max_length=10000)


class EPUBRegisterRequest(BaseModel):
    fingerprint: str = Field(min_length=64, max_length=64)
    title: str = Field(min_length=1, max_length=500)
    language: Literal["japanese", "english"]
    total_unique_words: int = Field(ge=0)
    units: List[EPUBRegisterUnit] = Field(default_factory=list, max_length=10000)


class EPUBRegisterResponse(BaseModel):
    book_id: UUID
    title: str
    language: str
    fingerprint: str
    created: bool
    total_unique_words: int
    units_registered: int
    registered_at: datetime


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
    fingerprint: Optional[str] = None
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
