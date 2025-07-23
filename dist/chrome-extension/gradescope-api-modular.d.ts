import { GradescopeAPI } from '../modules/api/gradescope-api';
import { RubricExtractor } from '../modules/rubric/rubric-extractor';
declare const gradescopeAPI: GradescopeAPI;
declare const rubricExtractor: RubricExtractor;
declare function getRubric(): import("../types/index").RubricResult;
declare function showRadioDiag(): Promise<void>;
export { gradescopeAPI, rubricExtractor, getRubric, showRadioDiag };
//# sourceMappingURL=gradescope-api-modular.d.ts.map