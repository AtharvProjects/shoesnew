/**
 * Windows Build Fix: Patches Node.js glob to handle EPERM errors
 * on Windows junction points like 'Application Data'.
 * 
 * Usage: node packaging/win-build.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Monkey-patch fs.readdirSync to gracefully handle EPERM on Windows junction points
const originalReaddirSync = fs.readdirSync;
fs.readdirSync = function(dirPath, options) {
  try {
    return originalReaddirSync.call(this, dirPath, options);
  } catch (err) {
    if (err.code === 'EPERM' || err.code === 'EACCES') {
      // Windows junction point — return empty array
      return [];
    }
    throw err;
  }
};

const originalReaddir = fs.readdir;
fs.readdir = function(dirPath, optionsOrCallback, maybeCallback) {
  const callback = typeof optionsOrCallback === 'function' ? optionsOrCallback : maybeCallback;
  const options = typeof optionsOrCallback === 'function' ? undefined : optionsOrCallback;
  
  originalReaddir.call(this, dirPath, options, (err, files) => {
    if (err && (err.code === 'EPERM' || err.code === 'EACCES')) {
      callback(null, []);
      return;
    }
    callback(err, files);
  });
};

// Also patch fs.promises.readdir
const originalReaddirPromise = fs.promises.readdir;
fs.promises.readdir = async function(dirPath, options) {
  try {
    return await originalReaddirPromise.call(this, dirPath, options);
  } catch (err) {
    if (err.code === 'EPERM' || err.code === 'EACCES') {
      return [];
    }
    throw err;
  }
};

// Patch scandir (used by glob internally via graceful-fs)
const originalScandir = fs.scandir;
if (originalScandir) {
  fs.scandir = function(dirPath, options, callback) {
    try {
      return originalScandir.call(this, dirPath, options, (err, entries) => {
        if (err && (err.code === 'EPERM' || err.code === 'EACCES')) {
          callback(null, []);
          return;
        }
        callback(err, entries);
      });
    } catch (err) {
      if (err.code === 'EPERM' || err.code === 'EACCES') {
        callback(null, []);
        return;
      }
      throw err;
    }
  };
}

console.log('[win-build] Applied EPERM patch for Windows junction points');
console.log('[win-build] Starting Next.js build...\n');

// Now run the actual build
try {
  execSync('npx next build', {
    stdio: 'inherit',
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, NODE_ENV: 'production' },
  });
  console.log('\n[win-build] Build completed successfully!');
} catch (error) {
  console.error('\n[win-build] Build failed!');
  process.exit(1);
}
