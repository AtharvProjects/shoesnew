'use client';

import { useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function PrintActionsInner() {
    const searchParams = useSearchParams();
    const noPrint = searchParams.get('noprint');

    useEffect(() => {
        if (noPrint) return;
        // Auto-print after a short delay to ensure rendering is complete
        const timer = setTimeout(() => {
            window.print();
        }, 500);
        return () => clearTimeout(timer);
    }, [noPrint]);

    return (
        <div className="flex gap-2">
            <button onClick={() => window.close()} className="px-4 py-2 border rounded hover:bg-gray-100">
                Close
            </button>
            <button onClick={() => window.print()} className="px-4 py-2 bg-black text-white rounded hover:bg-gray-800">
                Print Invoice
            </button>
        </div>
    );
}

export default function PrintActions() {
    return (
        <Suspense fallback={<div />}>
            <PrintActionsInner />
        </Suspense>
    );
}

