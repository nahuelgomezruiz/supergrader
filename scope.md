# AI Gradescope Grading Extension - Project Scope

_Last updated: 2025-01-27_

## 1. Architecture Overview

```
┌─────────────────┐    ┌──────────────┐    ┌─────────────────┐
│ Chrome Extension│────│ Your Backend │────│ GPT-4o API      │
│ (Content Script)│    │ API Server   │    │                 │
└─────────────────┘    └──────────────┘    └─────────────────┘
         │                       │
         │                       │
         ▼                       ▼
┌─────────────────┐    ┌──────────────┐
│ Gradescope      │    │ Evaluation   │
│ Platform        │    │ Database     │
└─────────────────┘    └──────────────┘
```

## 2. Chrome Extension Components

### 2.1 Manifest V3 Configuration
```json
{
  "manifest_version": 3,
  "name": "AI Gradescope Assistant",
  "version": "1.0",
  "permissions": ["storage", "cookies", "scripting", "activeTab"],
  "host_permissions": ["https://www.gradescope.com/*"],
  "content_scripts": [{
    "matches": ["https://www.gradescope.com/courses/*/assignments/*/submissions/*/grade"],
    "js": ["content.js", "gradescope-api.js", "ui-controller.js"],
    "css": ["styles.css"],
    "run_at": "document_idle"
  }],
  "background": {
    "service_worker": "background.js"
  },
  "action": {
    "default_popup": "popup.html"
  }
}
```

### 2.2 Core Extension Files

#### **content.js** - Main orchestrator
- Detects when user is on grading page
- Extracts course/assignment/submission IDs from URL
- Coordinates data collection and AI interaction
- Manages UI state and uncertainty notifications

#### **gradescope-api.js** - Gradescope integration
- Handles authentication (CSRF tokens, session cookies)
- Downloads source files via ZIP endpoint
- Extracts rubric structure from DOM
- Executes grading actions (tick/untick, add comments)
- Implements rate limiting (≤10 concurrent, ≤100/min)

#### **ui-controller.js** - User interface
- Adds AI grading panel to Gradescope UI
- Shows progress indicators during AI processing
- Displays uncertainty warnings with specific rubric items
- Provides manual override controls

## 3. Data Collection & Processing

### 3.1 Source Code Extraction
```javascript
async function extractSubmissionData(submissionId) {
  const zipUrl = `/submissions/${submissionId}/zip_download`;
  const response = await fetch(zipUrl, {credentials: 'include'});
  const zipBlob = await response.blob();
  
  // Use JSZip to parse files
  const zip = await JSZip.loadAsync(zipBlob);
  const sourceFiles = {};
  
  for (const [path, file] of Object.entries(zip.files)) {
    if (/\.(cpp|h|py|java|js|ts)$/i.test(path)) {
      sourceFiles[path] = await file.async('string');
    }
  }
  
  return sourceFiles;
}
```

### 3.2 Rubric Structure Extraction
```javascript
function extractRubricStructure() {
  const rubricItems = [];
  document.querySelectorAll('.rubric-item[data-rubric-item-id]').forEach(item => {
    const itemId = item.dataset.rubricItemId;
    const description = item.querySelector('.rubric-description').textContent;
    const points = parseFloat(item.querySelector('.points').textContent);
    const category = item.closest('.question-section').dataset.questionId;
    
    rubricItems.push({
      id: itemId,
      description: description.trim(),
      points,
      category,
      currentlySelected: item.querySelector('input').checked
    });
  });
  
  return rubricItems;
}
```

## 4. Backend API Design

### 4.1 Grading Endpoint
```
POST /api/grade-submission
Content-Type: application/json

{
  "assignment_context": {
    "course_id": "12345",
    "assignment_id": "67890",
    "assignment_name": "Programming Assignment 1",
    "instructions": "Implement a binary search tree..."
  },
  "source_files": {
    "main.cpp": "...",
    "tree.h": "...",
    "tree.cpp": "..."
  },
  "rubric_items": [
    {
      "id": "RbA3C2",
      "description": "Proper error handling for edge cases",
      "points": -2,
      "category": "correctness"
    }
  ],
  "student_metadata": {
    "submission_id": "424242",
    "anonymized_id": "student_xyz"  // No real names for FERPA compliance
  }
}
```

### 4.2 Response Format
```json
{
  "grading_decisions": [
    {
      "rubric_item_id": "RbA3C2",
      "should_deduct": true,
      "confidence": 0.92,
      "reasoning": "No null pointer checks in insert() method",
      "code_locations": [
        {"file": "tree.cpp", "line_start": 45, "line_end": 47}
      ],
      "comment": "Add null pointer validation before dereferencing"
    }
  ],
  "overall_confidence": 0.87,
  "uncertain_items": ["RbB1X4"],  // Items with confidence < 0.8
  "processing_time_ms": 3240
}
```

## 5. AI Integration & Prompt Engineering

### 5.1 GPT-4o System Prompt Template
```
You are an expert programming instructor grading student code submissions. 

ASSIGNMENT CONTEXT:
- Course: {{course_name}}
- Assignment: {{assignment_name}}
- Instructions: {{assignment_instructions}}

RUBRIC ITEMS:
{{#each rubric_items}}
- {{description}} ({{points}} points)
{{/each}}

STUDENT CODE:
{{#each source_files}}
File: {{filename}}
```{{language}}
{{content}}
```
{{/each}}

For each rubric item, determine:
1. Should points be deducted? (true/false)
2. Your confidence level (0.0 to 1.0)
3. Brief reasoning
4. Specific code locations if applicable
5. Constructive comment for student

Be consistent with typical TA grading standards. Focus on:
- Correctness and functionality
- Code quality and style
- Error handling
- Edge cases
- Performance considerations

Return your assessment in the specified JSON format.
```

### 5.2 Confidence Calibration
- Use few-shot examples from your evaluation dataset
- Implement confidence calibration based on historical accuracy
- Track model confidence vs. actual TA agreement rates

## 6. Uncertainty Handling System

### 6.1 UI Uncertainty Indicators
```javascript
function showUncertaintyWarnings(uncertainItems, rubricItems) {
  const warningPanel = document.createElement('div');
  warningPanel.className = 'ai-uncertainty-panel';
  warningPanel.innerHTML = `
    <div class="warning-header">
      ⚠️ AI Uncertain About ${uncertainItems.length} Item(s)
    </div>
    <div class="uncertain-items">
      ${uncertainItems.map(itemId => {
        const item = rubricItems.find(r => r.id === itemId);
        return `<div class="uncertain-item" data-item-id="${itemId}">
          "${item.description}" - Please review manually
        </div>`;
      }).join('')}
    </div>
  `;
  
  document.querySelector('.rubric-container').prepend(warningPanel);
}
```

### 6.2 Confidence Threshold Logic
- **High confidence (≥0.9)**: Auto-apply with minimal UI indication
- **Medium confidence (0.8-0.89)**: Apply but highlight for review
- **Low confidence (<0.8)**: Flag as uncertain, require manual review

## 7. Evaluation System

### 7.1 Data Collection for Evals
```javascript
async function collectEvaluationData(courseId, assignmentId) {
  // Export all submissions for the assignment
  const exportUrl = `/courses/${courseId}/assignments/${assignmentId}/export_submissions`;
  const gradebookUrl = `/courses/${courseId}/gradebook.csv`;
  
  // Parse human grading decisions
  const humanGrades = await parseGradebookData(gradebookUrl);
  
  return {
    assignment_id: assignmentId,
    human_grading_decisions: humanGrades,
    export_timestamp: new Date().toISOString()
  };
}
```

### 7.2 Accuracy Metrics
- **Rubric Item Agreement**: Percentage of rubric items where AI matches human TA
- **Point Accuracy**: Mean absolute error in final scores
- **False Positive Rate**: AI deductions that human TAs didn't make
- **False Negative Rate**: Human deductions that AI missed
- **Comment Quality**: Semantic similarity scores for AI vs. human comments

### 7.3 Continuous Learning Pipeline
```python
# Backend evaluation service
def evaluate_ai_performance(assignment_id, ai_decisions, human_decisions):
    metrics = {
        'item_agreement': calculate_item_agreement(ai_decisions, human_decisions),
        'score_mae': calculate_score_error(ai_decisions, human_decisions),
        'false_positive_rate': calculate_fp_rate(ai_decisions, human_decisions),
        'false_negative_rate': calculate_fn_rate(ai_decisions, human_decisions)
    }
    
    # Store for model improvement
    store_evaluation_results(assignment_id, metrics)
    
    return metrics
```

## 8. Security & Privacy Considerations

### 8.1 FERPA Compliance
- Strip all student identifying information before sending to AI
- Use anonymized IDs consistently
- Implement data retention policies
- Provide opt-out mechanisms

### 8.2 Rate Limiting & Reliability
- Implement exponential backoff for API failures
- Queue requests during high usage
- Graceful degradation when backend is unavailable
- Local caching for rubric structures

### 8.3 Audit Trail
- Log all AI decisions with timestamps
- Track manual overrides for improvement
- Maintain version history of grading decisions

---

# 9. DETAILED IMPLEMENTATION PHASES

## Phase 1: MVP Foundation (4 weeks)

### Week 1: Chrome Extension Setup
**Deliverables:**
- ✅ Basic Chrome extension with Manifest V3
- ✅ Content script that detects Gradescope grading pages
- ✅ Basic UI injection into Gradescope interface

**Specific Tasks:**
1. **Day 1-2: Project Setup**
   - Initialize Chrome extension project structure
   - Create manifest.json with required permissions
   - Set up development environment and hot-reload
   - Test extension loads on Gradescope pages

2. **Day 3-4: Content Script Foundation**
   - Implement URL pattern matching for grading pages
   - Extract course_id, assignment_id, submission_id from URL
   - Create basic DOM injection point for AI controls
   - Add extension icon and basic popup

3. **Day 5: Authentication Handling**
   - Extract CSRF tokens from page meta tags
   - Validate session cookie presence
   - Implement basic error handling for auth failures

**Success Criteria:**
- Extension loads on Gradescope grading pages without errors
- Can extract basic page identifiers
- UI elements appear in Gradescope interface

### Week 2: Gradescope API Integration
**Deliverables:**
- ✅ Source code extraction via ZIP download
- ✅ Rubric structure parsing from DOM
- ✅ Basic API interaction with Gradescope endpoints

**Specific Tasks:**
1. **Day 1-2: Source Code Extraction**
   - Implement ZIP download from `/submissions/{id}/zip_download`
   - Integrate JSZip library for file parsing
   - Filter and extract supported file types (.cpp, .py, .java, etc.)
   - Handle encoding issues and binary files

2. **Day 3-4: Rubric Parsing**
   - Parse rubric items from DOM using selectors
   - Extract rubric item IDs, descriptions, and point values
   - Map rubric items to question categories
   - Handle different rubric types (checkboxes, radio buttons)

3. **Day 5: API Testing**
   - Test rubric item toggle endpoint
   - Validate CSRF token usage
   - Implement basic error handling and retries
   - Create test data fixtures

**Success Criteria:**
- Can download and parse source files from any submission
- Successfully extracts rubric structure
- Can programmatically toggle rubric items

### Week 3: Backend API Development
**Deliverables:**
- ✅ Backend API server with grading endpoint
- ✅ GPT-4o integration for code analysis
- ✅ Basic prompt engineering for grading

**Specific Tasks:**
1. **Day 1-2: API Server Setup**
   - Initialize Node.js/Express or Python/FastAPI backend
   - Create `/api/grade-submission` endpoint
   - Implement request validation and sanitization
   - Set up environment configuration for OpenAI API

2. **Day 3-4: GPT-4o Integration**
   - Implement OpenAI API client
   - Create initial system prompt template
   - Handle API rate limits and errors
   - Implement response parsing and validation

3. **Day 5: Prompt Engineering**
   - Design rubric-specific prompting strategy
   - Test prompt effectiveness with sample code
   - Implement confidence scoring methodology
   - Create fallback responses for API failures

**Success Criteria:**
- Backend API accepts grading requests
- Successfully calls GPT-4o with formatted prompts
- Returns structured grading decisions

### Week 4: MVP Integration
**Deliverables:**
- ✅ End-to-end grading workflow
- ✅ Basic uncertainty handling (80% threshold)
- ✅ Manual override capabilities

**Specific Tasks:**
1. **Day 1-2: Integration Layer**
   - Connect Chrome extension to backend API
   - Implement request/response handling
   - Add loading states and progress indicators
   - Handle network errors and timeouts

2. **Day 3: Uncertainty Handling**
   - Implement confidence threshold checking
   - Create UI warnings for uncertain items
   - Add manual review prompts
   - Track uncertain items for later analysis

3. **Day 4-5: Testing & Polish**
   - End-to-end testing with real Gradescope submissions
   - Bug fixes and error handling improvements
   - Basic user documentation
   - Performance optimization

**Success Criteria:**
- Complete grading workflow from extension to Gradescope
- Uncertainty warnings appear for low-confidence items
- Manual overrides work correctly

---

## Phase 2: Enhanced Features (3 weeks)

### Week 5: Advanced UI Development
**Deliverables:**
- ✅ Comprehensive progress indicators
- ✅ Enhanced uncertainty visualization
- ✅ Improved user controls

**Specific Tasks:**
1. **Day 1-2: Progress Indicators**
   - Create multi-step progress bar (Download → Analyze → Apply)
   - Add estimated time remaining
   - Show current processing status
   - Implement cancel functionality

2. **Day 3-4: Uncertainty UI**
   - Design uncertainty warning panel
   - Highlight uncertain rubric items in different color
   - Add confidence percentages to UI
   - Create "Review Required" workflow

3. **Day 5: User Controls**
   - Add "Auto-apply high confidence" toggle
   - Implement "Preview before applying" mode
   - Create settings panel for confidence thresholds
   - Add extension enable/disable per assignment

**Success Criteria:**
- Clear visual feedback throughout grading process
- Users can easily identify and review uncertain items
- Flexible control over automation level

### Week 6: Comment Generation & Code Highlighting
**Deliverables:**
- ✅ Inline code comments for deductions
- ✅ Ace Editor integration for highlighting
- ✅ Comment quality improvements

**Specific Tasks:**
1. **Day 1-2: Comment Generation**
   - Enhance GPT-4o prompt for comment generation
   - Implement `/add_comment` endpoint integration
   - Map AI feedback to specific code lines
   - Handle multi-line comment placement

2. **Day 3-4: Code Highlighting**
   - Integrate with Ace Editor for syntax highlighting
   - Add colored markers for AI-identified issues
   - Implement hover tooltips for quick explanations
   - Create visual indicators for different issue types

3. **Day 5: Comment Quality**
   - Improve prompt engineering for constructive feedback
   - Add comment templates for common issues
   - Implement comment length and tone guidelines
   - Test comment helpfulness with sample code

**Success Criteria:**
- AI generates helpful comments for each deduction
- Code highlighting clearly shows problem areas
- Comments are constructive and educational

### Week 7: Confidence Calibration
**Deliverables:**
- ✅ Improved confidence scoring
- ✅ Historical accuracy tracking
- ✅ Dynamic threshold adjustment

**Specific Tasks:**
1. **Day 1-2: Confidence Metrics**
   - Implement multiple confidence indicators
   - Track prediction certainty vs. actual accuracy
   - Create confidence calibration dataset
   - Add confidence explanation in UI

2. **Day 3-4: Historical Tracking**
   - Store grading decisions and outcomes
   - Track manual override patterns
   - Implement accuracy feedback loop
   - Create confidence score improvements

3. **Day 5: Dynamic Thresholds**
   - Implement adaptive confidence thresholds
   - Adjust thresholds based on assignment type
   - Add per-rubric-item confidence tracking
   - Create threshold recommendation system

**Success Criteria:**
- Confidence scores accurately reflect AI certainty
- System learns from manual corrections
- Automatic threshold optimization improves over time

---

## Phase 3: Production Ready (3 weeks)

### Week 8: Evaluation Framework
**Deliverables:**
- ✅ Evaluation data collection system
- ✅ Accuracy metrics dashboard
- ✅ Performance benchmarking

**Specific Tasks:**
1. **Day 1-2: Data Collection**
   - Implement Gradescope export parsing
   - Create evaluation dataset from human grading
   - Build anonymization pipeline for student data
   - Set up automated data collection workflows

2. **Day 3-4: Metrics Calculation**
   - Implement rubric item agreement calculations
   - Create point accuracy measurement system
   - Build false positive/negative rate tracking
   - Add comment quality scoring (semantic similarity)

3. **Day 5: Dashboard Creation**
   - Build web dashboard for evaluation metrics
   - Create charts for accuracy trends over time
   - Add assignment-specific performance breakdowns
   - Implement alerting for accuracy drops

**Success Criteria:**
- Automated evaluation against human grading data
- Clear metrics showing AI performance
- Dashboard provides actionable insights

### Week 9: Security & Compliance
**Deliverables:**
- ✅ FERPA compliance implementation
- ✅ Security hardening
- ✅ Privacy controls

**Specific Tasks:**
1. **Day 1-2: FERPA Compliance**
   - Strip all student identifying information
   - Implement consistent anonymization
   - Add data retention policies
   - Create opt-out mechanisms for students

2. **Day 3-4: Security Hardening**
   - Implement API authentication/authorization
   - Add request validation and sanitization
   - Encrypt data in transit and at rest
   - Conduct security vulnerability assessment

3. **Day 5: Privacy Controls**
   - Add instructor privacy settings
   - Implement data deletion workflows
   - Create privacy policy and terms of service
   - Add consent mechanisms

**Success Criteria:**
- Full FERPA compliance verified
- Security assessment passes
- Clear privacy controls for users

### Week 10: Performance & Reliability
**Deliverables:**
- ✅ Production performance optimization
- ✅ Error handling and recovery
- ✅ Monitoring and alerting

**Specific Tasks:**
1. **Day 1-2: Performance Optimization**
   - Optimize API response times
   - Implement caching for rubric structures
   - Add request queuing for high load
   - Minimize extension memory footprint

2. **Day 3-4: Reliability Improvements**
   - Implement exponential backoff for failures
   - Add circuit breaker patterns
   - Create graceful degradation modes
   - Build comprehensive error recovery

3. **Day 5: Monitoring Setup**
   - Add application performance monitoring
   - Implement error tracking and alerting
   - Create uptime monitoring
   - Set up log aggregation and analysis

**Success Criteria:**
- Sub-5-second response times for typical requests
- 99.9% uptime with graceful failure handling
- Comprehensive monitoring covers all critical paths

---

## Phase 4: Advanced Features (4 weeks)

### Week 11-12: Custom Model Training
**Deliverables:**
- ✅ Fine-tuning pipeline for GPT models
- ✅ Assignment-specific model adaptation
- ✅ Continuous learning implementation

**Specific Tasks:**
1. **Week 11 Day 1-3: Fine-tuning Infrastructure**
   - Set up OpenAI fine-tuning pipeline
   - Create training data preparation scripts
   - Implement model evaluation framework
   - Design A/B testing for model comparison

2. **Week 11 Day 4-5: Training Data Pipeline**
   - Build automated training data generation
   - Implement human feedback collection
   - Create data quality validation
   - Add training/validation/test splits

3. **Week 12 Day 1-3: Model Deployment**
   - Implement custom model serving
   - Create model version management
   - Add rollback capabilities
   - Build performance comparison tools

4. **Week 12 Day 4-5: Continuous Learning**
   - Implement online learning feedback loops
   - Create automated retraining triggers
   - Add model drift detection
   - Build continuous evaluation pipelines

**Success Criteria:**
- Custom models outperform base GPT-4o on evaluation metrics
- Automated retraining improves performance over time
- Model deployment and rollback processes work reliably

### Week 13: Advanced Uncertainty Quantification
**Deliverables:**
- ✅ Multi-model ensemble predictions
- ✅ Uncertainty decomposition analysis
- ✅ Predictive uncertainty indicators

**Specific Tasks:**
1. **Day 1-2: Ensemble Methods**
   - Implement multiple model predictions
   - Create ensemble voting mechanisms
   - Add uncertainty aggregation across models
   - Build consensus-based confidence scoring

2. **Day 3-4: Uncertainty Analysis**
   - Decompose uncertainty into epistemic/aleatoric
   - Analyze uncertainty by rubric item type
   - Create uncertainty pattern recognition
   - Implement uncertainty-aware active learning

3. **Day 5: Predictive Indicators**
   - Build uncertainty prediction models
   - Create early warning systems for difficult cases
   - Implement proactive manual review suggestions
   - Add uncertainty trend analysis

**Success Criteria:**
- Ensemble predictions improve accuracy over single models
- Uncertainty quantification helps prioritize manual review
- Predictive uncertainty reduces wasted manual effort

### Week 14: Multi-Assignment Integration
**Deliverables:**
- ✅ Support for different assignment types
- ✅ Cross-assignment learning
- ✅ Assignment template system

**Specific Tasks:**
1. **Day 1-2: Assignment Type Support**
   - Extend support to written assignments, math problems
   - Add support for different programming languages
   - Create assignment type detection
   - Build type-specific grading strategies

2. **Day 3-4: Cross-Assignment Learning**
   - Implement knowledge transfer between assignments
   - Create shared rubric item libraries
   - Build assignment similarity detection
   - Add progressive difficulty adaptation

3. **Day 5: Template System**
   - Create reusable assignment templates
   - Build template sharing between instructors
   - Implement template versioning and updates
   - Add template performance analytics

**Success Criteria:**
- Extension works across multiple assignment types
- Learning from previous assignments improves new assignment grading
- Template system reduces setup time for instructors

---

## 10. Testing Strategy

### 10.1 Unit Testing
- Chrome extension API interactions
- Gradescope endpoint parsing
- AI response processing

### 10.2 Integration Testing
- End-to-end grading workflows
- Error handling and recovery
- Rate limiting behavior

### 10.3 User Testing
- TA acceptance testing
- Instructor feedback sessions
- Student privacy impact assessment

## 11. Success Metrics

### Technical Metrics
- **Response Time**: < 5 seconds for typical grading requests
- **Accuracy**: > 85% agreement with human TAs on rubric items
- **Uptime**: 99.9% availability during grading periods
- **Error Rate**: < 1% of requests result in unhandled errors

### User Experience Metrics
- **Adoption Rate**: > 70% of TAs use the tool for eligible assignments
- **Time Savings**: > 40% reduction in grading time
- **Satisfaction**: > 4.0/5.0 average rating from TA feedback
- **Manual Override Rate**: < 20% of AI decisions manually changed

### Business Metrics
- **Grading Consistency**: Reduced variance in grading between TAs
- **Feedback Quality**: Improved comment helpfulness scores
- **Instructor Adoption**: > 50% of eligible courses use the tool
- **Student Satisfaction**: No decrease in grading satisfaction scores

This comprehensive scope provides specific, actionable steps for each development phase while maintaining focus on the core objectives of accuracy, efficiency, and educational value. 