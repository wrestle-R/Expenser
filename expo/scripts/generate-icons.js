const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const inputSvg = path.join(__dirname, '../../next/public/logo.svg');
const outDir = path.join(__dirname, '../assets/images');

async function generateIcons() {
  const iconSizes = [
    { name: 'icon.png', size: 1024 },
    { name: 'splash-icon.png', size: 1024 },
    { name: 'android-icon-foreground.png', size: 1024 },
    { name: 'notification-icon.png', size: 96 },
    { name: 'favicon.png', size: 48 },
  ];

  for (const { name, size } of iconSizes) {
    await sharp(inputSvg)
      .resize(size, size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .png()
      .toFile(path.join(outDir, name));
    console.log(`Generated ${name}`);
  }
}

generateIcons().catch(console.error);
