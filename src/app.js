/**
 * src/app.js
 */
import { CONFIG, REPO_CONFIG, DEBUG } from './config.js';
import { deckReader, save, load, KEYS } from './io.js';
import { fetchRemoteDeckList, fetchTextFromUrl, processDeckText } from './io.js';
import {
    AUTO_VOICE_VALUE,
    normalizeVoiceLocale,
    normalizeVoiceSpec,
    parseVoiceSpec,
    filterVoiceSpecs,
    buildVoiceSpecLabel,
    selectVoiceBySpec,
    selectBestVoiceForLanguage,
    detectLanguageFromCard,
    loadAvailableVoices,
    renderVoiceOptions,
    _resetVoiceCache,
} from './speech.js';
import {
    updateProbabilitiesForSession,
    pushToHistoryBuffer,
    navigateBackInSession,
    navigateInSession,
    drawCardFromSession,
    applySessionLogicToState,
    getCardOrdinalInMasterDeck as getCardOrdinalFromState,
} from './session.js';
import {
    showToastMessage,
    showModeToast,
    updateUIRender,
    refreshCategoryUIRender,
    provideVisualFeedbackRender,
} from './ui.js';
import { SPEECH_RATE, state } from './state.js';
import { SCORE_SETTINGS } from './state.js';
import { SESSION_SIZE } from './state.js';
import { TEMPERATURE } from './state.js';
import { HISTORY_SIZE } from './state.js';
import { pickWeightedCard, generateSessionDeck, calculateProbabilities, filterCards, flipDeck, applyScoreChange } from './srs.js';
import { isRecognitionSupported, listenForSpeech } from './recognition.js';
import { createConversation, isChromeAIAvailable, isOllamaAvailable } from './tutor.js';
import {
    markUpdateAvailable,
    hasNewerRemoteVersion,
    activateWaitingWorkerImmediately,
    bindVersionTagUpdateHandler,
    getIsRefreshing,
    setIsRefreshing,
    getHasPendingUpdate,
} from './swUpdate.js';

let ui = {};
let isNormalizingPhraseSelection = false;

const TUTOR_API_KEY_STORAGE = 'tutorApiKey';
const tutorConversation = createConversation();
let swRegistration = null;
let refreshUpdateStatusFn = null;
let nextZoneLongPressTimer = null;
let nextZoneLongPressTriggered = false;
const NEXT_ZONE_LONG_PRESS_MS = 500;
const NEXT_ZONE_DEBUG_ALERT = false;
const IS_LOCAL_DEVELOPMENT = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);
let isSpeechPrimed = false;
let lastNoCardsSearchTerm = '';

function notifyNoCardsSelected(searchTerm, previousSearchTerm, showToast = showToastMessage) {
    if (!searchTerm || previousSearchTerm === searchTerm) {
        return previousSearchTerm;
    }

    showToast('No cards selected', 1600, { centered: true });
    return searchTerm;
}

function init() {

    // Load voices for speech synthesis
    loadAvailableVoices();
    primeSpeechOnFirstGesture();

    // 1. Register service worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js', {
            updateViaCache: 'none'
        })
        .then(reg => {
            swRegistration = reg;
            navigator.serviceWorker.oncontrollerchange = () => {
                if (!getIsRefreshing()) {
                    setIsRefreshing(true);
                    window.location.reload();
                }
            };

            const checkWaitingWorker = () => {
                if (reg.waiting) {
                    if (IS_LOCAL_DEVELOPMENT) {
                        return activateWaitingWorkerImmediately(reg);
                    }
                    markUpdateAvailable(ui);
                    return true;
                }
                return false;
            };

            const watchInstallingWorker = (worker) => {
                if (!worker) {
                    return;
                }
                worker.addEventListener('statechange', () => {
                    if (worker.state === 'installed' && navigator.serviceWorker.controller) {
                        if (IS_LOCAL_DEVELOPMENT) {
                            worker.postMessage({ type: 'SKIP_WAITING' });
                            return;
                        }
                        markUpdateAvailable(ui);
                    }
                });
            };

            const refreshUpdateStatus = () => {
                const updateCheck = reg.update().catch(() => null);
                const remoteVersionCheck = hasNewerRemoteVersion().then((hasRemoteUpdate) => {
                    if (hasRemoteUpdate) {
                        markUpdateAvailable(ui);
                    }
                });

                return Promise.allSettled([updateCheck, remoteVersionCheck]).finally(() => {
                    checkWaitingWorker();
                });
            };
            refreshUpdateStatusFn = refreshUpdateStatus;

            // Attach listeners before forcing update checks to avoid missing events.
            reg.addEventListener('updatefound', () => {
                watchInstallingWorker(reg.installing);
            });

            if (reg.installing) {
                watchInstallingWorker(reg.installing);
            }

            // 1. Pre-check: Does a worker exist already?
            checkWaitingWorker();

            bindVersionTagUpdateHandler(ui, swRegistration, refreshUpdateStatusFn);

            const refreshWhenVisible = () => {
                if (document.visibilityState !== 'visible') {
                    return;
                }
                refreshUpdateStatus();
            };

            refreshUpdateStatus();

            document.addEventListener('visibilitychange', refreshWhenVisible);
            window.addEventListener('focus', refreshWhenVisible);
        })
        .catch(err => console.error('app: SW Registration Failed:', err));
    }

    validateConfiguration();
    // 1. Force a layout recalculation
    window.dispatchEvent(new Event('resize'));

    ui = {
        backDisplay: document.getElementById('backDisplay'),
        backLabel: document.getElementById('backLabel'),
        autoPlayFrontOnFlip: document.getElementById('autoPlayFrontOnFlip'),
        autoPlayBackOnFlip: document.getElementById('autoPlayBackOnFlip'),
        cardInner: document.getElementById('cardInner'),
        categoryList: document.getElementById('categoryList'),
        closeImport: document.getElementById('closeImport'),
        closeSelect: document.getElementById('closeSelect'),
        closeSettings: document.getElementById('closeSettings'),
        counter: document.getElementById('card-counter'),
        deckBtn: document.getElementById('deckBtn'),
        deckOverlay: document.getElementById('deckOverlay'),
        filePicker: document.getElementById('filePicker'),
        frontDisplay: document.getElementById('frontDisplay'),
        frontLabel: document.getElementById('frontLabel'),
        helpBtn: document.getElementById('helpBtn'),
        helpContent: document.getElementById('helpContent'),
        helpOverlay: document.getElementById('helpOverlay'),
        importBtn: document.getElementById('importBtn'),
        importUrlBtn: document.getElementById('importUrlBtn'),
        importOverlay: document.getElementById('importOverlay'),
        menuBtn: document.getElementById('menuBtn'),
        menuOverlay: document.getElementById('menuOverlay'),
        closeMenuBtn: document.getElementById('closeMenuBtn'),
        shareBtn: document.getElementById('shareBtn'),
        exportBtn: document.getElementById('exportBtn'),
        nextZone: document.getElementById('nextZone'),
        prevZone: document.getElementById('prevZone'),
        resetSessionBtn: document.getElementById('resetSessionBtn'),
        saveSettingsBtn: document.getElementById('saveSettingsBtn'),
        searchBar: document.getElementById('searchBar'),
        selectAllBtn: document.getElementById('selectAllBtn'),
        selectNoneBtn: document.getElementById('selectNoneBtn'),
        sessionSize: document.getElementById('sessionSize'),
        historySize: document.getElementById('historySizeInput'),
        settingsBtn: document.getElementById('settingsBtn'),
        settingsOverlay: document.getElementById('settingsOverlay'),
        speechRateInput: document.getElementById('speechRateInput'),
        frontVoiceSearch: document.getElementById('frontVoiceSearch'),
        frontVoiceSelect: document.getElementById('frontVoiceSelect'),
        backVoiceSearch: document.getElementById('backVoiceSearch'),
        backVoiceSelect: document.getElementById('backVoiceSelect'),
        modeSelect: document.getElementById('modeSelect'),
        remoteExamplesList: document.getElementById('remoteExamplesList'),
        // srsFactorInput: document.getElementById('srsFactor'),
        // srsFactorVal: document.getElementById('srsFactorVal'),
        tempInput: document.getElementById('tempInput'),
        audioBtn: document.getElementById('audioBtn'),
        micBtn: document.getElementById('micBtn'),
        cardScore: document.getElementById('cardScore'),
        freqDown: document.getElementById('freqDown'),
        freqUp: document.getElementById('freqUp'),
        versionTag: document.getElementById('versionTag'),
        apiKeyInput: document.getElementById('apiKeyInput'),
        enableChromeAI: document.getElementById('enableChromeAI'),
        enableOllama: document.getElementById('enableOllama'),
        enableOpenAI: document.getElementById('enableOpenAI'),
        ollamaUrlInput: document.getElementById('ollamaUrlInput'),
        ollamaModelInput: document.getElementById('ollamaModelInput'),
        openaiModelInput: document.getElementById('openaiModelInput'),
        tutorOverlay: document.getElementById('tutorOverlay'),
        tutorMessages: document.getElementById('tutorMessages'),
        tutorInput: document.getElementById('tutorInput'),
        tutorSend: document.getElementById('tutorSend'),
        tutorMic: document.getElementById('tutorMic'),
        tutorClear: document.getElementById('tutorClear'),
        closeTutor: document.getElementById('closeTutor'),
    };

    assertRequiredUI();
    bindVersionTagUpdateHandler(ui, swRegistration, refreshUpdateStatusFn);
    ui.versionTag.textContent = `Version: ${CONFIG.VERSION}`;
    if (getHasPendingUpdate()) {
        ui.versionTag.classList.add('is-update-available');
    }

    // 2. Debugging Log
    const missing = Object.keys(ui).filter(key => ui[key] === null);
    if (missing.length > 0) {
        console.error("DEBUG: init: The following IDs are missing from your HTML:", missing);
    } else {
        console.log("DEBUG: init: UI Initialized successfully.");
    }

    state.settings = { ...state.settings, ...load(KEYS.SETTINGS) };
    state.settings.frontVoice = normalizeVoiceSpec(state.settings.frontVoice) || AUTO_VOICE_VALUE;
    state.settings.backVoice = normalizeVoiceSpec(state.settings.backVoice) || AUTO_VOICE_VALUE;
    // state.masterDeck = { ...state.masterDeck, ...load(KEYS.DECK) };
    // state.masterDeck = load(KEYS.DECK) || state.masterDeck;
    const savedDeck = load(KEYS.DECK);
    state.masterDeck = Array.isArray(savedDeck) ? savedDeck : [];

    // 2. ALWAYS setup listeners so buttons work!
    setupEventListeners();
    setupWholePhraseSelection();
    syncSettingsToUI();
    initRemoteMenu();

    if (state.masterDeck.length > 0) {
        refreshCategoryUI();
        applySessionLogic();
    } else {
        ui.frontDisplay.textContent = "Please import a .deck file";
    }

    console.log("init: UI Initialized. FilePicker is:", ui.filePicker);

    setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
    }, 50);
}

function primeSpeechOnFirstGesture() {
    if (!window.speechSynthesis || isSpeechPrimed) {
        return;
    }

    const prime = () => {
        if (isSpeechPrimed) {
            return;
        }

        isSpeechPrimed = true;

        try {
            const warmupUtterance = new SpeechSynthesisUtterance(' ');
            warmupUtterance.volume = 0;
            warmupUtterance.rate = 1;
            warmupUtterance.pitch = 1;

            window.speechSynthesis.cancel();
            window.speechSynthesis.speak(warmupUtterance);
            // Cancel quickly so this unlock does not produce audible output.
            setTimeout(() => window.speechSynthesis.cancel(), 0);
        } catch (error) {
            if (DEBUG) {
                console.warn('[Speech] Prime failed:', error);
            }
        }

        document.removeEventListener('pointerdown', prime, true);
        document.removeEventListener('touchstart', prime, true);
        document.removeEventListener('click', prime, true);
    };

    document.addEventListener('pointerdown', prime, true);
    document.addEventListener('touchstart', prime, true);
    document.addEventListener('click', prime, true);
}

// TODO: remove it
// function updateUIVersion() {
//     ui.versionTag.textContent = `Version: ${CONFIG.VERSION}`;
// }

/**
 * Custom Assertion: Fails loudly if condition is false.
 * @param {boolean} condition - The truth to check.
 * @param {string} message - Description of the expected state.
 * @param {object} context - Optional data to log for debugging.
 */
function assert(condition, message, context = null) {
    if (!condition) {
        console.error(`ASSERTION FAILED: ${message}`);
        if (context) console.dir(context);
        if (DEBUG) alert(`ASSERTION FAILED: ${message}`);
        throw new Error(message);
    }
}

function validateConfiguration() {
    const x = SCORE_SETTINGS;
    assert(typeof x.delta === 'number' && x.delta > 0, "Config: delta must be > 0");
    assert(typeof x.min === 'number', "Config: min must be a number");
    assert(typeof x.max === 'number', "Config: max must be a number");
    assert(x.max - x.min > x.delta, "Config: max - min must be greater than delta", { min: x.min, max: x.max });
}

function assertRequiredUI() {
    const required = [
        'autoPlayFrontOnFlip',
        'autoPlayBackOnFlip',
        'cardInner',
        'categoryList',
        'closeImport',
        'closeSelect',
        'closeSettings',
        'deckBtn',
        'deckOverlay',
        'filePicker',
        'helpBtn',
        'helpOverlay',
        'importBtn',
        'importOverlay',
        'importUrlBtn',
        'menuBtn',
        'menuOverlay',
        'modeSelect',
        'nextZone',
        'prevZone',
        'resetSessionBtn',
        'saveSettingsBtn',
        'searchBar',
        'selectAllBtn',
        'selectNoneBtn',
        'sessionSize',
        'settingsBtn',
        'settingsOverlay',
        'speechRateInput',
        'frontVoiceSearch',
        'frontVoiceSelect',
        'backVoiceSearch',
        'backVoiceSelect',
        'tempInput',
        'versionTag'
    ];

    required.forEach(key => assert(ui[key], `UI element missing: ${key}`));
}

function updateNextZoneModeIcon() {
    const isWeighted = state.settings.selectionMode === 'weighted';
    ui.nextZone.classList.toggle('mode-weighted', isWeighted);
    ui.nextZone.classList.toggle('mode-sequential', !isWeighted);
    ui.nextZone.textContent = isWeighted ? '🔀' : '>';
    ui.nextZone.setAttribute('aria-label', isWeighted ? 'Shuffle mode' : 'Next mode');
    if (ui.freqDown) ui.freqDown.style.visibility = isWeighted ? '' : 'hidden';
    if (ui.freqUp)   ui.freqUp.style.visibility   = isWeighted ? '' : 'hidden';
    if (ui.cardScore) ui.cardScore.style.visibility = isWeighted ? '' : 'hidden';
    if (DEBUG) {
        console.log('[nextZone] icon sync', {
            mode: state.settings.selectionMode,
            className: ui.nextZone.className,
            textContent: ui.nextZone.textContent
        });
    }
}

function debugNextZone(message, context = null) {
    if (!DEBUG) return;
    if (context) {
        console.log(`[nextZone] ${message}`, context);
    } else {
        console.log(`[nextZone] ${message}`);
    }
}

/**
 * Load available voices from the Web Speech API
 * Voices are loaded asynchronously on some browsers
 */
function getVoiceSettingKey(isBack) {
    return isBack ? 'backVoice' : 'frontVoice';
}

function syncVoiceSelectors() {
    if (!ui.frontVoiceSelect || !ui.backVoiceSelect) {
        return;
    }

    renderVoiceOptions(ui.frontVoiceSelect, ui.frontVoiceSearch?.value, state.settings.frontVoice || AUTO_VOICE_VALUE);
    renderVoiceOptions(ui.backVoiceSelect, ui.backVoiceSearch?.value, state.settings.backVoice || AUTO_VOICE_VALUE);
}

function updateVoiceSetting(isBack, value) {
    state.settings[getVoiceSettingKey(isBack)] = normalizeVoiceSpec(value) || AUTO_VOICE_VALUE;
}

/**
 * Detect the language of a card based on its label/metadata
 * Returns a BCP-47 language code like 'en-US', 'fr-FR', 'de-DE'.
 */

function resolveVoiceSpecForSide(card, isBack) {
    const settingsVoice = state.settings?.[getVoiceSettingKey(isBack)];
    if (settingsVoice) return normalizeVoiceSpec(settingsVoice);

    if (!card) return null;

    const sideKey = isBack ? 'backVoice' : 'frontVoice';
    const oppositeKey = isBack ? 'frontVoice' : 'backVoice';

    // 1) Current card in session deck
    if (card[sideKey]) return normalizeVoiceSpec(card[sideKey]);

    // 2) Recover from master deck by id
    if (card.id && Array.isArray(state.masterDeck)) {
        const fromMaster = state.masterDeck.find(c => c.id === card.id);
        if (fromMaster?.[sideKey]) return normalizeVoiceSpec(fromMaster[sideKey]);
        // Fallback: if deck was flipped and voice keys were not swapped in old data,
        // we still prefer having an explicit voice rather than auto-detect.
        if (fromMaster?.[oppositeKey]) return normalizeVoiceSpec(fromMaster[oppositeKey]);
    }

    // 3) Deck defaults from any card that carries voice metadata
    if (Array.isArray(state.masterDeck)) {
        const withVoice = state.masterDeck.find(c => c?.frontVoice || c?.backVoice);
        if (withVoice?.[sideKey]) return normalizeVoiceSpec(withVoice[sideKey]);
        if (withVoice?.[oppositeKey]) return normalizeVoiceSpec(withVoice[oppositeKey]);
    }

    return null;
}


function setSelectionMode(mode, { persist = true } = {}) {
    assert(mode === 'weighted' || mode === 'sequential', `Invalid selection mode: ${mode}`, { mode });
    state.settings.selectionMode = mode;
    if (ui.modeSelect.value !== mode) {
        ui.modeSelect.value = mode;
    }
    updateNextZoneModeIcon();
    const activeSearch = ui.searchBar?.value?.trim() || '';
    if (activeSearch) {
        handleSearch(activeSearch);
    } else {
        applySessionLogic();
    }
    if (persist) {
        save(KEYS.SETTINGS, state.settings);
    }
}

function toggleSelectionModeFromNextZone() {
    const nextMode = state.settings.selectionMode === 'sequential' ? 'weighted' : 'sequential';
    debugNextZone('long-press fired', { currentMode: state.settings.selectionMode, nextMode });
    setSelectionMode(nextMode);
    showModeToast(nextMode);
    if (DEBUG && NEXT_ZONE_DEBUG_ALERT) {
        alert(`nextZone long-press -> ${nextMode}`);
    }
    console.log(`Selection mode toggled via long press: ${nextMode}`);
}

function selectWholePhrase(phraseElement) {
    if (!phraseElement) return false;

    const fullText = (phraseElement.textContent || '').trim();
    if (!fullText) return false;

    const selection = window.getSelection();
    if (!selection) return false;

    isNormalizingPhraseSelection = true;
    const range = document.createRange();
    range.selectNodeContents(phraseElement);
    selection.removeAllRanges();
    selection.addRange(range);

    setTimeout(() => {
        isNormalizingPhraseSelection = false;
    }, 0);

    return true;
}

async function copyTextToClipboard(text) {
    const safeText = (text || '').trim();
    if (!safeText) return false;

    try {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(safeText);
            return true;
        }
    } catch {
        // Fallback below.
    }

    try {
        const tmp = document.createElement('textarea');
        tmp.value = safeText;
        tmp.setAttribute('readonly', '');
        tmp.style.position = 'fixed';
        tmp.style.opacity = '0';
        tmp.style.left = '-9999px';
        document.body.appendChild(tmp);
        tmp.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(tmp);
        return ok;
    } catch {
        return false;
    }
}

async function selectAndCopyPhrase(phraseElement) {
    if (!selectWholePhrase(phraseElement)) return;

    const fullText = (phraseElement.textContent || '').trim();
    const copied = await copyTextToClipboard(fullText);
    showToastMessage(copied ? 'Copied phrase' : 'Selected phrase');
}

function setupEventListeners() {
    // Menu Toggle
    ui.menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        ui.menuOverlay.classList.toggle('is-visible');
    });

    ui.closeMenuBtn?.addEventListener('click', () => {
        ui.menuOverlay.classList.remove('is-visible');
    });

    window.addEventListener('click', () => ui.menuOverlay.classList.remove('is-visible'));

    ui.searchBar.addEventListener('search', (e) => {
    // This triggers when the user clicks the native "X" or presses the keyboard Search button
        handleSearch(e.target.value);
    });

    // Keep your standard input listener for real-time filtering
    ui.searchBar.addEventListener('input', (e) => {
        handleSearch(e.target.value);
    });

    // Help Modal
    ui.helpBtn.addEventListener('click', () => {
        ui.menuOverlay.classList.remove('is-visible');
        toggleHelpModal();
    });

    // Export
    ui.exportBtn?.addEventListener('click', () => {
        ui.menuOverlay.classList.remove('is-visible');
        const deck = state.masterDeck;
        if (!deck || deck.length === 0) {
            showToastMessage('No deck loaded to export.');
            return;
        }

        // Rebuild .deck text from masterDeck
        const lines = [];

        // Deck-wide voice directive (from first card that has voice metadata)
        const voiceCard = deck.find(c => c.frontVoice || c.backVoice);
        if (voiceCard) {
            const fv = voiceCard.frontVoice || '';
            const bv = voiceCard.backVoice || '';
            lines.push(`& Front: ${fv}; Back: ${bv}`);
            lines.push('');
        }

        // Group by category pair (frontLabel|backLabel)
        let lastFrontLabel = null, lastBackLabel = null;
        for (const card of deck) {
            if (card.frontLabel !== lastFrontLabel || card.backLabel !== lastBackLabel) {
                lines.push(`* ${card.frontLabel} | ${card.backLabel}`);
                lastFrontLabel = card.frontLabel;
                lastBackLabel = card.backLabel;
            }
            const score = typeof card.score === 'number' ? card.score : 0;
            lines.push(`${card.frontText} | ${card.backText} | ${score}`);
        }

        const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'deck.deck';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToastMessage(`✅ Exported ${deck.length} cards`);
    });

    // Share
    ui.shareBtn?.addEventListener('click', async () => {
        ui.menuOverlay.classList.remove('is-visible');
        const shareData = {
            title: 'Immersive Flashcards',
            text: '🧠 I\'ve been studying with Immersive Flashcards — a distraction-free, offline-ready PWA for spaced repetition learning. Try it!',
            url: window.location.href,
        };
        if (navigator.share) {
            try {
                await navigator.share(shareData);
            } catch (err) {
                if (err.name !== 'AbortError') console.error('Share failed:', err);
            }
        } else {
            const copied = await copyTextToClipboard(`${shareData.text}\n${shareData.url}`);
            showToastMessage(copied ? '🔗 Link copied to clipboard!' : 'Copy the URL from your address bar');
        }
    });

    ui.helpOverlay.addEventListener('click', (e) => {
        // If they click the close button OR the dark background area
        if (e.target.id === 'closeHelp' || e.target === ui.helpOverlay) {
            toggleHelpModal(false);
        }
    });

    // Tutor Chat
    ui.closeTutor?.addEventListener('click', () => closeTutorChat());
    ui.tutorOverlay?.addEventListener('click', (e) => {
        if (e.target === ui.tutorOverlay) closeTutorChat();
    });
    ui.tutorSend?.addEventListener('click', () => sendTutorMessage());
    ui.tutorInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendTutorMessage(); }
    });
    ui.tutorMic?.addEventListener('click', () => handleTutorMic());
    ui.tutorClear?.addEventListener('click', () => {
        tutorConversation.clear();
        if (ui.tutorMessages) ui.tutorMessages.innerHTML = '';
    });

    // Settings Modal
    ui.settingsBtn.addEventListener('click', () => {
        ui.menuOverlay.classList.remove('is-visible');
        loadAvailableVoices();
        syncSettingsToUI();
        ui.settingsOverlay.classList.add('is-visible');
    });

    ui.closeSettings.addEventListener('click', () => {
        ui.settingsOverlay.classList.remove('is-visible');
        save(KEYS.SETTINGS, state.settings);
    });

    ui.saveSettingsBtn.addEventListener('click', () => {
        updateStateFromUI();
        save(KEYS.SETTINGS, state.settings);
        ui.settingsOverlay.classList.remove('is-visible');
        const activeSearch = ui.searchBar?.value?.trim() || '';
        if (activeSearch) {
            handleSearch(activeSearch);
        } else {
            applySessionLogic();
        }
    });

    ui.modeSelect.addEventListener('change', (e) => {
        setSelectionMode(e.target.value);
        console.log(`Card selection mode: ${e.target.value}`);
    });

    // Deck Selector Modal
    ui.deckBtn.addEventListener('click', () => {
        refreshCategoryUI();
        ui.menuOverlay.classList.remove('is-visible');
        ui.deckOverlay.classList.add('is-visible');
    });



    // SRS Slider Feedback
    // ui.srsFactorInput?.addEventListener('input', (e) => {
    //     ui.srsFactorVal.textContent = e.target.value;
    // });

    // Card Interaction
    // ui.cardInner?.addEventListener('click', (e) => {
    //     console.log("DEBUG: Card clicked! Target:", e.target);
    //     state.isFlipped = !state.isFlipped;
    //     ui.cardInner.classList.toggle('is-flipped', state.isFlipped);
    // });

    ui.nextZone.addEventListener('click', (e) => {
        e.stopPropagation();
        debugNextZone('click received', { longPressTriggered: nextZoneLongPressTriggered, mode: state.settings.selectionMode });
        if (nextZoneLongPressTriggered) {
            nextZoneLongPressTriggered = false;
            debugNextZone('click ignored after long-press');
            return;
        }
        if (state.settings.selectionMode === 'sequential') {
            debugNextZone('click action: navigate(1)');
            navigate(1);
        } else {
            debugNextZone('click action: drawCard()');
            drawCard();
        }
    });

    const startNextZoneLongPress = (source) => {
        nextZoneLongPressTriggered = false;
        clearTimeout(nextZoneLongPressTimer);
        debugNextZone('long-press timer start', { source, thresholdMs: NEXT_ZONE_LONG_PRESS_MS });
        nextZoneLongPressTimer = setTimeout(() => {
            nextZoneLongPressTriggered = true;
            debugNextZone('long-press timer elapsed', { source });
            toggleSelectionModeFromNextZone();
        }, NEXT_ZONE_LONG_PRESS_MS);
    };

    const cancelNextZoneLongPress = (reason) => {
        debugNextZone('long-press timer cancel', { reason });
        clearTimeout(nextZoneLongPressTimer);
    };

    if (window.PointerEvent) {
        ui.nextZone.addEventListener('pointerdown', (e) => {
            if (e.pointerType === 'mouse' && e.button !== 0) return;
            startNextZoneLongPress(`pointerdown:${e.pointerType}`);
        });
        ui.nextZone.addEventListener('pointerup', () => cancelNextZoneLongPress('pointerup'));
        ui.nextZone.addEventListener('pointerleave', () => cancelNextZoneLongPress('pointerleave'));
        ui.nextZone.addEventListener('pointercancel', () => cancelNextZoneLongPress('pointercancel'));
    } else {
        ui.nextZone.addEventListener('touchstart', () => startNextZoneLongPress('touchstart'), { passive: true });
        ui.nextZone.addEventListener('touchend', () => cancelNextZoneLongPress('touchend'));
        ui.nextZone.addEventListener('touchcancel', () => cancelNextZoneLongPress('touchcancel'));
        ui.nextZone.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            startNextZoneLongPress('mousedown');
        });
        ui.nextZone.addEventListener('mouseup', () => cancelNextZoneLongPress('mouseup'));
        ui.nextZone.addEventListener('mouseleave', () => cancelNextZoneLongPress('mouseleave'));
    }

    ui.nextZone.addEventListener('contextmenu', (e) => e.preventDefault());

    ui.prevZone.addEventListener('click', (e) => {
        e.stopPropagation();
        if (state.settings.selectionMode === 'sequential') {
            navigate(-1);
        } else {
            navigateBack();
        }
    });

    // File Import
    // ui.importBtn?.addEventListener('click', () => {
    //     ui.menuOverlay.classList.remove('is-visible');
    //     ui.filePicker.click();
    // });

    ui.importBtn.addEventListener('click', () => {
        // 1. Hide the main menu overlay
        ui.menuOverlay.classList.remove('is-visible');

        // 2. Show the new import options overlay
        ui.importOverlay.classList.add('is-visible');
    });

    ui.filePicker.addEventListener('change', async (e) => {
        console.log("DEBUG: File selected:", e.target.files);
        const file = e.target.files[0];
        if (!file) return;
        try {
            // deckReader does the reading, parsing, AND sanitizing
            let importedDeck = await deckReader(file);

            // Check if user wants to flip the deck
            const flipDeckCheckbox = document.getElementById('flipDeckCheckbox');
            if (flipDeckCheckbox && flipDeckCheckbox.checked) {
                importedDeck = flipDeck(importedDeck);
                console.log("Deck flipped - front/back reversed");
                flipDeckCheckbox.checked = false; // Reset checkbox for next import
            }

            await handleImportData(importedDeck);
        } catch (error) {
            // alert(error);
            console.log("ERROR: filePicker: error= ", error);
        }
    });

    ui.importUrlBtn.addEventListener('click', async () => {
        const url = prompt("Enter raw .deck URL:");
        if (!url) return;
        try {
            const text = await fetchTextFromUrl(url);
            let cards = processDeckText(text);

            // Check if user wants to flip the deck
            const flipDeckCheckbox = document.getElementById('flipDeckCheckbox');
            if (flipDeckCheckbox && flipDeckCheckbox.checked) {
                cards = flipDeck(cards);
                console.log("Deck flipped - front/back reversed");
                flipDeckCheckbox.checked = false; // Reset checkbox for next import
            }

            await handleImportData(cards);
        } catch (err) {
            console.error("URL import failed:", err.message);
        }
    });

    ui.closeImport.addEventListener('click', () => {
        ui.importOverlay.classList.remove('is-visible');
    });

    ui.closeSelect.addEventListener('click', () => {
        const checkboxes = ui.categoryList.querySelectorAll('input:checked');
        const selected = Array.from(checkboxes).map(cb => cb.value);

        if (selected.length === 0) {
            showToastMessage('⚠️ Select at least one category', 1000, { centered: true });
            return;
        }

        state.settings.activeCategories = selected;
        ui.deckOverlay.classList.remove('is-visible');
        applySessionLogic();
        save(KEYS.SETTINGS, state.settings);
    });

    ui.selectAllBtn.addEventListener('click', () => {
        const checkboxes = ui.categoryList.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(cb => cb.checked = true);
    });

    ui.selectNoneBtn.addEventListener('click', () => {
        const checkboxes = ui.categoryList.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(cb => cb.checked = false);
    });

    document.querySelectorAll('.adj-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetId = btn.dataset.target;
            const direction = parseFloat(btn.dataset.dir); // -1 or 1

            if (targetId === 'speechRateInput') {
                const current = state.settings.speechRate;
                const nextVal = current + (direction * SPEECH_RATE.delta);
                updateSpeechRate(nextVal);
            } else if (targetId === 'tempInput') {
                const current = state.settings.temperature;
                const nextVal = current + (direction * TEMPERATURE.delta);
                updateTemperature(nextVal);
            }
        });
    });

    ui.tempInput.addEventListener('change', (e) => {
        updateTemperature(parseFloat(e.target.value) || TEMPERATURE.default);
    });

    ui.speechRateInput.addEventListener('change', (e) => {
        updateSpeechRate(parseFloat(e.target.value) || SPEECH_RATE.default);
    });

    ui.frontVoiceSearch.addEventListener('input', (e) => {
        renderVoiceOptions(ui.frontVoiceSelect, e.target.value, state.settings.frontVoice || AUTO_VOICE_VALUE);
    });

    ui.backVoiceSearch.addEventListener('input', (e) => {
        renderVoiceOptions(ui.backVoiceSelect, e.target.value, state.settings.backVoice || AUTO_VOICE_VALUE);
    });

    ui.frontVoiceSelect.addEventListener('change', (e) => {
        updateVoiceSetting(false, e.target.value);
    });

    ui.backVoiceSelect.addEventListener('change', (e) => {
        updateVoiceSetting(true, e.target.value);
    });

    ui.resetSessionBtn.addEventListener('click', () => {
        resetSessionSettings();
    });

    // ui.updateBadge.addEventListener('click', updateApp);

    // TODO: connect Settings x button to Save & Restart
    // TODO: call save(KEYS.SETTINGS, state.settings) only on Close, Reset, or Save & Restart

    /**
     * Double-click to Select All
     * This allows one-click erasure/replacement
     */
    [ui.tempInput, ui.sessionSize, ui.speechRateInput].forEach(el => {
        el.addEventListener('focus', (e) => {
            // We use a tiny timeout because some browsers
            // reset the cursor AFTER the focus event fires,
            // which would undo our selection.
            setTimeout(() => {  e.target.select();}, 50);
        });
    });

    window.addEventListener('beforeunload', () => {
        // Final emergency save just in case they didn't click 'Close'
        save(KEYS.SETTINGS, state.settings);
    });

    setupCardListeners();
}

/**
 * NEW: Unified handler for all import sources
 */
async function handleImportData(cards) {
    assert(Array.isArray(cards),
           `Imported data must be an array of cards.`);
    // if (!cards || cards.length === 0) return;
    state.masterDeck = cards;
    save(KEYS.DECK, state.masterDeck);
    refreshCategoryUI();
    applySessionLogic();
    ui.menuOverlay?.classList.remove('is-visible');
    ui.importOverlay?.classList.remove('is-visible');
    const categoryCount = new Set(cards.map(c => c.frontLabel)).size;
    showToastMessage(`✅ Imported ${cards.length} cards across ${categoryCount} ${categoryCount === 1 ? 'category' : 'categories'}`, 3000, { centered: true });
    console.log("Import successful, deck size:", cards.length);
}

/**
 * NEW: Logic to populate the GitHub Example Menu
 */
async function initRemoteMenu(path = REPO_CONFIG.basePath) {
    if (!ui.remoteExamplesList) return;

    // Reset UI
    ui.remoteExamplesList.innerHTML = '<p class="hint">Scanning GitHub...</p>';

    try {
        // This now calls our standalone function
        const files = await fetchRemoteDeckList(path);

        ui.remoteExamplesList.innerHTML = '';

        // Add Breadcrumb
        const breadcrumb = document.createElement('div');
        breadcrumb.className = 'path-breadcrumb';
        breadcrumb.textContent = `📍 ${path}`;
        ui.remoteExamplesList.appendChild(breadcrumb);

        // BACK button
        if (path !== REPO_CONFIG.basePath) {
            const parts = path.split('/');
            parts.pop();
            const parentPath = parts.join('/') || REPO_CONFIG.basePath;
            ui.remoteExamplesList.appendChild(createRemoteItem("⬅️ .. Back", () => initRemoteMenu(parentPath), 'back-btn'));
        }

        // Render contents
        files.forEach(file => {
            if (file.type === 'dir') {
                ui.remoteExamplesList.appendChild(createRemoteItem(`📁 ${file.name}/`, () => initRemoteMenu(file.path), 'dir-item'));
            } else if (file.name.endsWith('.deck')) {
                ui.remoteExamplesList.appendChild(createRemoteItem(`📚 ${file.name.replace('.deck', '')}`, async () => {
                    const text = await fetchTextFromUrl(file.download_url);
                    let cards = processDeckText(text);

                    // Check if user wants to flip the deck
                    const flipDeckCheckbox = document.getElementById('flipDeckCheckbox');
                    if (flipDeckCheckbox && flipDeckCheckbox.checked) {
                        cards = flipDeck(cards);
                        console.log("Deck flipped - front/back reversed");
                        flipDeckCheckbox.checked = false; // Reset checkbox for next import
                    }

                    await handleImportData(cards);
                    console.log(`Successfully imported ${cards.length} cards from ${file.name}`);
                }, 'file-item'));
            }
        });
    } catch (err) {
        ui.remoteExamplesList.innerHTML = `<p class="hint" style="color: red;">Error: ${err.message}</p>`;
    }
}

/**
 * Updated Helper to strictly stop event bubbling
 */
function createRemoteItem(text, onClickHandler, extraClass) {
    const btn = document.createElement('button');
    btn.className = `remote-deck-item ${extraClass}`;
    btn.textContent = text;
    btn.type = "button"; // Explicitly not a 'submit' button

    btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation(); // VERY IMPORTANT: Stops parent elements from hearing this click
        onClickHandler(e);
    }, false);

    return btn;
}

function updateSessionSize(newVal) {
    assert(ui.sessionSize, "Session size input element not found in UI.", ui);
    const clamped = Math.max(SESSION_SIZE.min, Math.min(SESSION_SIZE.max, newVal));
    state.settings.sessionSize = clamped;
    ui.sessionSize.value = clamped;
    console.log(`Session size updated to: ${clamped}`);
}

function updateSpeechRate(newVal) {
    assert(ui.speechRateInput, "Speech rate input element not found in UI.");
    const clamped = Math.max(SPEECH_RATE.min, Math.min(SPEECH_RATE.max, newVal));
    state.settings.speechRate = clamped;
    ui.speechRateInput.value = clamped.toFixed(1);
    console.log(`Speech rate updated to: ${clamped}`);
}

function updateTemperature(newVal) {
    assert(ui.tempInput, "Temperature input element not found in UI.", ui);
    const clamped = Math.max(TEMPERATURE.min, Math.min(TEMPERATURE.max, newVal));
    state.settings.temperature = clamped;
    state.calculateProbabilities = true; // Business-logic requirement
    ui.tempInput.value = clamped.toFixed(1);
    console.log(`Temperature updated to: ${clamped}`);
}

function resetSessionSettings() {
    updateTemperature(TEMPERATURE.default);
    updateSpeechRate(SPEECH_RATE.default);
    state.settings.autoPlayFrontOnFlip = false;
    state.settings.autoPlayBackOnFlip = false;
    state.settings.frontVoice = AUTO_VOICE_VALUE;
    state.settings.backVoice = AUTO_VOICE_VALUE;
    if (ui.autoPlayFrontOnFlip) ui.autoPlayFrontOnFlip.checked = false;
    if (ui.autoPlayBackOnFlip) ui.autoPlayBackOnFlip.checked = false;
    if (ui.frontVoiceSearch) ui.frontVoiceSearch.value = '';
    if (ui.backVoiceSearch) ui.backVoiceSearch.value = '';
    syncVoiceSelectors();
    updateSessionSize(SESSION_SIZE.default);
    if (ui.historySize) ui.historySize.value = HISTORY_SIZE.default;
    state.settings.historySize = HISTORY_SIZE.default;
    console.log(`resetSessionSettings: default values restored.`);
}

// Example of how to handle the 4 distinct actions
function setupCardListeners() {
    if (ui.cardInner.dataset.initialized === 'true') return;

    // --- CONFIGURATION CONSTANTS ---
    const TOUCH_MOVE_THRESHOLD_PX = 10;
    const MOUSE_MOVE_THRESHOLD_PX = 8;
    const TOUCH_LONG_PRESS_DURATION_MS = 250;
    let lastFlipTime = 0; // NEW: Track when the last flip happened
    const DEBOUNCE_MS = 250; // NEW: Ignore events within 250ms of each other

    // Determine environment to set the correct movement tolerance
    const isTouchEnv = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const currentMoveThreshold = isTouchEnv ? TOUCH_MOVE_THRESHOLD_PX : MOUSE_MOVE_THRESHOLD_PX;

    let startX, startY;
    let touchTimer = null;
    let isLongPress = false;
    let isMultiTouchGesture = false;

    // We pass an explicit 'isMouse' flag to separate the logic
    const handleStart = (x, y, target, isMouse) => {
        startX = x;
        startY = y;
        isLongPress = false;

        if (touchTimer) clearTimeout(touchTimer);

        // Desktop users natively click-and-drag to select text,
        // so we ONLY need the long-press timer for touch devices.
        if (!isMouse) {
            touchTimer = setTimeout(() => {
                isLongPress = true;

                const phraseElement = target?.closest?.('#frontDisplay, #backDisplay');
                if (phraseElement) {
                    selectAndCopyPhrase(phraseElement);
                }
            }, TOUCH_LONG_PRESS_DURATION_MS);
        }
    };

    const handleEnd = (x, y, target, isMouse) => {
        const now = Date.now();
        // --- NEW MODIFICATION: The Double-Event Guard ---
        if (now - lastFlipTime < DEBOUNCE_MS) {
            console.log(`[DEBUG] Blocked double-fire from: ${isMouse ? 'Mouse' : 'Touch'}`);
            return;
        }

        if (touchTimer) clearTimeout(touchTimer);

        const diffX = Math.abs(x - startX);
        const diffY = Math.abs(y - startY);

        console.log(`[DEBUG] handleEnd | isMouse: ${isMouse}, diffX: ${diffX}, diffY: ${diffY}, isLongPress: ${isLongPress}`);

        // 1. Cancel if movement exceeds the defined pixel threshold (Drag/Highlight)
        if (diffX > currentMoveThreshold || diffY > currentMoveThreshold) {
            console.log("[DEBUG] Cancelled: Exceeded move threshold");
            return;
        }

        // 2. Cancel if touch timer completed (Copy intent on Pixel)
        if (!isMouse && isLongPress) {
            console.log("[DEBUG] Cancelled: Touch long press detected");
            return;
        }

        // 3. Cancel if a button was the target
        if (target.closest('button')) {
            console.log("[DEBUG] Cancelled: Clicked a button");
            return;
        }

        // 4. Clean Click/Tap: Execute Flip
        console.log("[DEBUG] Executing Flip!");
        lastFlipTime = now; // Record the time of this flip
        state.isFlipped = !ui.cardInner.classList.contains('is-flipped');
        ui.cardInner.classList.toggle('is-flipped', state.isFlipped);
        console.log(`[DEBUG] Executing Flip from: ${isMouse ? 'Mouse' : 'Touch'}`);

        const shouldAutoPlay = state.isFlipped
            ? Boolean(state.settings.autoPlayBackOnFlip)
            : Boolean(state.settings.autoPlayFrontOnFlip);
        if (shouldAutoPlay) {
            playAudio();
        }
    };

    // --- Mouse Listeners (Desktop) ---
    ui.cardInner.addEventListener('mousedown', e => {
        if (e.button !== 0) return; // Only accept left-clicks
        handleStart(e.clientX, e.clientY, e.target, true);
    });

    ui.cardInner.addEventListener('mouseup', e => {
        if (e.button !== 0) return;
        handleEnd(e.clientX, e.clientY, e.target, true);
    });

    // --- Touch Listeners (Pixel) ---
    ui.cardInner.addEventListener('touchstart', e => {
        if (e.touches.length !== 1) {
            isMultiTouchGesture = true;
            if (touchTimer) clearTimeout(touchTimer);
            return;
        }

        isMultiTouchGesture = false;
        handleStart(e.touches[0].clientX, e.touches[0].clientY, e.target, false);
    }, { passive: true });

    ui.cardInner.addEventListener('touchmove', e => {
        if (e.touches.length > 1) {
            isMultiTouchGesture = true;
            if (touchTimer) clearTimeout(touchTimer);
        }
    }, { passive: true });

    ui.cardInner.addEventListener('touchend', e => {
        if (isMultiTouchGesture || e.changedTouches.length !== 1) {
            if (touchTimer) clearTimeout(touchTimer);
            if (e.touches.length === 0) {
                isMultiTouchGesture = false;
            }
            return;
        }

        handleEnd(e.changedTouches[0].clientX, e.changedTouches[0].clientY, e.target, false);
    }, { passive: true });

    ui.cardInner.addEventListener('touchcancel', () => {
        if (touchTimer) clearTimeout(touchTimer);
        isMultiTouchGesture = false;
    }, { passive: true });

    // --- Control Button Listeners (outside flip zone, direct bindings) ---
    ui.freqDown?.addEventListener('click', () => handleFrequencyChange(-1));
    ui.freqUp?.addEventListener('click', () => handleFrequencyChange(1));
    ui.audioBtn?.addEventListener('click', () => playAudio());
    ui.micBtn?.addEventListener('click', () => openTutorChat());

    ui.cardInner.dataset.initialized = 'true';
}

function setupWholePhraseSelection() {
    if (document.body.dataset.wholePhraseSelectionInitialized === 'true') return;

    document.addEventListener('selectionchange', () => {
        if (isNormalizingPhraseSelection) return;

        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;

        const range = selection.getRangeAt(0);
        const container = range.commonAncestorContainer;
        const baseElement = container.nodeType === Node.TEXT_NODE
            ? container.parentElement
            : container;

        const phraseElement = baseElement?.closest?.('#frontDisplay, #backDisplay');
        if (!phraseElement) return;

        const selectedText = selection.toString().trim();
        const fullText = (phraseElement.textContent || '').trim();

        // Expand Android's default single-word selection to the full phrase.
        if (!selectedText || !fullText || selectedText === fullText) return;

        isNormalizingPhraseSelection = true;
        const fullRange = document.createRange();
        fullRange.selectNodeContents(phraseElement);
        selection.removeAllRanges();
        selection.addRange(fullRange);

        setTimeout(() => {
            isNormalizingPhraseSelection = false;
        }, 0);
    });

    document.body.dataset.wholePhraseSelectionInitialized = 'true';
}

function handleFrequencyChange(change) {
    const card = state.currentSessionDeck[state.currentCardIndex];

    if (!card) {
        showToastMessage('Please load the deck!', 2000, { centered: true });
        return;
    }

    // 1. Assert Entry State
    assert(typeof card.score === 'number', "Card missing score", card);
    assert(change === 1 || change === -1, "Invalid frequency change direction", { change });

    card.score = applyScoreChange(card.score, change);

    // 4. Trigger Recalc
    state.calculateProbabilities = true;

    save(KEYS.DECK, state.masterDeck);
    provideVisualFeedback(change > 0 ? 'up' : 'down');
    if (ui.cardScore) {
        ui.cardScore.textContent = `Score: ${card.score}`;
        ui.cardScore.classList.add('score-flash');
        setTimeout(() => ui.cardScore.classList.remove('score-flash'), 1200);
    }
}

function handleSearch(query) {
    const searchTerm = query.toLowerCase().trim();

    if (searchTerm === "") {
        lastNoCardsSearchTerm = '';
        // If search is empty, go back to the normal session deck
        applySessionLogic();
        return;
    }

    const searchResults = filterCards(state.masterDeck, query);

    if (searchResults.length > 0) {
        lastNoCardsSearchTerm = '';
        state.currentSessionDeck = searchResults;
        state.currentCardIndex = 0;
        updateUI();
    } else {
        state.currentSessionDeck = [];
        state.currentCardIndex = 0;
        updateUI();

        lastNoCardsSearchTerm = notifyNoCardsSelected(searchTerm, lastNoCardsSearchTerm);

        console.log("Search: No matches found for:", query);
    }
}

function updateProbabilities() {
    updateProbabilitiesForSession(state, calculateProbabilities, assert);
    console.log('DEBUG: updateProbabilities: Updated probabilities for current session.', {
        probabilities: state.sessionProbabilities
    });
}

function pushToHistory(cardIndex) {
    pushToHistoryBuffer(state, cardIndex);
}

function navigateBack() {
    navigateBackInSession(state, ui, updateUI, showToastMessage);
}

function navigate(direction) {
    navigateInSession(state, ui, direction, updateUI, pushToHistory);
}

/**
 * Modified Navigation for Weighted Streaming
 */
function drawCard() {
    drawCardFromSession(state, ui, pickWeightedCard, updateUI, pushToHistory, updateProbabilities);
}

function applySessionLogic() {
    applySessionLogicToState(state, generateSessionDeck, assert, updateUI);
}

function getCardOrdinalInMasterDeck(card) {
    return getCardOrdinalFromState(state, card);
}

function updateUI() {
    updateUIRender(state, ui, getCardOrdinalInMasterDeck);
}

function syncSettingsToUI() {
    if (ui.sessionSize) ui.sessionSize.value = state.settings.sessionSize;
    if (ui.historySize) ui.historySize.value = state.settings.historySize;
    if (ui.tempInput) ui.tempInput.value = state.settings.temperature;
    // if (ui.srsFactorInput) {
    //     ui.srsFactorInput.value = state.settings.srsFactor;
    //     ui.srsFactorVal.textContent = state.settings.srsFactor;
    // }
    if (ui.speechRateInput) ui.speechRateInput.value = state.settings.speechRate;
    if (ui.modeSelect) ui.modeSelect.value = state.settings.selectionMode;
    if (ui.autoPlayFrontOnFlip) ui.autoPlayFrontOnFlip.checked = Boolean(state.settings.autoPlayFrontOnFlip);
    if (ui.autoPlayBackOnFlip) ui.autoPlayBackOnFlip.checked = Boolean(state.settings.autoPlayBackOnFlip);
    if (ui.frontVoiceSearch) ui.frontVoiceSearch.value = '';
    if (ui.backVoiceSearch) ui.backVoiceSearch.value = '';
    if (ui.apiKeyInput) ui.apiKeyInput.value = sessionStorage.getItem(TUTOR_API_KEY_STORAGE) || '';
    if (ui.enableChromeAI) ui.enableChromeAI.checked = state.settings.enableChromeAI !== false;
    if (ui.enableOllama) ui.enableOllama.checked = state.settings.enableOllama !== false;
    if (ui.enableOpenAI) ui.enableOpenAI.checked = Boolean(state.settings.enableOpenAI);
    if (ui.ollamaUrlInput) ui.ollamaUrlInput.value = state.settings.ollamaUrl || '';
    if (ui.ollamaModelInput) ui.ollamaModelInput.value = state.settings.ollamaModel || '';
    if (ui.openaiModelInput) ui.openaiModelInput.value = state.settings.openaiModel || '';
    syncVoiceSelectors();
    updateNextZoneModeIcon();
}

function updateStateFromUI() {
    state.settings.sessionSize = parseInt(ui.sessionSize.value);
    state.settings.historySize = Math.max(HISTORY_SIZE.min, Math.min(HISTORY_SIZE.max, parseInt(ui.historySize?.value) || 0));
    state.settings.temperature = parseFloat(ui.tempInput.value);
    state.settings.speechRate = parseFloat(ui.speechRateInput.value);
    state.settings.selectionMode = ui.modeSelect?.value || 'sequential';
    state.settings.autoPlayFrontOnFlip = Boolean(ui.autoPlayFrontOnFlip.checked);
    state.settings.autoPlayBackOnFlip = Boolean(ui.autoPlayBackOnFlip.checked);
    state.settings.frontVoice = normalizeVoiceSpec(ui.frontVoiceSelect?.value) || AUTO_VOICE_VALUE;
    state.settings.backVoice = normalizeVoiceSpec(ui.backVoiceSelect?.value) || AUTO_VOICE_VALUE;
    state.settings.enableChromeAI = Boolean(ui.enableChromeAI?.checked);
    state.settings.enableOllama = Boolean(ui.enableOllama?.checked);
    state.settings.enableOpenAI = Boolean(ui.enableOpenAI?.checked);
    state.settings.ollamaUrl = ui.ollamaUrlInput?.value?.trim() || '';
    state.settings.ollamaModel = ui.ollamaModelInput?.value?.trim() || '';
    state.settings.openaiModel = ui.openaiModelInput?.value?.trim() || '';
    // API key stored separately (not in settings object)
    const keyVal = ui.apiKeyInput?.value?.trim() || '';
    if (keyVal) {
        sessionStorage.setItem(TUTOR_API_KEY_STORAGE, keyVal);
    } else {
        sessionStorage.removeItem(TUTOR_API_KEY_STORAGE);
    }
}

function refreshCategoryUI() {
    refreshCategoryUIRender(state, ui);
}

function provideVisualFeedback(type) {
    provideVisualFeedbackRender(ui, type);
}

const isTestEnvironment = typeof process !== 'undefined' && process.env.NODE_ENV === 'test';

// Ignition
if (!isTestEnvironment) {
    if (document.readyState === 'complete') {
        init();
    } else {
        window.addEventListener('load', init);
    }
}

function playAudio() {
    const card = state.currentSessionDeck[state.currentCardIndex];
    if (!card) return;

    if (!window.speechSynthesis || typeof SpeechSynthesisUtterance === 'undefined') {
        showToastMessage('Audio is not available in this browser context.', 2000, { centered: true });
        return;
    }

    // Stop any existing speech
    window.speechSynthesis.cancel();

    // Determine text and voice preference based on flip state
    const textToSpeak = state.isFlipped ? card.backText : card.frontText;
    const voiceSpec = resolveVoiceSpecForSide(card, state.isFlipped);

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    let hasRetriedWithDefaultVoice = false;

    let selectedVoice = null;
    let languageCode = null;

    // Priority 1: Use card's voice specification if available
    if (voiceSpec) {
        const parsedVoiceSpec = parseVoiceSpec(voiceSpec);
        // Even if exact voice name is unavailable, preserve requested locale from deck metadata.
        if (parsedVoiceSpec?.lang) {
            languageCode = parsedVoiceSpec.lang;
            utterance.lang = languageCode;
        }

        selectedVoice = selectVoiceBySpec(voiceSpec);
        if (selectedVoice) {
            languageCode = selectedVoice.lang;
            utterance.voice = selectedVoice;
            utterance.lang = languageCode;
        } else if (parsedVoiceSpec?.lang) {
            selectedVoice = selectBestVoiceForLanguage(parsedVoiceSpec.lang);
            if (selectedVoice) {
                utterance.voice = selectedVoice;
                utterance.lang = selectedVoice.lang;
                languageCode = selectedVoice.lang;
            }
        }
    }

    // Priority 2: Fall back to language detection only when no language was resolved yet.
    // If voiceSpec provided a locale (e.g. es-ES), keep it even when no matching installed voice exists.
    if (!selectedVoice && !languageCode) {
        languageCode = detectLanguageFromCard(card, {
            isBack: state.isFlipped,
            textOverride: textToSpeak
        });
        utterance.lang = languageCode;
        selectedVoice = selectBestVoiceForLanguage(languageCode);
        if (selectedVoice) {
            utterance.voice = selectedVoice;
        }
    }

    // Use the speech rate from our settings slider
    utterance.rate = state.settings.speechRate || 1.0;
    utterance.pitch = 1.0; // Keep a neutral pitch for all content domains

    if (DEBUG) {
        console.log(`[Speech] Speaking (${state.isFlipped ? 'Back' : 'Front'}):`, {
            text: textToSpeak,
            voiceSpec: voiceSpec || 'auto-detected',
            language: languageCode,
            voice: selectedVoice ? selectedVoice.name : 'default',
            rate: utterance.rate,
            pitch: utterance.pitch
        });
    } else {
        console.log(`Speaking (${state.isFlipped ? 'Back' : 'Front'}): ${textToSpeak}`);
    }

    utterance.onerror = (event) => {
        const errorCode = event?.error || 'unknown';
        if (DEBUG) {
            console.error('[Speech] onerror:', errorCode, event);
        }

        // Pixel/Chrome can fail with selected lang/voice on local/LAN dev URLs.
        // Retry once using the browser default voice and language before failing.
        if (!hasRetriedWithDefaultVoice) {
            hasRetriedWithDefaultVoice = true;
            try {
                const fallback = new SpeechSynthesisUtterance(textToSpeak);
                fallback.rate = utterance.rate;
                fallback.pitch = utterance.pitch;
                fallback.onerror = (fallbackEvent) => {
                    if (DEBUG) {
                        console.error('[Speech] fallback onerror:', fallbackEvent?.error || fallbackEvent);
                    }
                    showToastMessage('Audio unavailable right now.', 1800, { centered: true });
                };

                window.speechSynthesis.cancel();
                window.speechSynthesis.resume();
                window.speechSynthesis.speak(fallback);
                return;
            } catch (fallbackError) {
                if (DEBUG) {
                    console.error('[Speech] fallback throw:', fallbackError);
                }
            }
        }
    };

    // Some mobile engines get stuck in paused state after backgrounding.
    try {
        window.speechSynthesis.resume();
    } catch {
        // ignore
    }

    window.speechSynthesis.speak(utterance);
}

// ---------- Tutor Chat ----------

async function openTutorChat() {
    const s = state.settings;
    const apiKey = sessionStorage.getItem(TUTOR_API_KEY_STORAGE);
    const ollamaUrl = s.ollamaUrl || undefined;
    const useChromeAI = s.enableChromeAI !== false;
    const useOllama = s.enableOllama !== false;
    const useOpenAI = Boolean(s.enableOpenAI);

    let anyAvailable = false;
    if (useChromeAI && (await isChromeAIAvailable()) === 'readily') anyAvailable = true;
    if (!anyAvailable && useOllama && await isOllamaAvailable(ollamaUrl)) anyAvailable = true;
    if (!anyAvailable && useOpenAI && apiKey) anyAvailable = true;

    if (!anyAvailable) {
        showToastMessage('No AI backend available. Enable one in Settings and make sure it\'s running.', 3500, { centered: true });
        return;
    }
    ui.tutorOverlay?.classList.add('is-visible');
    ui.tutorInput?.focus();
}

function closeTutorChat() {
    ui.tutorOverlay?.classList.remove('is-visible');
}

function appendTutorMsg(role, text) {
    const div = document.createElement('div');
    div.className = `tutor-msg ${role}`;
    div.textContent = text;
    // Tap assistant messages to hear them via TTS
    if (role === 'assistant') {
        div.addEventListener('click', () => {
            if (window.speechSynthesis && typeof SpeechSynthesisUtterance !== 'undefined') {
                const utter = new SpeechSynthesisUtterance(text);
                utter.lang = 'es';
                const voice = selectBestVoiceForLanguage('es');
                if (voice) utter.voice = voice;
                utter.rate = parseFloat(state.settings.speechRate) || 1.0;
                window.speechSynthesis.cancel();
                window.speechSynthesis.speak(utter);
            }
        });
    }
    ui.tutorMessages?.appendChild(div);
    ui.tutorMessages?.scrollTo(0, ui.tutorMessages.scrollHeight);
    return div;
}

async function sendTutorMessage() {
    const text = ui.tutorInput?.value?.trim();
    if (!text) return;
    const apiKey = sessionStorage.getItem(TUTOR_API_KEY_STORAGE);
    ui.tutorInput.value = '';
    appendTutorMsg('user', text);
    const typing = appendTutorMsg('typing', '…');

    try {
        const reply = await tutorConversation.ask(text, apiKey, {
            enableChromeAI: state.settings.enableChromeAI !== false,
            enableOllama: state.settings.enableOllama !== false,
            enableOpenAI: Boolean(state.settings.enableOpenAI),
            ollamaUrl: state.settings.ollamaUrl || undefined,
            ollamaModel: state.settings.ollamaModel || undefined,
            openaiModel: state.settings.openaiModel || undefined,
        });
        typing.remove();
        appendTutorMsg('assistant', reply);
        // Auto-speak the reply in Spanish
        if (window.speechSynthesis && typeof SpeechSynthesisUtterance !== 'undefined') {
            const utter = new SpeechSynthesisUtterance(reply);
            utter.lang = 'es';
            const voice = selectBestVoiceForLanguage('es');
            if (voice) utter.voice = voice;
            utter.rate = parseFloat(state.settings.speechRate) || 1.0;
            window.speechSynthesis.cancel();
            window.speechSynthesis.speak(utter);
        }
    } catch (err) {
        typing.remove();
        const msg = err?.message || 'Request failed';
        appendTutorMsg('error', msg);
    }
}

async function handleTutorMic() {
    if (!isRecognitionSupported()) {
        showToastMessage('Speech recognition not supported in this browser', 2000, { centered: true });
        return;
    }
    ui.tutorMic?.classList.add('listening');
    try {
        const transcripts = await listenForSpeech('es-ES');
        ui.tutorMic?.classList.remove('listening');
        if (transcripts?.length) {
            ui.tutorInput.value = transcripts[0];
            sendTutorMessage();
        }
    } catch (err) {
        ui.tutorMic?.classList.remove('listening');
        if (err?.error === 'no-speech') {
            showToastMessage('No speech detected — try again', 2000, { centered: true });
        } else if (err?.error === 'not-allowed') {
            showToastMessage('Microphone access denied', 2500, { centered: true });
        }
    }
}

// Export small pure/update helpers for regression tests.
export {
    normalizeVoiceLocale,
    parseVoiceSpec,
    normalizeVoiceSpec,
    buildVoiceSpecLabel,
    filterVoiceSpecs,
    selectVoiceBySpec,
    selectBestVoiceForLanguage,
    resolveVoiceSpecForSide,
    notifyNoCardsSelected,
    _resetVoiceCache,
};

function adjustSpeechRate(delta) {
    const input = document.getElementById('speechRateInput');
    assert(!!input, "speechRateInput not found in DOM");

    const currentVal = parseFloat(input.value) || 1.0;
    const newVal = currentVal + delta;

    // We don't even need an 'if' here, just clamp it
    input.value = Math.max(0.5, Math.min(2.0, newVal)).toFixed(1);

    // Manually trigger the change event to update the state
    input.dispatchEvent(new Event('change'));
}

async function toggleHelpModal(show = true) {
    if (!show) {
        ui.helpOverlay.classList.remove('is-visible');
        return;
    }

    // 1. Check if we already loaded the content
    const helpBody = ui.helpOverlay.querySelector('.modal-body');

    if (helpBody.textContent.trim() === "" || helpBody.textContent.includes('Loading')) {
        helpBody.innerHTML = '<div class="loader">⌛ Loading help guide...</div>';

        try {
            const response = await fetch('help.html');
            if (!response.ok) throw new Error('Help file not found');
            const html = await response.text();

            // 2. Inject the HTML - help.html is a trusted app bundle, not user input
            helpBody.innerHTML = html;
        } catch (err) {
            console.error("Help Load Error:", err);
            helpBody.innerHTML = '<p style="color:red">⚠️ Error loading help. Check your connection.</p>';
        }
    }

    // 3. Show the modal
    ui.helpOverlay.classList.add('is-visible');
}
