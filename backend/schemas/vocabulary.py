from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from uuid import UUID
from datetime import datetime

class WordDetail(BaseModel):
    base_word: str
    conjugated_word: str
    reading: str
    meaning: str

class VocabGenerateRequest(BaseModel):
    mode: Literal["jlpt", "books"]
    language: Literal["japanese", "english"] = "japanese"
    jlpt_level: Optional[Literal["N5", "N4", "N3", "N2", "N1"]] = "N5"
    book_id: Optional[UUID] = None
    start_page: Optional[int] = Field(default=1, ge=1)
    end_page: Optional[int] = Field(default=10, ge=1)
    sentence_max_words: int = Field(default=20, le=30)
    kanji_density: float = Field(default=0.5, ge=0.0, le=1.0)
    target_vocab_count: int = Field(default=3, le=5)

class VocabCardResponse(BaseModel):
    words: List[str]
    sentence: str
    translation: str
    word_details: List[WordDetail]

class SRSReviewRequest(BaseModel):
    word: str
    language: Literal["japanese", "english"] = "japanese"
    rating: Literal["very_hard", "hard", "ok", "good"]

class SRSReviewResponse(BaseModel):
    word: str
    next_review_date: datetime
    state: int
    difficulty: float
    stability: float
    reps: int
    lapses: int