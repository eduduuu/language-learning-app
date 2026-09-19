import json
from typing import Any, Dict
import google.generativeai as genai
from google.generativeai.types import GenerationConfig
from core.config import settings
from core.llm.base import BaseLLMProvider

class GeminiAdapter(BaseLLMProvider):
    def __init__(self, model_name: str = "gemini-3.6-flash"):
        genai.configure(api_key=settings.GEMINI_API_KEY)
        self.model = genai.GenerativeModel(model_name)

    async def generate_json(self, prompt: str, schema: Dict[str, Any]) -> Dict[str, Any]:
        # Gemini 1.5 Flash natively supports forced JSON output
        config = GenerationConfig(response_mime_type="application/json")
        
        system_instruction = (
            f"You are a helpful language assistant. "
            f"You must output STRICT valid JSON adhering to this schema: {json.dumps(schema)}"
        )
        
        full_prompt = f"{system_instruction}\n\nUser Request:\n{prompt}"
        
        response = await self.model.generate_content_async(
            full_prompt,
            generation_config=config
        )
        
        return json.loads(response.text)

    async def generate_text(self, prompt: str) -> str:
        response = await self.model.generate_content_async(prompt)
        return response.text