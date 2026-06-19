'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/components/LanguageProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Search, Plus, UserPlus, BookOpen, Pencil, Trash2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface Dealer {
  id: number;
  name: string;
  phone: string;
  address: string;
  gstin: string;
  balance: number;
  created_at: string;
}

export default function DealersPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [openAdd, setOpenAdd] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [editingDealer, setEditingDealer] = useState<Dealer | null>(null);
  const [openEdit, setOpenEdit] = useState(false);
  const [deletingDealer, setDeletingDealer] = useState<Dealer | null>(null);


  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    gstin: '',
    opening_balance: 0,
  });

  const fetchDealers = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/dealers');
      if (res.ok) {
        setDealers(await res.json());
      }
    } catch (error) {
      toast.error('Failed to load dealers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDealers();
  }, []);

  
  const openEditModal = (dealer: Dealer) => {
    setEditingDealer(dealer);
    setFormData({
      name: dealer.name,
      phone: dealer.phone || '',
      gstin: dealer.gstin || '',
      address: dealer.address || '',
      opening_balance: 0 // Cannot edit opening balance from here
    });
    setOpenEdit(true);
  };

  const handleEditDealer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDealer) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/dealers/${editingDealer.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        toast.success(t('Dealer updated successfully') || 'Dealer updated successfully');
        setOpenEdit(false);
        fetchDealers();
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to update dealer');
      }
    } catch (error) {
      toast.error('Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteDealer = async () => {
    if (!deletingDealer) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/dealers/${deletingDealer.id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success(t('Dealer deleted successfully') || 'Dealer deleted successfully');
        setDeletingDealer(null);
        fetchDealers();
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to delete dealer');
      }
    } catch (error) {
      toast.error('Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredDealers = dealers.filter(d => 
    d.name.toLowerCase().includes(search.toLowerCase()) || 
    (d.phone && d.phone.includes(search))
  );

  const handleAddDealer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return toast.error('Name is required');

    setSubmitting(true);
    try {
      const res = await fetch('/api/dealers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        toast.success('Dealer added successfully');
        setOpenAdd(false);
        setFormData({ name: '', phone: '', address: '', gstin: '', opening_balance: 0 });
        fetchDealers();
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to add dealer');
      }
    } catch (error) {
      toast.error('An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('Dealers & Distributors')}</h1>
          <p className="text-muted-foreground mt-1">{t('Manage khatabook ledgers for your suppliers')}</p>
        </div>
        <Button onClick={() => setOpenAdd(true)} className="gap-2 bg-blue-600 hover:bg-blue-700">
          <UserPlus className="h-4 w-4" /> Add Dealer
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3 border-b">
          <div className="flex justify-between items-center">
            <CardTitle>{t('All Dealers')}</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search dealers..."
                className="pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-gray-50/50">
              <TableRow>
                <TableHead className="pl-6">{t('Dealer Name')}</TableHead>
                <TableHead>{t('Contact')}</TableHead>
                <TableHead className="text-right">{t('Lena / Dena Balance')}</TableHead>
                <TableHead className="text-right pr-6">{t('Action')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    Loading dealers...
                  </TableCell>
                </TableRow>
              ) : filteredDealers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    No dealers found. Add one to get started!
                  </TableCell>
                </TableRow>
              ) : (
                filteredDealers.map((dealer) => (
                  <TableRow key={dealer.id} className="cursor-pointer hover:bg-gray-50" onClick={() => router.push(`/dealers/${dealer.id}`)}>
                    <TableCell className="pl-6 font-medium">
                      {dealer.name}
                      {dealer.gstin && <div className="text-xs text-muted-foreground mt-0.5">GST: {dealer.gstin}</div>}
                    </TableCell>
                    <TableCell>
                      {dealer.phone || '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      {dealer.balance > 0 ? (
                        <div className="text-red-600 font-semibold text-lg flex items-center justify-end gap-1">
                          ₹{dealer.balance.toFixed(2)} <span className="text-xs font-normal">{t('Payable')}</span>
                        </div>
                      ) : dealer.balance < 0 ? (
                        <div className="text-green-600 font-semibold text-lg flex items-center justify-end gap-1">
                          ₹{Math.abs(dealer.balance).toFixed(2)} <span className="text-xs font-normal">{t('Receivable')}</span>
                        </div>
                      ) : (
                        <div className="text-gray-500 font-medium text-lg">
                          ₹0.00 <span className="text-xs font-normal">{t('Settled')}</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-800 hover:bg-blue-50" onClick={() => router.push(`/dealers/${dealer.id}`)}>
                          <BookOpen className="h-4 w-4 mr-2" /> {t('Open Khatabook')}
                        </Button>
                        <Button variant="ghost" size="icon" className="text-gray-500 hover:text-gray-900" onClick={(e) => { e.stopPropagation(); openEditModal(dealer); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={(e) => { e.stopPropagation(); setDeletingDealer(dealer); }}>
                          <Trash2 className="h-4 w-4" />
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

      {/* Add Dealer Dialog */}
      <Dialog open={openAdd} onOpenChange={setOpenAdd}>
        <DialogContent>
          <form onSubmit={handleAddDealer}>
            <DialogHeader>
              <DialogTitle>{t('Add New Dealer / Distributor')}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">{t('Dealer Name *')}</Label>
                <Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phone">{t('Phone Number')}</Label>
                <Input id="phone" type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="gstin">{t('GSTIN (Optional)')}</Label>
                <Input id="gstin" value={formData.gstin} onChange={(e) => setFormData({ ...formData, gstin: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="address">{t('Address / City')}</Label>
                <Input id="address" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="opening_balance">{t('Opening Balance (₹)')}</Label>
                <Input 
                  id="opening_balance" 
                  type="number" 
                  step="0.01" 
                  value={formData.opening_balance} 
                  onChange={(e) => setFormData({ ...formData, opening_balance: parseFloat(e.target.value) || 0 })} 
                />
                <p className="text-xs text-muted-foreground">{t('Positive amount means you owe them (Payable).')}</p>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpenAdd(false)}>Cancel</Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? t('Adding...') : t('Add Dealer')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    
      {/* Edit Dealer Dialog */}
      <Dialog open={openEdit} onOpenChange={setOpenEdit}>
        <DialogContent>
          <form onSubmit={handleEditDealer}>
            <DialogHeader>
              <DialogTitle>{t('Edit Dealer') || 'Edit Dealer'}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit_name">{t('Dealer Name *')}</Label>
                <Input id="edit_name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit_phone">{t('Phone Number')}</Label>
                <Input id="edit_phone" type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit_gstin">{t('GSTIN (Optional)')}</Label>
                <Input id="edit_gstin" value={formData.gstin} onChange={(e) => setFormData({ ...formData, gstin: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit_address">{t('Address / City')}</Label>
                <Input id="edit_address" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpenEdit(false)}>Cancel</Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? (t('Saving...') || 'Saving...') : (t('Save Changes') || 'Save Changes')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Dealer Dialog */}
      <Dialog open={!!deletingDealer} onOpenChange={(open) => !open && setDeletingDealer(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <AlertCircle className="h-5 w-5" /> {t('Delete Dealer') || 'Delete Dealer'}
            </DialogTitle>
            <div className="py-4 text-gray-700">
              {t('Are you sure you want to delete this dealer?') || 'Are you sure you want to delete this dealer?'} 
              <br/><br/>
              <strong>{deletingDealer?.name}</strong>
              <br/><br/>
              <span className="text-red-600 text-sm font-medium">
                {t('This will also delete all their ledger transactions permanently. This action cannot be undone.') || 'This will also delete all their ledger transactions permanently. This action cannot be undone.'}
              </span>
            </div>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingDealer(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteDealer} disabled={submitting}>
              {submitting ? (t('Deleting...') || 'Deleting...') : (t('Delete') || 'Delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
