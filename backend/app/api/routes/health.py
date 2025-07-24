"""Health check API routes."""

from fastapi import APIRouter

from app.core.config import settings
from app.services.persistence.factory import JobRepositoryFactory


router = APIRouter()


@router.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "version": "1.0.0",
        "llm_provider": settings.llm_provider,
        "llm_model": settings.llm_model
    }


@router.get("/health/detailed")
async def detailed_health_check():
    """Detailed health check with service status."""
    
    # Check job repository health
    try:
        job_repository = JobRepositoryFactory.create_repository()
        await job_repository.initialize()
        job_count = await job_repository.get_job_count()
        job_repository_status = "healthy"
        await job_repository.cleanup()
    except Exception as e:
        job_repository_status = f"unhealthy: {str(e)}"
        job_count = None
    
    return {
        "status": "healthy",
        "version": "1.0.0",
        "services": {
            "llm": {
                "provider": settings.llm_provider,
                "model": settings.llm_model,
                "status": "configured"
            },
            "job_repository": {
                "status": job_repository_status,
                "job_count": job_count
            },
            "cache": {
                "url": settings.redis_url,
                "ttl": settings.cache_ttl
            }
        }
    } 