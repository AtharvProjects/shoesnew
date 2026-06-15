/**
 * Settings Page — Store info, Gmail SMTP config, invoice settings.
 */

'use client';

import { useEffect, useState } from 'react';
import { useLanguage } from '@/components/LanguageProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Settings, Mail, Store, FileText, Trash2, Plus, Tag, UserCheck, Database, Download, Upload, MessageCircle, QrCode, RefreshCcw, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { 
  isValidEmail, isValidPhone, isValidGSTIN, 
  isValidIFSC, isValidUPI, isNonNegative 
} from '@/lib/validations';

export default function SettingsPage() {
  const { t, language } = useLanguage();
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [categories, setCategories] = useState<{ id: number, name: string }[]>([]);
  const [units, setUnits] = useState<{ id: number, name: string }[]>([]);
  const [newCat, setNewCat] = useState('');
  const [newUnit, setNewUnit] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [waStatus, setWaStatus] = useState<'disconnected' | 'initializing' | 'qr_ready' | 'authenticating' | 'syncing' | 'connected' | 'error'>('disconnected');
  const [waQr, setWaQr] = useState<string | null>(null);
  const [waError, setWaError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/settings').then(r => r.json()),
      fetch('/api/categories').then(r => r.json()),
      fetch('/api/units').then(r => r.json())
    ]).then(([settingsData, catData, unitData]) => {
      setSettings(settingsData);
      setCategories(catData);
      setUnits(unitData);
      setLoading(false);
    });

    const fetchWa = async () => {
      try {
        const res = await fetch('/api/whatsapp/status', { cache: 'no-store' });
        const data = await res.json();
        setWaStatus(data.status);
        setWaQr(data.qr);
        setWaError(data.error);
      } catch {}
    };
    fetchWa();
    const interval = setInterval(fetchWa, 3000);
    return () => clearInterval(interval);
  }, []);

  const addCategory = async () => {
    if (!newCat.trim()) return;
    try {
      const res = await fetch('/api/categories', { method: 'POST', body: JSON.stringify({ name: newCat }) });
      if (res.ok) {
        setCategories([...categories, { id: Date.now(), name: newCat }]);
        setNewCat('');
        fetch('/api/categories').then(r => r.json()).then(setCategories);
      }
    } catch { toast.error(t('Failed to add category')); }
  };

  const deleteCategory = async (id: number) => {
    if (!confirm(t('Delete this category?'))) return;
    try {
      await fetch(`/api/categories/${id}`, { method: 'DELETE' });
      setCategories(categories.filter(c => c.id !== id));
    } catch { toast.error(t('Failed to delete category')); }
  };

  const addUnit = async () => {
    if (!newUnit.trim()) return;
    try {
      const res = await fetch('/api/units', { method: 'POST', body: JSON.stringify({ name: newUnit }) });
      if (res.ok) {
        setUnits([...units, { id: Date.now(), name: newUnit }]);
        setNewUnit('');
        fetch('/api/units').then(r => r.json()).then(setUnits);
      }
    } catch { toast.error(t('Failed to add unit')); }
  };

  const deleteUnit = async (id: number) => {
    if (!confirm(t('Delete this unit?'))) return;
    try {
      await fetch(`/api/units/${id}`, { method: 'DELETE' });
      setUnits(units.filter(u => u.id !== id));
    } catch { toast.error(t('Failed to delete unit')); }
  };

  const update = (key: string, value: string) => {
    setSettings({ ...settings, [key]: value });
  };

  const handleSave = async () => {
    // Basic validations
    if (settings.store_email && !isValidEmail(settings.store_email)) {
      toast.error(t('Invalid Store Email')); return;
    }
    if (settings.store_phone && !isValidPhone(settings.store_phone)) {
      toast.error(t('Invalid Store Phone (10-digit number required)')); return;
    }
    if (settings.store_gstin && !isValidGSTIN(settings.store_gstin)) {
      toast.error(t('Invalid Store GSTIN')); return;
    }
    if (settings.bank_ifsc && !isValidIFSC(settings.bank_ifsc)) {
      toast.error(t('Invalid Bank IFSC Code (e.g., SBIN0000123)')); return;
    }
    if (settings.upi_id && !isValidUPI(settings.upi_id)) {
      toast.error(t('Invalid UPI ID format (e.g., storename@upi)')); return;
    }
    if (settings.ca_phone && !isValidPhone(settings.ca_phone)) {
      toast.error(t('Invalid CA WhatsApp Number (digits only, e.g., 919876543210)')); return;
    }
    if (settings.gmail_user && !isValidEmail(settings.gmail_user)) {
      toast.error(t('Invalid Gmail Address')); return;
    }
    if (settings.low_stock_email && !isValidEmail(settings.low_stock_email)) {
      toast.error(t('Invalid alert notification email')); return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error();
      toast.success(t('Settings saved successfully'));
    } catch { toast.error(t('Failed to save settings')); }
    finally { setSaving(false); }
  };

  const handleBackup = () => {
    window.location.href = '/api/backup';
    toast.success(t('Backup download started'));
  };

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm('CRITICAL WARNING: This will overwrite your current database with the uploaded file. All current data will be LOST. Are you sure?')) {
      e.target.value = '';
      return;
    }

    const formData = new FormData();
    formData.append('backup', file);

    try {
      const res = await fetch('/api/backup', { method: 'POST', body: formData });
      const data = await res.json();
      if (res.ok) {
        toast.success(t('Database restored! Please refresh the page.'));
        setTimeout(() => window.location.reload(), 2000);
      } else {
        toast.error(data.error || t('Restore failed'));
      }
    } catch {
      toast.error(t('Failed to connect to server'));
    } finally {
      e.target.value = '';
    }
  };

  const [testingEmail, setTestingEmail] = useState(false);
  const handleTestEmail = async () => {
    setTestingEmail(true);
    try {
      const res = await fetch('/api/settings/test-email', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
      } else {
        toast.error(data.error);
      }
    } catch {
      toast.error('Connection failed');
    } finally {
      setTestingEmail(false);
    }
  };

  const connectWhatsApp = async () => {
    setWaStatus('initializing');
    setWaError(null);
    try {
      await fetch('/api/whatsapp/connect', { method: 'POST' });
    } catch {
      toast.error(t('Failed to start WhatsApp'));
    }
  };

  const disconnectWhatsApp = async () => {
    setWaStatus('disconnected');
    setWaQr(null);
    try {
      await fetch('/api/whatsapp/disconnect', { method: 'POST' });
      toast.success(t('Disconnected from WhatsApp'));
    } catch {
      toast.error(t('Failed to disconnect'));
    }
  };

  const forceResetWhatsApp = async () => {
    if (!confirm('This will wipe all WhatsApp session data on this PC and force a complete restart. You will need to scan the QR code again. Proceed?')) return;
    setWaStatus('disconnected');
    setWaQr(null);
    setWaError(null);
    try {
      await fetch('/api/whatsapp/reset', { method: 'POST' });
      toast.success(t('WhatsApp Integration Reset'));
    } catch {
      toast.error(t('Failed to reset'));
    }
  };

  if (loading) {
    return <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('Settings')}</h1>
        <p className="text-muted-foreground">{t('Configure your store and notification settings')}</p>
      </div>

      {/* Store Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Store className="h-5 w-5" /> {t('Store Information')}</CardTitle>
          <CardDescription>{t('Business details shown on invoices')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div><Label>{t('Store Name')}</Label><Input value={settings.store_name || ''} onChange={(e) => update('store_name', e.target.value)} /></div>
          <div><Label>{t('Store Address')}</Label><Input value={settings.store_address || ''} onChange={(e) => update('store_address', e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>{t('Phone')}</Label><Input value={settings.store_phone || ''} onChange={(e) => update('store_phone', e.target.value)} /></div>
            <div><Label>{t('Email')}</Label><Input value={settings.store_email || ''} onChange={(e) => update('store_email', e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>{t('GSTIN')}</Label><Input value={settings.store_gstin || ''} onChange={(e) => update('store_gstin', e.target.value)} placeholder="e.g., 27AAAAA0000A1Z5" /></div>
          </div>
          <div>
            <Label>{t('State Code')}</Label>
            <Select value={settings.store_state_code || '27'} onValueChange={(v) => update('store_state_code', v)}>
              <SelectTrigger><SelectValue placeholder="Select State" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="27">27 - Maharashtra</SelectItem>
                <SelectItem value="01">01 - Jammu & Kashmir</SelectItem>
                <SelectItem value="02">02 - Himachal Pradesh</SelectItem>
                <SelectItem value="03">03 - Punjab</SelectItem>
                <SelectItem value="04">04 - Chandigarh</SelectItem>
                <SelectItem value="05">05 - Uttarakhand</SelectItem>
                <SelectItem value="06">06 - Haryana</SelectItem>
                <SelectItem value="07">07 - Delhi</SelectItem>
                <SelectItem value="08">08 - Rajasthan</SelectItem>
                <SelectItem value="09">09 - Uttar Pradesh</SelectItem>
                <SelectItem value="10">10 - Bihar</SelectItem>
                <SelectItem value="19">19 - West Bengal</SelectItem>
                <SelectItem value="21">21 - Odisha</SelectItem>
                <SelectItem value="23">23 - Madhya Pradesh</SelectItem>
                <SelectItem value="24">24 - Gujarat</SelectItem>
                <SelectItem value="29">29 - Karnataka</SelectItem>
                <SelectItem value="30">30 - Goa</SelectItem>
                <SelectItem value="32">32 - Kerala</SelectItem>
                <SelectItem value="33">33 - Tamil Nadu</SelectItem>
                <SelectItem value="36">36 - Telangana</SelectItem>
                <SelectItem value="37">37 - Andhra Pradesh</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Invoice Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> {t('Invoice Settings')}</CardTitle>
          <CardDescription>{t('Configure invoice numbering')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><Label>{t('Invoice Prefix')}</Label><Input value={settings.invoice_prefix || ''} onChange={(e) => update('invoice_prefix', e.target.value)} placeholder="e.g., GKS" /></div>
            <div><Label>{t('Next Invoice Number')}</Label><Input type="number" value={settings.invoice_counter || ''} onChange={(e) => update('invoice_counter', e.target.value)} /></div>
          </div>
          <div>
            <Label>{t('Print Theme Layout')}</Label>
            <Select value={settings.invoice_theme || 'professional'} onValueChange={(v) => update('invoice_theme', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="professional">{t('Professional (A4)')}</SelectItem>
                <SelectItem value="thermal">{t('Thermal Receipt (POS 80mm)')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between pt-2 border-t">
            <div>
              <Label>{t('Default GST Price Mode')}</Label>
              <p className="text-xs text-muted-foreground">{t('Are product prices inclusive of GST by default?')}</p>
            </div>
            <Select value={settings.gst_inclusive || '0'} onValueChange={(v) => update('gst_inclusive', v)}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="0">{t('Exclusive of GST')}</SelectItem>
                <SelectItem value="1">{t('Inclusive of GST')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Bank Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> {t('Bank Details')}</CardTitle>
          <CardDescription>{t('Bank information shown on printed invoices for payments')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><Label>{t('Bank Name')}</Label><Input value={settings.bank_name || ''} onChange={(e) => update('bank_name', e.target.value)} placeholder="e.g., State Bank of India" /></div>
            <div><Label>{t('Account Number')}</Label><Input value={settings.bank_account_no || ''} onChange={(e) => update('bank_account_no', e.target.value)} placeholder="e.g., 017002100000884" /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>{t('Branch')}</Label><Input value={settings.bank_branch || ''} onChange={(e) => update('bank_branch', e.target.value)} placeholder="e.g., Main Branch" /></div>
            <div><Label>{t('IFSC Code')}</Label><Input value={settings.bank_ifsc || ''} onChange={(e) => update('bank_ifsc', e.target.value)} placeholder="e.g., SBIN0000123" /></div>
          </div>
          <div>
            <Label>{t('UPI ID')}</Label>
            <Input
              value={settings.upi_id || ''}
              onChange={(e) => update('upi_id', e.target.value)}
              placeholder="e.g., storename@upi or 9876543210@paytm"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {t('If set, a scannable UPI QR code will be printed on every invoice so customers can pay instantly.')}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* CA Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><UserCheck className="h-5 w-5" /> {t('CA (Chartered Accountant) Details')}</CardTitle>
          <CardDescription>{t("CA's WhatsApp number used to send monthly reports")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><Label>{t('CA Name')}</Label><Input value={settings.ca_name || ''} onChange={(e) => update('ca_name', e.target.value)} placeholder="e.g., CA Ramesh Gupta" /></div>
            <div><Label>{t('CA WhatsApp Number')}</Label><Input value={settings.ca_phone || ''} onChange={(e) => update('ca_phone', e.target.value)} placeholder="e.g., 919876543210" /></div>
          </div>
          <p className="text-xs text-muted-foreground">Enter number with country code, no spaces or dashes. E.g., 919876543210 for India.</p>
        </CardContent>
      </Card>

      {/* Dynamic Item Attributes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Tag className="h-5 w-5" /> {t('Product Categories & Units')}</CardTitle>
          <CardDescription>{t('Manage the dropdown options available when adding inventory')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Categories */}
            <div>
              <Label className="mb-2 block border-b pb-2 font-semibold">{t('Categories')}</Label>
              <div className="flex gap-2 mb-3">
                <Input placeholder={t('New Category')} value={newCat} onChange={(e) => setNewCat(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addCategory()} />
                <Button variant="outline" onClick={addCategory}><Plus className="h-4 w-4" /></Button>
              </div>
              <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2">
                {categories.map(c => (
                  <div key={c.id} className="flex justify-between items-center bg-gray-50 border px-3 py-1.5 rounded text-sm">
                    {c.name}
                    <Button size="icon-sm" variant="ghost" onClick={() => deleteCategory(c.id)} className="h-6 w-6"><Trash2 className="h-3 w-3 text-red-500" /></Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Units */}
            <div>
              <Label className="mb-2 block border-b pb-2 font-semibold">{t('Measurement Units')}</Label>
              <div className="flex gap-2 mb-3">
                <Input placeholder={t('New Unit (e.g., kg, feet)')} value={newUnit} onChange={(e) => setNewUnit(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addUnit()} />
                <Button variant="outline" onClick={addUnit}><Plus className="h-4 w-4" /></Button>
              </div>
              <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2">
                {units.map(u => (
                  <div key={u.id} className="flex justify-between items-center bg-gray-50 border px-3 py-1.5 rounded text-sm">
                    {u.name}
                    <Button size="icon-sm" variant="ghost" onClick={() => deleteUnit(u.id)} className="h-6 w-6"><Trash2 className="h-3 w-3 text-red-500" /></Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* WhatsApp Integration */}
      <Card className="border-green-200 bg-green-50/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-700">
            <MessageCircle className="h-5 w-5" /> {t('WhatsApp Integration')}
          </CardTitle>
          <CardDescription>{t('Connect your WhatsApp to send automated invoices and receipts')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col md:flex-row items-stretch gap-6 bg-white p-6 rounded-xl border shadow-sm">
            
            {/* Left Panel: Instructions & Status */}
            <div className="flex-1 space-y-5">
              <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-lg border">
                <span className="font-semibold text-slate-700 min-w-max">{t('Connection Status:')}</span>
                {waStatus === 'connected' && <span className="bg-green-100 text-green-700 px-3 py-1.5 rounded-full text-sm font-bold flex items-center gap-2 w-full"><div className="w-2 h-2 rounded-full bg-green-500"></div> {t('Connected & Ready')}</span>}
                {waStatus === 'disconnected' && <span className="bg-slate-200 text-slate-700 px-3 py-1.5 rounded-full text-sm font-bold flex items-center gap-2 w-full"><div className="w-2 h-2 rounded-full bg-slate-500"></div> {t('Disconnected')}</span>}
                {waStatus === 'initializing' && <span className="bg-blue-100 text-blue-700 px-3 py-1.5 rounded-full text-sm font-bold flex items-center gap-2 w-full"><RefreshCcw className="w-4 h-4 animate-spin" /> {t('Starting Browser Engine...')}</span>}
                {waStatus === 'qr_ready' && <span className="bg-yellow-100 text-yellow-700 px-3 py-1.5 rounded-full text-sm font-bold flex items-center gap-2 w-full"><QrCode className="w-4 h-4" /> {t('Awaiting QR Scan...')}</span>}
                {waStatus === 'authenticating' && <span className="bg-purple-100 text-purple-700 px-3 py-1.5 rounded-full text-sm font-bold flex items-center gap-2 w-full"><RefreshCcw className="w-4 h-4 animate-spin" /> {t('Authenticating...')}</span>}
                {waStatus === 'syncing' && <span className="bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-full text-sm font-bold flex items-center gap-2 w-full"><RefreshCcw className="w-4 h-4 animate-spin" /> {t('Syncing Messages...')}</span>}
                {waStatus === 'error' && <span className="bg-red-100 text-red-700 px-3 py-1.5 rounded-full text-sm font-bold flex items-center gap-2 w-full"><div className="w-2 h-2 rounded-full bg-red-500"></div> {t('Error')}</span>}
              </div>

              {waStatus === 'disconnected' && (
                <div className="space-y-4">
                  <h4 className="font-bold text-slate-800">How to Connect:</h4>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-slate-600 bg-slate-50 p-4 rounded border">
                    <li>Click the <b>Generate QR Code</b> button below.</li>
                    <li>Open <b>WhatsApp</b> on your phone.</li>
                    <li>Tap <b>Menu</b> (⋮) or <b>Settings</b> and select <b>Linked Devices</b>.</li>
                    <li>Tap <b>Link a Device</b>.</li>
                    <li>Point your phone to this screen to capture the code.</li>
                  </ol>
                  <Button onClick={connectWhatsApp} size="lg" className="w-full bg-green-600 hover:bg-green-700 text-white shadow-md transition-transform hover:scale-[1.02]">
                    <QrCode className="mr-2 h-5 w-5" /> {t('Generate QR Code')}
                  </Button>
                </div>
              )}

              {waStatus === 'connected' && (
                <div className="space-y-4">
                  <div className="bg-green-50 p-4 rounded border border-green-200">
                    <p className="text-sm text-green-800"><b>Success!</b> Your WhatsApp is connected securely. Automated invoices, receipts, and low-stock alerts will now be dispatched instantly.</p>
                  </div>
                  <Button variant="outline" onClick={disconnectWhatsApp} className="w-full border-red-200 text-red-600 hover:bg-red-50">
                    <LogOut className="mr-2 h-4 w-4" /> {t('Disconnect Account')}
                  </Button>
                </div>
              )}

              {['initializing', 'qr_ready', 'authenticating', 'syncing', 'error'].includes(waStatus) && (
                <div className="space-y-4">
                  {waStatus === 'syncing' && (
                    <div className="bg-indigo-50 p-4 rounded border border-indigo-200">
                      <p className="text-sm text-indigo-800"><b>Do not close this page.</b> WhatsApp is downloading your message history. This is completely normal and can take up to 3-5 minutes depending on your chat history size.</p>
                    </div>
                  )}
                  {waStatus === 'error' && (
                    <div className="bg-red-50 p-4 rounded border border-red-200">
                      <p className="text-sm text-red-800 mb-2"><b>Connection Failed</b></p>
                      <p className="text-xs text-red-700 font-mono bg-red-100 p-2 rounded">{waError || 'Unknown Error'}</p>
                    </div>
                  )}
                  <div className="pt-2 border-t flex flex-col gap-2">
                    <p className="text-xs text-slate-500">Stuck or frozen?</p>
                    <Button variant="outline" onClick={forceResetWhatsApp} className="w-full border-slate-300 text-slate-700">
                      <RefreshCcw className="mr-2 h-4 w-4" /> {t('Force Restart Session')}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Right Panel: Interactive Visuals */}
            <div className="w-full md:w-72 flex flex-col justify-center items-center rounded-xl bg-slate-50 border p-6 min-h-[250px] relative overflow-hidden shadow-inner">
              {waStatus === 'disconnected' && (
                <div className="text-muted-foreground text-center flex flex-col items-center">
                  <div className="w-20 h-20 bg-slate-200 rounded-full flex items-center justify-center mb-4">
                    <MessageCircle className="w-10 h-10 text-slate-400" />
                  </div>
                  <span className="text-sm font-medium">Ready to Connect</span>
                </div>
              )}
              {waStatus === 'initializing' && (
                <div className="text-center flex flex-col items-center">
                  <RefreshCcw className="w-10 h-10 text-blue-500 animate-spin mb-4" />
                  <span className="text-sm font-medium text-slate-700">Warming up browser...</span>
                  <span className="text-xs text-slate-500 mt-1">(Please wait up to 30s)</span>
                </div>
              )}
              {waStatus === 'qr_ready' && waQr && (
                <div className="text-center animate-in fade-in zoom-in duration-300">
                  <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-200 mb-3">
                    <img src={waQr} alt="WhatsApp QR Code" className="w-48 h-48" />
                  </div>
                  <p className="text-sm font-bold text-slate-700 animate-pulse">Scan with WhatsApp</p>
                </div>
              )}
              {waStatus === 'authenticating' && (
                <div className="text-center flex flex-col items-center animate-in fade-in duration-300">
                  <div className="w-16 h-16 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mb-4"></div>
                  <span className="text-sm font-bold text-purple-700">Authenticating</span>
                  <span className="text-xs text-slate-500 mt-1">Linking device...</span>
                </div>
              )}
              {waStatus === 'syncing' && (
                <div className="text-center flex flex-col items-center animate-in fade-in duration-300">
                  <div className="relative w-20 h-20 mb-4">
                    <div className="absolute inset-0 border-4 border-indigo-100 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-indigo-500 rounded-full border-t-transparent animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <MessageCircle className="w-8 h-8 text-indigo-500 animate-pulse" />
                    </div>
                  </div>
                  <span className="text-sm font-bold text-indigo-700">Syncing Messages</span>
                  <span className="text-xs text-slate-500 mt-1 text-center px-4">Downloading history from your phone...</span>
                </div>
              )}
              {waStatus === 'connected' && (
                <div className="text-center flex flex-col items-center animate-in zoom-in duration-500">
                  <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-4 shadow-sm ring-4 ring-green-50">
                    <MessageCircle className="w-12 h-12 text-green-600" />
                  </div>
                  <span className="text-lg font-bold text-green-700">Online</span>
                  <span className="text-xs text-green-600 mt-1">Ready to send messages</span>
                </div>
              )}
              {waStatus === 'error' && (
                <div className="text-center flex flex-col items-center">
                  <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                    <span className="text-red-500 font-bold text-2xl">!</span>
                  </div>
                  <span className="text-sm font-bold text-red-700">Connection Error</span>
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-green-200 mt-4">
            <h4 className="font-semibold text-green-800 mb-3 text-sm">{t('Automated Channel Invites')}</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>{t("Men's Channel Invite Link")}</Label>
                <Input value={settings.wa_channel_men || ''} onChange={(e) => update('wa_channel_men', e.target.value)} placeholder="https://chat.whatsapp.com/..." />
                <p className="text-xs text-muted-foreground mt-1">{t('Sent to Male customers')}</p>
              </div>
              <div>
                <Label>{t("Women's Channel Invite Link")}</Label>
                <Input value={settings.wa_channel_women || ''} onChange={(e) => update('wa_channel_women', e.target.value)} placeholder="https://chat.whatsapp.com/..." />
                <p className="text-xs text-muted-foreground mt-1">{t('Sent to Female customers')}</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>{t('WhatsApp Receipt Message Template (English)')}</Label>
                <Textarea 
                  value={settings.wa_message_template_en || ''} 
                  onChange={(e) => update('wa_message_template_en', e.target.value)} 
                  placeholder={t('Message template...')}
                  className="mt-1 min-h-[120px]"
                />
              </div>
              <div>
                <Label>{t('WhatsApp Receipt Message Template (Marathi)')}</Label>
                <Textarea 
                  value={settings.wa_message_template_mr || ''} 
                  onChange={(e) => update('wa_message_template_mr', e.target.value)} 
                  placeholder={t('Message template...')}
                  className="mt-1 min-h-[120px]"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              You can use these placeholders in your message: 
              <code className="bg-gray-100 px-1 mx-1 rounded">{'{{customer_name}}'}</code>, 
              <code className="bg-gray-100 px-1 mx-1 rounded">{'{{invoice_number}}'}</code>, 
              <code className="bg-gray-100 px-1 mx-1 rounded">{'{{total_amount}}'}</code>, 
              <code className="bg-gray-100 px-1 mx-1 rounded">{'{{store_name}}'}</code>, 
              <code className="bg-gray-100 px-1 mx-1 rounded">{'{{date}}'}</code>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Gmail SMTP Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5" /> {t('Gmail Alert Settings')}</CardTitle>
          <CardDescription>{t('Configure Gmail SMTP for low-stock email alerts. Use an App Password (not your regular Gmail password).')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div><Label>{t('Gmail Address')}</Label><Input type="email" value={settings.gmail_user || ''} onChange={(e) => update('gmail_user', e.target.value)} placeholder="your.email@gmail.com" /></div>
          <div><Label>{t('App Password')}</Label><Input type="password" value={settings.gmail_app_password || ''} onChange={(e) => update('gmail_app_password', e.target.value)} placeholder="16-char app password" /></div>
          <div><Label>{t('Send Alerts To (optional)')}</Label><Input type="email" value={settings.low_stock_email || ''} onChange={(e) => update('low_stock_email', e.target.value)} placeholder="Defaults to Gmail address above" /></div>
          <p className="text-xs text-muted-foreground">
            To create an App Password: Google Account &rarr; Security &rarr; 2-Step Verification &rarr; App Passwords
          </p>
          <div className="pt-2 border-t">
            <Button variant="outline" size="sm" onClick={handleTestEmail} disabled={testingEmail}>
               <Mail className="mr-2 h-4 w-4" />
               {testingEmail ? 'Sending Test...' : t('Send Test Email')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Data Management (Backup/Restore) */}
      <Card className="border-blue-200 bg-blue-50/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-700">
            <Database className="h-5 w-5" /> {t('Data Management')}
          </CardTitle>
          <CardDescription>{t('Secure your business data by downloading backups regularly')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 space-y-2">
              <h4 className="font-semibold text-sm">{t('Download Backup')}</h4>
              <p className="text-xs text-muted-foreground">Download a full copy of your database (`.sqlite`) which you can save on a USB drive or Cloud storage.</p>
              <Button onClick={handleBackup} variant="outline" className="w-full md:w-auto">
                <Download className="mr-2 h-4 w-4" /> {t('Download .sqlite Backup')}
              </Button>
            </div>
            <div className="flex-1 space-y-2 border-t md:border-t-0 md:border-l pt-4 md:pt-0 md:pl-4">
              <h4 className="font-semibold text-sm text-red-600">{t('Restore Database')}</h4>
              <p className="text-xs text-muted-foreground font-medium italic">Warning: This will delete your current data and replace it with the backup file.</p>
              <div className="mt-2">
                <Button variant="destructive" className="relative cursor-pointer w-full md:w-auto">
                  <Upload className="mr-2 h-4 w-4" /> {t('Upload & Restore')}
                  <input
                    type="file"
                    accept=".sqlite"
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    onChange={handleRestore}
                  />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving} size="lg">
        <Settings className="mr-2 h-4 w-4" />
        {saving ? t('Loading...') : t('Save All Settings')}
      </Button>
    </div>
  );
}
