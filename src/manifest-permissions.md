This file documents why each permission in `src/manifest.json` is required.

- `activeTab` — Allows the extension to access the currently active tab when the user invokes the extension action (popup). EatWell uses this to read the page contents or open a connection to the page only when the user explicitly clicks the extension, following the minimal-permissions principle.

- `scripting` — Required to programmatically inject scripts or CSS into tabs using the `chrome.scripting` API. EatWell uses this for advanced injection (if needed) or to update the content script behavior from the background/service worker in response to a user action. This is scoped and doesn't require blanket host permissions to run on a page the user has interacted with.

- `storage` — Used to persist user preferences, small caches, or tokens. This uses the chrome.storage API and is strictly scoped to extension storage.

- `identity` (listed as `optional_permissions`) — Optional. Only required if you plan to authenticate the user with an external OAuth provider (for example, to sync settings or access a partner API). Keeping it optional allows users to install the extension without granting identity by default.

- `host_permissions` (site list) — These are explicit host permissions for common recipe websites the extension will interact with (scrape structured recipe data or fetch additional resources). Listing these hosts follows the minimal permissions principle by limiting host access to known recipe sources instead of `<all_urls>`.

Notes about content scripts and development

- The `content_scripts` entry is currently set to match `http://*/*` and `https://*/*` so that during development the content script can be injected on arbitrary pages for testing. In production you should narrow these matches to the specific recipe domains above (or remove the broad matches) to reduce the extension's surface area.

- Chrome's manifest JSON does not support comments. This file documents the reasons for the selected permissions.

If you'd like, I can switch the `content_scripts.matches` to the explicit recipe host list for production and keep the broad http/https matches only during development via a build-time replacement.
