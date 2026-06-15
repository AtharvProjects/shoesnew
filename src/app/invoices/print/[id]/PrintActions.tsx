'use client';

import { useEffect } from 'react';

export default function PrintActions() {
    useEffect(() => {
        // Auto-print after a short delay to ensure rendering is complete
        const timer = setTimeout(() => {
            window.print();
        }, 500);
        return () => clearTimeout(timer);
    }, []);

    return (
        <>
            <button onClick={() => window.close()} className="px-4 py-2 border rounded hover:bg-gray-100">
                Close
            </button>
            <button onClick={() => window.print()} className="px-4 py-2 bg-black text-white rounded hover:bg-gray-800">
                Print Invoice
            </button>
        </>
    );
}
