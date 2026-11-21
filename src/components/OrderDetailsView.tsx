import React, { useState } from 'react';
import {
  Order,
  Product,
  ProductReview,
  User,
  buildWhatsAppOrderShareUrl,
  formatINR,
  getCourierTrackingUrl,
  getOrderDeliveryStage,
  getOrderStatusLabel,
  getOrderStepIndex,
  getReturnWindowInfo,
  isOrderCancellable,
} from '../types';

interface Props {
  order: Order;
  currentUser: User | null;
  products: Product[];
  allReviews: ProductReview[];
  onBack: () => void;
  onOpenProduct: (prod: Product) => void;
  onOpenInvoice: (ord: Order) => void;
  onOpenCancelModal: (ord: Order) => void;
  onOpenReturnModal: (ord: Order) => void;
  onBuyAgain: (ord: Order) => void;
  onOpenReview: (target: { product: Product; order: Order; existing?: ProductReview | null }) => void;
}

function formatDateTime(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const OrderDetailsView: React.FC<Props> = ({
  order,
  currentUser,
  products,
  allReviews,
  onBack,
  onOpenProduct,
  onOpenInvoice,
  onOpenCancelModal,
  onOpenReturnModal,
  onBuyAgain,
  onOpenReview,
}) => {
  const [copiedAwb, setCopiedAwb] = useState(false);
  const [copiedOtp, setCopiedOtp] = useState(false);

  const stepIdx = getOrderStepIndex(order.status);
  const isCancelled = order.status === 'Cancelled';
  const isReturnState =
    order.status === 'Return Requested' ||
    order.status === 'Return Approved' ||
    order.status === 'Refunded';
  const canCancel = isOrderCancellable(order);
  const returnWin = getReturnWindowInfo(order);
  const isDelivered = order.status === 'Delivered';
  const liveTrackUrl = getCourierTrackingUrl(order.courierName, order.trackingId, order.trackingUrl);
  const whatsappShareUrl = buildWhatsAppOrderShareUrl(order);
  const deliveryStage = getOrderDeliveryStage(order);

  const itemsSubtotal =
    typeof order.subtotal === 'number'
      ? order.subtotal
      : order.items.reduce((sum, it) => sum + Number(it.price) * Number(it.quantity), 0);
  const couponDiscount = Math.max(0, Number(order.couponDiscount || 0));
  const deliveryFee = Math.max(0, Number(order.deliveryFee || 0));
  const platformFee = Math.max(0, Number(order.platformFee || 0));
  const grandTotal = Number(order.total_amount ?? order.total ?? 0);

  const riderPhoneClean = (order.deliveryBoyPhone || '').replace(/[^\d+]/g, '');
  const hasLiveGps =
    typeof order.riderLiveLat === 'number' && typeof order.riderLiveLng === 'number';

  const handleCopy = async (text: string, type: 'awb' | 'otp') => {
    try {
      if (navigator.clipboard && text) {
        await navigator.clipboard.writeText(text);
      }
    } catch {
      // ignore clipboard errors
    }
    if (type === 'awb') {
      setCopiedAwb(true);
      window.setTimeout(() => setCopiedAwb(false), 2000);
    } else {
      setCopiedOtp(true);
      window.setTimeout(() => setCopiedOtp(false), 2000);
    }
  };

  // Vertical Flipkart-style tracking steps
  const timelineSteps: {
    key: string;
    title: string;
    subtitle: string;
    timestamp?: string;
    completed: boolean;
    current: boolean;
    tone?: 'green' | 'red' | 'amber' | 'blue';
  }[] = [
    {
      key: 'placed',
      title: 'Order Placed',
      subtitle: `Order #${order.id} confirmed (${order.paymentMethod || 'Cash on Delivery'})`,
      timestamp: formatDateTime(order.created_at),
      completed: true,
      current: !isCancelled && stepIdx === 1,
      tone: 'green',
    },
    ...(isCancelled
      ? [
          {
            key: 'cancelled',
            title: 'Order Cancelled',
            subtitle: order.cancelReason
              ? `Reason: ${order.cancelReason}`
              : 'Cancelled before delivery · Item stock restored',
            timestamp: formatDateTime(order.cancelledAt || order.created_at),
            completed: true,
            current: true,
            tone: 'red' as const,
          },
        ]
      : [
          {
            key: 'packed',
            title: 'Packed by Seller',
            subtitle:
              stepIdx >= 3 && (order.courierName || order.trackingId)
                ? `Shipped via ${order.courierName || 'Courier Partner'}${
                    order.trackingId ? ` · AWB ${order.trackingId}` : ''
                  }`
                : stepIdx >= 2
                ? 'Seller has packed your items and prepared for dispatch'
                : 'Awaiting seller packing and handover',
            timestamp: formatDateTime(order.packedAt || order.shippedAt),
            completed: stepIdx >= 2,
            current: stepIdx === 2 || stepIdx === 3,
            tone: 'green' as const,
          },
          {
            key: 'out_for_delivery',
            title: 'Out for Delivery',
            subtitle: order.deliveryBoyName
              ? `Assigned to ${order.deliveryBoyName}${
                  order.deliveryBoyVehicle ? ` · ${order.deliveryBoyVehicle}` : ''
                }`
              : order.courierName
              ? `In final mile transit with ${order.courierName}`
              : stepIdx >= 4
              ? 'Our delivery partner is on the way to your address'
              : 'Delivery partner will be assigned before doorstep dispatch',
            timestamp: formatDateTime(order.deliveryOutForDeliveryAt || order.deliveryAssignedAt),
            completed: stepIdx >= 4,
            current: stepIdx === 4,
            tone: 'green' as const,
          },
          {
            key: 'delivered',
            title: 'Delivered',
            subtitle:
              stepIdx >= 5
                ? order.deliveryOtpVerified
                  ? 'Delivered securely with 4-digit OTP verification'
                  : 'Order delivered to your address'
                : 'Pending doorstep handover',
            timestamp: formatDateTime(order.deliveredAt),
            completed: stepIdx >= 5,
            current: stepIdx >= 5 && !isReturnState,
            tone: 'green' as const,
          },
        ]),
    ...(isReturnState
      ? [
          {
            key: 'return_requested',
            title: `${order.returnResolution || 'Return'} Requested`,
            subtitle: order.returnReason || 'Under Smart Basket Admin/Seller review',
            timestamp: formatDateTime(order.returnRequestedAt),
            completed: true,
            current: order.status === 'Return Requested',
            tone: 'amber' as const,
          },
          ...(order.status === 'Return Approved' || order.status === 'Refunded'
            ? [
                {
                  key: 'return_approved',
                  title: `${order.returnResolution || 'Return'} Approved`,
                  subtitle: 'Reverse pickup / replacement scheduled by Admin/Seller',
                  timestamp: formatDateTime(order.returnApprovedAt),
                  completed: true,
                  current: order.status === 'Return Approved',
                  tone: 'blue' as const,
                },
              ]
            : []),
          ...(order.status === 'Refunded'
            ? [
                {
                  key: 'refunded',
                  title: 'Refund Completed',
                  subtitle: 'Amount credited to original payment source (5–7 business days)',
                  timestamp: formatDateTime(order.refundedAt),
                  completed: true,
                  current: true,
                  tone: 'green' as const,
                },
              ]
            : []),
        ]
      : []),
  ];

  return (
    <main className="max-w-3xl mx-auto px-3 sm:px-4 py-5 space-y-4">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to My Orders"
            className="w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-slate-50 shrink-0"
          >
            <i className="fa-solid fa-arrow-left text-xs"></i>
          </button>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 font-mono truncate">
              Order #{order.id}
            </h1>
            <p className="text-[11px] sm:text-xs text-slate-500">
              Placed on {formatDateTime(order.created_at)}
            </p>
          </div>
        </div>

        <span
          className={`px-2.5 py-1 rounded-md text-xs font-extrabold border ${
            isCancelled
              ? 'bg-rose-50 text-rose-700 border-rose-200'
              : order.status === 'Return Requested'
              ? 'bg-amber-50 text-amber-800 border-amber-200'
              : order.status === 'Return Approved'
              ? 'bg-blue-50 text-[#2874F0] border-blue-200'
              : 'bg-emerald-50 text-[#2E7D32] border-emerald-200'
          }`}
        >
          {getOrderStatusLabel(order.status)}
        </span>
      </div>

      {/* Primary Action Strip: WhatsApp Share, Tax Invoice, Buy Again, Cancel / Return */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 flex flex-wrap items-center gap-2">
        <a
          href={whatsappShareUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="px-3.5 py-2 rounded-lg bg-[#25D366] hover:bg-[#1ebe5d] text-white text-xs font-extrabold inline-flex items-center gap-1.5 transition"
        >
          <i className="fa-brands fa-whatsapp text-sm"></i>
          <span>Share Order on WhatsApp</span>
        </a>

        {!isCancelled && (
          <button
            type="button"
            onClick={() => onOpenInvoice(order)}
            className="px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold inline-flex items-center gap-1.5 transition"
          >
            <i className="fa-solid fa-file-invoice text-[#2874F0]"></i>
            <span>Tax Invoice</span>
          </button>
        )}

        {isDelivered && (
          <button
            type="button"
            onClick={() => onBuyAgain(order)}
            className="px-3.5 py-2 rounded-lg bg-[#2874F0] hover:bg-[#1e60d5] text-white text-xs font-extrabold inline-flex items-center gap-1.5 transition"
          >
            <i className="fa-solid fa-cart-plus"></i>
            <span>Buy Again</span>
          </button>
        )}

        {canCancel && (
          <button
            type="button"
            onClick={() => onOpenCancelModal(order)}
            className="px-3.5 py-2 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-extrabold inline-flex items-center gap-1.5 transition sm:ml-auto"
          >
            <i className="fa-solid fa-xmark"></i>
            <span>Cancel Order</span>
          </button>
        )}

        {isDelivered && returnWin.eligible && (
          <button
            type="button"
            onClick={() => onOpenReturnModal(order)}
            className="px-3.5 py-2 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 text-xs font-extrabold inline-flex items-center gap-1.5 transition sm:ml-auto"
          >
            <i className="fa-solid fa-rotate-left"></i>
            <span>Return / Replace ({returnWin.daysLeft}d left)</span>
          </button>
        )}

        {isDelivered && !returnWin.eligible && (
          <span className="text-[11px] font-semibold text-slate-400 sm:ml-auto">
            7-day return window closed
          </span>
        )}
      </div>

      {/* Vertical Step-by-Step Tracking Timeline */}
      <section className="bg-white rounded-xl border border-slate-200/80 p-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
            <i className="fa-solid fa-route text-[#2874F0]"></i>
            <span>Live Order Tracking Timeline</span>
          </h2>
          {order.trackingNote && !isCancelled && (
            <span className="text-[11px] font-bold text-[#2E7D32] truncate max-w-[240px]">
              {order.trackingNote}
            </span>
          )}
        </div>

        <ol className="relative pl-1 space-y-0">
          {timelineSteps.map((step, idx) => {
            const isLast = idx === timelineSteps.length - 1;
            const nextCompleted = !isLast && timelineSteps[idx + 1]?.completed;
            const dotClasses = !step.completed
              ? 'bg-white border-2 border-slate-300 text-slate-400'
              : step.tone === 'red'
              ? 'bg-rose-600 text-white border-2 border-rose-600'
              : step.tone === 'amber'
              ? 'bg-amber-500 text-white border-2 border-amber-500'
              : step.tone === 'blue'
              ? 'bg-[#2874F0] text-white border-2 border-[#2874F0]'
              : 'bg-[#2E7D32] text-white border-2 border-[#2E7D32]';

            return (
              <li key={step.key} className="relative flex items-start gap-3.5 pb-5 last:pb-0">
                {/* Vertical connector line */}
                {!isLast && (
                  <span
                    aria-hidden="true"
                    className={`absolute left-[11px] top-6 bottom-0 w-0.5 ${
                      nextCompleted ? 'bg-[#2E7D32]' : 'bg-slate-200'
                    }`}
                  />
                )}

                {/* Status Node */}
                <span
                  className={`relative z-10 w-6 h-6 rounded-full flex items-center justify-center text-[10px] shrink-0 mt-0.5 ${dotClasses} ${
                    step.current ? 'ring-4 ring-emerald-100' : ''
                  }`}
                >
                  {step.completed ? (
                    <i
                      className={`fa-solid ${
                        step.tone === 'red'
                          ? 'fa-xmark'
                          : step.tone === 'amber'
                          ? 'fa-rotate-left'
                          : 'fa-check'
                      }`}
                    ></i>
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                  )}
                </span>

                {/* Step Details */}
                <div className="flex-1 min-w-0 pt-0.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                    <p
                      className={`text-sm font-extrabold ${
                        step.completed ? 'text-slate-900' : 'text-slate-400'
                      }`}
                    >
                      {step.title}
                    </p>
                    {step.timestamp && step.completed && (
                      <span className="text-[11px] font-medium text-slate-500 tabular-nums">
                        {step.timestamp}
                      </span>
                    )}
                  </div>
                  <p
                    className={`text-xs mt-0.5 leading-relaxed ${
                      step.completed ? 'text-slate-600' : 'text-slate-400'
                    }`}
                  >
                    {step.subtitle}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>

        {/* Attached Return Photo Proof Preview (if submitted) */}
        {order.returnProofPhoto && (
          <div className="pt-3 border-t border-slate-100 flex items-center gap-3">
            <img
              src={order.returnProofPhoto}
              alt="Submitted return proof"
              className="w-16 h-16 rounded-lg object-cover border border-slate-200 shrink-0"
            />
            <div className="text-xs">
              <p className="font-extrabold text-slate-900">Return Photo Proof Attached</p>
              {order.returnRequestId && (
                <p className="text-[11px] font-mono text-slate-500 mt-0.5">
                  Request ID: {order.returnRequestId}
                </p>
              )}
              <p className="text-[11px] text-slate-600 mt-0.5">
                Shared with Admin &amp; Seller for verification.
              </p>
            </div>
          </div>
        )}
      </section>

      {/* Assigned Delivery Partner / Courier Details */}
      {!isCancelled && (order.deliveryBoyName || order.deliveryOtp || order.courierName || order.trackingId) && (
        <section className="bg-white rounded-xl border border-slate-200/80 p-4 sm:p-5 space-y-3">
          <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
            Delivery Partner &amp; Shipment Details
          </h2>

          {order.deliveryBoyName && order.dispatchMode !== 'courier' && (
            <div className="rounded-xl bg-blue-50/70 border border-blue-200/80 p-3.5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-[#2874F0] text-white flex items-center justify-center shrink-0">
                    <i className="fa-solid fa-motorcycle text-sm"></i>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-extrabold text-slate-900 truncate">
                        {order.deliveryBoyName}
                      </p>
                      {deliveryStage && (
                        <span className="px-2 py-0.5 rounded bg-white border border-blue-200 text-[10px] font-extrabold text-[#2874F0] uppercase">
                          {deliveryStage}
                        </span>
                      )}
                    </div>
                    {order.deliveryBoyPhone && (
                      <p className="text-xs font-mono text-slate-600">{order.deliveryBoyPhone}</p>
                    )}
                    {order.deliveryBoyVehicle && (
                      <p className="text-[11px] text-slate-500">{order.deliveryBoyVehicle}</p>
                    )}
                  </div>
                </div>

                {riderPhoneClean && (
                  <a
                    href={`tel:${riderPhoneClean}`}
                    className="px-3.5 py-2 rounded-lg bg-[#2E7D32] hover:bg-emerald-800 text-white text-xs font-extrabold inline-flex items-center gap-1.5 transition shrink-0"
                  >
                    <i className="fa-solid fa-phone text-[11px]"></i>
                    <span>Call Rider</span>
                  </a>
                )}
              </div>

              {order.status === 'Out for Delivery' && hasLiveGps && (
                <div className="flex flex-wrap items-center justify-between gap-2 bg-white rounded-lg border border-emerald-200 px-3 py-2">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                    <span className="font-bold text-emerald-900">Rider Live GPS Active</span>
                  </div>
                  <a
                    href={`https://www.google.com/maps?q=${order.riderLiveLat},${order.riderLiveLng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-lg bg-[#2874F0] text-white text-xs font-bold inline-flex items-center gap-1.5"
                  >
                    <i className="fa-solid fa-location-crosshairs"></i>
                    <span>Open Live Map</span>
                  </a>
                </div>
              )}
            </div>
          )}

          {order.deliveryOtp && !isDelivered && !isReturnState && order.dispatchMode !== 'courier' && (
            <div className="rounded-xl bg-amber-50 border border-amber-300 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800">
                  4-Digit Delivery Verification OTP
                </p>
                <p className="text-[11px] text-amber-900">
                  Share this code with your delivery partner at doorstep handover.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-lg bg-white border border-amber-300 font-mono text-base font-extrabold tracking-[0.25em] text-amber-950 select-text">
                  {order.deliveryOtp}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(order.deliveryOtp || '', 'otp')}
                  className="px-2.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold"
                >
                  {copiedOtp ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
          )}

          {(order.courierName || order.trackingId || liveTrackUrl) && (
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 flex flex-wrap items-center justify-between gap-2.5">
              <div className="space-y-1 text-xs">
                <p className="font-extrabold text-slate-900 flex items-center gap-1.5">
                  <i className="fa-solid fa-truck-fast text-[#2874F0]"></i>
                  <span>{order.courierName || 'Courier Partner'}</span>
                </p>
                {order.trackingId && (
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-500">AWB:</span>
                    <span className="font-mono font-bold text-slate-900 select-text">
                      {order.trackingId}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(order.trackingId || '', 'awb')}
                      className="px-1.5 py-0.5 rounded bg-blue-50 text-[#2874F0] text-[10px] font-bold hover:bg-blue-100"
                    >
                      {copiedAwb ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                )}
              </div>
              {liveTrackUrl && (
                <a
                  href={liveTrackUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2 rounded-lg bg-[#2874F0] hover:bg-[#1e60d5] text-white text-xs font-bold inline-flex items-center gap-1.5"
                >
                  <span>Track Shipment</span>
                  <i className="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>
                </a>
              )}
            </div>
          )}
        </section>
      )}

      {/* Ordered Items */}
      <section className="bg-white rounded-xl border border-slate-200/80 overflow-hidden">
        <div className="px-4 sm:px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-extrabold text-slate-900">
            Items in This Order ({order.items.length})
          </h2>
          {isDelivered && (
            <span className="text-[11px] font-bold text-[#2E7D32]">Verified Purchase</span>
          )}
        </div>
        <div className="divide-y divide-slate-100">
          {order.items.map((it) => {
            const matchedProduct =
              products.find((p) => p.id === it.product_id) || {
                id: it.product_id,
                docId: it.product_doc_id,
                cat_id: 1,
                name: it.product_name,
                description: '',
                price: it.price,
                stock: 0,
                image: it.product_image,
                created_at: order.created_at,
              };
            const uid = currentUser ? currentUser.uid || String(currentUser.id) : '';
            const myExisting = uid
              ? allReviews.find((r) => r.productId === it.product_id && r.userId === uid)
              : undefined;

            return (
              <div key={it.id} className="p-4 flex items-center gap-3.5">
                <button
                  type="button"
                  onClick={() => onOpenProduct(matchedProduct)}
                  className="w-16 h-16 rounded-lg bg-slate-100 overflow-hidden shrink-0 border border-slate-200/70"
                >
                  <img
                    src={it.product_image}
                    alt={it.product_name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </button>
                <div className="flex-1 min-w-0">
                  <button
                    type="button"
                    onClick={() => onOpenProduct(matchedProduct)}
                    className="text-left text-sm font-bold text-slate-900 hover:text-[#2874F0] line-clamp-2"
                  >
                    {it.product_name}
                  </button>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Qty: {it.quantity} × {formatINR(it.price)}
                    {it.sellerName ? ` · Seller: ${it.sellerName}` : ''}
                  </p>
                  {isDelivered && currentUser && (
                    <button
                      type="button"
                      onClick={() =>
                        onOpenReview({
                          product: matchedProduct,
                          order,
                          existing: myExisting || null,
                        })
                      }
                      className="mt-2 px-2.5 py-1 rounded-md bg-blue-50 hover:bg-blue-100 text-[#2874F0] text-[11px] font-bold inline-flex items-center gap-1"
                    >
                      <i className="fa-solid fa-star text-[9px] text-amber-500"></i>
                      <span>{myExisting ? `Rated ${myExisting.rating}★ (Edit)` : 'Write Verified Review'}</span>
                    </button>
                  )}
                </div>
                <span className="text-sm font-extrabold font-mono text-slate-900 tabular-nums shrink-0">
                  {formatINR(it.price * it.quantity)}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Shipping Address & Price Breakdown */}
      <div className="grid sm:grid-cols-2 gap-4">
        <section className="bg-white rounded-xl border border-slate-200/80 p-4 sm:p-5 space-y-1.5 text-xs">
          <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-2">
            Shipping Details
          </h2>
          <p className="text-sm font-extrabold text-slate-900">{order.name}</p>
          <p className="text-slate-600 leading-relaxed">{order.address}</p>
          <p className="text-slate-700 font-semibold pt-1">
            <i className="fa-solid fa-phone text-[#2874F0] mr-1.5"></i>
            +91 {order.phone}
          </p>
          <p className="text-slate-600">
            <i className="fa-solid fa-wallet text-[#2E7D32] mr-1.5"></i>
            {order.paymentMethod || 'Cash on Delivery'}
          </p>
        </section>

        <section className="bg-white rounded-xl border border-slate-200/80 p-4 sm:p-5 space-y-2 text-xs">
          <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-2">
            Price Details
          </h2>
          <div className="flex justify-between text-slate-600">
            <span>Items Subtotal</span>
            <span className="font-mono font-semibold text-slate-900">{formatINR(itemsSubtotal)}</span>
          </div>
          {couponDiscount > 0 && (
            <div className="flex justify-between text-emerald-700 font-semibold">
              <span>Promo ({order.couponCode || 'DISCOUNT'})</span>
              <span className="font-mono">-{formatINR(couponDiscount)}</span>
            </div>
          )}
          <div className="flex justify-between text-slate-600">
            <span>Delivery Charge</span>
            <span className={`font-mono font-semibold ${deliveryFee === 0 ? 'text-[#2E7D32]' : 'text-slate-900'}`}>
              {deliveryFee > 0 ? formatINR(deliveryFee) : 'FREE'}
            </span>
          </div>
          {platformFee > 0 && (
            <div className="flex justify-between text-slate-600">
              <span>Platform Fee</span>
              <span className="font-mono font-semibold text-slate-900">{formatINR(platformFee)}</span>
            </div>
          )}
          <div className="pt-2 border-t border-slate-200 flex justify-between text-sm font-extrabold text-slate-900">
            <span>Total Paid</span>
            <span className="font-mono tabular-nums">{formatINR(grandTotal)}</span>
          </div>
        </section>
      </div>
    </main>
  );
};
