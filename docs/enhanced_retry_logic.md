# Enhanced LLM Retry Logic

## Overview

The LLM evaluation system now includes comprehensive retry logic that handles a wide range of retryable failures, significantly reducing the occurrence of "Unable to evaluate automatically" fallback messages.

## What Changed

### 🔧 **Before (Limited Retry)**
```python
@retry(
    stop=stop_after_attempt(settings.llm_max_retries),
    wait=wait_exponential(multiplier=1, min=4, max=10),
    retry=retry_if_exception_type((httpx.TimeoutException, httpx.ConnectError))
)
```

**Problems:**
- ❌ Only retried 2 specific exception types
- ❌ Ignored HTTP 429 rate limiting errors
- ❌ Ignored HTTP 500-series server errors  
- ❌ Ignored API-specific exceptions from Anthropic/OpenAI
- ❌ No intelligent backoff for different error types

### 🚀 **After (Comprehensive Retry)**
```python
@retry(
    stop=stop_after_attempt(settings.llm_max_retries),
    wait=wait_combine(
        wait_exponential(multiplier=1, min=4, max=30),  # Exponential backoff up to 30s
        wait_fixed(2)  # Minimum 2s wait between retries
    ),
    retry=retry_if_exception(is_retryable_error),
    reraise=True
)
```

## Retryable Error Types

### 🌐 **Network-Level Errors**
- `httpx.TimeoutException` - Request timeouts
- `httpx.ConnectError` - Connection failures
- `httpx.ReadError` - Network read errors

### 🔢 **HTTP Status Code Errors**
- **HTTP 429** - Rate limiting (most important!)
- **HTTP 500** - Internal server error
- **HTTP 502** - Bad gateway
- **HTTP 503** - Service unavailable  
- **HTTP 504** - Gateway timeout

### 🤖 **Anthropic-Specific Errors**
- `anthropic.RateLimitError` - Rate limiting
- `anthropic.InternalServerError` - Server errors
- `anthropic.APITimeoutError` - API timeouts
- `anthropic.APIConnectionError` - Connection errors

### 🧠 **OpenAI-Specific Errors**
- `openai.RateLimitError` - Rate limiting
- `openai.InternalServerError` - Server errors
- `openai.APITimeoutError` - API timeouts
- `openai.APIConnectionError` - Connection errors

## Smart Backoff Strategy

### 🕐 **Wait Strategy**
```python
wait_combine(
    wait_exponential(multiplier=1, min=4, max=30),  # 4s, 8s, 16s, 30s, 30s...
    wait_fixed(2)  # Always wait at least 2s
)
```

**Benefits:**
- ✅ **Minimum 2-second wait** prevents immediate retry spam
- ✅ **Exponential backoff** reduces load on struggling servers
- ✅ **Maximum 30-second cap** prevents excessively long waits
- ✅ **Respects rate limits** with appropriate delays

### 📊 **Retry Attempts**
- **Default**: 3 attempts per LLM call (configurable via `settings.llm_max_retries`)
- **Total timeline**: ~2s + ~6s + ~18s = **~26 seconds maximum per call**
- **Parallel calls**: Each of the `parallel_llm_calls` gets its own retry attempts

## Impact on Fallback Messages

### 📈 **Before Enhancement**
```bash
❌ LLM call 1 failed: HTTPStatusError: 429 Too Many Requests
❌ LLM call 2 failed: HTTPStatusError: 429 Too Many Requests  
❌ LLM call 3 failed: HTTPStatusError: 429 Too Many Requests
📊 Rubric item X: 0/3 LLM calls succeeded
⚠️ All LLM calls failed, using fallback decision
💬 Comment: "Unable to evaluate automatically - please review manually"
```

### 📈 **After Enhancement**
```bash
🔄 Retryable HTTP 429 error: Too Many Requests
🔄 Retrying in 4 seconds...
✅ LLM call 1 succeeded after 2 retries
📊 Rubric item X: 3/3 LLM calls succeeded  
💬 Comment: "Code demonstrates excellent abstraction with clear separation..."
```

## Logging and Transparency

### 🔍 **Retry Logging**
Each retry attempt is logged with context:
```bash
🔄 Retryable HTTP 429 error: Too Many Requests
🔄 Anthropic rate limit error: Request was throttled
🔄 API connection error: Connection timeout
❌ Non-retryable error: ValidationError: Invalid JSON response
```

### 📈 **Success Tracking**
Final success/failure stats show the effectiveness:
```bash
📊 Rubric item rubric_5: 2/3 LLM calls succeeded (after retries)
📊 Rubric item rubric_6: 3/3 LLM calls succeeded (1 required retry)
```

## Configuration

### ⚙️ **Settings** (`backend/app/core/config.py`)
```python
llm_max_retries: int = 3  # Attempts per LLM call
parallel_llm_calls: int = 1  # LLM calls per rubric item
```

### 🎯 **Effective Retry Attempts**
- **Per rubric item**: `parallel_llm_calls × llm_max_retries`
- **Default**: `1 × 3 = 3 total attempts`
- **With parallel calls**: `3 × 3 = 9 total attempts`

## Benefits

### 🎯 **Fewer Manual Reviews**
- **Significant reduction** in "Unable to evaluate automatically" messages
- **Higher success rate** for LLM evaluations
- **Better user experience** with more automated results

### 🛡️ **Robust Error Handling**
- **Handles rate limiting gracefully** with appropriate backoff
- **Recovers from temporary server issues** automatically
- **Respects API provider limits** with intelligent retry timing

### 📊 **Improved System Reliability**
- **Less sensitive to network hiccups** and temporary outages
- **Better handling of high-load scenarios** with rate limiting
- **More consistent evaluation results** across different conditions

### 🔍 **Better Debugging**
- **Clear logging** of retry attempts and reasons
- **Distinction between retryable and fatal errors**
- **Visibility into which errors are being recovered from**

## Error Types That Still Trigger Fallbacks

### ❌ **Non-Retryable Errors** (Immediate Fallback)
- **Authentication errors** - Invalid API keys
- **Validation errors** - Malformed requests  
- **Permission errors** - Insufficient access
- **JSON parsing errors** - Malformed LLM responses
- **Model not found** - Invalid model specifications

### 🔄 **Exhausted Retries** (Fallback After All Attempts)
- **Persistent rate limiting** - If rate limits don't clear after retries
- **Ongoing server outages** - If servers remain down through all attempts
- **Network connectivity issues** - If connection problems persist

## Best Practices

### 🎯 **Monitoring**
- Watch for patterns in retry logs to identify systemic issues
- Monitor the ratio of successful vs. fallback evaluations
- Track which error types are most common

### ⚙️ **Configuration Tuning**
- **High-volume usage**: Consider increasing `parallel_llm_calls` for redundancy
- **Rate-limited scenarios**: Consider decreasing `parallel_llm_calls` to reduce API pressure
- **Time-sensitive scenarios**: Consider reducing `llm_max_retries` for faster feedback

### 🔧 **Development**
- Test retry logic with simulated failures (network issues, rate limits)
- Verify fallback behavior for truly non-retryable errors
- Monitor retry effectiveness in production logs

## Example Terminal Output

### Successful Retry Scenario
```bash
🤖 PROMPT SENT TO ANTHROPIC (claude-3-5-sonnet-20241022)
================================================================================
[... prompt content ...]

🔄 Retryable HTTP 429 error: Too Many Requests  
🔄 Retrying in 4 seconds...

🤖 PROMPT SENT TO ANTHROPIC (claude-3-5-sonnet-20241022) [RETRY 1/3]
================================================================================
[... same prompt content ...]

📤 RESPONSE FROM ANTHROPIC
================================================================================
{"decision": "check", "evidence": {...}, "comment": "...", "confidence": 95}
================================================================================

✅ Evaluation succeeded after 1 retry
```

This enhancement makes the system significantly more robust and reduces the need for manual intervention! 🎯 