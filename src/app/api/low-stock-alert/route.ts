/**
 * /api/low-stock-alert — POST sends low-stock email via Gmail SMTP
 * Reads Gmail credentials from settings table.
 */

import { NextResponse } from 'next/server';
import db from '@/lib/db';
import nodemailer from 'nodemailer';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const lowStock = db.prepare(
      'SELECT id, name, sku, category, quantity, unit, selling_price, low_stock_alert FROM products WHERE quantity <= low_stock_alert ORDER BY quantity ASC'
    ).all();
    return NextResponse.json(lowStock);
  } catch (error) {
    console.error('Low stock GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch low stock items' }, { status: 500 });
  }
}

export async function POST() {
  try {
    /* Get settings */
    const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
    const s: Record<string, string> = {};
    for (const r of rows) s[r.key] = r.value;

    if (!s.gmail_user || !s.gmail_app_password) {
      return NextResponse.json(
        { error: 'Gmail credentials not configured. Go to Settings to set up.' },
        { status: 400 },
      );
    }

    const recipient = s.low_stock_email || s.gmail_user;

    /* Get low-stock products */
    const lowStock = db.prepare(
      'SELECT name, quantity, unit, low_stock_alert FROM products WHERE quantity <= low_stock_alert ORDER BY quantity ASC'
    ).all() as { name: string; quantity: number; unit: string; low_stock_alert: number }[];

    if (lowStock.length === 0) {
      return NextResponse.json({ message: 'No low-stock items found.' });
    }

    /* Build email body */
    const itemsHtml = lowStock.map(
      (p) => `<tr><td style="padding:8px;border:1px solid #ddd">${p.name}</td>
               <td style="padding:8px;border:1px solid #ddd;color:${p.quantity === 0 ? 'red' : 'orange'}">${p.quantity} ${p.unit}</td>
               <td style="padding:8px;border:1px solid #ddd">${p.low_stock_alert} ${p.unit}</td></tr>`
    ).join('');

    const html = `
      <h2>Low Stock Alert - ${s.store_name || 'Store'}</h2>
      <p>${lowStock.length} product(s) are running low on stock:</p>
      <table style="border-collapse:collapse;width:100%">
        <tr style="background:#f5f5f5">
          <th style="padding:8px;border:1px solid #ddd;text-align:left">Product</th>
          <th style="padding:8px;border:1px solid #ddd;text-align:left">Current Stock</th>
          <th style="padding:8px;border:1px solid #ddd;text-align:left">Alert Level</th>
        </tr>
        ${itemsHtml}
      </table>
      <p style="margin-top:16px;color:#666">Sent from Gajraj Billing Software</p>
    `;

    /* Send email */
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: s.gmail_user, pass: s.gmail_app_password },
    });

    await transporter.sendMail({
      from: s.gmail_user,
      to: recipient,
      subject: `Low Stock Alert - ${lowStock.length} items need restocking`,
      html,
    });

    return NextResponse.json({ message: `Alert sent to ${recipient} for ${lowStock.length} items.` });
  } catch (error) {
    console.error('Low stock alert error:', error);
    return NextResponse.json({ error: 'Failed to send alert email' }, { status: 500 });
  }
}
