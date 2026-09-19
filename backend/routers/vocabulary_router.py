from typing import List, Union

from fastapi import APIRouter, Header

from schemas.vocabulary import (
    EnrichBookSentenceRequest,
    EnrichBookSentenceResponse,
    SRSCardCreateRequest,
    SRSCardListItem,
    SRSCardResponse,
    SRSReviewRequest,
    SRSReviewResponse,
    TranslateSentenceRequest,
    TranslateSentenceResponse,
    VocabBookContextResponse,
    VocabCardResponse,
    VocabGenerateRequest,
)

from services.srs_service import SRSService
from repositories.srs_repository import SRSRepository


router = APIRouter(
    prefix="/api/v1/vocab",
    tags=["Vocabulary & SRS"]
)

srs_service = SRSService()


# ============================================================
# Generate vocabulary card
# ============================================================

@router.post(
    "/generate",
    response_model=Union[
        VocabCardResponse,
        VocabBookContextResponse
    ]
)
async def generate_vocab_card(
    req: VocabGenerateRequest,
    x_user_id: str = Header(
        ...,
        description="Supabase User UUID"
    )
):
    return await srs_service.generate_vocab_card(
        x_user_id,
        req
    )


# ============================================================
# Enrich a sentence from a local EPUB
# ============================================================

@router.post(
    "/enrich-book-sentence",
    response_model=EnrichBookSentenceResponse
)
async def enrich_book_sentence(
    req: EnrichBookSentenceRequest,
    x_user_id: str = Header(
        ...,
        description="Supabase User UUID"
    )
):
    return await srs_service.enrich_book_sentence(
        user_id=x_user_id,
        sentence=req.sentence,
        words=req.words
    )


# ============================================================
# Translate a sentence from the reader
# ============================================================

@router.post(
    "/translate-sentence",
    response_model=TranslateSentenceResponse
)
async def translate_sentence(
    req: TranslateSentenceRequest,
    x_user_id: str = Header(
        ...,
        description="Supabase User UUID"
    )
):
    return await srs_service.translate_sentence(
        user_id=x_user_id,
        sentence=req.sentence,
        language=req.language
    )


# ============================================================
# Add word to SRS
# ============================================================

@router.post(
    "/cards",
    response_model=SRSCardResponse
)
async def add_card_to_srs(
    req: SRSCardCreateRequest,
    x_user_id: str = Header(
        ...,
        description="Supabase User UUID"
    )
):
    card = srs_service.add_card(
        user_id=x_user_id,
        word=req.word,
        language=req.language
    )

    return SRSCardResponse(
        word=card["word"],
        language=card["language"],
        state=card.get("state", 0),
        difficulty=card.get("difficulty", 0.0),
        stability=card.get("stability", 0.0),
        reps=card.get("reps", 0),
        lapses=card.get("lapses", 0),
        next_review_date=card["next_review_date"],
        last_reviewed=card.get("last_reviewed"),
    )


# ============================================================
# Get user's SRS cards
# ============================================================

@router.get(
    "/cards",
    response_model=List[SRSCardListItem]
)
async def get_srs_cards(
    language: str = "japanese",
    x_user_id: str = Header(
        ...,
        description="Supabase User UUID"
    )
):
    cards = SRSRepository.get_all_cards(
        user_id=x_user_id,
        language=language
    )

    return [
        SRSCardListItem(
            word=card["word"],
            language=card["language"],
            state=card.get("state", 0),
            difficulty=card.get("difficulty", 0.0),
            stability=card.get("stability", 0.0),
            reps=card.get("reps", 0),
            lapses=card.get("lapses", 0),
            next_review_date=card["next_review_date"],
            last_reviewed=card.get("last_reviewed"),
        )
        for card in cards
    ]


# ============================================================
# Review card
# ============================================================

@router.post(
    "/review",
    response_model=SRSReviewResponse
)
async def review_card(
    req: SRSReviewRequest,
    x_user_id: str = Header(
        ...,
        description="Supabase User UUID"
    )
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
        state=card_data.get("state", 0),
        difficulty=card_data.get("difficulty", 0.0),
        stability=card_data.get("stability", 0.0),
        reps=card_data.get("reps", 0),
        lapses=card_data.get("lapses", 0)
    )


# ============================================================
# Book mastery
# ============================================================

@router.get(
    "/books/{book_id}/mastery"
)
async def get_book_mastery(
    book_id: str,
    language: str = "japanese",
    x_user_id: str = Header(...)
):
    return srs_service.get_book_mastery(
        user_id=x_user_id,
        book_id=book_id,
        language=language
    )