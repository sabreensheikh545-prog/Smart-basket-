import React from 'react';
import { Order, buildWhatsAppOrderShareUrl, formatINR } from '../types';

interface Props {
  order: Order | null;
  onClose: () => void;
}

export const TaxInvoiceModal: React.FC<Props> = ({ order, onClose }) => {
  if (!order) return null;

  const itemsSubtotal =
    typeof order.subtotal === 'number'
      ? order.subtotal
      : order.items.reduce((sum, it) => sum + Number(it.price) * Number(it.quantity), 0);
  const couponDiscount = Math.max(0, Number(order.couponDiscount || 0));
  const deliveryFee = Math.max(0, Number(order.deliveryFee || 0));
  const platformFee = Math.max(0, Number(order.platformFee || 0));
  const grandTotal = Number(order.total_amount ?? order.total ?? 0);

  // Standard 18% GST inclusive breakdown for Indian e-commerce invoices
  const taxableValue = Math.round((grandTotal / 1.18) * 100) / 100;
  const totalGst = Math.round((grandTotal - taxableValue) * 100) / 100;
  const cgst = Math.round((totalGst / 2) * 100) / 100;
  const sgst = Math.round((totalGst - cgst) * 100) / 100;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/65 backdrop-blur-[2px] flex items-center justify-center p-3 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-white rounded-xl shadow-2xl border border-slate-200 max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3.5 bg-[#0F172A] text-white flex items-center justify-between shrink-0 print:hidden">
          <div className="flex items-center gap-2">
            <i className="fa-solid fa-file-invoice text-[#FFE500]"></i>
            <h2 className="text-sm sm:text-base font-extrabold">Tax Invoice · Order #{order.id}</h2>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={buildWhatsAppOrderShareUrl(order)}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-lg bg-[#25D366] hover:bg-[#1ebe5d] text-white text-xs font-bold inline-flex items-center gap-1.5"
            >
              <i className="fa-brands fa-whatsapp text-sm"></i>
              <span className="hidden sm:inline">WhatsApp</span>
            </a>
            <button
              type="button"
              onClick={() => window.print()}
              className="px-3 py-1.5 rounded-lg bg-[#2874F0] hover:bg-[#1e60d5] text-white text-xs font-bold inline-flex items-center gap-1.5"
            >
              <i className="fa-solid fa-print text-[11px]"></i>
              <span>Print / Save PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close invoice"
              className="w-8 h-8 rounded-lg hover:bg-white/15 flex items-center justify-center"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 text-xs text-slate-700">
          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <p className="text-lg font-extrabold tracking-tight text-[#2874F0] italic">
                Smart <span className="text-[#FB641B]">Basket</span>
              </p>
              <p className="text-[11px] font-semibold text-slate-600 mt-0.5">
                Smart Basket Retail Marketplace Pvt. Ltd.
              </p>
              <p className="text-[11px] text-slate-500">
                JJ Colony, Bawana, New Delhi - 110039, India
              </p>
              <p className="text-[11px] text-slate-500">Support: sabreensheikh545@gmail.com</p>
            </div>
            <div className="text-left sm:text-right space-y-0.5">
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                TAX INVOICE
              </p>
              <p className="font-mono font-bold text-slate-900">INV-SB-{order.id}</p>
              <p className="text-[11px] text-slate-500">
                Date:{' '}
                {new Date(order.created_at).toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </p>
              <p className="text-[11px] font-semibold text-slate-700">
                Payment: {order.paymentMethod || 'Cash on Delivery'}
              </p>
            </div>
          </div>

          {/* Customer Billing/Shipping */}
          <div className="grid sm:grid-cols-2 gap-3 bg-slate-50 rounded-lg border border-slate-200 p-3.5">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                Billed &amp; Shipped To
              </p>
              <p className="text-xs font-extrabold text-slate-900 mt-1">{order.name}</p>
              <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">{order.address}</p>
              <p className="text-[11px] text-slate-600 mt-0.5">Phone: +91 {order.phone}</p>
            </div>
            <div className="sm:text-right">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                Order Status
              </p>
              <p className="text-xs font-extrabold text-emerald-700 mt-1">{order.status}</p>
              {order.couponCode && couponDiscount > 0 && (
                <p className="text-[11px] font-bold text-[#2874F0] mt-1">
                  Promo Applied: {order.couponCode}
                </p>
              )}
            </div>
          </div>

          {/* Line Items Table */}
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100 text-[10px] font-extrabold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                  <th className="py-2.5 px-3">Item Description</th>
                  <th className="py-2.5 px-2 text-center">Qty</th>
                  <th className="py-2.5 px-3 text-right">Unit Price</th>
                  <th className="py-2.5 px-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {order.items.map((it) => (
                  <tr key={it.id}>
                    <td className="py-2.5 px-3 font-semibold text-slate-900">{it.product_name}</td>
                    <td className="py-2.5 px-2 text-center font-mono">{it.quantity}</td>
                    <td className="py-2.5 px-3 text-right font-mono">{formatINR(it.price)}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                      {formatINR(it.price * it.quantity)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Summary Totals */}
          <div className="ml-auto max-w-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-600">Items Subtotal</span>
              <span className="font-mono font-semibold text-slate-900">{formatINR(itemsSubtotal)}</span>
            </div>
            {couponDiscount > 0 && (
              <div className="flex justify-between text-emerald-700 font-bold">
                <span>Promo Discount ({order.couponCode || 'COUPON'})</span>
                <span className="font-mono">-{formatINR(couponDiscount)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-slate-600">Delivery Charge</span>
              <span className="font-mono font-semibold text-slate-900">
                {deliveryFee > 0 ? formatINR(deliveryFee) : 'FREE'}
              </span>
            </div>
            {platformFee > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-600">Platform Fee</span>
                <span className="font-mono font-semibold text-slate-900">{formatINR(platformFee)}</span>
              </div>
            )}
            <div className="pt-2 border-t border-slate-200 flex justify-between text-sm font-extrabold text-slate-900">
              <span>Grand Total (incl. GST)</span>
              <span className="font-mono">{formatINR(grandTotal)}</span>
            </div>
            <div className="pt-1.5 text-[10px] text-slate-500 space-y-0.5 border-t border-dashed border-slate-200">
              <div className="flex justify-between">
                <span>Taxable Value</span>
                <span className="font-mono">₹{taxableValue.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>CGST (9%) + SGST (9%)</span>
                <span className="font-mono">₹{cgst.toFixed(2)} + ₹{sgst.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <p className="text-[10px] text-slate-400 text-center pt-2 border-t border-slate-100">
            This is a computer-generated Tax Invoice and does not require a physical signature.
          </p>
        </div>
      </div>
    </div>
  );
};
