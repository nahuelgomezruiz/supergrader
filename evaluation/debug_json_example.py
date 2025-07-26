#!/usr/bin/env python3
"""
Debug script to show JSON structure sent to backend without running full evaluation.
"""

import json
import sys
from pathlib import Path
from evaluation_dashboard import CSVParser


def generate_example_json():
    """Generate and print example JSON request payload."""
    
    # Find a CSV file to parse (look in parent directory)
    eval_data_dir = Path("../eval-data")
    
    if not eval_data_dir.exists():
        print("Error: eval-data directory not found")
        print("This script needs to be run from the evaluation directory with eval-data available")
        return
    
    # Find first available CSV file
    csv_file = None
    project_name = None
    for project_dir in eval_data_dir.iterdir():
        if project_dir.is_dir():
            grades_dir = project_dir / "grades"
            if grades_dir.exists():
                csv_files = list(grades_dir.glob("*.csv"))
                if csv_files:
                    csv_file = csv_files[0]
                    project_name = project_dir.name
                    break
    
    if not csv_file:
        print("No CSV files found in eval-data")
        return
    
    print(f"Generating example JSON from: {csv_file}")
    print("=" * 80)
    
    try:
        # Parse CSV to get rubric structure
        parser = CSVParser()
        rubric_items, student_grades = parser.parse_rubric_from_csv(csv_file)
        
        if not student_grades:
            print("No student data found in CSV")
            return
        
        # Get first student for example
        first_student_id = list(student_grades.keys())[0]
        
        # Create example source files (simulated)
        example_source_files = {
            "main.cpp": "#include <iostream>\n#include \"arraylist.h\"\n\nint main() {\n    ArrayList<int> list;\n    list.add(1);\n    list.add(2);\n    std::cout << \"Size: \" << list.size() << std::endl;\n    return 0;\n}",
            "arraylist.h": "#pragma once\n#include <vector>\n\ntemplate<typename T>\nclass ArrayList {\nprivate:\n    std::vector<T> data;\npublic:\n    void add(const T& item);\n    int size() const;\n    T get(int index) const;\n};",
            "arraylist.cpp": "#include \"arraylist.h\"\n\ntemplate<typename T>\nvoid ArrayList<T>::add(const T& item) {\n    data.push_back(item);\n}\n\ntemplate<typename T>\nint ArrayList<T>::size() const {\n    return data.size();\n}\n\ntemplate<typename T>\nT ArrayList<T>::get(int index) const {\n    return data[index];\n}",
            "README.md": "# ArrayList Implementation\n\nThis is a simple ArrayList implementation in C++.\n\n## Features\n- Add elements\n- Get size\n- Access by index"
        }
        
        # Convert rubric items to backend format
        backend_rubric_items = []
        for rubric_item in rubric_items:
            item_dict = {
                "id": rubric_item.id,
                "description": rubric_item.description,
                "points": rubric_item.points,
                "type": rubric_item.type
            }
            if rubric_item.options:
                item_dict["options"] = rubric_item.options
            backend_rubric_items.append(item_dict)
        
        # Create assignment context
        assignment_context = {
            "course_id": project_name,
            "assignment_id": csv_file.stem,
            "submission_id": first_student_id,
            "assignment_name": f"{project_name} - {csv_file.stem}"
        }
        
        # Create complete request JSON
        request_data = {
            "assignment_context": assignment_context,
            "source_files": example_source_files,
            "rubric_items": backend_rubric_items
        }
        
        print("ASSIGNMENT CONTEXT:")
        print(json.dumps(assignment_context, indent=2))
        
        print(f"\nSOURCE FILES ({len(example_source_files)} files):")
        for filename, content in example_source_files.items():
            print(f"  {filename}: {len(content)} characters")
            print(f"    First 100 chars: {repr(content[:100])}")
        
        print(f"\nRUBRIC ITEMS ({len(backend_rubric_items)} items):")
        for i, item in enumerate(backend_rubric_items, 1):
            print(f"  Item {i}:")
            print(f"    {json.dumps(item, indent=6)}")
        
        print("\n" + "="*80)
        print("COMPLETE REQUEST JSON STRUCTURE:")
        print("=" * 80)
        
        # Create a version with truncated source files for readability
        display_request = request_data.copy()
        display_request["source_files"] = {
            filename: f"[{len(content)} characters] {content[:100]}..." if len(content) > 100 
            else content for filename, content in example_source_files.items()
        }
        
        print(json.dumps(display_request, indent=2))
        
        print("\n" + "="*80)
        print("STATISTICS:")
        print("=" * 80)
        print(f"Project: {project_name}")
        print(f"Assignment: {csv_file.stem}")
        print(f"Student ID: {first_student_id}")
        print(f"Source files: {len(example_source_files)}")
        print(f"Total source code characters: {sum(len(content) for content in example_source_files.values())}")
        print(f"Rubric items: {len(backend_rubric_items)}")
        
        checkbox_count = sum(1 for item in backend_rubric_items if item['type'] == 'CHECKBOX')
        radio_count = sum(1 for item in backend_rubric_items if item['type'] == 'RADIO')
        print(f"  - Checkbox items: {checkbox_count}")
        print(f"  - Radio items: {radio_count}")
        
        total_points = sum(item['points'] for item in backend_rubric_items)
        print(f"Total possible points: {total_points}")
        
        
    except Exception as e:
        print(f"Error generating example: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    generate_example_json() 