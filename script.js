import { CONFIG } from './config.js';

let allCards = [];
let filteredCards = [];
let currentIndex = 0;
let isReplacing = false;
let selectedCategories = new Set();
const synth = window.speechSynthesis;

const cardInner = document.getElementById('cardInner');
const searchBar = document.getElementById('searchBar');
const fileInput = document.getElementById('fileInput');
const statusDisplay = document.getElementById('status');
const settingsModal = document.getElementById('settingsModal');

window.addEventListener('DOMContentLoaded', () => {
    const versionTag = document.getElementById('version-tag');
    if (versionTag) versionTag.innerText = `Version: ${CONFIG.VERSION}`;

    const savedData = localStorage.getItem('myFlashcards');
    if (savedData) {
        try {
            allCards = JSON.parse(savedData);
            if (allCards.length > 0) {
                updateAppTitle(localStorage.getItem('myDeckTitle') || "Flashcards");
                applyFilters(true);
                startApp();
            }
        } catch (e) { console.error("Data error", e); }
    }

    // NEW

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js', { type: 'module' }).then(reg => {
            // Check for updates every time the app loads
            reg.update();

            reg.addEventListener('updatefound', () => {
                const newWorker = reg.installing;
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        // Show the badge instead of auto-reloading
                        const badge = document.getElementById('update-badge');
                        if (badge) badge.style.display = 'inline-block';
                        
                        const versionCont = document.getElementById('version-container');
                        if (versionCont) {
                            versionCont.onclick = () => {
                                newWorker.postMessage({ type: 'SKIP_WAITING' });
                            };
                        }
                    }
                });
            });
        });

        // This ensures we only reload ONCE when the new worker has actually claimed the page
        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (refreshing) return;
            refreshing = true;
            window.location.reload();
        });
    }

    setupEventListeners();
});

function setupEventListeners() {
    // 1. Navigation Zones (The 15% side margins with watermarks)
    const pZone = document.getElementById('prevZone');
    const nZone = document.getElementById('nextZone');
    
    if (pZone) {
        pZone.addEventListener('click', (e) => {
            e.stopPropagation(); // Stops the card from flipping when navigating
            prevCard();
        });
    }
    
    if (nZone) {
        nZone.addEventListener('click', (e) => {
            e.stopPropagation(); // Stops the card from flipping when navigating
            nextCard();
        });
    }

    // 2. Card Interaction (Flipping and Audio)
    const cardCont = document.getElementById('cardCont');
    if (cardCont) {
        cardCont.addEventListener('click', handleCardClick);
    }

    // 3. Menu / Settings Modal
    const settingsBtn = document.getElementById('settingsBtn');
    const closeSettings = document.getElementById('closeSettings');
    const applySettingsBtn = document.getElementById('applySettings');

    if (settingsBtn) settingsBtn.addEventListener('click', openSettings);
    if (closeSettings) {
        closeSettings.addEventListener('click', () => {
            settingsModal.style.display = 'none';
        });
    }
    if (applySettingsBtn) applySettingsBtn.addEventListener('click', applySettings);

    // 4. Modal Utility Buttons (All/None)
    const selectAll = document.getElementById('selectAll');
    const selectNone = document.getElementById('selectNone');

    if (selectAll) {
        selectAll.addEventListener('click', () => {
            document.querySelectorAll('#categoryList input').forEach(cb => cb.checked = true);
        });
    }
    if (selectNone) {
        selectNone.addEventListener('click', () => {
            document.querySelectorAll('#categoryList input').forEach(cb => cb.checked = false);
        });
    }

    // 5. File Management & Search
    const replaceBtn = document.getElementById('replaceBtn');
    const resetSearchBtn = document.getElementById('resetSearch');

    if (fileInput) fileInput.addEventListener('change', handleFileUpload);
    if (replaceBtn) replaceBtn.addEventListener('click', replaceDeck);
    if (resetSearchBtn) resetSearchBtn.addEventListener('click', resetSearch);
    
    if (searchBar) {
        searchBar.addEventListener('input', () => applyFilters(false));
    }

    // 6. Global Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
        // Don't trigger shortcuts if the user is typing in the search bar
        if (document.activeElement === searchBar) return;

        if (e.code === 'Space') {
            e.preventDefault();
            if (cardInner) cardInner.classList.toggle('is-flipped');
        } else if (e.code === 'ArrowRight') {
            nextCard();
        } else if (e.code === 'ArrowLeft') {
            prevCard();
        }
    });
}

function replaceDeck() {
    if (confirm("Delete all current cards and start fresh?")) {
        isReplacing = true;
        fileInput.click();
    }
}

function openSettings() {
    const listCont = document.getElementById('categoryList');
    listCont.innerHTML = '';
    const categories = [...new Set(allCards.map(c => c.catF))];
    categories.forEach(cat => {
        const div = document.createElement('div');
        div.style.marginBottom = "5px";
        const checked = (selectedCategories.size === 0 || selectedCategories.has(cat)) ? 'checked' : '';
        div.innerHTML = `<label><input type="checkbox" value="${cat}" ${checked}> ${cat}</label>`;
        listCont.appendChild(div);
    });
    settingsModal.style.display = 'flex';
}

function applySettings() {
    const checkboxes = document.querySelectorAll('#categoryList input:checked');
    selectedCategories = new Set([...checkboxes].map(cb => cb.value));
    applyFilters(true);
    settingsModal.style.display = 'none';
}

function applyFilters(isNewSession = false) {
    let result = allCards.filter(c => selectedCategories.size === 0 || selectedCategories.has(c.catF));
    const query = searchBar.value.toLowerCase();
    if (query) {
        result = result.filter(c => c.front.toLowerCase().includes(query) || c.back.toLowerCase().includes(query));
    }
    const n = parseInt(document.getElementById('sampleSize').value) || 3;
    if (isNewSession && n > 0) {
        result = result.sort(() => Math.random() - 0.5).slice(0, n);
    } else if (!isNewSession && n > 0 && filteredCards.length > 0) {
        result = filteredCards.filter(c => c.front.toLowerCase().includes(query) || c.back.toLowerCase().includes(query));
    }
    filteredCards = result;
    currentIndex = 0;
    if (allCards.length > 0) updateCard();
}

function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        if (isReplacing) { allCards = []; isReplacing = false; }
        parseAndAdd(event.target.result);
    };
    reader.readAsText(file);
    e.target.value = '';
}

function parseAndAdd(text) {
    const lines = text.split('\n');
    let curCatF = "General", curCatB = "General";
    let newCards = [];
    lines.forEach(line => {
        const t = line.trim();
        if (!t) return;
        if (t.startsWith('**')) {
            const title = t.replace('**', '').trim();
            updateAppTitle(title);
            localStorage.setItem('myDeckTitle', title);
        } else if (t.startsWith('*')) {
            const p = t.replace('*', '').trim();
            if (p.includes('|')) [curCatF, curCatB] = p.split('|').map(s => s.trim());
            else curCatF = curCatB = p;
        } else if (t.includes('|')) {
            const [f, b] = t.split('|').map(s => s.trim());
            if (f && b) newCards.push({ catF: curCatF, catB: curCatB, front: f, back: b });
        }
    });
    allCards = [...allCards, ...newCards];
    localStorage.setItem('myFlashcards', JSON.stringify(allCards));
    selectedCategories.clear();
    applyFilters(true);
    startApp();
}

function startApp() {
    const importer = document.getElementById('importer');
    const appView = document.getElementById('appView');

    // Only try to change style if the elements actually exist
    if (importer) {
        importer.style.display = 'none';
    } else {
        console.warn("UI Warning: #importer element not found.");
    }

    if (appView) {
        appView.style.display = 'flex'; // Changed from 'block' to 'flex' for your new layout
    } else {
        console.error("Critical Error: #appView element not found. App cannot start.");
        return; 
    }

    updateCard();
}

function updateCard() {
    if (filteredCards.length === 0) {
        // Use optional chaining or checks to prevent the crash
        const eng = document.getElementById('engDisplay');
        const spa = document.getElementById('spaDisplay');
        if (eng) eng.innerText = "Empty set";
        if (spa) spa.innerText = "Check filters";
        return;
    }

    const card = filteredCards[currentIndex];
    cardInner.classList.remove('is-flipped');

    // Small delay to allow the flip animation to reset
    setTimeout(() => {
        const cf = document.getElementById('catFront');
        const cb = document.getElementById('catBack');
        const ef = document.getElementById('engDisplay');
        const eb = document.getElementById('spaDisplay');
        const st = document.getElementById('status');

        // Only set text if the element actually exists
        if (cf) cf.innerText = card.catF;
        if (cb) cb.innerText = card.catB;
        if (ef) ef.innerText = card.front;
        if (eb) eb.innerText = card.back;
        if (st) st.innerText = `${currentIndex + 1} / ${filteredCards.length}`;
    }, 100);
}

function nextCard() { if(filteredCards.length) { currentIndex = (currentIndex + 1) % filteredCards.length; updateCard(); } }
function prevCard() { if(filteredCards.length) { currentIndex = (currentIndex - 1 + filteredCards.length) % filteredCards.length; updateCard(); } }

function shuffleDeck() {
    filteredCards.sort(() => Math.random() - 0.5);
    currentIndex = 0;
    updateCard();
}

function resetSearch() { searchBar.value = ""; applyFilters(false); }


function updateAppTitle(title) {
    if (!title) return;
    document.title = title;
    
    // Look for the specific H2 inside the importer div
    const importerHeader = document.querySelector('#importer h2');
    
    if (importerHeader) {
        importerHeader.innerText = title;
    } else {
        console.warn("UI Warning: #importer h2 not found. Title updated in browser tab only.");
    }
}

function handleCardClick(e) {
    // 1. Check if the user clicked the speaker button (or the icon inside it)
    const speakerBtn = e.target.closest('.speaker-btn');
    
    if (speakerBtn) {
        // Stop the click from "bubbling up" and flipping the card
        e.stopPropagation();
        
        const lang = speakerBtn.getAttribute('data-lang');
        const card = filteredCards[currentIndex];
        
        if (!card) return;
        
        const text = (lang === 'en') ? card.front : card.back;
        speak(text, lang);
    } else {
        // 2. If they clicked anywhere else on the card (the middle 70%), flip it
        if (cardInner) {
            cardInner.classList.toggle('is-flipped');
        }
    }
}

function speak(text, langCode) {
    if (synth.speaking) synth.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    const voice = synth.getVoices().find(v => v.lang.startsWith(langCode));
    if (voice) utter.voice = voice;
    utter.rate = 0.9;
    synth.speak(utter);
}
window.speechSynthesis.onvoiceschanged = () => synth.getVoices();
