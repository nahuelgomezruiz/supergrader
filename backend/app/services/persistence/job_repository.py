"""Abstract job repository interface."""

from abc import ABC, abstractmethod
from typing import Optional, Dict, List
from app.models import JobStatus


class JobRepository(ABC):
    """Abstract base class for job persistence."""
    
    @abstractmethod
    async def create_job(self, job_id: str, job_status: JobStatus) -> None:
        """Create a new job record."""
        pass
    
    @abstractmethod
    async def get_job(self, job_id: str) -> Optional[JobStatus]:
        """Get a job by ID."""
        pass
    
    @abstractmethod
    async def update_job(self, job_id: str, job_status: JobStatus) -> None:
        """Update an existing job."""
        pass
    
    @abstractmethod
    async def delete_job(self, job_id: str) -> bool:
        """Delete a job. Returns True if job existed."""
        pass
    
    @abstractmethod
    async def list_jobs(self, limit: Optional[int] = None) -> List[JobStatus]:
        """List all jobs, optionally limited."""
        pass
    
    @abstractmethod
    async def cleanup_old_jobs(self, max_age_seconds: int) -> int:
        """Clean up jobs older than max_age_seconds. Returns count of deleted jobs."""
        pass
    
    @abstractmethod
    async def get_job_count(self) -> int:
        """Get total number of jobs."""
        pass
    
    @abstractmethod
    async def initialize(self) -> None:
        """Initialize the repository (e.g., connect to database)."""
        pass
    
    @abstractmethod
    async def cleanup(self) -> None:
        """Clean up resources (e.g., close connections)."""
        pass 