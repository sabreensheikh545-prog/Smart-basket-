import React, { useEffect, useMemo, useState } from 'react';
import {
  authenticateDeliveryBoyFirestore,
  markOrderOutForDeliveryFirestore,
  subscribeRiderOrdersFirestore,
  verifyAndDeliverOrderFirestore,
} from '../services/firestoreService';
import { setStoredCurrentRider } from '../store/localStore';
import {
  DeliveryBoy,
  Order,
  extractPincodeFromAddress,
  formatINR,
  getOrderDeliveryStage,
  isOnlinePaidOrder,
} from '../types';

interface Props {
  currentRider: DeliveryBoy | null;
  onRiderChange: (rider: DeliveryBoy | null) => void;
  onExitRider: () => void;
  onRefresh: () => void;
  showLoader: (text?: string) => void;
  hideLoader: () => void;
  showModal: (opts: {
    title: string;
    message: string;
    type?: 'info' | 'success' | 'error';
    onConfirm?: () => void;
    confirmText?: string;
  }) => void;
}

export const RiderView: React.FC<Props> = ({
  currentRider,
  onRiderChange,
  onExitRider,
  onRefresh,
  showLoader,
  hideLoader,
  showModal,
}) => {
  // Login state
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);

  // Dashboard state
  const [riderOrders, setRiderOrders] = useState<Order[]>([]);
  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');

  // OTP Verification Modal state
  const [otpModalOrder, setOtpModalOrder] = useState<Order | null>(null);
  const [otpInput, setOtpInput] = useState('');
  const [otpError, setOtpError] = useState('');
  const [otpBusy, setOtpBusy] = useState(false);

  useEffect(() => {
    if (!currentRider) {
      setRiderOrders([]);
      return;
    }
    const unsub = subscribeRiderOrdersFirestore(
      currentRider,
      (list) => setRiderOrders(list),
      () => {
        // Offline local cache fallback is handled automatically inside subscribeRiderOrdersFirestore
      }
    );
    return () => unsub();
  }, [currentRider]);

  const activeDeliveries = useMemo(
    () =>
      riderOrders.filter(
        (o) =>
          o.status !== 'Delivered' &&
          o.status !== 'Cancelled' &&
          o.status !== 'Return Requested' &&
          o.status !== 'Return Approved' &&
          o.status !== 'Refunded'
      ),
    [riderOrders]
  );

  const completedDeliveries = useMemo(
    () =>
      riderOrders.filter(
        (o) =>
          o.status === 'Delivered' ||
          o.status === 'Return Requested' ||
          o.status === 'Return Approved' ||
          o.status === 'Refunded'
      ),
    [riderOrders]
  );

  const codToCollectTotal = useMemo(
    () =>
      activeDeliveries
        .filter((o) => !isOnlinePaidOrder(o))
        .reduce((sum, o) => sum + Number(o.total_amount || 0), 0),
    [activeDeliveries]
  );

  const handleRiderLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loginBusy) return;
    setLoginError('');
    setLoginBusy(true);
    showLoader('Signing in to Delivery Partner Hub...');
    try {
      const res = await authenticateDeliveryBoyFirestore(identifier, password);
      if (!res.success || !res.rider) {
        setLoginError(res.message);
        return;
      }
      onRiderChange(res.rider);
      setIdentifier('');
      setPassword('');
    } finally {
      hideLoader();
      setLoginBusy(false);
    }
  };

  const handleRiderLogout = () => {
    setStoredCurrentRider(null);
    onRiderChange(null);
    setRiderOrders([]);
    setOtpModalOrder(null);
  };

  const handleMarkOutForDelivery = async (order: Order) => {
    showLoader('Updating delivery status...');
    const res = await markOrderOutForDeliveryFirestore(order);
    hideLoader();
    if (res.success) {
      setRiderOrders((prev) =>
        prev.map((o) =>
          o.id === order.id
            ? { ...o, status: 'Out for Delivery', deliveryOutForDeliveryAt: new Date().toISOString() }
            : o
        )
      );
      onRefresh();
      showModal({
        title: 'Out for Delivery',
        message: res.message,
        type: 'success',
      });
    } else {
      showModal({ title: 'Error', message: res.message, type: 'error' });
    }
  };

  const openOtpVerificationModal = (order: Order) => {
    setOtpModalOrder(order);
    setOtpInput('');
    setOtpError('');
  };

  const handleVerifyAndDeliver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpModalOrder || otpBusy) return;
    setOtpError('');
    setOtpBusy(true);
    showLoader('Verifying Delivery OTP...');
    try {
      const res = await verifyAndDeliverOrderFirestore(otpModalOrder, otpInput);
      if (!res.success) {
        setOtpError(res.message);
        return;
      }
      const deliveredId = otpModalOrder.id;
      setRiderOrders((prev) =>
        prev.map((o) =>
          o.id === deliveredId
            ? {
                ...o,
                status: 'Delivered',
                deliveryOtpVerified: true,
                deliveredAt: new Date().toISOString(),
              }
            : o
        )
      );
      setOtpModalOrder(null);
      setOtpInput('');
      onRefresh();
      showModal({
        title: 'Delivery Verified',
        message: res.message,
        type: 'success',
      });
    } finally {
      hideLoader();
      setOtpBusy(false);
    }
  };

  // ============================================================================
  // RIDER LOGIN SCREEN
  // ============================================================================
  if (!currentRider) {
    return (
      <div className="min-h-screen bg-[#F1F3F6] flex flex-col">
        <header className="sticky top-0 z-40 bg-[#2874F0] text-white shadow-sm">
          <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-lg font-extrabold italic tracking-tight">
                Smart <span className="text-[#FFE500]">Basket</span>
              </span>
              <span className="px-2 py-0.5 rounded bg-white/15 text-[10px] font-extrabold uppercase tracking-wider">
                Delivery Partner
              </span>
            </div>
            <button
              type="button"
              onClick={onExitRider}
              className="px-3 py-1.5 rounded-lg bg-white text-[#2874F0] text-xs font-bold hover:bg-blue-50 transition whitespace-nowrap"
            >
              <i className="fa-solid fa-arrow-left mr-1.5"></i>Storefront
            </button>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden">
            <div className="bg-[#2874F0] px-6 py-6 text-white">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h1 className="text-xl font-extrabold tracking-tight">Delivery Partner Login</h1>
                  <p className="mt-1 text-xs text-blue-100 leading-relaxed">
                    Sign in with the Rider ID or Email &amp; Password created by Smart Basket Admin
                  </p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-[#FFE500] text-[#2874F0] flex items-center justify-center shrink-0 shadow-xs">
                  <i className="fa-solid fa-motorcycle text-xl"></i>
                </div>
              </div>
            </div>

            <div className="p-6">
              {loginError && (
                <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-start gap-2">
                  <i className="fa-solid fa-circle-exclamation mt-0.5 shrink-0"></i>
                  <span>{loginError}</span>
                </div>
              )}

              <form onSubmit={handleRiderLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Rider ID, Email, or Phone Number
                  </label>
                  <input
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    required
                    placeholder="e.g. SB-RIDER-101 or rider@smartbasket.in"
                    className="w-full h-11 px-3.5 rounded-xl bg-slate-50 border border-slate-300 text-sm font-medium text-slate-900 placeholder-slate-400 focus:bg-white focus:border-[#2874F0] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      placeholder="Enter your rider password"
                      className="w-full h-11 pl-3.5 pr-11 rounded-xl bg-slate-50 border border-slate-300 text-sm font-medium text-slate-900 placeholder-slate-400 focus:bg-white focus:border-[#2874F0] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-0 top-0 h-11 w-11 flex items-center justify-center text-slate-400 hover:text-slate-700"
                    >
                      <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'} text-sm`}></i>
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loginBusy}
                  className="w-full h-12 rounded-xl bg-[#FB641B] text-white text-sm font-extrabold hover:bg-[#e55812] disabled:opacity-60 transition flex items-center justify-center gap-2"
                >
                  <i className="fa-solid fa-motorcycle"></i>
                  <span>{loginBusy ? 'Signing In...' : 'Sign In as Delivery Partner'}</span>
                </button>
              </form>

              <div className="mt-5 p-3.5 rounded-xl bg-blue-50/70 border border-blue-100 text-[11px] text-slate-600 leading-relaxed">
                <p className="font-bold text-[#2874F0] mb-0.5">
                  <i className="fa-solid fa-circle-info mr-1"></i>How Rider Access Works
                </p>
                Admin adds delivery boys in <strong>Admin Panel → Delivery Boys</strong> and assigns active orders. Once logged in, you&apos;ll see only your assigned deliveries with customer navigation, COD collection amount, and OTP delivery verification.
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ============================================================================
  // RIDER DASHBOARD (LOGGED IN)
  // ============================================================================
  const displayedOrders = activeTab === 'active' ? activeDeliveries : completedDeliveries;

  return (
    <div className="min-h-screen bg-[#F1F3F6] pb-12">
      {/* Rider Top Header */}
      <header className="sticky top-0 z-40 bg-[#2874F0] text-white shadow-sm">
        <div className="max-w-5xl mx-auto px-3 sm:px-4 h-14 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#FFE500] text-[#2874F0] flex items-center justify-center shrink-0">
              <i className="fa-solid fa-motorcycle text-base"></i>
            </div>
            <div className="min-w-0 leading-tight">
              <p className="text-sm sm:text-base font-extrabold tracking-tight truncate">
                Smart <span className="text-[#FFE500]">Basket</span> Rider
              </p>
              <p className="text-[11px] text-blue-100 truncate">
                {currentRider.name} · <span className="font-mono font-bold">{currentRider.riderId}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onExitRider}
              className="px-2.5 sm:px-3 py-1.5 rounded-lg bg-white/15 text-white text-xs font-bold hover:bg-white/25 transition whitespace-nowrap"
            >
              <i className="fa-solid fa-store sm:mr-1.5"></i>
              <span className="hidden sm:inline">Store</span>
            </button>
            <button
              type="button"
              onClick={handleRiderLogout}
              className="px-2.5 sm:px-3 py-1.5 rounded-lg bg-white text-rose-600 text-xs font-extrabold hover:bg-rose-50 transition whitespace-nowrap"
            >
              <i className="fa-solid fa-right-from-bracket sm:mr-1.5"></i>
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-3 sm:px-4 py-5 space-y-5">
        {/* Rider Profile & Shift Metrics */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 space-y-4 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-12 h-12 rounded-full bg-blue-50 border border-blue-200 text-[#2874F0] font-extrabold text-lg flex items-center justify-center shrink-0">
                {currentRider.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-base sm:text-lg font-extrabold text-slate-900 truncate">
                    {currentRider.name}
                  </h1>
                  <span className="px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-[#2E7D32] text-[10px] font-extrabold uppercase tracking-wide">
                    <i className="fa-solid fa-circle text-[7px] mr-1 align-middle"></i>
                    {currentRider.status === 'active' ? 'On Duty · Active' : 'Inactive'}
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                  <span className="font-mono font-semibold text-slate-700">
                    ID: {currentRider.riderId}
                  </span>
                  <span>
                    <i className="fa-solid fa-phone text-[10px] mr-1 text-slate-400"></i>
                    +91 {currentRider.phone}
                  </span>
                  {currentRider.vehicleArea && (
                    <span>
                      <i className="fa-solid fa-route text-[10px] mr-1 text-slate-400"></i>
                      {currentRider.vehicleArea}
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2.5 sm:gap-3.5">
            <div className="rounded-xl bg-blue-50/70 border border-blue-100 p-3">
              <p className="text-[11px] font-semibold text-slate-600">Active Deliveries</p>
              <p className="mt-0.5 text-xl font-extrabold text-[#2874F0] font-mono tabular-nums">
                {activeDeliveries.length}
              </p>
            </div>
            <div className="rounded-xl bg-emerald-50/70 border border-emerald-100 p-3">
              <p className="text-[11px] font-semibold text-slate-600">Completed</p>
              <p className="mt-0.5 text-xl font-extrabold text-[#2E7D32] font-mono tabular-nums">
                {completedDeliveries.length}
              </p>
            </div>
            <div className="rounded-xl bg-amber-50/80 border border-amber-200 p-3">
              <p className="text-[11px] font-semibold text-amber-900">COD to Collect</p>
              <p className="mt-0.5 text-lg sm:text-xl font-extrabold text-amber-900 font-mono tabular-nums truncate">
                {formatINR(codToCollectTotal)}
              </p>
            </div>
          </div>
        </div>

        {/* Active vs Completed Tabs */}
        <div className="grid grid-cols-2 p-1 bg-slate-200/80 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveTab('active')}
            className={`py-2.5 px-3 text-xs sm:text-sm font-extrabold rounded-lg transition flex items-center justify-center gap-2 ${
              activeTab === 'active'
                ? 'bg-white text-[#2874F0] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <i className="fa-solid fa-box-open"></i>
            <span>Active Deliveries ({activeDeliveries.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('completed')}
            className={`py-2.5 px-3 text-xs sm:text-sm font-extrabold rounded-lg transition flex items-center justify-center gap-2 ${
              activeTab === 'completed'
                ? 'bg-white text-[#2E7D32] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <i className="fa-solid fa-circle-check"></i>
            <span>Completed Deliveries ({completedDeliveries.length})</span>
          </button>
        </div>

        {/* Delivery Cards List */}
        {displayedOrders.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-10 text-center space-y-2.5">
            <div className="w-14 h-14 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <i
                className={`fa-solid ${
                  activeTab === 'active' ? 'fa-motorcycle' : 'fa-clipboard-check'
                } text-2xl`}
              ></i>
            </div>
            <h2 className="text-base font-extrabold text-slate-800">
              {activeTab === 'active'
                ? 'No Active Deliveries Assigned'
                : 'No Completed Deliveries Yet'}
            </h2>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {activeTab === 'active'
                ? 'When Smart Basket Admin assigns orders to you, they will appear here automatically in real time.'
                : 'Orders you verify via the customer’s 4-digit Delivery OTP will be listed here.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {displayedOrders.map((ord) => {
              const onlinePaid = isOnlinePaidOrder(ord);
              const pincode = extractPincodeFromAddress(ord.address, ord.pincode);
              const deliveryStage = getOrderDeliveryStage(ord) || 'Assigned';
              const isOutForDelivery = ord.status === 'Out for Delivery';
              const isCompleted = activeTab === 'completed';
              const cleanCustomerPhone = (ord.phone || '').replace(/\D/g, '').slice(-10);
              const mapDestination = encodeURIComponent(
                pincode && !ord.address.includes(pincode)
                  ? `${ord.address}, ${pincode}, India`
                  : `${ord.address}, India`
              );
              const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${mapDestination}`;

              return (
                <article
                  key={ord.docId || ord.id}
                  className={`bg-white rounded-2xl border overflow-hidden shadow-2xs flex flex-col justify-between ${
                    isOutForDelivery
                      ? 'border-[#2874F0]/60 ring-1 ring-blue-100'
                      : 'border-slate-200/90'
                  }`}
                >
                  <div className="p-4 sm:p-5 space-y-3.5">
                    {/* Card Top: Order ID + Status Pill */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-extrabold text-slate-900">
                            Order #{ord.id}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            {new Date(ord.created_at).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                            })}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {ord.items.reduce((sum, it) => sum + Number(it.quantity || 1), 0)} item(s)
                        </p>
                      </div>
                      <span
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold uppercase tracking-wide inline-flex items-center gap-1.5 shrink-0 ${
                          deliveryStage === 'Delivered'
                            ? 'bg-emerald-50 border border-emerald-200 text-[#2E7D32]'
                            : deliveryStage === 'Out for Delivery'
                            ? 'bg-blue-50 border border-blue-200 text-[#2874F0]'
                            : 'bg-amber-50 border border-amber-200 text-amber-800'
                        }`}
                      >
                        <i
                          className={`fa-solid ${
                            deliveryStage === 'Delivered'
                              ? 'fa-circle-check'
                              : deliveryStage === 'Out for Delivery'
                              ? 'fa-motorcycle'
                              : 'fa-clipboard-list'
                          } text-[10px]`}
                        ></i>
                        <span>{deliveryStage}</span>
                      </span>
                    </div>

                    {/* Prominent Payment Collection Badge */}
                    {onlinePaid ? (
                      <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-8 h-8 rounded-lg bg-[#2E7D32] text-white flex items-center justify-center shrink-0">
                            <i className="fa-solid fa-check-double text-xs"></i>
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs font-extrabold text-[#1B5E20] tracking-wide">
                              PAID ONLINE
                            </p>
                            <p className="text-[11px] font-semibold text-emerald-800">
                              ₹0 to collect · Hand over after OTP verification
                            </p>
                          </div>
                        </div>
                        <span className="font-mono text-sm font-extrabold text-[#2E7D32] shrink-0">
                          ₹0
                        </span>
                      </div>
                    ) : (
                      <div className="p-3 rounded-xl bg-amber-50 border-2 border-amber-300 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-8 h-8 rounded-lg bg-[#FB641B] text-white flex items-center justify-center shrink-0">
                            <i className="fa-solid fa-indian-rupee-sign text-xs"></i>
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs font-extrabold text-amber-950 tracking-wide">
                              COLLECT CASH (COD): {formatINR(ord.total_amount)}
                            </p>
                            <p className="text-[11px] font-semibold text-amber-800">
                              Collect cash before confirming Delivery OTP
                            </p>
                          </div>
                        </div>
                        <span className="font-mono text-sm font-extrabold text-amber-950 shrink-0 tabular-nums">
                          {formatINR(ord.total_amount)}
                        </span>
                      </div>
                    )}

                    {/* Customer Name, Full Address & Pincode */}
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-extrabold text-slate-900 flex items-center gap-2 min-w-0">
                          <i className="fa-solid fa-user text-[#2874F0] text-xs shrink-0"></i>
                          <span className="truncate">{ord.name}</span>
                        </p>
                        {pincode && (
                          <span className="px-2 py-0.5 rounded bg-white border border-slate-200 font-mono text-[11px] font-extrabold text-slate-800 shrink-0">
                            PIN: {pincode}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-700 leading-relaxed flex items-start gap-2">
                        <i className="fa-solid fa-location-dot text-rose-500 text-xs mt-0.5 shrink-0"></i>
                        <span className="select-text">{ord.address}</span>
                      </p>
                      <p className="text-xs font-mono font-semibold text-slate-600 flex items-center gap-2">
                        <i className="fa-solid fa-phone text-[#2E7D32] text-[11px] shrink-0"></i>
                        <span>{ord.phone || 'Phone not provided'}</span>
                      </p>
                    </div>

                    {/* Items Preview */}
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                        Parcel Contents
                      </p>
                      <div className="space-y-1">
                        {ord.items.map((it) => (
                          <div
                            key={it.id}
                            className="flex items-center justify-between gap-2 text-xs text-slate-700"
                          >
                            <span className="truncate font-medium">
                              {it.product_name}
                            </span>
                            <span className="font-mono font-bold text-slate-900 shrink-0">
                              × {it.quantity}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Direct Call Customer & Open in Google Maps Buttons */}
                    <div className="grid grid-cols-2 gap-2.5 pt-1">
                      <a
                        href={cleanCustomerPhone ? `tel:+91${cleanCustomerPhone}` : `tel:${ord.phone}`}
                        className="h-10 px-3 rounded-xl bg-emerald-50 border border-emerald-200 text-[#1B5E20] text-xs font-extrabold hover:bg-emerald-100 transition flex items-center justify-center gap-1.5"
                      >
                        <i className="fa-solid fa-phone"></i>
                        <span>Call Customer</span>
                      </a>
                      <a
                        href={googleMapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="h-10 px-3 rounded-xl bg-blue-50 border border-blue-200 text-[#2874F0] text-xs font-extrabold hover:bg-blue-100 transition flex items-center justify-center gap-1.5"
                      >
                        <i className="fa-solid fa-map-location-dot"></i>
                        <span>Open in Google Maps</span>
                      </a>
                    </div>
                  </div>

                  {/* Card Footer: Status Action Buttons */}
                  {!isCompleted ? (
                    <div className="px-4 sm:px-5 py-3.5 bg-slate-50 border-t border-slate-200/80 grid grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => handleMarkOutForDelivery(ord)}
                        disabled={isOutForDelivery}
                        className={`h-11 px-3 rounded-xl text-xs font-extrabold transition flex items-center justify-center gap-1.5 ${
                          isOutForDelivery
                            ? 'bg-blue-100 text-[#2874F0] border border-blue-200 cursor-default'
                            : 'bg-[#2874F0] text-white hover:bg-[#1e60d5]'
                        }`}
                      >
                        <i
                          className={`fa-solid ${
                            isOutForDelivery ? 'fa-check' : 'fa-motorcycle'
                          }`}
                        ></i>
                        <span>
                          {isOutForDelivery ? 'Out for Delivery' : 'Out for Delivery'}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => openOtpVerificationModal(ord)}
                        className="h-11 px-3 rounded-xl bg-[#2E7D32] text-white text-xs font-extrabold hover:bg-emerald-800 transition flex items-center justify-center gap-1.5 shadow-2xs"
                      >
                        <i className="fa-solid fa-shield-check"></i>
                        <span>Mark Delivered</span>
                      </button>
                    </div>
                  ) : (
                    <div className="px-4 sm:px-5 py-3 bg-emerald-50/70 border-t border-emerald-100 flex items-center justify-between text-xs">
                      <span className="font-extrabold text-[#1B5E20] inline-flex items-center gap-1.5">
                        <i className="fa-solid fa-circle-check"></i>
                        <span>
                          {ord.deliveryOtpVerified
                            ? 'Delivered · 4-Digit OTP Verified'
                            : 'Delivery Completed'}
                        </span>
                      </span>
                      {ord.deliveredAt && (
                        <span className="text-[11px] text-emerald-800 font-mono">
                          {new Date(ord.deliveredAt).toLocaleString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </main>

      {/* 4-Digit Delivery OTP Verification Modal */}
      {otpModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="bg-[#2E7D32] px-5 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <i className="fa-solid fa-key text-[#FFE500]"></i>
                <div>
                  <h2 className="text-sm font-extrabold">Verify Delivery OTP</h2>
                  <p className="text-[11px] text-emerald-100 font-mono">
                    Order #{otpModalOrder.id} · {otpModalOrder.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOtpModalOrder(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white hover:bg-white/15"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <form onSubmit={handleVerifyAndDeliver} className="p-5 space-y-4">
              {isOnlinePaidOrder(otpModalOrder) ? (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-[#1B5E20] flex items-center gap-2">
                  <i className="fa-solid fa-circle-check"></i>
                  <span>PAID ONLINE — ₹0 cash to collect from customer.</span>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-xs font-extrabold text-amber-950 flex items-center gap-2">
                  <i className="fa-solid fa-indian-rupee-sign text-[#FB641B]"></i>
                  <span>
                    Collect Cash (COD): {formatINR(otpModalOrder.total_amount)} before completing delivery.
                  </span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Ask customer for their 4-digit Delivery OTP
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  autoFocus
                  value={otpInput}
                  onChange={(e) => {
                    setOtpError('');
                    setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 4));
                  }}
                  placeholder="• • • •"
                  className="w-full h-14 px-4 rounded-xl bg-slate-50 border-2 border-slate-300 text-center text-2xl font-mono font-extrabold tracking-[0.55em] text-slate-900 focus:bg-white focus:border-[#2E7D32] focus:outline-none"
                />
              </div>

              {otpError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-start gap-2">
                  <i className="fa-solid fa-circle-exclamation mt-0.5 shrink-0"></i>
                  <span>{otpError}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setOtpModalOrder(null)}
                  className="h-11 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={otpBusy || otpInput.length !== 4}
                  className="h-11 rounded-xl bg-[#2E7D32] text-white text-xs font-extrabold hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-1.5"
                >
                  <i className="fa-solid fa-check-circle"></i>
                  <span>{otpBusy ? 'Verifying...' : 'Confirm Delivery'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
