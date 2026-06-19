/**
 * Billing Page — Create new invoices with full GST support
 * Features: product search, per-item GST calculation (CGST+SGST / IGST),
 * HSN codes, GST inclusive/exclusive, discount, customer selection with GSTIN,
 * payment method, and invoice creation.
 */

'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLanguage } from '@/components/LanguageProvider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Search, Plus, Trash2, ShoppingCart, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useRouter, useSearchParams } from 'next/navigation';
import { isValidPhone, isValidGSTIN, isNonNegative, isPositive } from '@/lib/validations';

interface Product {
  id: number; name: string; sku: string; brand: string; article_no: string; size: string; color: string; selling_price: number;
  quantity: number; unit: string; gst_rate: number; hsn_code: string;
}

interface Customer {
  id: number; name: string; phone: string; gstin: string; address: string;
}

interface BillItem {
  product_id: number | null;
  product_name: string;
  brand: string;
  article_no: string;
  size: string;
  color: string;
  hsn_code: string;
  quantity: number;
  unit: string;
  weight_kg: number; // KG weight when unit is bag/count (optional)
  price: number;
  discount: number;
  gst_rate: number;
  available_stock: number;
  // Calculated fields
  taxable_amount: number;
  cgst_rate: number;
  cgst_amount: number;
  sgst_rate: number;
  sgst_amount: number;
  igst_rate: number;
  igst_amount: number;
  total: number;
}

function BillingCounter({ counterIndex, editId, onClearEdit }: { counterIndex: number, editId: string | null, onClearEdit: () => void }) {
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);
  const { t, language } = useLanguage();

  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);

  /* Bill state */
  const [items, setItems] = useState<BillItem[]>([]);
  const [customerId, setCustomerId] = useState<string>('');
  const [customerName, setCustomerName] = useState('Walk-in Customer');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerGstin, setCustomerGstin] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerGender, setCustomerGender] = useState('Unspecified');
  const [gstEnabled, setGstEnabled] = useState(false);
  const [gstInclusive, setGstInclusive] = useState(false);
  const [isIgst, setIsIgst] = useState(false);
  const [discountAmount, setDiscountAmount] = useState<number | ''>('');
  const [discountType, setDiscountType] = useState<'flat' | 'percent'>('flat');
  const [hamali, setHamali] = useState<number | ''>('');
  const [marketCess, setMarketCess] = useState<number | ''>('');
  const [otherExp, setOtherExp] = useState<number | ''>('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentStatus, setPaymentStatus] = useState('paid');
  const [amountPaid, setAmountPaid] = useState<number | ''>('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  
  const [sendWa, setSendWa] = useState(true);
  const [waConnected, setWaConnected] = useState(false);

  /* Fetch data */
  useEffect(() => {
    fetch('/api/products').then(r => r.json()).then(setProducts);
    fetch('/api/customers').then(r => r.json()).then(setCustomers);
    fetch('/api/settings').then(r => r.json()).then((s) => {
      setSettings(s);
      setGstInclusive(s.gst_inclusive === '1');
    });
    
    const fetchWa = async () => {
      try {
        const res = await fetch('/api/whatsapp/status', { cache: 'no-store' });
        const data = await res.json();
        setWaConnected(data.status === 'connected');
      } catch {}
    };
    fetchWa();
  }, []);

  /* Fetch edit data */
  useEffect(() => {
    if (!editId) return;
    const fetchInvoice = async () => {
      try {
        const res = await fetch(`/api/invoices/${editId}`);
        if (!res.ok) throw new Error('Failed to load invoice');
        const data = await res.json();
        const inv = data.invoice;
        
        // Populate customer
        setCustomerId(inv.customer_id ? String(inv.customer_id) : 'walk-in');
        setCustomerName(inv.customer_name);
        setCustomerPhone(inv.customer_phone);
        setCustomerGstin(inv.customer_gstin);
        setCustomerAddress(inv.customer_address);
        setCustomerGender(inv.customer_gender || 'Unspecified');
        
        // Populate items
        const loadedItems = data.items.map((i: any) => ({
          product_id: i.product_id, product_name: i.product_name, brand: i.brand, article_no: i.article_no, size: i.size, color: i.color, hsn_code: i.hsn_code,
          quantity: i.quantity, unit: i.unit, weight_kg: i.weight_kg, price: i.price, discount: i.discount, gst_rate: i.gst_rate, available_stock: Infinity,
          taxable_amount: i.taxable_amount, cgst_rate: i.cgst_rate, cgst_amount: i.cgst_amount, sgst_rate: i.sgst_rate, sgst_amount: i.sgst_amount,
          igst_rate: i.igst_rate, igst_amount: i.igst_amount, total: i.total
        }));
        setItems(loadedItems);
        
        // Populate flags and totals
        setGstEnabled(inv.gst_enabled === 1);
        setGstInclusive(loadedItems.length > 0 ? loadedItems[0].gst_inclusive === 1 : false);
        setIsIgst(inv.is_igst === 1);
        setDiscountType('flat');
        setDiscountAmount(inv.discount_amount || '');
        setHamali(inv.hamali || '');
        setMarketCess(inv.market_cess || '');
        setOtherExp(inv.other_exp || '');
        setPaymentMethod(inv.payment_method);
        setPaymentStatus(inv.payment_status);
        setAmountPaid(inv.amount_paid || '');
        setNotes(inv.notes || '');
      } catch (err) {
        toast.error('Failed to load invoice for editing');
        onClearEdit();
      }
    };
    fetchInvoice();
  }, [editId]);

  /* Filter products on search */
  useEffect(() => {
    if (!searchTerm) { setFilteredProducts(products); return; }
    const filtered = products.filter(
      (p) => p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.sku && p.sku.toLowerCase().includes(searchTerm.toLowerCase()))
    );
    setFilteredProducts(filtered);
  }, [searchTerm, products]);

  /* Calculate GST for an item */
  const calcItemGst = (item: Partial<BillItem>): BillItem => {
    const qty = item.quantity || 0;
    const price = item.price || 0;
    const discount = item.discount || 0;
    const gstRate = gstEnabled ? (item.gst_rate || 0) : 0;

    const grossAmount = qty * price;
    const afterDiscount = grossAmount - discount;

    let taxableAmount: number;
    let taxAmount: number;

    if (gstInclusive && gstRate > 0) {
      taxableAmount = afterDiscount * 100 / (100 + gstRate);
      taxAmount = afterDiscount - taxableAmount;
    } else {
      taxableAmount = afterDiscount;
      taxAmount = taxableAmount * gstRate / 100;
    }

    taxableAmount = Math.round(taxableAmount * 100) / 100;
    taxAmount = Math.round(taxAmount * 100) / 100;

    let cgst_rate = 0, cgst_amount = 0;
    let sgst_rate = 0, sgst_amount = 0;
    let igst_rate = 0, igst_amount = 0;

    if (gstRate > 0) {
      if (isIgst) {
        igst_rate = gstRate;
        igst_amount = taxAmount;
      } else {
        cgst_rate = gstRate / 2;
        sgst_rate = gstRate / 2;
        cgst_amount = Math.round(taxAmount / 2 * 100) / 100;
        sgst_amount = Math.round((taxAmount - cgst_amount) * 100) / 100;
      }
    }

    const total = Math.round((taxableAmount + cgst_amount + sgst_amount + igst_amount) * 100) / 100;

    return {
      product_id: item.product_id ?? null,
      product_name: item.product_name || '',
      brand: item.brand || '',
      article_no: item.article_no || '',
      size: item.size || '',
      color: item.color || '',
      hsn_code: item.hsn_code || '',
      quantity: qty,
      unit: item.unit || 'pcs',
      weight_kg: item.weight_kg || 0,
      price,
      discount,
      gst_rate: item.gst_rate || 0,
      available_stock: item.available_stock || Infinity,
      taxable_amount: taxableAmount,
      cgst_rate,
      cgst_amount,
      sgst_rate,
      sgst_amount,
      igst_rate,
      igst_amount,
      total,
    };
  };

  /* Recalculate all items when GST settings change */
  useEffect(() => {
    if (items.length > 0) {
      setItems(items.map(item => calcItemGst(item)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gstEnabled, gstInclusive, isIgst]);

  /* Auto-detect inter-state from GSTIN */
  useEffect(() => {
    const storeGstin = settings.store_gstin || '';
    if (storeGstin && customerGstin && customerGstin.length >= 2) {
      const sellerState = storeGstin.substring(0, 2);
      const buyerState = customerGstin.substring(0, 2);
      setIsIgst(sellerState !== buyerState);
    }
  }, [customerGstin, settings.store_gstin]);

  /* Add item from product selection */
  const addItem = (p: Product) => {
    if (p.quantity < 1) {
      toast.warning(`${p.name} is out of stock in the system (${p.quantity} left)`);
    }

    const existing = items.find(i => i.product_id === p.id);
    if (existing) {
      setItems(items.map(i => {
        if (i.product_id === p.id) {
          const newQty = i.quantity + 1;
          if (newQty > p.quantity) {
            toast.warning(`Quantity exceeds system stock for ${p.name}`);
          }
          return calcItemGst({ ...i, quantity: newQty });
        }
        return i;
      }));
    } else {
      const newItem = calcItemGst({
        product_id: p.id, product_name: p.name, brand: p.brand, article_no: p.article_no, size: p.size, color: p.color, quantity: 1,
        unit: p.unit, price: p.selling_price, discount: 0,
        gst_rate: p.gst_rate || 0, hsn_code: p.hsn_code || '',
        available_stock: p.quantity,
      });
      setItems([...items, newItem]);
    }
    setSearchTerm('');
    searchRef.current?.focus();
  };

  /* Add custom item (not from inventory) */
  const addCustomItem = () => {
    const newItem = calcItemGst({
      product_id: null, product_name: '', brand: '', article_no: '', size: '', color: '', quantity: 1,
      unit: 'pair', price: 0, discount: 0, gst_rate: 0, hsn_code: '',
      available_stock: Infinity, weight_kg: 0,
    });
    setItems([...items, newItem]);
  };

  /* Update item */
  const updateItem = (idx: number, field: string, value: string | number) => {
    setItems(items.map((item, i) => {
      if (i !== idx) return item;
      const updated = { ...item, [field]: value };
      return calcItemGst(updated);
    }));
  };

  /* Remove item */
  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));

  /* Calculations */
  const totals = useMemo(() => {
    let taxable = 0, cgst = 0, sgst = 0, igst = 0, subtotal = 0;
    for (const item of items) {
      subtotal += item.quantity * item.price;
      taxable += item.taxable_amount;
      cgst += item.cgst_amount;
      sgst += item.sgst_amount;
      igst += item.igst_amount;
    }
    const gstTotal = cgst + sgst + igst;
    
    // Calculate final discount value
    const baseAmount = taxable + gstTotal;
    const rawDiscount = discountAmount || 0;
    const finalDiscount = discountType === 'percent' ? (baseAmount * rawDiscount / 100) : rawDiscount;
    
    const extraCharges = (hamali || 0) + (marketCess || 0) + (otherExp || 0);
    const exactTotal = taxable + gstTotal - finalDiscount + extraCharges;
    const roundedTotal = Math.round(exactTotal);
    const roundOff = Math.round((roundedTotal - exactTotal) * 100) / 100;

    return {
      subtotal: Math.round(subtotal * 100) / 100,
      taxable_amount: Math.round(taxable * 100) / 100,
      cgst_amount: Math.round(cgst * 100) / 100,
      sgst_amount: Math.round(sgst * 100) / 100,
      igst_amount: Math.round(igst * 100) / 100,
      gst_amount: Math.round(gstTotal * 100) / 100,
      round_off: roundOff,
      total_amount: roundedTotal,
      final_discount: Math.round(finalDiscount * 100) / 100,
    };
  }, [items, discountAmount, discountType, hamali, marketCess, otherExp]);

  /* Keyboard Shortcuts */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        const saveBtn = document.getElementById('save-bill-btn');
        if (saveBtn) saveBtn.click();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  /* Customer selection */
  const handleCustomerSelect = (val: string) => {
    setCustomerId(val);
    if (val === 'walk-in') {
      setCustomerName('Walk-in Customer');
      setCustomerPhone('');
      setCustomerGstin('');
      setCustomerAddress('');
      setCustomerGender('Unspecified');
    } else {
      const c = customers.find(c => String(c.id) === val);
      if (c) {
        setCustomerName(c.name);
        setCustomerPhone(c.phone);
        setCustomerGstin(c.gstin || '');
        setCustomerAddress(c.address || '');
        setCustomerGender(c.gender || 'Unspecified');
      }
    }
  };

  const resetForm = () => {
    setItems([]);
    setCustomerId('');
    handleCustomerSelect('walk-in');
    setPaymentMethod('cash');
    setPaymentStatus('paid');
    setAmountPaid('');
    setDiscountAmount('');
    setHamali('');
    setMarketCess('');
    setOtherExp('');
    setNotes('');
    onClearEdit();
  };

  /* Save invoice */
  const handleSave = async (printAndClear = false) => {
    if (saving) return;
    if (items.length === 0) { toast.error('Add at least one item'); return; }
    
    // Validate Item Details
    for (const item of items) {
      if (!item.product_name) {
        toast.error('Product name is required for all items'); return;
      }
      if (!isPositive(item.quantity)) {
        toast.error(`Quantity for "${item.product_name}" must be greater than zero`); return;
      }
      if (!isNonNegative(item.price)) {
        toast.error(`Price for "${item.product_name}" cannot be negative`); return;
      }
      if (!isNonNegative(item.discount)) {
        toast.error(`Discount for "${item.product_name}" cannot be negative`); return;
      }
    }

    // Validate Customer Details (if not walk-in)
    if (customerPhone && !isValidPhone(customerPhone)) {
      toast.error('Invalid customer phone number'); return;
    }
    if (customerGstin && !isValidGSTIN(customerGstin)) {
      toast.error('Invalid customer GSTIN'); return;
    }

    // Validate Bill Totals
    const safeDiscount = Number(discountAmount) || 0;
    if (!isNonNegative(safeDiscount)) {
      toast.error('Overall discount cannot be negative'); return;
    }
    if (totals.final_discount > totals.taxable_amount + totals.gst_amount) {
      toast.error('Discount cannot be greater than bill total'); return;
    }
    if (!isNonNegative(Number(hamali) || 0) || !isNonNegative(Number(marketCess) || 0) || !isNonNegative(Number(otherExp) || 0)) {
      toast.error('Extra charges cannot be negative'); return;
    }

    if (paymentStatus === 'partial') {
      if (!amountPaid || amountPaid <= 0) {
        toast.error('Enter a valid amount paid for partial payment');
        return;
      }
      if (amountPaid >= totals.total_amount) {
        toast.error('Partial payment amount must be less than total amount');
        return;
      }
    }

    setSaving(true);
    try {
      const res = await fetch(editId ? `/api/invoices/${editId}` : '/api/invoices', {
        method: editId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: customerId && customerId !== 'walk-in' ? parseInt(customerId) : null,
          customer_name: customerName,
          customer_phone: customerPhone,
          customer_gstin: customerGstin,
          customer_address: customerAddress,
          items: items.map(i => ({
            product_id: i.product_id, product_name: i.product_name, brand: i.brand, article_no: i.article_no, size: i.size, color: i.color,
            quantity: i.quantity, unit: i.unit, price: i.price,
            discount: i.discount, total: i.total,
            hsn_code: i.hsn_code, gst_rate: i.gst_rate,
            taxable_amount: i.taxable_amount,
            cgst_rate: i.cgst_rate, cgst_amount: i.cgst_amount,
            sgst_rate: i.sgst_rate, sgst_amount: i.sgst_amount,
            igst_rate: i.igst_rate, igst_amount: i.igst_amount,
            gst_inclusive: gstInclusive,
            weight_kg: i.weight_kg || 0,
          })),
          subtotal: totals.subtotal,
          discount_amount: totals.final_discount,
          gst_enabled: gstEnabled,
          gst_amount: totals.gst_amount,
          gst_rate: 0,
          taxable_amount: totals.taxable_amount,
          cgst_amount: totals.cgst_amount,
          sgst_amount: totals.sgst_amount,
          igst_amount: totals.igst_amount,
          is_igst: isIgst,
          round_off: totals.round_off,
          total_amount: totals.total_amount,
          amount_paid: paymentStatus === 'paid' ? totals.total_amount : (paymentStatus === 'unpaid' ? 0 : (amountPaid || 0)),
          payment_method: paymentMethod,
          payment_status: paymentStatus,
          notes,
          hamali,
          market_cess: marketCess,
          other_exp: otherExp,
          customer_gender: customerGender,
        }),
      });

      if (!res.ok) throw new Error();
      const data = await res.json();
      toast.success(editId ? `Invoice ${data.invoice.invoice_number} updated!` : `Invoice ${data.invoice.invoice_number} created!`);

      if (printAndClear) {
        window.open(`/invoices/print/${data.invoice.id}`, '_blank');
      }

      // Send WhatsApp Receipt
      if (sendWa && waConnected && customerPhone) {
        try {
          let channelLink = '';
          if (customerGender === 'Male' && settings.wa_channel_men) {
            channelLink = `\n\nJoin our Men's Collection WhatsApp Channel:\n${settings.wa_channel_men}`;
          } else if (customerGender === 'Female' && settings.wa_channel_women) {
            channelLink = `\n\nJoin our Women's Collection WhatsApp Channel:\n${settings.wa_channel_women}`;
          }
          
          const template = settings[`wa_message_template_${language}`] || settings.wa_message_template || (language === 'mr'
            ? `नमस्कार {{customer_name}},\n\nतुमचे {{total_amount}} चे बिल {{store_name}} येथे तयार आहे.\nबिल क्रमांक: {{invoice_number}}\nतारीख: {{date}}\n\nभेट दिल्याबद्दल धन्यवाद!`
            : `Hello {{customer_name}},\n\nYour invoice #{{invoice_number}} for Rs. {{total_amount}} has been generated at {{store_name}}.\n\nThank you for shopping with us!`);
          
          let msg = template
            .replace(/\{\{customer_name\}\}/g, customerName || 'Customer')
            .replace(/\{\{invoice_number\}\}/g, data.invoice.invoice_number)
            .replace(/\{\{total_amount\}\}/g, totals.total_amount.toString())
            .replace(/\{\{store_name\}\}/g, settings.store_name || 'Footwear Store')
            .replace(/\{\{date\}\}/g, new Date().toLocaleDateString('en-IN'));

          msg += channelLink;
          
          // Generate PDF Receipt using print layout
          let mediaBase64 = null;
          let fileName = null;
          try {
            const iframe = document.createElement('iframe');
            iframe.style.position = 'absolute';
            iframe.style.width = '1000px'; 
            iframe.style.height = '1414px';
            iframe.style.top = '-9999px';
            iframe.style.left = '-9999px';
            
            iframe.src = `/invoices/print/${data.invoice.id}?noprint=true`;
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
              const pdfHeight = Math.max((canvas.height * pdfWidth) / canvas.width, 100);
              
              const pdf = new JsPDF({
                orientation: 'p',
                unit: 'mm',
                format: [pdfWidth, pdfHeight]
              });
              
              pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
              mediaBase64 = pdf.output('datauristring').split(',')[1];
              fileName = `${data.invoice.invoice_number || 'invoice'}.pdf`;
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

          const waRes = await fetch('/api/whatsapp/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone: customerPhone, message: msg, mediaBase64, fileName }),
          });
          
          if (!waRes.ok) {
            const errorData = await waRes.json();
            throw new Error(errorData.error || 'Failed to send WhatsApp message');
          }
          
          toast.success('WhatsApp receipt sent!');
        } catch (err: any) {
          toast.error(`Failed to send WhatsApp receipt: ${err.message || err}`);
        }
      }

      if (printAndClear) {
        resetForm();
      } else {
        router.push(`/invoices?highlight=${data.invoice.id}`);
      }
    } catch {
      toast.error('Failed to create invoice');
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{editId ? t('Editing Invoice') : t('Billing')}</h1>
          <p className="text-muted-foreground">{editId ? t('Modifying existing invoice record') : t('Create a new invoice for a customer')}</p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={resetForm}>{t('Cancel Bill')}</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left: Cart & Search */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          
          {/* Top: Auto-Focus Search Bar */}
          <Card className="border-2 border-primary/20 shadow-sm relative z-50">
            <div className="p-1 bg-primary/5 text-center border-b text-[10px] uppercase font-bold text-primary tracking-wider">
              {t('Barcode / SKU Scanner Ready (Press F2 to focus)')}
            </div>
            <CardContent className="p-4">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-6 w-6 text-primary/60" />
                <Input
                  ref={searchRef}
                  autoFocus
                  placeholder={t('Scan barcode or type to search products...')}
                  className="pl-12 h-14 text-lg font-medium bg-slate-50 border-slate-300 shadow-inner focus-visible:ring-primary focus-visible:ring-offset-2"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && filteredProducts.length === 1) {
                      e.preventDefault();
                      addItem(filteredProducts[0]);
                    }
                  }}
                />
              </div>

              {/* Autocomplete Dropdown */}
              {searchTerm.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-50 mx-4 mt-1 bg-white border border-slate-200 rounded-lg shadow-2xl overflow-hidden max-h-[350px] overflow-y-auto">
                  {filteredProducts.length > 0 ? (
                    <ul className="divide-y divide-slate-100">
                      {filteredProducts.map((p) => (
                        <li key={p.id}>
                          <button
                            onClick={() => addItem(p)}
                            className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center justify-between transition-colors focus:bg-slate-50 focus:outline-none"
                          >
                            <div className="flex flex-col">
                              <span className="font-semibold text-slate-800">{p.name}</span>
                              <span className="text-xs text-muted-foreground font-mono mt-0.5">
                                {p.brand && `${p.brand} `}{p.article_no && `| Art: ${p.article_no} `}{p.size && `| Sz: ${p.size}`}
                              </span>
                            </div>
                            <div className="flex flex-col items-end">
                              <span className="font-bold text-slate-900">{formatCurrency(p.selling_price)}</span>
                              <span className="text-[10px] text-slate-500 font-medium bg-slate-100 px-1.5 rounded mt-1">{t('Stock:')} {p.quantity}</span>
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      {t('No products found matching')} "{searchTerm}"
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Middle: Items Table (The Cart) */}
          <Card className="flex-1 shadow-sm border-slate-200">
            <CardHeader className="py-4 border-b bg-slate-50/50">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <ShoppingCart className="h-5 w-5 text-primary" /> {t('Bill Items')} <span className="bg-primary text-white text-xs px-2 py-0.5 rounded-full">{items.length}</span>
                </CardTitle>
                <Button variant="outline" size="sm" onClick={addCustomItem} className="h-8 border-slate-300 bg-white hover:bg-slate-50">
                  <Plus className="mr-1 h-4 w-4" /> {t('Custom Item')}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {items.length === 0 ? (
                <div className="text-center py-12 px-4 flex flex-col items-center justify-center">
                  <div className="bg-slate-100 p-4 rounded-full mb-4">
                    <ShoppingCart className="h-8 w-8 text-slate-400" />
                  </div>
                  <p className="text-lg font-medium text-slate-700">{t('Cart is empty')}</p>
                  <p className="text-sm text-muted-foreground mt-1">{t('Scan a barcode or search for a product to begin.')}</p>
                </div>
              ) : (
                <div className="overflow-x-auto max-h-[45vh] overflow-y-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-slate-100 z-10 shadow-sm">
                      <TableRow>
                        <TableHead className="w-[180px] font-semibold text-slate-800">{t('Product')}</TableHead>
                        <TableHead className="w-[80px] font-semibold text-slate-800">{t('HSN')}</TableHead>
                        <TableHead className="w-[70px] font-semibold text-slate-800">{t('Qty')}</TableHead>
                        <TableHead className="w-[50px] font-semibold text-slate-800">{t('Unit')}</TableHead>
                        <TableHead className="w-[70px] font-semibold text-slate-800">{t('KG')}</TableHead>
                        <TableHead className="w-[90px] font-semibold text-slate-800">{t('Rate')}</TableHead>
                        <TableHead className="w-[70px] font-semibold text-slate-800">{t('Disc.')}</TableHead>
                        {gstEnabled && (
                          <>
                            <TableHead className="w-[60px] font-semibold text-slate-800">{t('GST%')}</TableHead>
                            {!isIgst ? (
                              <>
                                <TableHead className="w-[70px] text-right font-semibold text-slate-800">{t('CGST')}</TableHead>
                                <TableHead className="w-[70px] text-right font-semibold text-slate-800">{t('SGST')}</TableHead>
                              </>
                            ) : (
                              <TableHead className="w-[70px] text-right font-semibold text-slate-800">{t('IGST')}</TableHead>
                            )}
                          </>
                        )}
                        <TableHead className="text-right w-[90px] font-semibold text-slate-800">{t('Total')}</TableHead>
                        <TableHead className="w-[35px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item, idx) => (
                        <TableRow key={idx} className="hover:bg-slate-50/50">
                          <TableCell>
                            {item.product_id ? (
                              <div>
                                <span className="font-semibold text-slate-800">{item.product_name}</span>
                                <div className="text-[10px] text-muted-foreground font-mono mt-0.5">{item.brand} {item.article_no ? `| ${item.article_no}` : ''}</div>
                              </div>
                            ) : (
                              <Input
                                value={item.product_name}
                                onChange={(e) => updateItem(idx, 'product_name', e.target.value)}
                                placeholder={t('Item name')}
                                className="h-8 border-slate-300 focus-visible:ring-1"
                              />
                            )}
                          </TableCell>
                          <TableCell>
                            {item.product_id ? (
                              <span className="text-xs text-muted-foreground font-mono">{item.hsn_code || '-'}</span>
                            ) : (
                              <Input
                                value={item.hsn_code}
                                onChange={(e) => updateItem(idx, 'hsn_code', e.target.value)}
                                placeholder="HSN"
                                className="h-8 w-20 text-xs border-slate-300"
                              />
                            )}
                          </TableCell>
                          <TableCell className="align-top pt-4">
                            <div className="flex flex-col gap-1 items-start">
                              <Input
                                type="number" min="0" step="any"
                                value={item.quantity === 0 ? '' : item.quantity}
                                onChange={(e) => updateItem(idx, 'quantity', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                                className={`h-8 w-20 border-slate-300 font-medium ${item.product_id && item.quantity > item.available_stock ? 'border-destructive focus-visible:ring-destructive text-destructive' : ''}`}
                              />
                              {item.product_id && item.quantity > item.available_stock ? (
                                <span className="text-[10px] text-destructive leading-tight font-medium bg-red-50 px-1 rounded border border-red-100">
                                  Stock: {item.available_stock}
                                </span>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs">{item.unit}</TableCell>
                          <TableCell>
                            {['bag', 'pcs', 'box', 'pack', 'dozen'].includes((item.unit || '').toLowerCase()) ? (
                              <Input
                                type="number" min="0" step="any"
                                value={item.weight_kg === 0 ? '' : item.weight_kg}
                                onChange={(e) => updateItem(idx, 'weight_kg', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                                placeholder="kg"
                                className="h-8 w-20 border-slate-300"
                              />
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {item.product_id ? (
                              <span className="font-semibold text-slate-800">{formatCurrency(item.price)}</span>
                            ) : (
                              <Input
                                type="number" min="0" step="any"
                                value={item.price === 0 ? '' : item.price}
                                onChange={(e) => updateItem(idx, 'price', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                                className="h-8 w-24 border-slate-300"
                              />
                            )}
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number" min="0" step="any"
                              value={item.discount === 0 ? '' : item.discount}
                              onChange={(e) => updateItem(idx, 'discount', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                              className="h-8 w-20 border-slate-300 text-blue-700 font-medium"
                            />
                          </TableCell>
                          {gstEnabled && (
                            <>
                              <TableCell>
                                {item.product_id ? (
                                  <span className="text-xs font-semibold text-slate-700">{item.gst_rate}%</span>
                                ) : (
                                  <Select value={String(item.gst_rate)} onValueChange={(v) => updateItem(idx, 'gst_rate', parseFloat(v))}>
                                    <SelectTrigger className="h-8 w-16 text-xs border-slate-300"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="0">0%</SelectItem>
                                      <SelectItem value="5">5%</SelectItem>
                                      <SelectItem value="12">12%</SelectItem>
                                      <SelectItem value="18">18%</SelectItem>
                                      <SelectItem value="28">28%</SelectItem>
                                    </SelectContent>
                                  </Select>
                                )}
                              </TableCell>
                              {!isIgst ? (
                                <>
                                  <TableCell className="text-right text-xs">
                                    {item.cgst_amount > 0 ? (
                                      <div>
                                        <span className="text-[10px] text-muted-foreground font-medium">{item.cgst_rate}%</span>
                                        <br /><span className="text-slate-700">{item.cgst_amount.toFixed(2)}</span>
                                      </div>
                                    ) : '-'}
                                  </TableCell>
                                  <TableCell className="text-right text-xs">
                                    {item.sgst_amount > 0 ? (
                                      <div>
                                        <span className="text-[10px] text-muted-foreground font-medium">{item.sgst_rate}%</span>
                                        <br /><span className="text-slate-700">{item.sgst_amount.toFixed(2)}</span>
                                      </div>
                                    ) : '-'}
                                  </TableCell>
                                </>
                              ) : (
                                <TableCell className="text-right text-xs">
                                  {item.igst_amount > 0 ? (
                                    <div>
                                      <span className="text-[10px] text-muted-foreground font-medium">{item.igst_rate}%</span>
                                      <br /><span className="text-slate-700">{item.igst_amount.toFixed(2)}</span>
                                    </div>
                                  ) : '-'}
                                </TableCell>
                              )}
                            </>
                          )}
                          <TableCell className="text-right font-bold text-slate-900 bg-slate-50/50">{formatCurrency(item.total)}</TableCell>
                          <TableCell>
                            <Button size="icon-sm" variant="ghost" className="hover:bg-red-100" onClick={() => removeItem(idx)}>
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Bottom: Product Catalog (Hidden by default unless browsing) */}
          {searchTerm.length === 0 && (
            <Card className="shadow-sm border-slate-200">
            <CardHeader className="py-3 border-b bg-slate-50/50">
              <CardTitle className="text-sm font-medium text-slate-700">{t('Browse Product Catalog')}</CardTitle>
            </CardHeader>
            <CardContent className="p-4 bg-slate-50/30">
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 max-h-[200px] overflow-y-auto pr-2 pb-2">
                {filteredProducts.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => addItem(p)}
                    className="flex flex-col text-left p-3 border border-slate-200 bg-white rounded-xl hover:bg-slate-50 hover:border-primary/40 transition-colors focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
                  >
                    <span className="font-semibold text-sm truncate w-full text-slate-800" title={p.name}>{p.name}</span>
                    <span className="text-[11px] text-muted-foreground font-mono mt-1 truncate w-full">
                      {p.brand && `${p.brand} `}{p.article_no && `| Art: ${p.article_no} `}{p.size && `| Sz: ${p.size}`}
                    </span>
                    <div className="mt-3 flex items-center justify-between w-full">
                      <span className="font-bold text-sm text-slate-900">{formatCurrency(p.selling_price)}</span>
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-[10px] bg-slate-100 border border-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-medium">
                          {p.quantity} {p.unit}
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
                {filteredProducts.length === 0 && (
                  <div className="col-span-full py-6 text-center text-sm text-muted-foreground bg-white border border-dashed rounded-lg">
                    {t('No products found.')}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          )}
        </div>        {/* Right: Bill Summary & Checkout */}
        <div className="space-y-4 flex flex-col">
          
          {/* Customer */}
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="py-3 border-b bg-slate-50/50">
              <CardTitle className="text-sm font-medium text-slate-700">{t('Customer Details')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              <Select value={customerId || 'walk-in'} onValueChange={handleCustomerSelect}>
                <SelectTrigger className="border-slate-300 font-medium"><SelectValue placeholder={t('Walk-in Customer')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="walk-in">{t('Walk-in Customer (Quick Bill)')}</SelectItem>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name} {c.phone ? `(${c.phone})` : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {customerId === 'walk-in' || !customerId ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder={t('Name (Optional)')} className="border-slate-300" value={customerName === 'Walk-in Customer' ? '' : customerName}
                      onChange={(e) => setCustomerName(e.target.value || 'Walk-in Customer')} />
                    <Input placeholder={t('Phone (Optional)')} className="border-slate-300" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
                  </div>
                </div>
              ) : null}
              <div className="mt-3 flex items-center gap-2">
                <Label className="text-xs text-muted-foreground mr-2">{t('Gender:')}</Label>
                <button className={`px-3 py-1 rounded text-xs font-semibold ${customerGender === 'Male' ? 'bg-blue-100 text-blue-700 border-blue-300' : 'bg-slate-100 text-slate-600 border-slate-200'} border`} onClick={() => setCustomerGender('Male')}>{t('Male')}</button>
                <button className={`px-3 py-1 rounded text-xs font-semibold ${customerGender === 'Female' ? 'bg-pink-100 text-pink-700 border-pink-300' : 'bg-slate-100 text-slate-600 border-slate-200'} border`} onClick={() => setCustomerGender('Female')}>{t('Female')}</button>
                <button className={`px-3 py-1 rounded text-xs font-semibold ${customerGender === 'Unspecified' ? 'bg-gray-200 text-gray-700 border-gray-300' : 'bg-slate-100 text-slate-600 border-slate-200'} border`} onClick={() => setCustomerGender('Unspecified')}>{t('Unspecified')}</button>
              </div>
            </CardContent>
          </Card>

          {/* Payment & Discount */}
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="py-3 border-b bg-slate-50/50">
              <CardTitle className="text-sm font-medium text-slate-700">{t('Payment & Discount')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">{t('Method')}</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger className="mt-1 border-slate-300"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">{t('Cash')}</SelectItem>
                      <SelectItem value="upi">{t('UPI')}</SelectItem>
                      <SelectItem value="card">{t('Card')}</SelectItem>
                      <SelectItem value="bank_transfer">{t('Bank Transfer')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">{t('Status')}</Label>
                  <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                    <SelectTrigger className="mt-1 border-slate-300"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="paid">{t('Paid')}</SelectItem>
                      <SelectItem value="unpaid">{t('Unpaid')}</SelectItem>
                      <SelectItem value="partial">{t('Partial')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {paymentStatus === 'partial' && (
                <div>
                  <Label className="text-xs text-muted-foreground">{t('Amount Paid (Rs.) *')}</Label>
                  <Input type="number" min="0" value={amountPaid}
                    placeholder="0.00" className="mt-1 border-slate-300"
                    onChange={(e) => setAmountPaid(e.target.value ? parseFloat(e.target.value) : '')} />
                </div>
              )}

              <div>
                <Label className="text-xs text-muted-foreground">{t('Overall Discount')}</Label>
                <div className="flex mt-1 shadow-sm rounded-md">
                  <Select value={discountType} onValueChange={(v: 'flat'|'percent') => setDiscountType(v)}>
                    <SelectTrigger className="w-[80px] rounded-r-none border-r-0 bg-slate-100 border-slate-300 font-medium">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="flat">{t('₹ Flat')}</SelectItem>
                      <SelectItem value="percent">{t('% Pct')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input 
                    type="number" min="0" step="any"
                    value={discountAmount} 
                    onChange={(e) => setDiscountAmount(e.target.value === '' ? '' : parseFloat(e.target.value))} 
                    className="rounded-l-none border-slate-300 focus-visible:ring-1 focus-visible:z-10 relative" 
                    placeholder="0.00" 
                  />
                </div>
              </div>
              
              <div>
                <Label className="text-xs text-muted-foreground">{t('Additional Charges (Rs.)')}</Label>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  <Input placeholder={t('Hamali')} type="number" className="border-slate-300 text-xs" value={hamali} onChange={(e) => setHamali(e.target.value ? parseFloat(e.target.value) : '')} />
                  <Input placeholder={t('Mkt Cess')} type="number" className="border-slate-300 text-xs" value={marketCess} onChange={(e) => setMarketCess(e.target.value ? parseFloat(e.target.value) : '')} />
                  <Input placeholder={t('Other Exp')} type="number" className="border-slate-300 text-xs" value={otherExp} onChange={(e) => setOtherExp(e.target.value ? parseFloat(e.target.value) : '')} />
                </div>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">{t('Notes')}</Label>
                <Textarea 
                  placeholder={t('Optional notes for invoice...')} 
                  className="mt-1 border-slate-300 resize-none h-16" 
                  value={notes} 
                  onChange={(e) => setNotes(e.target.value)} 
                />
              </div>

              <div className="flex items-center space-x-2 pt-2 border-t border-slate-100">
                <Checkbox id="sendWa" checked={sendWa && waConnected} onCheckedChange={(c) => setSendWa(!!c)} disabled={!waConnected} />
                <Label htmlFor="sendWa" className="text-xs text-muted-foreground cursor-pointer">
                  {t('Send WhatsApp Receipt')} {waConnected ? '' : '(Not connected in Settings)'}
                </Label>
              </div>
            </CardContent>
          </Card>

          {/* Tax Settings (Compact) */}
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="py-2 border-b bg-slate-50/50 cursor-pointer" onClick={() => document.getElementById('tax-settings-body')?.classList.toggle('hidden')}>
              <CardTitle className="text-[13px] font-medium text-slate-600 flex justify-between">
                {t('Tax Settings (GST)')}
                <span className="text-primary font-normal">{t('Toggle')}</span>
              </CardTitle>
            </CardHeader>
            <CardContent id="tax-settings-body" className="space-y-3 pt-3 hidden">
              <div className="flex items-center justify-between">
                <Label className="text-sm">{t('Enable GST')}</Label>
                <Switch checked={gstEnabled} onCheckedChange={setGstEnabled} />
              </div>
              {gstEnabled && (
                <>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm text-muted-foreground">{t('Price includes GST')}</Label>
                    <Switch checked={gstInclusive} onCheckedChange={setGstInclusive} />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm text-muted-foreground">{t('Inter-State (IGST)')}</Label>
                    <Switch checked={isIgst} onCheckedChange={setIsIgst} />
                  </div>
                  {(customerId === 'walk-in' || !customerId) ? (
                    <div className="space-y-2 mt-2 pt-2 border-t">
                      <Input placeholder={t('Customer GSTIN')} className="text-xs h-8" value={customerGstin} onChange={(e) => setCustomerGstin(e.target.value.toUpperCase())} maxLength={15} />
                      <Input placeholder={t('Customer Address')} className="text-xs h-8" value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} />
                    </div>
                  ) : (
                    <div className="space-y-2 mt-2 pt-2 border-t">
                      <Input placeholder={t('Customer GSTIN')} className="text-xs h-8" value={customerGstin} onChange={(e) => setCustomerGstin(e.target.value.toUpperCase())} maxLength={15} />
                      <Input placeholder={t('Customer Address')} className="text-xs h-8" value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} />
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Bill Summary - Huge Checkout Box */}
          <Card className="mt-auto bg-slate-50 border-2 border-primary/20 shadow-md">
            <CardContent className="space-y-2 pt-5 pb-4 px-5">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600 font-medium">{t('Subtotal')}</span>
                <span className="font-semibold text-slate-800">{formatCurrency(totals.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600 font-medium">{t('Discount')} {discountType === 'percent' && discountAmount ? `(${discountAmount}%)` : ''}</span>
                <span className="text-blue-600 font-bold">-{formatCurrency(totals.final_discount)}</span>
              </div>
              {gstEnabled && totals.gst_amount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 font-medium">{t('GST')}</span>
                  <span className="font-semibold text-slate-800">{formatCurrency(totals.gst_amount)}</span>
                </div>
              )}
              {((Number(hamali)||0) + (Number(marketCess)||0) + (Number(otherExp)||0)) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 font-medium">{t('Extra Charges')}</span>
                  <span className="font-semibold text-slate-800">+{formatCurrency((Number(hamali)||0) + (Number(marketCess)||0) + (Number(otherExp)||0))}</span>
                </div>
              )}
              {totals.round_off !== 0 && (
                <div className="flex justify-between text-xs mt-1">
                  <span className="text-muted-foreground">{t('Round Off')}</span>
                  <span className="text-muted-foreground">{totals.round_off > 0 ? '+' : ''}{totals.round_off.toFixed(2)}</span>
                </div>
              )}
              
              <div className="pt-4 mt-3 border-t-2 border-slate-200 flex flex-col gap-1">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-bold text-slate-800 uppercase tracking-wide">{t('Total')}</span>
                  <span className="text-4xl font-black text-primary tracking-tighter">{formatCurrency(totals.total_amount)}</span>
                </div>
              </div>
            </CardContent>
            
            <div className="p-4 bg-white rounded-b-lg border-t border-slate-200">
              <Button 
                id="save-bill-btn" 
                size="lg" 
                className="w-full h-16 text-xl font-bold shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all bg-primary hover:bg-primary/90 text-primary-foreground" 
                onClick={() => handleSave(true)} 
                disabled={saving}
              >
                {saving ? (
                  t('Saving...')
                ) : (
                  <span className="flex items-center">
                    <CheckCircle className="mr-2 h-6 w-6" /> {editId ? t('Update Invoice') : t('Save & Print')} <span className="text-sm font-normal opacity-80 ml-2">{t('(Ctrl+S)')}</span>
                  </span>
                )}
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function BillingPageContent() {
  const [activeTab, setActiveTab] = useState(0);
  const searchParams = useSearchParams();
  const router = useRouter();
  const editId = searchParams.get('edit');
  const { t } = useLanguage();
  
  const [tabEdits, setTabEdits] = useState<(string | null)[]>(Array(7).fill(null));

  useEffect(() => {
    if (editId) {
      setTabEdits(prev => {
        const next = [...prev];
        next[activeTab] = editId;
        return next;
      });
      // clear the search param
      router.replace('/billing');
    }
  }, [editId, activeTab, router]);

  return (
    <div className="space-y-4">
       <Tabs value={activeTab.toString()} onValueChange={v => setActiveTab(parseInt(v))}>
         <TabsList className="mb-4 overflow-x-auto max-w-full justify-start h-auto p-1">
           {Array.from({length: 7}).map((_, i) => (
             <TabsTrigger key={i} value={i.toString()} className="px-6 font-medium whitespace-nowrap">
               {t('Counter')} {i + 1} {tabEdits[i] ? t('(Editing)') : ''}
             </TabsTrigger>
           ))}
         </TabsList>
       </Tabs>
       {Array.from({length: 7}).map((_, i) => (
         <div key={i} className={activeTab === i ? 'block' : 'hidden'}>
            <BillingCounter counterIndex={i} editId={tabEdits[i]} onClearEdit={() => {
              setTabEdits(prev => {
                const next = [...prev];
                next[i] = null;
                return next;
              });
            }} />
         </div>
       ))}
    </div>
  );
}

import { Suspense } from 'react';

export default function BillingPageWrapper() {
  return (
    <Suspense fallback={<div>Loading billing page...</div>}>
      <BillingPageContent />
    </Suspense>
  );
}
