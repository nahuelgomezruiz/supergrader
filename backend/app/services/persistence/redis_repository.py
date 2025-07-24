"""Redis-based job repository implementation."""

import json
import time
from typing import Optional, Dict, List
import redis.asyncio as redis

from app.models import JobStatus
from app.core.config import settings
from .job_repository import JobRepository


class RedisJobRepository(JobRepository):
    """Redis-based job repository implementation."""
    
    def __init__(self, redis_url: Optional[str] = None, key_prefix: str = "job:"):
        """
        Initialize the Redis repository.
        
        Args:
            redis_url: Redis connection URL (defaults to settings.redis_url)
            key_prefix: Prefix for Redis keys
        """
        self.redis_url = redis_url or settings.redis_url
        self.key_prefix = key_prefix
        self._redis: Optional[redis.Redis] = None
        self._connected = False
    
    async def initialize(self) -> None:
        """Initialize the Redis connection."""
        try:
            self._redis = await redis.from_url(
                self.redis_url,
                encoding="utf-8",
                decode_responses=True
            )
            # Test the connection
            await self._redis.ping()
            self._connected = True
            print("✓ Initialized Redis job repository")
        except Exception as e:
            print(f"⚠️ Redis connection failed: {e}")
            raise
    
    async def cleanup(self) -> None:
        """Clean up Redis connection."""
        if self._redis:
            await self._redis.close()
            self._connected = False
            print("🧹 Cleaned up Redis job repository")
    
    def _job_key(self, job_id: str) -> str:
        """Generate Redis key for job."""
        return f"{self.key_prefix}{job_id}"
    
    def _created_key(self, job_id: str) -> str:
        """Generate Redis key for job creation time."""
        return f"{self.key_prefix}{job_id}:created"
    
    async def _ensure_connected(self) -> redis.Redis:
        """Ensure Redis connection is established."""
        if not self._connected or not self._redis:
            await self.initialize()
        return self._redis
    
    async def create_job(self, job_id: str, job_status: JobStatus) -> None:
        """Create a new job record."""
        redis_client = await self._ensure_connected()
        
        # Store job data and creation time
        job_data = job_status.model_dump_json()
        created_time = str(time.time())
        
        async with redis_client.pipeline() as pipe:
            pipe.set(self._job_key(job_id), job_data, ex=settings.cache_ttl)
            pipe.set(self._created_key(job_id), created_time, ex=settings.cache_ttl)
            await pipe.execute()
        
        print(f"📝 Created job {job_id} in Redis")
    
    async def get_job(self, job_id: str) -> Optional[JobStatus]:
        """Get a job by ID."""
        redis_client = await self._ensure_connected()
        
        job_data = await redis_client.get(self._job_key(job_id))
        if not job_data:
            return None
        
        try:
            return JobStatus.model_validate_json(job_data)
        except Exception as e:
            print(f"⚠️ Failed to parse job data for {job_id}: {e}")
            return None
    
    async def update_job(self, job_id: str, job_status: JobStatus) -> None:
        """Update an existing job."""
        redis_client = await self._ensure_connected()
        
        # Check if job exists
        if not await redis_client.exists(self._job_key(job_id)):
            raise ValueError(f"Job {job_id} not found")
        
        # Update job data while preserving TTL
        job_data = job_status.model_dump_json()
        ttl = await redis_client.ttl(self._job_key(job_id))
        
        if ttl > 0:
            await redis_client.set(self._job_key(job_id), job_data, ex=ttl)
        else:
            await redis_client.set(self._job_key(job_id), job_data, ex=settings.cache_ttl)
        
        print(f"📝 Updated job {job_id}: {job_status.status}, progress: {job_status.progress:.1%}")
    
    async def delete_job(self, job_id: str) -> bool:
        """Delete a job. Returns True if job existed."""
        redis_client = await self._ensure_connected()
        
        async with redis_client.pipeline() as pipe:
            pipe.delete(self._job_key(job_id))
            pipe.delete(self._created_key(job_id))
            results = await pipe.execute()
        
        deleted = results[0] > 0  # Number of keys deleted
        if deleted:
            print(f"🗑️ Deleted job {job_id} from Redis")
        
        return deleted
    
    async def list_jobs(self, limit: Optional[int] = None) -> List[JobStatus]:
        """List all jobs, optionally limited."""
        redis_client = await self._ensure_connected()
        
        # Find all job keys
        pattern = f"{self.key_prefix}*"
        keys = []
        async for key in redis_client.scan_iter(match=pattern):
            # Skip created time keys
            if not key.endswith(":created"):
                keys.append(key)
        
        # Apply limit
        if limit is not None:
            keys = keys[:limit]
        
        # Fetch all job data
        jobs = []
        if keys:
            job_data_list = await redis_client.mget(keys)
            for job_data in job_data_list:
                if job_data:
                    try:
                        jobs.append(JobStatus.model_validate_json(job_data))
                    except Exception as e:
                        print(f"⚠️ Failed to parse job data: {e}")
        
        return jobs
    
    async def cleanup_old_jobs(self, max_age_seconds: int) -> int:
        """Clean up jobs older than max_age_seconds. Returns count of deleted jobs."""
        redis_client = await self._ensure_connected()
        
        current_time = time.time()
        cutoff_time = current_time - max_age_seconds
        
        # Find all created time keys
        pattern = f"{self.key_prefix}*:created"
        old_job_ids = []
        
        async for key in redis_client.scan_iter(match=pattern):
            created_time_str = await redis_client.get(key)
            if created_time_str:
                try:
                    created_time = float(created_time_str)
                    if created_time < cutoff_time:
                        # Extract job_id from key
                        job_id = key[len(self.key_prefix):-8]  # Remove prefix and ":created"
                        old_job_ids.append(job_id)
                except ValueError:
                    continue
        
        # Delete old jobs
        deleted_count = 0
        for job_id in old_job_ids:
            if await self.delete_job(job_id):
                deleted_count += 1
        
        if deleted_count > 0:
            print(f"🧹 Cleaned up {deleted_count} old jobs from Redis")
        
        return deleted_count
    
    async def get_job_count(self) -> int:
        """Get total number of jobs."""
        redis_client = await self._ensure_connected()
        
        # Count job keys (excluding created time keys)
        count = 0
        pattern = f"{self.key_prefix}*"
        async for key in redis_client.scan_iter(match=pattern):
            if not key.endswith(":created"):
                count += 1
        
        return count 