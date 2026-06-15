/**
 * /api/categories — GET list, POST create
 */

import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const categories = db.prepare('SELECT * FROM categories ORDER BY name ASC').all();
  return NextResponse.json(categories);
}

export async function POST(req: NextRequest) {
  try {
    const { name } = await req.json();
    if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 });
    db.prepare('INSERT INTO categories (name) VALUES (?)').run(name);
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error('Categories POST error:', error);
    return NextResponse.json({ error: 'Failed to create category' }, { status: 500 });
  }
}
