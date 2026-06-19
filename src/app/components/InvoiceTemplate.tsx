'use client';

import React from 'react';
import { format } from 'date-fns';
import { amountInWords } from '@/lib/gst-utils';

export interface InvoiceItem {
  id?: number;
  product_name: string;
  quantity: number;
  unit?: string;
  price: number;
  discount: number;
  total: number;
  hsn_code?: string;
  gst_rate?: number;
  taxable_amount?: number;
  cgst_rate?: number;
  cgst_amount?: number;
  sgst_rate?: number;
  sgst_amount?: number;
  igst_rate?: number;
  igst_amount?: number;
  weight_kg?: number;
}

export interface Invoice {
  id?: number;
  invoice_number: string;
  customer_name: string;
  customer_phone?: string;
  customer_address?: string;
  customer_gstin?: string;
  subtotal: number;
  discount_amount: number;
  gst_enabled: number;
  gst_amount: number;
  gst_rate?: number;
  taxable_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  is_igst: number;
  round_off: number;
  total_amount: number;
  amount_paid: number;
  payment_method: string;
  payment_status: string;
  notes?: string;
  created_at: string;
  store_name?: string;
  invoice_items?: InvoiceItem[];
}

interface InvoiceTemplateProps {
  invoice: Invoice;
  items: InvoiceItem[];
  settings: Record<string, string>;
  qrDataUrl?: string;
  t?: (key: string) => string;
}

export default function InvoiceTemplate({ invoice, items, settings, qrDataUrl, t = (k) => k }: InvoiceTemplateProps) {
  const isGst = invoice.gst_enabled === 1;
  const isIgst = invoice.is_igst === 1;

  return (
    <div style={{ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '11px', backgroundColor: 'white', color: 'black' }} className="invoice-a4-inner pb-8">
      {/* ───── STORE HEADER ───── */}
      <div className="flex justify-between items-start border-b-2 border-black pb-4 mb-4">
        <div className="flex flex-col max-w-[60%]">
          <h1 className="font-bold text-2xl uppercase tracking-wider mb-1">{settings.store_name || 'STORE NAME'}</h1>
          {settings.store_address && <p className="text-xs text-gray-800 leading-tight whitespace-pre-wrap mb-1">{settings.store_address}</p>}
          {settings.store_phone && <p className="text-xs text-gray-800 font-medium">Contact: {settings.store_phone}</p>}
          {settings.store_gstin && <p className="text-xs text-gray-800 font-bold mt-1">GSTIN: {settings.store_gstin}</p>}
        </div>

        <div className="flex flex-col items-end text-right space-y-1">
          <h2 className="font-bold text-lg uppercase tracking-widest">{isGst ? t('TAX INVOICE') : t('SALES INVOICE')}</h2>
          <p className="text-[10px] font-bold text-gray-600 mb-2">(Original for Recipient)</p>
          
          <table className="text-xs text-left border-collapse mt-2">
            <tbody>
              <tr>
                <td className="pr-3 py-0.5 font-bold text-gray-600">Invoice No:</td>
                <td className="py-0.5 font-bold">{invoice.invoice_number}</td>
              </tr>
              <tr>
                <td className="pr-3 py-0.5 font-bold text-gray-600">Date:</td>
                <td className="py-0.5 font-bold">{format(new Date(invoice.created_at.replace(' ', 'T') + 'Z'), 'dd-MMM-yyyy')}</td>
              </tr>
              <tr>
                <td className="pr-3 py-0.5 font-bold text-gray-600">Payment:</td>
                <td className="py-0.5 font-bold uppercase">{invoice.payment_method}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ───── BUYER DETAILS ───── */}
      <div className="mb-4">
        <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Billed To</h3>
        <div className="border border-gray-300 rounded-sm p-3 bg-gray-50 w-full max-w-sm">
          <p className="font-bold text-sm mb-1">{invoice.customer_name || 'Cash Customer'}</p>
          {invoice.customer_phone && <p className="text-xs mb-0.5">Mob: <span className="font-medium">{invoice.customer_phone}</span></p>}
          {invoice.customer_address && <p className="text-xs mb-0.5">{invoice.customer_address}</p>}
          {invoice.customer_gstin && <p className="text-xs font-bold mt-1">GSTIN: {invoice.customer_gstin}</p>}
        </div>
      </div>

      {/* ───── ITEMS TABLE ───── */}
      <div className="mb-6">
        <table className="w-full border-collapse invoice-items-table border border-black text-xs">
          <thead>
            <tr className="bg-gray-100 border-b border-black text-left">
              <th className="border-r border-black py-2 px-2 w-[5%] text-center">Sr.</th>
              <th className="border-r border-black py-2 px-2 w-[40%]">Item Description</th>
              {isGst && <th className="border-r border-black py-2 px-2 w-[10%] text-center">HSN/SAC</th>}
              <th className="border-r border-black py-2 px-2 w-[8%] text-center">Qty</th>
              <th className="border-r border-black py-2 px-2 w-[10%] text-right">Rate</th>
              <th className="border-r border-black py-2 px-2 w-[9%] text-right">Disc.</th>
              {isGst && <th className="border-r border-black py-2 px-2 w-[8%] text-center">GST %</th>}
              <th className="py-2 px-2 w-[10%] text-right font-bold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i} className="border-b border-gray-300 last:border-b-black">
                <td className="border-r border-black py-2 px-2 text-center align-top">{i + 1}</td>
                <td className="border-r border-black py-2 px-2 align-top font-medium">{item.product_name}</td>
                {isGst && <td className="border-r border-black py-2 px-2 text-center align-top text-[10px]">{item.hsn_code || '-'}</td>}
                <td className="border-r border-black py-2 px-2 text-center align-top">{item.quantity} {item.unit || 'Pair'}</td>
                <td className="border-r border-black py-2 px-2 text-right align-top">₹{Number(item.price).toFixed(2)}</td>
                <td className="border-r border-black py-2 px-2 text-right align-top">{Number(item.discount) > 0 ? `₹${Number(item.discount).toFixed(2)}` : '-'}</td>
                {isGst && <td className="border-r border-black py-2 px-2 text-center align-top text-[10px]">{item.gst_rate || 0}%</td>}
                <td className="py-2 px-2 text-right align-top font-bold">₹{Number(item.total).toFixed(2)}</td>
              </tr>
            ))}
            
            {/* Blank filler rows to ensure minimum height if only 1 item */}
            {items.length < 5 && Array.from({ length: 5 - items.length }).map((_, i) => (
              <tr key={`filler-${i}`} className={i === 4 - items.length ? "border-b border-black" : "border-b border-gray-200"}>
                <td className="border-r border-black py-3 px-2"></td>
                <td className="border-r border-black py-3 px-2"></td>
                {isGst && <td className="border-r border-black py-3 px-2"></td>}
                <td className="border-r border-black py-3 px-2"></td>
                <td className="border-r border-black py-3 px-2"></td>
                <td className="border-r border-black py-3 px-2"></td>
                {isGst && <td className="border-r border-black py-3 px-2"></td>}
                <td className="py-3 px-2"></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ───── SUMMARY & FOOTER ROW ───── */}
      <div className="flex justify-between items-stretch">
        
        {/* Left Side: Notes, Amount in Words, QR Code */}
        <div className="w-[60%] flex flex-col justify-between pr-4">
          <div>
            <div className="mb-4">
              <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">Amount in Words:</p>
              <p className="font-bold text-sm bg-gray-50 p-2 rounded-sm border border-gray-200 inline-block w-full">
                {amountInWords(invoice.total_amount)}
              </p>
            </div>
            
            {invoice.notes && (
              <div className="mb-4">
                <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">Notes:</p>
                <p className="text-xs whitespace-pre-wrap">{invoice.notes}</p>
              </div>
            )}
          </div>
          
          <div className="flex items-center space-x-6 mt-4">
            {qrDataUrl && (
              <div className="flex flex-col items-center border border-gray-200 p-2 rounded-md bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrDataUrl} alt="Pay via UPI" width={80} height={80} className="mb-1" />
                <span className="text-[9px] font-bold tracking-wide">Scan to Pay via UPI</span>
              </div>
            )}
            <div className="text-[10px] text-gray-600 space-y-1">
              <p className="font-bold text-black text-xs mb-2">Terms & Conditions:</p>
              <p>1. Goods once sold will not be taken back or exchanged.</p>
              <p>2. Subject to local jurisdiction only.</p>
              <p>3. Warranty as per company policy.</p>
            </div>
          </div>
        </div>

        {/* Right Side: Totals Calculation */}
        <div className="w-[35%]">
          <div className="border border-black rounded-sm overflow-hidden">
            <table className="w-full text-xs">
              <tbody>
                <tr className="border-b border-gray-200">
                  <td className="py-2 px-3 font-bold text-gray-700">Sub Total</td>
                  <td className="py-2 px-3 text-right font-bold">₹{Number(invoice.subtotal).toFixed(2)}</td>
                </tr>
                {Number(invoice.discount_amount) > 0 && (
                  <tr className="border-b border-gray-200 text-green-700">
                    <td className="py-1.5 px-3 font-bold">Invoice Discount</td>
                    <td className="py-1.5 px-3 text-right font-bold">- ₹{Number(invoice.discount_amount).toFixed(2)}</td>
                  </tr>
                )}
                
                {isGst && (
                  <>
                    <tr className="border-b border-gray-200">
                      <td className="py-1.5 px-3 font-medium text-gray-600">Taxable Amount</td>
                      <td className="py-1.5 px-3 text-right">₹{Number(invoice.taxable_amount).toFixed(2)}</td>
                    </tr>
                    {!isIgst ? (
                      <>
                        <tr className="border-b border-gray-100">
                          <td className="py-1.5 px-3 font-medium text-gray-600">Add: CGST</td>
                          <td className="py-1.5 px-3 text-right">₹{Number(invoice.cgst_amount || 0).toFixed(2)}</td>
                        </tr>
                        <tr className="border-b border-gray-200">
                          <td className="py-1.5 px-3 font-medium text-gray-600">Add: SGST</td>
                          <td className="py-1.5 px-3 text-right">₹{Number(invoice.sgst_amount || 0).toFixed(2)}</td>
                        </tr>
                      </>
                    ) : (
                      <tr className="border-b border-gray-200">
                        <td className="py-1.5 px-3 font-medium text-gray-600">Add: IGST</td>
                        <td className="py-1.5 px-3 text-right">₹{Number(invoice.igst_amount || 0).toFixed(2)}</td>
                      </tr>
                    )}
                  </>
                )}

                {Number(invoice.round_off) !== 0 && (
                  <tr className="border-b border-gray-200">
                    <td className="py-1.5 px-3 font-medium text-gray-600">Round Off</td>
                    <td className="py-1.5 px-3 text-right">{Number(invoice.round_off) > 0 ? '+' : ''}₹{Number(invoice.round_off).toFixed(2)}</td>
                  </tr>
                )}

                <tr className="bg-gray-100 border-b border-black">
                  <td className="py-3 px-3 font-bold text-sm uppercase">Grand Total</td>
                  <td className="py-3 px-3 text-right font-bold text-sm">₹{Number(invoice.total_amount).toFixed(2)}</td>
                </tr>

                {Number(invoice.amount_paid) > 0 && Number(invoice.amount_paid) < Number(invoice.total_amount) && (
                  <tr className="bg-green-50 text-green-800 border-b border-gray-200">
                    <td className="py-2 px-3 font-bold">Amount Paid</td>
                    <td className="py-2 px-3 text-right font-bold">₹{Number(invoice.amount_paid).toFixed(2)}</td>
                  </tr>
                )}
                {Number(invoice.amount_paid) > 0 && Number(invoice.amount_paid) < Number(invoice.total_amount) && (
                  <tr className="bg-red-50 text-red-800">
                    <td className="py-2 px-3 font-bold">Balance Due</td>
                    <td className="py-2 px-3 text-right font-bold">₹{(Number(invoice.total_amount) - Number(invoice.amount_paid)).toFixed(2)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          <div className="mt-8 pt-12 text-center border-t border-black w-full relative">
            <span className="text-[10px] font-bold tracking-wide absolute -top-5 left-0 w-full text-center uppercase text-gray-500">For {settings.store_name || 'Store'}</span>
            <span className="font-bold text-xs uppercase">Authorized Signatory</span>
          </div>
        </div>
      </div>
      
      <div className="mt-8 text-center text-xs font-bold text-gray-400 border-t border-gray-200 pt-4">
        Thank you for shopping with us! Visit again.
      </div>

    </div>
  );
}
