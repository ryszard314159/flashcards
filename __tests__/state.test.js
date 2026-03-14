/**
 * __tests__/state.test.js
 * Tests for application state and configuration validation
 */

import { SCORE_SETTINGS, TEMPERATURE, SPEECH_RATE, SESSION_SIZE, state } from '../src/state.js';
import { save, load, KEYS } from '../src/io.js';

describe('state.js - Application State', () => {
  // ============================================================================
  // SCORE_SETTINGS Validation
  // ============================================================================
  describe('SCORE_SETTINGS', () => {
    test('should have min, max, and delta properties', () => {
      expect(SCORE_SETTINGS).toHaveProperty('min');
      expect(SCORE_SETTINGS).toHaveProperty('max');
      expect(SCORE_SETTINGS).toHaveProperty('delta');
    });

    test('min should be less than max', () => {
      expect(SCORE_SETTINGS.min).toBeLessThan(SCORE_SETTINGS.max);
    });

    test('delta should be positive', () => {
      expect(SCORE_SETTINGS.delta).toBeGreaterThan(0);
    });

    test('max - min should be greater than delta', () => {
      const range = SCORE_SETTINGS.max - SCORE_SETTINGS.min;
      expect(range).toBeGreaterThan(SCORE_SETTINGS.delta);
    });

    test('should have reasonable bounds for -9 to 9 range', () => {
      expect(SCORE_SETTINGS.min).toEqual(-9);
      expect(SCORE_SETTINGS.max).toEqual(9);
    });
  });

  // ============================================================================
  // TEMPERATURE Configuration
  // ============================================================================
  describe('TEMPERATURE', () => {
    test('should have min, max, and default properties', () => {
      expect(TEMPERATURE).toHaveProperty('min');
      expect(TEMPERATURE).toHaveProperty('max');
      expect(TEMPERATURE).toHaveProperty('default');
      expect(TEMPERATURE).toHaveProperty('delta');
    });

    test('min should be less than max', () => {
      expect(TEMPERATURE.min).toBeLessThan(TEMPERATURE.max);
    });

    test('default should be between min and max', () => {
      expect(TEMPERATURE.default).toBeGreaterThanOrEqual(TEMPERATURE.min);
      expect(TEMPERATURE.default).toBeLessThanOrEqual(TEMPERATURE.max);
    });

    test('delta should be positive', () => {
      expect(TEMPERATURE.delta).toBeGreaterThan(0);
    });

    test('should have reasonable range (0.1 to 10)', () => {
      expect(TEMPERATURE.min).toBeLessThanOrEqual(0.2);
      expect(TEMPERATURE.max).toBeGreaterThanOrEqual(10);
    });
  });

  // ============================================================================
  // SPEECH_RATE Configuration
  // ============================================================================
  describe('SPEECH_RATE', () => {
    test('should have min, max, and default properties', () => {
      expect(SPEECH_RATE).toHaveProperty('min');
      expect(SPEECH_RATE).toHaveProperty('max');
      expect(SPEECH_RATE).toHaveProperty('default');
      expect(SPEECH_RATE).toHaveProperty('delta');
    });

    test('min should be less than max', () => {
      expect(SPEECH_RATE.min).toBeLessThan(SPEECH_RATE.max);
    });

    test('default should be between min and max', () => {
      expect(SPEECH_RATE.default).toBeGreaterThanOrEqual(SPEECH_RATE.min);
      expect(SPEECH_RATE.default).toBeLessThanOrEqual(SPEECH_RATE.max);
    });

    test('should have reasonable range for speech synthesis', () => {
      expect(SPEECH_RATE.min).toBeLessThanOrEqual(0.7);
      expect(SPEECH_RATE.max).toBeGreaterThanOrEqual(1.3);
    });
  });

  // ============================================================================
  // SESSION_SIZE Configuration
  // ============================================================================
  describe('SESSION_SIZE', () => {
    test('should have min, max, and default properties', () => {
      expect(SESSION_SIZE).toHaveProperty('min');
      expect(SESSION_SIZE).toHaveProperty('max');
      expect(SESSION_SIZE).toHaveProperty('default');
    });

    test('min should be 0 (for all cards)', () => {
      expect(SESSION_SIZE.min).toBe(0);
    });

    test('max should be positive', () => {
      expect(SESSION_SIZE.max).toBeGreaterThan(0);
    });

    test('default should be between min and max', () => {
      expect(SESSION_SIZE.default).toBeGreaterThanOrEqual(SESSION_SIZE.min);
      expect(SESSION_SIZE.default).toBeLessThanOrEqual(SESSION_SIZE.max);
    });
  });

  // ============================================================================
  // Global State Structure
  // ============================================================================
  describe('Global State Object', () => {
    test('should have required properties', () => {
      expect(state).toHaveProperty('masterDeck');
      expect(state).toHaveProperty('currentSessionDeck');
      expect(state).toHaveProperty('settings');
    });

    test('masterDeck should be an array', () => {
      expect(Array.isArray(state.masterDeck)).toBe(true);
    });

    test('currentSessionDeck should be an array', () => {
      expect(Array.isArray(state.currentSessionDeck)).toBe(true);
    });

    test('settings should be an object', () => {
      expect(typeof state.settings).toBe('object');
      expect(state.settings).not.toBeNull();
    });

    test('should have activeCategories array in settings', () => {
      expect(Array.isArray(state.settings.activeCategories)).toBe(true);
    });

    test('should have currentCardIndex', () => {
      expect(typeof state.currentCardIndex).toBe('number');
    });

    test('should have isFlipped boolean', () => {
      expect(typeof state.isFlipped).toBe('boolean');
    });
  });

  // ============================================================================
  // Settings Structure
  // ============================================================================
  describe('Default Settings', () => {
    test('should have temperature setting', () => {
      expect(state.settings).toHaveProperty('temperature');
      expect(typeof state.settings.temperature).toBe('number');
    });

    test('should have speechRate setting', () => {
      expect(state.settings).toHaveProperty('speechRate');
      expect(typeof state.settings.speechRate).toBe('number');
    });

    test('should have sessionSize setting', () => {
      expect(state.settings).toHaveProperty('sessionSize');
      expect(typeof state.settings.sessionSize).toBe('number');
    });

    test('should have frontVoice and backVoice settings', () => {
      expect(state.settings).toHaveProperty('frontVoice');
      expect(state.settings).toHaveProperty('backVoice');
      expect(typeof state.settings.frontVoice).toBe('string');
      expect(typeof state.settings.backVoice).toBe('string');
    });

    test('temperature should be within valid range', () => {
      expect(state.settings.temperature).toBeGreaterThanOrEqual(TEMPERATURE.min);
      expect(state.settings.temperature).toBeLessThanOrEqual(TEMPERATURE.max);
    });

    test('speechRate should be within valid range', () => {
      expect(state.settings.speechRate).toBeGreaterThanOrEqual(SPEECH_RATE.min);
      expect(state.settings.speechRate).toBeLessThanOrEqual(SPEECH_RATE.max);
    });

    test('sessionSize should be within valid range', () => {
      expect(state.settings.sessionSize).toBeGreaterThanOrEqual(SESSION_SIZE.min);
      expect(state.settings.sessionSize).toBeLessThanOrEqual(SESSION_SIZE.max);
    });

    test('voice settings should default to auto-detect', () => {
      expect(state.settings.frontVoice).toBe('');
      expect(state.settings.backVoice).toBe('');
    });
  });

  // ============================================================================
  // Category persistence round-trip
  // ============================================================================
  describe('activeCategories persistence', () => {
    afterEach(() => {
      localStorage.clear();
      state.settings.activeCategories = [];
    });

    test('activeCategories is included when settings are saved', () => {
      state.settings.activeCategories = ['Spanish', 'German'];
      save(KEYS.SETTINGS, state.settings);

      const loaded = load(KEYS.SETTINGS);
      expect(loaded.activeCategories).toEqual(['Spanish', 'German']);
    });

    test('activeCategories survives a full save/load round-trip', () => {
      state.settings.activeCategories = ['Biology', 'Chemistry'];
      save(KEYS.SETTINGS, state.settings);

      // Simulate what init() does on reload
      const restored = load(KEYS.SETTINGS);
      const mergedSettings = { ...state.settings, ...restored };

      expect(mergedSettings.activeCategories).toEqual(['Biology', 'Chemistry']);
    });

    test('empty activeCategories is preserved (not dropped) on round-trip', () => {
      state.settings.activeCategories = [];
      save(KEYS.SETTINGS, state.settings);

      const loaded = load(KEYS.SETTINGS);
      expect(Array.isArray(loaded.activeCategories)).toBe(true);
      expect(loaded.activeCategories).toHaveLength(0);
    });

    test('other settings are unaffected when activeCategories changes', () => {
      state.settings.activeCategories = ['French'];
      state.settings.temperature = 2.0;
      save(KEYS.SETTINGS, state.settings);

      const loaded = load(KEYS.SETTINGS);
      expect(loaded.activeCategories).toEqual(['French']);
      expect(loaded.temperature).toBe(2.0);
    });
  });
});
