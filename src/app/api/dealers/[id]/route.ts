import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const dealer = db.prepare('SELECT * FROM dealers WHERE id = ?').get(id);
    if (!dealer) {
      return NextResponse.json({ error: 'Dealer not found' }, { status: 404 });
    }
    return NextResponse.json(dealer);
  } catch (error) {
    console.error('Failed to fetch dealer:', error);
    return NextResponse.json({ error: 'Failed to fetch dealer' }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { name, phone, address, gstin } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const stmt = db.prepare(`
      UPDATE dealers 
      SET name = ?, phone = ?, address = ?, gstin = ?, updated_at = datetime('now')
      WHERE id = ?
    `);
    
    const info = stmt.run(name, phone || '', address || '', gstin || '', id);
    
    if (info.changes === 0) {
      return NextResponse.json({ error: 'Dealer not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Failed to update dealer:', error);
    return NextResponse.json({ error: error.message || 'Failed to update dealer' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    
    // Deleting dealer will cascade and delete all their transactions 
    // due to ON DELETE CASCADE on dealer_transactions table
    const info = db.prepare('DELETE FROM dealers WHERE id = ?').run(id);
    
    if (info.changes === 0) {
      return NextResponse.json({ error: 'Dealer not found' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Failed to delete dealer:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete dealer' }, { status: 500 });
  }
}
