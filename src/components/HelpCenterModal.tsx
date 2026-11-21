import React, { useState } from 'react';
import { submitSupportTicketFirestore } from '../services/firestoreService';
import {
  Order,
  SUPPORT_TICKET_CATEGORIES,
  SupportTicket,
  SupportTicketCategory,
  User,
  formatINR,
} from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  currentUser: User | null;
  orders: Order[];
  tickets: SupportTicket[];
  initialOrderId?: number | null;
  onTicketCreated?: (ticket: SupportTicket) => void;
  onRequireLogin: () => void;
}

export const HelpCenterModal: React.FC<Props> = ({
  open,
  onClose,
  currentUser,
  orders,
  tickets,
  initialOrderId,
  onTicketCreated,
  onRequireLogin,
}) => {
  const [activeTab, setActiveTab] = useState<'raise' | 'history'>('raise');
  const [selectedOrderId, setSelectedOrderId] = useState<string>(
    initialOrderId ? String(initialOrderId) : orders[0]?.id ? String(orders[0].id) : ''
  );
  const [category, setCategory] = useState<SupportTicketCategory>(SUPPORT_TICKET_CATEGORIES[0]);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      onClose();
      onRequireLogin();
      return;
    }
    setFeedback(null);
    setSubmitting(true);
    const linkedOrder = selectedOrderId
      ? orders.find((o) => String(o.id) === selectedOrderId) || null
      : null;

    const res = await submitSupportTicketFirestore({
      user: currentUser,
      order: linkedOrder,
      category,
      subject,
      message,
    });
    setSubmitting(false);

    if (res.success && res.ticket) {
      onTicketCreated?.(res.ticket);
      setSubject('');
      setMessage('');
      setFeedback({ type: 'success', text: res.message });
      setActiveTab('history');
    } else {
      setFeedback({ type: 'error', text: res.message });
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 bg-[#2874F0] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
              <i className="fa-solid fa-headset text-base text-[#FFE500]"></i>
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-extrabold leading-tight truncate">
                Smart Basket Help Center
              </h2>
              <p className="text-[11px] text-blue-100 truncate">
                24×7 Order Support · Track &amp; Resolve Issues
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close help center"
            className="w-8 h-8 rounded-lg hover:bg-white/15 flex items-center justify-center shrink-0"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-2 border-b border-slate-200 bg-slate-50 shrink-0">
          <button
            type="button"
            onClick={() => {
              setActiveTab('raise');
              setFeedback(null);
            }}
            className={`py-3 text-xs sm:text-sm font-bold border-b-2 transition ${
              activeTab === 'raise'
                ? 'bg-white text-[#2874F0] border-[#2874F0]'
                : 'text-slate-600 border-transparent hover:text-slate-900'
            }`}
          >
            Raise Support Ticket
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`py-3 text-xs sm:text-sm font-bold border-b-2 transition ${
              activeTab === 'history'
                ? 'bg-white text-[#2874F0] border-[#2874F0]'
                : 'text-slate-600 border-transparent hover:text-slate-900'
            }`}
          >
            My Tickets ({tickets.length})
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {feedback && (
            <div
              className={`p-3 rounded-lg border text-xs font-semibold flex items-start gap-2 ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-700'
              }`}
            >
              <i
                className={`fa-solid mt-0.5 shrink-0 ${
                  feedback.type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'
                }`}
              ></i>
              <span>{feedback.text}</span>
            </div>
          )}

          {activeTab === 'raise' ? (
            !currentUser ? (
              <div className="py-8 text-center space-y-3">
                <i className="fa-solid fa-user-lock text-3xl text-slate-300"></i>
                <p className="text-sm font-bold text-slate-800">
                  Please sign in to raise a support ticket
                </p>
                <p className="text-xs text-slate-500">
                  Sign in so we can link your ticket to your orders and notify you on resolution.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onRequireLogin();
                  }}
                  className="px-5 py-2.5 rounded-lg bg-[#2874F0] text-white text-xs font-bold hover:bg-[#1e60d5]"
                >
                  Login / Sign Up
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Select Related Order (Optional)
                  </label>
                  <select
                    value={selectedOrderId}
                    onChange={(e) => setSelectedOrderId(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg bg-slate-50 border border-slate-300 text-xs sm:text-sm text-slate-900 focus:bg-white focus:border-[#2874F0] focus:outline-none"
                  >
                    <option value="">General Account / Non-Order Issue</option>
                    {orders.map((ord) => (
                      <option key={ord.docId || ord.id} value={String(ord.id)}>
                        Order #{ord.id} — {formatINR(ord.total_amount)} ({ord.status})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Issue Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as SupportTicketCategory)}
                    className="w-full h-10 px-3 rounded-lg bg-slate-50 border border-slate-300 text-xs sm:text-sm text-slate-900 focus:bg-white focus:border-[#2874F0] focus:outline-none"
                  >
                    {SUPPORT_TICKET_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Subject
                  </label>
                  <input
                    type="text"
                    required
                    minLength={4}
                    maxLength={120}
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g., Delayed delivery or missing item in package"
                    className="w-full h-10 px-3.5 rounded-lg bg-slate-50 border border-slate-300 text-xs sm:text-sm text-slate-900 focus:bg-white focus:border-[#2874F0] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Describe Your Issue
                  </label>
                  <textarea
                    rows={4}
                    required
                    minLength={10}
                    maxLength={800}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Please share full details so Smart Basket Support can resolve this quickly..."
                    className="w-full p-3 rounded-lg bg-slate-50 border border-slate-300 text-xs sm:text-sm text-slate-900 focus:bg-white focus:border-[#2874F0] focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-11 rounded-lg bg-[#FB641B] hover:bg-[#e55812] disabled:opacity-60 text-white text-sm font-extrabold transition flex items-center justify-center gap-2"
                >
                  <i className="fa-solid fa-paper-plane text-xs"></i>
                  <span>{submitting ? 'Submitting Ticket...' : 'Submit Support Ticket'}</span>
                </button>
              </form>
            )
          ) : tickets.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <i className="fa-solid fa-ticket text-3xl text-slate-300"></i>
              <p className="text-sm font-bold text-slate-700">No support tickets yet</p>
              <p className="text-xs text-slate-500">
                Need help with an order? Switch to &ldquo;Raise Support Ticket&rdquo; to contact us.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {tickets.map((tkt) => (
                <div
                  key={tkt.docId || tkt.id}
                  className="rounded-xl border border-slate-200 p-3.5 space-y-2 bg-white"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-mono font-extrabold text-slate-900">
                        {tkt.ticketNumber}
                      </span>
                      {tkt.orderId && (
                        <span className="text-[11px] font-mono text-[#2874F0] font-bold">
                          Order #{tkt.orderId}
                        </span>
                      )}
                    </div>
                    <span
                      className={`text-[11px] font-extrabold ${
                        tkt.status === 'Resolved'
                          ? 'text-[#2E7D32]'
                          : tkt.status === 'In Progress'
                          ? 'text-[#2874F0]'
                          : 'text-amber-700'
                      }`}
                    >
                      {tkt.status}
                    </span>
                  </div>

                  <div>
                    <p className="text-xs font-extrabold text-slate-900">{tkt.subject}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {tkt.category} ·{' '}
                      {new Date(tkt.created_at).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">{tkt.message}</p>

                  {tkt.adminReply && (
                    <div className="rounded-lg bg-emerald-50/70 border border-emerald-200 p-2.5 text-xs space-y-0.5">
                      <p className="text-[11px] font-extrabold text-[#2E7D32]">
                        Smart Basket Support Reply
                      </p>
                      <p className="text-slate-700 leading-relaxed">{tkt.adminReply}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
