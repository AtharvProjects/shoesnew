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
                    /* ══════════════ PROFESSIONAL A4 — EXACT MATCH TO REFERENCE ══════════════ */
                    <div style={{ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '11px' }} className="text-black bg-white invoice-a4-inner">
                        <table className="w-full border-collapse invoice-items-table" style={{ borderCollapse: 'collapse' }}>
                            <tbody>
                                {/* ───── ROW 1: Company Header ───── */}
                                <tr style={{ height: '1px' }}>
                                    <td colSpan={9} className="border border-black p-0 relative">
                                        <div className="flex flex-col items-center justify-center p-2">
                                            <h1 className="font-bold text-xl uppercase tracking-wider">{s.store_name || 'PRASHANT SALES'}</h1>
                                            {s.store_address && <p className="text-[10px] font-bold mt-0.5 tracking-wide">{s.store_address}</p>}
                                            {s.store_phone && <p className="text-[9px] font-bold tracking-wide">Contact : {s.store_phone}</p>}
                                            {s.store_gstin && <p className="text-[9px] font-bold tracking-wide">GSTIN : {s.store_gstin}</p>}
                                        </div>
                                        {/* QR Code — real UPI QR if upi_id is set, else grey placeholder */}
                                        <div className="absolute top-1 right-1 w-[68px] h-[68px] flex items-center justify-center">
                                            {qrDataUrl ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img src={qrDataUrl} alt="Pay via UPI" width={68} height={68} />
                                            ) : (
                                                <div className="w-full h-full border border-gray-400 bg-gray-50 flex items-center justify-center">
                                                    <span className="text-[7px] text-gray-400 font-bold text-center leading-tight px-1">
                                                        Set UPI ID<br/>in Settings
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                </tr>

                                {/* ───── ROW 2: Invoice Type + Original Copy ───── */}
                                <tr style={{ height: '1px' }}>
                                    <td colSpan={9} className="border border-black p-0 relative">
                                        <div className="flex justify-center items-center py-[1px]">
                                            <span className="font-bold text-[15px] tracking-widest">{isGst ? t('TAX INVOICE') : t('SALES CREDIT')}</span>
                                        </div>
                                        <div className="absolute right-2 top-1/2 -translate-y-1/2">
                                            <span className="text-[8px] font-bold tracking-wide">(ORIGINAL FOR RECIPIENT)</span>
                                        </div>
                                    </td>
                                </tr>

                                {/* ───── ROW 3: Buyer + Invoice Details ───── */}
                                <tr style={{ height: '1px' }}>
                                    <td colSpan={5} className="border border-black p-0 align-top" style={{ width: '45%' }}>
                                        <div className="w-[60%] border-r border-black p-1">
                                            <p className="text-[10px] text-gray-700">Buyer :</p>
                                            <p className="font-bold text-[11px] leading-tight mt-0.5">{invoice.customer_name}</p>
                                            {invoice.customer_address && <p className="ml-2 font-bold text-[10px]">{invoice.customer_address}</p>}
                                            {invoice.customer_phone && <p className="ml-2 font-bold text-[10px]">Mob : {invoice.customer_phone}</p>}
                                            {invoice.customer_gstin && <p className="ml-2 font-bold text-[10px]">GST No : {invoice.customer_gstin}</p>}
                                        </div>
                                    </td>
                                    <td colSpan={4} className="border border-black p-0 align-top" style={{ width: '55%' }}>
                                        <table className="w-full text-[10px] border-collapse h-full">
                                            <tbody>
                                                <tr className="border-b border-black">
                                                    <td className="font-bold p-0.5 px-2 border-r border-black w-[40%] whitespace-nowrap">Invoice No</td>
                                                    <td className="font-bold p-0.5 px-2 text-center text-[12px]">{invoice.invoice_number}</td>
                                                </tr>
                                                <tr className="border-b border-black">
                                                    <td className="font-bold p-0.5 px-2 border-r border-black whitespace-nowrap">Invoice Date</td>
                                                    <td className="font-bold p-0.5 px-2 text-center text-[12px]">{format(new Date(invoice.created_at.replace(' ', 'T') + 'Z'), 'dd-MMM-yy')}</td>
                                                </tr>
                                                <tr className="border-b border-black">
                                                    <td className="font-bold p-0.5 px-2 border-r border-black whitespace-nowrap">Motor Vehicle No</td>
                                                    <td className="p-0.5 px-2"></td>
                                                </tr>
                                                <tr>
                                                    <td className="font-bold p-0.5 px-2 border-r border-black">Time</td>
                                                    <td className="font-bold p-0.5 px-2 text-center text-[12px]">{format(new Date(invoice.created_at.replace(' ', 'T') + 'Z'), 'HH:mm:ss')}</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </td>
                                </tr>

                                {/* ───── ROW 4: Items Table Header ───── */}
                                <tr className="font-bold border border-black text-center" style={{ fontSize: '9px', height: '1px' }}>
                                    <td className="border-r border-black p-0.5 w-[5%]">SI<br/>No</td>
                                    <td className="border-r border-black p-0.5 w-[30%]">{t('Particulars')}<br/><span className="text-transparent">.</span></td>
                                    <td className="border-r border-black p-0.5 w-[10%]">HSN/<br/>SAC</td>
                                    <td className="border-r border-black p-0.5 w-[6%]">GST<br/>%</td>
                                    <td className="border-r border-black p-0.5 w-[6%]">Art<br/>No</td>
                                    <td className="border-r border-black p-0.5 w-[8%]">{t('Size')}<br/><span className="text-transparent">.</span></td>
                                    <td className="border-r border-black p-0.5 w-[10%]">{t('Qty')}<br/><span className="text-transparent">.</span></td>
                                    <td className="border-r border-black p-0.5 w-[10%]">{t('Rate')}<br/><span className="text-transparent">.</span></td>
                                    <td className="p-0.5 w-[15%]">{t('Net Value')}</td>
                                </tr>

                                {/* ───── Items Rows ───── */}
                                {items.map((item: any, idx: number) => (
                                    <tr key={item.id} style={{ fontSize: '9px', verticalAlign: 'top', height: '1px' }} className="font-bold">
                                        <td className="border-r border-black px-1 py-0.5 text-center">{idx + 1}</td>
                                        <td className="border-r border-black px-1 py-0.5">
                                            {item.product_name}
                                            {item.brand && <span className="block text-[8px] text-gray-700">Brand: {item.brand}</span>}
                                        </td>
                                        <td className="border-r border-black px-1 py-0.5 text-center">{item.hsn_code || ''}</td>
                                        <td className="border-r border-black px-1 py-0.5 text-center">{item.gst_rate > 0 ? `${item.gst_rate}%` : '-'}</td>
                                        <td className="border-r border-black px-1 py-0.5 text-center">{item.article_no || '-'}</td>
                                        <td className="border-r border-black px-1 py-0.5 text-center">{item.size || '-'}</td>
                                        <td className="border-r border-black px-1 py-0.5 text-right">{item.quantity} {item.unit}</td>
                                        <td className="border-r border-black px-1 py-0.5 text-right">{fmtNum(item.price)}</td>
                                        <td className="px-1 py-0.5 text-right">{fmtNum(item.taxable_amount || item.total)}</td>
                                    </tr>
                                ))}

                                {/* ───── Spacer Row: stretches to fill remaining A4 height ───── */}
                                <tr className="invoice-spacer-row" style={{ fontSize: '10px' }}>
                                    <td className="border-r border-black p-1"></td>
                                    <td className="border-r border-black p-1"></td>
                                    <td className="border-r border-black p-1"></td>
                                    <td className="border-r border-black p-1"></td>
                                    <td className="border-r border-black p-1"></td>
                                    <td className="border-r border-black p-1"></td>
                                    <td className="border-r border-black p-1"></td>
                                    <td className="border-r border-black p-1"></td>
                                    <td className="p-1"></td>
                                </tr>

                                {/* ───── Charges: Discount A/c ───── */}
                                {invoice.discount_amount > 0 && (
                                    <tr style={{ fontSize: '10px', height: '1px' }}>
                                        <td className="border-r border-black p-0"></td>
                                        <td className="border-r border-black p-0 pr-4 text-right font-bold" colSpan={7}>{t('Discount A/c')}</td>
                                        <td className="p-1 text-right font-bold">{fmtNum(invoice.discount_amount)}</td>
                                    </tr>
                                )}

                                {/* ───── Charges: Hamali ───── */}
                                {(hamali > 0 || invoice.hamali) && (
                                    <tr style={{ fontSize: '10px', height: '1px' }}>
                                        <td className="border-r border-black p-0"></td>
                                        <td className="border-r border-black p-0 pr-4 text-right font-bold" colSpan={7}>{t('Hamali')}</td>
                                        <td className="p-1 text-right font-bold">{hamali > 0 ? fmtNum(hamali) : ''}</td>
                                    </tr>
                                )}

                                {/* ───── Charges: Market Cess ───── */}
                                {(marketCess > 0 || invoice.market_cess) && (
                                    <tr style={{ fontSize: '10px', height: '1px' }}>
                                        <td className="border-r border-black p-0"></td>
                                        <td className="border-r border-black p-0 pr-4 text-right font-bold" colSpan={7}>{t('Market Cess')}</td>
                                        <td className="p-1 text-right font-bold">{marketCess > 0 ? fmtNum(marketCess) : ''}</td>
                                    </tr>
                                )}

                                {/* ───── Charges: OTHER EXP. ───── */}
                                {(otherExp > 0 || invoice.other_exp) && (
                                    <tr style={{ fontSize: '10px', height: '1px' }}>
                                        <td className="border-r border-black p-0"></td>
                                        <td className="border-r border-black p-0 pr-4 text-right font-bold" colSpan={7}>{t('OTHER EXP.')}</td>
                                        <td className="p-1 text-right font-bold">{otherExp > 0 ? fmtNum(otherExp) : ''}</td>
                                    </tr>
                                )}

                                {/* ───── Charges: C GST ───── */}
                                {isGst && !isIgst && (
                                    <tr style={{ fontSize: '10px', height: '1px' }}>
                                        <td className="border-r border-black p-0"></td>
                                        <td className="border-r border-black p-0 pr-4 text-right font-bold" colSpan={7}>{t('C GST')}</td>
                                        <td className="p-1 text-right font-bold">{(invoice.cgst_amount || 0) > 0 ? fmtNum(invoice.cgst_amount) : ''}</td>
                                    </tr>
                                )}

                                {/* ───── Charges: S GST ───── */}
                                {isGst && !isIgst && (
                                    <tr style={{ fontSize: '10px', height: '1px' }}>
                                        <td className="border-r border-black p-0"></td>
                                        <td className="border-r border-black p-0 pr-4 text-right font-bold" colSpan={7}>{t('S GST')}</td>
                                        <td className="p-1 text-right font-bold">{(invoice.sgst_amount || 0) > 0 ? fmtNum(invoice.sgst_amount) : ''}</td>
                                    </tr>
                                )}

                                {/* ───── Charges: I GST ───── */}
                                {isGst && isIgst && (
                                    <tr style={{ fontSize: '10px', height: '1px' }}>
                                        <td className="border-r border-black p-0"></td>
                                        <td className="border-r border-black p-0 pr-4 text-right font-bold" colSpan={7}>{t('I GST')}</td>
                                        <td className="p-1 text-right font-bold">{(invoice.igst_amount || 0) > 0 ? fmtNum(invoice.igst_amount) : ''}</td>
                                    </tr>
                                )}

                                {/* ───── Charges: R/off ───── */}
                                {(invoice.round_off || 0) !== 0 && (
                                    <tr style={{ fontSize: '10px', height: '1px' }}>
                                        <td className="border-r border-black p-0"></td>
                                        <td className="border-r border-black p-0 pr-4 text-right font-bold" colSpan={7}>{t('R/off')}</td>
                                        <td className="p-1 text-right font-bold">{fmtNum(invoice.round_off)}</td>
                                    </tr>
                                )}

                                {/* ───── HSN/SAC Summary Section ───── */}
                                {isGst && (
                                    <tr>
                                        <td colSpan={9} className="border border-black p-0">
                                            <table className="w-full border-collapse" style={{ fontSize: '9px' }}>
                                                <thead>
                                                    <tr className="border-b border-black font-bold bg-gray-50">
                                                        <td className="p-1 border-r border-black text-center" style={{ width: '15%' }}>HSN/SAC</td>
                                                        <td className="p-1 border-r border-black text-right" style={{ width: '15%' }}>{t('Taxable Value')}</td>
                                                        {!isIgst ? (
                                                            <>
                                                                <td className="p-1 border-r border-black text-center" colSpan={2}>{t('Central Tax')}</td>
                                                                <td className="p-1 border-r border-black text-center" colSpan={2}>{t('State Tax')}</td>
                                                            </>
                                                        ) : (
                                                            <td className="p-1 border-r border-black text-center" colSpan={2}>{t('Integrated Tax')}</td>
                                                        )}
                                                        <td className="p-1 text-right" style={{ width: '15%' }}>{t('Total Tax')}</td>
                                                    </tr>
                                                    <tr className="border-b border-black font-bold text-[8px]">
                                                        <td className="border-r border-black"></td><td className="border-r border-black"></td>
                                                        {!isIgst ? (
                                                            <>
                                                                <td className="p-0.5 border-r border-black text-center" style={{ width: '8%' }}>{t('Rate')}</td><td className="p-0.5 border-r border-black text-right" style={{ width: '12%' }}>{t('Amount')}</td>
                                                                <td className="p-0.5 border-r border-black text-center" style={{ width: '8%' }}>{t('Rate')}</td><td className="p-0.5 border-r border-black text-right" style={{ width: '12%' }}>{t('Amount')}</td>
                                                            </>
                                                        ) : (
                                                            <><td className="p-0.5 border-r border-black text-center" style={{ width: '10%' }}>{t('Rate')}</td><td className="p-0.5 border-r border-black text-right" style={{ width: '20%' }}>{t('Amount')}</td></>
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
                                                                <td className="p-1 border-r border-black text-right">{fmtNum(row.taxable)}</td>
                                                                {!isIgst ? (
                                                                    <>
                                                                        <td className="p-1 border-r border-black text-center">{(row.rate / 2).toFixed(1)}%</td><td className="p-1 border-r border-black text-right">{fmtNum(row.cgst)}</td>
                                                                        <td className="p-1 border-r border-black text-center">{(row.rate / 2).toFixed(1)}%</td><td className="p-1 border-r border-black text-right">{fmtNum(row.sgst)}</td>
                                                                    </>
                                                                ) : (
                                                                    <><td className="p-1 border-r border-black text-center">{row.rate.toFixed(1)}%</td><td className="p-1 border-r border-black text-right">{fmtNum(row.igst)}</td></>
                                                                )}
                                                                <td className="p-1 text-right">{fmtNum(row.cgst + row.sgst + row.igst)}</td>
                                                            </tr>
                                                        ));
                                                    })()}
                                                </tbody>
                                            </table>
                                        </td>
                                    </tr>
                                )}

                                {/* ───── TOTAL ROW ───── */}
                                <tr className="font-bold border border-black no-break" style={{ fontSize: '9px', pageBreakInside: 'avoid', breakInside: 'avoid', height: '1px' }}>
                                    <td className="border-r border-black p-0.5"></td>
                                    <td className="border-r border-black p-0.5">{t('Total :')}</td>
                                    <td className="border-r border-black p-0.5"></td>
                                    <td className="border-r border-black p-0.5"></td>
                                    <td className="border-r border-black p-0.5"></td>
                                    <td className="border-r border-black p-0.5"></td>
                                    <td className="border-r border-black p-0.5 text-right font-bold text-[11px]">
                                        {items.reduce((a: number, c: any) => a + Number(c.quantity), 0)}
                                    </td>
                                    <td className="border-r border-black p-0.5"></td>
                                    <td className="p-0.5 text-right font-bold text-[11px]">{fmtNum(Number(invoice.total_amount))}</td>
                                </tr>

                                {/* ───── BOTTOM: Amount in Words + Bank Details ───── */}
                                <tr className="no-break border-b border-black" style={{ fontSize: '9px', pageBreakInside: 'avoid', breakInside: 'avoid', height: '1px' }}>
                                    <td colSpan={5} className="border-r border-black p-1 align-top h-full">
                                        <div className="flex flex-col justify-between h-full">
                                            <div>
                                                <div className="font-bold mb-1">{t('Invoice Amount In Words :')}</div>
                                                <div className="leading-tight">{amountInWords(Number(invoice.total_amount), lang)}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td colSpan={4} className="p-1 align-top h-full relative">
                                        <table className="w-full text-[9px] border-collapse">
                                            <tbody>
                                                {s.bank_name ? (
                                                    <tr>
                                                        <td className="font-bold p-0.5 whitespace-nowrap w-[20%]">Bank Name</td>
                                                        <td className="font-bold p-0.5 w-[5%]">:</td>
                                                        <td className="p-0.5 font-bold">{s.bank_name}</td>
                                                    </tr>
                                                ) : (<tr><td colSpan={3} className="p-0.5">&nbsp;</td></tr>)}
                                                {s.bank_account_no && (
                                                    <tr>
                                                        <td className="font-bold p-0.5 whitespace-nowrap">A/c No.</td>
                                                        <td className="font-bold p-0.5">:</td>
                                                        <td className="p-0.5 font-bold">{s.bank_account_no}</td>
                                                    </tr>
                                                )}
                                                {s.bank_branch && (
                                                    <tr>
                                                        <td className="font-bold p-0.5 whitespace-nowrap">Branch</td>
                                                        <td className="font-bold p-0.5">:</td>
                                                        <td className="p-0.5 font-bold">{s.bank_branch}</td>
                                                    </tr>
                                                )}
                                                {s.bank_ifsc && (
                                                    <tr>
                                                        <td className="font-bold p-0.5 whitespace-nowrap">IFSC Code</td>
                                                        <td className="font-bold p-0.5">:</td>
                                                        <td className="p-0.5 font-bold">{s.bank_ifsc}</td>
                                                    </tr>
                                                )}
                                                {s.upi_id && (
                                                    <tr>
                                                        <td className="font-bold p-0.5 whitespace-nowrap">UPI ID</td>
                                                        <td className="font-bold p-0.5">:</td>
                                                        <td className="p-0.5 font-bold">{s.upi_id}</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                        {/* For Company Name — bottom right */}
                                        <div className="absolute bottom-1 right-1 text-right font-bold text-[10px]">
                                            For {s.store_name || 'PRASHANT SALES'}
                                        </div>
                                    </td>
                                </tr>

                                {/* ───── CERTIFICATION TEXT ───── */}
                                <tr className="border-none" style={{ height: '1px' }}>
                                    <td colSpan={9} className="p-1 border-none pt-2">
                                        <p className="text-[8px] font-bold text-center">
                                            I/We here by certify that footwear / products mentioned in this invoice is / are warranted to be of the nature &amp; quality which it / these purports / purport to be at the time of delivery
                                        </p>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
