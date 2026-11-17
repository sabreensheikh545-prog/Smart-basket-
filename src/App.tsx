import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AdminView } from './components/AdminView';
import { PhpBundleModal } from './components/PhpBundleModal';
import { CartEntry, Category, Order, Product, User, formatINR } from './types';

type UserPage = 'home' | 'shop' | 'detail' | 'cart' | 'checkout' | 'orders' | 'profile' | 'login';

interface ModalConfig {
  open: boolean;
  title: string;
  message: string;
  type: 'info' | 'success' | 'error';
  confirmText: string;
  onConfirm?: () => void;
}

export default function App() {
  const [mode, setMode] = useState<'user' | 'admin'>('user');
  const [page, setPage] = useState<UserPage>('home');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [phpModalOpen, setPhpModalOpen] = useState(false);

  // Server data
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [adminUsername, setAdminUsername] = useState('admin');
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Catalog Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCatId, setFilterCatId] = useState<number>(0);
  const [maxPrice, setMaxPrice] = useState<number>(0);
  const [sortBy, setSortBy] = useState<'newest' | 'price_asc' | 'price_desc'>('newest');

  // Product Detail
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [detailSlideIdx, setDetailSlideIdx] = useState(0);
  const [detailQty, setDetailQty] = useState(1);

  // Cart
  const [cart, setCart] = useState<CartEntry[]>([]);

  // Auth Forms
  const [authTab, setAuthTab] = useState<'login' | 'signup'>('login');
  const [loginEmail, setLoginEmail] = useState('aarav@quickkart.in');
  const [loginPassword, setLoginPassword] = useState('demo1234');
  const [signupName, setSignupName] = useState('');
  const [signupPhone, setSignupPhone] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [authError, setAuthError] = useState('');

  // Checkout Form
  const [checkoutName, setCheckoutName] = useState('');
  const [checkoutPhone, setCheckoutPhone] = useState('');
  const [checkoutAddress, setCheckoutAddress] = useState('');

  // Orders View
  const [orderTab, setOrderTab] = useState<'active' | 'history'>('active');
  const [expandedOrderIds, setExpandedOrderIds] = useState<number[]>([]);

  // Profile Forms
  const [profName, setProfName] = useState('');
  const [profPhone, setProfPhone] = useState('');
  const [profEmail, setProfEmail] = useState('');
  const [profAddress, setProfAddress] = useState('');
  const [currPass, setCurrPass] = useState('');
  const [newPass, setNewPass] = useState('');

  // Loader & Modal
  const [loader, setLoader] = useState<{ open: boolean; text: string }>({ open: false, text: 'Please wait...' });
  const [modal, setModal] = useState<ModalConfig>({
    open: false,
    title: 'Notice',
    message: '',
    type: 'info',
    confirmText: 'OK',
  });

  const showLoader = useCallback((text = 'Please wait...') => setLoader({ open: true, text }), []);
  const hideLoader = useCallback(() => setLoader((prev) => ({ ...prev, open: false })), []);
  const showModal = useCallback(
    (opts: { title: string; message: string; type?: 'info' | 'success' | 'error'; onConfirm?: () => void; confirmText?: string }) => {
      setModal({
        open: true,
        title: opts.title,
        message: opts.message,
        type: opts.type || 'info',
        confirmText: opts.confirmText || 'OK',
        onConfirm: opts.onConfirm,
      });
    },
    []
  );

  const loadBootstrap = useCallback(async () => {
    const res = await fetch('/api/bootstrap');
    const data = await res.json();
    setCategories(data.categories || []);
    setProducts(data.products || []);
    setOrders(data.orders || []);
    setUsers(data.users || []);
    setAdminUsername(data.adminUsername || 'admin');
  }, []);

  const handleDownloadZip = useCallback(async () => {
    showLoader('Preparing ZIP...');
    try {
      const res = await fetch('/api/download-php-zip');
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'quick-kart-php-mysql.zip';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      hideLoader();
    } catch {
      hideLoader();
      showModal({ title: 'Download Failed', message: 'Could not generate ZIP file. Please try again.', type: 'error' });
    }
  }, [showLoader, hideLoader, showModal]);

  useEffect(() => {
    loadBootstrap();
  }, [loadBootstrap]);

  // Security & Mobile UX restrictions: disable right-click, text selection, and zoom
  useEffect(() => {
    const preventContext = (e: MouseEvent) => e.preventDefault();
    const preventSelect = (e: Event) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag !== 'input' && tag !== 'textarea' && tag !== 'select') {
        e.preventDefault();
      }
    };
    const preventZoomKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && ['+', '-', '=', '0'].includes(e.key)) {
        e.preventDefault();
      }
    };
    const preventWheelZoom = (e: WheelEvent) => {
      if (e.ctrlKey) e.preventDefault();
    };
    const preventPinch = (e: TouchEvent) => {
      if (e.touches.length > 1) e.preventDefault();
    };

    document.addEventListener('contextmenu', preventContext);
    document.addEventListener('selectstart', preventSelect);
    document.addEventListener('keydown', preventZoomKey);
    document.addEventListener('wheel', preventWheelZoom, { passive: false });
    document.addEventListener('touchmove', preventPinch, { passive: false });

    return () => {
      document.removeEventListener('contextmenu', preventContext);
      document.removeEventListener('selectstart', preventSelect);
      document.removeEventListener('keydown', preventZoomKey);
      document.removeEventListener('wheel', preventWheelZoom);
      document.removeEventListener('touchmove', preventPinch);
    };
  }, []);

  // Sync profile fields when currentUser changes
  useEffect(() => {
    if (currentUser) {
      setProfName(currentUser.name);
      setProfPhone(currentUser.phone);
      setProfEmail(currentUser.email);
      setProfAddress(currentUser.address || '');
      setCheckoutName(currentUser.name);
      setCheckoutPhone(currentUser.phone);
      setCheckoutAddress(currentUser.address || '');
    }
  }, [currentUser]);

  const cartCount = useMemo(() => cart.reduce((acc, item) => acc + item.quantity, 0), [cart]);
  const cartTotal = useMemo(() => cart.reduce((acc, item) => acc + item.product.price * item.quantity, 0), [cart]);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = products.filter((p) => {
      if (filterCatId > 0 && p.cat_id !== filterCatId) return false;
      if (maxPrice > 0 && p.price > maxPrice) return false;
      if (q && !p.name.toLowerCase().includes(q) && !p.description.toLowerCase().includes(q)) return false;
      return true;
    });
    if (sortBy === 'price_asc') return [...list].sort((a, b) => a.price - b.price);
    if (sortBy === 'price_desc') return [...list].sort((a, b) => b.price - a.price);
    return list;
  }, [products, filterCatId, maxPrice, searchQuery, sortBy]);

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === selectedProductId) || null,
    [products, selectedProductId]
  );

  const userOrders = useMemo(() => {
    const uid = currentUser?.id || 1;
    return orders.filter((o) => o.user_id === uid);
  }, [orders, currentUser]);

  const activeOrders = useMemo(
    () => userOrders.filter((o) => o.status === 'Placed' || o.status === 'Dispatched'),
    [userOrders]
  );
  const historyOrders = useMemo(
    () => userOrders.filter((o) => o.status === 'Delivered' || o.status === 'Cancelled'),
    [userOrders]
  );

  const openProductDetail = (prod: Product) => {
    setSelectedProductId(prod.id);
    setDetailSlideIdx(0);
    setDetailQty(1);
    setPage('detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const addToCart = (prod: Product, qty = 1, goCart = false) => {
    if (prod.stock <= 0) {
      showModal({ title: 'Out of Stock', message: 'This item is currently unavailable.', type: 'error' });
      return;
    }
    showLoader('Adding item...');
    setTimeout(() => {
      setCart((prev) => {
        const existing = prev.find((c) => c.product.id === prod.id);
        if (existing) {
          return prev.map((c) =>
            c.product.id === prod.id ? { ...c, quantity: Math.min(prod.stock, c.quantity + qty) } : c
          );
        }
        return [...prev, { product: prod, quantity: Math.min(prod.stock, qty) }];
      });
      hideLoader();
      if (goCart) {
        setPage('cart');
      } else {
        showModal({ title: 'Added to Cart', message: `${prod.name} added to your bag.`, type: 'success' });
      }
    }, 220);
  };

  const updateCartQty = (productId: number, qty: number) => {
    if (qty <= 0) {
      setCart((prev) => prev.filter((c) => c.product.id !== productId));
      return;
    }
    setCart((prev) =>
      prev.map((c) => (c.product.id === productId ? { ...c, quantity: Math.min(c.product.stock, qty) } : c))
    );
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    showLoader('Verifying...');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const data = await res.json();
      hideLoader();
      if (data.success) {
        setCurrentUser(data.user);
        setPage('home');
      } else {
        setAuthError(data.message);
      }
    } catch {
      hideLoader();
      setAuthError('Network error.');
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    showLoader('Creating account...');
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: signupName,
          phone: signupPhone,
          email: signupEmail,
          password: signupPassword,
        }),
      });
      const data = await res.json();
      hideLoader();
      if (data.success) {
        setCurrentUser(data.user);
        await loadBootstrap();
        setPage('home');
      } else {
        setAuthError(data.message);
      }
    } catch {
      hideLoader();
      setAuthError('Network error.');
    }
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      showModal({
        title: 'Sign In Required',
        message: 'Please sign in or create an account to confirm your COD order.',
        type: 'info',
        confirmText: 'Go to Login',
        onConfirm: () => setPage('login'),
      });
      return;
    }
    showLoader('Placing order...');
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: currentUser.id,
          name: checkoutName,
          phone: checkoutPhone,
          address: checkoutAddress,
          items: cart.map((c) => ({ product_id: c.product.id, quantity: c.quantity })),
        }),
      });
      const data = await res.json();
      hideLoader();
      if (data.success) {
        setCart([]);
        await loadBootstrap();
        setOrderTab('active');
        setPage('orders');
        showModal({ title: 'Order Confirmed', message: data.message, type: 'success' });
      } else {
        showModal({ title: 'Checkout Error', message: data.message, type: 'error' });
      }
    } catch {
      hideLoader();
      showModal({ title: 'Error', message: 'Failed to place order.', type: 'error' });
    }
  };

  const handleCancelOrder = (orderId: number) => {
    showModal({
      title: `Cancel Order #${orderId}`,
      message: 'Are you sure you want to cancel this order?',
      type: 'info',
      confirmText: 'Yes, Cancel',
      onConfirm: async () => {
        showLoader('Cancelling...');
        const res = await fetch('/api/orders/cancel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order_id: orderId, user_id: currentUser?.id || 1 }),
        });
        const data = await res.json();
        hideLoader();
        await loadBootstrap();
        if (!data.success) {
          showModal({ title: 'Notice', message: data.message, type: 'error' });
        }
      },
    });
  };

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    showLoader('Saving profile...');
    const res = await fetch('/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: currentUser.id,
        name: profName,
        phone: profPhone,
        email: profEmail,
        address: profAddress,
      }),
    });
    const data = await res.json();
    hideLoader();
    if (data.success) {
      setCurrentUser(data.user);
      await loadBootstrap();
    }
    showModal({ title: data.success ? 'Saved' : 'Error', message: data.message, type: data.success ? 'success' : 'error' });
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    showLoader('Updating password...');
    const res = await fetch('/api/profile/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: currentUser.id, current_password: currPass, new_password: newPass }),
    });
    const data = await res.json();
    hideLoader();
    if (data.success) {
      setCurrPass('');
      setNewPass('');
    }
    showModal({ title: data.success ? 'Updated' : 'Error', message: data.message, type: data.success ? 'success' : 'error' });
  };

  const renderOrderCard = (ord: Order) => {
    const firstItem = ord.items[0];
    const extraCount = Math.max(0, ord.items.length - 1);
    const stage = ord.status === 'Delivered' ? 3 : ord.status === 'Dispatched' ? 2 : 1;
    const isCancelled = ord.status === 'Cancelled';
    const isExpanded = expandedOrderIds.includes(ord.id);

    return (
      <div key={ord.id} className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 flex items-center gap-3.5">
          <img
            src={firstItem?.product_image || '/src/assets/images/hero_quick_kart_1794891801002.jpg'}
            alt={firstItem?.product_name || 'Order'}
            className="w-16 h-16 rounded-xl bg-slate-100 object-cover shrink-0"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-mono font-semibold text-slate-500">Order #{ord.id}</span>
              <span
                className={`text-xs font-semibold inline-flex items-center gap-1 ${
                  isCancelled ? 'text-rose-600' : stage === 3 ? 'text-emerald-700' : stage === 2 ? 'text-blue-700' : 'text-amber-700'
                }`}
              >
                <i
                  className={`fa-solid ${
                    isCancelled ? 'fa-circle-xmark' : stage === 3 ? 'fa-circle-check' : stage === 2 ? 'fa-truck-fast' : 'fa-receipt'
                  }`}
                ></i>
                <span>{ord.status}</span>
              </span>
            </div>
            <h3 className="mt-0.5 text-sm font-bold text-slate-900 truncate">
              {firstItem?.product_name || 'Quick Kart Order'}
              {extraCount > 0 ? ` + ${extraCount} more` : ''}
            </h3>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-sm font-extrabold text-slate-900 font-mono tabular-nums">{formatINR(ord.total_amount)}</span>
              <span className="text-[11px] text-slate-500">{new Date(ord.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
            </div>
          </div>
        </div>

        {!isCancelled && (
          <div className="px-5 pt-2 pb-4 border-t border-slate-100 bg-slate-50/50">
            <div className="relative flex items-center justify-between">
              <div className="absolute left-6 right-6 top-4 h-1 bg-slate-200 rounded-full">
                <div
                  className="h-full bg-orange-600 rounded-full transition-all duration-300"
                  style={{ width: stage === 1 ? '0%' : stage === 2 ? '50%' : '100%' }}
                />
              </div>
              {[
                { label: 'Placed', icon: 'fa-receipt', active: stage >= 1, done: false },
                { label: 'Dispatched', icon: 'fa-truck-fast', active: stage >= 2, done: false },
                { label: 'Delivered', icon: 'fa-box-open', active: stage >= 3, done: stage === 3 },
              ].map((st) => (
                <div key={st.label} className="relative z-10 flex flex-col items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs transition ${
                      st.done
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : st.active
                        ? 'bg-orange-600 text-white shadow-sm'
                        : 'bg-slate-200 text-slate-500'
                    }`}
                  >
                    <i className={`fa-solid ${st.icon}`}></i>
                  </div>
                  <span
                    className={`mt-1.5 text-[11px] font-bold ${
                      st.done ? 'text-emerald-700' : st.active ? 'text-slate-900' : 'text-slate-400'
                    }`}
                  >
                    {st.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="px-4 py-2.5 border-t border-slate-100 flex items-center justify-between bg-white">
          <button
            type="button"
            onClick={() =>
              setExpandedOrderIds((prev) => (prev.includes(ord.id) ? prev.filter((x) => x !== ord.id) : [...prev, ord.id]))
            }
            className="text-xs font-bold text-slate-700 hover:text-orange-600 flex items-center gap-1.5"
          >
            <span>View Details</span>
            <i className={`fa-solid fa-chevron-down text-[10px] transition-transform ${isExpanded ? 'rotate-180' : ''}`}></i>
          </button>
          {ord.status === 'Placed' && (
            <button type="button" onClick={() => handleCancelOrder(ord.id)} className="text-xs font-semibold text-rose-600 hover:text-rose-700">
              Cancel Order
            </button>
          )}
        </div>

        {isExpanded && (
          <div className="px-4 pb-4 pt-2 border-t border-slate-100 bg-slate-50 space-y-3">
            <div className="space-y-2">
              {ord.items.map((it) => (
                <div key={it.id} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-semibold text-slate-800 truncate">{it.product_name}</span>
                    <span className="text-slate-500 shrink-0">× {it.quantity}</span>
                  </div>
                  <span className="font-mono font-semibold text-slate-800 tabular-nums shrink-0">{formatINR(it.price * it.quantity)}</span>
                </div>
              ))}
            </div>
            <div className="pt-2 border-t border-slate-200/70 text-xs text-slate-600 space-y-1">
              <p><strong className="text-slate-800">Recipient:</strong> {ord.name} · {ord.phone}</p>
              <p><strong className="text-slate-800">Delivery Address:</strong> {ord.address}</p>
              <p><strong className="text-slate-800">Payment:</strong> Cash on Delivery</p>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans select-none overflow-x-hidden">
      {mode === 'admin' ? (
        <AdminView
          categories={categories}
          products={products}
          orders={orders}
          users={users}
          adminUsername={adminUsername}
          onRefresh={loadBootstrap}
          onExitAdmin={() => setMode('user')}
          showLoader={showLoader}
          hideLoader={hideLoader}
          showModal={showModal}
        />
      ) : (
        <div className="pb-20 md:pb-12">
          {/* Top Navigation Bar */}
          <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80">
            <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setSidebarOpen(true)}
                  aria-label="Open menu"
                  className="w-10 h-10 -ml-1 rounded-xl flex items-center justify-center text-slate-700 hover:bg-slate-100 active:scale-95 transition"
                >
                  <i className="fa-solid fa-bars text-lg"></i>
                </button>
                <button type="button" onClick={() => setPage('home')} className="flex items-center gap-2 whitespace-nowrap shrink-0">
                  <span className="w-8 h-8 rounded-lg bg-orange-600 text-white flex items-center justify-center shadow-sm">
                    <i className="fa-solid fa-bolt text-sm"></i>
                  </span>
                  <span className="text-lg font-extrabold tracking-tight text-slate-900">Quick Kart</span>
                </button>
              </div>

              <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
                <button type="button" onClick={() => setPage('home')} className={`hover:text-slate-900 whitespace-nowrap ${page === 'home' ? 'text-orange-600 font-bold' : ''}`}>Home</button>
                <button type="button" onClick={() => setPage('shop')} className={`hover:text-slate-900 whitespace-nowrap ${page === 'shop' ? 'text-orange-600 font-bold' : ''}`}>Shop</button>
                <button type="button" onClick={() => setPage('orders')} className={`hover:text-slate-900 whitespace-nowrap ${page === 'orders' ? 'text-orange-600 font-bold' : ''}`}>Orders</button>
                <button type="button" onClick={() => setPage(currentUser ? 'profile' : 'login')} className={`hover:text-slate-900 whitespace-nowrap ${page === 'profile' ? 'text-orange-600 font-bold' : ''}`}>
                  {currentUser ? 'Profile' : 'Sign In'}
                </button>
              </nav>

              <div className="flex items-center gap-2 shrink-0">
                <div className="hidden sm:flex items-center relative w-52 lg:w-64">
                  <i className="fa-solid fa-magnifying-glass text-slate-400 text-xs absolute left-3.5 pointer-events-none"></i>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      if (page !== 'shop') setPage('shop');
                    }}
                    placeholder="Search products..."
                    className="w-full h-9 pl-9 pr-3 rounded-xl bg-slate-100 text-sm text-slate-900 placeholder-slate-400 border border-transparent focus:border-orange-500 focus:bg-white focus:outline-none transition"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleDownloadZip}
                  className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl bg-orange-600 text-white text-xs font-bold hover:bg-orange-700 active:scale-95 transition whitespace-nowrap shadow-xs"
                >
                  <i className="fa-solid fa-download"></i>
                  <span>Download ZIP</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPhpModalOpen(true)}
                  className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 transition whitespace-nowrap"
                >
                  <i className="fa-solid fa-code"></i>
                  <span>PHP Files</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPage('cart')}
                  className="relative w-10 h-10 rounded-xl flex items-center justify-center text-slate-700 hover:bg-slate-100 transition"
                  aria-label="Cart"
                >
                  <i className="fa-solid fa-bag-shopping text-lg"></i>
                  {cartCount > 0 && (
                    <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-orange-600 text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                      {cartCount}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {(page === 'home' || page === 'shop') && (
              <div className="sm:hidden px-4 pb-2.5">
                <div className="relative flex items-center">
                  <i className="fa-solid fa-magnifying-glass text-slate-400 text-xs absolute left-3.5 pointer-events-none"></i>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      if (page !== 'shop') setPage('shop');
                    }}
                    placeholder="Search essentials, audio, footwear..."
                    className="w-full h-10 pl-9 pr-4 rounded-xl bg-slate-100 text-sm text-slate-900 placeholder-slate-400 border border-transparent focus:border-orange-500 focus:bg-white focus:outline-none transition"
                  />
                </div>
              </div>
            )}
          </header>

          {/* Sliding Mobile Sidebar Drawer */}
          {sidebarOpen && <div onClick={() => setSidebarOpen(false)} className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs" />}
          <aside className={`fixed top-0 left-0 bottom-0 z-50 w-72 bg-white border-r border-slate-200 shadow-2xl transform transition-transform duration-200 flex flex-col ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-lg bg-orange-600 text-white flex items-center justify-center">
                  <i className="fa-solid fa-bolt text-sm"></i>
                </span>
                <span className="text-base font-extrabold text-slate-900">Quick Kart</span>
              </div>
              <button type="button" onClick={() => setSidebarOpen(false)} className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100">
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <div className="px-5 py-4 bg-slate-50 border-b border-slate-100">
              {currentUser ? (
                <>
                  <p className="text-sm font-bold text-slate-900 truncate">{currentUser.name}</p>
                  <p className="text-xs text-slate-500 truncate mt-0.5">{currentUser.email}</p>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold text-slate-800">Welcome, Guest</p>
                  <button
                    type="button"
                    onClick={() => {
                      setPage('login');
                      setSidebarOpen(false);
                    }}
                    className="inline-flex items-center gap-1.5 mt-1.5 text-xs font-semibold text-orange-600"
                  >
                    <span>Sign in or Create Account</span>
                    <i className="fa-solid fa-arrow-right text-[10px]"></i>
                  </button>
                </>
              )}
            </div>

            <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
              {[
                { id: 'home', label: 'Home', icon: 'fa-house' },
                { id: 'shop', label: 'All Products', icon: 'fa-store' },
                { id: 'cart', label: 'My Cart', icon: 'fa-bag-shopping' },
                { id: 'orders', label: 'My Orders', icon: 'fa-box' },
                { id: 'profile', label: 'My Profile', icon: 'fa-user' },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    if (item.id === 'profile' && !currentUser) setPage('login');
                    else setPage(item.id as UserPage);
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium ${
                    page === item.id ? 'bg-orange-50 text-orange-600 font-semibold' : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <i className={`fa-solid ${item.icon} w-5 text-center`}></i>
                  <span>{item.label}</span>
                </button>
              ))}

              <div className="pt-3 mt-3 border-t border-slate-100 space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    setSidebarOpen(false);
                    setMode('admin');
                  }}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  <i className="fa-solid fa-shield-halved w-5 text-center text-orange-600"></i>
                  <span>Admin Panel</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSidebarOpen(false);
                    setPhpModalOpen(true);
                  }}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  <i className="fa-brands fa-php w-5 text-center text-indigo-600"></i>
                  <span>Inspect PHP Files</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSidebarOpen(false);
                    handleDownloadZip();
                  }}
                  className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-bold bg-orange-600 text-white hover:bg-orange-700 transition"
                >
                  <i className="fa-solid fa-file-zipper"></i>
                  <span>Download ZIP (quick-kart)</span>
                </button>
              </div>
            </nav>

            <div className="p-4 border-t border-slate-100">
              {currentUser ? (
                <button
                  type="button"
                  onClick={() => {
                    setCurrentUser(null);
                    setSidebarOpen(false);
                    setPage('login');
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-100 text-slate-800 text-sm font-semibold flex items-center justify-center gap-2 hover:bg-slate-200"
                >
                  <i className="fa-solid fa-right-from-bracket"></i>
                  <span>Logout</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setSidebarOpen(false);
                    setPage('login');
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-900 text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-slate-800"
                >
                  <i className="fa-solid fa-right-to-bracket"></i>
                  <span>Login / Sign Up</span>
                </button>
              )}
            </div>
          </aside>

          {/* Page Content */}
          {page === 'home' && (
            <main className="max-w-7xl mx-auto px-4 py-5 space-y-7">
              <section className="relative rounded-3xl overflow-hidden bg-slate-900 text-white shadow-sm">
                <div className="grid md:grid-cols-2 items-stretch">
                  <div className="p-6 sm:p-10 flex flex-col justify-center">
                    <p className="text-xs font-semibold text-orange-400 tracking-wide">Curated Daily Essentials</p>
                    <h1 className="mt-2 text-2xl sm:text-4xl font-extrabold tracking-tight leading-tight">
                      Smart tech &amp; everyday carry, delivered fast.
                    </h1>
                    <p className="mt-3 text-sm text-slate-300 max-w-md leading-relaxed">
                      Shop studio-grade audio, titanium wearables, and commuter gear with instant Cash on Delivery.
                    </p>
                    <div className="mt-6 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setPage('shop')}
                        className="px-5 py-2.5 rounded-xl bg-orange-600 text-white text-sm font-bold hover:bg-orange-700 transition inline-flex items-center gap-2 whitespace-nowrap"
                      >
                        <span>Explore Catalog</span>
                        <i className="fa-solid fa-arrow-right text-xs"></i>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPage('orders')}
                        className="px-4 py-2.5 rounded-xl bg-white/10 text-white text-sm font-semibold hover:bg-white/15 transition whitespace-nowrap"
                      >
                        Track Orders
                      </button>
                    </div>
                  </div>
                  <div className="h-48 sm:h-64 md:h-auto">
                    <img src="/src/assets/images/hero_quick_kart_1794891801002.jpg" alt="Quick Kart Essentials" className="w-full h-full object-cover" />
                  </div>
                </div>
              </section>

              <section>
                <div className="flex items-center justify-between mb-3.5">
                  <h2 className="text-base sm:text-lg font-bold text-slate-900">Top Categories</h2>
                  <button type="button" onClick={() => { setFilterCatId(0); setPage('shop'); }} className="text-xs font-semibold text-orange-600 hover:text-orange-700">
                    View All <i className="fa-solid fa-chevron-right text-[10px] ml-0.5"></i>
                  </button>
                </div>
                <div className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-1">
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        setFilterCatId(cat.id);
                        setPage('shop');
                      }}
                      className="shrink-0 w-24 sm:w-28 bg-white rounded-2xl border border-slate-200/80 p-3 flex flex-col items-center text-center hover:border-orange-300 hover:shadow-sm transition"
                    >
                      <img src={cat.image} alt={cat.name} className="w-12 h-12 rounded-xl object-cover bg-slate-100" />
                      <span className="mt-2 text-xs font-semibold text-slate-800 truncate w-full">{cat.name}</span>
                    </button>
                  ))}
                </div>
              </section>

              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base sm:text-lg font-bold text-slate-900">Featured Products</h2>
                  <span className="text-xs text-slate-500">Cash on Delivery available</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-5">
                  {products.map((prod) => (
                    <div key={prod.id} className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden flex flex-col hover:shadow-md transition">
                      <button type="button" onClick={() => openProductDetail(prod)} className="block aspect-square bg-slate-100 overflow-hidden">
                        <img src={prod.image} alt={prod.name} className="w-full h-full object-cover hover:scale-105 transition duration-300" />
                      </button>
                      <div className="p-3.5 flex-1 flex flex-col">
                        <p className="text-[11px] font-medium text-slate-500 truncate">{categories.find((c) => c.id === prod.cat_id)?.name || 'General'}</p>
                        <button type="button" onClick={() => openProductDetail(prod)} className="mt-0.5 text-left text-sm font-bold text-slate-900 line-clamp-2 hover:text-orange-600 transition">
                          {prod.name}
                        </button>
                        <div className="mt-auto pt-3 flex items-center justify-between gap-2">
                          <span className="text-sm sm:text-base font-extrabold text-slate-900 font-mono tabular-nums">{formatINR(prod.price)}</span>
                          {prod.stock > 0 ? (
                            <button
                              type="button"
                              onClick={() => addToCart(prod, 1)}
                              className="h-9 px-3 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-orange-600 active:scale-95 transition flex items-center gap-1.5 shrink-0"
                            >
                              <i className="fa-solid fa-plus text-[10px]"></i>
                              <span>Add</span>
                            </button>
                          ) : (
                            <span className="text-[11px] font-semibold text-rose-600">Out of stock</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </main>
          )}

          {page === 'shop' && (
            <main className="max-w-7xl mx-auto px-4 py-5 space-y-5">
              <section className="bg-white rounded-2xl border border-slate-200/80 p-4 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Category</label>
                  <select value={filterCatId} onChange={(e) => setFilterCatId(Number(e.target.value))} className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 text-sm">
                    <option value={0}>All Categories</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Max Price (₹)</label>
                  <select value={maxPrice} onChange={(e) => setMaxPrice(Number(e.target.value))} className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 text-sm">
                    <option value={0}>Any Price</option>
                    <option value={1500}>Under ₹1,500</option>
                    <option value={3000}>Under ₹3,000</option>
                    <option value={5000}>Under ₹5,000</option>
                    <option value={10000}>Under ₹10,000</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Sort By</label>
                  <select value={sortBy} onChange={(e) => setSortBy(e.target.value as 'newest' | 'price_asc' | 'price_desc')} className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 text-sm">
                    <option value="newest">Newest First</option>
                    <option value="price_asc">Price: Low to High</option>
                    <option value="price_desc">Price: High to Low</option>
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setFilterCatId(0);
                    setMaxPrice(0);
                    setSortBy('newest');
                    setSearchQuery('');
                  }}
                  className="w-full h-10 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-1.5"
                >
                  <i className="fa-solid fa-rotate-left"></i>
                  <span>Reset Filters</span>
                </button>
              </section>

              <div className="flex items-center justify-between">
                <h1 className="text-base sm:text-lg font-bold text-slate-900">
                  {searchQuery ? `Results for "${searchQuery}"` : 'All Products'}
                </h1>
                <span className="text-xs font-medium text-slate-500 tabular-nums">{filteredProducts.length} items</span>
              </div>

              {filteredProducts.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
                  <i className="fa-solid fa-box-open text-3xl text-slate-300"></i>
                  <p className="mt-3 text-sm font-semibold text-slate-700">No products match your filters.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-5">
                  {filteredProducts.map((prod) => (
                    <div key={prod.id} className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden flex flex-col hover:shadow-md transition">
                      <button type="button" onClick={() => openProductDetail(prod)} className="block aspect-square bg-slate-100 overflow-hidden">
                        <img src={prod.image} alt={prod.name} className="w-full h-full object-cover" />
                      </button>
                      <div className="p-3.5 flex-1 flex flex-col">
                        <p className="text-[11px] font-medium text-slate-500 truncate">{categories.find((c) => c.id === prod.cat_id)?.name || 'General'}</p>
                        <button type="button" onClick={() => openProductDetail(prod)} className="mt-0.5 text-left text-sm font-bold text-slate-900 line-clamp-2 hover:text-orange-600">
                          {prod.name}
                        </button>
                        <div className="mt-auto pt-3 flex items-center justify-between gap-2">
                          <span className="text-sm sm:text-base font-extrabold text-slate-900 font-mono tabular-nums">{formatINR(prod.price)}</span>
                          {prod.stock > 0 ? (
                            <button type="button" onClick={() => addToCart(prod, 1)} className="h-9 px-3 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-orange-600 transition flex items-center gap-1.5">
                              <i className="fa-solid fa-cart-plus text-[11px]"></i>
                              <span>Add</span>
                            </button>
                          ) : (
                            <span className="text-[11px] font-semibold text-rose-600">Sold out</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </main>
          )}

          {page === 'detail' && selectedProduct && (
            <main className="max-w-6xl mx-auto px-4 py-5 space-y-8">
              <button type="button" onClick={() => setPage('shop')} className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900">
                <i className="fa-solid fa-arrow-left"></i> Back to Shop
              </button>
              <div className="grid md:grid-cols-2 gap-6 items-start">
                <div className="bg-white rounded-3xl border border-slate-200/80 overflow-hidden">
                  <div className="aspect-square bg-slate-100 relative overflow-hidden">
                    <img
                      src={detailSlideIdx === 0 ? selectedProduct.image : '/src/assets/images/hero_quick_kart_1794891801002.jpg'}
                      alt={selectedProduct.name}
                      className="w-full h-full object-cover transition duration-300"
                    />
                    <button
                      type="button"
                      onClick={() => setDetailSlideIdx((i) => (i === 0 ? 1 : 0))}
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 text-slate-800 shadow-md flex items-center justify-center"
                    >
                      <i className="fa-solid fa-chevron-left text-xs"></i>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDetailSlideIdx((i) => (i === 0 ? 1 : 0))}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 text-slate-800 shadow-md flex items-center justify-center"
                    >
                      <i className="fa-solid fa-chevron-right text-xs"></i>
                    </button>
                  </div>
                  <div className="p-3 flex items-center justify-center gap-2 border-t border-slate-100">
                    {[selectedProduct.image, '/src/assets/images/hero_quick_kart_1794891801002.jpg'].map((img, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setDetailSlideIdx(idx)}
                        className={`w-14 h-14 rounded-xl overflow-hidden border-2 ${detailSlideIdx === idx ? 'border-orange-600' : 'border-slate-200'}`}
                      >
                        <img src={img} alt={`Slide ${idx + 1}`} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-white rounded-3xl border border-slate-200/80 p-6 space-y-5">
                  <div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span>{categories.find((c) => c.id === selectedProduct.cat_id)?.name || 'Collection'}</span>
                      <span>·</span>
                      {selectedProduct.stock > 0 ? (
                        <span className="text-emerald-700 font-semibold"><i className="fa-solid fa-circle-check mr-1"></i>In Stock ({selectedProduct.stock})</span>
                      ) : (
                        <span className="text-rose-600 font-semibold"><i className="fa-solid fa-circle-xmark mr-1"></i>Out of Stock</span>
                      )}
                    </div>
                    <h1 className="mt-2 text-2xl font-extrabold text-slate-900">{selectedProduct.name}</h1>
                    <p className="mt-2 text-2xl font-extrabold text-slate-900 font-mono tabular-nums">{formatINR(selectedProduct.price)}</p>
                    <p className="text-xs text-slate-500 mt-0.5">Inclusive of all taxes · Cash on Delivery available</p>
                  </div>

                  <div className="pt-4 border-t border-slate-100">
                    <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Description</h2>
                    <p className="mt-2 text-sm text-slate-600 leading-relaxed">{selectedProduct.description}</p>
                  </div>

                  {selectedProduct.stock > 0 && (
                    <div className="pt-4 border-t border-slate-100 space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-slate-700">Quantity</span>
                        <div className="inline-flex items-center rounded-xl border border-slate-200 bg-slate-50">
                          <button type="button" onClick={() => setDetailQty((q) => Math.max(1, q - 1))} className="w-10 h-10 flex items-center justify-center text-slate-700">
                            <i className="fa-solid fa-minus text-xs"></i>
                          </button>
                          <span className="w-10 text-center text-sm font-bold tabular-nums">{detailQty}</span>
                          <button type="button" onClick={() => setDetailQty((q) => Math.min(selectedProduct.stock, q + 1))} className="w-10 h-10 flex items-center justify-center text-slate-700">
                            <i className="fa-solid fa-plus text-xs"></i>
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <button type="button" onClick={() => addToCart(selectedProduct, detailQty, false)} className="h-12 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 transition flex items-center justify-center gap-2">
                          <i className="fa-solid fa-bag-shopping"></i>
                          <span>Add to Cart</span>
                        </button>
                        <button type="button" onClick={() => addToCart(selectedProduct, detailQty, true)} className="h-12 rounded-xl bg-orange-600 text-white text-sm font-bold hover:bg-orange-700 transition flex items-center justify-center gap-2">
                          <i className="fa-solid fa-bolt"></i>
                          <span>Buy Now</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <section>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 mb-4">Related Products</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {products
                    .filter((p) => p.id !== selectedProduct.id)
                    .slice(0, 4)
                    .map((rel) => (
                      <button
                        key={rel.id}
                        type="button"
                        onClick={() => openProductDetail(rel)}
                        className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden hover:shadow-md transition text-left flex flex-col"
                      >
                        <img src={rel.image} alt={rel.name} className="w-full aspect-square object-cover bg-slate-100" />
                        <div className="p-3 w-full">
                          <p className="text-sm font-bold text-slate-900 truncate">{rel.name}</p>
                          <p className="mt-1 text-sm font-extrabold text-orange-600 font-mono tabular-nums">{formatINR(rel.price)}</p>
                        </div>
                      </button>
                    ))}
                </div>
              </section>
            </main>
          )}

          {page === 'cart' && (
            <main className="max-w-4xl mx-auto px-4 py-5 space-y-5">
              <div className="flex items-center justify-between">
                <h1 className="text-xl font-extrabold text-slate-900">Shopping Cart</h1>
                <span className="text-xs font-semibold text-slate-500 tabular-nums">{cartCount} items</span>
              </div>

              {cart.length === 0 ? (
                <div className="bg-white rounded-3xl border border-slate-200 p-10 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                    <i className="fa-solid fa-bag-shopping text-2xl"></i>
                  </div>
                  <h2 className="mt-4 text-base font-bold text-slate-900">Your cart is empty</h2>
                  <p className="mt-1 text-xs text-slate-500">Add essentials from our catalog to get started.</p>
                  <button type="button" onClick={() => setPage('shop')} className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-orange-600 transition">
                    <span>Browse Products</span>
                    <i className="fa-solid fa-arrow-right text-xs"></i>
                  </button>
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    {cart.map((entry) => (
                      <div key={entry.product.id} className="bg-white rounded-2xl border border-slate-200/80 p-3.5 flex items-center gap-3.5">
                        <img src={entry.product.image} alt={entry.product.name} className="w-20 h-20 rounded-xl bg-slate-100 object-cover shrink-0" />
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-bold text-slate-900 truncate">{entry.product.name}</h3>
                          <p className="text-xs text-slate-500 font-mono tabular-nums mt-0.5">{formatINR(entry.product.price)} each</p>
                          <div className="mt-2.5 flex items-center justify-between gap-2">
                            <div className="inline-flex items-center rounded-xl border border-slate-200 bg-slate-50">
                              <button type="button" onClick={() => updateCartQty(entry.product.id, entry.quantity - 1)} className="w-8 h-8 flex items-center justify-center text-slate-700">
                                <i className="fa-solid fa-minus text-[10px]"></i>
                              </button>
                              <span className="w-9 text-center text-xs font-bold tabular-nums">{entry.quantity}</span>
                              <button type="button" onClick={() => updateCartQty(entry.product.id, entry.quantity + 1)} className="w-8 h-8 flex items-center justify-center text-slate-700">
                                <i className="fa-solid fa-plus text-[10px]"></i>
                              </button>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-extrabold text-slate-900 font-mono tabular-nums">{formatINR(entry.product.price * entry.quantity)}</span>
                              <button
                                type="button"
                                onClick={() =>
                                  showModal({
                                    title: 'Remove Item',
                                    message: `Remove ${entry.product.name} from cart?`,
                                    confirmText: 'Remove',
                                    onConfirm: () => updateCartQty(entry.product.id, 0),
                                  })
                                }
                                className="w-8 h-8 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center"
                              >
                                <i className="fa-solid fa-trash-can text-xs"></i>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
                    <div className="flex items-center justify-between text-sm text-slate-600">
                      <span>Delivery (Cash on Delivery)</span>
                      <span className="font-semibold text-emerald-700">Free</span>
                    </div>
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-base font-bold text-slate-900">Total Payable</span>
                      <span className="text-xl font-extrabold text-slate-900 font-mono tabular-nums">{formatINR(cartTotal)}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (!currentUser) {
                          setPage('login');
                        } else {
                          setPage('checkout');
                        }
                      }}
                      className="w-full h-12 rounded-xl bg-orange-600 text-white text-sm font-bold hover:bg-orange-700 transition flex items-center justify-center gap-2"
                    >
                      <span>Proceed to Checkout</span>
                      <i className="fa-solid fa-arrow-right text-xs"></i>
                    </button>
                  </div>
                </>
              )}
            </main>
          )}

          {page === 'checkout' && (
            <main className="max-w-2xl mx-auto px-4 py-6 space-y-5">
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setPage('cart')} className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-700">
                  <i className="fa-solid fa-arrow-left text-xs"></i>
                </button>
                <div>
                  <h1 className="text-xl font-extrabold text-slate-900">Checkout</h1>
                  <p className="text-xs text-slate-500">{cartCount} items · Total {formatINR(cartTotal)}</p>
                </div>
              </div>

              <form onSubmit={handlePlaceOrder} className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Full Name</label>
                  <input type="text" value={checkoutName} onChange={(e) => setCheckoutName(e.target.value)} required className="w-full h-11 px-4 rounded-xl bg-slate-50 border border-slate-200 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Phone Number</label>
                  <input type="tel" value={checkoutPhone} onChange={(e) => setCheckoutPhone(e.target.value)} required className="w-full h-11 px-4 rounded-xl bg-slate-50 border border-slate-200 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Delivery Address</label>
                  <textarea rows={3} value={checkoutAddress} onChange={(e) => setCheckoutAddress(e.target.value)} required className="w-full p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm" />
                </div>
                <div className="p-4 rounded-2xl border-2 border-orange-500 bg-orange-50/50 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-10 h-10 rounded-xl bg-orange-600 text-white flex items-center justify-center">
                      <i className="fa-solid fa-money-bill-wave"></i>
                    </span>
                    <div>
                      <p className="text-sm font-bold text-slate-900">Cash on Delivery (COD)</p>
                      <p className="text-xs text-slate-500">Pay {formatINR(cartTotal)} upon delivery</p>
                    </div>
                  </div>
                  <i className="fa-solid fa-circle-check text-orange-600 text-lg"></i>
                </div>
                <button type="submit" className="w-full h-12 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-orange-600 transition flex items-center justify-center gap-2">
                  <i className="fa-solid fa-check"></i>
                  <span>Confirm COD Order</span>
                </button>
              </form>
            </main>
          )}

          {page === 'orders' && (
            <main className="max-w-3xl mx-auto px-4 py-5 space-y-5">
              <div className="flex items-center justify-between">
                <h1 className="text-xl font-extrabold text-slate-900">My Orders</h1>
                <button type="button" onClick={() => setPage('shop')} className="text-xs font-semibold text-orange-600">Shop More</button>
              </div>

              <div className="grid grid-cols-2 p-1 bg-slate-200/70 rounded-xl">
                <button
                  type="button"
                  onClick={() => setOrderTab('active')}
                  className={`py-2.5 text-xs font-bold rounded-lg transition ${orderTab === 'active' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'}`}
                >
                  Active Orders ({activeOrders.length})
                </button>
                <button
                  type="button"
                  onClick={() => setOrderTab('history')}
                  className={`py-2.5 text-xs font-bold rounded-lg transition ${orderTab === 'history' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'}`}
                >
                  Order History ({historyOrders.length})
                </button>
              </div>

              <div className="space-y-4">
                {(orderTab === 'active' ? activeOrders : historyOrders).length === 0 ? (
                  <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
                    <i className="fa-solid fa-box text-3xl text-slate-300"></i>
                    <p className="mt-3 text-sm font-semibold text-slate-700">No orders in this tab yet.</p>
                  </div>
                ) : (
                  (orderTab === 'active' ? activeOrders : historyOrders).map(renderOrderCard)
                )}
              </div>
            </main>
          )}

          {page === 'profile' && currentUser && (
            <main className="max-w-2xl mx-auto px-4 py-6 space-y-5">
              <div className="bg-white rounded-3xl border border-slate-200 p-6 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-14 h-14 rounded-2xl bg-orange-600 text-white flex items-center justify-center text-xl font-extrabold shrink-0">
                    {currentUser.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h1 className="text-lg font-extrabold text-slate-900 truncate">{currentUser.name}</h1>
                    <p className="text-xs text-slate-500 truncate">{currentUser.email}</p>
                  </div>
                </div>
                <button type="button" onClick={() => setPage('orders')} className="px-4 py-2 rounded-xl bg-slate-100 text-slate-800 text-xs font-bold">My Orders</button>
              </div>

              <form onSubmit={handleProfileSave} className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4">
                <h2 className="text-base font-bold text-slate-900">Account Details</h2>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Full Name</label>
                    <input type="text" value={profName} onChange={(e) => setProfName(e.target.value)} required className="w-full h-11 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Phone</label>
                    <input type="tel" value={profPhone} onChange={(e) => setProfPhone(e.target.value)} required className="w-full h-11 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Email</label>
                  <input type="email" value={profEmail} onChange={(e) => setProfEmail(e.target.value)} required className="w-full h-11 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Address</label>
                  <textarea rows={3} value={profAddress} onChange={(e) => setProfAddress(e.target.value)} className="w-full p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm" />
                </div>
                <button type="submit" className="w-full h-11 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 transition">Save Profile Changes</button>
              </form>

              <form onSubmit={handlePasswordChange} className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4">
                <h2 className="text-base font-bold text-slate-900">Change Password</h2>
                <div className="grid sm:grid-cols-2 gap-4">
                  <input type="password" value={currPass} onChange={(e) => setCurrPass(e.target.value)} required placeholder="Current Password" className="w-full h-11 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm" />
                  <input type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} required minLength={6} placeholder="New Password" className="w-full h-11 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm" />
                </div>
                <button type="submit" className="w-full h-11 rounded-xl bg-orange-600 text-white text-sm font-bold hover:bg-orange-700 transition">Update Password</button>
              </form>

              <button
                type="button"
                onClick={() => {
                  setCurrentUser(null);
                  setPage('login');
                }}
                className="w-full h-11 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm font-bold flex items-center justify-center gap-2"
              >
                <i className="fa-solid fa-right-from-bracket"></i> Logout
              </button>
            </main>
          )}

          {page === 'login' && (
            <main className="max-w-md mx-auto px-4 py-8">
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 pt-7 pb-5 text-center border-b border-slate-100">
                  <div className="w-12 h-12 rounded-2xl bg-orange-600 text-white flex items-center justify-center mx-auto shadow-md shadow-orange-600/20">
                    <i className="fa-solid fa-bolt text-xl"></i>
                  </div>
                  <h1 className="mt-3 text-xl font-extrabold text-slate-900">Welcome to Quick Kart</h1>
                  <p className="mt-1 text-xs text-slate-500">Demo account: aarav@quickkart.in / demo1234</p>
                  <div className="mt-5 grid grid-cols-2 p-1 bg-slate-100 rounded-xl">
                    <button type="button" onClick={() => { setAuthTab('login'); setAuthError(''); }} className={`py-2 text-xs font-bold rounded-lg transition ${authTab === 'login' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'}`}>Login</button>
                    <button type="button" onClick={() => { setAuthTab('signup'); setAuthError(''); }} className={`py-2 text-xs font-bold rounded-lg transition ${authTab === 'signup' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'}`}>Sign Up</button>
                  </div>
                </div>
                <div className="p-6">
                  {authError && (
                    <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
                      <i className="fa-solid fa-circle-exclamation"></i>
                      <span>{authError}</span>
                    </div>
                  )}
                  {authTab === 'login' ? (
                    <form onSubmit={handleLogin} className="space-y-4">
                      <input type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} required placeholder="Email Address" className="w-full h-11 px-4 rounded-xl bg-slate-50 border border-slate-200 text-sm" />
                      <input type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} required placeholder="Password" className="w-full h-11 px-4 rounded-xl bg-slate-50 border border-slate-200 text-sm" />
                      <button type="submit" className="w-full h-11 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 transition">Sign In</button>
                    </form>
                  ) : (
                    <form onSubmit={handleSignup} className="space-y-4">
                      <input type="text" value={signupName} onChange={(e) => setSignupName(e.target.value)} required placeholder="Full Name" className="w-full h-11 px-4 rounded-xl bg-slate-50 border border-slate-200 text-sm" />
                      <input type="tel" value={signupPhone} onChange={(e) => setSignupPhone(e.target.value)} required placeholder="Phone Number" className="w-full h-11 px-4 rounded-xl bg-slate-50 border border-slate-200 text-sm" />
                      <input type="email" value={signupEmail} onChange={(e) => setSignupEmail(e.target.value)} required placeholder="Email Address" className="w-full h-11 px-4 rounded-xl bg-slate-50 border border-slate-200 text-sm" />
                      <input type="password" value={signupPassword} onChange={(e) => setSignupPassword(e.target.value)} required minLength={6} placeholder="Password (min 6 chars)" className="w-full h-11 px-4 rounded-xl bg-slate-50 border border-slate-200 text-sm" />
                      <button type="submit" className="w-full h-11 rounded-xl bg-orange-600 text-white text-sm font-bold hover:bg-orange-700 transition">Create Account</button>
                    </form>
                  )}
                </div>
              </div>
            </main>
          )}

          {/* Fixed Mobile Bottom Nav */}
          <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200">
            <div className="grid grid-cols-4 h-16 items-center">
              <button type="button" onClick={() => setPage('home')} className={`flex flex-col items-center justify-center h-full ${page === 'home' ? 'text-orange-600' : 'text-slate-500'}`}>
                <i className="fa-solid fa-house text-lg"></i>
                <span className="text-[10px] font-semibold mt-1">Home</span>
              </button>
              <button type="button" onClick={() => setPage('shop')} className={`flex flex-col items-center justify-center h-full ${page === 'shop' || page === 'detail' ? 'text-orange-600' : 'text-slate-500'}`}>
                <i className="fa-solid fa-border-all text-lg"></i>
                <span className="text-[10px] font-semibold mt-1">Shop</span>
              </button>
              <button type="button" onClick={() => setPage('cart')} className={`relative flex flex-col items-center justify-center h-full ${page === 'cart' || page === 'checkout' ? 'text-orange-600' : 'text-slate-500'}`}>
                <div className="relative">
                  <i className="fa-solid fa-bag-shopping text-lg"></i>
                  {cartCount > 0 && (
                    <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-[16px] px-1 rounded-full bg-orange-600 text-white text-[9px] font-bold flex items-center justify-center tabular-nums">
                      {cartCount}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-semibold mt-1">Cart</span>
              </button>
              <button
                type="button"
                onClick={() => setPage(currentUser ? 'profile' : 'login')}
                className={`flex flex-col items-center justify-center h-full ${page === 'profile' || page === 'orders' || page === 'login' ? 'text-orange-600' : 'text-slate-500'}`}
              >
                <i className="fa-solid fa-user text-lg"></i>
                <span className="text-[10px] font-semibold mt-1">Profile</span>
              </button>
            </div>
          </nav>
        </div>
      )}

      {/* Square Animated Dotted Loading Modal */}
      {loader.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs">
          <div className="w-28 h-28 rounded-2xl bg-white shadow-2xl border border-slate-100 flex flex-col items-center justify-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-600 qk-dot-1"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-orange-600 qk-dot-2"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-orange-600 qk-dot-3"></span>
            </div>
            <span className="text-[11px] font-semibold text-slate-600">{loader.text}</span>
          </div>
        </div>
      )}

      {/* Reusable Tailwind Modal */}
      {modal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl border border-slate-200 p-6">
            <div className="flex items-start gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  modal.type === 'success'
                    ? 'bg-emerald-50 text-emerald-600'
                    : modal.type === 'error'
                    ? 'bg-rose-50 text-rose-600'
                    : 'bg-orange-50 text-orange-600'
                }`}
              >
                <i
                  className={`fa-solid text-lg ${
                    modal.type === 'success'
                      ? 'fa-circle-check'
                      : modal.type === 'error'
                      ? 'fa-circle-exclamation'
                      : 'fa-circle-info'
                  }`}
                ></i>
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-bold text-slate-900">{modal.title}</h3>
                <p className="mt-1 text-sm text-slate-600 leading-relaxed">{modal.message}</p>
              </div>
            </div>
            <div className="mt-5 flex items-center justify-end gap-2">
              {modal.onConfirm && (
                <button
                  type="button"
                  onClick={() => setModal((m) => ({ ...m, open: false }))}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  const fn = modal.onConfirm;
                  setModal((m) => ({ ...m, open: false }));
                  if (fn) fn();
                }}
                className="px-5 py-2 rounded-xl text-sm font-semibold bg-slate-900 text-white hover:bg-slate-800"
              >
                {modal.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

      <PhpBundleModal open={phpModalOpen} onClose={() => setPhpModalOpen(false)} />
    </div>
  );
}
