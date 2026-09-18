from pydantic import BaseModel, Field
from typing import List, Literal
from uuid import UUID
from datetime import datetime

class QuizGenerateRequest(BaseModel):
    language: Literal["japanese", "english"] = "japanese"
    theme: str = Field(..., example="N4 Te-form usage")
    complexity: int = Field(default=3, ge=1, le=5)

class QuizQuestionResponse(BaseModel):
    question: str
    options: List[str]
    correct_option_index: int
    explanation: str

class QuizLogRequest(BaseModel):
    theme: str
    language: Literal["japanese", "english"] = "japanese"
    complexity: int = Field(..., ge=1, le=5)
    is_correct: bool

class QuizLogResponse(BaseModel):
    id: UUID
    user_id: UUID
    theme: str
    language: str
    complexity: int
    is_correct: bool
    created_at: datetime