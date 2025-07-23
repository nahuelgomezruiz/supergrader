"""Application configuration."""

from typing import Optional, Literal
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings."""
    
    # API Settings
    app_name: str = "Supergrader Backend"
    debug: bool = False
    api_prefix: str = "/api/v1"
    
    # Redis Settings
    redis_url: str = "redis://localhost:6379/0"
    cache_ttl: int = 3600  # 1 hour in seconds
    
    # LLM Settings
    llm_provider: Literal["openai", "anthropic"] = "openai"
    openai_api_key: Optional[str] = None
    anthropic_api_key: Optional[str] = None
    llm_model: str = "gpt-4o"  # or "claude-3-5-sonnet-20241022"
    llm_temperature: float = 0.1
    llm_max_tokens: int = 4096
    llm_timeout: int = 30  # seconds
    llm_max_retries: int = 3
    
    # Grading Settings
    parallel_llm_calls: int = 3  # Number of parallel LLM calls per rubric item
    confidence_threshold: float = 0.8
    max_file_size: int = 100_000  # Max characters per file
    
    # CORS Settings
    cors_origins: list[str] = ["http://localhost:3000", "chrome-extension://*"]
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False
    )


settings = Settings() 