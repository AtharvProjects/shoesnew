/**
 * /api/products — CRUD for inventory products
 * GET  — list all (with optional ?search= and ?category= query params)
 * POST — create a new product
 */

import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';

/* ---------- GET all products ---------- */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const category = searchParams.get('category') || '';

    let sql = 'SELECT * FROM products WHERE 1=1';
    const params: string[] = [];

    if (search) {
      sql += ' AND (name LIKE ? OR sku LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }
    sql += ' ORDER BY name ASC';

    const products = db.prepare(sql).all(...params);
    return NextResponse.json(products);
  } catch (error) {
    console.error('Products GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}

/* ---------- POST create product ---------- */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      name, sku, brand, article_no, size, color, category, hsn_code, purchase_price,
      selling_price, quantity, unit, low_stock_alert, gst_rate, description,
    } = body;

    if (!name || selling_price === undefined) {
      return NextResponse.json({ error: 'Name and selling price are required' }, { status: 400 });
    }

    const result = db.prepare(`
      INSERT INTO products (name, sku, brand, article_no, size, color, category, hsn_code, purchase_price,
        selling_price, quantity, unit, low_stock_alert, gst_rate, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      name, sku || null, brand || '', article_no || '', size || '', color || '', category || '', hsn_code || '',
      purchase_price || 0, selling_price, quantity || 0,
      unit || 'pcs', low_stock_alert ?? 10, gst_rate || 0, description || '',
    );

    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid);
    return NextResponse.json(product, { status: 201 });
  } catch (error: any) {
    console.error('Products POST error:', error);
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return NextResponse.json({ error: 'A product with this SKU already exists' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 });
  }
}
