let allCards = [];
let filteredCards = [];
let currentIndex = 0;
const synth = window.speechSynthesis;

window.onload = () => {
    const savedData = localStorage.getItem('myFlashcards');
    if (savedData) {
        allCards = JSON.parse(savedData);
        if (allCards.length > 0) {
            filteredCards = [...allCards];
            startApp();
        }
    }
    // Register Service Worker for PWA
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js');
    }
};

document.getElementById('fileInput').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => parseAndAdd(e.target.result);
    reader.readAsText(file);
    this.value = ''; 
});

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
    const query = document.getElementById('searchBar').value.toLowerCase();
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
    document.getElementById('searchBar').value = "";
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
        document.getElementById('cardInner').classList.toggle('is-flipped');
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
    document.getElementById('cardInner').classList.remove('is-flipped');
    
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
window.speechSynthesis.getVoices();
