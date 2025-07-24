"""OpenAI LLM provider implementation."""

import openai
from typing import Dict, Optional
from .base_provider import BaseLLMProvider


class OpenAIProvider(BaseLLMProvider):
    """OpenAI LLM provider implementation."""
    
    def __init__(self, api_key: str, model: str = "gpt-4o", **kwargs):
        """Initialize OpenAI provider."""
        super().__init__(api_key, model, **kwargs)
        if not api_key:
            raise ValueError("OpenAI API key not configured")
    
    async def initialize(self) -> None:
        """Initialize the OpenAI client."""
        self._client = openai.AsyncOpenAI(api_key=self.api_key)
    
    async def call_llm(self, prompt: str) -> str:
        """Make a call to OpenAI's API."""
        if not self._client:
            await self.initialize()
        
        try:
            response = await self._client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are an expert code grader."},
                    {"role": "user", "content": prompt}
                ],
                temperature=self.temperature,
                max_tokens=self.max_tokens,
                timeout=self.timeout
            )
            
            content = response.choices[0].message.content
            if not content:
                raise ValueError("OpenAI returned empty response")
            
            return content
            
        except Exception as e:
            print(f"🚨 OpenAI API call failed: {type(e).__name__}: {e}")
            if hasattr(e, 'status_code'):
                print(f"🔍 HTTP Status: {e.status_code}")
            if hasattr(e, 'response') and hasattr(e.response, 'text'):
                print(f"🔍 Response: {e.response.text[:200]}...")
            raise
    
    @property
    def provider_name(self) -> str:
        """Return the provider name."""
        return "openai" 