const fs = require('fs')
const path = require('path')

async function copyFileRaw(src, dest) {
  await fs.promises.mkdir(path.dirname(dest), { recursive: true })
  await fs.promises.copyFile(src, dest)
}

async function writePngFromBase64(src, dest) {
  // read the text content (base64) and decode to binary PNG
  const b64 = await fs.promises.readFile(src, 'utf8')
  // remove whitespace/newlines
  const cleaned = b64.replace(/\s+/g, '')
  const buf = Buffer.from(cleaned, 'base64')
  await fs.promises.mkdir(path.dirname(dest), { recursive: true })
  await fs.promises.writeFile(dest, buf)
}

async function copyDir(srcDir, destDir) {
  await fs.promises.mkdir(destDir, { recursive: true })
  const entries = await fs.promises.readdir(srcDir, { withFileTypes: true })
  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name)
    const destPath = path.join(destDir, entry.name)
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath)
    } else {
      const ext = path.extname(entry.name).toLowerCase()
      if (ext === '.png') {
        // assume file contains base64 text and decode to binary PNG in dest
        await writePngFromBase64(srcPath, destPath)
      } else {
        await copyFileRaw(srcPath, destPath)
      }
    }
  }
}

async function main() {
  try {
    const root = path.resolve(__dirname, '..')
    const src = path.join(root, 'src')
    const dist = path.join(root, 'dist')

    // copy manifest
    const manifestSrc = path.join(src, 'manifest.json')
    const manifestDest = path.join(dist, 'manifest.json')
    if (fs.existsSync(manifestSrc)) {
      await copyFileRaw(manifestSrc, manifestDest)
      console.log('Copied manifest.json to dist/')
    } else {
      console.warn('No src/manifest.json found to copy')
    }

    // copy icons if present
    const iconsSrc = path.join(src, 'icons')
    const iconsDest = path.join(dist, 'icons')
    if (fs.existsSync(iconsSrc)) {
      await copyDir(iconsSrc, iconsDest)
      console.log('Copied icons/ to dist/icons/')
    } else {
      console.warn('No src/icons/ found to copy')
    }
  } catch (err) {
    console.error('Error copying static files:', err)
    process.exitCode = 1
  }
}

main()
