import React, { useEffect, useState } from 'react';
import { Order, Product, ProductReview } from '../types';

interface Props {
  open: boolean;
  product: Product | null;
  order: Order | null;
  existingReview?: ProductReview | null;
  onClose: () => void;
  onSubmit: (payload: { rating: number; title: string; comment: string }) => Promise<void>;
}

const STAR_LABELS: Record<number, string> = {
  1: 'Very Bad',
  2: 'Below Average',
  3: 'Good',
  4: 'Very Good',
  5: 'Excellent',
};

export const VerifiedReviewModal: React.FC<Props> = ({
  open,
  product,
  order,
  existingReview,
  onClose,
  onSubmit,
}) => {
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setRating(existingReview?.rating || 5);
    setTitle(existingReview?.title || '');
    setComment(existingReview?.comment || '');
    setError('');
    setSubmitting(false);
  }, [open, existingReview]);

  if (!open || !product || !order) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (comment.trim().length < 5) {
      setError('Please write at least 5 characters about your experience.');
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({ rating, title: title.trim(), comment: comment.trim() });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 bg-[#2874F0] text-white flex items-center justify-between">
          <div>
            <h2 className="text-base font-extrabold">
              {existingReview ? 'Edit Your Verified Review' : 'Rate & Review Product'}
            </h2>
            <p className="text-[11px] text-blue-100 mt-0.5 flex items-center gap-1.5">
              <i className="fa-solid fa-circle-check text-[#FFE500]"></i>
              <span>Verified Purchase · Order #{order.id}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close review modal"
            className="w-8 h-8 rounded-lg hover:bg-white/15 flex items-center justify-center"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-50 border border-slate-200">
            <img
              src={product.image}
              alt={product.name}
              className="w-12 h-12 rounded-md object-cover bg-white border border-slate-200 shrink-0"
            />
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-900 line-clamp-2">{product.name}</p>
              <p className="text-[11px] text-emerald-700 font-semibold mt-0.5">
                Delivered Order #{order.id}
              </p>
            </div>
          </div>

          {error && (
            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">
              Your Rating: <span className="text-[#2874F0]">{rating}/5 — {STAR_LABELS[rating]}</span>
            </label>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className={`w-10 h-10 rounded-lg border text-lg flex items-center justify-center transition ${
                    star <= rating
                      ? 'bg-amber-50 border-amber-300 text-amber-500'
                      : 'bg-slate-50 border-slate-200 text-slate-300 hover:text-amber-400'
                  }`}
                  aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
                >
                  <i className="fa-solid fa-star"></i>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Review Headline <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              maxLength={80}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Genuine quality & fast delivery"
              className="w-full h-10 px-3 rounded-lg bg-slate-50 border border-slate-200 text-sm focus:bg-white focus:border-[#2874F0] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Write your review *
            </label>
            <textarea
              rows={3}
              required
              maxLength={500}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Share product quality, packaging, and delivery experience..."
              className="w-full p-3 rounded-lg bg-slate-50 border border-slate-200 text-sm focus:bg-white focus:border-[#2874F0] focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 h-10 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 h-10 rounded-lg bg-[#FB641B] hover:bg-[#e55a14] text-white text-xs font-extrabold uppercase tracking-wide disabled:opacity-60 transition"
            >
              {submitting ? 'Submitting...' : existingReview ? 'Update Review' : 'Submit Review'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
