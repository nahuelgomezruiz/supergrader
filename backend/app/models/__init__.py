"""Pydantic models for the grading system."""

from enum import Enum
from typing import Dict, List, Optional, Literal, Any
from pydantic import BaseModel, Field, ConfigDict


class RubricType(str, Enum):
    """Rubric question types."""
    CHECKBOX = "CHECKBOX"
    RADIO = "RADIO"


class RubricDecision(str, Enum):
    """Checkbox rubric decisions."""
    CHECK = "check"
    UNCHECK = "uncheck"


class Evidence(BaseModel):
    """Evidence location in code."""
    file: str = Field(..., description="File name containing the evidence")
    lines: str = Field(..., description="Line range in format 'start-end'")


class RubricItem(BaseModel):
    """Individual rubric item to evaluate."""
    id: str = Field(..., description="Unique identifier for the rubric item")
    description: str = Field(..., description="Description of what to evaluate")
    points: float = Field(..., description="Points value (can be negative)")
    type: RubricType = Field(..., description="Type of rubric item")
    options: Optional[Dict[str, str]] = Field(None, description="Options for RADIO type items")


class AssignmentContext(BaseModel):
    """Context about the assignment."""
    course_id: str
    assignment_id: str
    submission_id: str
    assignment_name: Optional[str] = None
    instructions: Optional[str] = None


class SubmissionRequest(BaseModel):
    """Request to grade a submission."""
    assignment_context: AssignmentContext
    source_files: Dict[str, str] = Field(..., description="Map of filename to content")
    rubric_items: List[RubricItem]
    
    model_config = ConfigDict(json_schema_extra={
        "example": {
            "assignment_context": {
                "course_id": "12345",
                "assignment_id": "67890",
                "submission_id": "424242",
                "assignment_name": "Binary Search Tree Implementation"
            },
            "source_files": {
                "main.cpp": "// C++ code here",
                "tree.h": "// Header file",
                "tree.cpp": "// Implementation"
            },
            "rubric_items": [{
                "id": "RbA3C2",
                "description": "Proper error handling for edge cases",
                "points": -2,
                "type": "CHECKBOX"
            }]
        }
    })


class CheckboxVerdict(BaseModel):
    """LLM verdict for a checkbox rubric item."""
    decision: RubricDecision
    evidence: Evidence
    comment: str = Field(..., description="Feedback comment for the student")
    confidence: int = Field(..., ge=0, le=100, description="Confidence percentage")


class RadioVerdict(BaseModel):
    """LLM verdict for a radio rubric item."""
    selected_option: str = Field(..., description="The selected option key")
    evidence: Evidence
    comment: str = Field(..., description="Feedback comment for the student")
    confidence: int = Field(..., ge=0, le=100, description="Confidence percentage")


class GradingDecision(BaseModel):
    """Final grading decision for a rubric item."""
    rubric_item_id: str
    type: RubricType
    verdict: Any = Field(..., description="CheckboxVerdict or RadioVerdict based on type")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Normalized confidence score")
    reasoning: Optional[str] = Field(None, description="Internal reasoning (not shown to students)")


class PartialResult(BaseModel):
    """Partial result emitted during streaming."""
    type: Literal["partial_result", "job_complete"] = "partial_result"
    rubric_item_id: Optional[str] = None
    decision: Optional[GradingDecision] = None
    progress: Optional[float] = Field(None, ge=0.0, le=1.0, description="Overall progress")
    message: Optional[str] = None


class JobStatus(BaseModel):
    """Overall job status."""
    job_id: str
    status: Literal["pending", "processing", "completed", "failed"]
    progress: float = Field(0.0, ge=0.0, le=1.0)
    completed_items: int = 0
    total_items: int = 0
    error: Optional[str] = None 