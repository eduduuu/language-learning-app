import json
from typing import Any, Dict
from google import genai
from google.genai import types
from core.config import settings
from core.llm.base import BaseLLMProvider


class GeminiAdapter(BaseLLMProvider):
    def __init__(self, model_name: str = "gemini-3.5-flash-lite"):
        self.client = genai.Client(api_key=settings.GEMINI_API_KEY)
        self.model_name = model_name


    async def generate_json(self, prompt: str, schema: Dict[str, Any]) -> Dict[str, Any]:
        system_instruction = (
            f"You are a helpful language assistant. "
            f"You must output STRICT valid JSON adhering to this schema: {json.dumps(schema)}"
        )
        full_prompt = f"{system_instruction}\n\nUser Request:\n{prompt}"

        response = await self.client.aio.models.generate_content(
            model=self.model_name,
            contents=full_prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json"
            )
        )

        raw_text = response.text.strip()
        if raw_text.startswith("```json"):
            raw_text = raw_text[7:]
        if raw_text.startswith("```"):
            raw_text = raw_text[3:]
        if raw_text.endswith("```"):
            raw_text = raw_text[:-3]

        return json.loads(raw_text.strip())

    async def generate_text(self, prompt: str) -> str:
        response = await self.client.aio.models.generate_content(
            model=self.model_name,
            contents=prompt
        )
        return response.text