from pydantic import BaseModel, Field
from typing import Dict, List, Optional
from uuid import UUID
import typing

class UserSettingsResponse(BaseModel):
    id: UUID
    tier: str
    max_new_cards_per_day: int

class UserSettingsUpdate(BaseModel):
    max_new_cards_per_day: Optional[int] = Field(None, ge=1, le=100)

class AnalyticsOverviewResponse(BaseModel):
    total_books: int
    total_cards: int
    cards_due_today: int
    words_mastered: int = 0
    current_streak: int = 0
    quiz_total_attempts: int
    quiz_accuracy_rate: float
    grammar_theme_breakdown: Dict[str, Dict[str, typing.Any]]