# Design Document: Immersive Flashcards PWA

## 1. Project Vision
A minimalist, content-centric flashcard application designed for **Spaced Repetition (SRS)** and active-recall learning. The app prioritizes "Immersive Mode," where UI elements are secondary to the content, utilizing intuitive tap-zones for navigation and a weighted probability system to optimize memory retention.

**Reference:** [Spaced Repetition - Wikipedia](https://en.wikipedia.org/wiki/Spaced_repetition)

## 2. Technical Stack
- **Language:** Vanilla JavaScript (ES6+), HTML5, CSS3.
- **Persistence:** `localStorage` for card data, weights, and session settings.
- **Offline Support:** Service Worker (PWA) with a "Cache-First" strategy.
- **Audio:** Web Speech API (Text-to-Speech).
- **Assets:** Scalable Vector Graphics (SVG) for UI icons.

## 3. Structural Architecture (CSS Grid)

Overall layout of the main panel should be like this:

|       HEADER       |
| PREV | CARD | NEXT |
|      FOOTER        |

but is is like this

|       HEADER       |
______________________
| PREV | NEXT
| PREV | CARD |
|      FOOTER        |

Now card-view looks like this

--------------------------
|      |          |      |
| PREV |    ?     | NEXT |
|      |          |      |
--------------------------
|      |          |      |
|   ?  |  CARD    |  ?   |
|      |          |      |
--------------------------




### Top-Level Layout (Body)
1x3 Grid filling 100vh.
- **Header (Row 1):** `min-content` (approx 10%)
- **Card View (Row 2):** `1fr` (approx 80%)
- **Footer (Row 3):** `min-content` (approx 10%)

### Header Structure
3x1 Grid (Columns: 15% | 70% | 15%)
1. **Left:** Card counter (e.g., `1 / 595`).
2. **Center:** Search box with magnifying glass SVG placeholder.
3. **Right:** Menu button (`&vellip;`) triggering the Modal Overlay.

### Menu (Modal Overlay)
2xN Grid (Columns: 40px | 1fr) displayed as a right-aligned modal.

| Icon | Label | Action |
| :--- | :--- | :--- |
| ? | **Help** | Display help page |
| 📤 | **Share** | Triggers `navigator.share()` API. |
| 📥 | **Export .deck**| Downloads `.deck` file including `score` metadata. |
| 📁 | **Import .deck**| Loads new content; replaces `localStorage`. |
| ⚙️ | **Settings...** | Opens the Settings Panel. |

### Settings Panel
#### Section A: Study Session
- **Session Size:** Input box (Number). Defines how many cards are pulled for the current session.
  - *Default:* 5.
  - *Behavior:* If empty/null, the entire filtered deck is used.
- **Category Filter:** Checkbox list to toggle active categories.

#### Section B: SRS Calibration
- **SRS_UPDATE_FACTOR:** Slider (default 0.9).
- **Weight Limits:** `SRS_MIN` (0.1) and `SRS_MAX` (10.0).

#### Section C: Audio
- **Voice Selection:** Dropdown of system voices.
- **Speech Rate:** Slider.

### Card Interaction Grid (Main View)
Nested grid managing navigation and difficulty voting.

| Column | Role | Interaction |
| :--- | :--- | :--- |
| **Left (15%)** | Prev Zone | `prevCard()` / **Vote Down (Learned)**. |
| **Center (70%)** | Content | `flipCard()` / TTS Audio. |
| **Right (15%)** | Next Zone | `nextCard()` / **Vote Up (Difficult)**. |

**SRS Voting Logic:**
- **Vote Up (Difficult):** `score = score * (1 / SRS_UPDATE_FACTOR)`.
- **Vote Down (Learned):** `score = score * SRS_UPDATE_FACTOR`.
- **Selection Algorithm:** Weighted random pull based on `score`. Higher scores have a higher probability of being included in the **Study Session**.


### Footer Structure
1x3 Grid. Center column for `VERSION` and `UPDATE_BADGE`. Side columns reserved for future status icons.

## 4. Interaction Layering
- **Layer 1 (Base):** The 3D-flippable card faces.
- **Layer 2 (Overlay):** Invisible navigation zones (Left/Right) for edge-tapping.
- **Layer 3 (UI):** Modals (Settings/Menu) and SVG icon buttons.

## 5. Data Specification

### File Format (`.deck`)
Plain text with standard headers:
- `** Title`: Application/Tab title.
- `* FrontLabel | BackLabel`: Category headers for both card faces.
- `Front | Back | [score]`: Content line (score is optional for import).

## 6. Source code structure

```text
./DESIGN.md
./README.md
./help.html
./index.html
./manifest.json
./css/style.css
./decks/spanish.deck
./icons/export.svg
./icons/help.svg
./icons/import.svg
./icons/settings.svg
./icons/share.svg
./src/app.js      (Main controller & App State)
./src/config.js   (Globals)
./src/audio.js    (Web Speech API wrappers)
./src/io.js       (Import/Export & LocalStorage)
./src/parser.js   (File processing logic)
./src/ui.js       (DOM updates, Grid handling, Modals)
./src/srs.js      (Weighted selection & Scoring logic)
./src/sw.js       (Service Worker)
```

### Card Object Schema
```javascript
{
  frontLabel: string, 
  backLabel: string,  
  frontText: string, 
  backText: string,
  score: number,      // Weighted importance (default: 1.0)
  lastSeen: timestamp // Unix timestamp
}
```