# EatWell — Eat smart. Live well.

# About

**EatWell** is an AI-driven Chrome Extension designed to make cooking simpler, healthier, and more inclusive. By combining multiple on-device and cloud-based AI models, EatWell helps users understand, adapt, and personalize any recipe they find online: directly within the browser.

---

## 🧩 Problem We’re Solving

Modern recipe websites are cluttered, inconsistent, and often not inclusive of different dietary needs or cultural ingredient availability.
Users face several challenges:

* **Managing diets** while ensuring nutritional balance.
* **Finding ingredient substitutions** for allergies, dietary preferences, or local availability.
* **Understanding complex recipes** with vague steps or unfamiliar measurements.
* **Scaling recipes** for different serving sizes without tedious calculations.

**EatWell** solves these problems by combining AI summarization, reasoning, and personalization into one seamless browser extension. It empowers users to:

* Instantly **understand** any recipe.
* **Adapt** it to their needs.
* And **chat** naturally with on-device AI for fine-tuning.

---

## ✨ Core Features

### 🧠 1. Recipe Summarization

Uses the **Summarizer API** to provide a concise summary highlighting:

* Serving size
* Cooking time
* Cuisine style
* Expected flavor profile

This allows users to instantly gauge if a recipe suits their time and taste.

---

### 🧂 2. Ingredient Localization & Cleaning

Powered by the **Prompt API**, EatWell identifies and reformats ingredient names, converting region-specific terms into standardized forms (e.g., “maida” → “all-purpose flour”) or vice-versa.
This ensures clarity and consistency across global recipes.

---

### ⚠️ 3. Allergen Detection

The same **Prompt API** detects potential allergens (e.g., nuts, dairy, gluten) and flags them for quick visibility, promoting safer and more inclusive cooking.

---

### 🍳 4. Recipe Simplification

With the **Rewriter API**, complex cooking steps are rephrased into beginner-friendly instructions.
It reduces ambiguity, clarifies measurements, and keeps the original flavor intact.

---

### 🥗 5. Nutrition Estimation

The **Gemini API** provides detailed nutritional breakdowns, including approximate calories, macros, and essential nutrients, helping users make informed dietary choices.

---

### 💬 6. On-Device AI Chat Assistant

EatWell features a built-in chat window powered by **Gemini Nano (on-device)** or **Gemini 2.5 Flash (cloud)** — depending on user preference.
Users can naturally ask:

* “Convert this recipe to 3 servings.”
* “What’s a vegan alternative for cheese?”
* “Change all measurements to metric.”

This interactive layer replaces rigid buttons with flexible, conversational AI reasoning — all while giving users control over **privacy (Nano)** or **power (Flash)**.

---

## ⚙️ APIs Used

| API                | Purpose                                                                                 |
| ------------------ | --------------------------------------------------------------------------------------- |
| **Prompt API**     | Ingredient cleaning, localization, allergen detection, and on-device chat functionality |
| **Summarizer API** | Recipe summarization and extraction of key details                                      |
| **Rewriter API**   | Recipe simplification and readability enhancement                                       |
| **Gemini API**     | Nutrition estimation, dietary substitution, serving rescaling, and unit conversion      |

---

## 🌍 Vision

EatWell isn’t just about cooking — it’s about **empowering healthy, inclusive, and personalized eating** for everyone.
By combining AI understanding with real-world usability, it bridges the gap between **recipe discovery** and **practical meal preparation**, making diet management and cooking simpler for all users — from beginners to health enthusiasts.

---


What you'll find here

- `src/manifest.json` — extension manifest (MV3)
- `src/popup` — popup UI built with React + TypeScript
- `src/sidebar` — sidebar UI entry (example)
- `src/background.ts` — MV3 background service worker
- `src/contentScript.tsx` — content script (injects a small badge)
- `vite.config.ts`, `tsconfig.json` — build tool config

# Quick start

1. Install dependencies

   npm install

2. Dev (starts Vite dev server)

   npm run dev

   This starts Vite (serves the `src` folder). The dev server compiles the TypeScript/React assets and provides HMR for the UI files.

3. Build for production

   npm run build

   The production build will be written to `dist/`. The artifacts you need to load into Chrome are in `dist/` (including `popup/index.html`, `sidebar/index.html`, `background.js`, `content.js`, and `icons/`).

Loading into Chrome (extension developer mode)

1. Open chrome://extensions/
2. Enable Developer mode (top-right)
3. Click "Load unpacked"
4. Select the `dist/` folder from this repository

Note: the build script copies `src/manifest.json` and the `src/icons/` folder into `dist/`. Make sure you load the `dist/` folder (not `src/`) so Chrome can find the icons and built assets.

# Setting up the Extension

1. Register the required API keys

- If you plan to use the Rewriter / Origin Trial features, register via the Chrome Origin Trials page and add the token to the extension Options (see project docs for the exact trial URL).
- To use Gemini (or other Google AI REST endpoints) in the extension you must provision an API key at AI Studio: https://aistudio.google.com/app/apikey and enable any required services for your account.

2. Configure the extension options

- In chrome://extensions click "Details" for the EatWell extension and then click "Extension options" (or open the `options` page from the extension card).
- In the Options page add:
   - Your allergy information
   - Your calorie goals
   - API keys (the UI stores them in chrome.storage; keys are masked and can be shown temporarily)
- Click Save.

Notes and acceptance

- The popup UI shows the text "EatWell" (see `src/popup/main.tsx`).
- The project uses Manifest V3 and TypeScript.
- `npm run dev` starts Vite and compiles the UI sources (requirements: Node.js installed).

# EatWell
EatWell Extension for Chrome Built-In AI hackathon 2025
