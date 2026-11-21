import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db, getFirestoreErrorMessage } from '../firebase';
import {
  DEFAULT_CATEGORIES,
  DEFAULT_PRODUCTS,
  DEFAULT_PROMO_CODES,
  assignOrderRiderLocal,
  authenticateDeliveryBoyLocal,
  cacheCategoriesLocal,
  cacheDeliveryBoysLocal,
  cacheOrdersLocal,
  cacheProductsLocal,
  cacheSellersLocal,
  deductProductStockLocal,
  deleteDeliveryBoyLocal,
  getDeliverySettingsLocal,
  getPromoCodesLocal,
  getReviewsLocal,
  getSavedAddressesLocal,
  getSellerByEmailOrUidLocal,
  getStoredDeliveryBoysLocal,
  getStoredOrdersLocal,
  getStoredSellersLocal,
  getWishlistIdsLocal,
  markOrderOutForDeliveryLocal,
  markSellerPayoutPaidLocal,
  recordRiderCodCollectionLocal,
  requestOrderReturnLocal,
  requestSellerPayoutLocal,
  resolveAssetImage,
  restoreProductStockLocal,
  reviewRiderKycLocal,
  saveAddressesLocal,
  saveDeliveryBoyLocal,
  saveDeliverySettingsLocal,
  savePromoCodesLocal,
  saveReviewsLocal,
  saveSellerProfileLocal,
  saveWishlistIdsLocal,
  settleRiderCodCashLocal,
  shipOrderViaCourierLocal,
  submitRiderKycApplicationLocal,
  toggleDeliveryBoyStatusLocal,
  updateOrderRiderLocationLocal,
  updateOrderStatusLocal,
  updateOrderTrackingLocal,
  updateSellerStatusLocal,
  verifyAndDeliverOrderLocal,
} from '../store/localStore';
import {
  Category,
  DEFAULT_DELIVERY_SETTINGS,
  DeliveryBoy,
  DeliverySettings,
  Order,
  OrderItem,
  OrderStatus,
  Product,
  ProductReview,
  PromoCode,
  RiderCashSettlement,
  RiderKycStatus,
  SavedAddress,
  SellerPayoutRecord,
  SellerProfile,
  User,
  extractPincodeFromAddress,
  generateDeliveryOtp,
  getReturnWindowInfo,
  isOnlinePaidOrder,
  isOrderCancellable,
  normalizeSellerStatus,
} from '../types';
import {
  isValidIndianMobile,
  isValidIndianPincodeFormat,
} from '../utils/indianKycValidation';

let productsSeedAttempted = false;
let categoriesSeedAttempted = false;

function stableNumericId(str: string): number {
  const numeric = Number(str);
  if (Number.isFinite(numeric) && numeric > 0) {
    return Math.floor(numeric);
  }
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash * 31 + str.charCodeAt(i)) % 900000000;
  }
  return Math.abs(hash) + 100000;
}

function mapCategoryDoc(id: string, data: Record<string, unknown>): Category {
  return {
    id: typeof data.id === 'number' ? data.id : stableNumericId(id),
    docId: id,
    name: String(data.name || ''),
    image: resolveAssetImage(typeof data.image === 'string' ? data.image : ''),
  };
}

function mapProductDoc(id: string, data: Record<string, unknown>): Product {
  const price = Number(data.price || 0);
  const mrpRaw = data.mrp !== undefined && data.mrp !== null ? Number(data.mrp) : undefined;
  return {
    id: typeof data.id === 'number' ? data.id : stableNumericId(id),
    docId: id,
    cat_id: Number(data.cat_id || 1),
    name: String(data.name || ''),
    description: String(data.description || ''),
    price,
    mrp: mrpRaw && mrpRaw > price ? mrpRaw : undefined,
    rating: data.rating !== undefined && Number(data.reviews || 0) > 0 ? Number(data.rating) : 0,
    reviews: data.reviews !== undefined ? Math.max(0, Number(data.reviews)) : 0,
    stock: Math.max(0, Math.floor(Number(data.stock ?? 0))),
    image: resolveAssetImage(typeof data.image === 'string' ? data.image : ''),
    created_at: String(data.created_at || data.createdAt || new Date().toISOString()),
    sellerId: typeof data.sellerId === 'string' ? data.sellerId : undefined,
    sellerEmail: typeof data.sellerEmail === 'string' ? data.sellerEmail.trim().toLowerCase() : undefined,
    sellerName: typeof data.sellerName === 'string' ? data.sellerName : undefined,
  };
}

function mapOrderDoc(id: string, data: Record<string, unknown>): Order {
  const rawItems = Array.isArray(data.items) ? data.items : [];
  const orderNumericId = typeof data.id === 'number' ? data.id : stableNumericId(id);
  const items: OrderItem[] = rawItems.map((raw, idx) => {
    const it = (raw || {}) as Record<string, unknown>;
    return {
      id: typeof it.id === 'number' ? it.id : idx + 1,
      order_id: typeof it.order_id === 'number' ? it.order_id : orderNumericId,
      product_id: Number(it.product_id || it.productId || 0),
      product_doc_id: typeof it.product_doc_id === 'string' ? it.product_doc_id : undefined,
      product_name: String(it.product_name || it.name || 'Product'),
      product_image: resolveAssetImage(typeof it.product_image === 'string' ? it.product_image : ''),
      quantity: Number(it.quantity || 1),
      price: Number(it.price || 0),
      sellerId: typeof it.sellerId === 'string' ? it.sellerId : undefined,
      sellerEmail: typeof it.sellerEmail === 'string' ? it.sellerEmail.trim().toLowerCase() : undefined,
      sellerName: typeof it.sellerName === 'string' ? it.sellerName : undefined,
    };
  });

  const totalAmount = Number(data.total_amount ?? data.total ?? 0);
  const rawStatus = String(data.status || 'Confirmed');
  const validStatuses: OrderStatus[] = [
    'Placed',
    'Confirmed',
    'Packed',
    'Shipped',
    'Dispatched',
    'Out for Delivery',
    'Delivered',
    'Return Requested',
    'Return Approved',
    'Refunded',
    'Cancelled',
  ];
  const validStatus: OrderStatus = validStatuses.includes(rawStatus as OrderStatus)
    ? (rawStatus as OrderStatus)
    : 'Confirmed';

  const sellerIds = Array.isArray(data.sellerIds)
    ? data.sellerIds.filter((v): v is string => typeof v === 'string')
    : undefined;
  const sellerEmails = Array.isArray(data.sellerEmails)
    ? data.sellerEmails.filter((v): v is string => typeof v === 'string').map((e) => e.trim().toLowerCase())
    : undefined;

  return {
    id: orderNumericId,
    docId: id,
    user_id: typeof data.user_id === 'number' ? data.user_id : stableNumericId(String(data.userId || '1')),
    userId: typeof data.userId === 'string' ? data.userId : undefined,
    name: String(data.name || data.customerName || 'Customer'),
    phone: String(data.phone || ''),
    email: typeof data.email === 'string' ? data.email : undefined,
    address: String(data.address || ''),
    total_amount: totalAmount,
    total: totalAmount,
    subtotal: data.subtotal !== undefined ? Number(data.subtotal) : undefined,
    deliveryFee: data.deliveryFee !== undefined ? Number(data.deliveryFee) : undefined,
    platformFee: data.platformFee !== undefined ? Number(data.platformFee) : undefined,
    couponCode: typeof data.couponCode === 'string' ? data.couponCode : undefined,
    couponDiscount: data.couponDiscount !== undefined ? Number(data.couponDiscount) : undefined,
    stockDeducted: data.stockDeducted === true,
    stockRestored: data.stockRestored === true,
    paymentMethod: String(data.paymentMethod || 'Cash on Delivery'),
    status: validStatus,
    courierName: typeof data.courierName === 'string' && data.courierName.trim() ? data.courierName.trim() : undefined,
    trackingId: typeof data.trackingId === 'string' && data.trackingId.trim() ? data.trackingId.trim() : undefined,
    trackingUrl: typeof data.trackingUrl === 'string' && data.trackingUrl.trim() ? data.trackingUrl.trim() : undefined,
    trackingNote: typeof data.trackingNote === 'string' && data.trackingNote.trim() ? data.trackingNote.trim() : undefined,
    returnReason: typeof data.returnReason === 'string' && data.returnReason.trim() ? data.returnReason.trim() : undefined,
    returnResolution: data.returnResolution === 'Replace' ? 'Replace' : data.returnResolution === 'Return' ? 'Return' : undefined,
    returnRequestedAt: typeof data.returnRequestedAt === 'string' ? data.returnRequestedAt : undefined,
    returnProofPhoto: typeof data.returnProofPhoto === 'string' && data.returnProofPhoto.trim() ? data.returnProofPhoto : undefined,
    returnRequestId: typeof data.returnRequestId === 'string' && data.returnRequestId.trim() ? data.returnRequestId : undefined,
    returnApprovedAt: typeof data.returnApprovedAt === 'string' ? data.returnApprovedAt : undefined,
    refundedAt: typeof data.refundedAt === 'string' ? data.refundedAt : undefined,
    cancelReason: typeof data.cancelReason === 'string' && data.cancelReason.trim() ? data.cancelReason.trim() : undefined,
    cancelledAt: typeof data.cancelledAt === 'string' ? data.cancelledAt : undefined,
    packedAt: typeof data.packedAt === 'string' ? data.packedAt : undefined,
    shippedAt: typeof data.shippedAt === 'string' ? data.shippedAt : undefined,
    created_at: String(data.created_at || data.createdAt || new Date().toISOString()),
    items,
    sellerIds,
    sellerEmails,
    pincode: extractPincodeFromAddress(
      String(data.address || ''),
      typeof data.pincode === 'string' ? data.pincode : undefined
    ),
    dispatchMode:
      data.dispatchMode === 'courier'
        ? 'courier'
        : data.dispatchMode === 'rider'
        ? 'rider'
        : typeof data.deliveryBoyId === 'string' && data.deliveryBoyId.trim()
        ? 'rider'
        : typeof data.trackingId === 'string' && data.trackingId.trim()
        ? 'courier'
        : undefined,
    deliveryBoyId: typeof data.deliveryBoyId === 'string' && data.deliveryBoyId.trim() ? data.deliveryBoyId.trim() : undefined,
    deliveryBoyName: typeof data.deliveryBoyName === 'string' && data.deliveryBoyName.trim() ? data.deliveryBoyName.trim() : undefined,
    deliveryBoyPhone: typeof data.deliveryBoyPhone === 'string' && data.deliveryBoyPhone.trim() ? data.deliveryBoyPhone.trim() : undefined,
    deliveryBoyEmail: typeof data.deliveryBoyEmail === 'string' && data.deliveryBoyEmail.trim() ? data.deliveryBoyEmail.trim().toLowerCase() : undefined,
    deliveryBoyVehicle: typeof data.deliveryBoyVehicle === 'string' && data.deliveryBoyVehicle.trim() ? data.deliveryBoyVehicle.trim() : undefined,
    deliveryAssignedAt: typeof data.deliveryAssignedAt === 'string' ? data.deliveryAssignedAt : undefined,
    deliveryOutForDeliveryAt: typeof data.deliveryOutForDeliveryAt === 'string' ? data.deliveryOutForDeliveryAt : undefined,
    deliveredAt: typeof data.deliveredAt === 'string' ? data.deliveredAt : undefined,
    deliveryOtp: typeof data.deliveryOtp === 'string' && data.deliveryOtp.trim() ? data.deliveryOtp.trim() : undefined,
    deliveryOtpVerified: Boolean(data.deliveryOtpVerified),
    riderLiveLat: typeof data.riderLiveLat === 'number' && Number.isFinite(data.riderLiveLat) ? data.riderLiveLat : undefined,
    riderLiveLng: typeof data.riderLiveLng === 'number' && Number.isFinite(data.riderLiveLng) ? data.riderLiveLng : undefined,
    riderLocationUpdatedAt: typeof data.riderLocationUpdatedAt === 'string' ? data.riderLocationUpdatedAt : undefined,
  };
}

function mapUserDoc(id: string, data: Record<string, unknown>): User {
  const roleVal = data.role === 'admin' || data.role === 'seller' || data.role === 'customer' ? data.role : undefined;
  return {
    id: typeof data.id === 'number' ? data.id : stableNumericId(id),
    uid: typeof data.uid === 'string' ? data.uid : id,
    docId: id,
    name: String(data.name || 'Customer'),
    phone: String(data.phone || ''),
    email: String(data.email || ''),
    address: String(data.address || ''),
    status: data.status === 'blocked' ? 'blocked' : 'active',
    created_at: String(data.created_at || data.createdAt || new Date().toISOString()),
    role: roleVal,
    isSeller: Boolean(data.isSeller || roleVal === 'seller'),
    sellerStoreName: typeof data.sellerStoreName === 'string' ? data.sellerStoreName : undefined,
  };
}

function mapSellerDoc(id: string, data: Record<string, unknown>): SellerProfile {
  const status = normalizeSellerStatus(typeof data.status === 'string' ? data.status : 'pending');
  const rawHistory = Array.isArray(data.payoutHistory) ? data.payoutHistory : [];
  const payoutHistory: SellerPayoutRecord[] = rawHistory
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    .map((item, idx) => ({
      id: typeof item.id === 'string' ? item.id : `po_${idx}`,
      amount: Number(item.amount || 0),
      payoutAccount: String(item.payoutAccount || ''),
      status: item.status === 'paid' ? 'paid' : 'requested',
      requestedAt: String(item.requestedAt || new Date().toISOString()),
      paidAt: typeof item.paidAt === 'string' ? item.paidAt : undefined,
    }));

  const rawPayoutStatus = String(data.payoutStatus || 'none');
  const payoutStatus: SellerProfile['payoutStatus'] =
    rawPayoutStatus === 'requested' || rawPayoutStatus === 'paid' ? rawPayoutStatus : 'none';

  return {
    id: typeof data.id === 'string' ? data.id : id,
    uid: typeof data.uid === 'string' ? data.uid : id,
    docId: id,
    email: String(data.email || '').trim().toLowerCase(),
    storeName: String(data.storeName || 'Seller Store'),
    ownerName: String(data.ownerName || 'Seller'),
    phone: String(data.phone || ''),
    gstOrPan: typeof data.gstOrPan === 'string' ? data.gstOrPan : '',
    pickupAddress: String(data.pickupAddress || ''),
    pickupPincode: typeof data.pickupPincode === 'string' ? data.pickupPincode : '',
    payoutAccount: typeof data.payoutAccount === 'string' ? data.payoutAccount : '',
    totalPaidOut: Number(data.totalPaidOut || 0),
    pendingPayoutAmount: Number(data.pendingPayoutAmount || 0),
    payoutStatus,
    payoutRequestedAt: typeof data.payoutRequestedAt === 'string' ? data.payoutRequestedAt : undefined,
    lastPayoutPaidAt: typeof data.lastPayoutPaidAt === 'string' ? data.lastPayoutPaidAt : undefined,
    payoutHistory,
    status,
    created_at: String(data.created_at || data.createdAt || new Date().toISOString()),
  };
}

async function seedDefaultCategories(): Promise<void> {
  if (categoriesSeedAttempted) return;
  categoriesSeedAttempted = true;
  try {
    const batch = writeBatch(db);
    DEFAULT_CATEGORIES.forEach((cat) => {
      const ref = doc(db, 'categories', String(cat.id));
      batch.set(ref, {
        id: cat.id,
        name: cat.name,
        image: cat.image,
      });
    });
    await batch.commit();
  } catch {
    // Ignore if security rules block initial unauthenticated seeding
  }
}

async function seedDefaultProducts(): Promise<void> {
  if (productsSeedAttempted) return;
  productsSeedAttempted = true;
  try {
    const batch = writeBatch(db);
    DEFAULT_PRODUCTS.forEach((prod) => {
      const ref = doc(db, 'products', String(prod.id));
      batch.set(ref, {
        id: prod.id,
        cat_id: prod.cat_id,
        name: prod.name,
        description: prod.description,
        price: prod.price,
        mrp: prod.mrp ?? null,
        rating: 0,
        reviews: 0,
        stock: prod.stock,
        image: prod.image,
        created_at: prod.created_at,
        createdAt: prod.created_at,
      });
    });
    await batch.commit();
  } catch {
    // Ignore if security rules block initial unauthenticated seeding
  }
}

export function subscribeCategoriesFirestore(
  onData: (categories: Category[]) => void,
  onError?: (message: string) => void
): () => void {
  return onSnapshot(
    collection(db, 'categories'),
    (snapshot) => {
      if (snapshot.empty) {
        void seedDefaultCategories();
        return;
      }
      const list = snapshot.docs
        .map((d) => mapCategoryDoc(d.id, d.data() as Record<string, unknown>))
        .sort((a, b) => a.id - b.id);
      cacheCategoriesLocal(list);
      onData(list);
    },
    (err) => {
      onError?.(getFirestoreErrorMessage(err));
    }
  );
}

export function subscribeProductsFirestore(
  onData: (products: Product[]) => void,
  onError?: (message: string) => void
): () => void {
  return onSnapshot(
    collection(db, 'products'),
    (snapshot) => {
      if (snapshot.empty) {
        void seedDefaultProducts();
        return;
      }
      const list = snapshot.docs
        .map((d) => mapProductDoc(d.id, d.data() as Record<string, unknown>))
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      cacheProductsLocal(list);
      onData(list);
    },
    (err) => {
      onError?.(getFirestoreErrorMessage(err));
    }
  );
}

export async function saveCategoryFirestore(payload: {
  id?: number;
  docId?: string;
  name: string;
  image: string;
}): Promise<{ success: boolean; message: string }> {
  const cleanName = payload.name.trim();
  if (cleanName.length < 2) {
    return { success: false, message: 'Category name is required.' };
  }
  try {
    const isEdit = Boolean(payload.docId || (payload.id && payload.id > 0));
    const numericId = payload.id && payload.id > 0 ? payload.id : Date.now();
    const docId = payload.docId || String(numericId);
    await setDoc(
      doc(db, 'categories', docId),
      {
        id: numericId,
        name: cleanName,
        image: payload.image,
      },
      { merge: true }
    );
    return { success: true, message: isEdit ? 'Category updated.' : 'Category added.' };
  } catch (err) {
    return { success: false, message: getFirestoreErrorMessage(err) };
  }
}

export async function deleteCategoryFirestore(
  cat: Category,
  linkedProducts: Product[]
): Promise<{ success: boolean; message: string }> {
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'categories', cat.docId || String(cat.id)));
    linkedProducts
      .filter((p) => p.cat_id === cat.id)
      .forEach((p) => {
        batch.delete(doc(db, 'products', p.docId || String(p.id)));
      });
    await batch.commit();
    return { success: true, message: 'Category deleted.' };
  } catch (err) {
    return { success: false, message: getFirestoreErrorMessage(err) };
  }
}

export async function saveProductFirestore(payload: {
  id?: number;
  docId?: string;
  cat_id: number;
  name: string;
  description: string;
  price: number;
  mrp?: number;
  rating?: number;
  reviews?: number;
  stock: number;
  image: string;
  created_at?: string;
  sellerId?: string;
  sellerEmail?: string;
  sellerName?: string;
}): Promise<{ success: boolean; message: string }> {
  const cleanName = payload.name.trim();
  if (!cleanName || payload.price <= 0) {
    return { success: false, message: 'Valid product name and price required.' };
  }
  try {
    const isEdit = Boolean(payload.docId || (payload.id && payload.id > 0));
    const numericId = payload.id && payload.id > 0 ? payload.id : Date.now();
    const docId = payload.docId || String(numericId);
    const mrpValue =
      payload.mrp && payload.mrp > payload.price
        ? payload.mrp
        : Math.round((payload.price * 1.35) / 10) * 10 - 1;
    const nowIso = new Date().toISOString();

    const docPayload: Record<string, unknown> = {
      id: numericId,
      cat_id: payload.cat_id,
      name: cleanName,
      description: payload.description.trim(),
      price: payload.price,
      mrp: mrpValue,
      rating: payload.rating ?? 0,
      reviews: payload.reviews ?? 0,
      stock: Math.max(0, Math.floor(payload.stock)),
      image: payload.image,
      created_at: payload.created_at || nowIso,
      createdAt: payload.created_at || nowIso,
      updatedAt: nowIso,
    };

    if (payload.sellerId) docPayload.sellerId = payload.sellerId;
    if (payload.sellerEmail) docPayload.sellerEmail = payload.sellerEmail.trim().toLowerCase();
    if (payload.sellerName) docPayload.sellerName = payload.sellerName.trim();

    await setDoc(doc(db, 'products', docId), docPayload, { merge: true });
    return { success: true, message: isEdit ? 'Product updated.' : 'Product added.' };
  } catch (err) {
    return { success: false, message: getFirestoreErrorMessage(err) };
  }
}

export async function deleteProductFirestore(prod: Product): Promise<{ success: boolean; message: string }> {
  try {
    await deleteDoc(doc(db, 'products', prod.docId || String(prod.id)));
    return { success: true, message: 'Product deleted.' };
  } catch (err) {
    return { success: false, message: getFirestoreErrorMessage(err) };
  }
}

export async function syncUserProfileFirestore(payload: {
  uid: string;
  name?: string;
  email: string;
  phone?: string;
  address?: string;
}): Promise<{ success: boolean; message: string; user?: User }> {
  const cleanEmail = payload.email.trim().toLowerCase();
  if (!cleanEmail) {
    return { success: false, message: 'Valid email address is required.' };
  }

  try {
    const userRef = doc(db, 'users', payload.uid);
    const existingSnap = await getDoc(userRef);
    const existingData = existingSnap.exists() ? (existingSnap.data() as Record<string, unknown>) : null;

    if (existingData?.status === 'blocked') {
      return { success: false, message: 'Your account has been suspended.' };
    }

    const cleanName = payload.name?.trim() || '';
    const existingName = typeof existingData?.name === 'string' ? existingData.name.trim() : '';
    const finalName =
      cleanName && (!existingName || existingName === 'Smart Basket Customer')
        ? cleanName
        : existingName || cleanName || cleanEmail.split('@')[0] || 'Customer';

    const cleanPhone = payload.phone ? payload.phone.replace(/\D/g, '').slice(-10) : '';
    const existingPhone = typeof existingData?.phone === 'string' ? existingData.phone.trim() : '';
    const finalPhone = cleanPhone || existingPhone;

    const cleanAddress = payload.address?.trim() || '';
    const existingAddress = typeof existingData?.address === 'string' ? existingData.address.trim() : '';
    const finalAddress = cleanAddress || existingAddress;

    const numericId =
      typeof existingData?.id === 'number' ? existingData.id : stableNumericId(payload.uid);
    const createdAt =
      typeof existingData?.created_at === 'string'
        ? existingData.created_at
        : typeof existingData?.createdAt === 'string'
        ? existingData.createdAt
        : new Date().toISOString();
    const nowIso = new Date().toISOString();

    const existingRole =
      existingData?.role === 'admin' || existingData?.role === 'seller' || existingData?.role === 'customer'
        ? existingData.role
        : undefined;
    const existingIsSeller = Boolean(existingData?.isSeller || existingRole === 'seller');
    const existingStoreName =
      typeof existingData?.sellerStoreName === 'string' ? existingData.sellerStoreName : undefined;

    const docData: Record<string, unknown> = {
      id: numericId,
      uid: payload.uid,
      name: finalName,
      email: cleanEmail,
      phone: finalPhone,
      address: finalAddress,
      status: 'active' as const,
      created_at: createdAt,
      createdAt,
      updatedAt: nowIso,
    };
    if (existingRole) docData.role = existingRole;
    if (existingIsSeller) docData.isSeller = true;
    if (existingStoreName) docData.sellerStoreName = existingStoreName;

    await setDoc(userRef, docData, { merge: true });

    const user: User = {
      id: numericId,
      uid: payload.uid,
      docId: payload.uid,
      name: finalName,
      email: cleanEmail,
      phone: finalPhone,
      address: finalAddress,
      status: 'active',
      created_at: createdAt,
      role: existingRole,
      isSeller: existingIsSeller,
      sellerStoreName: existingStoreName,
    };

    return { success: true, message: 'Profile synced.', user };
  } catch (err) {
    return { success: false, message: getFirestoreErrorMessage(err) };
  }
}

export async function updateUserProfileFirestore(payload: {
  uid?: string;
  docId?: string;
  id: number;
  name: string;
  phone: string;
  email: string;
  address: string;
}): Promise<{ success: boolean; message: string }> {
  const docId = payload.docId || payload.uid;
  if (!docId) {
    return { success: true, message: 'Profile saved locally.' };
  }
  try {
    const cleanPhone = payload.phone.replace(/\D/g, '').slice(-10) || payload.phone.trim();
    await setDoc(
      doc(db, 'users', docId),
      {
        id: payload.id,
        uid: payload.uid || docId,
        name: payload.name.trim(),
        phone: cleanPhone,
        email: payload.email.trim().toLowerCase(),
        address: payload.address.trim(),
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    return { success: true, message: 'Profile updated successfully.' };
  } catch (err) {
    return { success: false, message: getFirestoreErrorMessage(err) };
  }
}

export function subscribeAllUsersFirestore(
  onData: (users: User[]) => void,
  onError?: (message: string) => void
): () => void {
  return onSnapshot(
    collection(db, 'users'),
    (snapshot) => {
      const list = snapshot.docs
        .map((d) => mapUserDoc(d.id, d.data() as Record<string, unknown>))
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      onData(list);
    },
    (err) => {
      onError?.(getFirestoreErrorMessage(err));
    }
  );
}

export async function toggleUserBlockFirestore(
  user: User,
  status: 'active' | 'blocked'
): Promise<{ success: boolean; message: string }> {
  const docId = user.docId || user.uid;
  if (!docId) return { success: false, message: 'User record ID missing.' };
  try {
    await updateDoc(doc(db, 'users', docId), {
      status,
      updatedAt: new Date().toISOString(),
    });
    return { success: true, message: `User ${status === 'blocked' ? 'blocked' : 'unblocked'}.` };
  } catch (err) {
    return { success: false, message: getFirestoreErrorMessage(err) };
  }
}

export async function deleteUserFirestore(user: User): Promise<{ success: boolean; message: string }> {
  const docId = user.docId || user.uid;
  if (!docId) return { success: false, message: 'User record ID missing.' };
  try {
    await deleteDoc(doc(db, 'users', docId));
    return { success: true, message: 'User deleted.' };
  } catch (err) {
    return { success: false, message: getFirestoreErrorMessage(err) };
  }
}

const STOCK_RESTORE_STATUSES: OrderStatus[] = ['Cancelled', 'Return Approved', 'Refunded'];

function shouldRestoreStockOnTransition(prevStatus: OrderStatus, nextStatus: OrderStatus, alreadyRestored?: boolean): boolean {
  if (alreadyRestored) return false;
  if (STOCK_RESTORE_STATUSES.includes(prevStatus)) return false;
  return STOCK_RESTORE_STATUSES.includes(nextStatus);
}

export async function restoreOrderStockFirestore(
  order: Order
): Promise<{ restored: boolean; message?: string }> {
  if (!order.items || order.items.length === 0) return { restored: false };
  if (order.stockRestored) return { restored: false };

  const nowIso = new Date().toISOString();
  const qtyByDocId = new Map<string, { product_id: number; quantity: number }>();
  order.items.forEach((it) => {
    const docKey = it.product_doc_id || String(it.product_id);
    const qty = Math.max(1, Math.floor(Number(it.quantity) || 1));
    const prev = qtyByDocId.get(docKey);
    qtyByDocId.set(docKey, {
      product_id: it.product_id,
      quantity: (prev?.quantity || 0) + qty,
    });
  });

  // Always restore local cache immediately
  restoreProductStockLocal(
    Array.from(qtyByDocId.values()).map((v) => ({
      product_id: v.product_id,
      quantity: v.quantity,
    }))
  );

  if (!order.docId) {
    return { restored: true };
  }

  try {
    const restoredInTx = await runTransaction(db, async (tx) => {
      const orderRef = doc(db, 'orders', order.docId!);
      const orderSnap = await tx.get(orderRef);
      if (orderSnap.exists()) {
        const orderData = orderSnap.data() as Record<string, unknown>;
        if (orderData.stockRestored === true) {
          return false;
        }
      }

      const entries = Array.from(qtyByDocId.entries());
      const prodSnaps = await Promise.all(
        entries.map(([prodDocId]) => tx.get(doc(db, 'products', prodDocId)))
      );

      entries.forEach(([prodDocId, info], idx) => {
        const snap = prodSnaps[idx];
        const prodRef = doc(db, 'products', prodDocId);
        if (snap.exists()) {
          const data = snap.data() as Record<string, unknown>;
          const currentStock = Math.max(0, Math.floor(Number(data.stock ?? 0)));
          tx.update(prodRef, {
            stock: currentStock + info.quantity,
            updatedAt: nowIso,
          });
        }
      });

      if (orderSnap.exists()) {
        tx.update(orderRef, {
          stockRestored: true,
          stockRestoredAt: nowIso,
          updatedAt: nowIso,
        });
      }
      return true;
    });
    return { restored: restoredInTx };
  } catch {
    // Fallback atomic increment if transaction is restricted
    await Promise.allSettled(
      Array.from(qtyByDocId.entries()).map(([prodDocId, info]) =>
        updateDoc(doc(db, 'products', prodDocId), {
          stock: increment(info.quantity),
          updatedAt: nowIso,
        })
      )
    );
    await updateDoc(doc(db, 'orders', order.docId), {
      stockRestored: true,
      stockRestoredAt: nowIso,
      updatedAt: nowIso,
    }).catch(() => {});
    return { restored: true };
  }
}

export async function placeOrderFirestore(payload: {
  userId: string;
  numericUserId: number;
  name: string;
  phone: string;
  email: string;
  address: string;
  paymentMethod?: string;
  deliveryFee?: number;
  platformFee?: number;
  couponCode?: string;
  couponDiscount?: number;
  items: { product: Product; quantity: number }[];
}): Promise<{ success: boolean; message: string; order?: Order }> {
  if (!payload.name.trim() || !payload.phone.trim() || !payload.address.trim() || payload.items.length === 0) {
    return { success: false, message: 'Please provide complete delivery details and cart items.' };
  }

  for (const entry of payload.items) {
    if (entry.product.stock <= 0 || entry.product.stock < entry.quantity) {
      return {
        success: false,
        message:
          entry.product.stock <= 0
            ? `${entry.product.name} is Out of Stock.`
            : `Only ${entry.product.stock} unit(s) left for ${entry.product.name}.`,
      };
    }
  }

  try {
    const orderNumber = Math.floor(100000 + (Date.now() % 900000));
    const nowIso = new Date().toISOString();
    let subtotal = 0;

    const orderItems: OrderItem[] = payload.items.map((entry, idx) => {
      const qty = Math.max(1, Math.floor(Number(entry.quantity) || 1));
      const unitPrice = Number(entry.product.price) || 0;
      subtotal += unitPrice * qty;
      const item: OrderItem = {
        id: idx + 1,
        order_id: orderNumber,
        product_id: entry.product.id,
        product_doc_id: entry.product.docId || String(entry.product.id),
        product_name: entry.product.name,
        product_image: entry.product.image,
        quantity: qty,
        price: unitPrice,
      };
      if (entry.product.sellerId) item.sellerId = entry.product.sellerId;
      if (entry.product.sellerEmail) item.sellerEmail = entry.product.sellerEmail.trim().toLowerCase();
      if (entry.product.sellerName) item.sellerName = entry.product.sellerName;
      return item;
    });

    const deliveryFee = Math.max(0, Number(payload.deliveryFee ?? 0));
    const platformFee = Math.max(0, Number(payload.platformFee ?? 10));
    const couponDiscount = Math.max(0, Math.min(subtotal, Number(payload.couponDiscount ?? 0)));
    const total = Math.max(0, subtotal - couponDiscount + deliveryFee + platformFee);

    const sellerIds = Array.from(
      new Set(orderItems.map((it) => it.sellerId).filter((v): v is string => Boolean(v)))
    );
    const sellerEmails = Array.from(
      new Set(orderItems.map((it) => it.sellerEmail?.trim().toLowerCase()).filter((v): v is string => Boolean(v)))
    );

    const paymentMethod = payload.paymentMethod || 'Cash on Delivery';
    const orderDocRef = doc(collection(db, 'orders'));
    const deliveryOtp = generateDeliveryOtp();
    const pincode = extractPincodeFromAddress(payload.address);

    const orderPayload = {
      id: orderNumber,
      userId: payload.userId,
      user_id: payload.numericUserId,
      name: payload.name.trim(),
      customerName: payload.name.trim(),
      phone: payload.phone.trim(),
      email: payload.email.trim().toLowerCase(),
      address: payload.address.trim(),
      pincode,
      items: orderItems,
      sellerIds,
      sellerEmails,
      subtotal,
      deliveryFee,
      platformFee,
      couponCode: (payload.couponCode || '').trim().toUpperCase(),
      couponDiscount,
      total,
      total_amount: total,
      paymentMethod,
      status: 'Confirmed' as const,
      stockDeducted: true,
      stockRestored: false,
      deliveryOtp,
      deliveryOtpVerified: false,
      createdAt: nowIso,
      created_at: nowIso,
    };

    // Aggregate requested quantities per Firestore product document
    const qtyByDocId = new Map<string, { product: Product; quantity: number }>();
    payload.items.forEach((entry) => {
      const docId = entry.product.docId || String(entry.product.id);
      const qty = Math.max(1, Math.floor(Number(entry.quantity) || 1));
      const existing = qtyByDocId.get(docId);
      qtyByDocId.set(docId, {
        product: entry.product,
        quantity: (existing?.quantity || 0) + qty,
      });
    });

    // Atomic Firestore Transaction: verify live inventory, lock & deduct stock, and create order together
    await runTransaction(db, async (tx) => {
      const entries = Array.from(qtyByDocId.entries());
      const snapshots = await Promise.all(
        entries.map(([prodDocId]) => tx.get(doc(db, 'products', prodDocId)))
      );

      // Verify exact real-time stock before performing any writes
      const nextStocks: { ref: ReturnType<typeof doc>; exists: boolean; nextStock: number; product: Product }[] = [];
      entries.forEach(([prodDocId, info], idx) => {
        const snap = snapshots[idx];
        const prodRef = doc(db, 'products', prodDocId);
        let liveStock = Math.max(0, Math.floor(Number(info.product.stock ?? 0)));
        if (snap.exists()) {
          const d = snap.data() as Record<string, unknown>;
          if (typeof d.stock === 'number' && Number.isFinite(d.stock)) {
            liveStock = Math.max(0, Math.floor(d.stock));
          }
        }
        if (liveStock <= 0) {
          throw new Error(`INSUFFICIENT_STOCK:${info.product.name} just went Out of Stock.`);
        }
        if (liveStock < info.quantity) {
          throw new Error(
            `INSUFFICIENT_STOCK:Only ${liveStock} unit(s) of ${info.product.name} left in stock. Please reduce quantity.`
          );
        }
        nextStocks.push({
          ref: prodRef,
          exists: snap.exists(),
          nextStock: Math.max(0, liveStock - info.quantity),
          product: info.product,
        });
      });

      // Perform atomic stock deductions + order creation inside same transaction
      nextStocks.forEach(({ ref, exists, nextStock, product }) => {
        if (exists) {
          tx.update(ref, {
            stock: nextStock,
            updatedAt: nowIso,
          });
        } else {
          tx.set(
            ref,
            {
              id: product.id,
              cat_id: product.cat_id,
              name: product.name,
              description: product.description,
              price: product.price,
              mrp: product.mrp ?? null,
              stock: nextStock,
              image: product.image,
              created_at: product.created_at,
              updatedAt: nowIso,
            },
            { merge: true }
          );
        }
      });

      tx.set(orderDocRef, orderPayload);
    });

    // Sync local cache immediately
    deductProductStockLocal(
      payload.items.map((entry) => ({
        product_id: entry.product.id,
        quantity: Math.max(1, Math.floor(Number(entry.quantity) || 1)),
      }))
    );

    // Track coupon usage count asynchronously
    if (orderPayload.couponCode && couponDiscount > 0) {
      updateDoc(doc(db, 'promo_codes', orderPayload.couponCode), {
        usedCount: increment(1),
        updatedAt: nowIso,
      }).catch(() => {});
    }

    if (payload.userId) {
      await setDoc(
        doc(db, 'users', payload.userId),
        {
          address: payload.address.trim(),
          phone: payload.phone.replace(/\D/g, '').slice(-10) || payload.phone.trim(),
          updatedAt: nowIso,
        },
        { merge: true }
      ).catch(() => {});
    }

    const createdOrder: Order = {
      ...orderPayload,
      docId: orderDocRef.id,
    };

    return {
      success: true,
      message: `Order #${orderNumber} placed successfully!`,
      order: createdOrder,
    };
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('INSUFFICIENT_STOCK:')) {
      return {
        success: false,
        message: err.message.replace('INSUFFICIENT_STOCK:', '').trim(),
      };
    }
    return { success: false, message: getFirestoreErrorMessage(err) };
  }
}

export function subscribeCustomerOrdersFirestore(
  userId: string,
  onData: (orders: Order[]) => void,
  onError?: (message: string) => void
): () => void {
  const q = query(collection(db, 'orders'), where('userId', '==', userId));
  return onSnapshot(
    q,
    (snapshot) => {
      const list = snapshot.docs
        .map((d) => mapOrderDoc(d.id, d.data() as Record<string, unknown>))
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      onData(list);
    },
    (err) => {
      onError?.(getFirestoreErrorMessage(err));
    }
  );
}

export function subscribeAllOrdersFirestore(
  onData: (orders: Order[]) => void,
  onError?: (message: string) => void
): () => void {
  return onSnapshot(
    collection(db, 'orders'),
    (snapshot) => {
      const list = snapshot.docs
        .map((d) => mapOrderDoc(d.id, d.data() as Record<string, unknown>))
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      cacheOrdersLocal(list);
      onData(list);
    },
    (err) => {
      onError?.(getFirestoreErrorMessage(err));
    }
  );
}

function buildOrderStatusTimestampPatch(
  order: Order,
  status: Order['status'],
  nowIso: string
): Record<string, unknown> {
  const patch: Record<string, unknown> = {
    status,
    updatedAt: nowIso,
  };
  if (status === 'Packed' && !order.packedAt) patch.packedAt = nowIso;
  if ((status === 'Shipped' || status === 'Dispatched') && !order.shippedAt) patch.shippedAt = nowIso;
  if (status === 'Out for Delivery' && !order.deliveryOutForDeliveryAt) {
    patch.deliveryOutForDeliveryAt = nowIso;
  }
  if (status === 'Delivered' && !order.deliveredAt) patch.deliveredAt = nowIso;
  if (status === 'Return Approved' && !order.returnApprovedAt) patch.returnApprovedAt = nowIso;
  if (status === 'Refunded' && !order.refundedAt) patch.refundedAt = nowIso;
  if (status === 'Cancelled' && !order.cancelledAt) patch.cancelledAt = nowIso;
  return patch;
}

export async function updateOrderStatusFirestore(
  order: Order,
  status: Order['status'],
  extra?: { cancelReason?: string }
): Promise<{ success: boolean; message: string }> {
  const prevStatus = order.status;
  const nowIso = new Date().toISOString();
  // Always sync localStore immediately as well
  updateOrderStatusLocal(order.id, status, extra);

  const willRestoreStock = shouldRestoreStockOnTransition(prevStatus, status, order.stockRestored);

  const docId = order.docId;
  if (!docId) {
    if (willRestoreStock) {
      await restoreOrderStockFirestore(order);
    }
    return { success: true, message: `Order #${order.id} updated to ${status}.` };
  }
  try {
    const patch = buildOrderStatusTimestampPatch(order, status, nowIso);
    if (status === 'Cancelled' && extra?.cancelReason) {
      patch.cancelReason = extra.cancelReason.trim();
    }
    await updateDoc(doc(db, 'orders', docId), patch);

    // Sync linked structured return_requests document if present
    if (order.returnRequestId && (status === 'Return Approved' || status === 'Refunded')) {
      setDoc(
        doc(db, 'return_requests', order.returnRequestId),
        {
          status: status === 'Refunded' ? 'Refunded' : 'Approved',
          updatedAt: nowIso,
        },
        { merge: true }
      ).catch(() => {});
    }

    if (willRestoreStock) {
      await restoreOrderStockFirestore(order);
    }
    return {
      success: true,
      message: willRestoreStock
        ? `Order #${order.id} updated to ${status} and inventory restored automatically.`
        : `Order #${order.id} updated to ${status}.`,
    };
  } catch (err) {
    return { success: false, message: getFirestoreErrorMessage(err) };
  }
}

export async function updateOrderTrackingFirestore(
  order: Order,
  payload: {
    status: OrderStatus;
    courierName?: string;
    trackingId?: string;
    trackingUrl?: string;
    trackingNote?: string;
  }
): Promise<{ success: boolean; message: string }> {
  const prevStatus = order.status;
  const nowIso = new Date().toISOString();
  const cleanCourier = (payload.courierName || '').trim();
  const cleanTrackingId = (payload.trackingId || '').trim();
  const cleanTrackingUrl = (payload.trackingUrl || '').trim();
  const cleanTrackingNote = (payload.trackingNote || '').trim();
  const willRestoreStock = shouldRestoreStockOnTransition(prevStatus, payload.status, order.stockRestored);

  // Always sync localStore immediately
  updateOrderTrackingLocal(order.id, {
    status: payload.status,
    courierName: cleanCourier,
    trackingId: cleanTrackingId,
    trackingUrl: cleanTrackingUrl,
    trackingNote: cleanTrackingNote,
  });

  const docId = order.docId;
  if (!docId) {
    if (willRestoreStock) {
      await restoreOrderStockFirestore(order);
    }
    return { success: true, message: `Live tracking updated for Order #${order.id}.` };
  }
  try {
    const patch = buildOrderStatusTimestampPatch(order, payload.status, nowIso);
    await updateDoc(doc(db, 'orders', docId), {
      ...patch,
      courierName: cleanCourier,
      trackingId: cleanTrackingId,
      trackingUrl: cleanTrackingUrl,
      trackingNote: cleanTrackingNote,
    });
    if (order.returnRequestId && (payload.status === 'Return Approved' || payload.status === 'Refunded')) {
      setDoc(
        doc(db, 'return_requests', order.returnRequestId),
        {
          status: payload.status === 'Refunded' ? 'Refunded' : 'Approved',
          updatedAt: nowIso,
        },
        { merge: true }
      ).catch(() => {});
    }
    if (willRestoreStock) {
      await restoreOrderStockFirestore(order);
    }
    return {
      success: true,
      message: willRestoreStock
        ? `Order #${order.id} updated to ${payload.status} and inventory restored.`
        : `Live tracking updated for Order #${order.id}.`,
    };
  } catch (err) {
    return { success: false, message: getFirestoreErrorMessage(err) };
  }
}

export async function requestOrderReturnFirestore(
  order: Order,
  payload: {
    returnReason: string;
    returnResolution?: 'Return' | 'Replace';
    returnProofPhoto?: string;
  }
): Promise<{ success: boolean; message: string; returnRequestId?: string }> {
  const cleanReason = payload.returnReason.trim();
  if (!cleanReason) {
    return { success: false, message: 'Please select a reason for your return or replacement request.' };
  }
  const win = getReturnWindowInfo(order);
  if (!win.eligible) {
    return {
      success: false,
      message: 'This order is outside the 7-day post-delivery return window.',
    };
  }
  const resolution = payload.returnResolution || 'Return';
  const nowIso = new Date().toISOString();
  const returnRequestId = `RET-${order.id}-${Date.now().toString(36).toUpperCase()}`;
  const cleanPhoto = (payload.returnProofPhoto || '').trim();

  // Always update localStore immediately
  requestOrderReturnLocal(order.id, {
    returnReason: cleanReason,
    returnResolution: resolution,
    returnProofPhoto: cleanPhoto || undefined,
    returnRequestId,
  });

  const docId = order.docId;
  if (!docId) {
    return {
      success: true,
      returnRequestId,
      message: `${resolution} request submitted for Order #${order.id}. Admin/Seller will review it within 24 hours.`,
    };
  }
  try {
    const orderPatch: Record<string, unknown> = {
      status: 'Return Requested',
      returnReason: cleanReason,
      returnResolution: resolution,
      returnRequestedAt: nowIso,
      returnRequestId,
      updatedAt: nowIso,
    };
    if (cleanPhoto) {
      orderPatch.returnProofPhoto = cleanPhoto;
    }

    await updateDoc(doc(db, 'orders', docId), orderPatch);

    // Create structured return request record in Firestore `return_requests` collection
    await setDoc(doc(db, 'return_requests', returnRequestId), {
      id: returnRequestId,
      orderId: order.id,
      orderDocId: docId,
      userId: order.userId || String(order.user_id),
      customerName: order.name,
      customerPhone: order.phone,
      resolution,
      reason: cleanReason,
      proofPhoto: cleanPhoto || null,
      status: 'Pending',
      sellerIds: order.sellerIds || [],
      sellerEmails: order.sellerEmails || [],
      items: order.items,
      totalAmount: Number(order.total_amount ?? order.total ?? 0),
      created_at: nowIso,
      updatedAt: nowIso,
    }).catch(() => {});

    return {
      success: true,
      returnRequestId,
      message: `${resolution} request #${returnRequestId} submitted for Order #${order.id}. Admin/Seller will review it within 24 hours.`,
    };
  } catch (err) {
    return {
      success: true,
      returnRequestId,
      message: `${resolution} request saved locally for Order #${order.id} (${getFirestoreErrorMessage(err)}).`,
    };
  }
}

export async function cancelOrderFirestore(
  order: Order,
  cancelReason?: string
): Promise<{ success: boolean; message: string }> {
  if (!isOrderCancellable(order)) {
    return {
      success: false,
      message: 'Orders that are already Out for Delivery or Delivered cannot be cancelled.',
    };
  }
  const cleanReason = (cancelReason || '').trim() || 'Cancelled by customer';
  const res = await updateOrderStatusFirestore(order, 'Cancelled', { cancelReason: cleanReason });
  if (!res.success) return res;
  return {
    success: true,
    message: `Order #${order.id} cancelled (${cleanReason}) and item stock restored.`,
  };
}

export function subscribeAllSellersFirestore(
  onData: (sellers: SellerProfile[]) => void,
  onError?: (message: string) => void
): () => void {
  const mergeWithLocal = (fsSellers: SellerProfile[]) => {
    const localList = getStoredSellersLocal();
    const byKey = new Map<string, SellerProfile>();
    localList.forEach((s) => {
      const k = (s.docId || s.uid || s.email || s.id).toLowerCase();
      byKey.set(k, { ...s, status: normalizeSellerStatus(s.status) });
    });
    fsSellers.forEach((s) => {
      const k = (s.docId || s.uid || s.email || s.id).toLowerCase();
      byKey.set(k, { ...s, status: normalizeSellerStatus(s.status) });
    });
    const merged = Array.from(byKey.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    cacheSellersLocal(merged);
    return merged;
  };

  // Emit local sellers immediately so UI is responsive even before snapshot arrives
  const initialLocal = getStoredSellersLocal();
  if (initialLocal.length > 0) {
    onData(initialLocal);
  }

  return onSnapshot(
    collection(db, 'sellers'),
    (snapshot) => {
      const fsList = snapshot.docs.map((d) => mapSellerDoc(d.id, d.data() as Record<string, unknown>));
      onData(mergeWithLocal(fsList));
    },
    (err) => {
      onData(getStoredSellersLocal());
      onError?.(getFirestoreErrorMessage(err));
    }
  );
}

export async function updateSellerStatusFirestore(
  seller: SellerProfile,
  status: 'approved' | 'pending' | 'blocked'
): Promise<{ success: boolean; message: string }> {
  const identifier = seller.docId || seller.uid || seller.id || seller.email;
  updateSellerStatusLocal(identifier, status);

  const docId = seller.docId || seller.uid || seller.id;
  if (!docId) {
    return { success: true, message: `${seller.storeName} marked as ${status}.` };
  }
  try {
    await setDoc(
      doc(db, 'sellers', docId),
      {
        status,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    return {
      success: true,
      message: `${seller.storeName} is now ${status === 'approved' ? 'Approved' : status === 'blocked' ? 'Blocked' : 'Pending'}.`,
    };
  } catch {
    return {
      success: true,
      message: `${seller.storeName} status updated to ${status} locally.`,
    };
  }
}

export async function getSellerProfileFirestore(
  uid?: string,
  email?: string
): Promise<SellerProfile | null> {
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanUid = (uid || '').trim();
  if (!cleanUid && !cleanEmail) return null;

  try {
    if (cleanUid) {
      const snap = await getDoc(doc(db, 'sellers', cleanUid));
      if (snap.exists()) {
        const mapped = mapSellerDoc(snap.id, snap.data() as Record<string, unknown>);
        saveSellerProfileLocal(mapped);
        return mapped;
      }
    }
    if (cleanEmail) {
      const q = query(collection(db, 'sellers'), where('email', '==', cleanEmail));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const first = snap.docs[0];
        const mapped = mapSellerDoc(first.id, first.data() as Record<string, unknown>);
        saveSellerProfileLocal(mapped);
        return mapped;
      }
    }
  } catch {
    // Gracefully fall back to localStore if Firestore rules restrict sellers collection
  }

  return getSellerByEmailOrUidLocal(cleanEmail, cleanUid);
}

export function subscribeSellerProfileFirestore(
  uid: string | undefined,
  email: string | undefined,
  onData: (seller: SellerProfile | null) => void
): () => void {
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanUid = (uid || '').trim();
  if (!cleanUid && !cleanEmail) {
    onData(null);
    return () => {};
  }

  const localInitial = getSellerByEmailOrUidLocal(cleanEmail, cleanUid);
  if (localInitial) {
    onData(localInitial);
  }

  if (cleanUid) {
    return onSnapshot(
      doc(db, 'sellers', cleanUid),
      (snap) => {
        if (snap.exists()) {
          const mapped = mapSellerDoc(snap.id, snap.data() as Record<string, unknown>);
          saveSellerProfileLocal(mapped);
          onData(mapped);
        } else {
          onData(getSellerByEmailOrUidLocal(cleanEmail, cleanUid));
        }
      },
      () => {
        onData(getSellerByEmailOrUidLocal(cleanEmail, cleanUid));
      }
    );
  }

  const q = query(collection(db, 'sellers'), where('email', '==', cleanEmail));
  return onSnapshot(
    q,
    (snap) => {
      if (!snap.empty) {
        const first = snap.docs[0];
        const mapped = mapSellerDoc(first.id, first.data() as Record<string, unknown>);
        saveSellerProfileLocal(mapped);
        onData(mapped);
      } else {
        onData(getSellerByEmailOrUidLocal(cleanEmail, cleanUid));
      }
    },
    () => {
      onData(getSellerByEmailOrUidLocal(cleanEmail, cleanUid));
    }
  );
}

export async function checkDuplicateMobileFirestore(
  rawPhone: string,
  options?: {
    excludeSellerEmail?: string;
    excludeSellerUid?: string;
    excludeRiderEmail?: string;
    excludeRiderId?: string;
  }
): Promise<{ available: boolean; reason?: string }> {
  const cleanPhone = rawPhone.replace(/\D/g, '').slice(-10);
  if (!isValidIndianMobile(cleanPhone)) {
    return {
      available: false,
      reason: 'Enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.',
    };
  }

  const exSellerEmail = (options?.excludeSellerEmail || '').trim().toLowerCase();
  const exSellerUid = (options?.excludeSellerUid || '').trim();
  const exRiderEmail = (options?.excludeRiderEmail || '').trim().toLowerCase();
  const exRiderId = (options?.excludeRiderId || '').trim();

  const matchesExcludedSeller = (rec: { email?: unknown; uid?: unknown; id?: unknown; docId?: unknown }) => {
    const email = String(rec.email || '').trim().toLowerCase();
    const uid = String(rec.uid || rec.id || rec.docId || '').trim();
    if (exSellerEmail && email && email === exSellerEmail) return true;
    if (exSellerUid && uid && uid === exSellerUid) return true;
    return false;
  };

  const matchesExcludedRider = (rec: { email?: unknown; id?: unknown; docId?: unknown; riderId?: unknown }) => {
    const email = String(rec.email || '').trim().toLowerCase();
    const rid = String(rec.id || rec.docId || rec.riderId || '').trim();
    if (exRiderEmail && email && email === exRiderEmail) return true;
    if (exRiderId && rid && rid === exRiderId) return true;
    return false;
  };

  // 1. Check local cache first for immediate feedback
  const localSellerDup = getStoredSellersLocal().find(
    (s) => s.phone.replace(/\D/g, '').slice(-10) === cleanPhone && !matchesExcludedSeller(s)
  );
  if (localSellerDup) {
    return {
      available: false,
      reason: 'This mobile number is already registered with an existing Seller account.',
    };
  }

  const localRiderDup = getStoredDeliveryBoysLocal().find(
    (r) =>
      r.phone.replace(/\D/g, '').slice(-10) === cleanPhone &&
      r.kycStatus !== 'rejected' &&
      !matchesExcludedRider(r)
  );
  if (localRiderDup) {
    return {
      available: false,
      reason: 'This mobile number is already registered with an existing Delivery Partner account.',
    };
  }

  // 2. Check Firestore live across sellers, deliveryBoys, and riders collections
  try {
    const [sellersSnap, deliveryBoysSnap, ridersSnap] = await Promise.all([
      getDocs(query(collection(db, 'sellers'), where('phone', '==', cleanPhone))).catch(() => null),
      getDocs(query(collection(db, 'deliveryBoys'), where('phone', '==', cleanPhone))).catch(() => null),
      getDocs(query(collection(db, 'riders'), where('phone', '==', cleanPhone))).catch(() => null),
    ]);

    if (sellersSnap && !sellersSnap.empty) {
      const conflict = sellersSnap.docs.some((d) => {
        const data = d.data() as Record<string, unknown>;
        return !matchesExcludedSeller({ ...data, id: d.id, docId: d.id });
      });
      if (conflict) {
        return {
          available: false,
          reason: 'This mobile number is already registered with an existing Seller account.',
        };
      }
    }

    const riderDocs = [
      ...(deliveryBoysSnap ? deliveryBoysSnap.docs : []),
      ...(ridersSnap ? ridersSnap.docs : []),
    ];
    if (riderDocs.length > 0) {
      const conflict = riderDocs.some((d) => {
        const data = d.data() as Record<string, unknown>;
        const kycStatus = String(data.kycStatus || 'approved').toLowerCase();
        if (kycStatus === 'rejected') return false;
        return !matchesExcludedRider({ ...data, id: d.id, docId: d.id });
      });
      if (conflict) {
        return {
          available: false,
          reason: 'This mobile number is already registered with an existing Delivery Partner account.',
        };
      }
    }
  } catch {
    // Allow graceful fallback if Firestore is temporarily unreachable
  }

  return { available: true };
}

export async function registerOrUpdateSellerFirestore(payload: {
  uid?: string;
  email: string;
  storeName: string;
  ownerName: string;
  phone: string;
  gstOrPan?: string;
  pickupAddress: string;
  pickupPincode?: string;
  payoutAccount: string;
}): Promise<{ success: boolean; message: string; seller?: SellerProfile }> {
  const cleanEmail = payload.email.trim().toLowerCase();
  const cleanStore = payload.storeName.trim();
  const cleanOwner = payload.ownerName.trim();
  const cleanPhone = payload.phone.replace(/\D/g, '').slice(-10) || payload.phone.trim();
  const cleanAddress = payload.pickupAddress.trim();
  const cleanPincode = (payload.pickupPincode || '').replace(/\D/g, '').slice(0, 6);
  const cleanPayoutAccount = (payload.payoutAccount || '').trim();

  if (!cleanEmail || cleanStore.length < 2) {
    return { success: false, message: 'Please enter a valid Store / Business Name and email.' };
  }
  if (cleanOwner.length < 2) {
    return { success: false, message: 'Please enter the Owner Full Name.' };
  }
  if (!isValidIndianMobile(cleanPhone)) {
    return {
      success: false,
      message: 'Please enter a valid 10-digit Indian Mobile Number starting with 6, 7, 8, or 9.',
    };
  }
  if (cleanAddress.length < 5) {
    return { success: false, message: 'Please enter your complete Pickup Address.' };
  }
  if (!isValidIndianPincodeFormat(cleanPincode)) {
    return {
      success: false,
      message: 'Please enter a valid 6-digit Indian Pickup Pincode (cannot start with 0).',
    };
  }
  if (cleanPayoutAccount.length < 3) {
    return { success: false, message: 'Please enter a valid Bank Account or UPI ID for payouts.' };
  }

  const dupCheck = await checkDuplicateMobileFirestore(cleanPhone, {
    excludeSellerEmail: cleanEmail,
    excludeSellerUid: payload.uid,
  });
  if (!dupCheck.available) {
    return {
      success: false,
      message: dupCheck.reason || 'This mobile number is already registered.',
    };
  }

  const docId = payload.uid || cleanEmail.replace(/[^a-z0-9]/g, '_');
  const nowIso = new Date().toISOString();

  // Preserve existing approval status if updating profile; default new sellers to 'pending'
  const existingLocal = getSellerByEmailOrUidLocal(cleanEmail, payload.uid);
  const resolvedStatus = existingLocal ? normalizeSellerStatus(existingLocal.status) : 'pending';

  // Always save locally first so seller onboarding works offline or under strict Firestore rules
  const localRes = saveSellerProfileLocal({
    id: docId,
    uid: payload.uid,
    docId,
    email: cleanEmail,
    storeName: cleanStore,
    ownerName: cleanOwner,
    phone: cleanPhone,
    gstOrPan: payload.gstOrPan?.trim() || '',
    pickupAddress: cleanAddress,
    pickupPincode: cleanPincode,
    payoutAccount: cleanPayoutAccount,
    status: resolvedStatus,
  });

  try {
    const existingSnap = await getDoc(doc(db, 'sellers', docId)).catch(() => null);
    const fsStatus =
      existingSnap && existingSnap.exists()
        ? normalizeSellerStatus(String((existingSnap.data() as Record<string, unknown>).status || resolvedStatus))
        : resolvedStatus;

    await setDoc(
      doc(db, 'sellers', docId),
      {
        id: docId,
        uid: payload.uid || docId,
        email: cleanEmail,
        storeName: cleanStore,
        ownerName: cleanOwner,
        phone: cleanPhone,
        gstOrPan: payload.gstOrPan?.trim() || '',
        pickupAddress: cleanAddress,
        pickupPincode: cleanPincode,
        payoutAccount: cleanPayoutAccount,
        totalPaidOut: localRes.seller?.totalPaidOut ?? 0,
        pendingPayoutAmount: localRes.seller?.pendingPayoutAmount ?? 0,
        payoutStatus: localRes.seller?.payoutStatus ?? 'none',
        payoutHistory: localRes.seller?.payoutHistory ?? [],
        status: fsStatus,
        created_at: localRes.seller?.created_at || nowIso,
        createdAt: localRes.seller?.created_at || nowIso,
        updatedAt: nowIso,
      },
      { merge: true }
    );

    if (localRes.seller && localRes.seller.status !== fsStatus) {
      updateSellerStatusLocal(docId, fsStatus);
      localRes.seller = { ...localRes.seller, status: fsStatus };
    }

    if (payload.uid) {
      await setDoc(
        doc(db, 'users', payload.uid),
        {
          isSeller: true,
          role: 'seller',
          sellerStoreName: cleanStore,
          updatedAt: nowIso,
        },
        { merge: true }
      ).catch(() => {});
    }
  } catch {
    // Already persisted in localStore; keep UX seamless
  }

  return localRes;
}

export async function requestSellerPayoutFirestore(
  seller: SellerProfile,
  amount: number,
  payoutAccount: string
): Promise<{ success: boolean; message: string; seller?: SellerProfile }> {
  const identifier = seller.docId || seller.uid || seller.id || seller.email;
  const localRes = requestSellerPayoutLocal(identifier, amount, payoutAccount);
  if (!localRes.success || !localRes.seller) {
    return localRes;
  }

  const docId = seller.docId || seller.uid || seller.id;
  if (!docId) return localRes;

  try {
    await setDoc(
      doc(db, 'sellers', docId),
      {
        payoutAccount: localRes.seller.payoutAccount,
        pendingPayoutAmount: localRes.seller.pendingPayoutAmount ?? 0,
        payoutStatus: 'requested',
        payoutRequestedAt: localRes.seller.payoutRequestedAt,
        payoutHistory: localRes.seller.payoutHistory ?? [],
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch {
    // Already persisted in localStore; keep UX seamless
  }

  return localRes;
}

export async function markSellerPayoutPaidFirestore(
  seller: SellerProfile,
  amountOverride?: number
): Promise<{ success: boolean; message: string; seller?: SellerProfile; paidAmount?: number }> {
  const identifier = seller.docId || seller.uid || seller.id || seller.email;
  const localRes = markSellerPayoutPaidLocal(identifier, amountOverride);
  if (!localRes.success || !localRes.seller) {
    return localRes;
  }

  const docId = seller.docId || seller.uid || seller.id;
  if (!docId) return localRes;

  try {
    await setDoc(
      doc(db, 'sellers', docId),
      {
        totalPaidOut: localRes.seller.totalPaidOut ?? 0,
        pendingPayoutAmount: 0,
        payoutStatus: 'paid',
        lastPayoutPaidAt: localRes.seller.lastPayoutPaidAt,
        payoutHistory: localRes.seller.payoutHistory ?? [],
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch {
    // Already persisted in localStore; keep UX seamless
  }

  return localRes;
}

export function filterOrderForSeller(
  ord: Order,
  sellerId: string,
  sellerEmail: string,
  sellerProductIds: Set<number>
): Order | null {
  const cleanEmail = sellerEmail.trim().toLowerCase();
  const cleanId = sellerId.trim();

  const ownItems = ord.items.filter((it) => {
    if (it.sellerEmail && cleanEmail && it.sellerEmail.trim().toLowerCase() === cleanEmail) return true;
    if (it.sellerId && cleanId && it.sellerId === cleanId) return true;
    if (sellerProductIds.has(it.product_id)) return true;
    return false;
  });

  if (ownItems.length === 0) return null;

  const sellerTotal = ownItems.reduce((sum, it) => sum + it.price * it.quantity, 0);
  return {
    ...ord,
    items: ownItems,
    total_amount: sellerTotal,
    total: sellerTotal,
  };
}

export function subscribeSellerOrdersFirestore(
  sellerId: string,
  sellerEmail: string,
  sellerProductIds: number[],
  onData: (orders: Order[]) => void,
  onError?: (message: string) => void
): () => void {
  const cleanEmail = sellerEmail.trim().toLowerCase();
  const prodIdSet = new Set(sellerProductIds);

  // Query orders tagged with this seller's email first; if security rules allow collection scan, also catch legacy items
  const ordersQuery = cleanEmail
    ? query(collection(db, 'orders'), where('sellerEmails', 'array-contains', cleanEmail))
    : collection(db, 'orders');

  return onSnapshot(
    ordersQuery,
    (snapshot) => {
      const scopedOrders: Order[] = [];
      snapshot.docs.forEach((d) => {
        const mapped = mapOrderDoc(d.id, d.data() as Record<string, unknown>);
        const filtered = filterOrderForSeller(mapped, sellerId, cleanEmail, prodIdSet);
        if (filtered) scopedOrders.push(filtered);
      });
      scopedOrders.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      onData(scopedOrders);
    },
    (err) => {
      onError?.(getFirestoreErrorMessage(err));
    }
  );
}

// =============================================================================
// HYBRID LOGISTICS: DELIVERY BOYS, KYC, COD CASH LEDGER, COURIER & LIVE GPS
// =============================================================================

function mapDeliveryBoyDoc(id: string, data: Record<string, unknown>): DeliveryBoy {
  const kycRaw = String(data.kycStatus || 'approved').toLowerCase();
  const kycStatus: RiderKycStatus =
    kycRaw === 'pending_kyc' || kycRaw === 'pending'
      ? 'pending_kyc'
      : kycRaw === 'rejected'
      ? 'rejected'
      : 'approved';

  const rawHistory = Array.isArray(data.cashSettlementHistory) ? data.cashSettlementHistory : [];
  const cashSettlementHistory: RiderCashSettlement[] = rawHistory
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    .map((item, idx) => ({
      id: typeof item.id === 'string' ? item.id : `cod_${idx}`,
      amount: Math.max(0, Number(item.amount || 0)),
      settledAt: typeof item.settledAt === 'string' ? item.settledAt : new Date().toISOString(),
      note: typeof item.note === 'string' ? item.note : undefined,
    }));

  const vehicleType = typeof data.vehicleType === 'string' ? data.vehicleType : undefined;
  const vehicleNumber = typeof data.vehicleNumber === 'string' ? data.vehicleNumber : undefined;
  const areaPincode = typeof data.areaPincode === 'string' ? data.areaPincode : undefined;
  const fallbackVehicleArea = [vehicleType, vehicleNumber, areaPincode].filter(Boolean).join(' • ');

  return {
    id: typeof data.id === 'string' && data.id ? data.id : id,
    docId: id,
    riderId: String(data.riderId || `RDR-${id.slice(-4).toUpperCase()}`).trim().toUpperCase(),
    name: String(data.name || 'Delivery Partner').trim(),
    phone: String(data.phone || '').trim(),
    email: String(data.email || '').trim().toLowerCase(),
    password: String(data.password || ''),
    vehicleType,
    vehicleNumber,
    areaPincode,
    vehicleArea: String(data.vehicleArea || fallbackVehicleArea || 'Local Delivery Zone').trim(),
    aadhaarNumber: typeof data.aadhaarNumber === 'string' ? data.aadhaarNumber : undefined,
    aadhaarPhoto: typeof data.aadhaarPhoto === 'string' ? data.aadhaarPhoto : undefined,
    drivingLicensePhoto: typeof data.drivingLicensePhoto === 'string' ? data.drivingLicensePhoto : undefined,
    selfiePhoto: typeof data.selfiePhoto === 'string' ? data.selfiePhoto : undefined,
    kycStatus,
    kycSubmittedAt: typeof data.kycSubmittedAt === 'string' ? data.kycSubmittedAt : undefined,
    kycReviewedAt: typeof data.kycReviewedAt === 'string' ? data.kycReviewedAt : undefined,
    kycRejectionReason: typeof data.kycRejectionReason === 'string' ? data.kycRejectionReason : undefined,
    codCashInHand: Math.max(0, Math.round(Number(data.codCashInHand || 0) * 100) / 100),
    totalCodSettled: Math.max(0, Math.round(Number(data.totalCodSettled || 0) * 100) / 100),
    lastCashSettledAt: typeof data.lastCashSettledAt === 'string' ? data.lastCashSettledAt : undefined,
    cashSettlementHistory,
    status: data.status === 'inactive' ? 'inactive' : 'active',
    created_at: String(data.created_at || data.createdAt || new Date().toISOString()),
  };
}

export function subscribeDeliveryBoysFirestore(
  onData: (riders: DeliveryBoy[]) => void,
  onError?: (message: string) => void
): () => void {
  const localInitial = getStoredDeliveryBoysLocal();
  if (localInitial.length > 0) {
    onData(localInitial);
  }

  return onSnapshot(
    collection(db, 'deliveryBoys'),
    (snapshot) => {
      const remoteList = snapshot.docs.map((d) =>
        mapDeliveryBoyDoc(d.id, d.data() as Record<string, unknown>)
      );
      if (remoteList.length > 0) {
        cacheDeliveryBoysLocal(remoteList);
      }
      const merged = getStoredDeliveryBoysLocal();
      onData(merged.length > 0 ? merged : remoteList);
    },
    (err) => {
      onData(getStoredDeliveryBoysLocal());
      onError?.(getFirestoreErrorMessage(err));
    }
  );
}

export async function saveDeliveryBoyFirestore(payload: {
  id?: string;
  docId?: string;
  riderId?: string;
  name: string;
  phone: string;
  email?: string;
  password: string;
  vehicleType?: string;
  vehicleNumber?: string;
  areaPincode?: string;
  vehicleArea: string;
  aadhaarNumber?: string;
  aadhaarPhoto?: string;
  drivingLicensePhoto?: string;
  selfiePhoto?: string;
  kycStatus?: RiderKycStatus;
  status?: 'active' | 'inactive';
}): Promise<{ success: boolean; message: string; rider?: DeliveryBoy }> {
  const localRes = saveDeliveryBoyLocal(payload);
  if (!localRes.success || !localRes.rider) {
    return localRes;
  }

  const rider = localRes.rider;
  const docId = rider.docId || rider.id;
  try {
    await setDoc(
      doc(db, 'deliveryBoys', docId),
      {
        id: rider.id,
        riderId: rider.riderId,
        name: rider.name,
        phone: rider.phone,
        email: rider.email,
        password: rider.password,
        vehicleType: rider.vehicleType || '',
        vehicleNumber: rider.vehicleNumber || '',
        areaPincode: rider.areaPincode || '',
        vehicleArea: rider.vehicleArea,
        aadhaarNumber: rider.aadhaarNumber || '',
        aadhaarPhoto: rider.aadhaarPhoto || '',
        drivingLicensePhoto: rider.drivingLicensePhoto || '',
        selfiePhoto: rider.selfiePhoto || '',
        kycStatus: rider.kycStatus,
        kycSubmittedAt: rider.kycSubmittedAt || rider.created_at,
        kycReviewedAt: rider.kycReviewedAt || '',
        codCashInHand: rider.codCashInHand ?? 0,
        totalCodSettled: rider.totalCodSettled ?? 0,
        cashSettlementHistory: rider.cashSettlementHistory ?? [],
        status: rider.status,
        created_at: rider.created_at,
        createdAt: rider.created_at,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch {
    // Persisted locally; keep UI seamless
  }

  return localRes;
}

export async function submitRiderKycApplicationFirestore(payload: {
  name: string;
  phone: string;
  email?: string;
  areaPincode: string;
  vehicleType: string;
  vehicleNumber: string;
  aadhaarNumber: string;
  aadhaarPhoto: string;
  drivingLicensePhoto: string;
  selfiePhoto: string;
  loginPin: string;
}): Promise<{ success: boolean; message: string; rider?: DeliveryBoy }> {
  const dupCheck = await checkDuplicateMobileFirestore(payload.phone);
  if (!dupCheck.available) {
    return {
      success: false,
      message: dupCheck.reason || 'This mobile number is already registered.',
    };
  }

  const localRes = submitRiderKycApplicationLocal(payload);
  if (!localRes.success || !localRes.rider) {
    return localRes;
  }

  const rider = localRes.rider;
  const docId = rider.docId || rider.id;
  try {
    await setDoc(
      doc(db, 'deliveryBoys', docId),
      {
        id: rider.id,
        riderId: rider.riderId,
        name: rider.name,
        phone: rider.phone,
        email: rider.email,
        password: rider.password,
        vehicleType: rider.vehicleType || '',
        vehicleNumber: rider.vehicleNumber || '',
        areaPincode: rider.areaPincode || '',
        vehicleArea: rider.vehicleArea,
        aadhaarNumber: rider.aadhaarNumber || '',
        aadhaarPhoto: rider.aadhaarPhoto || '',
        drivingLicensePhoto: rider.drivingLicensePhoto || '',
        selfiePhoto: rider.selfiePhoto || '',
        kycStatus: 'pending_kyc',
        kycSubmittedAt: rider.kycSubmittedAt || rider.created_at,
        codCashInHand: 0,
        totalCodSettled: 0,
        cashSettlementHistory: [],
        status: 'inactive',
        created_at: rider.created_at,
        createdAt: rider.created_at,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch {
    // Persisted locally; keep UI seamless
  }

  return localRes;
}

export async function reviewRiderKycFirestore(
  rider: DeliveryBoy,
  decision: 'approved' | 'rejected',
  reason?: string
): Promise<{ success: boolean; message: string; rider?: DeliveryBoy }> {
  const docId = rider.docId || rider.id;
  const localRes = reviewRiderKycLocal(docId, decision, reason);
  try {
    await setDoc(
      doc(db, 'deliveryBoys', docId),
      {
        kycStatus: decision,
        kycReviewedAt: new Date().toISOString(),
        kycRejectionReason: decision === 'rejected' ? (reason || 'KYC documents did not pass verification.').trim() : '',
        status: decision === 'approved' ? 'active' : 'inactive',
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch {
    // Local fallback already applied
  }
  return localRes;
}

export async function toggleDeliveryBoyStatusFirestore(
  rider: DeliveryBoy,
  status: 'active' | 'inactive'
): Promise<{ success: boolean; message: string }> {
  const docId = rider.docId || rider.id;
  const localRes = toggleDeliveryBoyStatusLocal(docId, status);
  try {
    await setDoc(
      doc(db, 'deliveryBoys', docId),
      {
        status,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch {
    // Local fallback already applied
  }
  return localRes;
}

export async function deleteDeliveryBoyFirestore(rider: DeliveryBoy): Promise<{ success: boolean; message: string }> {
  const docId = rider.docId || rider.id;
  deleteDeliveryBoyLocal(docId);
  try {
    await deleteDoc(doc(db, 'deliveryBoys', docId));
  } catch {
    // Local fallback already applied
  }
  return { success: true, message: `${rider.name} removed.` };
}

export async function authenticateDeliveryBoyFirestore(
  identifier: string,
  password: string
): Promise<{ success: boolean; message: string; rider?: DeliveryBoy; pendingKyc?: boolean }> {
  let remoteList: DeliveryBoy[] = [];
  try {
    const snap = await getDocs(collection(db, 'deliveryBoys'));
    remoteList = snap.docs.map((d) => mapDeliveryBoyDoc(d.id, d.data() as Record<string, unknown>));
    if (remoteList.length > 0) {
      cacheDeliveryBoysLocal(remoteList);
    }
  } catch {
    // Fallback to local cache
  }
  const merged = getStoredDeliveryBoysLocal();
  return authenticateDeliveryBoyLocal(identifier, password, merged.length > 0 ? merged : remoteList);
}

export async function settleRiderCodCashFirestore(
  rider: DeliveryBoy,
  note?: string
): Promise<{ success: boolean; message: string; settledAmount?: number; rider?: DeliveryBoy }> {
  const docId = rider.docId || rider.id;
  const localRes = settleRiderCodCashLocal(docId, note);
  if (!localRes.success || !localRes.rider) {
    return localRes;
  }
  try {
    await setDoc(
      doc(db, 'deliveryBoys', docId),
      {
        codCashInHand: 0,
        totalCodSettled: localRes.rider.totalCodSettled ?? 0,
        lastCashSettledAt: localRes.rider.lastCashSettledAt || new Date().toISOString(),
        cashSettlementHistory: localRes.rider.cashSettlementHistory ?? [],
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch {
    // Local fallback already applied
  }
  return localRes;
}

export async function assignOrderRiderFirestore(
  order: Order,
  rider: DeliveryBoy | null
): Promise<{ success: boolean; message: string; otp?: string }> {
  const otpToUse = order.deliveryOtp || generateDeliveryOtp();
  const localRes = assignOrderRiderLocal(order.id, rider, otpToUse);
  const nowIso = new Date().toISOString();

  if (!order.docId) {
    return localRes;
  }

  try {
    if (!rider) {
      await updateDoc(doc(db, 'orders', order.docId), {
        dispatchMode: order.trackingId ? 'courier' : '',
        deliveryBoyId: '',
        deliveryBoyName: '',
        deliveryBoyPhone: '',
        deliveryBoyEmail: '',
        deliveryBoyVehicle: '',
        deliveryAssignedAt: '',
        riderLiveLat: null,
        riderLiveLng: null,
        riderLocationUpdatedAt: '',
        updatedAt: nowIso,
      });
      return { success: true, message: `Rider unassigned from Order #${order.id}.`, otp: otpToUse };
    }

    await updateDoc(doc(db, 'orders', order.docId), {
      dispatchMode: 'rider',
      deliveryBoyId: rider.docId || rider.id,
      deliveryBoyName: rider.name,
      deliveryBoyPhone: rider.phone,
      deliveryBoyEmail: rider.email || '',
      deliveryBoyVehicle: rider.vehicleArea,
      deliveryAssignedAt: nowIso,
      deliveryOtp: otpToUse,
      deliveryOtpVerified: false,
      pincode: extractPincodeFromAddress(order.address, order.pincode),
      courierName: 'Smart Basket Rider',
      trackingNote: `Assigned to Delivery Partner ${rider.name}`,
      updatedAt: nowIso,
    });
    return {
      success: true,
      message: `Order #${order.id} assigned to ${rider.name}. Delivery OTP: ${otpToUse}`,
      otp: otpToUse,
    };
  } catch (err) {
    return { success: false, message: getFirestoreErrorMessage(err) };
  }
}

export async function shipOrderViaCourierFirestore(
  order: Order,
  payload: {
    courierName: string;
    trackingId: string;
    trackingUrl?: string;
    trackingNote?: string;
  }
): Promise<{ success: boolean; message: string }> {
  const cleanCourier = payload.courierName.trim();
  const cleanAwb = payload.trackingId.trim();
  if (!cleanCourier || !cleanAwb) {
    return { success: false, message: 'Courier Partner Name and AWB Tracking Number are required.' };
  }

  const localRes = shipOrderViaCourierLocal(order.id, payload);
  if (!order.docId) {
    return localRes;
  }

  const nowIso = new Date().toISOString();
  try {
    await updateDoc(doc(db, 'orders', order.docId), {
      dispatchMode: 'courier',
      status: 'Shipped',
      courierName: cleanCourier,
      trackingId: cleanAwb,
      trackingUrl: (payload.trackingUrl || '').trim(),
      trackingNote: (payload.trackingNote || '').trim() || `Dispatched via ${cleanCourier}`,
      deliveryBoyId: '',
      deliveryBoyName: '',
      deliveryBoyPhone: '',
      deliveryBoyEmail: '',
      deliveryBoyVehicle: '',
      riderLiveLat: null,
      riderLiveLng: null,
      riderLocationUpdatedAt: '',
      updatedAt: nowIso,
    });
    return {
      success: true,
      message: `Order #${order.id} dispatched via ${cleanCourier} (AWB: ${cleanAwb}).`,
    };
  } catch (err) {
    return { success: false, message: getFirestoreErrorMessage(err) };
  }
}

export function subscribeRiderOrdersFirestore(
  rider: DeliveryBoy,
  onData: (orders: Order[]) => void,
  onError?: (message: string) => void
): () => void {
  const riderKeys = new Set(
    [rider.docId, rider.id, rider.riderId].filter((v): v is string => Boolean(v && v.trim()))
  );
  const cleanPhone = rider.phone.replace(/\D/g, '').slice(-10);

  const matchesRider = (ord: Order): boolean => {
    if (ord.deliveryBoyId && riderKeys.has(ord.deliveryBoyId)) return true;
    if (
      cleanPhone.length >= 10 &&
      ord.deliveryBoyPhone &&
      ord.deliveryBoyPhone.replace(/\D/g, '').slice(-10) === cleanPhone
    ) {
      return true;
    }
    return false;
  };

  const localMatches = getStoredOrdersLocal()
    .filter(matchesRider)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  if (localMatches.length > 0) {
    onData(localMatches);
  }

  return onSnapshot(
    collection(db, 'orders'),
    (snapshot) => {
      const list = snapshot.docs
        .map((d) => mapOrderDoc(d.id, d.data() as Record<string, unknown>))
        .filter(matchesRider)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      onData(list);
    },
    (err) => {
      const fallback = getStoredOrdersLocal()
        .filter(matchesRider)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      onData(fallback);
      onError?.(getFirestoreErrorMessage(err));
    }
  );
}

export async function markOrderOutForDeliveryFirestore(
  order: Order,
  coords?: { lat: number; lng: number } | null
): Promise<{ success: boolean; message: string }> {
  const localRes = markOrderOutForDeliveryLocal(order.id, coords);
  if (!order.docId) return localRes;

  const nowIso = new Date().toISOString();
  const updatePayload: Record<string, unknown> = {
    status: 'Out for Delivery',
    deliveryOutForDeliveryAt: nowIso,
    trackingNote: order.deliveryBoyName
      ? `Out for Delivery with ${order.deliveryBoyName}`
      : 'Out for Delivery',
    updatedAt: nowIso,
  };
  if (coords && Number.isFinite(coords.lat) && Number.isFinite(coords.lng)) {
    updatePayload.riderLiveLat = coords.lat;
    updatePayload.riderLiveLng = coords.lng;
    updatePayload.riderLocationUpdatedAt = nowIso;
  }

  try {
    await updateDoc(doc(db, 'orders', order.docId), updatePayload);
    return {
      success: true,
      message: coords
        ? `Order #${order.id} marked Out for Delivery with Live GPS tracking active!`
        : `Order #${order.id} marked Out for Delivery.`,
    };
  } catch (err) {
    return { success: false, message: getFirestoreErrorMessage(err) };
  }
}

export async function updateOrderRiderLocationFirestore(
  order: Order,
  lat: number,
  lng: number
): Promise<{ success: boolean; message: string }> {
  updateOrderRiderLocationLocal(order.id, lat, lng);
  if (!order.docId) {
    return { success: true, message: 'Live GPS location shared with customer.' };
  }
  const nowIso = new Date().toISOString();
  try {
    await updateDoc(doc(db, 'orders', order.docId), {
      riderLiveLat: lat,
      riderLiveLng: lng,
      riderLocationUpdatedAt: nowIso,
      updatedAt: nowIso,
    });
    return { success: true, message: 'Live GPS coordinates updated for customer!' };
  } catch (err) {
    return { success: false, message: getFirestoreErrorMessage(err) };
  }
}

export async function verifyAndDeliverOrderFirestore(
  order: Order,
  enteredOtp: string,
  rider?: DeliveryBoy | null
): Promise<{ success: boolean; message: string; codCollected?: number }> {
  const cleanEntered = enteredOtp.replace(/\D/g, '').slice(0, 4);
  if (cleanEntered.length !== 4) {
    return { success: false, message: 'Please enter the 4-digit Delivery OTP provided by the customer.' };
  }
  const expectedOtp = (order.deliveryOtp || '').trim();
  if (expectedOtp && cleanEntered !== expectedOtp) {
    return { success: false, message: 'Incorrect Delivery OTP. Please verify the 4-digit code with the customer.' };
  }

  const wasAlreadyDelivered = order.status === 'Delivered';
  const isCod = !isOnlinePaidOrder(order);
  const codAmount = !wasAlreadyDelivered && isCod ? Math.max(0, Number(order.total_amount ?? order.total ?? 0)) : 0;
  const riderDocId = rider?.docId || rider?.id || order.deliveryBoyId;

  const localRes = verifyAndDeliverOrderLocal(
    order.id,
    cleanEntered,
    expectedOtp,
    riderDocId,
    codAmount
  );
  if (!localRes.success) return localRes;

  const nowIso = new Date().toISOString();

  if (order.docId) {
    try {
      await updateDoc(doc(db, 'orders', order.docId), {
        status: 'Delivered',
        deliveryOtpVerified: true,
        deliveredAt: nowIso,
        trackingNote: order.deliveryBoyName
          ? `Delivered by ${order.deliveryBoyName} (OTP Verified)`
          : 'Delivered (OTP Verified)',
        updatedAt: nowIso,
      });
    } catch (err) {
      return { success: false, message: getFirestoreErrorMessage(err) };
    }
  }

  // Auto-increment rider's COD Cash in Hand in Firestore when COD order is delivered
  if (codAmount > 0 && riderDocId) {
    try {
      const riderRef = doc(db, 'deliveryBoys', riderDocId);
      let currentCash = Number(rider?.codCashInHand || 0);
      try {
        const snap = await getDoc(riderRef);
        if (snap.exists()) {
          const d = snap.data() as Record<string, unknown>;
          if (typeof d.codCashInHand === 'number' && Number.isFinite(d.codCashInHand)) {
            currentCash = d.codCashInHand;
          }
        }
      } catch {
        // use local/known balance
      }
      const nextCash = Math.round((currentCash + codAmount) * 100) / 100;
      await setDoc(
        riderRef,
        {
          codCashInHand: nextCash,
          updatedAt: nowIso,
        },
        { merge: true }
      );
      // Ensure local cache stays aligned
      if (!localRes.codCollected) {
        recordRiderCodCollectionLocal(riderDocId, codAmount);
      }
    } catch {
      // Local store already updated
    }
  }

  return {
    success: true,
    codCollected: codAmount,
    message:
      codAmount > 0
        ? `Order #${order.id} delivered! ₹${codAmount.toLocaleString('en-IN')} added to COD Cash in Hand.`
        : `Order #${order.id} verified & marked Delivered!`,
  };
}

// ==================== DELIVERY SETTINGS (settings/delivery) ====================

function mapDeliverySettingsDoc(data?: Record<string, unknown> | null): DeliverySettings {
  if (!data) return DEFAULT_DELIVERY_SETTINGS;
  const freeDeliveryThreshold =
    typeof data.freeDeliveryThreshold === 'number' && Number.isFinite(data.freeDeliveryThreshold)
      ? Math.max(0, Math.round(data.freeDeliveryThreshold))
      : DEFAULT_DELIVERY_SETTINGS.freeDeliveryThreshold;
  const deliveryCharge =
    typeof data.deliveryCharge === 'number' && Number.isFinite(data.deliveryCharge)
      ? Math.max(0, Math.round(data.deliveryCharge))
      : DEFAULT_DELIVERY_SETTINGS.deliveryCharge;
  const platformFee =
    typeof data.platformFee === 'number' && Number.isFinite(data.platformFee)
      ? Math.max(0, Math.round(data.platformFee))
      : DEFAULT_DELIVERY_SETTINGS.platformFee;
  return {
    freeDeliveryThreshold,
    deliveryCharge,
    platformFee,
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : undefined,
  };
}

export function subscribeDeliverySettingsFirestore(
  onData: (settings: DeliverySettings) => void,
  onError?: (message: string) => void
): () => void {
  onData(getDeliverySettingsLocal());
  const ref = doc(db, 'settings', 'delivery');
  return onSnapshot(
    ref,
    (snap) => {
      if (snap.exists()) {
        const mapped = mapDeliverySettingsDoc(snap.data() as Record<string, unknown>);
        saveDeliverySettingsLocal(mapped);
        onData(mapped);
      } else {
        const fallback = getDeliverySettingsLocal();
        onData(fallback);
      }
    },
    (err) => {
      onData(getDeliverySettingsLocal());
      onError?.(getFirestoreErrorMessage(err));
    }
  );
}

export async function saveDeliverySettingsFirestore(
  settings: DeliverySettings
): Promise<{ success: boolean; message: string; settings: DeliverySettings }> {
  const clean: DeliverySettings = {
    freeDeliveryThreshold: Math.max(0, Math.round(Number(settings.freeDeliveryThreshold) || 0)),
    deliveryCharge: Math.max(0, Math.round(Number(settings.deliveryCharge) || 0)),
    platformFee: Math.max(0, Math.round(Number(settings.platformFee) || 0)),
    updatedAt: new Date().toISOString(),
  };
  saveDeliverySettingsLocal(clean);
  try {
    await setDoc(doc(db, 'settings', 'delivery'), clean, { merge: true });
    return {
      success: true,
      settings: clean,
      message: `Delivery settings saved! Free delivery above ₹${clean.freeDeliveryThreshold.toLocaleString('en-IN')}.`,
    };
  } catch (err) {
    return {
      success: true,
      settings: clean,
      message: `Saved locally (${getFirestoreErrorMessage(err)})`,
    };
  }
}

// ==================== PROMO CODES (promo_codes) ====================

let promoSeedAttempted = false;

function mapPromoCodeDoc(docId: string, data: Record<string, unknown>): PromoCode {
  const code = String(data.code || docId).trim().toUpperCase();
  const discountType: 'flat' | 'percent' = data.discountType === 'percent' ? 'percent' : 'flat';
  return {
    id: String(data.id || docId),
    docId,
    code,
    discountType,
    discountValue: Math.max(0, Number(data.discountValue ?? 0)),
    maxDiscount:
      data.maxDiscount !== undefined && data.maxDiscount !== null && Number(data.maxDiscount) > 0
        ? Number(data.maxDiscount)
        : undefined,
    minOrderValue: Math.max(0, Number(data.minOrderValue ?? 0)),
    description: typeof data.description === 'string' ? data.description : undefined,
    active: data.active !== false,
    usedCount: Math.max(0, Number(data.usedCount ?? 0)),
    created_at: typeof data.created_at === 'string' ? data.created_at : new Date().toISOString(),
  };
}

export function subscribePromoCodesFirestore(
  onData: (promos: PromoCode[]) => void,
  onError?: (message: string) => void
): () => void {
  onData(getPromoCodesLocal());
  return onSnapshot(
    collection(db, 'promo_codes'),
    async (snapshot) => {
      if (snapshot.empty && !promoSeedAttempted) {
        promoSeedAttempted = true;
        try {
          const batch = writeBatch(db);
          DEFAULT_PROMO_CODES.forEach((p) => {
            batch.set(doc(db, 'promo_codes', p.code), {
              id: p.id,
              code: p.code,
              discountType: p.discountType,
              discountValue: p.discountValue,
              ...(p.maxDiscount ? { maxDiscount: p.maxDiscount } : {}),
              minOrderValue: p.minOrderValue,
              description: p.description || '',
              active: p.active,
              usedCount: p.usedCount || 0,
              created_at: p.created_at,
            });
          });
          await batch.commit();
        } catch {
          // Use local defaults if seeding is restricted
        }
        const localPromos = getPromoCodesLocal();
        onData(localPromos);
        return;
      }

      const list = snapshot.docs
        .map((d) => mapPromoCodeDoc(d.id, d.data() as Record<string, unknown>))
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      savePromoCodesLocal(list);
      onData(list);
    },
    (err) => {
      onData(getPromoCodesLocal());
      onError?.(getFirestoreErrorMessage(err));
    }
  );
}

export async function savePromoCodeFirestore(input: {
  id?: string;
  docId?: string;
  code: string;
  discountType: 'flat' | 'percent';
  discountValue: number;
  maxDiscount?: number;
  minOrderValue: number;
  description?: string;
  active: boolean;
}): Promise<{ success: boolean; message: string; promo?: PromoCode }> {
  const cleanCode = input.code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  if (cleanCode.length < 3) {
    return { success: false, message: 'Promo code must be at least 3 alphanumeric characters.' };
  }
  const discountVal = Math.round(Number(input.discountValue) || 0);
  if (discountVal <= 0) {
    return { success: false, message: 'Discount value must be greater than 0.' };
  }
  if (input.discountType === 'percent' && discountVal > 90) {
    return { success: false, message: 'Percentage discount cannot exceed 90%.' };
  }
  const minOrder = Math.max(0, Math.round(Number(input.minOrderValue) || 0));
  const maxDisc =
    input.discountType === 'percent' && input.maxDiscount && Number(input.maxDiscount) > 0
      ? Math.round(Number(input.maxDiscount))
      : undefined;

  const existingList = getPromoCodesLocal();
  const existing = existingList.find(
    (p) => p.code.toUpperCase() === cleanCode || (input.docId && p.docId === input.docId)
  );
  const nowIso = new Date().toISOString();
  const docId = input.docId || cleanCode;

  const promo: PromoCode = {
    id: existing?.id || docId,
    docId,
    code: cleanCode,
    discountType: input.discountType,
    discountValue: discountVal,
    maxDiscount: maxDisc,
    minOrderValue: minOrder,
    description:
      input.description?.trim() ||
      (input.discountType === 'percent'
        ? `${discountVal}% OFF${maxDisc ? ` up to ₹${maxDisc}` : ''} on orders above ₹${minOrder}`
        : `Flat ₹${discountVal} OFF on orders above ₹${minOrder}`),
    active: input.active,
    usedCount: existing?.usedCount || 0,
    created_at: existing?.created_at || nowIso,
  };

  const nextLocal = [
    promo,
    ...existingList.filter((p) => p.docId !== docId && p.code.toUpperCase() !== cleanCode),
  ];
  savePromoCodesLocal(nextLocal);

  try {
    const payload: Record<string, unknown> = {
      id: promo.id,
      code: promo.code,
      discountType: promo.discountType,
      discountValue: promo.discountValue,
      minOrderValue: promo.minOrderValue,
      description: promo.description || '',
      active: promo.active,
      usedCount: promo.usedCount || 0,
      created_at: promo.created_at,
      updatedAt: nowIso,
    };
    if (maxDisc) {
      payload.maxDiscount = maxDisc;
    }
    await setDoc(doc(db, 'promo_codes', docId), payload, { merge: true });
    return { success: true, promo, message: `Promo code ${cleanCode} saved & synced!` };
  } catch (err) {
    return {
      success: true,
      promo,
      message: `Promo code ${cleanCode} saved locally (${getFirestoreErrorMessage(err)})`,
    };
  }
}

export async function togglePromoCodeActiveFirestore(
  promo: PromoCode
): Promise<{ success: boolean; message: string }> {
  const nextActive = !promo.active;
  const docId = promo.docId || promo.code;
  const list = getPromoCodesLocal().map((p) =>
    p.code === promo.code || p.docId === docId ? { ...p, active: nextActive } : p
  );
  savePromoCodesLocal(list);

  try {
    await updateDoc(doc(db, 'promo_codes', docId), {
      active: nextActive,
      updatedAt: new Date().toISOString(),
    });
    return {
      success: true,
      message: `Promo code ${promo.code} ${nextActive ? 'activated' : 'disabled'}.`,
    };
  } catch (err) {
    return {
      success: true,
      message: `Updated locally (${getFirestoreErrorMessage(err)})`,
    };
  }
}

export async function deletePromoCodeFirestore(
  promo: PromoCode
): Promise<{ success: boolean; message: string }> {
  const docId = promo.docId || promo.code;
  const list = getPromoCodesLocal().filter((p) => p.code !== promo.code && p.docId !== docId);
  savePromoCodesLocal(list);
  try {
    await deleteDoc(doc(db, 'promo_codes', docId));
    return { success: true, message: `Promo code ${promo.code} deleted.` };
  } catch (err) {
    return { success: true, message: `Removed locally (${getFirestoreErrorMessage(err)})` };
  }
}

export async function incrementPromoCodeUsageFirestore(promoCode?: string): Promise<void> {
  const cleanCode = (promoCode || '').trim().toUpperCase();
  if (!cleanCode) return;
  const list = getPromoCodesLocal().map((p) =>
    p.code.toUpperCase() === cleanCode ? { ...p, usedCount: (p.usedCount || 0) + 1 } : p
  );
  savePromoCodesLocal(list);
  const matched = list.find((p) => p.code.toUpperCase() === cleanCode);
  const docId = matched?.docId || cleanCode;
  try {
    await updateDoc(doc(db, 'promo_codes', docId), {
      usedCount: increment(1),
      updatedAt: new Date().toISOString(),
    });
  } catch {
    // non-fatal
  }
}

// ==================== WISHLISTS (wishlists/{uid}) ====================

export function subscribeUserWishlistFirestore(
  uid: string | undefined,
  onData: (productIds: number[]) => void
): () => void {
  const localIds = getWishlistIdsLocal();
  onData(localIds);
  if (!uid) {
    return () => {};
  }
  const ref = doc(db, 'wishlists', uid);
  return onSnapshot(
    ref,
    (snap) => {
      if (snap.exists()) {
        const data = snap.data() as Record<string, unknown>;
        const raw = Array.isArray(data.productIds) ? data.productIds : [];
        const clean = Array.from(
          new Set(raw.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0))
        );
        saveWishlistIdsLocal(clean);
        onData(clean);
      }
    },
    () => {
      onData(getWishlistIdsLocal());
    }
  );
}

export async function setUserWishlistFirestore(
  uid: string | undefined,
  productIds: number[]
): Promise<{ success: boolean; ids: number[] }> {
  const clean = Array.from(
    new Set(productIds.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0))
  );
  saveWishlistIdsLocal(clean);
  if (!uid) {
    return { success: true, ids: clean };
  }
  try {
    await setDoc(
      doc(db, 'wishlists', uid),
      {
        userId: uid,
        productIds: clean,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    return { success: true, ids: clean };
  } catch {
    return { success: true, ids: clean };
  }
}

export async function toggleWishlistItemFirestore(
  uid: string | undefined,
  currentIds: number[],
  productId: number
): Promise<{ added: boolean; ids: number[] }> {
  const exists = currentIds.includes(productId);
  const nextIds = exists
    ? currentIds.filter((id) => id !== productId)
    : [productId, ...currentIds];
  await setUserWishlistFirestore(uid, nextIds);
  return { added: !exists, ids: nextIds };
}

// ==================== MULTIPLE SAVED ADDRESSES (users/{uid}) ====================

function sanitizeAddressesList(raw: unknown): SavedAddress[] {
  if (!Array.isArray(raw)) return [];
  const valid: SavedAddress[] = [];
  raw.forEach((item, idx) => {
    if (!item || typeof item !== 'object') return;
    const obj = item as Record<string, unknown>;
    const houseStreet = String(obj.houseStreet || '').trim();
    const pincode = String(obj.pincode || '').replace(/\D/g, '').slice(0, 6);
    if (!houseStreet && !pincode) return;
    const labelRaw = String(obj.label || 'Home');
    const label: 'Home' | 'Work' | 'Other' =
      labelRaw === 'Work' || labelRaw === 'Other' ? labelRaw : 'Home';
    valid.push({
      id: String(obj.id || `addr_${Date.now()}_${idx}`),
      label,
      name: String(obj.name || '').trim(),
      phone: String(obj.phone || '').trim(),
      houseStreet,
      area: typeof obj.area === 'string' && obj.area.trim() ? obj.area.trim() : undefined,
      city: String(obj.city || 'New Delhi').trim(),
      state: typeof obj.state === 'string' && obj.state.trim() ? obj.state.trim() : undefined,
      pincode: pincode || '110039',
      isDefault: Boolean(obj.isDefault),
      updatedAt: typeof obj.updatedAt === 'string' ? obj.updatedAt : undefined,
    });
  });
  if (valid.length > 0 && !valid.some((a) => a.isDefault)) {
    valid[0].isDefault = true;
  }
  return valid;
}

export function subscribeUserAddressesFirestore(
  uid: string | undefined,
  onData: (addresses: SavedAddress[]) => void
): () => void {
  onData(getSavedAddressesLocal());
  if (!uid) return () => {};
  return onSnapshot(
    doc(db, 'users', uid),
    (snap) => {
      if (snap.exists()) {
        const data = snap.data() as Record<string, unknown>;
        if (Array.isArray(data.savedAddresses)) {
          const parsed = sanitizeAddressesList(data.savedAddresses);
          saveAddressesLocal(parsed);
          onData(parsed);
        }
      }
    },
    () => {
      onData(getSavedAddressesLocal());
    }
  );
}

export async function saveUserAddressesFirestore(
  uid: string | undefined,
  addresses: SavedAddress[]
): Promise<{ success: boolean; addresses: SavedAddress[]; message: string }> {
  const clean = sanitizeAddressesList(addresses);
  saveAddressesLocal(clean);
  if (!uid) {
    return { success: true, addresses: clean, message: 'Address saved on this device.' };
  }
  const defaultAddr = clean.find((a) => a.isDefault) || clean[0];
  try {
    await setDoc(
      doc(db, 'users', uid),
      {
        savedAddresses: clean.map((a) => ({
          id: a.id,
          label: a.label,
          name: a.name,
          phone: a.phone,
          houseStreet: a.houseStreet,
          area: a.area || '',
          city: a.city,
          state: a.state || '',
          pincode: a.pincode,
          isDefault: Boolean(a.isDefault),
          updatedAt: a.updatedAt || new Date().toISOString(),
        })),
        ...(defaultAddr
          ? {
              address: `${defaultAddr.houseStreet}${defaultAddr.area ? `, ${defaultAddr.area}` : ''}, ${defaultAddr.city}${defaultAddr.state ? `, ${defaultAddr.state}` : ''} - ${defaultAddr.pincode}`,
            }
          : {}),
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    return { success: true, addresses: clean, message: 'Saved addresses synced to your account.' };
  } catch (err) {
    return {
      success: true,
      addresses: clean,
      message: `Address saved locally (${getFirestoreErrorMessage(err)})`,
    };
  }
}

// ==================== VERIFIED PURCHASE REVIEWS (reviews) ====================

function mapReviewDoc(docId: string, data: Record<string, unknown>): ProductReview {
  return {
    id: String(data.id || docId),
    docId,
    productId: Number(data.productId || 0),
    productDocId: typeof data.productDocId === 'string' ? data.productDocId : undefined,
    orderId: Number(data.orderId || 0),
    orderDocId: typeof data.orderDocId === 'string' ? data.orderDocId : undefined,
    userId: String(data.userId || ''),
    userName: String(data.userName || 'Verified Buyer'),
    rating: Math.min(5, Math.max(1, Math.round(Number(data.rating || 5)))),
    title: String(data.title || '').trim(),
    comment: String(data.comment || '').trim(),
    verifiedPurchase: data.verifiedPurchase !== false,
    created_at: typeof data.created_at === 'string' ? data.created_at : new Date().toISOString(),
  };
}

export function subscribeProductReviewsFirestore(
  onData: (reviews: ProductReview[]) => void
): () => void {
  onData(getReviewsLocal());
  return onSnapshot(
    collection(db, 'reviews'),
    (snapshot) => {
      const list = snapshot.docs
        .map((d) => mapReviewDoc(d.id, d.data() as Record<string, unknown>))
        .filter((r) => r.verifiedPurchase && r.productId > 0)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      saveReviewsLocal(list);
      onData(list);
    },
    () => {
      onData(getReviewsLocal());
    }
  );
}

export async function submitProductReviewFirestore(input: {
  product: Product;
  order: Order;
  user: User;
  rating: number;
  title: string;
  comment: string;
  existingReviews: ProductReview[];
}): Promise<{ success: boolean; message: string; review?: ProductReview }> {
  if (input.order.status !== 'Delivered') {
    return {
      success: false,
      message: 'Verified purchase reviews can only be submitted after your order is Delivered.',
    };
  }

  const containsProduct = (input.order.items || []).some(
    (it) =>
      Number(it.product_id) === Number(input.product.id) ||
      (it.product_doc_id && input.product.docId && it.product_doc_id === input.product.docId)
  );
  if (!containsProduct) {
    return {
      success: false,
      message: 'This product was not found in your delivered order.',
    };
  }

  const cleanRating = Math.min(5, Math.max(1, Math.round(Number(input.rating) || 0)));
  if (cleanRating < 1 || cleanRating > 5) {
    return { success: false, message: 'Please select a star rating between 1 and 5.' };
  }
  const cleanComment = input.comment.trim();
  if (cleanComment.length < 5) {
    return { success: false, message: 'Please write at least 5 characters in your review.' };
  }

  const uid = input.user.uid || String(input.user.id);
  const reviewDocId = `rev_${input.product.id}_${uid}`;
  const nowIso = new Date().toISOString();

  const review: ProductReview = {
    id: reviewDocId,
    docId: reviewDocId,
    productId: input.product.id,
    productDocId: input.product.docId || String(input.product.id),
    orderId: input.order.id,
    orderDocId: input.order.docId,
    userId: uid,
    userName: input.user.name || 'Verified Buyer',
    rating: cleanRating,
    title:
      input.title.trim() ||
      (cleanRating >= 4 ? 'Great product!' : cleanRating === 3 ? 'Decent quality' : 'Could be better'),
    comment: cleanComment,
    verifiedPurchase: true,
    created_at: nowIso,
  };

  const mergedReviews = [
    review,
    ...input.existingReviews.filter(
      (r) => !(r.productId === input.product.id && r.userId === uid)
    ),
  ];
  saveReviewsLocal(mergedReviews);

  // Compute exact average rating for this product from verified reviews
  const productReviews = mergedReviews.filter((r) => r.productId === input.product.id);
  const avgRating =
    productReviews.length > 0
      ? Math.round(
          (productReviews.reduce((sum, r) => sum + r.rating, 0) / productReviews.length) * 10
        ) / 10
      : cleanRating;

  try {
    await setDoc(
      doc(db, 'reviews', reviewDocId),
      {
        id: review.id,
        productId: review.productId,
        productDocId: review.productDocId || '',
        orderId: review.orderId,
        orderDocId: review.orderDocId || '',
        userId: review.userId,
        userName: review.userName,
        rating: review.rating,
        title: review.title,
        comment: review.comment,
        verifiedPurchase: true,
        created_at: review.created_at,
        updatedAt: nowIso,
      },
      { merge: true }
    );

    if (input.product.docId) {
      await updateDoc(doc(db, 'products', input.product.docId), {
        rating: avgRating,
        reviews: productReviews.length,
        updatedAt: nowIso,
      }).catch(() => {});
    }

    return {
      success: true,
      review,
      message: 'Thank you! Your Verified Purchase review is now live.',
    };
  } catch (err) {
    return {
      success: true,
      review,
      message: `Review saved (${getFirestoreErrorMessage(err)})`,
    };
  }
}


