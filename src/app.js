/**
 * src/app.js
 */
import { DEFAULT_SALT_LENGTH } from '../../hpass/config.js';
import { deckReader, save, load, KEYS } from './io.js';
import { state } from './state.js';
import { FREQUENCY_SETTINGS } from './state.js';
import { DEFAULT_SESSION_SIZE } from './state.js';
import { DEFAULT_TEMPERATURE } from './state.js';

let ui = {};

function init() {
    // 1. Force a layout recalculation
    window.dispatchEvent(new Event('resize'));

    ui = {
        backDisplay: document.getElementById('backDisplay'),
        backLabel: document.getElementById('backLabel'),
        cardInner: document.getElementById('cardInner'),
        categoryList: document.getElementById('categoryList'),
        closeDeck: document.getElementById('closeDeck'),
        closeSettings: document.getElementById('closeSettings'),
        counter: document.getElementById('card-counter'),
        deckBtn: document.getElementById('deckBtn'),
        deckOverlay: document.getElementById('deckOverlay'),
        filePicker: document.getElementById('filePicker'),
        frontDisplay: document.getElementById('frontDisplay'),
        frontLabel: document.getElementById('frontLabel'),
        importBtn: document.getElementById('importBtn'),
        menuBtn: document.getElementById('menuBtn'),
        menuOverlay: document.getElementById('menuOverlay'),
        nextZone: document.getElementById('nextZone'),
        prevZone: document.getElementById('prevZone'),
        saveSettingsBtn: document.getElementById('saveSettingsBtn'),
        selectAllBtn: document.getElementById('selectAllBtn'),
        selectNoneBtn: document.getElementById('selectNoneBtn'),
        sessionSizeInput: document.getElementById('sessionSize'),
        settingsBtn: document.getElementById('settingsBtn'),
        settingsOverlay: document.getElementById('settingsOverlay'),
        speechRateInput: document.getElementById('speechRate'),
        srsFactorInput: document.getElementById('srsFactor'),
        srsFactorVal: document.getElementById('srsFactorVal'),
        tempSlider: document.getElementById('tempSlider'),
        tempValue: document.getElementById('tempValue'),
    };

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
    setupCardListeners();
    syncSettingsToUI();

    if (state.masterDeck.length > 0) {
        refreshCategoryUI();
        applySessionLogic();
    } else {
        if (ui.frontDisplay) {
            ui.frontDisplay.textContent = "Please import a .deck file";
        }
    }
    
    console.log("init: UI Initialized. FilePicker is:", ui.filePicker);
    
    setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
    }, 50);
}

function setupEventListeners() {
    // Menu Toggle
    ui.menuBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        ui.menuOverlay.classList.toggle('is-visible');
    });

    window.addEventListener('click', () => ui.menuOverlay?.classList.remove('is-visible'));

    // Settings Modal
    ui.settingsBtn?.addEventListener('click', () => {
        ui.menuOverlay.classList.remove('is-visible');
        ui.settingsOverlay.classList.add('is-visible');
    });

    ui.closeSettings?.addEventListener('click', () => {
        ui.settingsOverlay.classList.remove('is-visible');
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
        
        // Safety: if nothing is selected, we could alert or default to all
        if (state.activeCategories.length === 0) {
            alert("Please select at least one category.");
            return; 
        }

        ui.deckOverlay?.classList.remove('is-visible');
        applySessionLogic();
        save(KEYS.SETTINGS, state.settings); // Save active categories as part of settings
    });

    // SRS Slider Feedback
    ui.srsFactorInput?.addEventListener('input', (e) => {
        ui.srsFactorVal.textContent = e.target.value;
    });

    // Card Interaction
    ui.cardInner?.addEventListener('click', (e) => {
        console.log("DEBUG: Card clicked! Target:", e.target);
        state.isFlipped = !state.isFlipped;
        ui.cardInner.classList.toggle('is-flipped', state.isFlipped);
    });

    ui.prevZone?.addEventListener('click', (e) => {
        e.stopPropagation();
        navigate(-1);
    });

    ui.nextZone?.addEventListener('click', (e) => {
        e.stopPropagation();
        navigate(1);
    });

    // File Import
    ui.importBtn?.addEventListener('click', () => {
        ui.menuOverlay.classList.remove('is-visible');
        ui.filePicker.click();
    });

    ui.filePicker?.addEventListener('change', async (e) => {
        console.log("DEBUG: File selected:", e.target.files);
        const file = e.target.files[0];
        if (!file) return;

        try {
            // deckReader does the reading, parsing, AND sanitizing
            const importedDeck = await deckReader(file);
            
            state.masterDeck = importedDeck;
            save(KEYS.DECK, state.masterDeck);

            refreshCategoryUI();
            applySessionLogic();
        } catch (error) {
            // alert(error);
            console.log("ERROR: filePicker: error= ", error);
        }
    });

    ui.selectAllBtn?.addEventListener('click', () => {
    const checkboxes = ui.categoryList.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = true);
    });

    ui.selectNoneBtn?.addEventListener('click', () => {
        const checkboxes = ui.categoryList.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(cb => cb.checked = false);
    });
}

// Example of how to handle the 4 distinct actions
function setupCardListeners() {
    // 1. Check if we already attached this to prevent "Double Flipping"
    if (ui.cardInner.dataset.initialized === 'true') return;

    ui.cardInner.addEventListener('click', (e) => {
        // Find if a button was clicked
        const btn = e.target.closest('button');
        
        if (btn) {
            // If it's a button, handle logic and STOP the event from reaching cardInner toggle
            e.stopPropagation(); 
            if (btn.classList.contains('freq-up')) handleFrequencyChange(1);
            if (btn.classList.contains('freq-down')) handleFrequencyChange(-1);
            if (btn.classList.contains('audio-btn')) playAudio();
            return;
        }

        // 2. Only flip if we clicked the card body or header (NOT a button)
        // We use toggle() directly on the class for reliability
        const willBeFlipped = !ui.cardInner.classList.contains('is-flipped');
        ui.cardInner.classList.toggle('is-flipped', willBeFlipped);
        state.isFlipped = willBeFlipped;

        console.log("Card Flipped:", state.isFlipped);
    });

    // Mark as initialized
    ui.cardInner.dataset.initialized = 'true';
}

function handleFrequencyChange(change) {
    const currentCard = state.currentSessionDeck[state.currentCardIndex];
    if (!currentCard) {
        console.error("No card found at index:", state.currentCardIndex);
        console.log("Current Session Deck Length:", state.currentSessionDeck.length);
        return;
    }

    // Initialize if missing
    if (currentCard.frequencyFactor === undefined) {
        currentCard.frequencyFactor = 0;
    }

    // Apply delta (+1 or -1)
    let newValue = currentCard.frequencyFactor + (change * FREQUENCY_SETTINGS.delta);
    currentCard.frequencyFactor = Math.max(
        FREQUENCY_SETTINGS.min, 
        Math.min(FREQUENCY_SETTINGS.max, newValue)
    );

    save(KEYS.DECK, state.masterDeck);

    console.log(`handleFrequencyChange: Cards "${currentCard.id}" factor: ${currentCard.frequencyFactor}`);
    
    // Visual Feedback
    provideVisualFeedback(change > 0 ? 'up' : 'down');
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

    // const size = state.settings.sessionSize || DEFAULT_SESSION_SIZE;
    const size = filteredCards.length;
    const temp = state.settings.temperature || DEFAULT_TEMPERATURE;

    // Use our Softmax generator
    state.currentSessionDeck = generateSessionDeck(filteredCards, size, temp);
    state.currentCardIndex = 0;
    console.log("Session generated. Size:", state.currentSessionDeck.length);
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
    if (ui.sessionSizeInput) ui.sessionSizeInput.value = state.settings.sessionSize;
    if (ui.srsFactorInput) {
        ui.srsFactorInput.value = state.settings.srsFactor;
        ui.srsFactorVal.textContent = state.settings.srsFactor;
    }
    if (ui.speechRateInput) ui.speechRateInput.value = state.settings.speechRate;
}

function updateStateFromUI() {
    state.settings.sessionSize = parseInt(ui.sessionSizeInput.value) || 0;
    state.settings.srsFactor = parseFloat(ui.srsFactorInput.value);
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
        item.innerHTML = `
            <label>
                <input type="checkbox" value="${cat}" ${isChecked ? 'checked' : ''}>
                <span>${cat}</span>
            </label>
        `;
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
