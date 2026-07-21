/**
 * Ensure kiosk static files are present in dist/ after expo export.
 */
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'public', 'kiosk');
const dest = path.join(__dirname, '..', 'dist', 'kiosk');

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const srcPath = path.join(from, entry.name);
    const destPath = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(srcPath, destPath);
    else fs.copyFileSync(srcPath, destPath);
  }
}

if (!fs.existsSync(src)) {
  console.warn('[copy-kiosk] Source missing:', src);
  process.exit(0);
}

copyDir(src, dest);
console.log('[copy-kiosk] Copied kiosk assets to dist/kiosk');
