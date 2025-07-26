"""Modular LLM service with provider support."""

import json
from typing import Dict, Optional, Union
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
    retry_if_exception,
    wait_combine,
    wait_fixed
)
import httpx
import anthropic
import openai

from app.core.config import settings
from app.models import RubricType, CheckboxVerdict, RadioVerdict
from .factory import LLMProviderFactory
from .base_provider import BaseLLMProvider


def is_retryable_error(exception: Exception) -> bool:
    """Determine if an exception should be retried."""
    
    # Network-level retryable errors
    if isinstance(exception, (httpx.TimeoutException, httpx.ConnectError, httpx.ReadError)):
        return True
    
    # HTTP status code errors
    if isinstance(exception, httpx.HTTPStatusError):
        status_code = exception.response.status_code
        # Retry on rate limiting and server errors
        if status_code in (429, 500, 502, 503, 504):
            print(f"🔄 Retryable HTTP {status_code} error: {exception}")
            return True
    
    # Anthropic-specific retryable errors
    if isinstance(exception, anthropic.RateLimitError):
        print(f"🔄 Anthropic rate limit error: {exception}")
        return True
    
    if isinstance(exception, (anthropic.InternalServerError, anthropic.APITimeoutError)):
        print(f"🔄 Anthropic server/timeout error: {exception}")
        return True
    
    # OpenAI-specific retryable errors  
    if isinstance(exception, openai.RateLimitError):
        print(f"🔄 OpenAI rate limit error: {exception}")
        return True
        
    if isinstance(exception, (openai.InternalServerError, openai.APITimeoutError)):
        print(f"🔄 OpenAI server/timeout error: {exception}")
        return True
    
    # Generic API connection errors
    if isinstance(exception, (openai.APIConnectionError, anthropic.APIConnectionError)):
        print(f"🔄 API connection error: {exception}")
        return True
    
    print(f"❌ Non-retryable error: {type(exception).__name__}: {exception}")
    return False


class LLMService:
    """Modular LLM service using pluggable providers."""
    
    def __init__(self, provider: Optional[BaseLLMProvider] = None):
        """
        Initialize LLM service.
        
        Args:
            provider: Optional provider instance. If None, uses factory to create default.
        """
        self._provider = provider
        self._initialized = False
    
    async def _ensure_provider(self) -> BaseLLMProvider:
        """Ensure provider is initialized."""
        if not self._provider:
            self._provider = LLMProviderFactory.create_provider()
        
        if not self._initialized:
            await self._provider.initialize()
            self._initialized = True
            print(f"✓ Initialized {self._provider.provider_name} provider with model {self._provider.model}")
        
        return self._provider
    
    @retry(
        stop=stop_after_attempt(settings.llm_max_retries),
        wait=wait_combine(
            wait_exponential(multiplier=1, min=4, max=30),  # Exponential backoff up to 30s
            wait_fixed(2)  # Minimum 2s wait between retries
        ),
        retry=retry_if_exception(is_retryable_error),
        reraise=True
    )
    async def evaluate_rubric_item(
        self,
        rubric_type: RubricType,
        rubric_description: str,
        rubric_points: float,
        rubric_options: Optional[Dict[str, str]],
        source_files: Dict[str, str],
        language: str = "cpp",
        section_context: Optional[str] = None
    ) -> Union[CheckboxVerdict, RadioVerdict]:
        """Evaluate a single rubric item using the LLM."""
        
        provider = await self._ensure_provider()
        
        try:
            # Prepare the prompt based on rubric type
            if rubric_type == RubricType.CHECKBOX:
                prompt = provider.build_checkbox_prompt(
                    rubric_description, rubric_points, source_files, language, section_context
                )
            else:
                prompt = provider.build_radio_prompt(
                    rubric_description, rubric_options, source_files, language, section_context
                )
            
            # Call the LLM
            response = await provider.call_llm(prompt)
            
            # Parse the response
            result = self._parse_response(response, rubric_type)
            print(f"✅ LLM call succeeded: {rubric_description[:30]}...")
            return result
            
        except Exception as e:
            print(f"❌ LLM call failed: {rubric_description[:30]}... - {type(e).__name__}: {e}")
            raise
    
    def _parse_response(
        self,
        response: str,
        rubric_type: RubricType
    ) -> Union[CheckboxVerdict, RadioVerdict]:
        """Parse LLM response into appropriate verdict model."""
        
        try:
            # Extract JSON from response
            json_start = response.find("```json")
            json_end = response.rfind("```")
            
            if json_start != -1 and json_end != -1:
                json_str = response[json_start + 7:json_end].strip()
            else:
                # Try to parse the entire response as JSON
                json_str = response.strip()
            
            try:
                data = json.loads(json_str)
            except json.JSONDecodeError as e:
                raise ValueError(f"Failed to parse LLM response as JSON: {e}")
            
            # Handle null comment values (convert to empty string)
            if data.get('comment') is None:
                data['comment'] = ""
            
            # Create appropriate verdict model
            if rubric_type == RubricType.CHECKBOX:
                return CheckboxVerdict(**data)
            else:
                return RadioVerdict(**data)
                
        except Exception as e:
            print(f"❌ Response parsing failed: {type(e).__name__}: {e}")
            raise
    
    @property
    def provider_name(self) -> str:
        """Get the current provider name."""
        if self._provider:
            return self._provider.provider_name
        return settings.llm_provider
    
    @property
    def model_name(self) -> str:
        """Get the current model name."""
        if self._provider:
            return self._provider.model
        return settings.llm_model 