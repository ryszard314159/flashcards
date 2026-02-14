# Flashcard Pro: Universal Learning Engine

Flashcard Pro is a lightweight, **Progressive Web App (PWA)** designed for rapid-fire learning and memorization. While highly effective for language pairs, it is a general-purpose engine capable of handling any subject matter—from coding syntax and medical terms to history dates and technical certifications.

The app is entirely **offline-first**, meaning once loaded, it requires no internet connection. Your data stays on your device.

## 🚀 Key Features

-   **PWA Ready:** Install it directly to your mobile home screen or desktop. No App Store required.
-   **Universal Parser:** Import cards from simple `.txt` files using a clean, human-readable format.
-   **Global Search:** Instantly filter through thousands of cards across multiple categories using the real-time search bar.
-   **Text-to-Speech:** Integrated audio support for both "Front" and "Back" of cards (supports any language recognized by your OS).
-   **Zero Backend:** Privacy-focused; all flashcard data is stored locally in your browser's `localStorage`.
-   **Shuffle Logic:** Randomize your study sessions with a single tap.

---

## 📂 Data Format

To add cards, create a `.txt` file using the following structure. You can mix multiple categories in one file:

```text
* Category Name | Sub-Category
Front Side Text | Back Side Text
Question or Term | Answer or Definition

* Biology | Anatomy
Heart | Corazón
Lungs | Pulmones
