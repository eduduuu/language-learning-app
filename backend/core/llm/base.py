from abc import ABC, abstractmethod
from typing import Any, Dict, List

class BaseLLMProvider(ABC):
    """
    Abstract Base Class for LLM Providers (Strategy Pattern).
    Swapping to OpenAI or Anthropic requires only implementing this interface.
    """
    
    @abstractmethod
    async def generate_json(self, prompt: str, schema: Dict[str, Any]) -> Dict[str, Any]:
        """Generates structured JSON output adhering to a given schema."""
        pass

    @abstractmethod
    async def generate_text(self, prompt: str) -> str:
        """Generates plain text response."""
        pass