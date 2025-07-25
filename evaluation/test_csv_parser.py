#!/usr/bin/env python3
"""Test script to verify CSV parsing functionality."""

import sys
from pathlib import Path
from evaluation_dashboard import CSVParser


def test_csv_parsing():
    """Test CSV parsing on available data."""
    
    eval_data_dir = Path("eval-data")
    
    if not eval_data_dir.exists():
        print("Error: eval-data directory not found")
        return
    
    # Find first available CSV file
    csv_file = None
    for project_dir in eval_data_dir.iterdir():
        if project_dir.is_dir():
            grades_dir = project_dir / "grades"
            if grades_dir.exists():
                csv_files = list(grades_dir.glob("*.csv"))
                if csv_files:
                    csv_file = csv_files[0]
                    break
    
    if not csv_file:
        print("No CSV files found in eval-data")
        return
    
    print(f"Testing CSV parser on: {csv_file}")
    print("-" * 80)
    
    try:
        parser = CSVParser()
        rubric_items, student_grades = parser.parse_rubric_from_csv(csv_file)
        
        print(f"\nFound {len(rubric_items)} rubric items:")
        print("-" * 80)
        
        for item in rubric_items[:5]:  # Show first 5
            print(f"\nID: {item.id}")
            print(f"Type: {item.type}")
            print(f"Description: {item.description[:100]}...")
            print(f"Points: {item.points}")
            if item.options:
                print(f"Options: {item.options}")
        
        if len(rubric_items) > 5:
            print(f"\n... and {len(rubric_items) - 5} more rubric items")
        
        print(f"\n\nFound {len(student_grades)} student grades:")
        print("-" * 80)
        
        # Show first 3 students
        for i, (sid, grade) in enumerate(list(student_grades.items())[:3]):
            print(f"\nStudent {i+1}:")
            print(f"  Submission ID: {sid}")
            print(f"  Name: {grade.name}")
            print(f"  Number of grades: {len(grade.grades)}")
            
            # Show first few grades
            grade_items = list(grade.grades.items())[:3]
            for rubric_id, value in grade_items:
                print(f"    {rubric_id}: {value}")
            
            if len(grade.grades) > 3:
                print(f"    ... and {len(grade.grades) - 3} more grades")
        
        if len(student_grades) > 3:
            print(f"\n... and {len(student_grades) - 3} more students")
        
        print("\n\nCSV parsing test completed successfully!")
        
    except Exception as e:
        print(f"Error parsing CSV: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    test_csv_parsing() 