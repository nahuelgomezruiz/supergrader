"""Anthropic LLM provider implementation."""

import anthropic
from typing import Dict, Optional
from .base_provider import BaseLLMProvider


class AnthropicProvider(BaseLLMProvider):
    """Anthropic LLM provider implementation."""
    
    def __init__(self, api_key: str, model: str = "claude-3-5-sonnet-20241022", **kwargs):
        """Initialize Anthropic provider."""
        super().__init__(api_key, model, **kwargs)
        if not api_key:
            raise ValueError("Anthropic API key not configured")
    
    async def initialize(self) -> None:
        """Initialize the Anthropic client."""
        self._client = anthropic.AsyncAnthropic(api_key=self.api_key)
    
    async def call_llm(self, prompt: str) -> str:
        """Make a call to Anthropic's API."""
        if not self._client:
            await self.initialize()
        
        try:
            response = await self._client.messages.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                system="You are an expert code grader.",
                temperature=self.temperature,
                max_tokens=self.max_tokens
            )
            
            # Anthropic returns content as a list of content blocks
            if not response.content or len(response.content) == 0:
                raise ValueError("Anthropic returned empty response")
            
            return response.content[0].text
            
        except Exception as e:
            print(f"🚨 Anthropic API call failed: {type(e).__name__}: {e}")
            if hasattr(e, 'status_code'):
                print(f"🔍 HTTP Status: {e.status_code}")
            if hasattr(e, 'response') and hasattr(e.response, 'text'):
                print(f"🔍 Response: {e.response.text[:200]}...")
            raise
    
    @property
    def provider_name(self) -> str:
        """Return the provider name."""
        return "anthropic" 