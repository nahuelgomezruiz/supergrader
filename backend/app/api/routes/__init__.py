"""API routes module."""

from .grading import router as grading_router
from .jobs import router as jobs_router  
from .health import router as health_router

__all__ = [
    "grading_router",
    "jobs_router", 
    "health_router"
] 