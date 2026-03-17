let modeToastTimer = null;

export function showToastMessage(text, timeoutMs = 3000, { centered = false } = {}) {
    let toast = document.getElementById('modeToast');

    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'modeToast';
        toast.className = 'mode-toast';
        document.body.appendChild(toast);
    }

    toast.textContent = text;
    toast.classList.toggle('mode-toast--centered', centered);
    toast.classList.add('is-visible');

    clearTimeout(modeToastTimer);
    modeToastTimer = setTimeout(() => {
        toast.classList.remove('is-visible');
    }, timeoutMs);
}

export function showModeToast(mode) {
    const text = mode === 'weighted'
        ? 'Changing card selection mode to\nSpaced Repetition System (SRS)'
        : 'Changing card selection mode to\nLinear (Sequential)';
    showToastMessage(text, 2200, { centered: true });
}

export function updateUIRender(state, ui, getCardOrdinalInMasterDeck) {
    const deck = state.currentSessionDeck;
    const card = deck[state.currentCardIndex];
    if (!card) return;

    ui.frontLabel.textContent = card.frontLabel;
    ui.backLabel.textContent = card.backLabel;
    ui.frontDisplay.textContent = card.frontText;
    ui.backDisplay.textContent = card.backText;

    const originalOrdinal = getCardOrdinalInMasterDeck(card);
    const counterNumerator = originalOrdinal ?? (state.currentCardIndex + 1);
    const counterDenominator = Array.isArray(state.masterDeck) && state.masterDeck.length > 0
        ? state.masterDeck.length
        : deck.length;

    ui.counter.textContent = `${counterNumerator} / ${counterDenominator}`;
    if (ui.cardScore) ui.cardScore.textContent = `Score: ${card.score}`;
}

export function refreshCategoryUIRender(state, ui) {
    const allCategories = [...new Set(state.masterDeck.map((card) => card.frontLabel))];
    if (state.settings.activeCategories.length === 0) {
        state.settings.activeCategories = [...allCategories];
    }

    ui.categoryList.innerHTML = '';
    allCategories.forEach((cat) => {
        const isChecked = state.settings.activeCategories.includes(cat);
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

export function provideVisualFeedbackRender(ui, type) {
    const card = ui.cardInner;
    if (!card) return;

    card.classList.remove('feedback-up', 'feedback-down');
    void card.offsetWidth;
    card.classList.add(type === 'up' ? 'feedback-up' : 'feedback-down');

    setTimeout(() => {
        card.classList.remove('feedback-up', 'feedback-down');
    }, 500);
}
