// src/io.js

import { REPO_CONFIG } from './config.js';

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
    
    console.log("Fetching from:", url); // Verify this in your Pixel's remote debugger if needed

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
    return await response.text();
}

/**
 * MODIFIED: Internal Parsing Logic (Now used by both File and URL imports)
 */
export function processDeckText(rawText) {
    const lines = rawText.split(/\r?\n/);
    const newCards = [];
    let currentFrontLabel = "Front", currentBackLabel = "Back";

    lines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed) return;
        if (trimmed.startsWith('**')) return; // Metadata
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
                backText: parts[1].trim(),
                id: `card-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                frequencyFactor: 0
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
            try {
                const cards = processDeckText(event.target.result);
                if (!cards.length) reject("Empty or invalid deck file.");
                resolve(cards);
            } catch (e) { reject(e); }
        };
        reader.onerror = () => reject("File read error.");
        reader.readAsText(file);
    });
}