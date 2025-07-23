# Supergrader Backend API

A modular, clean backend for AI-powered code grading that evaluates student submissions against rubric items.

## Features

- **Modular Architecture**: Clean separation of concerns with dedicated services
- **Parallel LLM Evaluation**: 3 parallel LLM calls per rubric item with majority voting
- **Smart Preprocessing**: Filters and summarizes test files to optimize context window usage
- **Caching**: Redis-based caching for preprocessed submissions
- **Streaming Results**: Server-Sent Events (SSE) for real-time grading progress
- **Multi-Provider Support**: Works with both OpenAI (GPT-4o) and Anthropic (Claude)

## Architecture

```
backend/
├── app/
│   ├── api/          # API endpoints
│   ├── core/         # Configuration
│   ├── models/       # Pydantic models
│   ├── services/     # Business logic
│   │   ├── grading.py      # Main orchestrator
│   │   ├── llm.py          # LLM wrapper
│   │   └── preprocessing.py # File preprocessing
│   └── utils/        # Utilities (caching)
├── docker-compose.yml
├── Dockerfile
└── requirements.txt
```

## Setup

### 1. Environment Configuration

Copy `env.example` to `.env` and configure:

```bash
cp env.example .env
```

Key settings:
- `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`: Your LLM provider API key
- `LLM_PROVIDER`: Choose "openai" or "anthropic"
- `LLM_MODEL`: Model name (e.g., "gpt-4o" or "claude-3-5-sonnet-20241022")

### 2. Running with Docker Compose

```bash
docker-compose up
```

This starts:
- API server on http://localhost:8000
- Redis on localhost:6379

### 3. Running Locally

Install dependencies:
```bash
pip install -r requirements.txt
```

Start Redis:
```bash
docker run -p 6379:6379 redis:7-alpine
```

Run the API:
```bash
uvicorn app.main:app --reload
```

## API Usage

### Grade Submission

**POST** `/api/v1/grade-submission`

Streams grading results via Server-Sent Events.

Example request:
```json
{
  "assignment_context": {
    "course_id": "12345",
    "assignment_id": "67890",
    "submission_id": "424242",
    "assignment_name": "Binary Search Tree"
  },
  "source_files": {
    "main.cpp": "// C++ code here",
    "tree.h": "// Header file",
    "tree.cpp": "// Implementation"
  },
  "rubric_items": [
    {
      "id": "RbA3C2",
      "description": "Proper error handling for edge cases",
      "points": -2,
      "type": "CHECKBOX"
    },
    {
      "id": "RbB1X4",
      "description": "Code quality and style",
      "points": 0,
      "type": "RADIO",
      "options": {
        "excellent": "Excellent (0 pts)",
        "good": "Good (-1 pt)",
        "poor": "Poor (-2 pts)"
      }
    }
  ]
}
```

Response stream (SSE):
```
event: partial_result
data: {"type": "partial_result", "rubric_item_id": "RbA3C2", "decision": {...}, "progress": 0.5}

event: partial_result
data: {"type": "partial_result", "rubric_item_id": "RbB1X4", "decision": {...}, "progress": 1.0}

event: job_complete
data: {"type": "job_complete", "message": "Grading completed successfully", "progress": 1.0}
```

### Check Job Status

**GET** `/api/v1/job/{job_id}`

Returns current job status and progress.

### Health Check

**GET** `/api/v1/health`

## Processing Pipeline

1. **Preprocessing** (`preprocess_submission`):
   - Filters test files and creates summaries
   - Caches results by (course_id, assignment_id, submission_id)
   - Truncates large files to stay within token limits

2. **Rubric Evaluation** (per item):
   - Launches 3 parallel LLM calls
   - Each call uses chain-of-thought prompting
   - Returns structured JSON verdict

3. **Majority Voting**:
   - For CHECKBOX: Majority decision (check/uncheck)
   - For RADIO: Most selected option (low confidence on ties)
   - Final confidence = (agreement_rate × average_confidence)

4. **Streaming Results**:
   - Emits partial results immediately after each item
   - Client receives real-time progress updates

## Development

### Running Tests
```bash
pytest tests/
```

### API Documentation
Visit http://localhost:8000/docs for interactive API documentation.

### Adding New LLM Providers
1. Update `LLMService` in `app/services/llm.py`
2. Add provider-specific client initialization
3. Implement `_call_llm` method for the provider

## Performance Considerations

- **Caching**: Preprocessed submissions are cached for 1 hour
- **Parallel Processing**: 3 LLM calls run concurrently per rubric item
- **Token Optimization**: Test files are summarized to save context space
- **Streaming**: Results stream as they're ready, no waiting for full completion

## Error Handling

- **LLM Failures**: Retries with exponential backoff (up to 3 attempts)
- **All Calls Fail**: Returns low-confidence fallback decision
- **Network Issues**: Graceful degradation with error events in stream 