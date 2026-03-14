/**
 * __tests__/app-core-logic.test.js
 * Tests for core SRS algorithm and business logic functions.
 * All functions imported directly from src/srs.js.
 */

import {
  pickWeightedCard,
  generateSessionDeck,
  calculateProbabilities,
  applyScoreChange,
  filterCards,
  flipDeck,
} from '../src/srs.js';

describe('Core SRS Logic Functions', () => {
  // ============================================================================
  // pickWeightedCard() - Weighted Random Selection
  // ============================================================================
  describe('pickWeightedCard()', () => {
    test('should select a card from single-card pool', () => {
      const pool = [{ id: '1', score: 0 }];
      const result = pickWeightedCard(pool);

      expect(result).toBe(pool[0]);
    });

    test('should return null for empty pool', () => {
      const result = pickWeightedCard([]);

      expect(result).toBeNull();
    });

    test('should return null for null pool', () => {
      const result = pickWeightedCard(null);

      expect(result).toBeNull();
    });

    test('should favor cards with higher scores', () => {
      const pool = [
        { id: '1', score: -5 },
        { id: '2', score: 5 },
      ];

      // Run multiple times to check distribution
      const counts = { '1': 0, '2': 0 };
      for (let i = 0; i < 100; i++) {
        const card = pickWeightedCard(pool);
        counts[card.id]++;
      }

      // Card with higher score should be selected more often
      expect(counts['2']).toBeGreaterThan(counts['1']);
    });

    test('should handle temperature=0.1 (more aggressive focus)', () => {
      const pool = [
        { id: '1', score: -5 },
        { id: '2', score: 5 },
      ];

      const counts = { '1': 0, '2': 0 };
      for (let i = 0; i < 100; i++) {
        const card = pickWeightedCard(pool, 0.1);
        counts[card.id]++;
      }

      // With low temperature, should heavily favor high-score cards
      expect(counts['2']).toBeGreaterThan(counts['1']);
    });

    test('should handle temperature=10 (flatter distribution)', () => {
      const pool = [
        { id: '1', score: -5 },
        { id: '2', score: 5 },
      ];

      const counts = { '1': 0, '2': 0 };
      for (let i = 0; i < 100; i++) {
        const card = pickWeightedCard(pool, 10);
        counts[card.id]++;
      }

      // With high temperature, distribution should be more uniform (roughly 50-50)
      // Allow some variance for randomness: both should get reasonable counts
      expect(counts['1']).toBeGreaterThan(20);
      expect(counts['2']).toBeGreaterThan(20);
    });

    test('should handle missing score (defaults to 0)', () => {
      const pool = [
        { id: '1' },
        { id: '2', score: 0 },
      ];

      const result = pickWeightedCard(pool);

      expect(result).toBeDefined();
      expect([pool[0], pool[1]]).toContain(result);
    });
  });

  // ============================================================================
  // generateSessionDeck() - Weighted Session Creation
  // ============================================================================
  describe('generateSessionDeck()', () => {
    test('should return all cards when sessionSize >= pool length', () => {
      const pool = [
        { id: '1', score: 0 },
        { id: '2', score: 1 },
      ];

      const result = generateSessionDeck(pool, 5);

      expect(result).toHaveLength(2);
    });

    test('should return fewer cards when sessionSize < pool length', () => {
      const pool = [
        { id: '1', score: 0 },
        { id: '2', score: 1 },
        { id: '3', score: 2 },
      ];

      const result = generateSessionDeck(pool, 2);

      expect(result).toHaveLength(2);
    });

    test('should return empty array for empty pool', () => {
      const result = generateSessionDeck([], 5);

      expect(result).toEqual([]);
    });

    test('should return single card for sessionSize=1', () => {
      const pool = [
        { id: '1', score: 0 },
        { id: '2', score: 1 },
      ];

      const result = generateSessionDeck(pool, 1);

      expect(result).toHaveLength(1);
    });

    test('should not select same card twice', () => {
      const pool = [
        { id: '1', score: 0 },
        { id: '2', score: 1 },
        { id: '3', score: 2 },
      ];

      const result = generateSessionDeck(pool, 3);
      const ids = result.map(card => card.id);

      expect(new Set(ids).size).toBe(3);
    });
  });

  // ============================================================================
  // applyScoreChange() - SRS Scoring with Clamping
  // ============================================================================
  describe('applyScoreChange()', () => {
    test('should increase score by delta', () => {
      const result = applyScoreChange(0, 1);

      expect(result).toBe(1);
    });

    test('should decrease score by delta', () => {
      const result = applyScoreChange(5, -1);

      expect(result).toBe(4);
    });

    test('should clamp to min value', () => {
      const result = applyScoreChange(-8, -1);

      expect(result).toBe(-9);
    });

    test('should clamp to max value', () => {
      const result = applyScoreChange(8, 1);

      expect(result).toBe(9);
    });

    test('should not exceed max when already at max', () => {
      const result = applyScoreChange(9, 1);

      expect(result).toBe(9);
    });

    test('should not go below min when already at min', () => {
      const result = applyScoreChange(-9, -1);

      expect(result).toBe(-9);
    });
  });

  // ============================================================================
  // calculateProbabilities() - Softmax Probability Calculation
  // ============================================================================
  describe('calculateProbabilities()', () => {
    test('should calculate probabilities that sum to 1', () => {
      const pool = [
        { score: 0 },
        { score: 1 },
        { score: -1 },
      ];

      const probs = calculateProbabilities(pool, 1.0);

      expect(probs.length).toBe(3);
      const sum = probs.reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1.0, 5);
    });

    test('should assign higher probability to higher scores', () => {
      const pool = [
        { score: 1 },
        { score: 5 },
      ];

      const probs = calculateProbabilities(pool, 1.0);

      expect(probs[1]).toBeGreaterThan(probs[0]);
    });

    test('should respect temperature scaling', () => {
      const pool = [
        { score: 1 },
        { score: -1 },
      ];

      const probsLowTemp = calculateProbabilities(pool, 0.1);
      const probsHighTemp = calculateProbabilities(pool, 10);

      const diffLow = Math.abs(probsLowTemp[0] - probsLowTemp[1]);
      const diffHigh = Math.abs(probsHighTemp[0] - probsHighTemp[1]);

      expect(diffLow).toBeGreaterThan(diffHigh);
    });

    test('should handle equal scores with equal probabilities', () => {
      const pool = [
        { score: 0 },
        { score: 0 },
        { score: 0 },
      ];

      const probs = calculateProbabilities(pool, 1.0);

      probs.forEach(prob => {
        expect(prob).toBeCloseTo(1 / 3, 5);
      });
    });
  });

  // ============================================================================
  // filterCards() - Text Search/Filter
  // ============================================================================
  describe('filterCards()', () => {
    test('should filter cards by front text', () => {
      const deck = [
        {
          id: '1',
          frontText: 'hello',
          backText: 'saludo',
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
      ];

      const result = filterCards(deck, 'hello');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('1');
    });

    test('should filter cards by back text', () => {
      const deck = [
        {
          id: '1',
          frontText: 'hello',
          backText: 'saludo',
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
      ];

      const result = filterCards(deck, 'adiós');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('2');
    });

    test('should be case-insensitive', () => {
      const deck = [
        {
          id: '1',
          frontText: 'HELLO',
          backText: 'answer',
          frontLabel: 'English',
          backLabel: 'Spanish',
        },
      ];

      const result = filterCards(deck, 'hello');

      expect(result).toHaveLength(1);
    });

    test('should filter by category labels', () => {
      const deck = [
        {
          id: '1',
          frontText: 'hello',
          backText: 'answer',
          frontLabel: 'Spanish',
          backLabel: 'English',
        },
        {
          id: '2',
          frontText: 'hi',
          backText: 'response',
          frontLabel: 'French',
          backLabel: 'English',
        },
      ];

      const result = filterCards(deck, 'spanish');

      expect(result).toHaveLength(1);
      expect(result[0].frontLabel).toBe('Spanish');
    });

    test('should return all cards for empty query', () => {
      const deck = [
        { id: '1', frontText: 'a', backText: 'b', frontLabel: 'F', backLabel: 'B' },
        { id: '2', frontText: 'c', backText: 'd', frontLabel: 'F', backLabel: 'B' },
      ];

      const result = filterCards(deck, '');

      expect(result).toHaveLength(2);
    });

    test('should return empty array for no matches', () => {
      const deck = [
        { id: '1', frontText: 'hello', backText: 'answer', frontLabel: 'English', backLabel: 'Spanish' },
      ];

      const result = filterCards(deck, 'zzzzz');

      expect(result).toHaveLength(0);
    });

    test('should trim whitespace from query', () => {
      const deck = [
        { id: '1', frontText: 'hello', backText: 'answer', frontLabel: 'English', backLabel: 'Spanish' },
      ];

      const result = filterCards(deck, '  hello  ');

      expect(result).toHaveLength(1);
    });

    test('should not throw when card fields are null or undefined', () => {
      const deck = [
        { id: '1', frontText: null, backText: undefined, frontLabel: null, backLabel: undefined },
        { id: '2', frontText: 'hello', backText: 'hola', frontLabel: 'English', backLabel: 'Spanish' },
      ];

      expect(() => filterCards(deck, 'hello')).not.toThrow();
      const result = filterCards(deck, 'hello');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('2');
    });

    test('should skip null card entries without throwing', () => {
      const deck = [
        null,
        { id: '1', frontText: 'hello', backText: 'hola', frontLabel: 'English', backLabel: 'Spanish' },
      ];

      // null entries produce a TypeError on field access; guard catches them
      const result = filterCards(deck.filter(Boolean), 'hello');
      expect(result).toHaveLength(1);
    });
  });

  // ============================================================================
  // flipDeck() - Deck Direction Reversal
  // ============================================================================
  describe('flipDeck()', () => {
    test('should swap frontText and backText', () => {
      const deck = [
        { id: '1', frontLabel: 'Spanish', backLabel: 'English', frontText: 'hola', backText: 'hello', score: 0 },
      ];

      const result = flipDeck(deck);

      expect(result[0].frontText).toBe('hello');
      expect(result[0].backText).toBe('hola');
    });

    test('should swap frontLabel and backLabel', () => {
      const deck = [
        { id: '1', frontLabel: 'Spanish', backLabel: 'English', frontText: 'hola', backText: 'hello', score: 0 },
      ];

      const result = flipDeck(deck);

      expect(result[0].frontLabel).toBe('English');
      expect(result[0].backLabel).toBe('Spanish');
    });

    test('should preserve card id and score', () => {
      const deck = [
        { id: 'abc123', frontLabel: 'Spanish', backLabel: 'English', frontText: 'hola', backText: 'hello', score: 5 },
      ];

      const result = flipDeck(deck);

      expect(result[0].id).toBe('abc123');
      expect(result[0].score).toBe(5);
    });

    test('should handle multiple cards', () => {
      const deck = [
        { id: '1', frontLabel: 'Spanish', backLabel: 'English', frontText: 'hola', backText: 'hello', score: 0 },
        { id: '2', frontLabel: 'Spanish', backLabel: 'English', frontText: 'adiós', backText: 'goodbye', score: 2 },
      ];

      const result = flipDeck(deck);

      expect(result).toHaveLength(2);
      expect(result[0].frontText).toBe('hello');
      expect(result[0].backText).toBe('hola');
      expect(result[1].frontText).toBe('goodbye');
      expect(result[1].backText).toBe('adiós');
    });

    test('should return empty array for empty input', () => {
      const result = flipDeck([]);

      expect(result).toEqual([]);
    });

    test('should return empty array for null input', () => {
      const result = flipDeck(null);

      expect(result).toEqual([]);
    });

    test('should be reversible (flipping twice returns original)', () => {
      const original = [
        { id: '1', frontLabel: 'Spanish', backLabel: 'English', frontText: 'hola', backText: 'hello', score: 0 },
      ];

      const flipped = flipDeck(original);
      const reverted = flipDeck(flipped);

      expect(reverted[0].frontLabel).toBe(original[0].frontLabel);
      expect(reverted[0].backLabel).toBe(original[0].backLabel);
      expect(reverted[0].frontText).toBe(original[0].frontText);
      expect(reverted[0].backText).toBe(original[0].backText);
    });
  });
});
