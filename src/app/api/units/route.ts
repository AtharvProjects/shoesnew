import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
    const units = db.prepare('SELECT * FROM units ORDER BY name ASC').all();
    return NextResponse.json(units);
}

export async function POST(req: NextRequest) {
    try {
        const { name } = await req.json();
        if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 });
        db.prepare('INSERT INTO units (name) VALUES (?)').run(name);
        return NextResponse.json({ success: true }, { status: 201 });
    } catch (error) {
        console.error('Units POST error:', error);
        return NextResponse.json({ error: 'Failed to create unit' }, { status: 500 });
    }
}
