const fs = require('fs')
const path = require('path')

function ok(msg) {
  console.log('[PASS] ' + msg)
}

function fail(msg) {
  console.error('[FAIL] ' + msg)
  process.exitCode = 2
}

function fileExists(p) {
  try {
    return fs.statSync(p).isFile()
  } catch (e) {
    return false
  }
}

const root = path.resolve(__dirname, '..')
const dist = path.join(root, 'dist')

console.log('Verifying dist/ contents...')

// 1) manifest.json exists
const manifest = path.join(dist, 'manifest.json')
if (fileExists(manifest)) ok('manifest.json exists')
else fail('manifest.json is missing')

// 2) popup index.html exists
const popupHtml = path.join(dist, 'popup', 'index.html')
if (fileExists(popupHtml)) ok('popup/index.html exists')
else fail('popup/index.html is missing')

// 3) popup.js exists and contains EatWell
const popupJs = path.join(dist, 'popup.js')
if (fileExists(popupJs)) {
  ok('popup.js exists')
  const txt = fs.readFileSync(popupJs, 'utf8')
  if (txt.includes('EatWell')) ok("popup.js contains 'EatWell'")
  else fail("popup.js does not contain 'EatWell'")
} else {
  fail('popup.js is missing')
}

// 4) background.js exists
const background = path.join(dist, 'background.js')
if (fileExists(background)) ok('background.js exists')
else fail('background.js is missing')

// 5) content.js exists
const content = path.join(dist, 'content.js')
if (fileExists(content)) ok('content.js exists')
else fail('content.js is missing')

// 6) icons exist and are non-empty
const iconsDir = path.join(dist, 'icons')
if (fs.existsSync(iconsDir)) {
  const icons = fs.readdirSync(iconsDir)
  if (icons.length > 0) ok('icons directory exists with files: ' + icons.join(', '))
  else fail('icons directory exists but empty')
} else {
  fail('icons directory missing')
}

if (!process.exitCode) {
  console.log('\nAll verification checks passed. The extension build looks good.')
} else {
  console.error('\nOne or more checks failed. See messages above.')
}
