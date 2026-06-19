import db from '@/lib/db';
import { format } from 'date-fns';
import PrintActionClient from './PrintActionClient';
import { amountInWords } from '@/lib/gst-utils';

export const dynamic = 'force-dynamic';

function fmtNum(n: number | null | undefined) {
    return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(Number(n) || 0);
}

export default async function BatchPrintPage({ searchParams }: { searchParams: Promise<{ from: string, to: string }> }) {
    const resolvedParams = await searchParams;
    const { from, to } = resolvedParams;
    
    if (!from || !to) {
        return <div className="p-8 text-center">Please provide a valid date range (from, to).</div>;
    }

    const invoices = db.prepare('SELECT * FROM invoices WHERE date(created_at) >= ? AND date(created_at) <= ? ORDER BY created_at ASC').all(from, to) as any[];
    
    if (invoices.length === 0) {
        return <div className="p-8 text-center">No invoices found for this period.</div>;
    }

    const invoiceIds = invoices.map(i => i.id);
    const placeholders = invoiceIds.map(() => '?').join(',');
    const allItems = db.prepare(`SELECT * FROM invoice_items WHERE invoice_id IN (${placeholders})`).all(...invoiceIds) as any[];

    const settingsRows = db.prepare('SELECT key, value FROM settings').all() as any[];
    const s = settingsRows.reduce((acc: any, row: any) => ({ ...acc, [row.key]: row.value }), {});
    
    const bagUnits = new Set(['bag', 'pcs', 'box', 'pack', 'dozen', 'feet', 'meter', 'sqft', 'ltr', 'ml']);
    
    return (
        <div className="bg-gray-100 min-h-screen print:bg-white text-black invoice-print-bg">
            <PrintActionClient invoiceCount={invoices.length} />

            <div id="print-area">
                {invoices.map((invoice) => {
                    const items = allItems.filter(it => it.invoice_id === invoice.id);
                    const isGst = invoice.gst_enabled === 1;
                    const isIgst = invoice.is_igst === 1;

                    const totalBags = items.reduce((a, c) => a + (bagUnits.has((c.unit || '').toLowerCase()) ? Number(c.quantity) : 0), 0);
                    const totalKg = items.reduce((a, c) => {
                        const u = (c.unit || '').toLowerCase();
                        if (bagUnits.has(u) && Number(c.weight_kg) > 0) return a + (Number(c.quantity) * Number(c.weight_kg));
                        if (u === 'kg') return a + Number(c.quantity);
                        if (u === 'g') return a + Number(c.quantity) / 1000;
                        return a;
                    }, 0);

                    return (
                        <div key={invoice.id} className="invoice-page-container relative" style={{ breakAfter: 'page', pageBreakAfter: 'always', marginBottom: '20px' }}>
                            <div className="bg-white p-6 border border-gray-300 mx-auto text-black w-full invoice-a4-wrapper">
                                <InvoiceTemplate 
                                    invoice={invoice as any} 
                                    items={items as any} 
                                    settings={s} 
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}