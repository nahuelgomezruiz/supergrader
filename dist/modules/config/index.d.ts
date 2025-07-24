export interface AppConfig {
    backend: {
        defaultUrl: string;
        timeout: number;
        maxRetries: number;
        retryDelay: number;
    };
    grading: {
        confidenceThreshold: number;
        autoApplyHighConfidence: boolean;
        enabledForAssignment: boolean;
    };
    auth: {
        maxRetries: number;
        rateLimitPerMinute: number;
        maxConcurrentRequests: number;
        sessionTimeout: number;
    };
    ui: {
        progressUpdateInterval: number;
        errorAutoHideDelay: number;
        successAutoHideDelay: number;
        statusCheckInterval: number;
        animationDuration: number;
    };
    files: {
        maxFileSize: number;
        supportedExtensions: string[];
        testFileMaxContent: number;
    };
    rubric: {
        accordionWaitTime: number;
        collapseWaitTime: number;
        cacheTTL: number;
    };
    extension: {
        version: string;
        debugMode: boolean;
        healthCheckInterval: number;
    };
}
export declare const DEFAULT_CONFIG: AppConfig;
export interface UserSettings {
    confidenceThreshold: number;
    autoApplyHighConfidence: boolean;
    enabledForAssignment: boolean;
    backendUrl?: string;
    debugMode?: boolean;
}
export declare const DEFAULT_USER_SETTINGS: UserSettings;
/**
 * Configuration manager class
 */
export declare class ConfigManager {
    private config;
    private userSettings;
    constructor();
    /**
     * Get the complete configuration
     */
    getConfig(): AppConfig;
    /**
     * Get user settings
     */
    getUserSettings(): UserSettings;
    /**
     * Update configuration with user settings
     */
    updateFromUserSettings(settings: Partial<UserSettings>): void;
    /**
     * Load user settings from Chrome storage
     */
    loadUserSettings(): Promise<void>;
    /**
     * Save user settings to Chrome storage
     */
    saveUserSettings(settings?: Partial<UserSettings>): Promise<void>;
    /**
     * Reset to default settings
     */
    resetToDefaults(): void;
    /**
     * Get specific config section
     */
    getBackendConfig(): {
        defaultUrl: string;
        timeout: number;
        maxRetries: number;
        retryDelay: number;
    };
    getGradingConfig(): {
        confidenceThreshold: number;
        autoApplyHighConfidence: boolean;
        enabledForAssignment: boolean;
    };
    getAuthConfig(): {
        maxRetries: number;
        rateLimitPerMinute: number;
        maxConcurrentRequests: number;
        sessionTimeout: number;
    };
    getUIConfig(): {
        progressUpdateInterval: number;
        errorAutoHideDelay: number;
        successAutoHideDelay: number;
        statusCheckInterval: number;
        animationDuration: number;
    };
    getFilesConfig(): {
        maxFileSize: number;
        supportedExtensions: string[];
        testFileMaxContent: number;
    };
    getRubricConfig(): {
        accordionWaitTime: number;
        collapseWaitTime: number;
        cacheTTL: number;
    };
    getExtensionConfig(): {
        version: string;
        debugMode: boolean;
        healthCheckInterval: number;
    };
    /**
     * Validate configuration values
     */
    validate(): {
        isValid: boolean;
        errors: string[];
    };
    /**
     * Get environment-specific config
     */
    getEnvironmentConfig(): {
        isDevelopment: boolean;
        isProduction: boolean;
    };
}
/**
 * Get the global configuration manager instance
 */
export declare function getConfigManager(): ConfigManager;
/**
 * Initialize configuration (load from storage)
 */
export declare function initializeConfig(): Promise<ConfigManager>;
export declare function getBackendUrl(): string;
export declare function getConfidenceThreshold(): number;
export declare function getMaxRetries(): number;
export declare function getRetryDelay(): number;
export declare function isDebugMode(): boolean;
//# sourceMappingURL=index.d.ts.map