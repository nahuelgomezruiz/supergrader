"""Grading API routes."""

import json
from typing import AsyncGenerator
from fastapi import APIRouter, HTTPException, BackgroundTasks
from sse_starlette.sse import EventSourceResponse

from app.models import SubmissionRequest, PartialResult, JobStatus
from app.services.grading import GradingService
from app.services.persistence.factory import JobRepositoryFactory
from app.api.validators.submission import validate_submission_request


router = APIRouter()
grading_service = GradingService()

# Create repository instance - will be initialized by main app lifecycle
job_repository = JobRepositoryFactory.create_repository()


@router.post("/grade-submission")
async def grade_submission(
    request: SubmissionRequest,
    background_tasks: BackgroundTasks
) -> EventSourceResponse:
    """
    Grade a submission with streaming results.
    
    Returns a Server-Sent Events stream with partial results.
    """
    
    # Validate request using centralized validator
    validate_submission_request(request)
    
    # Create job ID
    job_id = f"{request.assignment_context.course_id}_{request.assignment_context.assignment_id}_{request.assignment_context.submission_id}"
    
    # Track job using repository
    job_status = JobStatus(
        job_id=job_id,
        status="processing",
        total_items=len(request.rubric_items)
    )
    await job_repository.create_job(job_id, job_status)
    
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
                # Update job status using repository
                current_job = await job_repository.get_job(job_id)
                if current_job:
                    if result.type == "partial_result":
                        current_job.completed_items += 1
                        current_job.progress = result.progress
                        await job_repository.update_job(job_id, current_job)
                    elif result.type == "job_complete":
                        current_job.status = "completed"
                        current_job.progress = 1.0
                        await job_repository.update_job(job_id, current_job)
                
                # Yield SSE event
                yield {
                    "event": result.type,
                    "data": result.model_dump_json(exclude_none=True)
                }
        
        except Exception as e:
            # Update job status on error using repository
            current_job = await job_repository.get_job(job_id)
            if current_job:
                current_job.status = "failed"
                current_job.error = str(e)
                await job_repository.update_job(job_id, current_job)
            
            # Yield error event
            yield {
                "event": "error",
                "data": json.dumps({"error": str(e)})
            }
    
    return EventSourceResponse(event_generator()) 