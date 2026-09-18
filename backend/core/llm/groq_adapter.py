import json
from typing import Any, Dict
from groq import AsyncGroq
from core.config import settings
from core.llm.base import BaseLLMProvider

class GroqAdapter(BaseLLMProvider):
    def __init__(self, model_name: str = "qwen/qwen3.8-27b"):
        self.client = AsyncGroq(api_key=settings.GROQ_API_KEY)
        self.model_name = model_name

    async def generate_json(self, prompt: str, schema: Dict[str, Any]) -> Dict[str, Any]:
        system_instruction = (
            f"You are a helpful language assistant. "
            f"You must output STRICT valid JSON adhering to this schema: {json.dumps(schema)}"
        )
        
        response = await self.client.chat.completions.create(
            model=self.model_name,
            messages=[
                {"role": "system", "content": system_instruction},
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"}
        )
        
        raw_content = response.choices[0].message.content
        return json.loads(raw_content)

    async def generate_text(self, prompt: str) -> str:
        response = await self.client.chat.completions.create(
            model=self.model_name,
            messages=[{"role": "user", "content": prompt}]
        )
        return response.choices[0].message.content