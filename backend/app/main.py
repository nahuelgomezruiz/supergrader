"""Main FastAPI application."""

from contextlib import asynccontextmanager
from fastapi import FastAPI

from app.core.config import settings
from app.api.endpoints import router, job_repository
from app.utils.cache import cache
from app.middleware.cors import setup_cors_middleware
from app.middleware.error_handling import setup_error_handling_middleware


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifecycle."""
    # Startup
    await cache.connect()
    await job_repository.initialize()
    yield
    # Shutdown
    await job_repository.cleanup()
    await cache.disconnect()


# Create FastAPI app
app = FastAPI(
    title=settings.app_name,
    debug=settings.debug,
    lifespan=lifespan
)

# Configure middleware
setup_cors_middleware(app)
setup_error_handling_middleware(app)

# Include routers
app.include_router(router, prefix=settings.api_prefix)


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "message": "Supergrader Backend API",
        "version": "1.0.0",
        "docs": "/docs"
    } 