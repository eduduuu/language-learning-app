from typing import Dict
from .base_engine import BaseGrammarEngine
from .japanese_engine import JapaneseGrammarEngine

_ENGINES: Dict[str, BaseGrammarEngine] = {
    "japanese": JapaneseGrammarEngine(),
}

def get_grammar_engine(language: str = "japanese") -> BaseGrammarEngine:
    """
    Factory function returning the grammar engine for the specified language.
    Defaults to JapaneseGrammarEngine if language is unknown.
    """
    lang_key = language.lower() if language else "japanese"
    return _ENGINES.get(lang_key, _ENGINES["japanese"])
