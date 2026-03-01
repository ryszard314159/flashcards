// 
// config.js
// 
export const CONFIG = {
    VERSION: "2026-03-01.0",
    // You can add more here later, like:
    // DEFAULT_SPEED: 0.9,
    // DARK_MODE: true
};

export const REPO_CONFIG = {
    owner: "ryszard314159",
    repo: "flashcards",
    path: "decks",
    get apiUrl() {
        return `https://api.github.com/repos/${this.owner}/${this.repo}/contents/${this.path}`;
    }
};