"""API endpoints for the grading service."""

import json
from typing import AsyncGenerator
from fastapi import APIRouter, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse
from sse_starlette.sse import EventSourceResponse

from app.models import SubmissionRequest, PartialResult, JobStatus
from app.services.grading import GradingService
from app.core.config import settings


router = APIRouter()
grading_service = GradingService()

# In-memory job tracking (in production, use Redis or a database)
jobs: dict[str, JobStatus] = {}


@router.post("/grade-submission")
async def grade_submission(
    request: SubmissionRequest,
    background_tasks: BackgroundTasks
) -> EventSourceResponse:
    """
    Grade a submission with streaming results.
    
    Returns a Server-Sent Events stream with partial results.
    """
    
    # Validate request
    if not request.rubric_items:
        raise HTTPException(status_code=400, detail="No rubric items provided")
    
    if not request.source_files:
        raise HTTPException(status_code=400, detail="No source files provided")
    
    # Create job ID
    job_id = f"{request.assignment_context.course_id}_{request.assignment_context.assignment_id}_{request.assignment_context.submission_id}"
    
    # Track job
    jobs[job_id] = JobStatus(
        job_id=job_id,
        status="processing",
        total_items=len(request.rubric_items)
    )
    
    async def event_generator() -> AsyncGenerator[str, None]:
        """Generate SSE events from grading results."""
        try:
            async for result in grading_service.grade_submission(
                course_id=request.assignment_context.course_id,
                assignment_id=request.assignment_context.assignment_id,
                submission_id=request.assignment_context.submission_id,
                source_files=request.source_files,
                rubric_items=request.rubric_items
            ):
                # Update job status
                if result.type == "partial_result":
                    jobs[job_id].completed_items += 1
                    jobs[job_id].progress = result.progress
                elif result.type == "job_complete":
                    jobs[job_id].status = "completed"
                    jobs[job_id].progress = 1.0
                
                # Yield SSE event
                yield {
                    "event": result.type,
                    "data": result.model_dump_json(exclude_none=True)
                }
        
        except Exception as e:
            # Update job status on error
            jobs[job_id].status = "failed"
            jobs[job_id].error = str(e)
            
            # Yield error event
            yield {
                "event": "error",
                "data": json.dumps({"error": str(e)})
            }
    
    return EventSourceResponse(event_generator())


@router.get("/job/{job_id}")
async def get_job_status(job_id: str) -> JobStatus:
    """Get the status of a grading job."""
    
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    
    return jobs[job_id]


@router.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "version": "1.0.0",
        "llm_provider": settings.llm_provider,
        "llm_model": settings.llm_model
    } 