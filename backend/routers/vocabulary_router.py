from fastapi import APIRouter, Header
from schemas.vocabulary import (
    VocabGenerateRequest,
    VocabCardResponse,
    SRSReviewRequest,
    SRSReviewResponse,
)
from services.srs_service import SRSService

router = APIRouter(prefix="/api/v1/vocab", tags=["Vocabulary & SRS"])
srs_service = SRSService()

@router.post("/generate", response_model=VocabCardResponse)
async def generate_vocab_card(
    req: VocabGenerateRequest,
    x_user_id: str = Header(..., description="Supabase User UUID")
):
    return await srs_service.generate_vocab_card(x_user_id, req)

@router.post("/review", response_model=SRSReviewResponse)
async def review_card(
    req: SRSReviewRequest,
    x_user_id: str = Header(..., description="Supabase User UUID")
):
    card_data = srs_service.process_review(
        user_id=x_user_id,
        word=req.word,
        language=req.language,
        rating=req.rating
    )
    return SRSReviewResponse(
        word=card_data["word"],
        next_review_date=card_data["next_review_date"],
        interval=card_data["interval"],
        ease_factor=card_data["ease_factor"],
        step_count=card_data["step_count"]
    )