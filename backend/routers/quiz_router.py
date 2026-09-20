from fastapi import APIRouter, Depends, Query
from typing import List

from core.auth import get_current_user
from schemas.quiz import (
    QuizGenerateRequest,
    QuizQuestionResponse,
    QuizClozeRequest,
    QuizClozeResponse,
    QuizLogRequest,
    QuizLogResponse,
    WeakTopicResponse
)
from services.quiz_service import QuizService
from repositories.quiz_repository import QuizRepository

router = APIRouter(prefix="/api/v1/quiz", tags=["Quiz"])
quiz_service = QuizService()

@router.get("/topics")
async def get_grammar_topics(language: str = Query("japanese")):
    """Fetch curated grammar topics catalog for a given language."""
    return QuizRepository.get_grammar_topics(language)

@router.get("/weak-topics", response_model=List[WeakTopicResponse])
async def get_weak_grammar_topics(
    user_id: str = Depends(get_current_user)
):
    """Fetch user's lowest accuracy topics from quiz logs to suggest recap."""
    return QuizRepository.get_weak_topics(user_id)

@router.post("/generate", response_model=QuizQuestionResponse)
async def generate_quiz_question(
    req: QuizGenerateRequest,
    user_id: str = Depends(get_current_user)
):
    """Generate or retrieve a grammar quiz question (preseeded, rule-based, or LLM)."""
    return await quiz_service.generate_quiz(req, user_id=user_id)

@router.post("/cloze", response_model=QuizClozeResponse)
async def generate_sentence_cloze(req: QuizClozeRequest):
    """Generate a 4-choice fill-in-the-blank question from 1 single book sentence."""
    return await quiz_service.generate_cloze(req)

@router.post("/log", response_model=QuizLogResponse)
async def log_quiz_attempt(
    req: QuizLogRequest,
    user_id: str = Depends(get_current_user)
):
    """Log quiz result to analytics."""
    log_data = QuizRepository.create_quiz_log(
        user_id=user_id,
        theme=req.theme,
        language=req.language,
        complexity=req.complexity,
        is_correct=req.is_correct,
        question_id=req.question_id
    )
    return log_data