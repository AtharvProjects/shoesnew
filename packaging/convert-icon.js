const { Jimp } = require('jimp');
const pngToIco = require('png-to-ico').default;
const fs = require('fs');
const path = require('path');

const srcFile = process.argv[2];
if (!srcFile) {
  console.error("Usage: node convert-icon.js <path-to-jpeg>");
  process.exit(1);
}

const destPng = path.resolve(__dirname, '../public/logo.png');
const destIco = path.resolve(__dirname, '../public/favicon.ico');

async function convert() {
  const image = await Jimp.read(srcFile);
  
  // Resize to 256x256 to ensure standard ICO max size compatibility
  image.resize({ w: 256, h: 256 });
  await image.write(destPng);
  console.log('Successfully saved to public/logo.png');

  const buf = await pngToIco(destPng);
  fs.writeFileSync(destIco, buf);
  console.log('Successfully converted icon to public/favicon.ico');
}

convert().catch(console.error);
