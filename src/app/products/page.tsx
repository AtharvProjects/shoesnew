/**
 * Products / Inventory Management Page
 * MyBillBook-style table with search, category filter, add/edit/delete modals.
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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Pencil, Trash2, Package, Upload, Download, Camera, Wand2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { useLanguage } from '@/components/LanguageProvider';
import { isPositive, isNonNegative, isValidHSN } from '@/lib/validations';

interface Product {
  id: number;
  name: string;
  sku: string;
  brand: string;
  article_no: string;
  size: string;
  color: string;
  category: string;
  hsn_code: string;
  purchase_price: number;
  selling_price: number;
  quantity: number;
  unit: string;
  low_stock_alert: number;
  gst_rate: number;
  description: string;
}

interface Category {
  id: number;
  name: string;
}

const emptyProduct = {
  name: '', sku: '', brand: '', article_no: '', size: '', color: '', category: '', hsn_code: '',
  purchase_price: 0, selling_price: 0, quantity: 0,
  unit: 'pair', low_stock_alert: 10, gst_rate: 0, description: '',
};

export default function ProductsPage() {
  const { t } = useLanguage();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<{ id: number, name: string }[]>([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [form, setForm] = useState(emptyProduct);

  const [extractOpen, setExtractOpen] = useState(false);
  const [extractedProducts, setExtractedProducts] = useState<Product[]>([]);

  /* Fetch products */
  const fetchProducts = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (categoryFilter) params.set('category', categoryFilter);
      const res = await fetch(`/api/products?${params}`);
      const data = await res.json();
      setProducts(data);
    } catch { toast.error(t('Failed to load products')); }
    finally { setLoading(false); }
  }, [search, categoryFilter]);

  /* Fetch categories and units */
  const fetchAttributes = async () => {
    const [catRes, unitRes] = await Promise.all([
      fetch('/api/categories'),
      fetch('/api/units')
    ]);
    setCategories(await catRes.json());
    setUnits(await unitRes.json());
  };

  useEffect(() => { fetchProducts(); }, [fetchProducts]);
  useEffect(() => { fetchAttributes(); }, []);

  /* Open dialog for add / edit */
  const openAdd = () => {
    setEditingProduct(null);
    setForm(emptyProduct);
    setDialogOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditingProduct(p);
    setForm({
      name: p.name, sku: p.sku, brand: p.brand || '', article_no: p.article_no || '', size: p.size || '', color: p.color || '', category: p.category, hsn_code: p.hsn_code,
      purchase_price: p.purchase_price, selling_price: p.selling_price,
      quantity: p.quantity, unit: p.unit, low_stock_alert: p.low_stock_alert,
      gst_rate: p.gst_rate, description: p.description,
    });
    setDialogOpen(true);
  };

  /* Save */
  const [saving, setSaving] = useState(false);
  const handleSave = async () => {
    if (saving) return;
    if (!form.name) {
      toast.error(t('Product name is required') || 'Product name is required');
      return;
    }
    if (!isPositive(form.selling_price)) {
      toast.error(t('Selling price must be greater than zero') || 'Selling price must be greater than zero');
      return;
    }
    if (!isNonNegative(form.purchase_price)) {
      toast.error(t('Purchase price cannot be negative') || 'Purchase price cannot be negative');
      return;
    }
    if (!isNonNegative(form.quantity)) {
      toast.error(t('Quantity cannot be negative') || 'Quantity cannot be negative');
      return;
    }
    if (form.hsn_code && !isValidHSN(form.hsn_code)) {
      toast.error(t('Invalid HSN code (4–8 digits)') || 'Invalid HSN code (4–8 digits)');
      return;
    }
    if (form.gst_rate < 0 || form.gst_rate > 100) {
      toast.error(t('GST rate must be between 0 and 100') || 'GST rate must be between 0 and 100');
      return;
    }

    // SKU must be unique (check against current products, excluding the one we're editing)
    if (form.sku) {
      const duplicate = products.find(p => p.sku === form.sku && p.id !== editingProduct?.id);
      if (duplicate) {
        toast.error(t('A product with this SKU already exists') || 'A product with this SKU already exists');
        return;
      }
    }

    setSaving(true);
    try {
      const url = editingProduct ? `/api/products/${editingProduct.id}` : '/api/products';
      const method = editingProduct ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save product');
      
      toast.success(editingProduct ? t('Product updated successfully') : t('Product added successfully'));
      setDialogOpen(false);
      fetchProducts();
    } catch (error: any) { 
      toast.error(error.message || t('Failed to save product')); 
    } finally {
      setSaving(false);
    }
  };

  /* Delete */
  /* Delete Confirmation State */
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  const promptDelete = (p: Product) => {
    setProductToDelete(p);
    setDeleteConfirmText('');
    setDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (!productToDelete) return;
    setDeleting(true);
    try {
      await fetch(`/api/products/${productToDelete.id}`, { method: 'DELETE' });
      toast.success(t('Product deleted successfully'));
      setDeleteOpen(false);
      fetchProducts();
    } catch {
      toast.error(t('Failed to delete product') || 'Failed to delete product');
    } finally {
      setDeleting(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const toastId = toast.loading('Reading Excel file...');
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(worksheet);

      if (!json || json.length === 0) {
        toast.error('Excel file is empty or invalid format.', { id: toastId });
        return;
      }

      toast.loading('Importing products into database...', { id: toastId });
      const res = await fetch('/api/products/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(json)
      });
      const result = await res.json();

      if (!res.ok) throw new Error(result.error || 'Import Failed');

      toast.success(`Successfully imported ${result.count} products!`, { id: toastId });
      fetchProducts();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Failed to import products from Excel', { id: toastId });
    }
    // Reset file input
    e.target.value = '';
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const toastId = toast.loading('Extracting invoice with Local OCR... (this may take a few seconds)');
    try {
      // Dynamically import Tesseract to avoid Next.js SSR issues
      const Tesseract = (await import('tesseract.js')).default;
      const { data: { text } } = await Tesseract.recognize(file, 'eng');
      
      const lines = text.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 0);
      const products: any[] = [];
      
      for (const line of lines) {
        const lowerLine = line.toLowerCase();
        // Skip header/footer lines
        if (lowerLine.includes('total') || lowerLine.includes('tax') || lowerLine.includes('invoice') || lowerLine.includes('date') || lowerLine.includes('hsn') || lowerLine.includes('gst') || lowerLine.includes('m.r.p')) {
          continue;
        }

        // Try to find prices if possible
        const decimalMatch = line.match(/\b\d+[\.,]\d{2}\b/g);
        let maxPrice = 0;
        let minPrice = 0;
        
        if (decimalMatch && decimalMatch.length >= 1) {
          const prices = decimalMatch.map(s => Number(s.replace(',', '.'))).filter(n => !isNaN(n) && n > 0);
          if (prices.length > 0) {
            maxPrice = Math.max(...prices);
            minPrice = Math.min(...prices);
          }
        }

        // Try to find quantity
        const intMatch = line.match(/\b\d{1,4}\b/g);
        let quantity = 1;
        if (intMatch) {
          const ints = intMatch.map(Number).filter(n => n > 0 && n <= 500);
          if (ints.length > 0) {
             quantity = ints[0];
          }
        }

        // Clean up name by removing numbers that look like prices or IDs
        let name = line.replace(/\b\d+[\.,]\d{2}\b/g, '')
                       .replace(/\b\d{5,}\b/g, '')
                       .replace(/[^\w\s-]/g, ' ')
                       .replace(/\s+/g, ' ')
                       .trim();

        // If Tesseract completely failed to separate things, just use the raw line as the name
        if (name.length < 3) {
           name = line.replace(/[^\w\s-\.,]/g, ' ').replace(/\s+/g, ' ').trim();
        }

        if (name.length >= 5) {
           products.push({
             ...emptyProduct,
             name: name.substring(0, 100),
             purchase_price: minPrice,
             selling_price: maxPrice,
             quantity: quantity,
             category: 'Uncategorized',
             unit: 'pcs'
           });
        }
      }

      // If even that failed, show a better fallback
      if (products.length === 0) {
         products.push({
            ...emptyProduct,
            name: 'No readable text found',
            purchase_price: 0,
            selling_price: 0,
            quantity: 1,
         });
      }

      const productsWithIds = products.map((p: any, i: number) => ({
        ...p,
        id: -1 * (i + 1), // temp id for tracking
      }));

      setExtractedProducts(productsWithIds);
      setExtractOpen(true);
      toast.success('Extraction successful. Please review.', { id: toastId });
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Failed to extract from image', { id: toastId });
    }
    e.target.value = '';
  };

  const handleSaveExtracted = async () => {
    const toastId = toast.loading('Saving products...');
    try {
      // Remove temp IDs
      const toSave = extractedProducts.map(({ id, ...rest }) => rest);
      const res = await fetch('/api/products/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toSave)
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Import Failed');

      toast.success(`Successfully added ${result.count} products!`, { id: toastId });
      setExtractOpen(false);
      fetchProducts();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save extracted products', { id: toastId });
    }
  };

  const updateExtractedProduct = (id: number, field: keyof Product, value: any) => {
    setExtractedProducts(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  };
  const removeExtractedProduct = (id: number) => {
    setExtractedProducts(prev => prev.filter(p => p.id !== id));
  };

  const downloadSampleExcel = () => {
    const sampleData = [
      {
        name: 'Sample Product 1',
        sku: 'SKU001',
        category: 'Grocery',
        hsn_code: '1234',
        purchase_price: 100,
        selling_price: 150,
        quantity: 50,
        unit: 'pcs',
        low_stock_alert: 10,
        gst_rate: 18,
        description: 'Sample description'
      },
      {
        name: 'Sample Product 2',
        sku: 'SKU002',
        category: 'Dairy',
        hsn_code: '5678',
        purchase_price: 45,
        selling_price: 60,
        quantity: 100,
        unit: 'ltr',
        low_stock_alert: 20,
        gst_rate: 0,
        description: 'Milk 1L'
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Products');
    XLSX.writeFile(workbook, 'Sample_Products_Import.xlsx');
  };

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('Products')}</h1>
          <p className="text-muted-foreground">{t('Manage your shoe inventory, variations, and pricing')}</p>
        </div>
        <div className="flex gap-2">
          <input
            type="file"
            accept=".xlsx, .xls, .csv"
            className="hidden"
            id="excel-upload"
            onChange={handleFileUpload}
          />
          <input
            type="file"
            accept="image/*"
            className="hidden"
            id="image-upload"
            onChange={handleImageUpload}
          />
          <Button variant="outline" onClick={downloadSampleExcel} title={t('Download Sample format')}>
            <Download className="mr-2 h-4 w-4" /> {t('Sample Format')}
          </Button>
          <Button variant="outline" onClick={() => document.getElementById('image-upload')?.click()}>
            <Camera className="mr-2 h-4 w-4" /> {t('Extract Invoice')}
          </Button>
          <Button variant="outline" onClick={() => document.getElementById('excel-upload')?.click()}>
            <Upload className="mr-2 h-4 w-4" /> {t('Import Excel')}
          </Button>
          <Button onClick={openAdd}>
            <Plus className="mr-2 h-4 w-4" /> {t('Add Product')}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('Search products by name or SKU...')}
                className="pl-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder={t('All Categories')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('All Categories')}</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Products Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {t('Products')} ({products.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-lg font-medium">{t('No products found')}</p>
              <p className="text-sm">{t('Add your first product to get started')}</p>
              <Button onClick={openAdd} className="mt-4" variant="outline">
                <Plus className="mr-2 h-4 w-4" /> {t('Add Product')}
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('Name')}</TableHead>
                  <TableHead>{t('SKU')}</TableHead>
                  <TableHead>{t('Brand')}</TableHead>
                  <TableHead>{t('Article')}</TableHead>
                  <TableHead>{t('Size')}</TableHead>
                  <TableHead>{t('Color')}</TableHead>
                  <TableHead>{t('Category')}</TableHead>
                  <TableHead className="text-right">{t('Purchase')}</TableHead>
                  <TableHead className="text-right">{t('Selling')}</TableHead>
                  <TableHead className="text-right">{t('Stock')}</TableHead>
                  <TableHead>{t('Status')}</TableHead>
                  <TableHead className="text-right">{t('Actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="text-muted-foreground">{p.sku || '-'}</TableCell>
                    <TableCell>{p.brand || '-'}</TableCell>
                    <TableCell>{p.article_no || '-'}</TableCell>
                    <TableCell>{p.size || '-'}</TableCell>
                    <TableCell>{p.color || '-'}</TableCell>
                    <TableCell>{p.category || '-'}</TableCell>
                    <TableCell className="text-right">{formatCurrency(p.purchase_price)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(p.selling_price)}</TableCell>
                    <TableCell className="text-right">{p.quantity} {p.unit}</TableCell>
                    <TableCell>
                      {p.quantity === 0 ? (
                        <Badge variant="destructive">{t('Out of Stock')}</Badge>
                      ) : p.quantity <= p.low_stock_alert ? (
                        <Badge className="bg-orange-500 text-white">{t('Low Stock')}</Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-green-100 text-green-700">{t('In Stock')}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon-sm" variant="ghost" onClick={() => openEdit(p)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon-sm" variant="ghost" onClick={() => promptDelete(p)}>
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

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProduct ? t('Edit Product') : t('Add Product')}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-8 py-2">
            
            {/* Basic Information Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2 text-slate-800">{t('Basic Information')}</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 sm:col-span-1">
                  <Label htmlFor="product-name">{t('Product Name *')}</Label>
                  <Input autoFocus id="product-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t('Enter product name')} />
                </div>
                <div>
                  <Label>{t('Category')}</Label>
                  <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                    <SelectTrigger><SelectValue placeholder={t('Select category')} /></SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="product-brand">{t('Brand')}</Label>
                  <Input id="product-brand" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} placeholder="e.g. Nike" />
                </div>
                <div>
                  <Label htmlFor="product-article">{t('Article No.')}</Label>
                  <Input id="product-article" value={form.article_no} onChange={(e) => setForm({ ...form, article_no: e.target.value })} placeholder="e.g. N-123" />
                </div>
              </div>
            </div>

            {/* Variants Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2 text-slate-800">{t('Variants')}</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="product-size">{t('Size')}</Label>
                  <Input id="product-size" value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })} placeholder="e.g. 9 UK" />
                </div>
                <div>
                  <Label htmlFor="product-color">{t('Color')}</Label>
                  <Input id="product-color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} placeholder="e.g. Black" />
                </div>
              </div>
            </div>

            {/* Pricing & Tax Section */}
            <div className="space-y-4 bg-slate-50 p-4 rounded-lg border">
              <h3 className="text-lg font-semibold border-b pb-2 text-slate-800">{t('Pricing & Tax')}</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="purchase-price">{t('Purchase Price (₹)')}</Label>
                  <Input id="purchase-price" type="number" min="0" step="any" value={form.purchase_price === 0 ? '' : form.purchase_price} onChange={(e) => setForm({ ...form, purchase_price: e.target.value === '' ? 0 : parseFloat(e.target.value) })} />
                </div>
                <div>
                  <Label htmlFor="selling-price">{t('Selling Price * (₹)')}</Label>
                  <Input id="selling-price" type="number" min="0" step="any" value={form.selling_price === 0 ? '' : form.selling_price} onChange={(e) => setForm({ ...form, selling_price: e.target.value === '' ? 0 : parseFloat(e.target.value) })} />
                </div>
                
                {/* Live Margin Display */}
                <div className="col-span-2 h-6">
                  {form.selling_price > 0 && form.purchase_price >= 0 && form.selling_price >= form.purchase_price ? (
                    <span className="text-sm text-green-600 font-medium bg-green-100 px-2 py-1 rounded">
                      {t('Profit Margin:')} ₹{(form.selling_price - form.purchase_price).toFixed(2)} ({((form.selling_price - form.purchase_price) / form.selling_price * 100).toFixed(1)}%)
                    </span>
                  ) : form.selling_price > 0 && form.purchase_price > form.selling_price ? (
                    <span className="text-sm text-red-600 font-medium bg-red-100 px-2 py-1 rounded">
                      {t('Loss:')} ₹{(form.purchase_price - form.selling_price).toFixed(2)} (Selling below purchase price)
                    </span>
                  ) : null}
                </div>

                <div>
                  <Label>{t('GST Rate (%)')}</Label>
                  <Input type="number" min="0" step="any" value={form.gst_rate === 0 ? '' : form.gst_rate} onChange={(e) => setForm({ ...form, gst_rate: e.target.value === '' ? 0 : parseFloat(e.target.value) })} />
                </div>
                <div>
                  <Label>{t('HSN Code')}</Label>
                  <Input value={form.hsn_code} onChange={(e) => setForm({ ...form, hsn_code: e.target.value })} />
                </div>
              </div>
            </div>

            {/* Inventory Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2 text-slate-800">{t('Inventory Management')}</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 sm:col-span-1">
                  <Label htmlFor="product-sku">{t('SKU / Barcode')}</Label>
                  <div className="flex gap-2">
                    <Input id="product-sku" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder={t('Scan or enter SKU')} />
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="icon" 
                      title={t('Auto-Generate SKU')}
                      onClick={() => setForm({ ...form, sku: 'SHOE-' + Math.floor(100000 + Math.random() * 900000) })}
                    >
                      <Wand2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div>
                  <Label>{t('Stock Quantity')}</Label>
                  <Input type="number" min="0" step="any" value={form.quantity === 0 ? '' : form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value === '' ? 0 : parseFloat(e.target.value) })} />
                </div>
                <div>
                  <Label>{t('Unit')}</Label>
                  <Select value={form.unit} onValueChange={(v) => setForm({ ...form, unit: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {units.map((u) => <SelectItem key={u.id} value={u.name}>{u.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="low-stock-alert">{t('Low Stock Alert Level')}</Label>
                  <Input id="low-stock-alert" type="number" min="0" step="any" value={form.low_stock_alert === 0 ? '' : form.low_stock_alert} onChange={(e) => setForm({ ...form, low_stock_alert: e.target.value === '' ? 0 : parseFloat(e.target.value) })} />
                </div>
              </div>
            </div>

            {/* Description Section */}
            <div className="space-y-4">
              <div className="col-span-2">
                <Label htmlFor="product-description">{t('Description')}</Label>
                <Input id="product-description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder={t('Optional description or notes')} />
              </div>
            </div>

          </div>

          <DialogFooter className="mt-6 border-t pt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>{t('Cancel')}</Button>
            <Button onClick={handleSave} disabled={saving} className="min-w-[120px]">
              {saving ? t('Saving...') : (editingProduct ? t('Update Product') : t('Add Product'))}
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
              {t('Delete Product')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-red-50 text-red-800 p-4 rounded-md text-sm border border-red-200">
              <p className="font-bold mb-1">{t('Warning: This action cannot be undone.')}</p>
              <p>{t('Deleting this product will permanently remove it from the inventory. Any existing stock count will be lost.')}</p>
            </div>

            <div className="space-y-2">
              <Label>
                Please type <strong className="select-none">{productToDelete?.name}</strong> to confirm.
              </Label>
              <Input
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder={productToDelete?.name}
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
              disabled={deleting || deleteConfirmText !== productToDelete?.name}
            >
              {deleting ? t('Deleting...') : t('Permanently Delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Extract Review Dialog */}
      <Dialog open={extractOpen} onOpenChange={setExtractOpen}>
        <DialogContent className="sm:max-w-[90vw] md:max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('Review Extracted Products')}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">{t('Please review the extracted data and fix any errors before saving.')}</p>
            <div className="border rounded-md overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[250px]">{t('Name')}</TableHead>
                    <TableHead className="min-w-[120px]">{t('SKU')}</TableHead>
                    <TableHead className="min-w-[140px]">{t('Category')}</TableHead>
                    <TableHead className="min-w-[100px]">{t('Purchase Price (₹)')}</TableHead>
                    <TableHead className="min-w-[100px]">{t('Selling Price * (₹)')}</TableHead>
                    <TableHead className="min-w-[80px]">{t('Qty')}</TableHead>
                    <TableHead className="min-w-[80px]">{t('GST Rate (%)')}</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {extractedProducts.map(p => (
                    <TableRow key={p.id}>
                      <TableCell><Input value={p.name} onChange={e => updateExtractedProduct(p.id, 'name', e.target.value)} className="w-full" /></TableCell>
                      <TableCell><Input value={p.sku || ''} onChange={e => updateExtractedProduct(p.id, 'sku', e.target.value)} className="w-full" /></TableCell>
                      <TableCell><Input value={p.category || ''} onChange={e => updateExtractedProduct(p.id, 'category', e.target.value)} className="w-full" /></TableCell>
                      <TableCell><Input type="number" value={p.purchase_price} onChange={e => updateExtractedProduct(p.id, 'purchase_price', parseFloat(e.target.value) || 0)} className="w-full" /></TableCell>
                      <TableCell><Input type="number" value={p.selling_price} onChange={e => updateExtractedProduct(p.id, 'selling_price', parseFloat(e.target.value) || 0)} className="w-full" /></TableCell>
                      <TableCell><Input type="number" value={p.quantity} onChange={e => updateExtractedProduct(p.id, 'quantity', parseFloat(e.target.value) || 0)} className="w-full" /></TableCell>
                      <TableCell><Input type="number" value={p.gst_rate} onChange={e => updateExtractedProduct(p.id, 'gst_rate', parseFloat(e.target.value) || 0)} className="w-full" /></TableCell>
                      <TableCell>
                        <Button size="icon-sm" variant="ghost" onClick={() => removeExtractedProduct(p.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExtractOpen(false)}>{t('Cancel')}</Button>
            <Button onClick={handleSaveExtracted}>{t('Save')} {extractedProducts.length} {t('Products')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
