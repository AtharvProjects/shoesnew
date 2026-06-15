/**
 * /api/reports — GET sales reports with date range filters
 */

import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get('from') || '';
    const to = searchParams.get('to') || '';
    const type = searchParams.get('type') || 'summary'; // summary | daily | products | customers

    let dateFilter = '';
    const params: string[] = [];
    if (from) { dateFilter += ' AND date(created_at, \'localtime\') >= ?'; params.push(from); }
    if (to) { dateFilter += ' AND date(created_at, \'localtime\') <= ?'; params.push(to); }

    if (type === 'daily') {
      const rows = db.prepare(`
        SELECT date(created_at, 'localtime') AS date,
               COUNT(*) AS invoice_count,
               COALESCE(SUM(total_amount), 0) AS total_sales,
               COALESCE(SUM(gst_amount), 0) AS total_gst,
               COALESCE(SUM(discount_amount), 0) AS total_discount
        FROM invoices WHERE 1=1 ${dateFilter}
        GROUP BY date(created_at, 'localtime') ORDER BY date DESC
      `).all(...params);
      return NextResponse.json(rows);
    }

    if (type === 'products') {
      const rows = db.prepare(`
        SELECT ii.product_name,
               SUM(ii.quantity) AS total_qty,
               SUM(ii.total) AS total_revenue,
               COUNT(DISTINCT ii.invoice_id) AS invoice_count
        FROM invoice_items ii
        JOIN invoices i ON i.id = ii.invoice_id
        WHERE 1=1 ${dateFilter.replace(/created_at/g, 'i.created_at')}
        GROUP BY ii.product_name ORDER BY total_revenue DESC
      `).all(...params);
      return NextResponse.json(rows);
    }

    if (type === 'customers') {
      const rows = db.prepare(`
        SELECT customer_name,
               COUNT(*) AS invoice_count,
               COALESCE(SUM(total_amount), 0) AS total_spent
        FROM invoices WHERE 1=1 ${dateFilter}
        GROUP BY customer_name ORDER BY total_spent DESC
      `).all(...params);
      return NextResponse.json(rows);
    }

    if (type === 'invoicelist') {
      const rows = db.prepare(`
        SELECT 
            invoice_number as InvoiceNo, 
            date(created_at, 'localtime') as Date, 
            customer_name as Customer, 
            total_amount as Amount, 
            gst_amount as GST, 
            payment_status as Status,
            total_amount - COALESCE(amount_paid, (CASE WHEN payment_status = 'paid' THEN total_amount ELSE 0 END)) as BalanceDue
        FROM invoices WHERE 1=1 ${dateFilter}
        ORDER BY created_at DESC
      `).all(...params);
      return NextResponse.json(rows);
    }

    if (type === 'invoicelist_detailed') {
      const invoices = db.prepare(`SELECT * FROM invoices WHERE 1=1 ${dateFilter} ORDER BY created_at ASC`).all(...params);
      const invoiceIds = invoices.map((i: any) => i.id);
      let items: any[] = [];
      items = db.prepare(`
        SELECT * FROM invoice_items 
        WHERE invoice_id IN (SELECT id FROM invoices WHERE 1=1 ${dateFilter})
      `).all(...params);
      return NextResponse.json({ invoices, items });
    }

    /* summary */
    const totalSales = db.prepare(`
      SELECT COALESCE(SUM(total_amount), 0) AS total FROM invoices WHERE 1=1 ${dateFilter}
    `).get(...params) as { total: number };
    const totalInvoices = db.prepare(`
      SELECT COUNT(*) AS cnt FROM invoices WHERE 1=1 ${dateFilter}
    `).get(...params) as { cnt: number };
    const totalGst = db.prepare(`
      SELECT COALESCE(SUM(gst_amount), 0) AS total FROM invoices WHERE 1=1 ${dateFilter}
    `).get(...params) as { total: number };
    const totalDiscount = db.prepare(`
      SELECT COALESCE(SUM(discount_amount), 0) AS total FROM invoices WHERE 1=1 ${dateFilter}
    `).get(...params) as { total: number };
    const avgBill = db.prepare(`
      SELECT COALESCE(AVG(total_amount), 0) AS avg FROM invoices WHERE 1=1 ${dateFilter}
    `).get(...params) as { avg: number };
    const paymentMethods = db.prepare(`
      SELECT payment_method, COUNT(*) AS cnt, COALESCE(SUM(total_amount), 0) AS total
      FROM invoices WHERE 1=1 ${dateFilter}
      GROUP BY payment_method
    `).all(...params);

    return NextResponse.json({
      totalSales: totalSales.total,
      totalInvoices: totalInvoices.cnt,
      totalGst: totalGst.total,
      totalDiscount: totalDiscount.total,
      avgBill: avgBill.avg,
      paymentMethods,
    });
  } catch (error) {
    console.error('Reports API error:', error);
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });
  }
}
