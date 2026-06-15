/**
 * Sidebar navigation component
 * Navigation links and dynamic store branding.
 */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  FileText,
  BarChart3,
  Settings,
  AlertTriangle,
  Store,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLanguage } from '@/components/LanguageProvider';
import { Button } from '@/components/ui/button';

/* Navigation items */
const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/billing', label: 'New Bill', icon: ShoppingCart },
  { href: '/invoices', label: 'Invoices', icon: FileText },
  { href: '/products', label: 'Products', icon: Package },
  { href: '/customers', label: 'Customers', icon: Users },
  { href: '/reports', label: 'Reports', icon: BarChart3 },
  { href: '/low-stock', label: 'Low Stock', icon: AlertTriangle },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const [storeName, setStoreName] = useState('Billing Software');
  const { language, setLanguage, t } = useLanguage();

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then((data) => {
        if (data.store_name) {
          setStoreName(data.store_name);
        }
      })
      .catch((err) => console.error('Failed to load store name for sidebar', err));
  }, []);

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r bg-card flex flex-col">
      {/* Store branding header */}
      <div className="flex items-center gap-3 px-6 py-5 border-b">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Store className="h-5 w-5" />
        </div>
        <div className="overflow-hidden">
          <h1 className="text-sm font-bold leading-tight truncate" title={storeName}>
            {storeName}
          </h1>
          <p className="text-xs text-muted-foreground truncate">Billing Software</p>
        </div>
      </div>

      {/* Navigation links */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {t(item.label)}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t px-6 py-3 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">Language / भाषा</span>
          <Button 
            variant="outline" 
            size="sm" 
            className="h-7 text-xs px-2"
            onClick={() => setLanguage(language === 'en' ? 'mr' : 'en')}
          >
            {language === 'en' ? 'मराठी' : 'English'}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground text-center mt-1">
          v1.0.0 &middot; Single User
        </p>
      </div>
    </aside>
  );
}
