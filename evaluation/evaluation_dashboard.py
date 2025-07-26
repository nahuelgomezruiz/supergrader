import os
import csv
import json
import asyncio
import aiohttp
import pandas as pd
from typing import Dict, List, Tuple, Any, Optional
from dataclasses import dataclass, field
from pathlib import Path
import openpyxl
from openpyxl.styles import PatternFill, Font, Alignment, Border, Side
from openpyxl.utils import get_column_letter
import argparse
from datetime import datetime
import re
import logging
import random

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('evaluation_debug.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# QWERTY order for radio button option letters
QWERTY_LETTERS = "QWERTYUIOPASDFGHJKLZXCVBNM"


@dataclass
class RubricItem:
    """Represents a single rubric item."""
    id: str
    description: str
    points: float
    type: str  # "CHECKBOX" or "RADIO"
    options: Optional[Dict[str, str]] = None  # For RADIO type
    column_index: int = 0  # Original column index in CSV


@dataclass
class StudentGrade:
    """Represents grades for a single student."""
    submission_id: str
    name: str
    grades: Dict[str, bool]  # rubric_id -> True/False for checkbox, or selected option for radio
    
    
@dataclass
class EvaluationResult:
    """Results from backend evaluation."""
    submission_id: str
    rubric_id: str
    decision: str  # "check"/"uncheck" for checkbox, or selected option for radio
    confidence: float
    comment: str
    evidence: Dict[str, str]


class CSVParser:
    """Parses Gradescope CSV files to extract rubric items and grades."""
    
    # File processing configuration (matching Chrome extension)
    MAX_FILE_SIZE = 1048576  # 1MB in characters
    TEST_FILE_MAX_CONTENT = 100  # characters for test files
    SUPPORTED_EXTENSIONS = ['.cpp', '.h', '.py', '.java', '.js', '.ts', '.c', '.cc', '.cxx']
    
    @staticmethod
    def is_test_file(file_path: str) -> bool:
        """Check if a file is a test file (same logic as Chrome extension)."""
        lower = file_path.lower()
        
        # Get just the filename (handle both / and \ separators)
        base_name = lower.replace('\\', '/').split('/')[-1]
        
        # Core files that are NEVER treated as test files
        if base_name == 'makefile' or base_name.startswith('readme'):
            return False
        
        # Core source files (.cpp and .h) - but check for test patterns
        if lower.endswith('.cpp') or lower.endswith('.h'):
            # Special case: unit_tests.h is important for grading, don't truncate it
            if base_name == 'unit_tests.h':
                return False  # Treat as core file (don't truncate)
            # Other test files with "test" in the name are test files
            elif 'test' in base_name:
                return True
            return False
        
        # Check if it's a supported extension
        has_valid_extension = any(lower.endswith(ext) for ext in CSVParser.SUPPORTED_EXTENSIONS)
        if not has_valid_extension:
            return True  # Non-source files are considered test files
        
        # Everything else is considered a test/auxiliary file
        return True
    
    @staticmethod
    def process_file_content(file_path: str, content: str) -> str | None:
        """Process file content with filtering and truncation (same as Chrome extension)."""
        
        # Check for binary data (basic check)
        if '\0' in content:
            print(f"      ⚠️  Skipping binary file: {file_path}")
            return None
        
        # Clean line endings
        content = content.replace('\r\n', '\n').replace('\r', '\n')
        
        # Apply file size limit
        if len(content) > CSVParser.MAX_FILE_SIZE:
            content = content[:CSVParser.MAX_FILE_SIZE] + '\n\n// [FILE TRUNCATED - TOO LARGE]'
            print(f"      📏 Truncated large file: {file_path} ({len(content)} chars)")
        
        # Apply test file truncation
        if CSVParser.is_test_file(file_path):
            if len(content) > CSVParser.TEST_FILE_MAX_CONTENT:
                content = content[:CSVParser.TEST_FILE_MAX_CONTENT] + '[TRIMMED]'
                print(f"      ✂️  Truncated test file: {file_path} (to {CSVParser.TEST_FILE_MAX_CONTENT} chars)")
        
        return content
    
    @staticmethod
    def parse_rubric_from_csv(csv_path: Path) -> Tuple[List[RubricItem], Dict[str, StudentGrade]]:
        """Parse CSV file to extract rubric items and student grades."""
        rubric_items = []
        student_grades = {}
        
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.reader(f)
            rows = list(reader)
            
            if len(rows) < 4:
                raise ValueError(f"CSV file {csv_path} doesn't have enough rows")
            
            # Parse headers (first row contains questions)
            headers = rows[0]
            
            # Get point values from last row
            point_values_row = rows[-1]
            
            # Process rubric items from headers
            radio_groups = {}  # Track radio button groups
            
            for col_idx, header in enumerate(headers):
                if col_idx < 8:  # Skip metadata columns
                    continue
                    
                if not header or header.strip() == "":
                    continue
                
                # Skip columns that are not meant to be graded
                excluded_columns = ["Adjustment", "Comments", "Grader", "Tags"]
                if header.strip() in excluded_columns:
                    continue
                    
                # Check if it's a radio button
                radio_match = re.match(r'\[RADIO (\d+)\](.+)', header)
                
                if radio_match:
                    group_num = radio_match.group(1)
                    full_description = radio_match.group(2).strip()
                    
                    # Extract the common description (before the colon)
                    parts = full_description.split(':', 1)
                    if len(parts) == 2:
                        base_description = parts[0].strip()
                        option_text = parts[1].strip()
                    else:
                        base_description = full_description
                        option_text = full_description
                    
                    # Get point value
                    try:
                        points = float(point_values_row[col_idx]) if col_idx < len(point_values_row) else 0.0
                    except (ValueError, IndexError):
                        points = 0.0
                    
                    if group_num not in radio_groups:
                        radio_groups[group_num] = {
                            'description': base_description,
                            'options': {},
                            'max_points': 0.0,
                            'column_indices': [],
                            'column_to_letter': {}
                        }
                    
                    # Assign QWERTY letter to this option
                    current_option_count = len(radio_groups[group_num]['options'])
                    if current_option_count < len(QWERTY_LETTERS):
                        option_letter = QWERTY_LETTERS[current_option_count]
                        radio_groups[group_num]['options'][option_letter] = {
                            'text': option_text,
                            'points': str(points)
                        }
                        radio_groups[group_num]['max_points'] = max(radio_groups[group_num]['max_points'], points)
                        radio_groups[group_num]['column_indices'].append(col_idx)
                        # Store mapping from column index to letter for later use
                        radio_groups[group_num]['column_to_letter'] = radio_groups[group_num].get('column_to_letter', {})
                        radio_groups[group_num]['column_to_letter'][col_idx] = option_letter
                
                else:
                    # Regular checkbox item
                    try:
                        points = float(point_values_row[col_idx]) if col_idx < len(point_values_row) else 0.0
                    except (ValueError, IndexError):
                        points = 0.0
                        
                    rubric_item = RubricItem(
                        id=f"checkbox_{col_idx}",
                        description=header,
                        points=points,
                        type="CHECKBOX",
                        column_index=col_idx
                    )
                    rubric_items.append(rubric_item)
            
            # Add radio groups as rubric items
            for group_num, group_data in radio_groups.items():
                rubric_item = RubricItem(
                    id=f"radio_{group_num}",
                    description=group_data['description'],
                    points=group_data['max_points'],
                    type="RADIO",
                    options=group_data['options'],
                    column_index=min(group_data['column_indices'])  # Use first column index
                )
                rubric_items.append(rubric_item)
            
            # Parse student grades (skip header and last two rows)
            for row_idx in range(1, len(rows) - 2):
                row = rows[row_idx]
                if len(row) < 8:
                    continue
                    
                submission_id = row[0]
                name = row[2] if len(row) > 2 else ""
                
                if not submission_id or submission_id == "":
                    continue
                
                grades = {}
                
                # Process checkbox items
                for rubric_item in rubric_items:
                    if rubric_item.type == "CHECKBOX":
                        col_idx = rubric_item.column_index
                        if col_idx < len(row):
                            value = row[col_idx].strip().upper()
                            grades[rubric_item.id] = value == "TRUE"
                
                # Process radio items
                for group_num, group_data in radio_groups.items():
                    radio_id = f"radio_{group_num}"
                    selected_letter = None
                    
                    for col_idx in group_data['column_indices']:
                        if col_idx < len(row) and row[col_idx].strip().upper() == "TRUE":
                            # Get the letter for this column
                            selected_letter = group_data['column_to_letter'].get(col_idx)
                            break
                    
                    if selected_letter:
                        grades[radio_id] = selected_letter
                
                student_grades[submission_id] = StudentGrade(
                    submission_id=submission_id,
                    name=name,
                    grades=grades
                )
        
        return rubric_items, student_grades


class BackendClient:
    """Client for interacting with the grading backend."""
    
    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url
        self.session = None
        
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
            
    async def grade_submission(
        self,
        assignment_context: Dict[str, str],
        source_files: Dict[str, str],
        rubric_items: List[Dict[str, Any]]
    ) -> List[EvaluationResult]:
        """Send grading request to backend and parse results."""
        
        request_data = {
            "assignment_context": assignment_context,
            "source_files": source_files,
            "rubric_items": rubric_items
        }
        
        # Log the complete request for debugging
        logger.info(f"=== SENDING REQUEST TO BACKEND ===")
        logger.info(f"URL: {self.base_url}/api/v1/grade-submission")
        logger.info(f"Assignment Context: {json.dumps(assignment_context, indent=2)}")
        logger.info(f"Number of source files: {len(source_files)}")
        logger.info(f"Source files: {list(source_files.keys())}")
        logger.info(f"Number of rubric items: {len(rubric_items)}")
        logger.info(f"Rubric items structure:")
        for i, item in enumerate(rubric_items):
            logger.info(f"  Item {i+1}: {json.dumps(item, indent=4)}")
        
        # Log complete request JSON (truncated source files for readability)
        debug_request = request_data.copy()
        debug_request["source_files"] = {
            filename: f"[{len(content)} characters]" if len(content) > 200 
            else content for filename, content in source_files.items()
        }
        logger.info(f"Complete request JSON structure:")
        logger.info(json.dumps(debug_request, indent=2))
        
        results = []
        
        try:
            async with self.session.post(
                f"{self.base_url}/api/v1/grade-submission",
                json=request_data,
                timeout=aiohttp.ClientTimeout(total=300)  # 5 minute timeout
            ) as response:
                logger.info(f"=== BACKEND RESPONSE ===")
                logger.info(f"Status: {response.status}")
                logger.info(f"Headers: {dict(response.headers)}")
                
                if response.status != 200:
                    error_text = await response.text()
                    logger.error(f"Backend error response: {error_text}")
                    raise Exception(f"Backend returned status {response.status}: {error_text}")
                
                logger.info("Starting to parse Server-Sent Events...")
                # Parse Server-Sent Events
                async for line in response.content:
                    line = line.decode('utf-8').strip()
                    logger.debug(f"Received SSE line: {line}")
                    if line.startswith('data: '):
                        data_str = line[6:]  # Remove 'data: ' prefix
                        try:
                            data = json.loads(data_str)
                            logger.info(f"Parsed SSE data: {json.dumps(data, indent=2)}")
                            if data.get('type') == 'partial_result' and data.get('decision'):
                                decision = data['decision']
                                verdict = decision.get('verdict', {})
                                
                                # Extract decision based on type
                                if decision['type'] == 'CHECKBOX':
                                    result_decision = verdict.get('decision', 'uncheck')
                                else:  # RADIO
                                    result_decision = verdict.get('selected_option', '')
                                
                                result = EvaluationResult(
                                    submission_id=assignment_context['submission_id'],
                                    rubric_id=decision['rubric_item_id'],
                                    decision=result_decision,
                                    confidence=verdict.get('confidence', 0) / 100.0,  # Convert to 0-1
                                    comment=verdict.get('comment', ''),
                                    evidence=verdict.get('evidence', {})
                                )
                                results.append(result)
                                logger.info(f"Added result for rubric {decision['rubric_item_id']}: {result_decision}")
                        except json.JSONDecodeError as e:
                            logger.warning(f"Failed to parse JSON from SSE data: {data_str}, error: {e}")
                            continue
                            
        except Exception as e:
            print(f"Error grading submission {assignment_context['submission_id']}: {str(e)}")
            
        return results


class ExcelReportGenerator:
    """Generates Excel reports comparing backend and human grades."""
    
    def __init__(self):
        self.wb = None
        self.ws = None
        
    def create_report(
        self,
        project_name: str,
        rubric_items: List[RubricItem],
        human_grades: Dict[str, StudentGrade],
        backend_results: Dict[str, List[EvaluationResult]],
        output_path: Path
    ):
        """Create Excel report with comparison visualization."""
        
        self.wb = openpyxl.Workbook()
        self.ws = self.wb.active
        self.ws.title = project_name[:31]  # Excel sheet name limit
        
        # Define styles
        header_fill = PatternFill(start_color="366092", end_color="366092", fill_type="solid")
        header_font = Font(color="FFFFFF", bold=True)
        match_fill = PatternFill(start_color="C6EFCE", end_color="C6EFCE", fill_type="solid")  # Green
        false_positive_fill = PatternFill(start_color="FFC7CE", end_color="FFC7CE", fill_type="solid")  # Light red
        false_negative_fill = PatternFill(start_color="FFEB9C", end_color="FFEB9C", fill_type="solid")  # Yellow
        border = Border(
            left=Side(style='thin'),
            right=Side(style='thin'),
            top=Side(style='thin'),
            bottom=Side(style='thin')
        )
        
        # Create headers
        headers = ["Submission ID", "Student Name"]
        
        # Add rubric item headers
        for rubric_item in rubric_items:
            headers.append(rubric_item.description)  # Full description without truncation
            headers.append("Backend Decision")
            headers.append("Confidence %")
            headers.append("Comment")
            headers.append("Match?")
        
        # Write headers
        for col, header in enumerate(headers, 1):
            cell = self.ws.cell(row=1, column=col, value=header)
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
            cell.border = border
        
        # Process each student
        row_idx = 2
        for submission_id, student_grade in human_grades.items():
            # Basic info
            self.ws.cell(row=row_idx, column=1, value=submission_id).border = border
            self.ws.cell(row=row_idx, column=2, value=student_grade.name).border = border
            
            # Get backend results for this student
            student_backend_results = backend_results.get(submission_id, [])
            backend_by_rubric = {r.rubric_id: r for r in student_backend_results}
            
            col_idx = 3
            for rubric_item in rubric_items:
                # Human grade
                human_value = student_grade.grades.get(rubric_item.id, False)
                
                if rubric_item.type == "CHECKBOX":
                    human_cell = self.ws.cell(row=row_idx, column=col_idx, value="TRUE" if human_value else "FALSE")
                else:  # RADIO
                    human_cell = self.ws.cell(row=row_idx, column=col_idx, value=str(human_value))
                human_cell.border = border
                
                # Backend result
                backend_result = backend_by_rubric.get(rubric_item.id)
                
                if backend_result:
                    if rubric_item.type == "CHECKBOX":
                        backend_value = "TRUE" if backend_result.decision == "check" else "FALSE"
                    else:  # RADIO
                        backend_value = backend_result.decision
                    
                    backend_cell = self.ws.cell(row=row_idx, column=col_idx + 1, value=backend_value)
                    confidence_cell = self.ws.cell(row=row_idx, column=col_idx + 2, value=f"{backend_result.confidence * 100:.1f}")
                    comment_cell = self.ws.cell(row=row_idx, column=col_idx + 3, value=backend_result.comment)
                    
                    # Check if match
                    if rubric_item.type == "CHECKBOX":
                        human_bool = human_value
                        backend_bool = backend_result.decision == "check"
                        match = human_bool == backend_bool
                        
                        if match:
                            match_text = "MATCH"
                            fill = match_fill
                        elif human_bool and not backend_bool:
                            match_text = "FALSE NEGATIVE"
                            fill = false_negative_fill
                        else:
                            match_text = "FALSE POSITIVE"
                            fill = false_positive_fill
                    else:  # RADIO
                        # For radio buttons, compare letters
                        match = str(human_value) == backend_result.decision
                        match_text = "MATCH" if match else "MISMATCH"
                        fill = match_fill if match else false_positive_fill
                    
                    match_cell = self.ws.cell(row=row_idx, column=col_idx + 4, value=match_text)
                    
                    # Apply formatting
                    for cell in [human_cell, backend_cell, match_cell]:
                        cell.fill = fill
                        cell.border = border
                    
                    confidence_cell.border = border
                    comment_cell.border = border
                    comment_cell.alignment = Alignment(wrap_text=True)
                else:
                    # No backend result
                    self.ws.cell(row=row_idx, column=col_idx + 1, value="N/A").border = border
                    self.ws.cell(row=row_idx, column=col_idx + 2, value="N/A").border = border
                    self.ws.cell(row=row_idx, column=col_idx + 3, value="No result").border = border
                    self.ws.cell(row=row_idx, column=col_idx + 4, value="NO DATA").border = border
                
                col_idx += 5
            
            row_idx += 1
        
        # Add summary statistics
        self.add_summary_sheet(rubric_items, human_grades, backend_results)
        
        # Adjust column widths
        for col in range(1, self.ws.max_column + 1):
            self.ws.column_dimensions[get_column_letter(col)].width = 15
        
        # Save
        self.wb.save(output_path)
        
    def add_summary_sheet(
        self,
        rubric_items: List[RubricItem],
        human_grades: Dict[str, StudentGrade],
        backend_results: Dict[str, List[EvaluationResult]]
    ):
        """Add summary statistics sheet."""
        
        summary_ws = self.wb.create_sheet("Summary")
        
        # Calculate statistics
        stats = []
        for rubric_item in rubric_items:
            total = 0
            matches = 0
            false_positives = 0
            false_negatives = 0
            no_data = 0
            avg_confidence = 0
            confidence_count = 0
            
            for submission_id, student_grade in human_grades.items():
                total += 1
                human_value = student_grade.grades.get(rubric_item.id, False)
                
                backend_results_student = backend_results.get(submission_id, [])
                backend_result = next((r for r in backend_results_student if r.rubric_id == rubric_item.id), None)
                
                if backend_result:
                    avg_confidence += backend_result.confidence
                    confidence_count += 1
                    
                    if rubric_item.type == "CHECKBOX":
                        human_bool = human_value
                        backend_bool = backend_result.decision == "check"
                        
                        if human_bool == backend_bool:
                            matches += 1
                        elif human_bool and not backend_bool:
                            false_negatives += 1
                        else:
                            false_positives += 1
                    else:  # RADIO
                        # For radio buttons, compare letters
                        if str(human_value) == backend_result.decision:
                            matches += 1
                        else:
                            false_positives += 1  # Treat all mismatches as false positives for radio
                else:
                    no_data += 1
            
            if confidence_count > 0:
                avg_confidence /= confidence_count
            
            stats.append({
                'rubric': rubric_item.description[:100],
                'type': rubric_item.type,
                'total': total,
                'matches': matches,
                'false_positives': false_positives,
                'false_negatives': false_negatives,
                'no_data': no_data,
                'accuracy': matches / (total - no_data) if (total - no_data) > 0 else 0,
                'avg_confidence': avg_confidence
            })
        
        # Write summary
        headers = ["Rubric Item", "Type", "Total", "Matches", "False Positives", "False Negatives", 
                   "No Data", "Accuracy %", "Avg Confidence %"]
        
        for col, header in enumerate(headers, 1):
            cell = summary_ws.cell(row=1, column=col, value=header)
            cell.font = Font(bold=True)
        
        for row, stat in enumerate(stats, 2):
            summary_ws.cell(row=row, column=1, value=stat['rubric'])
            summary_ws.cell(row=row, column=2, value=stat['type'])
            summary_ws.cell(row=row, column=3, value=stat['total'])
            summary_ws.cell(row=row, column=4, value=stat['matches'])
            summary_ws.cell(row=row, column=5, value=stat['false_positives'])
            summary_ws.cell(row=row, column=6, value=stat['false_negatives'])
            summary_ws.cell(row=row, column=7, value=stat['no_data'])
            summary_ws.cell(row=row, column=8, value=f"{stat['accuracy'] * 100:.1f}")
            summary_ws.cell(row=row, column=9, value=f"{stat['avg_confidence'] * 100:.1f}")
        
        # Adjust column widths
        for col in range(1, 10):
            summary_ws.column_dimensions[get_column_letter(col)].width = 20


class UnifiedExcelReportGenerator:
    """Generates unified Excel reports combining multiple CSV evaluations."""
    
    def __init__(self):
        self.wb = None
    
    def create_unified_report(
        self,
        project_name: str,
        all_evaluation_data: List[Dict],
        output_path: Path
    ):
        """Create unified Excel report with separate sheets for each CSV and combined summary."""
        
        self.wb = openpyxl.Workbook()
        # Remove default sheet
        default_sheet = self.wb.active
        self.wb.remove(default_sheet)
        
        # Define styles
        header_fill = PatternFill(start_color="366092", end_color="366092", fill_type="solid")
        header_font = Font(color="FFFFFF", bold=True)
        match_fill = PatternFill(start_color="C6EFCE", end_color="C6EFCE", fill_type="solid")  # Green
        false_positive_fill = PatternFill(start_color="FFC7CE", end_color="FFC7CE", fill_type="solid")  # Light red
        false_negative_fill = PatternFill(start_color="FFEB9C", end_color="FFEB9C", fill_type="solid")  # Yellow
        border = Border(
            left=Side(style='thin'),
            right=Side(style='thin'),
            top=Side(style='thin'),
            bottom=Side(style='thin')
        )
        
        # Create sheet for each CSV evaluation
        for eval_data in all_evaluation_data:
            csv_name = eval_data['csv_name']
            rubric_items = eval_data['rubric_items']
            human_grades = eval_data['human_grades']
            backend_results = eval_data['backend_results']
            
            # Create sheet (truncate name if too long for Excel)
            sheet_name = csv_name[:31] if len(csv_name) > 31 else csv_name
            ws = self.wb.create_sheet(title=sheet_name)
            
            # Create headers
            headers = ["Submission ID", "Student Name"]
            for rubric_item in rubric_items:
                headers.append(rubric_item.description)  # Full description
                headers.append("Backend Decision")
                headers.append("Confidence %")
                headers.append("Comment")
                headers.append("Match?")
            
            # Write headers
            for col, header in enumerate(headers, 1):
                cell = ws.cell(row=1, column=col, value=header)
                cell.fill = header_fill
                cell.font = header_font
                cell.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
                cell.border = border
            
            # Process each student
            row_idx = 2
            for submission_id, student_grade in human_grades.items():
                # Basic info
                ws.cell(row=row_idx, column=1, value=submission_id).border = border
                ws.cell(row=row_idx, column=2, value=student_grade.name).border = border
                
                # Get backend results for this student
                student_backend_results = backend_results.get(submission_id, [])
                backend_by_rubric = {r.rubric_id: r for r in student_backend_results}
                
                col_idx = 3
                for rubric_item in rubric_items:
                    # Human grade
                    human_value = student_grade.grades.get(rubric_item.id, False)
                    
                    if rubric_item.type == "CHECKBOX":
                        human_cell = ws.cell(row=row_idx, column=col_idx, value="TRUE" if human_value else "FALSE")
                    else:  # RADIO
                        human_cell = ws.cell(row=row_idx, column=col_idx, value=str(human_value))
                    human_cell.border = border
                    
                    # Backend result
                    backend_result = backend_by_rubric.get(rubric_item.id)
                    
                    if backend_result:
                        if rubric_item.type == "CHECKBOX":
                            backend_value = "TRUE" if backend_result.decision == "check" else "FALSE"
                        else:  # RADIO
                            backend_value = backend_result.decision
                        
                        backend_cell = ws.cell(row=row_idx, column=col_idx + 1, value=backend_value)
                        confidence_cell = ws.cell(row=row_idx, column=col_idx + 2, value=f"{backend_result.confidence * 100:.1f}")
                        comment_cell = ws.cell(row=row_idx, column=col_idx + 3, value=backend_result.comment)
                        
                        # Check if match
                        if rubric_item.type == "CHECKBOX":
                            human_bool = human_value
                            backend_bool = backend_result.decision == "check"
                            match = human_bool == backend_bool
                            
                            if match:
                                match_text = "MATCH"
                                fill = match_fill
                            elif human_bool and not backend_bool:
                                match_text = "FALSE NEGATIVE"
                                fill = false_negative_fill
                            else:
                                match_text = "FALSE POSITIVE"
                                fill = false_positive_fill
                        else:  # RADIO
                            # For radio buttons, compare letters
                            match = str(human_value) == backend_result.decision
                            match_text = "MATCH" if match else "MISMATCH"
                            fill = match_fill if match else false_positive_fill
                        
                        match_cell = ws.cell(row=row_idx, column=col_idx + 4, value=match_text)
                        
                        # Apply formatting
                        for cell in [human_cell, backend_cell, match_cell]:
                            cell.fill = fill
                            cell.border = border
                        
                        confidence_cell.border = border
                        comment_cell.border = border
                        comment_cell.alignment = Alignment(wrap_text=True)
                    else:
                        # No backend result
                        ws.cell(row=row_idx, column=col_idx + 1, value="N/A").border = border
                        ws.cell(row=row_idx, column=col_idx + 2, value="N/A").border = border
                        ws.cell(row=row_idx, column=col_idx + 3, value="No result").border = border
                        ws.cell(row=row_idx, column=col_idx + 4, value="NO DATA").border = border
                    
                    col_idx += 5
                
                row_idx += 1
            
            # Adjust column widths
            for col in range(1, ws.max_column + 1):
                ws.column_dimensions[get_column_letter(col)].width = 15
        
        # Create comprehensive summary sheet
        self.create_comprehensive_summary_sheet(all_evaluation_data)
        
        # Save the workbook
        self.wb.save(output_path)
    
    def create_comprehensive_summary_sheet(self, all_evaluation_data: List[Dict]):
        """Create a comprehensive summary sheet combining all CSV evaluations."""
        
        summary_ws = self.wb.create_sheet("COMPREHENSIVE_SUMMARY", 0)  # Make it the first sheet
        
        # Calculate combined statistics
        all_stats = []
        
        for eval_data in all_evaluation_data:
            csv_name = eval_data['csv_name']
            rubric_items = eval_data['rubric_items']
            human_grades = eval_data['human_grades']
            backend_results = eval_data['backend_results']
            
            for rubric_item in rubric_items:
                total = 0
                matches = 0
                false_positives = 0
                false_negatives = 0
                no_data = 0
                avg_confidence = 0
                confidence_count = 0
                
                for submission_id, student_grade in human_grades.items():
                    total += 1
                    human_value = student_grade.grades.get(rubric_item.id, False)
                    
                    backend_results_student = backend_results.get(submission_id, [])
                    backend_result = next((r for r in backend_results_student if r.rubric_id == rubric_item.id), None)
                    
                    if backend_result:
                        avg_confidence += backend_result.confidence
                        confidence_count += 1
                        
                        if rubric_item.type == "CHECKBOX":
                            human_bool = human_value
                            backend_bool = backend_result.decision == "check"
                            
                            if human_bool == backend_bool:
                                matches += 1
                            elif human_bool and not backend_bool:
                                false_negatives += 1
                            else:
                                false_positives += 1
                        else:  # RADIO
                            # For radio buttons, compare letters
                            if str(human_value) == backend_result.decision:
                                matches += 1
                            else:
                                false_positives += 1  # Treat all mismatches as false positives for radio
                    else:
                        no_data += 1
                
                if confidence_count > 0:
                    avg_confidence /= confidence_count
                
                all_stats.append({
                    'csv_name': csv_name,
                    'rubric': rubric_item.description,
                    'type': rubric_item.type,
                    'total': total,
                    'matches': matches,
                    'false_positives': false_positives,
                    'false_negatives': false_negatives,
                    'no_data': no_data,
                    'accuracy': matches / (total - no_data) if (total - no_data) > 0 else 0,
                    'avg_confidence': avg_confidence
                })
        
        # Write comprehensive summary
        headers = ["CSV File", "Rubric Item", "Type", "Total", "Matches", "False Positives", 
                   "False Negatives", "No Data", "Accuracy %", "Avg Confidence %"]
        
        for col, header in enumerate(headers, 1):
            cell = summary_ws.cell(row=1, column=col, value=header)
            cell.font = Font(bold=True)
            cell.fill = PatternFill(start_color="366092", end_color="366092", fill_type="solid")
            cell.font = Font(color="FFFFFF", bold=True)
        
        for row, stat in enumerate(all_stats, 2):
            summary_ws.cell(row=row, column=1, value=stat['csv_name'])
            summary_ws.cell(row=row, column=2, value=stat['rubric'])
            summary_ws.cell(row=row, column=3, value=stat['type'])
            summary_ws.cell(row=row, column=4, value=stat['total'])
            summary_ws.cell(row=row, column=5, value=stat['matches'])
            summary_ws.cell(row=row, column=6, value=stat['false_positives'])
            summary_ws.cell(row=row, column=7, value=stat['false_negatives'])
            summary_ws.cell(row=row, column=8, value=stat['no_data'])
            summary_ws.cell(row=row, column=9, value=f"{stat['accuracy'] * 100:.1f}")
            summary_ws.cell(row=row, column=10, value=f"{stat['avg_confidence'] * 100:.1f}")
        
        # Adjust column widths for summary
        for col in range(1, 11):
            summary_ws.column_dimensions[get_column_letter(col)].width = 20
        
        # Add overall project statistics at the top after some empty rows
        summary_ws.insert_rows(1, 5)
        
        # Calculate overall project stats
        total_evaluations = sum(stat['total'] for stat in all_stats)
        total_matches = sum(stat['matches'] for stat in all_stats)
        total_false_positives = sum(stat['false_positives'] for stat in all_stats)
        total_false_negatives = sum(stat['false_negatives'] for stat in all_stats)
        total_no_data = sum(stat['no_data'] for stat in all_stats)
        
        overall_accuracy = total_matches / (total_evaluations - total_no_data) if (total_evaluations - total_no_data) > 0 else 0
        overall_confidence = sum(stat['avg_confidence'] * stat['total'] for stat in all_stats) / total_evaluations if total_evaluations > 0 else 0
        
        # Write project overview
        summary_ws.cell(row=1, column=1, value="PROJECT OVERVIEW").font = Font(bold=True, size=14)
        summary_ws.cell(row=2, column=1, value=f"Total Evaluations: {total_evaluations}")
        summary_ws.cell(row=2, column=3, value=f"Overall Accuracy: {overall_accuracy * 100:.1f}%")
        summary_ws.cell(row=3, column=1, value=f"Total Matches: {total_matches}")
        summary_ws.cell(row=3, column=3, value=f"Overall Confidence: {overall_confidence * 100:.1f}%")
        summary_ws.cell(row=4, column=1, value=f"False Positives: {total_false_positives}")
        summary_ws.cell(row=4, column=3, value=f"False Negatives: {total_false_negatives}")


async def evaluate_project(
    project_path: Path,
    backend_client: BackendClient,
    num_students: int,
    output_dir: Path
) -> None:
    """Evaluate a single project."""
    
    print(f"\nEvaluating project: {project_path.name}")
    
    grades_dir = project_path / "grades"
    assignments_dir = project_path / "assignments"
    
    if not grades_dir.exists() or not assignments_dir.exists():
        print(f"Skipping {project_path.name}: missing grades or assignments directory")
        return
    
    # Get all CSV files
    csv_files = list(grades_dir.glob("*.csv"))
    if not csv_files:
        print(f"No CSV files found in {grades_dir}")
        return
    
    # Collect all evaluation data for unified report
    all_evaluation_data = []
    
    # Process each CSV file
    for csv_file in csv_files:
        print(f"  Processing {csv_file.name}")
        
        # Parse CSV
        parser = CSVParser()
        rubric_items, human_grades = parser.parse_rubric_from_csv(csv_file)
        
        print(f"    Found {len(rubric_items)} rubric items and {len(human_grades)} students")
        
        # Select students to evaluate (randomly sampled)
        all_student_ids = list(human_grades.keys())
        if len(all_student_ids) <= num_students:
            student_ids = all_student_ids
            print(f"    Using all {len(student_ids)} available students")
        else:
            student_ids = random.sample(all_student_ids, num_students)
            print(f"    Randomly selected {len(student_ids)} students from {len(all_student_ids)} available")
        
        # Collect backend results
        backend_results = {}
        
        for idx, student_id in enumerate(student_ids):
            print(f"    Evaluating student {idx + 1}/{len(student_ids)}: {student_id}")
            
            # Load student files
            submission_dir = assignments_dir / f"submission_{student_id}"
            if not submission_dir.exists():
                print(f"      Submission directory not found: {submission_dir}")
                continue
            
            # Read and filter source files (same logic as Chrome extension)
            source_files = {}
            for file_path in submission_dir.rglob("*"):
                if file_path.is_file():
                    try:
                        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                            relative_path = file_path.relative_to(submission_dir)
                            content = f.read()
                            
                            # Apply same filtering logic as Chrome extension
                            processed_content = CSVParser.process_file_content(str(relative_path), content)
                            if processed_content is not None:  # None means file was filtered out
                                source_files[str(relative_path)] = processed_content
                    except Exception as e:
                        print(f"      Error reading {file_path}: {e}")
            
            if not source_files:
                print(f"      No source files found for {student_id}")
                continue
            
            # Prepare rubric items for backend
            backend_rubric_items = []
            for rubric_item in rubric_items:
                item_dict = {
                    "id": rubric_item.id,
                    "description": rubric_item.description,
                    "points": rubric_item.points,
                    "type": rubric_item.type
                }
                if rubric_item.options:
                    # Convert letter-based options to backend format
                    if rubric_item.type == "RADIO":
                        # Options are in format: {"Q": {"text": "...", "points": "..."}, "W": {...}}
                        # Backend expects: {"Q": "option text", "W": "option text"}
                        backend_options = {}
                        for letter, option_data in rubric_item.options.items():
                            if isinstance(option_data, dict) and 'text' in option_data:
                                backend_options[letter] = option_data['text']
                            else:
                                # Fallback for old format
                                backend_options[letter] = str(option_data)
                        item_dict["options"] = backend_options
                    else:
                        item_dict["options"] = rubric_item.options
                backend_rubric_items.append(item_dict)
            
            # Send to backend
            assignment_context = {
                "course_id": project_path.name,
                "assignment_id": csv_file.stem,
                "submission_id": student_id,
                "assignment_name": f"{project_path.name} - {csv_file.stem}"
            }
            
            try:
                results = await backend_client.grade_submission(
                    assignment_context=assignment_context,
                    source_files=source_files,
                    rubric_items=backend_rubric_items
                )
                backend_results[student_id] = results
            except Exception as e:
                print(f"      Error from backend: {e}")
        
        # Filter human grades to only include evaluated students
        evaluated_human_grades = {sid: human_grades[sid] for sid in student_ids if sid in human_grades}
        
        # Store evaluation data for unified report
        evaluation_data = {
            'csv_name': csv_file.stem,
            'rubric_items': rubric_items,
            'human_grades': evaluated_human_grades,
            'backend_results': backend_results
        }
        all_evaluation_data.append(evaluation_data)
        
        print(f"    Completed evaluation for {csv_file.stem}")
    
    # Generate unified report for the entire project
    if all_evaluation_data:
        print(f"  Creating unified report for {project_path.name}")
        unified_report_generator = UnifiedExcelReportGenerator()
        unified_output_path = output_dir / f"{project_path.name}_UNIFIED_evaluation.xlsx"
        
        unified_report_generator.create_unified_report(
            project_name=project_path.name,
            all_evaluation_data=all_evaluation_data,
            output_path=unified_output_path
        )
        
        print(f"  ✅ Unified report saved to: {unified_output_path}")


async def main():
    """Main evaluation function."""
    
    parser = argparse.ArgumentParser(description="Evaluation Dashboard for Grading Backend")
    parser.add_argument(
        "--num-students", "-n",
        type=int,
        default=5,
        help="Number of students to evaluate per assignment (default: 5)"
    )
    parser.add_argument(
        "--backend-url",
        type=str,
        default="http://localhost:8000",
        help="Backend API URL (default: http://localhost:8000)"
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default="evaluation_results",
        help="Output directory for Excel reports (default: evaluation_results)"
    )
    parser.add_argument(
        "--debug", "-d",
        action="store_true",
        help="Enable debug logging to see JSON requests/responses"
    )
    
    args = parser.parse_args()
    
    # Configure logging level based on debug flag
    if args.debug:
        logger.setLevel(logging.DEBUG)
        logger.info("Debug logging enabled - will show detailed JSON requests/responses")
    else:
        logger.setLevel(logging.INFO)
    
    # Create output directory
    output_dir = Path(args.output_dir)
    output_dir.mkdir(exist_ok=True)
    
    # Add timestamp to output directory
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    run_output_dir = output_dir / f"run_{timestamp}"
    run_output_dir.mkdir(exist_ok=True)
    
    print(f"Evaluation Dashboard")
    print(f"===================")
    print(f"Number of students per assignment: {args.num_students}")
    print(f"Backend URL: {args.backend_url}")
    print(f"Output directory: {run_output_dir}")
    
    # Get all project directories (look in eval-data directory)
    eval_data_dir = Path("eval-data")
    if not eval_data_dir.exists():
        # Try parent directory as fallback
        eval_data_dir = Path("../eval-data")
        if not eval_data_dir.exists():
            print(f"Error: eval-data directory not found at {eval_data_dir.absolute()}")
            return
    
    project_dirs = [d for d in eval_data_dir.iterdir() if d.is_dir()]
    print(f"\nFound {len(project_dirs)} projects to evaluate")
    
    # Run evaluations
    async with BackendClient(args.backend_url) as client:
        for project_dir in project_dirs:
            await evaluate_project(
                project_path=project_dir,
                backend_client=client,
                num_students=args.num_students,
                output_dir=run_output_dir
            )
    
    print(f"\nEvaluation complete! Results saved to: {run_output_dir}")
    
    # Create summary report
    print("\nCreating summary report...")
    create_summary_report(run_output_dir)


def create_summary_report(output_dir: Path):
    """Create a summary report across all evaluations."""
    
    summary_data = []
    
    for excel_file in output_dir.glob("*.xlsx"):
        wb = openpyxl.load_workbook(excel_file, read_only=True)
        
        if "Summary" in wb.sheetnames:
            ws = wb["Summary"]
            
            # Read summary data (skip header)
            for row in ws.iter_rows(min_row=2, values_only=True):
                if row[0]:  # Check if rubric item exists
                    summary_data.append({
                        'project': excel_file.stem.split('_evaluation')[0],
                        'rubric': row[0],
                        'type': row[1],
                        'accuracy': float(row[7]) if row[7] else 0,
                        'avg_confidence': float(row[8]) if row[8] else 0,
                        'total': row[2],
                        'matches': row[3],
                        'false_positives': row[4],
                        'false_negatives': row[5]
                    })
        
        wb.close()
    
    # Create summary DataFrame
    if summary_data:
        df = pd.DataFrame(summary_data)
        
        # Calculate overall statistics
        overall_stats = {
            'Overall Accuracy': df['accuracy'].mean(),
            'Overall Confidence': df['avg_confidence'].mean(),
            'Total Evaluations': df['total'].sum(),
            'Total Matches': df['matches'].sum(),
            'Total False Positives': df['false_positives'].sum(),
            'Total False Negatives': df['false_negatives'].sum()
        }
        
        # Save summary
        summary_path = output_dir / "overall_summary.txt"
        with open(summary_path, 'w') as f:
            f.write("Overall Evaluation Summary\n")
            f.write("=========================\n\n")
            
            for key, value in overall_stats.items():
                if 'Accuracy' in key or 'Confidence' in key:
                    f.write(f"{key}: {value:.1f}%\n")
                else:
                    f.write(f"{key}: {value}\n")
            
            f.write("\n\nPer-Project Accuracy:\n")
            f.write("--------------------\n")
            
            project_accuracy = df.groupby('project')['accuracy'].mean()
            for project, accuracy in project_accuracy.items():
                f.write(f"{project}: {accuracy:.1f}%\n")
        
        print(f"Summary report saved to: {summary_path}")


if __name__ == "__main__":
    asyncio.run(main()) 