/**
 * @file Application-wide configuration settings.
 */

/** Set to false before deploying to production to silence assertion dialogs. */
export const DEBUG = true;

/**
 * General application configuration.
 */
export const CONFIG = {
    VERSION: "2026-03-14.2116",
    // You can add more here later, like:
    // DEFAULT_SPEED: 0.9,
    // DARK_MODE: true
};
/**
 * Configuration for the GitHub repository from which flashcard decks are fetched.
 */
export const REPO_CONFIG = {
    owner: "ryszard314159",
    repo: "flashcards",
    basePath: "decks",
    /**
     * Constructs the GitHub API URL for fetching contents.
     * @param {string} [subPath] - An optional sub-path within the repo (e.g., 'decks/spanish'). Defaults to `basePath`.
     * @returns {string} The full GitHub API contents URL.
     */
    getContentsUrl(subPath) {
        const targetPath = subPath || this.basePath;
        return `https://api.github.com/repos/${this.owner}/${this.repo}/contents/${targetPath}`;
    }
};