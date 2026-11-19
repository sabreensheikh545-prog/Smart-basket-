import React, { useEffect, useMemo, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  updateProfile,
} from 'firebase/auth';
import { auth, getFirebaseAuthErrorMessage, googleProvider } from '../firebase';
import {
  deleteProductFirestore,
  filterOrderForSeller,
  getSellerProfileFirestore,
  registerOrUpdateSellerFirestore,
  requestSellerPayoutFirestore,
  saveProductFirestore,
  subscribeSellerOrdersFirestore,
  subscribeSellerProfileFirestore,
  syncUserProfileFirestore,
  updateOrderTrackingFirestore,
} from '../services/firestoreService';
import {
  ASSETS,
  IMAGE_CHOICES,
  deleteProductLocal,
  getBootstrapData,
  getSellerByEmailOrUidLocal,
  saveProductLocal,
  setStoredCurrentSeller,
  syncFirebaseCustomerLocal,
} from '../store/localStore';
import {
  COURIER_PARTNERS,
  Category,
  ORDER_STATUS_OPTIONS,
  Order,
  OrderStatus,
  Product,
  SellerProfile,
  User,
  calculateSellerEarnings,
  formatINR,
  getCourierTrackingUrl,
  getEffectiveMrp,
  getOrderStatusLabel,
  normalizeOrderStatus,
  normalizeSellerStatus,
} from '../types';

type SellerTab = 'dashboard' | 'products' | 'orders' | 'order_detail' | 'profile';

function compressImageFileToDataUrl(file: File, maxDimension = 500, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Please select a valid image file.'));
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      try {
        const srcW = img.naturalWidth || img.width || maxDimension;
        const srcH = img.naturalHeight || img.height || maxDimension;
        const scale = Math.min(1, maxDimension / Math.max(srcW, srcH));
        const targetW = Math.max(1, Math.round(srcW * scale));
        const targetH = Math.max(1, Math.round(srcH * scale));

        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Unable to process image in this browser.'));
          return;
        }

        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, targetW, targetH);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, targetW, targetH);

        resolve(canvas.toDataURL('image/jpeg', quality));
      } catch (err) {
        reject(err instanceof Error ? err : new Error('Failed to compress image.'));
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Could not read the selected image file.'));
    };

    img.src = objectUrl;
  });
}

interface Props {
  currentUser: User | null;
  categories: Category[];
  products: Product[];
  onUserSignedIn: (user: User) => void;
  onRefresh: () => void;
  onExitSeller: () => void;
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

export const SellerView: React.FC<Props> = ({
  currentUser,
  categories,
  products,
  onUserSignedIn,
  onRefresh,
  onExitSeller,
  showLoader,
  hideLoader,
  showModal,
}) => {
  const [sellerProfile, setSellerProfile] = useState<SellerProfile | null>(() =>
    getSellerByEmailOrUidLocal(currentUser?.email, currentUser?.uid)
  );
  const [loadingProfile, setLoadingProfile] = useState<boolean>(Boolean(currentUser));
  const [sellerTab, setSellerTab] = useState<SellerTab>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sellerOrders, setSellerOrders] = useState<Order[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [trackingModalOrder, setTrackingModalOrder] = useState<Order | null>(null);
  const [orderStatusDraft, setOrderStatusDraft] = useState<OrderStatus>('Confirmed');
  const [trackingCourierDraft, setTrackingCourierDraft] = useState<string>('Delhivery');
  const [trackingIdDraft, setTrackingIdDraft] = useState<string>('');
  const [trackingUrlDraft, setTrackingUrlDraft] = useState<string>('');
  const [trackingNoteDraft, setTrackingNoteDraft] = useState<string>('');

  // Guest Seller Auth Form
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authName, setAuthName] = useState('');
  const [authPhone, setAuthPhone] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState('');

  // Seller Registration / KYC & Store Profile Form
  const [storeName, setStoreName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [sellerPhone, setSellerPhone] = useState('');
  const [pickupAddress, setPickupAddress] = useState('');
  const [pickupPincode, setPickupPincode] = useState('');
  const [gstOrPan, setGstOrPan] = useState('');
  const [payoutAccount, setPayoutAccount] = useState('');
  const [regError, setRegError] = useState('');

  // Product Modal State (Seller's own products only)
  const [prodModalOpen, setProdModalOpen] = useState(false);
  const [editingProd, setEditingProd] = useState<Product | null>(null);
  const [prodCatId, setProdCatId] = useState<number>(categories[0]?.id || 1);
  const [prodName, setProdName] = useState('');
  const [prodDesc, setProdDesc] = useState('');
  const [prodPrice, setProdPrice] = useState('');
  const [prodMrp, setProdMrp] = useState('');
  const [prodStock, setProdStock] = useState('15');
  const [prodImage, setProdImage] = useState(ASSETS.smartphone);
  const [imageCompressing, setImageCompressing] = useState(false);
  const [imageUploadError, setImageUploadError] = useState('');

  // Hydrate & live-sync seller profile whenever currentUser changes
  useEffect(() => {
    let active = true;
    if (!currentUser) {
      setSellerProfile(null);
      setLoadingProfile(false);
      return;
    }

    setLoadingProfile(true);
    setOwnerName(currentUser.name || '');
    setSellerPhone(currentUser.phone || '');
    setPickupAddress(currentUser.address || '');
    const pinFromAddr = (currentUser.address || '').match(/\b\d{6}\b/)?.[0] || '';
    setPickupPincode(pinFromAddr);

    const activeUid = currentUser.uid || auth.currentUser?.uid;
    const applyFoundProfile = (found: SellerProfile | null) => {
      if (!active) return;
      setSellerProfile(found);
      if (found) {
        setStoreName(found.storeName);
        setOwnerName(found.ownerName);
        setSellerPhone(found.phone);
        setPickupAddress(found.pickupAddress);
        const resolvedPin =
          found.pickupPincode || found.pickupAddress.match(/\b\d{6}\b/)?.[0] || '';
        setPickupPincode(resolvedPin);
        setGstOrPan(found.gstOrPan || '');
        setPayoutAccount(found.payoutAccount || '');
      }
    };

    getSellerProfileFirestore(activeUid, currentUser.email)
      .then((found) => {
        applyFoundProfile(found);
      })
      .finally(() => {
        if (active) setLoadingProfile(false);
      });

    const unsubProfile = subscribeSellerProfileFirestore(
      activeUid,
      currentUser.email,
      (liveFound) => {
        if (liveFound) {
          applyFoundProfile(liveFound);
        }
      }
    );

    return () => {
      active = false;
      unsubProfile();
    };
  }, [currentUser]);

  // Strict ownership check for seller's own products ONLY
  const isOwnProduct = (prod: Product, profile: SellerProfile | null): boolean => {
    if (!profile) return false;
    const sEmail = profile.email.trim().toLowerCase();
    const sId = (profile.uid || profile.id || '').trim();
    if (prod.sellerEmail && sEmail && prod.sellerEmail.trim().toLowerCase() === sEmail) return true;
    if (prod.sellerId && sId && prod.sellerId.trim() === sId) return true;
    return false;
  };

  const myProducts = useMemo(() => {
    if (!sellerProfile) return [];
    return products.filter((p) => isOwnProduct(p, sellerProfile));
  }, [products, sellerProfile]);

  const myProductIdsKey = useMemo(
    () =>
      myProducts
        .map((p) => p.id)
        .sort((a, b) => a - b)
        .join(','),
    [myProducts]
  );

  // Subscribe ONLY to orders containing this seller's own products
  useEffect(() => {
    if (!sellerProfile) {
      setSellerOrders([]);
      return;
    }

    const sellerId = sellerProfile.uid || sellerProfile.id;
    const sellerEmail = sellerProfile.email.trim().toLowerCase();
    const prodIds = myProductIdsKey ? myProductIdsKey.split(',').map(Number) : [];
    const prodIdSet = new Set(prodIds);

    const loadLocalFallbackOrders = () => {
      const localOrders = getBootstrapData().orders;
      const scoped: Order[] = [];
      localOrders.forEach((ord) => {
        const filtered = filterOrderForSeller(ord, sellerId, sellerEmail, prodIdSet);
        if (filtered) scoped.push(filtered);
      });
      scoped.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setSellerOrders(scoped);
    };

    const unsub = subscribeSellerOrdersFirestore(
      sellerId,
      sellerEmail,
      prodIds,
      (list) => {
        setSellerOrders(list);
      },
      () => {
        // Fallback to locally scoped orders if Firestore index or rules block the query
        loadLocalFallbackOrders();
      }
    );

    return () => {
      unsub();
    };
  }, [sellerProfile, myProductIdsKey]);

  // Guest seller login / signup via Firebase Auth
  const handleSellerAccountAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authBusy) return;
    const email = authEmail.trim();
    if (!email || !email.includes('@')) {
      setAuthError('Please enter a valid email address.');
      return;
    }
    if (authPassword.length < 6) {
      setAuthError('Password must be at least 6 characters.');
      return;
    }
    if (authMode === 'signup') {
      const digits = authPhone.replace(/\D/g, '');
      if (authName.trim().length < 2) {
        setAuthError('Please enter your full name.');
        return;
      }
      if (digits.length !== 10) {
        setAuthError('Please enter a valid 10-digit mobile number.');
        return;
      }
    }

    setAuthError('');
    setAuthBusy(true);
    showLoader(authMode === 'login' ? 'Signing in to Seller Hub...' : 'Creating Seller Account...');

    try {
      const cred =
        authMode === 'login'
          ? await signInWithEmailAndPassword(auth, email, authPassword)
          : await createUserWithEmailAndPassword(auth, email, authPassword);

      if (authMode === 'signup' && authName.trim()) {
        await updateProfile(cred.user, { displayName: authName.trim() }).catch(() => {});
      }

      const cleanDigits = authPhone.replace(/\D/g, '');
      const fsRes = await syncUserProfileFirestore({
        uid: cred.user.uid,
        name: authMode === 'signup' ? authName.trim() : cred.user.displayName || undefined,
        email: cred.user.email || email,
        phone: authMode === 'signup' ? cleanDigits : cred.user.phoneNumber || undefined,
      });

      if (!fsRes.success && fsRes.message.includes('suspended')) {
        setAuthError(fsRes.message);
        return;
      }

      const localRes = syncFirebaseCustomerLocal({
        uid: cred.user.uid,
        docId: cred.user.uid,
        name: fsRes.user?.name || (authMode === 'signup' ? authName.trim() : cred.user.displayName || undefined),
        email: cred.user.email || email,
        phone: fsRes.user?.phone || cleanDigits || cred.user.phoneNumber || undefined,
        address: fsRes.user?.address,
        role: fsRes.user?.role,
        isSeller: fsRes.user?.isSeller,
        sellerStoreName: fsRes.user?.sellerStoreName,
      });

      if (localRes.success && localRes.user) {
        setAuthPassword('');
        onUserSignedIn(localRes.user);
      } else {
        setAuthError(localRes.message || 'Unable to sign in.');
      }
    } catch (err) {
      setAuthError(getFirebaseAuthErrorMessage(err));
    } finally {
      hideLoader();
      setAuthBusy(false);
    }
  };

  const handleSellerGoogleSignIn = async () => {
    if (authBusy) return;
    setAuthError('');
    setAuthBusy(true);
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
      const localRes = syncFirebaseCustomerLocal({
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
      if (localRes.success && localRes.user) {
        onUserSignedIn(localRes.user);
      }
    } catch (err) {
      const code = (err as { code?: string } | null)?.code || '';
      if (
        code === 'auth/popup-blocked' ||
        code === 'auth/operation-not-supported-in-this-environment' ||
        code === 'auth/cancelled-popup-request'
      ) {
        try {
          await signInWithRedirect(auth, googleProvider);
          return;
        } catch (redirectErr) {
          setAuthError(getFirebaseAuthErrorMessage(redirectErr));
        }
      } else {
        setAuthError(getFirebaseAuthErrorMessage(err));
      }
    } finally {
      hideLoader();
      setAuthBusy(false);
    }
  };

  const handleSellerRegistrationOrUpdate = async (e: React.FormEvent, isProfileUpdate = false) => {
    e.preventDefault();
    if (!currentUser) return;
    setRegError('');
    showLoader(isProfileUpdate ? 'Saving store & KYC profile...' : 'Submitting seller KYC registration...');

    const res = await registerOrUpdateSellerFirestore({
      uid: currentUser.uid || auth.currentUser?.uid || String(currentUser.id),
      email: currentUser.email,
      storeName,
      ownerName,
      phone: sellerPhone,
      gstOrPan,
      pickupAddress,
      pickupPincode,
      payoutAccount,
    });

    hideLoader();
    if (res.success && res.seller) {
      const normalizedStatus = normalizeSellerStatus(res.seller.status);
      setSellerProfile({ ...res.seller, status: normalizedStatus });
      onRefresh();
      showModal({
        title: isProfileUpdate ? 'Store & KYC Updated' : 'Seller KYC Submitted',
        message: isProfileUpdate
          ? 'Your seller store, KYC, and Bank/UPI payout details have been updated.'
          : normalizedStatus === 'approved'
          ? `${res.seller.storeName} is approved and live! You can list your products now.`
          : `${res.seller.storeName} has been registered with status "Pending Approval". Once approved by Smart Basket Admin, your products will appear live on the storefront.`,
        type: 'success',
      });
    } else {
      setRegError(res.message);
    }
  };

  const handleRequestSellerPayout = (withdrawableBalance: number) => {
    if (!sellerProfile) return;
    const savedDestination = (sellerProfile.payoutAccount || payoutAccount || '').trim();
    if (savedDestination.length < 3) {
      showModal({
        title: 'Add Bank Account / UPI ID',
        message: 'Please save your Bank Account or UPI ID in Store Profile before requesting a payout.',
        type: 'info',
        confirmText: 'Go to Store Profile',
        onConfirm: () => setSellerTab('profile'),
      });
      return;
    }
    if (withdrawableBalance <= 0) {
      showModal({
        title: 'No Withdrawable Balance',
        message: 'Payouts are unlocked once customer orders for your products reach Delivered status (after 10% Smart Basket platform fee).',
        type: 'info',
      });
      return;
    }

    showModal({
      title: 'Confirm Payout Request',
      message: `Request withdrawal of ${formatINR(withdrawableBalance)} to "${savedDestination}"? Smart Basket Admin will review and transfer your payout.`,
      type: 'info',
      confirmText: 'Request Payout',
      onConfirm: async () => {
        showLoader('Recording payout request...');
        const res = await requestSellerPayoutFirestore(sellerProfile, withdrawableBalance, savedDestination);
        hideLoader();
        if (res.success && res.seller) {
          setSellerProfile({ ...res.seller, status: normalizeSellerStatus(res.seller.status) });
          onRefresh();
          showModal({
            title: 'Payout Requested',
            message: res.message,
            type: 'success',
          });
        } else {
          showModal({
            title: 'Payout Error',
            message: res.message,
            type: 'error',
          });
        }
      },
    });
  };

  const openProductModal = (prod?: Product) => {
    if (prod && !isOwnProduct(prod, sellerProfile)) {
      showModal({
        title: 'Access Denied',
        message: 'You can only edit your own listed products.',
        type: 'error',
      });
      return;
    }
    setEditingProd(prod || null);
    setProdCatId(prod ? prod.cat_id : categories[0]?.id || 1);
    setProdName(prod ? prod.name : '');
    setProdDesc(prod ? prod.description : '');
    setProdPrice(prod ? String(prod.price) : '');
    setProdMrp(prod ? String(getEffectiveMrp(prod.price, prod.mrp)) : '');
    setProdStock(prod ? String(prod.stock) : '15');
    setProdImage(prod ? prod.image : ASSETS.smartphone);
    setImageCompressing(false);
    setImageUploadError('');
    setProdModalOpen(true);
  };

  const handleProductPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImageUploadError('');
    setImageCompressing(true);
    try {
      const compressed = await compressImageFileToDataUrl(file, 500, 0.7);
      setProdImage(compressed);
    } catch (err) {
      setImageUploadError(err instanceof Error ? err.message : 'Unable to process image.');
    } finally {
      setImageCompressing(false);
    }
  };

  const handleSaveSellerProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sellerProfile) return;
    if (editingProd && !isOwnProduct(editingProd, sellerProfile)) {
      showModal({ title: 'Access Denied', message: 'You can only modify your own products.', type: 'error' });
      return;
    }

    const priceNum = Number(prodPrice);
    const mrpNum = Number(prodMrp);
    const stockNum = Math.max(0, Math.floor(Number(prodStock)));
    if (!prodName.trim() || !Number.isFinite(priceNum) || priceNum <= 0) {
      showModal({ title: 'Validation Error', message: 'Enter a valid product name and selling price.', type: 'error' });
      return;
    }

    const sellerId = sellerProfile.uid || sellerProfile.id;
    const sellerEmail = sellerProfile.email.trim().toLowerCase();
    const sellerName = sellerProfile.storeName;

    showLoader(editingProd ? 'Updating product...' : 'Publishing product...');
    const fsRes = await saveProductFirestore({
      id: editingProd?.id || 0,
      docId: editingProd?.docId,
      cat_id: prodCatId,
      name: prodName,
      description: prodDesc,
      price: priceNum,
      mrp: mrpNum > priceNum ? mrpNum : undefined,
      rating: editingProd?.rating,
      reviews: editingProd?.reviews,
      stock: stockNum,
      image: prodImage,
      created_at: editingProd?.created_at,
      sellerId,
      sellerEmail,
      sellerName,
    });

    if (!fsRes.success) {
      // Fallback to localStore if Firestore rules restrict direct product writes
      const localRes = saveProductLocal({
        id: editingProd?.id || 0,
        cat_id: prodCatId,
        name: prodName,
        description: prodDesc,
        price: priceNum,
        mrp: mrpNum > priceNum ? mrpNum : undefined,
        rating: editingProd?.rating,
        stock: stockNum,
        image: prodImage,
        sellerId,
        sellerEmail,
        sellerName,
      });
      hideLoader();
      if (localRes.success) {
        setProdModalOpen(false);
        onRefresh();
        showModal({ title: 'Saved', message: localRes.message, type: 'success' });
      } else {
        showModal({ title: 'Error', message: localRes.message, type: 'error' });
      }
      return;
    }

    hideLoader();
    setProdModalOpen(false);
    onRefresh();
    showModal({ title: 'Saved', message: fsRes.message, type: 'success' });
  };

  const handleDeleteSellerProduct = (prod: Product) => {
    if (!isOwnProduct(prod, sellerProfile)) {
      showModal({ title: 'Access Denied', message: 'You can only delete your own products.', type: 'error' });
      return;
    }
    showModal({
      title: 'Delete Your Product',
      message: `Remove "${prod.name}" from your seller catalog?`,
      type: 'error',
      confirmText: 'Delete',
      onConfirm: async () => {
        showLoader('Deleting product...');
        const fsRes = await deleteProductFirestore(prod);
        if (!fsRes.success) {
          deleteProductLocal(prod.id);
        }
        hideLoader();
        onRefresh();
      },
    });
  };

  const populateTrackingDrafts = (ord: Order) => {
    setOrderStatusDraft(normalizeOrderStatus(ord.status));
    setTrackingCourierDraft(ord.courierName || 'Delhivery');
    setTrackingIdDraft(ord.trackingId || '');
    setTrackingUrlDraft(ord.trackingUrl || '');
    setTrackingNoteDraft(ord.trackingNote || '');
  };

  const openTrackingModal = (ord: Order) => {
    populateTrackingDrafts(ord);
    setTrackingModalOrder(ord);
  };

  const handleSaveSellerOrderTracking = async (targetOrder: Order, e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      status: orderStatusDraft,
      courierName: trackingCourierDraft.trim(),
      trackingId: trackingIdDraft.trim(),
      trackingUrl: trackingUrlDraft.trim(),
      trackingNote: trackingNoteDraft.trim(),
    };
    showLoader('Updating order tracking...');
    const res = await updateOrderTrackingFirestore(targetOrder, payload);
    hideLoader();
    setSellerOrders((prev) =>
      prev.map((o) =>
        o.id === targetOrder.id
          ? {
              ...o,
              status: payload.status,
              courierName: payload.courierName || undefined,
              trackingId: payload.trackingId || undefined,
              trackingUrl: payload.trackingUrl || undefined,
              trackingNote: payload.trackingNote || undefined,
            }
          : o
      )
    );
    setTrackingModalOrder(null);
    onRefresh();
    showModal({
      title: res.success ? 'Tracking Updated' : 'Saved Locally',
      message: res.success
        ? res.message
        : `Order #${targetOrder.id} tracking saved locally (${res.message}).`,
      type: 'success',
    });
  };

  // STEP 1: Guest User -> Seller Hub Login / Sign Up
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#F1F3F6] flex flex-col">
        <header className="bg-[#2874F0] text-white shadow-sm">
          <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg font-extrabold italic tracking-tight">
                Smart <span className="text-[#FFE500]">Basket</span>
              </span>
              <span className="px-2 py-0.5 rounded bg-white/15 text-[11px] font-bold">Seller Hub</span>
            </div>
            <button
              type="button"
              onClick={onExitSeller}
              className="px-3 py-1.5 rounded-lg bg-white text-[#2874F0] text-xs font-bold hover:bg-blue-50"
            >
              <i className="fa-solid fa-store mr-1.5"></i>Storefront
            </button>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden">
            <div className="bg-gradient-to-r from-[#1854C6] to-[#2874F0] px-6 py-6 text-white">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-[#FFE500] text-[#2874F0] flex items-center justify-center shrink-0 shadow-xs">
                  <i className="fa-solid fa-store text-xl"></i>
                </div>
                <div>
                  <h1 className="text-lg font-extrabold">Smart Basket Seller Hub</h1>
                  <p className="text-xs text-blue-100 mt-0.5">
                    Sign in or create an account to list products &amp; track your store orders
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 border-b border-slate-200 bg-slate-50">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('login');
                  setAuthError('');
                }}
                className={`py-3 text-xs font-bold border-b-2 transition ${
                  authMode === 'login' ? 'bg-white text-[#2874F0] border-[#2874F0]' : 'text-slate-600 border-transparent'
                }`}
              >
                Seller Login
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('signup');
                  setAuthError('');
                }}
                className={`py-3 text-xs font-bold border-b-2 transition ${
                  authMode === 'signup' ? 'bg-white text-[#2874F0] border-[#2874F0]' : 'text-slate-600 border-transparent'
                }`}
              >
                New Seller Sign Up
              </button>
            </div>

            <div className="p-6">
              {authError && (
                <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-start gap-2">
                  <i className="fa-solid fa-circle-exclamation mt-0.5 shrink-0"></i>
                  <span>{authError}</span>
                </div>
              )}

              <form onSubmit={handleSellerAccountAuth} className="space-y-3.5">
                {authMode === 'signup' && (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                      <input
                        type="text"
                        value={authName}
                        onChange={(e) => setAuthName(e.target.value)}
                        required
                        placeholder="Your full name"
                        className="w-full h-11 px-3.5 rounded-lg bg-slate-50 border border-slate-300 text-sm focus:bg-white focus:border-[#2874F0] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Mobile Number</label>
                      <input
                        type="tel"
                        inputMode="numeric"
                        maxLength={10}
                        value={authPhone}
                        onChange={(e) => setAuthPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        required
                        placeholder="10-digit mobile number"
                        className="w-full h-11 px-3.5 rounded-lg bg-slate-50 border border-slate-300 text-sm focus:bg-white focus:border-[#2874F0] focus:outline-none"
                      />
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    required
                    placeholder="seller@example.com"
                    className="w-full h-11 px-3.5 rounded-lg bg-slate-50 border border-slate-300 text-sm focus:bg-white focus:border-[#2874F0] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
                  <input
                    type="password"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    required
                    minLength={6}
                    placeholder="Minimum 6 characters"
                    className="w-full h-11 px-3.5 rounded-lg bg-slate-50 border border-slate-300 text-sm focus:bg-white focus:border-[#2874F0] focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={authBusy}
                  className="w-full h-11 rounded-lg bg-[#FB641B] text-white text-sm font-bold hover:bg-[#e55812] disabled:opacity-60 transition"
                >
                  {authMode === 'login' ? 'Sign In to Seller Hub' : 'Create Account & Continue'}
                </button>
              </form>

              <div className="my-4 flex items-center gap-3">
                <div className="flex-1 h-px bg-slate-200" />
                <span className="text-[11px] font-bold uppercase text-slate-400">OR</span>
                <div className="flex-1 h-px bg-slate-200" />
              </div>

              <button
                type="button"
                disabled={authBusy}
                onClick={handleSellerGoogleSignIn}
                className="w-full h-11 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-sm font-bold text-slate-800 flex items-center justify-center gap-2"
              >
                <i className="fa-brands fa-google text-[#2874F0]"></i>
                <span>Continue with Google</span>
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Loading seller profile check
  if (loadingProfile) {
    return (
      <div className="min-h-screen bg-[#F1F3F6] flex items-center justify-center p-6">
        <div className="bg-white rounded-xl border border-slate-200 px-8 py-6 text-center shadow-sm">
          <i className="fa-solid fa-store text-2xl text-[#2874F0] animate-pulse"></i>
          <p className="mt-2 text-sm font-semibold text-slate-700">Loading your Seller Hub...</p>
        </div>
      </div>
    );
  }

  // STEP 2: Signed-in User -> Seller Registration & KYC Onboarding Form
  if (!sellerProfile) {
    return (
      <div className="min-h-screen bg-[#F1F3F6] flex flex-col">
        <header className="bg-[#2874F0] text-white shadow-sm">
          <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg font-extrabold italic tracking-tight">
                Smart <span className="text-[#FFE500]">Basket</span>
              </span>
              <span className="px-2 py-0.5 rounded bg-white/15 text-[11px] font-bold">Become a Seller</span>
            </div>
            <button
              type="button"
              onClick={onExitSeller}
              className="px-3 py-1.5 rounded-lg bg-white text-[#2874F0] text-xs font-bold hover:bg-blue-50"
            >
              <i className="fa-solid fa-arrow-left mr-1.5"></i>Storefront
            </button>
          </div>
        </header>

        <main className="max-w-xl w-full mx-auto px-4 py-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-[#1854C6] to-[#2874F0] px-6 py-5 text-white">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-[#FFE500] text-[#2874F0] flex items-center justify-center shrink-0">
                  <i className="fa-solid fa-store text-lg"></i>
                </div>
                <div>
                  <h1 className="text-lg font-extrabold">Seller Registration &amp; KYC Onboarding</h1>
                  <p className="text-xs text-blue-100 mt-0.5">
                    Complete your store KYC &amp; payout details to start selling on Smart Basket.
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={(e) => handleSellerRegistrationOrUpdate(e, false)} className="p-6 space-y-4">
              {regError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-start gap-2">
                  <i className="fa-solid fa-circle-exclamation mt-0.5 shrink-0"></i>
                  <span>{regError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Store / Business Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  required
                  placeholder="e.g. Amina Fashion & Accessories"
                  className="w-full h-11 px-3.5 rounded-lg bg-slate-50 border border-slate-300 text-sm focus:bg-white focus:border-[#2874F0] focus:outline-none"
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Owner Full Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    required
                    placeholder="Full legal name"
                    className="w-full h-11 px-3.5 rounded-lg bg-slate-50 border border-slate-300 text-sm focus:bg-white focus:border-[#2874F0] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Mobile Number <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    value={sellerPhone}
                    onChange={(e) => setSellerPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    required
                    placeholder="10-digit mobile number"
                    className="w-full h-11 px-3.5 rounded-lg bg-slate-50 border border-slate-300 text-sm focus:bg-white focus:border-[#2874F0] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Verified Account Email</label>
                <input
                  type="email"
                  value={currentUser.email}
                  readOnly
                  className="w-full h-11 px-3.5 rounded-lg bg-slate-100 border border-slate-200 text-sm text-slate-600 cursor-not-allowed"
                />
              </div>

              <div className="grid sm:grid-cols-3 gap-3.5">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Pickup Address <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={2}
                    value={pickupAddress}
                    onChange={(e) => setPickupAddress(e.target.value)}
                    required
                    placeholder="Shop / Warehouse street, Area, City, State"
                    className="w-full p-3 rounded-lg bg-slate-50 border border-slate-300 text-sm focus:bg-white focus:border-[#2874F0] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Pickup Pincode <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={6}
                    value={pickupPincode}
                    onChange={(e) => setPickupPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    required
                    placeholder="6-digit PIN"
                    className="w-full h-11 px-3.5 rounded-lg bg-slate-50 border border-slate-300 text-sm font-mono focus:bg-white focus:border-[#2874F0] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    GSTIN <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={gstOrPan}
                    onChange={(e) => setGstOrPan(e.target.value.toUpperCase())}
                    placeholder="e.g. 07ABCDE1234F1Z5"
                    className="w-full h-11 px-3.5 rounded-lg bg-slate-50 border border-slate-300 text-sm font-mono uppercase focus:bg-white focus:border-[#2874F0] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Bank Account / UPI ID <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={payoutAccount}
                    onChange={(e) => setPayoutAccount(e.target.value)}
                    required
                    placeholder="e.g. store@upi or A/C & IFSC"
                    className="w-full h-11 px-3.5 rounded-lg bg-slate-50 border border-slate-300 text-sm focus:bg-white focus:border-[#2874F0] focus:outline-none"
                  />
                </div>
              </div>

              <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 flex items-start gap-2.5 text-[11px] text-amber-900">
                <i className="fa-solid fa-shield-halved text-amber-600 mt-0.5 shrink-0"></i>
                <p className="leading-relaxed">
                  New seller registrations are created with <strong>Pending Approval</strong> status until verified by the Smart Basket Admin. Sales payouts are settled directly to your saved Bank Account / UPI ID after a 10% platform fee.
                </p>
              </div>

              <button
                type="submit"
                className="w-full h-12 rounded-lg bg-[#FB641B] text-white text-sm font-bold hover:bg-[#e55812] transition flex items-center justify-center gap-2"
              >
                <i className="fa-solid fa-store"></i>
                <span>Submit Seller Registration &amp; KYC</span>
              </button>
            </form>
          </div>
        </main>
      </div>
    );
  }

  // STEP 3: Active Seller Dashboard (Strictly Isolated to Seller's Own Products & Orders)
  const sellerApprovalStatus = normalizeSellerStatus(sellerProfile.status);
  const myRevenue = sellerOrders
    .filter((o) => o.status !== 'Cancelled' && o.status !== 'Refunded')
    .reduce((sum, o) => sum + o.total_amount, 0);
  const deliveredOrders = sellerOrders.filter((o) => o.status === 'Delivered');
  const deliveredSales = deliveredOrders.reduce((sum, o) => sum + o.total_amount, 0);
  const earnings = calculateSellerEarnings(deliveredSales, sellerProfile);
  const myTotalStock = myProducts.reduce((sum, p) => sum + p.stock, 0);
  const activeOrder = sellerOrders.find((o) => o.id === selectedOrderId) || null;

  return (
    <div className="min-h-screen bg-[#F1F3F6] pb-20 md:pb-10">
      {/* Seller Top Header */}
      <header className="sticky top-0 z-40 bg-[#2874F0] text-white shadow-sm">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 h-14 flex items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open seller menu"
              className="w-10 h-10 -ml-1 rounded-xl flex items-center justify-center text-white hover:bg-white/10 shrink-0"
            >
              <i className="fa-solid fa-bars text-lg"></i>
            </button>
            <button
              type="button"
              onClick={() => setSellerTab('dashboard')}
              className="flex items-center gap-2 whitespace-nowrap min-w-0"
            >
              <span className="text-base sm:text-lg font-extrabold tracking-tight italic">
                Smart <span className="text-[#FFE500]">Basket</span>
              </span>
              <span className="px-2 py-0.5 rounded bg-white/15 text-[10px] sm:text-[11px] font-bold text-[#FFE500]">
                Seller Hub
              </span>
            </button>
          </div>

          <nav className="hidden lg:flex items-center gap-5 text-xs font-semibold text-blue-100">
            {(
              [
                { id: 'dashboard', label: 'Dashboard' },
                { id: 'products', label: 'My Products' },
                { id: 'orders', label: 'My Orders' },
                { id: 'profile', label: 'Store Profile' },
              ] as { id: SellerTab; label: string }[]
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSellerTab(t.id)}
                className={`whitespace-nowrap transition ${sellerTab === t.id ? 'text-[#FFE500] font-bold' : 'hover:text-white'}`}
              >
                {t.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-lg bg-white/15">
              <span className="w-7 h-7 rounded-full bg-[#FFE500] text-[#2874F0] text-xs font-extrabold flex items-center justify-center shrink-0">
                {sellerProfile.storeName.charAt(0).toUpperCase()}
              </span>
              <div className="leading-tight max-w-[140px]">
                <p className="text-xs font-bold text-white truncate">{sellerProfile.storeName}</p>
                <span className="text-[9px] font-bold uppercase text-blue-100">
                  {sellerApprovalStatus === 'approved'
                    ? 'Approved Seller'
                    : sellerApprovalStatus === 'blocked'
                    ? 'Blocked'
                    : 'Pending Approval'}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={onExitSeller}
              className="px-2.5 sm:px-3.5 py-2 rounded-lg bg-white text-[#2874F0] text-xs font-bold hover:bg-blue-50 whitespace-nowrap"
            >
              <i className="fa-solid fa-store sm:mr-1.5"></i>
              <span className="hidden sm:inline">Storefront</span>
            </button>
          </div>
        </div>
      </header>

      {/* Seller Sliding Drawer */}
      {sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs" />
      )}
      <aside
        className={`fixed top-0 left-0 bottom-0 z-50 w-72 bg-white text-slate-900 border-r border-slate-200 shadow-2xl transform transition-transform duration-200 flex flex-col ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="px-5 py-4 bg-[#2874F0] text-white flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-[#FFE500] text-[#2874F0] font-extrabold text-sm flex items-center justify-center shrink-0">
              {sellerProfile.storeName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-extrabold text-white truncate">{sellerProfile.storeName}</p>
              <p className="text-[11px] text-blue-100 truncate mt-0.5">{sellerProfile.email}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white hover:bg-white/10 shrink-0"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {(
            [
              { id: 'dashboard', label: 'Seller Dashboard', icon: 'fa-chart-line' },
              { id: 'products', label: 'My Products', icon: 'fa-boxes-stacked' },
              { id: 'orders', label: 'My Orders', icon: 'fa-bag-shopping' },
              { id: 'profile', label: 'Store Profile', icon: 'fa-store' },
            ] as { id: SellerTab; label: string; icon: string }[]
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setSellerTab(item.id);
                setSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium ${
                sellerTab === item.id ? 'bg-blue-50 text-[#2874F0] font-bold' : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <i className={`fa-solid ${item.icon} w-5 text-center`}></i>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-100 space-y-2">
          <button
            type="button"
            onClick={() => {
              setSidebarOpen(false);
              onExitSeller();
            }}
            className="w-full py-2.5 rounded-xl bg-blue-50 text-[#2874F0] text-sm font-bold hover:bg-blue-100"
          >
            <i className="fa-solid fa-arrow-left mr-2"></i>Back to Storefront
          </button>
          <button
            type="button"
            onClick={() => {
              setStoredCurrentSeller(null);
              setSidebarOpen(false);
              onExitSeller();
            }}
            className="w-full py-2.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-200"
          >
            Close Seller Session
          </button>
        </div>
      </aside>

      <main className="max-w-6xl mx-auto px-4 py-5 space-y-6">
        {/* Seller Approval Status Notice */}
        <div
          className={`rounded-xl border p-3.5 sm:p-4 flex items-start gap-3 ${
            sellerApprovalStatus === 'approved'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : sellerApprovalStatus === 'blocked'
              ? 'bg-rose-50 border-rose-200 text-rose-900'
              : 'bg-amber-50 border-amber-200 text-amber-900'
          }`}
        >
          <i
            className={`fa-solid mt-0.5 text-base shrink-0 ${
              sellerApprovalStatus === 'approved'
                ? 'fa-circle-check text-[#2E7D32]'
                : sellerApprovalStatus === 'blocked'
                ? 'fa-ban text-rose-600'
                : 'fa-clock text-amber-600'
            }`}
          ></i>
          <div className="text-xs leading-relaxed">
            <p className="font-extrabold">
              {sellerApprovalStatus === 'approved'
                ? 'Store Approved & Live'
                : sellerApprovalStatus === 'blocked'
                ? 'Seller Account Blocked by Admin'
                : 'Pending Admin Approval'}
            </p>
            <p className="mt-0.5 opacity-90">
              {sellerApprovalStatus === 'approved'
                ? 'Your store is approved. All products you publish appear live on the Smart Basket storefront.'
                : sellerApprovalStatus === 'blocked'
                ? 'Your store is currently blocked by the Admin. Your products are hidden from public shoppers until re-approved.'
                : 'Your seller profile is awaiting approval from Smart Basket Admin. You can add and edit your products now — they will go live on the storefront as soon as approved.'}
            </p>
          </div>
        </div>

        {/* SELLER DASHBOARD */}
        {sellerTab === 'dashboard' && (
          <>
            <div className="bg-white rounded-xl border border-slate-200/80 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-12 h-12 rounded-full bg-[#2874F0] text-[#FFE500] font-extrabold text-lg flex items-center justify-center shrink-0">
                  {sellerProfile.storeName.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-base sm:text-lg font-extrabold text-slate-900 truncate">
                      {sellerProfile.storeName}
                    </h1>
                    <span
                      className={`px-2 py-0.5 rounded-sm text-[10px] font-extrabold uppercase tracking-wide border ${
                        sellerApprovalStatus === 'approved'
                          ? 'bg-emerald-50 text-[#388E3C] border-emerald-200'
                          : sellerApprovalStatus === 'blocked'
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : 'bg-amber-50 text-amber-800 border-amber-200'
                      }`}
                    >
                      {sellerApprovalStatus === 'approved'
                        ? 'Approved Seller'
                        : sellerApprovalStatus === 'blocked'
                        ? 'Blocked'
                        : 'Pending Approval'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">
                    {sellerProfile.ownerName} · {sellerProfile.email}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSellerTab('products');
                  openProductModal();
                }}
                className="px-4 py-2.5 rounded-lg bg-[#FB641B] text-white text-xs font-bold hover:bg-[#e55812] transition shrink-0"
              >
                <i className="fa-solid fa-plus mr-1.5"></i>Add New Product
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 sm:gap-4">
              {[
                { label: 'My Products', value: myProducts.length, icon: 'fa-boxes-stacked', color: 'bg-blue-50 text-[#2874F0]' },
                { label: 'Total Stock', value: myTotalStock, icon: 'fa-cubes', color: 'bg-indigo-50 text-indigo-600' },
                { label: 'My Orders', value: sellerOrders.length, icon: 'fa-bag-shopping', color: 'bg-amber-50 text-amber-600' },
                { label: 'Total Sales', value: formatINR(myRevenue), icon: 'fa-indian-rupee-sign', color: 'bg-emerald-50 text-[#388E3C]' },
              ].map((stat) => (
                <div key={stat.label} className="bg-white rounded-xl border border-slate-200/80 p-4 flex items-center gap-3">
                  <span className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${stat.color}`}>
                    <i className={`fa-solid ${stat.icon} text-lg`}></i>
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-500">{stat.label}</p>
                    <p className="text-base sm:text-xl font-extrabold text-slate-900 font-mono tabular-nums truncate">
                      {stat.value}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Earnings, Commission (10%) & Payout Card */}
            <section className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 bg-slate-50/70">
                <div className="flex items-center gap-2.5">
                  <span className="w-9 h-9 rounded-xl bg-emerald-100 text-[#2E7D32] flex items-center justify-center shrink-0">
                    <i className="fa-solid fa-wallet text-base"></i>
                  </span>
                  <div>
                    <h2 className="text-sm sm:text-base font-extrabold text-slate-900">Earnings &amp; Payout Summary</h2>
                    <p className="text-[11px] text-slate-500">
                      Calculated from {deliveredOrders.length} delivered order{deliveredOrders.length === 1 ? '' : 's'} · 10% Smart Basket platform fee
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500 font-medium">Payout UPI/Bank:</span>
                  <span className="font-mono font-bold text-slate-800 bg-white border border-slate-200 px-2.5 py-1 rounded-lg max-w-[200px] truncate">
                    {sellerProfile.payoutAccount || 'Not set'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSellerTab('profile')}
                    className="text-[#2874F0] font-bold hover:underline"
                  >
                    Edit
                  </button>
                </div>
              </div>

              <div className="p-5 space-y-4">
                <div className="grid sm:grid-cols-3 gap-3.5">
                  <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-4">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                      Total Delivered Sales
                    </p>
                    <p className="mt-1.5 text-xl sm:text-2xl font-extrabold text-slate-900 font-mono tabular-nums">
                      {formatINR(earnings.grossDelivered)}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {deliveredOrders.length} completed deliver{deliveredOrders.length === 1 ? 'y' : 'ies'}
                    </p>
                  </div>

                  <div className="rounded-xl bg-rose-50/70 border border-rose-200/80 p-4">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-rose-700">
                      Smart Basket Platform Fee (10%)
                    </p>
                    <p className="mt-1.5 text-xl sm:text-2xl font-extrabold text-rose-700 font-mono tabular-nums">
                      -{formatINR(earnings.platformFee)}
                    </p>
                    <p className="mt-1 text-[11px] text-rose-600/90">
                      Marketplace &amp; payment processing fee
                    </p>
                  </div>

                  <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-[#1B5E20]">
                      Net Seller Earnings / Withdrawable Balance
                    </p>
                    <p className="mt-1.5 text-xl sm:text-2xl font-extrabold text-[#2E7D32] font-mono tabular-nums">
                      {formatINR(earnings.withdrawableBalance)}
                    </p>
                    <p className="mt-1 text-[11px] text-emerald-800">
                      Net Earned: <strong className="font-mono">{formatINR(earnings.netEarnings)}</strong>
                      {earnings.totalPaidOut > 0 ? ` · Paid: ${formatINR(earnings.totalPaidOut)}` : ''}
                    </p>
                  </div>
                </div>

                {earnings.pendingPayout > 0 && (
                  <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-950">
                    <div className="flex items-center gap-2">
                      <i className="fa-solid fa-clock text-amber-600"></i>
                      <span>
                        <strong>Pending Payout Request:</strong>{' '}
                        <span className="font-mono font-extrabold">{formatINR(earnings.pendingPayout)}</span>{' '}
                        awaiting transfer to <strong className="font-mono">{sellerProfile.payoutAccount || 'your UPI/Bank'}</strong>
                      </span>
                    </div>
                    {sellerProfile.payoutRequestedAt && (
                      <span className="text-[11px] text-amber-800">
                        Requested {new Date(sellerProfile.payoutRequestedAt).toLocaleDateString('en-IN')}
                      </span>
                    )}
                  </div>
                )}

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                  <div className="text-xs text-slate-500">
                    {earnings.totalPaidOut > 0 ? (
                      <span className="inline-flex items-center gap-1.5 font-semibold text-[#2E7D32]">
                        <i className="fa-solid fa-circle-check"></i>
                        <span>
                          Total Settled Payouts: <strong className="font-mono">{formatINR(earnings.totalPaidOut)}</strong>
                          {sellerProfile.lastPayoutPaidAt
                            ? ` (Last paid ${new Date(sellerProfile.lastPayoutPaidAt).toLocaleDateString('en-IN')})`
                            : ''}
                        </span>
                      </span>
                    ) : (
                      <span>
                        Delivered earnings are available for direct bank/UPI withdrawal via Smart Basket Admin.
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRequestSellerPayout(earnings.withdrawableBalance)}
                    disabled={earnings.withdrawableBalance <= 0}
                    className="px-5 py-2.5 rounded-xl bg-[#2E7D32] text-white text-xs sm:text-sm font-extrabold hover:bg-emerald-800 disabled:bg-slate-200 disabled:text-slate-500 disabled:cursor-not-allowed transition inline-flex items-center justify-center gap-2 shrink-0"
                  >
                    <i className="fa-solid fa-building-columns"></i>
                    <span>
                      {earnings.withdrawableBalance > 0
                        ? `Request Payout (${formatINR(earnings.withdrawableBalance)})`
                        : earnings.pendingPayout > 0
                        ? 'Payout Requested (Pending Admin)'
                        : 'Request Payout'}
                    </span>
                  </button>
                </div>

                {sellerProfile.payoutHistory && sellerProfile.payoutHistory.length > 0 && (
                  <div className="pt-3 border-t border-slate-100">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-2">
                      Recent Payout Requests
                    </p>
                    <div className="divide-y divide-slate-100 rounded-xl border border-slate-100 bg-slate-50/50">
                      {sellerProfile.payoutHistory.slice(0, 4).map((rec) => (
                        <div key={rec.id} className="px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs">
                          <div className="min-w-0">
                            <p className="font-bold text-slate-800 truncate">
                              <span className="font-mono">{formatINR(rec.amount)}</span> →{' '}
                              <span className="font-mono text-slate-600">{rec.payoutAccount}</span>
                            </p>
                            <p className="text-[10px] text-slate-500">
                              Requested {new Date(rec.requestedAt).toLocaleDateString('en-IN')}
                              {rec.paidAt ? ` · Paid ${new Date(rec.paidAt).toLocaleDateString('en-IN')}` : ''}
                            </p>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase shrink-0 ${
                              rec.status === 'paid'
                                ? 'bg-emerald-100 text-[#2E7D32]'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {rec.status === 'paid' ? 'Paid' : 'Pending'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>

            <div>
              <h2 className="text-sm font-bold text-slate-800 mb-3">Quick Seller Actions</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setSellerTab('products');
                    openProductModal();
                  }}
                  className="p-4 rounded-xl bg-[#2874F0] text-white hover:bg-[#1e60d5] transition flex items-center gap-3"
                >
                  <i className="fa-solid fa-plus-circle text-lg text-[#FFE500]"></i>
                  <span className="text-xs font-bold">Add Product</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSellerTab('products')}
                  className="p-4 rounded-xl bg-white border border-slate-200 text-slate-800 hover:border-[#2874F0] transition flex items-center gap-3"
                >
                  <i className="fa-solid fa-boxes-stacked text-[#2874F0] text-lg"></i>
                  <span className="text-xs font-bold">My Catalog</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSellerTab('orders')}
                  className="p-4 rounded-xl bg-white border border-slate-200 text-slate-800 hover:border-[#2874F0] transition flex items-center gap-3"
                >
                  <i className="fa-solid fa-receipt text-[#FB641B] text-lg"></i>
                  <span className="text-xs font-bold">My Orders</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSellerTab('profile')}
                  className="p-4 rounded-xl bg-white border border-slate-200 text-slate-800 hover:border-[#2874F0] transition flex items-center gap-3"
                >
                  <i className="fa-solid fa-store text-[#388E3C] text-lg"></i>
                  <span className="text-xs font-bold">Store Profile</span>
                </button>
              </div>
            </div>
          </>
        )}

        {/* MY PRODUCTS (Strictly filtered to seller's own products) */}
        {sellerTab === 'products' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h1 className="text-xl font-extrabold text-slate-900">My Products ({myProducts.length})</h1>
                <p className="text-xs text-slate-500">Only products listed by {sellerProfile.storeName} are shown here.</p>
              </div>
              <button
                type="button"
                onClick={() => openProductModal()}
                className="px-4 py-2.5 rounded-lg bg-[#FB641B] text-white text-xs font-bold hover:bg-[#e55812] transition shrink-0"
              >
                <i className="fa-solid fa-plus mr-1.5"></i>Add Product
              </button>
            </div>

            {myProducts.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-10 text-center space-y-3">
                <div className="w-14 h-14 rounded-full bg-blue-50 text-[#2874F0] flex items-center justify-center mx-auto">
                  <i className="fa-solid fa-box-open text-2xl"></i>
                </div>
                <h2 className="text-base font-bold text-slate-900">No products listed yet</h2>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Add your first product to make it live on Smart Basket and start receiving customer orders.
                </p>
                <button
                  type="button"
                  onClick={() => openProductModal()}
                  className="px-5 py-2.5 rounded-lg bg-[#FB641B] text-white text-xs font-bold hover:bg-[#e55812] transition"
                >
                  <i className="fa-solid fa-plus mr-1.5"></i>Add First Product
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {myProducts.map((prod) => (
                  <div key={prod.docId || prod.id} className="bg-white rounded-xl border border-slate-200/80 p-4 flex gap-3.5 items-center">
                    <img
                      src={prod.image}
                      alt={prod.name}
                      referrerPolicy="no-referrer"
                      className="w-20 h-20 rounded-lg object-cover bg-slate-100 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-medium text-slate-500 truncate">
                        {categories.find((c) => c.id === prod.cat_id)?.name || 'General'}
                      </p>
                      <h3 className="text-sm font-bold text-slate-900 truncate">{prod.name}</h3>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-extrabold text-slate-900 font-mono tabular-nums">{formatINR(prod.price)}</span>
                        {prod.stock <= 0 ? (
                          <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-700 text-[10px] font-extrabold uppercase">
                            Out of Stock
                          </span>
                        ) : prod.stock <= 5 ? (
                          <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-extrabold">
                            Low Stock: {prod.stock}
                          </span>
                        ) : (
                          <span className="font-semibold text-[#388E3C]">Stock: {prod.stock}</span>
                        )}
                      </div>
                      <div className="mt-2.5 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openProductModal(prod)}
                          className="px-3 py-1.5 rounded-lg bg-blue-50 text-[#2874F0] text-xs font-bold hover:bg-blue-100"
                        >
                          <i className="fa-solid fa-pen mr-1"></i>Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteSellerProduct(prod)}
                          className="px-3 py-1.5 rounded-lg bg-rose-50 text-rose-600 text-xs font-bold hover:bg-rose-100"
                        >
                          <i className="fa-solid fa-trash mr-1"></i>Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* MY ORDERS (Strictly filtered to orders containing seller's own items) */}
        {sellerTab === 'orders' && (
          <div className="space-y-5">
            <div>
              <h1 className="text-xl font-extrabold text-slate-900">My Store Orders ({sellerOrders.length})</h1>
              <p className="text-xs text-slate-500">
                Showing only orders containing your listed products and your store subtotal.
              </p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="py-3 px-4">Order ID</th>
                      <th className="py-3 px-4">Customer</th>
                      <th className="py-3 px-4">My Payout</th>
                      <th className="py-3 px-4">Status &amp; Courier</th>
                      <th className="py-3 px-4 text-right">Tracking</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {sellerOrders.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-10 text-center text-xs text-slate-500">
                          No customer orders for your products yet.
                        </td>
                      </tr>
                    ) : (
                      sellerOrders.map((ord) => (
                        <tr
                          key={ord.docId || ord.id}
                          onClick={() => {
                            setSelectedOrderId(ord.id);
                            populateTrackingDrafts(ord);
                            setSellerTab('order_detail');
                          }}
                          className="hover:bg-slate-50 cursor-pointer transition"
                        >
                          <td className="py-3.5 px-4 font-mono font-bold text-slate-900 tabular-nums">
                            <div>#{ord.id}</div>
                            <div className="text-[10px] font-sans font-normal text-slate-400">
                              {new Date(ord.created_at).toLocaleDateString('en-IN')} ·{' '}
                              {ord.items.reduce((acc, it) => acc + it.quantity, 0)} item(s)
                            </div>
                          </td>
                          <td className="py-3.5 px-4 font-semibold text-slate-800">{ord.name}</td>
                          <td className="py-3.5 px-4 font-mono font-bold text-[#388E3C] tabular-nums">
                            {formatINR(ord.total_amount)}
                          </td>
                          <td className="py-3 px-4 text-xs">
                            <span className="font-bold text-[#2874F0] block">
                              {getOrderStatusLabel(ord.status)}
                            </span>
                            {(ord.courierName || ord.trackingId) && (
                              <span className="text-[11px] text-slate-500 font-mono block truncate max-w-[180px]">
                                {ord.courierName || 'Courier'}
                                {ord.trackingId ? ` · ${ord.trackingId}` : ''}
                              </span>
                            )}
                          </td>
                          <td
                            className="py-2.5 px-4 text-right"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => openTrackingModal(ord)}
                              className="px-3 py-1.5 rounded-lg bg-[#2874F0] text-white text-xs font-bold hover:bg-[#1e60d5] transition whitespace-nowrap inline-flex items-center gap-1.5"
                            >
                              <i className="fa-solid fa-truck-fast text-[11px]"></i>
                              <span>Update Tracking</span>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* SELLER ORDER DETAIL (Seller's items only) */}
        {sellerTab === 'order_detail' && activeOrder && (
          <div className="space-y-5 max-w-4xl">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSellerTab('orders')}
                className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-slate-50"
              >
                <i className="fa-solid fa-arrow-left text-xs"></i>
              </button>
              <div>
                <h1 className="text-xl font-extrabold text-slate-900 font-mono">Order #{activeOrder.id}</h1>
                <p className="text-xs text-slate-500">
                  {new Date(activeOrder.created_at).toLocaleString('en-IN')} · Status:{' '}
                  <strong className="text-[#2874F0]">{getOrderStatusLabel(activeOrder.status)}</strong>
                </p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-white rounded-xl border border-slate-200/80 p-5 space-y-2.5">
                <h2 className="text-xs font-bold text-slate-500 uppercase">Shipping Details</h2>
                <p className="text-sm font-bold text-slate-900">{activeOrder.name}</p>
                <p className="text-xs text-slate-600">
                  <i className="fa-solid fa-phone mr-1.5"></i>
                  {activeOrder.phone}
                </p>
                <p className="text-xs text-slate-600">
                  <i className="fa-solid fa-location-dot mr-1.5"></i>
                  {activeOrder.address}
                </p>
                <p className="text-xs text-slate-600">
                  <i className="fa-solid fa-wallet mr-1.5"></i>
                  {activeOrder.paymentMethod || 'Cash on Delivery'}
                </p>
                {(activeOrder.courierName || activeOrder.trackingId || activeOrder.trackingNote) && (
                  <div className="pt-2.5 mt-2 border-t border-slate-100 space-y-1 text-xs">
                    <p className="font-bold text-slate-800">
                      <i className="fa-solid fa-truck-fast text-[#2874F0] mr-1.5"></i>
                      {activeOrder.courierName || 'Courier'}
                      {activeOrder.trackingId ? ` · AWB: ${activeOrder.trackingId}` : ''}
                    </p>
                    {activeOrder.trackingNote && (
                      <p className="text-emerald-700 font-medium">{activeOrder.trackingNote}</p>
                    )}
                    {getCourierTrackingUrl(activeOrder.courierName, activeOrder.trackingId, activeOrder.trackingUrl) && (
                      <a
                        href={getCourierTrackingUrl(activeOrder.courierName, activeOrder.trackingId, activeOrder.trackingUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[#2874F0] font-bold hover:underline"
                      >
                        <span>Open Live Courier Link</span>
                        <i className="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>
                      </a>
                    )}
                  </div>
                )}
              </div>

              <form
                onSubmit={(e) => handleSaveSellerOrderTracking(activeOrder, e)}
                className="bg-white rounded-xl border border-slate-200/80 p-5 space-y-3"
              >
                <h2 className="text-xs font-bold text-slate-500 uppercase">Update Tracking</h2>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Order Status</label>
                  <select
                    value={orderStatusDraft}
                    onChange={(e) => setOrderStatusDraft(e.target.value as OrderStatus)}
                    className="w-full h-10 px-3 rounded-lg bg-slate-50 border border-slate-200 text-sm font-semibold text-slate-900"
                  >
                    {ORDER_STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Courier Partner</label>
                    <select
                      value={trackingCourierDraft}
                      onChange={(e) => setTrackingCourierDraft(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-900"
                    >
                      {COURIER_PARTNERS.map((partner) => (
                        <option key={partner} value={partner}>
                          {partner}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">AWB / Tracking No.</label>
                    <input
                      type="text"
                      value={trackingIdDraft}
                      onChange={(e) => setTrackingIdDraft(e.target.value)}
                      placeholder="e.g. DLV948271630IN"
                      className="w-full h-10 px-3 rounded-lg bg-slate-50 border border-slate-200 text-xs font-mono text-slate-900"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Live Location / Hub Note</label>
                  <input
                    type="text"
                    value={trackingNoteDraft}
                    onChange={(e) => setTrackingNoteDraft(e.target.value)}
                    placeholder="e.g. Dispatched from Bawana Warehouse, Delhi"
                    className="w-full h-10 px-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Custom Tracking URL <span className="text-slate-400 font-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={trackingUrlDraft}
                    onChange={(e) => setTrackingUrlDraft(e.target.value)}
                    placeholder="https://..."
                    className="w-full h-9 px-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-900"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full h-10 rounded-lg bg-[#2874F0] text-white text-sm font-bold hover:bg-[#1e60d5] transition"
                >
                  Save Tracking Update
                </button>
              </form>
            </div>

            <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900">Your Store Items in This Order</h2>
                <span className="text-sm font-extrabold font-mono text-[#388E3C] tabular-nums">
                  {formatINR(activeOrder.total_amount)}
                </span>
              </div>
              <div className="divide-y divide-slate-100">
                {activeOrder.items.map((it) => (
                  <div key={it.id} className="p-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={it.product_image}
                        alt={it.product_name}
                        referrerPolicy="no-referrer"
                        className="w-12 h-12 rounded-lg object-cover bg-slate-100 shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900 truncate">{it.product_name}</p>
                        <p className="text-xs text-slate-500 font-mono">
                          {formatINR(it.price)} × {it.quantity}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-extrabold font-mono tabular-nums shrink-0">
                      {formatINR(it.price * it.quantity)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* SELLER STORE PROFILE & KYC */}
        {sellerTab === 'profile' && (
          <div className="max-w-lg">
            <form
              onSubmit={(e) => handleSellerRegistrationOrUpdate(e, true)}
              className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4"
            >
              <div>
                <h1 className="text-lg font-extrabold text-slate-900">Store Profile &amp; KYC Details</h1>
                <p className="text-xs text-slate-500">
                  Manage your store details, pickup address &amp; pincode, GSTIN, and Bank/UPI payout ID.
                </p>
              </div>
              {regError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                  {regError}
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Store / Business Name</label>
                <input
                  type="text"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  required
                  className="w-full h-11 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Owner Full Name</label>
                <input
                  type="text"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  required
                  className="w-full h-11 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Seller Email</label>
                <input
                  type="email"
                  value={sellerProfile.email}
                  readOnly
                  className="w-full h-11 px-3.5 rounded-xl bg-slate-100 border border-slate-200 text-sm text-slate-500 cursor-not-allowed"
                />
              </div>
              <div className="grid sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Mobile Number</label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    value={sellerPhone}
                    onChange={(e) => setSellerPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    required
                    className="w-full h-11 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Pickup Pincode</label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={6}
                    value={pickupPincode}
                    onChange={(e) => setPickupPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    required
                    placeholder="6-digit pincode"
                    className="w-full h-11 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Pickup Address</label>
                <textarea
                  rows={2}
                  value={pickupAddress}
                  onChange={(e) => setPickupAddress(e.target.value)}
                  required
                  className="w-full p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Bank Account / UPI ID <span className="text-slate-400 font-normal">(for payouts)</span>
                </label>
                <input
                  type="text"
                  value={payoutAccount}
                  onChange={(e) => setPayoutAccount(e.target.value)}
                  required
                  placeholder="e.g. yourstore@upi or A/C & IFSC"
                  className="w-full h-11 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">GSTIN (Optional)</label>
                <input
                  type="text"
                  value={gstOrPan}
                  onChange={(e) => setGstOrPan(e.target.value.toUpperCase())}
                  placeholder="Optional business GSTIN"
                  className="w-full h-11 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-mono uppercase"
                />
              </div>
              <button
                type="submit"
                className="w-full h-11 rounded-xl bg-[#2874F0] text-white text-sm font-bold hover:bg-[#1e60d5] transition"
              >
                Save Store &amp; Payout Details
              </button>
            </form>
          </div>
        )}
      </main>

      {/* Seller Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200">
        <div className="grid grid-cols-4 h-14 items-center">
          {(
            [
              { id: 'dashboard', label: 'Home', icon: 'fa-chart-line' },
              { id: 'products', label: 'Products', icon: 'fa-boxes-stacked' },
              { id: 'orders', label: 'Orders', icon: 'fa-bag-shopping' },
              { id: 'profile', label: 'Store', icon: 'fa-store' },
            ] as { id: SellerTab; label: string; icon: string }[]
          ).map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setSellerTab(b.id)}
              className={`flex flex-col items-center justify-center h-full ${
                sellerTab === b.id ? 'text-[#2874F0]' : 'text-slate-500'
              }`}
            >
              <i className={`fa-solid ${b.icon} text-base`}></i>
              <span className="text-[10px] font-semibold mt-0.5">{b.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Seller Product Add/Edit Modal */}
      {prodModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-extrabold text-slate-900">
                  {editingProd ? 'Edit Your Product' : 'Add Product to Your Store'}
                </h2>
                <p className="text-[11px] text-slate-500">Seller: {sellerProfile.storeName}</p>
              </div>
              <button
                type="button"
                onClick={() => setProdModalOpen(false)}
                className="w-9 h-9 rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <form onSubmit={handleSaveSellerProduct} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Category</label>
                <select
                  value={prodCatId}
                  onChange={(e) => setProdCatId(Number(e.target.value))}
                  className="w-full h-11 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Product Name</label>
                <input
                  type="text"
                  value={prodName}
                  onChange={(e) => setProdName(e.target.value)}
                  required
                  placeholder="Enter product title"
                  className="w-full h-11 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Price (₹)</label>
                  <input
                    type="number"
                    min="1"
                    value={prodPrice}
                    onChange={(e) => setProdPrice(e.target.value)}
                    required
                    className="w-full h-11 px-3 rounded-xl bg-slate-50 border border-slate-200 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">MRP (₹)</label>
                  <input
                    type="number"
                    min="1"
                    value={prodMrp}
                    onChange={(e) => setProdMrp(e.target.value)}
                    placeholder="Auto"
                    className="w-full h-11 px-3 rounded-xl bg-slate-50 border border-slate-200 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Stock Quantity</label>
                  <input
                    type="number"
                    min="0"
                    value={prodStock}
                    onChange={(e) => setProdStock(e.target.value)}
                    required
                    placeholder="0"
                    className="w-full h-11 px-3 rounded-xl bg-slate-50 border border-slate-200 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Product Description</label>
                <textarea
                  rows={3}
                  value={prodDesc}
                  onChange={(e) => setProdDesc(e.target.value)}
                  required
                  placeholder="Key highlights, material, warranty..."
                  className="w-full p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Product Photo</label>
                <div className="flex items-center gap-3">
                  <img
                    src={prodImage}
                    alt="Preview"
                    referrerPolicy="no-referrer"
                    className="w-16 h-16 rounded-lg object-cover bg-slate-100 border border-slate-200 shrink-0"
                  />
                  <div className="flex-1 space-y-2">
                    <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 text-[#2874F0] text-xs font-bold cursor-pointer hover:bg-blue-100">
                      <i className="fa-solid fa-camera"></i>
                      <span>{imageCompressing ? 'Compressing...' : 'Upload Photo'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleProductPhotoUpload}
                        className="hidden"
                      />
                    </label>
                    <select
                      value={IMAGE_CHOICES.some((ic) => ic.url === prodImage) ? prodImage : ''}
                      onChange={(e) => {
                        if (e.target.value) setProdImage(e.target.value);
                      }}
                      className="w-full h-9 px-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs"
                    >
                      <option value="">Or choose sample image...</option>
                      {IMAGE_CHOICES.map((ic) => (
                        <option key={ic.url} value={ic.url}>
                          {ic.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                {imageUploadError && <p className="mt-1 text-xs text-rose-600">{imageUploadError}</p>}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setProdModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={imageCompressing}
                  className="px-5 py-2.5 rounded-xl bg-[#FB641B] text-white text-xs font-bold hover:bg-[#e55812] disabled:opacity-60"
                >
                  {editingProd ? 'Save Changes' : 'Publish Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Seller Update Tracking Modal */}
      {trackingModalOrder && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/55 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-base font-extrabold text-slate-900">
                  Update Tracking · <span className="font-mono">#{trackingModalOrder.id}</span>
                </h2>
                <p className="text-[11px] text-slate-500 truncate">
                  {trackingModalOrder.name} · {formatINR(trackingModalOrder.total_amount)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTrackingModalOrder(null)}
                aria-label="Close tracking modal"
                className="w-8 h-8 rounded-lg text-slate-500 hover:bg-slate-100 flex items-center justify-center"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <form
              onSubmit={(e) => handleSaveSellerOrderTracking(trackingModalOrder, e)}
              className="p-5 space-y-3.5"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Order Status</label>
                <select
                  value={orderStatusDraft}
                  onChange={(e) => setOrderStatusDraft(e.target.value as OrderStatus)}
                  className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold text-slate-900"
                >
                  {ORDER_STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Courier Partner</label>
                  <select
                    value={trackingCourierDraft}
                    onChange={(e) => setTrackingCourierDraft(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-900"
                  >
                    {COURIER_PARTNERS.map((partner) => (
                      <option key={partner} value={partner}>
                        {partner}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">AWB / Tracking ID</label>
                  <input
                    type="text"
                    value={trackingIdDraft}
                    onChange={(e) => setTrackingIdDraft(e.target.value)}
                    placeholder="e.g. DLV948271630IN"
                    className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono text-slate-900"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Live Location / Hub Note</label>
                <input
                  type="text"
                  value={trackingNoteDraft}
                  onChange={(e) => setTrackingNoteDraft(e.target.value)}
                  placeholder="Dispatched from Bawana Warehouse, Delhi"
                  className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Custom Tracking URL <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={trackingUrlDraft}
                  onChange={(e) => setTrackingUrlDraft(e.target.value)}
                  placeholder="Auto-links to courier page if left blank"
                  className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setTrackingModalOrder(null)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#2874F0] text-white text-xs font-bold hover:bg-[#1e60d5] transition"
                >
                  Save Live Tracking
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
