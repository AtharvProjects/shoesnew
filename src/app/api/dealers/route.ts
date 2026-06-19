import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET() {
  try {
    const dealers = db.prepare('SELECT * FROM dealers ORDER BY name ASC').all();
    return NextResponse.json(dealers);
  } catch (error) {
    console.error('Failed to fetch dealers:', error);
    return NextResponse.json({ error: 'Failed to fetch dealers' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, phone, address, gstin, opening_balance = 0 } = body;

    if (!name) {
      return NextResponse.json({ error: 'Dealer name is required' }, { status: 400 });
    }

    const stmt = db.prepare(`
      INSERT INTO dealers (name, phone, address, gstin, balance)
      VALUES (?, ?, ?, ?, ?)
    `);

    let dealerId;
    
    // We use a transaction so we can also create an opening balance transaction if needed
    const tx = db.transaction(() => {
      const info = stmt.run(name, phone || '', address || '', gstin || '', opening_balance);
      dealerId = info.lastInsertRowid;
      
      if (opening_balance !== 0) {
        db.prepare(`
          INSERT INTO dealer_transactions (dealer_id, type, amount, balance_after, notes)
          VALUES (?, ?, ?, ?, ?)
        `).run(
          dealerId, 
          'opening_balance', 
          opening_balance, 
          opening_balance, 
          'Opening Balance'
        );
      }
    });
    
    tx();

    return NextResponse.json({ success: true, id: dealerId });
  } catch (error: any) {
    console.error('Failed to create dealer:', error);
    return NextResponse.json({ error: error.message || 'Failed to create dealer' }, { status: 500 });
  }
}
