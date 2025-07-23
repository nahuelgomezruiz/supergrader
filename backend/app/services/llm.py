"""LLM service wrapper with retries and timeout."""

import json
from typing import Dict, Any, Optional, Union
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type
)
import httpx
import openai
import anthropic

from app.core.config import settings
from app.models import RubricType, CheckboxVerdict, RadioVerdict


class LLMService:
    """Unified LLM service supporting OpenAI and Anthropic."""
    
    def __init__(self):
        self.provider = settings.llm_provider
        
        if self.provider == "openai":
            if not settings.openai_api_key:
                raise ValueError("OpenAI API key not configured")
            self.client = openai.AsyncOpenAI(api_key=settings.openai_api_key)
        elif self.provider == "anthropic":
            if not settings.anthropic_api_key:
                raise ValueError("Anthropic API key not configured")
            self.client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
        else:
            raise ValueError(f"Unknown LLM provider: {self.provider}")
    
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
        
        # Prepare the prompt based on rubric type
        if rubric_type == RubricType.CHECKBOX:
            prompt = self._build_checkbox_prompt(
                rubric_description, rubric_points, source_files, language
            )
        else:
            prompt = self._build_radio_prompt(
                rubric_description, rubric_options, source_files, language
            )
        
        # Call the LLM
        response = await self._call_llm(prompt)
        
        # Parse the response
        return self._parse_response(response, rubric_type)
    
    def _build_checkbox_prompt(
        self,
        description: str,
        points: float,
        source_files: Dict[str, str],
        language: str
    ) -> str:
        """Build prompt for checkbox rubric items."""
        
        # Format source files
        files_section = "\n\n".join([
            f"{filename}\n```{language}\n{content}\n```"
            for filename, content in source_files.items()
        ])
        
        return f"""You are an expert code grader. Think step‑by‑step **silently**; show only the final JSON.

Rubric item (CHECKBOX, {points} pts):
«{description}»

Student submission (trimmed):
{files_section}

TASKS – for this single checkbox only:
1. Decide **check** or **uncheck**.
2. Gather the most relevant evidence lines for your decision (file + line range).
3. If unchecked, draft a short feedback comment for the student at the evidence location.
4. Estimate a confidence percentage (0‑100).

OUTPUT FORMAT (JSON only, no extra text):
```json
{{
  "decision": "check" | "uncheck",
  "evidence": {{ "file": "…", "lines": "start‑end" }},
  "comment": "…",
  "confidence": 0‑100
}}
```

Remember: think internally first, then output **only** the JSON block."""
    
    def _build_radio_prompt(
        self,
        description: str,
        options: Dict[str, str],
        source_files: Dict[str, str],
        language: str
    ) -> str:
        """Build prompt for radio rubric items."""
        
        # Format source files
        files_section = "\n\n".join([
            f"{filename}\n```{language}\n{content}\n```"
            for filename, content in source_files.items()
        ])
        
        # Format options
        options_section = "\n".join([
            f"{key} – {text}"
            for key, text in options.items()
        ])
        
        return f"""You are an expert code grader. Think step‑by‑step **silently**; show only the final JSON.

Rubric item (RADIO):
«{description}»

Options (pick exactly one):
{options_section}

Student submission (trimmed):
{files_section}

TASKS – for this radio item only:
1. Select the **option_key** that best fits the student code.
2. Gather the most relevant evidence lines for your choice (file + line range).
3. If the chosen option awards less than full points, draft a short feedback comment at the evidence location.
4. Estimate a confidence percentage (0‑100).

OUTPUT FORMAT (JSON only, no extra text):
```json
{{
  "selected_option": "{{option_key}}",
  "evidence": {{ "file": "…", "lines": "start‑end" }},
  "comment": "…",
  "confidence": 0‑100
}}
```

Remember: think internally first, then output **only** the JSON block."""
    
    async def _call_llm(self, prompt: str) -> str:
        """Call the LLM with the prompt."""
        
        if self.provider == "openai":
            response = await self.client.chat.completions.create(
                model=settings.llm_model,
                messages=[
                    {"role": "system", "content": "You are an expert code grader."},
                    {"role": "user", "content": prompt}
                ],
                temperature=settings.llm_temperature,
                max_tokens=settings.llm_max_tokens,
                timeout=settings.llm_timeout
            )
            return response.choices[0].message.content
        
        elif self.provider == "anthropic":
            response = await self.client.messages.create(
                model=settings.llm_model,
                messages=[{"role": "user", "content": prompt}],
                system="You are an expert code grader.",
                temperature=settings.llm_temperature,
                max_tokens=settings.llm_max_tokens
            )
            return response.content[0].text
    
    def _parse_response(
        self,
        response: str,
        rubric_type: RubricType
    ) -> Union[CheckboxVerdict, RadioVerdict]:
        """Parse LLM response into appropriate verdict model."""
        
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
        
        # Create appropriate verdict model
        if rubric_type == RubricType.CHECKBOX:
            return CheckboxVerdict(**data)
        else:
            return RadioVerdict(**data) 