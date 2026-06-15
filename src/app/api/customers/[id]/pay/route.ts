import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await req.json();
        const { amount } = body;

        if (!amount || amount <= 0) {
            return NextResponse.json({ error: 'Valid amount is required' }, { status: 400 });
        }

        // Wrap in a transaction to update balance safely
        const settlePayment = db.transaction(() => {
            // Get current balance
            const customer = db.prepare('SELECT balance FROM customers WHERE id = ?').get(id) as { balance: number } | undefined;

            if (!customer) {
                throw new Error('Customer not found');
            }

            // Update the balance by deducting the payment
            db.prepare(`
        UPDATE customers SET balance = balance - ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(amount, id);

            return db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
        });

        const updatedCustomer = settlePayment();
        return NextResponse.json(updatedCustomer);
    } catch (error) {
        console.error('Customer payment error:', error);
        return NextResponse.json({ error: 'Failed to process payment' }, { status: 500 });
    }
}
