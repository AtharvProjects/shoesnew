'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertCircle, Search, Mail, Package } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/components/LanguageProvider';

interface Product {
    id: number;
    name: string;
    sku: string;
    category: string;
    quantity: number;
    unit: string;
    selling_price: number;
    low_stock_alert: number;
}

export default function LowStockPage() {
    const [products, setProducts] = useState<Product[]>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [sendingEmail, setSendingEmail] = useState(false);
    const { t } = useLanguage();

    const fetchLowStock = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/low-stock-alert');
            if (res.ok) {
                setProducts(await res.json());
            } else {
                toast.error(t('Failed to fetch low stock items') || 'Failed to fetch low stock items');
            }
        } catch {
            toast.error(t('Error connecting to server') || 'Error connecting to server');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLowStock();
    }, []);

    const handleSendEmail = async () => {
        if (!confirm(t('Are you sure you want to send a low stock alert email?') || 'Are you sure you want to send a low stock alert email?')) return;
        setSendingEmail(true);
        try {
            const res = await fetch('/api/low-stock-alert', { method: 'POST' });
            const data = await res.json();
            if (res.ok) {
                toast.success(data.message || t('Email sent successfully!'));
            } else {
                toast.error(data.error || t('Failed to send alert'));
            }
        } catch {
            toast.error(t('Failed to connect to email system') || 'Failed to connect to email system');
        } finally {
            setSendingEmail(false);
        }
    };

    const filtered = products.filter(
        (p) =>
            p.name.toLowerCase().includes(search.toLowerCase()) ||
            (p.sku && p.sku.toLowerCase().includes(search.toLowerCase())) ||
            (p.category && p.category.toLowerCase().includes(search.toLowerCase()))
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">{t('Low Stock Alerts')}</h1>
                    <p className="text-muted-foreground">{t('Manage inventory that needs restocking soon')}</p>
                </div>
                <div className="flex gap-2">
                    <Button onClick={handleSendEmail} disabled={sendingEmail || products.length === 0}>
                        <Mail className="mr-2 h-4 w-4" />
                        {sendingEmail ? t('Sending...') : t('Send Alert Email')}
                    </Button>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <Card className="md:col-span-1 border-destructive">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">{t('Critical Items')}</CardTitle>
                        <AlertCircle className="h-4 w-4 text-destructive" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-destructive">{products.length}</div>
                        <p className="text-xs text-muted-foreground pt-1">{t('Products below alert threshold')}</p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardContent className="pt-6">
                    <div className="flex gap-4 mb-6">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder={t('Search low stock products by name, SKU, or category...')}
                                className="pl-10"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="rounded-md border">
                        {loading ? (
                            <div className="py-8 text-center text-muted-foreground">{t('Loading low stock data...')}</div>
                        ) : filtered.length === 0 ? (
                            <div className="py-12 text-center text-muted-foreground flex flex-col items-center">
                                <Package className="h-8 w-8 text-muted-foreground/50 mb-3" />
                                <p>{products.length === 0 ? t('All stock levels look great!') : t('No products match your search.')}</p>
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>{t('Product details')}</TableHead>
                                        <TableHead>{t('Category')}</TableHead>
                                        <TableHead className="text-right">{t('Price')}</TableHead>
                                        <TableHead className="text-right text-destructive">{t('Current Qty')}</TableHead>
                                        <TableHead className="text-right">{t('Alert Level')}</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filtered.map((p) => {
                                        const isZero = p.quantity <= 0;
                                        return (
                                            <TableRow key={p.id}>
                                                <TableCell>
                                                    <div className="font-medium">{p.name}</div>
                                                    {p.sku && <div className="text-xs text-muted-foreground">SKU: {p.sku}</div>}
                                                </TableCell>
                                                <TableCell className="text-muted-foreground">{p.category || '-'}</TableCell>
                                                <TableCell className="text-right font-medium">₹{p.selling_price}</TableCell>
                                                <TableCell className={`text-right font-bold ${isZero ? 'text-destructive' : 'text-orange-500'}`}>
                                                    {p.quantity} {p.unit}
                                                </TableCell>
                                                <TableCell className="text-right text-muted-foreground">{p.low_stock_alert} {p.unit}</TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
