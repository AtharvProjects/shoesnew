/**
 * Invoices Page — List all invoices, view details, export to PDF/JPG
 * Uses jspdf + html2canvas for export functionality.
 */

'use client';

import { amountInWords } from '@/lib/gst-utils';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Search, FileText, Trash2, Eye, Download, Image, AlertTriangle, MessageCircle, Edit } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useLanguage } from '@/components/LanguageProvider';

interface Invoice {
  id: number; invoice_number: string; customer_name: string;
  customer_phone: string; subtotal: number; discount_amount: number;
  gst_enabled: number; gst_amount: number; gst_rate: number;
  taxable_amount: number; cgst_amount: number; sgst_amount: number;
  igst_amount: number; is_igst: number; round_off: number;
  customer_gstin: string; customer_address: string;
  total_amount: number; payment_method: string; payment_status: string;
  notes: string; created_at: string; store_name?: string;
  amount_paid: number;
  hamali: number; market_cess: number; other_exp: number;
}

interface InvoiceItem {
  id: number; product_name: string; quantity: number; unit: string;
  price: number; discount: number; total: number;
  hsn_code: string; gst_rate: number; taxable_amount: number;
  cgst_rate: number; cgst_amount: number;
  sgst_rate: number; sgst_amount: number;
  igst_rate: number; igst_amount: number;
  weight_kg?: number;
}

export default function InvoicesPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [selectedItems, setSelectedItems] = useState<InvoiceItem[]>([]);
  const billRef = useRef<HTMLDivElement>(null);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const { t, language } = useLanguage();

  /* Delete Confirmation State */
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchInvoices = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`/api/invoices?${params}`);
      setInvoices(await res.json());
    } catch { toast.error(t('Failed to load invoices') || 'Failed to load invoices'); }
    finally { setLoading(false); }
  }, [debouncedSearch, statusFilter]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  useEffect(() => {
     fetch('/api/settings').then(r => r.json()).then(setSettings);
  }, []);

  const viewInvoice = async (inv: Invoice) => {
    const res = await fetch(`/api/invoices/${inv.id}`);
    const data = await res.json();
    setSelectedInvoice(data.invoice);
    setSelectedItems(data.items);
    setDetailOpen(true);
  };

  const promptDelete = (inv: Invoice) => {
    setInvoiceToDelete(inv);
    setDeleteConfirmText('');
    setDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (!invoiceToDelete) return;
    setDeleting(true);
    try {
      await fetch(`/api/invoices/${invoiceToDelete.id}`, { method: 'DELETE' });
      toast.success(t('Invoice deleted permanently') || 'Invoice deleted permanently');
      setDeleteOpen(false);
      fetchInvoices();
    } catch {
      toast.error(t('Failed to delete invoice') || 'Failed to delete invoice');
    } finally {
      setDeleting(false);
    }
  };

  /*
   * A4 dimensions at 96 DPI:
   *   210mm = 794px wide,  297mm = 1123px tall
   *
   * Steps:
   *  1. Unlock every scrollable/clipping ancestor (dialog, modals)
   *  2. Force the billRef div to exact A4 size
   *  3. Force the inner invoice table to fill (A4 height − padding)
   *  4. Wait 2 rAFs for a full browser reflow
   *  5. Capture at 2× pixel ratio → crisp 1588×2246 px image
   *  6. Always restore original styles (even on error)
   */
  const A4_W_PX = 794;
  const A4_H_PX = 1123;

  const forceA4AndCapture = async (
    fmt: 'png' | 'jpeg',
    quality = 0.95
  ): Promise<string> => {
    const node = billRef.current!;

    // 1. Unlock every scrolling/clipping ancestor
    const ancestors: Array<{ el: HTMLElement; mh: string; ov: string; oy: string }> = [];
    let anc: HTMLElement | null = node.parentElement;
    while (anc && anc !== document.body) {
      const cs = window.getComputedStyle(anc);
      if (cs.overflow !== 'visible' || cs.overflowY !== 'visible' ||
          (cs.maxHeight !== 'none' && cs.maxHeight !== '')) {
        ancestors.push({ el: anc, mh: anc.style.maxHeight, ov: anc.style.overflow, oy: anc.style.overflowY });
        anc.style.maxHeight = 'none';
        anc.style.overflow  = 'visible';
        anc.style.overflowY = 'visible';
      }
      anc = anc.parentElement;
    }

    // 2. Force the bill node to exact A4 pixels
    const sNode = {
      width: node.style.width, minWidth: node.style.minWidth,
      height: node.style.height, minHeight: node.style.minHeight,
      maxHeight: node.style.maxHeight, overflow: node.style.overflow,
    };
    node.style.width    = `${A4_W_PX}px`;
    node.style.minWidth = `${A4_W_PX}px`;
    node.style.height   = `${A4_H_PX}px`;
    node.style.minHeight = `${A4_H_PX}px`;
    node.style.maxHeight = `${A4_H_PX}px`;
    node.style.overflow  = 'hidden';

    // 3. Force the inner invoice table to fill the A4 height
    //    billRef has p-6 padding (24px * 2 = 48px total vertical)
    const table = node.querySelector('.invoice-items-table') as HTMLElement | null;
    const sTable = table ? table.style.height : '';
    if (table) table.style.height = `${A4_H_PX - 48}px`;

    // 4. Two animation frames → full reflow
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

    const restore = () => {
      Object.assign(node.style, sNode);
      if (table) table.style.height = sTable;
      for (const { el, mh, ov, oy } of ancestors) {
        el.style.maxHeight  = mh;
        el.style.overflow   = ov;
        el.style.overflowY  = oy;
      }
    };

    try {
      const lib = await import('html-to-image');
      const fn  = fmt === 'png' ? lib.toPng : lib.toJpeg;
      const url = await fn(node, {
        backgroundColor: '#ffffff',
        pixelRatio: 2,
        width:  A4_W_PX,
        height: A4_H_PX,
        quality,
      });
      restore();
      return url;
    } catch (err) {
      restore();
      throw err;
    }
  };

  /* ── Download as A4 PDF ── */
  const exportPDF = async () => {
    if (!billRef.current) return;
    const tid = toast.loading(t('Generating A4 PDF…') || 'Generating A4 PDF…');
    try {
      const img = await forceA4AndCapture('png');
      const mod = await import('jspdf');
      const JsPDF = (mod.jsPDF ?? mod.default ?? mod) as any;
      const pdf  = new JsPDF('p', 'mm', [210, 297]);
      pdf.addImage(img, 'PNG', 0, 0, 210, 297);
      pdf.save(`${selectedInvoice?.invoice_number || 'invoice'}.pdf`);
      toast.success(t('PDF saved — A4 size ✓') || 'PDF saved — A4 size ✓', { id: tid });
    } catch (e) {
      console.error(e);
      toast.error(t('PDF export failed.') || 'PDF export failed.', { id: tid });
    }
  };

  /* ── Download as A4 JPG ── */
  const exportJPG = async () => {
    if (!billRef.current) return;
    const tid = toast.loading(t('Generating JPG…') || 'Generating JPG…');
    try {
      const url  = await forceA4AndCapture('jpeg', 0.95);
      const link = document.createElement('a');
      link.download = `${selectedInvoice?.invoice_number || 'invoice'}.jpg`;
      link.href = url;
      link.click();
      toast.success(t('JPG saved — A4 size ✓') || 'JPG saved — A4 size ✓', { id: tid });
    } catch (e) {
      console.error(e);
      toast.error(t('JPG export failed.') || 'JPG export failed.', { id: tid });
    }
  };

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n);

  const shareFromRow = async (inv: Invoice) => {
    await viewInvoice(inv);
    setTimeout(async () => {
      await shareOnWhatsApp(inv);
    }, 500);
  };

  const shareOnWhatsApp = async (inv: Invoice | null) => {
    if (!inv) return;
    if (!inv.customer_phone) {
      toast.error(t('No phone number attached to this invoice.') || 'No phone number attached to this invoice.');
      return;
    }

    const toastId = toast.loading(t('Sending invoice details via WhatsApp...') || 'Sending invoice details via WhatsApp...');
    try {
      const store = (inv as any).store_name || settings?.store_name || "Store";
      const template = settings[`wa_message_template_${language}`] || settings.wa_message_template || (language === 'mr'
        ? `नमस्कार {{customer_name}},\n\nतुमचे {{total_amount}} चे बिल {{store_name}} येथे तयार आहे.\nबिल क्रमांक: {{invoice_number}}\nतारीख: {{date}}\n\nभेट दिल्याबद्दल धन्यवाद!`
        : `Hello {{customer_name}},\n\nYour invoice #{{invoice_number}} for Rs. {{total_amount}} has been generated at {{store_name}}.\n\nThank you for shopping with us!`);
        
      const text = template
        .replace(/\{\{customer_name\}\}/g, inv.customer_name || 'Customer')
        .replace(/\{\{invoice_number\}\}/g, inv.invoice_number)
        .replace(/\{\{total_amount\}\}/g, inv.total_amount.toString())
        .replace(/\{\{store_name\}\}/g, store)
        .replace(/\{\{date\}\}/g, format(new Date(inv.created_at.replace(' ', 'T') + 'Z'), 'dd MMM yyyy'));
      
      const cleanPhone = inv.customer_phone.replace(/\D/g, '');
      
      let mediaBase64 = null;
      let fileName = null;
      if (billRef.current) {
        try {
          const img = await forceA4AndCapture('jpeg', 0.95);
          const mod = await import('jspdf');
          const JsPDF = (mod.jsPDF ?? mod.default ?? mod) as any;
          const pdf  = new JsPDF('p', 'mm', [210, 297]);
          pdf.addImage(img, 'JPEG', 0, 0, 210, 297);
          mediaBase64 = pdf.output('datauristring').split(',')[1];
          fileName = `${inv.invoice_number || 'invoice'}.pdf`;
        } catch (e) {
          console.error("Failed to generate PDF for attachment:", e);
        }
      }

      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: cleanPhone, message: text, mediaBase64, fileName })
      });
      
      if (!res.ok) {
        throw new Error('Failed to send via background integration');
      }
      toast.success(t('Invoice details sent automatically via WhatsApp!') || 'Invoice details sent automatically via WhatsApp!', { id: toastId });
    } catch (error) {
      console.error('Share Error:', error);
      toast.error(t('Failed to send WhatsApp message.') || 'Failed to send WhatsApp message.', { id: toastId });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('Invoices')}</h1>
        <p className="text-muted-foreground">{t('View and manage all your bills')}</p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder={t('Search by invoice # or customer...')} className="pl-10"
                value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder={t('All Status')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('All Status')}</SelectItem>
                <SelectItem value="paid">{t('Paid')}</SelectItem>
                <SelectItem value="unpaid">{t('Unpaid')}</SelectItem>
                <SelectItem value="partial">{t('Partial')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Invoices Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" /> {t('Invoices')} ({invoices.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
          ) : invoices.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-lg font-medium">{t('No invoices found')}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('Invoice No.')}</TableHead>
                  <TableHead>{t('Customer')}</TableHead>
                  <TableHead>{t('Date')}</TableHead>
                  <TableHead>{t('Payment')}</TableHead>
                  <TableHead className="text-right">{t('Amount')}</TableHead>
                  <TableHead>{t('Status')}</TableHead>
                  <TableHead className="text-right">{t('Actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">{inv.invoice_number}</TableCell>
                    <TableCell>{inv.customer_name}</TableCell>
                    <TableCell>{format(new Date(inv.created_at.replace(' ', 'T') + 'Z'), 'dd MMM yyyy')}</TableCell>
                    <TableCell className="capitalize">{inv.payment_method}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(inv.total_amount)}</TableCell>
                    <TableCell>
                      <Badge variant={inv.payment_status === 'paid' ? 'secondary' : inv.payment_status === 'unpaid' ? 'destructive' : 'outline'}
                        className={inv.payment_status === 'paid' ? 'bg-green-100 text-green-700' : ''}>
                        {inv.payment_status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon-sm" variant="ghost" onClick={() => shareFromRow(inv)} title="Share on WhatsApp">
                          <MessageCircle className="h-4 w-4 text-green-600" />
                        </Button>
                        <Button size="icon-sm" variant="ghost" onClick={() => router.push(`/billing?edit=${inv.id}`)} title="Edit">
                          <Edit className="h-4 w-4 text-blue-600" />
                        </Button>
                        <Button size="icon-sm" variant="ghost" onClick={() => viewInvoice(inv)} title="View">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button size="icon-sm" variant="ghost" onClick={() => promptDelete(inv)} title="Delete">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Invoice Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Invoice {selectedInvoice?.invoice_number}</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="text-green-600 border-green-200 hover:bg-green-50" onClick={() => shareOnWhatsApp(selectedInvoice)}>
                  <MessageCircle className="mr-1 h-3 w-3" /> WhatsApp
                </Button>
                <Button size="sm" variant="outline" onClick={exportPDF}>
                  <Download className="mr-1 h-3 w-3" /> PDF
                </Button>
                <Button size="sm" variant="outline" onClick={exportJPG}>
                  <Image className="mr-1 h-3 w-3" /> JPG
                </Button>
              </div>
            </DialogTitle>
          </DialogHeader>

          {/* Printable Bill Content */}
          <div ref={billRef} className={settings.invoice_theme === 'thermal' ? "bg-white p-6 mx-auto w-[300px]" : "bg-white p-6 border border-gray-300 mt-4 text-black w-full"}>
            {settings.invoice_theme === 'thermal' ? (
              /* THERMAL RECEIPT LAYOUT */
              <div className="font-mono text-sm leading-tight text-black pb-8 shrink-0">
                <div className="text-center mb-4">
                  <h2 className="font-bold text-lg uppercase">{selectedInvoice?.store_name || settings.store_name}</h2>
                  {settings.store_address && <p className="text-xs mt-1 whitespace-pre-line">{settings.store_address}</p>}
                  {settings.store_phone && <p className="text-xs">PHONE : {settings.store_phone}</p>}
                  {settings.store_gstin && <p className="text-xs">GSTIN : {settings.store_gstin}</p>}
                </div>
                <div className="text-center font-bold mb-4">
                  <p>{selectedInvoice?.gst_enabled === 1 ? t('Tax Invoice') : t('Retail Invoice')}</p>
                </div>
                <div className="mb-4">
                  {selectedInvoice && <p>Date : {format(new Date(selectedInvoice.created_at.replace(' ', 'T') + 'Z'), 'dd/MM/yyyy, hh:mm a')}</p>}
                  <p className="font-bold mt-2">{selectedInvoice?.customer_name}</p>
                  {selectedInvoice?.customer_gstin && <p>GSTIN: {selectedInvoice.customer_gstin}</p>}
                  <p>Bill No: {selectedInvoice?.invoice_number}</p>
                  <p>Payment Mode: {selectedInvoice?.payment_method}</p>
                </div>
                <div className="border-t border-b border-dashed border-black py-1 mb-2">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-dashed border-black">
                        <th className="text-left font-bold pb-1 w-2/5">{t('Item')}</th>
                        <th className="text-center font-bold pb-1 w-1/5">{t('Qty')}</th>
                        <th className="text-right font-bold pb-1 w-1/5">{t('Rate')}</th>
                        <th className="text-right font-bold pb-1 w-1/5">{t('Amt')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedItems.map((item) => (
                        <tr key={item.id}>
                          <td className="py-1 break-words align-top pr-1">{item.product_name}</td>
                          <td className="py-1 text-center align-top">{item.quantity}</td>
                          <td className="py-1 text-right align-top">{item.price.toFixed(2)}</td>
                          <td className="py-1 text-right align-top">{(item.taxable_amount || item.total).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-between mb-1">
                  <span>{t('Sub Total')}</span>
                  <span>{(selectedInvoice?.taxable_amount || selectedInvoice?.subtotal || 0).toFixed(2)}</span>
                </div>
                {(selectedInvoice?.discount_amount || 0) > 0 && (
                  <div className="flex justify-between mb-1">
                    <span>(-) {t('Discount')}</span>
                    <span>{selectedInvoice?.discount_amount.toFixed(2)}</span>
                  </div>
                )}
                {selectedInvoice?.gst_enabled === 1 && (
                  <div className="text-xs space-y-0.5 mb-1">
                    {selectedInvoice.is_igst !== 1 ? (
                      <>
                        <div className="flex justify-between"><span>CGST</span><span>{(selectedInvoice.cgst_amount || 0).toFixed(2)}</span></div>
                        <div className="flex justify-between"><span>SGST</span><span>{(selectedInvoice.sgst_amount || 0).toFixed(2)}</span></div>
                      </>
                    ) : (
                      <div className="flex justify-between"><span>IGST</span><span>{(selectedInvoice.igst_amount || 0).toFixed(2)}</span></div>
                    )}
                  </div>
                )}
                {(selectedInvoice?.round_off || 0) !== 0 && (
                  <div className="flex justify-between mb-1 text-xs">
                    <span>R/off</span>
                    <span>{((selectedInvoice?.round_off || 0) > 0 ? '+' : '')}{(selectedInvoice?.round_off || 0).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-dashed border-black pt-1 font-bold mb-4">
                  <span>TOTAL</span>
                  <span>Rs {selectedInvoice?.total_amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-b border-dashed border-black pb-2 mb-4">
                  <span>{selectedInvoice?.payment_method} :</span>
                  <span>Rs {(selectedInvoice?.amount_paid || selectedInvoice?.total_amount || 0).toFixed(2)}</span>
                </div>
                <div className="text-xs mb-4 font-bold">
                  <p>{selectedInvoice ? amountInWords(selectedInvoice.total_amount, language) : ''}</p>
                </div>
                <div className="text-right text-xs font-bold mt-8"><p>E & O.E</p></div>
                <div className="text-center text-xs mt-4"><p>{t('Thank you for visiting!')}</p></div>
              </div>
            ) : (
              /* PROFESSIONAL A4 LAYOUT */
              <div style={{ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '11px' }} className="text-black bg-white">
                <table className="invoice-items-table border-collapse w-full" style={{ borderCollapse: 'collapse' }}>
                  <tbody>
                    {/* Company Header */}
                    <tr style={{ height: '1px' }}>
                      <td colSpan={9} className="border border-black p-0">
                        <div className="flex-1 text-center py-3 px-4">
                          <h1 className="font-bold text-xl uppercase tracking-wide">{selectedInvoice?.store_name || settings.store_name || 'Store'}</h1>
                          {settings.store_address && <p className="text-[11px] mt-0.5">{settings.store_address}</p>}
                          {settings.store_fssai && <p className="text-[11px]">Fssai No.{settings.store_fssai}</p>}
                          {settings.store_phone && <p className="text-[11px]">Contact : {settings.store_phone}</p>}
                          {settings.store_gstin && <p className="text-[11px] font-bold">GSTIN : {settings.store_gstin}</p>}
                        </div>
                      </td>
                    </tr>

                    {/* Invoice Type */}
                    <tr style={{ height: '1px' }}>
                      <td colSpan={9} className="border border-black p-0">
                        <div className="flex justify-between items-center px-2 py-1">
                          <span></span>
                          <span className="font-bold text-sm">{selectedInvoice?.gst_enabled === 1 ? t('Tax Invoice').toUpperCase() : t('Bill of Supply').toUpperCase()}</span>
                          <span className="text-[10px] font-bold">(ORIGINAL FOR RECIPIENT)</span>
                        </div>
                      </td>
                    </tr>

                    {/* Buyer + Invoice Details */}
                    <tr style={{ height: '1px' }}>
                      <td colSpan={5} className="border border-black p-0 align-top" style={{ width: '55%' }}>
                        <div className="p-1.5 text-[10px] leading-tight">
                          <p className="font-bold text-[9px]">{t('Buyer')} :</p>
                          <p className="font-bold ml-1 text-[11px]">{selectedInvoice?.customer_name}</p>
                          {selectedInvoice?.customer_address && <p className="ml-1 text-[10px]">{selectedInvoice.customer_address}</p>}
                          {selectedInvoice?.customer_phone && <p className="ml-1 font-bold text-[10px]">Mob : {selectedInvoice.customer_phone}</p>}
                          {selectedInvoice?.customer_gstin && <p className="ml-1 font-bold text-[10px]">GST No : {selectedInvoice.customer_gstin}</p>}
                        </div>
                      </td>
                      <td colSpan={4} className="border border-black p-0 align-top" style={{ width: '45%' }}>
                        <table className="w-full text-[10px] border-collapse">
                          <tbody>
                            <tr className="border-b border-black">
                              <td className="font-bold p-1 px-2 border-r border-black whitespace-nowrap">{t('Invoice No.')}</td>
                              <td className="font-bold p-1 px-2">{selectedInvoice?.invoice_number}</td>
                            </tr>
                            <tr className="border-b border-black">
                              <td className="font-bold p-1 px-2 border-r border-black whitespace-nowrap">{t('Date')}</td>
                              <td className="font-bold p-1 px-2">{selectedInvoice && format(new Date(selectedInvoice.created_at.replace(' ', 'T') + 'Z'), 'dd-MMM-yy')}</td>
                            </tr>
                            <tr className="border-b border-black">
                              <td className="font-bold p-1 px-2 border-r border-black whitespace-nowrap">{t('Vehicle No.')}</td>
                              <td className="p-1 px-2"></td>
                            </tr>
                            <tr>
                              <td className="font-bold p-1 px-2 border-r border-black whitespace-nowrap">{t('Time')}</td>
                              <td className="p-1 px-2 font-bold">{selectedInvoice && format(new Date(selectedInvoice.created_at.replace(' ', 'T') + 'Z'), 'HH:mm:ss')}</td>
                            </tr>
                          </tbody>
                        </table>
                      </td>
                    </tr>

                    {/* Items Header */}
                    <tr className="font-bold border border-black" style={{ fontSize: '10px', height: '1px' }}>
                      <td className="border border-black p-1 text-center" style={{ width: '25px' }}>{t('SI No')}</td>
                      <td className="border border-black p-1" style={{ width: '35%' }}>{t('Particulars')}</td>
                      <td className="border border-black p-1 text-center" style={{ width: '55px' }}>HSN/SAC</td>
                      <td className="border border-black p-1 text-center" style={{ width: '30px' }}>GST %</td>
                      <td className="border border-black p-1 text-center" style={{ width: '40px' }}>{t('BAG')}</td>
                      <td className="border border-black p-1 text-center" style={{ width: '65px' }}>{t('KG')}</td>
                      <td className="border border-black p-1 text-center" style={{ width: '45px' }}>{t('Tax Incl')}</td>
                      <td className="border border-black p-1 text-center" style={{ width: '50px' }}>{t('Rate')}</td>
                      <td className="border border-black p-1 text-right" style={{ width: '80px' }}>{t('Net Value')}</td>
                    </tr>

                    {/* Items Rows */}
                    {selectedItems.map((item, idx) => {
                      const bagUnits = new Set(['bag', 'pcs', 'box', 'pack', 'dozen', 'feet', 'meter', 'sqft', 'ltr', 'ml']);
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
                        <td className="border-r border-black p-1 text-center"></td>
                        <td className="border-r border-black p-1 text-right">{item.price.toFixed(2)}</td>
                        <td className="border-l border-r border-black p-1 text-right">{(item.taxable_amount || item.total).toFixed(2)}</td>
                      </tr>
                      );
                    })}

                    {/* Spacer row — fills remaining A4 space */}
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

                    {/* Discount A/c */}
                    <tr style={{ fontSize: '10px', height: '1px' }}>
                      <td className="border-l border-r border-black p-1"></td>
                      <td className="border-r border-black p-1 text-center font-bold">Discount A/c</td>
                      <td className="border-r border-black p-1"></td><td className="border-r border-black p-1"></td>
                      <td className="border-r border-black p-1"></td><td className="border-r border-black p-1"></td>
                      <td className="border-r border-black p-1"></td><td className="border-r border-black p-1"></td>
                      <td className="border-l border-r border-black p-1 text-right">{(selectedInvoice?.discount_amount || 0) > 0 ? (selectedInvoice?.discount_amount || 0).toFixed(2) : ''}</td>
                    </tr>
                    {/* Hamali */}
                    <tr style={{ fontSize: '10px', height: '1px' }}>
                      <td className="border-l border-r border-black p-1"></td>
                      <td className="border-r border-black p-1 text-center font-bold">Hamali</td>
                      <td className="border-r border-black p-1"></td><td className="border-r border-black p-1"></td>
                      <td className="border-r border-black p-1"></td><td className="border-r border-black p-1"></td>
                      <td className="border-r border-black p-1"></td><td className="border-r border-black p-1"></td>
                      <td className="border-l border-r border-black p-1 text-right">{(selectedInvoice?.hamali || 0) > 0 ? (selectedInvoice?.hamali || 0).toFixed(2) : ''}</td>
                    </tr>
                    {/* Market Cess */}
                    <tr style={{ fontSize: '10px', height: '1px' }}>
                      <td className="border-l border-r border-black p-1"></td>
                      <td className="border-r border-black p-1 text-center font-bold">Market Cess</td>
                      <td className="border-r border-black p-1"></td><td className="border-r border-black p-1"></td>
                      <td className="border-r border-black p-1"></td><td className="border-r border-black p-1"></td>
                      <td className="border-r border-black p-1"></td><td className="border-r border-black p-1"></td>
                      <td className="border-l border-r border-black p-1 text-right">{(selectedInvoice?.market_cess || 0) > 0 ? (selectedInvoice?.market_cess || 0).toFixed(2) : ''}</td>
                    </tr>
                    {/* OTHER EXP. */}
                    <tr style={{ fontSize: '10px', height: '1px' }}>
                      <td className="border-l border-r border-black p-1"></td>
                      <td className="border-r border-black p-1 text-center font-bold">OTHER EXP.</td>
                      <td className="border-r border-black p-1"></td><td className="border-r border-black p-1"></td>
                      <td className="border-r border-black p-1"></td><td className="border-r border-black p-1"></td>
                      <td className="border-r border-black p-1"></td><td className="border-r border-black p-1"></td>
                      <td className="border-l border-r border-black p-1 text-right">{(selectedInvoice?.other_exp || 0) > 0 ? (selectedInvoice?.other_exp || 0).toFixed(2) : ''}</td>
                    </tr>
                    {/* C GST */}
                    <tr style={{ fontSize: '10px', height: '1px' }}>
                      <td className="border-l border-r border-black p-1"></td>
                      <td className="border-r border-black p-1 text-center font-bold">C GST</td>
                      <td className="border-r border-black p-1"></td><td className="border-r border-black p-1"></td>
                      <td className="border-r border-black p-1"></td><td className="border-r border-black p-1"></td>
                      <td className="border-r border-black p-1"></td><td className="border-r border-black p-1"></td>
                      <td className="border-l border-r border-black p-1 text-right">{selectedInvoice?.gst_enabled === 1 && selectedInvoice.is_igst !== 1 && (selectedInvoice.cgst_amount || 0) > 0 ? (selectedInvoice.cgst_amount || 0).toFixed(2) : ''}</td>
                    </tr>
                    {/* S GST */}
                    <tr style={{ fontSize: '10px', height: '1px' }}>
                      <td className="border-l border-r border-black p-1"></td>
                      <td className="border-r border-black p-1 text-center font-bold">S GST</td>
                      <td className="border-r border-black p-1"></td><td className="border-r border-black p-1"></td>
                      <td className="border-r border-black p-1"></td><td className="border-r border-black p-1"></td>
                      <td className="border-r border-black p-1"></td><td className="border-r border-black p-1"></td>
                      <td className="border-l border-r border-black p-1 text-right">{selectedInvoice?.gst_enabled === 1 && selectedInvoice.is_igst !== 1 && (selectedInvoice.sgst_amount || 0) > 0 ? (selectedInvoice.sgst_amount || 0).toFixed(2) : ''}</td>
                    </tr>
                    {/* I GST */}
                    <tr style={{ fontSize: '10px', height: '1px' }}>
                      <td className="border-l border-r border-black p-1"></td>
                      <td className="border-r border-black p-1 text-center font-bold">I GST</td>
                      <td className="border-r border-black p-1"></td><td className="border-r border-black p-1"></td>
                      <td className="border-r border-black p-1"></td><td className="border-r border-black p-1"></td>
                      <td className="border-r border-black p-1"></td><td className="border-r border-black p-1"></td>
                      <td className="border-l border-r border-black p-1 text-right">{selectedInvoice?.gst_enabled === 1 && selectedInvoice.is_igst === 1 && (selectedInvoice.igst_amount || 0) > 0 ? (selectedInvoice.igst_amount || 0).toFixed(2) : ''}</td>
                    </tr>
                    {/* R/off */}
                    <tr style={{ fontSize: '10px', height: '1px' }}>
                      <td className="border-l border-r border-black p-1"></td>
                      <td className="border-r border-black p-1 text-center font-bold">R/off</td>
                      <td className="border-r border-black p-1"></td><td className="border-r border-black p-1"></td>
                      <td className="border-r border-black p-1"></td><td className="border-r border-black p-1"></td>
                      <td className="border-r border-black p-1"></td><td className="border-r border-black p-1"></td>
                      <td className="border-l border-r border-black p-1 text-right">{(selectedInvoice?.round_off || 0) !== 0 ? (selectedInvoice?.round_off || 0).toFixed(2) : ''}</td>
                    </tr>

                    {/* TOTAL ROW */}
                    <tr className="font-bold border border-black" style={{ fontSize: '10px', height: '1px' }}>
                      <td className="border border-black p-1"></td>
                      <td className="border border-black p-1">{t('Total :')}</td>
                      <td className="border border-black p-1"></td>
                      <td className="border border-black p-1"></td>
                      <td className="border border-black p-1 text-center">
                        {(() => {
                           const bagU = new Set(['bag', 'pcs', 'box', 'pack', 'dozen', 'feet', 'meter', 'sqft', 'ltr', 'ml']);
                           const totalBags = selectedItems.reduce((a, c) => a + (bagU.has((c.unit || '').toLowerCase()) ? c.quantity : 0), 0);
                           return totalBags > 0 ? totalBags : '';
                        })()}
                      </td>
                      <td className="border border-black p-1 text-right">
                        {(() => {
                           const bagU = new Set(['bag', 'pcs', 'box', 'pack', 'dozen', 'feet', 'meter', 'sqft', 'ltr', 'ml']);
                           const totalKg = selectedItems.reduce((a, c) => {
                             const u = (c.unit || '').toLowerCase();
                             if (bagU.has(u) && Number(c.weight_kg) > 0) return a + (c.quantity * Number(c.weight_kg));
                             if (u === 'kg') return a + c.quantity;
                             if (u === 'g') return a + c.quantity / 1000;
                             return a;
                           }, 0);
                           return totalKg > 0 ? totalKg.toFixed(3) : '';
                        })()}
                      </td>
                      <td className="border border-black p-1"></td>
                      <td className="border border-black p-1"></td>
                      <td className="border border-black p-1 text-right">{selectedInvoice?.total_amount.toFixed(2)}</td>
                    </tr>

                    {/* HSN/SAC Summary Section */}
                    {selectedInvoice?.gst_enabled === 1 && (
                      <tr style={{ fontSize: '9px' }}>
                        <td colSpan={9} className="border border-black p-0">
                          <table className="w-full border-collapse">
                            <thead>
                              <tr className="border-b border-black font-bold bg-gray-50">
                                <td className="p-1 border-r border-black text-center" style={{ width: '15%' }}>HSN/SAC</td>
                                <td className="p-1 border-r border-black text-right" style={{ width: '15%' }}>{t('Taxable Value')}</td>
                                {selectedInvoice.is_igst !== 1 ? (
                                  <>
                                    <td className="p-1 border-r border-black text-center" colSpan={2}>Central Tax</td>
                                    <td className="p-1 border-r border-black text-center" colSpan={2}>State Tax</td>
                                  </>
                                ) : (
                                  <td className="p-1 border-r border-black text-center" colSpan={2}>Integrated Tax</td>
                                )}
                                <td className="p-1 text-right" style={{ width: '15%' }}>{t('Total Tax')}</td>
                              </tr>
                              <tr className="border-b border-black font-bold text-[8px]">
                                <td className="border-r border-black"></td><td className="border-r border-black"></td>
                                {selectedInvoice.is_igst !== 1 ? (
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
                                selectedItems.forEach(item => {
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
                                    {selectedInvoice.is_igst !== 1 ? (
                                      <>
                                        <td className="p-1 border-r border-black text-center">{(row.rate/2).toFixed(1)}%</td><td className="p-1 border-r border-black text-right">{row.cgst.toFixed(2)}</td>
                                        <td className="p-1 border-r border-black text-center">{(row.rate/2).toFixed(1)}%</td><td className="p-1 border-r border-black text-right">{row.sgst.toFixed(2)}</td>
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

                    {/* Amount in Words + Bank Details */}
                    <tr style={{ fontSize: '10px', height: '1px' }}>
                      <td colSpan={5} className="border border-black p-2 align-top">
                        <p className="font-bold mb-1">{t('Amount in Words')} :</p>
                        <p className="font-bold">{selectedInvoice ? amountInWords(selectedInvoice.total_amount, language) : ''}</p>
                      </td>
                      <td colSpan={3} className="border border-black p-0 align-top">
                        <table className="w-full text-[10px] border-collapse">
                          <tbody>
                            {settings.bank_name && <tr><td className="font-bold p-1 whitespace-nowrap">Bank Name</td><td className="font-bold p-1">:</td><td className="p-1 font-bold">{settings.bank_name}</td></tr>}
                            {settings.bank_account_no && <tr><td className="font-bold p-1 whitespace-nowrap">A/c No.</td><td className="font-bold p-1">:</td><td className="p-1 font-bold">{settings.bank_account_no}</td></tr>}
                            {settings.bank_branch && <tr><td className="font-bold p-1 whitespace-nowrap">Branch</td><td className="font-bold p-1">:</td><td className="p-1 font-bold">{settings.bank_branch}</td></tr>}
                            {settings.bank_ifsc && <tr><td className="font-bold p-1 whitespace-nowrap">IFSC Code</td><td className="font-bold p-1">:</td><td className="p-1 font-bold">{settings.bank_ifsc}</td></tr>}
                          </tbody>
                        </table>
                      </td>
                      <td colSpan={1} className="border border-black p-1 align-bottom text-right">
                        <div className="font-bold text-[11px] pb-1 pr-1 whitespace-nowrap">
                          For {selectedInvoice?.store_name || settings.store_name || 'Store'}
                        </div>
                      </td>
                    </tr>

                    {/* Certification */}
                    <tr style={{ height: '1px' }}>
                      <td colSpan={9} className="border border-black p-1">
                        <p className="text-[8px] italic text-center">
                          I/We here by certify that food / foods mentioned in this invoice is / are warranted to be of the nature & quality which it / these purports / purport to be at the time of delivery
                        </p>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              {t('Delete Invoice')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-red-50 text-red-800 p-4 rounded-md text-sm border border-red-200">
              <p className="font-bold mb-1">Warning: This action cannot be undone.</p>
              <p>{t('Deleting this invoice will permanently remove it from the system, automatically reverse the stock deductions, and update the customer\'s balance back to what it was.')}</p>
            </div>

            <div className="space-y-2">
              <Label>
                Please type <strong className="select-none">{invoiceToDelete?.invoice_number}</strong> to confirm.
              </Label>
              <Input
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder={invoiceToDelete?.invoice_number}
                className="mt-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleting || deleteConfirmText !== invoiceToDelete?.invoice_number}
            >
              {deleting ? 'Deleting...' : 'Permanently Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
