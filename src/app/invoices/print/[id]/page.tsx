import db from '@/lib/db';
import { format } from 'date-fns';
import { notFound } from 'next/navigation';
import PrintActions from './PrintActions';
import { amountInWords } from '@/lib/gst-utils';
import QRCode from 'qrcode';
import { mrDictionary } from '@/lib/i18n/mr';

export const dynamic = 'force-dynamic';

function fmtNum(n: number | null | undefined) {
    return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(Number(n) || 0);
}

/** Builds a UPI deep-link string for QR generation */
function buildUpiUrl(upiId: string, name: string, amount: number): string {
    const params = new URLSearchParams({
        pa: upiId,
        pn: name,
        am: amount.toFixed(2),
        cu: 'INR',
    });
    return `upi://pay?${params.toString()}`;
}

export default async function PrintInvoicePage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = await params;
    const invoiceId = parseInt(resolvedParams.id, 10);
    if (isNaN(invoiceId)) return notFound();

    const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceId) as any;
    if (!invoice) return notFound();

    const items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?').all(invoiceId) as any[];
    const settingsRows = db.prepare('SELECT key, value FROM settings').all() as any[];
    const s = settingsRows.reduce((acc: any, row: any) => ({ ...acc, [row.key]: row.value }), {});

    const isGst = invoice.gst_enabled === 1;
    const isIgst = invoice.is_igst === 1;
    const theme = s.invoice_theme || 'professional';
    const lang = s.app_language || 'en';
    const t = (key: string) => (lang === 'mr' && mrDictionary[key]) ? mrDictionary[key] : key;

    // Extra charges (from saved invoice)
    const hamali = Number(invoice.hamali) || 0;
    const marketCess = Number(invoice.market_cess) || 0;
    const otherExp = Number(invoice.other_exp) || 0;

    // Removed old Bag/Kg logic to fit Footwear attributes

    // Generate UPI QR code (base64 PNG) if upi_id is set
    let qrDataUrl: string | null = null;
    if (s.upi_id) {
        try {
            const upiUrl = buildUpiUrl(s.upi_id, s.store_name || 'Store', Number(invoice.total_amount));
            qrDataUrl = await QRCode.toDataURL(upiUrl, { width: 80, margin: 1 });
        } catch { /* QR generation failed silently */ }
    }

    return (
        <div className="bg-gray-100 min-h-screen print:bg-white text-black invoice-print-bg">
            {/* Print/Close buttons — outside the A4 wrapper so they don't affect page height */}
            <div className="py-4 flex justify-center print:hidden">
                <PrintActions />
            </div>
            <div className={`${theme === 'thermal' ? 'w-[300px]' : ''} border border-gray-300 bg-white mx-auto invoice-a4-wrapper`} id="print-area">

                {theme === 'thermal' ? (
                    /* ══════════════ THERMAL RECEIPT LAYOUT ══════════════ */
                    <div className="font-mono text-sm leading-tight text-black pb-8 p-4 shrink-0">
                        <div className="text-center mb-4">
                            <h2 className="font-bold text-lg uppercase">{s.store_name || 'Store'}</h2>
                            {s.store_address && <p className="text-xs mt-1 whitespace-pre-line">{s.store_address}</p>}
                            {s.store_phone && <p className="text-xs">PHONE : {s.store_phone}</p>}
                            {s.store_gstin && <p className="text-xs">GSTIN : {s.store_gstin}</p>}
                        </div>
                        <div className="text-center bg-gray-200 border-y border-black py-0.5">
                            <h2 className="font-bold text-[12px] uppercase tracking-widest leading-tight">
                                {isGst ? t('Tax Invoice') : t('Retail Invoice')}
                            </h2>
                            {invoice.payment_status === 'unpaid' && (
                                <p className="font-bold text-[9px] uppercase tracking-wide">[{t('SALES CREDIT')}]</p>
                            )}
                        </div>
                        <div className="mb-4">
                            <p>Date : {format(new Date(invoice.created_at.replace(' ', 'T') + 'Z'), 'dd/MM/yyyy, hh:mm a')}</p>
                            <p className="font-bold mt-2">{invoice.customer_name}</p>
                            {invoice.customer_gstin && <p>GSTIN: {invoice.customer_gstin}</p>}
                            <p>Bill No: {invoice.invoice_number}</p>
                            <p>Payment Mode: {invoice.payment_method}</p>
                        </div>
                        <div className="border-t border-b border-dashed border-black py-1 mb-2">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-dashed border-black">
                                        <th className="text-left font-bold pb-1 w-2/5">Item</th>
                                        <th className="text-center font-bold pb-1 w-1/5">Qty</th>
                                        <th className="text-right font-bold pb-1 w-1/5">Rate</th>
                                        <th className="text-right font-bold pb-1 w-1/5">Amt</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map((item: any) => (
                                        <tr key={item.id}>
                                            <td className="py-1 break-words align-top pr-1">
                                                {item.product_name}
                                                <div className="text-[9px] text-gray-700">
                                                  {item.brand && `${item.brand} `}{item.article_no && `Art:${item.article_no} `}{item.size && `Sz:${item.size}`}
                                                </div>
                                                {isGst && item.hsn_code && <span className="text-[9px] block text-gray-600">HSN:{item.hsn_code}</span>}
                                            </td>
                                            <td className="py-1 text-center align-top">{item.quantity} {item.unit}</td>
                                            <td className="py-1 text-right align-top">{item.price.toFixed(2)}</td>
                                            <td className="py-1 text-right align-top">{(item.taxable_amount || item.total).toFixed(2)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="flex justify-between mb-1">
                            <span>Sub Total</span>
                            <span>{(invoice.taxable_amount || invoice.subtotal).toFixed(2)}</span>
                        </div>
                        {invoice.discount_amount > 0 && (
                            <div className="flex justify-between mb-1">
                                <span>(-) Discount</span>
                                <span>{invoice.discount_amount.toFixed(2)}</span>
                            </div>
                        )}
                        {hamali > 0 && (
                            <div className="flex justify-between mb-1">
                                <span>Hamali</span>
                                <span>{hamali.toFixed(2)}</span>
                            </div>
                        )}
                        {marketCess > 0 && (
                            <div className="flex justify-between mb-1">
                                <span>Market Cess</span>
                                <span>{marketCess.toFixed(2)}</span>
                            </div>
                        )}
                        {otherExp > 0 && (
                            <div className="flex justify-between mb-1">
                                <span>Other Exp</span>
                                <span>{otherExp.toFixed(2)}</span>
                            </div>
                        )}
                        {isGst && (
                            <div className="text-xs space-y-0.5 mb-1">
                                {!isIgst ? (
                                    <>
                                        <div className="flex justify-between"><span>CGST</span><span>{(invoice.cgst_amount || 0).toFixed(2)}</span></div>
                                        <div className="flex justify-between"><span>SGST</span><span>{(invoice.sgst_amount || 0).toFixed(2)}</span></div>
                                    </>
                                ) : (
                                    <div className="flex justify-between"><span>IGST</span><span>{(invoice.igst_amount || 0).toFixed(2)}</span></div>
                                )}
                            </div>
                        )}
                        {(invoice.round_off || 0) !== 0 && (
                            <div className="flex justify-between mb-1 text-xs">
                                <span>R/off</span>
                                <span>{(Number(invoice.round_off) > 0 ? '+' : '')}{Number(invoice.round_off).toFixed(2)}</span>
                            </div>
                        )}
                        <div className="flex justify-between border-t border-dashed border-black pt-1 font-bold mb-4 no-break">
                            <span>TOTAL</span>
                            <span>Rs {Number(invoice.total_amount).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between border-b border-dashed border-black pb-2 mb-4 no-break">
                            <span>{invoice.payment_method} :</span>
                            <span>Rs {Number(invoice.amount_paid || invoice.total_amount).toFixed(2)}</span>
                        </div>
                        <div className="text-xs mb-4 font-bold">
                            <p>{amountInWords(invoice.total_amount)}</p>
                        </div>
                        {qrDataUrl && (
                            <div className="flex flex-col items-center mb-4">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={qrDataUrl} alt="Pay via UPI" width={80} height={80} />
                                <p className="text-[9px] mt-1">Scan to Pay via UPI</p>
                            </div>
                        )}
                        <div className="text-right text-xs font-bold mt-8"><p>E &amp; O.E</p></div>
                        <div className="text-center text-xs mt-4"><p>Thank you for visiting!</p></div>
                    </div>
                ) : (
                    /* PROFESSIONAL A4 LAYOUT */
                    <InvoiceTemplate 
                        invoice={invoice as any} 
                        items={items as any} 
                        settings={s} 
                        qrDataUrl={qrDataUrl || undefined}
                        t={t as any} 
                    />
                )}
            </div>
        </div>
    );
}