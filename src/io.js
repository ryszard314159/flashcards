// src/io.js

export const KEYS = {
    SETTINGS: 'flashcardSettings',
    DECK: 'masterDeck'
};

// --- Storage Logic ---
export const save = (key, data) => localStorage.setItem(key, JSON.stringify(data));

export const load = (key) => {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : null;
    } catch (e) {
        console.error("Load error:", e);
        return null;
    }
};

// --- Internal Parsing Logic (Private to this module) ---
function parseDeckText(rawText) {
    const lines = rawText.split(/\r?\n/);
    const newCards = [];
    let currentFrontLabel = "Front", currentBackLabel = "Back";

    lines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed) return;

        if (trimmed.startsWith('**')) {
            const title = trimmed.replace('**', '').split(':')[1]?.trim();
            if (title) document.title = title;
            return;
        }

        if (trimmed.startsWith('*')) {
            const labels = trimmed.replace('*', '').split('|');
            currentFrontLabel = labels[0]?.trim() || "Front";
            currentBackLabel = labels[1]?.trim() || "Back";
            return;
        }

        const parts = trimmed.split('|');
        if (parts.length >= 2) {
            newCards.push({
                frontLabel: currentFrontLabel,
                backLabel: currentBackLabel,
                frontText: parts[0].trim(),
                backText: parts[1].trim()
            });
        }
    });
    return newCards;
}

// --- Public File Reader ---
export async function deckReader(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const rawCards = parseDeckText(event.target.result);
            if (!rawCards.length) return reject("Empty or invalid deck file.");

            // Final Sanitization
            const sanitized = rawCards.map((card, index) => ({
                ...card,
                id: card.id || `card-${Date.now()}-${index}`,
                frequencyFactor: card.frequencyFactor ?? 0
            }));
            resolve(sanitized);
        };
        reader.onerror = () => reject("File read error.");
        reader.readAsText(file);
    });
}