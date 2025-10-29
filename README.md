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

Notes and acceptance

- The popup UI shows the text "EatWell" (see `src/popup/main.tsx`).
- The project uses Manifest V3 and TypeScript.
- `npm run dev` starts Vite and compiles the UI sources (requirements: Node.js installed).

Next steps

- Add icons in `src/icons/` if you want PNGs for the Chrome store.
- Add tests and CI, and wire an automated builder that zips `dist/` for uploads.
# EatWell
EatWell Extension for Chrome Built-In AI hackathon 2025
