"""
Prompts Configuration Engine for Japanese Context Reader.
Supports Japanese and English multi-language flashcards and deep-dive breakdowns.
"""

PROMPTS = {
    "japanese": {
        "flashcard_base": """
You are an expert Japanese language teacher. Generate EXACTLY ONE practice sentence for a language learner.

TARGET VOCABULARY TO INCLUDE:
{vocab_list}

GRAMMAR LEVEL CONSTRAINTS:
{selected_grammar}

KANJI DENSITY RATIO ({kanji_ratio:.1f}):
{kanji_instruction}

SENTENCE LENGTH:
Target roughly {sentence_length_words} words.

FORMATTING RULES:
- Absolutely NO spaces between words or particles in the Japanese sentence.
- Identify if target words require first-time breakdowns (kanji radicals, visual mnemonics, and meanings).
- Output strictly valid JSON.

JSON OUTPUT SCHEMA:
{{
  "japanese_sentence": "...",
  "english_translation": "...",
  "target_vocabs": ["...", "..."],
  "first_time_breakdowns": [
    {{
      "word": "...",
      "kanji": "...",
      "radicals": "...",
      "visual_mnemonic": "...",
      "meaning": "..."
    }}
  ]
}}
""",
        "grammar_question": """
You are a Japanese language proficiency exam author. Generate ONE multiple-choice grammar question for a {complexity} student.

TOPIC: {topic}

RULES:
1. Provide 4 option choices where exactly ONE option is correct.
2. Provide a clear, educational explanation in English explaining why the correct choice works.
3. Output strictly valid JSON.

JSON OUTPUT SCHEMA:
{{
  "question": "...",
  "options": ["...", "...", "...", "..."],
  "correct_index": 0,
  "explanation": "..."
}}
"""
    },
    
    "english": {
        "flashcard_base": """
You are an expert English language coach. Generate EXACTLY ONE natural practice sentence for an ESL student.

TARGET VOCABULARY TO INCLUDE:
{vocab_list}

COMPLEXITY LEVEL:
{selected_grammar}

SENTENCE LENGTH:
Target roughly {sentence_length_words} words.

JSON OUTPUT SCHEMA:
{{
  "sentence": "...",
  "translation": "...",
  "target_vocabs": ["..."],
  "first_time_breakdowns": [
    {{
      "word": "...",
      "etymology_or_root": "...",
      "visual_mnemonic": "...",
      "meaning": "..."
    }}
  ]
}}
""",
        "grammar_question": """
Generate ONE English grammar multiple-choice question for level {complexity} on topic: {topic}.

JSON OUTPUT SCHEMA:
{{
  "question": "...",
  "options": ["...", "...", "...", "..."],
  "correct_index": 0,
  "explanation": "..."
}}
"""
    }
}

GRAMMAR_RULES = {
    "japanese": {
        "absolute_beginner": """
- End every sentence consistently in polite form (~です or ~ます).
- Use basic particles only: は, が, を, に, で, と, の.
- Avoid complex structures (no passive, causative, or nested clause conditionals).
""",
        "elementary": """
- End sentences in polite form (~です or ~ます), but te-form (~て) may be used to connect two simple clauses.
- Basic time markers and basic compound verbs are permitted.
"""
    },
    "english": {
        "absolute_beginner": "Use simple present and present continuous tenses with basic subject-verb-object structures.",
        "elementary": "Permit past tense, compound sentences joined by 'and/but/so', and common phrasal verbs."
    }
}