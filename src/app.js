/**
 * src/app.js
 */
import { Parser } from './parser.js';
import { state, saveToDisk, loadFromDisk } from './state.js';

let ui = {};

function init() {
    // 1. Force a layout recalculation
    window.dispatchEvent(new Event('resize'));

    ui = {
        menuBtn: document.getElementById('menuBtn'),
        menuOverlay: document.getElementById('menuOverlay'),
        settingsOverlay: document.getElementById('settingsOverlay'),
        settingsBtn: document.getElementById('settingsBtn'),
        closeSettings: document.getElementById('closeSettings'),
        saveSettingsBtn: document.getElementById('saveSettingsBtn'),
        cardInner: document.getElementById('cardInner'),
        prevZone: document.getElementById('prevZone'),
        nextZone: document.getElementById('nextZone'),
        counter: document.getElementById('card-counter'),
        frontLabel: document.getElementById('frontLabel'),
        backLabel: document.getElementById('backLabel'),
        frontDisplay: document.getElementById('frontDisplay'),
        backDisplay: document.getElementById('backDisplay'),
        sessionSizeInput: document.getElementById('sessionSize'),
        srsFactorInput: document.getElementById('srsFactor'),
        srsFactorVal: document.getElementById('srsFactorVal'),
        speechRateInput: document.getElementById('speechRate'),
        importBtn: document.getElementById('importBtn'),
        filePicker: document.getElementById('filePicker'),
        categoryList: document.getElementById('categoryList'),
        deckOverlay: document.getElementById('deckOverlay'),
        closeDeck: document.getElementById('closeDeck'),
        deckBtn: document.getElementById('deckBtn'),
    };

    // 2. Debugging Log
    const missing = Object.keys(ui).filter(key => ui[key] === null);
    if (missing.length > 0) {
        console.error("DEBUG: init: The following IDs are missing from your HTML:", missing);
    } else {
        console.log("DEBUG: init: UI Initialized successfully.");
    }

    loadFromDisk();
    refreshCategoryUI();
    syncSettingsToUI();
    setupEventListeners();
    applySessionLogic();
    
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
        saveToDisk();
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
        ui.deckOverlay?.classList.remove('is-visible');
        applySessionLogic();
        saveToDisk();
    });

    // SRS Slider Feedback
    ui.srsFactorInput?.addEventListener('input', (e) => {
        ui.srsFactorVal.textContent = e.target.value;
    });

    // Card Interaction
    ui.cardInner?.addEventListener('click', () => {
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

    ui.filePicker?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            if (Parser.loadIntoState(event.target.result)) {
                refreshCategoryUI();
                applySessionLogic();
            }
        };
        reader.readAsText(file);
    });
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
    let filteredCards = state.masterDeck.filter(card => 
        state.activeCategories.includes(card.frontLabel)
    );

    if (filteredCards.length === 0) filteredCards = [...state.masterDeck];

    const size = state.settings.sessionSize;
    state.currentSessionDeck = (size > 0 && size < filteredCards.length) 
        ? filteredCards.slice(0, size) 
        : filteredCards;

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

// Ignition
if (document.readyState === 'complete') {
    init();
} else {
    window.addEventListener('load', init);
}
