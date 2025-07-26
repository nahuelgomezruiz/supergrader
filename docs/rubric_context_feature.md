# Rubric Context Enhancement

## Overview

The backend now includes the full rubric section as context when evaluating individual rubric items. This provides the LLM with broader understanding of the assignment's grading criteria while making it clear which specific item to evaluate.

## Key Features

### 1. Full Section Context
- When evaluating any rubric item, the LLM receives the complete rubric section as context
- Ensures consistent evaluation based on the overall rubric structure
- Helps LLM understand relative importance and relationships between criteria

### 2. Clear Task Separation
- Context is clearly marked as "for context only"
- Specific evaluation task is highlighted with "YOUR SPECIFIC TASK"
- Instructions emphasize evaluating only the target item

### 3. Assignment-Specific Rubrics
- Automatically loads the correct rubric files based on `assignment_id`
- Supports mapping from various assignment identifiers to rubric directories
- Caches rubric data for performance

## Implementation Details

### RubricLoaderService

**Location**: `backend/app/services/rubric_loader.py`

**Key Methods**:
- `load_full_rubric_sections(assignment_id)`: Loads all rubric sections for an assignment
- `get_section_for_rubric_item(rubric_item, all_sections)`: Determines which section a rubric item belongs to
- `format_section_context(section_items)`: Formats rubric items into readable context

**Assignment Mapping**:
```python
{
    "hw_arraylists": "hw_arraylists",
    "hw_linkedlists": "hw_linkedlists", 
    "proj_gerp": "proj_gerp",
    "proj_metrosim": "proj_metrosim",
    # ... alternative names also supported
}
```

### Enhanced Prompts

**Checkbox Prompt Structure**:
```
Entire rubric for this section (for context only):
[Full section rubric items with formatting]

YOUR SPECIFIC TASK - Evaluate this single checkbox:
[Target rubric item]

INSTRUCTIONS:
The above rubric section is provided for context only...
```

**Radio Prompt Structure**:
```
Entire rubric for this section (for context only):
[Full section rubric items with formatting]

YOUR SPECIFIC TASK - Evaluate this single radio button:
[Target rubric item with options]

INSTRUCTIONS:  
The above rubric section is provided for context only...
```

### Section Context Format

Rubric items are formatted as:
```
1. Description (points pts) [TYPE]
   Q: Option text
   W: Option text
   [for RADIO items]

2. Description (points pts) [CHECKBOX]
   [for CHECKBOX items]
```

## File Structure

### Rubric Files Location
```
eval-data/
├── hw_arraylists/grades/
│   ├── Functionality_and_Design_Rubric.txt
│   ├── Testing_Rubric.txt
│   └── Style_Organization_and_Documentation_Rubric.txt
├── proj_gerp/grades/
│   ├── Functionality_and_Design_Rubric.txt
│   ├── Testing_Rubric.txt
│   └── Style_Organization_and_Documentation_Rubric.txt
└── [other assignments...]
```

### Rubric File Format
Each file contains JSON objects separated by double newlines:
```json
{
  "id": "rubric_item_1",
  "description": "Item description",
  "points": 3.0,
  "type": "RADIO",
  "options": {
    "Q": "Option 1 text",
    "W": "Option 2 text"
  }
}

{
  "id": "rubric_item_2", 
  "description": "Another item description",
  "points": 2.0,
  "type": "CHECKBOX"
}
```

## Usage

### API Integration
The enhancement is automatically active when using the grading API. No changes required to API requests.

### Section Detection
The system automatically:
1. Loads all rubric sections for the assignment
2. Determines which section each rubric item belongs to
3. Provides the appropriate section context during evaluation

### Caching
- Rubric data is cached per assignment for performance
- Cache is automatically invalidated if files change
- First load per assignment may be slightly slower

## Benefits

### Improved Accuracy
- LLM has full context of grading criteria
- Better understanding of relative standards
- More consistent evaluation across similar items

### Better Feedback
- Comments can reference broader rubric context
- More nuanced evaluation based on assignment scope
- Improved alignment with instructor expectations

### Maintainability  
- Centralized rubric management
- Easy to update assignment mappings
- Clear separation between context and task

## Monitoring

The system logs:
- Rubric loading operations: `📚 Loaded rubric sections for {assignment_id}`
- Section assignment decisions
- File loading errors and warnings
- Cache performance metrics

## Error Handling

- Graceful fallback if rubric files not found
- Empty context if section detection fails
- Comprehensive error logging for debugging
- Assignment mapping warnings for unknown IDs 