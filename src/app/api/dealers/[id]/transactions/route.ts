import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    
    // Check if dealer exists
    const dealer = db.prepare('SELECT id FROM dealers WHERE id = ?').get(id);
    if (!dealer) {
      return NextResponse.json({ error: 'Dealer not found' }, { status: 404 });
    }

    const transactions = db.prepare(`
      SELECT * FROM dealer_transactions 
      WHERE dealer_id = ? 
      ORDER BY datetime(created_at) ASC, id ASC
    `).all(id);
    
    return NextResponse.json(transactions);
  } catch (error) {
    console.error('Failed to fetch transactions:', error);
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { type, amount, date, reference, notes } = body;

    const numAmount = Number(amount);
    if (!type || isNaN(numAmount) || numAmount <= 0) {
      return NextResponse.json({ error: 'Invalid type or amount' }, { status: 400 });
    }

    let success = false;
    let newBalance = 0;

    const tx = db.transaction(() => {
      // 1. Get current balance
      const dealer = db.prepare('SELECT balance FROM dealers WHERE id = ?').get(id) as { balance: number };
      if (!dealer) {
        throw new Error('Dealer not found');
      }

      // 2. Calculate new balance
      // Positive balance means we owe them (Payable)
      // Negative balance means they owe us (Receivable)
      let change = 0;
      switch (type) {
        case 'purchase':
        case 'payment_received': // if they refund us, our payable increases
          change = numAmount;
          break;
        case 'payment_given':
        case 'purchase_return':
          change = -numAmount;
          break;
        default:
          throw new Error('Invalid transaction type');
      }

      newBalance = dealer.balance + change;

      // 3. Insert transaction
      db.prepare(`
        INSERT INTO dealer_transactions (dealer_id, type, amount, balance_after, date, reference, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, 
        type, 
        numAmount, 
        newBalance, 
        date || new Date().toISOString(), 
        reference || '', 
        notes || ''
      );

      // 4. Update dealer balance
      db.prepare("UPDATE dealers SET balance = ?, updated_at = datetime('now') WHERE id = ?").run(newBalance, id);
      success = true;
    });

    tx();

    return NextResponse.json({ success, newBalance });
  } catch (error: any) {
    console.error('Failed to add transaction:', error);
    return NextResponse.json({ error: error.message || 'Failed to add transaction' }, { status: 500 });
  }
}
