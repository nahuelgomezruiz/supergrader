import { rest } from 'msw';
import { setupServer } from 'msw/node';
import { fetchRubricMap } from '../src/gradescope/rubric';

// Mock Chrome storage API
const mockChromeStorage = {
  local: {
    get: jest.fn(),
    set: jest.fn()
  }
};

const mockChromeRuntime = {
  lastError: null as Error | null
};

// Setup global chrome mock
(global as any).chrome = {
  storage: mockChromeStorage,
  runtime: mockChromeRuntime
};

// Mock data for tests
const mockQuestions = [
  {
    id: 1,
    name: "Problem 1",
    parent_id: null
  },
  {
    id: 2,
    name: "Problem 1a",
    parent_id: 1
  },
  {
    id: 3,
    name: "Problem 1b",
    parent_id: 1
  },
  {
    id: 4,
    name: "Problem 2",
    parent_id: null
  }
];

const mockRubricItems = {
  1: {
    select_one: false,
    rubric_items: [
      { id: 101, description: "Correct implementation", points: 10 },
      { id: 102, description: "Good documentation", points: 5 }
    ]
  },
  2: {
    select_one: true,
    rubric_items: [
      { id: 201, description: "Excellent", points: 0 },
      { id: 202, description: "Good", points: -2 },
      { id: 203, description: "Poor", points: -5 }
    ]
  },
  3: {
    select_one: false,
    rubric_items: [
      { id: 301, description: "Logic error", points: -3 },
      { id: 302, description: "Style issue", points: -1 }
    ]
  },
  4: {
    select_one: false,
    rubric_items: [
      { id: 401, description: "Complete solution", points: 15 }
    ]
  }
};

// Setup MSW server
const server = setupServer(
  // Mock questions endpoint
  rest.get('/api/v2/courses/:courseId/assignments/:assignmentId/questions', (req, res, ctx) => {
    const { courseId, assignmentId } = req.params;
    
    if (courseId === '999') {
      return res(ctx.status(404), ctx.json({ error: 'Course not found' }));
    }
    
    if (assignmentId === '888') {
      return res(ctx.status(500), ctx.json({ error: 'Internal server error' }));
    }
    
    return res(ctx.json(mockQuestions));
  }),

  // Mock rubric items endpoint
  rest.get('/courses/:courseId/questions/:questionId/rubric_items.json', (req, res, ctx) => {
    const { questionId } = req.params;
    const questionIdNum = parseInt(questionId as string);
    
    if (questionIdNum === 999) {
      return res(ctx.status(404), ctx.json({ error: 'Question not found' }));
    }
    
    if (questionIdNum === 888) {
      return res(ctx.status(500), ctx.json({ error: 'Internal server error' }));
    }
    
    const rubricData = mockRubricItems[questionIdNum as keyof typeof mockRubricItems];
    if (!rubricData) {
      return res(ctx.status(404), ctx.json({ error: 'Rubric not found' }));
    }
    
    return res(ctx.json(rubricData));
  })
);

describe('fetchRubricMap', () => {
  beforeAll(() => {
    server.listen();
  });

  beforeEach(() => {
    // Reset chrome storage mocks
    mockChromeStorage.local.get.mockClear();
    mockChromeStorage.local.set.mockClear();
    mockChromeRuntime.lastError = null;
    
    // Default mock implementations
    mockChromeStorage.local.get.mockImplementation((_keys, callback) => {
      callback({});
    });
    
    mockChromeStorage.local.set.mockImplementation((_data, callback) => {
      callback();
    });
  });

  afterAll(() => {
    server.close();
  });

  afterEach(() => {
    server.resetHandlers();
  });

  test('fetches and parses rubric structure correctly', async () => {
    const result = await fetchRubricMap(123, 456);
    
    expect(result.questions).toHaveProperty('1');
    expect(result.questions).toHaveProperty('2');
    expect(result.questions).toHaveProperty('3');
    expect(result.questions).toHaveProperty('4');
    
    // Check question 1 (parent, checkbox)
    expect(result.questions[1]).toEqual({
      name: "Problem 1",
      parentId: null,
      rubricStyle: "CHECKBOX",
      items: [
        { id: 101, text: "Correct implementation", points: 10 },
        { id: 102, text: "Good documentation", points: 5 }
      ]
    });
    
    // Check question 2 (child, radio)
    expect(result.questions[2]).toEqual({
      name: "Problem 1a",
      parentId: 1,
      rubricStyle: "RADIO",
      items: [
        { id: 201, text: "Excellent", points: 0 },
        { id: 202, text: "Good", points: -2 },
        { id: 203, text: "Poor", points: -5 }
      ]
    });
  });

  test('builds correct itemToQuestion mapping', async () => {
    const result = await fetchRubricMap(123, 456);
    
    expect(result.itemToQuestion).toEqual({
      101: 1,
      102: 1,
      201: 2,
      202: 2,
      203: 2,
      301: 3,
      302: 3,
      401: 4
    });
  });

  test('handles parent/child relationships correctly', async () => {
    const result = await fetchRubricMap(123, 456);
    
    // Parent question
    expect(result.questions[1].parentId).toBeNull();
    
    // Child questions
    expect(result.questions[2].parentId).toBe(1);
    expect(result.questions[3].parentId).toBe(1);
    
    // Another parent
    expect(result.questions[4].parentId).toBeNull();
  });

  test('distinguishes between RADIO and CHECKBOX rubric styles', async () => {
    const result = await fetchRubricMap(123, 456);
    
    expect(result.questions[1].rubricStyle).toBe("CHECKBOX");
    expect(result.questions[2].rubricStyle).toBe("RADIO");
    expect(result.questions[3].rubricStyle).toBe("CHECKBOX");
    expect(result.questions[4].rubricStyle).toBe("CHECKBOX");
  });

  test('uses cached data when available and fresh', async () => {
    const cachedData = {
      questions: {
        1: {
          name: "Cached Question",
          parentId: null,
          rubricStyle: "CHECKBOX" as const,
          items: [{ id: 999, text: "Cached item", points: 5 }]
        }
      },
      itemToQuestion: { 999: 1 }
    };
    
    const cacheEntry = {
      data: cachedData,
      updatedAt: Date.now() - 1000 * 60 * 30 // 30 minutes ago
    };
    
    mockChromeStorage.local.get.mockImplementation((_keys, callback) => {
      callback({ 'rubric:456': cacheEntry });
    });
    
    const result = await fetchRubricMap(123, 456);
    
    expect(result).toEqual(cachedData);
    expect(mockChromeStorage.local.get).toHaveBeenCalledWith(['rubric:456'], expect.any(Function));
  });

  test('ignores expired cache and fetches fresh data', async () => {
    const expiredCacheEntry = {
      data: { questions: {}, itemToQuestion: {} },
      updatedAt: Date.now() - 1000 * 60 * 60 * 13 // 13 hours ago
    };
    
    mockChromeStorage.local.get.mockImplementation((_keys, callback) => {
      callback({ 'rubric:456': expiredCacheEntry });
    });
    
    const result = await fetchRubricMap(123, 456);
    
    // Should fetch fresh data, not return empty cache
    expect(Object.keys(result.questions)).toHaveLength(4);
    expect(mockChromeStorage.local.set).toHaveBeenCalled();
  });

  test('caches fetched data correctly', async () => {
    let cachedData: any = null;
    
    mockChromeStorage.local.set.mockImplementation((data, callback) => {
      cachedData = data;
      callback();
    });
    
    await fetchRubricMap(123, 456);
    
    expect(mockChromeStorage.local.set).toHaveBeenCalled();
    expect(cachedData).toHaveProperty('rubric:456');
    expect(cachedData['rubric:456']).toHaveProperty('data');
    expect(cachedData['rubric:456']).toHaveProperty('updatedAt');
    expect(typeof cachedData['rubric:456'].updatedAt).toBe('number');
  });

  test('handles questions endpoint failure gracefully', async () => {
    await expect(fetchRubricMap(999, 456)).rejects.toThrow('Failed to fetch questions: 404');
  });

  test('handles individual rubric item fetch failures gracefully', async () => {
    // Add a question that will fail to fetch rubric items
    const questionsWithFailure = [
      ...mockQuestions,
      { id: 999, name: "Failing Question", parent_id: null }
    ];
    
    server.use(
      rest.get('/api/v2/courses/123/assignments/456/questions', (_req, res, ctx) => {
        return res(ctx.json(questionsWithFailure));
      })
    );
    
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    
    const result = await fetchRubricMap(123, 456);
    
    // Should still return data for successful questions
    expect(Object.keys(result.questions)).toHaveLength(5);
    expect(result.questions[999]).toEqual({
      name: "Failing Question",
      parentId: null,
      rubricStyle: "CHECKBOX",
      items: []
    });
    
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to fetch rubric items for question 999'),
      expect.any(Error)
    );
    
    consoleSpy.mockRestore();
  });

  test('handles chrome storage errors gracefully', async () => {
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    
    // Mock storage error
    mockChromeRuntime.lastError = new Error('Storage quota exceeded');
    
    mockChromeStorage.local.get.mockImplementation((_keys, callback) => {
      callback({});
    });
    
    mockChromeStorage.local.set.mockImplementation((_data, callback) => {
      callback();
    });
    
    const result = await fetchRubricMap(123, 456);
    
    // Should still return data even with storage errors
    expect(Object.keys(result.questions)).toHaveLength(4);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'Failed to cache rubric data:',
      expect.any(Error)
    );
    
    consoleWarnSpy.mockRestore();
    mockChromeRuntime.lastError = null;
  });

  test('processes requests in batches for performance', async () => {
    // Create a large number of questions to test batching
    const largeQuestionSet = Array.from({ length: 20 }, (_, i) => ({
      id: i + 1,
      name: `Question ${i + 1}`,
      parent_id: null
    }));
    
    const largeMockRubricItems: { [key: number]: any } = {};
    largeQuestionSet.forEach((q) => {
      largeMockRubricItems[q.id] = {
        select_one: false,
        rubric_items: [
          { id: q.id * 100, description: `Item for question ${q.id}`, points: 1 }
        ]
      };
    });
    
    let requestCount = 0;
    
    server.use(
      rest.get('/api/v2/courses/123/assignments/456/questions', (_req, res, ctx) => {
        return res(ctx.json(largeQuestionSet));
      }),
      rest.get('/courses/123/questions/:questionId/rubric_items.json', (req, res, ctx) => {
        requestCount++;
        const questionId = parseInt(req.params.questionId as string);
        const rubricData = largeMockRubricItems[questionId];
        return res(ctx.json(rubricData));
      })
    );
    
    const startTime = Date.now();
    const result = await fetchRubricMap(123, 456);
    const endTime = Date.now();
    
    expect(Object.keys(result.questions)).toHaveLength(20);
    expect(requestCount).toBe(20);
    
    // Should complete reasonably quickly (less than 5 seconds for 20 questions)
    expect(endTime - startTime).toBeLessThan(5000);
  });

  test('performance test: handles 100 questions under 3 seconds with warm cache', async () => {
    const largeCachedData = {
      questions: {} as any,
      itemToQuestion: {} as any
    };
    
    // Create cached data for 100 questions
    for (let i = 1; i <= 100; i++) {
      largeCachedData.questions[i] = {
        name: `Question ${i}`,
        parentId: null,
        rubricStyle: "CHECKBOX" as const,
        items: [{ id: i * 100, text: `Item ${i}`, points: 1 }]
      };
      largeCachedData.itemToQuestion[i * 100] = i;
    }
    
    const cacheEntry = {
      data: largeCachedData,
      updatedAt: Date.now() - 1000 * 60 // 1 minute ago
    };
    
    mockChromeStorage.local.get.mockImplementation((_keys, callback) => {
      callback({ 'rubric:456': cacheEntry });
    });
    
    const startTime = Date.now();
    const result = await fetchRubricMap(123, 456);
    const endTime = Date.now();
    
    expect(Object.keys(result.questions)).toHaveLength(100);
    expect(endTime - startTime).toBeLessThan(3000); // Under 3 seconds
  });
}); 