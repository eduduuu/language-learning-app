import os
import re
import json
import random
import ebooklib
from ebooklib import epub
from bs4 import BeautifulSoup
import fugashi
from dotenv import load_dotenv
from openai import OpenAI
from tenacity import retry, stop_after_attempt, wait_fixed

load_dotenv()

def extract_text_by_page_range(epub_path: str, start_page: int = 1, end_page: int = 1, chars_per_page: int = 1000) -> str:
    """
    Simulates pagination by extracting raw text from EPUB documents and slicing it
    into character blocks (pages) of `chars_per_page` size.
    """
    book = epub.read_epub(epub_path)
    full_text = ""
    
    for item in book.get_items_of_type(ebooklib.ITEM_DOCUMENT):
        soup = BeautifulSoup(item.get_content(), 'html.parser')
        full_text += soup.get_text() + "\n"
    
    # Calculate index bounds based on simulated page length
    total_chars = len(full_text)
    start_idx = max(0, (start_page - 1) * chars_per_page)
    end_idx = min(total_chars, end_page * chars_per_page)
    
    if start_idx >= total_chars:
        return full_text[-chars_per_page:] if total_chars > 0 else ""
        
    return full_text[start_idx:end_idx]

def extract_vocabulary(japanese_text: str) -> list[str]:
    """Tokenizes Japanese text with fugashi and extracts unique lemmas for nouns, verbs, and adjectives."""
    tagger = fugashi.Tagger()
    vocab_set = set()
    japanese_pattern = re.compile(r'[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]')
    
    for word in tagger(japanese_text):
        if word.feature.pos1 in ["名詞", "動詞", "形容詞"]:  
            lemma = word.feature.lemma if word.feature.lemma else word.surface
            if japanese_pattern.search(lemma):
                vocab_set.add(lemma)
            
    return list(vocab_set)

@retry(stop=stop_after_attempt(3), wait=wait_fixed(2))
def generate_single_flashcard(
    vocab_list: list[str],
    target_words_count: int = 2,
    complexity: str = "absolute_beginner",
    sentence_length_words: int = 10,
    kanji_ratio: float = 0.3
) -> str:
    """
    Generates a single Japanese flashcard sentence with strict kanji density,
    sentence length controls, and formatting rules.
    """
    client = OpenAI(
        base_url="https://api.groq.com/openai/v1",
        api_key=os.getenv("GROQ_API_KEY")
    )

    grammar_rules = {
        "absolute_beginner": """
            - End every sentence consistently in polite form (~です or ~ます).
            - Use only basic particles: は, が, を, に, で, と, の.
            - Avoid complex structures (no passive, causative, or nested clause conditionals).
            - Each sentence must convey a single, clear thought.
        """,
        "elementary": """
            - End sentences in polite form (~です or ~ます), but te-form (~て) may be used to connect two simple clauses.
            - Basic time markers and basic compound verbs are permitted.
        """
    }
    selected_grammar = grammar_rules.get(complexity, grammar_rules["absolute_beginner"])

    # Translate kanji_ratio (0.0 = minimal kanji, 1.0 = maximum kanji) into instructions
    if kanji_ratio <= 0.2:
        kanji_instruction = "Use Hiragana for almost everything. Only use Kanji for the explicit target vocabulary words."
    elif kanji_ratio <= 0.6:
        kanji_instruction = "Use Hiragana for common auxiliary words (e.g., あります, ない, です, ます, ひと, とき). Use standard Kanji moderately."
    else:
        kanji_instruction = "Use standard modern Japanese Kanji frequency for all nouns, verbs, and adjectives where natural."

    prompt = f"""
    You are an expert Japanese language pedagogue. Create EXACTLY ONE practice sentence for a language learner.

    TARGET VOCABULARY TO INCLUDE:
    {', '.join(vocab_list[:target_words_count])}

    STRICT CONSTRAINTS:
    1. GRAMMAR LEVEL:
    {selected_grammar}
    
    2. KANJI DENSITY RATIO ({kanji_ratio:.1f}):
    {kanji_instruction}

    3. LENGTH RULE:
    The Japanese sentence must be approximately {sentence_length_words} words long.

    4. FORMATTING RULES:
    - Absolutely NO spaces or ideographic spaces between words or particles (e.g., "私は行く" is correct, "私 は 行く" is forbidden).
    - Output MUST be valid, parseable JSON matching the exact schema below.

    REQUIRED JSON OUTPUT SCHEMA:
    {{
      "japanese_sentence": "...",
      "english_translation": "...",
      "target_vocabs": ["...", "..."]
    }}
    """

    response = client.chat.completions.create(
        model="qwen/qwen3.8-27b",
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"}
    )
    
    return response.choices[0].message.content

@retry(stop=stop_after_attempt(3), wait=wait_fixed(2))
def generate_grammar_question(topic: str = "particles", complexity: str = "absolute_beginner") -> str:
    """Generates a multiple-choice grammar question for Japanese practice."""
    client = OpenAI(
        base_url="https://api.groq.com/openai/v1",
        api_key=os.getenv("GROQ_API_KEY")
    )

    topic_descriptions = {
        "particles": "Japanese particles (は, が, を, に, で, へ, と, から, まで)",
        "politeness": "Polite form conjugations (~です, ~ます, ~でした, ~ませんでした)",
        "verb_conjugation": "Basic verb tense conjugations (Past, Negative, Te-form)",
        "beginner_combo": "A mix of basic Japanese sentence structure, particle selection, and vocabulary usage"
    }
    chosen_desc = topic_descriptions.get(topic, topic_descriptions["beginner_combo"])

    prompt = f"""
    You are a Japanese language proficiency exam author. Generate ONE multiple-choice grammar question for a {complexity.replace('_', ' ')} student.

    QUESTION TOPIC:
    {chosen_desc}

    RULES:
    1. Provide 4 option choices where exactly ONE option is correct.
    2. Provide a clear, educational explanation in English explaining why the correct choice works and why key distractors are incorrect.
    3. Output strictly valid JSON.

    REQUIRED JSON OUTPUT SCHEMA:
    {{
      "question": "Fill in the blank: わたし ___ たなかです。",
      "options": ["は", "が", "を", "に"],
      "correct_index": 0,
      "explanation": "'は' is the topic marker particle used after 'わたし' to indicate the sentence topic."
    }}
    """

    response = client.chat.completions.create(
        model="qwen/qwen3.8-27b",
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"}
    )
    
    return response.choices[0].message.content