const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('==> Step 1: Compiling freshest Next.js code...');
try {
    execSync('npm run build', { stdio: 'inherit', cwd: process.cwd() });
} catch (error) {
    console.error('Build failed. Aborting update.');
    process.exit(1);
}

const sourceFolder = path.join(process.cwd(), '.next', 'standalone', 'Gajraj_Kirana');
const targetFolder = path.join(process.cwd(), 'Gajraj_Release');

console.log('==> Step 2: Safely copying new code (ignoring Database)...');

// Filter function to ensure we absolutely never copy or overwrite a DB file
const filterFunc = (src, dest) => {
    if (src.includes('gajraj_store.db')) return false;
    return true;
};

// Copy backend and node_modules
fs.cpSync(sourceFolder, targetFolder, {
    recursive: true,
    force: true,
    filter: filterFunc
});

// Copy frontend static assets
fs.cpSync(
    path.join(process.cwd(), 'public'),
    path.join(targetFolder, 'public'),
    { recursive: true, force: true }
);

fs.cpSync(
    path.join(process.cwd(), '.next', 'static'),
    path.join(targetFolder, '.next', 'static'),
    { recursive: true, force: true }
);

console.log('==> Update Complete! The Gajraj_Release folder is now up to date.');
