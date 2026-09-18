import re
import io
import ebooklib
from ebooklib import epub
from bs4 import BeautifulSoup
from typing import List, Dict, Any, Tuple
from fastapi import HTTPException, status
import fugashi

from repositories.book_repository import BookRepository

class EPUBService:
    def __init__(self):
        # Initialize Fugashi tagger for Japanese morphological analysis
        try:
            self.tagger = fugashi.Tagger()
        except Exception:
            self.tagger = None

    def _tokenize_text(self, text: str, language: str) -> List[str]:
        """Extracts unique vocabulary words base forms depending on the target language."""
        if language.lower() == "japanese":
            if not self.tagger:
                # Fallback regex if fugashi fails to load dictionary
                return list(set(re.findall(r'[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]+', text)))
            
            words = set()
            for word in self.tagger(text):
                # Extract dictionary form / lemma of nouns, verbs, and adjectives
                pos = word.feature.pos1 if hasattr(word.feature, 'pos1') else ""
                if pos in ['名詞', '動詞', '形容詞']:  # Noun, Verb, Adjective
                    words.add(word.feature.orthBase if hasattr(word.feature, 'orthBase') and word.feature.orthBase else word.surface)
            return list(words)
        else:
            # English tokenization: lowercased unique words with length > 2
            words = re.findall(r'\b[a-zA-Z]{3,}\b', text.lower())
            return list(set(words))

    def _extract_epub_pages(self, file_bytes: bytes, start_page: int, end_page: int) -> List[str]:
        """Reads EPUB bytes and extracts raw HTML/text per chapter/page."""
        book = epub.read_epub(io.BytesIO(file_bytes))
        pages_text = []

        for item in book.get_items_of_type(ebooklib.ITEM_DOCUMENT):
            soup = BeautifulSoup(item.get_content(), "html.parser")
            text = soup.get_text(separator=" ", strip=True)
            if text:
                pages_text.append(text)

        # Slice to requested range (1-indexed page bounds)
        total_extracted = len(pages_text)
        start_idx = max(0, start_page - 1)
        end_idx = min(total_extracted, end_page)

        if start_idx >= total_extracted:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Requested start page ({start_page}) exceeds total document pages ({total_extracted})."
            )

        return pages_text[start_idx:end_idx]

    def process_and_store_epub(
        self,
        user_id: str,
        file_bytes: bytes,
        title: str,
        language: str,
        start_page: int,
        end_page: int
    ) -> Tuple[Dict[str, Any], int, int]:
        
        # 1. Tier Enforcement
        tier = BookRepository.get_user_tier(user_id)
        requested_page_count = (end_page - start_page) + 1

        if tier == "free":
            current_book_count = BookRepository.count_user_books(user_id)
            if current_book_count >= 3:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Free tier limit reached (3 books max). Delete a book to upload a new one."
                )
            if requested_page_count > 10:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Free tier users can only extract up to 10 pages per request."
                )

        # 2. Extract EPUB pages
        extracted_pages = self._extract_epub_pages(file_bytes, start_page, end_page)

        # 3. Create Book entry in Supabase
        book = BookRepository.create_book(user_id, title, language)
        book_id = book["id"]

        # 4. Tokenize vocabulary per page and build page records
        pages_to_insert = []
        total_vocab_count = 0

        for idx, page_text in enumerate(extracted_pages):
            page_num = start_page + idx
            vocab_list = self._tokenize_text(page_text, language)
            total_vocab_count += len(vocab_list)

            pages_to_insert.append({
                "book_id": book_id,
                "page_number": page_num,
                "vocabulary": vocab_list
            })

        if pages_to_insert:
            BookRepository.create_book_pages(pages_to_insert)

        return book, len(extracted_pages), total_vocab_count