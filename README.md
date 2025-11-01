# EatWell — Chrome extension scaffold

This repository is a small scaffold for a Chrome Extension (Manifest V3) using React, TypeScript, Vite and Tailwind CSS.

What you'll find here

- `src/manifest.json` — extension manifest (MV3)
- `src/popup` — popup UI built with React + TypeScript
- `src/sidebar` — sidebar UI entry (example)
- `src/background.ts` — MV3 background service worker
- `src/contentScript.tsx` — content script (injects a small badge)
- `vite.config.ts`, `tsconfig.json` — build tool config

Quick start

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
