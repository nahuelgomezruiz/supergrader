"""In-memory job repository implementation."""

import time
from typing import Optional, Dict, List
from app.models import JobStatus
from .job_repository import JobRepository


class MemoryJobRepository(JobRepository):
    """In-memory job repository implementation."""
    
    def __init__(self):
        """Initialize the in-memory repository."""
        self._jobs: Dict[str, JobStatus] = {}
        self._created_times: Dict[str, float] = {}
    
    async def create_job(self, job_id: str, job_status: JobStatus) -> None:
        """Create a new job record."""
        self._jobs[job_id] = job_status
        self._created_times[job_id] = time.time()
        print(f"📝 Created job {job_id} in memory")
    
    async def get_job(self, job_id: str) -> Optional[JobStatus]:
        """Get a job by ID."""
        return self._jobs.get(job_id)
    
    async def update_job(self, job_id: str, job_status: JobStatus) -> None:
        """Update an existing job."""
        if job_id in self._jobs:
            self._jobs[job_id] = job_status
            print(f"📝 Updated job {job_id}: {job_status.status}, progress: {job_status.progress:.1%}")
        else:
            raise ValueError(f"Job {job_id} not found")
    
    async def delete_job(self, job_id: str) -> bool:
        """Delete a job. Returns True if job existed."""
        if job_id in self._jobs:
            del self._jobs[job_id]
            if job_id in self._created_times:
                del self._created_times[job_id]
            print(f"🗑️ Deleted job {job_id} from memory")
            return True
        return False
    
    async def list_jobs(self, limit: Optional[int] = None) -> List[JobStatus]:
        """List all jobs, optionally limited."""
        jobs = list(self._jobs.values())
        if limit is not None:
            jobs = jobs[:limit]
        return jobs
    
    async def cleanup_old_jobs(self, max_age_seconds: int) -> int:
        """Clean up jobs older than max_age_seconds. Returns count of deleted jobs."""
        current_time = time.time()
        old_job_ids = []
        
        for job_id, created_time in self._created_times.items():
            if current_time - created_time > max_age_seconds:
                old_job_ids.append(job_id)
        
        for job_id in old_job_ids:
            await self.delete_job(job_id)
        
        if old_job_ids:
            print(f"🧹 Cleaned up {len(old_job_ids)} old jobs from memory")
        
        return len(old_job_ids)
    
    async def get_job_count(self) -> int:
        """Get total number of jobs."""
        return len(self._jobs)
    
    async def initialize(self) -> None:
        """Initialize the repository."""
        print("✓ Initialized in-memory job repository")
    
    async def cleanup(self) -> None:
        """Clean up resources."""
        self._jobs.clear()
        self._created_times.clear()
        print("🧹 Cleaned up in-memory job repository") 