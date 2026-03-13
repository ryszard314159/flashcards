/**
 * jest.setup.js - Global test setup and mocks
 * Sets up localStorage, fetch API, and other browser APIs for testing
 */

// Mock localStorage
const localStorageMock = {
  store: {},
  getItem(key) {
    return this.store[key] || null;
  },
  setItem(key, value) {
    this.store[key] = String(value);
  },
  removeItem(key) {
    delete this.store[key];
  },
  clear() {
    this.store = {};
  }
};

global.localStorage = localStorageMock;

// Mock fetch API - will be properly mocked in each test file using jest.fn()
// For now, provide a fallback
if (!global.fetch) {
  global.fetch = async (url, options) => {
    return {
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
      text: () => Promise.resolve(''),
    };
  };
}

// Mock window.speechSynthesis
global.speechSynthesis = {
  cancel: () => {},
  speak: () => {},
};

// Mock SpeechSynthesisUtterance
global.SpeechSynthesisUtterance = function(text) {
  this.text = text;
  this.rate = 1.0;
  this.lang = 'en-US';
};

// ============================================================================
// JSDOM DOM Element Mocks (for DOM integration tests)
// ============================================================================

// Helper to create a mock element with classList and event handling
function createMockElement(id) {
  return {
    id,
    innerHTML: '',
    textContent: '',
    value: '',
    checked: false,
    classList: {
      _classes: new Set(),
      add(...names) {
        names.forEach(name => this._classes.add(name));
      },
      remove(...names) {
        names.forEach(name => this._classes.delete(name));
      },
      toggle(name, force) {
        if (force === undefined) {
          if (this._classes.has(name)) {
            this._classes.delete(name);
          } else {
            this._classes.add(name);
          }
        } else if (force) {
          this._classes.add(name);
        } else {
          this._classes.delete(name);
        }
      },
      contains(name) {
        return this._classes.has(name);
      },
    },
    appendChild() {},
    removeChild() {},
    addEventListener() {},
    dispatchEvent() {},
    closest() {
      return null;
    },
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
  };
}

// Create mock UI elements for tests
// Keys must match the HTML id attributes they represent
const mockElements = {
  'helpOverlay': createMockElement('helpOverlay'),
  'settingsOverlay': createMockElement('settingsOverlay'),
  'deckOverlay': createMockElement('deckOverlay'),
  'importOverlay': createMockElement('importOverlay'),
  'menuOverlay': createMockElement('menuOverlay'),
  'cardInner': createMockElement('cardInner'),
  'sessionSize': createMockElement('sessionSize'),
  'tempInput': createMockElement('tempInput'),
  'speechRateInput': createMockElement('speechRateInput'),
  'frontVoiceSearch': createMockElement('frontVoiceSearch'),
  'frontVoiceSelect': createMockElement('frontVoiceSelect'),
  'backVoiceSearch': createMockElement('backVoiceSearch'),
  'backVoiceSelect': createMockElement('backVoiceSelect'),
  'searchBar': createMockElement('searchBar'),
  'frontDisplay': createMockElement('frontDisplay'),
  'backDisplay': createMockElement('backDisplay'),
  'frontLabel': createMockElement('frontLabel'),
  'backLabel': createMockElement('backLabel'),
  'card-counter': createMockElement('card-counter'),
  'categoryList': createMockElement('categoryList'),
  'remoteExamplesList': createMockElement('remoteExamplesList'),
  'versionTag': createMockElement('versionTag'),
};

// Mock document.getElementById for JSDOM tests
const originalGetElementById = document.getElementById;
document.getElementById = function(id) {
  return mockElements[id] || originalGetElementById.call(document, id);
};

// Mock document.querySelector for finding mock elements
const originalQuerySelector = document.querySelector;
document.querySelector = function(selector) {
  if (selector === '.modal-body') {
    return createMockElement('modal-body');
  }
  if (selector === '.modal-overlay') {
    return mockElements.helpOverlay;
  }
  return originalQuerySelector.call(document, selector);
};

