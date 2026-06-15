/**
 * Gajraj Kirana — Desktop Launcher
 * 
 * This script handles:
 * 1. Single-instance enforcement (file lock)
 * 2. Auto port detection (3000-3100)
 * 3. Starting the Next.js standalone server
 * 4. Opening the browser in --app mode (looks like native desktop app)
 * 5. Daily auto-backup of the database
 * 6. Graceful shutdown on exit
 */

const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const net = require('net');
const os = require('os');
const http = require('http');

/* ---------- Constants ---------- */
const APP_NAME = 'GajrajKirana';
const DEFAULT_PORT = 3000;
const PORT_RANGE_END = 3100;
const SERVER_READY_TIMEOUT = 30000; // 30 seconds max wait
const BACKUP_RETENTION_DAYS = 7;

/* ---------- Data Directory ---------- */
const LOCAL_APP_DATA = process.env.LOCALAPPDATA
  || path.join(os.homedir(), 'AppData', 'Local');
const DATA_DIR = path.join(LOCAL_APP_DATA, APP_NAME);
const LOCK_FILE = path.join(DATA_DIR, 'app.lock');
const LOG_FILE = path.join(DATA_DIR, 'logs', 'app.log');
const BACKUPS_DIR = path.join(DATA_DIR, 'backups');

// Ensure directories exist
fs.mkdirSync(path.join(DATA_DIR, 'logs'), { recursive: true });
fs.mkdirSync(BACKUPS_DIR, { recursive: true });

/* ---------- Logging ---------- */
function log(message) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${message}\n`;
  process.stdout.write(line);
  try {
    fs.appendFileSync(LOG_FILE, line);
  } catch (e) { /* ignore log write failures */ }
}

/* ---------- Single Instance Lock ---------- */
function checkSingleInstance() {
  if (fs.existsSync(LOCK_FILE)) {
    try {
      const lockData = JSON.parse(fs.readFileSync(LOCK_FILE, 'utf-8'));
      const { pid, port } = lockData;

      // Check if the process is actually running
      try {
        process.kill(pid, 0); // Signal 0 = just check if process exists
        log(`Another instance is already running (PID: ${pid}, Port: ${port}). Opening browser...`);
        openBrowser(port);
        process.exit(0);
      } catch (e) {
        // Process is not running — stale lock file, clean up
        log('Found stale lock file. Cleaning up...');
        fs.unlinkSync(LOCK_FILE);
      }
    } catch (e) {
      // Corrupted lock file, remove it
      fs.unlinkSync(LOCK_FILE);
    }
  }
}

function writeLockFile(port) {
  const lockData = { pid: process.pid, port, startedAt: new Date().toISOString() };
  fs.writeFileSync(LOCK_FILE, JSON.stringify(lockData, null, 2));
}

function removeLockFile() {
  try { fs.unlinkSync(LOCK_FILE); } catch (e) { /* ignore */ }
}

/* ---------- Port Detection ---------- */
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    server.listen(port, '127.0.0.1');
  });
}

async function findAvailablePort() {
  for (let port = DEFAULT_PORT; port <= PORT_RANGE_END; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available ports found in range ${DEFAULT_PORT}-${PORT_RANGE_END}`);
}

/* ---------- Server Health Check ---------- */
function waitForServer(port) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const check = () => {
      const req = http.get(`http://127.0.0.1:${port}/`, (res) => {
        if (res.statusCode >= 200 && res.statusCode < 500) {
          resolve();
        } else {
          retry();
        }
      });
      req.on('error', retry);
      req.setTimeout(2000, () => { req.destroy(); retry(); });
    };

    const retry = () => {
      if (Date.now() - startTime > SERVER_READY_TIMEOUT) {
        reject(new Error('Server did not start within timeout'));
        return;
      }
      setTimeout(check, 500);
    };

    check();
  });
}

/* ---------- Browser Launch (--app mode) ---------- */
function openBrowser(port) {
  const url = `http://127.0.0.1:${port}`;
  
  // Try Microsoft Edge first (pre-installed on Windows 10/11)
  const edgePaths = [
    path.join(process.env['PROGRAMFILES(X86)'] || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(process.env.PROGRAMFILES || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(LOCAL_APP_DATA, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
  ];

  // Try Google Chrome as fallback
  const chromePaths = [
    path.join(process.env['PROGRAMFILES(X86)'] || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(process.env.PROGRAMFILES || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(LOCAL_APP_DATA, 'Google', 'Chrome', 'Application', 'chrome.exe'),
  ];

  const allPaths = [...edgePaths, ...chromePaths];
  
  for (const browserPath of allPaths) {
    if (fs.existsSync(browserPath)) {
      log(`Opening in --app mode: ${browserPath}`);
      spawn(browserPath, [`--app=${url}`], {
        detached: true,
        stdio: 'ignore',
      }).unref();
      return;
    }
  }

  // Ultimate fallback: use system default browser (won't have --app mode)
  log('No Chromium browser found. Opening in default browser...');
  try {
    execSync(`start "" "${url}"`, { stdio: 'ignore', shell: true });
  } catch (e) {
    log(`Failed to open browser: ${e.message}`);
  }
}

/* ---------- Daily Auto-Backup ---------- */
function performDailyBackup() {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const backupFile = path.join(BACKUPS_DIR, `gajraj_store_${today}.db`);

  // Skip if today's backup already exists
  if (fs.existsSync(backupFile)) {
    log(`Today's backup already exists: ${backupFile}`);
    return;
  }

  const dbFile = path.join(DATA_DIR, 'gajraj_store.db');
  if (!fs.existsSync(dbFile)) {
    log('No database file found to backup.');
    return;
  }

  try {
    fs.copyFileSync(dbFile, backupFile);
    log(`Daily backup created: ${backupFile}`);

    // Clean old backups (keep last 7 days)
    cleanOldBackups();
  } catch (e) {
    log(`Backup failed: ${e.message}`);
  }
}

function cleanOldBackups() {
  try {
    const files = fs.readdirSync(BACKUPS_DIR);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - BACKUP_RETENTION_DAYS);

    for (const file of files) {
      if (!file.startsWith('gajraj_store_') || !file.endsWith('.db')) continue;
      
      // Extract date from filename: gajraj_store_2026-04-10.db
      const dateStr = file.replace('gajraj_store_', '').replace('.db', '');
      const fileDate = new Date(dateStr);
      
      if (fileDate < cutoffDate) {
        fs.unlinkSync(path.join(BACKUPS_DIR, file));
        log(`Deleted old backup: ${file}`);
      }
    }
  } catch (e) {
    log(`Backup cleanup error: ${e.message}`);
  }
}

/* ---------- Graceful Shutdown ---------- */
let serverProcess = null;

function shutdown(signal) {
  log(`Received ${signal}. Shutting down gracefully...`);
  removeLockFile();
  
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill('SIGTERM');
    
    // Force kill after 5 seconds if still running
    setTimeout(() => {
      if (serverProcess && !serverProcess.killed) {
        log('Force killing server process...');
        serverProcess.kill('SIGKILL');
      }
      process.exit(0);
    }, 5000);
  } else {
    process.exit(0);
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('exit', removeLockFile);

// Windows-specific: handle console close
if (process.platform === 'win32') {
  process.on('SIGHUP', () => shutdown('SIGHUP'));
}

/* ---------- Main ---------- */
async function main() {
  log('========================================');
  log('Gajraj Kirana Billing Software — Starting');
  log(`Data directory: ${DATA_DIR}`);
  log('========================================');

  // Step 1: Check single instance
  checkSingleInstance();

  // Step 2: Find available port
  let port;
  try {
    port = await findAvailablePort();
    log(`Selected port: ${port}`);
  } catch (e) {
    log(`FATAL: ${e.message}`);
    process.exit(1);
  }

  // Step 3: Write lock file
  writeLockFile(port);

  // Step 4: Daily backup
  performDailyBackup();

  // Step 5: Start the Next.js server
  const serverScript = path.join(__dirname, 'server.js');
  
  log(`Starting server: node ${serverScript}`);
  
  const env = {
    ...process.env,
    PORT: String(port),
    HOSTNAME: '127.0.0.1',
    NODE_ENV: 'production',
    DATA_DIR: DATA_DIR,
  };

  serverProcess = spawn(process.execPath, [serverScript], {
    cwd: __dirname,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  // Pipe server output to log
  serverProcess.stdout.on('data', (data) => {
    const msg = data.toString().trim();
    if (msg) log(`[SERVER] ${msg}`);
  });

  serverProcess.stderr.on('data', (data) => {
    const msg = data.toString().trim();
    if (msg) log(`[SERVER:ERR] ${msg}`);
  });

  serverProcess.on('exit', (code) => {
    log(`Server exited with code ${code}`);
    removeLockFile();
    process.exit(code || 0);
  });

  // Step 6: Wait for server to be ready
  try {
    log('Waiting for server to be ready...');
    await waitForServer(port);
    log('Server is ready!');
  } catch (e) {
    log(`FATAL: ${e.message}`);
    shutdown('TIMEOUT');
    return;
  }

  // Step 7: Open browser in --app mode
  openBrowser(port);
  
  log(`Gajraj Kirana is running at http://127.0.0.1:${port}`);
  log('Close this window or use system tray to stop the server.');
}

main().catch((err) => {
  log(`FATAL ERROR: ${err.message}`);
  removeLockFile();
  process.exit(1);
});
