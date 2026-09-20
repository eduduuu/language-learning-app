from typing import List, Union

from fastapi import APIRouter, Header, HTTPException

from schemas.vocabulary import (
    AnkiImportRequest,
    AnkiImportResponse,
    EnrichBookSentenceRequest,
    EnrichBookSentenceResponse,
    SRSCardBulkActionRequest,
    SRSCardCreateRequest,
    SRSCardListItem,
    SRSCardResponse,
    SRSCardUpdateRequest,
    SRSReviewRequest,
    SRSReviewResponse,
    TranslateSentenceRequest,
    TranslateSentenceResponse,
    VocabBookContextResponse,
    VocabCardResponse,
    VocabGenerateRequest,
    WordLookupRequest,
    WordLookupResponse,
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


# ============================================================
# Record word lookup
# ============================================================

@router.post(
    "/lookup",
    response_model=WordLookupResponse
)
async def record_word_lookup(
    req: WordLookupRequest,
    x_user_id: str = Header(...)
):
    result = SRSRepository.record_word_lookup(
        user_id=x_user_id,
        word=req.word,
        language=req.language
    )
    return WordLookupResponse(
        word=req.word,
        lookup_count=result.get("lookup_count", 1)
    )


# ============================================================
# Update card status / reschedule
# ============================================================

@router.patch(
    "/cards/{word}",
    response_model=SRSCardResponse
)
async def update_srs_card(
    word: str,
    req: SRSCardUpdateRequest,
    language: str = "japanese",
    x_user_id: str = Header(...)
):
    updated = SRSRepository.update_card_status(
        user_id=x_user_id,
        word=word,
        language=language,
        state=req.state,
        next_review_date=req.next_review_date,
        reps=req.reps,
        stability=req.stability,
        difficulty=req.difficulty,
        lapses=req.lapses,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Card not found")

    return SRSCardResponse(
        word=updated["word"],
        language=updated["language"],
        state=updated.get("state", 0),
        difficulty=updated.get("difficulty", 0.0),
        stability=updated.get("stability", 0.0),
        reps=updated.get("reps", 0),
        lapses=updated.get("lapses", 0),
        next_review_date=updated["next_review_date"],
        last_reviewed=updated.get("last_reviewed"),
    )


# ============================================================
# Delete card from SRS
# ============================================================

@router.delete(
    "/cards/{word}"
)
async def delete_srs_card(
    word: str,
    language: str = "japanese",
    x_user_id: str = Header(...)
):
    success = SRSRepository.delete_card(
        user_id=x_user_id,
        word=word,
        language=language
    )
    return {"success": success, "word": word}


# ============================================================
# Bulk card actions
# ============================================================

@router.post(
    "/cards/bulk-action"
)
async def bulk_card_action(
    req: SRSCardBulkActionRequest,
    x_user_id: str = Header(...)
):
    affected = SRSRepository.bulk_action(
        user_id=x_user_id,
        words=req.words,
        language=req.language,
        action=req.action,
        target_date=req.target_date
    )
    return {"affected": affected, "action": req.action}


# ============================================================
# Import from Anki
# ============================================================

@router.post(
    "/import-anki",
    response_model=AnkiImportResponse
)
async def import_anki_cards(
    req: AnkiImportRequest,
    x_user_id: str = Header(...)
):
    cards_data = [item.model_dump() for item in req.cards]
    imported = SRSRepository.bulk_upsert_cards(
        user_id=x_user_id,
        cards=cards_data,
        language=req.language,
        import_progress=req.import_progress
    )
    return AnkiImportResponse(
        imported_count=imported,
        total_cards=len(req.cards)
    )