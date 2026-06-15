/**
 * GET /api/dashboard — Aggregated stats for the dashboard
 * Returns: todaySales, monthSales, weekSales, totalProducts, lowStockProducts,
 *          totalCustomers, recentInvoices, topProducts, salesTrend, lowStockItems
 */

import { NextResponse } from 'next/server';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    /* ---------- today / week / month sales ---------- */
    const todayRow = db.prepare(`
      SELECT COALESCE(SUM(total_amount), 0) AS total, COUNT(*) AS cnt
      FROM invoices WHERE date(created_at, 'localtime') = date('now', 'localtime')
    `).get() as { total: number; cnt: number };

    const weekRow = db.prepare(`
      SELECT COALESCE(SUM(total_amount), 0) AS total
      FROM invoices WHERE created_at >= datetime('now', '-7 days', 'localtime')
    `).get() as { total: number };

    const monthRow = db.prepare(`
      SELECT COALESCE(SUM(total_amount), 0) AS total
      FROM invoices WHERE strftime('%Y-%m', created_at, 'localtime') = strftime('%Y-%m', 'now', 'localtime')
    `).get() as { total: number };

    /* ---------- product counts ---------- */
    const totalProducts = (db.prepare(`SELECT COUNT(*) AS c FROM products`).get() as { c: number }).c;
    const lowStockProducts = (db.prepare(
      `SELECT COUNT(*) AS c FROM products WHERE quantity <= low_stock_alert`
    ).get() as { c: number }).c;

    /* ---------- customer count ---------- */
    const totalCustomers = (db.prepare(`SELECT COUNT(*) AS c FROM customers`).get() as { c: number }).c;

    /* ---------- recent invoices ---------- */
    const recentInvoices = db.prepare(`
      SELECT id, invoice_number, customer_name, total_amount, payment_status, created_at
      FROM invoices ORDER BY created_at DESC LIMIT 5
    `).all();

    /* ---------- top products (by quantity sold) ---------- */
    const topProducts = db.prepare(`
      SELECT product_name, SUM(quantity) AS total_quantity, SUM(total) AS total_revenue
      FROM invoice_items GROUP BY product_name ORDER BY total_quantity DESC LIMIT 5
    `).all();

    /* ---------- 7-day sales trend ---------- */
    const salesTrend = db.prepare(`
      WITH RECURSIVE dates(d) AS (
        SELECT date('now', '-6 days', 'localtime')
        UNION ALL SELECT date(d, '+1 day') FROM dates WHERE d < date('now', 'localtime')
      )
      SELECT dates.d AS date,
             COALESCE(SUM(i.total_amount), 0) AS amount
      FROM dates
      LEFT JOIN invoices i ON date(i.created_at, 'localtime') = dates.d
      GROUP BY dates.d ORDER BY dates.d
    `).all();

    /* ---------- low stock items ---------- */
    const lowStockItems = db.prepare(`
      SELECT id, name, quantity, low_stock_alert, unit
      FROM products WHERE quantity <= low_stock_alert ORDER BY quantity ASC LIMIT 10
    `).all();

    return NextResponse.json({
      stats: {
        todaySales: todayRow.total,
        todayInvoices: todayRow.cnt,
        totalProducts,
        lowStockProducts,
        totalCustomers,
        monthSales: monthRow.total,
        weekSales: weekRow.total,
      },
      recentInvoices,
      topProducts,
      salesTrend,
      lowStockItems,
    });
  } catch (error) {
    console.error('Dashboard API error:', error);
    return NextResponse.json({ error: 'Failed to load dashboard' }, { status: 500 });
  }
}
