/**
 * src/parser.js
 * Logic for converting .deck text files into Card objects
 */

import { state } from './state.js';

export const Parser = {
    /**
     * Parses raw text from a .deck file
     * @param {string} rawText 
     */
    parseDeck(rawText) {
        const lines = rawText.split(/\r?\n/);
        const newCards = [];
        
        let currentFrontLabel = "Front";
        let currentBackLabel = "Back";

        lines.forEach(line => {
            const trimmed = line.trim();
            if (!trimmed) return; // Skip empty lines

            // 1. Parse Title (starts with **)
            if (trimmed.startsWith('**')) {
                const title = trimmed.replace('**', '').split(':')[1]?.trim();
                if (title) document.title = title;
                return;
            }

            // 2. Parse Labels (starts with *)
            if (trimmed.startsWith('*')) {
                const labels = trimmed.replace('*', '').split('|');
                currentFrontLabel = labels[0]?.trim() || "Front";
                currentBackLabel = labels[1]?.trim() || "Back";
                return;
            }

            // 3. Parse Card Data (Front | Back | [score])
            const parts = trimmed.split('|');
            if (parts.length >= 2) {
                newCards.push({
                    frontLabel: currentFrontLabel,
                    backLabel: currentBackLabel,
                    frontText: parts[0].trim(),
                    backText: parts[1].trim(),
                    score: parts[2] ? parseFloat(parts[2]) : 1.0,
                    lastSeen: Date.now()
                });
            }
        });

        return newCards;
    },

    /**
     * Updates the global state with new cards
     */
    loadIntoState(rawText) {
        const cards = this.parseDeck(rawText);
        if (cards.length > 0) {
            state.masterDeck = cards;
            return true;
        }
        return false;
    }
};