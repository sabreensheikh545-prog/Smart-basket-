import React, { useEffect, useState } from 'react';
import {
  assignOrderRiderFirestore,
  deleteCategoryFirestore,
  deleteDeliveryBoyFirestore,
  deleteProductFirestore,
  deleteUserFirestore,
  filterOrderForSeller,
  markSellerPayoutPaidFirestore,
  reviewRiderKycFirestore,
  saveCategoryFirestore,
  saveDeliveryBoyFirestore,
  saveProductFirestore,
  settleRiderCodCashFirestore,
  shipOrderViaCourierFirestore,
  subscribeAllOrdersFirestore,
  subscribeAllSellersFirestore,
  subscribeAllUsersFirestore,
  subscribeDeliveryBoysFirestore,
  toggleDeliveryBoyStatusFirestore,
  toggleUserBlockFirestore,
  updateOrderStatusFirestore,
  updateOrderTrackingFirestore,
  updateSellerStatusFirestore,
} from '../services/firestoreService';
import {
  ASSETS,
  IMAGE_CHOICES,
  getBootstrapData,
  getStoredDeliveryBoysLocal,
  getStoredSellersLocal,
  loginAdminLocal,
  saveProductLocal,
  setStoredAdminLoggedIn,
  updateAdminSettingsLocal,
} from '../store/localStore';
import {
  COURIER_PARTNERS,
  Category,
  DeliveryBoy,
  ORDER_STATUS_OPTIONS,
  Order,
  OrderStatus,
  Product,
  SellerProfile,
  User,
  calculateSellerEarnings,
  formatINR,
  generateDeliveryOtp,
  getCourierTrackingUrl,
  getEffectiveMrp,
  getOrderStatusLabel,
  normalizeOrderStatus,
  normalizeSellerStatus,
} from '../types';

type AdminTab =
  | 'dashboard'
  | 'categories'
  | 'products'
  | 'orders'
  | 'order_detail'
  | 'delivery_boys'
  | 'sellers'
  | 'users'
  | 'settings';

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

        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
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
  categories: Category[];
  products: Product[];
  orders: Order[];
  users: User[];
  adminUsername: string;
  onRefresh: () => void;
  onExitAdmin: () => void;
  showLoader: (text?: string) => void;
  hideLoader: () => void;
  showModal: (opts: { title: string; message: string; type?: 'info' | 'success' | 'error'; onConfirm?: () => void; confirmText?: string }) => void;
}

export const AdminView: React.FC<Props> = ({
  categories,
  products,
  orders,
  users,
  adminUsername,
  onRefresh,
  onExitAdmin,
  showLoader,
  hideLoader,
  showModal,
}) => {
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState<boolean>(() => getBootstrapData().adminLoggedIn);
  const [adminTab, setAdminTab] = useState<AdminTab>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [liveOrders, setLiveOrders] = useState<Order[]>(orders);
  const [liveUsers, setLiveUsers] = useState<User[]>(users);
  const [liveSellers, setLiveSellers] = useState<SellerProfile[]>(() => getStoredSellersLocal());
  const [liveDeliveryBoys, setLiveDeliveryBoys] = useState<DeliveryBoy[]>(() => getStoredDeliveryBoysLocal());

  // Admin Login Form
  const [loginUser, setLoginUser] = useState('Seraj');
  const [loginPass, setLoginPass] = useState('seraj123');
  const [loginErr, setLoginErr] = useState('');

  // Category Modal State
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [catName, setCatName] = useState('');
  const [catImage, setCatImage] = useState(ASSETS.smartphone);

  // Product Modal State
  const [prodModalOpen, setProdModalOpen] = useState(false);
  const [editingProd, setEditingProd] = useState<Product | null>(null);
  const [prodCatId, setProdCatId] = useState<number>(categories[0]?.id || 1);
  const [prodName, setProdName] = useState('');
  const [prodDesc, setProdDesc] = useState('');
  const [prodPrice, setProdPrice] = useState('');
  const [prodMrp, setProdMrp] = useState('');
  const [prodStock, setProdStock] = useState('20');
  const [prodImage, setProdImage] = useState(ASSETS.smartphone);
  const [imageCompressing, setImageCompressing] = useState(false);
  const [imageUploadError, setImageUploadError] = useState('');

  // Order Detail Status & Real-World Courier Tracking Drafts
  const [orderStatusDraft, setOrderStatusDraft] = useState<OrderStatus>('Confirmed');
  const [trackingCourierDraft, setTrackingCourierDraft] = useState<string>('Shiprocket');
  const [trackingIdDraft, setTrackingIdDraft] = useState<string>('');
  const [trackingUrlDraft, setTrackingUrlDraft] = useState<string>('');
  const [trackingNoteDraft, setTrackingNoteDraft] = useState<string>('');
  const [trackingModalOrder, setTrackingModalOrder] = useState<Order | null>(null);

  // Hybrid Dispatch: Ship via Courier Modal State
  const [courierShipModalOrder, setCourierShipModalOrder] = useState<Order | null>(null);
  const [shipCourierPartner, setShipCourierPartner] = useState<string>('Shiprocket');
  const [shipCustomCourier, setShipCustomCourier] = useState<string>('');
  const [shipAwbNumber, setShipAwbNumber] = useState<string>('');
  const [shipTrackingUrl, setShipTrackingUrl] = useState<string>('');
  const [shipTrackingNote, setShipTrackingNote] = useState<string>('');

  // Delivery Boy Add/Edit Modal State
  const [riderModalOpen, setRiderModalOpen] = useState(false);
  const [editingRider, setEditingRider] = useState<DeliveryBoy | null>(null);
  const [riderName, setRiderName] = useState('');
  const [riderPhone, setRiderPhone] = useState('');
  const [riderEmail, setRiderEmail] = useState('');
  const [riderIdInput, setRiderIdInput] = useState('');
  const [riderPassword, setRiderPassword] = useState('');
  const [riderVehicleArea, setRiderVehicleArea] = useState('');
  const [riderStatusDraft, setRiderStatusDraft] = useState<'active' | 'inactive'>('active');

  // KYC Document Lightbox Preview
  const [kycLightbox, setKycLightbox] = useState<{ title: string; subtitle: string; src: string } | null>(null);

  // Admin Settings
  const [settingsUser, setSettingsUser] = useState(adminUsername);
  const [settingsPass, setSettingsPass] = useState('');

  useEffect(() => {
    if (!isAdminLoggedIn) return;
    const unsubOrders = subscribeAllOrdersFirestore(
      (list) => setLiveOrders(list),
      (errMsg) => showModal({ title: 'Orders Sync Notice', message: errMsg, type: 'error' })
    );
    const unsubUsers = subscribeAllUsersFirestore(
      (list) => setLiveUsers(list),
      (errMsg) => showModal({ title: 'Users Sync Notice', message: errMsg, type: 'error' })
    );
    const unsubSellers = subscribeAllSellersFirestore((list) => setLiveSellers(list));
    const unsubRiders = subscribeDeliveryBoysFirestore((list) => setLiveDeliveryBoys(list));
    return () => {
      unsubOrders();
      unsubUsers();
      unsubSellers();
      unsubRiders();
    };
  }, [isAdminLoggedIn, showModal]);

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginErr('');
    showLoader('Signing in...');
    const res = loginAdminLocal(loginUser, loginPass);
    hideLoader();
    if (res.success) {
      setIsAdminLoggedIn(true);
    } else {
      setLoginErr(res.message);
    }
  };

  if (!isAdminLoggedIn) {
    return (
      <div className="min-h-screen bg-[#F1F3F6] flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden">
          <div className="bg-[#2874F0] px-6 py-6 text-center text-white">
            <div className="w-12 h-12 rounded-xl bg-[#FFE500] text-[#2874F0] flex items-center justify-center mx-auto shadow-sm">
              <i className="fa-solid fa-shield-halved text-xl"></i>
            </div>
            <h1 className="mt-3 text-xl font-extrabold tracking-tight">Quick Kart Seller Admin</h1>
            <p className="mt-1 text-xs text-blue-100">Default credentials: Seraj / seraj123</p>
          </div>
          <div className="p-6">
            {loginErr && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
                <i className="fa-solid fa-circle-exclamation"></i>
                <span>{loginErr}</span>
              </div>
            )}
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Username</label>
                <input
                  type="text"
                  value={loginUser}
                  onChange={(e) => setLoginUser(e.target.value)}
                  required
                  placeholder="Seraj"
                  className="w-full h-11 px-4 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:bg-white focus:border-[#2874F0] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Password</label>
                <input
                  type="password"
                  value={loginPass}
                  onChange={(e) => setLoginPass(e.target.value)}
                  required
                  placeholder="seraj123"
                  className="w-full h-11 px-4 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:bg-white focus:border-[#2874F0] focus:outline-none"
                />
              </div>
              <button
                type="submit"
                className="w-full h-11 rounded-xl bg-[#FB641B] text-white text-sm font-bold hover:bg-[#e55812] transition flex items-center justify-center gap-2"
              >
                <span>Sign In to Admin</span>
                <i className="fa-solid fa-arrow-right text-xs"></i>
              </button>
            </form>
            <button
              type="button"
              onClick={onExitAdmin}
              className="mt-5 w-full min-h-[44px] text-center text-xs font-semibold text-[#2874F0] hover:underline"
            >
              <i className="fa-solid fa-arrow-left mr-1"></i> Back to Storefront
            </button>
          </div>
        </div>
      </div>
    );
  }

  const revenue = liveOrders.filter((o) => o.status !== 'Cancelled').reduce((acc, o) => acc + o.total_amount, 0);
  const activeProducts = products.filter((p) => p.stock > 0).length;
  const cancellations = liveOrders.filter((o) => o.status === 'Cancelled').length;
  const shipments = liveOrders.filter((o) =>
    ['Packed', 'Shipped', 'Dispatched', 'Delivered'].includes(o.status)
  ).length;
  const pendingSellersCount = liveSellers.filter((s) => normalizeSellerStatus(s.status) === 'pending').length;
  const pendingPayoutSellersCount = liveSellers.filter((s) => Number(s.pendingPayoutAmount || 0) > 0).length;
  const sellerAttentionCount = pendingSellersCount + pendingPayoutSellersCount;
  const pendingKycRiders = liveDeliveryBoys.filter((r) => r.kycStatus === 'pending_kyc');
  const approvedRiders = liveDeliveryBoys.filter((r) => r.kycStatus === 'approved');
  const rejectedKycRiders = liveDeliveryBoys.filter((r) => r.kycStatus === 'rejected');
  const activeApprovedRiders = approvedRiders.filter((r) => r.status === 'active');
  const totalCodCashInHand = approvedRiders.reduce((sum, r) => sum + Number(r.codCashInHand || 0), 0);
  const activeOrder = liveOrders.find((o) => o.id === selectedOrderId) || null;

  const openCategoryModal = (cat?: Category) => {
    setEditingCat(cat || null);
    setCatName(cat ? cat.name : '');
    setCatImage(cat ? cat.image : ASSETS.smartphone);
    setCatModalOpen(true);
  };

  const saveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    showLoader('Saving category...');
    const res = await saveCategoryFirestore({
      id: editingCat?.id || 0,
      docId: editingCat?.docId,
      name: catName,
      image: catImage,
    });
    hideLoader();
    if (res.success) {
      setCatModalOpen(false);
      onRefresh();
    } else {
      showModal({ title: 'Error', message: res.message, type: 'error' });
    }
  };

  const deleteCategory = (cat: Category) => {
    showModal({
      title: 'Delete Category',
      message: 'Deleting a category also removes its linked products. Continue?',
      type: 'error',
      confirmText: 'Delete',
      onConfirm: async () => {
        showLoader('Deleting...');
        const res = await deleteCategoryFirestore(cat, products);
        hideLoader();
        if (!res.success) {
          showModal({ title: 'Error', message: res.message, type: 'error' });
        } else {
          onRefresh();
        }
      },
    });
  };

  const openProductModal = (prod?: Product) => {
    setEditingProd(prod || null);
    setProdCatId(prod ? prod.cat_id : categories[0]?.id || 1);
    setProdName(prod ? prod.name : '');
    setProdDesc(prod ? prod.description : '');
    setProdPrice(prod ? String(prod.price) : '');
    setProdMrp(prod ? String(getEffectiveMrp(prod.price, prod.mrp)) : '');
    setProdStock(prod ? String(prod.stock) : '20');
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
      const compressedDataUrl = await compressImageFileToDataUrl(file, 500, 0.7);
      setProdImage(compressedDataUrl);
    } catch (err) {
      setImageUploadError(err instanceof Error ? err.message : 'Unable to process selected photo.');
    } finally {
      setImageCompressing(false);
    }
  };

  const saveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    showLoader('Saving product...');
    const priceNum = Number(prodPrice);
    const mrpNum = Number(prodMrp);
    const stockNum = Math.max(0, Math.floor(Number(prodStock) || 0));
    const res = await saveProductFirestore({
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
      sellerId: editingProd?.sellerId,
      sellerEmail: editingProd?.sellerEmail,
      sellerName: editingProd?.sellerName,
    });
    if (!res.success) {
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
        sellerId: editingProd?.sellerId,
        sellerEmail: editingProd?.sellerEmail,
        sellerName: editingProd?.sellerName,
      });
      hideLoader();
      if (localRes.success) {
        setProdModalOpen(false);
        onRefresh();
        showModal({ title: 'Saved', message: localRes.message, type: 'success' });
      } else {
        showModal({ title: 'Validation Error', message: localRes.message, type: 'error' });
      }
      return;
    }
    hideLoader();
    setProdModalOpen(false);
    onRefresh();
    showModal({ title: 'Saved', message: res.message, type: 'success' });
  };

  const deleteProduct = (prod: Product) => {
    showModal({
      title: 'Delete Product',
      message: 'Remove this product from your live catalog?',
      type: 'error',
      confirmText: 'Delete',
      onConfirm: async () => {
        showLoader('Deleting...');
        const res = await deleteProductFirestore(prod);
        hideLoader();
        if (!res.success) {
          showModal({ title: 'Error', message: res.message, type: 'error' });
        } else {
          onRefresh();
        }
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

  const handleQuickOrderStatusUpdate = async (ord: Order, nextStatus: OrderStatus) => {
    showLoader('Updating order status...');
    const res = await updateOrderStatusFirestore(ord, nextStatus);
    hideLoader();
    if (res.success) {
      setLiveOrders((prev) => prev.map((o) => (o.id === ord.id ? { ...o, status: nextStatus } : o)));
      setOrderStatusDraft(nextStatus);
      onRefresh();
    } else {
      showModal({ title: 'Error', message: res.message, type: 'error' });
    }
  };

  const handleSaveOrderTracking = async (targetOrder: Order, e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      status: orderStatusDraft,
      courierName: trackingCourierDraft.trim(),
      trackingId: trackingIdDraft.trim(),
      trackingUrl: trackingUrlDraft.trim(),
      trackingNote: trackingNoteDraft.trim(),
    };
    showLoader('Updating live tracking...');
    const res = await updateOrderTrackingFirestore(targetOrder, payload);
    hideLoader();
    if (res.success) {
      setLiveOrders((prev) =>
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
      showModal({ title: 'Tracking Updated', message: res.message, type: 'success' });
    } else {
      showModal({ title: 'Error', message: res.message, type: 'error' });
    }
  };

  // Hybrid Logistics Handlers (Delivery Boys, KYC Approval, COD Cash Settlement, Rider/Courier Dispatch)
  const openRiderModal = (rider?: DeliveryBoy) => {
    setEditingRider(rider || null);
    setRiderName(rider ? rider.name : '');
    setRiderPhone(rider ? rider.phone : '');
    setRiderEmail(rider ? rider.email : '');
    setRiderIdInput(rider ? rider.riderId : `RDR-${Math.floor(1000 + Math.random() * 9000)}`);
    setRiderPassword(rider ? rider.password : '');
    setRiderVehicleArea(rider ? rider.vehicleArea : '');
    setRiderStatusDraft(rider ? rider.status : 'active');
    setRiderModalOpen(true);
  };

  const handleSaveRider = async (e: React.FormEvent) => {
    e.preventDefault();
    showLoader('Saving delivery partner...');
    const res = await saveDeliveryBoyFirestore({
      id: editingRider?.id,
      docId: editingRider?.docId,
      riderId: riderIdInput,
      name: riderName,
      phone: riderPhone,
      email: riderEmail,
      password: riderPassword,
      vehicleArea: riderVehicleArea,
      kycStatus: editingRider?.kycStatus || 'approved',
      status: riderStatusDraft,
    });
    hideLoader();
    if (res.success && res.rider) {
      setLiveDeliveryBoys(getStoredDeliveryBoysLocal());
      setRiderModalOpen(false);
      showModal({ title: 'Delivery Partner Saved', message: res.message, type: 'success' });
    } else {
      showModal({ title: 'Validation Error', message: res.message, type: 'error' });
    }
  };

  const handleReviewRiderKyc = async (rider: DeliveryBoy, decision: 'approved' | 'rejected') => {
    showLoader(decision === 'approved' ? 'Approving KYC...' : 'Rejecting KYC...');
    const res = await reviewRiderKycFirestore(rider, decision);
    hideLoader();
    setLiveDeliveryBoys(getStoredDeliveryBoysLocal());
    showModal({
      title: decision === 'approved' ? 'Rider KYC Approved' : 'Rider KYC Rejected',
      message: res.message,
      type: decision === 'approved' ? 'success' : 'info',
    });
  };

  const handleToggleRiderStatus = async (rider: DeliveryBoy) => {
    const nextStatus = rider.status === 'active' ? 'inactive' : 'active';
    showLoader('Updating rider status...');
    const res = await toggleDeliveryBoyStatusFirestore(rider, nextStatus);
    hideLoader();
    setLiveDeliveryBoys(getStoredDeliveryBoysLocal());
    showModal({ title: 'Status Updated', message: res.message, type: 'success' });
  };

  const handleDeleteRider = (rider: DeliveryBoy) => {
    showModal({
      title: 'Remove Delivery Partner',
      message: `Remove ${rider.name} (${rider.riderId}) from your delivery fleet?`,
      type: 'error',
      confirmText: 'Remove',
      onConfirm: async () => {
        showLoader('Removing...');
        await deleteDeliveryBoyFirestore(rider);
        hideLoader();
        setLiveDeliveryBoys(getStoredDeliveryBoysLocal());
      },
    });
  };

  const handleSettleRiderCash = (rider: DeliveryBoy) => {
    const cash = Number(rider.codCashInHand || 0);
    if (cash <= 0) {
      showModal({
        title: 'No Cash Pending',
        message: `${rider.name} has ₹0 COD cash in hand to settle.`,
        type: 'info',
      });
      return;
    }
    showModal({
      title: 'Settle Rider COD Cash',
      message: `Confirm you have collected ${formatINR(cash)} COD cash from ${rider.name} (${rider.riderId})? This will reset their COD Cash in Hand to ₹0.`,
      type: 'info',
      confirmText: 'Confirm & Settle Cash',
      onConfirm: async () => {
        showLoader('Settling COD cash...');
        const res = await settleRiderCodCashFirestore(rider, `Collected by ${adminUsername}`);
        hideLoader();
        setLiveDeliveryBoys(getStoredDeliveryBoysLocal());
        showModal({
          title: res.success ? 'COD Cash Settled' : 'Error',
          message: res.message,
          type: res.success ? 'success' : 'error',
        });
      },
    });
  };

  const handleAssignOrderRider = async (ord: Order, riderIdValue: string) => {
    const chosen = riderIdValue
      ? activeApprovedRiders.find((r) => (r.docId || r.id) === riderIdValue) || null
      : null;
    showLoader(chosen ? `Assigning ${chosen.name}...` : 'Unassigning rider...');
    const res = await assignOrderRiderFirestore(ord, chosen);
    hideLoader();
    if (res.success) {
      const otpVal = res.otp || ord.deliveryOtp || generateDeliveryOtp();
      setLiveOrders((prev) =>
        prev.map((o) =>
          o.id === ord.id
            ? chosen
              ? {
                  ...o,
                  dispatchMode: 'rider',
                  deliveryBoyId: chosen.docId || chosen.id,
                  deliveryBoyName: chosen.name,
                  deliveryBoyPhone: chosen.phone,
                  deliveryBoyEmail: chosen.email || undefined,
                  deliveryBoyVehicle: chosen.vehicleArea,
                  deliveryOtp: otpVal,
                  courierName: 'Smart Basket Rider',
                }
              : {
                  ...o,
                  dispatchMode: o.trackingId ? 'courier' : undefined,
                  deliveryBoyId: undefined,
                  deliveryBoyName: undefined,
                  deliveryBoyPhone: undefined,
                  deliveryBoyEmail: undefined,
                  deliveryBoyVehicle: undefined,
                  riderLiveLat: undefined,
                  riderLiveLng: undefined,
                }
            : o
        )
      );
      onRefresh();
      showModal({
        title: chosen ? 'Rider Assigned' : 'Rider Unassigned',
        message: res.message,
        type: 'success',
      });
    } else {
      showModal({ title: 'Assignment Error', message: res.message, type: 'error' });
    }
  };

  const openCourierShipModal = (ord: Order) => {
    setCourierShipModalOrder(ord);
    const known = ['Shiprocket', 'Porter', 'Delhivery', 'Borzo', 'BlueDart', 'India Post'];
    if (ord.courierName && known.includes(ord.courierName)) {
      setShipCourierPartner(ord.courierName);
      setShipCustomCourier('');
    } else if (ord.courierName && ord.courierName !== 'Smart Basket Rider') {
      setShipCourierPartner('Other');
      setShipCustomCourier(ord.courierName);
    } else {
      setShipCourierPartner('Shiprocket');
      setShipCustomCourier('');
    }
    setShipAwbNumber(ord.trackingId || '');
    setShipTrackingUrl(ord.trackingUrl || '');
    setShipTrackingNote(ord.trackingNote || '');
  };

  const handleShipViaCourierSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courierShipModalOrder) return;
    const resolvedPartner =
      shipCourierPartner === 'Other' ? shipCustomCourier.trim() : shipCourierPartner.trim();
    if (!resolvedPartner || !shipAwbNumber.trim()) {
      showModal({
        title: 'Missing Details',
        message: 'Please enter both the Courier Partner Name and AWB Tracking Number.',
        type: 'error',
      });
      return;
    }

    showLoader(`Shipping via ${resolvedPartner}...`);
    const res = await shipOrderViaCourierFirestore(courierShipModalOrder, {
      courierName: resolvedPartner,
      trackingId: shipAwbNumber.trim(),
      trackingUrl: shipTrackingUrl.trim(),
      trackingNote: shipTrackingNote.trim(),
    });
    hideLoader();
    if (res.success) {
      setLiveOrders((prev) =>
        prev.map((o) =>
          o.id === courierShipModalOrder.id
            ? {
                ...o,
                dispatchMode: 'courier',
                status: 'Shipped',
                courierName: resolvedPartner,
                trackingId: shipAwbNumber.trim(),
                trackingUrl: shipTrackingUrl.trim() || undefined,
                trackingNote: shipTrackingNote.trim() || `Dispatched via ${resolvedPartner}`,
                deliveryBoyId: undefined,
                deliveryBoyName: undefined,
                deliveryBoyPhone: undefined,
                riderLiveLat: undefined,
                riderLiveLng: undefined,
              }
            : o
        )
      );
      setCourierShipModalOrder(null);
      onRefresh();
      showModal({ title: 'Shipped via Courier', message: res.message, type: 'success' });
    } else {
      showModal({ title: 'Dispatch Error', message: res.message, type: 'error' });
    }
  };

  const handleSellerApprovalToggle = async (
    seller: SellerProfile,
    nextStatus: 'approved' | 'pending' | 'blocked'
  ) => {
    showLoader('Updating seller status...');
    const res = await updateSellerStatusFirestore(seller, nextStatus);
    hideLoader();
    setLiveSellers((prev) =>
      prev.map((s) =>
        (s.docId || s.uid || s.id) === (seller.docId || seller.uid || seller.id)
          ? { ...s, status: nextStatus }
          : s
      )
    );
    onRefresh();
    showModal({
      title: res.success ? 'Seller Status Updated' : 'Notice',
      message: res.message,
      type: res.success ? 'success' : 'error',
    });
  };

  const handleMarkSellerPayoutPaid = (seller: SellerProfile, amountToPay: number) => {
    if (amountToPay <= 0) {
      showModal({
        title: 'No Pending Payout',
        message: `${seller.storeName} has no pending payout balance to settle.`,
        type: 'info',
      });
      return;
    }
    showModal({
      title: 'Mark Seller Payout Paid',
      message: `Confirm that ${formatINR(amountToPay)} has been transferred to ${seller.storeName} (${seller.payoutAccount || 'No UPI/Bank saved'})?`,
      type: 'info',
      confirmText: 'Mark Payout Paid',
      onConfirm: async () => {
        showLoader('Marking payout as paid...');
        const res = await markSellerPayoutPaidFirestore(seller, amountToPay);
        hideLoader();
        if (res.success && res.seller) {
          setLiveSellers((prev) =>
            prev.map((s) =>
              (s.docId || s.uid || s.id) === (seller.docId || seller.uid || seller.id)
                ? res.seller!
                : s
            )
          );
          onRefresh();
          showModal({
            title: 'Payout Marked Paid',
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

  const toggleUserBlock = async (user: User) => {
    showLoader('Updating user...');
    const res = await toggleUserBlockFirestore(user, user.status === 'blocked' ? 'active' : 'blocked');
    hideLoader();
    if (!res.success) {
      showModal({ title: 'Error', message: res.message, type: 'error' });
    } else {
      onRefresh();
    }
  };

  const deleteUser = (user: User) => {
    showModal({
      title: 'Delete User',
      message: 'Are you sure you want to remove this user account from Firestore?',
      type: 'error',
      confirmText: 'Delete',
      onConfirm: async () => {
        showLoader('Deleting...');
        const res = await deleteUserFirestore(user);
        hideLoader();
        if (!res.success) {
          showModal({ title: 'Error', message: res.message, type: 'error' });
        } else {
          onRefresh();
        }
      },
    });
  };

  const saveAdminSettings = (e: React.FormEvent) => {
    e.preventDefault();
    showLoader('Saving...');
    const res = updateAdminSettingsLocal(settingsUser, settingsPass);
    hideLoader();
    setSettingsPass('');
    onRefresh();
    showModal({ title: res.success ? 'Saved' : 'Error', message: res.message, type: res.success ? 'success' : 'error' });
  };

  const imageChoices = IMAGE_CHOICES;

  return (
    <div className="min-h-screen bg-[#F1F3F6] pb-20 md:pb-10">
      {/* Admin Top Bar */}
      <header className="sticky top-0 z-40 bg-[#2874F0] text-white shadow-sm">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 h-14 flex items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open admin menu"
              className="w-10 h-10 -ml-1 rounded-xl flex items-center justify-center text-white hover:bg-white/10 shrink-0"
            >
              <i className="fa-solid fa-bars text-lg"></i>
            </button>
            <button type="button" onClick={() => setAdminTab('dashboard')} className="flex items-center gap-2 whitespace-nowrap min-w-0">
              <span className="text-base sm:text-lg font-extrabold tracking-tight italic">
                Quick <span className="text-[#FFE500]">Kart</span>
              </span>
              <span className="hidden sm:inline text-[11px] font-semibold text-blue-100">Admin</span>
            </button>
          </div>

          <nav className="hidden lg:flex items-center gap-4 text-xs font-semibold text-blue-100">
            {(['dashboard', 'categories', 'products', 'orders', 'delivery_boys', 'sellers', 'users', 'settings'] as AdminTab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setAdminTab(t)}
                className={`whitespace-nowrap transition inline-flex items-center gap-1 ${adminTab === t ? 'text-[#FFE500] font-bold' : 'hover:text-white'}`}
              >
                <span className="capitalize">{t === 'delivery_boys' ? 'Delivery Boys' : t}</span>
                {t === 'sellers' && sellerAttentionCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-[#FFE500] text-[#2874F0] text-[10px] font-extrabold tabular-nums">
                    {sellerAttentionCount}
                  </span>
                )}
                {t === 'delivery_boys' && pendingKycRiders.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-[#FB641B] text-white text-[10px] font-extrabold tabular-nums">
                    {pendingKycRiders.length}
                  </span>
                )}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setAdminTab('settings')}
              className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/20 transition text-left"
            >
              <span className="w-7 h-7 rounded-full bg-[#FFE500] text-[#2874F0] text-xs font-extrabold flex items-center justify-center shrink-0">
                MS
              </span>
              <div className="leading-tight">
                <p className="text-[11px] sm:text-xs font-bold text-white whitespace-nowrap">Md. Seraj (Mudassir)</p>
                <span className="inline-block text-[9px] font-extrabold uppercase tracking-wide px-1.5 py-0.2 rounded bg-[#FFE500] text-[#2874F0]">
                  Store Owner
                </span>
              </div>
            </button>
            <button
              type="button"
              onClick={onExitAdmin}
              className="px-2.5 sm:px-3.5 py-2 rounded-lg bg-white text-[#2874F0] text-xs font-bold hover:bg-blue-50 whitespace-nowrap"
            >
              <i className="fa-solid fa-store sm:mr-1.5"></i>
              <span className="hidden sm:inline">Storefront</span>
            </button>
          </div>
        </div>
      </header>

      {/* Admin Sliding Sidebar */}
      {sidebarOpen && <div onClick={() => setSidebarOpen(false)} className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs" />}
      <aside className={`fixed top-0 left-0 bottom-0 z-50 w-72 bg-white text-slate-900 border-r border-slate-200 shadow-2xl transform transition-transform duration-200 flex flex-col ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="px-5 py-4 bg-[#2874F0] text-white flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-[#FFE500] text-[#2874F0] font-extrabold text-sm flex items-center justify-center shrink-0">
              MS
            </div>
            <div className="min-w-0">
              <p className="text-sm font-extrabold text-white truncate">Md. Seraj (Mudassir)</p>
              <div className="mt-1 flex items-center gap-1.5">
                <span className="px-1.5 py-0.5 rounded bg-[#FFE500] text-[#2874F0] text-[10px] font-extrabold uppercase">
                  Store Owner
                </span>
                <span className="text-[11px] text-blue-100 truncate">@{adminUsername}</span>
              </div>
            </div>
          </div>
          <button type="button" onClick={() => setSidebarOpen(false)} className="w-9 h-9 rounded-xl flex items-center justify-center text-white hover:bg-white/10 shrink-0">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: 'fa-chart-pie' },
            { id: 'categories', label: 'Categories', icon: 'fa-tags' },
            { id: 'products', label: 'Products', icon: 'fa-boxes-stacked' },
            { id: 'orders', label: 'Orders', icon: 'fa-receipt' },
            { id: 'delivery_boys', label: 'Delivery Boys', icon: 'fa-motorcycle', badge: pendingKycRiders.length },
            { id: 'sellers', label: 'Sellers Management', icon: 'fa-store', badge: sellerAttentionCount },
            { id: 'users', label: 'Users', icon: 'fa-users' },
            { id: 'settings', label: 'Settings', icon: 'fa-gear' },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setAdminTab(item.id as AdminTab);
                setSidebarOpen(false);
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium ${adminTab === item.id ? 'bg-blue-50 text-[#2874F0] font-bold' : 'text-slate-700 hover:bg-slate-100'}`}
            >
              <span className="flex items-center gap-3">
                <i className={`fa-solid ${item.icon} w-5 text-center`}></i>
                <span>{item.label}</span>
              </span>
              {item.badge ? (
                <span className="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-extrabold tabular-nums">
                  {item.badge}
                </span>
              ) : null}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-100">
          <button
            type="button"
            onClick={() => {
              setStoredAdminLoggedIn(false);
              setIsAdminLoggedIn(false);
            }}
            className="w-full py-2.5 rounded-xl bg-rose-50 text-rose-600 text-sm font-bold hover:bg-rose-100"
          >
            <i className="fa-solid fa-right-from-bracket mr-2"></i>Logout
          </button>
        </div>
      </aside>

      <main className="max-w-6xl mx-auto px-4 py-5 space-y-6">
        {adminTab === 'dashboard' && (
          <>
            {/* Admin Profile Section */}
            <div className="bg-white rounded-xl border border-slate-200/80 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-12 h-12 rounded-full bg-[#2874F0] text-[#FFE500] font-extrabold text-base flex items-center justify-center shrink-0 shadow-xs">
                  MS
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base sm:text-lg font-extrabold text-slate-900 truncate">Md. Seraj (Mudassir)</h2>
                    <span className="px-2 py-0.5 rounded-sm bg-[#2874F0] text-[#FFE500] text-[10px] font-extrabold uppercase tracking-wide">
                      Store Owner
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Admin Username: <span className="font-semibold text-slate-700">{adminUsername}</span> · Quick Kart Store Management
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setAdminTab('products');
                  openProductModal();
                }}
                className="px-4 py-2.5 rounded-lg bg-[#FB641B] text-white text-xs font-bold hover:bg-[#e55812] transition shrink-0"
              >
                <i className="fa-solid fa-plus mr-1.5"></i>Add Product
              </button>
            </div>

            <div>
              <h1 className="text-lg font-extrabold text-slate-900">Dashboard Overview</h1>
              <p className="text-xs text-slate-500">Real-time store catalog, orders &amp; customers synced with Firestore</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3.5 sm:gap-5">
              {[
                { label: 'Total Users', value: liveUsers.length, icon: 'fa-users', color: 'bg-blue-50 text-[#2874F0]' },
                { label: 'Orders', value: liveOrders.length, icon: 'fa-bag-shopping', color: 'bg-amber-50 text-amber-600' },
                { label: 'Revenue', value: formatINR(revenue), icon: 'fa-indian-rupee-sign', color: 'bg-emerald-50 text-[#388E3C]' },
                { label: 'Active Products', value: activeProducts, icon: 'fa-boxes-stacked', color: 'bg-indigo-50 text-indigo-600' },
                { label: 'Cancellations', value: cancellations, icon: 'fa-circle-xmark', color: 'bg-rose-50 text-rose-600' },
                { label: 'Shipments', value: shipments, icon: 'fa-truck-fast', color: 'bg-teal-50 text-teal-600' },
              ].map((stat) => (
                <div key={stat.label} className="bg-white rounded-xl border border-slate-200/80 p-4 flex items-center gap-3.5">
                  <span className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${stat.color}`}>
                    <i className={`fa-solid ${stat.icon} text-lg`}></i>
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-500">{stat.label}</p>
                    <p className="text-base sm:text-xl font-extrabold text-slate-900 font-mono tabular-nums truncate">{stat.value}</p>
                  </div>
                </div>
              ))}
            </div>

            <div>
              <h2 className="text-sm font-bold text-slate-800 mb-3">Quick Actions</h2>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <button type="button" onClick={() => { setAdminTab('products'); openProductModal(); }} className="p-4 rounded-xl bg-[#2874F0] text-white hover:bg-[#1e60d5] transition flex items-center gap-3">
                  <i className="fa-solid fa-plus-circle text-lg text-[#FFE500]"></i>
                  <span className="text-xs font-bold">Add Product</span>
                </button>
                <button type="button" onClick={() => setAdminTab('products')} className="p-4 rounded-xl bg-white border border-slate-200 text-slate-800 hover:border-[#2874F0] transition flex items-center gap-3">
                  <i className="fa-solid fa-pen-to-square text-[#2874F0] text-lg"></i>
                  <span className="text-xs font-bold">Manage Products</span>
                </button>
                <button type="button" onClick={() => setAdminTab('orders')} className="p-4 rounded-xl bg-white border border-slate-200 text-slate-800 hover:border-[#2874F0] transition flex items-center gap-3">
                  <i className="fa-solid fa-truck text-[#FB641B] text-lg"></i>
                  <span className="text-xs font-bold">Manage Orders</span>
                </button>
                <button type="button" onClick={() => setAdminTab('delivery_boys')} className="p-4 rounded-xl bg-white border border-slate-200 text-slate-800 hover:border-[#2874F0] transition flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2.5">
                    <i className="fa-solid fa-motorcycle text-[#2874F0] text-lg"></i>
                    <span className="text-xs font-bold">Delivery Boys ({approvedRiders.length})</span>
                  </span>
                  {pendingKycRiders.length > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-extrabold tabular-nums">
                      {pendingKycRiders.length} KYC
                    </span>
                  )}
                </button>
                <button type="button" onClick={() => setAdminTab('sellers')} className="p-4 rounded-xl bg-white border border-slate-200 text-slate-800 hover:border-[#2874F0] transition flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2.5">
                    <i className="fa-solid fa-store text-[#388E3C] text-lg"></i>
                    <span className="text-xs font-bold">Sellers ({liveSellers.length})</span>
                  </span>
                  {pendingSellersCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-extrabold tabular-nums">
                      {pendingSellersCount}
                    </span>
                  )}
                </button>
              </div>
            </div>
          </>
        )}

        {adminTab === 'categories' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-extrabold text-slate-900">Categories</h1>
              <button type="button" onClick={() => openCategoryModal()} className="px-4 py-2.5 rounded-lg bg-[#2874F0] text-white text-xs font-bold hover:bg-[#1e60d5] transition">
                <i className="fa-solid fa-plus mr-1.5"></i>Add Category
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {categories.map((cat) => (
                <div key={cat.id} className="bg-white rounded-xl border border-slate-200/80 p-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <img src={cat.image} alt={cat.name} referrerPolicy="no-referrer" className="w-14 h-14 rounded-full object-cover bg-slate-100 shrink-0" />
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-slate-900 truncate">{cat.name}</h3>
                      <p className="text-xs text-slate-500 tabular-nums">{products.filter((p) => p.cat_id === cat.id).length} products</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button type="button" onClick={() => openCategoryModal(cat)} className="w-10 h-10 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 flex items-center justify-center">
                      <i className="fa-solid fa-pen text-xs"></i>
                    </button>
                    <button type="button" onClick={() => deleteCategory(cat)} className="w-10 h-10 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 flex items-center justify-center">
                      <i className="fa-solid fa-trash text-xs"></i>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {adminTab === 'products' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-extrabold text-slate-900">Products ({products.length})</h1>
              <button type="button" onClick={() => openProductModal()} className="px-4 py-2.5 rounded-lg bg-[#FB641B] text-white text-xs font-bold hover:bg-[#e55812] transition">
                <i className="fa-solid fa-plus mr-1.5"></i>Add Product
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {products.map((prod) => (
                <div key={prod.id} className="bg-white rounded-xl border border-slate-200/80 p-4 flex gap-3.5 items-center">
                  <img src={prod.image} alt={prod.name} referrerPolicy="no-referrer" className="w-20 h-20 rounded-lg object-cover bg-slate-100 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium text-slate-500 truncate">{categories.find((c) => c.id === prod.cat_id)?.name || 'General'}</p>
                    <h3 className="text-sm font-bold text-slate-900 truncate">{prod.name}</h3>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-extrabold text-slate-900 font-mono tabular-nums">{formatINR(prod.price)}</span>
                      <span className="text-slate-400 line-through font-mono tabular-nums">{formatINR(getEffectiveMrp(prod.price, prod.mrp))}</span>
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
                      <button type="button" onClick={() => openProductModal(prod)} className="px-3 py-1.5 rounded-lg bg-blue-50 text-[#2874F0] text-xs font-bold hover:bg-blue-100">
                        <i className="fa-solid fa-pen mr-1"></i>Edit
                      </button>
                      <button type="button" onClick={() => deleteProduct(prod)} className="px-3 py-1.5 rounded-lg bg-rose-50 text-rose-600 text-xs font-bold hover:bg-rose-100">
                        <i className="fa-solid fa-trash mr-1"></i>Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {adminTab === 'orders' && (() => {
          const returnRequestedCount = liveOrders.filter((o) => o.status === 'Return Requested').length;
          return (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="text-xl font-extrabold text-slate-900">Orders ({liveOrders.length})</h1>
                  {returnRequestedCount > 0 && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-100 border border-amber-300 text-amber-900 text-xs font-extrabold">
                      <i className="fa-solid fa-rotate-left text-[11px]"></i>
                      <span>{returnRequestedCount} Return Requested</span>
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">Update any order status, courier tracking, or process 7-day return/refund requests live</p>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="py-3 px-4">Order ID</th>
                      <th className="py-3 px-4">Customer</th>
                      <th className="py-3 px-4">Amount</th>
                      <th className="py-3 px-4">Live Status</th>
                      <th className="py-3 px-4">Hybrid Dispatch (Own Rider / Courier)</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {liveOrders.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-xs text-slate-500">
                          No orders placed yet.
                        </td>
                      </tr>
                    ) : (
                      liveOrders.map((ord) => {
                        const normalizedValue = normalizeOrderStatus(ord.status);
                        const isReturnReq = normalizedValue === 'Return Requested';
                        const isReturnApproved = normalizedValue === 'Return Approved';
                        const isActiveDispatchable = !['Delivered', 'Cancelled', 'Refunded'].includes(normalizedValue);
                        const isCourierDispatched = ord.dispatchMode === 'courier' || (!ord.deliveryBoyId && Boolean(ord.trackingId));
                        return (
                          <tr
                            key={ord.docId || ord.id}
                            onClick={() => {
                              setSelectedOrderId(ord.id);
                              populateTrackingDrafts(ord);
                              setAdminTab('order_detail');
                            }}
                            className={`cursor-pointer transition ${
                              isReturnReq ? 'bg-amber-50/70 hover:bg-amber-50' : 'hover:bg-slate-50'
                            }`}
                          >
                            <td className="py-3.5 px-4 font-mono font-bold text-slate-900 tabular-nums">
                              <div className="flex items-center gap-1.5">
                                <span>#{ord.id}</span>
                                {isReturnReq && (
                                  <span className="px-1.5 py-0.5 rounded bg-amber-500 text-white font-sans text-[9px] font-extrabold uppercase tracking-wide">
                                    Return Requested
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] font-sans font-normal text-slate-400">
                                {new Date(ord.created_at).toLocaleDateString('en-IN')}
                              </div>
                            </td>
                            <td className="py-3.5 px-4">
                              <p className="font-semibold text-slate-800">{ord.name}</p>
                              <p className="text-[10px] text-slate-500">{ord.paymentMethod || 'Cash on Delivery'}</p>
                            </td>
                            <td className="py-3.5 px-4 font-mono font-bold text-slate-900 tabular-nums">{formatINR(ord.total_amount)}</td>
                            <td
                              className="py-2.5 px-4"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <select
                                aria-label={`Status for order #${ord.id}`}
                                value={normalizedValue}
                                onChange={(e) =>
                                  handleQuickOrderStatusUpdate(ord, e.target.value as OrderStatus)
                                }
                                className={`h-9 px-2.5 rounded-lg border text-xs font-bold focus:outline-none focus:border-[#2874F0] ${
                                  normalizedValue === 'Delivered' || normalizedValue === 'Refunded'
                                    ? 'bg-emerald-50 border-emerald-200 text-[#2E7D32]'
                                    : normalizedValue === 'Return Requested'
                                    ? 'bg-amber-100 border-amber-300 text-amber-900'
                                    : normalizedValue === 'Cancelled'
                                    ? 'bg-rose-50 border-rose-200 text-rose-700'
                                    : 'bg-blue-50 border-blue-200 text-[#2874F0]'
                                }`}
                              >
                                {ORDER_STATUS_OPTIONS.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                              {ord.returnReason && (
                                <p className="mt-1 text-[11px] font-semibold text-amber-800 max-w-[200px] truncate" title={ord.returnReason}>
                                  <i className="fa-solid fa-rotate-left mr-1 text-[10px]"></i>
                                  {ord.returnResolution || 'Return'}: {ord.returnReason}
                                </p>
                              )}
                            </td>
                            <td
                              className="py-2.5 px-4 text-xs"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="space-y-1.5 min-w-[230px]">
                                {isActiveDispatchable && (
                                  <div className="flex items-center gap-1.5">
                                    <select
                                      aria-label={`Assign rider for order #${ord.id}`}
                                      value={ord.deliveryBoyId || ''}
                                      onChange={(e) => handleAssignOrderRider(ord, e.target.value)}
                                      className="h-8 flex-1 px-2 rounded-lg border border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-800 focus:border-[#2874F0] focus:outline-none"
                                    >
                                      <option value="">— Assign Rider —</option>
                                      {activeApprovedRiders.map((r) => (
                                        <option key={r.docId || r.id} value={r.docId || r.id}>
                                          {r.name} ({r.riderId})
                                        </option>
                                      ))}
                                    </select>
                                    <button
                                      type="button"
                                      onClick={() => openCourierShipModal(ord)}
                                      className="h-8 px-2.5 rounded-lg bg-[#0F172A] hover:bg-slate-800 text-white text-[11px] font-bold whitespace-nowrap transition inline-flex items-center gap-1"
                                    >
                                      <i className="fa-solid fa-box-open text-[10px] text-[#FFE500]"></i>
                                      <span>Ship via Courier</span>
                                    </button>
                                  </div>
                                )}

                                {ord.deliveryBoyName ? (
                                  <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                                    <span className="px-2 py-0.5 rounded bg-blue-50 border border-blue-200 text-[#2874F0] font-bold">
                                      <i className="fa-solid fa-motorcycle mr-1"></i>
                                      {ord.deliveryBoyName}
                                    </span>
                                    {ord.deliveryOtp && (
                                      <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-mono font-extrabold">
                                        OTP: {ord.deliveryOtp}
                                      </span>
                                    )}
                                    {typeof ord.riderLiveLat === 'number' && typeof ord.riderLiveLng === 'number' && (
                                      <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
                                        GPS Live
                                      </span>
                                    )}
                                  </div>
                                ) : isCourierDispatched ? (
                                  <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                                    <span className="px-2 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-indigo-800 font-bold">
                                      <i className="fa-solid fa-truck-fast mr-1"></i>
                                      {ord.courierName || 'Courier'}
                                    </span>
                                    {ord.trackingId && (
                                      <span className="font-mono text-[11px] font-bold text-slate-700">
                                        AWB: {ord.trackingId}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-[11px] text-slate-400">
                                    {activeApprovedRiders.length === 0
                                      ? 'No active riders yet (use Courier or approve riders)'
                                      : 'Awaiting Rider or Courier dispatch'}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td
                              className="py-2.5 px-4 text-right"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="flex flex-wrap items-center justify-end gap-1.5">
                                {isReturnReq && (
                                  <button
                                    type="button"
                                    onClick={() => handleQuickOrderStatusUpdate(ord, 'Return Approved')}
                                    className="px-2.5 py-1.5 rounded-lg bg-amber-600 text-white text-[11px] font-bold hover:bg-amber-700 transition whitespace-nowrap"
                                  >
                                    Approve Return
                                  </button>
                                )}
                                {(isReturnReq || isReturnApproved) && (
                                  <button
                                    type="button"
                                    onClick={() => handleQuickOrderStatusUpdate(ord, 'Refunded')}
                                    className="px-2.5 py-1.5 rounded-lg bg-[#2E7D32] text-white text-[11px] font-bold hover:bg-emerald-800 transition whitespace-nowrap"
                                  >
                                    Mark Refunded
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => openTrackingModal(ord)}
                                  className="px-3 py-1.5 rounded-lg bg-[#2874F0] text-white text-xs font-bold hover:bg-[#1e60d5] transition whitespace-nowrap inline-flex items-center gap-1.5"
                                >
                                  <i className="fa-solid fa-truck-fast text-[11px]"></i>
                                  <span>Tracking</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          );
        })()}

        {adminTab === 'order_detail' && activeOrder && (
          <div className="space-y-5 max-w-4xl">
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setAdminTab('orders')} className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-slate-50">
                <i className="fa-solid fa-arrow-left text-xs"></i>
              </button>
              <div>
                <h1 className="text-xl font-extrabold text-slate-900 font-mono">Order #{activeOrder.id}</h1>
                <p className="text-xs text-slate-500">
                  {new Date(activeOrder.created_at).toLocaleString('en-IN')} · Current: <strong className="text-[#2874F0]">{getOrderStatusLabel(activeOrder.status)}</strong>
                </p>
              </div>
            </div>

            {(activeOrder.status === 'Return Requested' ||
              activeOrder.status === 'Return Approved' ||
              activeOrder.status === 'Refunded' ||
              activeOrder.returnReason) && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-amber-600 text-white text-[10px] font-extrabold uppercase tracking-wide">
                      {activeOrder.status}
                    </span>
                    <span className="text-xs font-bold text-amber-950">
                      7-Day {activeOrder.returnResolution || 'Return'} Request
                    </span>
                  </div>
                  {activeOrder.returnReason && (
                    <p className="text-xs text-amber-900">
                      <strong>Customer Reason:</strong> {activeOrder.returnReason}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {activeOrder.status !== 'Return Approved' && activeOrder.status !== 'Refunded' && (
                    <button
                      type="button"
                      onClick={() => handleQuickOrderStatusUpdate(activeOrder, 'Return Approved')}
                      className="px-3.5 py-2 rounded-lg bg-amber-600 text-white text-xs font-bold hover:bg-amber-700 transition"
                    >
                      Approve Return
                    </button>
                  )}
                  {activeOrder.status !== 'Refunded' && (
                    <button
                      type="button"
                      onClick={() => handleQuickOrderStatusUpdate(activeOrder, 'Refunded')}
                      className="px-3.5 py-2 rounded-lg bg-[#2E7D32] text-white text-xs font-bold hover:bg-emerald-800 transition"
                    >
                      Mark Refunded
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-white rounded-xl border border-slate-200/80 p-5 space-y-2.5">
                <h2 className="text-xs font-bold text-slate-500 uppercase">Customer &amp; Delivery</h2>
                <p className="text-sm font-bold text-slate-900">{activeOrder.name}</p>
                <p className="text-xs text-slate-600"><i className="fa-solid fa-phone mr-1.5"></i>{activeOrder.phone}</p>
                {activeOrder.email && (
                  <p className="text-xs text-slate-600"><i className="fa-solid fa-envelope mr-1.5"></i>{activeOrder.email}</p>
                )}
                <p className="text-xs text-slate-600"><i className="fa-solid fa-location-dot mr-1.5"></i>{activeOrder.address}</p>
                <p className="text-xs text-slate-600"><i className="fa-solid fa-wallet mr-1.5"></i>{activeOrder.paymentMethod || 'Cash on Delivery'}</p>

                {/* Hybrid Dispatch Control on Order Detail */}
                <div className="pt-3 mt-2 border-t border-slate-100 space-y-2">
                  <p className="text-[11px] font-bold uppercase text-slate-500">Hybrid Dispatch</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={activeOrder.deliveryBoyId || ''}
                      onChange={(e) => handleAssignOrderRider(activeOrder, e.target.value)}
                      className="h-9 flex-1 min-w-[160px] px-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800"
                    >
                      <option value="">— Assign Own Rider —</option>
                      {activeApprovedRiders.map((r) => (
                        <option key={r.docId || r.id} value={r.docId || r.id}>
                          {r.name} ({r.riderId})
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => openCourierShipModal(activeOrder)}
                      className="h-9 px-3 rounded-lg bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-bold inline-flex items-center gap-1.5"
                    >
                      <i className="fa-solid fa-box-open text-[#FFE500]"></i>
                      <span>Ship via Courier</span>
                    </button>
                  </div>
                  {activeOrder.deliveryBoyName && (
                    <div className="rounded-lg bg-blue-50 border border-blue-200 p-2.5 text-xs space-y-1">
                      <p className="font-bold text-[#2874F0]">
                        <i className="fa-solid fa-motorcycle mr-1.5"></i>
                        Rider: {activeOrder.deliveryBoyName} ({activeOrder.deliveryBoyPhone})
                      </p>
                      {activeOrder.deliveryOtp && (
                        <p className="font-mono font-extrabold text-amber-900">
                          4-Digit Delivery OTP: {activeOrder.deliveryOtp}
                        </p>
                      )}
                      {typeof activeOrder.riderLiveLat === 'number' && typeof activeOrder.riderLiveLng === 'number' && (
                        <a
                          href={`https://www.google.com/maps?q=${activeOrder.riderLiveLat},${activeOrder.riderLiveLng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-emerald-700 font-bold hover:underline"
                        >
                          <i className="fa-solid fa-location-crosshairs"></i>
                          <span>View Rider Live GPS Pin</span>
                        </a>
                      )}
                    </div>
                  )}
                </div>

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
                onSubmit={(e) => handleSaveOrderTracking(activeOrder, e)}
                className="bg-white rounded-xl border border-slate-200/80 p-5 space-y-3"
              >
                <h2 className="text-xs font-bold text-slate-500 uppercase">Update Tracking &amp; Status</h2>
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
                    Custom Tracking URL <span className="text-slate-400 font-normal">(optional, auto-links if empty)</span>
                  </label>
                  <input
                    type="text"
                    value={trackingUrlDraft}
                    onChange={(e) => setTrackingUrlDraft(e.target.value)}
                    placeholder="https://..."
                    className="w-full h-9 px-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-900"
                  />
                </div>
                <button type="submit" className="w-full h-10 rounded-lg bg-[#2874F0] text-white text-sm font-bold hover:bg-[#1e60d5] transition">
                  Save Tracking Update
                </button>
              </form>
            </div>
            <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900">Ordered Items</h2>
                <span className="text-sm font-extrabold font-mono tabular-nums">{formatINR(activeOrder.total_amount)}</span>
              </div>
              <div className="divide-y divide-slate-100">
                {activeOrder.items.map((it) => (
                  <div key={it.id} className="p-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <img src={it.product_image} alt={it.product_name} referrerPolicy="no-referrer" className="w-12 h-12 rounded-lg object-cover bg-slate-100" />
                      <div>
                        <p className="text-sm font-bold text-slate-900">{it.product_name}</p>
                        <p className="text-xs text-slate-500 font-mono">{formatINR(it.price)} × {it.quantity}</p>
                      </div>
                    </div>
                    <span className="text-sm font-extrabold font-mono tabular-nums">{formatINR(it.price * it.quantity)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {adminTab === 'delivery_boys' && (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-extrabold text-slate-900">
                    Delivery Boys &amp; Fleet KYC ({approvedRiders.length})
                  </h1>
                  {pendingKycRiders.length > 0 && (
                    <span className="px-2.5 py-0.5 rounded-md bg-amber-100 border border-amber-300 text-amber-900 text-xs font-extrabold">
                      {pendingKycRiders.length} Pending KYC Request{pendingKycRiders.length === 1 ? '' : 's'}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Verify applicant Aadhaar, Driving License &amp; Selfie KYC, manage active riders, and settle COD Cash in Hand.
                </p>
              </div>
              <button
                type="button"
                onClick={() => openRiderModal()}
                className="px-4 py-2.5 rounded-lg bg-[#2874F0] text-white text-xs font-bold hover:bg-[#1e60d5] transition inline-flex items-center gap-1.5"
              >
                <i className="fa-solid fa-plus"></i>
                <span>Add Delivery Boy</span>
              </button>
            </div>

            {/* Fleet & COD Cash Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white rounded-xl border border-slate-200/80 p-3.5">
                <p className="text-[11px] font-semibold text-slate-500">Pending KYC</p>
                <p className="text-xl font-extrabold text-amber-600 font-mono mt-0.5">{pendingKycRiders.length}</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200/80 p-3.5">
                <p className="text-[11px] font-semibold text-slate-500">Approved Riders</p>
                <p className="text-xl font-extrabold text-slate-900 font-mono mt-0.5">{approvedRiders.length}</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200/80 p-3.5">
                <p className="text-[11px] font-semibold text-slate-500">Active On Duty</p>
                <p className="text-xl font-extrabold text-[#2E7D32] font-mono mt-0.5">{activeApprovedRiders.length}</p>
              </div>
              <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-xl p-3.5 text-white">
                <p className="text-[11px] font-semibold text-emerald-100">Fleet COD Cash in Hand</p>
                <p className="text-xl font-extrabold font-mono mt-0.5">{formatINR(totalCodCashInHand)}</p>
              </div>
            </div>

            {/* Section 1: Pending KYC Requests */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                  <i className="fa-solid fa-id-card text-amber-600"></i>
                  <span>Pending KYC Requests ({pendingKycRiders.length})</span>
                </h2>
              </div>

              {pendingKycRiders.length === 0 ? (
                <div className="bg-white rounded-xl border border-dashed border-slate-300 p-5 text-center text-xs text-slate-500">
                  No pending rider KYC applications right now. When riders apply via &ldquo;Join as Delivery Partner&rdquo;, their Aadhaar, Driving License &amp; Selfie appear here for review.
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingKycRiders.map((applicant) => (
                    <div
                      key={applicant.docId || applicant.id}
                      className="bg-white rounded-2xl border-2 border-amber-300 shadow-xs p-4 sm:p-5 space-y-4"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-extrabold text-slate-900">{applicant.name}</h3>
                            <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 text-[10px] font-extrabold uppercase">
                              Pending KYC
                            </span>
                            <span className="px-2 py-0.5 rounded bg-blue-50 text-[#2874F0] font-mono text-[11px] font-bold">
                              {applicant.riderId}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                            <span><i className="fa-solid fa-phone mr-1 text-slate-400"></i>{applicant.phone}</span>
                            <span><i className="fa-solid fa-location-dot mr-1 text-slate-400"></i>{applicant.areaPincode || applicant.vehicleArea}</span>
                            <span><i className="fa-solid fa-motorcycle mr-1 text-slate-400"></i>{applicant.vehicleType || 'Vehicle'} {applicant.vehicleNumber ? `(${applicant.vehicleNumber})` : ''}</span>
                            {applicant.aadhaarNumber && (
                              <span className="font-mono font-bold text-slate-800">
                                Aadhaar: {applicant.aadhaarNumber}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400">
                            Applied {new Date(applicant.kycSubmittedAt || applicant.created_at).toLocaleString('en-IN')} · Login PIN: <span className="font-mono font-bold text-slate-700">{applicant.password}</span>
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleReviewRiderKyc(applicant, 'approved')}
                            className="px-4 py-2 rounded-lg bg-[#2E7D32] hover:bg-emerald-800 text-white text-xs font-extrabold transition inline-flex items-center gap-1.5"
                          >
                            <i className="fa-solid fa-circle-check"></i>
                            <span>Approve</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReviewRiderKyc(applicant, 'rejected')}
                            className="px-4 py-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-extrabold transition inline-flex items-center gap-1.5"
                          >
                            <i className="fa-solid fa-circle-xmark"></i>
                            <span>Reject</span>
                          </button>
                        </div>
                      </div>

                      {/* Uploaded KYC Document Thumbnails */}
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { label: 'Aadhaar Card', src: applicant.aadhaarPhoto },
                          { label: 'Driving License', src: applicant.drivingLicensePhoto },
                          { label: 'Live Selfie', src: applicant.selfiePhoto },
                        ].map((docItem) => (
                          <div key={docItem.label} className="rounded-xl border border-slate-200 bg-slate-50 p-2">
                            <p className="text-[10px] font-bold text-slate-600 uppercase mb-1.5 text-center">
                              {docItem.label}
                            </p>
                            {docItem.src ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setKycLightbox({
                                    title: `${applicant.name} — ${docItem.label}`,
                                    subtitle: `${applicant.riderId} · Phone: ${applicant.phone}${applicant.aadhaarNumber ? ` · Aadhaar: ${applicant.aadhaarNumber}` : ''}`,
                                    src: docItem.src!,
                                  })
                                }
                                className="group relative w-full h-24 sm:h-28 rounded-lg overflow-hidden border border-slate-200 bg-white block"
                              >
                                <img
                                  src={docItem.src}
                                  alt={docItem.label}
                                  className="w-full h-full object-cover group-hover:scale-105 transition"
                                />
                                <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/70 text-white text-[9px] font-bold">
                                  Tap to Zoom
                                </span>
                              </button>
                            ) : (
                              <div className="h-24 sm:h-28 rounded-lg bg-slate-100 flex items-center justify-center text-[10px] text-slate-400">
                                Not uploaded
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Section 2: Approved Riders & COD Cash Ledger */}
            <div className="space-y-3">
              <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                <i className="fa-solid fa-wallet text-emerald-600"></i>
                <span>Approved Delivery Partners &amp; COD Cash Ledger ({approvedRiders.length})</span>
              </h2>

              {approvedRiders.length === 0 ? (
                <div className="bg-white rounded-xl border border-slate-200/80 p-8 text-center space-y-2">
                  <i className="fa-solid fa-motorcycle text-3xl text-slate-300"></i>
                  <p className="text-sm font-bold text-slate-700">No approved delivery partners yet</p>
                  <p className="text-xs text-slate-500">
                    Approve a Pending KYC request above or click &ldquo;Add Delivery Boy&rdquo; to onboard a rider immediately.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {approvedRiders.map((rider) => {
                    const assignedCount = liveOrders.filter(
                      (o) =>
                        o.deliveryBoyId === (rider.docId || rider.id) &&
                        !['Delivered', 'Cancelled', 'Refunded'].includes(o.status)
                    ).length;
                    const completedCount = liveOrders.filter(
                      (o) => o.deliveryBoyId === (rider.docId || rider.id) && o.status === 'Delivered'
                    ).length;
                    const cashInHand = Number(rider.codCashInHand || 0);

                    return (
                      <div
                        key={rider.docId || rider.id}
                        className="bg-white rounded-2xl border border-slate-200/90 p-4 space-y-3.5 shadow-2xs"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center overflow-hidden shrink-0">
                              {rider.selfiePhoto ? (
                                <img src={rider.selfiePhoto} alt={rider.name} className="w-full h-full object-cover" />
                              ) : (
                                <i className="fa-solid fa-motorcycle text-[#2874F0] text-lg"></i>
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <h3 className="text-sm font-extrabold text-slate-900 truncate">{rider.name}</h3>
                                <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[10px] font-bold">
                                  {rider.riderId}
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                                    rider.status === 'active'
                                      ? 'bg-emerald-50 text-[#2E7D32] border border-emerald-200'
                                      : 'bg-slate-100 text-slate-500 border border-slate-200'
                                  }`}
                                >
                                  {rider.status}
                                </span>
                              </div>
                              <p className="text-xs text-slate-500 truncate mt-0.5">
                                {rider.phone} · {rider.vehicleArea}
                              </p>
                              <p className="text-[11px] text-slate-400">
                                PIN: <span className="font-mono font-bold text-slate-700">{rider.password}</span> · Active: <strong>{assignedCount}</strong> · Delivered: <strong>{completedCount}</strong>
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Automatic COD Cash in Hand Box + Settle Cash Button */}
                        <div
                          className={`rounded-xl p-3 border flex items-center justify-between gap-3 ${
                            cashInHand > 0
                              ? 'bg-amber-50 border-amber-300'
                              : 'bg-slate-50 border-slate-200'
                          }`}
                        >
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                              COD Cash in Hand
                            </p>
                            <p
                              className={`text-lg font-extrabold font-mono tabular-nums ${
                                cashInHand > 0 ? 'text-amber-900' : 'text-slate-700'
                              }`}
                            >
                              {formatINR(cashInHand)}
                            </p>
                            {Number(rider.totalCodSettled || 0) > 0 && (
                              <p className="text-[10px] text-emerald-700 font-semibold">
                                Total Settled: {formatINR(Number(rider.totalCodSettled || 0))}
                              </p>
                            )}
                          </div>
                          <button
                            type="button"
                            disabled={cashInHand <= 0}
                            onClick={() => handleSettleRiderCash(rider)}
                            className="px-3.5 py-2 rounded-lg bg-[#2E7D32] hover:bg-emerald-800 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-extrabold transition whitespace-nowrap inline-flex items-center gap-1.5"
                          >
                            <i className="fa-solid fa-hand-holding-dollar"></i>
                            <span>Settle Cash</span>
                          </button>
                        </div>

                        {/* KYC Document Quick Links (if uploaded) */}
                        {(rider.aadhaarPhoto || rider.drivingLicensePhoto || rider.selfiePhoto) && (
                          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                            <span className="text-slate-400 font-semibold">KYC Docs:</span>
                            {rider.aadhaarPhoto && (
                              <button
                                type="button"
                                onClick={() =>
                                  setKycLightbox({
                                    title: `${rider.name} — Aadhaar Card`,
                                    subtitle: `${rider.riderId} · Aadhaar: ${rider.aadhaarNumber || 'Verified'}`,
                                    src: rider.aadhaarPhoto!,
                                  })
                                }
                                className="px-2 py-0.5 rounded bg-blue-50 text-[#2874F0] font-bold hover:underline"
                              >
                                Aadhaar
                              </button>
                            )}
                            {rider.drivingLicensePhoto && (
                              <button
                                type="button"
                                onClick={() =>
                                  setKycLightbox({
                                    title: `${rider.name} — Driving License`,
                                    subtitle: `${rider.riderId} · ${rider.vehicleArea}`,
                                    src: rider.drivingLicensePhoto!,
                                  })
                                }
                                className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold hover:underline"
                              >
                                License
                              </button>
                            )}
                            {rider.selfiePhoto && (
                              <button
                                type="button"
                                onClick={() =>
                                  setKycLightbox({
                                    title: `${rider.name} — Live Selfie`,
                                    subtitle: `${rider.riderId} · Phone: ${rider.phone}`,
                                    src: rider.selfiePhoto!,
                                  })
                                }
                                className="px-2 py-0.5 rounded bg-orange-50 text-[#FB641B] font-bold hover:underline"
                              >
                                Selfie
                              </button>
                            )}
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={() => handleToggleRiderStatus(rider)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                              rider.status === 'active'
                                ? 'bg-amber-50 text-amber-800 hover:bg-amber-100'
                                : 'bg-emerald-50 text-[#2E7D32] hover:bg-emerald-100'
                            }`}
                          >
                            {rider.status === 'active' ? 'Mark Inactive' : 'Mark Active'}
                          </button>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => openRiderModal(rider)}
                              className="px-3 py-1.5 rounded-lg bg-blue-50 text-[#2874F0] text-xs font-bold hover:bg-blue-100"
                            >
                              <i className="fa-solid fa-pen mr-1"></i>Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteRider(rider)}
                              className="px-3 py-1.5 rounded-lg bg-rose-50 text-rose-600 text-xs font-bold hover:bg-rose-100"
                            >
                              <i className="fa-solid fa-trash mr-1"></i>Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {rejectedKycRiders.length > 0 && (
              <div className="space-y-2 pt-2">
                <h3 className="text-xs font-bold uppercase text-slate-400">
                  Rejected KYC Applications ({rejectedKycRiders.length})
                </h3>
                <div className="space-y-2">
                  {rejectedKycRiders.map((rej) => (
                    <div
                      key={rej.docId || rej.id}
                      className="bg-white rounded-xl border border-slate-200 p-3 flex flex-wrap items-center justify-between gap-2 text-xs"
                    >
                      <div>
                        <span className="font-bold text-slate-800">{rej.name}</span>
                        <span className="text-slate-500 ml-2">{rej.phone} · {rej.vehicleArea}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleReviewRiderKyc(rej, 'approved')}
                          className="px-2.5 py-1 rounded bg-emerald-50 text-[#2E7D32] font-bold hover:bg-emerald-100"
                        >
                          Re-Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteRider(rej)}
                          className="px-2.5 py-1 rounded bg-rose-50 text-rose-600 font-bold hover:bg-rose-100"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {adminTab === 'sellers' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-extrabold text-slate-900">Sellers Management ({liveSellers.length})</h1>
                  {pendingSellersCount > 0 && (
                    <span className="px-2.5 py-0.5 rounded-md bg-amber-100 border border-amber-300 text-amber-900 text-xs font-extrabold">
                      {pendingSellersCount} Pending KYC
                    </span>
                  )}
                  {pendingPayoutSellersCount > 0 && (
                    <span className="px-2.5 py-0.5 rounded-md bg-emerald-100 border border-emerald-300 text-[#1B5E20] text-xs font-extrabold">
                      {pendingPayoutSellersCount} Payout Request{pendingPayoutSellersCount === 1 ? '' : 's'}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Review seller KYC, Bank/UPI payout IDs, 10% platform commission earnings, approve/block stores, and settle payouts.
                </p>
              </div>
            </div>

            {liveSellers.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200/80 p-10 text-center space-y-2">
                <i className="fa-solid fa-store text-3xl text-slate-300"></i>
                <p className="text-sm font-bold text-slate-700">No sellers registered yet</p>
                <p className="text-xs text-slate-500">
                  When a user registers via Become a Seller / Seller Hub, their KYC &amp; payout details will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {liveSellers.map((seller) => {
                  const status = normalizeSellerStatus(seller.status);
                  const sellerProducts = products.filter(
                    (p) =>
                      (p.sellerEmail && p.sellerEmail.toLowerCase() === seller.email.toLowerCase()) ||
                      (p.sellerId && (p.sellerId === seller.uid || p.sellerId === seller.id))
                  );
                  const sellerProductCount = sellerProducts.length;
                  const sellerProductIdSet = new Set(sellerProducts.map((p) => p.id));
                  const sellerId = seller.uid || seller.id;
                  const sellerDeliveredSales = liveOrders
                    .filter((o) => o.status === 'Delivered')
                    .reduce((sum, ord) => {
                      const scoped = filterOrderForSeller(ord, sellerId, seller.email, sellerProductIdSet);
                      return sum + (scoped ? scoped.total_amount : 0);
                    }, 0);
                  const earnings = calculateSellerEarnings(sellerDeliveredSales, seller);
                  const hasRequestedPayout = earnings.pendingPayout > 0;
                  const payoutActionAmount = hasRequestedPayout
                    ? earnings.pendingPayout
                    : earnings.withdrawableBalance;

                  return (
                    <div
                      key={seller.docId || seller.uid || seller.id}
                      className={`bg-white rounded-xl border p-4 sm:p-5 space-y-4 ${
                        hasRequestedPayout
                          ? 'border-amber-300 shadow-xs'
                          : 'border-slate-200/80'
                      }`}
                    >
                      {/* Top Header & Actions */}
                      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-extrabold text-slate-900 truncate">{seller.storeName}</h3>
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-extrabold uppercase ${
                                status === 'approved'
                                  ? 'bg-emerald-50 text-[#2E7D32] border border-emerald-200'
                                  : status === 'blocked'
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : 'bg-amber-50 text-amber-800 border border-amber-200'
                              }`}
                            >
                              {status === 'approved' ? 'Approved' : status === 'blocked' ? 'Blocked' : 'Pending Approval'}
                            </span>
                            {hasRequestedPayout && (
                              <span className="px-2 py-0.5 rounded bg-amber-500 text-white text-[10px] font-extrabold uppercase tracking-wide">
                                Payout Requested: {formatINR(earnings.pendingPayout)}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-600">
                            Joined {new Date(seller.created_at).toLocaleDateString('en-IN')} ·{' '}
                            <span className="font-semibold text-slate-800 tabular-nums">
                              {sellerProductCount} listed product{sellerProductCount === 1 ? '' : 's'}
                            </span>
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleSellerApprovalToggle(seller, 'approved')}
                            disabled={status === 'approved'}
                            className={`px-3 py-2 rounded-lg text-xs font-bold transition ${
                              status === 'approved'
                                ? 'bg-[#2E7D32] text-white cursor-default'
                                : 'bg-emerald-50 text-[#2E7D32] hover:bg-emerald-100'
                            }`}
                          >
                            <i className="fa-solid fa-circle-check mr-1"></i>
                            {status === 'approved' ? 'Approved' : 'Approve Seller'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSellerApprovalToggle(seller, 'pending')}
                            disabled={status === 'pending'}
                            className={`px-3 py-2 rounded-lg text-xs font-bold transition ${
                              status === 'pending'
                                ? 'bg-amber-600 text-white cursor-default'
                                : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
                            }`}
                          >
                            Pending
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSellerApprovalToggle(seller, 'blocked')}
                            disabled={status === 'blocked'}
                            className={`px-3 py-2 rounded-lg text-xs font-bold transition ${
                              status === 'blocked'
                                ? 'bg-rose-600 text-white cursor-default'
                                : 'bg-rose-50 text-rose-600 hover:bg-rose-100'
                            }`}
                          >
                            <i className="fa-solid fa-ban mr-1"></i>
                            {status === 'blocked' ? 'Blocked' : 'Block Seller'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMarkSellerPayoutPaid(seller, payoutActionAmount)}
                            disabled={payoutActionAmount <= 0}
                            className="px-3.5 py-2 rounded-lg bg-[#2874F0] text-white text-xs font-extrabold hover:bg-[#1e60d5] disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed transition inline-flex items-center gap-1.5"
                          >
                            <i className="fa-solid fa-money-check-dollar"></i>
                            <span>
                              {payoutActionAmount > 0
                                ? `Mark Payout Paid (${formatINR(payoutActionAmount)})`
                                : 'Mark Payout Paid'}
                            </span>
                          </button>
                        </div>
                      </div>

                      {/* KYC & Payout Details Grid */}
                      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2.5 p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 text-xs">
                        <div>
                          <p className="text-[10px] font-bold uppercase text-slate-400">Owner &amp; Contact</p>
                          <p className="font-bold text-slate-900 mt-0.5">{seller.ownerName}</p>
                          <p className="text-slate-600 truncate">{seller.email}</p>
                          <p className="text-slate-600 font-mono">{seller.phone || 'No mobile'}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase text-slate-400">Pickup Address &amp; Pincode</p>
                          <p className="text-slate-700 mt-0.5 leading-snug">
                            {seller.pickupAddress || 'Not specified'}
                          </p>
                          {seller.pickupPincode && (
                            <p className="mt-0.5 font-mono font-bold text-slate-800">
                              PIN: {seller.pickupPincode}
                            </p>
                          )}
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase text-slate-400">GSTIN / Tax KYC</p>
                          <p className="font-mono font-bold text-slate-800 mt-0.5">
                            {seller.gstOrPan || 'Not Provided'}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase text-slate-400">Bank Account / UPI ID</p>
                          <p className="font-mono font-extrabold text-[#2874F0] mt-0.5 break-all">
                            {seller.payoutAccount || 'Not Provided'}
                          </p>
                          {seller.lastPayoutPaidAt && (
                            <p className="text-[10px] text-emerald-700 mt-0.5">
                              Last paid: {new Date(seller.lastPayoutPaidAt).toLocaleDateString('en-IN')}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Seller Earnings & Pending Payout Strip */}
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-xs">
                        <div className="rounded-lg border border-slate-200/80 px-3 py-2">
                          <p className="text-[10px] font-semibold text-slate-500">Delivered Sales</p>
                          <p className="font-mono font-extrabold text-slate-900 tabular-nums mt-0.5">
                            {formatINR(earnings.grossDelivered)}
                          </p>
                        </div>
                        <div className="rounded-lg border border-rose-100 bg-rose-50/40 px-3 py-2">
                          <p className="text-[10px] font-semibold text-rose-700">Platform Fee (10%)</p>
                          <p className="font-mono font-extrabold text-rose-700 tabular-nums mt-0.5">
                            {formatINR(earnings.platformFee)}
                          </p>
                        </div>
                        <div className="rounded-lg border border-emerald-100 bg-emerald-50/40 px-3 py-2">
                          <p className="text-[10px] font-semibold text-[#2E7D32]">Net Earnings</p>
                          <p className="font-mono font-extrabold text-[#2E7D32] tabular-nums mt-0.5">
                            {formatINR(earnings.netEarnings)}
                          </p>
                        </div>
                        <div className="rounded-lg border border-slate-200/80 px-3 py-2">
                          <p className="text-[10px] font-semibold text-slate-500">Total Paid Out</p>
                          <p className="font-mono font-extrabold text-slate-800 tabular-nums mt-0.5">
                            {formatINR(earnings.totalPaidOut)}
                          </p>
                        </div>
                        <div
                          className={`rounded-lg border px-3 py-2 col-span-2 sm:col-span-1 ${
                            hasRequestedPayout
                              ? 'border-amber-300 bg-amber-50'
                              : 'border-slate-200/80 bg-slate-50/60'
                          }`}
                        >
                          <p
                            className={`text-[10px] font-bold ${
                              hasRequestedPayout ? 'text-amber-900' : 'text-slate-500'
                            }`}
                          >
                            {hasRequestedPayout ? 'Pending Payout' : 'Unsettled Balance'}
                          </p>
                          <p
                            className={`font-mono font-extrabold tabular-nums mt-0.5 ${
                              hasRequestedPayout ? 'text-amber-900' : 'text-slate-900'
                            }`}
                          >
                            {formatINR(payoutActionAmount)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {adminTab === 'users' && (
          <div className="space-y-4">
            <h1 className="text-xl font-extrabold text-slate-900">Registered Users ({liveUsers.length})</h1>
            {liveUsers.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200/80 p-8 text-center text-xs text-slate-500">
                No registered customers in Firestore yet.
              </div>
            ) : (
              liveUsers.map((u) => (
                <div key={u.docId || u.uid || u.id} className="bg-white rounded-xl border border-slate-200/80 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-slate-900">{u.name}</h3>
                      <span className={`text-[11px] font-semibold ${u.status === 'blocked' ? 'text-rose-600' : 'text-[#388E3C]'}`}>
                        · {u.status === 'blocked' ? 'Blocked' : 'Active'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">{u.email || 'No email'} · {u.phone || 'No phone'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleUserBlock(u)}
                      className={`px-3.5 py-2 rounded-lg text-xs font-semibold ${u.status === 'blocked' ? 'bg-emerald-50 text-[#388E3C]' : 'bg-amber-50 text-amber-700'}`}
                    >
                      {u.status === 'blocked' ? 'Unblock' : 'Block'}
                    </button>
                    <button type="button" onClick={() => deleteUser(u)} className="px-3.5 py-2 rounded-lg bg-rose-50 text-rose-600 text-xs font-semibold">
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {adminTab === 'settings' && (
          <div className="max-w-md space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-full bg-[#2874F0] text-[#FFE500] font-extrabold text-base flex items-center justify-center shrink-0">
                MS
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-extrabold text-slate-900">Md. Seraj (Mudassir)</h2>
                  <span className="px-2 py-0.5 rounded-sm bg-[#2874F0] text-[#FFE500] text-[10px] font-extrabold uppercase tracking-wide">
                    Store Owner
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">Login Username: {adminUsername}</p>
              </div>
            </div>

            <form onSubmit={saveAdminSettings} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
              <h1 className="text-lg font-extrabold text-slate-900">Admin Profile &amp; Credentials</h1>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Username</label>
                <input type="text" value={settingsUser} onChange={(e) => setSettingsUser(e.target.value)} required className="w-full h-11 px-4 rounded-xl bg-slate-50 border border-slate-200 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">New Password (optional)</label>
                <input type="password" value={settingsPass} onChange={(e) => setSettingsPass(e.target.value)} placeholder="Min 6 characters" className="w-full h-11 px-4 rounded-xl bg-slate-50 border border-slate-200 text-sm" />
              </div>
              <button type="submit" className="w-full h-11 rounded-xl bg-[#2874F0] text-white text-sm font-bold hover:bg-[#1e60d5] transition">
                Save Changes
              </button>
            </form>
          </div>
        )}
      </main>

      {/* Admin Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200">
        <div className="grid grid-cols-6 h-14 items-center">
          {[
            { id: 'dashboard', label: 'Home', icon: 'fa-chart-pie' },
            { id: 'products', label: 'Products', icon: 'fa-boxes-stacked' },
            { id: 'orders', label: 'Orders', icon: 'fa-receipt' },
            { id: 'delivery_boys', label: 'Riders', icon: 'fa-motorcycle' },
            { id: 'sellers', label: 'Sellers', icon: 'fa-store' },
            { id: 'users', label: 'Users', icon: 'fa-users' },
          ].map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setAdminTab(b.id as AdminTab)}
              className={`relative flex flex-col items-center justify-center h-full ${adminTab === b.id ? 'text-[#2874F0]' : 'text-slate-500'}`}
            >
              <i className={`fa-solid ${b.icon} text-base`}></i>
              <span className="text-[10px] font-semibold mt-0.5">{b.label}</span>
              {b.id === 'sellers' && sellerAttentionCount > 0 && (
                <span className="absolute top-1.5 right-1.5 min-w-[15px] h-[15px] px-1 rounded-full bg-[#FB641B] text-white text-[9px] font-extrabold flex items-center justify-center tabular-nums">
                  {sellerAttentionCount}
                </span>
              )}
              {b.id === 'delivery_boys' && pendingKycRiders.length > 0 && (
                <span className="absolute top-1.5 right-1.5 min-w-[15px] h-[15px] px-1 rounded-full bg-amber-500 text-white text-[9px] font-extrabold flex items-center justify-center tabular-nums">
                  {pendingKycRiders.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </nav>

      {/* Category Modal */}
      {catModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-extrabold text-slate-900">{editingCat ? 'Edit Category' : 'Add Category'}</h2>
              <button type="button" onClick={() => setCatModalOpen(false)} className="w-9 h-9 rounded-lg text-slate-500 hover:bg-slate-100">
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <form onSubmit={saveCategory} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Category Name</label>
                <input type="text" value={catName} onChange={(e) => setCatName(e.target.value)} required className="w-full h-11 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Category Icon Image</label>
                <select value={catImage} onChange={(e) => setCatImage(e.target.value)} className="w-full h-11 px-3 rounded-xl bg-slate-50 border border-slate-200 text-sm">
                  {imageChoices.map((ic) => (
                    <option key={ic.url} value={ic.url}>{ic.label}</option>
                  ))}
                </select>
              </div>
              <button type="submit" className="w-full h-11 rounded-xl bg-[#2874F0] text-white text-sm font-bold hover:bg-[#1e60d5] transition">Save Category</button>
            </form>
          </div>
        </div>
      )}

      {/* Product Modal */}
      {prodModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-extrabold text-slate-900">{editingProd ? 'Edit Product' : 'Add Product'}</h2>
              <button type="button" onClick={() => setProdModalOpen(false)} className="w-9 h-9 rounded-lg text-slate-500 hover:bg-slate-100">
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <form onSubmit={saveProduct} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
                <select value={prodCatId} onChange={(e) => setProdCatId(Number(e.target.value))} className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 text-sm">
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Product Name</label>
                <input type="text" value={prodName} onChange={(e) => setProdName(e.target.value)} required className="w-full h-10 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Sale Price (₹)</label>
                  <input type="number" min="1" value={prodPrice} onChange={(e) => setProdPrice(e.target.value)} required className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">MRP (₹)</label>
                  <input type="number" min="1" value={prodMrp} onChange={(e) => setProdMrp(e.target.value)} placeholder="Optional" className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Stock Quantity</label>
                  <input type="number" min="0" value={prodStock} onChange={(e) => setProdStock(e.target.value)} required placeholder="0" className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                <textarea rows={3} value={prodDesc} onChange={(e) => setProdDesc(e.target.value)} required className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-sm" />
              </div>
              <div className="space-y-2.5">
                <label className="block text-xs font-semibold text-slate-700">Product Photo</label>

                <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="w-16 h-16 rounded-xl bg-white border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                    <img
                      src={prodImage || ASSETS.smartphone}
                      alt="Product preview"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <label className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg bg-[#2874F0] text-white text-xs font-bold hover:bg-[#1e60d5] active:scale-[0.99] transition cursor-pointer">
                      <i className={`fa-solid ${imageCompressing ? 'fa-spinner fa-spin' : 'fa-camera'}`}></i>
                      <span>{imageCompressing ? 'Compressing photo...' : 'Upload from Gallery'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleProductPhotoUpload}
                        disabled={imageCompressing}
                        className="sr-only"
                      />
                    </label>
                    <p className="text-[11px] text-slate-500">
                      {prodImage.startsWith('data:image/')
                        ? 'Gallery photo compressed (max 500×500 JPEG) & ready for Firestore.'
                        : 'Auto-resized & compressed (max 500×500px) for fast Firestore sync.'}
                    </p>
                  </div>
                </div>

                {imageUploadError && (
                  <p className="text-xs font-medium text-rose-600 flex items-center gap-1.5">
                    <i className="fa-solid fa-circle-exclamation"></i>
                    <span>{imageUploadError}</span>
                  </p>
                )}

                <div className="grid sm:grid-cols-2 gap-2">
                  <select
                    value={imageChoices.some((ic) => ic.url === prodImage) ? prodImage : ''}
                    onChange={(e) => {
                      if (e.target.value) {
                        setImageUploadError('');
                        setProdImage(e.target.value);
                      }
                    }}
                    className="w-full h-9 px-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700"
                  >
                    <option value="">
                      {prodImage.startsWith('data:image/') ? 'Uploaded Gallery Photo' : 'Custom Image URL'}
                    </option>
                    {imageChoices.map((ic) => (
                      <option key={ic.url} value={ic.url}>
                        {ic.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={prodImage.startsWith('data:image/') ? '' : prodImage}
                    onChange={(e) => {
                      setImageUploadError('');
                      setProdImage(e.target.value);
                    }}
                    placeholder={
                      prodImage.startsWith('data:image/')
                        ? 'Or paste https://... URL to replace'
                        : 'Or paste https://... image URL'
                    }
                    className="w-full h-9 px-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={imageCompressing}
                className="w-full h-11 rounded-xl bg-[#FB641B] text-white text-sm font-bold hover:bg-[#e55812] disabled:opacity-60 transition"
              >
                {imageCompressing ? 'Processing Photo...' : 'Save Product'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Admin Update Tracking Modal */}
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
              onSubmit={(e) => handleSaveOrderTracking(trackingModalOrder, e)}
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

      {/* Add / Edit Delivery Boy Modal */}
      {riderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/55 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-extrabold text-slate-900">
                {editingRider ? 'Edit Delivery Partner' : 'Add New Delivery Boy'}
              </h2>
              <button
                type="button"
                onClick={() => setRiderModalOpen(false)}
                className="w-9 h-9 rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <form onSubmit={handleSaveRider} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={riderName}
                    onChange={(e) => setRiderName(e.target.value)}
                    placeholder="e.g. Amit Verma"
                    className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Rider ID *</label>
                  <input
                    type="text"
                    required
                    value={riderIdInput}
                    onChange={(e) => setRiderIdInput(e.target.value.toUpperCase())}
                    placeholder="RDR-1001"
                    className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-mono uppercase"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number *</label>
                  <input
                    type="tel"
                    required
                    value={riderPhone}
                    onChange={(e) => setRiderPhone(e.target.value)}
                    placeholder="9876543210"
                    className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">4-Digit PIN / Password *</label>
                  <input
                    type="text"
                    required
                    value={riderPassword}
                    onChange={(e) => setRiderPassword(e.target.value)}
                    placeholder="e.g. 1234"
                    className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email (optional)</label>
                <input
                  type="email"
                  value={riderEmail}
                  onChange={(e) => setRiderEmail(e.target.value)}
                  placeholder="rider@smartbasket.in"
                  className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Vehicle &amp; Area *</label>
                <input
                  type="text"
                  required
                  value={riderVehicleArea}
                  onChange={(e) => setRiderVehicleArea(e.target.value)}
                  placeholder="e.g. Bike (DL 08 AB 1234) • Bawana 110039"
                  className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
                <select
                  value={riderStatusDraft}
                  onChange={(e) => setRiderStatusDraft(e.target.value as 'active' | 'inactive')}
                  className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold"
                >
                  <option value="active">Active (Available for Orders)</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <button
                type="submit"
                className="w-full h-11 rounded-xl bg-[#2874F0] text-white text-sm font-bold hover:bg-[#1e60d5] transition"
              >
                {editingRider ? 'Update Delivery Partner' : 'Save & Activate Delivery Boy'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Hybrid Dispatch: Ship via Third-Party Courier Modal */}
      {courierShipModalOrder && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/55 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 bg-[#0F172A] text-white flex items-center justify-between">
              <div>
                <h2 className="text-base font-extrabold flex items-center gap-2">
                  <i className="fa-solid fa-box-open text-[#FFE500]"></i>
                  <span>Ship via Courier · #{courierShipModalOrder.id}</span>
                </h2>
                <p className="text-[11px] text-slate-300 truncate">
                  {courierShipModalOrder.name} · {formatINR(courierShipModalOrder.total_amount)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCourierShipModalOrder(null)}
                className="w-8 h-8 rounded-lg text-white/80 hover:bg-white/10 flex items-center justify-center"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <form onSubmit={handleShipViaCourierSubmit} className="p-5 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Courier Partner Name *</label>
                <select
                  value={shipCourierPartner}
                  onChange={(e) => setShipCourierPartner(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold text-slate-900"
                >
                  {['Shiprocket', 'Porter', 'Delhivery', 'Borzo', 'BlueDart', 'India Post', 'Other'].map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              {shipCourierPartner === 'Other' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Enter Courier Partner Name *</label>
                  <input
                    type="text"
                    required
                    value={shipCustomCourier}
                    onChange={(e) => setShipCustomCourier(e.target.value)}
                    placeholder="e.g. XpressBees, DTDC, Shadowfax"
                    className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 text-sm"
                  />
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">AWB Tracking Number *</label>
                <input
                  type="text"
                  required
                  value={shipAwbNumber}
                  onChange={(e) => setShipAwbNumber(e.target.value)}
                  placeholder="e.g. SR129048192IN or DLV948271630"
                  className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tracking URL <span className="text-slate-400 font-normal">(optional, auto-generated if blank)</span>
                </label>
                <input
                  type="text"
                  value={shipTrackingUrl}
                  onChange={(e) => setShipTrackingUrl(e.target.value)}
                  placeholder="https://shiprocket.co/tracking/..."
                  className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Hub / Dispatch Note (optional)</label>
                <input
                  type="text"
                  value={shipTrackingNote}
                  onChange={(e) => setShipTrackingNote(e.target.value)}
                  placeholder="e.g. Picked up from Bawana Hub"
                  className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 text-xs"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCourierShipModalOrder(null)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#FB641B] hover:bg-[#e55a14] text-white text-xs font-extrabold transition"
                >
                  Confirm Courier Dispatch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* KYC Document Zoom Lightbox */}
      {kycLightbox && (
        <div
          onClick={() => setKycLightbox(null)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-white rounded-2xl overflow-hidden shadow-2xl"
          >
            <div className="px-4 py-3 bg-[#0F172A] text-white flex items-center justify-between">
              <div className="min-w-0">
                <h3 className="text-sm font-extrabold truncate">{kycLightbox.title}</h3>
                <p className="text-[11px] text-slate-300 truncate">{kycLightbox.subtitle}</p>
              </div>
              <button
                type="button"
                onClick={() => setKycLightbox(null)}
                className="w-8 h-8 rounded-lg hover:bg-white/10 text-white flex items-center justify-center shrink-0"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <div className="p-4 bg-slate-950 flex items-center justify-center">
              <img
                src={kycLightbox.src}
                alt={kycLightbox.title}
                className="max-h-[70vh] w-auto object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

