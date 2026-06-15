/**
 * /api/invoices — GET list, POST create invoice
 * Creating an invoice also decrements product stock automatically.
 */

import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';

/* ---------- GET list ---------- */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const from = searchParams.get('from') || '';
    const to = searchParams.get('to') || '';

    let sql = 'SELECT * FROM invoices WHERE 1=1';
    const params: string[] = [];

    if (search) {
      sql += ' AND (invoice_number LIKE ? OR customer_name LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    if (status && status !== 'all') {
      sql += ' AND payment_status = ?';
      params.push(status);
    }
    if (from) {
      sql += ' AND date(created_at) >= ?';
      params.push(from);
    }
    if (to) {
      sql += ' AND date(created_at) <= ?';
      params.push(to);
    }
    sql += ' ORDER BY created_at DESC';

    const invoices = db.prepare(sql).all(...params);
    return NextResponse.json(invoices);
  } catch (error) {
    console.error('Invoices GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch invoices' }, { status: 500 });
  }
}

/* ---------- POST create ---------- */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      customer_id, customer_name, customer_phone, customer_gstin, customer_address,
      items, subtotal, discount_amount, gst_enabled, gst_amount, gst_rate,
      taxable_amount, cgst_amount, sgst_amount, igst_amount, is_igst, round_off,
      total_amount, amount_paid, payment_method, payment_status, notes,
      hamali, market_cess, other_exp,
    } = body;

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'At least one item is required' }, { status: 400 });
    }

    /* Wrap in transaction */
    const createInvoice = db.transaction(() => {
      /* Generate invoice number cleanly isolated inside transaction lock */
      const prefixRow = db.prepare("SELECT value FROM settings WHERE key = 'invoice_prefix'").get() as { value: string } | undefined;
      const counterRow = db.prepare("SELECT value FROM settings WHERE key = 'invoice_counter'").get() as { value: string } | undefined;
      const prefix = prefixRow?.value || 'INV';
      const counter = parseInt(counterRow?.value || '1', 10);
      const invoice_number = `${prefix}-${String(counter).padStart(5, '0')}`;

      /* Insert invoice */
      const invResult = db.prepare(`
        INSERT INTO invoices (invoice_number, customer_id, customer_name, customer_phone,
          customer_gstin, customer_address,
          subtotal, discount_amount, gst_enabled, gst_amount, gst_rate,
          taxable_amount, cgst_amount, sgst_amount, igst_amount, is_igst, round_off,
          hamali, market_cess, other_exp,
          total_amount, amount_paid, payment_method, payment_status, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        invoice_number, customer_id || null,
        customer_name || 'Walk-in Customer', customer_phone || '',
        customer_gstin || '', customer_address || '',
        subtotal || 0, discount_amount || 0, gst_enabled ? 1 : 0,
        gst_amount || 0, gst_rate || 0,
        taxable_amount || 0, cgst_amount || 0, sgst_amount || 0, igst_amount || 0,
        is_igst ? 1 : 0, round_off || 0,
        hamali || 0, market_cess || 0, other_exp || 0,
        total_amount || 0,
        amount_paid ?? (payment_status === 'unpaid' ? 0 : total_amount),
        payment_method || 'cash', payment_status || 'paid', notes || '',
      );

      const invoiceId = invResult.lastInsertRowid;

      /* Insert items and decrement stock */
      const insertItem = db.prepare(`
        INSERT INTO invoice_items (invoice_id, product_id, product_name, brand, article_no, size, color, quantity, unit, price, discount, total,
          hsn_code, gst_rate, taxable_amount, cgst_rate, cgst_amount, sgst_rate, sgst_amount,
          igst_rate, igst_amount, gst_inclusive, weight_kg)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const decrementStock = db.prepare(`
        UPDATE products SET quantity = quantity - ?, updated_at = datetime('now') WHERE id = ?
      `);

      for (const item of items) {
        insertItem.run(
          invoiceId, item.product_id || null, item.product_name,
          item.brand || '', item.article_no || '', item.size || '', item.color || '',
          item.quantity, item.unit || 'pcs', item.price, item.discount || 0, item.total,
          item.hsn_code || '', item.gst_rate || 0, item.taxable_amount || item.total,
          item.cgst_rate || 0, item.cgst_amount || 0,
          item.sgst_rate || 0, item.sgst_amount || 0,
          item.igst_rate || 0, item.igst_amount || 0,
          item.gst_inclusive ? 1 : 0,
          item.weight_kg || 0,
        );
        /* Auto-decrement inventory */
        if (item.product_id) {
          decrementStock.run(item.quantity, item.product_id);
        }
      }

      /* Bump invoice counter */
      db.prepare("UPDATE settings SET value = ? WHERE key = 'invoice_counter'").run(String(counter + 1));

      /* Update customer balance and gender */
      const finalAmountPaid = amount_paid ?? (payment_status === 'unpaid' ? 0 : total_amount);
      const balanceDue = total_amount - finalAmountPaid;
      if (customer_id) {
        if (balanceDue !== 0) {
          db.prepare('UPDATE customers SET balance = COALESCE(balance, 0) + ? WHERE id = ?').run(balanceDue, customer_id);
        }
        if (body.customer_gender && body.customer_gender !== 'Unspecified') {
          db.prepare('UPDATE customers SET gender = ? WHERE id = ?').run(body.customer_gender, customer_id);
        }
      }

      return invoiceId;
    });

    const invoiceId = createInvoice();
    const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceId);
    const invoiceItems = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?').all(invoiceId);

    return NextResponse.json({ invoice, items: invoiceItems }, { status: 201 });
  } catch (error) {
    console.error('Invoices POST error:', error);
    return NextResponse.json({ error: 'Failed to create invoice' }, { status: 500 });
  }
}

