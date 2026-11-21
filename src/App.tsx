import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  EmailAuthProvider,
  createUserWithEmailAndPassword,
  getRedirectResult,
  onAuthStateChanged,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updatePassword,
  updateProfile,
} from 'firebase/auth';
import { AddressBookModal } from './components/AddressBookModal';
import { AdminView } from './components/AdminView';
import { CategoriesView } from './components/CategoriesView';
import { FirstLaunchAuthScreen } from './components/FirstLaunchAuthScreen';
import { RiderView } from './components/RiderView';
import { SellerView } from './components/SellerView';
import { TaxInvoiceModal } from './components/TaxInvoiceModal';
import { VerifiedReviewModal } from './components/VerifiedReviewModal';
import { auth, getFirebaseAuthErrorMessage, googleProvider } from './firebase';
import {
  authenticateDeliveryBoyFirestore,
  cancelOrderFirestore,
  incrementPromoCodeUsageFirestore,
  placeOrderFirestore,
  requestOrderReturnFirestore,
  saveUserAddressesFirestore,
  submitProductReviewFirestore,
  subscribeAllSellersFirestore,
  subscribeCategoriesFirestore,
  subscribeCustomerOrdersFirestore,
  subscribeDeliverySettingsFirestore,
  subscribeProductReviewsFirestore,
  subscribeProductsFirestore,
  subscribePromoCodesFirestore,
  subscribeUserAddressesFirestore,
  subscribeUserWishlistFirestore,
  syncUserProfileFirestore,
  toggleWishlistItemFirestore,
  updateUserProfileFirestore,
} from './services/firestoreService';
import {
  ASSETS,
  getBootstrapData,
  getDeliverySettingsLocal,
  getPromoCodesLocal,
  getReviewsLocal,
  getSavedAddressLocal,
  getSavedAddressesLocal,
  getStoredCurrentRider,
  getStoredSellersLocal,
  getWishlistIdsLocal,
  saveCart,
  saveStructuredAddressLocal,
  setStoredCurrentRider,
  setStoredCurrentUser,
  syncFirebaseCustomerLocal,
  updateProfileLocal,
  changePasswordLocal,
} from './store/localStore';
import {
  CartEntry,
  Category,
  DEFAULT_DELIVERY_SETTINGS,
  DeliveryBoy,
  DeliverySettings,
  Order,
  Product,
  ProductReview,
  PromoCode,
  RETURN_REASONS,
  SavedAddress,
  SellerProfile,
  User,
  calculatePromoDiscount,
  formatINR,
  formatSavedAddressLine,
  getCourierTrackingUrl,
  getDiscountPercent,
  getEffectiveMrp,
  getOrderDeliveryStage,
  getOrderStatusLabel,
  getOrderStepIndex,
  normalizeSellerStatus,
} from './types';

type LegalPolicyKey = 'privacy' | 'terms' | 'refund' | 'contact';

const ADMIN_EMAIL = 'sabreensheikh545@gmail.com';
const ADMIN_SECRET_PIN = '2026';
export const RAZORPAY_KEY_ID = "rzp_live_U1t08rrhb6TEXG";
const ONBOARDED_STORAGE_KEY = 'smart_basket_onboarded';
const DEFAULT_DELIVERY_PINCODE = '110039';
const DEFAULT_DELIVERY_LABEL = 'Bawana, Delhi - 110039';

type UserPage = 'home' | 'categories' | 'play' | 'shop' | 'detail' | 'cart' | 'checkout' | 'orders' | 'profile' | 'login';

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
  const [mode, setMode] = useState<'user' | 'admin' | 'seller' | 'rider'>('user');
  const [riderInitialView, setRiderInitialView] = useState<'login' | 'register'>('login');
  const [currentRider, setCurrentRider] = useState<DeliveryBoy | null>(() => getStoredCurrentRider());
  const [riderToast, setRiderToast] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [page, setPage] = useState<UserPage>('home');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [adminPinVerified, setAdminPinVerified] = useState(false);
  const [adminPinModalOpen, setAdminPinModalOpen] = useState(false);
  const [adminPinInput, setAdminPinInput] = useState('');
  const [adminPinError, setAdminPinError] = useState('');
  const logoTapTimestampsRef = useRef<number[]>([]);

  // Offline localStorage + Firestore data
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [sellers, setSellers] = useState<SellerProfile[]>(() => getStoredSellersLocal());
  const [orders, setOrders] = useState<Order[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [adminUsername, setAdminUsername] = useState('Seraj');
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const isStrictAdminEmail = useMemo(() => {
    const emailA = currentUser?.email?.trim().toLowerCase() || '';
    const emailB = auth.currentUser?.email?.trim().toLowerCase() || '';
    return emailA === ADMIN_EMAIL || emailB === ADMIN_EMAIL;
  }, [currentUser]);

  // Banner Carousel
  const [bannerIdx, setBannerIdx] = useState(0);

  // Catalog Filters & Live Search
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCatId, setFilterCatId] = useState<number>(0);
  const [maxPrice, setMaxPrice] = useState<number>(0);
  const [sortBy, setSortBy] = useState<'relevance' | 'price_asc' | 'price_desc' | 'top_rated'>('relevance');

  // Product Detail, Wishlist & Pincode Estimator
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [detailSlideIdx, setDetailSlideIdx] = useState(0);
  const [detailQty, setDetailQty] = useState(1);
  const [wishlistIds, setWishlistIds] = useState<number[]>(() => getWishlistIdsLocal());
  const [deliveryPincode, setDeliveryPincode] = useState<string>(() => {
    const saved = getSavedAddressLocal();
    return saved?.pincode || DEFAULT_DELIVERY_PINCODE;
  });
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState<boolean>(() => {
    try {
      return localStorage.getItem(ONBOARDED_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [firebaseAuthResolved, setFirebaseAuthResolved] = useState<boolean>(() =>
    Boolean(auth.currentUser || currentUser)
  );
  const [pincodeDraft, setPincodeDraft] = useState('');
  const [editingPincode, setEditingPincode] = useState(false);

  // Cart, Delivery Rules, Real Promo Codes, Multiple Saved Addresses & Verified Reviews
  const [cart, setCart] = useState<CartEntry[]>([]);
  const [cartTab, setCartTab] = useState<'smart-basket' | 'grocery'>('smart-basket');
  const [discountsExpanded, setDiscountsExpanded] = useState(true);
  const [deliverySettings, setDeliverySettings] = useState<DeliverySettings>(() =>
    getDeliverySettingsLocal() || DEFAULT_DELIVERY_SETTINGS
  );
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>(() => getPromoCodesLocal());
  const [allReviews, setAllReviews] = useState<ProductReview[]>(() => getReviewsLocal());
  const [appliedCouponCode, setAppliedCouponCode] = useState('');
  const [couponModalOpen, setCouponModalOpen] = useState(false);
  const [couponDraft, setCouponDraft] = useState('');
  const [couponError, setCouponError] = useState('');

  // Multi-Address Book
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>(() => getSavedAddressesLocal());
  const [selectedAddressId, setSelectedAddressId] = useState<string>(
    () => getSavedAddressLocal()?.id || ''
  );
  const [addressBookOpen, setAddressBookOpen] = useState(false);
  const [addressBookMode, setAddressBookMode] = useState<'manage' | 'select'>('select');
  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [savedAddress, setSavedAddress] = useState<SavedAddress | null>(() => getSavedAddressLocal());
  const [addrName, setAddrName] = useState('');
  const [addrPhone, setAddrPhone] = useState('');
  const [addrHouseStreet, setAddrHouseStreet] = useState('');
  const [addrArea, setAddrArea] = useState('');
  const [addrCity, setAddrCity] = useState('');
  const [addrState, setAddrState] = useState('');
  const [addrPincode, setAddrPincode] = useState('');
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState('');
  const [gpsSuccess, setGpsSuccess] = useState('');

  // Verified Review & Tax Invoice Modals
  const [reviewModalTarget, setReviewModalTarget] = useState<{
    product: Product;
    order: Order;
    existing?: ProductReview | null;
  } | null>(null);
  const [invoiceModalOrder, setInvoiceModalOrder] = useState<Order | null>(null);

  // Customer Email/Password & Google Auth
  const [authTab, setAuthTab] = useState<'login' | 'signup'>('login');
  const [authName, setAuthName] = useState('');
  const [authPhone, setAuthPhone] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [showAuthPassword, setShowAuthPassword] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState('');
  const isAuthActionInFlightRef = useRef(false);

  // Checkout Form
  const [checkoutName, setCheckoutName] = useState(() => getSavedAddressLocal()?.name || '');
  const [checkoutPhone, setCheckoutPhone] = useState(() => getSavedAddressLocal()?.phone || '');
  const [checkoutAddress, setCheckoutAddress] = useState(() => {
    const saved = getSavedAddressLocal();
    if (!saved) return '';
    return formatSavedAddressLine(saved);
  });
  const [paymentMethod, setPaymentMethod] = useState<'Online Payment' | 'Cash on Delivery'>('Online Payment');
  
  // Orders View, Return/Replace Request & Legal Policy Modals
  const [orderTab, setOrderTab] = useState<'active' | 'history'>('active');
  const [expandedOrderIds, setExpandedOrderIds] = useState<number[]>([]);
  const [copiedTrackingOrderId, setCopiedTrackingOrderId] = useState<number | null>(null);
  const [copiedOtpOrderId, setCopiedOtpOrderId] = useState<number | null>(null);
  const [returnModalOrder, setReturnModalOrder] = useState<Order | null>(null);
  const [returnReasonDraft, setReturnReasonDraft] = useState<string>(RETURN_REASONS[0]);
  const [returnResolutionDraft, setReturnResolutionDraft] = useState<'Return' | 'Replace'>('Return');
  const [returnExtraNote, setReturnExtraNote] = useState<string>('');
  const [activeLegalPolicy, setActiveLegalPolicy] = useState<LegalPolicyKey | null>(null);
  const [supportEmailCopied, setSupportEmailCopied] = useState(false);

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

  const showRiderToast = useCallback((text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setRiderToast({ text, type });
    window.setTimeout(() => {
      setRiderToast((prev) => (prev?.text === text ? null : prev));
    }, 3500);
  }, []);

  const openRiderPortal = useCallback((view: 'login' | 'register') => {
    setRiderInitialView(view);
    if (view === 'register') {
      setCurrentRider(null);
      setStoredCurrentRider(null);
    }
    setSidebarOpen(false);
    setMode('rider');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleCopyDeliveryOtp = useCallback((orderId: number, otp: string) => {
    if (!otp) return;
    navigator.clipboard?.writeText(otp).catch(() => {});
    setCopiedOtpOrderId(orderId);
    window.setTimeout(() => {
      setCopiedOtpOrderId((prev) => (prev === orderId ? null : prev));
    }, 2000);
  }, []);

  const refreshLocalSession = useCallback(() => {
    const data = getBootstrapData();
    setProducts(data.products);
    setSellers(getStoredSellersLocal());
    setAdminUsername(data.adminUsername);
    setCart(data.cart);
    setCurrentUser(data.currentUser);
  }, []);

  // Strict runtime guard: never allow Admin Panel unless email matches ADMIN_EMAIL AND PIN is verified
  useEffect(() => {
    if (!isStrictAdminEmail) {
      setAdminPinVerified(false);
      setAdminPinModalOpen(false);
      if (mode === 'admin') {
        setMode('user');
      }
    } else if (mode === 'admin' && !adminPinVerified) {
      setMode('user');
    }
  }, [isStrictAdminEmail, adminPinVerified, mode]);

  const requestAdminAccess = useCallback(() => {
    setSidebarOpen(false);
    if (!isStrictAdminEmail) {
      setMode('seller');
      return;
    }
    if (adminPinVerified) {
      setMode('admin');
      return;
    }
    setAdminPinInput('');
    setAdminPinError('');
    setAdminPinModalOpen(true);
  }, [isStrictAdminEmail, adminPinVerified]);

  const handleVerifyAdminPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isStrictAdminEmail) {
      setAdminPinModalOpen(false);
      setAdminPinVerified(false);
      setMode('user');
      return;
    }
    if (adminPinInput.trim() === ADMIN_SECRET_PIN) {
      setAdminPinVerified(true);
      setAdminPinModalOpen(false);
      setAdminPinInput('');
      setAdminPinError('');
      setSidebarOpen(false);
      setMode('admin');
    } else {
      setAdminPinError('Incorrect 4-digit Admin Secret PIN. Access denied.');
      setAdminPinInput('');
    }
  };

  const loadBootstrap = useCallback(() => {
    const data = getBootstrapData();
    setCategories(data.categories);
    setProducts(data.products);
    setOrders([]);
    setUsers(data.users);
    setAdminUsername(data.adminUsername);
    setCart(data.cart);
    setCurrentUser(data.currentUser);
  }, []);

  useEffect(() => {
    loadBootstrap();
  }, [loadBootstrap]);

  // Real-time Firestore sync for categories, products, and seller approvals across all devices
  useEffect(() => {
    const unsubCategories = subscribeCategoriesFirestore((list) => {
      setCategories(list);
    });
    const unsubProducts = subscribeProductsFirestore(
      (list) => {
        setProducts(list);
      },
      (errMsg) => {
        showModal({ title: 'Catalog Sync Notice', message: errMsg, type: 'error' });
      }
    );
    const unsubSellers = subscribeAllSellersFirestore((list) => {
      setSellers(list);
    });
    const unsubDelivery = subscribeDeliverySettingsFirestore((settings) => {
      setDeliverySettings(settings);
    });
    const unsubPromos = subscribePromoCodesFirestore((promos) => {
      setPromoCodes(promos);
    });
    const unsubReviews = subscribeProductReviewsFirestore((reviews) => {
      setAllReviews(reviews);
    });
    return () => {
      unsubCategories();
      unsubProducts();
      unsubSellers();
      unsubDelivery();
      unsubPromos();
      unsubReviews();
    };
  }, [showModal]);

  // Real-time Firestore sync for signed-in customer's orders, wishlist, and saved addresses
  const activeCustomerUid = currentUser?.uid || auth.currentUser?.uid || '';
  useEffect(() => {
    const unsubWishlist = subscribeUserWishlistFirestore(activeCustomerUid || undefined, (ids) => {
      setWishlistIds(ids);
    });
    const unsubAddresses = subscribeUserAddressesFirestore(activeCustomerUid || undefined, (addrs) => {
      setSavedAddresses(addrs);
      if (addrs.length > 0) {
        const active =
          addrs.find((a) => a.id === selectedAddressId) ||
          addrs.find((a) => a.isDefault) ||
          addrs[0];
        if (active) {
          setSelectedAddressId(active.id);
          setSavedAddress(active);
          if (active.pincode) setDeliveryPincode(active.pincode);
        }
      }
    });

    if (!activeCustomerUid) {
      setOrders([]);
      return () => {
        unsubWishlist();
        unsubAddresses();
      };
    }
    const unsubOrders = subscribeCustomerOrdersFirestore(
      activeCustomerUid,
      (list) => {
        setOrders(list);
      },
      (errMsg) => {
        showModal({ title: 'Orders Sync Notice', message: errMsg, type: 'error' });
      }
    );
    return () => {
      unsubOrders();
      unsubWishlist();
      unsubAddresses();
    };
  }, [activeCustomerUid, showModal]);

  // Auto-slide offer banners every 4 seconds on Home screen
  useEffect(() => {
    if (mode !== 'user' || page !== 'home') return;
    const timer = window.setInterval(() => {
      setBannerIdx((prev) => (prev + 1) % OFFER_BANNERS.length);
    }, 4200);
    return () => window.clearInterval(timer);
  }, [mode, page]);

  // Handle Google redirect completion & Firebase auth state synchronization
  useEffect(() => {
    let active = true;

    const syncSignedInUser = async (fbUser: NonNullable<typeof auth.currentUser>) => {
      if (!fbUser.email) return null;
      const fsSync = await syncUserProfileFirestore({
        uid: fbUser.uid,
        name: fbUser.displayName || undefined,
        email: fbUser.email,
        phone: fbUser.phoneNumber || undefined,
      });
      if (fsSync.success && fsSync.user) {
        const localSync = syncFirebaseCustomerLocal({
          uid: fbUser.uid,
          docId: fbUser.uid,
          name: fsSync.user.name,
          email: fsSync.user.email,
          phone: fsSync.user.phone,
          address: fsSync.user.address,
          status: fsSync.user.status,
          role: fsSync.user.role,
          isSeller: fsSync.user.isSeller,
          sellerStoreName: fsSync.user.sellerStoreName,
        });
        return localSync.user || fsSync.user;
      }
      if (!fsSync.success && fsSync.message.includes('suspended')) {
        setAuthError(fsSync.message);
        return null;
      }
      const fallback = syncFirebaseCustomerLocal({
        uid: fbUser.uid,
        docId: fbUser.uid,
        name: fbUser.displayName || undefined,
        email: fbUser.email,
        phone: fbUser.phoneNumber || undefined,
      });
      return fallback.user || null;
    };

    getRedirectResult(auth)
      .then(async (result) => {
        if (!active || !result?.user?.email) return;
        const user = await syncSignedInUser(result.user);
        if (active && user) {
          refreshLocalSession();
          setCurrentUser(user);
          setPage((prev) => (prev === 'login' ? 'home' : prev));
        }
      })
      .catch((err) => {
        if (!active) return;
        setAuthError(getFirebaseAuthErrorMessage(err));
      });

    const markOnboarded = () => {
      try {
        localStorage.setItem(ONBOARDED_STORAGE_KEY, 'true');
      } catch {
        // ignore storage errors
      }
      setHasCompletedOnboarding(true);
    };

    const authFallbackTimer = window.setTimeout(() => {
      if (active) setFirebaseAuthResolved(true);
    }, 1200);

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (!active) return;
      if (isAuthActionInFlightRef.current) {
        setFirebaseAuthResolved(true);
        return;
      }
      if (fbUser?.email) {
        const user = await syncSignedInUser(fbUser);
        if (active && user) {
          setCurrentUser(user);
          markOnboarded();
        }
      }
      if (active) {
        setFirebaseAuthResolved(true);
      }
    });

    return () => {
      active = false;
      window.clearTimeout(authFallbackTimer);
      unsubscribe();
    };
  }, [refreshLocalSession]);

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
      if (!savedAddress) {
        setCheckoutName((prev) => prev || currentUser.name);
        setCheckoutPhone((prev) => prev || currentUser.phone);
        setCheckoutAddress((prev) => prev || currentUser.address || '');
        const pinMatch = (currentUser.address || '').match(/\b\d{6}\b/);
        if (pinMatch) setDeliveryPincode(pinMatch[0]);
      }
    }
  }, [currentUser, savedAddress]);

  // Storefront visibility rule: show Admin/platform products + ONLY products from Approved sellers
  const publicProducts = useMemo(() => {
    return products.filter((prod) => {
      const sEmail = prod.sellerEmail?.trim().toLowerCase() || '';
      const sId = prod.sellerId?.trim() || '';
      if (!sEmail && !sId) return true; // Admin / platform catalog product
      if (sEmail === ADMIN_EMAIL) return true; // Admin's own product
      const matchedSeller = sellers.find(
        (s) =>
          (sEmail && s.email.trim().toLowerCase() === sEmail) ||
          (sId && (s.uid === sId || s.id === sId || s.docId === sId))
      );
      if (!matchedSeller) return false;
      return normalizeSellerStatus(matchedSeller.status) === 'approved';
    });
  }, [products, sellers]);

  // Real verified product rating stats computed strictly from Firestore reviews (zero fake ratings)
  const productReviewStats = useMemo(() => {
    const map = new Map<number, { avg: number; count: number; items: ProductReview[] }>();
    allReviews.forEach((rev) => {
      const existing = map.get(rev.productId);
      if (existing) {
        existing.items.push(rev);
      } else {
        map.set(rev.productId, { avg: 0, count: 0, items: [rev] });
      }
    });
    map.forEach((entry) => {
      entry.count = entry.items.length;
      const sum = entry.items.reduce((acc, r) => acc + r.rating, 0);
      entry.avg = entry.count > 0 ? Math.round((sum / entry.count) * 10) / 10 : 0;
    });
    return map;
  }, [allReviews]);

  const activePromoCodes = useMemo(
    () => promoCodes.filter((p) => p.active),
    [promoCodes]
  );

  // Normalize cart entries against live catalog so price, mrp, and quantity math are always exact
  const normalizedCart = useMemo<CartEntry[]>(() => {
    const productById = new Map(products.map((p) => [p.id, p]));
    return cart
      .map((entry) => {
        const liveProd = productById.get(entry.product.id) || entry.product;
        const safeQty = Math.max(1, Math.floor(Number(entry.quantity) || 1));
        return {
          product: {
            ...liveProd,
            price: Number(liveProd.price) || 0,
            mrp: liveProd.mrp !== undefined ? Number(liveProd.mrp) : undefined,
          },
          quantity: safeQty,
        };
      })
      .filter((entry) => entry.quantity > 0);
  }, [cart, products]);

  const cartCount = useMemo(
    () => normalizedCart.reduce((acc, item) => acc + item.quantity, 0),
    [normalizedCart]
  );
  const cartTotal = useMemo(
    () => normalizedCart.reduce((acc, item) => acc + item.product.price * item.quantity, 0),
    [normalizedCart]
  );

  const groceryCartEntries = useMemo(
    () => normalizedCart.filter((c) => c.product.cat_id === 6),
    [normalizedCart]
  );
  const groceryCartCount = useMemo(
    () => groceryCartEntries.reduce((acc, item) => acc + item.quantity, 0),
    [groceryCartEntries]
  );
  const displayedCartEntries = useMemo(
    () => (cartTab === 'grocery' ? groceryCartEntries : normalizedCart),
    [cartTab, groceryCartEntries, normalizedCart]
  );
  const displayedCartCount = useMemo(
    () => displayedCartEntries.reduce((acc, item) => acc + item.quantity, 0),
    [displayedCartEntries]
  );
  const displayedCartSubtotal = useMemo(
    () => displayedCartEntries.reduce((acc, item) => acc + Number(item.product.price) * Number(item.quantity), 0),
    [displayedCartEntries]
  );
  const displayedCartMrpTotal = useMemo(
    () =>
      displayedCartEntries.reduce(
        (acc, item) => acc + getEffectiveMrp(Number(item.product.price), item.product.mrp) * Number(item.quantity),
        0
      ),
    [displayedCartEntries]
  );
  const mrpDiscountAmount = useMemo(
    () => Math.max(0, displayedCartMrpTotal - displayedCartSubtotal),
    [displayedCartMrpTotal, displayedCartSubtotal]
  );

  const appliedPromoObj = useMemo(() => {
    const clean = appliedCouponCode.trim().toUpperCase();
    if (!clean) return null;
    return activePromoCodes.find((p) => p.code.toUpperCase() === clean) || null;
  }, [appliedCouponCode, activePromoCodes]);

  const couponDiscountAmount = useMemo(
    () => calculatePromoDiscount(displayedCartSubtotal, appliedPromoObj),
    [displayedCartSubtotal, appliedPromoObj]
  );

  // Free Delivery Nudge & Delivery Charge synced live from Firestore settings/delivery
  const freeDeliveryThreshold = Math.max(0, Number(deliverySettings.freeDeliveryThreshold ?? 499));
  const baseDeliveryCharge = Math.max(0, Number(deliverySettings.deliveryCharge ?? 40));
  const configuredPlatformFee = Math.max(0, Number(deliverySettings.platformFee ?? 10));

  const cartDeliveryFee = useMemo(() => {
    if (displayedCartEntries.length === 0) return 0;
    if (freeDeliveryThreshold === 0 || displayedCartSubtotal >= freeDeliveryThreshold) return 0;
    return baseDeliveryCharge;
  }, [displayedCartEntries.length, displayedCartSubtotal, freeDeliveryThreshold, baseDeliveryCharge]);

  const amountForFreeDelivery = useMemo(() => {
    if (freeDeliveryThreshold <= 0) return 0;
    return Math.max(0, freeDeliveryThreshold - displayedCartSubtotal);
  }, [freeDeliveryThreshold, displayedCartSubtotal]);

  const freeDeliveryProgressPct = useMemo(() => {
    if (freeDeliveryThreshold <= 0) return 100;
    return Math.min(100, Math.round((displayedCartSubtotal / freeDeliveryThreshold) * 100));
  }, [freeDeliveryThreshold, displayedCartSubtotal]);

  const activePlatformFee = displayedCartEntries.length > 0 ? configuredPlatformFee : 0;
  const finalCartPayable = useMemo(
    () =>
      displayedCartEntries.length > 0
        ? Math.max(0, displayedCartSubtotal - couponDiscountAmount + cartDeliveryFee + activePlatformFee)
        : 0,
    [displayedCartEntries.length, displayedCartSubtotal, couponDiscountAmount, cartDeliveryFee, activePlatformFee]
  );
  const totalCartSavings = useMemo(
    () => Math.max(0, mrpDiscountAmount + couponDiscountAmount + (cartDeliveryFee === 0 && displayedCartEntries.length > 0 ? baseDeliveryCharge : 0)),
    [mrpDiscountAmount, couponDiscountAmount, cartDeliveryFee, displayedCartEntries.length, baseDeliveryCharge]
  );

  // Full cart checkout totals (exact sync across Razorpay, COD, Firestore Order, and Tax Invoice)
  const checkoutCouponDiscount = useMemo(
    () => calculatePromoDiscount(cartTotal, appliedPromoObj),
    [cartTotal, appliedPromoObj]
  );
  const checkoutDeliveryFee = useMemo(() => {
    if (normalizedCart.length === 0) return 0;
    if (freeDeliveryThreshold === 0 || cartTotal >= freeDeliveryThreshold) return 0;
    return baseDeliveryCharge;
  }, [normalizedCart.length, cartTotal, freeDeliveryThreshold, baseDeliveryCharge]);
  const checkoutPlatformFee = normalizedCart.length > 0 ? configuredPlatformFee : 0;
  const checkoutPayableTotal = useMemo(
    () =>
      normalizedCart.length > 0
        ? Math.max(0, cartTotal - checkoutCouponDiscount + checkoutDeliveryFee + checkoutPlatformFee)
        : 0,
    [normalizedCart.length, cartTotal, checkoutCouponDiscount, checkoutDeliveryFee, checkoutPlatformFee]
  );

  const estimatedDeliveryDate = useMemo(() => {
    const dt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    return dt.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  }, []);

  const displayAddressSummary = useMemo(() => {
    if (savedAddress && (savedAddress.houseStreet || savedAddress.area || savedAddress.city)) {
      const parts = [savedAddress.houseStreet, savedAddress.area, savedAddress.city, savedAddress.state].filter(Boolean);
      const pinSuffix = savedAddress.pincode ? ` - ${savedAddress.pincode}` : '';
      return `${savedAddress.name ? `${savedAddress.name} · ` : ''}${parts.join(', ')}${pinSuffix}`;
    }
    return checkoutAddress || currentUser?.address || '';
  }, [savedAddress, checkoutAddress, currentUser]);

  const compactDeliverToLabel = useMemo(() => {
    if (savedAddress && (savedAddress.area || savedAddress.city || savedAddress.houseStreet)) {
      const shortParts = [savedAddress.area || savedAddress.houseStreet, savedAddress.city].filter(Boolean);
      const pin = savedAddress.pincode ? ` - ${savedAddress.pincode}` : '';
      return `${shortParts.join(', ')}${pin}`;
    }
    if (checkoutAddress) return checkoutAddress;
    if (currentUser?.address) return currentUser.address;
    if (deliveryPincode) {
      return deliveryPincode === DEFAULT_DELIVERY_PINCODE ? DEFAULT_DELIVERY_LABEL : deliveryPincode;
    }
    return DEFAULT_DELIVERY_LABEL;
  }, [savedAddress, checkoutAddress, currentUser, deliveryPincode]);

  const openAddressModal = useCallback(() => {
    const existingRaw = checkoutAddress || currentUser?.address || '';
    const extractedPin = savedAddress?.pincode || existingRaw.match(/\b\d{6}\b/)?.[0] || '';
    setGpsError('');
    setGpsSuccess('');
    setAddrName(savedAddress?.name || checkoutName || currentUser?.name || '');
    setAddrPhone(savedAddress?.phone || checkoutPhone || currentUser?.phone || '');
    if (savedAddress) {
      setAddrHouseStreet(savedAddress.houseStreet || '');
      setAddrArea(savedAddress.area || '');
      setAddrCity(savedAddress.city || '');
      setAddrState(savedAddress.state || '');
      setAddrPincode(savedAddress.pincode || '');
    } else if (existingRaw) {
      const parts = existingRaw.split(',').map((s) => s.trim()).filter(Boolean);
      setAddrHouseStreet(parts[0] || '');
      setAddrArea(parts.length >= 3 ? parts[1] : '');
      const lastPart = (parts[parts.length - 1] || '').replace(/\b\d{6}\b/g, '').replace(/-/g, '').trim();
      setAddrCity(parts.length >= 4 ? parts[2] : lastPart);
      setAddrState(parts.length >= 4 ? lastPart : '');
      setAddrPincode(extractedPin);
    } else {
      setAddrHouseStreet('');
      setAddrArea('');
      setAddrCity('');
      setAddrState('');
      setAddrPincode('');
    }
    setAddressModalOpen(true);
  }, [savedAddress, checkoutAddress, checkoutName, checkoutPhone, currentUser]);

  const handleUseCurrentLocation = useCallback(() => {
    setGpsError('');
    setGpsSuccess('');
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGpsError('Live GPS is not supported on this browser. Please enter your address manually below.');
      return;
    }

    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${encodeURIComponent(
            latitude
          )}&lon=${encodeURIComponent(longitude)}&addressdetails=1`;
          const response = await fetch(url, {
            headers: {
              Accept: 'application/json',
            },
          });
          if (!response.ok) {
            throw new Error('Geocoding service returned an error.');
          }
          const data = await response.json();
          const addr = data?.address || {};

          const detectedStreet = [addr.house_number, addr.road].filter(Boolean).join(', ').trim();
          const detectedArea =
            addr.suburb ||
            addr.neighbourhood ||
            addr.residential ||
            addr.quarter ||
            addr.city_district ||
            addr.village ||
            addr.hamlet ||
            addr.town ||
            '';
          const detectedCity =
            addr.city ||
            addr.town ||
            addr.state_district ||
            addr.county ||
            addr.village ||
            '';
          const detectedState = addr.state || '';
          const detectedPin = String(addr.postcode || '')
            .replace(/\D/g, '')
            .slice(0, 6);

          if (detectedStreet) {
            setAddrHouseStreet((prev) => prev.trim() || detectedStreet);
          }
          if (detectedArea) setAddrArea(detectedArea);
          if (detectedCity) setAddrCity(detectedCity);
          if (detectedState) setAddrState(detectedState);
          if (detectedPin) {
            setAddrPincode(detectedPin);
            if (detectedPin.length === 6) setDeliveryPincode(detectedPin);
          }

          const detectedSummary = [detectedArea, detectedCity, detectedState].filter(Boolean).join(', ');
          setGpsSuccess(
            detectedSummary || detectedPin
              ? `Location detected: ${detectedSummary}${detectedPin ? ` - ${detectedPin}` : ''}. Verify and tap Save.`
              : 'GPS coordinates fetched! Please verify your address fields below and tap Save.'
          );
        } catch {
          setGpsError(
            'Could not look up your street address automatically right now. Please enter your address manually below.'
          );
        } finally {
          setGpsLoading(false);
        }
      },
      (err) => {
        setGpsLoading(false);
        if (err.code === err.PERMISSION_DENIED) {
          setGpsError(
            'Location permission was denied. Please allow GPS access in your browser settings or enter your address manually below.'
          );
        } else if (err.code === err.TIMEOUT) {
          setGpsError('GPS request timed out. Please try again or enter your address manually below.');
        } else {
          setGpsError('Unable to detect your current location right now. Please enter your address manually below.');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0,
      }
    );
  }, []);

  const openAddressBook = useCallback((modeType: 'manage' | 'select' = 'select') => {
    setAddressBookMode(modeType);
    setAddressBookOpen(true);
  }, []);

  const applySelectedSavedAddress = useCallback((addr: SavedAddress) => {
    setSelectedAddressId(addr.id);
    setSavedAddress(addr);
    saveStructuredAddressLocal(addr);
    if (addr.pincode) setDeliveryPincode(addr.pincode);
    setCheckoutName(addr.name);
    setCheckoutPhone(addr.phone);
    setCheckoutAddress(formatSavedAddressLine(addr));
  }, []);

  const handleSaveAddressBook = useCallback(
    async (next: SavedAddress[], nextSelectedId?: string) => {
      const res = await saveUserAddressesFirestore(activeCustomerUid || undefined, next);
      setSavedAddresses(res.addresses);
      const chosen =
        res.addresses.find((a) => a.id === nextSelectedId) ||
        res.addresses.find((a) => a.isDefault) ||
        res.addresses[0] ||
        null;
      if (chosen) {
        applySelectedSavedAddress(chosen);
      } else {
        setSelectedAddressId('');
        setSavedAddress(null);
      }
    },
    [activeCustomerUid, applySelectedSavedAddress]
  );

  const handleApplyCouponCode = (rawCode: string, targetSubtotal?: number) => {
    const code = rawCode.trim().toUpperCase();
    const checkSubtotal = targetSubtotal !== undefined ? targetSubtotal : Math.max(displayedCartSubtotal, cartTotal);
    setCouponError('');
    if (!code) {
      setCouponError('Please enter a promo code.');
      return;
    }
    const found = activePromoCodes.find((c) => c.code.toUpperCase() === code);
    if (!found) {
      setCouponError('Invalid or inactive promo code.');
      return;
    }
    if (checkSubtotal < found.minOrderValue) {
      setCouponError(`Minimum order value of ${formatINR(found.minOrderValue)} required for ${found.code}.`);
      return;
    }
    const disc = calculatePromoDiscount(checkSubtotal, found);
    setAppliedCouponCode(found.code);
    setCouponDraft('');
    setCouponModalOpen(false);
    showModal({
      title: 'Promo Code Applied',
      message: `${found.code} applied! You save ${formatINR(disc)} on this order.`,
      type: 'success',
    });
  };

  const handleSaveCartAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = addrName.trim();
    const cleanPhone = addrPhone.replace(/\D/g, '').slice(-10);
    const cleanHouse = addrHouseStreet.trim();
    const cleanArea = addrArea.trim();
    const cleanCity = addrCity.trim();
    const cleanState = addrState.trim();
    const cleanPin = addrPincode.replace(/\D/g, '').slice(0, 6);

    if (cleanName.length < 2) {
      showModal({ title: 'Name Required', message: 'Please enter the recipient full name.', type: 'error' });
      return;
    }
    if (cleanPhone.length !== 10) {
      showModal({ title: 'Valid Phone Required', message: 'Please enter a valid 10-digit mobile number.', type: 'error' });
      return;
    }
    if ((cleanHouse.length < 3 && cleanArea.length < 2) || cleanCity.length < 2) {
      showModal({ title: 'Address Required', message: 'Please enter House/Street, Area, and City details.', type: 'error' });
      return;
    }
    if (cleanPin.length !== 6) {
      showModal({ title: 'Valid Pincode Required', message: 'Please enter a valid 6-digit Indian pincode.', type: 'error' });
      return;
    }

    const structured: SavedAddress = {
      id: savedAddress?.id || `addr_${Date.now()}`,
      label: savedAddress?.label || 'Home',
      name: cleanName,
      phone: cleanPhone,
      houseStreet: cleanHouse || cleanArea,
      area: cleanArea,
      city: cleanCity,
      state: cleanState,
      pincode: cleanPin,
      isDefault: true,
      updatedAt: new Date().toISOString(),
    };
    const formattedAddress = formatSavedAddressLine(structured);

    const merged = [
      structured,
      ...savedAddresses.filter((a) => a.id !== structured.id).map((a) => ({ ...a, isDefault: false })),
    ];
    await handleSaveAddressBook(merged, structured.id);
    setProfAddress(formattedAddress);

    if (currentUser) {
      showLoader('Saving delivery location...');
      const localRes = updateProfileLocal({
        id: currentUser.id,
        name: currentUser.name || cleanName,
        phone: currentUser.phone || cleanPhone,
        email: currentUser.email,
        address: formattedAddress,
      });
      await updateUserProfileFirestore({
        uid: currentUser.uid || auth.currentUser?.uid,
        docId: currentUser.docId || currentUser.uid || auth.currentUser?.uid,
        id: currentUser.id,
        name: currentUser.name || cleanName,
        phone: currentUser.phone || cleanPhone,
        email: currentUser.email,
        address: formattedAddress,
      });
      hideLoader();
      if (localRes.success && localRes.user) {
        setCurrentUser(localRes.user);
      }
    }
    setAddressModalOpen(false);
  };

  const toggleWishlist = async (productId: number) => {
    const res = await toggleWishlistItemFirestore(activeCustomerUid || undefined, wishlistIds, productId);
    setWishlistIds(res.ids);
  };

  const handleSaveForLater = async (prod: Product) => {
    if (!wishlistIds.includes(prod.id)) {
      const res = await toggleWishlistItemFirestore(activeCustomerUid || undefined, wishlistIds, prod.id);
      setWishlistIds(res.ids);
    }
    updateCartQty(prod.id, 0);
    showRiderToast(`${prod.name} saved to Wishlist for later.`, 'info');
  };

  const handleMoveWishlistToCart = async (prod: Product) => {
    if (prod.stock <= 0) {
      showModal({ title: 'Out of Stock', message: `${prod.name} is currently Out of Stock.`, type: 'error' });
      return;
    }
    addToCart(prod, 1, false);
    if (wishlistIds.includes(prod.id)) {
      const res = await toggleWishlistItemFirestore(activeCustomerUid || undefined, wishlistIds, prod.id);
      setWishlistIds(res.ids);
    }
  };

  const wishlistProducts = useMemo(
    () =>
      wishlistIds
        .map((id) => publicProducts.find((p) => p.id === id) || products.find((p) => p.id === id))
        .filter((p): p is Product => Boolean(p)),
    [wishlistIds, publicProducts, products]
  );

  const handleSubmitVerifiedReview = async (payload: { rating: number; title: string; comment: string }) => {
    if (!reviewModalTarget || !currentUser) return;
    showLoader('Publishing verified review...');
    const res = await submitProductReviewFirestore({
      product: reviewModalTarget.product,
      order: reviewModalTarget.order,
      user: currentUser,
      rating: payload.rating,
      title: payload.title,
      comment: payload.comment,
      existingReviews: allReviews,
    });
    hideLoader();
    if (res.success && res.review) {
      setAllReviews((prev) => [
        res.review!,
        ...prev.filter((r) => !(r.productId === res.review!.productId && r.userId === res.review!.userId)),
      ]);
      setReviewModalTarget(null);
      showModal({ title: 'Verified Review Published', message: res.message, type: 'success' });
    } else {
      showModal({ title: 'Review Not Allowed', message: res.message, type: 'error' });
    }
  };

  const handleShareProduct = async (prod: Product) => {
    const shareText = `Check out ${prod.name} at ${formatINR(prod.price)} on Smart Basket!`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: prod.name,
          text: shareText,
          url: window.location.href,
        });
        return;
      }
    } catch {
      // User dismissed or share unavailable
    }
    try {
      await navigator.clipboard.writeText(`${shareText} ${window.location.href}`);
      showModal({ title: 'Link Copied', message: 'Product link copied to clipboard. Ready to share!', type: 'success' });
    } catch {
      showModal({ title: 'Share Product', message: shareText, type: 'info' });
    }
  };

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const catNameById = new Map(categories.map((c) => [c.id, c.name.toLowerCase()]));
    const list = publicProducts.filter((p) => {
      if (filterCatId > 0 && p.cat_id !== filterCatId) return false;
      if (maxPrice > 0 && p.price > maxPrice) return false;
      if (q) {
        const catName = catNameById.get(p.cat_id) || '';
        const matchName = p.name.toLowerCase().includes(q);
        const matchDesc = p.description.toLowerCase().includes(q);
        const matchCat = catName.includes(q);
        const matchSeller = Boolean(p.sellerName && p.sellerName.toLowerCase().includes(q));
        if (!matchName && !matchDesc && !matchCat && !matchSeller) return false;
      }
      return true;
    });

    if (sortBy === 'price_asc') return [...list].sort((a, b) => a.price - b.price);
    if (sortBy === 'price_desc') return [...list].sort((a, b) => b.price - a.price);
    if (sortBy === 'top_rated') {
      return [...list].sort((a, b) => {
        const statsA = productReviewStats.get(a.id);
        const statsB = productReviewStats.get(b.id);
        const ratingDiff = (statsB?.avg || 0) - (statsA?.avg || 0);
        if (ratingDiff !== 0) return ratingDiff;
        return (statsB?.count || 0) - (statsA?.count || 0);
      });
    }
    // Relevance: prioritize exact/prefix name matches when searching
    if (q) {
      return [...list].sort((a, b) => {
        const score = (item: Product) => {
          const n = item.name.toLowerCase();
          if (n.startsWith(q)) return 3;
          if (n.includes(q)) return 2;
          if ((catNameById.get(item.cat_id) || '').includes(q)) return 1;
          return 0;
        };
        return score(b) - score(a);
      });
    }
    return list;
  }, [publicProducts, categories, filterCatId, maxPrice, searchQuery, sortBy]);

  const selectedProduct = useMemo(
    () => publicProducts.find((p) => p.id === selectedProductId) || products.find((p) => p.id === selectedProductId) || null,
    [publicProducts, products, selectedProductId]
  );

  const userOrders = useMemo(() => {
    if (!currentUser) return [];
    return orders.filter(
      (o) =>
        (o.userId && (o.userId === currentUser.uid || o.userId === String(currentUser.id))) ||
        o.user_id === currentUser.id
    );
  }, [orders, currentUser]);

  const findDeliveredOrderForProduct = useCallback(
    (productId: number): Order | null => {
      return (
        userOrders.find(
          (ord) =>
            ord.status === 'Delivered' &&
            (ord.items || []).some((it) => Number(it.product_id) === Number(productId))
        ) || null
      );
    },
    [userOrders]
  );

  const activeOrders = useMemo(
    () =>
      userOrders.filter((o) =>
        ['Placed', 'Confirmed', 'Packed', 'Shipped', 'Dispatched', 'Out for Delivery'].includes(o.status)
      ),
    [userOrders]
  );
  const historyOrders = useMemo(
    () =>
      userOrders.filter((o) =>
        ['Delivered', 'Return Requested', 'Return Approved', 'Refunded', 'Cancelled'].includes(o.status)
      ),
    [userOrders]
  );

  const openProductDetail = (prod: Product) => {
    setSelectedProductId(prod.id);
    setDetailSlideIdx(0);
    setDetailQty(1);
    setEditingPincode(false);
    setPage('detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const addToCart = (prod: Product, qty = 1, buyNow = false) => {
    if (prod.stock <= 0) {
      showModal({ title: 'Out of Stock', message: 'This item is currently unavailable.', type: 'error' });
      return;
    }
    const safeAddQty = Math.max(1, Math.floor(Number(qty) || 1));
    showLoader(buyNow ? 'Preparing checkout...' : 'Adding to cart...');
    window.setTimeout(() => {
      setCart((prev) => {
        const existing = prev.find((c) => c.product.id === prod.id);
        const maxStock = Math.max(1, Number(prod.stock) || 99);
        const nextCart = existing
          ? prev.map((c) =>
              c.product.id === prod.id
                ? { ...c, product: prod, quantity: Math.min(maxStock, Number(c.quantity) + safeAddQty) }
                : c
            )
          : [...prev, { product: prod, quantity: Math.min(maxStock, safeAddQty) }];
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
    const liveProd = products.find((p) => p.id === productId);
    setCart((prev) => {
      const nextCart =
        qty <= 0
          ? prev.filter((c) => c.product.id !== productId)
          : prev.map((c) => {
              if (c.product.id !== productId) return c;
              const maxStock = Math.max(1, Number(liveProd?.stock ?? c.product.stock) || 99);
              return {
                ...c,
                product: liveProd || c.product,
                quantity: Math.min(maxStock, Math.floor(Number(qty) || 1)),
              };
            });
      saveCart(nextCart);
      return nextCart;
    });
  };

  const markOnboardingComplete = useCallback(() => {
    try {
      localStorage.setItem(ONBOARDED_STORAGE_KEY, 'true');
    } catch {
      // ignore storage errors
    }
    setHasCompletedOnboarding(true);
  }, []);

  const completeCustomerLogin = (user: User) => {
    markOnboardingComplete();
    refreshLocalSession();
    setCurrentUser(user);
    setAuthError('');
    setAuthPassword('');
    setPage('home');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authBusy) return;
    const email = authEmail.trim();
    if (!email || !authPassword) {
      setAuthError('Please enter your email address and password.');
      return;
    }

    setAuthError('');
    setAuthBusy(true);
    isAuthActionInFlightRef.current = true;
    showLoader('Signing in...');

    try {
      // Auto-detect Delivery Partner credentials first (by email / phone / Rider ID + PIN)
      const riderCheck = await authenticateDeliveryBoyFirestore(email, authPassword);
      if (riderCheck.success && riderCheck.rider) {
        setCurrentRider(riderCheck.rider);
        setAuthPassword('');
        setMode('rider');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      if (riderCheck.pendingKyc) {
        setAuthError(riderCheck.message);
        return;
      }

      const cred = await signInWithEmailAndPassword(auth, email, authPassword);
      const fsRes = await syncUserProfileFirestore({
        uid: cred.user.uid,
        name: cred.user.displayName || undefined,
        email: cred.user.email || email,
        phone: cred.user.phoneNumber || undefined,
      });
      if (!fsRes.success && fsRes.message.includes('suspended')) {
        setAuthError(fsRes.message);
        return;
      }
      const res = syncFirebaseCustomerLocal({
        uid: cred.user.uid,
        docId: cred.user.uid,
        name: fsRes.user?.name || cred.user.displayName || undefined,
        email: cred.user.email || email,
        phone: fsRes.user?.phone || cred.user.phoneNumber || undefined,
        address: fsRes.user?.address,
        role: fsRes.user?.role,
        isSeller: fsRes.user?.isSeller,
        sellerStoreName: fsRes.user?.sellerStoreName,
      });
      if (!res.success || !res.user) {
        setAuthError(res.message || 'Unable to sign in.');
        return;
      }
      completeCustomerLogin(res.user);
    } catch (error) {
      setAuthError(getFirebaseAuthErrorMessage(error));
    } finally {
      isAuthActionInFlightRef.current = false;
      hideLoader();
      setAuthBusy(false);
    }
  };

  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authBusy) return;
    const name = authName.trim();
    const cleanDigits = authPhone.replace(/\D/g, '');
    const email = authEmail.trim();

    if (!name || name.length < 2) {
      setAuthError('Please enter your full name.');
      return;
    }
    if (cleanDigits.length !== 10) {
      setAuthError('Please enter a valid 10-digit Indian mobile number.');
      return;
    }
    if (!email || !email.includes('@')) {
      setAuthError('Please enter a valid email address.');
      return;
    }
    if (authPassword.length < 6) {
      setAuthError('Password must be at least 6 characters long.');
      return;
    }

    setAuthError('');
    setAuthBusy(true);
    isAuthActionInFlightRef.current = true;
    showLoader('Creating your account...');

    try {
      const cred = await createUserWithEmailAndPassword(auth, email, authPassword);
      await updateProfile(cred.user, { displayName: name }).catch(() => {});
      const fsRes = await syncUserProfileFirestore({
        uid: cred.user.uid,
        name,
        email: cred.user.email || email,
        phone: cleanDigits,
      });
      const res = syncFirebaseCustomerLocal({
        uid: cred.user.uid,
        docId: cred.user.uid,
        name: fsRes.user?.name || name,
        email: cred.user.email || email,
        phone: fsRes.user?.phone || cleanDigits,
        address: fsRes.user?.address,
        role: fsRes.user?.role,
        isSeller: fsRes.user?.isSeller,
        sellerStoreName: fsRes.user?.sellerStoreName,
      });
      if (!res.success || !res.user) {
        setAuthError(res.message || 'Unable to create account.');
        return;
      }
      completeCustomerLogin(res.user);
    } catch (error) {
      setAuthError(getFirebaseAuthErrorMessage(error));
    } finally {
      isAuthActionInFlightRef.current = false;
      hideLoader();
      setAuthBusy(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (authBusy) return;
    setAuthError('');
    setAuthBusy(true);
    isAuthActionInFlightRef.current = true;
    showLoader('Connecting with Google...');

    try {
      const cred = await signInWithPopup(auth, googleProvider);
      const email = cred.user.email;
      if (!email) {
        setAuthError('Google account did not return an email address.');
        return;
      }
      const fsRes = await syncUserProfileFirestore({
        uid: cred.user.uid,
        name: cred.user.displayName || undefined,
        email,
        phone: cred.user.phoneNumber || undefined,
      });
      if (!fsRes.success && fsRes.message.includes('suspended')) {
        setAuthError(fsRes.message);
        return;
      }
      const res = syncFirebaseCustomerLocal({
        uid: cred.user.uid,
        docId: cred.user.uid,
        name: fsRes.user?.name || cred.user.displayName || undefined,
        email,
        phone: fsRes.user?.phone || cred.user.phoneNumber || undefined,
        address: fsRes.user?.address,
        role: fsRes.user?.role,
        isSeller: fsRes.user?.isSeller,
        sellerStoreName: fsRes.user?.sellerStoreName,
      });
      if (!res.success || !res.user) {
        setAuthError(res.message || 'Unable to sign in with Google.');
        return;
      }
      completeCustomerLogin(res.user);
    } catch (error) {
      const code = (error as { code?: string } | null)?.code || '';
      if (
        code === 'auth/popup-blocked' ||
        code === 'auth/operation-not-supported-in-this-environment' ||
        code === 'auth/cancelled-popup-request'
      ) {
        try {
          await signInWithRedirect(auth, googleProvider);
          return;
        } catch (redirectError) {
          setAuthError(getFirebaseAuthErrorMessage(redirectError));
        }
      } else {
        setAuthError(getFirebaseAuthErrorMessage(error));
      }
    } finally {
      isAuthActionInFlightRef.current = false;
      hideLoader();
      setAuthBusy(false);
    }
  };

  const handleCustomerLogout = () => {
    setStoredCurrentUser(null);
    setCurrentUser(null);
    setOrders([]);
    setAuthError('');
    setAuthPassword('');
    setAdminPinVerified(false);
    setAdminPinModalOpen(false);
    setMode('user');
    signOut(auth).catch(() => {});
    setSidebarOpen(false);
    setPage('login');
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

    const outOfStockItem = normalizedCart.find(
      (c) => c.product.stock <= 0 || c.quantity > c.product.stock
    );
    if (outOfStockItem) {
      showModal({
        title: 'Insufficient Stock',
        message:
          outOfStockItem.product.stock <= 0
            ? `${outOfStockItem.product.name} is currently Out of Stock. Please remove it from your cart to continue.`
            : `Only ${outOfStockItem.product.stock} unit(s) of ${outOfStockItem.product.name} left in stock.`,
        type: 'error',
      });
      return;
    }

    const orderedQuantities = normalizedCart.map((c) => ({
      productId: c.product.id,
      quantity: Math.max(1, Math.floor(Number(c.quantity) || 1)),
    }));

    const finalizeOrder = async (methodLabel: string) => {
      showLoader('Locking inventory & placing order...');
      const res = await placeOrderFirestore({
        userId: currentUser.uid || auth.currentUser?.uid || String(currentUser.id),
        numericUserId: currentUser.id,
        name: checkoutName,
        phone: checkoutPhone,
        email: currentUser.email || auth.currentUser?.email || '',
        address: checkoutAddress,
        paymentMethod: methodLabel,
        deliveryFee: checkoutDeliveryFee,
        platformFee: checkoutPlatformFee,
        couponCode: checkoutCouponDiscount > 0 ? appliedCouponCode : '',
        couponDiscount: checkoutCouponDiscount,
        items: normalizedCart.map((c) => ({ product: c.product, quantity: c.quantity })),
      });
      hideLoader();
      if (res.success) {
        if (checkoutCouponDiscount > 0 && appliedCouponCode) {
          incrementPromoCodeUsageFirestore(appliedCouponCode).catch(() => {});
        }
        const qtyByProductId = new Map<number, number>();
        orderedQuantities.forEach((item) => {
          qtyByProductId.set(item.productId, (qtyByProductId.get(item.productId) || 0) + item.quantity);
        });
        setProducts((prev) =>
          prev.map((p) => {
            const deduct = qtyByProductId.get(p.id);
            if (!deduct) return p;
            return { ...p, stock: Math.max(0, Math.floor(Number(p.stock) - deduct)) };
          })
        );
        saveCart([]);
        setCart([]);
        setAppliedCouponCode('');
        setOrderTab('active');
        setPage('orders');
        showModal({ title: 'Order Confirmed', message: res.message, type: 'success' });
      } else {
        showModal({ title: 'Checkout Error', message: res.message, type: 'error' });
      }
    };

    if (paymentMethod === 'Cash on Delivery') {
      await finalizeOrder('Cash on Delivery');
      return;
    }

    const RazorpayConstructor = (window as unknown as { Razorpay?: new (opts: Record<string, unknown>) => { open: () => void } }).Razorpay;
    if (!RazorpayConstructor) {
      showModal({ title: 'Payment Unavailable', message: 'Razorpay SDK failed to load. Please check internet or select Cash on Delivery.', type: 'error' });
      return;
    }

    const rzp = new RazorpayConstructor({
      key: 'rzp_live_U1t08rrhb6TEXG',
      amount: Math.round(checkoutPayableTotal * 100),
      currency: 'INR',
      name: 'Smart Basket',
      description: 'Order Payment',
      prefill: {
        name: checkoutName,
        contact: checkoutPhone,
        email: currentUser.email || auth.currentUser?.email || '',
      },
      theme: { color: '#2874F0' },
            config: {
        display: {
          blocks: {
            upi: {
              name: 'Pay via UPI ID / QR',
              instruments: [
                {
                  method: 'upi',
                  flows: ['collect', 'qr'],
                },
              ],
            },
          },
          sequence: ['block.upi', 'block.card', 'block.netbanking', 'block.wallet'],
          preferences: { show_default_blocks: true },
        },
      },
      
      
      handler: async (response: { razorpay_payment_id?: string }) => {
        const payId = response?.razorpay_payment_id ? ` (${response.razorpay_payment_id})` : '';
        await finalizeOrder(`Online Paid${payId}`);
      },
    });
    rzp.open();
  };
  
  const handleCancelOrder = (ord: Order) => {
    showModal({
      title: `Cancel Order #${ord.id}`,
      message: 'Are you sure you want to cancel this order?',
      type: 'info',
      confirmText: 'Yes, Cancel',
      onConfirm: async () => {
        showLoader('Cancelling...');
        const res = await cancelOrderFirestore(ord);
        hideLoader();
        if (!res.success) {
          showModal({ title: 'Notice', message: res.message, type: 'error' });
        }
      },
    });
  };

  const handleProfileSave = async (e: React.FormEvent) => {
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
    const fsRes = await updateUserProfileFirestore({
      uid: currentUser.uid || auth.currentUser?.uid,
      docId: currentUser.docId || currentUser.uid || auth.currentUser?.uid,
      id: currentUser.id,
      name: profName,
      phone: profPhone,
      email: profEmail,
      address: profAddress,
    });
    if (res.success && auth.currentUser && profName.trim()) {
      await updateProfile(auth.currentUser, { displayName: profName.trim() }).catch(() => {});
    }
    hideLoader();
    if (res.success && res.user) {
      refreshLocalSession();
      setCurrentUser(res.user);
    }
    const finalOk = res.success && fsRes.success;
    showModal({
      title: finalOk ? 'Saved' : 'Error',
      message: !fsRes.success ? fsRes.message : res.message,
      type: finalOk ? 'success' : 'error',
    });
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    showLoader('Updating password...');

    const fbUser = auth.currentUser;
    const usesPasswordProvider = fbUser?.providerData?.some((p) => p.providerId === 'password');
    if (fbUser && fbUser.email && usesPasswordProvider) {
      try {
        const credential = EmailAuthProvider.credential(fbUser.email, currPass);
        await reauthenticateWithCredential(fbUser, credential);
        await updatePassword(fbUser, newPass);
        hideLoader();
        setCurrPass('');
        setNewPass('');
        showModal({ title: 'Updated', message: 'Password updated successfully.', type: 'success' });
      } catch (err) {
        hideLoader();
        showModal({ title: 'Error', message: getFirebaseAuthErrorMessage(err), type: 'error' });
      }
      return;
    }

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
    const stats = productReviewStats.get(prod.id);
    const realRatingCount = stats?.count || 0;
    const realRatingAvg = stats?.avg || 0;
    const isOutOfStock = prod.stock <= 0;
    const isLowStock = prod.stock > 0 && prod.stock <= 5;
    const isWishlisted = wishlistIds.includes(prod.id);

    return (
      <div
        key={prod.id}
        className="bg-white rounded-lg border border-slate-200/80 overflow-hidden flex flex-col hover:shadow-md transition"
      >
        <div className="relative aspect-square bg-slate-50 overflow-hidden p-2">
          <button
            type="button"
            onClick={() => openProductDetail(prod)}
            className="block w-full h-full overflow-hidden rounded-md"
          >
            <img
              src={prod.image}
              alt={prod.name}
              referrerPolicy="no-referrer"
              className={`w-full h-full object-cover rounded-md hover:scale-105 transition duration-300 ${
                isOutOfStock ? 'opacity-55 grayscale-[30%]' : ''
              }`}
            />
          </button>
          {isOutOfStock && (
            <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded bg-rose-600 text-white text-[10px] font-extrabold uppercase tracking-wide shadow-xs">
              Out of Stock
            </span>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleWishlist(prod.id);
            }}
            aria-label={isWishlisted ? 'Remove from Wishlist' : 'Save to Wishlist'}
            className={`absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-white/95 border border-slate-200/80 shadow-xs flex items-center justify-center transition active:scale-90 ${
              isWishlisted ? 'text-[#E53935]' : 'text-slate-400 hover:text-[#E53935]'
            }`}
          >
            <i className={`${isWishlisted ? 'fa-solid' : 'fa-regular'} fa-heart text-xs`}></i>
          </button>
        </div>

        <div className="p-2.5 sm:p-3.5 flex-1 flex flex-col">
          <button
            type="button"
            onClick={() => openProductDetail(prod)}
            className="text-left text-xs sm:text-sm font-semibold text-slate-900 line-clamp-2 leading-snug hover:text-[#2874F0] transition"
          >
            {prod.name}
          </button>

          <div className="mt-1.5 flex items-center gap-1.5 min-h-[18px]">
            {realRatingCount > 0 ? (
              <>
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-sm bg-[#388E3C] text-white text-[11px] font-bold leading-none tabular-nums">
                  <span>{realRatingAvg.toFixed(1)}</span>
                  <i className="fa-solid fa-star text-[9px]"></i>
                </span>
                <span className="text-[11px] text-slate-500 font-medium tabular-nums">
                  ({realRatingCount.toLocaleString('en-IN')})
                </span>
              </>
            ) : (
              <span className="text-[11px] text-slate-400 font-medium">No verified reviews yet</span>
            )}
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

          <div className="mt-1 flex items-center justify-between gap-1">
            {isOutOfStock ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-rose-600">
                <i className="fa-solid fa-circle-xmark text-[10px]"></i>
                <span>Out of Stock</span>
              </span>
            ) : isLowStock ? (
              <span className="text-[11px] font-extrabold text-rose-600">
                Only {prod.stock} left in stock!
              </span>
            ) : (
              <p className="text-[11px] font-medium text-slate-600">
                {freeDeliveryThreshold === 0 || prod.price >= freeDeliveryThreshold
                  ? 'Free Delivery'
                  : `Free delivery above ${formatINR(freeDeliveryThreshold)}`}
              </p>
            )}
          </div>

          <div className="mt-auto pt-2.5 grid grid-cols-2 gap-1.5">
            <button
              type="button"
              disabled={isOutOfStock}
              onClick={() => addToCart(prod, 1, false)}
              className="min-h-[38px] px-1.5 rounded-md bg-[#FF9F00] text-white text-[11px] sm:text-xs font-bold hover:bg-[#e89100] active:scale-95 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed disabled:active:scale-100 transition whitespace-nowrap"
            >
              {isOutOfStock ? 'Out of Stock' : 'Add to Cart'}
            </button>
            <button
              type="button"
              disabled={isOutOfStock}
              onClick={() => addToCart(prod, 1, true)}
              className="min-h-[38px] px-1.5 rounded-md bg-[#FB641B] text-white text-[11px] sm:text-xs font-bold hover:bg-[#e55812] active:scale-95 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed disabled:active:scale-100 transition whitespace-nowrap"
            >
              Buy Now
            </button>
          </div>
        </div>
      </div>
    );
  };

  const handleCopyTrackingId = async (orderId: number, awb: string) => {
    try {
      if (navigator.clipboard && awb) {
        await navigator.clipboard.writeText(awb);
      }
      setCopiedTrackingOrderId(orderId);
      window.setTimeout(() => {
        setCopiedTrackingOrderId((prev) => (prev === orderId ? null : prev));
      }, 2000);
    } catch {
      setCopiedTrackingOrderId(orderId);
    }
  };

  const openReturnModal = (ord: Order) => {
    setReturnModalOrder(ord);
    setReturnReasonDraft(RETURN_REASONS[0]);
    setReturnResolutionDraft('Return');
    setReturnExtraNote('');
  };

  const handleSubmitReturnRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnModalOrder) return;
    const combinedReason = returnExtraNote.trim()
      ? `${returnReasonDraft} — ${returnExtraNote.trim()}`
      : returnReasonDraft;
    showLoader('Submitting return request...');
    const res = await requestOrderReturnFirestore(returnModalOrder, {
      returnReason: combinedReason,
      returnResolution: returnResolutionDraft,
    });
    hideLoader();
    if (res.success) {
      setOrders((prev) =>
        prev.map((o) =>
          o.id === returnModalOrder.id
            ? {
                ...o,
                status: 'Return Requested',
                returnReason: combinedReason,
                returnResolution: returnResolutionDraft,
                returnRequestedAt: new Date().toISOString(),
              }
            : o
        )
      );
      setReturnModalOrder(null);
      refreshLocalSession();
      showModal({
        title: `${returnResolutionDraft} Request Submitted`,
        message: res.message,
        type: 'success',
      });
    } else {
      showModal({ title: 'Error', message: res.message, type: 'error' });
    }
  };

  const renderOrderCard = (ord: Order) => {
    const firstItem = ord.items[0];
    const extraCount = Math.max(0, ord.items.length - 1);
    const stepIdx = getOrderStepIndex(ord.status);
    const isCancelled = ord.status === 'Cancelled';
    const isReturnState =
      ord.status === 'Return Requested' ||
      ord.status === 'Return Approved' ||
      ord.status === 'Refunded';
    const isExpanded = expandedOrderIds.includes(ord.id);
    const canCancel = ord.status === 'Placed' || ord.status === 'Confirmed';
    const canRequestReturn = ord.status === 'Delivered';
    const liveTrackUrl = getCourierTrackingUrl(ord.courierName, ord.trackingId, ord.trackingUrl);
    const hasCourierInfo = Boolean(ord.courierName || ord.trackingId || ord.trackingNote || liveTrackUrl);

    const progressPercent =
      stepIdx <= 1
        ? '0%'
        : stepIdx === 2
        ? '25%'
        : stepIdx === 3
        ? '50%'
        : stepIdx === 4
        ? '75%'
        : '100%';

    const trackingSteps = [
      { step: 1, label: 'Confirmed', icon: 'fa-check' },
      { step: 2, label: 'Packed', icon: 'fa-box' },
      { step: 3, label: 'Shipped', icon: 'fa-truck-fast' },
      { step: 4, label: 'Out for Delivery', icon: 'fa-motorcycle' },
      { step: 5, label: 'Delivered', icon: 'fa-house-circle-check' },
    ];

    return (
      <div key={ord.docId || ord.id} className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
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
                className={`text-xs font-bold inline-flex items-center gap-1 ${
                  isCancelled
                    ? 'text-rose-600'
                    : ord.status === 'Return Requested'
                    ? 'text-amber-700'
                    : ord.status === 'Return Approved'
                    ? 'text-[#2874F0]'
                    : 'text-[#2E7D32]'
                }`}
              >
                <i
                  className={`fa-solid ${
                    isCancelled
                      ? 'fa-circle-xmark'
                      : ord.status === 'Return Requested' || ord.status === 'Return Approved'
                      ? 'fa-rotate-left'
                      : ord.status === 'Refunded'
                      ? 'fa-wallet'
                      : stepIdx >= 5
                      ? 'fa-circle-check'
                      : stepIdx === 4
                      ? 'fa-motorcycle'
                      : stepIdx === 3
                      ? 'fa-truck-fast'
                      : stepIdx === 2
                      ? 'fa-box'
                      : 'fa-circle-check'
                  }`}
                ></i>
                <span>{getOrderStatusLabel(ord.status)}</span>
              </span>
            </div>
            <h3 className="mt-0.5 text-sm font-bold text-slate-900 truncate">
              {firstItem?.product_name || 'Smart Basket Order'}
              {extraCount > 0 ? ` + ${extraCount} more` : ''}
            </h3>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-sm font-extrabold text-slate-900 font-mono tabular-nums">
                {formatINR(ord.total_amount)}
              </span>
              <span className="text-[11px] text-slate-500">
                {new Date(ord.created_at).toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
            </div>
          </div>
        </div>

        {/* 5-Step Visual Progress Tracker highlighted in Green up to current status */}
        {!isCancelled ? (
          <div className="px-2 sm:px-5 pt-3 pb-4 border-t border-slate-100 bg-slate-50/60">
            <div className="relative grid grid-cols-5 items-start">
              <div className="absolute left-[10%] right-[10%] top-3.5 h-1 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#2E7D32] rounded-full transition-all duration-300"
                  style={{ width: progressPercent }}
                />
              </div>
              {trackingSteps.map((st) => {
                const reached = stepIdx >= st.step;
                const isCurrent = stepIdx === st.step;
                return (
                  <div key={st.label} className="relative z-10 flex flex-col items-center text-center px-0.5">
                    <div
                      className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-[10px] sm:text-[11px] transition ${
                        reached
                          ? 'bg-[#2E7D32] text-white shadow-xs'
                          : 'bg-slate-200 text-slate-500'
                      } ${isCurrent ? 'ring-4 ring-emerald-100' : ''}`}
                    >
                      <i className={`fa-solid ${st.icon}`}></i>
                    </div>
                    <span
                      className={`mt-1.5 text-[9px] sm:text-[11px] leading-tight font-bold ${
                        reached ? 'text-[#1B5E20]' : 'text-slate-400'
                      }`}
                    >
                      {st.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="px-4 py-2.5 border-t border-rose-100 bg-rose-50/70 text-xs font-semibold text-rose-700 flex items-center gap-2">
            <i className="fa-solid fa-circle-xmark"></i>
            <span>This order was cancelled.</span>
          </div>
        )}

        {/* Own Delivery Partner Live Info + Live GPS Map + 4-Digit Delivery OTP */}
        {!isCancelled && (ord.deliveryBoyName || ord.deliveryOtp) && ord.dispatchMode !== 'courier' && (
          <div className="px-4 py-3.5 border-t border-slate-100 bg-gradient-to-r from-blue-50/70 to-indigo-50/50 space-y-3">
            {ord.deliveryBoyName && (() => {
              const deliveryStage = getOrderDeliveryStage(ord);
              const riderPhoneClean = (ord.deliveryBoyPhone || '').replace(/[^\d+]/g, '');
              const hasLiveGps =
                typeof ord.riderLiveLat === 'number' && typeof ord.riderLiveLng === 'number';
              const riderLiveMapUrl = hasLiveGps
                ? `https://www.google.com/maps?q=${ord.riderLiveLat},${ord.riderLiveLng}`
                : '';

              return (
                <div className="space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-[#2874F0] text-white flex items-center justify-center shrink-0 shadow-xs">
                        <i className="fa-solid fa-motorcycle text-sm"></i>
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500">
                            Delivery Partner
                          </span>
                          {deliveryStage && (
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                                deliveryStage === 'Delivered'
                                  ? 'bg-emerald-100 text-[#2E7D32]'
                                  : deliveryStage === 'Out for Delivery'
                                  ? 'bg-orange-100 text-orange-800'
                                  : 'bg-blue-100 text-[#2874F0]'
                              }`}
                            >
                              {deliveryStage}
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-extrabold text-slate-900 truncate">
                          {ord.deliveryBoyName}
                        </p>
                        {ord.deliveryBoyPhone && (
                          <p className="text-xs text-slate-600 font-mono">{ord.deliveryBoyPhone}</p>
                        )}
                      </div>
                    </div>

                    {riderPhoneClean && (
                      <a
                        href={`tel:${riderPhoneClean}`}
                        className="px-3 py-1.5 rounded-lg bg-[#2E7D32] hover:bg-emerald-800 text-white text-xs font-extrabold inline-flex items-center gap-1.5 shadow-2xs transition shrink-0"
                      >
                        <i className="fa-solid fa-phone text-[11px]"></i>
                        <span>Call Rider</span>
                      </a>
                    )}
                  </div>

                  {/* Live GPS Rider Map Tracking Button when Out for Delivery */}
                  {ord.status === 'Out for Delivery' && hasLiveGps && (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white border border-emerald-200 px-3 py-2.5 shadow-2xs">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                        <div>
                          <p className="font-extrabold text-emerald-900">Rider Live GPS Active</p>
                          {ord.riderLocationUpdatedAt && (
                            <p className="text-[10px] text-slate-500">
                              Updated{' '}
                              {new Date(ord.riderLocationUpdatedAt).toLocaleTimeString('en-IN', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                          )}
                        </div>
                      </div>
                      <a
                        href={riderLiveMapUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3.5 py-2 rounded-lg bg-[#2874F0] hover:bg-[#1e60d5] text-white text-xs font-extrabold inline-flex items-center gap-1.5 shadow-xs transition shrink-0"
                      >
                        <i className="fa-solid fa-location-crosshairs"></i>
                        <span>Track Rider Live on Map</span>
                      </a>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* 4-Digit Delivery Verification OTP Box */}
            {ord.deliveryOtp && ord.status !== 'Delivered' && !isReturnState && (
              <div className="rounded-xl bg-amber-50 border border-amber-300 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800">
                    Delivery Verification OTP
                  </p>
                  <p className="text-[11px] text-amber-900">
                    Share this 4-digit OTP with your delivery partner upon receiving your parcel.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-lg bg-white border border-amber-300 font-mono text-base font-extrabold tracking-[0.25em] text-amber-950 select-text">
                    {ord.deliveryOtp}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopyDeliveryOtp(ord.id, ord.deliveryOtp || '')}
                    className="px-2.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold transition"
                  >
                    {copiedOtpOrderId === ord.id ? 'Copied ✓' : 'Copy'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Third-Party Courier & Live Shipment Tracking Box */}
        {hasCourierInfo && !isCancelled && (!ord.deliveryBoyName || ord.dispatchMode === 'courier') && (
          <div className="px-4 py-3 border-t border-slate-100 bg-blue-50/40 space-y-2.5">
            {ord.trackingNote && (
              <div className="flex items-start gap-2 text-xs">
                <span className="mt-1 w-2 h-2 rounded-full bg-[#2E7D32] shrink-0 animate-pulse"></span>
                <p className="font-semibold text-slate-800 leading-snug">
                  <span className="text-[11px] uppercase tracking-wide font-extrabold text-[#2E7D32] mr-1.5">
                    Live Update:
                  </span>
                  {ord.trackingNote}
                </p>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {ord.courierName && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-slate-200 font-bold text-slate-800">
                    <i className="fa-solid fa-truck-fast text-[#2874F0] text-[11px]"></i>
                    <span>{ord.courierName}</span>
                  </span>
                )}
                {ord.trackingId && (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-slate-200">
                    <span className="text-[10px] font-bold uppercase text-slate-400">AWB</span>
                    <span className="font-mono font-bold text-slate-900 select-text">{ord.trackingId}</span>
                    <button
                      type="button"
                      onClick={() => handleCopyTrackingId(ord.id, ord.trackingId || '')}
                      className="ml-1 px-1.5 py-0.5 rounded bg-blue-50 text-[#2874F0] hover:bg-blue-100 text-[10px] font-extrabold transition"
                    >
                      {copiedTrackingOrderId === ord.id ? (
                        <>
                          <i className="fa-solid fa-check mr-0.5"></i>Copied
                        </>
                      ) : (
                        <>
                          <i className="fa-regular fa-copy mr-0.5"></i>Copy
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

              {liveTrackUrl && (
                <a
                  href={liveTrackUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-1.5 rounded-lg bg-[#2874F0] text-white text-xs font-extrabold hover:bg-[#1e60d5] transition inline-flex items-center gap-1.5 shrink-0"
                >
                  <i className="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>
                  <span>Track Live Shipment</span>
                </a>
              )}
            </div>
          </div>
        )}

        {/* 7-Day Return / Refund Status Banner */}
        {isReturnState && (
          <div
            className={`px-4 py-3 border-t text-xs flex items-start gap-2.5 ${
              ord.status === 'Refunded'
                ? 'border-emerald-100 bg-emerald-50/70 text-emerald-900'
                : ord.status === 'Return Approved'
                ? 'border-blue-100 bg-blue-50/70 text-blue-900'
                : 'border-amber-200 bg-amber-50/80 text-amber-950'
            }`}
          >
            <i
              className={`fa-solid mt-0.5 shrink-0 ${
                ord.status === 'Refunded'
                  ? 'fa-circle-check text-[#2E7D32]'
                  : ord.status === 'Return Approved'
                  ? 'fa-truck-pickup text-[#2874F0]'
                  : 'fa-rotate-left text-amber-600'
              }`}
            ></i>
            <div className="space-y-0.5">
              <p className="font-extrabold">
                {ord.status === 'Refunded'
                  ? 'Refund Completed — Credited to original payment method (5–7 business days)'
                  : ord.status === 'Return Approved'
                  ? `${ord.returnResolution || 'Return'} Approved — Pickup & refund/replacement scheduled`
                  : `${ord.returnResolution || 'Return'} Requested — Under Smart Basket Support review`}
              </p>
              {ord.returnReason && (
                <p className="text-[11px] opacity-90">
                  <strong>Reason:</strong> {ord.returnReason}
                </p>
              )}
            </div>
          </div>
        )}

        <div className="px-4 py-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 bg-white">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() =>
                setExpandedOrderIds((prev) =>
                  prev.includes(ord.id) ? prev.filter((x) => x !== ord.id) : [...prev, ord.id]
                )
              }
              className="text-xs font-bold text-[#2874F0] hover:underline flex items-center gap-1.5"
            >
              <span>View Details</span>
              <i className={`fa-solid fa-chevron-down text-[10px] transition-transform ${isExpanded ? 'rotate-180' : ''}`}></i>
            </button>
            {!isCancelled && (
              <button
                type="button"
                onClick={() => setInvoiceModalOrder(ord)}
                className="text-xs font-bold text-slate-600 hover:text-[#2874F0] inline-flex items-center gap-1"
              >
                <i className="fa-solid fa-file-invoice text-[11px]"></i>
                <span>Tax Invoice</span>
              </button>
            )}
          </div>
          <div className="flex items-center gap-2.5">
            {canRequestReturn && (
              <button
                type="button"
                onClick={() => openReturnModal(ord)}
                className="px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 text-xs font-extrabold hover:bg-amber-100 transition inline-flex items-center gap-1.5"
              >
                <i className="fa-solid fa-rotate-left text-[11px]"></i>
                <span>Request Return / Replace</span>
              </button>
            )}
            {canCancel && (
              <button
                type="button"
                onClick={() => handleCancelOrder(ord)}
                className="text-xs font-semibold text-rose-600 hover:text-rose-700"
              >
                Cancel Order
              </button>
            )}
          </div>
        </div>

        {/* Verified Purchase Review Strip (only unlocked when Order Status === Delivered) */}
        {ord.status === 'Delivered' && currentUser && (
          <div className="px-4 py-2.5 border-t border-emerald-100 bg-emerald-50/40 space-y-2">
            <p className="text-[11px] font-extrabold text-emerald-900 flex items-center gap-1.5">
              <i className="fa-solid fa-star text-amber-500"></i>
              <span>Verified Purchase · Rate &amp; Review Delivered Items</span>
            </p>
            <div className="space-y-1.5">
              {ord.items.map((it) => {
                const matchedProduct =
                  products.find((p) => p.id === it.product_id) || {
                    id: it.product_id,
                    docId: it.product_doc_id,
                    cat_id: 1,
                    name: it.product_name,
                    description: '',
                    price: it.price,
                    stock: 0,
                    image: it.product_image,
                    created_at: ord.created_at,
                  };
                const uid = currentUser.uid || String(currentUser.id);
                const myExisting = allReviews.find(
                  (r) => r.productId === it.product_id && r.userId === uid
                );
                return (
                  <div
                    key={it.id}
                    className="flex items-center justify-between gap-2 bg-white px-3 py-2 rounded-lg border border-emerald-200/80"
                  >
                    <span className="text-xs font-semibold text-slate-800 truncate">
                      {it.product_name}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setReviewModalTarget({
                          product: matchedProduct,
                          order: ord,
                          existing: myExisting || null,
                        })
                      }
                      className="px-2.5 py-1 rounded-md bg-[#2874F0] hover:bg-[#1e60d5] text-white text-[11px] font-bold shrink-0 inline-flex items-center gap-1"
                    >
                      <i className="fa-solid fa-star text-[9px] text-[#FFE500]"></i>
                      <span>{myExisting ? `Rated ${myExisting.rating}★ (Edit)` : 'Write Review'}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {isExpanded && (
          <div className="px-4 pb-4 pt-2 border-t border-slate-100 bg-slate-50 space-y-3">
            <div className="space-y-2">
              {ord.items.map((it) => (
                <div key={it.id} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-semibold text-slate-800 truncate">{it.product_name}</span>
                    <span className="text-slate-500 shrink-0">× {it.quantity}</span>
                  </div>
                  <span className="font-mono font-semibold text-slate-800 tabular-nums shrink-0">
                    {formatINR(it.price * it.quantity)}
                  </span>
                </div>
              ))}
            </div>
            <div className="pt-2 border-t border-slate-200/70 text-xs text-slate-600 space-y-1">
              {Number(ord.couponDiscount || 0) > 0 && (
                <p className="text-emerald-700 font-semibold">
                  <strong>Promo ({ord.couponCode}):</strong> -{formatINR(Number(ord.couponDiscount || 0))}
                </p>
              )}
              <p>
                <strong className="text-slate-800">Delivery Charge:</strong>{' '}
                {Number(ord.deliveryFee || 0) > 0 ? formatINR(Number(ord.deliveryFee || 0)) : 'FREE'}
              </p>
              <p><strong className="text-slate-800">Recipient:</strong> {ord.name} · {ord.phone}</p>
              <p><strong className="text-slate-800">Delivery Address:</strong> {ord.address}</p>
              <p><strong className="text-slate-800">Payment:</strong> {ord.paymentMethod || 'Cash on Delivery'}</p>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#F1F3F6] text-slate-900 font-sans select-none overflow-x-hidden">
      {mode === 'admin' && isStrictAdminEmail && adminPinVerified ? (
        <AdminView
          categories={categories}
          products={products}
          orders={orders}
          users={users}
          adminUsername={adminUsername}
          onRefresh={refreshLocalSession}
          onExitAdmin={() => {
            setAdminPinVerified(false);
            setMode('user');
          }}
          showLoader={showLoader}
          hideLoader={hideLoader}
          showModal={showModal}
        />
      ) : mode === 'seller' ? (
        <SellerView
          currentUser={currentUser}
          categories={categories}
          products={products}
          onUserSignedIn={(user) => {
            refreshLocalSession();
            setCurrentUser(user);
          }}
          onRefresh={refreshLocalSession}
          onExitSeller={() => setMode('user')}
          showLoader={showLoader}
          hideLoader={hideLoader}
          showModal={showModal}
        />
      ) : mode === 'rider' ? (
        <>
          <RiderView
            rider={currentRider}
            initialView={riderInitialView}
            onRiderAuthenticated={(r) => setCurrentRider(r)}
            onRiderLogout={() => {
              setCurrentRider(null);
              setStoredCurrentRider(null);
            }}
            onExit={() => setMode('user')}
            showToast={showRiderToast}
          />
          {riderToast && (
            <div
              className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl shadow-xl text-xs font-bold text-white max-w-[90vw] text-center ${
                riderToast.type === 'error'
                  ? 'bg-rose-600'
                  : riderToast.type === 'success'
                  ? 'bg-emerald-600'
                  : 'bg-[#0F172A]'
              }`}
            >
              {riderToast.text}
            </div>
          )}
        </>
      ) : !hasCompletedOnboarding && !currentUser && !currentRider ? (
        !firebaseAuthResolved ? (
          <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-3 px-6">
            <div className="w-12 h-12 rounded-2xl bg-[#2874F0] flex items-center justify-center shadow-xs">
              <i className="fa-solid fa-basket-shopping text-xl text-white"></i>
            </div>
            <p className="text-sm font-bold text-slate-700">Smart Basket ⚡</p>
          </div>
        ) : (
          <FirstLaunchAuthScreen
            onLogin={() => {
              markOnboardingComplete();
              setAuthTab('login');
              setAuthError('');
              setPage('login');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onSignUp={() => {
              markOnboardingComplete();
              setAuthTab('signup');
              setAuthError('');
              setPage('login');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onSkip={() => {
              markOnboardingComplete();
              setPage('home');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onOpenTerms={() => setActiveLegalPolicy('terms')}
            onOpenPrivacy={() => setActiveLegalPolicy('privacy')}
          />
        )
      ) : (
        <div className={page === 'categories' ? 'pb-14 md:pb-0' : page === 'cart' ? 'pb-36 md:pb-28' : page === 'detail' ? 'pb-20 md:pb-10' : 'pb-16 md:pb-10'}>
          {/* Flipkart Royal Blue Header (#2874F0) — hidden on Split-Screen All Categories & Flipkart-style Cart which render their own clean white sticky headers */}
          {page !== 'categories' && page !== 'cart' && (
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
                    const now = Date.now();
                    const recentTaps = [...logoTapTimestampsRef.current.filter((t) => now - t < 2500), now];
                    if (recentTaps.length >= 5) {
                      logoTapTimestampsRef.current = [];
                      if (isStrictAdminEmail) {
                        setAdminPinInput('');
                        setAdminPinError('');
                        setAdminPinModalOpen(true);
                      } else {
                        setSidebarOpen(false);
                        setMode('seller');
                      }
                      return;
                    }
                    logoTapTimestampsRef.current = recentTaps;
                    setFilterCatId(0);
                    setSearchQuery('');
                    setPage('home');
                  }}
                  className="flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <span className="text-lg sm:text-xl font-extrabold italic tracking-tight text-white">
                    Smart <span className="text-[#FFE500]">Basket</span>
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
                    onClick={() => setPage('categories')}
                    className="hover:text-[#FFE500] whitespace-nowrap"
                  >
                    Categories
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
                  className="inline-flex items-center gap-2 min-h-[36px] px-2.5 sm:px-3.5 py-1 rounded-md bg-white text-[#2874F0] text-xs font-bold hover:bg-blue-50 transition max-w-[175px] sm:max-w-[260px]"
                >
                  <i className="fa-solid fa-user text-[11px] shrink-0"></i>
                  {currentUser ? (
                    <div className="text-left min-w-0 leading-tight">
                      <span className="block truncate font-extrabold text-[11px] sm:text-xs">
                        {currentUser.name}
                      </span>
                      <span className="hidden sm:block truncate text-[10px] font-medium text-slate-600">
                        {currentUser.email}
                        {currentUser.phone ? ` · +91 ${currentUser.phone}` : ''}
                      </span>
                    </div>
                  ) : (
                    <span className="whitespace-nowrap">Login</span>
                  )}
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
          )}

          {/* Sliding Mobile Sidebar Drawer */}
          {sidebarOpen && <div onClick={() => setSidebarOpen(false)} className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs" />}
          <aside className={`fixed top-0 left-0 bottom-0 z-50 w-72 bg-white border-r border-slate-200 shadow-2xl transform transition-transform duration-200 flex flex-col ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
            <div className="px-5 py-4 bg-[#2874F0] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg font-extrabold italic">
                  Smart <span className="text-[#FFE500]">Basket</span>
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
                  {currentUser.email && (
                    <p className="text-xs text-slate-600 truncate mt-0.5">{currentUser.email}</p>
                  )}
                  {currentUser.phone && (
                    <p className="text-xs text-slate-500 truncate mt-0.5">+91 {currentUser.phone}</p>
                  )}
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
                { id: 'categories', label: 'All Categories', icon: 'fa-table-cells-large' },
                { id: 'play', label: 'Play & Reels', icon: 'fa-circle-play' },
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

              <div className="pt-3 mt-3 border-t border-slate-100 space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    setSidebarOpen(false);
                    setMode('seller');
                  }}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-100"
                >
                  <i className="fa-solid fa-store w-5 text-center text-[#FB641B]"></i>
                  <span>{currentUser?.isSeller ? 'Seller Hub' : 'Become a Seller'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => openRiderPortal('login')}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-100"
                >
                  <i className="fa-solid fa-motorcycle w-5 text-center text-[#2874F0]"></i>
                  <span>{currentRider ? `Rider Hub (${currentRider.riderId})` : 'Delivery Partner Login'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => openRiderPortal('register')}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-slate-700 hover:bg-emerald-50"
                >
                  <i className="fa-solid fa-user-plus w-5 text-center text-[#2E7D32]"></i>
                  <span>Join as Delivery Partner</span>
                </button>

                {isStrictAdminEmail && (
                  <button
                    type="button"
                    onClick={requestAdminAccess}
                    className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-slate-700 hover:bg-blue-50"
                  >
                    <i className="fa-solid fa-shield-halved w-5 text-center text-[#2874F0]"></i>
                    <span>Admin Panel</span>
                  </button>
                )}
              </div>
            </nav>

            <div className="p-4 border-t border-slate-100">
              {currentUser ? (
                <button
                  type="button"
                  onClick={handleCustomerLogout}
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
              {/* Flipkart-style Compact Live GPS Location Bar */}
              <div className="bg-white border-b border-slate-200/80">
                <button
                  type="button"
                  onClick={openAddressModal}
                  className="max-w-7xl w-full mx-auto px-3 sm:px-4 py-2.5 flex items-center justify-between gap-2.5 text-left hover:bg-blue-50/40 transition"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <i className="fa-solid fa-location-dot text-[#2874F0] text-sm shrink-0"></i>
                    <p className="text-xs sm:text-sm text-slate-700 truncate">
                      <span className="font-bold text-slate-900 mr-1">Deliver to:</span>
                      <span className="font-medium text-slate-700">{compactDeliverToLabel}</span>
                    </p>
                  </div>
                  <i className="fa-solid fa-chevron-right text-[11px] text-slate-400 shrink-0"></i>
                </button>
              </div>

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
                    {publicProducts.map(renderFlipkartProductCard)}
                  </div>
                </div>
              </section>
            </main>
          )}

          {/* FLIPKART-STYLE SPLIT-SCREEN ALL CATEGORIES PAGE */}
          {page === 'categories' && (
            <CategoriesView
              categories={categories}
              products={publicProducts}
              cartCount={cartCount}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onOpenCart={() => setPage('cart')}
              onOpenProduct={openProductDetail}
              onBackHome={() => setPage('home')}
              onBrowseShop={(opts) => {
                setFilterCatId(opts.catId ?? 0);
                setSearchQuery(opts.query ?? '');
                setMaxPrice(opts.maxPrice ?? 0);
                if (opts.sortBy) setSortBy(opts.sortBy);
                setPage('shop');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              showModal={showModal}
            />
          )}

          {/* PLAY / VIDEO DEALS SHOWCASE PAGE */}
          {page === 'play' && (
            <main className="max-w-5xl mx-auto px-3 sm:px-4 py-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-lg sm:text-xl font-extrabold text-slate-900">Smart Basket Play</h1>
                  <p className="text-xs text-slate-500">Shop trending drops &amp; top-rated picks in one tap</p>
                </div>
                <button
                  type="button"
                  onClick={() => setPage('categories')}
                  className="px-3 py-1.5 rounded-lg bg-blue-50 text-[#2874F0] text-xs font-bold hover:bg-blue-100 whitespace-nowrap"
                >
                  All Categories
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {publicProducts.slice(0, 8).map((prod) => {
                  const mrp = getEffectiveMrp(prod.price, prod.mrp);
                  const discount = getDiscountPercent(prod.price, mrp);
                  return (
                    <button
                      key={prod.docId || prod.id}
                      type="button"
                      onClick={() => openProductDetail(prod)}
                      className="group relative aspect-[3/4] rounded-xl overflow-hidden bg-slate-900 text-left shadow-xs"
                    >
                      <img
                        src={prod.image}
                        alt={prod.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
                      <div className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center">
                        <i className="fa-solid fa-play text-[10px] ml-0.5"></i>
                      </div>
                      <div className="absolute inset-x-0 bottom-0 p-3 text-white">
                        <p className="text-xs font-bold line-clamp-2 leading-snug">{prod.name}</p>
                        <div className="mt-1 flex items-baseline gap-1.5">
                          <span className="text-sm font-extrabold font-mono tabular-nums">{formatINR(prod.price)}</span>
                          {discount > 0 && (
                            <span className="text-[10px] font-bold text-[#FFE500] tabular-nums">{discount}% off</span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </main>
          )}

          {/* SHOP / LIVE SEARCH & SORT PAGE */}
          {page === 'shop' && (
            <main className="max-w-7xl mx-auto px-2.5 sm:px-4 py-4 space-y-3.5">
              {/* Quick Sort Chips */}
              <section className="bg-white rounded-xl border border-slate-200/80 p-3 space-y-3">
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide shrink-0 mr-1">
                    Sort:
                  </span>
                  {(
                    [
                      { id: 'relevance', label: 'Relevance' },
                      { id: 'price_asc', label: 'Price: Low to High' },
                      { id: 'price_desc', label: 'Price: High to Low' },
                      { id: 'top_rated', label: 'Top Rated' },
                    ] as const
                  ).map((chip) => {
                    const active = sortBy === chip.id;
                    return (
                      <button
                        key={chip.id}
                        type="button"
                        onClick={() => setSortBy(chip.id)}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap shrink-0 border ${
                          active
                            ? 'bg-[#2874F0] text-white border-[#2874F0] shadow-xs'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {chip.label}
                      </button>
                    );
                  })}
                </div>

                {/* Category & Price Filters */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-end pt-2 border-t border-slate-100">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Category</label>
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
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Max Price (₹)</label>
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
                  <button
                    type="button"
                    onClick={() => {
                      setFilterCatId(0);
                      setMaxPrice(0);
                      setSortBy('relevance');
                      setSearchQuery('');
                    }}
                    className="w-full h-10 rounded-lg border border-slate-200 text-xs font-bold text-[#2874F0] hover:bg-blue-50 flex items-center justify-center gap-1.5"
                  >
                    <i className="fa-solid fa-rotate-left"></i>
                    <span>Reset All</span>
                  </button>
                </div>
              </section>

              <div className="flex items-center justify-between gap-2 px-1">
                <div className="flex items-center gap-2 min-w-0">
                  <h1 className="text-base sm:text-lg font-extrabold text-slate-900 truncate">
                    {searchQuery
                      ? `Results for "${searchQuery}"`
                      : filterCatId > 0
                      ? categories.find((c) => c.id === filterCatId)?.name || 'Products'
                      : 'All Products'}
                  </h1>
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      aria-label="Clear search query"
                      className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 hover:bg-slate-300 flex items-center justify-center shrink-0"
                    >
                      <i className="fa-solid fa-xmark text-[10px]"></i>
                    </button>
                  )}
                </div>
                <span className="text-xs font-semibold text-slate-500 tabular-nums shrink-0">
                  {filteredProducts.length} item{filteredProducts.length === 1 ? '' : 's'}
                </span>
              </div>

              {filteredProducts.length === 0 ? (
                <div className="bg-white rounded-xl border border-slate-200 p-10 text-center space-y-2.5">
                  <i className="fa-solid fa-box-open text-3xl text-slate-300"></i>
                  <p className="text-sm font-semibold text-slate-700">No products match your search or filters.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setFilterCatId(0);
                      setMaxPrice(0);
                      setSortBy('relevance');
                    }}
                    className="px-4 py-2 rounded-lg bg-[#2874F0] text-white text-xs font-bold hover:bg-[#1e60d5] transition"
                  >
                    Clear Search &amp; Filters
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4">
                  {filteredProducts.map(renderFlipkartProductCard)}
                </div>
              )}
            </main>
          )}

          {/* FLIPKART-STYLE PRODUCT DETAIL PAGE */}
          {page === 'detail' && selectedProduct && (() => {
            const detailMrp = getEffectiveMrp(selectedProduct.price, selectedProduct.mrp);
            const detailDiscount = getDiscountPercent(selectedProduct.price, detailMrp);
            const detailCategory = categories.find((c) => c.id === selectedProduct.cat_id)?.name || 'Smart Basket';
            const detailBrand = selectedProduct.sellerName || selectedProduct.name.split(' ').slice(0, 2).join(' ');
            const isWishlisted = wishlistIds.includes(selectedProduct.id);
            const galleryImages = [selectedProduct.image, ASSETS.bigSavingBanner];
            const highlightBullets = selectedProduct.description
              .split(/[.,]/)
              .map((s) => s.trim())
              .filter((s) => s.length > 6);
            const detailReviewStats = productReviewStats.get(selectedProduct.id);
            const verifiedReviews = detailReviewStats?.items || [];
            const detailRealAvg = detailReviewStats?.avg || 0;
            const detailRealCount = detailReviewStats?.count || 0;
            const deliveredOrderForReview = currentUser
              ? findDeliveredOrderForProduct(selectedProduct.id)
              : null;
            const currentUid = currentUser ? currentUser.uid || String(currentUser.id) : '';
            const myExistingReview = currentUid
              ? verifiedReviews.find((r) => r.userId === currentUid) || null
              : null;

            return (
              <div className="bg-[#F1F3F6] min-h-screen">
                <main className="max-w-6xl mx-auto px-0 sm:px-4 py-0 sm:py-4 space-y-2.5 sm:space-y-4">
                  {/* Breadcrumb Back Bar */}
                  <div className="bg-white sm:bg-transparent px-3 py-2.5 sm:px-0 sm:py-0 flex items-center justify-between border-b sm:border-b-0 border-slate-200/80">
                    <button
                      type="button"
                      onClick={() => setPage('shop')}
                      className="inline-flex items-center gap-2 text-xs font-bold text-[#2874F0] hover:underline"
                    >
                      <i className="fa-solid fa-arrow-left"></i>
                      <span>Back to Products</span>
                    </button>
                    <span className="text-[11px] font-semibold text-slate-500 truncate max-w-[55%]">
                      {detailCategory} / {detailBrand}
                    </span>
                  </div>

                  <div className="grid md:grid-cols-12 gap-3 sm:gap-5 items-start">
                    {/* Left Column: Full-Width Product Image Carousel with Wishlist & Share */}
                    <div className="md:col-span-5 bg-white sm:rounded-xl border-b sm:border border-slate-200/80 overflow-hidden md:sticky md:top-20">
                      <div className="relative aspect-square bg-slate-50 overflow-hidden">
                        <img
                          src={galleryImages[detailSlideIdx % galleryImages.length]}
                          alt={selectedProduct.name}
                          referrerPolicy="no-referrer"
                          className={`w-full h-full object-cover transition duration-300 ${
                            selectedProduct.stock <= 0 ? 'opacity-60 grayscale-[30%]' : ''
                          }`}
                        />

                        {selectedProduct.stock <= 0 && (
                          <span className="absolute top-3 left-3 z-10 px-3 py-1 rounded-md bg-rose-600 text-white text-xs font-extrabold uppercase tracking-wide shadow-md">
                            Out of Stock
                          </span>
                        )}

                        {/* Floating Wishlist Heart & Share Action Buttons */}
                        <div className="absolute top-3 right-3 flex flex-col gap-2 z-10">
                          <button
                            type="button"
                            onClick={() => toggleWishlist(selectedProduct.id)}
                            aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
                            className={`w-10 h-10 rounded-full bg-white/95 shadow-md border border-slate-200/80 flex items-center justify-center transition active:scale-90 ${
                              isWishlisted ? 'text-[#E53935]' : 'text-slate-600 hover:text-[#E53935]'
                            }`}
                          >
                            <i className={`${isWishlisted ? 'fa-solid' : 'fa-regular'} fa-heart text-base`}></i>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleShareProduct(selectedProduct)}
                            aria-label="Share product"
                            className="w-10 h-10 rounded-full bg-white/95 shadow-md border border-slate-200/80 text-slate-700 hover:text-[#2874F0] flex items-center justify-center transition active:scale-90"
                          >
                            <i className="fa-solid fa-share-nodes text-sm"></i>
                          </button>
                        </div>

                        {/* Prev / Next Carousel Controls */}
                        <button
                          type="button"
                          aria-label="Previous image"
                          onClick={() =>
                            setDetailSlideIdx((i) => (i === 0 ? galleryImages.length - 1 : i - 1))
                          }
                          className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 text-slate-800 shadow-md flex items-center justify-center hover:bg-white transition"
                        >
                          <i className="fa-solid fa-chevron-left text-xs"></i>
                        </button>
                        <button
                          type="button"
                          aria-label="Next image"
                          onClick={() => setDetailSlideIdx((i) => (i + 1) % galleryImages.length)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 text-slate-800 shadow-md flex items-center justify-center hover:bg-white transition"
                        >
                          <i className="fa-solid fa-chevron-right text-xs"></i>
                        </button>

                        {/* Carousel Dots */}
                        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-black/30 px-2.5 py-1 rounded-full">
                          {galleryImages.map((_, idx) => (
                            <button
                              key={idx}
                              type="button"
                              aria-label={`View image ${idx + 1}`}
                              onClick={() => setDetailSlideIdx(idx)}
                              className={`h-1.5 rounded-full transition-all ${
                                detailSlideIdx === idx ? 'w-4 bg-white' : 'w-1.5 bg-white/60'
                              }`}
                            />
                          ))}
                        </div>
                      </div>

                      {/* Thumbnails */}
                      <div className="p-3 flex items-center justify-center gap-2.5 border-t border-slate-100">
                        {galleryImages.map((img, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setDetailSlideIdx(idx)}
                            className={`w-14 h-14 rounded-lg overflow-hidden border-2 transition ${
                              detailSlideIdx === idx ? 'border-[#2874F0]' : 'border-slate-200'
                            }`}
                          >
                            <img
                              src={img}
                              alt={`Preview ${idx + 1}`}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                            />
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Right Column: Product Info, Delivery Estimator, Highlights & Reviews */}
                    <div className="md:col-span-7 space-y-2.5 sm:space-y-3.5">
                      {/* Title, Rating & Price Block */}
                      <section className="bg-white sm:rounded-xl border-y sm:border border-slate-200/80 p-4 sm:p-6 space-y-3">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span className="font-bold text-[#2874F0]">{detailCategory}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-semibold text-slate-700">{detailBrand}</span>
                          <span aria-hidden="true">·</span>
                          {selectedProduct.stock <= 0 ? (
                            <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-700 font-extrabold uppercase text-[11px]">
                              Out of Stock
                            </span>
                          ) : selectedProduct.stock <= 5 ? (
                            <span className="px-2 py-0.5 rounded bg-rose-50 border border-rose-200 text-rose-700 font-extrabold text-[11px]">
                              Only {selectedProduct.stock} left in stock!
                            </span>
                          ) : (
                            <span className="text-[#2E7D32] font-bold">In Stock ({selectedProduct.stock})</span>
                          )}
                        </div>

                        <h1 className="text-lg sm:text-2xl font-extrabold text-slate-900 leading-snug">
                          {selectedProduct.name}
                        </h1>

                        <div className="flex items-center gap-2.5">
                          {detailRealCount > 0 ? (
                            <>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm bg-[#388E3C] text-white text-xs font-extrabold tabular-nums">
                                <span>{detailRealAvg.toFixed(1)}</span>
                                <i className="fa-solid fa-star text-[10px]"></i>
                              </span>
                              <span className="text-xs font-semibold text-slate-500 tabular-nums">
                                {detailRealCount.toLocaleString('en-IN')} Verified{' '}
                                {detailRealCount === 1 ? 'Review' : 'Reviews'}
                              </span>
                            </>
                          ) : (
                            <span className="text-xs font-semibold text-slate-400">
                              No verified buyer ratings yet
                            </span>
                          )}
                        </div>

                        <div className="pt-1 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                          <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-mono tabular-nums">
                            {formatINR(selectedProduct.price)}
                          </span>
                          {detailMrp > selectedProduct.price && (
                            <span className="text-sm sm:text-base text-slate-400 line-through font-mono tabular-nums">
                              {formatINR(detailMrp)}
                            </span>
                          )}
                          {detailDiscount > 0 && (
                            <span className="text-sm sm:text-base font-extrabold text-[#2E7D32] tabular-nums">
                              {detailDiscount}% OFF
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500">Inclusive of all taxes · Earn SmartCoins on this order</p>

                        {/* Quantity & Desktop CTA Buttons */}
                        <div className="pt-3 border-t border-slate-100 space-y-3">
                          {selectedProduct.stock > 0 ? (
                            <div className="flex items-center justify-between">
                              <span className="text-xs sm:text-sm font-bold text-slate-700">Quantity</span>
                              <div className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50">
                                <button
                                  type="button"
                                  aria-label="Decrease quantity"
                                  onClick={() => setDetailQty((q) => Math.max(1, q - 1))}
                                  className="w-10 h-9 flex items-center justify-center text-slate-700 hover:bg-slate-200/70 rounded-l-lg"
                                >
                                  <i className="fa-solid fa-minus text-xs"></i>
                                </button>
                                <span className="w-10 text-center text-sm font-extrabold tabular-nums">
                                  {detailQty}
                                </span>
                                <button
                                  type="button"
                                  aria-label="Increase quantity"
                                  onClick={() => setDetailQty((q) => Math.min(selectedProduct.stock, q + 1))}
                                  className="w-10 h-9 flex items-center justify-center text-slate-700 hover:bg-slate-200/70 rounded-r-lg"
                                >
                                  <i className="fa-solid fa-plus text-xs"></i>
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="rounded-xl bg-rose-50 border border-rose-200 px-3.5 py-2.5 flex items-center gap-2 text-xs font-bold text-rose-700">
                              <i className="fa-solid fa-circle-exclamation"></i>
                              <span>Currently Out of Stock — check back soon when the seller restocks.</span>
                            </div>
                          )}

                          {/* Desktop Action Buttons */}
                          <div className="hidden md:grid grid-cols-2 gap-3 pt-1">
                            <button
                              type="button"
                              disabled={selectedProduct.stock <= 0}
                              onClick={() => addToCart(selectedProduct, detailQty, false)}
                              className="h-12 rounded-xl bg-white border-2 border-slate-300 hover:border-slate-400 hover:bg-slate-50 text-slate-900 text-sm font-extrabold disabled:bg-slate-100 disabled:border-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
                            >
                              <i className="fa-solid fa-cart-shopping"></i>
                              <span>Add to cart</span>
                            </button>
                            <button
                              type="button"
                              disabled={selectedProduct.stock <= 0}
                              onClick={() => addToCart(selectedProduct, detailQty, true)}
                              className="h-12 rounded-xl bg-[#FFC200] hover:bg-[#f2b800] text-slate-950 text-sm font-extrabold shadow-xs disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
                            >
                              <i className="fa-solid fa-bolt"></i>
                              <span>Buy now</span>
                            </button>
                          </div>
                        </div>
                      </section>

                      {/* Delivery Estimator & Trust Badges Box */}
                      <section className="bg-white sm:rounded-xl border-y sm:border border-slate-200/80 p-4 sm:p-5 space-y-3.5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0">
                            <span className="w-9 h-9 rounded-lg bg-blue-50 text-[#2874F0] flex items-center justify-center shrink-0">
                              <i className="fa-solid fa-truck-fast text-sm"></i>
                            </span>
                            <div className="min-w-0">
                              <p className="text-xs sm:text-sm font-extrabold text-slate-900">
                                <span className="text-[#2E7D32]">Free Delivery</span> by {estimatedDeliveryDate}
                              </p>
                              <p className="text-xs text-slate-500 mt-0.5">
                                Delivering to Pincode <strong className="font-mono text-slate-800">{deliveryPincode}</strong>
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setPincodeDraft(deliveryPincode);
                              setEditingPincode((v) => !v);
                            }}
                            className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-[#2874F0] hover:bg-blue-50 shrink-0"
                          >
                            {editingPincode ? 'Close' : 'Change'}
                          </button>
                        </div>

                        {editingPincode && (
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              const clean = pincodeDraft.replace(/\D/g, '').slice(0, 6);
                              if (clean.length === 6) {
                                setDeliveryPincode(clean);
                                setEditingPincode(false);
                              }
                            }}
                            className="flex items-center gap-2 pt-1"
                          >
                            <input
                              type="tel"
                              inputMode="numeric"
                              maxLength={6}
                              value={pincodeDraft}
                              onChange={(e) => setPincodeDraft(e.target.value.replace(/\D/g, '').slice(0, 6))}
                              placeholder="Enter 6-digit pincode"
                              className="flex-1 h-10 px-3 rounded-lg bg-slate-50 border border-slate-300 text-sm font-mono focus:bg-white focus:border-[#2874F0] focus:outline-none"
                            />
                            <button
                              type="submit"
                              disabled={pincodeDraft.replace(/\D/g, '').length !== 6}
                              className="px-4 h-10 rounded-lg bg-[#2874F0] text-white text-xs font-bold disabled:opacity-50"
                            >
                              Check
                            </button>
                          </form>
                        )}

                        {/* Trust Strip: 7 Days Replacement & COD / Online Payment */}
                        <div className="grid grid-cols-2 gap-2.5 pt-3 border-t border-slate-100">
                          <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                            <span className="w-8 h-8 rounded-full bg-white text-[#2874F0] border border-slate-200 flex items-center justify-center shrink-0">
                              <i className="fa-solid fa-rotate-left text-xs"></i>
                            </span>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-900 leading-tight">7 Days Replacement</p>
                              <p className="text-[10px] text-slate-500">Easy doorstep pickup</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                            <span className="w-8 h-8 rounded-full bg-white text-[#2E7D32] border border-slate-200 flex items-center justify-center shrink-0">
                              <i className="fa-solid fa-wallet text-xs"></i>
                            </span>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-900 leading-tight">Cash on Delivery</p>
                              <p className="text-[10px] text-slate-500">&amp; Online Payment</p>
                            </div>
                          </div>
                        </div>
                      </section>

                      {/* Product Highlights & Description */}
                      <section className="bg-white sm:rounded-xl border-y sm:border border-slate-200/80 p-4 sm:p-5 space-y-3">
                        <h2 className="text-sm sm:text-base font-extrabold text-slate-900">Product Highlights &amp; Description</h2>
                        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">{selectedProduct.description}</p>
                        {highlightBullets.length > 1 && (
                          <ul className="space-y-1.5 pt-1">
                            {highlightBullets.map((item, idx) => (
                              <li key={idx} className="flex items-start gap-2 text-xs text-slate-700">
                                <i className="fa-solid fa-circle-check text-[#2E7D32] text-[10px] mt-1 shrink-0"></i>
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </section>

                      {/* Verified Purchase Customer Reviews Only (Zero Fake Ratings) */}
                      <section className="bg-white sm:rounded-xl border-y sm:border border-slate-200/80 p-4 sm:p-5 space-y-3.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <h2 className="text-sm sm:text-base font-extrabold text-slate-900">
                              Verified Buyer Ratings &amp; Reviews
                            </h2>
                            {detailRealCount > 0 && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm bg-[#388E3C] text-white text-xs font-bold tabular-nums">
                                {detailRealAvg.toFixed(1)}
                                <i className="fa-solid fa-star text-[9px]"></i>
                              </span>
                            )}
                          </div>
                          {deliveredOrderForReview ? (
                            <button
                              type="button"
                              onClick={() =>
                                setReviewModalTarget({
                                  product: selectedProduct,
                                  order: deliveredOrderForReview,
                                  existing: myExistingReview,
                                })
                              }
                              className="px-3 py-1.5 rounded-lg bg-[#2874F0] hover:bg-[#1e60d5] text-white text-xs font-bold inline-flex items-center gap-1.5 transition"
                            >
                              <i className="fa-solid fa-star text-[10px] text-[#FFE500]"></i>
                              <span>{myExistingReview ? 'Edit Your Review' : 'Write Verified Review'}</span>
                            </button>
                          ) : (
                            <span className="text-[11px] font-semibold text-slate-400">
                              Verified buyers only (after delivery)
                            </span>
                          )}
                        </div>

                        {verifiedReviews.length === 0 ? (
                          <div className="py-5 px-3 rounded-lg bg-slate-50 border border-slate-100 text-center space-y-1">
                            <p className="text-xs font-bold text-slate-700">No verified reviews yet</p>
                            <p className="text-[11px] text-slate-500">
                              Smart Basket only publishes ratings from customers whose order status is Delivered.
                            </p>
                          </div>
                        ) : (
                          <div className="divide-y divide-slate-100">
                            {verifiedReviews.map((rev) => (
                              <div key={rev.id} className="py-3 first:pt-0 last:pb-0 space-y-1.5">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-sm text-white text-[10px] font-bold tabular-nums ${
                                      rev.rating >= 4
                                        ? 'bg-[#388E3C]'
                                        : rev.rating === 3
                                        ? 'bg-amber-500'
                                        : 'bg-rose-600'
                                    }`}
                                  >
                                    {rev.rating} <i className="fa-solid fa-star text-[8px]"></i>
                                  </span>
                                  <span className="text-xs font-bold text-slate-900">{rev.title}</span>
                                </div>
                                <p className="text-xs text-slate-600 leading-relaxed">{rev.comment}</p>
                                <p className="text-[11px] text-slate-400 flex items-center gap-1.5 flex-wrap">
                                  <span className="font-semibold text-slate-600">{rev.userName}</span>
                                  <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                                    <i className="fa-solid fa-circle-check text-[10px]"></i>
                                    <span>Verified Purchase</span>
                                  </span>
                                  <span>·</span>
                                  <span>
                                    {new Date(rev.created_at).toLocaleDateString('en-IN', {
                                      day: '2-digit',
                                      month: 'short',
                                      year: 'numeric',
                                    })}
                                  </span>
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </section>
                    </div>
                  </div>

                  {/* Similar Products */}
                  <section className="bg-white sm:rounded-xl border-y sm:border border-slate-200/80 p-4">
                    <h2 className="text-base sm:text-lg font-extrabold text-slate-900 mb-3">Similar Products</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {publicProducts
                        .filter((p) => p.id !== selectedProduct.id)
                        .slice(0, 4)
                        .map(renderFlipkartProductCard)}
                    </div>
                  </section>
                </main>

                {/* Sticky Bottom Action Bar on Mobile/Tablet: White "Add to cart" | Yellow "#FFC200" "Buy now" */}
                <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 px-3 py-2.5 shadow-[0_-4px_16px_rgba(15,23,42,0.08)]">
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      disabled={selectedProduct.stock <= 0}
                      onClick={() => addToCart(selectedProduct, detailQty, false)}
                      className="h-12 rounded-xl bg-white border border-slate-300 text-slate-900 text-sm font-extrabold active:scale-95 disabled:bg-slate-100 disabled:border-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed disabled:active:scale-100 transition flex items-center justify-center gap-2"
                    >
                      <i className="fa-solid fa-cart-shopping text-xs"></i>
                      <span>{selectedProduct.stock <= 0 ? 'Out of Stock' : 'Add to cart'}</span>
                    </button>
                    <button
                      type="button"
                      disabled={selectedProduct.stock <= 0}
                      onClick={() => addToCart(selectedProduct, detailQty, true)}
                      className="h-12 rounded-xl bg-[#FFC200] hover:bg-[#f2b800] text-slate-950 text-sm font-extrabold active:scale-95 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed disabled:active:scale-100 transition flex items-center justify-center gap-2 shadow-xs"
                    >
                      <i className="fa-solid fa-bolt text-xs"></i>
                      <span>Buy now</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* FLIPKART-STYLE CART PAGE */}
          {page === 'cart' && (
            <div className="min-h-screen bg-[#F1F3F6]">
              {/* Top White Sticky Pill Tabs Header */}
              <header className="sticky top-0 z-30 bg-white border-b border-slate-200/90 shadow-2xs">
                <div className="max-w-4xl mx-auto px-3 sm:px-4 h-14 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <button
                      type="button"
                      onClick={() => setPage('home')}
                      aria-label="Back to Home"
                      className="hidden md:inline-flex w-9 h-9 -ml-1 rounded-full items-center justify-center text-slate-600 hover:bg-slate-100 transition shrink-0"
                    >
                      <i className="fa-solid fa-arrow-left text-sm"></i>
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setCartTab('smart-basket')}
                        className={`px-4 py-1.5 rounded-full text-xs sm:text-sm font-bold transition whitespace-nowrap ${
                          cartTab === 'smart-basket'
                            ? 'bg-[#2874F0] text-white shadow-xs'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80'
                        }`}
                      >
                        Smart Basket ({cartCount})
                      </button>
                      <button
                        type="button"
                        onClick={() => setCartTab('grocery')}
                        className={`px-4 py-1.5 rounded-full text-xs sm:text-sm font-bold transition whitespace-nowrap ${
                          cartTab === 'grocery'
                            ? 'bg-[#2874F0] text-white shadow-xs'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80'
                        }`}
                      >
                        Grocery{groceryCartCount > 0 ? ` (${groceryCartCount})` : ''}
                      </button>
                    </div>
                  </div>
                </div>
              </header>

              {/* Compact White Delivery Location Bar (opens Saved Address Book) */}
              <div className="bg-white border-b border-slate-200/80">
                <button
                  type="button"
                  onClick={() => openAddressBook('select')}
                  className="max-w-4xl w-full mx-auto px-3.5 sm:px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-blue-50/40 transition"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-7 h-7 rounded-full bg-blue-50 text-[#2874F0] flex items-center justify-center shrink-0">
                      <i className="fa-solid fa-location-dot text-xs"></i>
                    </span>
                    <p className="text-xs sm:text-sm text-slate-700 truncate">
                      <strong className="font-extrabold text-slate-900 mr-1.5">
                        Deliver to{savedAddress?.label ? ` (${savedAddress.label})` : ''}:
                      </strong>
                      <span>
                        {displayAddressSummary ||
                          (deliveryPincode === DEFAULT_DELIVERY_PINCODE
                            ? DEFAULT_DELIVERY_LABEL
                            : deliveryPincode) ||
                          DEFAULT_DELIVERY_LABEL}
                      </span>
                    </p>
                  </div>
                  <span className="text-xs font-bold text-[#2874F0] shrink-0">Change</span>
                </button>
              </div>

              <main className="max-w-4xl mx-auto px-3 sm:px-4 pt-3 space-y-3">
                {/* Free Delivery Nudge Progress Bar (Synced with Firestore settings/delivery) */}
                {displayedCartEntries.length > 0 && freeDeliveryThreshold > 0 && (
                  <div
                    className={`rounded-xl border px-4 py-3 shadow-2xs ${
                      amountForFreeDelivery === 0
                        ? 'bg-emerald-50 border-emerald-200'
                        : 'bg-white border-blue-200/80'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-xs sm:text-sm font-bold">
                      <span
                        className={`flex items-center gap-2 ${
                          amountForFreeDelivery === 0 ? 'text-emerald-800' : 'text-slate-800'
                        }`}
                      >
                        <i
                          className={`fa-solid ${
                            amountForFreeDelivery === 0
                              ? 'fa-circle-check text-[#2E7D32]'
                              : 'fa-truck-fast text-[#2874F0]'
                          }`}
                        ></i>
                        {amountForFreeDelivery === 0 ? (
                          <span>You unlocked FREE Delivery!</span>
                        ) : (
                          <span>
                            Add <strong className="text-[#2874F0] font-mono">{formatINR(amountForFreeDelivery)}</strong> more for{' '}
                            <strong className="text-[#2E7D32]">FREE Delivery</strong>
                          </span>
                        )}
                      </span>
                      <span className="text-[11px] font-mono font-bold text-slate-500 shrink-0 tabular-nums">
                        {freeDeliveryProgressPct}%
                      </span>
                    </div>
                    <div className="mt-2 h-2 w-full rounded-full bg-slate-200/80 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          amountForFreeDelivery === 0 ? 'bg-[#2E7D32]' : 'bg-[#2874F0]'
                        }`}
                        style={{ width: `${freeDeliveryProgressPct}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Clickable Coupons & Offers Card */}
                <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
                  <button
                    type="button"
                    onClick={() => {
                      setCouponError('');
                      setCouponDraft('');
                      setCouponModalOpen(true);
                    }}
                    className="w-full px-4 py-3.5 flex items-center justify-between gap-3 text-left hover:bg-slate-50 transition"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-8 h-8 rounded-full bg-emerald-50 text-[#2E7D32] flex items-center justify-center shrink-0">
                        <i className="fa-solid fa-percent text-xs"></i>
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                          Apply Promo Code ({activePromoCodes.length} available)
                        </p>
                        {appliedCouponCode && couponDiscountAmount > 0 ? (
                          <p className="text-[11px] font-bold text-[#2E7D32] mt-0.5 truncate">
                            {appliedCouponCode} applied · Saving {formatINR(couponDiscountAmount)}
                          </p>
                        ) : (
                          <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                            {activePromoCodes[0]
                              ? `Try ${activePromoCodes[0].code} — ${activePromoCodes[0].description || 'Instant discount'}`
                              : 'Enter an active Smart Basket promo code'}
                          </p>
                        )}
                      </div>
                    </div>
                    <i className="fa-solid fa-chevron-right text-xs text-slate-400 shrink-0"></i>
                  </button>
                </div>

                {displayedCartEntries.length === 0 ? (
                  <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
                    <div className="w-16 h-16 rounded-full bg-blue-50 text-[#2874F0] flex items-center justify-center mx-auto">
                      <i className={`fa-solid ${cartTab === 'grocery' ? 'fa-basket-shopping' : 'fa-cart-shopping'} text-2xl`}></i>
                    </div>
                    <h2 className="mt-4 text-base font-bold text-slate-900">
                      {cartTab === 'grocery' ? 'Your Grocery basket is empty!' : 'Your cart is empty!'}
                    </h2>
                    <p className="mt-1 text-xs text-slate-500">
                      {cartTab === 'grocery'
                        ? 'Add fresh dry fruits, honey, and daily essentials to see them here.'
                        : 'Add items from Smart Basket deals to see them here.'}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        if (cartTab === 'grocery') {
                          setFilterCatId(6);
                          setPage('shop');
                        } else {
                          setPage('home');
                        }
                      }}
                      className="mt-5 inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-[#2874F0] text-white text-sm font-bold hover:bg-[#1e60d5] transition"
                    >
                      <span>{cartTab === 'grocery' ? 'Shop Grocery' : 'Shop Now'}</span>
                      <i className="fa-solid fa-arrow-right text-xs"></i>
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Cart Items List */}
                    <div className="space-y-3">
                      {displayedCartEntries.map((entry) => {
                        const entryMrp = getEffectiveMrp(entry.product.price, entry.product.mrp);
                        const entryDiscount = getDiscountPercent(entry.product.price, entryMrp);
                        const catName = categories.find((c) => c.id === entry.product.cat_id)?.name || 'Smart Basket';
                        return (
                          <div
                            key={entry.product.id}
                            className="bg-white rounded-xl border border-slate-200/80 p-3.5 sm:p-4 shadow-2xs"
                          >
                            <div className="flex items-start gap-3.5">
                              <button
                                type="button"
                                onClick={() => openProductDetail(entry.product)}
                                className="w-20 h-20 sm:w-24 sm:h-24 rounded-lg bg-slate-50 border border-slate-100 p-1 overflow-hidden shrink-0"
                              >
                                <img
                                  src={entry.product.image}
                                  alt={entry.product.name}
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full rounded-md object-cover"
                                />
                              </button>

                              <div className="flex-1 min-w-0">
                                <button
                                  type="button"
                                  onClick={() => openProductDetail(entry.product)}
                                  className="text-left text-xs sm:text-sm font-bold text-slate-900 line-clamp-2 leading-snug hover:text-[#2874F0]"
                                >
                                  {entry.product.name}
                                </button>
                                <p className="mt-0.5 text-[11px] text-slate-500 truncate">
                                  {catName} · Standard Edition · Free Delivery
                                </p>

                                {(() => {
                                  const cartItemStats = productReviewStats.get(entry.product.id);
                                  if (!cartItemStats || cartItemStats.count === 0) return null;
                                  return (
                                    <div className="mt-1.5 flex items-center gap-1.5">
                                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-sm bg-[#388E3C] text-white text-[10px] font-bold leading-none tabular-nums">
                                        {cartItemStats.avg.toFixed(1)}
                                        <i className="fa-solid fa-star text-[8px]"></i>
                                      </span>
                                      <span className="text-[11px] text-slate-400 tabular-nums">
                                        ({cartItemStats.count.toLocaleString('en-IN')})
                                      </span>
                                    </div>
                                  );
                                })()}

                                <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                                  {entryDiscount > 0 && (
                                    <span className="text-xs font-extrabold text-[#2E7D32] tabular-nums">
                                      ↓ {entryDiscount}%
                                    </span>
                                  )}
                                  <span className="text-xs text-slate-400 line-through font-mono tabular-nums">
                                    {formatINR(entryMrp * entry.quantity)}
                                  </span>
                                  <span className="text-sm sm:text-base font-extrabold text-slate-900 font-mono tabular-nums">
                                    {formatINR(entry.product.price * entry.quantity)}
                                  </span>
                                  {entry.quantity > 1 && (
                                    <span className="text-[11px] font-medium text-slate-500 font-mono tabular-nums">
                                      ({formatINR(entry.product.price)} × {entry.quantity})
                                    </span>
                                  )}
                                </div>
                                {entry.product.stock <= 0 ? (
                                  <span className="mt-1.5 inline-block px-2 py-0.5 rounded bg-rose-100 text-rose-700 text-[10px] font-extrabold uppercase">
                                    Out of Stock — Remove to Checkout
                                  </span>
                                ) : entry.product.stock <= 5 ? (
                                  <span className="mt-1.5 inline-block text-[11px] font-extrabold text-rose-600">
                                    Only {entry.product.stock} left in stock!
                                  </span>
                                ) : null}
                              </div>
                            </div>

                            <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                              <div className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50">
                                <button
                                  type="button"
                                  aria-label="Decrease quantity"
                                  onClick={() => updateCartQty(entry.product.id, entry.quantity - 1)}
                                  className="w-9 h-8 flex items-center justify-center text-slate-700 hover:bg-slate-200/70 rounded-l-lg transition"
                                >
                                  <i className="fa-solid fa-minus text-[10px]"></i>
                                </button>
                                <span className="w-9 text-center text-xs font-extrabold text-slate-900 tabular-nums">
                                  {entry.quantity}
                                </span>
                                <button
                                  type="button"
                                  aria-label="Increase quantity"
                                  disabled={entry.product.stock <= 0 || entry.quantity >= entry.product.stock}
                                  onClick={() => updateCartQty(entry.product.id, entry.quantity + 1)}
                                  className="w-9 h-8 flex items-center justify-center text-slate-700 hover:bg-slate-200/70 disabled:text-slate-300 disabled:cursor-not-allowed rounded-r-lg transition"
                                >
                                  <i className="fa-solid fa-plus text-[10px]"></i>
                                </button>
                              </div>

                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleSaveForLater(entry.product)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 hover:text-[#2874F0] hover:border-blue-200 hover:bg-blue-50 transition"
                                >
                                  <i className="fa-regular fa-heart text-[11px]"></i>
                                  <span>Save for Later</span>
                                </button>
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
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 transition"
                                >
                                  <i className="fa-solid fa-trash-can text-[11px]"></i>
                                  <span>Remove</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Detailed "Price Details" Rounded White Card */}
                    <section className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
                      <div className="p-4 sm:p-5 space-y-3">
                        <h2 className="text-sm sm:text-base font-extrabold text-slate-900">
                          Price Details ({displayedCartCount} {displayedCartCount === 1 ? 'item' : 'items'})
                        </h2>

                        <div className="flex items-center justify-between text-xs sm:text-sm text-slate-700">
                          <span>Selling Price (incl. of all taxes)</span>
                          <span className="font-mono font-semibold text-slate-900 tabular-nums">
                            {formatINR(displayedCartMrpTotal)}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-xs sm:text-sm text-slate-700">
                          <span>Delivery Charge</span>
                          {cartDeliveryFee === 0 ? (
                            <span className="font-bold text-[#2E7D32] flex items-center gap-1.5">
                              {baseDeliveryCharge > 0 && (
                                <span className="text-slate-400 line-through font-mono font-normal text-xs">
                                  {formatINR(baseDeliveryCharge)}
                                </span>
                              )}
                              <span>FREE</span>
                            </span>
                          ) : (
                            <span className="font-mono font-semibold text-slate-900 tabular-nums">
                              {formatINR(cartDeliveryFee)}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between text-xs sm:text-sm text-slate-700">
                          <span>Platform Fee</span>
                          <span className="font-mono font-semibold text-slate-900 tabular-nums">
                            {formatINR(activePlatformFee)}
                          </span>
                        </div>

                        {/* Expandable Discounts Section */}
                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={() => setDiscountsExpanded((v) => !v)}
                            className="w-full flex items-center justify-between text-xs sm:text-sm font-bold text-slate-800 py-1"
                          >
                            <span className="inline-flex items-center gap-1.5">
                              <span>Discounts</span>
                              <i
                                className={`fa-solid fa-chevron-up text-[10px] text-slate-500 transition-transform duration-150 ${
                                  discountsExpanded ? '' : 'rotate-180'
                                }`}
                              ></i>
                            </span>
                            <span className="font-mono font-bold text-[#2E7D32] tabular-nums">
                              -{formatINR(totalCartSavings)}
                            </span>
                          </button>

                          {discountsExpanded && (
                            <div className="mt-1.5 pl-3 border-l border-slate-200 space-y-2 text-xs sm:text-[13px]">
                              <div className="flex items-center justify-between">
                                <span className="text-slate-600">Discount on Selling Price</span>
                                <span className="font-mono font-semibold text-[#2E7D32] tabular-nums">
                                  -{formatINR(mrpDiscountAmount)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-slate-600">
                                  Coupon applied{appliedCouponCode && couponDiscountAmount > 0 ? ` (${appliedCouponCode})` : ''}
                                </span>
                                <span className="font-mono font-semibold text-[#2E7D32] tabular-nums">
                                  -{formatINR(couponDiscountAmount)}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="pt-3 border-t border-dashed border-slate-200 flex items-center justify-between">
                          <span className="text-sm sm:text-base font-extrabold text-slate-900">Total Amount</span>
                          <span className="text-base sm:text-lg font-extrabold text-slate-900 font-mono tabular-nums">
                            {formatINR(finalCartPayable)}
                          </span>
                        </div>
                      </div>

                      {/* Full-width Soft Green Savings Banner */}
                      <div className="bg-emerald-50 border-t border-emerald-100 px-4 py-2.5 flex items-center justify-center gap-2 text-xs sm:text-sm font-extrabold text-[#1B5E20]">
                        <span className="w-5 h-5 rounded-full bg-[#2E7D32] text-white text-[10px] flex items-center justify-center shrink-0">
                          %
                        </span>
                        <span className="tabular-nums">
                          You&apos;ll Save {formatINR(totalCartSavings)} on this order
                        </span>
                      </div>
                    </section>

                    {/* Trust Badge */}
                    <div className="px-2 py-2 flex items-center justify-center gap-2.5 text-slate-500">
                      <i className="fa-solid fa-shield-halved text-lg text-slate-400 shrink-0"></i>
                      <p className="text-[11px] sm:text-xs font-medium leading-snug">
                        Safe and secure payments. Easy returns. 100% Authentic products.
                      </p>
                    </div>
                  </>
                )}

                {/* Saved for Later / Wishlist Section (Move cleanly between Wishlist and Cart) */}
                {wishlistProducts.length > 0 && (
                  <section className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden mt-3">
                    <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                      <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                        <i className="fa-solid fa-heart text-[#E53935] text-xs"></i>
                        <span>Saved for Later / Wishlist ({wishlistProducts.length})</span>
                      </h2>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {wishlistProducts.map((wp) => {
                        const isOos = wp.stock <= 0;
                        return (
                          <div key={wp.id} className="p-3.5 flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => openProductDetail(wp)}
                              className="w-16 h-16 rounded-lg bg-slate-50 border border-slate-200 overflow-hidden shrink-0"
                            >
                              <img
                                src={wp.image}
                                alt={wp.name}
                                className={`w-full h-full object-cover ${isOos ? 'opacity-50' : ''}`}
                              />
                            </button>
                            <div className="flex-1 min-w-0">
                              <button
                                type="button"
                                onClick={() => openProductDetail(wp)}
                                className="text-left text-xs sm:text-sm font-bold text-slate-900 line-clamp-1 hover:text-[#2874F0]"
                              >
                                {wp.name}
                              </button>
                              <div className="mt-0.5 flex items-center gap-2">
                                <span className="text-sm font-extrabold font-mono text-slate-900">
                                  {formatINR(wp.price)}
                                </span>
                                {isOos ? (
                                  <span className="text-[10px] font-extrabold text-rose-600 uppercase">
                                    Out of Stock
                                  </span>
                                ) : wp.stock <= 5 ? (
                                  <span className="text-[10px] font-bold text-rose-600">
                                    Only {wp.stock} left!
                                  </span>
                                ) : null}
                              </div>
                              <div className="mt-2 flex items-center gap-2">
                                <button
                                  type="button"
                                  disabled={isOos}
                                  onClick={() => handleMoveWishlistToCart(wp)}
                                  className="px-3 py-1 rounded-md bg-[#2874F0] hover:bg-[#1e60d5] text-white text-[11px] font-bold disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed transition"
                                >
                                  Move to Cart
                                </button>
                                <button
                                  type="button"
                                  onClick={() => toggleWishlist(wp.id)}
                                  className="px-2.5 py-1 rounded-md border border-slate-200 text-[11px] font-bold text-slate-600 hover:text-rose-600 hover:bg-rose-50"
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                )}
              </main>

              {/* Floating White Rounded Sticky Checkout Bar above Bottom Nav */}
              {displayedCartEntries.length > 0 && (
                <div className="fixed bottom-[64px] md:bottom-4 left-2.5 right-2.5 z-30 pointer-events-none">
                  <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-xl border border-slate-200/90 overflow-hidden pointer-events-auto">
                    <div className="bg-emerald-50 px-4 py-1.5 text-center text-[11px] sm:text-xs font-bold text-[#1B5E20] border-b border-emerald-100 tabular-nums">
                      You&apos;ll save {formatINR(totalCartSavings)} on this order
                    </div>
                    <div className="px-4 py-2.5 flex items-center justify-between gap-3">
                      <div className="min-w-0 leading-tight">
                        <span className="block text-[11px] text-slate-400 line-through font-mono tabular-nums">
                          {formatINR(displayedCartMrpTotal)}
                        </span>
                        <span className="block text-base sm:text-lg font-extrabold text-slate-900 font-mono tabular-nums">
                          {formatINR(finalCartPayable)}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const oos = normalizedCart.find(
                            (c) => c.product.stock <= 0 || c.quantity > c.product.stock
                          );
                          if (oos) {
                            showModal({
                              title: 'Stock Unavailable',
                              message:
                                oos.product.stock <= 0
                                  ? `${oos.product.name} is Out of Stock. Please remove it from your cart first.`
                                  : `Only ${oos.product.stock} unit(s) available for ${oos.product.name}.`,
                              type: 'error',
                            });
                            return;
                          }
                          if (!currentUser) {
                            setPage('login');
                          } else {
                            setPage('checkout');
                          }
                        }}
                        className="px-6 sm:px-8 h-11 rounded-full bg-[#FFC200] hover:bg-[#f2b800] active:scale-95 text-slate-950 text-xs sm:text-sm font-extrabold shadow-xs transition whitespace-nowrap"
                      >
                        Proceed to buy
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* CHECKOUT PAGE */}
          {page === 'checkout' && (
            <main className="max-w-2xl mx-auto px-3 sm:px-4 py-5 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setPage('cart')}
                    className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-700"
                  >
                    <i className="fa-solid fa-arrow-left text-xs"></i>
                  </button>
                  <div>
                    <h1 className="text-xl font-extrabold text-slate-900">Checkout</h1>
                    <p className="text-xs text-slate-500 tabular-nums">
                      {cartCount} {cartCount === 1 ? 'item' : 'items'} · Payable {formatINR(checkoutPayableTotal)}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => openAddressBook('select')}
                  className="px-3 py-1.5 rounded-lg bg-blue-50 text-[#2874F0] text-xs font-bold hover:bg-blue-100 whitespace-nowrap"
                >
                  Saved Addresses ({savedAddresses.length})
                </button>
              </div>

              {/* Multiple Saved Delivery Addresses Quick Selector */}
              {savedAddresses.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                      Select Saved Delivery Address
                    </h2>
                    <button
                      type="button"
                      onClick={() => openAddressBook('select')}
                      className="text-xs font-bold text-[#2874F0] hover:underline"
                    >
                      + Add / Edit
                    </button>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-2.5">
                    {savedAddresses.map((addr) => {
                      const active = selectedAddressId === addr.id;
                      return (
                        <button
                          key={addr.id}
                          type="button"
                          onClick={() => applySelectedSavedAddress(addr)}
                          className={`text-left p-3 rounded-lg border transition ${
                            active
                              ? 'border-[#2874F0] bg-blue-50/50 ring-1 ring-[#2874F0]/25'
                              : 'border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-extrabold uppercase">
                              {addr.label}
                            </span>
                            {active && (
                              <i className="fa-solid fa-circle-check text-[#2874F0] text-xs"></i>
                            )}
                          </div>
                          <p className="mt-1 text-xs font-bold text-slate-900 truncate">
                            {addr.name} · {addr.phone}
                          </p>
                          <p className="mt-0.5 text-[11px] text-slate-600 line-clamp-2">
                            {formatSavedAddressLine(addr)}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Promo Code & Order Price Summary matching Cart, Razorpay, COD, and Tax Invoice */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2.5 text-xs sm:text-sm">
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2 min-w-0">
                    <i className="fa-solid fa-ticket text-[#2874F0] text-xs"></i>
                    {appliedCouponCode && checkoutCouponDiscount > 0 ? (
                      <span className="text-xs font-bold text-[#2E7D32] truncate">
                        {appliedCouponCode} applied (-{formatINR(checkoutCouponDiscount)})
                      </span>
                    ) : (
                      <span className="text-xs font-semibold text-slate-700">Have a promo code?</span>
                    )}
                  </div>
                  {appliedCouponCode && checkoutCouponDiscount > 0 ? (
                    <button
                      type="button"
                      onClick={() => setAppliedCouponCode('')}
                      className="text-xs font-bold text-rose-600 hover:underline shrink-0"
                    >
                      Remove
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setCouponError('');
                        setCouponDraft('');
                        setCouponModalOpen(true);
                      }}
                      className="text-xs font-bold text-[#2874F0] hover:underline shrink-0"
                    >
                      Apply Coupon
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-between text-slate-600">
                  <span>Items Subtotal ({cartCount} {cartCount === 1 ? 'item' : 'items'})</span>
                  <span className="font-mono font-semibold text-slate-900 tabular-nums">{formatINR(cartTotal)}</span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>Delivery Charge</span>
                  <span className={`font-mono font-semibold tabular-nums ${checkoutDeliveryFee === 0 ? 'text-[#2E7D32]' : 'text-slate-900'}`}>
                    {checkoutDeliveryFee === 0 ? 'FREE' : formatINR(checkoutDeliveryFee)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>Platform Fee</span>
                  <span className="font-mono font-semibold text-slate-900 tabular-nums">{formatINR(checkoutPlatformFee)}</span>
                </div>
                {checkoutCouponDiscount > 0 && (
                  <div className="flex items-center justify-between text-[#2E7D32] font-semibold">
                    <span>Promo Discount ({appliedCouponCode})</span>
                    <span className="font-mono tabular-nums">-{formatINR(checkoutCouponDiscount)}</span>
                  </div>
                )}
                <div className="pt-2 border-t border-dashed border-slate-200 flex items-center justify-between font-extrabold text-slate-900 text-sm sm:text-base">
                  <span>Total Payable</span>
                  <span className="font-mono tabular-nums">{formatINR(checkoutPayableTotal)}</span>
                </div>
              </div>

              <form onSubmit={handlePlaceOrder} className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Full Name</label>
                  <input
                    type="text"
                    value={checkoutName}
                    onChange={(e) => setCheckoutName(e.target.value)}
                    required
                    className="w-full h-11 px-4 rounded-lg bg-slate-50 border border-slate-200 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Phone Number</label>
                  <input
                    type="tel"
                    value={checkoutPhone}
                    onChange={(e) => setCheckoutPhone(e.target.value)}
                    required
                    className="w-full h-11 px-4 rounded-lg bg-slate-50 border border-slate-200 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Delivery Address</label>
                  <textarea
                    rows={3}
                    value={checkoutAddress}
                    onChange={(e) => setCheckoutAddress(e.target.value)}
                    required
                    placeholder="House No, Street, City, Pincode"
                    className="w-full p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-sm"
                  />
                </div>
                              <div className="space-y-2.5">
                <div
                  onClick={() => setPaymentMethod('Online Payment')}
                  className={`p-4 rounded-xl border-2 cursor-pointer flex items-center justify-between transition ${
                    paymentMethod === 'Online Payment' ? 'border-[#2874F0] bg-blue-50/50' : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-10 h-10 rounded-lg bg-[#2874F0] text-white flex items-center justify-center">
                      <i className="fa-solid fa-credit-card"></i>
                    </span>
                    <div>
                      <p className="text-sm font-bold text-slate-900">Pay Online (UPI / Card / Netbanking)</p>
                      <p className="text-xs text-slate-500">Instant payment via Razorpay</p>
                    </div>
                  </div>
                  <i className={`fa-solid ${paymentMethod === 'Online Payment' ? 'fa-circle-check text-[#2874F0]' : 'fa-circle text-slate-300'} text-lg`}></i>
                </div>

                <div
                  onClick={() => setPaymentMethod('Cash on Delivery')}
                  className={`p-4 rounded-xl border-2 cursor-pointer flex items-center justify-between transition ${
                    paymentMethod === 'Cash on Delivery' ? 'border-[#2874F0] bg-blue-50/50' : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-10 h-10 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
                      <i className="fa-solid fa-money-bill-wave"></i>
                    </span>
                    <div>
                      <p className="text-sm font-bold text-slate-900">Cash on Delivery (COD)</p>
                      <p className="text-xs text-slate-500">Pay {formatINR(checkoutPayableTotal)} upon delivery</p>
                    </div>
                  </div>
                  <i className={`fa-solid ${paymentMethod === 'Cash on Delivery' ? 'fa-circle-check text-[#2874F0]' : 'fa-circle text-slate-300'} text-lg`}></i>
                </div>
              </div>

              <button
                type="submit"
                className="w-full h-12 rounded-lg bg-[#FB641B] text-white text-sm font-bold hover:bg-[#e85a12] transition flex items-center justify-center gap-2 shadow-sm"
              >
                <i className="fa-solid fa-check"></i>
                <span>{paymentMethod === 'Online Payment' ? `Pay ${formatINR(checkoutPayableTotal)} Online` : `Confirm Order (${formatINR(checkoutPayableTotal)})`}</span>
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

              {!currentUser ? (
                <div className="bg-white rounded-xl border border-slate-200 p-8 text-center space-y-3">
                  <i className="fa-solid fa-box text-3xl text-slate-300"></i>
                  <p className="text-sm font-semibold text-slate-700">Please login to view your live orders.</p>
                  <button
                    type="button"
                    onClick={() => setPage('login')}
                    className="px-5 py-2.5 rounded-lg bg-[#2874F0] text-white text-xs font-bold hover:bg-[#1e60d5] transition"
                  >
                    Login / Sign Up
                  </button>
                </div>
              ) : (
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
              )}
            </main>
          )}

          {/* PROFILE PAGE */}
          {page === 'profile' && currentUser && (
            <main className="max-w-2xl mx-auto px-3 sm:px-4 py-5 space-y-4">
              <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-14 h-14 rounded-full bg-[#2874F0] text-white flex items-center justify-center text-xl font-extrabold shrink-0">
                    {currentUser.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 space-y-0.5">
                    <h1 className="text-lg font-extrabold text-slate-900 truncate">{currentUser.name}</h1>
                    <p className="text-xs text-slate-600 truncate flex items-center gap-1.5">
                      <i className="fa-solid fa-envelope text-[#2874F0] w-3.5 text-center shrink-0"></i>
                      <span className="truncate">{currentUser.email || 'No email added'}</span>
                    </p>
                    <p className="text-xs text-slate-600 truncate flex items-center gap-1.5">
                      <i className="fa-solid fa-phone text-[#388E3C] w-3.5 text-center shrink-0"></i>
                      <span>{currentUser.phone ? `+91 ${currentUser.phone}` : 'Mobile number not added'}</span>
                    </p>
                  </div>
                </div>
                <button type="button" onClick={() => setPage('orders')} className="px-4 py-2 rounded-lg bg-blue-50 text-[#2874F0] text-xs font-bold shrink-0">
                  My Orders
                </button>
              </div>

              {/* Saved Delivery Addresses Card (Multiple Home / Work / Other Addresses) */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                      <i className="fa-solid fa-location-dot text-[#2874F0]"></i>
                      <span>My Saved Addresses ({savedAddresses.length})</span>
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Save multiple Home, Work &amp; Other addresses with Indian Pincode lookup
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openAddressBook('manage')}
                    className="px-3.5 py-2 rounded-lg bg-[#2874F0] hover:bg-[#1e60d5] text-white text-xs font-bold shrink-0 transition"
                  >
                    Manage
                  </button>
                </div>
                {savedAddresses.length > 0 && (
                  <div className="grid sm:grid-cols-2 gap-2.5">
                    {savedAddresses.slice(0, 2).map((addr) => (
                      <div key={addr.id} className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-[10px] font-extrabold uppercase text-slate-700">
                            {addr.label}
                          </span>
                          <span className="font-bold text-slate-900 truncate">{addr.name}</span>
                        </div>
                        <p className="mt-1 text-[11px] text-slate-600 line-clamp-2">
                          {formatSavedAddressLine(addr)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* My Wishlist (Saved for Later) Card */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                    <i className="fa-solid fa-heart text-[#E53935]"></i>
                    <span>My Wishlist ({wishlistProducts.length})</span>
                  </h2>
                  {wishlistProducts.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setPage('cart')}
                      className="text-xs font-bold text-[#2874F0] hover:underline"
                    >
                      Go to Cart
                    </button>
                  )}
                </div>
                {wishlistProducts.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    Tap the heart icon on any product or Save for Later in Cart to build your Wishlist.
                  </p>
                ) : (
                  <div className="grid sm:grid-cols-2 gap-2.5">
                    {wishlistProducts.map((wp) => (
                      <div key={wp.id} className="p-2.5 rounded-lg border border-slate-200 flex items-center gap-2.5">
                        <img
                          src={wp.image}
                          alt={wp.name}
                          className="w-12 h-12 rounded-md object-cover bg-slate-100 shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-slate-900 truncate">{wp.name}</p>
                          <p className="text-xs font-extrabold font-mono text-slate-800">{formatINR(wp.price)}</p>
                          <div className="mt-1 flex items-center gap-2">
                            <button
                              type="button"
                              disabled={wp.stock <= 0}
                              onClick={() => handleMoveWishlistToCart(wp)}
                              className="text-[11px] font-bold text-[#2874F0] hover:underline disabled:text-slate-400"
                            >
                              {wp.stock <= 0 ? 'Out of Stock' : 'Move to Cart'}
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleWishlist(wp.id)}
                              className="text-[11px] font-semibold text-rose-600 hover:underline"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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

              {/* Dedicated Seller Hub Card */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-orange-50 text-[#FB641B] flex items-center justify-center shrink-0">
                    <i className="fa-solid fa-store text-lg"></i>
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-sm font-extrabold text-slate-900 truncate">
                      {currentUser.isSeller
                        ? `Seller Hub · ${currentUser.sellerStoreName || 'My Store'}`
                        : 'Become a Seller / Seller Hub'}
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      List your own products &amp; manage orders from your dedicated seller dashboard
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setMode('seller')}
                  className="px-4 py-2 rounded-lg bg-[#FB641B] text-white text-xs font-bold hover:bg-[#e55812] transition shrink-0 whitespace-nowrap"
                >
                  {currentUser.isSeller ? 'Open Hub' : 'Start Selling'}
                </button>
              </div>

              {/* Delivery Partner Portal Card (Login + Join KYC) */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 space-y-3">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-blue-50 text-[#2874F0] flex items-center justify-center shrink-0">
                    <i className="fa-solid fa-motorcycle text-lg"></i>
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-sm font-extrabold text-slate-900 truncate">
                      {currentRider
                        ? `Delivery Partner · ${currentRider.name} (${currentRider.riderId})`
                        : 'Smart Basket Delivery Partner Fleet'}
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Sign in for live assigned deliveries &amp; GPS dispatch, or apply with KYC to join our fleet
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => openRiderPortal('login')}
                    className="px-4 py-2.5 rounded-lg bg-[#2874F0] text-white text-xs font-bold hover:bg-[#1e60d5] transition flex items-center justify-center gap-2"
                  >
                    <i className="fa-solid fa-motorcycle"></i>
                    <span>{currentRider ? 'Open Rider Dashboard' : 'Delivery Partner Login'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openRiderPortal('register')}
                    className="px-4 py-2.5 rounded-lg bg-[#0F172A] text-white text-xs font-bold hover:bg-slate-800 transition flex items-center justify-center gap-2"
                  >
                    <i className="fa-solid fa-id-card text-[#FFE500]"></i>
                    <span>Join as Delivery Partner</span>
                  </button>
                </div>
              </div>

              {/* Legal, Policies & Customer Support (Razorpay & Play Store Compliance) */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-extrabold text-slate-900">Policies, Legal &amp; Support</h2>
                    <p className="text-[11px] text-slate-500">Smart Basket commercial terms &amp; 7-day easy returns</p>
                  </div>
                  <i className="fa-solid fa-scale-balanced text-[#2874F0] text-sm"></i>
                </div>
                <div className="divide-y divide-slate-100">
                  {(
                    [
                      {
                        key: 'privacy' as LegalPolicyKey,
                        label: 'Privacy Policy',
                        sub: 'Data protection, GPS usage & Razorpay payment security',
                        icon: 'fa-user-shield',
                      },
                      {
                        key: 'terms' as LegalPolicyKey,
                        label: 'Terms & Conditions',
                        sub: 'Orders, pricing, COD/online payments & seller marketplace rules',
                        icon: 'fa-file-contract',
                      },
                      {
                        key: 'refund' as LegalPolicyKey,
                        label: 'Return & Refund Policy',
                        sub: '7-Day Easy Return & Replacement · 5–7 business day refunds',
                        icon: 'fa-rotate-left',
                      },
                      {
                        key: 'contact' as LegalPolicyKey,
                        label: 'Contact Us / Support',
                        sub: 'sabreensheikh545@gmail.com · Bawana, Delhi · 9 AM – 8 PM IST',
                        icon: 'fa-headset',
                      },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setActiveLegalPolicy(item.key)}
                      className="w-full px-5 py-3.5 flex items-center justify-between gap-3 text-left hover:bg-slate-50 transition"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-8 h-8 rounded-lg bg-blue-50 text-[#2874F0] flex items-center justify-center shrink-0">
                          <i className={`fa-solid ${item.icon} text-xs`}></i>
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs sm:text-sm font-bold text-slate-900">{item.label}</p>
                          <p className="text-[11px] text-slate-500 truncate">{item.sub}</p>
                        </div>
                      </div>
                      <i className="fa-solid fa-chevron-right text-xs text-slate-400 shrink-0"></i>
                    </button>
                  ))}
                </div>
              </div>

              <div className={`grid gap-3 ${isStrictAdminEmail ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {isStrictAdminEmail && (
                  <button
                    type="button"
                    onClick={requestAdminAccess}
                    className="h-11 rounded-lg bg-white border border-slate-200 text-[#2874F0] text-sm font-bold flex items-center justify-center gap-2 hover:bg-blue-50"
                  >
                    <i className="fa-solid fa-shield-halved"></i> Admin Panel
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleCustomerLogout}
                  className="h-11 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm font-bold flex items-center justify-center gap-2"
                >
                  <i className="fa-solid fa-right-from-bracket"></i> Logout
                </button>
              </div>
            </main>
          )}

          {/* CUSTOMER LOGIN & SIGN UP PAGE (Flipkart-style Email/Password & Google Auth) */}
          {page === 'login' && (
            <main className="max-w-md mx-auto px-3 sm:px-4 py-6">
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="bg-[#2874F0] px-6 py-5 text-white">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h1 className="text-xl font-extrabold">
                        {authTab === 'login' ? 'Login' : 'Create Account'}
                      </h1>
                      <p className="mt-1 text-xs text-blue-100 leading-relaxed">
                        {authTab === 'login'
                          ? 'Get access to your Orders, Cart & Big Saving Days'
                          : 'Sign up with your Name, Mobile Number & Email to start shopping'}
                      </p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                      <i className={`fa-solid ${authTab === 'login' ? 'fa-right-to-bracket' : 'fa-user-plus'} text-xl text-[#FFE500]`}></i>
                    </div>
                  </div>
                </div>

                {/* Two Tabs: Login | New User? Create Account */}
                <div className="grid grid-cols-2 border-b border-slate-200 bg-slate-50">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthTab('login');
                      setAuthError('');
                    }}
                    className={`py-3.5 px-2 text-xs sm:text-sm font-bold border-b-2 transition ${
                      authTab === 'login'
                        ? 'bg-white text-[#2874F0] border-[#2874F0]'
                        : 'text-slate-600 border-transparent hover:text-slate-900'
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
                    className={`py-3.5 px-2 text-xs sm:text-sm font-bold border-b-2 transition ${
                      authTab === 'signup'
                        ? 'bg-white text-[#2874F0] border-[#2874F0]'
                        : 'text-slate-600 border-transparent hover:text-slate-900'
                    }`}
                  >
                    New User? Create Account
                  </button>
                </div>

                <div className="p-6">
                  {authError && (
                    <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-start gap-2">
                      <i className="fa-solid fa-circle-exclamation mt-0.5 shrink-0"></i>
                      <span>{authError}</span>
                    </div>
                  )}

                  {authTab === 'login' ? (
                    <form onSubmit={handleEmailLogin} className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          Email Address
                        </label>
                        <input
                          type="email"
                          value={authEmail}
                          onChange={(e) => setAuthEmail(e.target.value)}
                          required
                          autoComplete="email"
                          placeholder="Enter your email"
                          className="w-full h-11 px-3.5 rounded-lg bg-slate-50 border border-slate-300 text-sm font-medium text-slate-900 placeholder-slate-400 focus:bg-white focus:border-[#2874F0] focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          Password
                        </label>
                        <div className="relative">
                          <input
                            type={showAuthPassword ? 'text' : 'password'}
                            value={authPassword}
                            onChange={(e) => setAuthPassword(e.target.value)}
                            required
                            autoComplete="current-password"
                            placeholder="Enter your password"
                            className="w-full h-11 pl-3.5 pr-11 rounded-lg bg-slate-50 border border-slate-300 text-sm font-medium text-slate-900 placeholder-slate-400 focus:bg-white focus:border-[#2874F0] focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => setShowAuthPassword((v) => !v)}
                            aria-label={showAuthPassword ? 'Hide password' : 'Show password'}
                            className="absolute right-0 top-0 h-11 w-11 flex items-center justify-center text-slate-400 hover:text-slate-700"
                          >
                            <i className={`fa-solid ${showAuthPassword ? 'fa-eye-slash' : 'fa-eye'} text-sm`}></i>
                          </button>
                        </div>
                      </div>

                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        By continuing, you agree to Smart Basket&apos;s{' '}
                        <button
                          type="button"
                          onClick={() => setActiveLegalPolicy('terms')}
                          className="text-[#2874F0] font-semibold hover:underline"
                        >
                          Terms &amp; Conditions
                        </button>{' '}
                        and{' '}
                        <button
                          type="button"
                          onClick={() => setActiveLegalPolicy('privacy')}
                          className="text-[#2874F0] font-semibold hover:underline"
                        >
                          Privacy Policy
                        </button>
                        .
                      </p>

                      <button
                        type="submit"
                        disabled={authBusy}
                        className="w-full h-12 rounded-lg bg-[#FB641B] text-white text-sm font-bold hover:bg-[#e55812] disabled:opacity-60 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
                      >
                        <span>{authBusy ? 'Signing in...' : 'Login'}</span>
                        <i className="fa-solid fa-arrow-right text-xs"></i>
                      </button>
                    </form>
                  ) : (
                    <form onSubmit={handleEmailSignup} className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          Full Name
                        </label>
                        <input
                          type="text"
                          value={authName}
                          onChange={(e) => setAuthName(e.target.value)}
                          required
                          autoComplete="name"
                          placeholder="Enter your full name"
                          className="w-full h-11 px-3.5 rounded-lg bg-slate-50 border border-slate-300 text-sm font-medium text-slate-900 placeholder-slate-400 focus:bg-white focus:border-[#2874F0] focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          Mobile Number
                        </label>
                        <div className="flex items-center rounded-lg border border-slate-300 bg-slate-50 focus-within:border-[#2874F0] focus-within:bg-white overflow-hidden transition">
                          <span className="px-3 h-11 flex items-center justify-center bg-slate-100 border-r border-slate-200 text-xs font-bold text-slate-700 shrink-0">
                            +91
                          </span>
                          <input
                            type="tel"
                            inputMode="numeric"
                            maxLength={10}
                            value={authPhone}
                            onChange={(e) => setAuthPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                            required
                            autoComplete="tel-national"
                            placeholder="10-digit mobile number"
                            className="w-full h-11 px-3.5 bg-transparent text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          Email Address
                        </label>
                        <input
                          type="email"
                          value={authEmail}
                          onChange={(e) => setAuthEmail(e.target.value)}
                          required
                          autoComplete="email"
                          placeholder="Enter your email"
                          className="w-full h-11 px-3.5 rounded-lg bg-slate-50 border border-slate-300 text-sm font-medium text-slate-900 placeholder-slate-400 focus:bg-white focus:border-[#2874F0] focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          Password
                        </label>
                        <div className="relative">
                          <input
                            type={showAuthPassword ? 'text' : 'password'}
                            value={authPassword}
                            onChange={(e) => setAuthPassword(e.target.value)}
                            required
                            minLength={6}
                            autoComplete="new-password"
                            placeholder="Minimum 6 characters"
                            className="w-full h-11 pl-3.5 pr-11 rounded-lg bg-slate-50 border border-slate-300 text-sm font-medium text-slate-900 placeholder-slate-400 focus:bg-white focus:border-[#2874F0] focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => setShowAuthPassword((v) => !v)}
                            aria-label={showAuthPassword ? 'Hide password' : 'Show password'}
                            className="absolute right-0 top-0 h-11 w-11 flex items-center justify-center text-slate-400 hover:text-slate-700"
                          >
                            <i className={`fa-solid ${showAuthPassword ? 'fa-eye-slash' : 'fa-eye'} text-sm`}></i>
                          </button>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={authBusy}
                        className="w-full h-12 rounded-lg bg-[#FB641B] text-white text-sm font-bold hover:bg-[#e55812] disabled:opacity-60 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
                      >
                        <span>{authBusy ? 'Creating Account...' : 'Create Account'}</span>
                        <i className="fa-solid fa-user-check text-xs"></i>
                      </button>
                    </form>
                  )}

                  <div className="my-5 flex items-center gap-3">
                    <div className="flex-1 h-px bg-slate-200" />
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">OR</span>
                    <div className="flex-1 h-px bg-slate-200" />
                  </div>

                  <button
                    type="button"
                    disabled={authBusy}
                    onClick={handleGoogleSignIn}
                    className="w-full h-11 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 active:scale-[0.99] disabled:opacity-60 transition flex items-center justify-center gap-2.5 text-sm font-bold text-slate-800 shadow-2xs"
                  >
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        fill="#4285F4"
                        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
                      />
                    </svg>
                    <span>Continue with Google</span>
                  </button>

                  {/* Delivery Partner Login & Join as Delivery Partner (KYC Self-Registration) */}
                  <div className="mt-5 pt-4 border-t border-slate-200 space-y-2.5">
                    <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 text-center">
                      Delivery Partner Portal
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => openRiderPortal('login')}
                        className="h-11 px-3 rounded-lg bg-blue-50 border border-blue-200 hover:bg-blue-100 text-[#2874F0] text-xs font-extrabold transition flex items-center justify-center gap-2"
                      >
                        <i className="fa-solid fa-motorcycle"></i>
                        <span>Delivery Partner Login</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => openRiderPortal('register')}
                        className="h-11 px-3 rounded-lg bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-extrabold transition flex items-center justify-center gap-2"
                      >
                        <i className="fa-solid fa-user-plus text-[#FFE500]"></i>
                        <span>Join as Delivery Partner</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Guest Legal & Policy Links Footer */}
              <div className="mt-4 bg-white rounded-xl border border-slate-200 p-4 space-y-2.5">
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                  Smart Basket Policies &amp; Support
                </p>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      { key: 'privacy' as LegalPolicyKey, label: 'Privacy Policy' },
                      { key: 'terms' as LegalPolicyKey, label: 'Terms & Conditions' },
                      { key: 'refund' as LegalPolicyKey, label: 'Return & Refund Policy' },
                      { key: 'contact' as LegalPolicyKey, label: 'Contact Us' },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setActiveLegalPolicy(item.key)}
                      className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 hover:border-[#2874F0] hover:text-[#2874F0] transition"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </main>
          )}

          {/* Fixed Mobile Bottom Nav (hidden on PDP so sticky Add to Cart / Buy Now bar sits cleanly at bottom) */}
          {page !== 'detail' && (
          <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 shadow-xs">
            <div className="grid grid-cols-5 h-14 items-center">
              <button
                type="button"
                onClick={() => setPage('home')}
                className={`flex flex-col items-center justify-center h-full transition-colors ${
                  page === 'home' ? 'text-[#2874F0]' : 'text-slate-500'
                }`}
              >
                <i className="fa-solid fa-house text-base"></i>
                <span className={`text-[10px] mt-0.5 ${page === 'home' ? 'font-extrabold' : 'font-semibold'}`}>Home</span>
              </button>

              <button
                type="button"
                onClick={() => setPage('play')}
                className={`flex flex-col items-center justify-center h-full transition-colors ${
                  page === 'play' ? 'text-[#2874F0]' : 'text-slate-500'
                }`}
              >
                <i className="fa-solid fa-circle-play text-base"></i>
                <span className={`text-[10px] mt-0.5 ${page === 'play' ? 'font-extrabold' : 'font-semibold'}`}>Play</span>
              </button>

              <button
                type="button"
                onClick={() => setPage('categories')}
                className={`flex flex-col items-center justify-center h-full transition-colors ${
                  page === 'categories' || page === 'shop' ? 'text-[#2874F0]' : 'text-slate-500'
                }`}
              >
                <i className="fa-solid fa-table-cells-large text-base"></i>
                <span
                  className={`text-[10px] mt-0.5 ${
                    page === 'categories' || page === 'shop' ? 'font-extrabold' : 'font-semibold'
                  }`}
                >
                  Categories
                </span>
              </button>

              <button
                type="button"
                onClick={() => setPage(currentUser ? 'profile' : 'login')}
                className={`flex flex-col items-center justify-center h-full transition-colors ${
                  page === 'profile' || page === 'orders' || page === 'login' ? 'text-[#2874F0]' : 'text-slate-500'
                }`}
              >
                <i className="fa-solid fa-user text-base"></i>
                <span
                  className={`text-[10px] mt-0.5 ${
                    page === 'profile' || page === 'orders' || page === 'login' ? 'font-extrabold' : 'font-semibold'
                  }`}
                >
                  Account
                </span>
              </button>

              <button
                type="button"
                onClick={() => setPage('cart')}
                className={`relative flex flex-col items-center justify-center h-full transition-colors ${
                  page === 'cart' || page === 'checkout' ? 'text-[#2874F0]' : 'text-slate-500'
                }`}
              >
                <div className="relative">
                  <i className="fa-solid fa-cart-shopping text-base"></i>
                  {cartCount > 0 && (
                    <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-[16px] px-1 rounded-full bg-[#E53935] text-white text-[9px] font-extrabold flex items-center justify-center tabular-nums">
                      {cartCount}
                    </span>
                  )}
                </div>
                <span
                  className={`text-[10px] mt-0.5 ${
                    page === 'cart' || page === 'checkout' ? 'font-extrabold' : 'font-semibold'
                  }`}
                >
                  Cart
                </span>
              </button>
            </div>
          </nav>
          )}
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

      {/* Strict Admin Secret PIN Verification Modal */}
      {adminPinModalOpen && isStrictAdminEmail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-[#2874F0] px-6 py-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#FFE500] text-[#2874F0] flex items-center justify-center shrink-0">
                  <i className="fa-solid fa-lock text-lg"></i>
                </div>
                <div>
                  <h3 className="text-base font-extrabold leading-tight">Admin Secret PIN</h3>
                  <p className="text-[11px] text-blue-100 mt-0.5 truncate">{ADMIN_EMAIL}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setAdminPinModalOpen(false);
                  setAdminPinInput('');
                  setAdminPinError('');
                }}
                aria-label="Close PIN modal"
                className="w-8 h-8 rounded-lg text-white/90 hover:bg-white/15 flex items-center justify-center"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <form onSubmit={handleVerifyAdminPin} className="p-6 space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                Enter your 4-digit Admin Secret PIN to unlock the Smart Basket Admin Panel.
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">4-Digit PIN</label>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={4}
                  autoFocus
                  required
                  value={adminPinInput}
                  onChange={(e) => {
                    setAdminPinInput(e.target.value.replace(/\D/g, '').slice(0, 4));
                    if (adminPinError) setAdminPinError('');
                  }}
                  placeholder="••••"
                  className="w-full h-12 px-4 rounded-xl bg-slate-50 border border-slate-300 text-center text-2xl font-mono font-extrabold tracking-[0.6em] text-slate-900 focus:bg-white focus:border-[#2874F0] focus:outline-none"
                />
              </div>

              {adminPinError && (
                <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                  <i className="fa-solid fa-circle-exclamation shrink-0"></i>
                  <span>{adminPinError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setAdminPinModalOpen(false);
                    setAdminPinInput('');
                    setAdminPinError('');
                  }}
                  className="px-4 py-2.5 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adminPinInput.length !== 4}
                  className="px-5 py-2.5 rounded-lg text-xs font-bold bg-[#2874F0] text-white hover:bg-[#1e60d5] disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-1.5"
                >
                  <i className="fa-solid fa-unlock-keyhole"></i>
                  <span>Unlock Admin Panel</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Coupons & Offers Modal */}
      {couponModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/55 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-900">Coupons &amp; Offers</h3>
              <button
                type="button"
                onClick={() => setCouponModalOpen(false)}
                aria-label="Close coupons modal"
                className="w-8 h-8 rounded-lg text-slate-500 hover:bg-slate-100 flex items-center justify-center"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <div className="p-5 space-y-4">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleApplyCouponCode(couponDraft);
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  value={couponDraft}
                  onChange={(e) => {
                    setCouponDraft(e.target.value.toUpperCase());
                    if (couponError) setCouponError('');
                  }}
                  placeholder="Enter coupon code (e.g. SMART50)"
                  className="flex-1 h-11 px-3.5 rounded-lg bg-slate-50 border border-slate-300 text-sm font-semibold uppercase focus:bg-white focus:border-[#2874F0] focus:outline-none"
                />
                <button
                  type="submit"
                  className="px-4 h-11 rounded-lg bg-[#2874F0] text-white text-xs font-bold hover:bg-[#1e60d5] transition shrink-0"
                >
                  Apply
                </button>
              </form>

              {couponError && (
                <p className="text-xs font-semibold text-rose-600">{couponError}</p>
              )}

              <div className="space-y-2.5 max-h-72 overflow-y-auto">
                {activePromoCodes.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-4">
                    No active promo codes available right now.
                  </p>
                ) : (
                  activePromoCodes.map((c) => {
                    const currentSubtotal = Math.max(displayedCartSubtotal, cartTotal);
                    const isApplied = appliedCouponCode.toUpperCase() === c.code.toUpperCase() && calculatePromoDiscount(currentSubtotal, c) > 0;
                    const eligible = currentSubtotal >= c.minOrderValue;
                    const promoTitle =
                      c.discountType === 'percent'
                        ? `${c.discountValue}% Off${c.maxDiscount ? ` (up to ${formatINR(c.maxDiscount)})` : ''}`
                        : `Flat ${formatINR(c.discountValue)} Off`;
                    return (
                      <div
                        key={c.docId || c.code}
                        className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 ${
                          isApplied ? 'border-[#2E7D32] bg-emerald-50/50' : 'border-slate-200 bg-slate-50/60'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs font-extrabold text-[#2874F0] tracking-wide">
                              {c.code}
                            </span>
                            <span className="text-xs font-bold text-slate-900">{promoTitle}</span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {c.description || `Valid on orders of ${formatINR(c.minOrderValue)} & above`}
                          </p>
                        </div>
                        {isApplied ? (
                          <button
                            type="button"
                            onClick={() => setAppliedCouponCode('')}
                            className="px-3 py-1.5 rounded-lg bg-rose-50 text-rose-600 text-xs font-bold shrink-0"
                          >
                            Remove
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={!eligible}
                            onClick={() => handleApplyCouponCode(c.code, currentSubtotal)}
                            className="px-3.5 py-1.5 rounded-lg bg-[#2874F0] text-white text-xs font-bold hover:bg-[#1e60d5] disabled:opacity-45 disabled:cursor-not-allowed shrink-0"
                          >
                            Apply
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Select Delivery Location Modal / Drawer (Live GPS + Manual Address) */}
      {addressModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/55 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden max-h-[92vh] flex flex-col">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-full bg-blue-50 text-[#2874F0] flex items-center justify-center">
                  <i className="fa-solid fa-location-dot text-xs"></i>
                </span>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 leading-tight">Select Delivery Location</h3>
                  <p className="text-[11px] text-slate-500">Updates Home, Cart &amp; Checkout instantly</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAddressModalOpen(false)}
                aria-label="Close delivery location modal"
                className="w-8 h-8 rounded-lg text-slate-500 hover:bg-slate-100 flex items-center justify-center"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <form onSubmit={handleSaveCartAddress} className="p-5 space-y-3.5 overflow-y-auto">
              {/* Prominent Live GPS Button */}
              <div className="space-y-2">
                <button
                  type="button"
                  disabled={gpsLoading}
                  onClick={handleUseCurrentLocation}
                  className="w-full py-3 px-4 rounded-xl bg-blue-50 hover:bg-blue-100/80 border border-[#2874F0]/30 text-[#2874F0] font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 transition disabled:opacity-70"
                >
                  {gpsLoading ? (
                    <>
                      <i className="fa-solid fa-spinner fa-spin"></i>
                      <span>Detecting your current location...</span>
                    </>
                  ) : (
                    <>
                      <span aria-hidden="true">📍</span>
                      <span>Use My Current Location</span>
                    </>
                  )}
                </button>

                {gpsSuccess && (
                  <div className="px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-[11px] font-semibold text-emerald-800 flex items-start gap-2">
                    <i className="fa-solid fa-circle-check text-emerald-600 mt-0.5 shrink-0"></i>
                    <span>{gpsSuccess}</span>
                  </div>
                )}

                {gpsError && (
                  <div className="px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-[11px] font-semibold text-amber-800 flex items-start gap-2">
                    <i className="fa-solid fa-triangle-exclamation text-amber-600 mt-0.5 shrink-0"></i>
                    <span>{gpsError}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2.5 pt-0.5">
                <div className="flex-1 h-px bg-slate-200"></div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Or enter address manually
                </span>
                <div className="flex-1 h-px bg-slate-200"></div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={addrName}
                    onChange={(e) => setAddrName(e.target.value)}
                    placeholder="Customer Name"
                    className="w-full h-10 px-3.5 rounded-xl bg-slate-50 border border-slate-300 text-sm focus:bg-white focus:border-[#2874F0] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    required
                    value={addrPhone}
                    onChange={(e) => setAddrPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="10-digit mobile"
                    className="w-full h-10 px-3.5 rounded-xl bg-slate-50 border border-slate-300 text-sm focus:bg-white focus:border-[#2874F0] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">House No., Building, Street</label>
                <input
                  type="text"
                  required={!addrArea.trim()}
                  value={addrHouseStreet}
                  onChange={(e) => setAddrHouseStreet(e.target.value)}
                  placeholder="Flat 402, Lotus Residency, MG Road"
                  className="w-full h-10 px-3.5 rounded-xl bg-slate-50 border border-slate-300 text-sm focus:bg-white focus:border-[#2874F0] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Area / Locality</label>
                <input
                  type="text"
                  value={addrArea}
                  onChange={(e) => setAddrArea(e.target.value)}
                  placeholder="e.g. Indiranagar / Sector 14"
                  className="w-full h-10 px-3.5 rounded-xl bg-slate-50 border border-slate-300 text-sm focus:bg-white focus:border-[#2874F0] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">City</label>
                  <input
                    type="text"
                    required
                    value={addrCity}
                    onChange={(e) => setAddrCity(e.target.value)}
                    placeholder="e.g. Bengaluru"
                    className="w-full h-10 px-3.5 rounded-xl bg-slate-50 border border-slate-300 text-sm focus:bg-white focus:border-[#2874F0] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">State</label>
                  <input
                    type="text"
                    value={addrState}
                    onChange={(e) => setAddrState(e.target.value)}
                    placeholder="e.g. Karnataka"
                    className="w-full h-10 px-3.5 rounded-xl bg-slate-50 border border-slate-300 text-sm focus:bg-white focus:border-[#2874F0] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Pincode</label>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  value={addrPincode}
                  onChange={(e) => setAddrPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="6-digit PIN"
                  className="w-full h-10 px-3.5 rounded-xl bg-slate-50 border border-slate-300 text-sm font-mono focus:bg-white focus:border-[#2874F0] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAddressModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#2874F0] text-white text-xs font-bold hover:bg-[#1e60d5] transition"
                >
                  Save Delivery Location
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7-Day Return / Replace Request Modal */}
      {returnModalOrder && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/55 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-full bg-amber-50 text-amber-700 flex items-center justify-center">
                  <i className="fa-solid fa-rotate-left text-xs"></i>
                </span>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 leading-tight">
                    Request Return / Replace
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Order #{returnModalOrder.id} · 7-Day Easy Return Protection
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReturnModalOrder(null)}
                aria-label="Close return modal"
                className="w-8 h-8 rounded-lg text-slate-500 hover:bg-slate-100 flex items-center justify-center"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <form onSubmit={handleSubmitReturnRequest} className="p-5 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">What would you like to do?</label>
                <div className="grid grid-cols-2 gap-2.5">
                  {(['Return', 'Replace'] as const).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setReturnResolutionDraft(opt)}
                      className={`py-2.5 px-3 rounded-xl border text-xs font-extrabold transition flex items-center justify-center gap-1.5 ${
                        returnResolutionDraft === opt
                          ? 'bg-blue-50 border-[#2874F0] text-[#2874F0]'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <i className={`fa-solid ${opt === 'Return' ? 'fa-wallet' : 'fa-arrows-rotate'}`}></i>
                      <span>{opt === 'Return' ? 'Return & Refund' : 'Replace Item'}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">Select Reason</label>
                <div className="space-y-2">
                  {RETURN_REASONS.map((reason) => (
                    <label
                      key={reason}
                      className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border cursor-pointer transition text-xs font-semibold ${
                        returnReasonDraft === reason
                          ? 'bg-amber-50 border-amber-400 text-amber-950'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <input
                        type="radio"
                        name="returnReason"
                        value={reason}
                        checked={returnReasonDraft === reason}
                        onChange={() => setReturnReasonDraft(reason)}
                        className="accent-[#2874F0]"
                      />
                      <span>{reason}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Additional Details <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <textarea
                  rows={2}
                  value={returnExtraNote}
                  onChange={(e) => setReturnExtraNote(e.target.value)}
                  placeholder="Briefly describe the damage, defect, or mismatch..."
                  className="w-full p-3 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-800 focus:bg-white focus:border-[#2874F0] focus:outline-none"
                />
              </div>

              <div className="px-3.5 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-900 leading-relaxed">
                <i className="fa-solid fa-shield-halved text-[#2E7D32] mr-1.5"></i>
                Approved refunds are credited to your original payment method within <strong>5–7 business days</strong>.
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setReturnModalOrder(null)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#FB641B] text-white text-xs font-extrabold hover:bg-[#e55812] transition"
                >
                  Submit {returnResolutionDraft} Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Commercial Legal, Policy & Contact Us Modal (Razorpay & Play Store Compliance) */}
      {activeLegalPolicy && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-5 py-4 bg-[#2874F0] text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
                  <i
                    className={`fa-solid ${
                      activeLegalPolicy === 'privacy'
                        ? 'fa-user-shield'
                        : activeLegalPolicy === 'terms'
                        ? 'fa-file-contract'
                        : activeLegalPolicy === 'refund'
                        ? 'fa-rotate-left'
                        : 'fa-headset'
                    } text-[#FFE500]`}
                  ></i>
                </div>
                <div>
                  <h3 className="text-base font-extrabold leading-tight">
                    {activeLegalPolicy === 'privacy'
                      ? 'Privacy Policy'
                      : activeLegalPolicy === 'terms'
                      ? 'Terms & Conditions'
                      : activeLegalPolicy === 'refund'
                      ? 'Return & Refund Policy'
                      : 'Contact Us & Support'}
                  </h3>
                  <p className="text-[11px] text-blue-100">Smart Basket India · Effective 2026</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveLegalPolicy(null)}
                aria-label="Close legal policy modal"
                className="w-8 h-8 rounded-lg text-white hover:bg-white/15 flex items-center justify-center"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            {/* Quick Policy Switcher Tabs */}
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0">
              {(
                [
                  { key: 'privacy' as LegalPolicyKey, label: 'Privacy Policy' },
                  { key: 'terms' as LegalPolicyKey, label: 'Terms & Conditions' },
                  { key: 'refund' as LegalPolicyKey, label: 'Return & Refund' },
                  { key: 'contact' as LegalPolicyKey, label: 'Contact Us' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveLegalPolicy(tab.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition ${
                    activeLegalPolicy === tab.key
                      ? 'bg-[#2874F0] text-white shadow-2xs'
                      : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="p-5 sm:p-6 overflow-y-auto space-y-4 text-xs sm:text-sm text-slate-700 leading-relaxed select-text">
              {activeLegalPolicy === 'privacy' && (
                <>
                  <p>
                    <strong>Smart Basket</strong> respects your privacy and is committed to protecting the personal
                    information you share while shopping on our platform.
                  </p>
                  <div className="space-y-1.5">
                    <h4 className="font-extrabold text-slate-900">1. Information We Collect</h4>
                    <p>
                      To process orders and deliver your packages accurately, we collect your <strong>full name</strong>,{' '}
                      <strong>mobile phone number</strong>, <strong>email address</strong>, and{' '}
                      <strong>shipping/delivery address</strong> (including Pincode).
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <h4 className="font-extrabold text-slate-900">2. Live GPS Location Usage</h4>
                    <p>
                      When you tap <em>&ldquo;Use My Current Location&rdquo;</em>, Smart Basket accesses your device&apos;s
                      GPS coordinates solely with your explicit browser permission to auto-fill your Area/Locality, City,
                      State, and Pincode for accurate doorstep delivery. We do not track your background location.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <h4 className="font-extrabold text-slate-900">3. Secure Payment Processing via Razorpay</h4>
                    <p>
                      All online transactions (UPI, Cards, NetBanking, Wallets) are processed securely through{' '}
                      <strong>Razorpay</strong> using PCI-DSS compliant encryption. Smart Basket{' '}
                      <strong>never collects or stores</strong> your raw debit/credit card numbers, CVV, or UPI PIN
                      credentials on our servers.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <h4 className="font-extrabold text-slate-900">4. Data Sharing &amp; Account Deletion</h4>
                    <p>
                      Delivery details (name, phone, address) are shared strictly with verified sellers and courier
                      partners (such as Delhivery, Shiprocket, BlueDart, or India Post) to fulfill your order. For data
                      access or deletion requests, email{' '}
                      <a href="mailto:sabreensheikh545@gmail.com" className="text-[#2874F0] font-bold hover:underline">
                        sabreensheikh545@gmail.com
                      </a>
                      .
                    </p>
                  </div>
                </>
              )}

              {activeLegalPolicy === 'terms' && (
                <>
                  <p>
                    Welcome to <strong>Smart Basket</strong>. By accessing or placing an order on Smart Basket, you
                    agree to the following Terms &amp; Conditions.
                  </p>
                  <div className="space-y-1.5">
                    <h4 className="font-extrabold text-slate-900">1. Order Acceptance &amp; Cancellation</h4>
                    <p>
                      Orders are confirmed once verified by Smart Basket or the respective approved seller. Customers may
                      cancel newly confirmed orders prior to packing/shipment directly from <strong>My Orders</strong>.
                      Smart Basket reserves the right to cancel orders in case of stock unavailability or pricing errors.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <h4 className="font-extrabold text-slate-900">2. Pricing, Platform Fee &amp; Offers</h4>
                    <p>
                      All prices are displayed in Indian Rupees (INR) inclusive of applicable taxes. A nominal platform
                      handling fee (₹10) and any applicable promotional coupon discounts are transparently itemized on
                      your Cart and Checkout summary before payment.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <h4 className="font-extrabold text-slate-900">3. COD &amp; Online Payment Rules</h4>
                    <p>
                      Customers may pay via <strong>Cash on Delivery (COD)</strong> where serviceable or via online
                      payments powered by <strong>Razorpay</strong>. Repeated refusal of COD shipments may result in COD
                      restrictions on the account.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <h4 className="font-extrabold text-slate-900">4. Seller Marketplace Guidelines</h4>
                    <p>
                      Independent sellers registering on Smart Basket Seller Hub undergo Admin review and approval before
                      their listings appear publicly. Sellers must list only genuine, accurate products, honor timely
                      dispatch with valid courier tracking IDs, and comply with Smart Basket&apos;s 7-day customer return
                      standards.
                    </p>
                  </div>
                </>
              )}

              {activeLegalPolicy === 'refund' && (
                <>
                  <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 font-semibold">
                    <i className="fa-solid fa-shield-check text-[#2E7D32] mr-1.5"></i>
                    Smart Basket offers a hassle-free <strong>7-Day Easy Return &amp; Replacement</strong> window from
                    the date of delivery.
                  </div>
                  <div className="space-y-1.5">
                    <h4 className="font-extrabold text-slate-900">1. Eligible Items for Return or Replacement</h4>
                    <p>
                      You can raise a return or replacement request within <strong>7 days of delivery</strong> directly
                      from <strong>My Orders → Request Return / Replace</strong> if you receive:
                    </p>
                    <ul className="list-disc pl-5 space-y-1 text-slate-600">
                      <li>A physically damaged or broken item</li>
                      <li>A defective or non-working product</li>
                      <li>A wrong item, size, or model delivered</li>
                      <li>Quality issues or missing parts/accessories</li>
                    </ul>
                  </div>
                  <div className="space-y-1.5">
                    <h4 className="font-extrabold text-slate-900">2. Return Approval &amp; Pickup</h4>
                    <p>
                      Once submitted, your order status updates to <strong>Return Requested</strong>. Our Admin support
                      team reviews and approves valid requests promptly, after which reverse pickup or replacement
                      dispatch is scheduled. Items should be returned in original packaging with tags intact.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <h4 className="font-extrabold text-slate-900">3. Refund Timeline (5–7 Business Days)</h4>
                    <p>
                      Upon approval and pickup verification, refunds for prepaid Razorpay orders are processed directly
                      back to your <strong>original payment method within 5–7 business days</strong>. For Cash on
                      Delivery (COD) orders, refunds are issued to your verified UPI ID or bank account within 5–7
                      business days.
                    </p>
                  </div>
                </>
              )}

              {activeLegalPolicy === 'contact' && (
                <>
                  <p>
                    Need help with an order, live tracking, 7-day return/refund, or seller onboarding? Reach out to the{' '}
                    <strong>Smart Basket Customer Support</strong> team directly:
                  </p>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                      <div className="flex items-center gap-2 text-[#2874F0] font-extrabold text-xs uppercase tracking-wide">
                        <i className="fa-solid fa-envelope"></i>
                        <span>Support Email</span>
                      </div>
                      <p className="font-mono font-bold text-slate-900 text-xs sm:text-sm break-all">
                        sabreensheikh545@gmail.com
                      </p>
                      <div className="pt-1 flex items-center gap-2">
                        <a
                          href="mailto:sabreensheikh545@gmail.com"
                          className="px-3 py-1.5 rounded-lg bg-[#2874F0] text-white text-xs font-bold hover:bg-[#1e60d5] transition"
                        >
                          Email Support
                        </a>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              if (navigator.clipboard) {
                                await navigator.clipboard.writeText('sabreensheikh545@gmail.com');
                              }
                              setSupportEmailCopied(true);
                              window.setTimeout(() => setSupportEmailCopied(false), 2000);
                            } catch {
                              setSupportEmailCopied(true);
                            }
                          }}
                          className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-100 transition"
                        >
                          {supportEmailCopied ? 'Copied!' : 'Copy Email'}
                        </button>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                      <div className="flex items-center gap-2 text-[#2E7D32] font-extrabold text-xs uppercase tracking-wide">
                        <i className="fa-solid fa-clock"></i>
                        <span>Support Hours</span>
                      </div>
                      <p className="font-bold text-slate-900 text-sm">9:00 AM – 8:00 PM IST</p>
                      <p className="text-xs text-slate-500">Monday to Sunday (All Days)</p>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-200/80 space-y-1.5">
                    <div className="flex items-center gap-2 text-[#2874F0] font-extrabold text-xs uppercase tracking-wide">
                      <i className="fa-solid fa-location-dot"></i>
                      <span>Registered Support &amp; Dispatch Location</span>
                    </div>
                    <p className="font-bold text-slate-900 text-sm">Smart Basket Customer Care &amp; Fulfillment Desk</p>
                    <p className="text-xs sm:text-sm text-slate-700">
                      JJ Colony, Bawana, Delhi - 110039, India
                    </p>
                  </div>
                </>
              )}
            </div>

            <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
              <span className="text-[11px] font-semibold text-slate-500">
                Smart Basket · JJ Colony, Bawana, Delhi - 110039
              </span>
              <button
                type="button"
                onClick={() => setActiveLegalPolicy(null)}
                className="px-4 py-2 rounded-xl bg-[#2874F0] text-white text-xs font-bold hover:bg-[#1e60d5] transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Multiple Saved Delivery Addresses Book Modal */}
      <AddressBookModal
        open={addressBookOpen}
        onClose={() => setAddressBookOpen(false)}
        addresses={savedAddresses}
        selectedAddressId={selectedAddressId}
        defaultName={currentUser?.name || checkoutName}
        defaultPhone={currentUser?.phone || checkoutPhone}
        onSaveAddresses={handleSaveAddressBook}
        onSelectAddress={applySelectedSavedAddress}
        mode={addressBookMode}
      />

      {/* Verified Purchase Review Modal (Delivered Orders Only) */}
      <VerifiedReviewModal
        open={Boolean(reviewModalTarget)}
        product={reviewModalTarget?.product || null}
        order={reviewModalTarget?.order || null}
        existingReview={reviewModalTarget?.existing || null}
        onClose={() => setReviewModalTarget(null)}
        onSubmit={handleSubmitVerifiedReview}
      />

      {/* Printable GST Tax Invoice Modal with Promo Code & Delivery Fee Breakdown */}
      <TaxInvoiceModal
        order={invoiceModalOrder}
        onClose={() => setInvoiceModalOrder(null)}
      />

    </div>
  );
}

