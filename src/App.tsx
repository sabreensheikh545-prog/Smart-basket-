import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AdminView } from './components/AdminView';
import {
  ASSETS,
  cancelOrderLocal,
  changePasswordLocal,
  getBootstrapData,
  loginUserLocal,
  placeOrderLocal,
  saveCart,
  setStoredCurrentUser,
  signupUserLocal,
  updateProfileLocal,
} from './store/localStore';
import {
  CartEntry,
  Category,
  Order,
  Product,
  User,
  formatINR,
  getDiscountPercent,
  getEffectiveMrp,
} from './types';

type UserPage = 'home' | 'shop' | 'detail' | 'cart' | 'checkout' | 'orders' | 'profile' | 'login';

interface ModalConfig {
  open: boolean;
  title: string;
  message: string;
  type: 'info' | 'success' | 'error';
  confirmText: string;
  onConfirm?: () => void;
}

const OFFER_BANNERS = [
  {
    id: 0,
    tag: 'Big Saving Days',
    title: 'Up to 60% Off on 5G Mobiles & Audio',
    subtitle: 'Instant deals on Redmi, Samsung, boAt & Sony with Free Delivery',
    cta: 'Shop Deals',
    catId: 1,
    image: ASSETS.bigSavingBanner,
    bgClass: 'from-[#1854C6] via-[#2874F0] to-[#0D3B9E]',
  },
  {
    id: 1,
    tag: 'Fashion Super Saver',
    title: 'Minimum 40% Off on Denim, Shoes & Bags',
    subtitle: 'Fresh casual drops from U.S. Polo Assn., Campus & Wildcraft',
    cta: 'Explore Fashion',
    catId: 2,
    image: ASSETS.fashion,
    bgClass: 'from-[#1D4ED8] via-[#2874F0] to-[#1E3A8A]',
  },
  {
    id: 2,
    tag: 'Home, Beauty & Grocery',
    title: 'Everyday Essentials Starting at ₹649',
    subtitle: 'Prestige appliances, skincare combos & dry fruits on Cash on Delivery',
    cta: 'View Essentials',
    catId: 4,
    image: ASSETS.homeAppliance,
    bgClass: 'from-[#1746A2] via-[#2874F0] to-[#1E40AF]',
  },
];

export default function App() {
  const [mode, setMode] = useState<'user' | 'admin'>('user');
  const [page, setPage] = useState<UserPage>('home');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Offline localStorage data
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [adminUsername, setAdminUsername] = useState('Seraj');
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Banner Carousel
  const [bannerIdx, setBannerIdx] = useState(0);

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
  const [loginIdentifier, setLoginIdentifier] = useState('user@quickkart.com');
  const [loginPassword, setLoginPassword] = useState('123456');
  const [signupName, setSignupName] = useState('');
  const [signupContact, setSignupContact] = useState('');
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

  const loadBootstrap = useCallback(() => {
    const data = getBootstrapData();
    setCategories(data.categories);
    setProducts(data.products);
    setOrders(data.orders);
    setUsers(data.users);
    setAdminUsername(data.adminUsername);
    setCart(data.cart);
    setCurrentUser(data.currentUser);
  }, []);

  useEffect(() => {
    loadBootstrap();
  }, [loadBootstrap]);

  // Auto-slide offer banners every 4 seconds on Home screen
  useEffect(() => {
    if (mode !== 'user' || page !== 'home') return;
    const timer = window.setInterval(() => {
      setBannerIdx((prev) => (prev + 1) % OFFER_BANNERS.length);
    }, 4200);
    return () => window.clearInterval(timer);
  }, [mode, page]);

  // Mobile UX restrictions: disable right-click, text selection, and zoom
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

  // Sync profile & checkout fields when currentUser changes
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
  const cartMrpTotal = useMemo(
    () => cart.reduce((acc, item) => acc + getEffectiveMrp(item.product.price, item.product.mrp) * item.quantity, 0),
    [cart]
  );

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

  const addToCart = (prod: Product, qty = 1, buyNow = false) => {
    if (prod.stock <= 0) {
      showModal({ title: 'Out of Stock', message: 'This item is currently unavailable.', type: 'error' });
      return;
    }
    showLoader(buyNow ? 'Preparing checkout...' : 'Adding to cart...');
    window.setTimeout(() => {
      setCart((prev) => {
        const existing = prev.find((c) => c.product.id === prod.id);
        const nextCart = existing
          ? prev.map((c) =>
              c.product.id === prod.id ? { ...c, quantity: Math.min(prod.stock, c.quantity + qty) } : c
            )
          : [...prev, { product: prod, quantity: Math.min(prod.stock, qty) }];
        saveCart(nextCart);
        return nextCart;
      });
      hideLoader();
      if (buyNow) {
        setPage(currentUser ? 'checkout' : 'cart');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        showModal({ title: 'Added to Cart', message: `${prod.name} has been added to your cart.`, type: 'success' });
      }
    }, 150);
  };

  const updateCartQty = (productId: number, qty: number) => {
    setCart((prev) => {
      const nextCart =
        qty <= 0
          ? prev.filter((c) => c.product.id !== productId)
          : prev.map((c) => (c.product.id === productId ? { ...c, quantity: Math.min(c.product.stock, qty) } : c));
      saveCart(nextCart);
      return nextCart;
    });
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    showLoader('Signing in...');
    const res = loginUserLocal(loginIdentifier, loginPassword);
    hideLoader();
    if (res.success && res.user) {
      setCurrentUser(res.user);
      setPage(cart.length > 0 ? 'checkout' : 'home');
    } else {
      setAuthError(res.message);
    }
  };

  const handleSignup = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    showLoader('Creating account...');
    const res = signupUserLocal({
      name: signupName,
      contact: signupContact,
      password: signupPassword,
    });
    hideLoader();
    if (res.success && res.user) {
      loadBootstrap();
      setCurrentUser(res.user);
      setSignupName('');
      setSignupContact('');
      setSignupPassword('');
      setPage(cart.length > 0 ? 'checkout' : 'home');
    } else {
      setAuthError(res.message);
    }
  };

  const handlePlaceOrder = (e: React.FormEvent) => {
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
    const res = placeOrderLocal({
      user_id: currentUser.id,
      name: checkoutName,
      phone: checkoutPhone,
      address: checkoutAddress,
      items: cart.map((c) => ({ product_id: c.product.id, quantity: c.quantity })),
    });
    hideLoader();
    if (res.success) {
      saveCart([]);
      loadBootstrap();
      setOrderTab('active');
      setPage('orders');
      showModal({ title: 'Order Confirmed', message: res.message, type: 'success' });
    } else {
      showModal({ title: 'Checkout Error', message: res.message, type: 'error' });
    }
  };

  const handleCancelOrder = (orderId: number) => {
    showModal({
      title: `Cancel Order #${orderId}`,
      message: 'Are you sure you want to cancel this order?',
      type: 'info',
      confirmText: 'Yes, Cancel',
      onConfirm: () => {
        showLoader('Cancelling...');
        const res = cancelOrderLocal(orderId, currentUser?.id || 1);
        hideLoader();
        loadBootstrap();
        if (!res.success) {
          showModal({ title: 'Notice', message: res.message, type: 'error' });
        }
      },
    });
  };

  const handleProfileSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    showLoader('Saving profile...');
    const res = updateProfileLocal({
      id: currentUser.id,
      name: profName,
      phone: profPhone,
      email: profEmail,
      address: profAddress,
    });
    hideLoader();
    if (res.success && res.user) {
      loadBootstrap();
      setCurrentUser(res.user);
    }
    showModal({ title: res.success ? 'Saved' : 'Error', message: res.message, type: res.success ? 'success' : 'error' });
  };

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    showLoader('Updating password...');
    const res = changePasswordLocal(currentUser.id, currPass, newPass);
    hideLoader();
    if (res.success) {
      setCurrPass('');
      setNewPass('');
    }
    showModal({ title: res.success ? 'Updated' : 'Error', message: res.message, type: res.success ? 'success' : 'error' });
  };

  const renderFlipkartProductCard = (prod: Product) => {
    const mrp = getEffectiveMrp(prod.price, prod.mrp);
    const discount = getDiscountPercent(prod.price, mrp);
    const rating = (prod.rating || 4.4).toFixed(1);
    const reviews = (prod.reviews || 1240).toLocaleString('en-IN');

    return (
      <div
        key={prod.id}
        className="bg-white rounded-lg border border-slate-200/80 overflow-hidden flex flex-col hover:shadow-md transition"
      >
        <button
          type="button"
          onClick={() => openProductDetail(prod)}
          className="relative block aspect-square bg-slate-50 overflow-hidden p-2"
        >
          <img
            src={prod.image}
            alt={prod.name}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover rounded-md hover:scale-105 transition duration-300"
          />
        </button>

        <div className="p-2.5 sm:p-3.5 flex-1 flex flex-col">
          <button
            type="button"
            onClick={() => openProductDetail(prod)}
            className="text-left text-xs sm:text-sm font-semibold text-slate-900 line-clamp-2 leading-snug hover:text-[#2874F0] transition"
          >
            {prod.name}
          </button>

          <div className="mt-1.5 flex items-center gap-1.5">
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-sm bg-[#388E3C] text-white text-[11px] font-bold leading-none tabular-nums">
              <span>{rating}</span>
              <i className="fa-solid fa-star text-[9px]"></i>
            </span>
            <span className="text-[11px] text-slate-500 font-medium tabular-nums">({reviews})</span>
          </div>

          <div className="mt-2 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
            <span className="text-sm sm:text-base font-extrabold text-slate-900 font-mono tabular-nums">
              {formatINR(prod.price)}
            </span>
            {mrp > prod.price && (
              <span className="text-[11px] sm:text-xs text-slate-400 line-through font-mono tabular-nums">
                {formatINR(mrp)}
              </span>
            )}
            {discount > 0 && (
              <span className="text-[11px] sm:text-xs font-bold text-[#388E3C] tabular-nums">
                {discount}% off
              </span>
            )}
          </div>

          <p className="mt-1 text-[11px] font-medium text-slate-600">Free Delivery</p>

          <div className="mt-auto pt-2.5 grid grid-cols-2 gap-1.5">
            {prod.stock > 0 ? (
              <>
                <button
                  type="button"
                  onClick={() => addToCart(prod, 1, false)}
                  className="min-h-[38px] px-1.5 rounded-md bg-[#FF9F00] text-white text-[11px] sm:text-xs font-bold hover:bg-[#e89100] active:scale-95 transition whitespace-nowrap"
                >
                  Add to Cart
                </button>
                <button
                  type="button"
                  onClick={() => addToCart(prod, 1, true)}
                  className="min-h-[38px] px-1.5 rounded-md bg-[#FB641B] text-white text-[11px] sm:text-xs font-bold hover:bg-[#e55812] active:scale-95 transition whitespace-nowrap"
                >
                  Buy Now
                </button>
              </>
            ) : (
              <span className="col-span-2 text-center py-2 text-xs font-bold text-rose-600 bg-rose-50 rounded-md">
                Out of Stock
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderOrderCard = (ord: Order) => {
    const firstItem = ord.items[0];
    const extraCount = Math.max(0, ord.items.length - 1);
    const stage = ord.status === 'Delivered' ? 3 : ord.status === 'Dispatched' ? 2 : 1;
    const isCancelled = ord.status === 'Cancelled';
    const isExpanded = expandedOrderIds.includes(ord.id);

    return (
      <div key={ord.id} className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 flex items-center gap-3.5">
          <img
            src={firstItem?.product_image || ASSETS.smartphone}
            alt={firstItem?.product_name || 'Order'}
            referrerPolicy="no-referrer"
            className="w-16 h-16 rounded-lg bg-slate-100 object-cover shrink-0"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-mono font-semibold text-slate-500">Order #{ord.id}</span>
              <span
                className={`text-xs font-semibold inline-flex items-center gap-1 ${
                  isCancelled ? 'text-rose-600' : stage === 3 ? 'text-[#388E3C]' : stage === 2 ? 'text-[#2874F0]' : 'text-amber-700'
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
              <span className="text-[11px] text-slate-500">
                {new Date(ord.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
              </span>
            </div>
          </div>
        </div>

        {!isCancelled && (
          <div className="px-5 pt-2 pb-4 border-t border-slate-100 bg-slate-50/50">
            <div className="relative flex items-center justify-between">
              <div className="absolute left-6 right-6 top-4 h-1 bg-slate-200 rounded-full">
                <div
                  className="h-full bg-[#388E3C] rounded-full transition-all duration-300"
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
                        ? 'bg-[#388E3C] text-white shadow-sm'
                        : st.active
                        ? 'bg-[#2874F0] text-white shadow-sm'
                        : 'bg-slate-200 text-slate-500'
                    }`}
                  >
                    <i className={`fa-solid ${st.icon}`}></i>
                  </div>
                  <span
                    className={`mt-1.5 text-[11px] font-bold ${
                      st.done ? 'text-[#388E3C]' : st.active ? 'text-slate-900' : 'text-slate-400'
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
            className="text-xs font-bold text-[#2874F0] hover:underline flex items-center gap-1.5"
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
    <div className="min-h-screen bg-[#F1F3F6] text-slate-900 font-sans select-none overflow-x-hidden">
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
        <div className="pb-16 md:pb-10">
          {/* Flipkart Royal Blue Header (#2874F0) */}
          <header className="sticky top-0 z-40 bg-[#2874F0] text-white shadow-sm">
            <div className="max-w-7xl mx-auto px-3 sm:px-4 h-12 sm:h-14 flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setSidebarOpen(true)}
                  aria-label="Open menu"
                  className="w-10 h-10 -ml-1 rounded-lg flex items-center justify-center text-white hover:bg-white/10 active:scale-95 transition"
                >
                  <i className="fa-solid fa-bars text-lg"></i>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFilterCatId(0);
                    setSearchQuery('');
                    setPage('home');
                  }}
                  className="flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <span className="text-lg sm:text-xl font-extrabold italic tracking-tight text-white">
                    Quick <span className="text-[#FFE500]">Kart</span>
                  </span>
                  <i className="fa-solid fa-bolt text-[#FFE500] text-xs"></i>
                </button>
              </div>

              {/* Desktop Search Bar inside Blue Header */}
              <div className="hidden md:flex flex-1 max-w-xl mx-4">
                <div className="relative w-full flex items-center">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      if (page !== 'shop') setPage('shop');
                    }}
                    placeholder="Search for products, brands and more"
                    className="w-full h-9 pl-4 pr-10 rounded-md bg-white text-sm text-slate-900 placeholder-slate-400 focus:outline-none shadow-xs"
                  />
                  {searchQuery ? (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      aria-label="Clear search"
                      className="absolute right-2.5 text-slate-400 hover:text-slate-700"
                    >
                      <i className="fa-solid fa-xmark text-sm"></i>
                    </button>
                  ) : (
                    <i className="fa-solid fa-magnifying-glass text-[#2874F0] text-sm absolute right-3.5 pointer-events-none"></i>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1 sm:gap-4 shrink-0">
                <nav className="hidden lg:flex items-center gap-5 text-sm font-semibold text-white">
                  <button
                    type="button"
                    onClick={() => setPage('home')}
                    className={`hover:text-[#FFE500] whitespace-nowrap ${page === 'home' ? 'text-[#FFE500]' : ''}`}
                  >
                    Home
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage('shop')}
                    className={`hover:text-[#FFE500] whitespace-nowrap ${page === 'shop' ? 'text-[#FFE500]' : ''}`}
                  >
                    Shop
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage('orders')}
                    className={`hover:text-[#FFE500] whitespace-nowrap ${page === 'orders' ? 'text-[#FFE500]' : ''}`}
                  >
                    Orders
                  </button>
                </nav>

                <button
                  type="button"
                  onClick={() => setPage(currentUser ? 'profile' : 'login')}
                  className="inline-flex items-center gap-1.5 h-9 px-2.5 sm:px-4 rounded-md bg-white text-[#2874F0] text-xs font-bold hover:bg-blue-50 transition whitespace-nowrap"
                >
                  <i className="fa-solid fa-user text-[11px]"></i>
                  <span>{currentUser ? currentUser.name.split(' ')[0] : 'Login'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPage('cart')}
                  className="relative w-10 h-10 rounded-lg flex items-center justify-center text-white hover:bg-white/10 transition"
                  aria-label="Shopping Cart"
                >
                  <i className="fa-solid fa-cart-shopping text-lg"></i>
                  {cartCount > 0 && (
                    <span className="absolute top-1 right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#FFE500] text-[#2874F0] text-[10px] font-extrabold flex items-center justify-center tabular-nums shadow-xs">
                      {cartCount}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Mobile Search Bar right inside the Royal Blue Header */}
            <div className="md:hidden px-3 pb-2.5">
              <div className="relative flex items-center">
                <i className="fa-solid fa-magnifying-glass text-slate-400 text-xs absolute left-3.5 pointer-events-none"></i>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    if (page !== 'shop') setPage('shop');
                  }}
                  placeholder="Search for products, brands and more"
                  className="w-full h-9 pl-9 pr-8 rounded-md bg-white text-sm text-slate-900 placeholder-slate-400 focus:outline-none shadow-xs"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    aria-label="Clear search"
                    className="absolute right-2.5 text-slate-400 hover:text-slate-700"
                  >
                    <i className="fa-solid fa-xmark text-xs"></i>
                  </button>
                )}
              </div>
            </div>
          </header>

          {/* Sliding Mobile Sidebar Drawer */}
          {sidebarOpen && <div onClick={() => setSidebarOpen(false)} className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs" />}
          <aside className={`fixed top-0 left-0 bottom-0 z-50 w-72 bg-white border-r border-slate-200 shadow-2xl transform transition-transform duration-200 flex flex-col ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
            <div className="px-5 py-4 bg-[#2874F0] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg font-extrabold italic">
                  Quick <span className="text-[#FFE500]">Kart</span>
                </span>
                <i className="fa-solid fa-bolt text-[#FFE500] text-xs"></i>
              </div>
              <button type="button" onClick={() => setSidebarOpen(false)} className="w-10 h-10 rounded-lg flex items-center justify-center text-white hover:bg-white/10">
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200/80">
              {currentUser ? (
                <>
                  <p className="text-sm font-bold text-slate-900 truncate">{currentUser.name}</p>
                  <p className="text-xs text-slate-500 truncate mt-0.5">{currentUser.email || currentUser.phone}</p>
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
                    className="inline-flex items-center gap-1.5 mt-1 text-xs font-bold text-[#2874F0]"
                  >
                    <span>Login or Sign Up</span>
                    <i className="fa-solid fa-arrow-right text-[10px]"></i>
                  </button>
                </>
              )}
            </div>

            <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
              {[
                { id: 'home', label: 'Home', icon: 'fa-house' },
                { id: 'shop', label: 'All Categories', icon: 'fa-table-cells-large' },
                { id: 'cart', label: 'My Cart', icon: 'fa-cart-shopping' },
                { id: 'orders', label: 'My Orders', icon: 'fa-box' },
                { id: 'profile', label: 'My Account', icon: 'fa-user' },
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
                    page === item.id ? 'bg-blue-50 text-[#2874F0] font-bold' : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <i className={`fa-solid ${item.icon} w-5 text-center`}></i>
                  <span>{item.label}</span>
                </button>
              ))}

              <div className="pt-3 mt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setSidebarOpen(false);
                    setMode('admin');
                  }}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-100"
                >
                  <i className="fa-solid fa-shield-halved w-5 text-center text-[#2874F0]"></i>
                  <span>Seller / Admin Panel</span>
                </button>
              </div>
            </nav>

            <div className="p-4 border-t border-slate-100">
              {currentUser ? (
                <button
                  type="button"
                  onClick={() => {
                    setStoredCurrentUser(null);
                    setCurrentUser(null);
                    setSidebarOpen(false);
                    setPage('login');
                  }}
                  className="w-full py-2.5 px-4 rounded-lg bg-slate-100 text-slate-800 text-sm font-semibold flex items-center justify-center gap-2 hover:bg-slate-200"
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
                  className="w-full py-2.5 px-4 rounded-lg bg-[#2874F0] text-white text-sm font-bold flex items-center justify-center gap-2 hover:bg-[#1e60d5]"
                >
                  <i className="fa-solid fa-right-to-bracket"></i>
                  <span>Login / Sign Up</span>
                </button>
              )}
            </div>
          </aside>

          {/* HOME PAGE */}
          {page === 'home' && (
            <main className="space-y-2.5 sm:space-y-4">
              {/* Circular Category Strip */}
              <section className="bg-white border-b border-slate-200/80">
                <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 flex items-center justify-between sm:justify-start gap-4 sm:gap-7 overflow-x-auto no-scrollbar">
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        setFilterCatId(cat.id);
                        setPage('shop');
                      }}
                      className="shrink-0 flex flex-col items-center text-center group min-w-[60px]"
                    >
                      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-[#F1F3F6] p-1 border border-slate-200/80 group-hover:border-[#2874F0] transition overflow-hidden">
                        <img
                          src={cat.image}
                          alt={cat.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full rounded-full object-cover group-hover:scale-105 transition"
                        />
                      </div>
                      <span className="mt-1.5 text-[11px] sm:text-xs font-semibold text-slate-800 group-hover:text-[#2874F0] whitespace-nowrap">
                        {cat.name}
                      </span>
                    </button>
                  ))}
                </div>
              </section>

              {/* Auto-Sliding Offer Banners ('Big Saving Days') */}
              <section className="max-w-7xl mx-auto px-2.5 sm:px-4">
                <div className="relative rounded-xl overflow-hidden shadow-xs bg-[#2874F0]">
                  <div
                    className="flex transition-transform duration-500 ease-out"
                    style={{ transform: `translateX(-${bannerIdx * 100}%)` }}
                  >
                    {OFFER_BANNERS.map((slide) => (
                      <div
                        key={slide.id}
                        className={`w-full shrink-0 bg-gradient-to-r ${slide.bgClass} text-white grid grid-cols-12 items-stretch min-h-[156px] sm:min-h-[220px]`}
                      >
                        <div className="col-span-7 sm:col-span-7 p-4 sm:p-8 flex flex-col justify-center">
                          <span className="text-[11px] sm:text-xs font-extrabold uppercase tracking-wider text-[#FFE500]">
                            {slide.tag}
                          </span>
                          <h1 className="mt-1 text-base sm:text-3xl font-extrabold leading-tight text-white">
                            {slide.title}
                          </h1>
                          <p className="mt-1 sm:mt-2 text-[11px] sm:text-sm text-blue-100 line-clamp-2">
                            {slide.subtitle}
                          </p>
                          <div className="mt-3 sm:mt-5">
                            <button
                              type="button"
                              onClick={() => {
                                setFilterCatId(slide.catId);
                                setPage('shop');
                              }}
                              className="px-3.5 py-1.5 sm:px-5 sm:py-2.5 rounded-md bg-[#FFE500] text-[#2874F0] text-xs sm:text-sm font-extrabold hover:bg-yellow-300 transition inline-flex items-center gap-1.5 whitespace-nowrap"
                            >
                              <span>{slide.cta}</span>
                              <i className="fa-solid fa-chevron-right text-[10px]"></i>
                            </button>
                          </div>
                        </div>
                        <div className="col-span-5 sm:col-span-5 relative overflow-hidden">
                          <img
                            src={slide.image}
                            alt={slide.tag}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-gradient-to-r from-[#2874F0]/50 via-transparent to-transparent" />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Indicator Dots */}
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-10">
                    {OFFER_BANNERS.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        aria-label={`Slide ${s.id + 1}`}
                        onClick={() => setBannerIdx(s.id)}
                        className={`h-1.5 rounded-full transition-all ${
                          bannerIdx === s.id ? 'w-5 bg-[#FFE500]' : 'w-1.5 bg-white/60'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </section>

              {/* Deals of the Day — 2-Column Mobile Grid */}
              <section className="max-w-7xl mx-auto px-2.5 sm:px-4">
                <div className="bg-white rounded-xl border border-slate-200/80 p-3 sm:p-5">
                  <div className="flex items-center justify-between mb-3 sm:mb-4">
                    <div>
                      <h2 className="text-base sm:text-xl font-extrabold text-slate-900">Deals of the Day</h2>
                      <p className="text-[11px] sm:text-xs text-slate-500">Top discounts with Free Delivery &amp; Cash on Delivery</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setFilterCatId(0);
                        setPage('shop');
                      }}
                      className="px-3 py-1.5 rounded-md bg-[#2874F0] text-white text-xs font-bold hover:bg-[#1e60d5] transition whitespace-nowrap"
                    >
                      View All
                    </button>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4">
                    {products.map(renderFlipkartProductCard)}
                  </div>
                </div>
              </section>
            </main>
          )}

          {/* SHOP / CATALOG PAGE */}
          {page === 'shop' && (
            <main className="max-w-7xl mx-auto px-2.5 sm:px-4 py-4 space-y-4">
              <section className="bg-white rounded-xl border border-slate-200/80 p-3.5 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Category</label>
                  <select
                    value={filterCatId}
                    onChange={(e) => setFilterCatId(Number(e.target.value))}
                    className="w-full h-10 px-3 rounded-lg bg-[#F1F3F6] border border-slate-200 text-sm"
                  >
                    <option value={0}>All Categories</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Max Price (₹)</label>
                  <select
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(Number(e.target.value))}
                    className="w-full h-10 px-3 rounded-lg bg-[#F1F3F6] border border-slate-200 text-sm"
                  >
                    <option value={0}>Any Price</option>
                    <option value={1000}>Under ₹1,000</option>
                    <option value={2000}>Under ₹2,000</option>
                    <option value={5000}>Under ₹5,000</option>
                    <option value={25000}>Under ₹25,000</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Sort By</label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as 'newest' | 'price_asc' | 'price_desc')}
                    className="w-full h-10 px-3 rounded-lg bg-[#F1F3F6] border border-slate-200 text-sm"
                  >
                    <option value="newest">Popularity</option>
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
                  className="w-full h-10 rounded-lg border border-slate-200 text-xs font-bold text-[#2874F0] hover:bg-blue-50 flex items-center justify-center gap-1.5"
                >
                  <i className="fa-solid fa-rotate-left"></i>
                  <span>Reset Filters</span>
                </button>
              </section>

              <div className="flex items-center justify-between px-1">
                <h1 className="text-base sm:text-lg font-extrabold text-slate-900">
                  {searchQuery
                    ? `Results for "${searchQuery}"`
                    : filterCatId > 0
                    ? categories.find((c) => c.id === filterCatId)?.name || 'Products'
                    : 'All Products'}
                </h1>
                <span className="text-xs font-semibold text-slate-500 tabular-nums">{filteredProducts.length} items</span>
              </div>

              {filteredProducts.length === 0 ? (
                <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
                  <i className="fa-solid fa-box-open text-3xl text-slate-300"></i>
                  <p className="mt-3 text-sm font-semibold text-slate-700">No products match your search or filters.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4">
                  {filteredProducts.map(renderFlipkartProductCard)}
                </div>
              )}
            </main>
          )}

          {/* PRODUCT DETAIL PAGE */}
          {page === 'detail' && selectedProduct && (
            <main className="max-w-6xl mx-auto px-3 sm:px-4 py-4 space-y-6">
              <button
                type="button"
                onClick={() => setPage('shop')}
                className="inline-flex items-center gap-2 text-xs font-bold text-[#2874F0] hover:underline"
              >
                <i className="fa-solid fa-arrow-left"></i> Back to Products
              </button>
              <div className="grid md:grid-cols-2 gap-5 items-start">
                <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden">
                  <div className="aspect-square bg-slate-50 relative overflow-hidden p-4">
                    <img
                      src={detailSlideIdx === 0 ? selectedProduct.image : ASSETS.bigSavingBanner}
                      alt={selectedProduct.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover rounded-lg transition duration-300"
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
                    {[selectedProduct.image, ASSETS.bigSavingBanner].map((img, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setDetailSlideIdx(idx)}
                        className={`w-14 h-14 rounded-lg overflow-hidden border-2 ${detailSlideIdx === idx ? 'border-[#2874F0]' : 'border-slate-200'}`}
                      >
                        <img src={img} alt={`Slide ${idx + 1}`} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200/80 p-5 sm:p-6 space-y-5">
                  <div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span>{categories.find((c) => c.id === selectedProduct.cat_id)?.name || 'Store'}</span>
                      <span>·</span>
                      {selectedProduct.stock > 0 ? (
                        <span className="text-[#388E3C] font-bold">
                          <i className="fa-solid fa-circle-check mr-1"></i>In Stock ({selectedProduct.stock})
                        </span>
                      ) : (
                        <span className="text-rose-600 font-bold">
                          <i className="fa-solid fa-circle-xmark mr-1"></i>Out of Stock
                        </span>
                      )}
                    </div>
                    <h1 className="mt-2 text-xl sm:text-2xl font-extrabold text-slate-900">{selectedProduct.name}</h1>

                    <div className="mt-2 flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm bg-[#388E3C] text-white text-xs font-bold tabular-nums">
                        <span>{(selectedProduct.rating || 4.4).toFixed(1)}</span>
                        <i className="fa-solid fa-star text-[10px]"></i>
                      </span>
                      <span className="text-xs text-slate-500 font-medium tabular-nums">
                        {(selectedProduct.reviews || 1240).toLocaleString('en-IN')} Ratings &amp; Reviews
                      </span>
                    </div>

                    <div className="mt-3 flex items-baseline gap-2.5">
                      <span className="text-2xl font-extrabold text-slate-900 font-mono tabular-nums">
                        {formatINR(selectedProduct.price)}
                      </span>
                      <span className="text-sm text-slate-400 line-through font-mono tabular-nums">
                        {formatINR(getEffectiveMrp(selectedProduct.price, selectedProduct.mrp))}
                      </span>
                      <span className="text-sm font-bold text-[#388E3C] tabular-nums">
                        {getDiscountPercent(selectedProduct.price, selectedProduct.mrp)}% off
                      </span>
                    </div>
                    <p className="text-xs text-[#388E3C] font-semibold mt-1">Free Delivery · Cash on Delivery available</p>
                  </div>

                  <div className="pt-4 border-t border-slate-100">
                    <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Product Highlights</h2>
                    <p className="mt-2 text-sm text-slate-600 leading-relaxed">{selectedProduct.description}</p>
                  </div>

                  {selectedProduct.stock > 0 && (
                    <div className="pt-4 border-t border-slate-100 space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-slate-700">Quantity</span>
                        <div className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50">
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
                        <button
                          type="button"
                          onClick={() => addToCart(selectedProduct, detailQty, false)}
                          className="h-12 rounded-lg bg-[#FF9F00] text-white text-sm font-bold hover:bg-[#e89100] transition flex items-center justify-center gap-2"
                        >
                          <i className="fa-solid fa-cart-shopping"></i>
                          <span>Add to Cart</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => addToCart(selectedProduct, detailQty, true)}
                          className="h-12 rounded-lg bg-[#FB641B] text-white text-sm font-bold hover:bg-[#e55812] transition flex items-center justify-center gap-2"
                        >
                          <i className="fa-solid fa-bolt"></i>
                          <span>Buy Now</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <section className="bg-white rounded-xl border border-slate-200/80 p-4">
                <h2 className="text-base sm:text-lg font-extrabold text-slate-900 mb-3">Similar Products</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {products
                    .filter((p) => p.id !== selectedProduct.id)
                    .slice(0, 4)
                    .map(renderFlipkartProductCard)}
                </div>
              </section>
            </main>
          )}

          {/* CART PAGE */}
          {page === 'cart' && (
            <main className="max-w-4xl mx-auto px-3 sm:px-4 py-4 space-y-4">
              <div className="flex items-center justify-between">
                <h1 className="text-xl font-extrabold text-slate-900">My Cart</h1>
                <span className="text-xs font-semibold text-slate-500 tabular-nums">{cartCount} items</span>
              </div>

              {cart.length === 0 ? (
                <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
                  <div className="w-16 h-16 rounded-full bg-blue-50 text-[#2874F0] flex items-center justify-center mx-auto">
                    <i className="fa-solid fa-cart-shopping text-2xl"></i>
                  </div>
                  <h2 className="mt-4 text-base font-bold text-slate-900">Your cart is empty!</h2>
                  <p className="mt-1 text-xs text-slate-500">Add items from Big Saving Days to see them here.</p>
                  <button
                    type="button"
                    onClick={() => setPage('home')}
                    className="mt-5 inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-[#2874F0] text-white text-sm font-bold hover:bg-[#1e60d5] transition"
                  >
                    <span>Shop Now</span>
                    <i className="fa-solid fa-arrow-right text-xs"></i>
                  </button>
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    {cart.map((entry) => {
                      const entryMrp = getEffectiveMrp(entry.product.price, entry.product.mrp);
                      return (
                        <div key={entry.product.id} className="bg-white rounded-xl border border-slate-200/80 p-3.5 flex items-center gap-3.5">
                          <img src={entry.product.image} alt={entry.product.name} referrerPolicy="no-referrer" className="w-20 h-20 rounded-lg bg-slate-100 object-cover shrink-0" />
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-bold text-slate-900 truncate">{entry.product.name}</h3>
                            <div className="mt-0.5 flex items-center gap-2">
                              <span className="text-sm font-extrabold text-slate-900 font-mono tabular-nums">{formatINR(entry.product.price)}</span>
                              <span className="text-xs text-slate-400 line-through font-mono tabular-nums">{formatINR(entryMrp)}</span>
                            </div>
                            <div className="mt-2.5 flex items-center justify-between gap-2">
                              <div className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50">
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
                      );
                    })}
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase">
                      <span>Price Details</span>
                    </div>
                    <div className="flex items-center justify-between text-sm text-slate-600">
                      <span>MRP ({cartCount} items)</span>
                      <span className="font-mono tabular-nums">{formatINR(cartMrpTotal)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm text-[#388E3C] font-semibold">
                      <span>Discount Savings</span>
                      <span className="font-mono tabular-nums">-{formatINR(Math.max(0, cartMrpTotal - cartTotal))}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm text-slate-600">
                      <span>Delivery Charges</span>
                      <span className="font-bold text-[#388E3C]">FREE</span>
                    </div>
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-base font-bold text-slate-900">Total Amount</span>
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
                      className="w-full h-12 rounded-lg bg-[#FB641B] text-white text-sm font-bold hover:bg-[#e55812] transition flex items-center justify-center gap-2"
                    >
                      <span>{currentUser ? 'Place Order' : 'Login to Place Order'}</span>
                      <i className="fa-solid fa-arrow-right text-xs"></i>
                    </button>
                  </div>
                </>
              )}
            </main>
          )}

          {/* CHECKOUT PAGE */}
          {page === 'checkout' && (
            <main className="max-w-2xl mx-auto px-3 sm:px-4 py-5 space-y-4">
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setPage('cart')} className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-700">
                  <i className="fa-solid fa-arrow-left text-xs"></i>
                </button>
                <div>
                  <h1 className="text-xl font-extrabold text-slate-900">Checkout</h1>
                  <p className="text-xs text-slate-500">{cartCount} items · Total {formatINR(cartTotal)}</p>
                </div>
              </div>

              <form onSubmit={handlePlaceOrder} className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Full Name</label>
                  <input type="text" value={checkoutName} onChange={(e) => setCheckoutName(e.target.value)} required className="w-full h-11 px-4 rounded-lg bg-slate-50 border border-slate-200 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Phone Number</label>
                  <input type="tel" value={checkoutPhone} onChange={(e) => setCheckoutPhone(e.target.value)} required className="w-full h-11 px-4 rounded-lg bg-slate-50 border border-slate-200 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Delivery Address</label>
                  <textarea rows={3} value={checkoutAddress} onChange={(e) => setCheckoutAddress(e.target.value)} required placeholder="House No, Street, City, Pincode" className="w-full p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-sm" />
                </div>
                <div className="p-4 rounded-xl border-2 border-[#2874F0] bg-blue-50/50 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-10 h-10 rounded-lg bg-[#2874F0] text-white flex items-center justify-center">
                      <i className="fa-solid fa-money-bill-wave"></i>
                    </span>
                    <div>
                      <p className="text-sm font-bold text-slate-900">Cash on Delivery (COD)</p>
                      <p className="text-xs text-slate-500">Pay {formatINR(cartTotal)} upon delivery</p>
                    </div>
                  </div>
                  <i className="fa-solid fa-circle-check text-[#2874F0] text-lg"></i>
                </div>
                <button type="submit" className="w-full h-12 rounded-lg bg-[#FB641B] text-white text-sm font-bold hover:bg-[#e55812] transition flex items-center justify-center gap-2">
                  <i className="fa-solid fa-check"></i>
                  <span>Confirm COD Order</span>
                </button>
              </form>
            </main>
          )}

          {/* ORDERS PAGE */}
          {page === 'orders' && (
            <main className="max-w-3xl mx-auto px-3 sm:px-4 py-5 space-y-4">
              <div className="flex items-center justify-between">
                <h1 className="text-xl font-extrabold text-slate-900">My Orders</h1>
                <button type="button" onClick={() => setPage('home')} className="text-xs font-bold text-[#2874F0]">Shop More</button>
              </div>

              <div className="grid grid-cols-2 p-1 bg-slate-200/80 rounded-lg">
                <button
                  type="button"
                  onClick={() => setOrderTab('active')}
                  className={`py-2.5 text-xs font-bold rounded-md transition ${orderTab === 'active' ? 'bg-white text-[#2874F0] shadow-xs' : 'text-slate-600'}`}
                >
                  Active Orders ({activeOrders.length})
                </button>
                <button
                  type="button"
                  onClick={() => setOrderTab('history')}
                  className={`py-2.5 text-xs font-bold rounded-md transition ${orderTab === 'history' ? 'bg-white text-[#2874F0] shadow-xs' : 'text-slate-600'}`}
                >
                  Order History ({historyOrders.length})
                </button>
              </div>

              <div className="space-y-3.5">
                {(orderTab === 'active' ? activeOrders : historyOrders).length === 0 ? (
                  <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
                    <i className="fa-solid fa-box text-3xl text-slate-300"></i>
                    <p className="mt-3 text-sm font-semibold text-slate-700">No orders in this tab yet.</p>
                  </div>
                ) : (
                  (orderTab === 'active' ? activeOrders : historyOrders).map(renderOrderCard)
                )}
              </div>
            </main>
          )}

          {/* PROFILE PAGE */}
          {page === 'profile' && currentUser && (
            <main className="max-w-2xl mx-auto px-3 sm:px-4 py-5 space-y-4">
              <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-14 h-14 rounded-full bg-[#2874F0] text-white flex items-center justify-center text-xl font-extrabold shrink-0">
                    {currentUser.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h1 className="text-lg font-extrabold text-slate-900 truncate">{currentUser.name}</h1>
                    <p className="text-xs text-slate-500 truncate">{currentUser.email || currentUser.phone}</p>
                  </div>
                </div>
                <button type="button" onClick={() => setPage('orders')} className="px-4 py-2 rounded-lg bg-blue-50 text-[#2874F0] text-xs font-bold">
                  My Orders
                </button>
              </div>

              <form onSubmit={handleProfileSave} className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
                <h2 className="text-base font-bold text-slate-900">Account Details</h2>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Full Name</label>
                    <input type="text" value={profName} onChange={(e) => setProfName(e.target.value)} required className="w-full h-11 px-3.5 rounded-lg bg-slate-50 border border-slate-200 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Phone</label>
                    <input type="tel" value={profPhone} onChange={(e) => setProfPhone(e.target.value)} className="w-full h-11 px-3.5 rounded-lg bg-slate-50 border border-slate-200 text-sm" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Email</label>
                  <input type="email" value={profEmail} onChange={(e) => setProfEmail(e.target.value)} className="w-full h-11 px-3.5 rounded-lg bg-slate-50 border border-slate-200 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Delivery Address</label>
                  <textarea rows={3} value={profAddress} onChange={(e) => setProfAddress(e.target.value)} className="w-full p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-sm" />
                </div>
                <button type="submit" className="w-full h-11 rounded-lg bg-[#2874F0] text-white text-sm font-bold hover:bg-[#1e60d5] transition">
                  Save Profile Changes
                </button>
              </form>

              <form onSubmit={handlePasswordChange} className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
                <h2 className="text-base font-bold text-slate-900">Change Password</h2>
                <div className="grid sm:grid-cols-2 gap-4">
                  <input type="password" value={currPass} onChange={(e) => setCurrPass(e.target.value)} required placeholder="Current Password" className="w-full h-11 px-3.5 rounded-lg bg-slate-50 border border-slate-200 text-sm" />
                  <input type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} required minLength={6} placeholder="New Password" className="w-full h-11 px-3.5 rounded-lg bg-slate-50 border border-slate-200 text-sm" />
                </div>
                <button type="submit" className="w-full h-11 rounded-lg bg-[#FF9F00] text-white text-sm font-bold hover:bg-[#e89100] transition">
                  Update Password
                </button>
              </form>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setMode('admin')}
                  className="h-11 rounded-lg bg-white border border-slate-200 text-[#2874F0] text-sm font-bold flex items-center justify-center gap-2 hover:bg-blue-50"
                >
                  <i className="fa-solid fa-shield-halved"></i> Seller Admin
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStoredCurrentUser(null);
                    setCurrentUser(null);
                    setPage('login');
                  }}
                  className="h-11 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm font-bold flex items-center justify-center gap-2"
                >
                  <i className="fa-solid fa-right-from-bracket"></i> Logout
                </button>
              </div>
            </main>
          )}

          {/* CUSTOMER LOGIN & SIGN UP PAGE */}
          {page === 'login' && (
            <main className="max-w-md mx-auto px-3 sm:px-4 py-6">
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="bg-[#2874F0] px-6 py-6 text-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <h1 className="text-xl font-extrabold">
                        {authTab === 'login' ? 'Login' : 'Create Account'}
                      </h1>
                      <p className="mt-1 text-xs text-blue-100">
                        Get access to your Orders, Cart &amp; Big Saving Days
                      </p>
                    </div>
                    <i className="fa-solid fa-bag-shopping text-3xl text-[#FFE500]"></i>
                  </div>
                  <div className="mt-4 grid grid-cols-2 p-1 bg-white/15 rounded-lg">
                    <button
                      type="button"
                      onClick={() => {
                        setAuthTab('login');
                        setAuthError('');
                      }}
                      className={`py-2 text-xs font-bold rounded-md transition ${
                        authTab === 'login' ? 'bg-white text-[#2874F0] shadow-xs' : 'text-white'
                      }`}
                    >
                      Login
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAuthTab('signup');
                        setAuthError('');
                      }}
                      className={`py-2 text-xs font-bold rounded-md transition ${
                        authTab === 'signup' ? 'bg-white text-[#2874F0] shadow-xs' : 'text-white'
                      }`}
                    >
                      Sign Up
                    </button>
                  </div>
                </div>

                <div className="p-6">
                  {authError && (
                    <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
                      <i className="fa-solid fa-circle-exclamation"></i>
                      <span>{authError}</span>
                    </div>
                  )}

                  {authTab === 'login' ? (
                    <form onSubmit={handleLogin} className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Email or Phone Number</label>
                        <input
                          type="text"
                          value={loginIdentifier}
                          onChange={(e) => setLoginIdentifier(e.target.value)}
                          required
                          placeholder="user@quickkart.com or phone"
                          className="w-full h-11 px-4 rounded-lg bg-slate-50 border border-slate-200 text-sm focus:bg-white focus:border-[#2874F0] focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Password</label>
                        <input
                          type="password"
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          required
                          placeholder="Password"
                          className="w-full h-11 px-4 rounded-lg bg-slate-50 border border-slate-200 text-sm focus:bg-white focus:border-[#2874F0] focus:outline-none"
                        />
                      </div>
                      <p className="text-xs text-slate-500">
                        Demo Customer: <span className="font-semibold text-slate-700">user@quickkart.com / 123456</span>
                      </p>
                      <button
                        type="submit"
                        className="w-full h-11 rounded-lg bg-[#FB641B] text-white text-sm font-bold hover:bg-[#e55812] transition"
                      >
                        Login
                      </button>
                    </form>
                  ) : (
                    <form onSubmit={handleSignup} className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Full Name</label>
                        <input
                          type="text"
                          value={signupName}
                          onChange={(e) => setSignupName(e.target.value)}
                          required
                          placeholder="Enter your name"
                          className="w-full h-11 px-4 rounded-lg bg-slate-50 border border-slate-200 text-sm focus:bg-white focus:border-[#2874F0] focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Email or Phone Number</label>
                        <input
                          type="text"
                          value={signupContact}
                          onChange={(e) => setSignupContact(e.target.value)}
                          required
                          placeholder="Email address or 10-digit phone"
                          className="w-full h-11 px-4 rounded-lg bg-slate-50 border border-slate-200 text-sm focus:bg-white focus:border-[#2874F0] focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Password</label>
                        <input
                          type="password"
                          value={signupPassword}
                          onChange={(e) => setSignupPassword(e.target.value)}
                          required
                          minLength={6}
                          placeholder="Min 6 characters"
                          className="w-full h-11 px-4 rounded-lg bg-slate-50 border border-slate-200 text-sm focus:bg-white focus:border-[#2874F0] focus:outline-none"
                        />
                      </div>
                      <button
                        type="submit"
                        className="w-full h-11 rounded-lg bg-[#FB641B] text-white text-sm font-bold hover:bg-[#e55812] transition"
                      >
                        Create Account &amp; Login
                      </button>
                    </form>
                  )}

                  <div className="mt-5 pt-4 border-t border-slate-100 text-center">
                    <button
                      type="button"
                      onClick={() => setMode('admin')}
                      className="text-xs font-bold text-[#2874F0] hover:underline"
                    >
                      Admin / Seller Login <i className="fa-solid fa-arrow-right ml-1 text-[10px]"></i>
                    </button>
                  </div>
                </div>
              </div>
            </main>
          )}

          {/* Fixed Mobile Bottom Nav */}
          <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 shadow-xs">
            <div className="grid grid-cols-4 h-14 items-center">
              <button
                type="button"
                onClick={() => setPage('home')}
                className={`flex flex-col items-center justify-center h-full ${page === 'home' ? 'text-[#2874F0]' : 'text-slate-500'}`}
              >
                <i className="fa-solid fa-house text-base"></i>
                <span className="text-[10px] font-semibold mt-0.5">Home</span>
              </button>
              <button
                type="button"
                onClick={() => setPage('shop')}
                className={`flex flex-col items-center justify-center h-full ${page === 'shop' || page === 'detail' ? 'text-[#2874F0]' : 'text-slate-500'}`}
              >
                <i className="fa-solid fa-table-cells-large text-base"></i>
                <span className="text-[10px] font-semibold mt-0.5">Categories</span>
              </button>
              <button
                type="button"
                onClick={() => setPage('cart')}
                className={`relative flex flex-col items-center justify-center h-full ${page === 'cart' || page === 'checkout' ? 'text-[#2874F0]' : 'text-slate-500'}`}
              >
                <div className="relative">
                  <i className="fa-solid fa-cart-shopping text-base"></i>
                  {cartCount > 0 && (
                    <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-[16px] px-1 rounded-full bg-[#FB641B] text-white text-[9px] font-bold flex items-center justify-center tabular-nums">
                      {cartCount}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-semibold mt-0.5">Cart</span>
              </button>
              <button
                type="button"
                onClick={() => setPage(currentUser ? 'profile' : 'login')}
                className={`flex flex-col items-center justify-center h-full ${page === 'profile' || page === 'orders' || page === 'login' ? 'text-[#2874F0]' : 'text-slate-500'}`}
              >
                <i className="fa-solid fa-user text-base"></i>
                <span className="text-[10px] font-semibold mt-0.5">Account</span>
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
              <span className="w-2.5 h-2.5 rounded-full bg-[#2874F0] qk-dot-1"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-[#FFE500] qk-dot-2"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-[#FB641B] qk-dot-3"></span>
            </div>
            <span className="text-[11px] font-semibold text-slate-600">{loader.text}</span>
          </div>
        </div>
      )}

      {/* Reusable Tailwind Modal */}
      {modal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-xl bg-white shadow-2xl border border-slate-200 p-6">
            <div className="flex items-start gap-3">
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                  modal.type === 'success'
                    ? 'bg-emerald-50 text-[#388E3C]'
                    : modal.type === 'error'
                    ? 'bg-rose-50 text-rose-600'
                    : 'bg-blue-50 text-[#2874F0]'
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
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100"
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
                className="px-5 py-2 rounded-lg text-sm font-bold bg-[#2874F0] text-white hover:bg-[#1e60d5]"
              >
                {modal.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
