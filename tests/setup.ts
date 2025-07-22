// Jest setup file for supergrader tests

// Import fetch polyfill for Node.js environment
import 'whatwg-fetch';

// Mock chrome APIs globally
const mockChrome = {
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn(),
      remove: jest.fn(),
      clear: jest.fn()
    },
    sync: {
      get: jest.fn(),
      set: jest.fn(),
      remove: jest.fn(),
      clear: jest.fn()
    }
  },
  runtime: {
    lastError: null,
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
      hasListener: jest.fn()
    },
    sendMessage: jest.fn(),
    getURL: jest.fn(),
    id: 'test-extension-id'
  },
  tabs: {
    query: jest.fn(),
    sendMessage: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn()
  },
  scripting: {
    executeScript: jest.fn(),
    insertCSS: jest.fn(),
    removeCSS: jest.fn()
  }
};

// Assign to global scope
(global as any).chrome = mockChrome;

// Mock fetch globally for tests that don't use MSW
global.fetch = jest.fn();

// Setup console methods to be less noisy in tests unless explicitly testing them
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeEach(() => {
  // Reset all mocks before each test
  jest.clearAllMocks();
  
  // Reset chrome mock state
  mockChrome.runtime.lastError = null;
  
  // Reset console methods
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

// Add custom jest matchers if needed
expect.extend({
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () => `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  },
});

// Mock timers for consistent test behavior
jest.useFakeTimers();

// Clean up after all tests
afterAll(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
}); 