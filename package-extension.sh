#!/usr/bin/env bash
set -euo pipefail

# package-extension.sh
# Packages the built extension (Vite `dist`) into a zip suitable for upload to the Chrome Web Store.
# Creates a minimal privacy policy file if none exists, collects icons and screenshots, and emits
# artifact/eatwell-chrome-extension.zip

ROOT=$(cd "$(dirname "$0")" && pwd)
REPO_ROOT="$ROOT"
DIST_DIR="$REPO_ROOT/dist"
OUT_DIR="$REPO_ROOT/artifact"
TMP_DIR="$OUT_DIR/pkg_tmp"

echo "Repo root: $REPO_ROOT"

if [ ! -d "$DIST_DIR" ]; then
  echo "Error: build output directory '$DIST_DIR' not found. Run 'npm run build' first." >&2
  exit 2
fi

rm -rf "$TMP_DIR"
mkdir -p "$TMP_DIR" "$OUT_DIR"

echo "Copying build output..."
cp -R "$DIST_DIR"/* "$TMP_DIR/"

# Ensure a privacy policy is included
PRIVACY_HTML="$TMP_DIR/PRIVACY_POLICY.html"
if [ -f "$REPO_ROOT/PRIVACY_POLICY.html" ]; then
  echo "Using existing PRIVACY_POLICY.html from repo root"
  cp "$REPO_ROOT/PRIVACY_POLICY.html" "$PRIVACY_HTML"
elif [ -f "$REPO_ROOT/PRIVACY.md" ]; then
  echo "Converting PRIVACY.md to PRIVACY_POLICY.html"
  # Attempt to convert if pandoc exists, otherwise simple wrapper
  if command -v pandoc >/dev/null 2>&1; then
    pandoc "$REPO_ROOT/PRIVACY.md" -o "$PRIVACY_HTML"
  else
    echo "<html><body><pre>" > "$PRIVACY_HTML"
    sed 's/&/&amp;/g; s/</\&lt;/g; s/>/\&gt;/g' "$REPO_ROOT/PRIVACY.md" >> "$PRIVACY_HTML"
    echo "</pre></body></html>" >> "$PRIVACY_HTML"
  fi
else
  echo "No privacy policy found; writing a template to $PRIVACY_HTML"
  cat > "$PRIVACY_HTML" <<'HTML'
<html>
<head><meta charset="utf-8"><title>Privacy Policy — EatWell</title></head>
<body>
<h1>Privacy Policy — EatWell</h1>
<p>This extension (EatWell) is designed to extract recipe data from web pages and provide nutrition/allergen insights. We respect user privacy and limit external requests when Privacy Mode is enabled.</p>
<h2>Data Collected</h2>
<ul>
  <li>Local recipe text and ingredient lists for on-device processing.</li>
  <li>When enabled, external APIs may be called to fetch nutrition or summarization results; those requests are made with user consent.</li>
</ul>
<h2>Third-party Services</h2>
<p>If you configure remote providers or AI services, their data handling is governed by those providers' policies.</p>
<h2>Turning off demo mocks / privacy</h2>
<p>To ensure no outgoing network calls during publishing or demos, set the extension preference <code>privacyMode</code> to <code>true</code> or ensure provider config does not point to remote services. See the repository PUBLISH.md for exact steps.</p>
<p>Contact: <a href="mailto:privacy@example.com">privacy@example.com</a></p>
</body>
</html>
HTML
fi

# Collect icons: search common locations
echo "Collecting icons (if present)..."
ICON_DEST="$TMP_DIR/icons"
mkdir -p "$ICON_DEST"
FOUND_ICON=0
for d in "$REPO_ROOT/public/icons" "$REPO_ROOT/src/assets/icons" "$REPO_ROOT/icons"; do
  if [ -d "$d" ]; then
    echo "Found icons in $d -> copying"
    cp -R "$d"/* "$ICON_DEST/" || true
    FOUND_ICON=1
  fi
done
if [ $FOUND_ICON -eq 0 ]; then
  echo "Warning: no icons directory found in public/icons or src/assets/icons or icons. Make sure manifest.json references correct icon paths."
fi

# Collect screenshots
SCREENSHOT_DEST="$TMP_DIR/screenshots"
mkdir -p "$SCREENSHOT_DEST"
if [ -d "$REPO_ROOT/screenshots" ]; then
  cp -R "$REPO_ROOT/screenshots"/* "$SCREENSHOT_DEST/" || true
else
  echo "No screenshots/ directory found; create screenshots/ with 1280x800 PNGs for the store listing if possible."
fi

# Create a short description file used by the store upload tooling
cat > "$TMP_DIR/SHORT_DESCRIPTION.txt" <<'TXT'
EatWell — find allergens, nutrition facts and smart substitutions for recipes using Chrome's AI APIs and on-device heuristics.
Supports privacy mode (no external calls) and local mocks for offline demos.
TXT

ZIP_NAME="$OUT_DIR/eatwell-chrome-extension.zip"
echo "Creating zip: $ZIP_NAME"
(cd "$TMP_DIR" && zip -r "$ZIP_NAME" .) >/dev/null

echo "Package created: $ZIP_NAME"
echo "You can now upload $ZIP_NAME to the Chrome Web Store or attach it to a GitHub release."

# cleanup tmp
rm -rf "$TMP_DIR"

echo "Done."

exit 0
