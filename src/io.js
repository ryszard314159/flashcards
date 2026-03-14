// src/io.js

import { REPO_CONFIG, DEBUG } from './config.js';

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

/**
 * NEW: Fetches the list of deck files available on GitHub
 */
// export async function fetchRemoteDeckList(path) {
//     // Pass the 'path' argument into our new helper method
//     const url = REPO_CONFIG.getContentsUrl(path);

//     const response = await fetch(url);
//     if (!response.ok) throw new Error("GitHub API unavailable");
//     return await response.json();
// }


// export async function fetchRemoteDeckList(path) {
//     try {
//         const url = REPO_CONFIG.getContentsUrl(path);
//         const response = await fetch(url);
//         if (!response.ok) throw new Error(`GitHub API Error: ${response.status}`);
//         return await response.json();
//     } catch (err) {
//         console.error("Fetch failed:", err);
//         throw err;
//     }
// }

// Independent function - Pixel-proof
export async function fetchRemoteDeckList(subPath) {
    // Determine the exact path to query
    const targetPath = subPath || REPO_CONFIG.basePath;

    // Construct URL manually
    const url = `https://api.github.com/repos/${REPO_CONFIG.owner}/${REPO_CONFIG.repo}/contents/${targetPath}`;

    if (DEBUG) console.log("Fetching from:", url);

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`GitHub API Error: ${response.status}`);
    }
    return await response.json();
}

/**
 * NEW: Fetches raw text from any URL (GitHub Raw, Gists, etc.)
 */
export async function fetchTextFromUrl(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Failed to download file");
    const text = await response.text();

    const firstNonEmpty = (text.split(/\r?\n/).find(l => l.trim().length > 0) || '');
    if (DEBUG) {
        console.log('[DeckFetch] url:', url);
        console.log('[DeckFetch] first non-empty line:', JSON.stringify(firstNonEmpty));
    }

    return text;
}

/**
 * MODIFIED: Internal Parsing Logic (Now used by both File and URL imports)
 * Now supports & directive for voice selection:
 *   & Front: Voice A (en-US); Back: Voice B (fr-FR)
 * Deck-wide behavior: one top-level '&' directive applies to all cards.
 */
export function processDeckText(rawText) {
    const lines = rawText.split(/\r?\n/);
    const newCards = [];
    let currentFrontLabel = "Front", currentBackLabel = "Back";
    let deckFrontVoice = null, deckBackVoice = null;
    let foundVoiceDirective = false;

    const firstNonEmpty = lines.find(l => l.trim().length > 0) || '';
    if (DEBUG) console.log('[DeckParse] first non-empty line:', JSON.stringify(firstNonEmpty));

    lines.forEach(line => {
        const trimmed = line.trim();
        const normalized = trimmed.replace(/^\uFEFF/, '');
        if (!normalized) return;

        // Parse metadata lines (e.g., ** Small talk)
        if (normalized.startsWith('**')) return;

        // Parse deck-wide voice directive (e.g., & Front: Voice A (en-US); Back: Voice B (fr-FR))
        if (normalized.startsWith('&')) {
            foundVoiceDirective = true;
            const voiceSpec = normalized.substring(1).trim();
            // Parse "Front: [voice]; Back: [voice]"
            const parts = voiceSpec.split(';');
            if (parts[0]) {
                const frontMatch = parts[0].match(/Front:\s*(.+)$/i);
                if (frontMatch) deckFrontVoice = frontMatch[1].trim();
            }
            if (parts[1]) {
                const backMatch = parts[1].match(/Back:\s*(.+)$/i);
                if (backMatch) deckBackVoice = backMatch[1].trim();
            }
            if (DEBUG) console.log('[DeckParse] parsed deck voices:', {
                frontVoice: deckFrontVoice,
                backVoice: deckBackVoice
            });
            return;
        }

        // Parse category / label line (e.g., * Greetings | Saludos)
        if (normalized.startsWith('*')) {
            const labels = normalized.replace('*', '').split('|');
            currentFrontLabel = labels[0]?.trim() || "Front";
            currentBackLabel = labels[1]?.trim() || "Back";
            return;
        }

        // Parse card content (e.g., frontText | backText | [score])
        const parts = normalized.split('|');
        if (parts.length >= 2) {
            const parsedScore = parts.length >= 3 ? parseFloat(parts[2].trim()) : NaN;
            newCards.push({
                frontLabel: currentFrontLabel,
                backLabel: currentBackLabel,
                frontText: parts[0].trim(),
                backText: parts[1].trim(),
                frontVoice: deckFrontVoice,
                backVoice: deckBackVoice,
                id: `card-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
                score: Number.isFinite(parsedScore) ? parsedScore : 0
            });
        }
    });

    if (newCards.length > 0 && DEBUG) {
        console.log('[DeckParse] first parsed card voice fields:', {
            frontVoice: newCards[0].frontVoice,
            backVoice: newCards[0].backVoice
        });
    }

    if (!foundVoiceDirective) {
        if (DEBUG) console.warn('[DeckParse] no top-level voice directive found. Expected first non-empty line like: "& Front: ...; Back: ..."');
    }

    return newCards;
}

// --- Public File Reader ---
export async function deckReader(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const rawText = String(event.target.result || '');
                if (DEBUG) {
                    const firstNonEmpty = (rawText.split(/\r?\n/).find(l => l.trim().length > 0) || '');
                    console.log('[DeckReader] file selected:', file?.name || '(unknown)');
                    console.log('[DeckReader] first non-empty line:', JSON.stringify(firstNonEmpty));
                }

                const cards = processDeckText(rawText);
                if (!cards.length) return reject("Empty or invalid deck file.");
                resolve(cards);
            } catch (e) { reject(e); }
        };
        reader.onerror = () => reject("File read error.");
        reader.readAsText(file);
    });
}