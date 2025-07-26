# Grading Evaluation Dashboard

This evaluation dashboard allows you to test the performance of the grading backend by comparing its results against human-graded assignments.

## Features

- **CSV Parsing**: Automatically parses Gradescope CSV files to extract rubric items and human grades
- **Concurrent Batch Processing**: **NEW!** Process multiple students in parallel across different assignments and projects for dramatically improved performance
- **Batch Evaluation**: Evaluate multiple projects and assignments in one run
- **Configurable Sample Size**: Choose how many students to evaluate per assignment
- **Performance Optimization**: Achieve 2-5x speedup with concurrent processing vs sequential evaluation
- **Excel Reports**: Generates detailed Excel reports with:
  - Side-by-side comparison of human vs backend grades
  - Color-coded cells showing matches, false positives, and false negatives
  - Confidence scores and comments from the backend
  - Summary statistics per rubric item and overall accuracy
- **GUI and CLI Options**: Use either the graphical interface or command-line

## Installation

1. Install the required dependencies:
```bash
pip install -r requirements.txt
```

## Usage

### Option 1: GUI Version (Recommended)

Run the GUI application:
```bash
python evaluation/evaluation_gui.py
```

The GUI allows you to:
- Set the number of students to evaluate per assignment
- Configure the backend URL
- Select which projects to evaluate
- Monitor progress in real-time
- View logs of the evaluation process

### Option 2: Command Line

Run from command line with options:
```bash
python evaluation/evaluation_dashboard.py --num-students 10 --backend-url http://localhost:8000
```

Options:
- `--num-students` or `-n`: Number of students to evaluate per assignment (default: 5)
- `--backend-url`: Backend API URL (default: http://localhost:8000)
- `--output-dir`: Output directory for Excel reports (default: evaluation_results)
- `--concurrent-batch-size`: Number of students to process concurrently (default: 20)
- `--use-concurrent`: Enable concurrent batch processing for better performance (default: enabled)
- `--sequential`: Force sequential processing (disables concurrent optimization)

### Performance Optimization

The evaluation dashboard now includes **concurrent batch processing** that dramatically improves evaluation speed:

**Sequential vs Concurrent Performance:**
- **Sequential (old)**: Process students one at a time → 5 students in ~50 seconds
- **Concurrent (new)**: Process 20+ students in parallel → 5 students in ~10 seconds
- **Typical speedup**: 2-5x faster depending on batch size and network conditions

**Example with concurrent processing:**
```bash
# Process with larger concurrent batches for better performance
python evaluation/evaluation_dashboard.py --num-students 50 --concurrent-batch-size 30

# Force sequential processing (if needed for debugging)
python evaluation/evaluation_dashboard.py --sequential
```

**Performance Testing:**
```bash
# Test and compare performance between sequential and concurrent processing
python evaluation/test_concurrent_performance.py --num-students 20
```

## Data Structure

The evaluation dashboard expects the following structure in the `eval-data` directory:

```
eval-data/
├── project_name/
│   ├── assignments/
│   │   ├── submission_12345/
│   │   │   └── (student source files)
│   │   └── submission_67890/
│   │       └── (student source files)
│   └── grades/
│       ├── 2_Functionality_and_Design.csv
│       ├── 3_Testing.csv
│       └── 4_Style_Organization_and_Documentation.csv
```

### CSV Format

The CSV files should follow this format:
- First row: Headers with rubric questions
- Radio questions: Prefixed with `[RADIO N]` where N is the group number
- Last row: Point values for each question
- Data rows: Student grades (TRUE/FALSE for each rubric item)

Example:
```csv
Assignment Submission ID,Name,...,"Question 1","[RADIO 1]Option A","[RADIO 1]Option B",...
12345,John Doe,...,TRUE,FALSE,TRUE,...
67890,Jane Smith,...,FALSE,TRUE,FALSE,...
...
Point Values,,,2,5,3,...
```

## Output

The evaluation generates Excel files with:

### Main Sheet
- **Human Grade**: Original grade from CSV
- **Backend Decision**: What the backend decided
- **Confidence %**: Backend's confidence in its decision
- **Comment**: Feedback comment from backend
- **Match Status**: 
  - MATCH (green): Backend agrees with human
  - FALSE POSITIVE (light red): Backend checked when human didn't
  - FALSE NEGATIVE (yellow): Backend didn't check when human did
  - MISMATCH (light red): For radio buttons when selections differ

### Summary Sheet
- Overall accuracy statistics
- Per-rubric-item accuracy
- Average confidence scores
- False positive/negative rates

## Backend API Format

The dashboard sends requests to the backend in this format:

```json
{
  "assignment_context": {
    "course_id": "project_name",
    "assignment_id": "csv_filename",
    "submission_id": "12345",
    "assignment_name": "Project - Assignment"
  },
  "source_files": {
    "file1.cpp": "// file contents...",
    "file2.h": "// file contents..."
  },
  "rubric_items": [
    {
      "id": "checkbox_8",
      "description": "Proper error handling",
      "points": 2.0,
      "type": "CHECKBOX"
    },
    {
      "id": "radio_1",
      "description": "Code Quality",
      "points": 5.0,
      "type": "RADIO",
      "options": {
        "Excellent": "5",
        "Good": "3",
        "Poor": "0"
      }
    }
  ]
}
```

## Tips

1. **Start Small**: Test with a few students first (e.g., 5) before running larger evaluations
2. **Check Backend**: Ensure your backend is running and accessible at the configured URL
3. **Monitor Progress**: Use the GUI to see real-time progress and catch any errors
4. **Review Results**: Check the Summary sheet first for overall performance metrics

## Troubleshooting

- **"Backend returned status 500"**: Check that your backend is running and the URL is correct
- **"No source files found"**: Ensure submission directories contain the student files
- **"CSV doesn't have enough rows"**: CSV files need at least 4 rows (header + 2 data + points)
- **Timeout errors**: Increase timeout in the code or reduce the number of students 