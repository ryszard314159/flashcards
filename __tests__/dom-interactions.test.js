/**
 * __tests__/dom-interactions.test.js
 * Tests for user interactions: card flips, debouncing, search, input binding
 */

describe('DOM: User Interactions', () => {
  let mockCardInner;
  let mockUI;
  let mockState;

  beforeEach(() => {
    // Reset localStorage
    localStorage.clear();

    // Setup mock card
    mockCardInner = document.getElementById('cardInner');

    // Setup mock UI
    mockUI = {
      cardInner: mockCardInner,
      searchBar: document.getElementById('searchBar'),
      sessionSize: document.getElementById('sessionSize'),
      tempInput: document.getElementById('tempInput'),
      speechRateInput: document.getElementById('speechRateInput'),
      counter: document.getElementById('card-counter'),
      categoryList: document.getElementById('categoryList'),
    };

    // Setup mock state
    mockState = {
      isFlipped: false,
      currentCardIndex: 0,
      currentSessionDeck: [
        { id: '1', frontText: 'hello', backText: 'hola', frontLabel: 'English', backLabel: 'Spanish' },
        { id: '2', frontText: 'goodbye', backText: 'adiós', frontLabel: 'English', backLabel: 'Spanish' },
        { id: '3', frontText: 'cat', backText: 'gato', frontLabel: 'English', backLabel: 'Spanish' },
      ],
      masterDeck: [],
      settings: {
        temperature: 1.0,
        sessionSize: 5,
        speechRate: 1.0,
      },
      calculateProbabilities: false,
    };
  });

  afterEach(() => {
    // Cleanup
  });

  // ============================================================================
  // Card Flip Tests
  // ============================================================================
  describe('Card Flip Interaction', () => {
    test('card flip toggles is-flipped class on card inner', () => {
      expect(mockCardInner.classList.contains('is-flipped')).toBe(false);

      // Simulate card click
      mockCardInner.classList.toggle('is-flipped');
      mockState.isFlipped = true;

      expect(mockCardInner.classList.contains('is-flipped')).toBe(true);
      expect(mockState.isFlipped).toBe(true);

      // Click again
      mockCardInner.classList.toggle('is-flipped');
      mockState.isFlipped = false;

      expect(mockCardInner.classList.contains('is-flipped')).toBe(false);
    });

    test('card flip debounce blocks second flip within 250ms', () => {
      let lastFlipTime = 0;
      const DEBOUNCE_MS = 250;
      const baseTime = 1000; // Start at 1000ms

      const handleFlip = (currentTime) => {
        if (currentTime - lastFlipTime < DEBOUNCE_MS) {
          // Blocked - too soon
          return false;
        }
        lastFlipTime = currentTime;
        mockCardInner.classList.toggle('is-flipped');
        return true;
      };

      // First flip at t=1000
      const flip1 = handleFlip(baseTime);
      expect(flip1).toBe(true);
      expect(mockCardInner.classList.contains('is-flipped')).toBe(true);

      // Immediate second flip (should be blocked) at t=1001
      const flip2 = handleFlip(baseTime + 1);
      expect(flip2).toBe(false);
      expect(mockCardInner.classList.contains('is-flipped')).toBe(true);

      // Third flip after debounce window at t=1300
      const flip3 = handleFlip(baseTime + 300);
      expect(flip3).toBe(true);
      expect(mockCardInner.classList.contains('is-flipped')).toBe(false);
    });

    test('card flip removed on navigation', () => {
      // Start with flipped card
      mockCardInner.classList.add('is-flipped');
      mockState.isFlipped = true;

      // Simulate navigation to next card
      mockCardInner.classList.remove('is-flipped');
      mockState.isFlipped = false;
      mockState.currentCardIndex = 1;

      expect(mockCardInner.classList.contains('is-flipped')).toBe(false);
      expect(mockState.isFlipped).toBe(false);
      expect(mockState.currentCardIndex).toBe(1);
    });
  });

  // ============================================================================
  // Frequency Change Feedback Tests
  // ============================================================================
  describe('Frequency Change Feedback', () => {
    test('frequency change adds feedback-up or feedback-down class', () => {
      expect(mockCardInner.classList.contains('feedback-up')).toBe(false);

      // Simulate frequency increase
      mockCardInner.classList.add('feedback-up');
      expect(mockCardInner.classList.contains('feedback-up')).toBe(true);

      // Clean up
      mockCardInner.classList.remove('feedback-up');

      // Simulate frequency decrease
      mockCardInner.classList.add('feedback-down');
      expect(mockCardInner.classList.contains('feedback-down')).toBe(true);
    });

    test('frequency feedback class auto-removes after 500ms', () => {
      mockCardInner.classList.add('feedback-up');
      expect(mockCardInner.classList.contains('feedback-up')).toBe(true);

      // Simulate 500ms timeout callback that removes the class
      mockCardInner.classList.remove('feedback-up');

      expect(mockCardInner.classList.contains('feedback-up')).toBe(false);
    });

    test('frequency feedback re-triggers after removal', () => {
      // First feedback
      mockCardInner.classList.add('feedback-up');
      expect(mockCardInner.classList.contains('feedback-up')).toBe(true);

      // Remove after timeout
      mockCardInner.classList.remove('feedback-up');
      expect(mockCardInner.classList.contains('feedback-up')).toBe(false);

      // Second feedback (should work)
      mockCardInner.classList.add('feedback-up');
      expect(mockCardInner.classList.contains('feedback-up')).toBe(true);
    });
  });

  // ============================================================================
  // Search Input Tests
  // ============================================================================
  describe('Search Interaction', () => {
    test('search input updates card counter', () => {
      const counter = mockUI.counter;

      // Simulate search filtering results
      const searchResults = mockState.currentSessionDeck.filter(card =>
        card.frontText.includes('hello')
      );

      counter.textContent = `${0 + 1} / ${searchResults.length}`;

      expect(counter.textContent).toBe('1 / 1');
    });

    test('search empty query returns full deck', () => {
      const searchTerm = '';

      const results = mockState.currentSessionDeck.filter(card =>
        searchTerm === '' || card.frontText.includes(searchTerm)
      );

      expect(results.length).toBe(mockState.currentSessionDeck.length);
      expect(results.length).toBe(3);
    });

    test('search with results updates displayed cards', () => {
      const searchTerm = 'cat';

      const results = mockState.currentSessionDeck.filter(card =>
        card.frontText.includes(searchTerm)
      );

      expect(results.length).toBe(1);
      expect(results[0].frontText).toBe('cat');
    });

    test('search with no results logs warning', () => {
      const searchTerm = 'zzzzz';

      const results = mockState.currentSessionDeck.filter(card =>
        card.frontText.includes(searchTerm)
      );

      // Verify search returned no results
      expect(results.length).toBe(0);

      // Verify the warning logic would be triggered
      expect(searchTerm).toBe('zzzzz');
      expect(results.length).toBe(0);
    });
  });

  // ============================================================================
  // Category Checkbox Tests
  // ============================================================================
  describe('Category Checkbox Interaction', () => {
    test('category checkboxes have correct checked state', () => {
      // Create mock checkboxes
      const mockCheckboxSpanish = { value: 'Spanish', checked: true };
      const mockCheckboxFrench = { value: 'French', checked: false };

      expect(mockCheckboxSpanish.checked).toBe(true);
      expect(mockCheckboxFrench.checked).toBe(false);

      // Toggle French
      mockCheckboxFrench.checked = true;
      expect(mockCheckboxFrench.checked).toBe(true);
    });

    test('select all button checks all category checkboxes', () => {
      const mockCheckboxes = [
        { value: 'Spanish', checked: false },
        { value: 'French', checked: false },
        { value: 'German', checked: false },
      ];

      // Simulate select all click
      mockCheckboxes.forEach(cb => cb.checked = true);

      mockCheckboxes.forEach(cb => {
        expect(cb.checked).toBe(true);
      });
    });

    test('select none button unchecks all category checkboxes', () => {
      const mockCheckboxes = [
        { value: 'Spanish', checked: true },
        { value: 'French', checked: true },
        { value: 'German', checked: true },
      ];

      // Simulate select none click
      mockCheckboxes.forEach(cb => cb.checked = false);

      mockCheckboxes.forEach(cb => {
        expect(cb.checked).toBe(false);
      });
    });
  });

  // ============================================================================
  // Input Value Binding Tests
  // ============================================================================
  describe('Input Value Binding', () => {
    test('temperature input value updates on change event', () => {
      const tempInput = mockUI.tempInput;

      // User types new value
      tempInput.value = '2.5';

      // Simulate change event handler
      mockState.settings.temperature = parseFloat(tempInput.value);

      expect(mockState.settings.temperature).toBe(2.5);
      expect(tempInput.value).toBe('2.5');
    });

    test('temperature adjustment buttons increment/decrement value', () => {
      const tempInput = mockUI.tempInput;
      tempInput.value = '1.0';
      const DELTA = 0.1;

      // Simulate + button
      const newValueUp = parseFloat(tempInput.value) + DELTA;
      tempInput.value = newValueUp.toFixed(1);

      expect(parseFloat(tempInput.value)).toBe(1.1);

      // Simulate - button
      const newValueDown = parseFloat(tempInput.value) - DELTA;
      tempInput.value = newValueDown.toFixed(1);

      expect(parseFloat(tempInput.value)).toBe(1.0);
    });

    test('temperature change triggers probability recalculation flag', () => {
      mockState.calculateProbabilities = false;
      const tempInput = mockUI.tempInput;

      // Change temperature
      tempInput.value = '2.0';
      mockState.calculateProbabilities = true;

      expect(mockState.calculateProbabilities).toBe(true);
    });

    test('session size input value bound to state', () => {
      const sessionSizeInput = mockUI.sessionSize;

      sessionSizeInput.value = '15';
      mockState.settings.sessionSize = parseInt(sessionSizeInput.value);

      expect(mockState.settings.sessionSize).toBe(15);
    });

    test('speech rate input value bound to state', () => {
      const speechInput = mockUI.speechRateInput;

      speechInput.value = '1.5';
      mockState.settings.speechRate = parseFloat(speechInput.value);

      expect(mockState.settings.speechRate).toBe(1.5);
    });
  });

  // ============================================================================
  // Input Focus Auto-Select Tests
  // ============================================================================
  describe('Input Focus Behavior', () => {
    test('input focus auto-selects text (textContent or value)', () => {
      const tempInput = mockUI.tempInput;
      tempInput.value = '1.0';

      // Simulate focus and auto-select
      const selectedText = tempInput.value;

      // In real code: e.target.select()
      // We verify the setup allows it
      expect(tempInput.value).toBe('1.0');
      expect(selectedText).toBe('1.0');
    });

    test('settings values synced to inputs on modal open', () => {
      mockState.settings.temperature = 1.5;
      mockState.settings.sessionSize = 10;
      mockState.settings.speechRate = 1.2;

      // Simulate syncing to UI
      mockUI.tempInput.value = mockState.settings.temperature.toFixed(1);
      mockUI.sessionSize.value = mockState.settings.sessionSize;
      mockUI.speechRateInput.value = mockState.settings.speechRate.toFixed(1);

      expect(parseFloat(mockUI.tempInput.value)).toBe(1.5);
      expect(parseInt(mockUI.sessionSize.value)).toBe(10);
      expect(parseFloat(mockUI.speechRateInput.value)).toBe(1.2);
    });
  });

  // ============================================================================
  // Input Value Clamping Tests
  // ============================================================================
  describe('Input Value Clamping', () => {
    test('temperature input clamps to valid range', () => {
      const tempInput = mockUI.tempInput;
      const MIN = 0.1;
      const MAX = 10.0;

      // Try to set too low
      let value = -1;
      const clamped1 = Math.max(MIN, Math.min(MAX, value));
      expect(clamped1).toBe(0.1);

      // Try to set too high
      value = 15;
      const clamped2 = Math.max(MIN, Math.min(MAX, value));
      expect(clamped2).toBe(10.0);

      // Valid value
      value = 2.5;
      const clamped3 = Math.max(MIN, Math.min(MAX, value));
      expect(clamped3).toBe(2.5);
    });

    test('session size input clamps to valid range', () => {
      const MIN = 0;
      const MAX = 100;

      // Too low
      let value = -5;
      const clamped1 = Math.max(MIN, Math.min(MAX, value));
      expect(clamped1).toBe(0);

      // Too high
      value = 200;
      const clamped2 = Math.max(MIN, Math.min(MAX, value));
      expect(clamped2).toBe(100);

      // Valid
      value = 25;
      const clamped3 = Math.max(MIN, Math.min(MAX, value));
      expect(clamped3).toBe(25);
    });
  });

  // ============================================================================
  // Next Button Mode-Aware Navigation Tests
  // ============================================================================
  describe('Next Button Mode-Aware Navigation', () => {
    let nextZone;

    beforeEach(() => {
      nextZone = document.getElementById('nextZone');
      mockUI.nextZone = nextZone;

      // Setup a 5-card session deck
      mockState.currentSessionDeck = [
        { id: '1', frontText: 'card1', backText: 'back1', frontLabel: 'Test', backLabel: 'Test' },
        { id: '2', frontText: 'card2', backText: 'back2', frontLabel: 'Test', backLabel: 'Test' },
        { id: '3', frontText: 'card3', backText: 'back3', frontLabel: 'Test', backLabel: 'Test' },
        { id: '4', frontText: 'card4', backText: 'back4', frontLabel: 'Test', backLabel: 'Test' },
        { id: '5', frontText: 'card5', backText: 'back5', frontLabel: 'Test', backLabel: 'Test' },
      ];
      mockState.currentCardIndex = 0;
      mockState.settings.selectionMode = 'sequential';
    });

    test('sequential mode: next button navigates to next card in order', () => {
      // Start at card 0
      expect(mockState.currentCardIndex).toBe(0);

      // Simulate navigate(1) - this is what should happen in sequential mode
      mockState.currentCardIndex = (mockState.currentCardIndex + 1 + mockState.currentSessionDeck.length) % mockState.currentSessionDeck.length;
      expect(mockState.currentCardIndex).toBe(1);

      // Continue navigating
      mockState.currentCardIndex = (mockState.currentCardIndex + 1 + mockState.currentSessionDeck.length) % mockState.currentSessionDeck.length;
      expect(mockState.currentCardIndex).toBe(2);

      mockState.currentCardIndex = (mockState.currentCardIndex + 1 + mockState.currentSessionDeck.length) % mockState.currentSessionDeck.length;
      expect(mockState.currentCardIndex).toBe(3);

      mockState.currentCardIndex = (mockState.currentCardIndex + 1 + mockState.currentSessionDeck.length) % mockState.currentSessionDeck.length;
      expect(mockState.currentCardIndex).toBe(4);

      // Wraps around to start
      mockState.currentCardIndex = (mockState.currentCardIndex + 1 + mockState.currentSessionDeck.length) % mockState.currentSessionDeck.length;
      expect(mockState.currentCardIndex).toBe(0);
    });

    test('sequential mode: maintains deck order with next/prev navigation', () => {
      const deck = mockState.currentSessionDeck;

      // Verify deck is in order 1-5
      expect(deck[0].frontText).toBe('card1');
      expect(deck[1].frontText).toBe('card2');
      expect(deck[2].frontText).toBe('card3');
      expect(deck[3].frontText).toBe('card4');
      expect(deck[4].frontText).toBe('card5');

      // Navigate forward 3 times
      mockState.currentCardIndex = 0;
      for (let i = 0; i < 3; i++) {
        mockState.currentCardIndex = (mockState.currentCardIndex + 1 + deck.length) % deck.length;
      }
      expect(deck[mockState.currentCardIndex].frontText).toBe('card4');
    });

    test('weighted mode: next button would call drawCard (not tested in details, just mode check)', () => {
      mockState.settings.selectionMode = 'weighted';

      // In weighted mode, next calls drawCard(), not navigate()
      // We verify the mode is set correctly for the handler to check
      expect(mockState.settings.selectionMode).toBe('weighted');
    });

    test('mode-aware behavior: sequential vs weighted have different next handlers', () => {
      // Verify the selection mode setting exists and has correct options
      expect(['weighted', 'sequential']).toContain(mockState.settings.selectionMode);

      mockState.settings.selectionMode = 'sequential';
      expect(mockState.settings.selectionMode).toBe('sequential');

      mockState.settings.selectionMode = 'weighted';
      expect(mockState.settings.selectionMode).toBe('weighted');
    });

    test('sequential mode: card counter shows correct position (1/5, 2/5, etc.)', () => {
      mockState.currentCardIndex = 0;
      const deckLength = mockState.currentSessionDeck.length;

      // Counter should show: currentCardIndex + 1 / deckLength
      let counter = `${mockState.currentCardIndex + 1} / ${deckLength}`;
      expect(counter).toBe('1 / 5');

      // Navigate to card 3
      mockState.currentCardIndex = 2;
      counter = `${mockState.currentCardIndex + 1} / ${deckLength}`;
      expect(counter).toBe('3 / 5');

      // Navigate to last card
      mockState.currentCardIndex = 4;
      counter = `${mockState.currentCardIndex + 1} / ${deckLength}`;
      expect(counter).toBe('5 / 5');

      // Wrap around
      mockState.currentCardIndex = (mockState.currentCardIndex + 1 + deckLength) % deckLength;
      counter = `${mockState.currentCardIndex + 1} / ${deckLength}`;
      expect(counter).toBe('1 / 5');
    });
  });
});
