// src/tutor.js — Spanish conversation tutor
// Priority: 1. Chrome built-in AI  2. Ollama (local)  3. OpenAI (needs key)

const SYSTEM_PROMPT = `You are a friendly, patient Spanish tutor. Your job is to help the user learn Spanish through conversation and translation.

Guidelines:
- When the user asks how to say something, give the Spanish translation with a brief pronunciation hint if useful.
- When the user speaks Spanish to you, respond in Spanish at a beginner-to-intermediate level, then add an English translation in parentheses.
- Correct mistakes gently and naturally.
- Keep responses concise — 1 to 3 sentences.
- If unsure what the user needs, ask a simple clarifying question in both languages.
- Use Latin American Spanish unless the user requests otherwise.`;

// ── Chrome built-in AI (Prompt API) ─────────────────────────────

let chromeSession = null;

function getAIRoot() {
    // Chrome has shipped multiple API shapes during the origin trial
    return globalThis.ai ?? globalThis.model ?? null;
}

function getLanguageModel() {
    const ai = getAIRoot();
    // Prefer languageModel (current), fall back to assistant/textModel (older names)
    return ai?.languageModel ?? ai?.assistant ?? ai?.textModel ?? null;
}

export async function isChromeAIAvailable() {
    try {
        const lm = getLanguageModel();
        if (!lm) {
            console.debug('[Tutor] Chrome AI: no language model API found.',
                'window.ai =', typeof window !== 'undefined' ? window.ai : 'N/A');
            return 'no';
        }
        if (typeof lm.capabilities === 'function') {
            const caps = await lm.capabilities();
            console.debug('[Tutor] Chrome AI capabilities:', caps?.available);
            return caps.available; // 'readily' | 'after-download' | 'no'
        }
        // Some builds expose create() directly without capabilities()
        console.debug('[Tutor] Chrome AI: no capabilities(), assuming readily');
        return 'readily';
    } catch (e) {
        console.debug('[Tutor] Chrome AI probe error:', e);
        return 'no';
    }
}

async function getChromeSession() {
    if (chromeSession) return chromeSession;
    const lm = getLanguageModel();
    chromeSession = await lm.create({
        systemPrompt: SYSTEM_PROMPT,
    });
    return chromeSession;
}

export function destroyChromeSession() {
    if (chromeSession) {
        chromeSession.destroy();
        chromeSession = null;
    }
}

async function sendChromeAI(userMessage, history) {
    const session = await getChromeSession();
    // Build context from history (Chrome session is stateless per-prompt)
    const ctx = history
        .map(m => (m.role === 'user' ? `Student: ${m.content}` : `Tutor: ${m.content}`))
        .join('\n');
    const prompt = ctx ? `${ctx}\nStudent: ${userMessage}` : `Student: ${userMessage}`;
    return (await session.prompt(prompt)).trim();
}

// ── Ollama (local LLM server) ───────────────────────────────────

const OLLAMA_DEFAULT_URL = 'http://localhost:11434';
const OLLAMA_DEFAULT_MODEL = 'gemma3:4b';

export async function isOllamaAvailable(baseUrl = OLLAMA_DEFAULT_URL) {
    try {
        const res = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(1500) });
        if (!res.ok) return false;
        const data = await res.json();
        return Array.isArray(data?.models) && data.models.length > 0;
    } catch {
        return false;
    }
}

async function sendOllama(userMessage, history, baseUrl = OLLAMA_DEFAULT_URL, model = OLLAMA_DEFAULT_MODEL) {
    const messages = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...history,
        { role: 'user', content: userMessage },
    ];

    const res = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages, stream: false }),
    });

    if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Ollama ${res.status}: ${body.slice(0, 200)}`);
    }

    const data = await res.json();
    return data.message?.content?.trim() ?? '';
}

// ── OpenAI fallback ─────────────────────────────────────────────

const OPENAI_MODEL = 'gpt-4o-mini';
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

async function sendOpenAI(userMessage, history, apiKey, model = OPENAI_MODEL) {
    const messages = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...history,
        { role: 'user', content: userMessage },
    ];

    const res = await fetch(OPENAI_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ model, messages, max_tokens: 256 }),
    });

    if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`API ${res.status}: ${body.slice(0, 200)}`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() ?? '';
}

// ── Conversation manager ────────────────────────────────────────

export function createConversation() {
    const history = [];

    return {
        /**
         * Send a message. Tries enabled backends in order: Chrome AI → Ollama → OpenAI.
         * @param {string} userMessage
         * @param {string} [apiKey] — only needed for OpenAI
         * @param {{ enableChromeAI?: boolean, enableOllama?: boolean, enableOpenAI?: boolean, ollamaUrl?: string, ollamaModel?: string, openaiModel?: string }} [opts]
         */
        async ask(userMessage, apiKey, opts = {}) {
            const useChromeAI = opts.enableChromeAI !== false;
            const useOllama = opts.enableOllama !== false;
            const useOpenAI = Boolean(opts.enableOpenAI);
            const ollamaUrl = opts.ollamaUrl || OLLAMA_DEFAULT_URL;
            const ollamaModel = opts.ollamaModel || OLLAMA_DEFAULT_MODEL;
            const openaiModel = opts.openaiModel || OPENAI_MODEL;
            let reply;

            // Try enabled backends in order
            if (useChromeAI && (await isChromeAIAvailable()) === 'readily') {
                reply = await sendChromeAI(userMessage, history);
            } else if (useOllama && await isOllamaAvailable(ollamaUrl)) {
                reply = await sendOllama(userMessage, history, ollamaUrl, ollamaModel);
            } else if (useOpenAI && apiKey) {
                reply = await sendOpenAI(userMessage, history, apiKey, openaiModel);
            } else {
                throw new Error('No AI backend available. Enable one in Settings and make sure it\'s running.');
            }

            history.push({ role: 'user', content: userMessage });
            history.push({ role: 'assistant', content: reply });
            while (history.length > 40) history.shift();
            return reply;
        },

        clear() {
            history.length = 0;
            destroyChromeSession();
        },

        getHistory() { return [...history]; },
    };
}
