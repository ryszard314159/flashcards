/**
 * src/srs.js
 * Pure SRS (Spaced Repetition System) functions.
 * No DOM, no state mutations — safe to import in tests.
 */

import { SCORE_SETTINGS } from './state.js';

/**
 * Picks a single card from a pool using Boltzmann-weighted random selection.
 * @param {Array} pool - Array of card objects with a `score` property.
 * @param {number} temperature - Softmax temperature (higher = flatter distribution).
 * @returns {object|null} - A selected card, or null for empty/null pool.
 */
export function pickWeightedCard(pool, temperature = 1.0) {
    if (!pool || pool.length === 0) return null;
    const T = Math.max(temperature, 0.01);
    const weights = pool.map(card => Math.exp((card.score || 0) / T));
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let dart = Math.random() * totalWeight;
    for (let i = 0; i < pool.length; i++) {
        dart -= weights[i];
        if (dart <= 0) return pool[i];
    }
    return pool[0];
}

/**
 * Generates a weighted session deck by sampling without replacement.
 * @param {Array} pool - Full card pool.
 * @param {number} sessionSize - Maximum number of cards to select.
 * @param {number} temperature - Softmax temperature.
 * @returns {Array} - Selected session deck.
 */
export function generateSessionDeck(pool, sessionSize, temperature = 1.0) {
    if (pool.length === 0) return [];
    const exps = pool.map(card => Math.exp((card.score || 0) / temperature));
    const sumExps = exps.reduce((a, b) => a + b, 0);
    let poolWithProbs = pool.map((card, index) => ({
        card,
        prob: exps[index] / sumExps
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
                const newSum = poolWithProbs.reduce((sum, item) => sum + item.prob, 0);
                if (newSum > 0) {
                    poolWithProbs.forEach(item => item.prob /= newSum);
                }
                break;
            }
        }
    }
    return session;
}

/**
 * Calculates softmax probabilities for a pool of cards.
 * @param {Array} pool - Cards with a numeric `score` property.
 * @param {number} temperature - Softmax temperature.
 * @returns {number[]} - Array of probabilities that sum to 1.
 */
export function calculateProbabilities(pool, temperature) {
    const exponents = pool.map(card => Math.exp(card.score / temperature));
    const sumExponents = exponents.reduce((a, b) => a + b, 0);
    return exponents.map(exp => exp / sumExponents);
}

/**
 * Applies a score change (+1 or -1) to a card's current score,
 * clamped to SCORE_SETTINGS bounds. Returns the new score value.
 * @param {number} currentScore
 * @param {number} change - Must be +1 or -1.
 * @returns {number}
 */
export function applyScoreChange(currentScore, change) {
    const newValue = currentScore + (change * SCORE_SETTINGS.delta);
    return Math.max(SCORE_SETTINGS.min, Math.min(SCORE_SETTINGS.max, newValue));
}

/**
 * Filters cards by matching a query against front/back text and labels.
 * @param {Array} masterDeck
 * @param {string} query
 * @returns {Array} - Full deck when query is empty, otherwise filtered subset.
 */
export function filterCards(masterDeck, query) {
    const searchTerm = query.toLowerCase().trim();
    if (searchTerm === '') return masterDeck;
    return masterDeck.filter(card =>
        card.frontLabel.toLowerCase().includes(searchTerm) ||
        card.backLabel.toLowerCase().includes(searchTerm) ||
        card.frontText.toLowerCase().includes(searchTerm) ||
        card.backText.toLowerCase().includes(searchTerm)
    );
}

/**
 * Swaps front and back properties for every card in the deck.
 * @param {Array} deck
 * @returns {Array}
 */
export function flipDeck(deck) {
    if (!deck || !Array.isArray(deck)) return [];
    return deck.map(card => ({
        ...card,
        frontLabel: card.backLabel,
        backLabel: card.frontLabel,
        frontText: card.backText,
        backText: card.frontText
    }));
}
