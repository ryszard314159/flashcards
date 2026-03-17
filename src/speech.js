import { DEBUG } from './config.js';

export const AUTO_VOICE_VALUE = '';
export const AUTO_VOICE_LABEL = 'Auto-detect / deck directive';

const VOICE_REFRESH_INTERVAL_MS = 400;
const MAX_VOICE_REFRESH_ATTEMPTS = 12;

let availableVoices = [];
let voicesLoaded = false;
let voiceRefreshTimer = null;

export function _resetVoiceCache() {
    availableVoices = [];
    voicesLoaded = false;
    if (voiceRefreshTimer) {
        clearTimeout(voiceRefreshTimer);
        voiceRefreshTimer = null;
    }
}

export function normalizeVoiceLocale(locale) {
    if (typeof locale !== 'string') {
        return '';
    }

    const trimmed = locale.trim();
    if (!trimmed) {
        return '';
    }

    const parts = trimmed.replace(/_/g, '-').split('-').filter(Boolean);
    if (parts.length === 0) {
        return '';
    }

    return parts
        .map((part, index) => {
            if (index === 0) {
                return part.toLowerCase();
            }
            if (part.length === 4 && /^[A-Za-z]+$/.test(part)) {
                return part[0].toUpperCase() + part.slice(1).toLowerCase();
            }
            if (part.length === 2 || part.length === 3) {
                return part.toUpperCase();
            }
            return part;
        })
        .join('-');
}

export function parseVoiceSpec(voiceSpec) {
    if (!voiceSpec) return null;

    const match = voiceSpec.match(/^(.+?)\s*\(([A-Za-z]{2,3}(?:[-_][A-Za-z0-9]{2,8})*)\)$/);
    if (!match) return null;

    return {
        name: match[1].trim(),
        lang: normalizeVoiceLocale(match[2])
    };
}

export function normalizeVoiceSpec(voiceSpec) {
    if (typeof voiceSpec !== 'string') {
        return '';
    }

    const trimmed = voiceSpec.trim();
    if (!trimmed) {
        return '';
    }

    const parsed = parseVoiceSpec(trimmed);
    if (!parsed) {
        return trimmed;
    }

    return `${parsed.name} (${parsed.lang})`;
}

export function buildVoiceSpecLabel(voice) {
    return `${voice.name} (${normalizeVoiceLocale(voice.lang)})`;
}

function getVoiceSpecCatalog() {
    const seen = new Set();

    return availableVoices
        .filter((voice) => voice?.name && voice?.lang)
        .map(buildVoiceSpecLabel)
        .filter((spec) => {
            if (seen.has(spec)) {
                return false;
            }
            seen.add(spec);
            return true;
        })
        .sort((left, right) => left.localeCompare(right, undefined, { sensitivity: 'base' }));
}

export function filterVoiceSpecs(specs, filterText = '') {
    const normalizedFilter = normalizeVoiceSpec(filterText).toLowerCase();

    if (!normalizedFilter) {
        return specs;
    }

    return specs.filter((spec) => normalizeVoiceSpec(spec).toLowerCase().includes(normalizedFilter));
}

export function renderVoiceOptions(selectElement, filterText = '', selectedValue = AUTO_VOICE_VALUE) {
    if (!selectElement) {
        return;
    }

    const allSpecs = getVoiceSpecCatalog();
    const filteredSpecs = filterVoiceSpecs(allSpecs, filterText);
    const specsToRender = [...filteredSpecs];
    const normalizedSelectedValue = normalizeVoiceSpec(selectedValue);

    if (normalizedSelectedValue && !specsToRender.includes(normalizedSelectedValue)) {
        specsToRender.unshift(normalizedSelectedValue);
    }

    selectElement.innerHTML = '';

    const autoOption = document.createElement('option');
    autoOption.value = AUTO_VOICE_VALUE;
    autoOption.textContent = AUTO_VOICE_LABEL;
    selectElement.appendChild(autoOption);

    if (allSpecs.length === 0) {
        const loadingOption = document.createElement('option');
        loadingOption.value = '__voice_loading__';
        loadingOption.textContent = window.speechSynthesis?.getVoices
            ? 'Loading system voices...'
            : 'Speech voices are not supported in this browser';
        loadingOption.disabled = true;
        selectElement.appendChild(loadingOption);
    } else if (specsToRender.length === 0) {
        const emptyOption = document.createElement('option');
        emptyOption.value = '__no_match__';
        emptyOption.textContent = 'No matching voices';
        emptyOption.disabled = true;
        selectElement.appendChild(emptyOption);
    } else {
        specsToRender.forEach((spec) => {
            const option = document.createElement('option');
            option.value = spec;
            option.textContent = spec;
            selectElement.appendChild(option);
        });
    }

    selectElement.value = normalizedSelectedValue || AUTO_VOICE_VALUE;
}

export function loadAvailableVoices(onVoicesUpdated = () => {}) {
    if (!window.speechSynthesis?.getVoices) {
        onVoicesUpdated();
        return;
    }

    const updateVoiceList = (attempt = 0) => {
        availableVoices = window.speechSynthesis.getVoices();
        if (availableVoices.length > 0) {
            voicesLoaded = true;
            if (voiceRefreshTimer) {
                clearTimeout(voiceRefreshTimer);
                voiceRefreshTimer = null;
            }
            if (DEBUG) {
                console.log(
                    `[Speech] Loaded ${availableVoices.length} voices:`,
                    availableVoices.map((v) => `${v.name} (${v.lang})`).join(', ')
                );
            }
        } else if (attempt < MAX_VOICE_REFRESH_ATTEMPTS) {
            voiceRefreshTimer = setTimeout(() => updateVoiceList(attempt + 1), VOICE_REFRESH_INTERVAL_MS);
        }

        onVoicesUpdated();
    };

    if (!voicesLoaded && voiceRefreshTimer) {
        clearTimeout(voiceRefreshTimer);
        voiceRefreshTimer = null;
    }

    updateVoiceList();
    window.speechSynthesis.onvoiceschanged = () => updateVoiceList();
}

export function selectVoiceBySpec(voiceSpec) {
    if (!window.speechSynthesis || !voiceSpec) return null;

    if (availableVoices.length === 0) {
        availableVoices = window.speechSynthesis.getVoices();
    }

    const spec = parseVoiceSpec(voiceSpec);
    if (!spec) {
        if (DEBUG) console.warn(`[Speech] Invalid voice spec: "${voiceSpec}"`);
        return null;
    }

    const { name, lang } = spec;

    let exactMatch = availableVoices.find((v) => v.name === name && normalizeVoiceLocale(v.lang) === lang);
    if (exactMatch) {
        if (DEBUG) console.log(`[Speech] Found exact voice: ${name} (${lang})`);
        return exactMatch;
    }

    let nameMatch = availableVoices.find((v) => v.name === name);
    if (nameMatch) {
        if (DEBUG) console.log(`[Speech] Found voice by name (different lang): ${nameMatch.name} (${nameMatch.lang})`);
        return nameMatch;
    }

    let langMatch = availableVoices.find((v) => normalizeVoiceLocale(v.lang) === lang);
    if (langMatch) {
        if (DEBUG) console.log(`[Speech] Found voice by language: ${langMatch.name} (${lang})`);
        return langMatch;
    }

    const baseLang = lang.split('-')[0];
    const sameBaseLang = availableVoices.find((v) => {
        const normalizedLang = normalizeVoiceLocale(v.lang);
        return normalizedLang && normalizedLang.startsWith(baseLang + '-');
    });
    if (sameBaseLang) {
        if (DEBUG) console.log(`[Speech] Found voice by base language: ${sameBaseLang.name} (${sameBaseLang.lang})`);
        return sameBaseLang;
    }

    if (DEBUG) console.warn(`[Speech] Voice not found: ${name} (${lang})`);
    return null;
}

export function selectBestVoiceForLanguage(langCode) {
    if (!window.speechSynthesis) return null;

    if (availableVoices.length === 0) {
        availableVoices = window.speechSynthesis.getVoices();
    }

    const normalizedLangCode = normalizeVoiceLocale(langCode);
    const baseLang = normalizedLangCode.split('-')[0];

    let exactMatch = availableVoices.find((v) => normalizeVoiceLocale(v.lang) === normalizedLangCode);
    if (exactMatch) return exactMatch;

    let sameLanguageVoices = availableVoices.filter((v) => normalizeVoiceLocale(v.lang).startsWith(baseLang + '-'));

    if (sameLanguageVoices.length > 0) {
        let googleVoice = sameLanguageVoices.find((v) => v.name.toLowerCase().includes('google'));
        if (googleVoice) return googleVoice;
        return sameLanguageVoices[0];
    }

    if (DEBUG) {
        console.warn(`[Speech] No matching voice found for ${langCode}; using browser default voice for that locale.`);
    }
    return null;
}

export function getDefaultSpeechLang() {
    const browserLang = (navigator.language || '').trim();
    return browserLang || 'en-US';
}

export function detectLanguageFromCard(card, { isBack = false, textOverride = '' } = {}) {
    if (!card) return getDefaultSpeechLang();

    const activeLabel = ((isBack ? card.backLabel : card.frontLabel) || '').toLowerCase();
    const oppositeLabel = ((isBack ? card.frontLabel : card.backLabel) || '').toLowerCase();
    const activeText = (textOverride || (isBack ? card.backText : card.frontText) || '');

    const explicitLang = isBack ? card.backLang : card.frontLang;
    if (typeof explicitLang === 'string' && explicitLang.trim()) {
        return explicitLang.trim();
    }

    const labelText = `${activeLabel} ${oppositeLabel}`;
    const labelHints = [
        { keywords: ['english'], lang: 'en-US' },
        { keywords: ['french', 'france'], lang: 'fr-FR' },
        { keywords: ['german'], lang: 'de-DE' },
        { keywords: ['italian'], lang: 'it-IT' },
        { keywords: ['portuguese'], lang: 'pt-BR' },
        { keywords: ['japanese'], lang: 'ja-JP' },
        { keywords: ['chinese', 'mandarin'], lang: 'zh-CN' },
        { keywords: ['spanish'], lang: 'es-ES' }
    ];
    for (const hint of labelHints) {
        if (hint.keywords.some((k) => labelText.includes(k))) {
            return hint.lang;
        }
    }

    if (/[\u3040-\u30ff]/.test(activeText)) return 'ja-JP';
    if (/[\u4e00-\u9fff]/.test(activeText)) return 'zh-CN';
    if (/[\u0400-\u04FF]/.test(activeText)) return 'ru-RU';
    if (/[\u0600-\u06FF]/.test(activeText)) return 'ar-SA';
    if (/[\u0900-\u097F]/.test(activeText)) return 'hi-IN';

    return getDefaultSpeechLang();
}
