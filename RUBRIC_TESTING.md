# Rubric Retrieval Testing Guide

## ✅ Implementation Status

**FIXED**: Module import issue resolved! The rubric testing functionality is now fully integrated into the working `gradescope-api.js` using dynamic imports.

The `fetchRubricMap` function has been successfully implemented and integrated with the Chrome extension. You can now test the complete rubric retrieval functionality on any Gradescope grading page.

## 🎯 What Gets Tested

The rubric system retrieves and structures:

1. **Question Hierarchy**: Parent-child relationships between questions
2. **Rubric Items**: Individual scoring items with IDs, descriptions, and point values  
3. **Rubric Styles**: CHECKBOX vs RADIO button behavior per question
4. **Reverse Mapping**: Fast lookup from rubric item ID to parent question
5. **Data Integrity**: Validation of all relationships and mappings

## 🚀 Quick Test Methods

### Method 1: UI Button (Week 2 Day 3-4 Implementation)

1. **Load the extension** on any Gradescope grading page
2. **Look for the supergrader panel** (should appear automatically)
3. **Click the green "📝 Test Rubric" button** 
4. **Watch for success message** showing question/item counts
5. **Check console** for detailed rubric structure output

### Method 2: Console Commands

Open any Gradescope grading page, then use these console commands:

```javascript
// Basic test - shows full structure
await supergrader.testRubric();

// Detailed analysis - shows statistics
await supergrader.analyzeRubric();

// Validate data integrity
await supergrader.validateRubricStructure();

// Look up specific item (replace 123 with real ID)
await supergrader.getRubricItem(123);
```

## 📊 Expected Data Structure

### RubricMap Interface
```typescript
{
  questions: {
    [questionId: number]: {
      name: string;                    // "Problem 1: Binary Search Tree"
      parentId: number | null;         // null for top-level, number for subquestions
      rubricStyle: "RADIO" | "CHECKBOX"; // Grading interaction type
      items: Array<{
        id: number;                    // Unique rubric item ID
        text: string;                  // "Correct implementation"
        points: number;                // Point value (positive/negative/zero)
      }>;
    };
  };
  itemToQuestion: {
    [rubricItemId: number]: number;    // Fast reverse lookup
  };
}
```

## ✅ Testing Checklist

### Prerequisites
- [ ] Extension loaded in Chrome Developer Mode
- [ ] On a Gradescope grading page (URL contains `/grade`)
- [ ] Developer Console open (F12)
- [ ] `supergrader` object available in console

### Core Functionality Tests
- [ ] `testRubric()` returns complete rubric data
- [ ] All questions have correct names and parent relationships
- [ ] Rubric items have valid IDs, descriptions, and point values
- [ ] RADIO vs CHECKBOX styles correctly identified
- [ ] Item-to-question reverse mapping works

### Data Validation Tests  
- [ ] `validateRubricStructure()` passes with no issues
- [ ] No orphaned items (items pointing to non-existent questions)
- [ ] No missing reverse mappings
- [ ] Parent-child relationships are consistent

### Performance Tests
- [ ] Initial fetch completes within reasonable time (<10 seconds)
- [ ] Cached retrieval is nearly instant on subsequent calls
- [ ] Large rubrics (10+ questions) handle correctly

## 🔍 Troubleshooting Common Issues

### "Missing courseId or assignmentId"
**Cause**: Not on a grading page or URL format not recognized  
**Solution**: Navigate to: `/courses/{id}/assignments/{id}/submissions/{id}/grade`

### Network/API Errors
**Cause**: Gradescope API endpoint changes or authentication issues  
**Solution**: Check browser Network tab for failed requests, verify login status

### Empty or Partial Results
**Cause**: Page not fully loaded or DOM elements not yet rendered  
**Solution**: Wait for page to load completely, try refreshing extension

### Cache Issues
**Cause**: Stale cached data from previous assignment  
**Solution**: Clear browser storage or wait for 12-hour cache expiration

## 📈 Sample Output Analysis

A typical computer science assignment might show:
- **3-5 questions** (main problems with subparts)
- **15-25 rubric items** total across all questions
- **Mixed rubric styles**: CHECKBOX for deductions, RADIO for quality levels
- **Point distribution**: Mix of positive (completion), negative (errors), zero (quality tiers)
- **2-3 levels** of question hierarchy (Problem → Subpart → Specific aspect)

## 🛠️ Next Steps After Successful Testing

1. **Integration**: Connect rubric data to grading workflow
2. **UI Updates**: Display rubric structure in extension interface  
3. **Backend API**: Send rubric context to AI grading service
4. **Automation**: Use rubric data to apply grading decisions

## 🐛 Found an Issue?

If testing reveals any problems:
1. Note the exact error message and browser console output
2. Record the specific assignment/course where it occurred
3. Check if the issue is consistent across different assignments
4. Verify the Gradescope page structure hasn't changed

The rubric retrieval system is designed to be robust and handle various edge cases, but new assignment types or Gradescope UI changes might require updates. 