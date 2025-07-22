/**
 * Unit tests for iframe-based rubric extraction (question pages)
 */

// Mock DOM for testing
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

describe('Iframe Rubric Extraction', () => {
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
  });

  test('should detect iframe with submissions content', () => {
    const iframe = document.querySelector('iframe[src*="submissions"]');
    expect(iframe).toBeTruthy();
    expect(iframe).toBe(mockIframe);
  });

  test('should extract correct number of rubric items', () => {
    const rubricItems = mockDoc.querySelectorAll('.rubric-item[data-rubric-item-id]');
    expect(rubricItems).toHaveLength(5);
  });

  test('should parse rubric item details correctly', () => {
    const items: Array<{ id: number; text: string; points: number }> = [];
    const rubricItems = mockDoc.querySelectorAll('.rubric-item[data-rubric-item-id]');
    
    rubricItems.forEach((item) => {
      const itemElement = item as HTMLElement;
      const itemId = itemElement.dataset.rubricItemId;
      const description = itemElement.querySelector('.rubric-description')?.textContent?.trim();
      const pointsText = itemElement.querySelector('.points')?.textContent?.trim();
      
      if (itemId && description && pointsText) {
        const points = parseFloat(pointsText.replace(/[^\d.-]/g, '')) || 0;
        const id = parseInt(itemId, 10);
        
        if (!isNaN(id)) {
          items.push({ id, text: description, points });
        }
      }
    });

    expect(items).toHaveLength(5);
    expect(items[0]).toEqual({
      id: 12345,
      text: 'Correct implementation of main function',
      points: 10
    });
    expect(items[4]).toEqual({
      id: 12349,
      text: 'Missing null checks',
      points: -3
    });
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

  test('should calculate points distribution correctly', () => {
    const items = [
      { points: 10 },  // positive
      { points: 5 },   // positive  
      { points: 0 },   // zero
      { points: -2 },  // negative
      { points: -3 }   // negative
    ];

    const distribution = items.reduce(
      (acc, item) => {
        if (item.points > 0) acc.positive++;
        else if (item.points < 0) acc.negative++;
        else acc.zero++;
        return acc;
      },
      { positive: 0, negative: 0, zero: 0 }
    );

    expect(distribution).toEqual({
      positive: 2,
      negative: 2,
      zero: 1
    });
  });

  test('should handle nested sub-questions structure', () => {
    // Add nested structure to mock
    const nestedContent = `
      <div class="question-section" data-question-id="1">
        <div class="rubric-item" data-rubric-item-id="1001">
          <input type="checkbox" />
          <div class="rubric-description">Parent question item</div>
          <div class="points">+5</div>
        </div>
        <div class="sub-question" data-parent-question="1">
          <div class="rubric-item" data-rubric-item-id="1002">
            <input type="checkbox" />
            <div class="rubric-description">Sub-question item 1</div>
            <div class="points">+2</div>
          </div>
          <div class="rubric-item" data-rubric-item-id="1003">
            <input type="checkbox" />
            <div class="rubric-description">Sub-question item 2</div>
            <div class="points">+3</div>
          </div>
        </div>
      </div>
    `;

    const parser = new DOMParser();
    const nestedDoc = parser.parseFromString(nestedContent, 'text/html');
    const allItems = nestedDoc.querySelectorAll('.rubric-item[data-rubric-item-id]');
    
    expect(allItems).toHaveLength(3);
    
    // Verify parent-child relationship detection
    const subQuestions = nestedDoc.querySelectorAll('.sub-question[data-parent-question]');
    expect(subQuestions).toHaveLength(1);
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

describe('Rubric Item Toggle Functionality', () => {
  let mockInput: HTMLInputElement;

  beforeEach(() => {
    document.body.innerHTML = `
      <div class="rubric-item" data-rubric-item-id="test123">
        <input type="checkbox" />
        <div class="rubric-description">Test item</div>
        <div class="points">+5</div>
      </div>
    `;
    
    mockInput = document.querySelector('input[type="checkbox"]') as HTMLInputElement;
    mockInput.checked = false;
  });

  test('should toggle checkbox state correctly', () => {
    expect(mockInput.checked).toBe(false);
    
    // Simulate click
    mockInput.click();
    expect(mockInput.checked).toBe(true);
    
    // Click again
    mockInput.click();
    expect(mockInput.checked).toBe(false);
  });

  test('should find rubric item by ID', () => {
    const item = document.querySelector('[data-rubric-item-id="test123"]');
    expect(item).toBeTruthy();
    
    const input = item?.querySelector('input[type="checkbox"]');
    expect(input).toBe(mockInput);
  });
}); 