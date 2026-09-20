from pydantic import BaseModel, Field
from typing import List, Optional, Literal, Dict, Any
from uuid import UUID
from datetime import datetime

class QuizGenerateRequest(BaseModel):
    language: str = "japanese"
    theme: str = Field(..., example="N4 Te-form usage")
    complexity: int = Field(default=3, ge=1, le=5)
    topic_id: Optional[str] = None
    use_preseeded_only: bool = False

class QuizQuestionResponse(BaseModel):
    id: Optional[str] = None
    question: str
    options: List[str]
    correct_option_index: int
    explanation: str
    topic_id: Optional[str] = None
    rule_explanation: Optional[str] = None
    source: str = "llm" # 'preseeded', 'rule_engine', 'llm'

class QuizClozeRequest(BaseModel):
    sentence: str = Field(..., min_length=5, example="一隻の飛空艇が港湾区画へと入ってきた。")
    language: str = "japanese"

class QuizClozeResponse(BaseModel):
    question: str
    options: List[str]
    correct_option_index: int
    explanation: str
    masked_target: Optional[str] = None

class GrammarTopicResponse(BaseModel):
    id: UUID
    language: str
    level: str
    category: str
    title: str
    summary: str
    rule_explanation: Optional[str] = None
    pattern_regex: Optional[str] = None
    weight: float = 1.0

class WeakTopicResponse(BaseModel):
    theme: str
    total: int
    correct: int
    accuracy: float
    rule_explanation: Optional[str] = None

class QuizLogRequest(BaseModel):
    theme: str
    language: str = "japanese"
    complexity: int = Field(..., ge=1, le=5)
    is_correct: bool
    question_id: Optional[str] = None

class QuizLogResponse(BaseModel):
    id: UUID
    user_id: UUID
    question_id: Optional[UUID] = None
    theme: str
    language: str
    complexity: int
    is_correct: bool
    created_at: datetime