import { NextResponse } from 'next/server';
import db from '@/lib/db';

function recalculateLedger(dealerId: string) {
  // Fetch all transactions ordered by time
  const transactions = db.prepare(`
    SELECT * FROM dealer_transactions 
    WHERE dealer_id = ? 
    ORDER BY datetime(created_at) ASC, id ASC
  `).all(dealerId);

  let currentBalance = 0;
  const updateTx = db.prepare('UPDATE dealer_transactions SET balance_after = ? WHERE id = ?');

  for (const tx of transactions) {
    let change = 0;
    switch (tx.type) {
      case 'purchase':
      case 'payment_received':
      case 'opening_balance':
        change = tx.amount;
        break;
      case 'payment_given':
      case 'purchase_return':
        change = -tx.amount;
        break;
    }
    
    currentBalance += change;
    updateTx.run(currentBalance, tx.id);
  }

  // Update dealer's master balance
  db.prepare("UPDATE dealers SET balance = ?, updated_at = datetime('now') WHERE id = ?").run(currentBalance, dealerId);
  return currentBalance;
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string, txId: string }> }) {
  try {
    const { id, txId } = await params;
    const body = await req.json();
    const { amount, date, reference, notes } = body;

    const numAmount = Number(amount);
    if (isNaN(numAmount)) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    let newBalance = 0;

    const dbTx = db.transaction(() => {
      // 1. Update the specific transaction
      // We don't allow changing 'type' for simplicity
      const info = db.prepare(`
        UPDATE dealer_transactions 
        SET amount = ?, date = ?, reference = ?, notes = ?
        WHERE id = ? AND dealer_id = ?
      `).run(numAmount, date, reference || '', notes || '', txId, id);

      if (info.changes === 0) {
        throw new Error('Transaction not found');
      }

      // 2. Recalculate ledger
      newBalance = recalculateLedger(id);
    });

    dbTx();

    return NextResponse.json({ success: true, newBalance });
  } catch (error: any) {
    console.error('Failed to update transaction:', error);
    return NextResponse.json({ error: error.message || 'Failed to update transaction' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string, txId: string }> }) {
  try {
    const { id, txId } = await params;
    
    let newBalance = 0;

    const dbTx = db.transaction(() => {
      // 1. Delete transaction
      const info = db.prepare('DELETE FROM dealer_transactions WHERE id = ? AND dealer_id = ?').run(txId, id);
      
      if (info.changes === 0) {
        throw new Error('Transaction not found');
      }

      // 2. Recalculate ledger
      newBalance = recalculateLedger(id);
    });

    dbTx();

    return NextResponse.json({ success: true, newBalance });
  } catch (error: any) {
    console.error('Failed to delete transaction:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete transaction' }, { status: 500 });
  }
}
