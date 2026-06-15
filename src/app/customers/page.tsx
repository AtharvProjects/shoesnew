/**
 * Customers Management Page
 * CRUD + purchase history view per customer.
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Pencil, Trash2, Users, Eye, Banknote, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { isValidEmail, isValidPhone, isValidGSTIN } from '@/lib/validations';
import { useLanguage } from '@/components/LanguageProvider';

interface Customer {
  id: number; name: string; phone: string; email: string;
  address: string; gstin: string; gender: string; balance: number; created_at: string;
}

interface Invoice {
  id: number; invoice_number: string; total_amount: number;
  payment_status: string; created_at: string;
}

const emptyCustomer = { name: '', phone: '', email: '', address: '', gstin: '', gender: 'Unspecified' };

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [paymentCustomer, setPaymentCustomer] = useState<Customer | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number | ''>('');
  const [form, setForm] = useState(emptyCustomer);
  const [history, setHistory] = useState<{ customer: Customer; invoices: Invoice[] } | null>(null);
  const { t, language } = useLanguage();

  const fetchCustomers = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      const res = await fetch(`/api/customers?${params}`);
      setCustomers(await res.json());
    } catch { toast.error(t('Failed to load customers') || 'Failed to load customers'); }
    finally { setLoading(false); }
  }, [search]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  const openAdd = () => { setEditingCustomer(null); setForm(emptyCustomer); setDialogOpen(true); };
  const openEdit = (c: Customer) => {
    setEditingCustomer(c);
    setForm({ name: c.name, phone: c.phone, email: c.email, address: c.address, gstin: c.gstin, gender: c.gender || 'Unspecified' });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name) { toast.error(t('Name is required') || 'Name is required'); return; }
    if (form.email && !isValidEmail(form.email)) {
      toast.error(t('Please enter a valid email address') || 'Please enter a valid email address');
      return;
    }
    if (form.phone && !isValidPhone(form.phone)) {
      toast.error(t('Please enter a valid 10-digit phone number') || 'Please enter a valid 10-digit phone number');
      return;
    }
    if (form.gstin && !isValidGSTIN(form.gstin)) {
      toast.error(t('Please enter a valid 15-digit GSTIN') || 'Please enter a valid 15-digit GSTIN');
      return;
    }
    try {
      const url = editingCustomer ? `/api/customers/${editingCustomer.id}` : '/api/customers';
      const method = editingCustomer ? 'PUT' : 'POST';
      await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      toast.success(editingCustomer ? t('Customer updated') || 'Customer updated' : t('Customer added') || 'Customer added');
      setDialogOpen(false);
      fetchCustomers();
    } catch { toast.error(t('Failed to save') || 'Failed to save'); }
  };

  /* Delete Confirmation State */
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  const promptDelete = (c: Customer) => {
    setCustomerToDelete(c);
    setDeleteConfirmText('');
    setDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (!customerToDelete) return;
    setDeleting(true);
    try {
      await fetch(`/api/customers/${customerToDelete.id}`, { method: 'DELETE' });
      toast.success(t('Customer deleted successfully') || 'Customer deleted permanently');
      setDeleteOpen(false);
      fetchCustomers();
    } catch {
      toast.error(t('Failed to delete customer') || 'Failed to delete customer');
    } finally {
      setDeleting(false);
    }
  };

  const viewHistory = async (c: Customer) => {
    const res = await fetch(`/api/customers/${c.id}?history=1`);
    const data = await res.json();
    setHistory(data);
    setHistoryOpen(true);
  };

  const openPay = (c: Customer) => {
    setPaymentCustomer(c);
    setPaymentAmount(c.balance); // Default to full amount
    setPayOpen(true);
  };

  const handlePayment = async () => {
    if (!paymentAmount || paymentAmount <= 0) {
      toast.error(t('Enter a valid amount') || 'Enter a valid amount');
      return;
    }
    try {
      if (!paymentCustomer) return;
      const res = await fetch(`/api/customers/${paymentCustomer.id}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: paymentAmount }),
      });
      if (!res.ok) throw new Error();
      toast.success(t('Payment settled successfully!') || 'Payment settled successfully!');
      setPayOpen(false);
      fetchCustomers();
    } catch {
      toast.error(t('Failed to process payment') || 'Failed to process payment');
    }
  };

  /* ── Send full bill history to customer on WhatsApp ── */
  const sendHistoryOnWhatsApp = async (c: Customer) => {
    if (!c.phone) {
      toast.error('This customer has no phone number saved.');
      return;
    }
    const toastId = toast.loading('Fetching bill history...');
    try {
      const res = await fetch(`/api/customers/${c.id}?history=1`);
      const data = await res.json();
      const invoices: Invoice[] = data.invoices || [];

      if (invoices.length === 0) {
        toast.dismiss(toastId);
        toast.info('No bills found for this customer.');
        return;
      }

      const totalSpent = invoices.reduce((sum, inv) => sum + inv.total_amount, 0);
      const pendingAmount = c.balance;

      // Build the formatted WhatsApp message
      const lines: string[] = [];

      if (language === 'mr') {
        lines.push(`🧾 *${c.name} साठी बिलांचा इतिहास*`);
        lines.push(`📅 तारीख: ${format(new Date(), 'dd MMM yyyy')}`);
        lines.push('');
        lines.push('─────────────────────');

        invoices.forEach((inv, idx) => {
          const statusEmoji = inv.payment_status === 'paid' ? '✅' : inv.payment_status === 'partial' ? '⚠️' : '❌';
          lines.push(`*${idx + 1}. बिल #${inv.invoice_number}*`);
          lines.push(`   📆 ${format(new Date(inv.created_at.replace(' ', 'T') + 'Z'), 'dd MMM yyyy')}`);
          lines.push(`   💰 रुपये ${inv.total_amount.toFixed(2)}`);
          lines.push(`   ${statusEmoji} ${inv.payment_status === 'paid' ? 'पेड' : inv.payment_status === 'partial' ? 'अंशतः' : 'थकीत'}`);
          lines.push('');
        });

        lines.push('─────────────────────');
        lines.push(`📊 *एकूण बिले:* ${invoices.length}`);
        lines.push(`💳 *एकूण रक्कम:* रुपये ${totalSpent.toFixed(2)}`);

        if (pendingAmount > 0) {
          lines.push(`⚠️ *थकीत रक्कम:* रुपये ${pendingAmount.toFixed(2)}`);
          lines.push('');
          lines.push('_कृपया आपली थकीत रक्कम लवकरात लवकर जमा करावी._');
        } else {
          lines.push('');
          lines.push('_✨ सर्व बिले भरलेली आहेत. धन्यवाद!_');
        }

        lines.push('');
        lines.push('🙏 भेट दिल्याबद्दल धन्यवाद!');
      } else {
        lines.push(`🧾 *Bill History for ${c.name}*`);
        lines.push(`📅 As on ${format(new Date(), 'dd MMM yyyy')}`);
        lines.push('');
        lines.push('─────────────────────');

        invoices.forEach((inv, idx) => {
          const statusEmoji = inv.payment_status === 'paid' ? '✅' : inv.payment_status === 'partial' ? '⚠️' : '❌';
          lines.push(`*${idx + 1}. Invoice #${inv.invoice_number}*`);
          lines.push(`   📆 ${format(new Date(inv.created_at.replace(' ', 'T') + 'Z'), 'dd MMM yyyy')}`);
          lines.push(`   💰 Rs. ${inv.total_amount.toFixed(2)}`);
          lines.push(`   ${statusEmoji} ${inv.payment_status.charAt(0).toUpperCase() + inv.payment_status.slice(1)}`);
          lines.push('');
        });

        lines.push('─────────────────────');
        lines.push(`📊 *Total Bills:* ${invoices.length}`);
        lines.push(`💳 *Total Spent:* Rs. ${totalSpent.toFixed(2)}`);

        if (pendingAmount > 0) {
          lines.push(`⚠️ *Pending Balance:* Rs. ${pendingAmount.toFixed(2)}`);
          lines.push('');
          lines.push('_Please clear your pending dues at your earliest._');
        } else {
          lines.push('');
          lines.push('_✨ All bills are cleared. Thank you!_');
        }

        lines.push('');
        lines.push('🙏 Thank you for your business!');
      }

      const message = lines.join('\n');
      const cleanPhone = c.phone.replace(/\D/g, '');
      
      // ─── Generate PDF ────────────────────────────────────────────────
      const jsPDFModule = await import('jspdf');
      const JsPDF = (jsPDFModule.jsPDF ?? jsPDFModule.default ?? jsPDFModule) as any;
      const doc = new JsPDF();
      const lm = 14;
      doc.setFontSize(20); doc.setFont('helvetica', 'bold');
      doc.text(`Bill History - ${c.name}`, lm, 18);
      doc.setFontSize(11); doc.setFont('helvetica', 'normal');
      doc.text(`Total Spent: Rs. ${totalSpent.toFixed(2)}`, lm, 26);
      doc.text(`Pending Balance: Rs. ${pendingAmount.toFixed(2)}`, lm, 32);
      
      const autoTableMod = await import('jspdf-autotable');
      const autoTable = (autoTableMod.default ?? autoTableMod) as any;
      autoTable(doc, {
        startY: 40,
        head: [['Invoice #', 'Date', 'Amount', 'Status']],
        body: invoices.map(inv => [
          inv.invoice_number,
          format(new Date(inv.created_at.replace(' ', 'T') + 'Z'), 'dd MMM yyyy'),
          `Rs. ${inv.total_amount.toFixed(2)}`,
          inv.payment_status.toUpperCase()
        ]),
        margin: { left: lm }, headStyles: { fillColor: [41, 128, 185] },
      });
      const mediaBase64 = doc.output('datauristring').split(',')[1];
      const fileName = `Bill_History_${c.name.replace(/\s+/g, '_')}.pdf`;
      
      const waRes = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: cleanPhone, message, mediaBase64, fileName })
      });
      
      if (!waRes.ok) throw new Error('Failed to send via background API');
      
      toast.success(t('Bill history sent successfully via WhatsApp!') || 'Bill history sent successfully via WhatsApp!', { id: toastId });
    } catch (err: any) {
      console.error('WhatsApp Bill Error:', err);
      toast.error(`Failed: ${err.message || err}`, { id: toastId });
    }
  };

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('Customers')}</h1>
          <p className="text-muted-foreground">{t('Manage customers and view purchase history')}</p>
        </div>
        <Button onClick={openAdd}><Plus className="mr-2 h-4 w-4" /> {t('Add Customer')}</Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder={t('Search by name, phone, or email...')} className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> {t('Customers')} ({customers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
          ) : customers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-lg font-medium">{t('No customers found')}</p>
              <Button onClick={openAdd} className="mt-4" variant="outline"><Plus className="mr-2 h-4 w-4" /> {t('Add Customer')}</Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('Name')}</TableHead>
                  <TableHead>{t('Phone')}</TableHead>
                  <TableHead>{t('Email')}</TableHead>
                  <TableHead>{t('GSTIN')}</TableHead>
                  <TableHead className="text-right">{t('Balance')}</TableHead>
                  <TableHead className="text-right">{t('Actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>{c.phone || '-'}</TableCell>
                    <TableCell>{c.email || '-'}</TableCell>
                    <TableCell>{c.gstin || '-'}</TableCell>
                    <TableCell className="text-right">
                      {c.balance > 0 ? (
                        <span className="text-red-500 font-medium">{formatCurrency(c.balance)}</span>
                      ) : (
                        <span className="text-green-600">{formatCurrency(0)}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {c.balance > 0 && (
                          <Button size="icon-sm" variant="ghost" className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50" onClick={() => openPay(c)} title="Settle Balance">
                            <Banknote className="h-4 w-4" />
                          </Button>
                        )}
                        {/* WhatsApp Bill History — only visible if customer has a phone number */}
                        {c.phone && (
                          <Button
                            size="icon-sm" variant="ghost"
                            className="text-green-600 hover:text-green-700 hover:bg-green-50"
                            onClick={() => sendHistoryOnWhatsApp(c)}
                            title="Send Bill History on WhatsApp"
                          >
                            <MessageCircle className="h-4 w-4" />
                          </Button>
                        )}
                        <Button size="icon-sm" variant="ghost" onClick={() => viewHistory(c)} title="View History">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button size="icon-sm" variant="ghost" onClick={() => openEdit(c)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon-sm" variant="ghost" onClick={() => promptDelete(c)}>
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

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingCustomer ? t('Edit Customer') : t('Add Customer')}</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>{t('Name *')}</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div>
                <Label>{t('Gender')}</Label>
                <select className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" value={form.gender || 'Unspecified'} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                  <option value="Unspecified">Unspecified</option>
                  <option value="Male">{t('Male')}</option>
                  <option value="Female">{t('Female')}</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>{t('Phone Number')}</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div><Label>{t('Email')}</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            </div>
            <div><Label>{t('Address')}</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
            <div><Label>{t('GSTIN')}</Label><Input value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('Cancel')}</Button>
            <Button onClick={handleSave}>{editingCustomer ? t('Update') : t('Add Customer')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Purchase History Dialog */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>{t('Purchase History — ')} {history?.customer?.name}</span>
              {history?.customer?.phone && (
                <Button
                  size="sm" variant="outline"
                  className="text-green-600 border-green-200 hover:bg-green-50 ml-4 shrink-0"
                  onClick={() => history?.customer && sendHistoryOnWhatsApp(history.customer)}
                >
                  <MessageCircle className="mr-1 h-3 w-3" />
                  {t('Send Bill History on WhatsApp')}
                </Button>
              )}
            </DialogTitle>
          </DialogHeader>
          {history?.invoices && history.invoices.length > 0 ? (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.invoices.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-medium">{inv.invoice_number}</TableCell>
                      <TableCell>{format(new Date(inv.created_at.replace(' ', 'T') + 'Z'), 'dd MMM yyyy, hh:mm a')}</TableCell>
                      <TableCell className="text-right">{formatCurrency(inv.total_amount)}</TableCell>
                      <TableCell>
                        <Badge variant={inv.payment_status === 'paid' ? 'secondary' : 'destructive'}>
                          {inv.payment_status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {/* Summary row */}
              <div className="flex justify-between items-center px-1 pt-2 border-t text-sm font-medium">
                <span className="text-muted-foreground">{history.invoices.length} bill{history.invoices.length !== 1 ? 's' : ''}</span>
                <span>Total: {formatCurrency(history.invoices.reduce((s, i) => s + i.total_amount, 0))}</span>
              </div>
            </>
          ) : (
            <p className="text-center py-8 text-muted-foreground">No purchase history</p>
          )}
        </DialogContent>
      </Dialog>

      {/* Receive Payment Dialog */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('Settle Balance')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-muted p-4 rounded-lg flex justify-between items-center">
              <span className="text-sm font-medium text-muted-foreground">{t('Current Balance')}</span>
              <span className="text-lg font-bold text-red-500">
                {paymentCustomer ? formatCurrency(paymentCustomer.balance) : formatCurrency(0)}
              </span>
            </div>

            <div className="space-y-2">
              <Label>{t('Amount Received (Rs.)')}</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value ? parseFloat(e.target.value) : '')}
                className="text-lg font-medium"
                placeholder="Enter amount..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)}>{t('Cancel')}</Button>
            <Button onClick={handlePayment} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {t('Settle Balance')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              {t('Delete Customer')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-red-50 text-red-800 p-4 rounded-md text-sm border border-red-200">
              <p className="font-bold mb-1">{t('Warning: This action cannot be undone.')}</p>
              <p>{t('Deleting this customer will permanently remove them from the system. If they have a pending balance, it will be lost from records.')}</p>
            </div>

            <div className="space-y-2">
              <Label>
                Please type <strong className="select-none">{customerToDelete?.name}</strong> to confirm.
              </Label>
              <Input
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder={customerToDelete?.name}
                className="mt-2 font-bold"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              {t('Cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleting || deleteConfirmText !== customerToDelete?.name}
            >
              {deleting ? t('Deleting...') : t('Permanently Delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
