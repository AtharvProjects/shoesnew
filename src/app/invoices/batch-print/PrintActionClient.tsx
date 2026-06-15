'use client';

import { Printer, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEffect } from 'react';

export default function PrintActionClient({ invoiceCount }: { invoiceCount: number }) {
    useEffect(() => {
        // Automatically trigger print shortly after load
        const t = setTimeout(() => {
            window.print();
        }, 1000);
        return () => clearTimeout(t);
    }, []);

    return (
        <div className="py-4 flex justify-between items-center print:hidden bg-white shadow-sm sticky top-0 z-50 mb-8 border-b px-8">
            <Button variant="ghost" onClick={() => window.close()}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Close
            </Button>
            <div className="flex items-center gap-4">
                <p className="text-sm font-semibold text-gray-700">Native Print Mode: {invoiceCount} Invoices</p>
                <Button onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-700 text-white">
                    <Printer className="mr-2 h-4 w-4" /> Save as PDF
                </Button>
            </div>
        </div>
    );
}
