# Flashcards PWA — Project Notes

## Overview
Immersive Flashcards — a distraction-free, offline-ready PWA for spaced repetition learning. Currently used for Spanish language study.

## Stack
- Vanilla JS (ES modules), no framework
- Jest tests: `npm test` (uses `--experimental-vm-modules`), 246 tests / 11 suites — all passing
- PWA with service worker (`sw.js`), versioned via `bash utils/update-version.sh`
- Served locally: `python3 -m http.server 8080`
- Tested on Linux desktop + Pixel phone (LAN at `192.168.1.29:8080`)

## Key Files
| File | Purpose |
|------|---------|
| `src/app.js` | Main application logic, event handlers, UI sync |
| `src/session.js` | Session management, card drawing, navigation history |
| `src/state.js` | State definition, constants (HISTORY_SIZE, SELECTION_MODE, etc.) |
| `src/tutor.js` | 3-tier AI tutor backend (Chrome AI → Ollama → OpenAI) |
| `src/speech.js` | TTS with voice selection |
| `src/recognition.js` | STT for voice input |
| `src/io.js` | Persistence: `save(key, data)` / `load(key)` via localStorage |
| `index.html` | Main HTML with settings UI |
| `css/style.css` | Styles including backend toggle groups |
| `sw.js` | Service worker for offline caching |
| `config.json` | App configuration |

## Architecture
- **State management**: `state.settings` merged from defaults + localStorage on startup
- **Selection modes**: `'weighted'` (shuffle/🔀) or `'sequential'` (>)
- **Navigation history**: runtime array (not persisted), `historySize` default=3
- **Deck format**: `.deck` text files with `* Category | Category` headers and `front | back | score` lines
- **Voice spec**: `"voiceName (lang)"` format, parsed/normalized throughout
- **API key**: stored in `sessionStorage` (not localStorage) for security

## AI Tutor Feature
Conversational Spanish tutor with 3 backends tried in priority order:
1. **Chrome AI** (Built-in) — needs GPU, unavailable on Linux
2. **Ollama** (Local) — `GET /api/tags` health check, `POST /api/chat`; slow on CPU for 8B+ models
3. **OpenAI** (Cloud) — requires API key

Per-backend enable/disable checkboxes in Settings UI. CSS `:has(:not(:checked))` hides config fields when unchecked.

## Recent Changes (March 2026)
1. AI Tutor Chat with 3 backends + per-backend toggle UI
2. TTS fix — tutor chat uses `lang='es'` + `selectBestVoiceForLanguage('es')`
3. History bug fix — `getElementById('historySizeInput')` → `getElementById('historySize')` (ID mismatch caused history to silently disable)
4. Startup migration — restores `historySize` default when corrupted `0` found in saved settings
5. SW update module extraction, search-aware settings save, card counter refactoring, empty search feedback, test coverage improvements

## Known Issues
- Flaky test: `app-core-logic.test.js:87` — probabilistic weighted distribution check occasionally fails due to randomness
- Ollama on CPU is slow for 8B+ models; recommend 1B-3B models
- Chrome AI unavailable on Linux (no GPU acceleration)
- After code changes, Pixel needs SW version bump (`bash utils/update-version.sh`) + cache clear to get updates
