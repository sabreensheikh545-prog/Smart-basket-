import React, { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { Order, buildWhatsAppOrderShareUrl, formatINR, isOnlinePaidOrder } from '../types';

interface Props {
  order: Order | null;
  onClose: () => void;
}

function buildBarcodeBars(code: string): number[] {
  const safe = code || 'SB0000';
  const widths: number[] = [2, 1, 2, 1];
  for (let i = 0; i < safe.length; i += 1) {
    const ch = safe.charCodeAt(i);
    widths.push(((ch >> 4) & 3) + 1);
    widths.push(((ch >> 2) & 1) + 1);
    widths.push((ch & 3) + 1);
    widths.push(1);
  }
  widths.push(2, 1, 2);
  return widths;
}

export const TaxInvoiceModal: React.FC<Props> = ({ order, onClose }) => {
  const [layoutMode, setLayoutMode] = useState<'a4' | 'thermal'>('a4');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  const itemsSubtotal = useMemo(() => {
    if (!order) return 0;
    return typeof order.subtotal === 'number'
      ? order.subtotal
      : order.items.reduce((sum, it) => sum + Number(it.price) * Number(it.quantity), 0);
  }, [order]);

  const grandTotal = order ? Number(order.total_amount ?? order.total ?? 0) : 0;
  const invoiceRef = order ? `INV-SB-${order.id}` : '';
  const barcodeText = order ? `SB${String(order.id).padStart(6, '0')}` : '';

  useEffect(() => {
    let active = true;
    if (!order) {
      setQrDataUrl('');
      return;
    }
    const payload = [
      'SMART BASKET TAX INVOICE',
      `INV: ${invoiceRef}`,
      `ORDER: #${order.id}`,
      `TOTAL: INR ${grandTotal}`,
      `PAY: ${isOnlinePaidOrder(order) ? 'PAID' : 'COD'}`,
      `STATUS: ${order.status}`,
    ].join(' | ');

    QRCode.toDataURL(payload, {
      width: 140,
      margin: 1,
      color: { dark: '#0F172A', light: '#FFFFFF' },
    })
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch(() => {
        if (active) setQrDataUrl('');
      });

    return () => {
      active = false;
    };
  }, [order, invoiceRef, grandTotal]);

  useEffect(() => {
    const cleanup = () => {
      document.body.classList.remove('sb-printing-invoice');
    };
    window.addEventListener('afterprint', cleanup);
    return () => {
      window.removeEventListener('afterprint', cleanup);
      cleanup();
    };
  }, []);

  if (!order) return null;

  const couponDiscount = Math.max(0, Number(order.couponDiscount || 0));
  const deliveryFee = Math.max(0, Number(order.deliveryFee || 0));
  const platformFee = Math.max(0, Number(order.platformFee || 0));

  // Standard 18% GST inclusive breakdown for Indian e-commerce invoices
  const taxableValue = Math.round((grandTotal / 1.18) * 100) / 100;
  const totalGst = Math.round((grandTotal - taxableValue) * 100) / 100;
  const cgst = Math.round((totalGst / 2) * 100) / 100;
  const sgst = Math.round((totalGst - cgst) * 100) / 100;

  const onlinePaid = isOnlinePaidOrder(order);
  const paymentStatusLabel =
    order.status === 'Refunded'
      ? 'REFUNDED'
      : order.status === 'Cancelled'
      ? 'CANCELLED'
      : onlinePaid
      ? 'PAID (PREPAID)'
      : order.status === 'Delivered'
      ? 'PAID (COD COLLECTED)'
      : 'COD — PAY ON DELIVERY';

  const sellerNames = Array.from(
    new Set(
      order.items
        .map((it) => (it.sellerName || '').trim())
        .filter((s) => s.length > 0)
    )
  );
  const sellerDisplay =
    sellerNames.length > 0 ? sellerNames.join(', ') : 'Smart Basket Direct Retail';

  const barcodeWidths = buildBarcodeBars(barcodeText);
  let barCursor = 0;
  const barcodeRects = barcodeWidths.map((w, idx) => {
    const x = barCursor;
    barCursor += w;
    return { x, w, isDark: idx % 2 === 0 };
  });

  const handlePrint = () => {
    document.body.classList.add('sb-printing-invoice');
    window.setTimeout(() => {
      window.print();
      window.setTimeout(() => {
        document.body.classList.remove('sb-printing-invoice');
      }, 1000);
    }, 60);
  };

  const isThermal = layoutMode === 'thermal';

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/65 backdrop-blur-[2px] flex items-center justify-center p-2.5 sm:p-4 print:static print:bg-white print:p-0"
      onClick={onClose}
    >
      <div
        className={`w-full ${
          isThermal ? 'max-w-md' : 'max-w-2xl'
        } bg-white rounded-xl shadow-2xl border border-slate-200 max-h-[93vh] flex flex-col overflow-hidden print:max-w-none print:max-h-none print:shadow-none print:border-0 print:rounded-none`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Action Bar (Hidden in Print) */}
        <div className="px-4 sm:px-5 py-3 bg-[#0F172A] text-white flex flex-wrap items-center justify-between gap-2 shrink-0 print:hidden">
          <div className="flex items-center gap-2 min-w-0">
            <i className="fa-solid fa-file-invoice text-[#FFE500]"></i>
            <h2 className="text-xs sm:text-sm font-extrabold truncate">
              Tax Invoice · #{order.id}
            </h2>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            {/* A4 vs Thermal 80mm Switcher */}
            <div className="inline-flex rounded-lg bg-white/10 p-0.5 text-[11px] font-bold">
              <button
                type="button"
                onClick={() => setLayoutMode('a4')}
                className={`px-2.5 py-1 rounded-md transition ${
                  !isThermal ? 'bg-white text-slate-900' : 'text-slate-200 hover:text-white'
                }`}
              >
                A4 Invoice
              </button>
              <button
                type="button"
                onClick={() => setLayoutMode('thermal')}
                className={`px-2.5 py-1 rounded-md transition ${
                  isThermal ? 'bg-white text-slate-900' : 'text-slate-200 hover:text-white'
                }`}
              >
                Thermal 80mm
              </button>
            </div>

            <a
              href={buildWhatsAppOrderShareUrl(order)}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 py-1.5 rounded-lg bg-[#25D366] hover:bg-[#1ebe5d] text-white text-xs font-bold inline-flex items-center gap-1.5"
            >
              <i className="fa-brands fa-whatsapp text-sm"></i>
              <span className="hidden sm:inline">WhatsApp</span>
            </a>
            <button
              type="button"
              onClick={handlePrint}
              className="px-3 py-1.5 rounded-lg bg-[#2874F0] hover:bg-[#1e60d5] text-white text-xs font-bold inline-flex items-center gap-1.5"
            >
              <i className="fa-solid fa-print text-[11px]"></i>
              <span>Print / PDF</span>
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

        {/* Printable Invoice & Packing Slip Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/70 print:bg-white print:p-0 print:overflow-visible">
          <div
            className={`sb-print-invoice-root ${
              isThermal ? 'sb-thermal-mode max-w-[320px] mx-auto p-3.5 text-[11px]' : 'p-5 sm:p-6 text-xs'
            } bg-white rounded-lg border border-slate-200 text-slate-700 space-y-4 print:border-0 print:rounded-none`}
          >
            {/* Brand & Invoice Ref Header */}
            <div
              className={`flex ${
                isThermal ? 'flex-col gap-2.5 text-center' : 'flex-wrap items-start justify-between gap-4'
              } border-b border-slate-200 pb-3.5`}
            >
              <div>
                <p className="text-lg font-extrabold tracking-tight text-[#2874F0] italic leading-none">
                  Smart <span className="text-[#FB641B]">Basket</span>
                </p>
                <p className="text-[11px] font-bold text-slate-800 mt-1">
                  Smart Basket Retail Marketplace Pvt. Ltd.
                </p>
                <p className="text-[10px] text-slate-500">
                  JJ Colony, Bawana, New Delhi - 110039, India
                </p>
                <p className="text-[10px] text-slate-500">GSTIN: 07AABCS5142K1Z8</p>
              </div>
              <div className={isThermal ? 'text-center space-y-0.5' : 'text-left sm:text-right space-y-0.5'}>
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                  TAX INVOICE / PACKING SLIP
                </p>
                <p className="font-mono font-extrabold text-slate-900 text-xs">{invoiceRef}</p>
                <p className="font-mono text-[11px] font-bold text-slate-700">Order #{order.id}</p>
                <p className="text-[10px] text-slate-500">
                  Date:{' '}
                  {new Date(order.created_at).toLocaleString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>

            {/* Seller, Customer Address & Payment Status */}
            <div
              className={`grid ${
                isThermal ? 'grid-cols-1 gap-2.5' : 'sm:grid-cols-2 gap-3'
              } bg-slate-50 rounded-lg border border-slate-200 p-3`}
            >
              <div className="space-y-1">
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  Ship &amp; Bill To
                </p>
                <p className="text-xs font-extrabold text-slate-900">{order.name}</p>
                <p className="text-[11px] text-slate-600 leading-relaxed">{order.address}</p>
                <p className="text-[11px] font-semibold text-slate-700">Phone: +91 {order.phone}</p>
              </div>

              <div className={`space-y-1.5 ${isThermal ? 'pt-2 border-t border-slate-200' : 'sm:text-right'}`}>
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                    Sold By
                  </p>
                  <p className="text-[11px] font-bold text-slate-900">{sellerDisplay}</p>
                </div>
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                    Payment Status
                  </p>
                  <p
                    className={`text-[11px] font-extrabold ${
                      onlinePaid ? 'text-[#2E7D32]' : 'text-amber-700'
                    }`}
                  >
                    {paymentStatusLabel}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    Method: {order.paymentMethod || 'Cash on Delivery'}
                  </p>
                </div>
                {(order.courierName || order.trackingId || order.deliveryBoyName) && (
                  <p className="text-[10px] text-slate-600">
                    Dispatch:{' '}
                    <span className="font-semibold text-slate-800">
                      {order.courierName
                        ? `${order.courierName}${order.trackingId ? ` (${order.trackingId})` : ''}`
                        : order.deliveryBoyName}
                    </span>
                  </p>
                )}
              </div>
            </div>

            {/* Line Items Table */}
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-[10px] font-extrabold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                    <th className="py-2 px-2.5">Item &amp; Variant</th>
                    <th className="py-2 px-1.5 text-center">Qty</th>
                    {!isThermal && <th className="py-2 px-2.5 text-right">Rate</th>}
                    <th className="py-2 px-2.5 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {order.items.map((it) => (
                    <tr key={it.id}>
                      <td className="py-2 px-2.5">
                        <p className="font-semibold text-slate-900 leading-snug">
                          {it.product_name}
                        </p>
                        {it.selectedVariant && (
                          <p className="text-[10px] font-semibold text-[#2874F0] mt-0.5">
                            {it.selectedVariant}
                          </p>
                        )}
                        {it.sellerName && (
                          <p className="text-[10px] text-slate-400">Seller: {it.sellerName}</p>
                        )}
                      </td>
                      <td className="py-2 px-1.5 text-center font-mono font-bold">
                        {it.quantity}
                      </td>
                      {!isThermal && (
                        <td className="py-2 px-2.5 text-right font-mono">{formatINR(it.price)}</td>
                      )}
                      <td className="py-2 px-2.5 text-right font-mono font-bold text-slate-900">
                        {formatINR(it.price * it.quantity)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Summary Totals & GST Breakdown */}
            <div
              className={`grid ${
                isThermal ? 'grid-cols-1 gap-3' : 'sm:grid-cols-12 gap-4 items-end'
              }`}
            >
              {/* QR Code + Barcode Order Ref */}
              <div
                className={`${
                  isThermal ? 'order-2 flex flex-col items-center pt-2 border-t border-dashed border-slate-200' : 'sm:col-span-5 flex items-center gap-3'
                }`}
              >
                {qrDataUrl && (
                  <img
                    src={qrDataUrl}
                    alt={`QR code for Order #${order.id}`}
                    className="w-20 h-20 rounded border border-slate-200 p-1 bg-white shrink-0"
                  />
                )}
                <div className={isThermal ? 'text-center space-y-1' : 'space-y-1 min-w-0'}>
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                    Scan / Barcode Ref
                  </p>
                  <svg
                    viewBox={`0 0 ${barCursor} 28`}
                    className="h-7 w-full max-w-[140px] mx-auto sm:mx-0"
                    role="img"
                    aria-label={`Barcode ${barcodeText}`}
                  >
                    {barcodeRects.map((rect, idx) =>
                      rect.isDark ? (
                        <rect
                          key={idx}
                          x={rect.x}
                          y={0}
                          width={rect.w}
                          height={28}
                          fill="#0F172A"
                        />
                      ) : null
                    )}
                  </svg>
                  <p className="font-mono text-[10px] font-bold tracking-[0.18em] text-slate-700">
                    {barcodeText}
                  </p>
                </div>
              </div>

              {/* Price & GST Table */}
              <div className={`${isThermal ? 'order-1' : 'sm:col-span-7'} space-y-1.5`}>
                <div className="flex justify-between">
                  <span className="text-slate-600">Items Subtotal</span>
                  <span className="font-mono font-semibold text-slate-900">
                    {formatINR(itemsSubtotal)}
                  </span>
                </div>
                {couponDiscount > 0 && (
                  <div className="flex justify-between text-[#2E7D32] font-bold">
                    <span>Promo ({order.couponCode || 'COUPON'})</span>
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
                    <span className="font-mono font-semibold text-slate-900">
                      {formatINR(platformFee)}
                    </span>
                  </div>
                )}
                <div className="pt-2 border-t border-slate-200 flex justify-between text-sm font-extrabold text-slate-900">
                  <span>Grand Total (incl. GST)</span>
                  <span className="font-mono">{formatINR(grandTotal)}</span>
                </div>
                <div className="pt-1.5 text-[10px] text-slate-500 space-y-0.5 border-t border-dashed border-slate-200">
                  <div className="flex justify-between">
                    <span>Taxable Value (Excl. 18% GST)</span>
                    <span className="font-mono">₹{taxableValue.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>CGST (9%) + SGST (9%)</span>
                    <span className="font-mono">
                      ₹{cgst.toFixed(2)} + ₹{sgst.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <p className="text-[10px] text-slate-400 text-center pt-2 border-t border-slate-100">
              Computer-generated Smart Basket Tax Invoice &amp; Packing Slip · No physical signature
              required · Support: sabreensheikh545@gmail.com
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

