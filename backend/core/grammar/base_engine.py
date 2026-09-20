from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional

class BaseGrammarEngine(ABC):
    """
    Abstract Base Class for modular, multi-language grammar rule engines.
    Subclasses implement language-specific conjugation, classification,
    and single-sentence cloze generation.
    """

    @property
    @abstractmethod
    def language(self) -> str:
        """Returns the language identifier (e.g., 'japanese', 'english')."""
        pass

    @abstractmethod
    def get_supported_categories(self) -> List[str]:
        """Returns list of grammar categories supported by this engine."""
        pass

    @abstractmethod
    def generate_rule_question(
        self,
        topic_key: str,
        complexity: int = 1
    ) -> Optional[Dict[str, Any]]:
        """
        Deterministically generates a rule-based question without calling an LLM.
        Returns dict with: question, options, correct_option_index, explanation.
        """
        pass

    @abstractmethod
    def generate_sentence_cloze(
        self,
        sentence: str
    ) -> Optional[Dict[str, Any]]:
        """
        Generates a 4-choice fill-in-the-blank question from a single sentence,
        masking a target particle, preposition, or conjugation marker.
        Returns dict with: question, options, correct_option_index, explanation, masked_target.
        """
        pass
