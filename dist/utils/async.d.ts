/**
 * Simple delay function
 */
export declare function delay(ms: number): Promise<void>;
/**
 * Retry a function with exponential backoff
 */
export declare function retry<T>(fn: () => Promise<T>, maxAttempts?: number, baseDelay?: number): Promise<T>;
/**
 * Timeout wrapper for promises
 */
export declare function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T>;
//# sourceMappingURL=async.d.ts.map