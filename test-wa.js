const { Client, LocalAuth } = require('whatsapp-web.js');
const fs = require('fs');

let executablePath = undefined;
const browserPaths = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
];
for (const p of browserPaths) {
  if (fs.existsSync(p)) {
    executablePath = p;
    console.log('Found browser at:', executablePath);
    break;
  }
}

const client = new Client({
  authStrategy: new LocalAuth({
    dataPath: './.wwebjs_auth'
  }),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    ...(executablePath ? { executablePath } : {})
  }
});

client.on('qr', (qr) => {
  console.log('QR Code received');
  process.exit(0);
});

client.on('ready', () => {
  console.log('Client is ready!');
  process.exit(0);
});

console.log('Initializing client...');
client.initialize().catch(err => {
  console.error('Failed to initialize client:', err);
  process.exit(1);
});
