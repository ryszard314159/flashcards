/**
 * Flashcard Pro: Universal Learning Engine
 * Core Logic (ES6 Module)
 */

let allCards = [];
let filteredCards = [];
let currentIndex = 0;
let isReplacing = false; // Tracks if the next file upload should overwrite the deck
const synth = window.speechSynthesis;

// DOM Elements
const cardInner = document.getElementById('cardInner');
const searchBar = document.getElementById('searchBar');
const fileInput = document.getElementById('fileInput');
const statusDisplay = document.getElementById('status');

// Initialize App
window.addEventListener('DOMContentLoaded', () => {
    // 1. Load data from LocalStorage
    const savedData = localStorage.getItem('myFlashcards');
    if (savedData) {
        allCards = JSON.parse(savedData);
        if (allCards.length > 0) {
            filteredCards = [...allCards];
            startApp();
        }
    }

    // 2. Register PWA Service Worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').catch(err => console.log("SW failed", err));
    }

    // 3. Attach all Event Listeners
    setupEventListeners();
});

function setupEventListeners() {
    // Navigation Buttons
    document.getElementById('nextBtn').addEventListener('click', nextCard);
    document.getElementById('prevBtn').addEventListener('click', prevCard);
    
    // Action Buttons
    document.getElementById('shuffleBtn').addEventListener('click', shuffleDeck);
    document.getElementById('replaceBtn').addEventListener('click', replaceDeck);
    document.getElementById('resetSearch').addEventListener('click', resetSearch);
    
    // File Input Logic
    fileInput.addEventListener('change', handleFileUpload);

    // Search Logic
    searchBar.addEventListener('input', handleSearch);

    // Card Interaction (Flip and Audio)
    document.getElementById('cardCont').addEventListener('click', handleCardClick);
}

/**
 * DECK MANAGEMENT
 */

function replaceDeck() {
    if (confirm("Replace existing cards with a new file? Current cards will be deleted.")) {
        isReplacing = true; 
        fileInput.click(); 
    }
}

function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        // Clear memory if "Replace" was clicked
        if (isReplacing) {
            allCards = [];
            isReplacing = false; 
        }
        parseAndAdd(event.target.result);
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input so same file can be uploaded twice if needed
}

function parseAndAdd(text) {
    const lines = text.split('\n');
    let cEn = "General", cEs = "General";
    let newCards = [];

    lines.forEach(line => {
        const t = line.trim();
        // Check for Category Marker: * Category Front | Category Back
        if (t.startsWith('*')) {
            const p = t.replace('*', '').trim();
            if (p.includes('|')) {
                [cEn, cEs] = p.split('|').map(s => s.trim());
            } else { 
                cEn = cEs = p; 
            }
        } 
        // Check for Card Content: Front | Back
        else if (t.includes('|')) {
            const [en, es] = t.split('|').map(s => s.trim());
            if(en && es) {
                newCards.push({ catEn: cEn, catEs: cEs, eng: en, spa: es });
            }
        }
    });

    allCards = [...allCards, ...newCards];
    localStorage.setItem('myFlashcards', JSON.stringify(allCards));
    filteredCards = [...allCards];
    startApp();
}

/**
 * APP FLOW & NAVIGATION
 */

function startApp() {
    document.getElementById('importer').style.display = 'none';
    document.getElementById('appView').style.display = 'flex';
    document.getElementById('utilFooter').style.display = 'flex';
    document.getElementById('searchWrapper').style.display = 'block';
    document.getElementById('replaceBtn').style.display = 'inline-block';
    updateCard();
}

function updateCard() {
    if (filteredCards.length === 0) {
        document.getElementById('engDisplay').innerText = "No matches found";
        document.getElementById('spaDisplay').innerText = "Sin coincidencias";
        statusDisplay.innerText = "0 / 0";
        return;
    }

    const card = filteredCards[currentIndex];
    cardInner.classList.remove('is-flipped'); // Always show front on new card
    
    // Slight delay to allow flip animation to reset if moving while flipped
    setTimeout(() => {
        document.getElementById('catFront').innerText = card.catEn;
        document.getElementById('catBack').innerText = card.catEs;
        document.getElementById('engDisplay').innerText = card.eng;
        document.getElementById('spaDisplay').innerText = card.spa;
        statusDisplay.innerText = `${currentIndex + 1} / ${filteredCards.length}`;
    }, 100);
}

function nextCard() { 
    if(filteredCards.length) { 
        currentIndex = (currentIndex + 1) % filteredCards.length; 
        updateCard(); 
    } 
}

function prevCard() { 
    if(filteredCards.length) { 
        currentIndex = (currentIndex - 1 + filteredCards.length) % filteredCards.length; 
        updateCard(); 
    } 
}

function shuffleDeck() {
    for (let i = filteredCards.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [filteredCards[i], filteredCards[j]] = [filteredCards[j], filteredCards[i]];
    }
    currentIndex = 0;
    updateCard();
}

/**
 * SEARCH LOGIC
 */

function handleSearch() {
    const query = searchBar.value.toLowerCase();
    const resetBtn = document.getElementById('resetSearch');
    
    if (query === "") {
        filteredCards = [...allCards];
        resetBtn.style.display = "none";
    } else {
        filteredCards = allCards.filter(c => 
            c.eng.toLowerCase().includes(query) || 
            c.spa.toLowerCase().includes(query) || 
            c.catEn.toLowerCase().includes(query) ||
            c.catEs.toLowerCase().includes(query)
        );
        resetBtn.style.display = "block";
    }
    currentIndex = 0;
    updateCard();
}

function resetSearch() {
    searchBar.value = "";
    handleSearch();
}

/**
 * INTERACTION & AUDIO
 */

function handleCardClick(e) {
    const btn = e.target.closest('.speaker-btn');
    if (btn) {
        e.stopPropagation(); // Don't flip the card when clicking the speaker
        const lang = btn.getAttribute('data-lang');
        const text = (lang === 'en') ? filteredCards[currentIndex].eng : filteredCards[currentIndex].spa;
        speak(text, lang);
    } else {
        cardInner.classList.toggle('is-flipped');
    }
}

function speak(text, langCode) {
    if (synth.speaking) synth.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    
    // Attempt to find a voice that matches the language code (e.g., 'es' or 'en')
    const voices = synth.getVoices();
    const voice = voices.find(v => v.lang.startsWith(langCode));
    
    if (voice) utter.voice = voice;
    utter.rate = 0.9; 
    synth.speak(utter);
}

// Pre-load voices for some browsers
window.speechSynthesis.onvoiceschanged = () => synth.getVoices();
