// Central Configuration Module for SuperGrader
// Consolidates all configuration and settings management

export interface AppConfig {
  // Backend Configuration
  backend: {
    defaultUrl: string;
    timeout: number;
    maxRetries: number;
    retryDelay: number;
  };

  // Grading Configuration
  grading: {
    confidenceThreshold: number;
    autoApplyHighConfidence: boolean;
    enabledForAssignment: boolean;
  };

  // Authentication Configuration
  auth: {
    maxRetries: number;
    rateLimitPerMinute: number;
    maxConcurrentRequests: number;
    sessionTimeout: number; // in ms
  };

  // UI Configuration
  ui: {
    progressUpdateInterval: number;
    errorAutoHideDelay: number;
    successAutoHideDelay: number;
    statusCheckInterval: number;
    animationDuration: number;
  };

  // File Processing Configuration
  files: {
    maxFileSize: number; // in characters
    supportedExtensions: string[];
    testFileMaxContent: number; // in characters
  };

  // Rubric Configuration
  rubric: {
    accordionWaitTime: number; // for radio button expansion
    collapseWaitTime: number;
    cacheTTL: number; // in hours
  };

  // Extension Configuration
  extension: {
    version: string;
    debugMode: boolean;
    healthCheckInterval: number; // in ms
  };
}

// Default configuration values
export const DEFAULT_CONFIG: AppConfig = {
  backend: {
    defaultUrl: 'http://localhost:8000',
    timeout: 10000, // 10 seconds
    maxRetries: 3,
    retryDelay: 1000 // 1 second
  },

  grading: {
    confidenceThreshold: 0.8,
    autoApplyHighConfidence: false,
    enabledForAssignment: true
  },

  auth: {
    maxRetries: 3,
    rateLimitPerMinute: 100,
    maxConcurrentRequests: 10,
    sessionTimeout: 3600000 // 1 hour
  },

  ui: {
    progressUpdateInterval: 100,
    errorAutoHideDelay: 8000,
    successAutoHideDelay: 3000,
    statusCheckInterval: 30000, // 30 seconds
    animationDuration: 300
  },

  files: {
    maxFileSize: 1048576, // 1MB in characters
    supportedExtensions: ['.cpp', '.h', '.py', '.java', '.js', '.ts', '.c', '.cc', '.cxx'],
    testFileMaxContent: 100 // characters for test files
  },

  rubric: {
    accordionWaitTime: 350, // ms for radio button accordion expansion
    collapseWaitTime: 150, // ms for accordion collapse
    cacheTTL: 12 // hours
  },

  extension: {
    version: '1.0.1',
    debugMode: false,
    healthCheckInterval: 30000 // 30 seconds
  }
};

// Chrome Storage Settings (subset of config that can be user-modified)
export interface UserSettings {
  confidenceThreshold: number;
  autoApplyHighConfidence: boolean;
  enabledForAssignment: boolean;
  backendUrl?: string;
  debugMode?: boolean;
}

// Default user settings
export const DEFAULT_USER_SETTINGS: UserSettings = {
  confidenceThreshold: DEFAULT_CONFIG.grading.confidenceThreshold,
  autoApplyHighConfidence: DEFAULT_CONFIG.grading.autoApplyHighConfidence,
  enabledForAssignment: DEFAULT_CONFIG.grading.enabledForAssignment,
  backendUrl: DEFAULT_CONFIG.backend.defaultUrl,
  debugMode: DEFAULT_CONFIG.extension.debugMode
};

/**
 * Configuration manager class
 */
export class ConfigManager {
  private config: AppConfig;
  private userSettings: UserSettings;

  constructor() {
    this.config = { ...DEFAULT_CONFIG };
    this.userSettings = { ...DEFAULT_USER_SETTINGS };
  }

  /**
   * Get the complete configuration
   */
  getConfig(): AppConfig {
    return { ...this.config };
  }

  /**
   * Get user settings
   */
  getUserSettings(): UserSettings {
    return { ...this.userSettings };
  }

  /**
   * Update configuration with user settings
   */
  updateFromUserSettings(settings: Partial<UserSettings>): void {
    this.userSettings = { ...this.userSettings, ...settings };

    // Update main config with user settings
    if (settings.confidenceThreshold !== undefined) {
      this.config.grading.confidenceThreshold = settings.confidenceThreshold;
    }
    if (settings.autoApplyHighConfidence !== undefined) {
      this.config.grading.autoApplyHighConfidence = settings.autoApplyHighConfidence;
    }
    if (settings.enabledForAssignment !== undefined) {
      this.config.grading.enabledForAssignment = settings.enabledForAssignment;
    }
    if (settings.backendUrl !== undefined) {
      this.config.backend.defaultUrl = settings.backendUrl;
    }
    if (settings.debugMode !== undefined) {
      this.config.extension.debugMode = settings.debugMode;
    }
  }

  /**
   * Load user settings from Chrome storage
   */
  async loadUserSettings(): Promise<void> {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      try {
        const result = await chrome.storage.sync.get(Object.keys(DEFAULT_USER_SETTINGS));
        console.log('ConfigManager: Loaded user settings from storage', result);
        
        // Validate and apply settings
        const validatedSettings: Partial<UserSettings> = {};
        
        if (typeof result.confidenceThreshold === 'number' && 
            result.confidenceThreshold >= 0 && result.confidenceThreshold <= 1) {
          validatedSettings.confidenceThreshold = result.confidenceThreshold;
        }
        
        if (typeof result.autoApplyHighConfidence === 'boolean') {
          validatedSettings.autoApplyHighConfidence = result.autoApplyHighConfidence;
        }
        
        if (typeof result.enabledForAssignment === 'boolean') {
          validatedSettings.enabledForAssignment = result.enabledForAssignment;
        }
        
        if (typeof result.backendUrl === 'string' && result.backendUrl.trim()) {
          validatedSettings.backendUrl = result.backendUrl;
        }
        
        if (typeof result.debugMode === 'boolean') {
          validatedSettings.debugMode = result.debugMode;
        }
        
        this.updateFromUserSettings(validatedSettings);
      } catch (error) {
        console.error('ConfigManager: Error loading user settings', error);
      }
    }
  }

  /**
   * Save user settings to Chrome storage
   */
  async saveUserSettings(settings?: Partial<UserSettings>): Promise<void> {
    if (settings) {
      this.updateFromUserSettings(settings);
    }

    if (typeof chrome !== 'undefined' && chrome.storage) {
      try {
        await chrome.storage.sync.set(this.userSettings);
        console.log('ConfigManager: Saved user settings to storage', this.userSettings);
      } catch (error) {
        console.error('ConfigManager: Error saving user settings', error);
        throw error;
      }
    }
  }

  /**
   * Reset to default settings
   */
  resetToDefaults(): void {
    this.config = { ...DEFAULT_CONFIG };
    this.userSettings = { ...DEFAULT_USER_SETTINGS };
  }

  /**
   * Get specific config section
   */
  getBackendConfig() {
    return this.config.backend;
  }

  getGradingConfig() {
    return this.config.grading;
  }

  getAuthConfig() {
    return this.config.auth;
  }

  getUIConfig() {
    return this.config.ui;
  }

  getFilesConfig() {
    return this.config.files;
  }

  getRubricConfig() {
    return this.config.rubric;
  }

  getExtensionConfig() {
    return this.config.extension;
  }

  /**
   * Validate configuration values
   */
  validate(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate confidence threshold
    if (this.config.grading.confidenceThreshold < 0 || this.config.grading.confidenceThreshold > 1) {
      errors.push('Confidence threshold must be between 0 and 1');
    }

    // Validate backend URL
    try {
      new URL(this.config.backend.defaultUrl);
    } catch {
      errors.push('Backend URL is not a valid URL');
    }

    // Validate timeouts and delays
    if (this.config.backend.timeout <= 0) {
      errors.push('Backend timeout must be positive');
    }

    if (this.config.auth.maxRetries < 0) {
      errors.push('Max retries cannot be negative');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Get environment-specific config
   */
  getEnvironmentConfig(): { isDevelopment: boolean; isProduction: boolean } {
    const isDevelopment = this.config.extension.debugMode || 
                          this.config.backend.defaultUrl.includes('localhost');
    
    return {
      isDevelopment,
      isProduction: !isDevelopment
    };
  }
}

// Global config manager instance
let globalConfigManager: ConfigManager | null = null;

/**
 * Get the global configuration manager instance
 */
export function getConfigManager(): ConfigManager {
  if (!globalConfigManager) {
    globalConfigManager = new ConfigManager();
  }
  return globalConfigManager;
}

/**
 * Initialize configuration (load from storage)
 */
export async function initializeConfig(): Promise<ConfigManager> {
  const configManager = getConfigManager();
  await configManager.loadUserSettings();
  
  const validation = configManager.validate();
  if (!validation.isValid) {
    console.warn('ConfigManager: Configuration validation failed:', validation.errors);
  }
  
  console.log('ConfigManager: Configuration initialized', {
    config: configManager.getConfig(),
    userSettings: configManager.getUserSettings(),
    validation
  });
  
  return configManager;
}

// Convenience functions for quick access to common config values
export function getBackendUrl(): string {
  return getConfigManager().getBackendConfig().defaultUrl;
}

export function getConfidenceThreshold(): number {
  return getConfigManager().getGradingConfig().confidenceThreshold;
}

export function getMaxRetries(): number {
  return getConfigManager().getBackendConfig().maxRetries;
}

export function getRetryDelay(): number {
  return getConfigManager().getBackendConfig().retryDelay;
}

export function isDebugMode(): boolean {
  return getConfigManager().getExtensionConfig().debugMode;
} 