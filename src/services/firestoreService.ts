import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db, getFirestoreErrorMessage } from '../firebase';
import {
  DEFAULT_CATEGORIES,
  DEFAULT_PRODUCTS,
  cacheCategoriesLocal,
  cacheProductsLocal,
  resolveAssetImage,
} from '../store/localStore';
import { Category, Order, OrderItem, Product, User } from '../types';

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
    rating: data.rating !== undefined ? Number(data.rating) : 4.4,
    reviews: data.reviews !== undefined ? Number(data.reviews) : 120,
    stock: Number(data.stock ?? 0),
    image: resolveAssetImage(typeof data.image === 'string' ? data.image : ''),
    created_at: String(data.created_at || data.createdAt || new Date().toISOString()),
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
    };
  });

  const totalAmount = Number(data.total_amount ?? data.total ?? 0);
  const rawStatus = String(data.status || 'Placed');
  const validStatus: Order['status'] =
    rawStatus === 'Dispatched' || rawStatus === 'Delivered' || rawStatus === 'Cancelled'
      ? rawStatus
      : 'Placed';

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
    paymentMethod: String(data.paymentMethod || 'Cash on Delivery'),
    status: validStatus,
    created_at: String(data.created_at || data.createdAt || new Date().toISOString()),
    items,
  };
}

function mapUserDoc(id: string, data: Record<string, unknown>): User {
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
        rating: prod.rating ?? 4.4,
        reviews: prod.reviews ?? 120,
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

    await setDoc(
      doc(db, 'products', docId),
      {
        id: numericId,
        cat_id: payload.cat_id,
        name: cleanName,
        description: payload.description.trim(),
        price: payload.price,
        mrp: mrpValue,
        rating: payload.rating || 4.4,
        reviews: payload.reviews || 120,
        stock: Math.max(0, Math.floor(payload.stock)),
        image: payload.image,
        created_at: payload.created_at || nowIso,
        createdAt: payload.created_at || nowIso,
        updatedAt: nowIso,
      },
      { merge: true }
    );
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

    const docData = {
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

export async function placeOrderFirestore(payload: {
  userId: string;
  numericUserId: number;
  name: string;
  phone: string;
  email: string;
  address: string;
  paymentMethod?: string;
  utr_number?: string;
  subtotal_amount?: number;
  gst_amount?: number;
  total_amount?: number;
  seller_gstin?: string;
  items: { product: Product; quantity: number }[];
}): Promise<{ success: boolean; message: string; order?: Order }> {
  if (!payload.name.trim() || !payload.phone.trim() || !payload.address.trim() || payload.items.length === 0) {
    return { success: false, message: 'Please provide complete delivery details and cart items.' };
  }

  for (const entry of payload.items) {
    if (entry.product.stock < entry.quantity) {
      return { success: false, message: `${entry.product.name} has insufficient stock.` };
    }
  }

  try {
    const orderNumber = Math.floor(100000 + (Date.now() % 900000));
    const nowIso = new Date().toISOString();
    let subtotal = 0;
    let totalGst = 0;

    const orderItems: OrderItem[] = payload.items.map((entry, idx) => {
      const qty = Math.max(1, entry.quantity);
      const gstRate = entry.product.gst_rate ?? 0;
      const itemSub = entry.product.price * qty;
      const itemGst = Math.round((itemSub * gstRate) / 100);
      subtotal += itemSub;
      totalGst += itemGst;
      return {
        id: idx + 1,
        order_id: orderNumber,
        product_id: entry.product.id,
        product_doc_id: entry.product.docId || String(entry.product.id),
        product_name: entry.product.name,
        product_image: entry.product.image,
        quantity: qty,
        price: entry.product.price,
        gst_rate: gstRate,
      };
    });

    const finalSub = payload.subtotal_amount ?? subtotal;
    const finalGst = payload.gst_amount ?? totalGst;
    const total = payload.total_amount ?? finalSub + finalGst;
    const paymentMethod = payload.paymentMethod || 'Cash on Delivery';
    const orderDocRef = doc(collection(db, 'orders'));

    const orderPayload = {
      id: orderNumber,
      userId: payload.userId,
      user_id: payload.numericUserId,
      name: payload.name.trim(),
      customerName: payload.name.trim(),
      phone: payload.phone.trim(),
      email: payload.email.trim().toLowerCase(),
      address: payload.address.trim(),
      items: orderItems,
      subtotal_amount: finalSub,
      gst_amount: finalGst,
      total,
      total_amount: total,
      paymentMethod,
      utr_number: payload.utr_number?.trim() || '',
      payment_verified: false,
      seller_gstin: payload.seller_gstin || '07AABCS1429B1Z5',
      status: 'Placed' as const,
      createdAt: nowIso,
      created_at: nowIso,
    };
        

    await setDoc(orderDocRef, orderPayload);

    // Best-effort product stock decrement and saved address update
    await Promise.allSettled(
      payload.items.map((entry) => {
        const prodDocId = entry.product.docId || String(entry.product.id);
        const nextStock = Math.max(0, entry.product.stock - Math.max(1, entry.quantity));
        return updateDoc(doc(db, 'products', prodDocId), {
          stock: nextStock,
          updatedAt: nowIso,
        });
      })
    );

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
      onData(list);
    },
    (err) => {
      onError?.(getFirestoreErrorMessage(err));
    }
  );
}

export async function updateOrderStatusFirestore(
  order: Order,
  status: Order['status']
): Promise<{ success: boolean; message: string }> {
  const docId = order.docId;
  if (!docId) return { success: false, message: 'Order document ID missing.' };
  try {
    await updateDoc(doc(db, 'orders', docId), {
      status,
      updatedAt: new Date().toISOString(),
    });
    return { success: true, message: `Order #${order.id} updated to ${status}.` };
  } catch (err) {
    return { success: false, message: getFirestoreErrorMessage(err) };
  }
}

export async function cancelOrderFirestore(order: Order): Promise<{ success: boolean; message: string }> {
  if (order.status !== 'Placed') {
    return { success: false, message: 'Only newly placed orders can be cancelled.' };
  }
  const res = await updateOrderStatusFirestore(order, 'Cancelled');
  if (!res.success) return res;
  return { success: true, message: `Order #${order.id} cancelled.` };
}
