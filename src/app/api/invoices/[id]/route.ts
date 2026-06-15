/**
 * /api/invoices/[id] — GET single invoice with items, DELETE invoice
 */

import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(id) as any;
  if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?').all(id);

  const setting = db.prepare('SELECT value FROM settings WHERE key = ?').get('store_name') as any;
  if (setting) {
    invoice.store_name = setting.value;
  }

  return NextResponse.json({ invoice, items });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Use a transaction to safely reverse the invoice's impacts
  const deleteInvoice = db.transaction((invoiceId: string) => {
    // 1. Get the invoice to know customer and totals
    const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceId) as any;
    if (!invoice) return;

    // 2. Get all items to restore stock
    const items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?').all(invoiceId) as any[];

    // 3. Restore product quantities
    const updateProductStock = db.prepare('UPDATE products SET quantity = quantity + ? WHERE id = ?');
    for (const item of items) {
      if (item.product_id) {
        updateProductStock.run(item.quantity, item.product_id);
      }
    }

    // 4. Reverse customer balance update
    // If there was a balance due added to the customer, subtract it back.
    if (invoice.customer_id) {
      const balanceDue = invoice.total_amount - (invoice.amount_paid || 0);
      if (balanceDue !== 0) {
        db.prepare('UPDATE customers SET balance = COALESCE(balance, 0) - ? WHERE id = ?').run(balanceDue, invoice.customer_id);
      }
    }

    // 5. Delete the invoice_items and the invoice itself
    db.prepare('DELETE FROM invoice_items WHERE invoice_id = ?').run(invoiceId);
    db.prepare('DELETE FROM invoices WHERE id = ?').run(invoiceId);
  });

  try {
    deleteInvoice(id);
    return NextResponse.json({ success: true, message: 'Invoice reversed and deleted.' });
  } catch (error) {
    console.error('Failed to delete invoice:', error);
    return NextResponse.json({ error: 'Failed to delete invoice and reverse stock.' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const {
      customer_id, customer_name, customer_phone, customer_gstin, customer_address,
      items, subtotal, discount_amount, gst_enabled, gst_amount, gst_rate,
      taxable_amount, cgst_amount, sgst_amount, igst_amount, is_igst, round_off,
      total_amount, amount_paid, payment_method, payment_status, notes,
      hamali, market_cess, other_exp, customer_gender,
    } = body;

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'At least one item is required' }, { status: 400 });
    }

    const updateInvoice = db.transaction((invoiceId: string) => {
      // 1. Get the OLD invoice to know customer and totals
      const oldInvoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceId) as any;
      if (!oldInvoice) throw new Error('Invoice not found');

      // 2. Get OLD items to restore stock
      const oldItems = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?').all(invoiceId) as any[];

      // 3. Restore OLD product quantities
      const updateProductStock = db.prepare(`UPDATE products SET quantity = quantity + ?, updated_at = datetime('now') WHERE id = ?`);
      for (const item of oldItems) {
        if (item.product_id) {
          updateProductStock.run(item.quantity, item.product_id);
        }
      }

      // 4. Reverse OLD customer balance
      if (oldInvoice.customer_id) {
        const oldBalanceDue = oldInvoice.total_amount - (oldInvoice.amount_paid || 0);
        if (oldBalanceDue !== 0) {
          db.prepare('UPDATE customers SET balance = COALESCE(balance, 0) - ? WHERE id = ?').run(oldBalanceDue, oldInvoice.customer_id);
        }
      }

      // 5. Update invoice record
      const finalAmountPaid = amount_paid ?? (payment_status === 'unpaid' ? 0 : total_amount);
      db.prepare(`
        UPDATE invoices SET 
          customer_id = ?, customer_name = ?, customer_phone = ?, customer_gstin = ?, customer_address = ?,
          subtotal = ?, discount_amount = ?, gst_enabled = ?, gst_amount = ?, gst_rate = ?,
          taxable_amount = ?, cgst_amount = ?, sgst_amount = ?, igst_amount = ?, is_igst = ?, round_off = ?,
          hamali = ?, market_cess = ?, other_exp = ?,
          total_amount = ?, amount_paid = ?, payment_method = ?, payment_status = ?, notes = ?
        WHERE id = ?
      `).run(
        customer_id || null, customer_name || 'Walk-in Customer', customer_phone || '', customer_gstin || '', customer_address || '',
        subtotal || 0, discount_amount || 0, gst_enabled ? 1 : 0, gst_amount || 0, gst_rate || 0,
        taxable_amount || 0, cgst_amount || 0, sgst_amount || 0, igst_amount || 0, is_igst ? 1 : 0, round_off || 0,
        hamali || 0, market_cess || 0, other_exp || 0,
        total_amount || 0, finalAmountPaid, payment_method || 'cash', payment_status || 'paid', notes || '',
        invoiceId
      );

      // 6. Delete old items and insert new ones
      db.prepare('DELETE FROM invoice_items WHERE invoice_id = ?').run(invoiceId);

      const insertItem = db.prepare(`
        INSERT INTO invoice_items (invoice_id, product_id, product_name, brand, article_no, size, color, quantity, unit, price, discount, total,
          hsn_code, gst_rate, taxable_amount, cgst_rate, cgst_amount, sgst_rate, sgst_amount,
          igst_rate, igst_amount, gst_inclusive, weight_kg)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      const decrementStock = db.prepare(`UPDATE products SET quantity = quantity - ?, updated_at = datetime('now') WHERE id = ?`);

      for (const item of items) {
        insertItem.run(
          invoiceId, item.product_id || null, item.product_name,
          item.brand || '', item.article_no || '', item.size || '', item.color || '',
          item.quantity, item.unit || 'pcs', item.price, item.discount || 0, item.total,
          item.hsn_code || '', item.gst_rate || 0, item.taxable_amount || item.total,
          item.cgst_rate || 0, item.cgst_amount || 0,
          item.sgst_rate || 0, item.sgst_amount || 0,
          item.igst_rate || 0, item.igst_amount || 0,
          item.gst_inclusive ? 1 : 0, item.weight_kg || 0
        );
        // Deduct NEW stock
        if (item.product_id) {
          decrementStock.run(item.quantity, item.product_id);
        }
      }

      // 7. Apply NEW customer balance and gender
      const newBalanceDue = total_amount - finalAmountPaid;
      if (customer_id) {
        if (newBalanceDue !== 0) {
          db.prepare('UPDATE customers SET balance = COALESCE(balance, 0) + ? WHERE id = ?').run(newBalanceDue, customer_id);
        }
        if (customer_gender && customer_gender !== 'Unspecified') {
          db.prepare('UPDATE customers SET gender = ? WHERE id = ?').run(customer_gender, customer_id);
        }
      }
    });

    updateInvoice(id);

    const updatedInvoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(id);
    const updatedItems = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?').all(id);

    return NextResponse.json({ invoice: updatedInvoice, items: updatedItems });
  } catch (error) {
    console.error('Invoices PUT error:', error);
    return NextResponse.json({ error: 'Failed to update invoice' }, { status: 500 });
  }
}
