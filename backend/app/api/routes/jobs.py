"""Job management API routes."""

from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query

from app.models import JobStatus
from app.services.persistence.factory import JobRepositoryFactory
from app.api.validators.submission import validate_job_id_format


router = APIRouter()

# Create repository instance - will be initialized by main app lifecycle  
job_repository = JobRepositoryFactory.create_repository()


@router.get("/job/{job_id}")
async def get_job_status(job_id: str) -> JobStatus:
    """Get the status of a grading job."""
    
    if not validate_job_id_format(job_id):
        raise HTTPException(status_code=400, detail="Invalid job ID format")
    
    job_status = await job_repository.get_job(job_id)
    if not job_status:
        raise HTTPException(status_code=404, detail="Job not found")
    
    return job_status


@router.get("/jobs")
async def list_jobs(limit: Optional[int] = Query(None, ge=1, le=100)) -> List[JobStatus]:
    """List all jobs, optionally limited."""
    
    jobs = await job_repository.list_jobs(limit=limit)
    return jobs


@router.delete("/job/{job_id}")
async def delete_job(job_id: str) -> dict:
    """Delete a job."""
    
    if not validate_job_id_format(job_id):
        raise HTTPException(status_code=400, detail="Invalid job ID format")
    
    deleted = await job_repository.delete_job(job_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Job not found")
    
    return {"message": f"Job {job_id} deleted successfully"}


@router.post("/jobs/cleanup")
async def cleanup_old_jobs(max_age_hours: int = Query(24, ge=1, le=168)) -> dict:
    """Clean up jobs older than specified hours."""
    
    max_age_seconds = max_age_hours * 3600
    deleted_count = await job_repository.cleanup_old_jobs(max_age_seconds)
    
    return {
        "message": f"Cleanup completed",
        "deleted_count": deleted_count,
        "max_age_hours": max_age_hours
    }


@router.get("/jobs/stats")
async def get_job_stats() -> dict:
    """Get job statistics."""
    
    total_jobs = await job_repository.get_job_count()
    
    return {
        "total_jobs": total_jobs
    } 