/**
 * Reports Page — Sales analytics with date filters
 * Summary, daily breakdown, top products, top customers.
 */

'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart3, IndianRupee, TrendingUp, Download, MessageCircle, UserCheck, FileText } from 'lucide-react';
import { toast } from 'sonner';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { format, subDays } from 'date-fns';
import * as XLSX from 'xlsx';
import jsPDFMod from 'jspdf';
import autoTableMod from 'jspdf-autotable';
import { useLanguage } from '@/components/LanguageProvider';

const jsPDF = (jsPDFMod as any).jsPDF || (jsPDFMod as any).default || jsPDFMod;
const autoTable = (autoTableMod as any).default || autoTableMod;

interface Summary {
  totalSales: number; totalInvoices: number; totalGst: number;
  totalDiscount: number; avgBill: number;
  paymentMethods: { payment_method: string; cnt: number; total: number }[];
}

export default function ReportsPage() {
  const [from, setFrom] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [to, setTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [summary, setSummary] = useState<Summary | null>(null);
  const [daily, setDaily] = useState<{ date: string; total_sales: number; invoice_count: number }[]>([]);
  const [productReport, setProductReport] = useState<{ product_name: string; total_qty: number; total_revenue: number }[]>([]);
  const [customerReport, setCustomerReport] = useState<{ customer_name: string; invoice_count: number; total_spent: number }[]>([]);
  const [invoiceList, setInvoiceList] = useState<{ InvoiceNo: string; Date: string; Customer: string; Amount: number; GST: number; Status: string; BalanceDue: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<Record<string, string>>({});

  // CA Report state
  const today = new Date();
  const [caMonth, setCaMonth] = useState(String(today.getMonth() + 1).padStart(2, '0'));
  const [caYear, setCaYear] = useState(String(today.getFullYear()));
  const [sendingCA, setSendingCA] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const { t, language } = useLanguage();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const MONTHS = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December'
  ];

  const fetchReports = async () => {
    setLoading(true);
    try {
      const params = `from=${from}&to=${to}&_t=${Date.now()}`;
      const [summRes, dailyRes, prodRes, custRes, invListRes] = await Promise.all([
        fetch(`/api/reports?${params}&type=summary`),
        fetch(`/api/reports?${params}&type=daily`),
        fetch(`/api/reports?${params}&type=products`),
        fetch(`/api/reports?${params}&type=customers`),
        fetch(`/api/reports?${params}&type=invoicelist`),
      ]);
      setSummary(await summRes.json());
      setDaily(await dailyRes.json());
      setProductReport(await prodRes.json());
      setCustomerReport(await custRes.json());
      setInvoiceList(await invListRes.json());
    } catch { toast.error(t('Failed to load reports') || 'Failed to load reports'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchReports(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(setSettings);
  }, []);

  /* ── Send Monthly Report to CA via WhatsApp (PDF) ── */
  const sendReportToCA = async () => {
    const caPhone = settings.ca_phone?.trim();
    if (!caPhone) {
      toast.error('CA WhatsApp number is not set. Please add it in Settings → CA Details.');
      return;
    }

    setSendingCA(true);
    const toastId = toast.loading(`Generating ${MONTHS[parseInt(caMonth) - 1]} ${caYear} PDF report...`);

    try {
      // Build date range for the selected month
      const monthStart = `${caYear}-${caMonth}-01`;
      const lastDay = new Date(parseInt(caYear), parseInt(caMonth), 0).getDate();
      const monthEnd = `${caYear}-${caMonth}-${String(lastDay).padStart(2, '0')}`;
      const params = `from=${monthStart}&to=${monthEnd}&_t=${Date.now()}`;

      const [summRes, custRes, invListRes] = await Promise.all([
        fetch(`/api/reports?${params}&type=summary`),
        fetch(`/api/reports?${params}&type=customers`),
        fetch(`/api/reports?${params}&type=invoicelist`),
      ]);
      const s = await summRes.json();
      const customers = await custRes.json();
      const invList = await invListRes.json();

      if (!s || s.totalInvoices === 0) {
        toast.dismiss(toastId);
        toast.info(`No invoices found for ${MONTHS[parseInt(caMonth) - 1]} ${caYear}.`);
        setSendingCA(false);
        return;
      }

      const storeName = settings.store_name || 'Our Store';
      const caName = settings.ca_name || 'CA Sir/Madam';
      const totalOutstanding = invList.reduce((acc: number, inv: any) => acc + (inv.BalanceDue || 0), 0);
      const paidCount    = invList.filter((i: any) => i.Status === 'paid').length;
      const unpaidCount  = invList.filter((i: any) => i.Status === 'unpaid').length;
      const partialCount = invList.filter((i: any) => i.Status === 'partial').length;
      const monthLabel = `${MONTHS[parseInt(caMonth) - 1]} ${caYear}`;

      // ─── Build PDF ────────────────────────────────────────────────────
      const doc = new jsPDF();
      const lm = 14;
      doc.setFontSize(20); doc.setFont('helvetica', 'bold');
      doc.text('Monthly Sales Report', lm, 18);
      doc.setFontSize(11); doc.setFont('helvetica', 'normal');
      doc.text(`Business  : ${storeName}`, lm, 27);
      if (settings.store_gstin) doc.text(`GSTIN     : ${settings.store_gstin}`, lm, 33);
      const baseY = settings.store_gstin ? 39 : 33;
      doc.text(`Period    : ${monthLabel}`, lm, baseY);
      doc.text(`Generated : ${format(new Date(), 'dd MMM yyyy, hh:mm a')}`, lm, baseY + 6);
      doc.text(`Prepared for : ${caName}`, lm, baseY + 12);
      let curY = baseY + 22;

      // Sales Summary
      doc.setFontSize(13); doc.setFont('helvetica', 'bold');
      doc.text('Sales Summary', lm, curY); curY += 4;
      autoTable(doc, {
        startY: curY, head: [['Metric', 'Value']],
        body: [
          ['Total Invoices', s.totalInvoices.toString()],
          ['Total Sales Amount', `Rs. ${s.totalSales.toFixed(2)}`],
          ['Total Discount Given', `Rs. ${(s.totalDiscount || 0).toFixed(2)}`],
          ['Average Bill Value', `Rs. ${(s.avgBill || 0).toFixed(2)}`],
        ],
        margin: { left: lm }, headStyles: { fillColor: [41, 128, 185] },
      });
      curY = (doc as any).lastAutoTable.finalY + 8;

      // GST Breakdown
      doc.setFontSize(13); doc.setFont('helvetica', 'bold');
      doc.text('GST Breakdown', lm, curY); curY += 4;
      const gstBody: string[][] = [['Total GST Collected', `Rs. ${(s.totalGst || 0).toFixed(2)}`]];
      if ((s.totalCgst || 0) > 0) gstBody.push(['  CGST', `Rs. ${s.totalCgst.toFixed(2)}`]);
      if ((s.totalSgst || 0) > 0) gstBody.push(['  SGST', `Rs. ${s.totalSgst.toFixed(2)}`]);
      if ((s.totalIgst || 0) > 0) gstBody.push(['  IGST', `Rs. ${s.totalIgst.toFixed(2)}`]);
      autoTable(doc, {
        startY: curY, head: [['Tax Component', 'Amount']], body: gstBody,
        margin: { left: lm }, headStyles: { fillColor: [39, 174, 96] },
      });
      curY = (doc as any).lastAutoTable.finalY + 8;

      // Payment Status
      doc.setFontSize(13); doc.setFont('helvetica', 'bold');
      doc.text('Payment Status', lm, curY); curY += 4;
      const statusBody: string[][] = [['Paid Invoices', paidCount.toString()]];
      if (partialCount > 0) statusBody.push(['Partial Invoices', partialCount.toString()]);
      if (unpaidCount  > 0) statusBody.push(['Unpaid Invoices',  unpaidCount.toString()]);
      if (totalOutstanding > 0) statusBody.push(['Total Outstanding', `Rs. ${totalOutstanding.toFixed(2)}`]);
      autoTable(doc, {
        startY: curY, head: [['Status', 'Count / Amount']], body: statusBody,
        margin: { left: lm }, headStyles: { fillColor: [142, 68, 173] },
      });
      curY = (doc as any).lastAutoTable.finalY + 8;

      // Payment Methods
      if (s.paymentMethods?.length > 0) {
        doc.setFontSize(13); doc.setFont('helvetica', 'bold');
        doc.text('Payment Methods', lm, curY); curY += 4;
        autoTable(doc, {
          startY: curY,
          head: [['Method', 'Bills', 'Total Amount']],
          body: s.paymentMethods.map((pm: any) => [pm.payment_method.toUpperCase(), pm.cnt.toString(), `Rs. ${pm.total.toFixed(2)}`]),
          margin: { left: lm }, headStyles: { fillColor: [230, 126, 34] },
        });
      }

      // Invoice list — new page
      if (invList.length > 0) {
        doc.addPage();
        doc.setFontSize(14); doc.setFont('helvetica', 'bold');
        doc.text('Invoice-wise Detail', lm, 18);
        autoTable(doc, {
          startY: 24,
          head: [['Invoice No', 'Date', 'Customer', 'Amount', 'GST', 'Status']],
          body: invList.map((inv: any) => [
            inv.InvoiceNo, format(new Date(inv.Date), 'dd MMM yyyy'), inv.Customer,
            `Rs. ${inv.Amount.toFixed(2)}`, `Rs. ${(inv.GST || 0).toFixed(2)}`, inv.Status.toUpperCase(),
          ]),
          margin: { left: lm }, headStyles: { fillColor: [52, 73, 94] }, styles: { fontSize: 8 },
        });
      }

      // Top Customers
      if (customers.length > 0) {
        const tcy = (doc as any).lastAutoTable.finalY + 10;
        doc.setFontSize(13); doc.setFont('helvetica', 'bold');
        doc.text('Top Customers', lm, tcy);
        autoTable(doc, {
          startY: tcy + 4,
          head: [['#', 'Customer', 'Bills', 'Total Spent']],
          body: customers.slice(0, 10).map((c: any, i: number) => [i + 1, c.customer_name, c.invoice_count, `Rs. ${c.total_spent.toFixed(2)}`]),
          margin: { left: lm }, headStyles: { fillColor: [41, 128, 185] },
        });
      }

      // Page footer on every page
      const pgCount = (doc as any).internal.getNumberOfPages();
      for (let pg = 1; pg <= pgCount; pg++) {
        doc.setPage(pg);
        doc.setFontSize(8); doc.setFont('helvetica', 'italic'); doc.setTextColor(150);
        doc.text(`${storeName} | ${monthLabel} Report | Page ${pg} of ${pgCount}`, lm, doc.internal.pageSize.getHeight() - 8);
        doc.setTextColor(0);
      }

      // ─── Share (mobile) or Download + WhatsApp (desktop) ────────────────
      const pdfBlob  = doc.output('blob');
      const fileName = `${storeName.replace(/\s+/g, '_')}_Report_${caYear}_${caMonth}.pdf`;
      const pdfFile  = new File([pdfBlob], fileName, { type: 'application/pdf' });

      const waText = language === 'mr'
        ? `नमस्कार ${caName},\n\nकृपया *${storeName}* चा *${monthLabel} महिन्याचा विक्री अहवाल* सोबत जोडलेला पहा.\n\nठळक मुद्दे:\n• एकूण बिले : ${s.totalInvoices}\n• एकूण विक्री    : रुपये ${s.totalSales.toFixed(2)}\n• गोळा केलेला GST  : रुपये ${(s.totalGst || 0).toFixed(2)}${totalOutstanding > 0 ? `\n• थकीत रक्कम    : रुपये ${totalOutstanding.toFixed(2)}` : ''}\n\nकृपया तपासा आणि काही शंका असल्यास कळवा.\n\n🙏 धन्यवाद,\n*${storeName}*`
        : `Hi ${caName},\n\nPlease find attached the *${monthLabel} Monthly Sales Report* for *${storeName}*.\n\nKey highlights:\n• Total Invoices : ${s.totalInvoices}\n• Total Sales    : Rs. ${s.totalSales.toFixed(2)}\n• GST Collected  : Rs. ${(s.totalGst || 0).toFixed(2)}${totalOutstanding > 0 ? `\n• Outstanding    : Rs. ${totalOutstanding.toFixed(2)}` : ''}\n\nPlease review and revert with any queries.\n\n🙏 Regards,\n*${storeName}*`;

      // On Android Chrome: share PDF file directly into WhatsApp
      if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
        toast.success(t('Opening share sheet — select WhatsApp') || 'Opening share sheet — select WhatsApp', { id: toastId, duration: 4000 });
        await navigator.share({ files: [pdfFile], title: `${monthLabel} Report`, text: waText });
      } else {
        // Desktop: download PDF + automatically send cover message
        const url = URL.createObjectURL(pdfBlob);
        const a = document.createElement('a'); a.href = url; a.download = fileName; a.click();
        URL.revokeObjectURL(url);
        
        toast.loading(t('PDF downloaded! Sending summary message via WhatsApp...') || 'PDF downloaded! Sending summary message via WhatsApp...', { id: toastId });
        
        const cleanPhone = caPhone.replace(/\D/g, '');
        const res = await fetch('/api/whatsapp/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: cleanPhone, message: waText })
        });
        
        if (!res.ok) throw new Error('Failed to send via background API');
        toast.success(t('Summary message sent successfully to CA!') || 'Summary message sent successfully to CA!', { id: toastId });
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        toast.error(t('Failed to generate CA report.') || 'Failed to generate CA report.', { id: toastId });
      } else {
        toast.dismiss(toastId);
      }
    } finally {
      setSendingCA(false);
    }
  };

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

  // jsPDF built-in fonts don't support the ₹ glyph — use Rs. prefix instead
  const fmtPDF = (n: number) =>
    'Rs. ' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n);

  const exportExcel = async () => {
    const tid = toast.loading(t('Generating Detailed Excel...') || 'Generating Detailed Excel...');
    try {
      const wb = XLSX.utils.book_new();

      // Header Data
      const headerData = [
        ['Report Title', `Business Report (${format(new Date(from), 'dd MMM yyyy')} to ${format(new Date(to), 'dd MMM yyyy')})`],
        ['Generated Date', format(new Date(), 'dd MMM yyyy, hh:mm a')],
        []
      ];

      // Calculate missing Summary fields
      const totalOutstanding = invoiceList.reduce((acc, curr) => acc + (curr.BalanceDue || 0), 0);
      const totalProfit = (summary?.totalSales ?? 0) - (summary?.totalGst ?? 0); // Simplified mock profit

      // 1. Fetch Itemized Detailed List FIRST (Make it the primary view!)
      const detailedReq = await fetch(`/api/reports?type=invoicelist_detailed&from=${from}&to=${to}&_t=${Date.now()}`);
      if (detailedReq.ok) {
        const { invoices: detailedInvs, items: detailedItems } = await detailedReq.json();
        const itemRows = [];
        for (const inv of detailedInvs) {
          const invItems = detailedItems.filter((it: any) => it.invoice_id === inv.id);
          for (const it of invItems) {
             itemRows.push({
               'Invoice No': inv.invoice_number,
               'Date': format(new Date(inv.created_at.replace(' ', 'T') + 'Z'), 'dd MMM yyyy'),
               'Customer': inv.customer_name,
               'Item Name': it.product_name,
               'HSN/SAC': it.hsn_code || '-',
               'Qty': it.quantity,
               'Unit': it.unit,
               'Weight/KG': it.weight_kg || 0,
               'Price': it.price,
               'Taxable Val': it.taxable_amount || it.total,
               'GST %': it.gst_rate > 0 ? it.gst_rate + '%' : '0%',
               'Item Total': it.total
             });
          }
        }
        if (itemRows.length > 0) {
           const wsItems = XLSX.utils.json_to_sheet(itemRows);
           // Style columns so they aren't cramped
           wsItems['!cols'] = [
             { wch: 15 }, { wch: 15 }, { wch: 25 }, { wch: 35 }, 
             { wch: 12 }, { wch: 8 }, { wch: 8 }, { wch: 10 }, 
             { wch: 10 }, { wch: 12 }, { wch: 8 }, { wch: 12 }
           ];
           XLSX.utils.book_append_sheet(wb, wsItems, 'ITEMIZED GST BILLS');
        }
      }

      // 2. Summary Sheet
      const summaryData = [
        ...headerData,
        ['Metric', 'Value'],
        ['Total Invoices Generated', summary?.totalInvoices ?? 0],
        ['Total Revenue Sales', summary?.totalSales ?? 0],
        ['Total GST Collected', summary?.totalGst ?? 0],
        ['Total Outstanding Payments', totalOutstanding]
      ];
      const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
      wsSummary['!cols'] = [{ wch: 30 }, { wch: 15 }];
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary Overview');

      // 3. Invoice Summary
      const formattedInvoiceList = invoiceList.map(inv => ({
        'Invoice No': inv.InvoiceNo,
        'Date': format(new Date(inv.Date), 'dd MMM yyyy'),
        'Customer': inv.Customer,
        'Amount': inv.Amount,
        'GST': inv.GST,
        'Status': inv.Status.toUpperCase()
      }));
      if (formattedInvoiceList.length > 0) {
        const wsInv = XLSX.utils.json_to_sheet(formattedInvoiceList);
        wsInv['!cols'] = [{ wch: 15 }, { wch: 15 }, { wch: 25 }, { wch: 12 }, { wch: 12 }, { wch: 15 }];
        XLSX.utils.book_append_sheet(wb, wsInv, 'Invoice List');
      }



      // Daily Sales Sheet
      const dailyData = daily.map(d => ({
        Date: format(new Date(d.date), 'dd MMM yyyy'),
        Invoices: d.invoice_count,
        Sales: d.total_sales
      }));
      if (dailyData.length > 0) {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dailyData), 'Daily Sales');
      }

      // Products Sheet
      const productsData = productReport.map((p, i) => ({
        '#': i + 1,
        Product: p.product_name,
        'Qty Sold': p.total_qty,
        Revenue: p.total_revenue
      }));
      if (productsData.length > 0) {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(productsData), 'Top Products');
      }

      // Customers Sheet
      const customersData = customerReport.map((c, i) => ({
        '#': i + 1,
        Customer: c.customer_name,
        Invoices: c.invoice_count,
        'Total Spent': c.total_spent
      }));
      if (customersData.length > 0) {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(customersData), 'Top Customers');
      }

      // Payment Methods Sheet
      if (summary?.paymentMethods && summary.paymentMethods.length > 0) {
        const paymentData = summary.paymentMethods.map(pm => ({
          Method: pm.payment_method.toUpperCase(),
          Count: pm.cnt,
          Total: pm.total
        }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(paymentData), 'Payment Methods');
      }

      XLSX.writeFile(wb, `Business_Report_${from}_to_${to}.xlsx`);
      toast.success(t('Detailed Excel downloaded successfully!') || 'Detailed Excel downloaded successfully!', { id: tid });
    } catch {
      toast.error(t('Failed to export Excel report') || 'Failed to export Excel report', { id: tid });
    }
  };

  const exportPDF = () => {
    try {
      const doc = new jsPDF();
      const lm = 14;
      const storeName = settings.store_name || 'Business';
      const periodLabel = `${format(new Date(from), 'dd MMM yyyy')} to ${format(new Date(to), 'dd MMM yyyy')}`;
      const totalOutstanding = invoiceList.reduce((acc, curr) => acc + (curr.BalanceDue || 0), 0);

      // Header
      doc.setFontSize(20); doc.setFont('helvetica', 'bold');
      doc.text('Business Analytics Report', lm, 18);
      doc.setFontSize(11); doc.setFont('helvetica', 'normal');
      doc.text(`Business  : ${storeName}`, lm, 27);
      if (settings.store_gstin) doc.text(`GSTIN     : ${settings.store_gstin}`, lm, 33);
      const baseY = settings.store_gstin ? 39 : 33;
      doc.text(`Period    : ${periodLabel}`, lm, baseY);
      doc.text(`Generated : ${format(new Date(), 'dd MMM yyyy, hh:mm a')}`, lm, baseY + 6);
      let curY = baseY + 16;

      // Sales Summary
      if (summary) {
        doc.setFontSize(13); doc.setFont('helvetica', 'bold');
        doc.text('Sales Summary', lm, curY); curY += 4;
        autoTable(doc, {
          startY: curY,
          head: [['Metric', 'Value']],
          body: [
            ['Total Invoices',        summary.totalInvoices.toString()],
            ['Total Sales Amount',    fmtPDF(summary.totalSales)],
            ['Total GST Collected',   fmtPDF(summary.totalGst)],
            ['Total Discount Given',  fmtPDF(summary.totalDiscount || 0)],
            ['Average Bill Value',    fmtPDF(summary.avgBill)],
            ['Total Outstanding',     fmtPDF(totalOutstanding)],
          ],
          margin: { left: lm }, headStyles: { fillColor: [41, 128, 185] },
        });
        curY = (doc as any).lastAutoTable.finalY + 8;

        // GST Breakdown
        doc.setFontSize(13); doc.setFont('helvetica', 'bold');
        doc.text('GST Breakdown', lm, curY); curY += 4;
        autoTable(doc, {
          startY: curY,
          head: [['Tax Component', 'Amount']],
          body: [['Total GST Collected', fmtPDF(summary.totalGst)]],
          margin: { left: lm }, headStyles: { fillColor: [39, 174, 96] },
        });
        curY = (doc as any).lastAutoTable.finalY + 8;

        // Payment Methods
        if (summary.paymentMethods && summary.paymentMethods.length > 0) {
          doc.setFontSize(13); doc.setFont('helvetica', 'bold');
          doc.text('Payment Methods', lm, curY); curY += 4;
          autoTable(doc, {
            startY: curY,
            head: [['Method', 'Bills', 'Total Amount']],
            body: summary.paymentMethods.map(pm => [
              pm.payment_method.toUpperCase(), pm.cnt.toString(), fmtPDF(pm.total)
            ]),
            margin: { left: lm }, headStyles: { fillColor: [230, 126, 34] },
          });
        }
      }

      // Invoice List — new page
      if (invoiceList.length > 0) {
        doc.addPage();
        doc.setFontSize(14); doc.setFont('helvetica', 'bold');
        doc.text('Invoice-wise Detail', lm, 18);
        autoTable(doc, {
          startY: 24,
          head: [['Invoice No', 'Date', 'Customer', 'Amount', 'GST', 'Status']],
          body: invoiceList.map(inv => [
            inv.InvoiceNo,
            format(new Date(inv.Date), 'dd MMM yyyy'),
            inv.Customer,
            fmtPDF(inv.Amount),
            fmtPDF(inv.GST || 0),
            inv.Status.toUpperCase(),
          ]),
          margin: { left: lm }, headStyles: { fillColor: [52, 73, 94] }, styles: { fontSize: 8 },
        });
      }

      // Daily Sales
      if (daily.length > 0) {
        const dy = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 10 : 28;
        doc.setFontSize(13); doc.setFont('helvetica', 'bold');
        doc.text('Daily Sales Breakdown', lm, dy);
        autoTable(doc, {
          startY: dy + 4,
          head: [['Date', 'Invoices', 'Sales']],
          body: daily.map(d => [format(new Date(d.date), 'dd MMM yyyy'), d.invoice_count, fmtPDF(d.total_sales)]),
          margin: { left: lm }, headStyles: { fillColor: [22, 160, 133] },
        });
      }

      // Top Products — new page
      if (productReport.length > 0) {
        doc.addPage();
        doc.setFontSize(14); doc.setFont('helvetica', 'bold');
        doc.text('Top Selling Products', lm, 18);
        autoTable(doc, {
          startY: 24,
          head: [['#', 'Product', 'Qty Sold', 'Revenue']],
          body: productReport.map((p, i) => [i + 1, p.product_name, p.total_qty, fmtPDF(p.total_revenue)]),
          margin: { left: lm }, headStyles: { fillColor: [39, 174, 96] },
        });
      }

      // Top Customers
      if (customerReport.length > 0) {
        const cy = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 10 : 28;
        doc.setFontSize(13); doc.setFont('helvetica', 'bold');
        doc.text('Top Customers', lm, cy);
        autoTable(doc, {
          startY: cy + 4,
          head: [['#', 'Customer', 'Invoices', 'Total Spent']],
          body: customerReport.map((c, i) => [i + 1, c.customer_name, c.invoice_count, fmtPDF(c.total_spent)]),
          margin: { left: lm }, headStyles: { fillColor: [41, 128, 185] },
        });
      }

      // Page footer on every page
      const pgCount = (doc as any).internal.getNumberOfPages();
      for (let pg = 1; pg <= pgCount; pg++) {
        doc.setPage(pg);
        doc.setFontSize(8); doc.setFont('helvetica', 'italic'); doc.setTextColor(150);
        doc.text(`${storeName} | ${periodLabel} | Page ${pg} of ${pgCount}`, lm, doc.internal.pageSize.getHeight() - 8);
        doc.setTextColor(0);
      }

      doc.save(`Business_Report_${from}_to_${to}.pdf`);
      toast.success(t('PDF report downloaded') || 'PDF report downloaded');
    } catch (err: any) {
      console.error('PDF Export Error:', err);
      toast.error(`Failed: ${err.message || err}`);
    }
  };

  return (
    <div className="space-y-6">
      {!isMounted ? null : (
        <>
          <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('Reports')}</h1>
          <p className="text-muted-foreground">{t('Sales analytics and business insights')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportExcel} disabled={!summary}>
            <Download className="mr-2 h-4 w-4" /> {t('Download Excel')}
          </Button>
          <Button variant="outline" size="sm" onClick={exportPDF} disabled={!summary}>
            <Download className="mr-2 h-4 w-4" /> {t('Download PDF')}
          </Button>
        </div>
      </div>

      {/* Send Monthly Report to CA */}
      <Card className="border-green-200 bg-green-50/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-green-800">
            <UserCheck className="h-5 w-5" />
            {t('Send Monthly Report to CA')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-3 flex-wrap">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">{t('Month')}</Label>
              <select
                value={caMonth}
                onChange={e => setCaMonth(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
              >
                {MONTHS.map((m, i) => (
                  <option key={m} value={String(i + 1).padStart(2, '0')}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">{t('Year')}</Label>
              <select
                value={caYear}
                onChange={e => setCaYear(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
              >
                {[0, 1, 2].map(offset => {
                  const y = String(today.getFullYear() - offset);
                  return <option key={y} value={y}>{y}</option>;
                })}
              </select>
            </div>
            <div className="flex gap-4">
              <Button
                onClick={sendReportToCA}
                disabled={sendingCA}
                className="bg-green-600 hover:bg-green-700 text-white w-full"
              >
                <MessageCircle className="mr-2 h-4 w-4" />
                {sendingCA ? t('Preparing...') : t('Send to CA on WhatsApp')}
              </Button>
            </div>
            {!settings.ca_phone && (
              <p className="text-xs text-amber-600 font-medium self-center mt-2">
                ⚠️ Set CA WhatsApp number in Settings first
              </p>
            )}
            {settings.ca_phone && settings.ca_name && (
              <p className="text-xs text-green-700 self-center mt-2">
                Will send to: <strong>{settings.ca_name}</strong> (+{settings.ca_phone})
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Date Range Filter */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-end gap-4 flex-wrap">
            <div><Label>{t('From')}</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
            <div><Label>{t('To')}</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
            <Button onClick={fetchReports} disabled={loading}>
              {loading ? t('Loading...') || 'Loading...' : t('Apply Date Filter')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {summary && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('Total Sales')}</CardTitle>
              <IndianRupee className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{formatCurrency(summary.totalSales)}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('Total Invoices')}</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{summary.totalInvoices}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('GST Collected')}</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{formatCurrency(summary.totalGst)}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('Avg Bill Value')}</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{formatCurrency(summary.avgBill)}</div></CardContent>
          </Card>
        </div>
      )}

      {/* Tabs for detailed reports */}
      <Tabs defaultValue="daily">
        <TabsList>
          <TabsTrigger value="daily">{t('Daily Sales')}</TabsTrigger>
          <TabsTrigger value="products">{t('Top Products')}</TabsTrigger>
          <TabsTrigger value="customers">{t('Top Customers')}</TabsTrigger>
          <TabsTrigger value="payment">{t('Payment Methods')}</TabsTrigger>
        </TabsList>

        <TabsContent value="daily" className="mt-4">
          <Card>
            <CardHeader><CardTitle>{t('Daily Sales Breakdown')}</CardTitle></CardHeader>
            <CardContent>
              {daily.length > 0 ? (
                <>
                  <div className="h-[300px] mb-6">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={daily}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" tickFormatter={(v) => format(new Date(v), 'dd MMM')} />
                        <YAxis tickFormatter={(v) => `₹${v}`} />
                        <Tooltip formatter={(v: number) => [formatCurrency(v), t('Sales')]} labelFormatter={(l) => format(new Date(l), 'dd MMM yyyy')} />
                        <Bar dataKey="total_sales" fill="#16a34a" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('Date')}</TableHead>
                        <TableHead className="text-right">{t('Invoices')}</TableHead>
                        <TableHead className="text-right">{t('Sales')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {daily.map((d) => (
                        <TableRow key={d.date}>
                          <TableCell>{format(new Date(d.date), 'dd MMM yyyy')}</TableCell>
                          <TableCell className="text-right">{d.invoice_count}</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(d.total_sales)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </>
              ) : <p className="text-center py-8 text-muted-foreground">No data for selected period</p>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="products" className="mt-4">
          <Card>
            <CardHeader><CardTitle>{t('Top Selling Products')}</CardTitle></CardHeader>
            <CardContent>
              {productReport.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>{t('Product')}</TableHead>
                      <TableHead className="text-right">{t('Qty Sold')}</TableHead>
                      <TableHead className="text-right">{t('Revenue')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {productReport.map((p, i) => (
                      <TableRow key={p.product_name}>
                        <TableCell>{i + 1}</TableCell>
                        <TableCell className="font-medium">{p.product_name}</TableCell>
                        <TableCell className="text-right">{p.total_qty}</TableCell>
                        <TableCell className="text-right">{formatCurrency(p.total_revenue)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : <p className="text-center py-8 text-muted-foreground">No product data</p>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="customers" className="mt-4">
          <Card>
            <CardHeader><CardTitle>{t('Top Customers')}</CardTitle></CardHeader>
            <CardContent>
              {customerReport.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>{t('Customer')}</TableHead>
                      <TableHead className="text-right">{t('Invoices')}</TableHead>
                      <TableHead className="text-right">{t('Total Spent')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customerReport.map((c, i) => (
                      <TableRow key={c.customer_name}>
                        <TableCell>{i + 1}</TableCell>
                        <TableCell className="font-medium">{c.customer_name}</TableCell>
                        <TableCell className="text-right">{c.invoice_count}</TableCell>
                        <TableCell className="text-right">{formatCurrency(c.total_spent)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : <p className="text-center py-8 text-muted-foreground">No customer data</p>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payment" className="mt-4">
          <Card>
            <CardHeader><CardTitle>{t('Payment Methods')}</CardTitle></CardHeader>
            <CardContent>
              {summary?.paymentMethods && summary.paymentMethods.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('Method')}</TableHead>
                      <TableHead className="text-right">{t('Count')}</TableHead>
                      <TableHead className="text-right">{t('Total')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary.paymentMethods.map((pm) => (
                      <TableRow key={pm.payment_method}>
                        <TableCell className="font-medium">{pm.payment_method.toUpperCase()}</TableCell>
                        <TableCell className="text-right">{pm.cnt}</TableCell>
                        <TableCell className="text-right">{formatCurrency(pm.total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : <p className="text-center py-8 text-muted-foreground">No payment data</p>}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </>
      )}
    </div>
  );
}
