"""Submission request validation."""

from typing import List, Tuple, Optional
from fastapi import HTTPException

from app.models import SubmissionRequest, RubricItem


def validate_submission_request(request: SubmissionRequest) -> None:
    """
    Validate a submission request.
    
    Args:
        request: The submission request to validate
        
    Raises:
        HTTPException: If validation fails
    """
    errors = []
    
    # Check rubric items
    if not request.rubric_items:
        errors.append("No rubric items provided")
    else:
        rubric_errors = _validate_rubric_items(request.rubric_items)
        errors.extend(rubric_errors)
    
    # Check source files
    if not request.source_files:
        errors.append("No source files provided")
    else:
        file_errors = _validate_source_files(request.source_files)
        errors.extend(file_errors)
    
    # Check assignment context
    context_errors = _validate_assignment_context(request)
    errors.extend(context_errors)
    
    if errors:
        error_message = "; ".join(errors)
        raise HTTPException(status_code=400, detail=error_message)


def _validate_rubric_items(rubric_items: List[RubricItem]) -> List[str]:
    """Validate rubric items."""
    errors = []
    
    seen_ids = set()
    for i, item in enumerate(rubric_items):
        # Check for duplicate IDs
        if item.id in seen_ids:
            errors.append(f"Duplicate rubric item ID: {item.id}")
        seen_ids.add(item.id)
        
        # Check description
        if not item.description or not item.description.strip():
            errors.append(f"Rubric item {item.id} has empty description")
        
        # Check points
        if item.points < 0:
            errors.append(f"Rubric item {item.id} has negative points: {item.points}")
        
        # Check radio button options
        if item.type == "RADIO":
            if not item.options:
                errors.append(f"Radio rubric item {item.id} has no options")
            else:
                option_errors = _validate_radio_options(item.id, item.options)
                errors.extend(option_errors)
    
    return errors


def _validate_radio_options(item_id: str, options: dict) -> List[str]:
    """Validate radio button options."""
    errors = []
    
    if len(options) < 2:
        errors.append(f"Radio rubric item {item_id} must have at least 2 options")
    
    for option_key, option_text in options.items():
        if not option_key or not option_key.strip():
            errors.append(f"Radio rubric item {item_id} has empty option key")
        
        if not option_text or not option_text.strip():
            errors.append(f"Radio rubric item {item_id} has empty option text for key '{option_key}'")
    
    return errors


def _validate_source_files(source_files: dict) -> List[str]:
    """Validate source files."""
    errors = []
    
    # Check for common issues
    total_size = 0
    empty_files = []
    
    for filename, content in source_files.items():
        if not filename or not filename.strip():
            errors.append("Found file with empty filename")
            continue
        
        if not isinstance(content, str):
            errors.append(f"File '{filename}' content is not a string")
            continue
        
        if not content.strip():
            empty_files.append(filename)
        
        total_size += len(content)
    
    # Warn about empty files but don't fail validation
    if empty_files and len(empty_files) < len(source_files):
        # Only warn if some files are empty but not all
        pass  # We could log a warning here
    
    # Check total size (approximate limit)
    max_total_size = 10 * 1024 * 1024  # 10MB
    if total_size > max_total_size:
        errors.append(f"Total source files size ({total_size} bytes) exceeds maximum ({max_total_size} bytes)")
    
    return errors


def _validate_assignment_context(request: SubmissionRequest) -> List[str]:
    """Validate assignment context."""
    errors = []
    
    context = request.assignment_context
    
    if not context.course_id or not context.course_id.strip():
        errors.append("Course ID is required")
    
    if not context.assignment_id or not context.assignment_id.strip():
        errors.append("Assignment ID is required")
    
    if not context.submission_id or not context.submission_id.strip():
        errors.append("Submission ID is required")
    
    # Assignment name is optional, but if provided should not be empty
    if context.assignment_name is not None and not context.assignment_name.strip():
        errors.append("Assignment name cannot be empty string")
    
    return errors


def validate_job_id_format(job_id: str) -> bool:
    """
    Validate job ID format.
    
    Args:
        job_id: Job ID to validate
        
    Returns:
        True if valid, False otherwise
    """
    if not job_id or not job_id.strip():
        return False
    
    # Job IDs should be in format: course_id_assignment_id_submission_id
    parts = job_id.split('_')
    if len(parts) < 3:
        return False
    
    # Each part should be non-empty
    return all(part.strip() for part in parts) 