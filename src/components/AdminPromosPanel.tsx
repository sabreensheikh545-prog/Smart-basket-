import React, { useEffect, useState } from 'react';
import {
  deletePromoCodeFirestore,
  saveDeliverySettingsFirestore,
  savePromoCodeFirestore,
  togglePromoCodeActiveFirestore,
} from '../services/firestoreService';
import { DeliverySettings, PromoCode, formatINR } from '../types';

interface Props {
  deliverySettings: DeliverySettings;
  promoCodes: PromoCode[];
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

export const AdminPromosPanel: React.FC<Props> = ({
  deliverySettings,
  promoCodes,
  showLoader,
  hideLoader,
  showModal,
}) => {
  // Delivery Threshold & Charges form
  const [threshold, setThreshold] = useState(String(deliverySettings.freeDeliveryThreshold));
  const [deliveryCharge, setDeliveryCharge] = useState(String(deliverySettings.deliveryCharge));
  const [platformFee, setPlatformFee] = useState(String(deliverySettings.platformFee));

  useEffect(() => {
    setThreshold(String(deliverySettings.freeDeliveryThreshold));
    setDeliveryCharge(String(deliverySettings.deliveryCharge));
    setPlatformFee(String(deliverySettings.platformFee));
  }, [deliverySettings]);

  // Promo Code create/edit form
  const [editingDocId, setEditingDocId] = useState<string | undefined>(undefined);
  const [code, setCode] = useState('');
  const [discountType, setDiscountType] = useState<'flat' | 'percent'>('flat');
  const [discountValue, setDiscountValue] = useState('50');
  const [maxDiscount, setMaxDiscount] = useState('');
  const [minOrderValue, setMinOrderValue] = useState('299');
  const [description, setDescription] = useState('');
  const [active, setActive] = useState(true);

  const handleSaveDeliverySettings = async (e: React.FormEvent) => {
    e.preventDefault();
    showLoader('Updating delivery settings...');
    const res = await saveDeliverySettingsFirestore({
      freeDeliveryThreshold: Math.max(0, Math.round(Number(threshold) || 0)),
      deliveryCharge: Math.max(0, Math.round(Number(deliveryCharge) || 0)),
      platformFee: Math.max(0, Math.round(Number(platformFee) || 0)),
    });
    hideLoader();
    showModal({
      title: res.success ? 'Delivery Rules Updated' : 'Update Failed',
      message: res.message,
      type: res.success ? 'success' : 'error',
    });
  };

  const resetPromoForm = () => {
    setEditingDocId(undefined);
    setCode('');
    setDiscountType('flat');
    setDiscountValue('50');
    setMaxDiscount('');
    setMinOrderValue('299');
    setDescription('');
    setActive(true);
  };

  const startEditPromo = (promo: PromoCode) => {
    setEditingDocId(promo.docId || promo.code);
    setCode(promo.code);
    setDiscountType(promo.discountType);
    setDiscountValue(String(promo.discountValue));
    setMaxDiscount(promo.maxDiscount ? String(promo.maxDiscount) : '');
    setMinOrderValue(String(promo.minOrderValue));
    setDescription(promo.description || '');
    setActive(promo.active);
  };

  const handleSavePromo = async (e: React.FormEvent) => {
    e.preventDefault();
    showLoader('Saving promo code...');
    const res = await savePromoCodeFirestore({
      docId: editingDocId,
      code,
      discountType,
      discountValue: Number(discountValue),
      maxDiscount: maxDiscount ? Number(maxDiscount) : undefined,
      minOrderValue: Number(minOrderValue),
      description,
      active,
    });
    hideLoader();
    if (res.success) {
      resetPromoForm();
      showModal({ title: 'Promo Code Saved', message: res.message, type: 'success' });
    } else {
      showModal({ title: 'Validation Error', message: res.message, type: 'error' });
    }
  };

  const handleTogglePromo = async (promo: PromoCode) => {
    showLoader('Updating coupon status...');
    const res = await togglePromoCodeActiveFirestore(promo);
    hideLoader();
    if (!res.success) {
      showModal({ title: 'Error', message: res.message, type: 'error' });
    }
  };

  const handleDeletePromo = (promo: PromoCode) => {
    showModal({
      title: `Delete ${promo.code}?`,
      message: 'Buyers will no longer be able to redeem this coupon at checkout.',
      type: 'error',
      confirmText: 'Delete',
      onConfirm: async () => {
        showLoader('Deleting promo code...');
        const res = await deletePromoCodeFirestore(promo);
        hideLoader();
        if (editingDocId === (promo.docId || promo.code)) {
          resetPromoForm();
        }
        if (!res.success) {
          showModal({ title: 'Error', message: res.message, type: 'error' });
        }
      },
    });
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-extrabold text-slate-900">Promo Codes &amp; Free Delivery Rules</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Manage real Firestore coupons (promo_codes) and live free-delivery threshold (settings/delivery) synced to Cart &amp; Checkout.
        </p>
      </div>

      {/* Free Delivery Threshold & Charges */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5">
        <div className="flex items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <i className="fa-solid fa-truck-fast text-[#2874F0]"></i>
              <span>Free Delivery Threshold &amp; Fees</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Powers the live Cart Free-Delivery Nudge progress bar and Checkout totals.
            </p>
          </div>
          <span className="px-2.5 py-1 rounded bg-blue-50 text-[#2874F0] text-[11px] font-mono font-bold">
            settings/delivery
          </span>
        </div>

        <form onSubmit={handleSaveDeliverySettings} className="grid sm:grid-cols-4 gap-3 items-end">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Free Delivery Above (₹)
            </label>
            <input
              type="number"
              min="0"
              required
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              className="w-full h-10 px-3 rounded-lg bg-slate-50 border border-slate-200 text-sm font-semibold focus:bg-white focus:border-[#2874F0] focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Delivery Charge (₹)
            </label>
            <input
              type="number"
              min="0"
              required
              value={deliveryCharge}
              onChange={(e) => setDeliveryCharge(e.target.value)}
              className="w-full h-10 px-3 rounded-lg bg-slate-50 border border-slate-200 text-sm font-semibold focus:bg-white focus:border-[#2874F0] focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Platform Fee (₹)
            </label>
            <input
              type="number"
              min="0"
              required
              value={platformFee}
              onChange={(e) => setPlatformFee(e.target.value)}
              className="w-full h-10 px-3 rounded-lg bg-slate-50 border border-slate-200 text-sm font-semibold focus:bg-white focus:border-[#2874F0] focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="h-10 px-4 rounded-lg bg-[#2874F0] hover:bg-[#1e60d5] text-white text-xs font-extrabold transition"
          >
            Save Delivery Rules
          </button>
        </form>
      </div>

      {/* Create / Edit Promo Code */}
      <div className="grid lg:grid-cols-12 gap-5">
        <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 shadow-xs p-5">
          <div className="flex items-center justify-between mb-3.5">
            <h2 className="text-sm font-extrabold text-slate-900">
              {editingDocId ? `Edit Coupon: ${code}` : 'Create Promo Code'}
            </h2>
            {editingDocId && (
              <button
                type="button"
                onClick={resetPromoForm}
                className="text-xs font-bold text-[#2874F0] hover:underline"
              >
                + New Coupon
              </button>
            )}
          </div>

          <form onSubmit={handleSavePromo} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Coupon Code *
              </label>
              <input
                type="text"
                required
                disabled={Boolean(editingDocId)}
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))}
                placeholder="e.g. SMART50"
                className="w-full h-10 px-3 rounded-lg bg-slate-50 border border-slate-200 text-sm font-mono font-bold uppercase focus:bg-white focus:border-[#2874F0] focus:outline-none disabled:opacity-60"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Discount Type</label>
                <select
                  value={discountType}
                  onChange={(e) => setDiscountType(e.target.value as 'flat' | 'percent')}
                  className="w-full h-10 px-3 rounded-lg bg-slate-50 border border-slate-200 text-xs font-semibold focus:bg-white focus:border-[#2874F0] focus:outline-none"
                >
                  <option value="flat">Flat Amount (₹)</option>
                  <option value="percent">Percentage (%)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {discountType === 'percent' ? 'Discount (%)' : 'Flat Discount (₹)'} *
                </label>
                <input
                  type="number"
                  min="1"
                  max={discountType === 'percent' ? 90 : undefined}
                  required
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg bg-slate-50 border border-slate-200 text-sm font-semibold focus:bg-white focus:border-[#2874F0] focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Min Order Value (₹) *
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={minOrderValue}
                  onChange={(e) => setMinOrderValue(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg bg-slate-50 border border-slate-200 text-sm font-semibold focus:bg-white focus:border-[#2874F0] focus:outline-none"
                />
              </div>
              {discountType === 'percent' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Max Cap (₹, optional)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={maxDiscount}
                    onChange={(e) => setMaxDiscount(e.target.value)}
                    placeholder="e.g. 250"
                    className="w-full h-10 px-3 rounded-lg bg-slate-50 border border-slate-200 text-sm font-semibold focus:bg-white focus:border-[#2874F0] focus:outline-none"
                  />
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Short Description (optional)
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Flat ₹50 OFF on orders above ₹299"
                className="w-full h-10 px-3 rounded-lg bg-slate-50 border border-slate-200 text-xs focus:bg-white focus:border-[#2874F0] focus:outline-none"
              />
            </div>

            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="w-4 h-4 accent-[#2874F0]"
              />
              <span>Active (immediately redeemable by buyers)</span>
            </label>

            <button
              type="submit"
              className="w-full h-10 rounded-lg bg-[#FB641B] hover:bg-[#e55a14] text-white text-xs font-extrabold uppercase tracking-wide transition"
            >
              {editingDocId ? 'Update Promo Code' : 'Create Promo Code'}
            </button>
          </form>
        </div>

        {/* Active & Inactive Promo Codes List */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 shadow-xs p-5">
          <div className="flex items-center justify-between mb-3.5">
            <h2 className="text-sm font-extrabold text-slate-900">
              All Promo Codes ({promoCodes.length})
            </h2>
            <span className="text-[11px] font-semibold text-slate-500">
              {promoCodes.filter((p) => p.active).length} active
            </span>
          </div>

          {promoCodes.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-500">
              No promo codes created yet. Create one like <span className="font-mono font-bold">SMART50</span> on the left.
            </div>
          ) : (
            <div className="space-y-2.5">
              {promoCodes.map((promo) => (
                <div
                  key={promo.docId || promo.code}
                  className={`p-3.5 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    promo.active
                      ? 'border-slate-200 bg-white'
                      : 'border-slate-200 bg-slate-50 opacity-75'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-0.5 rounded border border-dashed border-[#2874F0] bg-blue-50 text-[#2874F0] font-mono text-xs font-extrabold">
                        {promo.code}
                      </span>
                      <span className="text-xs font-extrabold text-slate-900">
                        {promo.discountType === 'percent'
                          ? `${promo.discountValue}% OFF${promo.maxDiscount ? ` (up to ${formatINR(promo.maxDiscount)})` : ''}`
                          : `Flat ${formatINR(promo.discountValue)} OFF`}
                      </span>
                      <span
                        className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                          promo.active
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {promo.active ? 'Active' : 'Paused'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1">
                      Min order: <span className="font-semibold text-slate-800">{formatINR(promo.minOrderValue)}</span>
                      {promo.description ? ` · ${promo.description}` : ''}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Redeemed {promo.usedCount || 0} time{(promo.usedCount || 0) === 1 ? '' : 's'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleTogglePromo(promo)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
                        promo.active
                          ? 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
                          : 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                      }`}
                    >
                      {promo.active ? 'Pause' : 'Activate'}
                    </button>
                    <button
                      type="button"
                      onClick={() => startEditPromo(promo)}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-[#2874F0] hover:bg-blue-50"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeletePromo(promo)}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-rose-600 hover:bg-rose-50"
                      aria-label={`Delete ${promo.code}`}
                    >
                      <i className="fa-solid fa-trash"></i>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
