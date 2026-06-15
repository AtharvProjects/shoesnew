import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import db, { DATA_DIR } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const dbPath = path.join(DATA_DIR, 'gajraj_store.db');
    
    if (!fs.existsSync(dbPath)) {
      return NextResponse.json({ error: 'Database file not found' }, { status: 404 });
    }

    // Checkpoint WAL to ensure backup contains all data
    try { db.pragma('wal_checkpoint(TRUNCATE)'); } catch(e) {}

    const fileBuffer = fs.readFileSync(dbPath);
    
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/x-sqlite3',
        'Content-Disposition': `attachment; filename="gajraj_backup_${new Date().toISOString().split('T')[0]}.sqlite"`,
      },
    });
  } catch (error) {
    console.error('Backup error:', error);
    return NextResponse.json({ error: 'Failed to generate backup' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('backup') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    
    // Header verification
    const header = buffer.slice(0, 15).toString();
    if (!header.includes('SQLite format 3')) {
       return NextResponse.json({ error: 'Invalid SQLite file' }, { status: 400 });
    }

    const dbPath = path.join(DATA_DIR, 'gajraj_store.db');

    // Attempt to close DB connection momentarily if your environment supports it
    try { db.close(); } catch(e) {}

    fs.writeFileSync(dbPath, buffer);

    return NextResponse.json({ message: 'Database restored successfully! Please restart/refresh the application.' });
  } catch (error: any) {
    console.error('Restore error:', error);
    if (error.code === 'EBUSY' || error.code === 'EPERM') {
       return NextResponse.json({ error: 'Database is currently in use. Please close all other tabs or restart the server to restore.' }, { status: 500 });
    }
    return NextResponse.json({ error: 'Failed to restore database: ' + error.message }, { status: 500 });
  }
}

