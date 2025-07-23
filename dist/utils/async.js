// Async utility functions
/**
 * Simple delay function
 */
export function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
/**
 * Retry a function with exponential backoff
 */
export async function retry(fn, maxAttempts = 3, baseDelay = 1000) {
    let lastError;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        }
        catch (error) {
            lastError = error;
            if (attempt === maxAttempts) {
                throw lastError;
            }
            const delayMs = baseDelay * Math.pow(2, attempt - 1);
            await delay(delayMs);
        }
    }
    throw lastError;
}
/**
 * Timeout wrapper for promises
 */
export function withTimeout(promise, ms) {
    return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error(`Operation timed out after ${ms}ms`)), ms))
    ]);
}
//# sourceMappingURL=async.js.map