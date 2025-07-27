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
        language: str = "cpp",
        section_context: Optional[str] = None
    ) -> str:
        """Build prompt for checkbox rubric items."""
        
        # Format source files
        files_section = "\n\n".join([
            f"{filename}\n```{language}\n{content}\n```"
            for filename, content in source_files.items()
        ])
        
        # Build section context if provided
        context_section = ""
        if section_context:
            context_section = f"""
Entire rubric for this section (for context only):
{section_context}

"""

        return f"""You are an expert code grader. Think step‑by‑step **silently**; show only the final JSON.

{context_section}YOUR SPECIFIC TASK - Evaluate this single checkbox:
Rubric item (CHECKBOX, {points} pts):
«{description}»

Student submission:
{files_section}

INSTRUCTIONS:
The above rubric section is provided for context only. Your task is to evaluate ONLY the specific checkbox item shown above.

TASKS – for this single checkbox only:
1. Decide **check** or **uncheck**.
2. Gather the most relevant evidence lines for your decision (file + line range).
3. Draft a short feedback comment explaining your decision (for both check and uncheck).
4. Estimate a confidence percentage (0‑100).

GENERAL CONSIDERATIONS:
- When judging the efficacy of the testing description on the README, it is ok if the student is not specific or cronological. Consider the good effort of the student description of the testing process. Be lenient on this type of question.
- To decide if the testing is adequately documented, look if either most unit tests have a comment explaining what they are testing or if the README has a very detailed description of the testing process.
- When evaluating the testing of specific components, such as functions or classes, look if the SPECIFIC tests described on the rubric are present.
- When judging whether file headers were correct, remember that: 
--> The driver (main.cpp) file header should describe the program at a high level, leaving out implementation details
--> All header (.h files apart from unit tests) file headers should explain at a high level what the class represents and leave implementation details only if they are relevant to a client
--> All driver (most .cpp) file headers should just state that they implement the underlying class
- Students not required to implement JFFE functions
- When evaluating the design and implementation of functions and classes, adhere strictly to what the rubric is asking for. Think step-by-step to figure out which of the points in the rubric are accomplished by the code of the student, and give an answer only when you're certain about which of the bullet points were addressed by the student.

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
        language: str = "cpp",
        section_context: Optional[str] = None
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
        
        # Build section context if provided
        context_section = ""
        if section_context:
            context_section = f"""
Entire rubric for this section (for context only):
{section_context}

"""

        return f"""You are an expert code grader. Think step‑by‑step **silently**; show only the final JSON.

{context_section}YOUR SPECIFIC TASK - Evaluate this single radio button:
Rubric item (RADIO):
«{description}»

Options (pick exactly one letter):
{options_section}

Student submission:
{files_section}

INSTRUCTIONS:
The above rubric section is provided for context only. Your task is to evaluate ONLY the specific radio button item shown above.

TASKS – for this radio item only:
1. Select the **letter** (Q, W, E, R, etc.) of the option that best fits the student code.
2. Gather the most relevant evidence lines for your choice (file + line range).
3. Draft a short feedback comment explaining your choice (for all options,
regardless of points).
4. Estimate a confidence percentage (0‑100).

GENERAL CONSIDERATIONS:
- When judging the efficacy of the testing description on the README, it is ok if the student is not specific or cronological. Consider the good effort of the student description of the testing process. Be lenient on this type of question.
- To decide if the testing is adequately documented, look if either most unit tests have a comment explaining what they are testing or if the README has a very detailed description of the testing process.
- When evaluating the testing of specific components, such as functions or classes, look if the SPECIFIC tests described on the rubric are present.
- When judging whether file headers were correct, remember that: 
--> The driver (main.cpp) file header should describe the program at a high level, leaving out implementation details
--> All header (.h files apart from unit tests) file headers should explain at a high level what the class represents and leave implementation details only if they are relevant to a client
--> All driver (most .cpp) file headers should just state that they implement the underlying class
- Students not required to implement JFFE functions
- When evaluating the design and implementation of functions and classes, adhere strictly to what the rubric is asking for. Think step-by-step to figure out which of the points in the rubric are accomplished by the code of the student, and give an answer only when you're certain about which of the bullet points were addressed by the student.

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