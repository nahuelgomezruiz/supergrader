"""Main API endpoints aggregator."""

from fastapi import APIRouter

from .routes.grading import router as grading_router
from .routes.jobs import router as jobs_router
from .routes.health import router as health_router
from .routes.feedback import router as feedback_router
from app.services.persistence.factory import JobRepositoryFactory


# Create main router
router = APIRouter()

# Include modular route modules
router.include_router(grading_router, tags=["grading"])
router.include_router(jobs_router, tags=["jobs"])
router.include_router(health_router, tags=["health"])
router.include_router(feedback_router, tags=["feedback"])

# Shared job repository instance for lifecycle management
job_repository = JobRepositoryFactory.create_repository() 