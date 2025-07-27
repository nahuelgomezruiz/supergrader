"""Feedback and caveat management API routes."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import logging

from app.services.llm.service import LLMService
from app.services.caveat_service import CaveatService


logger = logging.getLogger(__name__)
router = APIRouter()

# Initialize services
llm_service = LLMService()
caveat_service = CaveatService()


class FeedbackRequest(BaseModel):
    """Request model for user feedback."""
    rubricItemId: str
    rubricQuestion: str
    studentAssignment: str
    originalDecision: str
    userFeedback: str


class FeedbackResponse(BaseModel):
    """Response model for feedback submission."""
    success: bool
    caveat_id: Optional[str] = None
    message: str


@router.post("/feedback", response_model=FeedbackResponse)
async def submit_feedback(request: FeedbackRequest) -> FeedbackResponse:
    """
    Process user feedback and generate a caveat for future grading.
    
    This endpoint:
    1. Receives feedback about incorrect grading decisions
    2. Uses an LLM to extract insights from the feedback
    3. Stores the caveat for future similar questions
    """
    try:
        logger.info(f"Received feedback for rubric item: {request.rubricItemId}")
        
        # Generate caveat using LLM
        caveat_prompt = f"""
You are analyzing feedback from a human grader who disagreed with an AI grading decision.
Your task is to extract a general insight or caveat that will help avoid similar mistakes in the future.

RUBRIC QUESTION:
{request.rubricQuestion}

STUDENT'S ANSWER:
{request.studentAssignment}

AI'S DECISION:
{request.originalDecision}

HUMAN GRADER'S FEEDBACK:
{request.userFeedback}

Based on this feedback, generate a concise caveat (1-3 sentences) that captures the key insight.
The caveat should:
1. Be general enough to apply to similar situations
2. Focus on what to watch out for or consider differently
3. Not mention specific student names or assignment details
4. Be actionable for future grading decisions

Return ONLY the caveat text, nothing else.
"""
        
        # Get caveat from LLM
        caveat_text = await llm_service.generate_caveat(caveat_prompt)
        
        if not caveat_text:
            raise ValueError("Failed to generate caveat from feedback")
        
        # Store the caveat with semantic embedding
        caveat_id = await caveat_service.store_caveat(
            rubric_question=request.rubricQuestion,
            caveat_text=caveat_text,
            original_feedback=request.userFeedback,
            metadata={
                "rubric_item_id": request.rubricItemId,
                "original_decision": request.originalDecision
            }
        )
        
        logger.info(f"Successfully stored caveat {caveat_id}: {caveat_text}")
        
        return FeedbackResponse(
            success=True,
            caveat_id=caveat_id,
            message="Feedback processed successfully"
        )
        
    except Exception as e:
        logger.error(f"Error processing feedback: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to process feedback: {str(e)}"
        ) 