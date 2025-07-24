"""Error handling middleware."""

import traceback
from typing import Callable
from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException


async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    """
    Handle HTTP exceptions with consistent format.
    
    Args:
        request: The request that caused the exception
        exc: The HTTP exception
        
    Returns:
        JSON response with error details
    """
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": exc.status_code,
                "message": str(exc.detail),
                "type": "http_error"
            }
        }
    )


async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """
    Handle validation errors with detailed field information.
    
    Args:
        request: The request that caused the exception
        exc: The validation exception
        
    Returns:
        JSON response with validation error details
    """
    return JSONResponse(
        status_code=422,
        content={
            "error": {
                "code": 422,
                "message": "Validation failed",
                "type": "validation_error",
                "details": exc.errors()
            }
        }
    )


async def general_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """
    Handle unexpected exceptions with safe error messages.
    
    Args:
        request: The request that caused the exception
        exc: The unhandled exception
        
    Returns:
        JSON response with generic error message
    """
    # Log the full exception for debugging
    print(f"🚨 Unhandled exception: {type(exc).__name__}: {str(exc)}")
    print(f"🔍 Request: {request.method} {request.url}")
    print(f"🔍 Traceback:\n{traceback.format_exc()}")
    
    # Return safe error message to client
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": 500,
                "message": "Internal server error",
                "type": "server_error"
            }
        }
    )


def setup_error_handling_middleware(app: FastAPI) -> None:
    """
    Set up error handling middleware for the FastAPI application.
    
    Args:
        app: FastAPI application instance
    """
    # Add exception handlers
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(Exception, general_exception_handler)
    
    # Add logging middleware
    app.middleware("http")(logging_middleware)
    
    print("✓ Configured error handling middleware")


async def logging_middleware(request: Request, call_next: Callable) -> Response:
    """
    Log requests and responses for debugging.
    
    Args:
        request: The incoming request
        call_next: The next middleware or route handler
        
    Returns:
        The response from the next handler
    """
    # Log request
    print(f"📥 {request.method} {request.url}")
    
    # Process request
    try:
        response = await call_next(request)
        
        # Log response
        print(f"📤 {request.method} {request.url} -> {response.status_code}")
        
        return response
        
    except Exception as e:
        # Log error
        print(f"💥 {request.method} {request.url} -> ERROR: {type(e).__name__}: {str(e)}")
        raise 