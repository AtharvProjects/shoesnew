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
                                <div style={{ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '11px' }} className="text-black bg-white invoice-a4-inner">
                                    <table className="invoice-items-table border-collapse w-full" style={{ borderCollapse: 'collapse' }}>
                                        <tbody>
                                            {/* Company Header */}
                                            <tr style={{ height: '1px' }}>
                                                <td colSpan={9} className="border border-black p-0">
                                                    <div className="flex-1 text-center py-3 px-4">
                                                        <h1 className="font-bold text-xl uppercase tracking-wide">{invoice.store_name || s.store_name || 'Store'}</h1>
                                                        {s.store_address && <p className="text-[11px] mt-0.5">{s.store_address}</p>}
                                                        {s.store_fssai && <p className="text-[11px]">Fssai No.{s.store_fssai}</p>}
                                                        {s.store_phone && <p className="text-[11px]">Contact : {s.store_phone}</p>}
                                                        {s.store_gstin && <p className="text-[11px] font-bold">GSTIN : {s.store_gstin}</p>}
                                                    </div>
                                                </td>
                                            </tr>

                                            {/* Invoice Type */}
                                            <tr style={{ height: '1px' }}>
                                                <td colSpan={9} className="border border-black p-0">
                                                    <div className="flex justify-between items-center px-2 py-1">
                                                        <span></span>
                                                        <span className="font-bold text-sm">{invoice.gst_enabled === 1 ? 'TAX INVOICE' : 'BILL OF SUPPLY'}</span>
                                                        <span className="text-[10px] font-bold">(ORIGINAL FOR RECIPIENT)</span>
                                                    </div>
                                                </td>
                                            </tr>

                                            {/* Buyer + Invoice Details */}
                                            <tr style={{ height: '1px' }}>
                                                <td colSpan={5} className="border border-black p-0 align-top" style={{ width: '55%' }}>
                                                    <div className="p-1.5 text-[10px] leading-tight">
                                                        <p className="font-bold text-[9px]">Buyer :</p>
                                                        <p className="font-bold ml-1 text-[11px]">{invoice.customer_name}</p>
                                                        {invoice.customer_address && <p className="ml-1 text-[10px]">{invoice.customer_address}</p>}
                                                        {invoice.customer_phone && <p className="ml-1 font-bold text-[10px]">Mob : {invoice.customer_phone}</p>}
                                                        {invoice.customer_gstin && <p className="ml-1 font-bold text-[10px]">GST No : {invoice.customer_gstin}</p>}
                                                    </div>
                                                </td>
                                                <td colSpan={4} className="border border-black p-0 align-top" style={{ width: '45%' }}>
                                                    <table className="w-full text-[10px] border-collapse">
                                                        <tbody>
                                                            <tr className="border-b border-black">
                                                                <td className="font-bold p-1 px-2 border-r border-black whitespace-nowrap">Invoice No</td>
                                                                <td className="font-bold p-1 px-2">{invoice.invoice_number}</td>
                                                            </tr>
                                                            <tr className="border-b border-black">
                                                                <td className="font-bold p-1 px-2 border-r border-black whitespace-nowrap">Invoice Date</td>
                                                                <td className="font-bold p-1 px-2">{invoice && format(new Date(invoice.created_at.replace(' ', 'T') + 'Z'), 'dd-MMM-yy')}</td>
                                                            </tr>
                                                            <tr className="border-b border-black">
                                                                <td className="font-bold p-1 px-2 border-r border-black whitespace-nowrap">Motor Vehicle No</td>
                                                                <td className="p-1 px-2"></td>
                                                            </tr>
                                                            <tr>
                                                                <td className="font-bold p-1 px-2 border-r border-black whitespace-nowrap">Time</td>
                                                                <td className="p-1 px-2 font-bold">{invoice && format(new Date(invoice.created_at.replace(' ', 'T') + 'Z'), 'HH:mm:ss')}</td>
                                                            </tr>
                                                        </tbody>
                                                    </table>
                                                </td>
                                            </tr>

                                            {/* Items Header */}
                                            <tr className="font-bold border border-black" style={{ fontSize: '10px', height: '1px' }}>
                                                <td className="border border-black p-1 text-center" style={{ width: '25px' }}>SI<br/>No</td>
                                                <td className="border border-black p-1" style={{ width: '35%' }}>Particulars</td>
                                                <td className="border border-black p-1 text-center" style={{ width: '55px' }}>HSN/<br/>SAC</td>
                                                <td className="border border-black p-1 text-center" style={{ width: '30px' }}>GST<br/>%</td>
                                                <td className="border border-black p-1 text-center" style={{ width: '40px' }}>BAG</td>
                                                <td className="border border-black p-1 text-center" style={{ width: '65px' }}>KG</td>
                                                <td className="border border-black p-1 text-center" style={{ width: '45px' }}>Tax<br/>Incl</td>
                                                <td className="border border-black p-1 text-center" style={{ width: '50px' }}>Rate</td>
                                                <td className="border border-black p-1 text-right" style={{ width: '80px' }}>Net<br/>Value</td>
                                            </tr>

                                            {/* Rows */}
                                            {items.map((item, idx) => {
                                                const unit = (item.unit || '').toLowerCase();
                                                const bagStr = bagUnits.has(unit) ? String(item.quantity) : '-';
                                                let kgStr = '-';
                                                if (bagUnits.has(unit) && Number(item.weight_kg || 0) > 0) {
                                                    kgStr = (item.quantity * Number(item.weight_kg)).toFixed(2);
                                                } else if (unit === 'kg') {
                                                    kgStr = item.quantity.toFixed(3);
                                                } else if (unit === 'g') {
                                                    kgStr = (item.quantity / 1000).toFixed(3);
                                                }
                                                return (
                                                    <tr key={item.id} style={{ fontSize: '10px', height: '1px' }}>
                                                        <td className="border-l border-r border-black p-1 text-center">{idx + 1}</td>
                                                        <td className="border-r border-black p-1 font-bold">{item.product_name}</td>
                                                        <td className="border-r border-black p-1 text-center font-mono">{item.hsn_code || ''}</td>
                                                        <td className="border-r border-black p-1 text-center">{item.gst_rate || 0}%</td>
                                                        <td className="border-r border-black p-1 text-center">{bagStr}</td>
                                                        <td className="border-r border-black p-1 text-right">{kgStr}</td>
                                                        <td className="border-r border-black p-1 text-center">{item.gst_inclusive ? 'Y' : 'N'}</td>
                                                        <td className="border-r border-black p-1 text-right">{item.price.toFixed(2)}</td>
                                                        <td className="border-l border-r border-black p-1 text-right">{(item.taxable_amount || item.total).toFixed(2)}</td>
                                                    </tr>
                                                );
                                            })}

                                            {/* Spacer */}
                                            <tr className="invoice-spacer-row" style={{ fontSize: '10px' }}>
                                                <td className="border-l border-r border-black p-1"></td>
                                                <td className="border-r border-black p-1"></td>
                                                <td className="border-r border-black p-1"></td>
                                                <td className="border-r border-black p-1"></td>
                                                <td className="border-r border-black p-1"></td>
                                                <td className="border-r border-black p-1"></td>
                                                <td className="border-r border-black p-1"></td>
                                                <td className="border-r border-black p-1"></td>
                                                <td className="border-l border-r border-black p-1"></td>
                                            </tr>

                                            {/* Charges */}
                                            {invoice.discount_amount > 0 && (
                                                <tr style={{ fontSize: '10px', height: '1px' }}>
                                                    <td className="border-l border-r border-black p-1"></td>
                                                    <td className="border-r border-black p-1 text-center font-bold">Discount A/c</td>
                                                    <td colSpan={6} className="border-r border-black p-1"></td>
                                                    <td className="border-l border-r border-black p-1 text-right">{invoice.discount_amount.toFixed(2)}</td>
                                                </tr>
                                            )}
                                            {Number(invoice.hamali || 0) > 0 && (
                                                <tr style={{ fontSize: '10px', height: '1px' }}>
                                                    <td className="border-l border-r border-black p-1"></td>
                                                    <td className="border-r border-black p-1 text-center font-bold">Hamali</td>
                                                    <td colSpan={6} className="border-r border-black p-1"></td>
                                                    <td className="border-l border-r border-black p-1 text-right">{Number(invoice.hamali).toFixed(2)}</td>
                                                </tr>
                                            )}
                                            {Number(invoice.market_cess || 0) > 0 && (
                                                <tr style={{ fontSize: '10px', height: '1px' }}>
                                                    <td className="border-l border-r border-black p-1"></td>
                                                    <td className="border-r border-black p-1 text-center font-bold">Market Cess</td>
                                                    <td colSpan={6} className="border-r border-black p-1"></td>
                                                    <td className="border-l border-r border-black p-1 text-right">{Number(invoice.market_cess).toFixed(2)}</td>
                                                </tr>
                                            )}
                                            {Number(invoice.other_exp || 0) > 0 && (
                                                <tr style={{ fontSize: '10px', height: '1px' }}>
                                                    <td className="border-l border-r border-black p-1"></td>
                                                    <td className="border-r border-black p-1 text-center font-bold">OTHER EXP.</td>
                                                    <td colSpan={6} className="border-r border-black p-1"></td>
                                                    <td className="border-l border-r border-black p-1 text-right">{Number(invoice.other_exp).toFixed(2)}</td>
                                                </tr>
                                            )}
                                            <tr style={{ fontSize: '10px', height: '1px' }}>
                                                <td className="border-l border-r border-black p-1"></td>
                                                <td className="border-r border-black p-1 text-center font-bold">C GST</td>
                                                <td colSpan={6} className="border-r border-black p-1"></td>
                                                <td className="border-l border-r border-black p-1 text-right">{isGst && !isIgst && (invoice.cgst_amount || 0) > 0 ? invoice.cgst_amount.toFixed(2) : ''}</td>
                                            </tr>
                                            <tr style={{ fontSize: '10px', height: '1px' }}>
                                                <td className="border-l border-r border-black p-1"></td>
                                                <td className="border-r border-black p-1 text-center font-bold">S GST</td>
                                                <td colSpan={6} className="border-r border-black p-1"></td>
                                                <td className="border-l border-r border-black p-1 text-right">{isGst && !isIgst && (invoice.sgst_amount || 0) > 0 ? invoice.sgst_amount.toFixed(2) : ''}</td>
                                            </tr>
                                            <tr style={{ fontSize: '10px', height: '1px' }}>
                                                <td className="border-l border-r border-black p-1"></td>
                                                <td className="border-r border-black p-1 text-center font-bold">I GST</td>
                                                <td colSpan={6} className="border-r border-black p-1"></td>
                                                <td className="border-l border-r border-black p-1 text-right">{isGst && isIgst && (invoice.igst_amount || 0) > 0 ? invoice.igst_amount.toFixed(2) : ''}</td>
                                            </tr>
                                            <tr style={{ fontSize: '10px', height: '1px' }}>
                                                <td className="border-l border-r border-black p-1"></td>
                                                <td className="border-r border-black p-1 text-center font-bold">R/off</td>
                                                <td colSpan={6} className="border-r border-black p-1"></td>
                                                <td className="border-l border-r border-black p-1 text-right">{(invoice.round_off || 0) !== 0 ? invoice.round_off.toFixed(2) : ''}</td>
                                            </tr>

                                            {/* HSN/SAC Summary Section */}
                                            {invoice.gst_enabled === 1 && (
                                                <tr>
                                                    <td colSpan={9} className="border border-black p-0">
                                                        <table className="w-full border-collapse" style={{ fontSize: '9px' }}>
                                                            <thead>
                                                                <tr className="border-b border-black font-bold bg-gray-50">
                                                                    <td className="p-1 border-r border-black text-center" style={{ width: '15%' }}>HSN/SAC</td>
                                                                    <td className="p-1 border-r border-black text-right" style={{ width: '15%' }}>Taxable Value</td>
                                                                    {!isIgst ? (
                                                                        <>
                                                                            <td className="p-1 border-r border-black text-center" colSpan={2}>Central Tax</td>
                                                                            <td className="p-1 border-r border-black text-center" colSpan={2}>State Tax</td>
                                                                        </>
                                                                    ) : (
                                                                        <td className="p-1 border-r border-black text-center" colSpan={2}>Integrated Tax</td>
                                                                    )}
                                                                    <td className="p-1 text-right" style={{ width: '15%' }}>Total Tax</td>
                                                                </tr>
                                                                <tr className="border-b border-black font-bold text-[8px]">
                                                                    <td className="border-r border-black"></td><td className="border-r border-black"></td>
                                                                    {!isIgst ? (
                                                                        <>
                                                                            <td className="p-0.5 border-r border-black text-center" style={{ width: '8%' }}>Rate</td><td className="p-0.5 border-r border-black text-right" style={{ width: '12%' }}>Amount</td>
                                                                            <td className="p-0.5 border-r border-black text-center" style={{ width: '8%' }}>Rate</td><td className="p-0.5 border-r border-black text-right" style={{ width: '12%' }}>Amount</td>
                                                                        </>
                                                                    ) : (
                                                                        <><td className="p-0.5 border-r border-black text-center" style={{ width: '10%' }}>Rate</td><td className="p-0.5 border-r border-black text-right" style={{ width: '20%' }}>Amount</td></>
                                                                    )}
                                                                    <td></td>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {(() => {
                                                                    const hsnMap = new Map<string, any>();
                                                                    items.forEach(item => {
                                                                        if (!item.hsn_code || item.gst_rate === 0) return;
                                                                        const key = `${item.hsn_code}_${item.gst_rate}`;
                                                                        const existing = hsnMap.get(key);
                                                                        if (existing) {
                                                                            existing.taxable += item.taxable_amount || item.total;
                                                                            existing.cgst += item.cgst_amount || 0;
                                                                            existing.sgst += item.sgst_amount || 0;
                                                                            existing.igst += item.igst_amount || 0;
                                                                        } else {
                                                                            hsnMap.set(key, {
                                                                                hsn: item.hsn_code,
                                                                                rate: item.gst_rate,
                                                                                taxable: item.taxable_amount || item.total,
                                                                                cgst: item.cgst_amount || 0,
                                                                                sgst: item.sgst_amount || 0,
                                                                                igst: item.igst_amount || 0
                                                                            });
                                                                        }
                                                                    });
                                                                    return Array.from(hsnMap.values()).map((row, i) => (
                                                                        <tr key={i} className="border-b border-black">
                                                                            <td className="p-1 border-r border-black text-center font-mono">{row.hsn}</td>
                                                                            <td className="p-1 border-r border-black text-right">{row.taxable.toFixed(2)}</td>
                                                                            {!isIgst ? (
                                                                                <>
                                                                                    <td className="p-1 border-r border-black text-center">{(row.rate / 2).toFixed(1)}%</td><td className="p-1 border-r border-black text-right">{row.cgst.toFixed(2)}</td>
                                                                                    <td className="p-1 border-r border-black text-center">{(row.rate / 2).toFixed(1)}%</td><td className="p-1 border-r border-black text-right">{row.sgst.toFixed(2)}</td>
                                                                                </>
                                                                            ) : (
                                                                                <><td className="p-1 border-r border-black text-center">{row.rate.toFixed(1)}%</td><td className="p-1 border-r border-black text-right">{row.igst.toFixed(2)}</td></>
                                                                            )}
                                                                            <td className="p-1 text-right">{(row.cgst + row.sgst + row.igst).toFixed(2)}</td>
                                                                        </tr>
                                                                    ));
                                                                })()}
                                                            </tbody>
                                                        </table>
                                                    </td>
                                                </tr>
                                            )}

                                            <tr className="font-bold border border-black" style={{ fontSize: '10px' }}>
                                                <td className="border border-black p-1"></td>
                                                <td className="border border-black p-1">Total :</td>
                                                <td className="border border-black p-1"></td>
                                                <td className="border border-black p-1"></td>
                                                <td className="border border-black p-1 text-center">{totalBags > 0 ? totalBags : ''}</td>
                                                <td className="border border-black p-1 text-right">{totalKg > 0 ? totalKg.toFixed(2) : ''}</td>
                                                <td className="border border-black p-1"></td>
                                                <td className="border border-black p-1"></td>
                                                <td className="border border-black p-1 text-right">{fmtNum(invoice.total_amount)}</td>
                                            </tr>

                                            {/* Footer */}
                                            <tr className="no-break border-b border-black" style={{ fontSize: '9px', pageBreakInside: 'avoid', breakInside: 'avoid', height: '1px' }}>
                                                <td colSpan={5} className="border-r border-black p-1 align-top">
                                                    <p className="font-bold mb-0.5">Invoice Amount In Words :</p>
                                                    <p className="font-bold">{amountInWords(invoice.total_amount)}</p>
                                                </td>
                                                <td colSpan={4} className="p-1 align-top relative min-h-[100px]">
                                                    <div className="text-[9px]">
                                                        {s.bank_name && <p>Bank: <b>{s.bank_name}</b></p>}
                                                        {s.bank_account_no && <p>A/c No: <b>{s.bank_account_no}</b></p>}
                                                        {s.bank_ifsc && <p>IFSC: <b>{s.bank_ifsc}</b></p>}
                                                    </div>
                                                    <div className="text-right font-bold text-[10px] mt-4">
                                                        For {invoice.store_name || s.store_name || 'PRASHANT SALES'}
                                                    </div>
                                                </td>
                                            </tr>
                                            <tr className="border-none" style={{ height: '1px' }}>
                                                <td colSpan={9} className="p-1 border-none pt-2">
                                                    <p className="text-[8px] font-bold text-center">
                                                        I/We here by certify that food / foods mentioned in this invoice is / are warranted to be of the nature & quality which it / these purports / purport to be at the time of delivery
                                                    </p>
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
