"""Base LLM provider interface."""

from abc import ABC, abstractmethod
from typing import Dict, Optional, Union
from app.models import RubricType, CheckboxVerdict, RadioVerdict


class BaseLLMProvider(ABC):
    """Abstract base class for LLM providers."""
    
    def __init__(self, api_key: str, model: str, temperature: float = 0.1, 
                 max_tokens: int = 4096, timeout: int = 30):
        """Initialize the provider with common parameters."""
        self.api_key = api_key
        self.model = model
        self.temperature = temperature
        self.max_tokens = max_tokens
        self.timeout = timeout
        self._client = None
    
    @abstractmethod
    async def initialize(self) -> None:
        """Initialize the provider's client."""
        pass
    
    @abstractmethod
    async def call_llm(self, prompt: str) -> str:
        """Make a call to the LLM with the given prompt."""
        pass
    
    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Return the name of this provider."""
        pass
    
    def build_checkbox_prompt(
        self,
        description: str,
        points: float,
        source_files: Dict[str, str],
        language: str = "cpp"
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
3. Draft a short feedback comment explaining your decision (for both check and uncheck).
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
    
    def build_radio_prompt(
        self,
        description: str,
        options: Dict[str, str],
        source_files: Dict[str, str],
        language: str = "cpp"
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

Options (pick exactly one letter):
{options_section}

Student submission (trimmed):
{files_section}

TASKS – for this radio item only:
1. Select the **letter** (Q, W, E, R, etc.) of the option that best fits the student code.
2. Gather the most relevant evidence lines for your choice (file + line range).
3. Draft a short feedback comment explaining your choice (for all options, regardless of points).
4. Estimate a confidence percentage (0‑100).

OUTPUT FORMAT (JSON only, no extra text):
```json
{{
  "selected_option": "Q",
  "evidence": {{ "file": "…", "lines": "start‑end" }},
  "comment": "…",
  "confidence": 0‑100
}}
```

Remember: think internally first, then output **only** the JSON block with the letter of your chosen option.""" 