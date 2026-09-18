from pydantic import BaseModel, Field
from typing import List
from uuid import UUID
from datetime import datetime

class BookResponse(BaseModel):
    id: UUID
    user_id: UUID
    title: str
    language: str
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