import logging
from typing import Any, Dict, Optional

from core.config import settings
from core.llm.base import BaseLLMProvider
from core.llm.groq_adapter import GroqAdapter
from core.llm.gemini_adapter import GeminiAdapter

logger = logging.getLogger(__name__)


class FallbackLLMAdapter(BaseLLMProvider):
    """
    LLM Provider that tries the configured primary adapter first,
    and falls back to the secondary adapter on failure.
    """

    def __init__(self):
        self.primary: Optional[BaseLLMProvider] = None
        self.fallback: Optional[BaseLLMProvider] = None

        primary_name = (settings.DEFAULT_LLM_PROVIDER or "groq").lower()

        try:
            if primary_name == "gemini":
                self.primary = GeminiAdapter()
                if settings.GROQ_API_KEY:
                    self.fallback = GroqAdapter()
            else:
                self.primary = GroqAdapter()
                if settings.GEMINI_API_KEY:
                    self.fallback = GeminiAdapter()
        except Exception as e:
            logger.warning(f"Error initializing primary LLM adapter: {e}")
            if not self.primary and settings.GEMINI_API_KEY:
                try:
                    self.primary = GeminiAdapter()
                except Exception as inner_e:
                    logger.error(f"Error initializing fallback Gemini adapter: {inner_e}")

    async def generate_json(self, prompt: str, schema: Dict[str, Any]) -> Dict[str, Any]:
        if not self.primary:
            raise RuntimeError("No LLM adapter configured or initialized.")

        try:
            return await self.primary.generate_json(prompt, schema)
        except Exception as e:
            if self.fallback:
                logger.warning(f"Primary LLM adapter failed ({e}). Falling back to secondary adapter...")
                try:
                    return await self.fallback.generate_json(prompt, schema)
                except Exception as fb_err:
                    logger.error(f"Fallback LLM adapter also failed: {fb_err}")
                    raise fb_err
            raise e

    async def generate_text(self, prompt: str) -> str:
        if not self.primary:
            raise RuntimeError("No LLM adapter configured or initialized.")

        try:
            return await self.primary.generate_text(prompt)
        except Exception as e:
            if self.fallback:
                logger.warning(f"Primary LLM adapter failed ({e}). Falling back to secondary adapter...")
                try:
                    return await self.fallback.generate_text(prompt)
                except Exception as fb_err:
                    logger.error(f"Fallback LLM adapter also failed: {fb_err}")
                    raise fb_err
            raise e
