import React from 'react';
import {
  Order,
  extractPincodeFromAddress,
  formatINR,
  getPincodeDeliveryEstimate,
  isOnlinePaidOrder,
} from '../types';

interface Props {
  order: Order;
  onTrackOrder: (order: Order) => void;
  onContinueShopping: () => void;
  onPrintInvoice: (order: Order) => void;
}

export const OrderConfirmedView: React.FC<Props> = ({
  order,
  onTrackOrder,
  onContinueShopping,
  onPrintInvoice,
}) => {
  const pincode = extractPincodeFromAddress(order.address, order.pincode) || '110039';
  const estimate = getPincodeDeliveryEstimate(pincode);
  const isPaid = isOnlinePaidOrder(order);
  const grandTotal = Number(order.total_amount ?? order.total ?? 0);
  const itemCount = order.items.reduce((sum, it) => sum + Number(it.quantity || 1), 0);

  return (
    <main className="max-w-2xl mx-auto px-3 sm:px-4 py-6 space-y-4">
      {/* Green Confirmation Hero Card */}
      <section className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="bg-gradient-to-br from-[#2E7D32] via-[#388E3C] to-[#1B5E20] px-5 py-7 text-center text-white">
          <div className="w-16 h-16 rounded-full bg-white text-[#2E7D32] flex items-center justify-center mx-auto shadow-md">
            <i className="fa-solid fa-check text-3xl"></i>
          </div>
          <h1 className="mt-4 text-xl sm:text-2xl font-extrabold tracking-tight">
            Order Placed Successfully!
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-emerald-100">
            Thank you for shopping with Smart Basket. Your order has been confirmed.
          </p>
          <div className="mt-4 inline-flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-2 rounded-lg bg-white/15 text-xs font-bold">
            <span>
              Order ID:{' '}
              <strong className="font-mono text-[#FFE500] tabular-nums">#{order.id}</strong>
            </span>
            <span aria-hidden="true" className="text-emerald-200">
              ·
            </span>
            <span className="font-mono tabular-nums">{formatINR(grandTotal)}</span>
            <span aria-hidden="true" className="text-emerald-200">
              ·
            </span>
            <span>{isPaid ? 'Prepaid (Online Paid)' : 'Cash on Delivery'}</span>
          </div>
        </div>

        {/* Estimated Delivery & Address Grid */}
        <div className="p-4 sm:p-5 grid sm:grid-cols-2 gap-3.5 border-b border-slate-100">
          <div className="rounded-xl bg-emerald-50/70 border border-emerald-200/80 p-3.5 space-y-1">
            <div className="flex items-center gap-2 text-[#2E7D32]">
              <i className="fa-solid fa-truck-fast text-sm"></i>
              <span className="text-xs font-extrabold">Estimated Delivery Date</span>
            </div>
            <p className="text-sm font-extrabold text-slate-900 pt-0.5">
              {estimate.headline}
            </p>
            <p className="text-xs text-slate-600">{estimate.subtext}</p>
            {order.deliveryOtp && (
              <p className="pt-1 text-[11px] font-semibold text-amber-800">
                Delivery OTP:{' '}
                <strong className="font-mono font-extrabold tracking-widest">
                  {order.deliveryOtp}
                </strong>
              </p>
            )}
          </div>

          <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3.5 space-y-1">
            <div className="flex items-center gap-2 text-[#2874F0]">
              <i className="fa-solid fa-location-dot text-sm"></i>
              <span className="text-xs font-extrabold">Delivery Address</span>
            </div>
            <p className="text-xs sm:text-sm font-extrabold text-slate-900 pt-0.5">
              {order.name}
            </p>
            <p className="text-xs text-slate-600 leading-relaxed">{order.address}</p>
            <p className="text-xs font-semibold text-slate-700 pt-0.5">+91 {order.phone}</p>
          </div>
        </div>

        {/* Ordered Items Summary */}
        <div className="p-4 sm:p-5 space-y-3 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <h2 className="text-xs sm:text-sm font-extrabold text-slate-900">
              Order Summary ({itemCount} {itemCount === 1 ? 'item' : 'items'})
            </h2>
            <button
              type="button"
              onClick={() => onPrintInvoice(order)}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#2874F0] hover:underline"
            >
              <i className="fa-solid fa-print text-[11px]"></i>
              <span>Print Invoice</span>
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {order.items.map((it) => (
              <div key={it.id} className="py-2.5 first:pt-0 last:pb-0 flex items-center gap-3">
                <img
                  src={it.product_image}
                  alt={it.product_name}
                  referrerPolicy="no-referrer"
                  className="w-12 h-12 rounded-lg object-cover bg-slate-100 border border-slate-200/70 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                    {it.product_name}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Qty: {it.quantity}
                    {it.selectedVariant ? ` · ${it.selectedVariant}` : ''}
                  </p>
                </div>
                <span className="text-xs sm:text-sm font-extrabold font-mono text-slate-900 tabular-nums shrink-0">
                  {formatINR(it.price * it.quantity)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Primary Action Buttons */}
        <div className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-slate-50/70">
          <button
            type="button"
            onClick={() => onTrackOrder(order)}
            className="h-11 rounded-lg bg-[#2874F0] hover:bg-[#1e60d5] text-white text-sm font-extrabold transition flex items-center justify-center gap-2 shadow-xs"
          >
            <i className="fa-solid fa-route text-xs"></i>
            <span>Track Order</span>
          </button>
          <button
            type="button"
            onClick={onContinueShopping}
            className="h-11 rounded-lg bg-[#FFC200] hover:bg-[#f2b800] text-slate-950 text-sm font-extrabold transition flex items-center justify-center gap-2 shadow-xs"
          >
            <i className="fa-solid fa-bag-shopping text-xs"></i>
            <span>Continue Shopping</span>
          </button>
        </div>
      </section>
    </main>
  );
};
