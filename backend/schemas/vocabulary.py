from datetime import datetime
from typing import List, Optional, Literal

from pydantic import BaseModel, Field


# ============================================================
# Vocabulary generation
# ============================================================

class WordDetail(BaseModel):
    base_word: str
    conjugated_word: str
    reading: str
    meaning: str


class VocabGenerateRequest(BaseModel):
    mode: Literal["jlpt", "books"] = "books"

    sentence_mode: Literal["book", "ai"] = "book"

    language: Literal["japanese", "english"] = "japanese"

    jlpt_level: Optional[
        Literal["N5", "N4", "N3", "N2", "N1"]
    ] = None

    book_id: Optional[str] = None

    start_page: Optional[int] = Field(
        default=1,
        ge=1
    )

    end_page: Optional[int] = Field(
        default=10,
        ge=1
    )

    sentence_max_words: int = Field(
        default=20,
        ge=1,
        le=30
    )

    kanji_density: float = Field(
        default=0.5,
        ge=0.0,
        le=1.0
    )

    target_vocab_count: int = Field(
        default=1,
        ge=1,
        le=5
    )


class VocabCardResponse(BaseModel):
    words: List[str]
    sentence: str
    translation: str
    word_details: List[WordDetail]


class VocabBookContextResponse(BaseModel):
    words: List[str]
    book_id: str
    sentence_mode: Literal["book"] = "book"


# ============================================================
# Book sentence enrichment
# ============================================================

class EnrichBookSentenceRequest(BaseModel):
    sentence: str = Field(
        ...,
        min_length=1,
        max_length=5000
    )

    words: List[str] = Field(
        ...,
        min_length=1,
        max_length=10
    )


class EnrichBookSentenceResponse(BaseModel):
    translation: str
    word_details: List[WordDetail]


# ============================================================
# Reader sentence translation
# ============================================================

class TranslateSentenceRequest(BaseModel):
    sentence: str = Field(
        ...,
        min_length=1,
        max_length=5000
    )

    language: Literal["japanese", "english"] = "japanese"


class TranslateSentenceResponse(BaseModel):
    translation: str


# ============================================================
# SRS review
# ============================================================

class SRSReviewRequest(BaseModel):
    word: str
    language: Literal["japanese", "english"] = "japanese"
    rating: Literal[
        "very_hard",
        "hard",
        "ok",
        "good"
    ]


class SRSReviewResponse(BaseModel):
    word: str
    next_review_date: datetime
    state: int
    difficulty: float
    stability: float
    reps: int
    lapses: int


# ============================================================
# SRS card creation
# ============================================================

class SRSCardCreateRequest(BaseModel):
    word: str
    language: Literal["japanese", "english"] = "japanese"


class SRSCardResponse(BaseModel):
    word: str
    language: str
    state: int
    difficulty: float
    stability: float
    reps: int
    lapses: int
    next_review_date: datetime
    last_reviewed: Optional[datetime] = None


class SRSCardListItem(BaseModel):
    word: str
    language: str
    state: int
    difficulty: float
    stability: float
    reps: int
    lapses: int
    next_review_date: datetime
    last_reviewed: Optional[datetime] = None