"""CORS middleware configuration."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings


def setup_cors_middleware(app: FastAPI) -> None:
    """
    Set up CORS middleware for the FastAPI application.
    
    Args:
        app: FastAPI application instance
    """
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_origin_regex=settings.cors_origin_regex,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    print(f"✓ Configured CORS middleware")
    print(f"  - Allowed origins: {', '.join(settings.cors_origins) if settings.cors_origins else 'none'}")
    print(f"  - Origin regex: {settings.cors_origin_regex}")


def get_cors_config() -> dict:
    """
    Get CORS configuration as a dictionary.
    
    Returns:
        Dictionary with CORS configuration
    """
    return {
        "allow_origins": settings.cors_origins,
        "allow_origin_regex": settings.cors_origin_regex,
        "allow_credentials": True,
        "allow_methods": ["*"],
        "allow_headers": ["*"],
    } 