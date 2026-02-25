/**
 * src/state.js
 */

export const FREQUENCY_SETTINGS = { default: 0, delta: 1, min: -9, max: 9};
export const TEMPERATURE = { default: 1.0, delta: 1.0, min: 0.1, max: 10.0};
export const SPEECH_RATE = { default: 1.0, delta: 0.5, min: 0.5, max: 1.5};
export const SESSION_SIZE = { default: 5, delta: 1, min: 0, max: 20};

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
        sessionSize: SESSION_SIZE.default,
        temperature: TEMPERATURE.default,
        speechRate: SPEECH_RATE.default,
    }
};
