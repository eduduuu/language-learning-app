from fastapi import APIRouter, Header
from schemas.quiz import QuizGenerateRequest, QuizQuestionResponse, QuizLogRequest, QuizLogResponse
from services.quiz_service import QuizService
from repositories.quiz_repository import QuizRepository

router = APIRouter(prefix="/api/v1/quiz", tags=["Grammar Quiz"])
quiz_service = QuizService()

@router.post("/generate", response_model=QuizQuestionResponse)
async def generate_quiz_question(req: QuizGenerateRequest):
    return await quiz_service.generate_quiz(req)

@router.post("/log", response_model=QuizLogResponse)
async def log_quiz_attempt(
    req: QuizLogRequest,
    x_user_id: str = Header(..., description="Supabase User UUID")
):
    log_data = QuizRepository.create_quiz_log(
        user_id=x_user_id,
        theme=req.theme,
        language=req.language,
        complexity=req.complexity,
        is_correct=req.is_correct
    )
    return log_data