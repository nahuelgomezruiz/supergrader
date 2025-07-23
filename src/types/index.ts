// Central type definitions for SuperGrader

// Authentication types
export interface AuthState {
  isAuthenticated: boolean;
  sessionValid: boolean;
  csrfTokenValid: boolean;
  lastValidated: number | null;
  retryCount: number;
  maxRetries: number;
  csrfToken: string | null;
  rateLimiter: {
    currentRequests: number;
    recentRequests: number;
  };
}

// Rubric types
export interface RubricItem {
  id: string;
  description: string;
  points: number;
  element?: HTMLElement;
  itemType?: 'RADIO' | 'CHECKBOX';
}

export interface StructuredRubric {
  type: 'structured';
  items: RubricItem[];
  rubricStyle: 'CHECKBOX' | 'RADIO' | 'MIXED';
}

export interface ManualRubric {
  type: 'manual';
  box: HTMLInputElement;
}

export type RubricResult = StructuredRubric | ManualRubric | null;

// File download types
export interface FileContent {
  content: string;
  size: number;
  encoding: string;
  extension: string;
}

export interface DownloadMetadata {
  totalFiles: number;
  supportedFiles: number;
  skippedFiles: number;
  errors: string[];
  downloadTime: number;
  fileTypes: Record<string, number>;
}

export interface DownloadResult {
  files: Record<string, FileContent>;
  metadata: DownloadMetadata;
}

// UI types
export interface EnhancedState {
  courseId: string | null;
  assignmentId: string | null;
  submissionId: string | null;
  assignmentType: 'assignments' | 'questions' | null;
  isInitialized: boolean;
  retryCount: number;
  domReady: boolean;
  injectionPoint?: Element | null;
  rubricData?: any;
  sourceCode?: Record<string, string>;
  pageMetadata?: PageMetadata;
}

export interface PageMetadata {
  assignmentName?: string;
  courseName?: string;
  studentId?: string;
  submissionTime?: string;
}

export interface ProgressStage {
  progress: number;
  text: string;
}

// API Test types
export interface APITestResult {
  testName: string;
  status: 'success' | 'failure' | 'warning' | 'info';
  message: string;
  timing?: number;
  details?: any;
}

// Window extensions
export interface WindowWithExtensions extends Window {
  GradescopeAPI?: any;
  UIController?: any;
  supergrader?: any;
  getRubric?: () => RubricResult;
  getInnerDoc?: () => Document;
  showRadioDiag?: () => Promise<void>;
} 