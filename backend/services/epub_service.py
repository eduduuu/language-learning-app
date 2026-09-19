import re
import io
from typing import List, Dict, Any, Tuple, Optional
import ebooklib
from ebooklib import epub
from bs4 import BeautifulSoup
from fastapi import HTTPException, status
import fugashi

from core.supabase import supabase
from repositories.book_repository import BookRepository
from services.srs_service import SRSRepository

class EPUBService:
    def __init__(self):
        # Initialize Fugashi tagger for Japanese morphological analysis
        try:
            self.tagger = fugashi.Tagger()
        except Exception:
            self.tagger = None

    def _upload_cover_to_storage(self, book: epub.EpubBook, user_id: str, title: str) -> Optional[str]:
        """Extracts cover bytes and uploads directly to Supabase Storage."""
        cover_item = None

        # Strategy 1: Look for items with 'cover' in ID or name
        for item in book.get_items_of_type(ebooklib.ITEM_IMAGE):
            item_name = item.get_name().lower()
            item_id = (item.get_id() or "").lower()
            if "cover" in item_name or "cover" in item_id:
                cover_item = item
                break

        # Strategy 2: Fallback to the first image found in the EPUB
        if not cover_item:
            images = list(book.get_items_of_type(ebooklib.ITEM_IMAGE))
            if images:
                cover_item = images[0]

        if not cover_item:
            return None

        try:
            image_bytes = cover_item.get_content()
            file_ext = "jpg" if "jpg" in cover_item.media_type or "jpeg" in cover_item.media_type else "png"
            
            # Sanitize filename path
            clean_title = "".join(c for c in title if c.isalnum() or c in (' ', '_')).rstrip()
            file_path = f"{user_id}/{clean_title}_cover.{file_ext}"

            # Upload to Supabase Storage bucket
            supabase.storage.from_("covers").upload(
                path=file_path,
                file=image_bytes,
                file_options={"content-type": cover_item.media_type, "upsert": "true"}
            )

            # Retrieve public URL
            public_url = supabase.storage.from_("covers").get_public_url(file_path)
            return public_url
        except Exception as e:
            print(f"Failed to upload cover image: {e}")
            return None

    def _tokenize_text(self, text: str, language: str) -> List[str]:
        """Extracts unique vocabulary base forms depending on the target language."""
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

    def _extract_epub_pages(
        self, 
        book_obj: epub.EpubBook, 
        start_page: int, 
        end_page: int, 
        words_per_page: int = 250
    ) -> List[str]:
        # 1. Extrai todo o texto contínuo do livro
        full_text = []
        for item in book_obj.get_items_of_type(ebooklib.ITEM_DOCUMENT):
            soup = BeautifulSoup(item.get_content(), "html.parser")
            text = soup.get_text(separator=" ", strip=True)
            if text:
                full_text.append(text)
                
        combined_text = " ".join(full_text)
        words = combined_text.split()

        # 2. Divide em blocos virtuais de N palavras por página
        pages = []
        total_words = len(words)
        
        for i in range(0, total_words, words_per_page):
            page_words = words[i : i + words_per_page]
            pages.append(" ".join(page_words))

        # 3. Retorna o intervalo de páginas virtuais pretendido (índice baseado em 1)
        start_idx = max(0, start_page - 1)
        end_idx = min(len(pages), end_page)

        return pages[start_idx:end_idx]

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

        # 2. Read EPUB Bytes
        try:
            book_obj = epub.read_epub(io.BytesIO(file_bytes))
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid or corrupted EPUB file: {str(e)}"
            )

        # 3. Extract cover & upload to Supabase Storage
        cover_url = self._upload_cover_to_storage(book_obj, user_id, title)

        # 4. Extract EPUB text pages
        extracted_pages = self._extract_epub_pages(book_obj, start_page, end_page)

        # 5. Create Book entry in Supabase
        book = BookRepository.create_book(user_id, title, language, cover_url=cover_url)
        book_id = book["id"]

        # 6. Tokenize vocabulary per page and build page records
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

    def analyze_epub(
        self,
        user_id: str,
        file_bytes: bytes,
        language: str,
        start_page: int,
        end_page: int
    ) -> Dict[str, Any]:
        """Calculates comprehension metrics without writing anything to the database."""
        try:
            book_obj = epub.read_epub(io.BytesIO(file_bytes))
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid or corrupted EPUB file: {str(e)}"
            )

        # 1. Extract vocabulary for page range
        extracted_pages = self._extract_epub_pages(book_obj, start_page, end_page)
        range_unique_words = set()
        for page_text in extracted_pages:
            range_unique_words.update(self._tokenize_text(page_text, language))

        # 2. Extract vocabulary for entire book
        full_book_words = set()
        for item in book_obj.get_items_of_type(ebooklib.ITEM_DOCUMENT):
            soup = BeautifulSoup(item.get_content(), "html.parser")
            text = soup.get_text(separator=" ", strip=True)
            if text:
                full_book_words.update(self._tokenize_text(text, language))

        # 3. Cross-reference with user SRS vocabulary (state > 0)
        user_cards = SRSRepository.get_user_vocabulary(user_id, language)
        known_words_set = {card["word"] for card in user_cards if card.get("state", 0) > 0}

        def build_stats(word_set: set) -> Dict[str, Any]:
            total = len(word_set)
            known = len(word_set.intersection(known_words_set))
            pct = round((known / total) * 100, 1) if total > 0 else 0.0
            return {"total_unique_words": total, "known_words": known, "percentage": pct}

        return {
            "total_range_words": len(range_unique_words),
            "total_book_words": len(full_book_words),
            "full_book_stats": build_stats(full_book_words),
            "range_stats": build_stats(range_unique_words),
        }