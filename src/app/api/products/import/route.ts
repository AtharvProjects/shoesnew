import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function POST(req: Request) {
    try {
        const products = await req.json();

        if (!Array.isArray(products)) {
            return NextResponse.json({ error: 'Invalid data format' }, { status: 400 });
        }

        const insertProduct = db.prepare(`
      INSERT INTO products (
        name, sku, category, hsn_code, purchase_price, selling_price,
        quantity, unit, low_stock_alert, gst_rate, description
      ) VALUES (
        @name, @sku, @category, @hsn_code, @purchase_price, @selling_price,
        @quantity, @unit, @low_stock_alert, @gst_rate, @description
      )
    `);

        // Using a transaction for bulk insert
        const insertMany = db.transaction((rows: any[]) => {
            let count = 0;
            for (const row of rows) {
                // Basic validation: name and selling_price are required per our app logic
                if (!row.name || typeof row.selling_price === 'undefined' || row.selling_price === null) {
                    continue;
                }

                try {
                    insertProduct.run({
                        name: String(row.name).trim(),
                        sku: row.sku ? String(row.sku) : null,
                        category: row.category ? String(row.category) : '',
                        hsn_code: row.hsn_code ? String(row.hsn_code) : '',
                        purchase_price: Number(row.purchase_price) || 0,
                        selling_price: Number(row.selling_price) || 0,
                        quantity: Number(row.quantity) || 0,
                        unit: row.unit ? String(row.unit).toLowerCase() : 'pcs',
                        low_stock_alert: Number(row.low_stock_alert) || 10,
                        gst_rate: Number(row.gst_rate) || 0,
                        description: row.description ? String(row.description) : ''
                    });
                    count++;
                } catch (e: any) {
                    // Ignore unique constraint errors (like duplicate SKU) and continue
                    console.error("Row import error:", e.message);
                }
            }
            return count;
        });

        const insertedCount = insertMany(products);

        return NextResponse.json({ success: true, count: insertedCount });
    } catch (error: any) {
        console.error('Import POST Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
