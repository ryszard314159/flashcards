import { CONFIG } from './config.js';

let allCards = [];
let filteredCards = [];
let currentIndex = 0;
let isReplacing = false;
const synth = window.speechSynthesis;

// DOM Elements
const cardInner = document.getElementById('cardInner');
const searchBar = document.getElementById('searchBar');
const fileInput = document.getElementById('fileInput');
const statusDisplay = document.getElementById('status');

window.addEventListener('DOMContentLoaded', () => {
    // 1. Version UI
    const versionTag = document.getElementById('version-tag');
    if (versionTag) versionTag.innerText = `${CONFIG.VERSION}`;

    // 2. Load Local Data
    const savedData = localStorage.getItem('myFlashcards');
    if (savedData) {
        allCards = JSON.parse(savedData);
        if (allCards.length > 0) {
            filteredCards = [...allCards];
            updateAppTitle(allCards[0].catF);
            startApp();
        }
    }

    // 3. Service Worker with Silent Update
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js', { type: 'module' }).then(reg => {
            reg.addEventListener('updatefound', () => {
                const newWorker = reg.installing;
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        // Show the red badge
                        const badge = document.getElementById('update-badge');
                        if (badge) badge.style.display = 'inline-block';
                        
                        // Set click to update
                        document.getElementById('version-container').onclick = () => {
                            newWorker.postMessage({ type: 'SKIP_WAITING' });
                        };
                    }
                });
            });
        });

        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (!refreshing) {
                window.location.reload();
                refreshing = true;
            }
        });
    }

    setupEventListeners();
});

function setupEventListeners() {
    document.getElementById('nextBtn').addEventListener('click', nextCard);
    document.getElementById('prevBtn').addEventListener('click', prevCard);
    document.getElementById('shuffleBtn').addEventListener('click', shuffleDeck);
    document.getElementById('replaceBtn').addEventListener('click', replaceDeck);
    document.getElementById('resetSearch').addEventListener('click', resetSearch);
    fileInput.addEventListener('change', handleFileUpload);
    searchBar.addEventListener('input', handleSearch);
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
    let firstTitleFound = false;

    lines.forEach(line => {
        const t = line.trim();
        if (t.startsWith('*')) {
            const p = t.replace('*', '').trim();
            if (!firstTitleFound) { updateAppTitle(p.split('|')[0].trim()); firstTitleFound = true; }
            if (p.includes('|')) [curCatF, curCatB] = p.split('|').map(s => s.trim());
            else curCatF = curCatB = p;
        } else if (t.includes('|')) {
            const [f, b] = t.split('|').map(s => s.trim());
            if(f && b) newCards.push({ catF: curCatF, catB: curCatB, front: f, back: b });
        }
    });

    allCards = [...allCards, ...newCards];
    localStorage.setItem('myFlashcards', JSON.stringify(allCards));
    filteredCards = [...allCards];
    startApp();
}

function startApp() {
    document.getElementById('importer').style.display = 'none';
    document.getElementById('appView').style.display = 'flex';
    document.getElementById('utilFooter').style.display = 'flex';
    document.getElementById('searchWrapper').style.display = 'block';
    document.getElementById('replaceBtn').style.display = 'inline-block';
    updateCard();
}

function updateCard() {
    if (filteredCards.length === 0) return;
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
    for (let i = filteredCards.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [filteredCards[i], filteredCards[j]] = [filteredCards[j], filteredCards[i]];
    }
    currentIndex = 0;
    updateCard();
}

function handleSearch() {
    const query = searchBar.value.toLowerCase();
    const resetBtn = document.getElementById('resetSearch');
    if (query === "") {
        filteredCards = [...allCards];
        resetBtn.style.display = "none";
    } else {
        filteredCards = allCards.filter(c => 
            c.front.toLowerCase().includes(query) || c.back.toLowerCase().includes(query) ||
            c.catF.toLowerCase().includes(query) || c.catB.toLowerCase().includes(query)
        );
        resetBtn.style.display = "block";
    }
    currentIndex = 0;
    updateCard();
}

function resetSearch() { searchBar.value = ""; handleSearch(); }

function updateAppTitle(title) {
    document.title = title;
    const titleH2 = document.querySelector('#importer h2');
    if (titleH2) titleH2.innerText = title;
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
    const voices = synth.getVoices();
    const voice = voices.find(v => v.lang.startsWith(langCode));
    if (voice) utter.voice = voice;
    utter.rate = 0.9;
    synth.speak(utter);
}
window.speechSynthesis.onvoiceschanged = () => synth.getVoices();