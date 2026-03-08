/**
 * __tests__/config.test.js
 * Tests for application configuration
 */

import { CONFIG, REPO_CONFIG } from '../src/config.js';

describe('config.js - Application Configuration', () => {
  // ============================================================================
  // CONFIG Object
  // ============================================================================
  describe('CONFIG', () => {
    test('should have VERSION property', () => {
      expect(CONFIG).toHaveProperty('VERSION');
    });

    test('VERSION should be a non-empty string', () => {
      expect(typeof CONFIG.VERSION).toBe('string');
      expect(CONFIG.VERSION.length).toBeGreaterThan(0);
    });

    test('VERSION should follow timestamp format', () => {
      // Format: 2026-03-08.0856
      expect(CONFIG.VERSION).toMatch(/^\d{4}-\d{2}-\d{2}\.\d{4}$/);
    });
  });

  // ============================================================================
  // REPO_CONFIG Object
  // ============================================================================
  describe('REPO_CONFIG', () => {
    test('should have required properties', () => {
      expect(REPO_CONFIG).toHaveProperty('owner');
      expect(REPO_CONFIG).toHaveProperty('repo');
      expect(REPO_CONFIG).toHaveProperty('basePath');
    });

    test('owner should be a non-empty string', () => {
      expect(typeof REPO_CONFIG.owner).toBe('string');
      expect(REPO_CONFIG.owner.length).toBeGreaterThan(0);
    });

    test('repo should be a non-empty string', () => {
      expect(typeof REPO_CONFIG.repo).toBe('string');
      expect(REPO_CONFIG.repo.length).toBeGreaterThan(0);
    });

    test('basePath should be a non-empty string', () => {
      expect(typeof REPO_CONFIG.basePath).toBe('string');
      expect(REPO_CONFIG.basePath.length).toBeGreaterThan(0);
    });

    test('basePath should typically be "decks" or similar', () => {
      const validPaths = ['decks', 'examples', 'data', 'resources'];
      expect(validPaths).toContain(REPO_CONFIG.basePath);
    });
  });
});
