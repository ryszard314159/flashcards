/**
 * src/state.js
 */

export const FREQUENCY_SETTINGS = {
    default: 0,
    delta: 1,
    min: -9,
    max: 9
};
export const DEFAULT_SESSION_SIZE = 5;
export const DEFAULT_TEMPERATURE = 1.0;

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

export const updateCardWeight = (cardId, adjustment) => {
    const card = state.masterDeck.find(c => c.id === cardId);
    if (!card) return;

    // Ensure weight stays within a reasonable range (e.g., 1 to 10)
    const newWeight = (card.weight || 5) + adjustment;
    card.weight = Math.max(1, Math.min(newWeight, 10));

    console.log(`Card ${cardId} weight updated to: ${card.weight}`);
    
    // Suggestion: Trigger a save to LocalStorage here 
    // to ensure the Service Worker doesn't lose progress on refresh.
};



