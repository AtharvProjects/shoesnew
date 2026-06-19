import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);

export async function POST(req: Request) {
  try {
    // Run npm install to update whatsapp-web.js and puppeteer to their latest versions
    // We add --no-fund and --no-audit to speed it up slightly and reduce noise
    const { stdout, stderr } = await execPromise('npm install whatsapp-web.js@latest puppeteer@latest --no-fund --no-audit');
    
    return NextResponse.json({ 
      success: true, 
      message: 'WhatsApp engine updated successfully',
      details: stdout || stderr
    });
  } catch (error: any) {
    console.error('Failed to update WhatsApp engine:', error);
    return NextResponse.json({ 
      error: 'Failed to update WhatsApp engine', 
      details: error.message || String(error)
    }, { status: 500 });
  }
}
