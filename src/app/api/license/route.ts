import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { isValidLicenseKey, getMachineId } from '@/lib/license';

export const dynamic = 'force-dynamic';

import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    // 1. Check if the installer left a .license file
    const licenseFilePath = path.join(process.cwd(), 'data', '.license');
    if (fs.existsSync(licenseFilePath)) {
      const fileKey = fs.readFileSync(licenseFilePath, 'utf8').trim();
      if (isValidLicenseKey(fileKey)) {
        // Import into DB
        db.prepare(`
          INSERT INTO settings (key, value) VALUES ('license_key', ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value
        `).run(fileKey);
        
        // Remove the file so we don't keep importing it unnecessarily
        try { fs.unlinkSync(licenseFilePath); } catch (e) {}
      }
    }

    // 2. Read from DB as usual
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('license_key') as { value: string } | undefined;
    
    if (row && row.value && isValidLicenseKey(row.value)) {
      return NextResponse.json({ valid: true, key: row.value, machineId: getMachineId() });
    }
    
    return NextResponse.json({ valid: false, machineId: getMachineId() });
  } catch (error) {
    console.error('License GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch license' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { key } = await req.json();
    
    if (!key || typeof key !== 'string') {
      return NextResponse.json({ error: 'Invalid key format' }, { status: 400 });
    }
    
    if (!isValidLicenseKey(key)) {
      return NextResponse.json({ error: 'Invalid license key' }, { status: 400 });
    }
    
    // Save to database
    db.prepare(`
      INSERT INTO settings (key, value) VALUES ('license_key', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(key);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('License POST error:', error);
    return NextResponse.json({ error: 'Failed to update license' }, { status: 500 });
  }
}
