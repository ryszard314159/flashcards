/**
 * src/state.js
 */

export const state = {
    isFlipped: false,
    currentCardIndex: 0,
    // Master source of cards (Help & Usage categories)
    categories: [],      // e.g., ["Help", "Usage", "Spanish"]
    activeCategories: [], // e.g., ["Spanish"]
    masterDeck: [
        // Category: Help
        { frontLabel: "Help", backLabel: "Navigation", frontText: "How do I navigate?", backText: "Tap the LEFT edge for Previous, and the RIGHT edge for Next.", score: 1.0 },
        { frontLabel: "Help", backLabel: "Interaction", frontText: "How do I see the answer?", backText: "Tap the CENTER of the card to flip it.", score: 1.0 },
        { frontLabel: "Help", backLabel: "Audio", frontText: "Can I hear the text?", backText: "Yes! Tap the Speaker icon (coming soon) to trigger Text-to-Speech.", score: 1.0 },
        
        // Category: Usage
        { frontLabel: "Usage", backLabel: "Importing", frontText: "How do I add my own cards?", backText: "Open the Menu (⋮) and select 'Import .deck' to load a text file.", score: 1.0 },
        { frontLabel: "Usage", backLabel: "SRS", frontText: "What is the 'score'?", backText: "It tracks difficulty. Harder cards appear more often to help you learn faster.", score: 1.0 }
    ],
    currentSessionDeck: [],
    settings: {
        sessionSize: 5,
        srsFactor: 0.9,
        speechRate: 1.0
    }
};

export function saveToDisk() {
    localStorage.setItem('flashcardSettings', JSON.stringify(state.settings));
}

export function loadFromDisk() {
    const saved = localStorage.getItem('flashcardSettings');
    if (saved) {
        Object.assign(state.settings, JSON.parse(saved));
    }
}
