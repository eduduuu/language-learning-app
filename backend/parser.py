import os
import re
import json
import ebooklib
from ebooklib import epub
from bs4 import BeautifulSoup
import fugashi
from dotenv import load_dotenv
from openai import OpenAI
from tenacity import retry, stop_after_attempt, wait_exponential
from prompts import PROMPTS, GRAMMAR_RULES

load_dotenv()

def extract_text_by_page_range(epub_path: str, start_page: int = 1, end_page: int = 1, chars_per_page: int = 1000) -> str:
    """Extracts raw text from EPUB documents and slices it into simulated page lengths."""
    book = epub.read_epub(epub_path)
    full_text = ""
    
    for item in book.get_items_of_type(ebooklib.ITEM_DOCUMENT):
        soup = BeautifulSoup(item.get_content(), 'html.parser')
        full_text += soup.get_text() + "\n"
    
    total_chars = len(full_text)
    start_idx = max(0, (start_page - 1) * chars_per_page)
    end_idx = min(total_chars, end_page * chars_per_page)
    
    if start_idx >= total_chars:
        return full_text[-chars_per_page:] if total_chars > 0 else ""
        
    return full_text[start_idx:end_idx]

def extract_vocabulary(text: str, language: str = "japanese") -> list[str]:
    """Tokenizes text based on language and returns unique target vocabulary lemmas."""
    if language == "japanese":
        tagger = fugashi.Tagger()
        vocab_set = set()
        japanese_pattern = re.compile(r'[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]')
        
        for word in tagger(text):
            if word.feature.pos1 in ["名詞", "動詞", "形容詞"]:  
                lemma = word.feature.lemma if word.feature.lemma else word.surface
                if japanese_pattern.search(lemma):
                    vocab_set.add(lemma)
        return list(vocab_set)
    else:
        # Simple English tokenizer
        words = re.findall(r'\b[a-zA-Z]{4,}\b', text.lower())
        stopwords = {"with", "that", "this", "from", "they", "have", "been", "were", "what", "when", "where"}
        return list(set([w for w in words if w not in stopwords]))

@retry(stop=stop_after_attempt(4), wait=wait_exponential(multiplier=2, min=4, max=20))
def generate_single_flashcard(
    vocab_list: list[str],
    language: str = "japanese",
    target_words_count: int = 2,
    complexity: str = "absolute_beginner",
    sentence_length_words: int = 10,
    kanji_ratio: float = 0.3
) -> str:
    """Generates a contextual practice flashcard with prompt configuration routing."""
    client = OpenAI(
        base_url="https://api.groq.com/openai/v1",
        api_key=os.getenv("GROQ_API_KEY")
    )

    lang_prompts = PROMPTS.get(language, PROMPTS["japanese"])
    lang_grammar = GRAMMAR_RULES.get(language, GRAMMAR_RULES["japanese"])
    selected_grammar = lang_grammar.get(complexity, lang_grammar["absolute_beginner"])

    if kanji_ratio <= 0.2:
        kanji_instruction = "Use Hiragana for almost everything. Only use Kanji for explicit target words."
    elif kanji_ratio <= 0.6:
        kanji_instruction = "Use Hiragana for common auxiliary words. Use standard Kanji moderately."
    else:
        kanji_instruction = "Use standard modern Japanese Kanji frequency for all nouns, verbs, and adjectives."

    prompt_template = lang_prompts["flashcard_base"]
    prompt = prompt_template.format(
        vocab_list=', '.join(vocab_list[:target_words_count]),
        selected_grammar=selected_grammar,
        kanji_ratio=kanji_ratio,
        kanji_instruction=kanji_instruction,
        sentence_length_words=sentence_length_words
    )

    response = client.chat.completions.create(
        model="qwen/qwen3.8-27b",
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"}
    )
    
    return response.choices[0].message.content

@retry(stop=stop_after_attempt(4), wait=wait_exponential(multiplier=2, min=4, max=20))
def generate_grammar_question(topic: str = "particles", complexity: str = "absolute_beginner", language: str = "japanese") -> str:
    """Generates a multiple-choice grammar question."""
    client = OpenAI(
        base_url="https://api.groq.com/openai/v1",
        api_key=os.getenv("GROQ_API_KEY")
    )

    lang_prompts = PROMPTS.get(language, PROMPTS["japanese"])
    prompt = lang_prompts["grammar_question"].format(topic=topic, complexity=complexity)

    response = client.chat.completions.create(
        model="qwen/qwen3.8-27b",
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"}
    )
    
    return response.choices[0].message.content