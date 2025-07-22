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
/**
 * Fetches and parses the complete rubric structure for a Gradescope assignment
 * @param courseId - The Gradescope course ID
 * @param assignmentId - The Gradescope assignment ID
 * @returns Promise resolving to the rubric map with questions and reverse lookup
 */
export declare function fetchRubricMap(courseId: number, assignmentId: number): Promise<RubricMap>;
export {};
//# sourceMappingURL=rubric.d.ts.map