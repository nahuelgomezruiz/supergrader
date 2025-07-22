# Supergrader - AI-Powered Grading Assistant

**Full TypeScript Chrome Extension** for AI-assisted grading on Gradescope.

✅ **Migration Complete**: Entire codebase migrated from JavaScript to TypeScript with **zero breaking changes**

## 🚀 Quick Start

### Installation

```bash
npm install
```

### Development

```bash
# Build TypeScript files
npm run build

# Watch for changes and rebuild
npm run build:watch

# Run tests
npm test

# Run tests with coverage
npm test:coverage

# Watch tests
npm test:watch
```

## 📁 Project Structure

```
src/
├── gradescope/
│   └── rubric.ts          # Main rubric parsing functionality
tests/
├── rubric.test.ts         # Comprehensive unit tests
├── setup.ts               # Jest test setup
└── jest-matchers.d.ts     # Custom matcher types
```

## 🧪 Testing Rubric Retrieval

The rubric retrieval functionality can be tested on any Gradescope grading page. Follow these steps:

### Prerequisites
1. Load the extension in Chrome (Developer mode)
2. Navigate to a Gradescope grading page: `https://www.gradescope.com/courses/{course_id}/assignments/{assignment_id}/submissions/{submission_id}/grade`

### Testing Methods

#### Method 1: UI Button (Recommended)

1. **Look for the supergrader panel** that appears on the grading page
2. **Click the "📝 Test Rubric" button** (green button next to "🔧 Test File Download")
3. **Watch the progress indicator** and success/error messages
4. **Check the browser console** for detailed rubric structure output

#### Method 2: Console Commands

1. **Open Developer Tools** (F12) and go to the Console tab

2. **Verify Extension Loaded**
   ```javascript
   // Check if supergrader is available
   supergrader
   ```

3. **Test Rubric Retrieval** (Works on ALL Gradescope layouts!)
   ```javascript
   // 🛡️ UNIFIED: Works on all three layout types
   supergrader.testUnifiedRubric();  // Best choice - handles everything
   
   // Button test: Click the "📝 Test Rubric" button in the UI panel
   
   // For structured rubrics - toggle items
   const rubric = supergrader.getRubric();
   supergrader.applyGrade('12345', true);   // select rubric item 12345
   supergrader.applyGrade('12346', false);  // deselect rubric item 12346
   
   // For manual scoring - set numeric score
   supergrader.applyGrade(undefined, undefined, undefined, 85.5); // set score to 85.5

   // Legacy functions (still work)
   await supergrader.testRubric();      // API-based for assignments
   await supergrader.testIframeRubric(); // iframe-based wrapper
   await supergrader.analyzeRubric();   // assignment analysis
   ```

### Expected Output
   The test will log detailed information about:
   - **Question Structure**: Each question with name, parent relationships, and rubric style
   - **Rubric Items**: Individual items with IDs, descriptions, and point values
   - **Reverse Mapping**: Item-to-question lookup table
   - **Analytics**: Question types, point distributions, hierarchy structure
   - **Validation**: Data integrity checks and consistency verification

### Sample Output

**Basic Rubric Test (`supergrader.testRubric()`):**
```
supergrader: Fetching rubric for course 12345, assignment 67890
supergrader: Found 4 questions with 12 total rubric items

Question 1: "Problem 1: Binary Search Tree" (CHECKBOX, parent: none)
  Item 101: "Correct implementation of insert method" (10 pts)
  Item 102: "Proper error handling" (5 pts)
  Item 103: "Good code style and documentation" (3 pts)

Question 2: "Problem 1a: Insert Function" (RADIO, parent: 1)
  Item 201: "Excellent implementation" (0 pts)
  Item 202: "Good implementation with minor issues" (-2 pts)
  Item 203: "Poor implementation" (-5 pts)
```

**Rubric Analysis (`supergrader.analyzeRubric()`):**
```javascript
{
  totalQuestions: 4,
  totalItems: 12,
  questionsByType: { CHECKBOX: 3, RADIO: 1 },
  parentChildRelationships: 2,
  pointsDistribution: { positive: 4, negative: 6, zero: 2 },
  questionHierarchy: [
    {
      id: 1,
      name: "Problem 1: Binary Search Tree",
      children: [
        { id: 2, name: "Problem 1a: Insert Function" },
        { id: 3, name: "Problem 1b: Delete Function" }
      ]
    },
    {
      id: 4,
      name: "Problem 2: Balanced Tree",
      children: []
    }
  ]
}
```

**Item Lookup (`supergrader.getRubricItem(201)`):**
```javascript
{
  item: { id: 201, text: "Good implementation with minor issues", points: -2 },
  question: {
    id: 2,
    name: "Problem 1a: Insert Function",
    parentId: 1,
    rubricStyle: "RADIO"
  }
}
```

**Validation (`supergrader.validateRubricStructure()`):**
```
✅ Rubric structure validation passed
```

### Troubleshooting
- **Error "Missing courseId or assignmentId"**: Make sure you're on a grading page with the correct URL format
- **Network errors**: Check browser network tab for failed API requests
- **Permission errors**: Verify the extension has permissions for Gradescope

## 🔧 Usage

### Basic Usage

```typescript
import { fetchRubricMap } from './src/gradescope/rubric';

const rubricData = await fetchRubricMap(courseId, assignmentId);

// Access question structure
const questions = rubricData.questions;
// {
//   1: {
//     name: "Problem 1",
//     parentId: null,
//     rubricStyle: "CHECKBOX",
//     items: [
//       { id: 101, text: "Correct implementation", points: 10 },
//       { id: 102, text: "Good documentation", points: 5 }
//     ]
//   }
// }

// Fast reverse lookup: rubric item ID → question ID
const questionId = rubricData.itemToQuestion[101]; // Returns: 1
```

## 🏗️ API Reference

### `fetchRubricMap(courseId: number, assignmentId: number)`

**Parameters:**
- `courseId` - Gradescope course ID
- `assignmentId` - Gradescope assignment ID

**Returns:** `Promise<RubricMap>`

```typescript
interface RubricMap {
  questions: { [questionId: number]: QuestionData };
  itemToQuestion: { [rubricItemId: number]: number };
}

interface QuestionData {
  name: string;
  parentId: number | null;
  rubricStyle: "RADIO" | "CHECKBOX";
  items: Array<{ id: number; text: string; points: number }>;
}
```

## 🎯 Features

### ✅ Bullet-Proof Rubric System

- **🛡️ Universal Compatibility**: Handles ALL three Gradescope layout types:
  - **Legacy iframe + structured rubric** (old question pages)
  - **Frameless React + structured rubric** (new question pages)  
  - **Manual scoring interfaces** (free-points input boxes)
- **🎯 Smart Detection**: Automatically detects interface type and chooses optimal method
- **🔄 Interactive Control**: Both structured rubric toggling & manual score setting
- **📝 UI Integration**: Test button + comprehensive console API

### ✅ Core Implementation

- **Hierarchical Questions**: Handles parent/child question relationships
- **Rubric Styles**: Distinguishes between "Select One" (RADIO) and "Select Many" (CHECKBOX) 
- **Smart Caching**: 12-hour cache with Chrome storage integration
- **Performance Optimized**: Batched API requests for large assignments
- **Error Resilient**: Graceful handling of network and storage errors
- **Comprehensive Testing**: 27+ test scenarios covering all layouts

### 🚀 Performance

- **< 3 seconds** for 100-question assignments (warm cache)
- **Batch processing** prevents server overload
- **Intelligent caching** reduces redundant API calls

## 🧪 Testing

### Test Coverage

The test suite covers:
- Basic functionality and data structure parsing
- Parent/child relationship handling  
- RADIO vs CHECKBOX distinction
- Caching behavior (fresh/expired)
- Error handling (network failures, storage errors)
- Performance with large datasets
- Batch processing logic

### Running Tests

```bash
# Run all tests
npm test

# Watch mode for development
npm test:watch

# Generate coverage report
npm test:coverage
```

### Mock Data

Tests use MSW (Mock Service Worker) to simulate Gradescope API responses:
- `/api/v2/courses/{courseId}/assignments/{assignmentId}/questions`
- `/courses/{courseId}/questions/{questionId}/rubric_items.json`

## 📊 Example Data

### Input: Gradescope API Response

**Questions endpoint:**
```json
[
  { "id": 1, "name": "Problem 1", "parent_id": null },
  { "id": 2, "name": "Problem 1a", "parent_id": 1 },
  { "id": 3, "name": "Problem 2", "parent_id": null }
]
```

**Rubric items endpoint:**
```json
{
  "select_one": false,
  "rubric_items": [
    { "id": 101, "description": "Correct implementation", "points": 10 },
    { "id": 102, "description": "Good documentation", "points": 5 }
  ]
}
```

### Output: Parsed Structure

```typescript
{
  questions: {
    1: {
      name: "Problem 1",
      parentId: null, 
      rubricStyle: "CHECKBOX",
      items: [
        { id: 101, text: "Correct implementation", points: 10 },
        { id: 102, text: "Good documentation", points: 5 }
      ]
    },
    2: {
      name: "Problem 1a", 
      parentId: 1,
      rubricStyle: "RADIO",
      items: [...]
    }
  },
  itemToQuestion: {
    101: 1,
    102: 1,
    // ...
  }
}
```

## 🔧 Configuration

### TypeScript

The project uses strict TypeScript configuration with:
- Target: ES2020
- Module: ESNext  
- Strict mode enabled
- Chrome extension types included

### Jest

Test environment configured with:
- ts-jest preset
- jsdom environment
- MSW for API mocking
- whatwg-fetch polyfill

## 📝 Contributing

1. Follow the existing code structure
2. Add tests for new functionality
3. Ensure all tests pass: `npm test`
4. Use TypeScript strict mode
5. Follow existing naming conventions

## 🐛 Troubleshooting

### Common Issues

**Tests failing with "Request is not defined":**
- Ensure `whatwg-fetch` is installed
- Check that `import 'whatwg-fetch'` is in `tests/setup.ts`

**Chrome storage errors:**
- Mock implementations are provided in test setup
- Ensure `@types/chrome` is installed for type definitions

**Build errors:**
- Run `npm run build` to check TypeScript compilation
- Check `tsconfig.json` configuration

## 🚀 Integration with Chrome Extension

This TypeScript module can be integrated into the existing Chrome extension by:

1. Compiling to JavaScript: `npm run build`
2. Including the compiled output in `dist/`
3. Importing in existing extension files:

```javascript
// In content script or background script
import { fetchRubricMap } from './dist/gradescope/rubric.js';
```

---

Built with ❤️ for efficient grading workflows. 