# Gajraj Kirana — Packaging Guide

## Overview

This directory contains everything needed to package the billing software as a Windows desktop application.

## Prerequisites

1. **Node.js v20 LTS** installed on the build machine
2. **Inno Setup 6** installed → [Download](https://jrsoftware.org/isinfo.php)

## Build Steps

### Step 1: Build the distribution folder

```bash
# From the project root
node packaging/build.js
```

This creates `dist/GajrajKirana/` with everything needed to run the app.

### Step 2: Test locally

```bash
cd dist/GajrajKirana
node launcher.js
```

- The app should start on port 3000 (or next available)
- Your browser should open with the billing dashboard
- Check `%LOCALAPPDATA%\GajrajKirana\` for database and logs

### Step 3: Build the installer

1. Open `packaging/installer.iss` in Inno Setup Compiler
2. Click **Build → Compile** (or press Ctrl+F9)
3. The installer is generated at `dist/GajrajKirana_Setup_v1.0.0.exe`

### Step 4: Test the installer

1. Run the installer on a clean machine (or VM) **without Node.js installed**
2. Verify:
   - App installs to `C:\Program Files\Gajraj Kirana Billing\`
   - Desktop shortcut works
   - Start Menu shortcut works
   - Data is stored in `%LOCALAPPDATA%\GajrajKirana\`
   - App survives a reinstall (data preserved)
   - Uninstall prompts to keep/delete data

## Architecture

```
User double-clicks shortcut
        ↓
  GajrajKirana.vbs          (hides console window)
        ↓
  node.exe launcher.js      (port detection, instance check)
        ↓
  node.exe server.js        (Next.js standalone server)
        ↓
  msedge.exe --app=URL      (opens in native-looking window)
```

## Files

| File | Purpose |
|------|---------|
| `launcher.js` | Main entry — port detection, server lifecycle, auto-backup |
| `GajrajKirana.vbs` | Windows script to launch without console window |
| `splash.html` | Loading screen while server starts |
| `build.js` | Automated build pipeline |
| `installer.iss` | Inno Setup installer configuration |
| `README.md` | This file |

## Data Locations

| What | Where |
|------|-------|
| Application | `C:\Program Files\Gajraj Kirana Billing\` |
| Database | `%LOCALAPPDATA%\GajrajKirana\gajraj_store.db` |
| Auto-backups | `%LOCALAPPDATA%\GajrajKirana\backups\` |
| Logs | `%LOCALAPPDATA%\GajrajKirana\logs\app.log` |
| Lock file | `%LOCALAPPDATA%\GajrajKirana\app.lock` |

## Troubleshooting

### App won't start
1. Check `%LOCALAPPDATA%\GajrajKirana\logs\app.log` for errors
2. Make sure port 3000 isn't blocked by another app
3. Check if antivirus is blocking `node.exe`

### "Another instance is running"
1. Check system tray for existing instance
2. If stuck: delete `%LOCALAPPDATA%\GajrajKirana\app.lock`
3. Kill any orphaned node.exe: `taskkill /F /IM node.exe`

### Database issues
1. Backups are in `%LOCALAPPDATA%\GajrajKirana\backups\`
2. Copy a backup file over `gajraj_store.db` to restore
