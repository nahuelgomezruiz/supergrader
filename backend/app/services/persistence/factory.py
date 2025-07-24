"""Job repository factory."""

from typing import Dict, Type, Optional
from app.core.config import settings
from .job_repository import JobRepository
from .memory_repository import MemoryJobRepository
from .redis_repository import RedisJobRepository


class JobRepositoryFactory:
    """Factory for creating job repositories."""
    
    # Registry of available repository types
    _repositories: Dict[str, Type[JobRepository]] = {
        "memory": MemoryJobRepository,
        "redis": RedisJobRepository,
    }
    
    @classmethod
    def create_repository(
        cls,
        repository_type: Optional[str] = None,
        **kwargs
    ) -> JobRepository:
        """
        Create a job repository instance.
        
        Args:
            repository_type: Type of repository ("memory" or "redis"). 
                           If None, automatically selects based on Redis availability.
            **kwargs: Additional repository-specific arguments
            
        Returns:
            Configured job repository instance
            
        Raises:
            ValueError: If repository type is not supported
        """
        # Auto-select repository type if not specified
        if repository_type is None:
            repository_type = cls._auto_select_repository()
        
        if repository_type not in cls._repositories:
            available = ", ".join(cls._repositories.keys())
            raise ValueError(f"Unknown repository type: {repository_type}. Available: {available}")
        
        repository_class = cls._repositories[repository_type]
        
        # Pass additional configuration based on repository type
        if repository_type == "redis":
            # Redis-specific configuration
            repo_kwargs = {
                "redis_url": settings.redis_url,
                **kwargs
            }
        else:
            # Memory repository doesn't need additional config
            repo_kwargs = kwargs
        
        return repository_class(**repo_kwargs)
    
    @classmethod
    def _auto_select_repository(cls) -> str:
        """
        Automatically select the best available repository type.
        
        Returns:
            Repository type name
        """
        # Try Redis first if configured
        if settings.redis_url and settings.redis_url != "redis://localhost:6379/0":
            return "redis"
        
        # For now, default to memory
        # In production, you might want to test Redis connectivity here
        return "memory"
    
    @classmethod
    def register_repository(cls, name: str, repository_class: Type[JobRepository]) -> None:
        """
        Register a new repository type.
        
        Args:
            name: Repository type name
            repository_class: Repository implementation class
        """
        if not issubclass(repository_class, JobRepository):
            raise ValueError(f"Repository class must inherit from JobRepository")
        
        cls._repositories[name] = repository_class
        print(f"✓ Registered job repository: {name}")
    
    @classmethod
    def get_available_repositories(cls) -> Dict[str, Type[JobRepository]]:
        """Get all available repository types."""
        return cls._repositories.copy()
    
    @classmethod
    def is_repository_available(cls, repository_type: str) -> bool:
        """Check if a repository type is available."""
        return repository_type in cls._repositories 