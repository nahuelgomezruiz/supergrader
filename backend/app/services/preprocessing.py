"""Preprocessing service for submission files."""

import os
from typing import Dict, Tuple, Set
from pathlib import Path

from app.core.config import settings
from app.utils.cache import cached


# File extensions to include in full
INCLUDE_EXTENSIONS = {'.cpp', '.h', '.hpp', '.c', '.cc', '.cxx', '.py', '.java', '.js', '.ts', '.rs', '.go'}
SPECIAL_FILES = {'README', 'README.md', 'README.txt', 'Makefile', 'CMakeLists.txt', 'package.json'}

# Test file patterns
TEST_PATTERNS = {'test_', '_test', 'Test', 'test.', '.test.', 'spec.', '.spec.', 'tests/', 'test/'}


class PreprocessingService:
    """Service for preprocessing submission files."""
    
    async def preprocess_submission(
        self,
        course_id: str,
        assignment_id: str,
        submission_id: str,
        source_files: Dict[str, str]
    ) -> Dict[str, str]:
        """
        Preprocess submission files by filtering and summarizing.
        
        Returns a dict of filename -> content, where test files are summarized.
        """
        # Check cache first
        from app.utils.cache import cache
        cache_key = f"preprocess:{course_id}:{assignment_id}:{submission_id}"
        cached_result = await cache.get(cache_key)
        if cached_result:
            try:
                import json
                return json.loads(cached_result)
            except json.JSONDecodeError:
                pass
        processed = {}
        test_files = []
        
        for filename, content in source_files.items():
            # Skip if file is too large
            if len(content) > settings.max_file_size:
                processed[filename] = f"[File too large: {len(content)} characters, truncated to first {settings.max_file_size}]"
                processed[filename] += f"\n\n{content[:settings.max_file_size]}..."
                continue
            
            # Check if it's a special file or has included extension
            path = Path(filename)
            base_name = path.stem
            extension = path.suffix.lower()
            
            if base_name in SPECIAL_FILES or extension in INCLUDE_EXTENSIONS:
                # Check if it's a test file
                if self._is_test_file(filename):
                    test_files.append((filename, content))
                else:
                    # Include the full content
                    processed[filename] = content
            else:
                # Summarize other files
                processed[filename] = self._summarize_file(filename, content)
        
        # Create a summary of test files if any
        if test_files:
            test_summary = self._summarize_test_files(test_files)
            processed["__TEST_FILES_SUMMARY__"] = test_summary
        
        # Cache the result
        try:
            import json
            await cache.set(cache_key, json.dumps(processed))
        except Exception:
            pass  # Cache failure shouldn't break the function
        
        return processed
    
    def _is_test_file(self, filename: str) -> bool:
        """Check if a file is a test file based on patterns."""
        filename_lower = filename.lower()
        # Special case: do NOT treat unit_tests.h / unit_tests.cpp as test files – we need full content
        # because rubric items inspect actual tests for isolation, single-case coverage, etc.
        if filename_lower.endswith("unit_tests.h") or filename_lower.endswith("unit_tests.cpp"):
            return False
        
        # Check for test patterns in filename
        for pattern in TEST_PATTERNS:
            if pattern in filename_lower:
                return True
        
        # Check if in test directory
        parts = filename.split('/')
        for part in parts[:-1]:  # Exclude the filename itself
            if part.lower() in {'test', 'tests', 'spec', 'specs', '__tests__'}:
                return True
        
        return False
    
    def _summarize_file(self, filename: str, content: str) -> str:
        """Create a summary of a non-essential file."""
        lines = content.strip().split('\n')
        line_count = len(lines)
        
        # Get file size
        size_bytes = len(content.encode('utf-8'))
        size_str = self._format_size(size_bytes)
        
        # Extract some metadata
        summary = f"[File Summary: {filename}]\n"
        summary += f"Size: {size_str}, Lines: {line_count}\n"
        
        # Add first few lines as preview
        preview_lines = min(5, line_count)
        if preview_lines > 0:
            summary += f"Preview (first {preview_lines} lines):\n"
            for i in range(preview_lines):
                summary += f"  {lines[i][:80]}{'...' if len(lines[i]) > 80 else ''}\n"
        
        return summary
    
    def _summarize_test_files(self, test_files: list[Tuple[str, str]]) -> str:
        """Create a summary of all test files."""
        summary = "[TEST FILES SUMMARY]\n"
        summary += f"Total test files found: {len(test_files)}\n\n"
        
        for filename, content in test_files:
            lines = content.strip().split('\n')
            line_count = len(lines)
            
            # Try to extract test names/functions
            test_names = self._extract_test_names(content)
            
            summary += f"- {filename} ({line_count} lines)\n"
            if test_names:
                summary += f"  Tests found: {', '.join(test_names[:5])}"
                if len(test_names) > 5:
                    summary += f" ... and {len(test_names) - 5} more"
                summary += "\n"
            summary += "\n"
        
        summary += "\nNote: Test files are summarized to save context space. "
        summary += "Their presence indicates the student has written tests for their code."
        
        return summary
    
    def _extract_test_names(self, content: str) -> list[str]:
        """Extract test function/method names from content."""
        test_names = []
        
        # Common test patterns across languages
        patterns = [
            r'def test_(\w+)',  # Python
            r'TEST\s*\(\s*(\w+)',  # C++ Google Test
            r'@Test.*\s+(?:public\s+)?void\s+(\w+)',  # Java JUnit
            r'it\s*\(\s*[\'"`]([^\'"`]+)',  # JavaScript/TypeScript
            r'test\s*\(\s*[\'"`]([^\'"`]+)',  # JavaScript/TypeScript
            r'describe\s*\(\s*[\'"`]([^\'"`]+)',  # JavaScript/TypeScript
        ]
        
        import re
        for pattern in patterns:
            matches = re.findall(pattern, content, re.MULTILINE)
            test_names.extend(matches)
        
        return list(set(test_names))  # Remove duplicates
    
    def _format_size(self, size_bytes: int) -> str:
        """Format file size in human-readable format."""
        for unit in ['B', 'KB', 'MB']:
            if size_bytes < 1024.0:
                return f"{size_bytes:.1f} {unit}"
            size_bytes /= 1024.0
        return f"{size_bytes:.1f} GB" 