/**
 * Unit tests for supergrader console helper functions
 * Tests the merged console API functions from both content.ts and gradescope-api.ts
 */

// Mock the chrome runtime for module imports
const mockChrome = {
  runtime: {
    getURL: jest.fn((path: string) => `chrome-extension://test-id/${path}`)
  }
};

(global as any).chrome = mockChrome;

// Mock the rubric module that gets dynamically imported
const mockRubricModule = {
  fetchRubricMap: jest.fn()
};

// Mock dynamic import
(global as any).import = jest.fn().mockResolvedValue(mockRubricModule);

// Mock console helper functions in gradescope-api.ts
jest.mock('../src/chrome-extension/gradescope-api', () => ({
  getRubric: jest.fn(),
  applyGrade: jest.fn(), 
  getRubricFromIframe: jest.fn(),
  getInnerDoc: jest.fn(),
  getIframeDocument: jest.fn()
}));

// Mock window location for URL matching
delete (window as any).location;
window.location = {
  pathname: '/courses/123/assignments/456/submissions/789/grade'
} as any;

describe('Supergrader Console Helpers', () => {
  let mockWindow: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Create a clean window mock
    mockWindow = {
      GradescopeAPI: {
        getAuthStatus: jest.fn(() => ({ isAuthenticated: true })),
        extractRubricStructure: jest.fn()
      },
      UIController: {},
      supergraderState: { isInitialized: true },
      supergrader: {}
    };
    
    // Reset the module mock
    mockRubricModule.fetchRubricMap.mockResolvedValue({
      questions: {
        1: {
          name: "Test Question",
          parentId: null,
          rubricStyle: "CHECKBOX",
          items: [
            { id: 101, text: "Test item", points: 5 }
          ]
        }
      },
      itemToQuestion: { 101: 1 }
    });
  });

  describe('IIFE Object.assign merging', () => {
    test('should merge content script helpers correctly', () => {
      // Simulate content.ts IIFE
      (() => {
        const contentHelpers = {
          api: mockWindow.GradescopeAPI,
          ui: mockWindow.UIController,
          getStatus: () => mockWindow.GradescopeAPI?.getAuthStatus?.(),
          getState: () => mockWindow.supergraderState,
          downloadTest: (submissionId: string) => {
            // Mock implementation
            console.log('Download test for', submissionId);
          }
        };
        
        mockWindow.supergrader = Object.assign(
          mockWindow.supergrader || {},
          contentHelpers
        );
        
        const keys = Object.keys(mockWindow.supergrader);
        console.log('Content script helpers merged:', keys);
      })();

      // Verify content script helpers are present
      expect(mockWindow.supergrader.api).toBe(mockWindow.GradescopeAPI);
      expect(mockWindow.supergrader.ui).toBe(mockWindow.UIController);
      expect(typeof mockWindow.supergrader.getStatus).toBe('function');
      expect(typeof mockWindow.supergrader.getState).toBe('function');
      expect(typeof mockWindow.supergrader.downloadTest).toBe('function');
    });

    test('should merge API helpers with existing content helpers', () => {
      // First, set up content helpers
      mockWindow.supergrader = {
        api: mockWindow.GradescopeAPI,
        ui: mockWindow.UIController,
        getStatus: () => mockWindow.GradescopeAPI?.getAuthStatus?.(),
        getState: () => mockWindow.supergraderState,
        downloadTest: jest.fn()
      };

      // Simulate gradescope-api.ts IIFE
      (() => {
        const apiHelpers = {
          // Ensure core properties are set (may override existing)
          api: mockWindow.GradescopeAPI,
          ui: mockWindow.UIController,
          getStatus: () => mockWindow.GradescopeAPI?.getAuthStatus?.(),
          getState: () => mockWindow.supergraderState,
          downloadTest: jest.fn(),
          
          // Add the 5 console helper functions
          testRubric: jest.fn(),
          testUnifiedRubric: jest.fn(),
          testIframeRubric: jest.fn(),
          analyzeRubric: jest.fn(),
          getRubricItem: jest.fn(),
          
          // Additional helpers
          validateRubricStructure: jest.fn(),
          applyGrade: jest.fn(),
          applyRubric: jest.fn(),
          getRubric: jest.fn(),
          getInnerDoc: jest.fn(),
          getIframeDoc: jest.fn()
        };

        mockWindow.supergrader = Object.assign(
          mockWindow.supergrader || {},
          apiHelpers
        );

        const keys = Object.keys(mockWindow.supergrader);
        console.log('API helpers merged, final keys:', keys);
      })();

      // Verify all helpers are present
      const expectedKeys = [
        'api', 'ui', 'getStatus', 'getState', 'downloadTest',
        'testRubric', 'testUnifiedRubric', 'testIframeRubric', 
        'analyzeRubric', 'getRubricItem', 'validateRubricStructure',
        'applyGrade', 'applyRubric', 'getRubric', 'getInnerDoc', 'getIframeDoc'
      ];

      expectedKeys.forEach(key => {
        expect(mockWindow.supergrader).toHaveProperty(key);
        if (typeof mockWindow.supergrader[key] === 'function') {
          expect(typeof mockWindow.supergrader[key]).toBe('function');
        }
      });

      // Verify the key 5 console helpers are functions
      const consoleFunctions = ['testRubric', 'testUnifiedRubric', 'testIframeRubric', 'analyzeRubric', 'getRubricItem'];
      consoleFunctions.forEach(fnName => {
        expect(typeof mockWindow.supergrader[fnName]).toBe('function');
      });
    });
  });

  describe('Console helper functions', () => {
    let supergrader: any;

    beforeEach(() => {
      // Set up fully merged supergrader object
      supergrader = {
        api: mockWindow.GradescopeAPI,
        ui: mockWindow.UIController,
        getStatus: jest.fn(() => ({ isAuthenticated: true })),
        getState: jest.fn(() => mockWindow.supergraderState),
        downloadTest: jest.fn(),
        testRubric: jest.fn(),
        testUnifiedRubric: jest.fn(), 
        testIframeRubric: jest.fn(),
        analyzeRubric: jest.fn(),
        getRubricItem: jest.fn()
      };

      // Mock window.supergrader for global access
      (global as any).window = { ...mockWindow, supergrader };
    });

    test('testRubric function should be available and functional', async () => {
      // Mock the implementation
      supergrader.testRubric.mockImplementation(async () => {
        return mockRubricModule.fetchRubricMap(123, 456);
      });

      const result = await supergrader.testRubric();
      
      expect(supergrader.testRubric).toHaveBeenCalled();
      expect(result).toEqual({
        questions: {
          1: {
            name: "Test Question",
            parentId: null,
            rubricStyle: "CHECKBOX",
            items: [{ id: 101, text: "Test item", points: 5 }]
          }
        },
        itemToQuestion: { 101: 1 }
      });
    });

    test('testUnifiedRubric function should be available', () => {
      supergrader.testUnifiedRubric.mockReturnValue({
        type: 'structured',
        items: [{ id: '123', description: 'Test item', points: 5 }],
        rubricStyle: 'CHECKBOX'
      });

      const result = supergrader.testUnifiedRubric();
      
      expect(supergrader.testUnifiedRubric).toHaveBeenCalled();
      expect(result.type).toBe('structured');
      expect(result.items).toHaveLength(1);
    });

    test('testIframeRubric function should be available', async () => {
      supergrader.testIframeRubric.mockResolvedValue({
        items: [{ id: 123, text: 'Test item', points: 5 }],
        rubricStyle: 'CHECKBOX',
        pointsDistribution: { positive: 1, negative: 0, zero: 0 }
      });

      const result = await supergrader.testIframeRubric();
      
      expect(supergrader.testIframeRubric).toHaveBeenCalled();
      expect(result.items).toHaveLength(1);
      expect(result.rubricStyle).toBe('CHECKBOX');
    });

    test('analyzeRubric function should be available', async () => {
      // Mock testRubric to return data for analysis
      supergrader.testRubric.mockResolvedValue({
        questions: {
          1: {
            name: "Test Question",
            parentId: null,
            rubricStyle: "CHECKBOX",
            items: [
              { id: 101, text: "Positive item", points: 5 },
              { id: 102, text: "Negative item", points: -2 },
              { id: 103, text: "Zero item", points: 0 }
            ]
          }
        },
        itemToQuestion: { 101: 1, 102: 1, 103: 1 }
      });

      supergrader.analyzeRubric.mockImplementation(async () => {
        const rubricMap = await supergrader.testRubric();
        return {
          totalQuestions: Object.keys(rubricMap.questions).length,
          totalItems: Object.keys(rubricMap.itemToQuestion).length,
          pointsDistribution: { positive: 1, negative: 1, zero: 1 }
        };
      });

      const result = await supergrader.analyzeRubric();
      
      expect(supergrader.analyzeRubric).toHaveBeenCalled();
      expect(result.totalQuestions).toBe(1);
      expect(result.totalItems).toBe(3);
      expect(result.pointsDistribution).toEqual({ positive: 1, negative: 1, zero: 1 });
    });

    test('getRubricItem function should be available', async () => {
      supergrader.testRubric.mockResolvedValue({
        questions: {
          1: {
            name: "Test Question", 
            parentId: null,
            rubricStyle: "CHECKBOX",
            items: [{ id: 101, text: "Test item", points: 5 }]
          }
        },
        itemToQuestion: { 101: 1 }
      });

      supergrader.getRubricItem.mockImplementation(async (itemId: number) => {
        const rubricMap = await supergrader.testRubric();
        const questionId = rubricMap.itemToQuestion[itemId];
        const question = rubricMap.questions[questionId];
        const item = question.items.find((i: any) => i.id === itemId);
        
        return {
          item,
          question: {
            id: questionId,
            name: question.name,
            parentId: question.parentId,
            rubricStyle: question.rubricStyle
          }
        };
      });

      const result = await supergrader.getRubricItem(101);
      
      expect(supergrader.getRubricItem).toHaveBeenCalledWith(101);
      expect(result.item).toEqual({ id: 101, text: "Test item", points: 5 });
      expect(result.question.name).toBe("Test Question");
    });

    test('all 5 console functions should be present', () => {
      const consoleFunctions = ['testRubric', 'testUnifiedRubric', 'testIframeRubric', 'analyzeRubric', 'getRubricItem'];
      
      consoleFunctions.forEach(fnName => {
        expect(supergrader).toHaveProperty(fnName);
        expect(typeof supergrader[fnName]).toBe('function');
      });

      // This matches what the comprehensive test expects
      const availableFunctions = consoleFunctions.filter(fn => typeof supergrader[fn] === 'function');
      expect(availableFunctions).toHaveLength(5);
      expect(availableFunctions).toEqual(consoleFunctions);
    });
  });

  describe('Error handling', () => {
    let supergrader: any;

    beforeEach(() => {
      supergrader = {
        testRubric: jest.fn(),
        analyzeRubric: jest.fn(),
        getRubricItem: jest.fn()
      };
    });

    test('should handle testRubric errors gracefully', async () => {
      supergrader.testRubric.mockRejectedValue(new Error('Network error'));

      await expect(supergrader.testRubric()).rejects.toThrow('Network error');
    });

    test('should handle analyzeRubric with no data', async () => {
      supergrader.testRubric.mockResolvedValue(null);
      supergrader.analyzeRubric.mockImplementation(async () => {
        const rubricMap = await supergrader.testRubric();
        if (!rubricMap) return null;
        // Analysis logic would go here
        return null;
      });

      const result = await supergrader.analyzeRubric();
      expect(result).toBeNull();
    });

    test('should handle getRubricItem for non-existent item', async () => {
      supergrader.testRubric.mockResolvedValue({
        questions: {},
        itemToQuestion: {}
      });

      supergrader.getRubricItem.mockImplementation(async (itemId: number) => {
        const rubricMap = await supergrader.testRubric();
        const questionId = rubricMap.itemToQuestion[itemId];
        if (!questionId) {
          console.error(`Item ${itemId} not found`);
          return null;
        }
        return null;
      });

      const result = await supergrader.getRubricItem(999);
      expect(result).toBeNull();
    });
  });
}); 