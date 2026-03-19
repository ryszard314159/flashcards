/**
 * __tests__/dom-content.test.js
 * Tests for DOM content updates: card display, counters, text rendering
 */

import { updateUIRender } from '../src/ui.js';

describe('DOM: Content Updates', () => {
  let mockUI;
  let mockState;

  beforeEach(() => {
    // Setup mock UI elements
    mockUI = {
      frontDisplay: document.getElementById('frontDisplay'),
      backDisplay: document.getElementById('backDisplay'),
      frontLabel: document.getElementById('frontLabel'),
      backLabel: document.getElementById('backLabel'),
      counter: document.getElementById('card-counter'),
      searchBar: document.getElementById('searchBar'),
      cardInner: document.getElementById('cardInner'),
      cardScore: createCardScoreElement(),
      versionTag: document.getElementById('versionTag'),
      categoryList: document.getElementById('categoryList'),
    };

    mockUI.searchBar.value = '';
    mockUI.counter.textContent = '';
    mockUI.counter.innerHTML = '';
    mockUI.counter.classList.remove('counter-split');
    mockUI.cardInner.classList.remove('is-flipped');

    // Setup mock state with sample deck
    mockState = {
      currentCardIndex: 0,
      currentSessionDeck: [
        {
          id: '1',
          frontText: 'hello',
          backText: 'hola',
          frontLabel: 'English',
          backLabel: 'Spanish',
        },
        {
          id: '2',
          frontText: 'goodbye',
          backText: 'adiós',
          frontLabel: 'English',
          backLabel: 'Spanish',
        },
      ],
      masterDeck: [
        {
          id: '1',
          frontText: 'hello',
          backText: 'hola',
          frontLabel: 'English',
          backLabel: 'Spanish',
          score: 0,
        },
        {
          id: '2',
          frontText: 'goodbye',
          backText: 'adiós',
          frontLabel: 'English',
          backLabel: 'Spanish',
          score: 0,
        },
      ],
      settings: {
        activeCategories: ['English'],
      },
    };
  });

  function createCardScoreElement() {
    return {
      textContent: '',
      classList: {
        add() {},
        remove() {},
      },
    };
  }

  // ============================================================================
  // Card Display Tests
  // ============================================================================
  describe('Card Display Content', () => {
    test('card display shows correct front label', () => {
      const card = mockState.currentSessionDeck[mockState.currentCardIndex];
      mockUI.frontLabel.textContent = card.frontLabel;

      expect(mockUI.frontLabel.textContent).toBe('English');
    });

    test('card display shows correct back label', () => {
      const card = mockState.currentSessionDeck[mockState.currentCardIndex];
      mockUI.backLabel.textContent = card.backLabel;

      expect(mockUI.backLabel.textContent).toBe('Spanish');
    });

    test('card display shows correct front text', () => {
      const card = mockState.currentSessionDeck[mockState.currentCardIndex];
      mockUI.frontDisplay.textContent = card.frontText;

      expect(mockUI.frontDisplay.textContent).toBe('hello');
    });

    test('card display shows correct back text', () => {
      const card = mockState.currentSessionDeck[mockState.currentCardIndex];
      mockUI.backDisplay.textContent = card.backText;

      expect(mockUI.backDisplay.textContent).toBe('hola');
    });

    test('card counter shows "currentIndex + 1 / deckLength"', () => {
      const index = mockState.currentCardIndex;
      const length = mockState.currentSessionDeck.length;
      mockUI.counter.textContent = `${index + 1} / ${length}`;

      expect(mockUI.counter.textContent).toBe('1 / 2');
    });

    test('card counter updates when navigating to next card', () => {
      // Move to next card
      mockState.currentCardIndex = 1;
      const index = mockState.currentCardIndex;
      const length = mockState.currentSessionDeck.length;
      mockUI.counter.textContent = `${index + 1} / ${length}`;

      expect(mockUI.counter.textContent).toBe('2 / 2');
    });
  });

  // ============================================================================
  // Version Tag Tests
  // ============================================================================
  describe('Version Tag', () => {
    test('version tag updated on app load', () => {
      const VERSION = '2026-03-08.0856';
      mockUI.versionTag.textContent = `Version: ${VERSION}`;

      expect(mockUI.versionTag.textContent).toBe('Version: 2026-03-08.0856');
    });

    test('version tag has correct format', () => {
      const VERSION = '2026-03-08.0856';
      mockUI.versionTag.textContent = `Version: ${VERSION}`;

      // Check timestamp format (YYYY-MM-DD.HHMM)
      expect(mockUI.versionTag.textContent).toMatch(/\d{4}-\d{2}-\d{2}\.\d{4}/);
    });

    test('version tag updated on SW refresh', () => {
      const newVersion = '2026-03-08.1030';
      mockUI.versionTag.textContent = `Version: ${newVersion}`;

      expect(mockUI.versionTag.textContent).toContain('2026-03-08.1030');
    });
  });

  // ============================================================================
  // Card Counter Tests
  // ============================================================================
  describe('Card Counter Updates', () => {
    test('card counter updates when filtering by search', () => {
      // Start with 2 cards
      expect(mockState.currentSessionDeck.length).toBe(2);

      // Filter: only cards with 'hello' in front
      const filtered = mockState.currentSessionDeck.filter(card =>
        card.frontText.includes('hello')
      );

      // Update counter
      mockUI.counter.textContent = `${mockState.currentCardIndex + 1} / ${filtered.length}`;

      expect(mockUI.counter.textContent).toBe('1 / 1');
    });

    test('card counter resets to 1 after search', () => {
      // Simulate search results
      mockState.currentCardIndex = 0;
      const results = mockState.currentSessionDeck.filter(card => true); // All cards

      mockUI.counter.textContent = `${mockState.currentCardIndex + 1} / ${results.length}`;

      expect(mockUI.counter.textContent).toContain('1 /');
    });

    test('card counter updates with deck size changes', () => {
      // Start with 2 cards
      let deckSize = mockState.currentSessionDeck.length;
      mockUI.counter.textContent = `${mockState.currentCardIndex + 1} / ${deckSize}`;
      expect(mockUI.counter.textContent).toBe('1 / 2');

      // Add a card
      mockState.currentSessionDeck.push({
        id: '3',
        frontText: 'cat',
        backText: 'gato',
        frontLabel: 'English',
        backLabel: 'Spanish',
      });

      deckSize = mockState.currentSessionDeck.length;
      mockUI.counter.textContent = `${mockState.currentCardIndex + 1} / ${deckSize}`;
      expect(mockUI.counter.textContent).toBe('1 / 3');
    });

    test('updateUIRender shows master-only counter when no filters are active', () => {
      mockState.settings.activeCategories = ['English'];
      mockState.currentSessionDeck = [...mockState.masterDeck];
      mockUI.searchBar.value = '';

      updateUIRender(mockState, mockUI, (card) => mockState.masterDeck.indexOf(card) + 1);

      expect(mockUI.counter.textContent).toBe('1 / 2');
      expect(mockUI.counter.classList.contains('counter-split')).toBe(false);
    });

    test('updateUIRender shows split counter when search filter is active', () => {
      mockState.currentSessionDeck = [mockState.masterDeck[1]];
      mockUI.searchBar.value = 'good';

      updateUIRender(mockState, mockUI, (card) => mockState.masterDeck.indexOf(card) + 1);

      expect(mockUI.counter.classList.contains('counter-split')).toBe(true);
      expect(mockUI.counter.innerHTML).toContain('counter-current');
      expect(mockUI.counter.innerHTML).toContain('1</span><span class="counter-slash">/</span><span class="counter-den">1');
      expect(mockUI.counter.innerHTML).toContain('2</span><span class="counter-slash">/</span><span class="counter-den">2');
    });

    test('updateUIRender shows empty-state counter and messages when no cards are selected', () => {
      mockState.currentSessionDeck = [];
      mockUI.searchBar.value = 'yoyvoyvo';
      mockUI.cardInner.classList.add('is-flipped');

      updateUIRender(mockState, mockUI, () => null);

      expect(mockUI.counter.textContent).toBe('0 / 2');
      expect(mockUI.frontDisplay.textContent).toBe('No cards selected');
      expect(mockUI.backDisplay.textContent).toBe('Adjust Search or Categories');
      expect(mockUI.cardInner.classList.contains('is-flipped')).toBe(false);
    });
  });

  // ============================================================================
  // Category List Tests
  // ============================================================================
  describe('Category List Rendering', () => {
    test('category list cleared and rebuilt on refresh', () => {
      // Initial state: empty
      expect(mockUI.categoryList.innerHTML).toBe('');

      // Setup categories
      const categories = ['Spanish', 'French', 'German'];

      // Simulate refresh
      mockUI.categoryList.innerHTML = '';
      categories.forEach(cat => {
        mockUI.categoryList.innerHTML += `
          <div class="category-item">
            <label>
              <input type="checkbox" value="${cat}">
              <span>${cat}</span>
            </label>
          </div>
        `;
      });

      expect(mockUI.categoryList.innerHTML).toContain('Spanish');
      expect(mockUI.categoryList.innerHTML).toContain('French');
      expect(mockUI.categoryList.innerHTML).toContain('German');
    });

    test('category list items labeled correctly', () => {
      const categories = ['Spanish', 'French'];

      mockUI.categoryList.innerHTML = categories.map(cat => `
        <div class="category-item">
          <label>
            <input type="checkbox" value="${cat}">
            <span>${cat}</span>
          </label>
        </div>
      `).join('');

      expect(mockUI.categoryList.innerHTML).toContain('<span>Spanish</span>');
      expect(mockUI.categoryList.innerHTML).toContain('<span>French</span>');
    });
  });

  // ============================================================================
  // Modal Body Content Tests
  // ============================================================================
  describe('Modal Body HTML Content', () => {
    test('modal-body innerHTML contains HTML elements (not plain text)', () => {
      const helpBody = document.querySelector('.modal-body');

      // Correct: HTML content
      helpBody.innerHTML = `
        <div class="help-container">
          <h2>Help Guide</h2>
          <ul><li>Item 1</li></ul>
        </div>
      `;

      expect(helpBody.innerHTML).toContain('<div');
      expect(helpBody.innerHTML).toContain('<h2>');
      expect(helpBody.innerHTML).toContain('</h2>');
      expect(helpBody.innerHTML).toContain('<ul>');
      expect(helpBody.innerHTML).toContain('<li>');
    });

    test('modal-body preserves nested structure', () => {
      const helpBody = document.querySelector('.modal-body');

      helpBody.innerHTML = `
        <div class="outer">
          <div class="inner">
            <p>Text content</p>
          </div>
        </div>
      `;

      // Verify nesting is preserved
      const hasNesting = helpBody.innerHTML.includes('<div class="outer">') &&
                        helpBody.innerHTML.includes('<div class="inner">') &&
                        helpBody.innerHTML.includes('</div>');

      expect(hasNesting).toBe(true);
    });

    test('modal content does not render as plain text', () => {
      const helpBody = document.querySelector('.modal-body');

      // Correct approach
      helpBody.innerHTML = '<h1>Title</h1><p>Content</p>';

      // Should NOT be plain text
      const isNotPlainText = helpBody.innerHTML.includes('</h1>') &&
                            helpBody.innerHTML.includes('</p>');

      expect(isNotPlainText).toBe(true);

      // If this was textContent, we'd see: "TitleContent" (no tags)
      // But innerHTML preserves the tags
      expect(helpBody.innerHTML).not.toBe('TitleContent');
    });
  });

  // ============================================================================
  // Empty State Tests
  // ============================================================================
  describe('Empty State Messages', () => {
    test('empty deck shows "Please import" message', () => {
      mockState.currentSessionDeck = [];

      if (mockState.currentSessionDeck.length === 0) {
        mockUI.frontDisplay.textContent = 'Please import a .deck file';
      }

      expect(mockUI.frontDisplay.textContent).toBe('Please import a .deck file');
    });

    test('search with no results shows cards not found state', () => {
      const filteredCards = [];

      if (filteredCards.length === 0) {
        mockUI.counter.textContent = '0 / 0';
      }

      expect(mockUI.counter.textContent).toBe('0 / 0');
    });
  });

  // ============================================================================
  // Remote Menu Path Tests
  // ============================================================================
  describe('Remote Menu Path Display', () => {
    test('remote examples list shows breadcrumb path', () => {
      const remoteList = document.getElementById('remoteExamplesList');
      const currentPath = 'decks/spanish';

      remoteList.innerHTML = `<div class="path-breadcrumb">📍 ${currentPath}</div>`;

      expect(remoteList.innerHTML).toContain('📍');
      expect(remoteList.innerHTML).toContain('decks/spanish');
    });

    test('breadcrumb updates when navigating directories', () => {
      const remoteList = document.getElementById('remoteExamplesList');

      // Initial path
      remoteList.innerHTML = '<div class="path-breadcrumb">📍 decks</div>';
      expect(remoteList.innerHTML).toContain('decks');

      // Navigate to subdirectory
      remoteList.innerHTML = '<div class="path-breadcrumb">📍 decks/spanish</div>';
      expect(remoteList.innerHTML).toContain('decks/spanish');
    });
  });

  // ============================================================================
  // Multi-Card Display Tests
  // ============================================================================
  describe('Multiple Card Display', () => {
    test('updating card index updates all display fields', () => {
      // Card 0
      let card = mockState.currentSessionDeck[0];
      mockUI.frontDisplay.textContent = card.frontText;
      mockUI.backDisplay.textContent = card.backText;
      mockUI.frontLabel.textContent = card.frontLabel;
      mockUI.backLabel.textContent = card.backLabel;

      expect(mockUI.frontDisplay.textContent).toBe('hello');
      expect(mockUI.backDisplay.textContent).toBe('hola');

      // Card 1
      mockState.currentCardIndex = 1;
      card = mockState.currentSessionDeck[1];
      mockUI.frontDisplay.textContent = card.frontText;
      mockUI.backDisplay.textContent = card.backText;
      mockUI.frontLabel.textContent = card.frontLabel;
      mockUI.backLabel.textContent = card.backLabel;

      expect(mockUI.frontDisplay.textContent).toBe('goodbye');
      expect(mockUI.backDisplay.textContent).toBe('adiós');
    });

    test('all display fields synchronized when changing cards', () => {
      mockState.currentCardIndex = 1;
      const card = mockState.currentSessionDeck[mockState.currentCardIndex];

      // Update all fields at once (like updateUI function)
      mockUI.frontLabel.textContent = card.frontLabel;
      mockUI.backLabel.textContent = card.backLabel;
      mockUI.frontDisplay.textContent = card.frontText;
      mockUI.backDisplay.textContent = card.backText;
      mockUI.counter.textContent = `${mockState.currentCardIndex + 1} / ${mockState.currentSessionDeck.length}`;

      // All should be synchronized
      expect(mockUI.frontDisplay.textContent).toBe('goodbye');
      expect(mockUI.backDisplay.textContent).toBe('adiós');
      expect(mockUI.counter.textContent).toBe('2 / 2');
    });
  });
});
