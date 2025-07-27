"""Application configuration."""

from typing import Optional, Literal
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings."""
    
    # API Settings
    app_name: str = "Supergrader Backend"
    debug: bool = False
    api_prefix: str = "/api/v1"
    
    # Storage Settings
    data_dir: str = "./data"  # Directory for storing application data
    
    # Redis Settings
    redis_url: str = "redis://localhost:6379/0"
    cache_ttl: int = 3600  # 1 hour in seconds
    
    # LLM Settings
    llm_provider: Literal["openai", "anthropic"] = "anthropic"
    openai_api_key: Optional[str] = None
    anthropic_api_key: Optional[str] = None
    llm_model: str = "claude-sonnet-4-20250514"
    llm_temperature: float = 0.1
    llm_max_tokens: int = 4096
    llm_timeout: int = 30  # seconds
    llm_max_retries: int = 3
    
    # Grading Settings
    parallel_llm_calls: int = 1  # LLM calls per rubric item
    batch_size: int = 100  # Maximum rubrics to process simultaneously (increased from 50)
    batch_processing_delay: float = 0.05  # Reduced delay between batches
    confidence_threshold: float = 0.8
    max_file_size: int = 100_000  # Max characters per file
    
    # Rate Limit Safety Settings (Tier 5 Conservative Limits)
    max_requests_per_minute: int = 8000  # 80% of Tier 5 10K RPM limit
    max_tokens_per_minute: int = 24_000_000  # 80% of Tier 5 30M TPM limit
    
    # CORS Settings
    # List of exact origins (mostly for local dev)
    cors_origins: list[str] = [
        "http://localhost:8000",
    ]

    # Regex for wildcard origins (allow all subdomains of Gradescope)
    cors_origin_regex: str = r"https://.*\.gradescope\.com"
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False
    )


settings = Settings() 