/**
 * Gajraj Kirana — Build Pipeline
 * 
 * Creates a complete distributable folder structure:
 * 
 * dist/GajrajKirana/
 * ├── node.exe          (portable Node.js)
 * ├── launcher.js       (app entry point)
 * ├── GajrajKirana.vbs  (silent launcher — no console)
 * ├── splash.html       (loading screen)
 * ├── server.js         (Next.js standalone server)
 * ├── .next/            (standalone build)
 * ├── public/           (static assets)
 * └── node_modules/     (production only — from standalone)
 * 
 * Usage: node packaging/build.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist', 'GajrajKirana');
const STANDALONE = path.join(ROOT, '.next', 'standalone');
const PACKAGING = __dirname;

/* ---------- Helpers ---------- */
function step(num, msg) {
  console.log(`\n==> Step ${num}: ${msg}`);
}

function clean(dir) {
  if (fs.existsSync(dir)) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch (e) {
      console.log('Failed to fully clean directory, continuing anyway...', e.message);
    }
  }
  fs.mkdirSync(dir, { recursive: true });
}

function copyDir(src, dest, filter) {
  fs.cpSync(src, dest, { 
    recursive: true, 
    force: true,
    filter: filter || (() => true),
  });
}

/* ---------- Build Steps ---------- */

step(1, 'Cleaning dist folder...');
clean(DIST);

step(2, 'Building Next.js (standalone mode)...');
try {
  const fsPatch = path.join(PACKAGING, 'fs-patch.js').replace(/\\/g, '/');
  const nodeOptions = `--max-old-space-size=4096 --require ${fsPatch}`;
  const nextBin = path.join(ROOT, 'node_modules', 'next', 'dist', 'bin', 'next');
  execSync(`"${process.execPath}" "${nextBin}" build`, { 
    stdio: 'inherit', 
    cwd: ROOT,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      NODE_OPTIONS: nodeOptions,
    },
  });
} catch (error) {
  console.error('\n❌ Build failed! Fix the errors above and try again.');
  process.exit(1);
}

// Verify standalone output was created
if (!fs.existsSync(STANDALONE)) {
  console.error('\n❌ Standalone output not found!');
  console.error('Make sure next.config.ts has: output: "standalone"');
  process.exit(1);
}

step(3, 'Copying standalone build output...');

// The standalone output may be in a subfolder matching the project directory name
// Check for both locations
const possibleStandalonePaths = [
  STANDALONE,
  // Sometimes Next.js nests it under the project folder name
  ...fs.readdirSync(STANDALONE)
    .filter(f => fs.statSync(path.join(STANDALONE, f)).isDirectory() && f !== 'node_modules' && f !== '.next')
    .map(f => path.join(STANDALONE, f)),
];

// Copy the standalone server.js and node_modules
const standaloneServerJs = fs.existsSync(path.join(STANDALONE, 'server.js'))
  ? STANDALONE
  : possibleStandalonePaths.find(p => fs.existsSync(path.join(p, 'server.js')));

if (!standaloneServerJs) {
  console.error('❌ Cannot find server.js in standalone output!');
  console.error('Searched:', possibleStandalonePaths);
  process.exit(1);
}

console.log(`  Found standalone at: ${standaloneServerJs}`);

// Copy everything from standalone to dist (excluding DB files)
const filterFunc = (src) => {
  if (src.includes('gajraj_store.db')) return false;
  if (src.includes('.db-wal')) return false;
  if (src.includes('.db-shm')) return false;
  return true;
};

copyDir(standaloneServerJs, DIST, filterFunc);

step(3.5, 'Copying native node modules (Workaround Next.js tracer bug)...');
const modulesToCopy = ['better-sqlite3', 'bindings', 'file-uri-to-path'];
modulesToCopy.forEach(mod => {
  const modSrc = path.join(ROOT, 'node_modules', mod);
  const modDest = path.join(DIST, 'node_modules', mod);
  if (fs.existsSync(modSrc)) {
    copyDir(modSrc, modDest);
    console.log(`  ✓ Copied native module: ${mod}`);
  } else {
    console.warn(`  ⚠ Missing native module: ${mod}`);
  }
});

step(4, 'Copying static assets...');

// Copy .next/static (CSS, JS chunks)
const staticSrc = path.join(ROOT, '.next', 'static');
const staticDest = path.join(DIST, '.next', 'static');
if (fs.existsSync(staticSrc)) {
  copyDir(staticSrc, staticDest);
  console.log('  ✓ .next/static copied');
} else {
  console.warn('  ⚠ .next/static not found — CSS/JS may not load');
}

// Copy .next/server (Workaround for Next.js dropping dynamic chunks like nodemailer)
const serverSrc = path.join(ROOT, '.next', 'server');
const serverDest = path.join(DIST, '.next', 'server');
if (fs.existsSync(serverSrc)) {
  copyDir(serverSrc, serverDest);
  console.log('  ✓ .next/server missing chunks copied');
}

// Copy public folder
const publicSrc = path.join(ROOT, 'public');
const publicDest = path.join(DIST, 'public');
if (fs.existsSync(publicSrc)) {
  copyDir(publicSrc, publicDest);
  console.log('  ✓ public/ copied');
}

step(5, 'Copying launcher files...');

// Copy launcher.js
fs.copyFileSync(
  path.join(PACKAGING, 'launcher.js'),
  path.join(DIST, 'launcher.js')
);
console.log('  ✓ launcher.js');

// Copy GajrajKirana.vbs (silent launcher)
fs.copyFileSync(
  path.join(PACKAGING, 'GajrajKirana.vbs'),
  path.join(DIST, 'GajrajKirana.vbs')
);
console.log('  ✓ GajrajKirana.vbs');

// Copy splash.html
fs.copyFileSync(
  path.join(PACKAGING, 'splash.html'),
  path.join(DIST, 'splash.html')
);
console.log('  ✓ splash.html');

step(6, 'Setting up Node.js runtime...');

// Check if node.exe exists in packaging folder
const nodeExeSrc = path.join(PACKAGING, 'node.exe');
const nodeExeDest = path.join(DIST, 'node.exe');

if (fs.existsSync(nodeExeSrc)) {
  fs.copyFileSync(nodeExeSrc, nodeExeDest);
  console.log('  ✓ node.exe copied from packaging/');
} else {
  // Use the currently running node.exe
  const currentNodeExe = process.execPath;
  fs.copyFileSync(currentNodeExe, nodeExeDest);
  console.log(`  ✓ node.exe copied from current runtime: ${currentNodeExe}`);
  console.log(`    Node.js version: ${process.version}`);
}

step(7, 'Creating package metadata...');

// Create a minimal package.json for the dist
const pkgInfo = {
  name: 'gajraj-kirana-billing',
  version: '1.0.0',
  description: 'Gajraj Kirana Billing Software',
  private: true,
};
fs.writeFileSync(
  path.join(DIST, 'package.json'),
  JSON.stringify(pkgInfo, null, 2)
);
console.log('  ✓ package.json created');

step(8, 'Calculating distribution size...');

function getDirSize(dirPath) {
  let size = 0;
  const items = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const item of items) {
    const fullPath = path.join(dirPath, item.name);
    if (item.isDirectory()) {
      size += getDirSize(fullPath);
    } else {
      size += fs.statSync(fullPath).size;
    }
  }
  return size;
}

const totalSize = getDirSize(DIST);
const sizeMB = (totalSize / (1024 * 1024)).toFixed(1);

console.log('\n========================================');
console.log('✅ BUILD COMPLETE!');
console.log('========================================');
console.log(`📁 Output:    ${DIST}`);
console.log(`📦 Size:      ${sizeMB} MB`);
console.log(`🟢 Node.js:   ${process.version}`);
console.log('');
console.log('Next steps:');
console.log('  1. Test: cd dist/GajrajKirana && node launcher.js');
console.log('  2. Build installer: Compile packaging/installer.iss with Inno Setup');
console.log('========================================');
