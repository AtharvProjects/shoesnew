import { Client, LocalAuth } from 'whatsapp-web.js';
import QRCode from 'qrcode';

export type WhatsAppStatus = 'disconnected' | 'initializing' | 'qr_ready' | 'authenticating' | 'syncing' | 'connected' | 'error';

interface WhatsAppGlobal {
  client: Client | null;
  status: WhatsAppStatus;
  qrCodeDataUrl: string | null;
  errorMessage: string | null;
}

declare global {
  var __whatsapp: WhatsAppGlobal | undefined;
}

const globalWhatsapp = global.__whatsapp || {
  client: null,
  status: 'disconnected',
  qrCodeDataUrl: null,
  errorMessage: null,
};

global.__whatsapp = globalWhatsapp;

const getAuthPath = () => {
  const os = require('os');
  const path = require('path');
  const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
  const dataDir = process.env.DATA_DIR || path.join(localAppData, 'GajrajKirana');
  return path.join(dataDir, '.wwebjs_auth');
};

const clearAuthSession = () => {
  try {
    const fs = require('fs');
    const authPath = getAuthPath();
    if (fs.existsSync(authPath)) {
      fs.rmSync(authPath, { recursive: true, force: true });
      console.log('Cleared WhatsApp auth cache successfully.');
    }
  } catch (err) {
    console.error('Error clearing auth folder:', err);
  }
};

export const getWhatsAppStatus = () => {
  return {
    status: globalWhatsapp.status,
    qr: globalWhatsapp.qrCodeDataUrl,
    error: globalWhatsapp.errorMessage,
  };
};

export const resetWhatsApp = async () => {
  console.log('Force Resetting WhatsApp Integration...');
  globalWhatsapp.status = 'disconnected';
  globalWhatsapp.qrCodeDataUrl = null;
  globalWhatsapp.errorMessage = null;

  if (globalWhatsapp.client) {
    try {
      await globalWhatsapp.client.destroy();
    } catch (err) {
      console.error('Error destroying client during reset', err);
    }
    globalWhatsapp.client = null;
  }
  
  clearAuthSession();
};

export const initWhatsApp = async () => {
  if (globalWhatsapp.client) {
    // If it's in error state but client exists, let's reset it first
    if (globalWhatsapp.status === 'error') {
      await resetWhatsApp();
    } else {
      return;
    }
  }

  globalWhatsapp.status = 'initializing';
  globalWhatsapp.qrCodeDataUrl = null;
  globalWhatsapp.errorMessage = null;

  try {
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
        break;
      }
    }

    const client = new Client({
      authTimeoutMs: 600000, // 10 minutes for large histories
      authStrategy: new LocalAuth({
        dataPath: getAuthPath()
      }),
      puppeteer: {
        headless: true,
        args: [
          '--no-sandbox', 
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-extensions'
        ],
        ...(executablePath ? { executablePath } : {})
      }
    });

    globalWhatsapp.client = client;

    client.on('qr', async (qr) => {
      console.log('WhatsApp QR Code received');
      globalWhatsapp.status = 'qr_ready';
      try {
        globalWhatsapp.qrCodeDataUrl = await QRCode.toDataURL(qr);
      } catch (err) {
        console.error('Error generating QR Code', err);
      }
    });

    client.on('authenticated', () => {
      console.log('WhatsApp Authenticated (waiting for sync to complete...)');
      // The session is valid, now it will download history
      globalWhatsapp.status = 'syncing';
      globalWhatsapp.qrCodeDataUrl = null;

      // Fallback polling removed to ensure we wait for the 'ready' event properly,
      // as relying on getState() being 'CONNECTED' does not guarantee WWebJS is fully injected,
      // which causes 'Cannot read properties of undefined' during sendMessage.
    });

    client.on('ready', () => {
      console.log('WhatsApp Client is fully ready and synced!');
      globalWhatsapp.status = 'connected';
      globalWhatsapp.qrCodeDataUrl = null;
      globalWhatsapp.errorMessage = null;
    });

    client.on('auth_failure', (msg) => {
      console.error('WhatsApp Authentication failure', msg);
      globalWhatsapp.status = 'error';
      globalWhatsapp.errorMessage = 'Authentication failed. Please reset and scan again.';
      globalWhatsapp.qrCodeDataUrl = null;
      clearAuthSession();
    });

    client.on('disconnected', (reason) => {
      console.log('WhatsApp Client was disconnected', reason);
      globalWhatsapp.status = 'disconnected';
      globalWhatsapp.client = null;
      globalWhatsapp.qrCodeDataUrl = null;
      
      // If the user actively logged out from their phone:
      if (reason === 'NAVIGATION') {
          clearAuthSession();
      }
    });

    // Initialize without blocking the API
    client.initialize().catch(err => {
      console.error('Failed to initialize WhatsApp client:', err);
      globalWhatsapp.status = 'error';
      globalWhatsapp.errorMessage = err?.message || 'Failed to initialize browser.';
      globalWhatsapp.client = null;
      clearAuthSession();
    });
  } catch (error: any) {
    console.error('Error setting up WhatsApp client:', error);
    globalWhatsapp.status = 'error';
    globalWhatsapp.errorMessage = error?.message || 'Unknown error occurred.';
    globalWhatsapp.client = null;
    clearAuthSession();
  }
};

export const logoutWhatsApp = async () => {
  if (globalWhatsapp.client) {
    try {
      await globalWhatsapp.client.logout();
    } catch (err) {
      console.error('Error logging out', err);
    }
    try {
      await globalWhatsapp.client.destroy();
    } catch (err) {
      console.error('Error destroying client', err);
    }
    globalWhatsapp.client = null;
  }
  globalWhatsapp.status = 'disconnected';
  globalWhatsapp.qrCodeDataUrl = null;

  clearAuthSession();
};

export const sendWhatsAppMessage = async (phone: string, message: string, mediaBase64?: string, fileName?: string) => {
  if (globalWhatsapp.status !== 'connected' || !globalWhatsapp.client) {
    throw new Error('WhatsApp is not connected or still syncing');
  }

  // Format phone number to WhatsApp format
  let formattedPhone = phone.replace(/\D/g, '');
  if (formattedPhone.length === 10) {
    formattedPhone = `91${formattedPhone}`; // Default to India if only 10 digits
  }
  
  const chatId = `${formattedPhone}@c.us`;
  
  try {
    const isRegistered = await globalWhatsapp.client.isRegisteredUser(chatId);
    if (!isRegistered) {
      throw new Error('This phone number is not registered on WhatsApp.');
    }

    if (mediaBase64 && fileName) {
      const { MessageMedia } = require('whatsapp-web.js');
      const media = new MessageMedia('application/pdf', mediaBase64, fileName);
      await globalWhatsapp.client.sendMessage(chatId, media, { 
        caption: message,
        linkPreview: false 
      });
    } else {
      await globalWhatsapp.client.sendMessage(chatId, message, {
        linkPreview: false
      });
    }
    return true;
  } catch (error: any) {
    console.error('Error sending WhatsApp message:', error);
    
    // Auto-recover if the underlying Puppeteer browser crashed
    if (error && error.message && (
      error.message.includes('detached Frame') || 
      error.message.includes('Target closed') ||
      error.message.includes('Execution context was destroyed') ||
      error.message.includes('Protocol error') ||
      error.message.includes('Session closed')
    )) {
      console.log('Detected a crashed WhatsApp browser frame. Triggering auto-recovery...');
      try {
        await globalWhatsapp.client?.destroy();
      } catch (destroyErr) {
        console.error('Error destroying crashed client:', destroyErr);
      }
      globalWhatsapp.client = null;
      globalWhatsapp.status = 'disconnected';
      
      // Kick off initialization in the background (auth session is NOT cleared, so it will auto-login)
      initWhatsApp().catch(e => console.error('Auto-recovery init failed:', e));
      
      throw new Error('WhatsApp connection was lost and is restarting in the background. Please try sending again in 10 seconds.');
    }
    
    throw error;
  }
};
