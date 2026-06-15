'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  IndianRupee, 
  ShoppingCart, 
  Package, 
  Users, 
  TrendingUp,
  AlertTriangle,
  Plus,
  FileText
} from 'lucide-react';
import Link from 'next/link';
import { useLanguage } from '@/components/LanguageProvider';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar
} from 'recharts';
import { format } from 'date-fns';

interface DashboardData {
  stats: {
    todaySales: number;
    todayInvoices: number;
    totalProducts: number;
    lowStockProducts: number;
    totalCustomers: number;
    monthSales: number;
    weekSales: number;
  };
  recentInvoices: Array<{
    id: number;
    invoice_number: string;
    customer_name: string;
    total_amount: number;
    payment_status: string;
    created_at: string;
  }>;
  topProducts: Array<{
    product_name: string;
    total_quantity: number;
    total_revenue: number;
  }>;
  salesTrend: Array<{
    date: string;
    amount: number;
  }>;
  lowStockItems: Array<{
    id: number;
    name: string;
    quantity: number;
    low_stock_alert: number;
    unit: string;
  }>;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const { t } = useLanguage();

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const res = await fetch('/api/dashboard');
      const json = await res.json();
      setData(json);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const stats = data?.stats || {
    todaySales: 0,
    todayInvoices: 0,
    totalProducts: 0,
    lowStockProducts: 0,
    totalCustomers: 0,
    monthSales: 0,
    weekSales: 0
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('Dashboard')}</h1>
          <p className="text-muted-foreground">
            {t('Welcome back! Here\'s your store overview.')}
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/billing">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              {t('New Bill')}
            </Button>
          </Link>
          <Link href="/products">
            <Button variant="outline">
              <Package className="mr-2 h-4 w-4" />
              {t('Add Product')}
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("Today's Sales")}</CardTitle>
            <IndianRupee className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.todaySales)}</div>
            <p className="text-xs text-muted-foreground">
              {stats.todayInvoices} {t('invoices today')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('This Month')}</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.monthSales)}</div>
            <p className="text-xs text-muted-foreground">
              {t('Week:')} {formatCurrency(stats.weekSales)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('Total Products')}</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalProducts}</div>
            <p className="text-xs text-muted-foreground">
              {t('Active inventory items')}
            </p>
          </CardContent>
        </Card>

        <Card className={stats.lowStockProducts > 0 ? 'border-orange-500' : ''}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('Low Stock Alert')}</CardTitle>
            <AlertTriangle className={`h-4 w-4 ${stats.lowStockProducts > 0 ? 'text-orange-500' : 'text-muted-foreground'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${stats.lowStockProducts > 0 ? 'text-orange-500' : ''}`}>
              {stats.lowStockProducts}
            </div>
            <p className="text-xs text-muted-foreground">
              {t('Items need restocking')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Sales Trend Chart */}
        <Card>
          <CardHeader>
            <CardTitle>{t('Sales Trend (Last 7 Days)')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {data?.salesTrend && data.salesTrend.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.salesTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(value) => format(new Date(value), 'dd MMM')}
                    />
                    <YAxis tickFormatter={(value) => `₹${value}`} />
                    <Tooltip 
                      formatter={(value: number) => [formatCurrency(value), t('Sales')]}
                      labelFormatter={(label) => format(new Date(label), 'dd MMM yyyy')}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="amount" 
                      stroke="var(--primary)" 
                      fill="color-mix(in srgb, var(--primary) 20%, transparent)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  {t('No sales data available')}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Top Products Chart */}
        <Card>
          <CardHeader>
            <CardTitle>{t('Top Selling Products')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {data?.topProducts && data.topProducts.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.topProducts} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis 
                      dataKey="product_name" 
                      type="category" 
                      width={100}
                      tick={{ fontSize: 12 }}
                    />
                    <Tooltip 
                      formatter={(value: number, name: string) => [
                        name === 'total_quantity' ? `${value} ${t('units')}` : formatCurrency(value),
                        name === 'total_quantity' ? t('Quantity') : t('Revenue')
                      ]}
                    />
                    <Bar dataKey="total_quantity" fill="var(--primary)" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  {t('No product data available')}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Recent Invoices */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{t('Recent Invoices')}</CardTitle>
            <Link href="/invoices">
              <Button variant="ghost" size="sm">{t('View All')}</Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data?.recentInvoices && data.recentInvoices.length > 0 ? (
                data.recentInvoices.map((invoice) => (
                  <div key={invoice.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="rounded-full bg-primary/10 p-2">
                        <FileText className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{invoice.invoice_number}</p>
                        <p className="text-xs text-muted-foreground">{invoice.customer_name}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{formatCurrency(invoice.total_amount)}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(invoice.created_at.replace(' ', 'T') + 'Z'), 'dd MMM, hh:mm a')}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <ShoppingCart className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>{t('No invoices yet')}</p>
                  <Link href="/billing">
                    <Button variant="link" className="mt-2">{t('Create your first bill')}</Button>
                  </Link>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Low Stock Items */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{t('Low Stock Items')}</CardTitle>
            <Link href="/low-stock">
              <Button variant="ghost" size="sm">{t('View All')}</Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data?.lowStockItems && data.lowStockItems.length > 0 ? (
                data.lowStockItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`rounded-full p-2 ${item.quantity === 0 ? 'bg-red-100' : 'bg-orange-100'}`}>
                        <AlertTriangle className={`h-4 w-4 ${item.quantity === 0 ? 'text-red-500' : 'text-orange-500'}`} />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{item.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {t('Alert at:')} {item.low_stock_alert} {item.unit}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-bold ${item.quantity === 0 ? 'text-red-500' : 'text-orange-500'}`}>
                        {item.quantity} {item.unit}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.quantity === 0 ? t('Out of stock') : t('Low stock')}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>{t('All items are well stocked!')}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats */}
      <Card>
        <CardHeader>
          <CardTitle>{t('Quick Overview')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div className="p-4 rounded-lg bg-muted">
              <Users className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
              <p className="text-2xl font-bold">{stats.totalCustomers}</p>
              <p className="text-xs text-muted-foreground">{t('Total Customers')}</p>
            </div>
            <div className="p-4 rounded-lg bg-muted">
              <Package className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
              <p className="text-2xl font-bold">{stats.totalProducts}</p>
              <p className="text-xs text-muted-foreground">{t('Products')}</p>
            </div>
            <div className="p-4 rounded-lg bg-muted">
              <FileText className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
              <p className="text-2xl font-bold">{stats.todayInvoices}</p>
              <p className="text-xs text-muted-foreground">{t("Today's Bills")}</p>
            </div>
            <div className="p-4 rounded-lg bg-muted">
              <TrendingUp className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
              <p className="text-2xl font-bold">{formatCurrency(stats.weekSales)}</p>
              <p className="text-xs text-muted-foreground">{t('This Week')}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
