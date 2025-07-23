# SuperGrader Modular Architecture

This document describes the new modular architecture implemented to improve maintainability, testability, and code organization.

## Architecture Overview

The codebase has been restructured into focused modules with clear separation of concerns:

```
src/
├── types/              # Central type definitions
├── utils/              # Shared utility functions  
├── modules/            # Core business logic modules
│   ├── api/           # API client and orchestration
│   ├── auth/          # Authentication management
│   ├── rubric/        # Rubric extraction and parsing
│   ├── ui/            # UI components (future)
│   ├── download/      # File download logic (future)
│   └── testing/       # Testing utilities (future)
└── chrome-extension/   # Chrome extension entry points
```

## Key Modules

### 1. Types (`src/types/`)
- **`index.ts`**: Central type definitions for all interfaces and types
- Eliminates duplicate type definitions across files
- Provides single source of truth for data structures

### 2. Utilities (`src/utils/`)
- **`dom.ts`**: DOM manipulation utilities (getInnerDoc, waitForElement, etc.)
- **`async.ts`**: Async utilities (delay, retry, withTimeout)
- Reusable functions used across multiple modules

### 3. Authentication (`src/modules/auth/`)
- **`auth-manager.ts`**: Handles CSRF tokens, session validation, and auth state
- Isolated authentication logic with retry mechanisms
- Clean interface for checking auth status

### 4. API Client (`src/modules/api/`)
- **`api-client.ts`**: Generic authenticated HTTP client
- **`gradescope-api.ts`**: Main orchestrator that coordinates all modules
- Separation between generic API calls and Gradescope-specific logic

### 5. Rubric System (`src/modules/rubric/`)
- **`rubric-extractor.ts`**: Handles rubric parsing including radio button accordion logic
- Contains all the complex DOM parsing and radio group expansion logic
- Maintains the accordion-based approach for radio button extraction

## Key Features Preserved

### ✅ Radio Button Accordion Support
The modular architecture preserves all radio button extraction functionality:
- Sequential accordion expansion (only one group open at a time)
- Proper DOM parsing of `.rubricItemGroup--rubricItems .rubricItem` elements
- 350ms wait times for React rendering
- Automatic collapse after data extraction

### ✅ Backward Compatibility
- All existing global functions (`getRubric`, `showRadioDiag`, etc.) are preserved
- UI buttons continue to work without changes
- Chrome extension functionality remains intact

### ✅ Enhanced Diagnostics
- `showRadioDiag()` function maintains accordion-based approach
- `showEnhancedRubricData()` provides cleaner console output
- All debugging capabilities preserved and improved

## Migration Benefits

### 🎯 Maintainability
- **Single Responsibility**: Each module has a focused purpose
- **Smaller Files**: No more 3000+ line files
- **Clear Dependencies**: Easy to understand module relationships

### 🧪 Testability  
- **Isolated Logic**: Each module can be tested independently
- **Dependency Injection**: Easy to mock dependencies for testing
- **Clear Interfaces**: Well-defined input/output contracts

### 🔄 Extensibility
- **Plugin Architecture**: Easy to add new modules
- **Loose Coupling**: Modules communicate through well-defined interfaces
- **Future Growth**: Ready for additional features (file download, advanced UI, etc.)

### 🚀 Performance
- **Tree Shaking**: Unused code can be eliminated
- **Lazy Loading**: Modules can be loaded on demand
- **Better Caching**: Smaller modules cache more effectively

## Usage Examples

### Basic Usage (Backward Compatible)
```javascript
// These continue to work exactly as before
showRadioDiag();
showEnhancedRubricData();
const rubric = getRubric();
```

### Direct Module Usage
```javascript
import { GradescopeAPI } from './modules/api/gradescope-api';
import { RubricExtractor } from './modules/rubric/rubric-extractor';

const api = new GradescopeAPI();
await api.initialize();

const extractor = new RubricExtractor();
const rubric = extractor.extractRubric();
```

### Testing Individual Modules
```javascript
import { AuthManager } from './modules/auth/auth-manager';

const authManager = new AuthManager();
const isAuth = await authManager.initialize();
// Test authentication logic in isolation
```

## File Organization

### Before (Monolithic)
```
src/chrome-extension/gradescope-api.ts    (3474 lines!)
src/chrome-extension/ui-controller.ts     (1489 lines!)
```

### After (Modular)
```
src/modules/auth/auth-manager.ts          (~200 lines)
src/modules/api/api-client.ts             (~100 lines)
src/modules/api/gradescope-api.ts         (~150 lines)
src/modules/rubric/rubric-extractor.ts    (~400 lines)
src/types/index.ts                        (~100 lines)
src/utils/dom.ts                          (~60 lines)
src/utils/async.ts                        (~50 lines)
```

## Next Steps

1. **Gradual Migration**: The old `gradescope-api.ts` can coexist with the new modules
2. **Additional Modules**: File download, advanced UI components, etc.
3. **Enhanced Testing**: Unit tests for each module
4. **Documentation**: JSDoc comments for all public APIs

## Backward Compatibility

The new architecture is designed to be **100% backward compatible**:
- All existing buttons continue to work
- All global functions remain available  
- No changes required to existing UI or content scripts
- Radio button accordion logic is preserved exactly

The modular system runs alongside the existing code, gradually replacing functionality while maintaining all current features. 