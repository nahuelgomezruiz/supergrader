"""Modular LLM service with provider support."""

import json
from typing import Dict, Optional, Union
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type
)
import httpx

from app.core.config import settings
from app.models import RubricType, CheckboxVerdict, RadioVerdict
from .factory import LLMProviderFactory
from .base_provider import BaseLLMProvider


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
        wait=wait_exponential(multiplier=1, min=4, max=10),
        retry=retry_if_exception_type((httpx.TimeoutException, httpx.ConnectError))
    )
    async def evaluate_rubric_item(
        self,
        rubric_type: RubricType,
        rubric_description: str,
        rubric_points: float,
        rubric_options: Optional[Dict[str, str]],
        source_files: Dict[str, str],
        language: str = "cpp"
    ) -> Union[CheckboxVerdict, RadioVerdict]:
        """Evaluate a single rubric item using the LLM."""
        
        provider = await self._ensure_provider()
        
        try:
            # Prepare the prompt based on rubric type
            if rubric_type == RubricType.CHECKBOX:
                prompt = provider.build_checkbox_prompt(
                    rubric_description, rubric_points, source_files, language
                )
            else:
                prompt = provider.build_radio_prompt(
                    rubric_description, rubric_options, source_files, language
                )
            
            # Call the LLM
            response = await provider.call_llm(prompt)
            
            # Parse the response
            return self._parse_response(response, rubric_type)
            
        except Exception as e:
            print(f"🚨 LLM evaluation failed: {type(e).__name__}: {e}")
            print(f"🔍 Context: rubric_type={rubric_type}, description='{rubric_description[:50]}...'")
            print(f"🔍 Provider: {provider.provider_name}")
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
                print(f"🚨 JSON parsing failed: {e}")
                print(f"🔍 Attempted to parse: {json_str[:200]}...")
                print(f"🔍 Full response: {response[:500]}...")
                raise ValueError(f"Failed to parse LLM response as JSON: {e}")
            
            # Log the parsed data for debugging validation errors
            print(f"🔍 Parsed JSON data: {data}")
            
            # Handle null comment values (convert to empty string)
            if data.get('comment') is None:
                data['comment'] = ""
                print(f"🔧 Converted null comment to empty string")
            
            # Create appropriate verdict model
            if rubric_type == RubricType.CHECKBOX:
                return CheckboxVerdict(**data)
            else:
                return RadioVerdict(**data)
                
        except Exception as e:
            print(f"🚨 Response parsing failed: {type(e).__name__}: {e}")
            print(f"🔍 Rubric type: {rubric_type}")
            print(f"🔍 Response length: {len(response)} chars")
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