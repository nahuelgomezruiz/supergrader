# LLM Prompt Logging Feature

## Overview

The system now logs every prompt sent to the LLM provider and every response received. This provides complete transparency for debugging, prompt engineering, and understanding the AI grading process.

## What Gets Logged

### 1. **Full Prompts**
Every prompt sent to the LLM is printed to the terminal, including:
- Complete rubric section context
- Specific task instructions  
- Student code submissions
- Output format requirements

### 2. **Full Responses** 
Every response from the LLM is printed, showing:
- Raw LLM output before parsing
- JSON responses and any additional text
- Helps debug parsing issues

## Terminal Output Format

### Prompt Logging
```
================================================================================
🤖 PROMPT SENT TO ANTHROPIC (claude-3-5-sonnet-20241022)
================================================================================
You are an expert code grader. Think step‑by‑step **silently**; show only the final JSON.

Entire rubric for this section (for context only):
1. Abstraction (3.0 pts) [RADIO]
   Q: **Abstraction barriers are well-maintained between classes.**
- Primary data structure (e.g., hash table, tries, etc.) and command loop are not in the same class
- Every class has a specific purpose in the implementation, and there is little overlap in the functionality of classes
   W: **Abstraction is attempted, though some modules or classes may violate abstraction barriers.**
- Data structures may be specific to `gerp`, but implementing this decision does not break abstraction.

Ex: The submission may have public functions related to files or line numbers, but underlying structs are still private
   E: No credit.
2. Modularity (3.0 pts) [RADIO]
   Q: **Code exhibits great modularity.**
- Helper functions are used when necessary
- Every function has a specific, singular purpose.
   W: **Small amounts of code might be unnecessarily repeated,** but this does not make the code harder to follow:

- Some functions may be longer in length, but in general reasonable helper functions are present.
   E: **Large sections of code are repeated** or some code is repeated many times, but the code is still readable:
- Some functions might do many things, and it would be appropriate to break them up
- **OR** helper functions are not always called where they might be helpful
   R: No credit.

YOUR SPECIFIC TASK - Evaluate this single checkbox:
Rubric item (CHECKBOX, 2.0 pts):
«Memory management is handled correctly»

Student submission (trimmed):
main.cpp
```cpp
#include <iostream>
#include <memory>

class StudentData {
private:
    std::unique_ptr<int[]> data;
    size_t size;
    
public:
    StudentData(size_t n) : size(n) {
        data = std::make_unique<int[]>(n);
    }
    
    ~StudentData() = default; // unique_ptr handles cleanup
};

int main() {
    StudentData sd(100);
    return 0;
}
```

INSTRUCTIONS:
The above rubric section is provided for context only. Your task is to evaluate ONLY the specific checkbox item shown above.

TASKS – for this single checkbox only:
1. Decide **check** or **uncheck**.
2. Gather the most relevant evidence lines for your decision (file + line range).
3. Draft a short feedback comment explaining your decision (for both check and uncheck).
4. Estimate a confidence percentage (0‑100).

OUTPUT FORMAT (JSON only, no extra text):
```json
{
  "decision": "check" | "uncheck",
  "evidence": { "file": "…", "lines": "start‑end" },
  "comment": "…",
  "confidence": 0‑100
}
```

Remember: think internally first, then output **only** the JSON block.
================================================================================

```

### Response Logging
```
📤 RESPONSE FROM ANTHROPIC
================================================================================
{
  "decision": "check",
  "evidence": { "file": "main.cpp", "lines": "7-15" },
  "comment": "Memory management is handled correctly using std::unique_ptr which automatically manages memory allocation and deallocation. The destructor is properly defaulted since unique_ptr handles cleanup automatically.",
  "confidence": 95
}
================================================================================

```

## Benefits

### 1. **Complete Transparency**
- See exactly what context is provided to the LLM
- Verify that rubric sections are loaded correctly
- Confirm QWERTY ordering in radio buttons
- Check that individual checkboxes from "Select Many" are properly formatted

### 2. **Debugging Support**
- Identify prompt engineering issues
- Debug section context loading problems
- Verify assignment mapping is working
- Check JSON parsing failures

### 3. **Prompt Engineering**
- Optimize prompt structure based on actual output
- Test different context formatting approaches  
- Validate instruction clarity
- Monitor response quality patterns

### 4. **Quality Assurance**
- Verify consistent prompt structure across evaluations
- Check that all rubric items receive appropriate context
- Monitor LLM response format compliance
- Track confidence levels and decision patterns

## Usage

The logging is **automatically active** - no configuration needed:

1. **Start the backend server**
2. **Submit a grading request** via API
3. **Watch the terminal** for prompt/response logs
4. **Each rubric item evaluation** will show its full prompt and response

## Log Volume

### Expected Output
- **Per rubric item**: 2 log blocks (prompt + response)
- **Per parallel LLM call**: Multiple prompt/response pairs (default: 3 calls per item)
- **Per assignment**: Dozens to hundreds of log blocks depending on rubric size

### Example Assignment Volumes
- **Small assignment** (10 rubric items): ~60 log blocks
- **Large assignment** (50 rubric items): ~300 log blocks
- **With parallel calls** (3x): 3x the above numbers

## Performance Impact

### Minimal Impact
- **Terminal output**: Very fast, no significant delay
- **No file I/O**: Logs only to stdout/stderr
- **No network calls**: Pure local logging
- **Memory usage**: Negligible increase

### Benefits vs Costs
- **High debugging value** with **minimal performance cost**
- **Essential for development** and prompt optimization
- **Can be disabled** in production if needed (requires code change)

## Development Workflow

### 1. **Test New Prompts**
```bash
# Start backend with logging
cd backend && python -m uvicorn app.main:app --reload

# Submit test request
# Watch terminal for prompt/response output
# Iterate on prompt design based on actual output
```

### 2. **Debug Issues**
- **Missing context**: Check if rubric sections loaded properly
- **Wrong section**: Verify section detection logic
- **Poor responses**: Analyze prompt clarity and instructions
- **JSON errors**: Check response format compliance

### 3. **Quality Assurance**
- Review actual prompts sent to LLM
- Verify context consistency across items
- Check response quality patterns
- Monitor confidence levels

## Example Development Session

```bash
# Start backend
python -m uvicorn app.main:app --reload

# Terminal shows:
📚 Loaded rubric sections for proj_gerp:
   • Functionality and Design: 2 items
   • Testing: 2 items  
   • Style Organization and Documentation: 13 items

# Submit grading request, see:
================================================================================
🤖 PROMPT SENT TO ANTHROPIC (claude-3-5-sonnet-20241022)
================================================================================
[Full prompt with context]

📤 RESPONSE FROM ANTHROPIC
================================================================================
[JSON response]

# Repeat for each rubric item evaluation...
```

## Configuration

### Current Settings
- **Always enabled**: Logs every prompt and response
- **Full content**: Complete prompts and responses
- **Clear formatting**: Easy to read delimiters
- **Provider info**: Shows which LLM and model used

### Future Options
- Could add environment variable to disable logging
- Could add verbosity levels (summary vs full)
- Could add file output option
- Could add request ID tracking

## Troubleshooting

### Common Issues

**1. No logs appearing**
- Check that you're running the backend locally
- Verify grading requests are being submitted
- Ensure terminal is capturing stdout

**2. Truncated output**
- Terminal buffer may be limited
- Consider redirecting to file: `python -m uvicorn app.main:app > grading.log 2>&1`

**3. Too much output**
- Large assignments generate many logs
- Use terminal search/filtering tools
- Consider processing logs with grep/awk

**4. Encoding issues**
- Ensure terminal supports UTF-8
- Some rubric content may contain special characters 