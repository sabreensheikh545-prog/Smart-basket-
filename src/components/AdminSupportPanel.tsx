import React, { useMemo, useState } from 'react';
import {
  answerProductQuestionFirestore,
  updateSupportTicketFirestore,
} from '../services/firestoreService';
import {
  ProductQuestion,
  SupportTicket,
  SupportTicketStatus,
} from '../types';

interface Props {
  tickets: SupportTicket[];
  questions: ProductQuestion[];
  adminName: string;
  onTicketUpdated: (ticket: SupportTicket) => void;
  onQuestionAnswered: (question: ProductQuestion) => void;
  showModal: (opts: {
    title: string;
    message: string;
    type?: 'info' | 'success' | 'error';
  }) => void;
}

export const AdminSupportPanel: React.FC<Props> = ({
  tickets,
  questions,
  adminName,
  onTicketUpdated,
  onQuestionAnswered,
  showModal,
}) => {
  const [section, setSection] = useState<'tickets' | 'qa'>('tickets');
  const [statusFilter, setStatusFilter] = useState<'All' | SupportTicketStatus>('All');
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [qaReplyDrafts, setQaReplyDrafts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string>('');

  const openTicketCount = useMemo(
    () => tickets.filter((t) => t.status !== 'Resolved').length,
    [tickets]
  );
  const unansweredQaCount = useMemo(
    () => questions.filter((q) => !q.answer).length,
    [questions]
  );

  const filteredTickets = useMemo(() => {
    if (statusFilter === 'All') return tickets;
    return tickets.filter((t) => t.status === statusFilter);
  }, [tickets, statusFilter]);

  const handleUpdateTicket = async (
    ticket: SupportTicket,
    nextStatus: SupportTicketStatus
  ) => {
    const key = ticket.docId || ticket.id;
    const reply = (replyDrafts[key] ?? ticket.adminReply ?? '').trim();
    setBusyId(key);
    const res = await updateSupportTicketFirestore({
      ticket,
      status: nextStatus,
      adminReply: reply,
    });
    setBusyId('');
    if (res.success && res.ticket) {
      onTicketUpdated(res.ticket);
      showModal({ title: 'Ticket Updated', message: res.message, type: 'success' });
    } else {
      showModal({ title: 'Error', message: res.message, type: 'error' });
    }
  };

  const handleAnswerQuestion = async (q: ProductQuestion) => {
    const key = q.docId || q.id;
    const answerText = (qaReplyDrafts[key] ?? q.answer ?? '').trim();
    if (answerText.length < 3) {
      showModal({
        title: 'Answer Required',
        message: 'Please enter a helpful answer before publishing.',
        type: 'error',
      });
      return;
    }
    setBusyId(key);
    const res = await answerProductQuestionFirestore({
      question: q,
      answer: answerText,
      answeredBy: adminName || 'Smart Basket Admin',
      answeredRole: 'Admin',
    });
    setBusyId('');
    if (res.success && res.item) {
      onQuestionAnswered(res.item);
      showModal({ title: 'Answer Published', message: res.message, type: 'success' });
    } else {
      showModal({ title: 'Error', message: res.message, type: 'error' });
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">
            Customer Help Desk &amp; Product Q&amp;A
          </h1>
          <p className="text-xs text-slate-500">
            Resolve buyer support tickets from Firestore (`support_tickets`) and answer product questions
          </p>
        </div>
        <div className="inline-flex items-center p-1 rounded-lg bg-slate-200/80">
          <button
            type="button"
            onClick={() => setSection('tickets')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition whitespace-nowrap ${
              section === 'tickets'
                ? 'bg-white text-[#2874F0] shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Support Tickets ({openTicketCount} open)
          </button>
          <button
            type="button"
            onClick={() => setSection('qa')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition whitespace-nowrap ${
              section === 'qa'
                ? 'bg-white text-[#2874F0] shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Product Q&amp;A ({unansweredQaCount} pending)
          </button>
        </div>
      </div>

      {section === 'tickets' ? (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-wrap items-center gap-2">
            {(['All', 'Open', 'In Progress', 'Resolved'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
                  statusFilter === st
                    ? 'bg-[#2874F0] text-white border-[#2874F0]'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {filteredTickets.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-10 text-center space-y-2">
              <i className="fa-solid fa-headset text-3xl text-slate-300"></i>
              <p className="text-sm font-bold text-slate-700">No support tickets found</p>
              <p className="text-xs text-slate-500">
                Customer tickets submitted from the Account Help Center appear here in real time.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTickets.map((tkt) => {
                const key = tkt.docId || tkt.id;
                const draft = replyDrafts[key] ?? tkt.adminReply ?? '';
                const isBusy = busyId === key;
                return (
                  <div
                    key={key}
                    className="bg-white rounded-xl border border-slate-200/90 p-4 space-y-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="font-mono font-extrabold text-slate-900">
                            {tkt.ticketNumber}
                          </span>
                          <span className="text-slate-300">·</span>
                          <span className="font-bold text-[#2874F0]">{tkt.category}</span>
                          {tkt.orderId && (
                            <>
                              <span className="text-slate-300">·</span>
                              <span className="font-mono font-bold text-slate-700">
                                Order #{tkt.orderId}
                              </span>
                            </>
                          )}
                        </div>
                        <h3 className="text-sm font-extrabold text-slate-900">{tkt.subject}</h3>
                        <p className="text-[11px] text-slate-500">
                          {tkt.customerName}
                          {tkt.customerEmail ? ` · ${tkt.customerEmail}` : ''}
                          {tkt.customerPhone ? ` · +91 ${tkt.customerPhone}` : ''} ·{' '}
                          {new Date(tkt.created_at).toLocaleString('en-IN')}
                        </p>
                      </div>

                      <span
                        className={`text-xs font-extrabold shrink-0 ${
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

                    <p className="text-xs sm:text-sm text-slate-700 bg-slate-50 rounded-lg border border-slate-100 p-3 leading-relaxed">
                      {tkt.message}
                    </p>

                    <div className="space-y-2">
                      <label className="block text-[11px] font-bold text-slate-600">
                        Admin Resolution Note / Reply to Customer
                      </label>
                      <textarea
                        rows={2}
                        value={draft}
                        onChange={(e) =>
                          setReplyDrafts((prev) => ({ ...prev, [key]: e.target.value }))
                        }
                        placeholder="Write resolution update for the customer..."
                        className="w-full p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:border-[#2874F0] focus:outline-none"
                      />
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        {tkt.status !== 'In Progress' && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleUpdateTicket(tkt, 'In Progress')}
                            className="px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-[#2874F0] text-xs font-bold disabled:opacity-50 transition"
                          >
                            Mark In Progress
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleUpdateTicket(tkt, 'Resolved')}
                          className="px-3.5 py-1.5 rounded-lg bg-[#2E7D32] hover:bg-emerald-800 text-white text-xs font-bold disabled:opacity-50 transition inline-flex items-center gap-1.5"
                        >
                          <i className="fa-solid fa-check text-[10px]"></i>
                          <span>{tkt.status === 'Resolved' ? 'Update Reply' : 'Resolve Ticket'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : questions.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center space-y-2">
          <i className="fa-solid fa-circle-question text-3xl text-slate-300"></i>
          <p className="text-sm font-bold text-slate-700">No buyer questions yet</p>
          <p className="text-xs text-slate-500">
            Questions posted by buyers on Product Details pages appear here for instant answers.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {questions.map((q) => {
            const key = q.docId || q.id;
            const draft = qaReplyDrafts[key] ?? q.answer ?? '';
            const isBusy = busyId === key;
            return (
              <div
                key={key}
                className="bg-white rounded-xl border border-slate-200/90 p-4 space-y-2.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-bold text-[#2874F0] truncate">
                    {q.productName || `Product #${q.productId}`}
                  </span>
                  <span
                    className={`font-extrabold ${
                      q.answer ? 'text-[#2E7D32]' : 'text-amber-700'
                    }`}
                  >
                    {q.answer ? 'Answered' : 'Awaiting Reply'}
                  </span>
                </div>
                <p className="text-sm font-bold text-slate-900">Q: {q.question}</p>
                <p className="text-[11px] text-slate-500">
                  Asked by {q.userName} ·{' '}
                  {new Date(q.created_at).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </p>
                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                  <input
                    type="text"
                    value={draft}
                    onChange={(e) =>
                      setQaReplyDrafts((prev) => ({ ...prev, [key]: e.target.value }))
                    }
                    placeholder="Type official Admin answer..."
                    className="flex-1 h-9 px-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:border-[#2874F0] focus:outline-none"
                  />
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => handleAnswerQuestion(q)}
                    className="px-4 h-9 rounded-lg bg-[#2874F0] hover:bg-[#1e60d5] text-white text-xs font-bold disabled:opacity-50 transition whitespace-nowrap"
                  >
                    {q.answer ? 'Update Answer' : 'Post Answer'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
