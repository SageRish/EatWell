<#
.SYNOPSIS
  Package the built extension into a Chrome Web Store zip (Windows PowerShell variant).

USAGE
  From repository root (PowerShell):
    .\package-extension.ps1

This mirrors package-extension.sh but uses Compress-Archive so you don't need a separate `zip` binary.
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ScriptDir = Split-Path -Parent $PSCommandPath
$RepoRoot = Resolve-Path $ScriptDir
$DistDir = Join-Path $RepoRoot 'dist'
$OutDir = Join-Path $RepoRoot 'artifact'
$TmpDir = Join-Path $OutDir 'pkg_tmp'

Write-Host "Repo root: $RepoRoot"

if (-not (Test-Path $DistDir)) {
    Write-Error "Error: build output directory '$DistDir' not found. Run 'npm run build' first."
    exit 2
}

if (Test-Path $TmpDir) { Remove-Item -Recurse -Force $TmpDir }
New-Item -ItemType Directory -Path $TmpDir | Out-Null
if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Path $OutDir | Out-Null }

Write-Host "Copying build output..."
Copy-Item -Path (Join-Path $DistDir '*') -Destination $TmpDir -Recurse -Force

# Ensure a privacy policy is included
$PrivacyHtml = Join-Path $TmpDir 'PRIVACY_POLICY.html'
if (Test-Path (Join-Path $RepoRoot 'PRIVACY_POLICY.html')) {
    Write-Host 'Using existing PRIVACY_POLICY.html from repo root'
    Copy-Item -Path (Join-Path $RepoRoot 'PRIVACY_POLICY.html') -Destination $PrivacyHtml -Force
} elseif (Test-Path (Join-Path $RepoRoot 'PRIVACY.md')) {
    Write-Host 'Converting PRIVACY.md to PRIVACY_POLICY.html'
    if (Get-Command pandoc -ErrorAction SilentlyContinue) {
        & pandoc (Join-Path $RepoRoot 'PRIVACY.md') -o $PrivacyHtml
    } else {
        "$([System.Web.HttpUtility]::HtmlEncode((Get-Content (Join-Path $RepoRoot 'PRIVACY.md') -Raw)))" | Out-File -FilePath $PrivacyHtml -Encoding utf8
        Add-Content -Path $PrivacyHtml -Value "`n"
    }
} else {
    Write-Host "No privacy policy found; writing a template to $PrivacyHtml"
    @'
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
'@ | Out-File -FilePath $PrivacyHtml -Encoding utf8
}

$IconDest = Join-Path $TmpDir 'icons'
if (-not (Test-Path $IconDest)) { New-Item -ItemType Directory -Path $IconDest | Out-Null }
Write-Host "Collecting icons (if present)..."
$FoundIcon = $false
foreach ($d in @('public/icons','src/assets/icons','icons')) {
    $p = Join-Path $RepoRoot $d
    if (Test-Path $p) {
        Write-Host "Found icons in $p -> copying"
        Copy-Item -Path (Join-Path $p '*') -Destination $IconDest -Recurse -Force -ErrorAction SilentlyContinue
        $FoundIcon = $true
    }
}
if (-not $FoundIcon) { Write-Warning 'Warning: no icons directory found in public/icons or src/assets/icons or icons. Make sure manifest.json references correct icon paths.' }

Write-Host "Collecting screenshots (if present)..."
$ScreenshotDest = Join-Path $TmpDir 'screenshots'
if (-not (Test-Path $ScreenshotDest)) { New-Item -ItemType Directory -Path $ScreenshotDest | Out-Null }
if (Test-Path (Join-Path $RepoRoot 'screenshots')) {
    Copy-Item -Path (Join-Path $RepoRoot 'screenshots/*') -Destination $ScreenshotDest -Recurse -Force -ErrorAction SilentlyContinue
} else {
    Write-Host 'No screenshots/ directory found; create screenshots/ with 1280x800 PNGs for the store listing if possible.'
}

# Short description
@'
EatWell — find allergens, nutrition facts and smart substitutions for recipes using Chrome's AI APIs and on-device heuristics.
Supports privacy mode (no external calls) and local mocks for offline demos.
'@ | Out-File -FilePath (Join-Path $TmpDir 'SHORT_DESCRIPTION.txt') -Encoding utf8

$ZipName = Join-Path $OutDir 'eatwell-chrome-extension.zip'
Write-Host "Creating zip: $ZipName"

if (Test-Path $ZipName) { Remove-Item -Force $ZipName }
Compress-Archive -Path (Join-Path $TmpDir '*') -DestinationPath $ZipName -Force

Write-Host "Package created: $ZipName"
Write-Host "You can now upload $ZipName to the Chrome Web Store or attach it to a GitHub release."

# cleanup
Remove-Item -Recurse -Force $TmpDir

Write-Host 'Done.'

exit 0