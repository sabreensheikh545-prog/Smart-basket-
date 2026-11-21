import React, { useMemo, useState } from 'react';
import { filterOrderForSeller } from '../services/firestoreService';
import {
  DeliveryBoy,
  Order,
  PayoutRequest,
  Product,
  SELLER_PLATFORM_COMMISSION_RATE,
  SellerProfile,
  calculateSellerEarnings,
  formatINR,
  isOnlinePaidOrder,
  normalizeSellerStatus,
} from '../types';
import { exportOrdersToCsv } from '../utils/csvExport';

interface Props {
  orders: Order[];
  sellers: SellerProfile[];
  products: Product[];
  deliveryBoys: DeliveryBoy[];
  payoutRequests: PayoutRequest[];
  adminUsername: string;
  onMarkPayoutPaid: (
    seller: SellerProfile,
    amount: number,
    options: { utrNumber: string; requestId?: string }
  ) => Promise<void> | void;
  onSettleRiderCod: (rider: DeliveryBoy, note: string) => Promise<void> | void;
  showModal: (opts: {
    title: string;
    message: string;
    type?: 'info' | 'success' | 'error';
    onConfirm?: () => void;
    confirmText?: string;
  }) => void;
}

function roundMoney(v: number): number {
  return Math.round((Number(v) || 0) * 100) / 100;
}

function formatShortDate(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const AdminFinancePanel: React.FC<Props> = ({
  orders,
  sellers,
  products,
  deliveryBoys,
  payoutRequests,
  adminUsername,
  onMarkPayoutPaid,
  onSettleRiderCod,
  showModal,
}) => {
  const [payoutSubTab, setPayoutSubTab] = useState<'pending' | 'settled' | 'sellers'>('pending');
  const [utrByKey, setUtrByKey] = useState<Record<string, string>>({});
  const [handoverNoteByRider, setHandoverNoteByRider] = useState<Record<string, string>>({});

  // 1. Real-time Accounting Metrics strictly calculated from Firestore orders
  const ledger = useMemo(() => {
    const deliveredOrders = orders.filter((o) => o.status === 'Delivered');
    const cancelledOrReturnedOrders = orders.filter((o) =>
      ['Cancelled', 'Return Requested', 'Return Approved', 'Refunded'].includes(o.status)
    );

    const gmvDelivered = roundMoney(
      deliveredOrders.reduce((sum, o) => sum + Number(o.total_amount ?? o.total ?? 0), 0)
    );

    const deliveredItemSubtotal = roundMoney(
      deliveredOrders.reduce((sum, o) => {
        const sub =
          typeof o.subtotal === 'number'
            ? o.subtotal
            : (o.items || []).reduce((s, it) => s + Number(it.price || 0) * Number(it.quantity || 0), 0);
        return sum + sub;
      }, 0)
    );

    const platformCommissionEarned = roundMoney(
      deliveredItemSubtotal * SELLER_PLATFORM_COMMISSION_RATE
    );

    // Per-seller delivered sales (strictly status === 'Delivered', excluding any returned/cancelled)
    const sellerRows = sellers.map((seller) => {
      const sEmail = seller.email.trim().toLowerCase();
      const sId = seller.docId || seller.uid || seller.id;
      const sellerProdIds = new Set(
        products
          .filter(
            (p) =>
              (p.sellerEmail && p.sellerEmail.trim().toLowerCase() === sEmail) ||
              (p.sellerId && (p.sellerId === sId || p.sellerId === seller.uid || p.sellerId === seller.id))
          )
          .map((p) => p.id)
      );

      let deliveredSellerSubtotal = 0;
      let deliveredSellerOrders = 0;
      deliveredOrders.forEach((ord) => {
        const scoped = filterOrderForSeller(ord, sId, sEmail, sellerProdIds);
        if (scoped) {
          deliveredSellerOrders += 1;
          deliveredSellerSubtotal += Number(scoped.total_amount || 0);
        }
      });

      const earnings = calculateSellerEarnings(deliveredSellerSubtotal, seller);
      return {
        seller,
        deliveredSellerOrders,
        deliveredSellerSubtotal: roundMoney(deliveredSellerSubtotal),
        earnings,
      };
    });

    const netSellerPayableTotal = roundMoney(
      deliveredItemSubtotal * (1 - SELLER_PLATFORM_COMMISSION_RATE)
    );
    const totalSellerPaidOut = roundMoney(
      sellers.reduce((sum, s) => sum + Number(s.totalPaidOut || 0), 0)
    );
    const totalSellerUnpaidRemaining = Math.max(
      0,
      roundMoney(
        sellerRows.reduce(
          (sum, row) => sum + row.earnings.withdrawableBalance + row.earnings.pendingPayout,
          0
        )
      )
    );

    // Collections split: Razorpay Prepaid vs COD
    const deliveredPrepaidTotal = roundMoney(
      deliveredOrders
        .filter((o) => isOnlinePaidOrder(o))
        .reduce((sum, o) => sum + Number(o.total_amount ?? o.total ?? 0), 0)
    );
    const allActivePrepaidTotal = roundMoney(
      orders
        .filter(
          (o) =>
            isOnlinePaidOrder(o) &&
            !['Cancelled', 'Refunded'].includes(o.status)
        )
        .reduce((sum, o) => sum + Number(o.total_amount ?? o.total ?? 0), 0)
    );
    const deliveredCodTotal = roundMoney(
      deliveredOrders
        .filter((o) => !isOnlinePaidOrder(o))
        .reduce((sum, o) => sum + Number(o.total_amount ?? o.total ?? 0), 0)
    );

    const pendingCodWithRiders = roundMoney(
      deliveryBoys.reduce((sum, r) => sum + Math.max(0, Number(r.codCashInHand || 0)), 0)
    );
    const totalCodHandedOver = roundMoney(
      deliveryBoys.reduce((sum, r) => sum + Math.max(0, Number(r.totalCodSettled || 0)), 0)
    );

    return {
      deliveredCount: deliveredOrders.length,
      voidedCount: cancelledOrReturnedOrders.length,
      gmvDelivered,
      deliveredItemSubtotal,
      platformCommissionEarned,
      netSellerPayableTotal,
      totalSellerPaidOut,
      totalSellerUnpaidRemaining,
      deliveredPrepaidTotal,
      allActivePrepaidTotal,
      deliveredCodTotal,
      pendingCodWithRiders,
      totalCodHandedOver,
      sellerRows,
    };
  }, [orders, sellers, products, deliveryBoys]);

  // 2. Unified Pending Payout Requests (combining `payout_requests` + legacy seller pendingPayoutAmount fallback)
  const { pendingRequests, settledRequests } = useMemo(() => {
    const bySellerEmail = new Map<string, SellerProfile>();
    sellers.forEach((s) => {
      bySellerEmail.set(s.email.trim().toLowerCase(), s);
    });

    const pending: { request: PayoutRequest; seller: SellerProfile | null }[] = [];
    const settled: PayoutRequest[] = [];
    const pendingSellerEmails = new Set<string>();

    payoutRequests.forEach((req) => {
      const emailKey = req.sellerEmail.trim().toLowerCase();
      const matchedSeller =
        bySellerEmail.get(emailKey) ||
        sellers.find(
          (s) => s.docId === req.sellerId || s.uid === req.sellerId || s.id === req.sellerId
        ) ||
        null;

      if (req.status === 'pending') {
        pendingSellerEmails.add(emailKey);
        pending.push({ request: req, seller: matchedSeller });
      } else {
        settled.push(req);
      }
    });

    // Include any seller with pendingPayoutAmount > 0 who hasn't yet got a row in payout_requests
    sellers.forEach((s) => {
      const emailKey = s.email.trim().toLowerCase();
      const pendingAmt = roundMoney(Number(s.pendingPayoutAmount || 0));
      if (pendingAmt > 0 && !pendingSellerEmails.has(emailKey)) {
        pending.push({
          seller: s,
          request: {
            id: `LEGACY-${s.id}`,
            sellerId: s.docId || s.uid || s.id,
            sellerEmail: s.email,
            storeName: s.storeName,
            ownerName: s.ownerName,
            phone: s.phone,
            payoutAccount: s.payoutAccount || 'Not Set',
            amount: pendingAmt,
            status: 'pending',
            requestedAt: s.payoutRequestedAt || s.created_at,
          },
        });
      }
    });

    return {
      pendingRequests: pending.sort(
        (a, b) =>
          new Date(b.request.requestedAt).getTime() - new Date(a.request.requestedAt).getTime()
      ),
      settledRequests: settled.sort(
        (a, b) =>
          new Date(b.paidAt || b.requestedAt).getTime() -
          new Date(a.paidAt || a.requestedAt).getTime()
      ),
    };
  }, [payoutRequests, sellers]);

  // 3. Per-Rider COD Collection & Handover rows
  const riderCodRows = useMemo(() => {
    const deliveredCodOrders = orders.filter(
      (o) => o.status === 'Delivered' && !isOnlinePaidOrder(o)
    );
    return deliveryBoys
      .filter((r) => r.kycStatus === 'approved' || Number(r.codCashInHand || 0) > 0 || Number(r.totalCodSettled || 0) > 0)
      .map((rider) => {
        const riderKey = (rider.docId || rider.id).toLowerCase();
        const riderEmail = (rider.email || '').trim().toLowerCase();
        const matchedCodOrders = deliveredCodOrders.filter((ord) => {
          const ordRiderId = (ord.deliveryBoyId || '').toLowerCase();
          const ordRiderEmail = (ord.deliveryBoyEmail || '').trim().toLowerCase();
          return (
            (ordRiderId && (ordRiderId === riderKey || ordRiderId === rider.id.toLowerCase())) ||
            (ordRiderEmail && riderEmail && ordRiderEmail === riderEmail)
          );
        });
        const codDeliveredVolume = roundMoney(
          matchedCodOrders.reduce((sum, o) => sum + Number(o.total_amount ?? o.total ?? 0), 0)
        );
        return {
          rider,
          codDeliveredCount: matchedCodOrders.length,
          codDeliveredVolume,
          pendingCash: roundMoney(Math.max(0, Number(rider.codCashInHand || 0))),
          totalSettled: roundMoney(Math.max(0, Number(rider.totalCodSettled || 0))),
        };
      })
      .sort((a, b) => b.pendingCash - a.pendingCash || b.codDeliveredVolume - a.codDeliveredVolume);
  }, [deliveryBoys, orders]);

  const handleExportCsv = () => {
    const res = exportOrdersToCsv(orders, 'smart-basket-sales-gst-report');
    showModal({
      title: 'CSV Report Exported',
      message: `Downloaded ${res.filename} with ${res.exportedCount} order record${
        res.exportedCount === 1 ? '' : 's'
      } (including 10% commission, delivery fees & GST-ready totals).`,
      type: 'success',
    });
  };

  const handleSettlePayoutClick = (
    key: string,
    seller: SellerProfile | null,
    amount: number,
    account: string,
    requestId?: string
  ) => {
    if (!seller) {
      showModal({
        title: 'Seller Profile Missing',
        message: 'Could not locate the matching seller record for this payout request.',
        type: 'error',
      });
      return;
    }
    const utr = (utrByKey[key] || '').trim();
    if (utr.length < 4) {
      showModal({
        title: 'UTR / Transaction Ref Required',
        message: 'Please enter a valid Bank UTR or UPI Transaction Reference ID (at least 4 characters) before marking Paid.',
        type: 'error',
      });
      return;
    }
    showModal({
      title: 'Confirm Seller Payout Settlement',
      message: `Mark ${formatINR(amount)} as Paid ✓ to ${seller.storeName} (${account}) with UTR/Ref: ${utr}?`,
      type: 'info',
      confirmText: 'Mark Paid ✓',
      onConfirm: async () => {
        await onMarkPayoutPaid(seller, amount, {
          utrNumber: utr,
          requestId: requestId && !requestId.startsWith('LEGACY-') ? requestId : undefined,
        });
        setUtrByKey((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      },
    });
  };

  const handleRiderHandoverClick = (rider: DeliveryBoy, pendingCash: number) => {
    if (pendingCash <= 0) return;
    const riderKey = rider.docId || rider.id;
    const customNote = (handoverNoteByRider[riderKey] || '').trim();
    const finalNote = customNote
      ? `${customNote} (Verified by ${adminUsername})`
      : `COD Cash Handover verified by ${adminUsername}`;

    showModal({
      title: 'Confirm COD Cash Handover',
      message: `Confirm you have received ${formatINR(pendingCash)} cash from ${rider.name} (${rider.riderId}) and reset their pending cash-in-hand to ₹0?`,
      type: 'info',
      confirmText: 'Mark Settled ✓',
      onConfirm: async () => {
        await onSettleRiderCod(rider, finalNote);
        setHandoverNoteByRider((prev) => {
          const next = { ...prev };
          delete next[riderKey];
          return next;
        });
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Header & One-Click CSV Report Export */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">Finance &amp; Settlements</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time accounting ledger from Firestore orders, 10% platform commission, seller payouts &amp; rider COD reconciliation
          </p>
        </div>
        <button
          type="button"
          onClick={handleExportCsv}
          className="px-4 py-2.5 rounded-lg bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-extrabold inline-flex items-center justify-center gap-2 transition shrink-0"
        >
          <i className="fa-solid fa-file-csv text-[#FFE500] text-sm"></i>
          <span>Export Orders CSV</span>
        </button>
      </div>

      {/* 1. Real Accounting KPI Ledger */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
              Delivered GMV
            </span>
            <span className="w-8 h-8 rounded-lg bg-blue-50 text-[#2874F0] flex items-center justify-center">
              <i className="fa-solid fa-chart-line text-sm"></i>
            </span>
          </div>
          <p className="text-2xl font-extrabold text-slate-900 font-mono tabular-nums">
            {formatINR(ledger.gmvDelivered)}
          </p>
          <p className="text-[11px] text-slate-500">
            {ledger.deliveredCount} delivered order{ledger.deliveredCount === 1 ? '' : 's'}
            {ledger.voidedCount > 0 ? ` · ${ledger.voidedCount} voided/returned excluded` : ''}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-emerald-200 p-4 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wide text-[#1B5E20]">
              10% Platform Commission
            </span>
            <span className="w-8 h-8 rounded-lg bg-emerald-50 text-[#2E7D32] flex items-center justify-center">
              <i className="fa-solid fa-percent text-sm"></i>
            </span>
          </div>
          <p className="text-2xl font-extrabold text-[#2E7D32] font-mono tabular-nums">
            {formatINR(ledger.platformCommissionEarned)}
          </p>
          <p className="text-[11px] text-emerald-800">
            10% earned on {formatINR(ledger.deliveredItemSubtotal)} delivered item value
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-4 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
              Net Payable to Sellers (90%)
            </span>
            <span className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <i className="fa-solid fa-building-columns text-sm"></i>
            </span>
          </div>
          <p className="text-2xl font-extrabold text-slate-900 font-mono tabular-nums">
            {formatINR(ledger.netSellerPayableTotal)}
          </p>
          <p className="text-[11px] text-slate-500">
            Paid: <strong className="font-mono text-slate-700">{formatINR(ledger.totalSellerPaidOut)}</strong> · Due:{' '}
            <strong className="font-mono text-amber-700">{formatINR(ledger.totalSellerUnpaidRemaining)}</strong>
          </p>
        </div>

        <div className="bg-white rounded-xl border border-amber-200/90 p-4 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wide text-amber-900">
              Razorpay vs. Pending Rider COD
            </span>
            <span className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
              <i className="fa-solid fa-money-bill-transfer text-sm"></i>
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-2 pt-0.5">
            <div>
              <p className="text-[10px] font-bold uppercase text-slate-400">Prepaid Razorpay</p>
              <p className="text-base font-extrabold text-[#2874F0] font-mono tabular-nums">
                {formatINR(ledger.allActivePrepaidTotal)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase text-amber-700">Rider COD Held</p>
              <p className="text-base font-extrabold text-amber-700 font-mono tabular-nums">
                {formatINR(ledger.pendingCodWithRiders)}
              </p>
            </div>
          </div>
          <p className="text-[11px] text-slate-500">
            Delivered COD: <strong className="font-mono">{formatINR(ledger.deliveredCodTotal)}</strong> · Handed Over:{' '}
            <strong className="font-mono text-[#2E7D32]">{formatINR(ledger.totalCodHandedOver)}</strong>
          </p>
        </div>
      </div>

      {/* 2. Seller Payout Requests & Settlement Queue */}
      <section className="bg-white rounded-xl border border-slate-200/80 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/70">
          <div>
            <h2 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
              <i className="fa-solid fa-wallet text-[#2874F0]"></i>
              <span>Seller Payout Requests &amp; Settlement</span>
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Verify seller UPI/Bank details, enter Bank UTR / Transaction Ref ID, and mark Paid ✓
            </p>
          </div>

          <div className="inline-flex items-center p-1 rounded-lg bg-slate-200/70 text-xs font-bold">
            <button
              type="button"
              onClick={() => setPayoutSubTab('pending')}
              className={`px-3 py-1.5 rounded-md transition inline-flex items-center gap-1.5 ${
                payoutSubTab === 'pending'
                  ? 'bg-white text-[#2874F0] shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Pending Requests</span>
              {pendingRequests.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 text-[10px] font-extrabold tabular-nums">
                  {pendingRequests.length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setPayoutSubTab('settled')}
              className={`px-3 py-1.5 rounded-md transition ${
                payoutSubTab === 'settled'
                  ? 'bg-white text-[#2874F0] shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Settled ({settledRequests.length})
            </button>
            <button
              type="button"
              onClick={() => setPayoutSubTab('sellers')}
              className={`px-3 py-1.5 rounded-md transition ${
                payoutSubTab === 'sellers'
                  ? 'bg-white text-[#2874F0] shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Seller Balances
            </button>
          </div>
        </div>

        {payoutSubTab === 'pending' && (
          <div className="divide-y divide-slate-100">
            {pendingRequests.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                <i className="fa-solid fa-circle-check text-2xl text-emerald-400 mb-2 block"></i>
                No pending seller payout requests right now.
              </div>
            ) : (
              pendingRequests.map(({ request, seller }) => {
                const key = request.id;
                return (
                  <div
                    key={key}
                    className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-50/50 transition"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900">
                          {request.id}
                        </span>
                        <p className="text-sm font-extrabold text-slate-900 truncate">
                          {request.storeName}
                        </p>
                        <span className="text-xs text-slate-500">({request.ownerName})</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                        <span>
                          <i className="fa-solid fa-building-columns text-[#2874F0] mr-1.5"></i>
                          <strong className="font-mono text-slate-900 select-text">
                            {request.payoutAccount || seller?.payoutAccount || 'UPI/Bank not set'}
                          </strong>
                        </span>
                        <span>
                          <i className="fa-regular fa-clock text-slate-400 mr-1"></i>
                          {formatShortDate(request.requestedAt)}
                        </span>
                        {request.phone && (
                          <span className="font-mono text-slate-500">+91 {request.phone}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 shrink-0">
                      <div className="sm:text-right sm:mr-1">
                        <p className="text-[10px] font-bold uppercase text-slate-400">Requested</p>
                        <p className="text-lg font-extrabold font-mono text-[#2E7D32] tabular-nums">
                          {formatINR(request.amount)}
                        </p>
                      </div>
                      <input
                        type="text"
                        value={utrByKey[key] || ''}
                        onChange={(e) =>
                          setUtrByKey((prev) => ({ ...prev, [key]: e.target.value }))
                        }
                        placeholder="Enter UTR / Txn Ref ID"
                        className="h-10 w-full sm:w-52 px-3 rounded-lg bg-slate-50 border border-slate-300 text-xs font-mono font-semibold text-slate-900 focus:bg-white focus:border-[#2874F0] focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          handleSettlePayoutClick(
                            key,
                            seller,
                            request.amount,
                            request.payoutAccount || seller?.payoutAccount || '',
                            request.id
                          )
                        }
                        className="h-10 px-4 rounded-lg bg-[#2E7D32] hover:bg-emerald-800 text-white text-xs font-extrabold whitespace-nowrap transition inline-flex items-center justify-center gap-1.5"
                      >
                        <i className="fa-solid fa-check"></i>
                        <span>Paid ✓</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {payoutSubTab === 'settled' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Request ID</th>
                  <th className="py-3 px-4">Seller Store</th>
                  <th className="py-3 px-4">UPI / Bank Account</th>
                  <th className="py-3 px-4">UTR / Ref ID</th>
                  <th className="py-3 px-4 text-right">Amount Paid</th>
                  <th className="py-3 px-4 text-right">Settled On</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {settledRequests.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">
                      No settled payouts logged yet.
                    </td>
                  </tr>
                ) : (
                  settledRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-mono font-bold text-slate-700">{req.id}</td>
                      <td className="py-3 px-4">
                        <p className="font-bold text-slate-900">{req.storeName}</p>
                        <p className="text-[11px] text-slate-500">{req.ownerName}</p>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-700">{req.payoutAccount}</td>
                      <td className="py-3 px-4">
                        {req.utrNumber ? (
                          <span className="px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 font-mono font-bold text-[#2E7D32]">
                            {req.utrNumber}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-extrabold text-[#2E7D32] tabular-nums">
                        {formatINR(req.amount)}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-500 whitespace-nowrap">
                        {formatShortDate(req.paidAt || req.requestedAt)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {payoutSubTab === 'sellers' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Seller &amp; UPI/Bank</th>
                  <th className="py-3 px-4 text-right">Delivered Sales</th>
                  <th className="py-3 px-4 text-right">10% Fee</th>
                  <th className="py-3 px-4 text-right">90% Net Earned</th>
                  <th className="py-3 px-4 text-right">Paid Out</th>
                  <th className="py-3 px-4 text-right">Available + Pending</th>
                  <th className="py-3 px-4 text-right">Direct Settle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ledger.sellerRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500">
                      No registered sellers yet.
                    </td>
                  </tr>
                ) : (
                  ledger.sellerRows.map(({ seller, deliveredSellerOrders, earnings }) => {
                    const settleAmt = roundMoney(
                      earnings.pendingPayout > 0
                        ? earnings.pendingPayout
                        : earnings.withdrawableBalance
                    );
                    const key = `seller_${seller.docId || seller.id}`;
                    const statusNorm = normalizeSellerStatus(seller.status);
                    return (
                      <tr key={key} className="hover:bg-slate-50/70">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5">
                            <p className="font-bold text-slate-900">{seller.storeName}</p>
                            <span
                              className={`px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase ${
                                statusNorm === 'approved'
                                  ? 'bg-emerald-50 text-[#2E7D32]'
                                  : 'bg-slate-100 text-slate-500'
                              }`}
                            >
                              {statusNorm}
                            </span>
                          </div>
                          <p className="text-[11px] font-mono text-slate-500">
                            {seller.payoutAccount || 'UPI/Bank not added'}
                          </p>
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-800 tabular-nums">
                          <div>{formatINR(earnings.grossDelivered)}</div>
                          <div className="text-[10px] text-slate-400">
                            {deliveredSellerOrders} delivered
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-rose-600 tabular-nums">
                          -{formatINR(earnings.platformFee)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 tabular-nums">
                          {formatINR(earnings.netEarnings)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-[#2E7D32] font-bold tabular-nums">
                          {formatINR(earnings.totalPaidOut)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-extrabold text-amber-800 tabular-nums">
                          {formatINR(earnings.withdrawableBalance + earnings.pendingPayout)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {settleAmt > 0 ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <input
                                type="text"
                                value={utrByKey[key] || ''}
                                onChange={(e) =>
                                  setUtrByKey((prev) => ({ ...prev, [key]: e.target.value }))
                                }
                                placeholder="UTR / Ref"
                                className="h-8 w-28 px-2 rounded bg-slate-50 border border-slate-300 text-[11px] font-mono"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  handleSettlePayoutClick(
                                    key,
                                    seller,
                                    settleAmt,
                                    seller.payoutAccount || 'Registered UPI/Bank'
                                  )
                                }
                                className="h-8 px-2.5 rounded bg-[#2E7D32] hover:bg-emerald-800 text-white text-[11px] font-bold whitespace-nowrap"
                              >
                                Paid ✓
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] font-semibold text-slate-400">Settled</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 3. Delivery Partner COD Cash Collection & Handover Ledger */}
      <section className="bg-white rounded-xl border border-slate-200/80 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 bg-slate-50/70">
          <div>
            <h2 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
              <i className="fa-solid fa-motorcycle text-[#FB641B]"></i>
              <span>Delivery Partner COD Cash Collection &amp; Handover Ledger</span>
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Track exact COD cash collected per rider and reconcile cash handovers to reset pending balance
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="px-2.5 py-1 rounded-md bg-amber-50 border border-amber-200 font-bold text-amber-900">
              Pending Cash: <strong className="font-mono">{formatINR(ledger.pendingCodWithRiders)}</strong>
            </span>
            <span className="px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200 font-bold text-[#2E7D32]">
              Handed Over: <strong className="font-mono">{formatINR(ledger.totalCodHandedOver)}</strong>
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Delivery Partner</th>
                <th className="py-3 px-4 text-right">Delivered COD Orders</th>
                <th className="py-3 px-4 text-right">Total Settled</th>
                <th className="py-3 px-4 text-right">Pending Cash in Hand</th>
                <th className="py-3 px-4 text-right">COD Cash Handover</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {riderCodRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    No approved delivery partners with COD activity yet.
                  </td>
                </tr>
              ) : (
                riderCodRows.map(({ rider, codDeliveredCount, codDeliveredVolume, pendingCash, totalSettled }) => {
                  const riderKey = rider.docId || rider.id;
                  return (
                    <tr key={riderKey} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4">
                        <p className="font-extrabold text-slate-900">
                          {rider.name}{' '}
                          <span className="font-mono text-[11px] font-semibold text-slate-500">
                            ({rider.riderId})
                          </span>
                        </p>
                        <p className="text-[11px] text-slate-500">
                          +91 {rider.phone}
                          {rider.areaPincode ? ` · Pincode ${rider.areaPincode}` : ''}
                        </p>
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">
                        <p className="font-bold text-slate-900">{formatINR(codDeliveredVolume)}</p>
                        <p className="text-[10px] text-slate-400">
                          {codDeliveredCount} COD deliver{codDeliveredCount === 1 ? 'y' : 'ies'}
                        </p>
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">
                        <p className="font-bold text-[#2E7D32]">{formatINR(totalSettled)}</p>
                        {rider.lastCashSettledAt && (
                          <p className="text-[10px] text-slate-400">
                            Last: {new Date(rider.lastCashSettledAt).toLocaleDateString('en-IN')}
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-md font-mono font-extrabold tabular-nums ${
                            pendingCash > 0
                              ? 'bg-amber-100 text-amber-900'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {formatINR(pendingCash)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {pendingCash > 0 ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <input
                              type="text"
                              value={handoverNoteByRider[riderKey] || ''}
                              onChange={(e) =>
                                setHandoverNoteByRider((prev) => ({
                                  ...prev,
                                  [riderKey]: e.target.value,
                                }))
                              }
                              placeholder="Receipt / Note (opt.)"
                              className="h-8 w-32 px-2 rounded bg-slate-50 border border-slate-300 text-[11px]"
                            />
                            <button
                              type="button"
                              onClick={() => handleRiderHandoverClick(rider, pendingCash)}
                              className="h-8 px-3 rounded-lg bg-[#2E7D32] hover:bg-emerald-800 text-white text-[11px] font-extrabold whitespace-nowrap transition inline-flex items-center gap-1"
                            >
                              <i className="fa-solid fa-hand-holding-dollar"></i>
                              <span>Settled ✓</span>
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] font-bold text-[#2E7D32] inline-flex items-center gap-1">
                            <i className="fa-solid fa-circle-check"></i>
                            <span>Settled</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
