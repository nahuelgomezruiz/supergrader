interface Question {
    id: number;
    name: string;
    parent_id: number | null;
}
interface RubricItemData {
    id: number;
    description: string;
    points: number;
}
interface RubricItemsResponse {
    select_one?: boolean;
    rubric_items: RubricItemData[];
}
interface QuestionData {
    name: string;
    parentId: number | null;
    rubricStyle: "RADIO" | "CHECKBOX";
    items: Array<{
        id: number;
        text: string;
        points: number;
    }>;
}
interface RubricMap {
    questions: {
        [questionId: number]: QuestionData;
    };
    itemToQuestion: {
        [rubricItemId: number]: number;
    };
}
interface CachedRubricData {
    data: RubricMap;
    updatedAt: number;
}
/**
 * Retrieves cached rubric data from chrome.storage.local
 */
declare function getCachedRubric(cacheKey: string): Promise<CachedRubricData | null>;
/**
 * Stores rubric data in chrome.storage.local
 */
declare function setCachedRubric(cacheKey: string, data: RubricMap): Promise<void>;
/**
 * Fetches fresh rubric data from Gradescope APIs
 */
declare function fetchFreshRubricData(courseId: number, assignmentId: number): Promise<RubricMap>;
/**
 * Fetches rubric items for a specific question
 */
declare function fetchQuestionRubricItems(courseId: number, questionId: number): Promise<RubricItemsResponse>;
//# sourceMappingURL=rubric.d.ts.map