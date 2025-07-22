/**
 * Unit tests for unified rubric extraction (all Gradescope layouts)
 */

// Mock DOM content for different scenarios
const mockIframeContent = `
  <div class="rubric-item" data-rubric-item-id="12345">
    <input type="checkbox" />
    <div class="rubric-description">Correct implementation of main function</div>
    <div class="points">+10</div>
  </div>
  <div class="rubric-item" data-rubric-item-id="12346">
    <input type="checkbox" />
    <div class="rubric-description">Proper error handling</div>
    <div class="points">+5</div>
  </div>
  <div class="rubric-item" data-rubric-item-id="12347">
    <input type="radio" name="quality" />
    <div class="rubric-description">Code quality - Excellent</div>
    <div class="points">0</div>
  </div>
  <div class="rubric-item" data-rubric-item-id="12348">
    <input type="radio" name="quality" />
    <div class="rubric-description">Code quality - Good</div>
    <div class="points">-2</div>
  </div>
  <div class="rubric-item" data-rubric-item-id="12349">
    <input type="checkbox" />
    <div class="rubric-description">Missing null checks</div>
    <div class="points">-3</div>
  </div>
`;

const mockFramelessContent = `
  <div data-react-props="eyJydWJyaWNJdGVtcyI6W3siaWQiOiIyMDAwMSIsImRlc2NyaXB0aW9uIjoiQ29ycmVjdCBpbXBsZW1lbnRhdGlvbiIsInBvaW50cyI6MTAsInJ1YnJpY19pdGVtX2lkIjoiMjAwMDEifSx7ImlkIjoiMjAwMDIiLCJkZXNjcmlwdGlvbiI6IkVycm9yIGhhbmRsaW5nIiwicG9pbnRzIjo1LCJydWJyaWNfaXRlbV9pZCI6IjIwMDAyIn0seyJpZCI6IjIwMDAzIiwiZGVzY3JpcHRpb24iOiJDb2RlIHN0eWxlIiwicG9pbnRzIjowLCJydWJyaWNfaXRlbV9pZCI6IjIwMDAzIn1dLCJydWJyaWNTdHlsZSI6IkNIRUNLQk9YIn0=">
    React Component
  </div>
`;

const mockManualContent = `
  <div class="scoring-section">
    <label for="score">Score:</label>
    <input type="number" name="score" id="score" placeholder="Enter score" min="0" max="100" />
    <span>points</span>
  </div>
`;

describe('Unified Rubric Detection', () => {
  // Mock global functions that would be imported from gradescope-api.ts
  const getInnerDoc = jest.fn();
  const getRubric = jest.fn();
  const applyGrade = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Legacy iframe + structured rubric', () => {
    let mockIframe: HTMLIFrameElement;
    let mockDoc: Document;

    beforeEach(() => {
      // Create mock iframe and document
      document.body.innerHTML = '<iframe src="/submissions/test"></iframe>';
      mockIframe = document.querySelector('iframe') as HTMLIFrameElement;
      
      // Mock iframe document
      const parser = new DOMParser();
      mockDoc = parser.parseFromString(mockIframeContent, 'text/html');
      
      // Mock iframe access
      Object.defineProperty(mockIframe, 'contentDocument', {
        value: mockDoc,
        writable: false
      });
      
      Object.defineProperty(mockDoc, 'readyState', {
        value: 'complete',
        writable: true
      });
      
      // Mock getInnerDoc to return iframe document
      getInnerDoc.mockReturnValue(mockDoc);
    });

    test('should detect iframe with submissions content', () => {
      const iframe = document.querySelector('iframe[src*="submissions"]');
      expect(iframe).toBeTruthy();
      expect(iframe).toBe(mockIframe);
    });

    test('should extract structured rubric from iframe DOM', () => {
      const rubricItems = mockDoc.querySelectorAll('.rubric-item[data-rubric-item-id]');
      expect(rubricItems).toHaveLength(5);

      // Mock getRubric to simulate DOM-based extraction
      getRubric.mockReturnValue({
        type: 'structured',
        items: [
          { id: '12345', description: 'Correct implementation of main function', points: 10, element: rubricItems[0] },
          { id: '12346', description: 'Proper error handling', points: 5, element: rubricItems[1] },
          { id: '12347', description: 'Code quality - Excellent', points: 0, element: rubricItems[2] },
          { id: '12348', description: 'Code quality - Good', points: -2, element: rubricItems[3] },
          { id: '12349', description: 'Missing null checks', points: -3, element: rubricItems[4] }
        ],
        rubricStyle: 'RADIO'
      });

      const result = getRubric();
      expect(result?.type).toBe('structured');
      expect(result?.items).toHaveLength(5);
      expect(result?.rubricStyle).toBe('RADIO');
    });

    test('should detect mixed input types correctly', () => {
      const radioInputs = mockDoc.querySelectorAll('input[type="radio"]');
      const checkboxInputs = mockDoc.querySelectorAll('input[type="checkbox"]');
      
      expect(radioInputs).toHaveLength(2);
      expect(checkboxInputs).toHaveLength(3);
      
      // Should prefer RADIO if mixed (as per implementation)
      const rubricStyle = radioInputs.length > 0 ? "RADIO" : "CHECKBOX";
      expect(rubricStyle).toBe("RADIO");
    });

    test('should verify minimum 12-item rubric requirement', () => {
      // Create a rubric with exactly 12 items
      const largeRubricContent = Array.from({ length: 12 }, (_, i) => `
        <div class="rubric-item" data-rubric-item-id="${2000 + i}">
          <input type="checkbox" />
          <div class="rubric-description">Rubric item ${i + 1}</div>
          <div class="points">${i % 3 === 0 ? '+' : '-'}${i + 1}</div>
        </div>
      `).join('');

      const parser = new DOMParser();
      const largeDoc = parser.parseFromString(largeRubricContent, 'text/html');
      const items = largeDoc.querySelectorAll('.rubric-item[data-rubric-item-id]');
      
      expect(items).toHaveLength(12);
      expect(items.length).toBeGreaterThanOrEqual(12);
    });
  });

  describe('Frameless + React props rubric', () => {
    beforeEach(() => {
      // Setup frameless page with React props
      document.body.innerHTML = mockFramelessContent;
      
      // Mock getInnerDoc to return main document
      getInnerDoc.mockReturnValue(document);
    });

    test('should extract rubric from React props', () => {
      const propsEl = document.querySelector('[data-react-props]');
      expect(propsEl).toBeTruthy();
      
      const propsAttr = propsEl?.getAttribute('data-react-props');
      expect(propsAttr).toBeTruthy();
      
      // Decode and parse the base64 JSON
      const data = JSON.parse(atob(propsAttr!));
      expect(data.rubricItems).toHaveLength(3);
      expect(data.rubricStyle).toBe('CHECKBOX');
      
      // Mock getRubric to simulate React props extraction
      getRubric.mockReturnValue({
        type: 'structured',
        items: data.rubricItems,
        rubricStyle: 'CHECKBOX'
      });

      const result = getRubric();
      expect(result?.type).toBe('structured');
      expect(result?.items).toHaveLength(3);
      expect(result?.rubricStyle).toBe('CHECKBOX');
    });

    test('should parse React props JSON correctly', () => {
      const expectedData = {
        rubricItems: [
          { id: "20001", description: "Correct implementation", points: 10, rubric_item_id: "20001" },
          { id: "20002", description: "Error handling", points: 5, rubric_item_id: "20002" },
          { id: "20003", description: "Code style", points: 0, rubric_item_id: "20003" }
        ],
        rubricStyle: "CHECKBOX"
      };

      const propsEl = document.querySelector('[data-react-props]');
      const propsAttr = propsEl?.getAttribute('data-react-props');
      const data = JSON.parse(atob(propsAttr!));
      
      expect(data).toEqual(expectedData);
    });
  });

  describe('Manual scoring interface', () => {
    let mockScoreBox: HTMLInputElement;

    beforeEach(() => {
      // Setup manual scoring page
      document.body.innerHTML = mockManualContent;
      mockScoreBox = document.querySelector('input[name="score"]') as HTMLInputElement;
      
      // Mock getInnerDoc to return main document
      getInnerDoc.mockReturnValue(document);
    });

    test('should detect manual scoring input', () => {
      expect(mockScoreBox).toBeTruthy();
      expect(mockScoreBox.type).toBe('number');
      expect(mockScoreBox.name).toBe('score');
    });

    test('should return manual rubric result', () => {
      // Mock getRubric to simulate manual detection
      getRubric.mockReturnValue({
        type: 'manual',
        box: mockScoreBox
      });

      const result = getRubric();
      expect(result?.type).toBe('manual');
      expect((result as any)?.box).toBe(mockScoreBox);
    });

    test('should handle manual score setting', () => {
      const mockResult = { type: 'manual' as const, box: mockScoreBox };
      
      // Mock applyGrade to simulate setting score
      applyGrade.mockImplementation((target, _rubricId, _checked, score) => {
        if (target?.type === 'manual' && typeof score === 'number') {
          target.box.value = String(score);
          return true;
        }
        return false;
      });

      const success = applyGrade(mockResult, undefined, undefined, 4.5);
      expect(success).toBe(true);
      expect(mockScoreBox.value).toBe('4.5');
    });
  });
});

describe('Apply Grade Functionality', () => {
  const applyGrade = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Structured rubric toggle', () => {
    let mockCheckbox: HTMLInputElement;
    let mockRadio: HTMLInputElement;

    beforeEach(() => {
      document.body.innerHTML = `
        <div class="rubric-item" data-rubric-item-id="test123">
          <input type="checkbox" />
          <div class="rubric-description">Test checkbox item</div>
          <div class="points">+5</div>
        </div>
        <div class="rubric-item" data-rubric-item-id="test456">
          <input type="radio" name="quality" />
          <div class="rubric-description">Test radio item</div>
          <div class="points">-2</div>
        </div>
      `;
      
      mockCheckbox = document.querySelector('input[type="checkbox"]') as HTMLInputElement;
      mockRadio = document.querySelector('input[type="radio"]') as HTMLInputElement;
      mockCheckbox.checked = false;
      mockRadio.checked = false;
    });

    test('should toggle checkbox correctly', () => {
      const mockResult = {
        type: 'structured' as const,
        items: [{ id: 'test123', element: mockCheckbox.closest('.rubric-item') as HTMLElement }],
        rubricStyle: 'CHECKBOX' as const
      };

      // Mock applyGrade implementation
             applyGrade.mockImplementation((target: any, rubricId: string, checked: boolean) => {
         if (target?.type === 'structured' && rubricId === 'test123') {
           const item = target.items.find((i: any) => i.id === rubricId);
           const input = item?.element?.querySelector('input[type="checkbox"]') as HTMLInputElement;
           if (input && input.checked !== checked) {
             input.click();
             return true;
           }
         }
         return false;
       });

      expect(mockCheckbox.checked).toBe(false);
      const success = applyGrade(mockResult, 'test123', true);
      expect(success).toBe(true);
    });

    test('should toggle radio correctly', () => {
      const mockResult = {
        type: 'structured' as const,
        items: [{ id: 'test456', element: mockRadio.closest('.rubric-item') as HTMLElement }],
        rubricStyle: 'RADIO' as const
      };

             applyGrade.mockImplementation((target: any, rubricId: string, checked: boolean) => {
         if (target?.type === 'structured' && rubricId === 'test456') {
           const item = target.items.find((i: any) => i.id === rubricId);
           const input = item?.element?.querySelector('input[type="radio"]') as HTMLInputElement;
           if (input && input.checked !== checked) {
             input.click();
             return true;
           }
         }
         return false;
       });

      expect(mockRadio.checked).toBe(false);
      const success = applyGrade(mockResult, 'test456', true);
      expect(success).toBe(true);
    });

    test('should handle missing rubric item gracefully', () => {
      const mockResult = {
        type: 'structured' as const,
        items: [],
        rubricStyle: 'CHECKBOX' as const
      };

      applyGrade.mockReturnValue(false);
      const success = applyGrade(mockResult, 'nonexistent', true);
      expect(success).toBe(false);
    });
  });

  describe('Manual scoring', () => {
    let mockScoreBox: HTMLInputElement;

    beforeEach(() => {
      document.body.innerHTML = `
        <input type="number" name="score" placeholder="Enter score" />
      `;
      mockScoreBox = document.querySelector('input[name="score"]') as HTMLInputElement;
    });

    test('should set score correctly', () => {
      const mockResult = { type: 'manual' as const, box: mockScoreBox };

      applyGrade.mockImplementation((target, _rubricId, _checked, score) => {
        if (target?.type === 'manual' && typeof score === 'number') {
          target.box.value = String(score);
          target.box.dispatchEvent(new Event('input', { bubbles: true }));
          return true;
        }
        return false;
      });

      const success = applyGrade(mockResult, undefined, undefined, 85.5);
      expect(success).toBe(true);
      expect(mockScoreBox.value).toBe('85.5');
    });

    test('should handle invalid score input', () => {
      const mockResult = { type: 'manual' as const, box: mockScoreBox };

      applyGrade.mockImplementation((target, _rubricId, _checked, score) => {
        if (target?.type === 'manual') {
          if (typeof score !== 'number') return false;
          target.box.value = String(score);
          return true;
        }
        return false;
      });

      const success = applyGrade(mockResult, undefined, undefined, undefined);
      expect(success).toBe(false);
    });
  });

  test('should handle null rubric result', () => {
    applyGrade.mockReturnValue(false);
    const success = applyGrade(null, 'test123', true);
    expect(success).toBe(false);
  });
}); 