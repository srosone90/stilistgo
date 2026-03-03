/**
 * Genera le immagini placeholder necessarie per Expo.
 * Esegui con: node scripts/gen-assets.js
 */
const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const assetsDir = path.join(__dirname, '..', 'assets');
if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

function makeImage(size, bg, text, filename) {
  try {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.floor(size * 0.25)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, size / 2, size / 2);
    const buf = canvas.toBuffer('image/png');
    fs.writeFileSync(path.join(assetsDir, filename), buf);
    console.log(`✅ Creato ${filename}`);
  } catch {
    // canvas non installato, creo un PNG minimale manualmente
    // PNG 1x1 pixel trasparente (base64)
    const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    fs.writeFileSync(path.join(assetsDir, filename), Buffer.from(pngBase64, 'base64'));
    console.log(`⚠️  ${filename} creato come placeholder minimale (installa 'canvas' per icona vera)`);
  }
}

makeImage(1024, '#1a1a2e', '✂', 'icon.png');
makeImage(1024, '#1a1a2e', '✂', 'splash.png');
makeImage(1024, '#1a1a2e', '✂', 'adaptive-icon.png');
makeImage(64,   '#1a1a2e', '✂', 'favicon.png');

console.log('\n✅ Assets generati in /assets');
