from fastapi import APIRouter, Header, Query
from typing import List, Optional
from schemas.quiz import (
    QuizGenerateRequest,
    QuizQuestionResponse,
    QuizLogRequest,
    QuizLogResponse,
    GrammarTopicResponse,
    WeakTopicResponse,
    QuizClozeRequest,
    QuizClozeResponse
)
from services.quiz_service import QuizService
from repositories.quiz_repository import QuizRepository

router = APIRouter(prefix="/api/v1/quiz", tags=["Grammar Quiz"])
quiz_service = QuizService()

@router.get("/topics", response_model=List[GrammarTopicResponse])
async def get_grammar_topics(language: str = Query("japanese")):
    """Fetch curated grammar topics catalog for a given language."""
    return QuizRepository.get_grammar_topics(language)

@router.get("/weak-topics", response_model=List[WeakTopicResponse])
async def get_weak_grammar_topics(
    x_user_id: Optional[str] = Header("demo-user-123", description="Supabase User UUID")
):
    """Fetch user's lowest accuracy topics from quiz logs to suggest recap."""
    return QuizRepository.get_weak_topics(x_user_id or "demo-user-123")

@router.post("/generate", response_model=QuizQuestionResponse)
async def generate_quiz_question(
    req: QuizGenerateRequest,
    x_user_id: Optional[str] = Header("demo-user-123", description="Supabase User UUID")
):
    """Generate or retrieve a grammar quiz question (preseeded, rule-based, or LLM)."""
    return await quiz_service.generate_quiz(req, user_id=x_user_id or "demo-user-123")

@router.post("/cloze", response_model=QuizClozeResponse)
async def generate_sentence_cloze(req: QuizClozeRequest):
    """Generate a 4-choice fill-in-the-blank question from 1 single book sentence."""
    return await quiz_service.generate_cloze(req)

@router.post("/log", response_model=QuizLogResponse)
async def log_quiz_attempt(
    req: QuizLogRequest,
    x_user_id: Optional[str] = Header("demo-user-123", description="Supabase User UUID")
):
    """Log quiz result to analytics."""
    log_data = QuizRepository.create_quiz_log(
        user_id=x_user_id or "demo-user-123",
        theme=req.theme,
        language=req.language,
        complexity=req.complexity,
        is_correct=req.is_correct,
        question_id=req.question_id
    )
    return log_data