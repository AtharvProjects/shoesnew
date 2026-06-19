'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/components/LanguageProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { ArrowLeft, PlusCircle, MinusCircle, User, Phone, MapPin, Receipt, ArrowUpRight, ArrowDownLeft, Wallet, Pencil, Trash2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface Dealer {
  id: number;
  name: string;
  phone: string;
  address: string;
  gstin: string;
  balance: number;
}

interface Transaction {
  id: number;
  type: string;
  amount: number;
  balance_after: number;
  date: string;
  reference: string;
  notes: string;
}

export default function KhatabookPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const dealerId = resolvedParams.id;
  const router = useRouter();
  const { t } = useLanguage();

  const [dealer, setDealer] = useState<Dealer | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Transaction Dialog state
  const [openTx, setOpenTx] = useState(false);
  const [txType, setTxType] = useState<'purchase' | 'payment_given' | 'purchase_return'>('purchase');
  const [submitting, setSubmitting] = useState(false);

  const [editingTx, setEditingTx] = useState<any | null>(null);
  const [deletingTxId, setDeletingTxId] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    amount: '',
    date: new Date().toISOString().split('T')[0],
    reference: '',
    notes: ''
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [dealerRes, txRes] = await Promise.all([
        fetch(`/api/dealers/${dealerId}`),
        fetch(`/api/dealers/${dealerId}/transactions`)
      ]);
      
      if (dealerRes.ok && txRes.ok) {
        setDealer(await dealerRes.json());
        setTransactions(await txRes.json());
      } else {
        toast.error(t('Dealer not found'));
        router.push('/dealers');
      }
    } catch (error) {
      toast.error('Failed to load khatabook');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [dealerId]);

  
  const openEditTx = (tx: any) => {
    setTxType(tx.type);
    setEditingTx(tx);
    setFormData({
      amount: tx.amount.toString(),
      date: tx.date.split('T')[0],
      reference: tx.reference || '',
      notes: tx.notes || ''
    });
    setOpenTx(true);
  };

  const handleDeleteTx = async () => {
    if (!deletingTxId) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/dealers/${dealerId}/transactions/${deletingTxId}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success(t('Transaction deleted') || 'Transaction deleted');
        setDeletingTxId(null);
        fetchData();
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to delete');
      }
    } catch (error) {
      toast.error('Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount || Number(formData.amount) <= 0) return toast.error('Enter a valid amount');

    setSubmitting(true);
    try {
      const url = editingTx 
        ? `/api/dealers/${dealerId}/transactions/${editingTx.id}`
        : `/api/dealers/${dealerId}/transactions`;
      
      const res = await fetch(url, {
        method: editingTx ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: txType,
          amount: Number(formData.amount),
          date: new Date(formData.date).toISOString(),
          reference: formData.reference,
          notes: formData.notes
        }),
      });

      if (res.ok) {
        toast.success(editingTx ? 'Transaction updated successfully' : 'Transaction added successfully');
        setOpenTx(false);
        setFormData({ amount: '', date: new Date().toISOString().split('T')[0], reference: '', notes: '' });
        fetchData(); // Refresh data
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to add transaction');
      }
    } catch (error) {
      toast.error('An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  const openTransactionDialog = (type: 'purchase' | 'payment_given' | 'purchase_return') => {
    setTxType(type);
    setEditingTx(null);
    setFormData({ amount: '', date: new Date().toISOString().split('T')[0], reference: '', notes: '' });
    setOpenTx(true);
  };

  if (loading) return <div className="p-8 text-center">{t('Loading Khatabook...')}</div>;
  if (!dealer) return <div className="p-8 text-center text-red-500">{t('Dealer not found')}</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header Area */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => router.push('/dealers')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{dealer.name}'s Ledger</h1>
          <p className="text-muted-foreground mt-1 flex items-center gap-4">
            {dealer.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {dealer.phone}</span>}
            {dealer.address && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {dealer.address}</span>}
            {dealer.gstin && <span className="flex items-center gap-1"><Receipt className="h-3 w-3" /> GST: {dealer.gstin}</span>}
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid md:grid-cols-3 gap-6">
        <Card className="md:col-span-2 border-none shadow-md bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950">
          <CardContent className="p-6 flex flex-col justify-center h-full">
            <h2 className="text-sm font-semibold text-blue-800 dark:text-blue-200 uppercase tracking-wider mb-2">{t('Net Balance')}</h2>
            {dealer.balance > 0 ? (
              <div>
                <div className="text-4xl font-bold text-red-600 mb-1">₹{dealer.balance.toFixed(2)}</div>
                <div className="text-sm font-medium text-red-800 bg-red-100 dark:bg-red-900/30 dark:text-red-300 inline-flex items-center px-2 py-0.5 rounded">
                  <ArrowUpRight className="h-4 w-4 mr-1" /> You have to Pay (Dena)
                </div>
              </div>
            ) : dealer.balance < 0 ? (
              <div>
                <div className="text-4xl font-bold text-green-600 mb-1">₹{Math.abs(dealer.balance).toFixed(2)}</div>
                <div className="text-sm font-medium text-green-800 bg-green-100 dark:bg-green-900/30 dark:text-green-300 inline-flex items-center px-2 py-0.5 rounded">
                  <ArrowDownLeft className="h-4 w-4 mr-1" /> You will Receive (Lena)
                </div>
              </div>
            ) : (
              <div>
                <div className="text-4xl font-bold text-gray-700 mb-1">₹0.00</div>
                <div className="text-sm font-medium text-gray-600">{t('Settled')}</div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <Card className="border-none shadow-none bg-transparent">
          <CardContent className="p-0 flex flex-col gap-3 h-full justify-center">
            <Button size="lg" className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold text-lg py-6 shadow-md" onClick={() => openTransactionDialog('purchase')}>
              <PlusCircle className="mr-2 h-5 w-5" /> Add Bill (Purchase)
            </Button>
            <Button size="lg" className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold text-lg py-6 shadow-md" onClick={() => openTransactionDialog('payment_given')}>
              <MinusCircle className="mr-2 h-5 w-5" /> Give Payment
            </Button>
            <Button variant="outline" className="w-full text-gray-600 border-gray-300 hover:bg-gray-100" onClick={() => openTransactionDialog('purchase_return')}>
              Purchase Return
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Transactions Table */}
      <Card className="shadow-sm">
        <CardHeader className="border-b bg-gray-50/50 py-4">
          <CardTitle className="text-lg">{t('Ledger Statement')}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6 w-[15%]">{t('Date')}</TableHead>
                <TableHead className="w-[35%]">{t('Details')}</TableHead>
                <TableHead className="text-right w-[15%]">{t('You Got (Bill)')}</TableHead>
                <TableHead className="text-right w-[15%]">{t('You Gave (Pay)')}</TableHead>
                <TableHead className="text-right pr-6 w-[15%]">{t('Running Balance')}</TableHead>
                <TableHead className="w-[5%]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                    No transactions yet. Add a bill or payment to start the ledger.
                  </TableCell>
                </TableRow>
              ) : (
                transactions.map((tx) => (
                  <TableRow key={tx.id} className="hover:bg-gray-50 group">
                    <TableCell className="pl-6 whitespace-nowrap text-muted-foreground">
                      {format(new Date(tx.date.includes('T') ? tx.date : tx.date.replace(' ', 'T') + 'Z'), 'dd MMM yyyy')}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">
                        {tx.type === 'purchase' && t('Purchase Bill')}
                        {tx.type === 'payment_given' && t('Give Payment')}
                        {tx.type === 'purchase_return' && t('Purchase Return')}
                        {tx.type === 'opening_balance' && t('Opening Balance')}
                      </div>
                      {(tx.reference || tx.notes) && (
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {tx.reference && <span className="mr-2">Ref: {tx.reference}</span>}
                          {tx.notes && <span>{tx.notes}</span>}
                        </div>
                      )}
                    </TableCell>
                    
                    {/* You Got (Bill Amount - increases payable) */}
                    <TableCell className="text-right font-medium text-red-600 bg-red-50/30">
                      {(tx.type === 'purchase' || tx.type === 'opening_balance') ? `₹${tx.amount.toFixed(2)}` : '-'}
                    </TableCell>
                    
                    {/* You Gave (Payment Amount - decreases payable) */}
                    <TableCell className="text-right font-medium text-green-600 bg-green-50/30">
                      {(tx.type === 'payment_given' || tx.type === 'purchase_return') ? `₹${tx.amount.toFixed(2)}` : '-'}
                    </TableCell>
                    
                                        {/* Running Balance */}
                    <TableCell className="text-right pr-6 font-semibold bg-gray-50/50">
                      {tx.balance_after > 0 
                        ? <span className="text-red-600">₹{tx.balance_after.toFixed(2)} <span className="text-[10px] font-normal uppercase text-red-500/70 ml-1">{t('Payable')}</span></span>
                        : tx.balance_after < 0 
                        ? <span className="text-green-600">₹{Math.abs(tx.balance_after).toFixed(2)} <span className="text-[10px] font-normal uppercase text-green-500/70 ml-1">{t('Receivable')}</span></span>
                        : <span className="text-gray-500">₹0.00</span>
                      }
                    </TableCell>
                    
                    <TableCell className="p-0 w-[5%] pr-2">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-blue-600" onClick={() => openEditTx(tx)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => setDeletingTxId(tx.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Transaction Dialog */}
      <Dialog open={openTx} onOpenChange={setOpenTx}>
        <DialogContent>
          <form onSubmit={handleTransaction}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {txType === 'purchase' && <><PlusCircle className="text-red-500" /> {editingTx ? t('Edit Bill (Purchase)') || 'Edit Bill (Purchase)' : t('Add Bill (Purchase)')}</>}
                {txType === 'payment_given' && <><Wallet className="text-green-500" /> {editingTx ? t('Edit Payment') || 'Edit Payment' : t('Give Payment')}</>}
                {txType === 'purchase_return' && <><MinusCircle className="text-blue-500" /> {editingTx ? t('Edit Purchase Return') || 'Edit Purchase Return' : t('Purchase Return')}</>}
              </DialogTitle>
              <DialogDescription>
                {txType === 'purchase' && t('This will increase the amount you owe to this dealer.')}
                {txType === 'payment_given' && t('This will decrease the amount you owe to this dealer.')}
                {txType === 'purchase_return' && t('You returned stock. This decreases the amount you owe.')}
              </DialogDescription>
            </DialogHeader>
            
            <div className="grid gap-4 py-6">
              <div className="grid gap-2">
                <Label htmlFor="amount">{t('Amount (₹) *')}</Label>
                <Input 
                  id="amount" 
                  type="number" 
                  step="0.01" 
                  autoFocus
                  required
                  className="text-2xl h-14 font-semibold"
                  placeholder="0.00"
                  value={formData.amount} 
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })} 
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="date">{t('Date')}</Label>
                  <Input 
                    id="date" 
                    type="date" 
                    required
                    value={formData.date} 
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })} 
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="reference">{t('Reference / Bill No')}</Label>
                  <Input 
                    id="reference" 
                    placeholder={txType === 'purchase' ? "e.g. Bill #1234" : "e.g. UTR / Cheque No"}
                    value={formData.reference} 
                    onChange={(e) => setFormData({ ...formData, reference: e.target.value })} 
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="notes">{t('Notes (Optional)')}</Label>
                <Input 
                  id="notes" 
                  placeholder="Any additional details..."
                  value={formData.notes} 
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })} 
                />
              </div>
            </div>
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpenTx(false)}>{t('Cancel')}</Button>
              <Button 
                type="submit" 
                disabled={submitting}
                className={txType === 'purchase' ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"}
              >
                {submitting ? t('Saving...') : t('Save Entry')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Tx Dialog */}
      <Dialog open={!!deletingTxId} onOpenChange={(open) => !open && setDeletingTxId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <AlertCircle className="h-5 w-5" /> {t('Delete Transaction') || 'Delete Transaction'}
            </DialogTitle>
            <div className="py-4 text-gray-700">
              {t('Are you sure you want to delete this transaction?') || 'Are you sure you want to delete this transaction?'} 
              <br/><br/>
              <span className="text-red-600 text-sm font-medium">
                {t('This will alter the running balance for all subsequent transactions.') || 'This will alter the running balance for all subsequent transactions.'}
              </span>
            </div>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingTxId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteTx} disabled={submitting}>
              {submitting ? (t('Deleting...') || 'Deleting...') : (t('Delete') || 'Delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
