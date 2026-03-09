/**
 * src/app.js
 */
import { CONFIG } from './config.js';
import { REPO_CONFIG } from './config.js';
import { deckReader, save, load, KEYS } from './io.js';
import { fetchRemoteDeckList, fetchTextFromUrl, processDeckText } from './io.js';
import { SPEECH_RATE, state } from './state.js';
import { FREQUENCY_SETTINGS } from './state.js';
import { SESSION_SIZE } from './state.js';
import { TEMPERATURE } from './state.js';

let ui = {};
let isRefreshing = false; // Global flag to prevent double-reload

function init() {

    // 1. REGISTER SERVICE WORKER (Module Type)
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js', {
            type: 'module'
        })
        .then(reg => {
            console.log('app: SW Registered successfully');

            // 1. Pre-check: Does a worker exist already?
            if (reg.waiting) {
                console.log('app: Found a waiting worker on load!');
                if (ui.versionTag) ui.versionTag.classList.add('is-update-available');
            }

            // 2. Click Handler on versionTag
            if (ui.versionTag) {
                ui.versionTag.style.cursor = 'pointer';
                ui.versionTag.onclick = (e) => {
                    if (!ui.versionTag.classList.contains('is-update-available')) {
                        return; // Only allow click if update is available
                    }
                    console.log("Version clicked! Activating new Service Worker...");
                    e.preventDefault();
                    e.stopPropagation();
                    const worker = reg.waiting || reg.installing;
                    if (worker) {
                        worker.postMessage({ type: 'SKIP_WAITING' });
                        // Fallback: if oncontrollerchange doesn't fire, reload after a short delay
                        setTimeout(() => {
                            if (!isRefreshing) {
                                isRefreshing = true;
                                console.log('app: Forcing reload as controllerchange backup...');
                                window.location.reload();
                            }
                        }, 500);
                    }
                };
            }

            // 2b. Reload page when new Service Worker takes control
            navigator.serviceWorker.oncontrollerchange = () => {
                if (!isRefreshing) {
                    isRefreshing = true;
                    console.log('app: New Service Worker activated, reloading page...');
                    window.location.reload();
                }
            };
            
            // 3. Update Found Listener
            reg.onupdatefound = () => {
                const installingWorker = reg.installing;
                installingWorker.onstatechange = () => {
                    if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        console.log('app: New content is available.');
                        if (ui.versionTag) {
                            ui.versionTag.classList.add('is-update-available');
                        } else {
                            console.log('app: versionTag element not found in UI.');
                        }
                    }
                };
            };
        })
        .catch(err => console.error('app: SW Registration Failed:', err));
    }

    validateConfiguration();
    // 1. Force a layout recalculation
    window.dispatchEvent(new Event('resize'));

    ui = {
        backDisplay: document.getElementById('backDisplay'),
        backLabel: document.getElementById('backLabel'),
        cardInner: document.getElementById('cardInner'),
        categoryList: document.getElementById('categoryList'),
        closeDeck: document.getElementById('closeDeck'),
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
        importOverlay: document.getElementById('importOverlay'),
        menuBtn: document.getElementById('menuBtn'),
        menuOverlay: document.getElementById('menuOverlay'),
        nextZone: document.getElementById('nextZone'),
        prevZone: document.getElementById('prevZone'),
        resetSessionBtn: document.getElementById('resetSessionBtn'),
        saveSettingsBtn: document.getElementById('saveSettingsBtn'),
        searchBar: document.getElementById('searchBar'),
        selectAllBtn: document.getElementById('selectAllBtn'),
        selectNoneBtn: document.getElementById('selectNoneBtn'),
        sessionSize: document.getElementById('sessionSize'),
        settingsBtn: document.getElementById('settingsBtn'),
        settingsOverlay: document.getElementById('settingsOverlay'),
        speechRateInput: document.getElementById('speechRateInput'),
        remoteExamplesList: document.getElementById('remoteExamplesList'),
        // srsFactorInput: document.getElementById('srsFactor'),
        // srsFactorVal: document.getElementById('srsFactorVal'),
        tempInput: document.getElementById('tempInput'),
        versionTag: document.getElementById('versionTag'),
    };

    if (ui.versionTag) {
        versionTag.textContent = `Version: ${CONFIG.VERSION}`;
    }

    // 2. Debugging Log
    const missing = Object.keys(ui).filter(key => ui[key] === null);
    if (missing.length > 0) {
        console.error("DEBUG: init: The following IDs are missing from your HTML:", missing);
    } else {
        console.log("DEBUG: init: UI Initialized successfully.");
    }

    state.settings = { ...state.settings, ...load(KEYS.SETTINGS) };
    // state.masterDeck = { ...state.masterDeck, ...load(KEYS.DECK) };
    // state.masterDeck = load(KEYS.DECK) || state.masterDeck;
    const savedDeck = load(KEYS.DECK);
    state.masterDeck = Array.isArray(savedDeck) ? savedDeck : [];

    // 2. ALWAYS setup listeners so buttons work!
    setupEventListeners();
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

function updateUIVersion() {
    ui.versionTag.textContent = `Version: ${CONFIG.VERSION}`;
}

/**
 * Swaps front and back properties for every card in the deck.
 * Useful for flipping the study direction (e.g., Spanish→English to English→Spanish)
 * @param {Array} deck - Array of card objects with frontText, backText, frontLabel, backLabel
 * @returns {Array} - The transformed deck with swapped front/back
 */
function flipDeck(deck) {
    if (!deck || !Array.isArray(deck)) return [];
    return deck.map(card => ({
        ...card,                        // Keep other properties (id, frequencyFactor, etc.)
        frontLabel: card.backLabel,     // Swap labels
        backLabel: card.frontLabel,
        frontText: card.backText,       // Swap content
        backText: card.frontText
    }));
}

/**
 * Custom Assertion: Fails loudly if condition is false.
 * @param {boolean} condition - The truth to check.
 * @param {string} message - Description of the expected state.
 * @param {object} context - Optional data to log for debugging.
 */
function assert(condition, message, context = null) {
    if (!condition) {
        // We log the message AND the object separately
        console.error(`ASSERTION FAILED: ${message}`);
        if (context) console.dir(context); // console.dir shows the object structure clearly       
        alert(`ASSERTION FAILED: ${message}`);
        throw new Error(message);
    }
}

function validateConfiguration() {
    const x = FREQUENCY_SETTINGS;   
    assert(typeof x.delta === 'number' && x.delta > 0, "Config: delta must be > 0");
    assert(typeof x.min === 'number', "Config: min must be a number");
    assert(typeof x.max === 'number', "Config: max must be a number");
    assert(x.max - x.min > x.delta, "Config: max - min must be greater than delta", { min: x.min, max: x.max });
}

function setupEventListeners() {
    // Menu Toggle
    ui.menuBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        ui.menuOverlay.classList.toggle('is-visible');
    });

    window.addEventListener('click', () => ui.menuOverlay?.classList.remove('is-visible'));

    ui.searchBar.addEventListener('search', (e) => {
    // This triggers when the user clicks the native "X" or presses the keyboard Search button
        handleSearch(e.target.value); 
    });

    // Keep your standard input listener for real-time filtering
    ui.searchBar.addEventListener('input', (e) => {
        handleSearch(e.target.value);
    });

    // Help Modal
    ui.helpBtn?.addEventListener('click', () => {
        ui.menuOverlay.classList.remove('is-visible');
        toggleHelpModal();
    });

    ui.helpOverlay.addEventListener('click', (e) => {
        // If they click the close button OR the dark background area
        if (e.target.id === 'closeHelp' || e.target === ui.helpOverlay) {
            toggleHelpModal(false);
        }
    });

    // Settings Modal
    ui.settingsBtn?.addEventListener('click', () => {
        ui.menuOverlay.classList.remove('is-visible');
        ui.settingsOverlay.classList.add('is-visible');
    });

    ui.closeSettings?.addEventListener('click', () => {
        ui.settingsOverlay.classList.remove('is-visible');
        save(KEYS.SETTINGS, state.settings);
    });

    ui.saveSettingsBtn?.addEventListener('click', () => {
        updateStateFromUI();
        save(KEYS.SETTINGS, state.settings);
        ui.settingsOverlay.classList.remove('is-visible');
        applySessionLogic();
    });

    // Deck Selector Modal
    ui.deckBtn?.addEventListener('click', () => {
        refreshCategoryUI();
        ui.menuOverlay?.classList.remove('is-visible');
        ui.deckOverlay?.classList.add('is-visible');
    });

    ui.closeDeck?.addEventListener('click', () => {
        const checkboxes = ui.categoryList.querySelectorAll('input:checked');
        state.activeCategories = Array.from(checkboxes).map(cb => cb.value);
        
        // Safety: if nothing is selected, prevent closing and log warning
        if (state.activeCategories.length === 0) {
            console.warn("Category selection: At least one category must be selected.");
            return;
        }

        ui.deckOverlay?.classList.remove('is-visible');
        applySessionLogic();
        save(KEYS.SETTINGS, state.settings); // Save active categories as part of settings
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

    ui.nextZone?.addEventListener('click', (e) => {
        e.stopPropagation();
        // navigate(1);
        drawCard(); // No more navigate(1)!
    });

    ui.prevZone?.addEventListener('click', (e) => {
        e.stopPropagation();
        navigate(-1);
    });

    // File Import
    // ui.importBtn?.addEventListener('click', () => {
    //     ui.menuOverlay.classList.remove('is-visible');
    //     ui.filePicker.click();
    // });

    ui.importBtn?.addEventListener('click', () => {
        // 1. Hide the main menu overlay
        ui.menuOverlay.classList.remove('is-visible'); 
        
        // 2. Show the new import options overlay
        ui.importOverlay.classList.add('is-visible');  
    });    

    ui.filePicker?.addEventListener('change', async (e) => {
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

    ui.importUrlBtn?.addEventListener('click', async () => {
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

    ui.closeImport?.addEventListener('click', () => {
        ui.importOverlay.classList.remove('is-visible');
    });

    ui.closeSelect?.addEventListener('click', () => {
        ui.deckOverlay.classList.remove('is-visible');
    });

    ui.selectAllBtn?.addEventListener('click', () => {
        const checkboxes = ui.categoryList.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(cb => cb.checked = true);
    });

    ui.selectNoneBtn?.addEventListener('click', () => {
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

    ui.tempInput?.addEventListener('change', (e) => {
        updateTemperature(parseFloat(e.target.value) || TEMPERATURE.default);
    });

    ui.speechRateInput?.addEventListener('change', (e) => {
        updateSpeechRate(parseFloat(e.target.value) || SPEECH_RATE.default);
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
    [ui.tempInput, ui.sessionSizeInput, ui.speechRateInput].forEach(el => {
        el?.addEventListener('focus', (e) => {
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

    // 3. Listener to ensure we don't refresh twice
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        updateUIVersion();
        window.location.reload();
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
    updateSessionSize(SESSION_SIZE.default);
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

    // We pass an explicit 'isMouse' flag to separate the logic
    const handleStart = (x, y, isMouse) => {
        startX = x;
        startY = y;
        isLongPress = false;
        
        if (touchTimer) clearTimeout(touchTimer);
        
        // Desktop users natively click-and-drag to select text, 
        // so we ONLY need the long-press timer for touch devices.
        if (!isMouse) {
            touchTimer = setTimeout(() => { 
                isLongPress = true; 
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
    };

    // --- Mouse Listeners (Desktop) ---
    ui.cardInner.addEventListener('mousedown', e => {
        if (e.button !== 0) return; // Only accept left-clicks
        handleStart(e.clientX, e.clientY, true);
    });

    ui.cardInner.addEventListener('mouseup', e => {
        if (e.button !== 0) return;
        handleEnd(e.clientX, e.clientY, e.target, true);
    });

    // --- Touch Listeners (Pixel) ---
    ui.cardInner.addEventListener('touchstart', e => {
        handleStart(e.touches[0].clientX, e.touches[0].clientY, false);
    }, { passive: true });

    ui.cardInner.addEventListener('touchend', e => {
        handleEnd(e.changedTouches[0].clientX, e.changedTouches[0].clientY, e.target, false);
    }, { passive: true });

    // --- Button Click Listener ---
    // This exclusively handles buttons and prevents them from triggering the flip
    ui.cardInner.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;

        e.stopPropagation();
        
        if (btn.classList.contains('freq-up')) handleFrequencyChange(1);
        if (btn.classList.contains('freq-down')) handleFrequencyChange(-1);
        if (btn.classList.contains('audio-btn')) playAudio();
    });

    ui.cardInner.dataset.initialized = 'true';
}

function handleFrequencyChange(change) {
    const card = state.currentSessionDeck[state.currentCardIndex];
    
    // 1. Assert Entry State
    assert(!!card, "No card selected for frequency change.");
    assert(typeof card.frequencyFactor === 'number', "Card missing frequencyFactor", card);
    assert(change === 1 || change === -1, "Invalid frequency change direction", { change });

    const newValue = card.frequencyFactor + (change * FREQUENCY_SETTINGS.delta);
    
    card.frequencyFactor = Math.max(
        FREQUENCY_SETTINGS.min, 
        Math.min(FREQUENCY_SETTINGS.max, newValue)
    );

    // 4. Trigger Recalc
    state.calculateProbabilities = true;

    save(KEYS.DECK, state.masterDeck);
    provideVisualFeedback(change > 0 ? 'up' : 'down');
}

function handleSearch(query) {
    const searchTerm = query.toLowerCase().trim();
    
    if (searchTerm === "") {
        // If search is empty, go back to the normal session deck
        applySessionLogic(); 
        return;
    }

    // Filter the master deck based on front or back text
    const searchResults = state.masterDeck.filter(card => 
        card.frontLabel.toLowerCase().includes(searchTerm) || 
        card.backLabel.toLowerCase().includes(searchTerm)  ||
        card.frontText.toLowerCase().includes(searchTerm)  || 
        card.backText.toLowerCase().includes(searchTerm)
    );

    if (searchResults.length > 0) {
        state.currentSessionDeck = searchResults;
        state.currentCardIndex = 0;
        updateUI();
    } else {
        console.log("Search: No matches found for:", query);
    }
}

function updateProbabilities() {
    const pool = state.currentSessionDeck;
    const T = state.settings.temperature;

    // Assertions: Ensure the "Hand" and the "Environment" are valid
    assert(Array.isArray(pool) && pool.length > 0, "Cannot calculate probabilities for an empty pool.");
    assert(typeof T === 'number' && T >= 0.01, "Temperature must be a number >= 0.01", { T });

    const exponents = pool.map(card => {
        assert(typeof card.frequencyFactor === 'number', "Pool card missing factor", card);
        return Math.exp(card.frequencyFactor / T);
    });

    const sumExponents = exponents.reduce((a, b) => a + b, 0);
    assert(sumExponents > 0, "Sum of exponents is zero (underflow error).", { exponents });

    state.sessionProbabilities = exponents.map(exp => exp / sumExponents);
    console.log("DEBUG: updateProbabilities: Updated probabilities for current session.",
        { probabilities: state.sessionProbabilities });
    state.calculateProbabilities = false;
}

function generateSessionDeck(pool, sessionSize, temperature = 1.0) {
    if (pool.length === 0) return [];
    
    // 1. Calculate exponentials with Temperature scaling
    // Higher T = flatter distribution; Lower T = more aggressive focus
    const exps = pool.map(card => Math.exp((card.frequencyFactor || 0) / temperature));
    const sumExps = exps.reduce((a, b) => a + b, 0);

    let poolWithProbs = pool.map((card, index) => ({
        card,
        prob: exps[index] / sumExps
    }));

    const session = [];
    const size = Math.min(sessionSize, pool.length);

    // 2. Weighted Random Selection (Sampling without replacement)
    for (let i = 0; i < size; i++) {
        let dart = Math.random();
        let cumulativeProb = 0;

        for (let j = 0; j < poolWithProbs.length; j++) {
            cumulativeProb += poolWithProbs[j].prob;
            
            if (dart <= cumulativeProb) {
                const selected = poolWithProbs.splice(j, 1)[0];
                session.push(selected.card);
                
                // Re-normalize
                const newSum = poolWithProbs.reduce((sum, item) => sum + item.prob, 0);
                if (newSum > 0) {
                    poolWithProbs.forEach(item => item.prob /= newSum);
                }
                break;
            }
        }
    }

    console.log(`DEBUG: generateSessionDeck: Generated session of size ${session.length} from pool of ${pool.length} with temperature ${temperature}`);
    console.log("DEBUG: Sample of 7 session cards:", session.slice(0, 7));

    return session;
}

function navigate(direction) {
    state.isFlipped = false;
    ui.cardInner?.classList.remove('is-flipped');
    const deckSize = state.currentSessionDeck.length;
    if (deckSize === 0) return;
    state.currentCardIndex = (state.currentCardIndex + direction + deckSize) % deckSize;
    setTimeout(updateUI, 150);
}

/**
 * Modified Navigation for Weighted Streaming
 */
function drawCard() {
    // 1. Visual Reset
    state.isFlipped = false;
    ui.cardInner?.classList.remove('is-flipped');

    if (state.calculateProbabilities) {
        updateProbabilities();
    }

    // 2. The Logic: Draw a weighted index from the CURRENT session pool
    // We pass our current session deck into the weighted picker
    const nextCard = pickWeightedCard(state.currentSessionDeck, state.settings.temperature);
    
    // 3. Update the pointer so frequency buttons hit the right card
    state.currentCardIndex = state.currentSessionDeck.indexOf(nextCard);

    // 4. Animate and update
    setTimeout(updateUI, 150);
}

// A helper to pick a single card based on weights
function pickWeightedCard(pool, temperature = 1.0) {
    if (!pool || pool.length === 0) return null;
    
    const T = Math.max(temperature, 0.01);
    const weights = pool.map(card => Math.exp((card.frequencyFactor || 0) / T));
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    
    let dart = Math.random() * totalWeight;
    for (let i = 0; i < pool.length; i++) {
        dart -= weights[i];
        if (dart <= 0) return pool[i];
    }
    return pool[0];
}

function applySessionLogic() {

    // 1. Safety check: If masterDeck is empty, we can't do anything
    if (!state.masterDeck || state.masterDeck.length === 0) {
        console.warn("applySessionLogic: masterDeck is empty.");
        return;
    }

    // Ensure we have active categories; if not, default to all
    if (!state.activeCategories || state.activeCategories.length === 0) {
        state.activeCategories = [...new Set(state.masterDeck.map(c => c.frontLabel))];
    }

    let filteredCards = state.masterDeck.filter(card => 
        state.activeCategories.includes(card.frontLabel)
    );

    if (filteredCards.length === 0) filteredCards = [...state.masterDeck];

    // --- MINIMAL CHANGE START ---
    // Instead of using filteredCards.length, use the setting from state
    const requestedSize = state.settings.sessionSize || 0;
    
    // If requestedSize is 0, we take the whole filtered deck, 
    // otherwise we cap it at the number of available cards.
    const size = (requestedSize > 0) ? Math.min(requestedSize, filteredCards.length) : filteredCards.length;
    // --- MINIMAL CHANGE END ---

    const temp = state.settings.temperature;
    assert(temp >= 0.01, "Temperature must be at least 0.01", { temp });

    state.currentSessionDeck = generateSessionDeck(filteredCards, size, temp);
    state.currentCardIndex = 0;
    updateUI();
}

function updateUI() {
    const deck = state.currentSessionDeck;
    const card = deck[state.currentCardIndex];
    if (!card) return;

    ui.frontLabel.textContent = card.frontLabel;
    ui.backLabel.textContent = card.backLabel;
    ui.frontDisplay.textContent = card.frontText;
    ui.backDisplay.textContent = card.backText;
    ui.counter.textContent = `${state.currentCardIndex + 1} / ${deck.length}`;
}

function syncSettingsToUI() {
    if (ui.sessionSize) ui.sessionSize.value = state.settings.sessionSize;
    if (ui.tempInput) ui.tempInput.value = state.settings.temperature;
    // if (ui.srsFactorInput) {
    //     ui.srsFactorInput.value = state.settings.srsFactor;
    //     ui.srsFactorVal.textContent = state.settings.srsFactor;
    // }
    if (ui.speechRateInput) ui.speechRateInput.value = state.settings.speechRate;
}

function updateStateFromUI() {
    state.settings.sessionSize = parseInt(ui.sessionSize.value);
    state.settings.temperature = parseFloat(ui.tempInput.value);
    state.settings.speechRate = parseFloat(ui.speechRateInput.value);
}

function refreshCategoryUI() {
    const allCategories = [...new Set(state.masterDeck.map(card => card.frontLabel))];
    if (state.activeCategories.length === 0) {
        state.activeCategories = [...allCategories];
    }

    ui.categoryList.innerHTML = '';
    allCategories.forEach(cat => {
        const isChecked = state.activeCategories.includes(cat);
        const item = document.createElement('div');
        item.className = 'category-item';

        const label = document.createElement('label');

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = cat;
        checkbox.checked = isChecked;

        const span = document.createElement('span');
        span.textContent = cat;

        label.appendChild(checkbox);
        label.appendChild(span);
        item.appendChild(label);

        ui.categoryList.appendChild(item);
    });
}

function provideVisualFeedback(type) {
    const card = ui.cardInner;
    if (!card) return;

    // Remove existing classes to allow re-triggering
    card.classList.remove('feedback-up', 'feedback-down');
    
    // Force a reflow to restart the animation
    void card.offsetWidth;

    // Add the appropriate class
    card.classList.add(type === 'up' ? 'feedback-up' : 'feedback-down');

    // Optional: Auto-remove after animation ends (e.g., 500ms)
    setTimeout(() => {
        card.classList.remove('feedback-up', 'feedback-down');
    }, 500);
}

// Ignition
if (document.readyState === 'complete') {
    init();
} else {
    window.addEventListener('load', init);
}

function playAudio() {
    const card = state.currentSessionDeck[state.currentCardIndex];
    if (!card) return;

    // Stop any existing speech
    window.speechSynthesis.cancel();

    // Determine text based on flip state
    const textToSpeak = state.isFlipped ? card.backText : card.frontText;
    
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    
    // Use the speech rate from our settings slider
    utterance.rate = state.settings.speechRate || 1.0;
    
    // Optional: Auto-detect language if your labels are "Spanish" or "French"
    // utterance.lang = 'en-US'; 

    window.speechSynthesis.speak(utterance);
    
    console.log(`Speaking (${state.isFlipped ? 'Back' : 'Front'}): ${textToSpeak}`);
}

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
