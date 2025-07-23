"""Caching utilities."""

import json
import hashlib
from typing import Optional, Any, Callable
from functools import wraps
import redis.asyncio as redis

from app.core.config import settings


class RedisCache:
    """Async Redis cache wrapper."""
    
    def __init__(self):
        self._redis: Optional[redis.Redis] = None
        self._connected: bool = False
    
    async def connect(self):
        """Initialize Redis connection."""
        try:
            self._redis = await redis.from_url(
                settings.redis_url,
                encoding="utf-8",
                decode_responses=True
            )
            # Test the connection
            await self._redis.ping()
            self._connected = True
            print("✓ Connected to Redis")
        except Exception as e:
            print(f"⚠️ Redis connection failed: {e}")
            print("⚠️ Running without cache")
            self._redis = None
            self._connected = False
    
    async def disconnect(self):
        """Close Redis connection."""
        if self._redis:
            await self._redis.close()
            self._connected = False
    
    async def get(self, key: str) -> Optional[str]:
        """Get value from cache."""
        if not self._connected or not self._redis:
            return None
        try:
            return await self._redis.get(key)
        except Exception:
            return None
    
    async def set(self, key: str, value: str, ttl: int = settings.cache_ttl) -> bool:
        """Set value in cache with TTL."""
        if not self._connected or not self._redis:
            return False
        try:
            await self._redis.setex(key, ttl, value)
            return True
        except Exception:
            return False
    
    async def delete(self, key: str) -> bool:
        """Delete key from cache."""
        if not self._connected or not self._redis:
            return False
        try:
            await self._redis.delete(key)
            return True
        except Exception:
            return False


# Global cache instance
cache = RedisCache()


def cache_key(*args, **kwargs) -> str:
    """Generate cache key from arguments."""
    # Create a stable string representation
    key_data = {
        "args": args,
        "kwargs": sorted(kwargs.items())
    }
    key_str = json.dumps(key_data, sort_keys=True)
    
    # Hash it to avoid overly long keys
    return hashlib.sha256(key_str.encode()).hexdigest()


def cached(prefix: str, ttl: Optional[int] = None):
    """Decorator for caching async function results."""
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Generate cache key
            key = f"{prefix}:{cache_key(*args, **kwargs)}"
            
            # Try to get from cache
            cached_value = await cache.get(key)
            if cached_value is not None:
                try:
                    return json.loads(cached_value)
                except json.JSONDecodeError:
                    pass
            
            # Call the function
            result = await func(*args, **kwargs)
            
            # Cache the result
            if result is not None:
                await cache.set(
                    key,
                    json.dumps(result),
                    ttl or settings.cache_ttl
                )
            
            return result
        
        return wrapper
    return decorator 