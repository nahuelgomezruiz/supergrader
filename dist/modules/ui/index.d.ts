export { Panel, PanelConfig, PanelElements } from './panel';
export { Progress, ProgressStage, ProgressMessageType } from './progress';
export { ErrorDisplay, ErrorType, ErrorMessage } from './error';
export { StatusDisplay, AuthStatus, StatusType, StatusInfo } from './status';
export { ModularUIController } from './ui-controller';
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
//# sourceMappingURL=index.d.ts.map