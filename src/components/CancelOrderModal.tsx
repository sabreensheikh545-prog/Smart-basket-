import React, { useEffect, useState } from 'react';
import { CANCEL_REASONS, Order, formatINR, isOnlinePaidOrder } from '../types';

interface Props {
  order: Order | null;
  onClose: () => void;
  onConfirmCancel: (order: Order, reason: string) => Promise<void> | void;
}

export const CancelOrderModal: React.FC<Props> = ({ order, onClose, onConfirmCancel }) => {
  const [selectedReason, setSelectedReason] = useState<string>(CANCEL_REASONS[0]);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (order) {
      setSelectedReason(CANCEL_REASONS[0]);
      setNote('');
      setSubmitting(false);
    }
  }, [order]);

  if (!order) return null;

  const isPrepaid = isOnlinePaidOrder(order);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    const finalReason = note.trim() ? `${selectedReason} — ${note.trim()}` : selectedReason;
    setSubmitting(true);
    try {
      await onConfirmCancel(order, finalReason);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
              <i className="fa-solid fa-ban text-sm"></i>
            </span>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 leading-tight">
                Cancel Order #{order.id}
              </h3>
              <p className="text-[11px] text-slate-500">
                {order.items.length} item{order.items.length > 1 ? 's' : ''} · {formatINR(order.total_amount)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close cancel order modal"
            className="w-8 h-8 rounded-lg text-slate-500 hover:bg-slate-100 flex items-center justify-center"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">
              Reason for Cancellation
            </label>
            <div className="space-y-2">
              {CANCEL_REASONS.map((reason) => (
                <label
                  key={reason}
                  className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border cursor-pointer transition text-xs font-semibold ${
                    selectedReason === reason
                      ? 'bg-rose-50 border-rose-300 text-rose-950'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <input
                    type="radio"
                    name="cancelReason"
                    value={reason}
                    checked={selectedReason === reason}
                    onChange={() => setSelectedReason(reason)}
                    className="accent-rose-600"
                  />
                  <span>{reason}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Additional Comments <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add any extra details (optional)..."
              className="w-full p-3 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-800 focus:bg-white focus:border-[#2874F0] focus:outline-none"
            />
          </div>

          <div className="px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-700 leading-relaxed space-y-1">
            <p className="font-bold text-slate-900 flex items-center gap-1.5">
              <i className="fa-solid fa-circle-info text-[#2874F0]"></i>
              <span>What happens next</span>
            </p>
            <p>
              Item inventory is released immediately.{' '}
              {isPrepaid
                ? 'Your online Razorpay payment will be refunded to the original source within 5–7 business days.'
                : 'No amount was charged for this Cash on Delivery order.'}
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
            >
              Keep Order
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-xs font-extrabold transition"
            >
              {submitting ? 'Cancelling...' : 'Confirm Cancellation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
