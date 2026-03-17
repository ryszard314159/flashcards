export function updateProbabilitiesForSession(state, calculateProbabilities, assert) {
    const pool = state.currentSessionDeck;
    const temperature = state.settings.temperature;

    assert(Array.isArray(pool) && pool.length > 0, 'Cannot calculate probabilities for an empty pool.');
    assert(typeof temperature === 'number' && temperature >= 0.01, 'Temperature must be a number >= 0.01', { temperature });

    pool.forEach((card) => assert(typeof card.score === 'number', 'Pool card missing factor', card));

    state.sessionProbabilities = calculateProbabilities(pool, temperature);
    state.calculateProbabilities = false;
}

export function pushToHistoryBuffer(state, cardIndex) {
    const maxLen = state.settings.historySize || 0;
    if (maxLen <= 0) return;

    state.navigationHistory.push(cardIndex);
    if (state.navigationHistory.length > maxLen) {
        state.navigationHistory.shift();
    }
}

export function navigateBackInSession(state, ui, updateUI, showToastMessage) {
    state.isFlipped = false;
    ui.cardInner?.classList.remove('is-flipped');

    if (state.navigationHistory.length > 0) {
        state.currentCardIndex = state.navigationHistory.pop();
        setTimeout(updateUI, 150);
    } else {
        showToastMessage('No history yet', 1000);
    }
}

export function navigateInSession(state, ui, direction, updateUI, pushToHistory) {
    state.isFlipped = false;
    ui.cardInner?.classList.remove('is-flipped');

    const deckSize = state.currentSessionDeck.length;
    if (deckSize === 0) return;

    if (direction > 0 && state.settings.selectionMode !== 'sequential') {
        pushToHistory(state.currentCardIndex);
    }

    state.currentCardIndex = (state.currentCardIndex + direction + deckSize) % deckSize;
    setTimeout(updateUI, 150);
}

export function drawCardFromSession(state, ui, pickWeightedCard, updateUI, pushToHistory, updateProbabilities) {
    state.isFlipped = false;
    ui.cardInner?.classList.remove('is-flipped');

    pushToHistory(state.currentCardIndex);

    if (state.calculateProbabilities) {
        updateProbabilities();
    }

    const nextCard = pickWeightedCard(state.currentSessionDeck, state.settings.temperature);
    state.currentCardIndex = state.currentSessionDeck.indexOf(nextCard);

    setTimeout(updateUI, 150);
}

export function applySessionLogicToState(state, generateSessionDeck, assert, updateUI) {
    if (!state.masterDeck || state.masterDeck.length === 0) {
        console.warn('applySessionLogic: masterDeck is empty.');
        return;
    }

    if (!state.settings.activeCategories || state.settings.activeCategories.length === 0) {
        state.settings.activeCategories = [...new Set(state.masterDeck.map((card) => card.frontLabel))];
    }

    let filteredCards = state.masterDeck.filter((card) =>
        state.settings.activeCategories.includes(card.frontLabel)
    );

    if (filteredCards.length === 0) {
        filteredCards = [...state.masterDeck];
    }

    const requestedSize = state.settings.sessionSize || 0;
    const size = requestedSize > 0
        ? Math.min(requestedSize, filteredCards.length)
        : filteredCards.length;

    const temperature = state.settings.temperature;
    assert(temperature >= 0.01, 'Temperature must be at least 0.01', { temperature });

    const mode = state.settings.selectionMode;
    if (mode === 'weighted') {
        state.currentSessionDeck = generateSessionDeck(filteredCards, size, temperature);
    } else if (mode === 'sequential') {
        state.currentSessionDeck = filteredCards.slice(0, size);
    } else {
        state.currentSessionDeck = generateSessionDeck(filteredCards, size, temperature);
    }

    state.currentCardIndex = 0;
    state.navigationHistory = [];
    updateUI();
}

export function getCardOrdinalInMasterDeck(state, card) {
    if (!card || !Array.isArray(state.masterDeck) || state.masterDeck.length === 0) {
        return null;
    }

    const referenceIndex = state.masterDeck.indexOf(card);
    if (referenceIndex !== -1) {
        return referenceIndex + 1;
    }

    if (card.id) {
        const idIndex = state.masterDeck.findIndex((candidate) => candidate?.id === card.id);
        if (idIndex !== -1) {
            return idIndex + 1;
        }
    }

    return null;
}
