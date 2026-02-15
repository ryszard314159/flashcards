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

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js', { type: 'module' }).then(reg => {
            reg.update();
            reg.addEventListener('updatefound', () => {
                const newWorker = reg.installing;
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        const badge = document.getElementById('update-badge');
                        if (badge) badge.style.display = 'inline-block';
                        document.getElementById('version-container').onclick = () => {
                            newWorker.postMessage({ type: 'SKIP_WAITING' });
                        };
                    }
                });
            });
        });
        navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload());
    }

    setupEventListeners();
});

function setupEventListeners() {
    document.getElementById('nextBtn').addEventListener('click', nextCard);
    document.getElementById('prevBtn').addEventListener('click', prevCard);
    document.getElementById('shuffleBtn').addEventListener('click', shuffleDeck);
    document.getElementById('replaceBtn').addEventListener('click', replaceDeck);
    document.getElementById('resetSearch').addEventListener('click', resetSearch);
    document.getElementById('settingsBtn').addEventListener('click', openSettings);
    document.getElementById('closeSettings').addEventListener('click', () => { settingsModal.style.display = 'none'; });
    document.getElementById('applySettings').addEventListener('click', applySettings);
    document.getElementById('selectAll').addEventListener('click', () => {
        document.querySelectorAll('#categoryList input').forEach(cb => cb.checked = true);
    });
    document.getElementById('selectNone').addEventListener('click', () => {
        document.querySelectorAll('#categoryList input').forEach(cb => cb.checked = false);
    });
    fileInput.addEventListener('change', handleFileUpload);
    searchBar.addEventListener('input', () => applyFilters(false));
    document.getElementById('cardCont').addEventListener('click', handleCardClick);

    window.addEventListener('keydown', (e) => {
        if (document.activeElement === searchBar) return;
        if (e.code === 'Space') { e.preventDefault(); cardInner.classList.toggle('is-flipped'); }
        else if (e.code === 'ArrowRight') nextCard();
        else if (e.code === 'ArrowLeft') prevCard();
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
    document.getElementById('importer').style.display = 'none';
    document.getElementById('appView').style.display = 'flex';
    document.getElementById('utilFooter').style.display = 'flex';
    document.getElementById('searchWrapper').style.display = 'block';
    document.getElementById('replaceBtn').style.display = 'inline-block';
}

function updateCard() {
    if (filteredCards.length === 0) {
        document.getElementById('engDisplay').innerText = "Empty set";
        document.getElementById('spaDisplay').innerText = "Check filters";
        statusDisplay.innerText = "0 / 0";
        return;
    }
    const card = filteredCards[currentIndex];
    cardInner.classList.remove('is-flipped');
    setTimeout(() => {
        document.getElementById('catFront').innerText = card.catF;
        document.getElementById('catBack').innerText = card.catB;
        document.getElementById('engDisplay').innerText = card.front;
        document.getElementById('spaDisplay').innerText = card.back;
        statusDisplay.innerText = `${currentIndex + 1} / ${filteredCards.length}`;
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
    document.title = title;
    const h2 = document.querySelector('#importer h2');
    if (h2) h2.innerText = title;
}

function handleCardClick(e) {
    const btn = e.target.closest('.speaker-btn');
    if (btn) {
        e.stopPropagation();
        const lang = btn.getAttribute('data-lang');
        const text = (lang === 'en') ? filteredCards[currentIndex].front : filteredCards[currentIndex].back;
        speak(text, lang);
    } else cardInner.classList.toggle('is-flipped');
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
