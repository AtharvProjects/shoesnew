/**
 * fs-patch.js — Preloaded via NODE_OPTIONS="--require ./packaging/fs-patch.js"
 * 
 * Patches Node.js fs module to handle EPERM errors on Windows junction points.
 * These are legacy symlinks in user profile directories that Windows denies
 * read access to (Everyone:(DENY)(RD)).
 */

const fs = require('fs');
const path = require('path');

function isWindowsJunctionError(err, p) {
  if (!err || (err.code !== 'EPERM' && err.code !== 'EACCES')) return false;
  if (typeof p !== 'string') return false;
  // Only suppress for paths inside AppData or user profile directories
  const normalized = p.replace(/\\/g, '/').toLowerCase();
  return normalized.includes('/appdata/') || normalized.includes('/users/');
}

// Patch fs.readdirSync
const origReaddirSync = fs.readdirSync;
fs.readdirSync = function patchedReaddirSync(p, options) {
  try {
    return origReaddirSync.call(this, p, options);
  } catch (err) {
    if (isWindowsJunctionError(err, p)) {
      return [];
    }
    throw err;
  }
};

// Patch fs.readdir (callback)
const origReaddir = fs.readdir;
fs.readdir = function patchedReaddir(p, optionsOrCb, maybeCb) {
  const cb = typeof optionsOrCb === 'function' ? optionsOrCb : maybeCb;
  const opts = typeof optionsOrCb === 'function' ? undefined : optionsOrCb;
  origReaddir.call(this, p, opts, (err, files) => {
    if (isWindowsJunctionError(err, p)) {
      return cb(null, []);
    }
    cb(err, files);
  });
};

// Patch fs.promises.readdir
const origPromiseReaddir = fs.promises.readdir;
fs.promises.readdir = async function patchedPromiseReaddir(p, options) {
  try {
    return await origPromiseReaddir.call(this, p, options);
  } catch (err) {
    if (isWindowsJunctionError(err, p)) {
      return [];
    }
    throw err;
  }
};

