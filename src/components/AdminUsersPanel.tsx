import React, { useMemo, useState } from 'react';
import { Order, User, formatINR } from '../types';

interface Props {
  users: User[];
  orders: Order[];
  onToggleUserBlock: (user: User) => void;
  onDeleteUser: (user: User) => void;
}

interface EnrichedCustomerRow {
  user: User;
  orderCount: number;
  totalSpent: number;
  lastOrderDate?: string;
}

export const AdminUsersPanel: React.FC<Props> = ({
  users,
  orders,
  onToggleUserBlock,
  onDeleteUser,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'blocked'>('all');

  const enrichedCustomers = useMemo<EnrichedCustomerRow[]>(() => {
    // Merge registered Firestore/local users with any customer found in orders
    const byKey = new Map<string, User>();
    const normalizeKey = (uid?: string, email?: string, numericId?: number) => {
      if (uid && uid.trim()) return `uid:${uid.trim().toLowerCase()}`;
      if (email && email.trim()) return `email:${email.trim().toLowerCase()}`;
      return `id:${numericId || 0}`;
    };

    users.forEach((u) => {
      const k = normalizeKey(u.uid || u.docId, u.email, u.id);
      byKey.set(k, u);
    });

    orders.forEach((ord) => {
      const emailLower = (ord.email || '').trim().toLowerCase();
      const matched = Array.from(byKey.values()).find(
        (u) =>
          (ord.userId && (u.uid === ord.userId || u.docId === ord.userId || String(u.id) === ord.userId)) ||
          (emailLower && (u.email || '').trim().toLowerCase() === emailLower) ||
          (ord.user_id && u.id === ord.user_id)
      );
      if (!matched) {
        const synthKey = normalizeKey(ord.userId, ord.email, ord.user_id);
        if (!byKey.has(synthKey)) {
          byKey.set(synthKey, {
            id: ord.user_id || ord.id,
            uid: ord.userId,
            docId: ord.userId,
            name: ord.name || 'Customer',
            email: emailLower,
            phone: ord.phone || '',
            address: ord.address || '',
            status: 'active',
            created_at: ord.created_at,
            role: 'customer',
          });
        }
      }
    });

    return Array.from(byKey.values())
      .map((u) => {
        const emailLower = (u.email || '').trim().toLowerCase();
        const matchingOrders = orders.filter(
          (o) =>
            (o.userId && (o.userId === u.uid || o.userId === u.docId || o.userId === String(u.id))) ||
            (emailLower && (o.email || '').trim().toLowerCase() === emailLower) ||
            (u.id && o.user_id === u.id)
        );
        const totalSpent = matchingOrders
          .filter((o) => o.status !== 'Cancelled' && o.status !== 'Refunded')
          .reduce((sum, o) => sum + Number(o.total_amount ?? o.total ?? 0), 0);
        const sortedDates = matchingOrders
          .map((o) => o.created_at)
          .filter(Boolean)
          .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

        return {
          user: u,
          orderCount: matchingOrders.length,
          totalSpent,
          lastOrderDate: sortedDates[0],
        };
      })
      .sort((a, b) => {
        if (b.orderCount !== a.orderCount) return b.orderCount - a.orderCount;
        return new Date(b.user.created_at).getTime() - new Date(a.user.created_at).getTime();
      });
  }, [users, orders]);

  const activeCount = enrichedCustomers.filter((r) => r.user.status !== 'blocked').length;
  const blockedCount = enrichedCustomers.filter((r) => r.user.status === 'blocked').length;

  const filteredRows = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return enrichedCustomers.filter(({ user }) => {
      if (statusFilter === 'active' && user.status === 'blocked') return false;
      if (statusFilter === 'blocked' && user.status !== 'blocked') return false;
      if (!q) return true;
      return (
        user.name.toLowerCase().includes(q) ||
        (user.email || '').toLowerCase().includes(q) ||
        (user.phone || '').toLowerCase().includes(q)
      );
    });
  }, [enrichedCustomers, searchTerm, statusFilter]);

  return (
    <div className="space-y-4">
      {/* Header & Metrics */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">
            Users Management
          </h1>
          <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
            {enrichedCustomers.length} Registered · {activeCount} Active · {blockedCount} Blocked
          </p>
        </div>

        {/* Status Segmented Control */}
        <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-white border border-slate-200 self-start sm:self-auto max-w-full overflow-x-auto no-scrollbar">
          {(
            [
              { id: 'all', label: `All (${enrichedCustomers.length})` },
              { id: 'active', label: `Active (${activeCount})` },
              { id: 'blocked', label: `Blocked (${blockedCount})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`px-2.5 sm:px-3 py-1.5 rounded-md text-xs font-bold transition whitespace-nowrap ${
                statusFilter === tab.id
                  ? 'bg-[#2874F0] text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Search Input */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-3">
        <div className="relative flex items-center">
          <i className="fa-solid fa-magnifying-glass text-slate-400 text-xs absolute left-3.5 pointer-events-none"></i>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search customers by name, email, or phone..."
            className="w-full h-10 pl-9 pr-9 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:border-[#2874F0] focus:outline-none"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              aria-label="Clear search"
              className="absolute right-2.5 text-slate-400 hover:text-slate-700"
            >
              <i className="fa-solid fa-xmark text-xs"></i>
            </button>
          )}
        </div>
      </div>

      {/* Customer Directory Table / Mobile Cards */}
      {filteredRows.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200/80 p-10 text-center space-y-1.5">
          <i className="fa-solid fa-users-slash text-2xl text-slate-300"></i>
          <p className="text-sm font-bold text-slate-700">No matching customers found</p>
          <p className="text-xs text-slate-500">
            {searchTerm ? 'Try a different name, email, or mobile number.' : 'Registered customers will appear here automatically.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden">
          {/* Desktop Table Header */}
          <div className="hidden md:grid md:grid-cols-12 gap-3 px-4 py-3 bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
            <div className="col-span-3">Customer Name</div>
            <div className="col-span-3">Email</div>
            <div className="col-span-2">Phone</div>
            <div className="col-span-1 text-center">Total Orders</div>
            <div className="col-span-3 text-right">Account Status &amp; Action</div>
          </div>

          <div className="divide-y divide-slate-100">
            {filteredRows.map(({ user, orderCount, totalSpent }) => {
              const isBlocked = user.status === 'blocked';
              const initials = (user.name || 'C')
                .split(' ')
                .map((w) => w[0])
                .join('')
                .slice(0, 2)
                .toUpperCase();

              return (
                <div
                  key={user.docId || user.uid || user.email || user.id}
                  className={`p-4 md:grid md:grid-cols-12 md:items-center gap-3 transition ${
                    isBlocked ? 'bg-rose-50/35' : 'hover:bg-slate-50/70'
                  }`}
                >
                  {/* Name */}
                  <div className="md:col-span-3 flex items-center gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-lg font-extrabold text-xs flex items-center justify-center shrink-0 ${
                        isBlocked
                          ? 'bg-rose-100 text-rose-700'
                          : 'bg-blue-50 text-[#2874F0]'
                      }`}
                    >
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">{user.name}</p>
                      <p className="text-[11px] text-slate-500 tabular-nums">
                        Joined{' '}
                        {new Date(user.created_at).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                  </div>

                  {/* Email */}
                  <div className="md:col-span-3 mt-2 md:mt-0 min-w-0">
                    <span className="md:hidden text-[10px] font-bold uppercase text-slate-400 mr-1.5">
                      Email:
                    </span>
                    <span className="text-xs font-medium text-slate-700 break-all">
                      {user.email || '—'}
                    </span>
                  </div>

                  {/* Phone */}
                  <div className="md:col-span-2 mt-1 md:mt-0">
                    <span className="md:hidden text-[10px] font-bold uppercase text-slate-400 mr-1.5">
                      Phone:
                    </span>
                    <span className="text-xs font-mono text-slate-700 tabular-nums">
                      {user.phone ? `+91 ${user.phone}` : '—'}
                    </span>
                  </div>

                  {/* Order Count */}
                  <div className="md:col-span-1 mt-1.5 md:mt-0 md:text-center">
                    <span className="md:hidden text-[10px] font-bold uppercase text-slate-400 mr-1.5">
                      Total Orders:
                    </span>
                    <span className="text-sm font-extrabold text-slate-900 font-mono tabular-nums">
                      {orderCount}
                    </span>
                    {totalSpent > 0 && (
                      <span className="block text-[10px] text-slate-500 font-mono tabular-nums">
                        {formatINR(totalSpent)}
                      </span>
                    )}
                  </div>

                  {/* Active / Blocked Toggle Switch + Delete */}
                  <div className="md:col-span-3 mt-3 md:mt-0 flex items-center justify-between md:justify-end gap-3 pt-2.5 md:pt-0 border-t md:border-t-0 border-slate-100">
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`text-xs font-bold whitespace-nowrap ${
                          isBlocked ? 'text-rose-600' : 'text-[#2E7D32]'
                        }`}
                      >
                        {isBlocked ? 'Blocked' : 'Active'}
                      </span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={!isBlocked}
                        aria-label={isBlocked ? `Unblock ${user.name}` : `Block ${user.name}`}
                        onClick={() => onToggleUserBlock(user)}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2874F0] ${
                          isBlocked ? 'bg-rose-500' : 'bg-[#2E7D32]'
                        }`}
                      >
                        <span
                          aria-hidden="true"
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs transition duration-150 ${
                            isBlocked ? 'translate-x-0' : 'translate-x-5'
                          }`}
                        />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => onDeleteUser(user)}
                      aria-label={`Delete ${user.name}`}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 text-xs font-semibold transition whitespace-nowrap"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
