/**
 * src/recognition.js — Speech recognition (STT) for listen-and-repeat practice.
 *
 * Uses the Web Speech API (SpeechRecognition) available in Chrome/Edge.
 */

const SpeechRecognition = typeof window !== 'undefined'
    ? (window.SpeechRecognition || window.webkitSpeechRecognition)
    : null;

/** Can the current browser do speech recognition? */
export function isRecognitionSupported() {
    return Boolean(SpeechRecognition);
}

/**
 * Listen for a single spoken utterance.
 * Resolves with an array of alternative transcripts (best first).
 * Rejects on error or if no speech is detected.
 *
 * @param {string} lang  BCP-47 language tag, e.g. 'es-ES'
 * @returns {Promise<string[]>}
 */
export function listenForSpeech(lang = 'es-ES') {
    return new Promise((resolve, reject) => {
        if (!SpeechRecognition) {
            return reject(new Error('SpeechRecognition not supported'));
        }

        const recognition = new SpeechRecognition();
        recognition.lang = lang;
        recognition.interimResults = false;
        recognition.continuous = false;
        recognition.maxAlternatives = 5;

        let settled = false;

        recognition.onresult = (event) => {
            settled = true;
            const alternatives = Array.from(event.results[0])
                .map((alt) => alt.transcript);
            resolve(alternatives);
        };

        recognition.onerror = (event) => {
            settled = true;
            reject(event);
        };

        recognition.onnomatch = () => {
            settled = true;
            reject(new Error('no-match'));
        };

        recognition.onend = () => {
            if (!settled) {
                reject({ error: 'no-speech' });
            }
        };

        recognition.start();
    });
}

/**
 * Normalize a string for comparison: lowercase, strip common punctuation
 * and leading/trailing whitespace, collapse inner whitespace.
 */
export function normalizeForComparison(text) {
    return text
        .toLowerCase()
        .replace(/[¿¡.,;:!?()""''«»\-—…]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Levenshtein edit distance between two strings.
 */
export function levenshtein(a, b) {
    const m = a.length;
    const n = b.length;
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            dp[i][j] = Math.min(
                dp[i - 1][j] + 1,
                dp[i][j - 1] + 1,
                dp[i - 1][j - 1] + cost
            );
        }
    }
    return dp[m][n];
}

/**
 * Score how well the user's spoken transcripts match the expected phrase.
 *
 * @param {string}   expected     The card text to match against
 * @param {string[]} transcripts  STT alternative transcripts
 * @returns {'perfect' | 'close' | 'retry'}
 */
export function scoreMatch(expected, transcripts) {
    const target = normalizeForComparison(expected);
    if (!target) return 'perfect';

    for (const transcript of transcripts) {
        const spoken = normalizeForComparison(transcript);
        if (spoken === target) return 'perfect';
    }

    // Allow proportional tolerance: ~20% of target length, minimum 2
    const tolerance = Math.max(2, Math.ceil(target.length * 0.2));

    for (const transcript of transcripts) {
        const spoken = normalizeForComparison(transcript);
        if (levenshtein(spoken, target) <= tolerance) return 'close';
    }

    return 'retry';
}
