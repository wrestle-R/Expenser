const sharp = require('sharp');
const path = require('path');

const inputSvg = path.join(__dirname, '../../next/public/logo.svg');
const outDir = path.join(__dirname, '../assets/images');

async function createCenteredLogo({
  size,
  scale,
  background,
  tint,
}) {
  const logoSize = Math.round(size * scale);
  let logo = sharp(inputSvg).resize(logoSize, logoSize, {
    fit: 'contain',
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  });

  if (tint) {
    logo = logo.tint(tint);
  }

  const logoBuffer = await logo.png().toBuffer();
  const offset = Math.round((size - logoSize) / 2);

  const canvas = sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background,
    },
  });

  return canvas
    .composite([{ input: logoBuffer, left: offset, top: offset }])
    .png();
}

async function generateIcons() {
  await (await createCenteredLogo({
    size: 1024,
    scale: 0.7,
    background: { r: 255, g: 255, b: 255, alpha: 1 },
  })).toFile(path.join(outDir, 'icon.png'));
  console.log('Generated icon.png');

  await (await createCenteredLogo({
    size: 1024,
    scale: 0.52,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })).toFile(path.join(outDir, 'splash-icon.png'));
  console.log('Generated splash-icon.png');

  await (await createCenteredLogo({
    size: 1024,
    scale: 0.56,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })).toFile(path.join(outDir, 'android-icon-foreground.png'));
  console.log('Generated android-icon-foreground.png');

  await sharp({
    create: {
      width: 1024,
      height: 1024,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .png()
    .toFile(path.join(outDir, 'android-icon-background.png'));
  console.log('Generated android-icon-background.png');

  await (await createCenteredLogo({
    size: 1024,
    scale: 0.56,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
    tint: { r: 17, g: 24, b: 39 },
  })).toFile(path.join(outDir, 'android-icon-monochrome.png'));
  console.log('Generated android-icon-monochrome.png');

  await (await createCenteredLogo({
    size: 96,
    scale: 0.7,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
    tint: { r: 102, g: 102, b: 102 },
  })).toFile(path.join(outDir, 'notification-icon.png'));
  console.log('Generated notification-icon.png');

  await (await createCenteredLogo({
    size: 48,
    scale: 0.82,
    background: { r: 255, g: 255, b: 255, alpha: 1 },
  })).toFile(path.join(outDir, 'favicon.png'));
  console.log('Generated favicon.png');
}

generateIcons().catch(console.error);
