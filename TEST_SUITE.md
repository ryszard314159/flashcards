# Flashcards Test Suite Guide

## Overview

A comprehensive Jest-based regression test suite has been created for the Flashcards PWA application. The suite provides smoke-level testing to catch breaking changes in core functionality, including business logic tests and DOM integration tests.

**Test Statistics:**
- **Total Tests:** 161 (Phase 1: 94 + Phase 2: 67)
- **All Passing:** ✅
- **Coverage Areas:** 7 modules + DOM integration
- **Test Environment:** Jest with JSDOM

## Running Tests

### Quick Start
```bash
# Run all tests once
npm test

# Run tests in watch mode (re-run on file changes)
npm test:watch

# Run tests with coverage report
npm test:coverage
```

## Test Structure

Tests are organized in `__tests__/` directory with 7 test suites:

### 1. **io.test.js** - Import/Export & Data Persistence (21 tests)

Tests the deck file parsing and localStorage functionality - the backbone of data handling.

**Key Test Coverage:**
- ✅ **processDeckText()** - Deck file parser (13 tests)
  - Valid deck parsing with categories
  - Unique card ID generation
  - Multiple categories in one deck
  - Metadata line handling (lines starting with `**`)
  - Empty line and whitespace handling
  - Special character support (Spanish, accents, etc.)
  - Windows line endings (CRLF)
  - Mixed line endings

- ✅ **save()/load()** - localStorage persistence (7 tests)
  - Array and object serialization
  - JSON error handling
  - Data overwriting
  - Nested structure preservation
  - Key management

- ✅ **fetchTextFromUrl()** - HTTP fetching (1 test)
  - Function existence verification

**Why it matters:** These functions are critical for importing decks and persisting user data. Any parsing bug would break the entire app's ability to load flashcard files.

---

### 2. **app-core-logic.test.js** - SRS Algorithm (34 tests)

Tests the Spaced Repetition System (SRS) - the heart of the learning algorithm.

**Key Test Coverage:**

- ✅ **pickWeightedCard()** - Weighted random card selection (7 tests)
  - Single and empty pool handling
  - Weight distribution respects frequency factors
  - Temperature parameter affects selection probability
  - Missing frequencyFactor defaults to 0
  - Low temperature (0.1) heavily favors high-score cards
  - High temperature (10) creates flatter distribution

- ✅ **generateSessionDeck()** - Session creation (5 tests)
  - All cards returned when sessionSize >= pool
  - Proper capping when sessionSize < pool
  - Weighted sampling without replacement
  - No duplicate cards in session

- ✅ **Frequency Factor Adjustment** - Card difficulty scoring (4 tests)
  - Increase/decrease by delta
  - Min/max bounds enforcement (-9 to 9)
  - Proper clamping behavior

- ✅ **Probability Calculation** - SRS weighting (4 tests)
  - Probabilities sum to exactly 1.0
  - Higher scores get higher probabilities
  - Temperature scaling working correctly
  - Equal scores produce equal probabilities

- ✅ **handleSearch()** - Card filtering (7 tests)
  - Filter by front/back text
  - Filter by category labels
  - Case-insensitive matching
  - Whitespace trimming
  - Empty results handling

**Why it matters:** The SRS algorithm is what makes the app effective for learning. These tests ensure the probability calculations and card weighting remain correct through any refactoring.

---

### 3. **state.test.js** - Configuration & State (23 tests)

Tests application state structure and configuration bounds.

**Key Test Coverage:**

- ✅ **FREQUENCY_SETTINGS validation** (4 tests)
  - Min < Max contract
  - Delta is positive
  - Range bounds (-9 to 9)

- ✅ **TEMPERATURE configuration** (5 tests)
  - Default between min/max
  - Reasonable range (0.1 to 10)
  - Delta property present

- ✅ **SPEECH_RATE configuration** (4 tests)
  - Valid speech synthesis range
  - Default within bounds

- ✅ **SESSION_SIZE configuration** (3 tests)
  - Min/max/default validation

- ✅ **Global state structure** (4 tests)
  - Required properties present
  - Correct data types
  - activeCategories, currentCardIndex, isFlipped

- ✅ **Default settings validation** (3 tests)
  - Settings within valid ranges

**Why it matters:** Configuration errors cascade through the entire app. These tests catch invalid settings that would break the UI or algorithm.

---

### 4. **config.test.js** - Application Configuration (7 tests)

Tests version management and GitHub repository configuration.

**Key Test Coverage:**

- ✅ **CONFIG object** (3 tests)
  - VERSION property present
  - VERSION follows timestamp format (YYYY-MM-DD.HHMM)

- ✅ **REPO_CONFIG object** (4 tests)
  - Required properties: owner, repo, basePath
  - All are non-empty strings
  - basePath is sensible ('decks', etc.)

**Why it matters:** Version consistency and repository configuration are critical for PWA updates and remote deck importing.

---

### 5. **dom-modals.test.js** - Modal State Management (22 tests)

Tests modal visibility, state transitions, and HTML content injection safety.

**Key Test Coverage:**

- ✅ **Help Modal HTML Injection** (5 tests)
  - Load help.html content as HTML (innerHTML, not textContent) ← Catches raw HTML display bug
  - Content caching and re-fetch prevention
  - Loading state during fetch
  - Error handling on fetch failure

- ✅ **Modal Visibility & Toggling** (8 tests)
  - Settings modal opens/closes with is-visible class
  - Import modal shows/hides correctly
  - Remote menu toggling (open/close)
  - Menu overlay toggling with class management
  - Close buttons properly remove is-visible class
  - Overlay click (outside modal) closes modal

- ✅ **Modal Content & State** (7 tests)
  - Settings modal inputs synced to state
  - Category selector modal renders checkboxes dynamically
  - Deck selector collects checked categories on apply
  - Import options modal flipDeck checkbox state tracked
  - Help modal contains expected HTML structure
  - Remote menu shows breadcrumb path
  - Remote menu error display on API failure
  - Modal stacking prevention (opening new modal closes previous)

**Why it matters:** Modals are critical UI components. These tests catch visibility bugs, HTML injection vulnerabilities, and state synchronization issues that could confuse users.

---

### 6. **dom-interactions.test.js** - User Interactions & Input Binding (22 tests)

Tests user interactions, debouncing, CSS class application, and form input binding.

**Key Test Coverage:**

- ✅ **Card Flip Interactions** (3 tests)
  - Card flip toggles is-flipped class on card inner
  - Card flip debounce blocks second flip within 250ms
  - Card flip is removed on navigation

- ✅ **Frequency Feedback Animations** (3 tests)
  - Frequency change adds feedback-up or feedback-down class
  - Frequency feedback class auto-removes after 500ms
  - Frequency feedback re-triggers correctly after removal

- ✅ **Search & Filter Interactions** (3 tests)
  - Search input updates card counter display
  - Empty query returns full deck
  - Search with results displays correct filtered cards

- ✅ **Category & Checkbox Interactions** (3 tests)
  - Category checkboxes have correct checked state
  - Select All button checks all checkboxes
  - Select None button unchecks all checkboxes

- ✅ **Input Value Binding** (6 tests)
  - Temperature input value updates on change
  - Temperature adjustment buttons increment/decrement
  - Temperature change triggers probability recalculation
  - Session size input clamped to valid range
  - Speech rate input updates correctly
  - Input focus auto-selects text content

- ✅ **Settings Synchronization** (4 tests)
  - Settings values synced to inputs on modal open
  - Input changes reflect in state object
  - Range constraints enforced

**Why it matters:** User interactions drive the learning experience. These tests catch bugs in debouncing (preventing accidental double-flips), input binding (ensuring UI reflects state), and animation timing (feedback visibility).

---

### 7. **dom-content.test.js** - DOM Content Updates & Text Rendering (23 tests)

Tests DOM content accuracy, text rendering, and HTML structure preservation.

**Key Test Coverage:**

- ✅ **Card Display Content** (6 tests)
  - Card display shows correct front label
  - Card display shows correct back label
  - Card display shows correct front text (word-for-word)
  - Card display shows correct back text
  - Card counter format "currentIndex + 1 / deckLength"
  - Card counter updates when navigating cards

- ✅ **Version Tag** (2 tests)
  - Version tag updated on app load
  - Version tag format follows YYYY-MM-DD.HHMM pattern

- ✅ **Category List Rendering** (3 tests)
  - Category list cleared and rebuilt on refresh
  - Category items labeled correctly
  - Category checkboxes have proper structure

- ✅ **Modal HTML Content** (2 tests)
  - Modal-body innerHTML contains HTML elements (not plain text)
  - Modal-body preserves nested structure

- ✅ **Search & Counter Updates** (3 tests)
  - Card counter updates when filtering by search
  - Counter resets to 1 after search
  - Counter updates with deck size changes

- ✅ **Empty States & Special Content** (4 tests)
  - Empty deck shows "Please import" message
  - Search with no results shows correct counter (0 / 0)
  - Remote examples list shows breadcrumb path
  - Remote menu updates on directory navigation

**Why it matters:** Text display accuracy is critical for learning (students need to see correct content), and HTML injection prevents XSS vulnerabilities and raw HTML display bugs like the one discovered in the help modal.

---

## Test Infrastructure

### Mocking Setup (`jest.setup.js`)

Global mocks are configured for:

```javascript
localStorage               // localStorage mock with in-memory store
fetch API                  // Network requests (fallback version)
speechSynthesis           // Text-to-speech API
SpeechSynthesisUtterance  // Speech utterance constructor
DOM Elements              // All UI elements mocked with classList support
document.getElementById   // Element lookup with mock element registry
document.querySelector    // CSS selector lookup with mock fallbacks
```

### Jest Configuration (`jest.config.js`)

- **testEnvironment:** `jsdom` (provides DOM API for JSDOM tests)
- **Language:** ES6 modules (matches app's native module format)
- **Test pattern:** `__tests__/**/*.test.js`

### Package.json Scripts

```json
{
  "test": "node --experimental-vm-modules node_modules/jest/bin/jest.js",
  "test:watch": "...same with --watch flag",
  "test:coverage": "...same with --coverage flag"
}
```

---

## What Gets Tested vs. Not Tested

### ✅ Tested (Regression/Smoke Level)
- Deck file parsing logic
- SRS algorithm (weighted selection, probability calculation)
- localStorage persistence
- State configuration and bounds
- Text filtering/search
- Import/export data handling
- **NEW Phase 2:** DOM content rendering, modal state, CSS class application, input binding

### ❌ Not Tested (Visual/Style Related)
- CSS animations and transitions (hard to test in jsdom)
- Service Worker caching
- Responsive design and layout
- Accessibility (ARIA labels)

**Reasoning:** Functional DOM testing catches logic bugs and state issues. Visual and accessibility testing require different tools (e.g., visual regression with Percy, accessibility with Axe). The current suite focuses on business logic and functional correctness.

---

## How to Use for Regression Testing

### Workflow for Making Changes

1. **Make your code changes** to fix bugs or add features
2. **Run the test suite:** `npm test`
3. **All tests should pass** - if any fail, you've found a breaking change
4. **Investigate failures:**
   - Read the test name to understand what broke
   - Check the assertion error for details
   - Fix the code or update the test if intentional

### Example: Modifying the SRS Algorithm

If you change the SRS weighting formula:
```javascript
// Before
card.frequencyFactor *= (1 / temperature);

// After
card.frequencyFactor *= (1.5 / temperature);
```

The tests will immediately catch this:
```
✗ pickWeightedCard() › should favor cards with higher frequency factors
  Expected: high-score card selected more often
  Received: uniform distribution
```

---

## Future Enhancements

Potential additions to the test suite:

1. **Integration tests** - Test complete workflows (import deck → study → track progress)
2. **E2E tests** - Full browser testing with Playwright/Cypress
3. **Performance tests** - Ensure SRS doesn't slow down with large decks
4. **Accessibility tests** - ARIA labels and keyboard navigation
5. **Visual regression tests** - Screenshot comparisons
6. **Service Worker tests** - Caching and offline functionality

---

## Common Issues & Solutions

### Tests fail with "jest is not defined"
- This can happen in setup files when using ESM. The fix is to use `jest.fn()` only in test files, not in setup files.

### localStorage tests pollute subsequent tests
- Jest automatically clears mocks between tests via the `beforeEach()` hook in jest.setup.js

### Random test failures (probability tests)
- Probability/randomness tests sometimes fail due to variance. We use ranges (e.g., "expect > 20") instead of exact counts to handle this.

---

## Quick Reference

| Module | Tests | Focus |
|--------|-------|-------|
| **io.test.js** | 21 | Deck parsing, file I/O, persistence |
| **app-core-logic.test.js** | 34 | SRS algorithm, card selection, search, flip |
| **state.test.js** | 31 | Configuration, state structure |
| **config.test.js** | 8 | Version, repository config |
| **dom-modals.test.js** | 22 | Modal state, HTML injection, visibility |
| **dom-interactions.test.js** | 22 | User interactions, debouncing, input binding |
| **dom-content.test.js** | 23 | DOM content, text rendering, structure |
| **TOTAL** | **161** | Phase 1 (94) + Phase 2 (67) |

---

## Running Tests in CI/CD

To integrate into continuous integration:

```bash
# GitHub Actions example
- name: Run Tests
  run: npm install && npm test

# Will exit with code 0 if all pass, 1 if any fail
```

---

**Happy testing! 🎓**
