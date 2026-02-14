let allCards = [];
let filteredCards = [];
let currentIndex = 0;
const synth = window.speechSynthesis;

// Elements
const cardInner = document.getElementById('cardInner');
const searchBar = document.getElementById('searchBar');
const fileInput = document.getElementById('fileInput');

// Initialize
window.addEventListener('DOMContentLoaded', () => {
    const savedData = localStorage.getItem('myFlashcards');
    if (savedData) {
        allCards = JSON.parse(savedData);
        if (allCards.length > 0) {
            filteredCards = [...allCards];
            startApp();
        }
    }

    // PWA Service Worker Registration
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').catch(err => console.log("SW failed", err));
    }

    // Attach Event Listeners
    setupEventListeners();
});

function setupEventListeners() {
    // Navigation & Actions
    document.getElementById('nextBtn').addEventListener('click', nextCard);
    document.getElementById('prevBtn').addEventListener('click', prevCard);
    document.getElementById('shuffleBtn').addEventListener('click', shuffleDeck);
    document.getElementById('clearBtn').addEventListener('click', clearDeck);
    document.getElementById('resetSearch').addEventListener('click', resetSearch);
    
    // File Import
    fileInput.addEventListener('change', handleFileUpload);

    // Search
    searchBar.addEventListener('input', handleSearch);

    // Card Flip & Audio
    document.getElementById('cardCont').addEventListener('click', handleCardClick);
}

function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => parseAndAdd(event.target.result);
    reader.readAsText(file);
    e.target.value = ''; 
}

function parseAndAdd(text) {
    const lines = text.split('\n');
    let cEn = "General", cEs = "General";
    let newCards = [];

    lines.forEach(line => {
        const t = line.trim();
        if (t.startsWith('*')) {
            const p = t.replace('*', '').trim();
            if (p.includes('|')) {
                [cEn, cEs] = p.split('|').map(s => s.trim());
            } else { cEn = cEs = p; }
        } else if (t.includes('|')) {
            const [en, es] = t.split('|').map(s => s.trim());
            if(en && es) newCards.push({ catEn: cEn, catEs: cEs, eng: en, spa: es });
        }
    });

    allCards = [...allCards, ...newCards];
    localStorage.setItem('myFlashcards', JSON.stringify(allCards));
    filteredCards = [...allCards];
    startApp();
}

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

function handleCardClick(e) {
    const btn = e.target.closest('.speaker-btn');
    if (btn) {
        e.stopPropagation(); 
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
    const voices = synth.getVoices();
    const voice = voices.find(v => v.lang.startsWith(langCode));
    if (voice) utter.voice = voice;
    utter.rate = 0.9; 
    synth.speak(utter);
}

function startApp() {
    document.getElementById('importer').style.display = 'none';
    document.getElementById('appView').style.display = 'flex';
    document.getElementById('utilFooter').style.display = 'flex';
    document.getElementById('searchWrapper').style.display = 'block';
    document.getElementById('clearBtn').style.display = 'inline-block';
    updateCard();
}

function updateCard() {
    const status = document.getElementById('status');
    if (filteredCards.length === 0) {
        document.getElementById('engDisplay').innerText = "No matches found";
        document.getElementById('spaDisplay').innerText = "Sin coincidencias";
        status.innerText = "0 / 0";
        return;
    }
    const card = filteredCards[currentIndex];
    cardInner.classList.remove('is-flipped');
    
    setTimeout(() => {
        document.getElementById('catFront').innerText = card.catEn;
        document.getElementById('catBack').innerText = card.catEs;
        document.getElementById('engDisplay').innerText = card.eng;
        document.getElementById('spaDisplay').innerText = card.spa;
        status.innerText = `${currentIndex + 1} / ${filteredCards.length}`;
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

function clearDeck() {
    if(confirm("Delete all cards and start over?")) {
        localStorage.removeItem('myFlashcards');
        location.reload();
    }
}
