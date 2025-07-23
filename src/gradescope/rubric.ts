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
  items: Array<{ id: number; text: string; points: number }>;
}

interface RubricMap {
  questions: { [questionId: number]: QuestionData };
  itemToQuestion: { [rubricItemId: number]: number };
}

interface CachedRubricData {
  data: RubricMap;
  updatedAt: number;
}

/**
 * Fetches and parses the complete rubric structure for a Gradescope assignment
 * @param courseId - The Gradescope course ID
 * @param assignmentId - The Gradescope assignment ID
 * @returns Promise resolving to the rubric map with questions and reverse lookup
 */
async function fetchRubricMap(courseId: number, assignmentId: number): Promise<RubricMap> {
  const cacheKey = `rubric:${assignmentId}`;
  const cacheExpirationMs = 12 * 60 * 60 * 1000; // 12 hours
  
  // Check cache first
  try {
    const cached = await getCachedRubric(cacheKey);
    if (cached && (Date.now() - cached.updatedAt) < cacheExpirationMs) {
      return cached.data;
    }
  } catch (error) {
    console.warn('Failed to retrieve cached rubric data:', error);
  }

  // Fetch fresh data
  const rubricMap = await fetchFreshRubricData(courseId, assignmentId);
  
  // Cache the result
  try {
    await setCachedRubric(cacheKey, rubricMap);
  } catch (error) {
    console.warn('Failed to cache rubric data:', error);
  }
  
  return rubricMap;
}

/**
 * Retrieves cached rubric data from chrome.storage.local
 */
async function getCachedRubric(cacheKey: string): Promise<CachedRubricData | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get([cacheKey], (result) => {
      if (chrome.runtime.lastError) {
        resolve(null);
        return;
      }
      resolve(result[cacheKey] || null);
    });
  });
}

/**
 * Stores rubric data in chrome.storage.local
 */
async function setCachedRubric(cacheKey: string, data: RubricMap): Promise<void> {
  return new Promise((resolve, reject) => {
    const cachedData: CachedRubricData = {
      data,
      updatedAt: Date.now()
    };
    
    chrome.storage.local.set({ [cacheKey]: cachedData }, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      resolve();
    });
  });
}

/**
 * Fetches fresh rubric data from Gradescope APIs
 */
async function fetchFreshRubricData(courseId: number, assignmentId: number): Promise<RubricMap> {
  // Step 1: Fetch questions hierarchy
  const questionsUrl = `/api/v2/courses/${courseId}/assignments/${assignmentId}/questions`;
  const questionsResponse = await fetch(questionsUrl, {
    credentials: 'include',
    headers: {
      'Accept': 'application/json',
      'X-Requested-With': 'XMLHttpRequest'
    }
  });
  
  if (!questionsResponse.ok) {
    throw new Error(`Failed to fetch questions: ${questionsResponse.status} ${questionsResponse.statusText}`);
  }
  
  const questions: Question[] = await questionsResponse.json();
  
  // Step 2: Fetch rubric items for each question
  const rubricMap: RubricMap = {
    questions: {},
    itemToQuestion: {}
  };
  
  // Process questions concurrently but with reasonable batching to avoid overwhelming the server
  const batchSize = 5;
  for (let i = 0; i < questions.length; i += batchSize) {
    const batch = questions.slice(i, i + batchSize);
    await Promise.all(batch.map(async (question) => {
      try {
        const rubricItems = await fetchQuestionRubricItems(courseId, question.id);
        
        // Determine rubric style
        const rubricStyle: "RADIO" | "CHECKBOX" = rubricItems.select_one ? "RADIO" : "CHECKBOX";
        
        // Build question data
        const questionData: QuestionData = {
          name: question.name,
          parentId: question.parent_id,
          rubricStyle,
          items: rubricItems.rubric_items.map(item => ({
            id: item.id,
            text: item.description,
            points: item.points
          }))
        };
        
        rubricMap.questions[question.id] = questionData;
        
        // Build reverse lookup map
        rubricItems.rubric_items.forEach(item => {
          rubricMap.itemToQuestion[item.id] = question.id;
        });
        
      } catch (error) {
        console.error(`Failed to fetch rubric items for question ${question.id}:`, error);
        // Create a fallback entry for this question
        rubricMap.questions[question.id] = {
          name: question.name,
          parentId: question.parent_id,
          rubricStyle: "CHECKBOX",
          items: []
        };
      }
    }));
  }
  
  return rubricMap;
}

/**
 * Fetches rubric items for a specific question
 */
async function fetchQuestionRubricItems(courseId: number, questionId: number): Promise<RubricItemsResponse> {
  const rubricUrl = `/courses/${courseId}/questions/${questionId}/rubric_items.json`;
  const response = await fetch(rubricUrl, {
    credentials: 'include',
    headers: {
      'Accept': 'application/json',
      'X-Requested-With': 'XMLHttpRequest'
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch rubric items for question ${questionId}: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  
  // Ensure we have the expected structure
  if (!data.rubric_items || !Array.isArray(data.rubric_items)) {
    throw new Error(`Invalid rubric items response for question ${questionId}`);
  }
  
  return data;
} 