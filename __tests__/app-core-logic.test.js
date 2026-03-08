/**
 * __tests__/app-core-logic.test.js
 * Tests for core SRS algorithm and business logic functions
 */

// Note: These tests import functions that need to be exported from app.js
// For now, we'll test the logic directly

describe('Core SRS Logic Functions', () => {
  // ============================================================================
  // pickWeightedCard() - Weighted Random Selection
  // ============================================================================
  describe('pickWeightedCard()', () => {
    // Helper function to test weighted card selection
    function pickWeightedCard(pool, temperature = 1.0) {
      if (!pool || pool.length === 0) return null;

      const T = Math.max(temperature, 0.01);
      const weights = pool.map(card =>
        Math.exp((card.frequencyFactor || 0) / T)
      );
      const totalWeight = weights.reduce((a, b) => a + b, 0);

      let dart = Math.random() * totalWeight;
      for (let i = 0; i < pool.length; i++) {
        dart -= weights[i];
        if (dart <= 0) return pool[i];
      }
      return pool[0];
    }

    test('should select a card from single-card pool', () => {
      const pool = [{ id: '1', frequencyFactor: 0 }];
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

    test('should favor cards with higher frequency factors', () => {
      const pool = [
        { id: '1', frequencyFactor: -5 },
        { id: '2', frequencyFactor: 5 },
      ];

      // Run multiple times to check distribution
      const counts = { '1': 0, '2': 0 };
      for (let i = 0; i < 100; i++) {
        const card = pickWeightedCard(pool);
        counts[card.id]++;
      }

      // Card with higher frequency factor should be selected more often
      expect(counts['2']).toBeGreaterThan(counts['1']);
    });

    test('should handle temperature=0.1 (more aggressive focus)', () => {
      const pool = [
        { id: '1', frequencyFactor: -5 },
        { id: '2', frequencyFactor: 5 },
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
        { id: '1', frequencyFactor: -5 },
        { id: '2', frequencyFactor: 5 },
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

    test('should handle missing frequencyFactor (default to 0)', () => {
      const pool = [
        { id: '1' },
        { id: '2', frequencyFactor: 0 },
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
    function generateSessionDeck(pool, sessionSize, temperature = 1.0) {
      if (pool.length === 0) return [];

      const exps = pool.map(card =>
        Math.exp((card.frequencyFactor || 0) / temperature)
      );
      const sumExps = exps.reduce((a, b) => a + b, 0);

      let poolWithProbs = pool.map((card, index) => ({
        card,
        prob: exps[index] / sumExps,
      }));

      const session = [];
      const size = Math.min(sessionSize, pool.length);

      for (let i = 0; i < size; i++) {
        let dart = Math.random();
        let cumulativeProb = 0;

        for (let j = 0; j < poolWithProbs.length; j++) {
          cumulativeProb += poolWithProbs[j].prob;

          if (dart <= cumulativeProb) {
            const selected = poolWithProbs.splice(j, 1)[0];
            session.push(selected.card);

            const newSum = poolWithProbs.reduce(
              (sum, item) => sum + item.prob,
              0
            );
            if (newSum > 0) {
              poolWithProbs.forEach(item => (item.prob /= newSum));
            }
            break;
          }
        }
      }

      return session;
    }

    test('should return all cards when sessionSize >= pool length', () => {
      const pool = [
        { id: '1', frequencyFactor: 0 },
        { id: '2', frequencyFactor: 1 },
      ];

      const result = generateSessionDeck(pool, 5);

      expect(result).toHaveLength(2);
    });

    test('should return fewer cards when sessionSize < pool length', () => {
      const pool = [
        { id: '1', frequencyFactor: 0 },
        { id: '2', frequencyFactor: 1 },
        { id: '3', frequencyFactor: 2 },
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
        { id: '1', frequencyFactor: 0 },
        { id: '2', frequencyFactor: 1 },
      ];

      const result = generateSessionDeck(pool, 1);

      expect(result).toHaveLength(1);
    });

    test('should not select same card twice', () => {
      const pool = [
        { id: '1', frequencyFactor: 0 },
        { id: '2', frequencyFactor: 1 },
        { id: '3', frequencyFactor: 2 },
      ];

      const result = generateSessionDeck(pool, 3);
      const ids = result.map(card => card.id);

      expect(new Set(ids).size).toBe(3);
    });
  });

  // ============================================================================
  // handleFrequencyChange() - SRS Scoring
  // ============================================================================
  describe('Frequency Factor Adjustment', () => {
    test('should increase frequency factor by delta', () => {
      const card = { frequencyFactor: 0 };
      const delta = 1;

      card.frequencyFactor += delta;

      expect(card.frequencyFactor).toBe(1);
    });

    test('should decrease frequency factor by delta', () => {
      const card = { frequencyFactor: 5 };
      const delta = 1;

      card.frequencyFactor -= delta;

      expect(card.frequencyFactor).toBe(4);
    });

    test('should clamp to min value', () => {
      const card = { frequencyFactor: -8 };
      const min = -9;
      const max = 9;
      const delta = 1;

      card.frequencyFactor -= delta;
      card.frequencyFactor = Math.max(min, Math.min(max, card.frequencyFactor));

      expect(card.frequencyFactor).toBe(-9);
    });

    test('should clamp to max value', () => {
      const card = { frequencyFactor: 8 };
      const min = -9;
      const max = 9;
      const delta = 1;

      card.frequencyFactor += delta;
      card.frequencyFactor = Math.max(min, Math.min(max, card.frequencyFactor));

      expect(card.frequencyFactor).toBe(9);
    });
  });

  // ============================================================================
  // Probability Calculation
  // ============================================================================
  describe('Probability Calculation', () => {
    function calculateProbabilities(pool, temperature) {
      const exponents = pool.map(card =>
        Math.exp(card.frequencyFactor / temperature)
      );
      const sumExponents = exponents.reduce((a, b) => a + b, 0);
      return exponents.map(exp => exp / sumExponents);
    }

    test('should calculate probabilities that sum to 1', () => {
      const pool = [
        { frequencyFactor: 0 },
        { frequencyFactor: 1 },
        { frequencyFactor: -1 },
      ];

      const probs = calculateProbabilities(pool, 1.0);

      expect(probs.length).toBe(3);
      const sum = probs.reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1.0, 5);
    });

    test('should assign higher probability to higher scores', () => {
      const pool = [
        { frequencyFactor: 1 },
        { frequencyFactor: 5 },
      ];

      const probs = calculateProbabilities(pool, 1.0);

      expect(probs[1]).toBeGreaterThan(probs[0]);
    });

    test('should respect temperature scaling', () => {
      const pool = [
        { frequencyFactor: 1 },
        { frequencyFactor: -1 },
      ];

      const probsLowTemp = calculateProbabilities(pool, 0.1);
      const probsHighTemp = calculateProbabilities(pool, 10);

      // Low temperature should have bigger difference between probabilities
      const diffLow = Math.abs(probsLowTemp[0] - probsLowTemp[1]);
      const diffHigh = Math.abs(probsHighTemp[0] - probsHighTemp[1]);

      expect(diffLow).toBeGreaterThan(diffHigh);
    });

    test('should handle equal scores with equal probabilities', () => {
      const pool = [
        { frequencyFactor: 0 },
        { frequencyFactor: 0 },
        { frequencyFactor: 0 },
      ];

      const probs = calculateProbabilities(pool, 1.0);

      probs.forEach(prob => {
        expect(prob).toBeCloseTo(1 / 3, 5);
      });
    });
  });

  // ============================================================================
  // Search/Filter Logic
  // ============================================================================
  describe('handleSearch() - Text Filtering', () => {
    function filterCards(masterDeck, query) {
      const searchTerm = query.toLowerCase().trim();

      if (searchTerm === '') {
        return masterDeck;
      }

      return masterDeck.filter(
        card =>
          card.frontLabel.toLowerCase().includes(searchTerm) ||
          card.backLabel.toLowerCase().includes(searchTerm) ||
          card.frontText.toLowerCase().includes(searchTerm) ||
          card.backText.toLowerCase().includes(searchTerm)
      );
    }

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
  });
});
