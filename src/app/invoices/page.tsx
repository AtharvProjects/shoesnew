/**
 * Invoices Page — List all invoices, view details, export to PDF/JPG
 * Uses jspdf + html2canvas for export functionality.
 */

'use client';

import { amountInWords } from '@/lib/gst-utils';
import InvoiceTemplate from '@/app/components/InvoiceTemplate';

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
   * 1. Unlock every scrollable/clipping ancestor (dialog, modals)
   * 2. Force the billRef div to natural height
   * 3. Wait 2 rAFs for a full browser reflow
   * 4. Capture at 2× pixel ratio
   * 5. Always restore original styles (even on error)
   */
  const captureDynamicHeight = async (fmt: 'png'|'jpeg' = 'png', quality = 1) => {
    const node = billRef.current;
    if (!node) throw new Error('No bill ref');

    const A4_W_PX = 794; // 210mm at 96dpi

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

    // 2. Force the bill node to exact A4 width, but natural height
    const sNode = {
      width: node.style.width, minWidth: node.style.minWidth,
      height: node.style.height, minHeight: node.style.minHeight,
      maxHeight: node.style.maxHeight, overflow: node.style.overflow,
      margin: node.style.margin, padding: node.style.padding
    };
    node.style.width    = `${A4_W_PX}px`;
    node.style.minWidth = `${A4_W_PX}px`;
    node.style.height   = 'max-content';
    node.style.maxHeight = 'none';
    node.style.overflow  = 'visible';
    node.style.margin    = '0'; // Prevent centering from shifting capture bounds

    // 3. Let the inner table define its own height
    const table = node.querySelector('.invoice-items-table') as HTMLElement | null;
    const sTable = table ? table.style.height : '';
    if (table) table.style.height = 'max-content';

    // 4. Two animation frames → full reflow
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

    // Get the actual height after reflow
    const actualHeight = node.getBoundingClientRect().height;

    // 5. Scroll to top to prevent html-to-image from clipping the top header
    const originalScrollY = window.scrollY;
    const originalScrollX = window.scrollX;
    window.scrollTo(0, 0);

    const restore = () => {
      Object.assign(node.style, sNode);
      if (table) table.style.height = sTable;
      for (const { el, mh, ov, oy } of ancestors) {
        el.style.maxHeight  = mh;
        el.style.overflow   = ov;
        el.style.overflowY  = oy;
      }
      window.scrollTo(originalScrollX, originalScrollY);
    };

    try {
      const lib = await import('html-to-image');
      const fn  = fmt === 'png' ? lib.toPng : lib.toJpeg;
      const url = await fn(node, {
        backgroundColor: '#ffffff',
        pixelRatio: 2,
        width:  A4_W_PX,
        height: actualHeight,
        quality,
      });
      restore();
      return { url, actualHeight, width: A4_W_PX };
    } catch (err) {
      restore();
      throw err;
    }
  };

  /* ── Download as PDF ── */
  const exportPDF = async () => {
    if (!billRef.current) return;
    const tid = toast.loading(t('Generating PDF…') || 'Generating PDF…');
    try {
      const { url: img, actualHeight, width } = await captureDynamicHeight('png');
      const mod = await import('jspdf');
      const JsPDF = (mod.jsPDF ?? mod.default ?? mod) as any;
      
      const pdfWidth = 210; // A4 width
      const pdfHeight = Math.max((actualHeight * pdfWidth) / width, 100);
      
      const pdf = new JsPDF({
        orientation: 'p',
        unit: 'mm',
        format: [pdfWidth, pdfHeight]
      });
      pdf.addImage(img, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`${selectedInvoice?.invoice_number || 'invoice'}.pdf`);
      toast.success(t('PDF saved ✓') || 'PDF saved ✓', { id: tid });
    } catch (e) {
      console.error(e);
      toast.error(t('PDF export failed.') || 'PDF export failed.', { id: tid });
    }
  };

  /* ── Download as JPG ── */
  const exportJPG = async () => {
    if (!billRef.current) return;
    const tid = toast.loading(t('Generating JPG…') || 'Generating JPG…');
    try {
      const { url } = await captureDynamicHeight('jpeg', 0.95);
      const link = document.createElement('a');
      link.download = `${selectedInvoice?.invoice_number || 'invoice'}.jpg`;
      link.href = url;
      link.click();
      toast.success(t('JPG saved ✓') || 'JPG saved ✓', { id: tid });
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
      try {
        const iframe = document.createElement('iframe');
        iframe.style.position = 'absolute';
        iframe.style.width = '1000px'; 
        iframe.style.height = '1414px';
        iframe.style.top = '-9999px';
        iframe.style.left = '-9999px';
        
        iframe.src = `/invoices/print/${inv.id}?noprint=true`;
        document.body.appendChild(iframe);
        
        let printArea: HTMLElement | null = null;
        let iframeDoc: Document | null = null;
        
        // Poll for up to 5 seconds to find print-area
        for (let i = 0; i < 50; i++) {
          await new Promise(r => setTimeout(r, 100));
          try {
            iframeDoc = iframe.contentDocument || iframe.contentWindow?.document || null;
            printArea = iframeDoc?.getElementById('print-area') || null;
            if (printArea) {
              // Found it! Wait an additional 1 second for images/fonts to settle
              await new Promise(r => setTimeout(r, 1000));
              break;
            }
          } catch (e) {
            // Ignore potential cross-origin access errors during initial load
          }
        }
        
          if (printArea && iframeDoc) {
          // Clone the print area into the main document to avoid cross-iframe issues with html2canvas
          const clone = printArea.cloneNode(true) as HTMLElement;
          clone.style.position = 'absolute';
          clone.style.top = '0px';
          clone.style.left = '0px';
          clone.style.margin = '0px';
          clone.style.padding = '0px';
          clone.style.width = '794px'; // 210mm at 96dpi
          clone.style.zIndex = '-9999';
          clone.style.pointerEvents = 'none';
          
          // Copy all stylesheets from iframe into a <style> block
          const styles = Array.from(iframeDoc.querySelectorAll('style, link[rel="stylesheet"]'));
          const styleContainer = document.createElement('div');
          styleContainer.id = '__pdf-styles__';
          for (const s of styles) {
            styleContainer.appendChild(s.cloneNode(true));
          }
          document.head.appendChild(styleContainer);
          document.body.appendChild(clone);
          
          // Give browser a moment to apply styles
          await new Promise(r => setTimeout(r, 200));

          const html2canvas = (await import('html2canvas-pro')).default;
          const canvas = await html2canvas(clone, {
            scale: 2,
            useCORS: true,
            logging: false,
          });
          
          // Clean up cloned elements
          document.body.removeChild(clone);
          document.head.removeChild(styleContainer);
          
          const imgData = canvas.toDataURL('image/jpeg', 0.95);
          const mod = await import('jspdf');
          const JsPDF = (mod.jsPDF ?? mod.default ?? mod) as any;
          
          const pdfWidth = 210; // Standard A4 width in mm
          // Calculate exact height needed, ensuring a minimum height of 100mm
          const pdfHeight = Math.max((canvas.height * pdfWidth) / canvas.width, 100);
          
          const pdf = new JsPDF({
            orientation: 'p',
            unit: 'mm',
            format: [pdfWidth, pdfHeight]
          });
          
          pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
          mediaBase64 = pdf.output('datauristring').split(',')[1];
          fileName = `${inv.invoice_number || 'invoice'}.pdf`;
        } else {
          console.error("printArea not found inside iframe after 5 seconds.");
          toast.error("Failed to load printable invoice area. Proceeding with message only.");
        }
        document.body.removeChild(iframe);
      } catch (e: any) {
        console.error("Failed to generate PDF for attachment:", e);
        const errStr = e?.message || (typeof e === 'string' ? e : JSON.stringify(e));
        toast.error("Error generating PDF: " + errStr);
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
              <InvoiceTemplate 
                invoice={selectedInvoice as any} 
                items={selectedItems as any} 
                settings={settings} 
                t={t as any} 
              />
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
