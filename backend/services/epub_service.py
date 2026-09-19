from datetime import datetime, timezone
from typing import Dict, Any
from fastapi import HTTPException, status

from repositories.book_repository import BookRepository
from schemas.epub import EPUBRegisterRequest


class EPUBService:
    """Cloud-side book registration for the local-first architecture.

    The browser owns the EPUB and performs all parsing/tokenization. This
    service receives only metadata and a vocabulary projection needed by the
    existing SRS/book-selection features.
    """

    def register_local_book(self, user_id: str, request: EPUBRegisterRequest) -> Dict[str, Any]:
        tier = BookRepository.get_user_tier(user_id)

        if tier == "free":
            existing = BookRepository.get_book_by_fingerprint(user_id, request.fingerprint)
            if existing is None and BookRepository.count_user_books(user_id) >= 3:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Free tier limit reached (3 books max). Delete a book to add a new one.",
                )

        existing = BookRepository.get_book_by_fingerprint(user_id, request.fingerprint)

        if existing:
            book_id = str(existing["id"])
            created = False
            book = existing
        else:
            book = BookRepository.create_book(
                user_id=user_id,
                title=request.title,
                language=request.language,
                fingerprint=request.fingerprint,
            )
            book_id = str(book["id"])
            created = True

        # Keep the old book_pages projection because the existing SRS service
        # already consumes it. It now contains only vocabulary, never EPUB text.
        pages = []
        for unit in request.units:
            vocabulary = []
            seen = set()

            for item in unit.vocabulary:
                lemma = item.lemma.strip()
                if not lemma or lemma in seen:
                    continue
                seen.add(lemma)
                vocabulary.append(lemma)

            pages.append({
                "book_id": book_id,
                "page_number": unit.unit_number,
                "vocabulary": vocabulary,
            })

        # Re-registration is safe and gives the cloud projection the same
        # vocabulary as the local IndexedDB copy.
        BookRepository.replace_book_pages(book_id, pages)

        return {
            "book_id": book_id,
            "title": book["title"],
            "language": book["language"],
            "fingerprint": request.fingerprint,
            "created": created,
            "total_unique_words": request.total_unique_words,
            "units_registered": len(pages),
            "registered_at": datetime.now(timezone.utc),
        }
