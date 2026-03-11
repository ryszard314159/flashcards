/**
 * __tests__/io.test.js
 * Tests for import/export functionality and deck parsing
 */

import { processDeckText, save, load, KEYS } from '../src/io.js';

describe('io.js - Deck I/O Functions', () => {
  // ============================================================================
  // processDeckText() - Deck File Parser
  // ============================================================================
  describe('processDeckText()', () => {
    test('should parse a valid deck file with one category and cards', () => {
      const deckText = `* Spanish | English
hola | hello
gato | cat`;

      const result = processDeckText(deckText);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        frontLabel: 'Spanish',
        backLabel: 'English',
        frontText: 'hola',
        backText: 'hello',
        score: 0,
      });
      expect(result[1]).toMatchObject({
        frontLabel: 'Spanish',
        backLabel: 'English',
        frontText: 'gato',
        backText: 'cat',
      });
    });

    test('should generate unique card IDs', () => {
      const deckText = `* Front | Back
card1 | answer1
card2 | answer2`;

      const result = processDeckText(deckText);

      expect(result[0].id).toBeDefined();
      expect(result[1].id).toBeDefined();
      expect(result[0].id).not.toBe(result[1].id);
    });

    test('should handle multiple categories in same deck', () => {
      const deckText = `* Spanish | English
hola | hello

* German | English
hallo | hello`;

      const result = processDeckText(deckText);

      expect(result).toHaveLength(2);
      expect(result[0].frontLabel).toBe('Spanish');
      expect(result[1].frontLabel).toBe('German');
    });

    test('should ignore metadata lines starting with **', () => {
      const deckText = `** Deck Title
** Created: 2024-01-01
* Spanish | English
hola | hello`;

      const result = processDeckText(deckText);

      expect(result).toHaveLength(1);
      expect(result[0].frontText).toBe('hola');
    });

    test('should ignore empty lines', () => {
      const deckText = `* Spanish | English

hola | hello

gato | cat

`;

      const result = processDeckText(deckText);

      expect(result).toHaveLength(2);
    });

    test('should handle cards with special characters', () => {
      const deckText = `* Spanish | English
¿Hola? | Hello!
Cómo estás | How are you?`;

      const result = processDeckText(deckText);

      expect(result[0].frontText).toBe('¿Hola?');
      expect(result[1].backText).toBe('How are you?');
    });

    test('should handle cards with leading/trailing whitespace', () => {
      const deckText = `*   Spanish   |   English
  hola  |  hello  `;

      const result = processDeckText(deckText);

      expect(result[0].frontLabel).toBe('Spanish');
      expect(result[0].backLabel).toBe('English');
      expect(result[0].frontText).toBe('hola');
      expect(result[0].backText).toBe('hello');
    });

    test('should use default labels when category is empty', () => {
      const deckText = `* |
question | answer`;

      const result = processDeckText(deckText);

      expect(result[0].frontLabel).toBe('Front');
      expect(result[0].backLabel).toBe('Back');
    });

    test('should return empty array for empty text', () => {
      const result = processDeckText('');

      expect(result).toEqual([]);
    });

    test('should accept cards even with empty parts after pipe split', () => {
      const deckText = `* Spanish | English
hola | hello
incomplete |
| incomplete2`;

      const result = processDeckText(deckText);

      // All lines with pipe delimiter are accepted, even if parts are empty
      expect(result).toHaveLength(3);
      expect(result[1].frontText).toBe('incomplete');
      expect(result[1].backText).toBe('');
      expect(result[2].frontText).toBe('');
      expect(result[2].backText).toBe('incomplete2');
    });

    test('should handle Windows line endings (CRLF)', () => {
      const deckText = '* Spanish | English\r\nhola | hello\r\ngato | cat';

      const result = processDeckText(deckText);

      expect(result).toHaveLength(2);
    });

    test('should handle mixed line endings', () => {
      const deckText = '* Spanish | English\r\nhola | hello\ngato | cat';

      const result = processDeckText(deckText);

      expect(result).toHaveLength(2);
    });

    test('should handle cards with multiple pipes (use only first two parts)', () => {
      const deckText = `* Spanish | English
hola|hello|extra|more`;

      const result = processDeckText(deckText);

      expect(result[0].frontText).toBe('hola');
      expect(result[0].backText).toBe('hello');
    });
  });

  // ============================================================================
  // save() and load() - localStorage Persistence
  // ============================================================================
  describe('save() and load()', () => {
    test('should save an array to localStorage and retrieve it', () => {
      const testData = [
        { id: '1', frontText: 'hello', backText: 'hola' },
        { id: '2', frontText: 'goodbye', backText: 'adiós' },
      ];

      save(KEYS.DECK, testData);
      const loaded = load(KEYS.DECK);

      expect(loaded).toEqual(testData);
    });

    test('should save an object to localStorage', () => {
      const testSettings = {
        temperature: 0.8,
        speechRate: 1.2,
        sessionSize: 10,
      };

      save(KEYS.SETTINGS, testSettings);
      const loaded = load(KEYS.SETTINGS);

      expect(loaded).toEqual(testSettings);
    });

    test('should return null when loading non-existent key', () => {
      localStorage.clear();
      const result = load('non_existent_key');

      expect(result).toBeNull();
    });

    test('should use correct KEYS constants', () => {
      expect(KEYS.DECK).toBe('masterDeck');
      expect(KEYS.SETTINGS).toBe('flashcardSettings');
    });

    test('should handle JSON serialization errors gracefully', () => {
      // Simulate corrupted JSON in localStorage
      localStorage.setItem('test_key', '{invalid json}');

      const result = load('test_key');

      expect(result).toBeNull();
    });

    test('should overwrite existing data when saving with same key', () => {
      const data1 = { value: 'first' };
      const data2 = { value: 'second' };

      save('test_key', data1);
      save('test_key', data2);
      const loaded = load('test_key');

      expect(loaded).toEqual(data2);
    });

    test('should preserve complex nested structures', () => {
      const complexData = {
        cards: [
          { id: '1', labels: { front: 'F', back: 'B' }, scores: [1, 2, 3] },
          { id: '2', labels: { front: 'F2', back: 'B2' }, nested: { deep: true } },
        ],
      };

      save('complex', complexData);
      const loaded = load('complex');

      expect(loaded).toEqual(complexData);
      expect(loaded.cards[0].scores).toEqual([1, 2, 3]);
    });
  });

  // ============================================================================
  // fetchTextFromUrl() - HTTP Fetching
  // ============================================================================
  describe('fetchTextFromUrl()', () => {
    test('should be a function exported from io.js', async () => {
      const { fetchTextFromUrl } = await import('../src/io.js');

      expect(typeof fetchTextFromUrl).toBe('function');
    });
  });
});
