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
