import earbudsImg from '../assets/images/product_earbuds_1794891797883.jpg';
import smartwatchImg from '../assets/images/product_smartwatch_1794891795980.jpg';
import sneakersImg from '../assets/images/product_sneakers_1794891798636.jpg';
import backpackImg from '../assets/images/product_backpack_1794891798552.jpg';
import flaskImg from '../assets/images/product_flask_1794891799263.jpg';
import heroImg from '../assets/images/hero_quick_kart_1794891801002.jpg';
import smartphoneImg from '../assets/images/product_smartphone_5g_1794941059550.jpg';
import fashionImg from '../assets/images/product_fashion_denim_1794941061353.jpg';
import homeApplianceImg from '../assets/images/product_home_appliance_1794941059747.jpg';
import beautyImg from '../assets/images/product_beauty_skincare_1794941060127.jpg';
import groceryImg from '../assets/images/product_grocery_pack_1794941061136.jpg';
import bigSavingBannerImg from '../assets/images/banner_big_saving_1794941061121.jpg';
import {
  CartEntry,
  Category,
  DeliveryBoy,
  Order,
  Product,
  RiderCashSettlement,
  RiderKycStatus,
  SavedAddress,
  SellerPayoutRecord,
  SellerProfile,
  User,
  extractPincodeFromAddress,
  generateDeliveryOtp,
  isOnlinePaidOrder,
  normalizeSellerStatus,
} from '../types';
import {
  isValidAadhaarVerhoeff,
  isValidIndianMobile,
  isValidIndianVehicleNumber,
} from '../utils/indianKycValidation';

export const ASSETS = {
  smartphone: smartphoneImg,
  fashion: fashionImg,
  earbuds: earbudsImg,
  smartwatch: smartwatchImg,
  sneakers: sneakersImg,
  backpack: backpackImg,
  flask: flaskImg,
  homeAppliance: homeApplianceImg,
  beauty: beautyImg,
  grocery: groceryImg,
  hero: heroImg,
  bigSavingBanner: bigSavingBannerImg,
};

export const IMAGE_CHOICES = [
  { label: '5G Smartphone', url: smartphoneImg },
  { label: 'Fashion Denim & Shirt', url: fashionImg },
  { label: 'Wireless Earbuds', url: earbudsImg },
  { label: 'AMOLED Smartwatch', url: smartwatchImg },
  { label: 'Running Sneakers', url: sneakersImg },
  { label: 'Laptop Backpack', url: backpackImg },
  { label: 'Electric Kettle', url: homeApplianceImg },
  { label: 'Thermosteel Flask', url: flaskImg },
  { label: 'Vitamin C Skincare', url: beautyImg },
  { label: 'Almonds, Honey & Tea', url: groceryImg },
  { label: 'Over-Ear Headphones', url: heroImg },
];

interface StoredUser extends User {
  password: string;
}

interface AdminCreds {
  username: string;
  password: string;
}

const KEYS = {
  seeded: 'qk_seeded_v3',
  categories: 'qk_categories_v3',
  products: 'qk_products_v3',
  users: 'qk_users_v3',
  orders: 'qk_orders_v3',
  cart: 'qk_cart_v3',
  currentUser: 'qk_current_user_v3',
  adminCreds: 'qk_admin_creds_v3',
  adminLoggedIn: 'qk_admin_logged_in_v3',
  sellers: 'qk_sellers_v3',
  currentSeller: 'qk_current_seller_v3',
  deliveryBoys: 'qk_delivery_boys_v3',
  currentRider: 'qk_current_rider_v3',
  wishlist: 'qk_wishlist_v3',
  savedAddress: 'qk_saved_address_v3',
};

export function resolveAssetImage(imageValue?: string): string {
  const val = (imageValue || '').trim();
  if (!val) return smartphoneImg;
  const knownAssets = [
    { key: 'product_smartphone_5g_1794941059550', url: smartphoneImg },
    { key: 'product_fashion_denim_1794941061353', url: fashionImg },
    { key: 'product_earbuds_1794891797883', url: earbudsImg },
    { key: 'product_smartwatch_1794891795980', url: smartwatchImg },
    { key: 'product_sneakers_1794891798636', url: sneakersImg },
    { key: 'product_backpack_1794891798552', url: backpackImg },
    { key: 'product_flask_1794891799263', url: flaskImg },
    { key: 'product_home_appliance_1794941059747', url: homeApplianceImg },
    { key: 'product_beauty_skincare_1794941060127', url: beautyImg },
    { key: 'product_grocery_pack_1794941061136', url: groceryImg },
    { key: 'hero_quick_kart_1794891801002', url: heroImg },
    { key: 'banner_big_saving_1794941061121', url: bigSavingBannerImg },
  ];
  const matched = knownAssets.find((item) => val.includes(item.key));
  return matched ? matched.url : val;
}

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 1, name: 'Mobiles', image: smartphoneImg },
  { id: 2, name: 'Fashion', image: fashionImg },
  { id: 3, name: 'Electronics', image: earbudsImg },
  { id: 4, name: 'Home', image: homeApplianceImg },
  { id: 5, name: 'Beauty', image: beautyImg },
  { id: 6, name: 'Grocery', image: groceryImg },
];

export const DEFAULT_PRODUCTS: Product[] = [
  {
    id: 1,
    cat_id: 1,
    name: 'Redmi Note 13 Pro 5G (Midnight Blue, 128 GB)',
    description: '200MP OIS triple camera, 1.5K 120Hz AMOLED display, Snapdragon 7s Gen 2 processor with 67W turbo charging.',
    price: 21999,
    mrp: 28999,
    rating: 4.4,
    reviews: 3420,
    stock: 25,
    image: smartphoneImg,
    created_at: '2026-11-10T10:00:00Z',
  },
  {
    id: 2,
    cat_id: 1,
    name: 'Samsung Galaxy M35 5G (Thunder Blue, 8GB RAM)',
    description: '6000mAh massive battery, 120Hz Super AMOLED display, 50MP no-shake camera, and Gorilla Glass Victus+ protection.',
    price: 16499,
    mrp: 24499,
    rating: 4.5,
    reviews: 2180,
    stock: 18,
    image: smartphoneImg,
    created_at: '2026-11-11T10:00:00Z',
  },
  {
    id: 3,
    cat_id: 2,
    name: 'U.S. Polo Assn. Indigo Denim Jacket & Cotton Shirt',
    description: 'Pure breathable combed cotton casual shirt paired with a tailored classic indigo washed denim jacket.',
    price: 1899,
    mrp: 3999,
    rating: 4.4,
    reviews: 1560,
    stock: 30,
    image: fashionImg,
    created_at: '2026-11-12T10:00:00Z',
  },
  {
    id: 4,
    cat_id: 2,
    name: 'Campus Stride Air-Knit Running Shoes (Men)',
    description: 'Lightweight engineered mesh upper with dual-density cushioned EVA sole for everyday running and gym sessions.',
    price: 1299,
    mrp: 2599,
    rating: 4.3,
    reviews: 4890,
    stock: 35,
    image: sneakersImg,
    created_at: '2026-11-12T14:00:00Z',
  },
  {
    id: 5,
    cat_id: 2,
    name: 'Wildcraft 25L Waterproof Commuter Laptop Backpack',
    description: 'Heavy-duty water-repellent canvas daypack with 16-inch padded laptop compartment and ergonomic airflow straps.',
    price: 1199,
    mrp: 2499,
    rating: 4.5,
    reviews: 2670,
    stock: 22,
    image: backpackImg,
    created_at: '2026-11-13T10:00:00Z',
  },
  {
    id: 6,
    cat_id: 3,
    name: 'boAt Airdopes 141 ANC Wireless TWS Earbuds',
    description: 'Active Noise Cancellation up to 32dB, 42-hour playback, ENx quad-mic call clarity, and ASAP fast charging.',
    price: 1399,
    mrp: 4490,
    rating: 4.4,
    reviews: 8910,
    stock: 40,
    image: earbudsImg,
    created_at: '2026-11-13T15:00:00Z',
  },
  {
    id: 7,
    cat_id: 3,
    name: 'Noise ColorFit Pro 5 Titanium AMOLED Smartwatch',
    description: '1.85-inch vivid AMOLED display, Bluetooth calling, SpO2 & heart rate monitor, and 7-day battery endurance.',
    price: 3499,
    mrp: 6999,
    rating: 4.5,
    reviews: 2740,
    stock: 19,
    image: smartwatchImg,
    created_at: '2026-11-14T10:00:00Z',
  },
  {
    id: 8,
    cat_id: 3,
    name: 'Sony WH-CH520 Wireless Studio Headphones',
    description: '50-hour battery life, multipoint Bluetooth connection, DSEE audio upscaling, and ultra-soft earpads.',
    price: 4490,
    mrp: 5990,
    rating: 4.6,
    reviews: 1840,
    stock: 14,
    image: heroImg,
    created_at: '2026-11-14T16:00:00Z',
  },
  {
    id: 9,
    cat_id: 4,
    name: 'Prestige Matte Black 1.5L Stainless Electric Kettle',
    description: '1500W rapid boil stainless steel electric kettle with auto shut-off, 360-degree swivel base, and cool-touch handle.',
    price: 949,
    mrp: 1795,
    rating: 4.4,
    reviews: 1930,
    stock: 28,
    image: homeApplianceImg,
    created_at: '2026-11-15T09:00:00Z',
  },
  {
    id: 10,
    cat_id: 4,
    name: 'Milton Thermosteel 750ml Vacuum Insulated Flask',
    description: 'Double-walled 304 stainless steel vacuum flask keeps water chilled for 24 hours and tea/coffee piping hot.',
    price: 799,
    mrp: 1250,
    rating: 4.6,
    reviews: 5120,
    stock: 45,
    image: flaskImg,
    created_at: '2026-11-15T12:00:00Z',
  },
  {
    id: 11,
    cat_id: 5,
    name: 'Minimalist 10% Vitamin C Serum & Ceramide Cream Combo',
    description: 'Dermatologist-tested daily glow brightening serum with 10% ethyl ascorbic acid and barrier-repair moisturizer.',
    price: 649,
    mrp: 999,
    rating: 4.5,
    reviews: 3210,
    stock: 32,
    image: beautyImg,
    created_at: '2026-11-16T08:30:00Z',
  },
  {
    id: 12,
    cat_id: 6,
    name: 'Happilo California Almonds, Raw Honey & Green Tea Pack',
    description: 'Premium crunchy California almonds (250g), wild forest raw honey (500g), and organic Darjeeling green tea.',
    price: 749,
    mrp: 1199,
    rating: 4.6,
    reviews: 4190,
    stock: 50,
    image: groceryImg,
    created_at: '2026-11-16T15:45:00Z',
  },
];

const DEFAULT_USERS: StoredUser[] = [
  {
    id: 1,
    name: 'Demo Customer',
    phone: '9876543210',
    email: 'user@quickkart.com',
    password: '123456',
    address: '402 Indiranagar 100ft Road, Bengaluru, Karnataka 560038',
    status: 'active',
    created_at: '2026-11-01T09:00:00Z',
  },
];

const DEFAULT_ORDERS: Order[] = [
  {
    id: 1001,
    user_id: 1,
    name: 'Demo Customer',
    phone: '9876543210',
    address: '402 Indiranagar 100ft Road, Bengaluru, Karnataka 560038',
    total_amount: 1399,
    status: 'Shipped',
    courierName: 'Delhivery',
    trackingId: 'DLV948271630IN',
    trackingNote: 'Dispatched from Bawana Warehouse, Delhi',
    created_at: '2026-11-15T14:20:00Z',
    items: [
      {
        id: 1,
        order_id: 1001,
        product_id: 6,
        product_name: 'boAt Airdopes 141 ANC Wireless TWS Earbuds',
        product_image: earbudsImg,
        quantity: 1,
        price: 1399,
      },
    ],
  },
  {
    id: 1000,
    user_id: 1,
    name: 'Demo Customer',
    phone: '9876543210',
    address: '402 Indiranagar 100ft Road, Bengaluru, Karnataka 560038',
    total_amount: 799,
    status: 'Delivered',
    created_at: '2026-11-08T11:10:00Z',
    items: [
      {
        id: 2,
        order_id: 1000,
        product_id: 10,
        product_name: 'Milton Thermosteel 750ml Vacuum Insulated Flask',
        product_image: flaskImg,
        quantity: 1,
        price: 799,
      },
    ],
  },
];

const DEFAULT_ADMIN: AdminCreds = {
  username: 'Seraj',
  password: 'seraj123',
};

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJSON<T>(key: string, value: T): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota errors in restricted webviews
  }
}

export function ensureSeeded(): void {
  try {
    if (!window.localStorage.getItem(KEYS.seeded)) {
      writeJSON(KEYS.categories, DEFAULT_CATEGORIES);
      writeJSON(KEYS.products, DEFAULT_PRODUCTS);
      writeJSON(KEYS.users, DEFAULT_USERS);
      writeJSON(KEYS.orders, DEFAULT_ORDERS);
      writeJSON(KEYS.cart, []);
      writeJSON(KEYS.adminCreds, DEFAULT_ADMIN);
      window.localStorage.setItem(KEYS.seeded, '1');
    } else if (!window.localStorage.getItem(KEYS.adminCreds)) {
      writeJSON(KEYS.adminCreds, DEFAULT_ADMIN);
    }
  } catch {
    // Fallback handled by readJSON defaults
  }
}

export function getBootstrapData() {
  ensureSeeded();
  const categories = readJSON<Category[]>(KEYS.categories, DEFAULT_CATEGORIES);
  const products = readJSON<Product[]>(KEYS.products, DEFAULT_PRODUCTS);
  const users = readJSON<StoredUser[]>(KEYS.users, DEFAULT_USERS).map(({ password: _p, ...u }) => u);
  const orders = readJSON<Order[]>(KEYS.orders, DEFAULT_ORDERS);
  const adminCreds = readJSON<AdminCreds>(KEYS.adminCreds, DEFAULT_ADMIN);
  const cart = readJSON<CartEntry[]>(KEYS.cart, []);
  const currentUser = readJSON<User | null>(KEYS.currentUser, null);
  const adminLoggedIn = readJSON<boolean>(KEYS.adminLoggedIn, false);

  return {
    categories,
    products,
    users,
    orders,
    adminUsername: adminCreds.username,
    cart,
    currentUser,
    adminLoggedIn,
  };
}

export function saveCart(cart: CartEntry[]): void {
  writeJSON(KEYS.cart, cart);
}

export function cacheCategoriesLocal(categories: Category[]): void {
  writeJSON(KEYS.categories, categories);
}

export function cacheProductsLocal(products: Product[]): void {
  writeJSON(KEYS.products, products);
}

export function cacheOrdersLocal(orders: Order[]): void {
  writeJSON(KEYS.orders, orders);
}

export function cacheUsersLocal(users: User[]): void {
  const existing = readJSON<StoredUser[]>(KEYS.users, DEFAULT_USERS);
  const mapped: StoredUser[] = users.map((u) => {
    const prev = existing.find((e) => (u.uid && e.uid === u.uid) || e.email.toLowerCase() === u.email.toLowerCase());
    return { ...u, password: prev?.password || '' };
  });
  writeJSON(KEYS.users, mapped);
}

export function setStoredCurrentUser(user: User | null): void {
  writeJSON(KEYS.currentUser, user);
}

export function setStoredAdminLoggedIn(val: boolean): void {
  writeJSON(KEYS.adminLoggedIn, val);
}

export function loginUserLocal(identifier: string, password: string): { success: boolean; message: string; user?: User } {
  ensureSeeded();
  const clean = identifier.trim().toLowerCase();
  const digits = identifier.trim();
  const users = readJSON<StoredUser[]>(KEYS.users, DEFAULT_USERS);
  const found = users.find(
    (u) =>
      (u.email && u.email.toLowerCase() === clean) ||
      (u.phone && u.phone.trim() === digits)
  );
  if (!found || found.password !== password) {
    return { success: false, message: 'Invalid email/phone or password.' };
  }
  if (found.status === 'blocked') {
    return { success: false, message: 'Your account has been suspended.' };
  }
  const { password: _p, ...safeUser } = found;
  setStoredCurrentUser(safeUser);
  return { success: true, message: 'Signed in successfully.', user: safeUser };
}

export function syncFirebaseCustomerLocal(payload: {
  uid?: string;
  docId?: string;
  name?: string;
  email: string;
  phone?: string;
  address?: string;
  status?: 'active' | 'blocked';
  role?: User['role'];
  isSeller?: boolean;
  sellerStoreName?: string;
}): { success: boolean; message: string; user?: User } {
  ensureSeeded();
  const cleanEmail = payload.email.trim().toLowerCase();
  if (!cleanEmail) {
    return { success: false, message: 'Valid email address is required.' };
  }
  const cleanName = payload.name?.trim() || '';
  const cleanPhone = payload.phone ? payload.phone.replace(/\D/g, '').slice(-10) : '';
  const cleanAddress = payload.address?.trim() || '';

  const users = readJSON<StoredUser[]>(KEYS.users, DEFAULT_USERS);
  const existingIdx = users.findIndex(
    (u) =>
      (payload.uid && u.uid === payload.uid) ||
      (u.email && u.email.toLowerCase() === cleanEmail)
  );

  if (existingIdx !== -1) {
    const found = users[existingIdx];
    const effectiveStatus = payload.status || found.status;
    if (effectiveStatus === 'blocked') {
      return { success: false, message: 'Your account has been suspended.' };
    }
    const updatedUser: StoredUser = {
      ...found,
      uid: payload.uid || found.uid,
      docId: payload.docId || found.docId || payload.uid,
      name: cleanName && (!found.name || found.name === 'Smart Basket Customer') ? cleanName : found.name || cleanName || cleanEmail.split('@')[0],
      phone: cleanPhone || found.phone || '',
      address: cleanAddress || found.address || '',
      status: effectiveStatus,
      role: payload.role ?? found.role,
      isSeller: payload.isSeller ?? found.isSeller,
      sellerStoreName: payload.sellerStoreName ?? found.sellerStoreName,
    };
    users[existingIdx] = updatedUser;
    writeJSON(KEYS.users, users);
    const { password: _p, ...safeUser } = updatedUser;
    setStoredCurrentUser(safeUser);
    return { success: true, message: 'Signed in successfully.', user: safeUser };
  }

  const nextId = users.reduce((max, u) => Math.max(max, u.id), 0) + 1;
  const newUser: StoredUser = {
    id: nextId,
    uid: payload.uid,
    docId: payload.docId || payload.uid,
    name: cleanName || cleanEmail.split('@')[0] || 'Customer',
    phone: cleanPhone,
    email: cleanEmail,
    password: '',
    address: cleanAddress,
    status: payload.status || 'active',
    role: payload.role,
    isSeller: payload.isSeller,
    sellerStoreName: payload.sellerStoreName,
    created_at: new Date().toISOString(),
  };
  writeJSON(KEYS.users, [newUser, ...users]);
  const { password: _p, ...safeUser } = newUser;
  setStoredCurrentUser(safeUser);
  return { success: true, message: 'Welcome to Smart Basket!', user: safeUser };
}

export function signupUserLocal(payload: {
  name: string;
  contact: string;
  password: string;
}): { success: boolean; message: string; user?: User } {
  ensureSeeded();
  const name = payload.name.trim();
  const contact = payload.contact.trim();
  const password = payload.password;

  if (!name || !contact || password.length < 6) {
    return { success: false, message: 'Please enter Name, Email or Phone, and a 6+ char password.' };
  }

  const isEmail = contact.includes('@');
  const email = isEmail ? contact.toLowerCase() : '';
  const phone = isEmail ? '' : contact;

  const users = readJSON<StoredUser[]>(KEYS.users, DEFAULT_USERS);
  const duplicate = users.some(
    (u) =>
      (email && u.email.toLowerCase() === email) ||
      (phone && u.phone.trim() === phone)
  );
  if (duplicate) {
    return { success: false, message: 'An account with this email or phone already exists.' };
  }

  const nextId = users.reduce((max, u) => Math.max(max, u.id), 0) + 1;
  const newUser: StoredUser = {
    id: nextId,
    name,
    phone,
    email,
    password,
    address: '',
    status: 'active',
    created_at: new Date().toISOString(),
  };
  writeJSON(KEYS.users, [newUser, ...users]);
  const { password: _p, ...safeUser } = newUser;
  setStoredCurrentUser(safeUser);
  return { success: true, message: 'Account created and signed in.', user: safeUser };
}

export function updateProfileLocal(payload: {
  id: number;
  name: string;
  phone: string;
  email: string;
  address: string;
}): { success: boolean; message: string; user?: User } {
  const users = readJSON<StoredUser[]>(KEYS.users, DEFAULT_USERS);
  const idx = users.findIndex((u) => u.id === payload.id);
  if (idx === -1) return { success: false, message: 'User not found.' };
  users[idx] = {
    ...users[idx],
    name: payload.name.trim(),
    phone: payload.phone.trim(),
    email: payload.email.trim(),
    address: payload.address.trim(),
  };
  writeJSON(KEYS.users, users);
  const { password: _p, ...safeUser } = users[idx];
  setStoredCurrentUser(safeUser);
  return { success: true, message: 'Profile updated successfully.', user: safeUser };
}

export function changePasswordLocal(
  id: number,
  currentPassword: string,
  newPassword: string
): { success: boolean; message: string } {
  const users = readJSON<StoredUser[]>(KEYS.users, DEFAULT_USERS);
  const idx = users.findIndex((u) => u.id === id);
  if (idx === -1) return { success: false, message: 'User not found.' };
  if (users[idx].password !== currentPassword) {
    return { success: false, message: 'Current password is incorrect.' };
  }
  if (newPassword.length < 6) {
    return { success: false, message: 'New password must be at least 6 characters.' };
  }
  users[idx].password = newPassword;
  writeJSON(KEYS.users, users);
  return { success: true, message: 'Password changed successfully.' };
}

export function placeOrderLocal(payload: {
  user_id: number;
  name: string;
  phone: string;
  address: string;
  items: { product_id: number; quantity: number }[];
}): { success: boolean; message: string; order?: Order } {
  if (!payload.name.trim() || !payload.phone.trim() || !payload.address.trim() || payload.items.length === 0) {
    return { success: false, message: 'Please provide complete delivery details and cart items.' };
  }

  const products = readJSON<Product[]>(KEYS.products, DEFAULT_PRODUCTS);
  const orders = readJSON<Order[]>(KEYS.orders, DEFAULT_ORDERS);
  const users = readJSON<StoredUser[]>(KEYS.users, DEFAULT_USERS);

  const nextOrderId = orders.reduce((max, o) => Math.max(max, o.id), 1001) + 1;
  let total = 0;
  const orderItems: Order['items'] = [];
  let itemIdCounter = Date.now();

  for (const entry of payload.items) {
    const prod = products.find((p) => p.id === entry.product_id);
    if (!prod || prod.stock < entry.quantity) {
      return { success: false, message: `${prod?.name || 'Item'} has insufficient stock.` };
    }
    const qty = Math.max(1, entry.quantity);
    prod.stock -= qty;
    total += prod.price * qty;
    orderItems.push({
      id: itemIdCounter++,
      order_id: nextOrderId,
      product_id: prod.id,
      product_name: prod.name,
      product_image: prod.image,
      quantity: qty,
      price: prod.price,
      sellerId: prod.sellerId,
      sellerEmail: prod.sellerEmail,
      sellerName: prod.sellerName,
    });
  }

  const sellerIds = Array.from(new Set(orderItems.map((it) => it.sellerId).filter((v): v is string => Boolean(v))));
  const sellerEmails = Array.from(
    new Set(orderItems.map((it) => it.sellerEmail?.trim().toLowerCase()).filter((v): v is string => Boolean(v)))
  );

  const newOrder: Order = {
    id: nextOrderId,
    user_id: payload.user_id,
    name: payload.name.trim(),
    phone: payload.phone.trim(),
    address: payload.address.trim(),
    pincode: extractPincodeFromAddress(payload.address),
    total_amount: total,
    status: 'Placed',
    deliveryOtp: generateDeliveryOtp(),
    deliveryOtpVerified: false,
    created_at: new Date().toISOString(),
    items: orderItems,
    sellerIds,
    sellerEmails,
  };

  writeJSON(KEYS.products, products);
  writeJSON(KEYS.orders, [newOrder, ...orders]);
  writeJSON(KEYS.cart, []);

  const uIdx = users.findIndex((u) => u.id === payload.user_id);
  if (uIdx !== -1 && !users[uIdx].address) {
    users[uIdx].address = newOrder.address;
    writeJSON(KEYS.users, users);
    const { password: _p, ...safeUser } = users[uIdx];
    setStoredCurrentUser(safeUser);
  }

  return { success: true, message: `Order #${nextOrderId} placed successfully!`, order: newOrder };
}

export function cancelOrderLocal(orderId: number, userId: number): { success: boolean; message: string } {
  const orders = readJSON<Order[]>(KEYS.orders, DEFAULT_ORDERS);
  const ord = orders.find((o) => o.id === orderId && o.user_id === userId);
  if (!ord || (ord.status !== 'Placed' && ord.status !== 'Confirmed')) {
    return { success: false, message: 'Only newly confirmed orders can be cancelled.' };
  }
  ord.status = 'Cancelled';
  writeJSON(KEYS.orders, orders);
  return { success: true, message: `Order #${ord.id} cancelled.` };
}

export function loginAdminLocal(username: string, password: string): { success: boolean; message: string } {
  ensureSeeded();
  const creds = readJSON<AdminCreds>(KEYS.adminCreds, DEFAULT_ADMIN);
  if (username.trim() === creds.username && password === creds.password) {
    setStoredAdminLoggedIn(true);
    return { success: true, message: `Welcome back, ${creds.username}.` };
  }
  return { success: false, message: 'Invalid admin credentials.' };
}

export function saveCategoryLocal(payload: { id?: number; name: string; image: string }): { success: boolean; message: string } {
  if (!payload.name.trim() || payload.name.trim().length < 2) {
    return { success: false, message: 'Category name is required.' };
  }
  const categories = readJSON<Category[]>(KEYS.categories, DEFAULT_CATEGORIES);
  if (payload.id && payload.id > 0) {
    const idx = categories.findIndex((c) => c.id === payload.id);
    if (idx !== -1) {
      categories[idx] = { ...categories[idx], name: payload.name.trim(), image: payload.image || categories[idx].image };
      writeJSON(KEYS.categories, categories);
    }
    return { success: true, message: 'Category updated.' };
  }
  const nextId = categories.reduce((max, c) => Math.max(max, c.id), 0) + 1;
  writeJSON(KEYS.categories, [
    { id: nextId, name: payload.name.trim(), image: payload.image || heroImg },
    ...categories,
  ]);
  return { success: true, message: 'Category added.' };
}

export function deleteCategoryLocal(id: number): void {
  const categories = readJSON<Category[]>(KEYS.categories, DEFAULT_CATEGORIES).filter((c) => c.id !== id);
  const products = readJSON<Product[]>(KEYS.products, DEFAULT_PRODUCTS).filter((p) => p.cat_id !== id);
  writeJSON(KEYS.categories, categories);
  writeJSON(KEYS.products, products);
}

export function saveProductLocal(payload: {
  id?: number;
  cat_id: number;
  name: string;
  description: string;
  price: number;
  mrp?: number;
  rating?: number;
  stock: number;
  image: string;
  sellerId?: string;
  sellerEmail?: string;
  sellerName?: string;
}): { success: boolean; message: string; product?: Product } {
  if (!payload.name.trim() || payload.price <= 0) {
    return { success: false, message: 'Valid product name and price required.' };
  }
  const products = readJSON<Product[]>(KEYS.products, DEFAULT_PRODUCTS);
  const mrpValue = payload.mrp && payload.mrp > payload.price ? payload.mrp : Math.round((payload.price * 1.35) / 10) * 10 - 1;
  if (payload.id && payload.id > 0) {
    const idx = products.findIndex((p) => p.id === payload.id);
    if (idx !== -1) {
      products[idx] = {
        ...products[idx],
        cat_id: payload.cat_id,
        name: payload.name.trim(),
        description: payload.description.trim(),
        price: payload.price,
        mrp: mrpValue,
        rating: payload.rating || products[idx].rating || 4.4,
        stock: payload.stock,
        image: payload.image || products[idx].image,
        sellerId: payload.sellerId ?? products[idx].sellerId,
        sellerEmail: payload.sellerEmail ?? products[idx].sellerEmail,
        sellerName: payload.sellerName ?? products[idx].sellerName,
      };
      writeJSON(KEYS.products, products);
      return { success: true, message: 'Product updated.', product: products[idx] };
    }
    return { success: true, message: 'Product updated.' };
  }
  const nextId = products.reduce((max, p) => Math.max(max, p.id), 0) + 1;
  const newProd: Product = {
    id: nextId,
    cat_id: payload.cat_id,
    name: payload.name.trim(),
    description: payload.description.trim(),
    price: payload.price,
    mrp: mrpValue,
    rating: payload.rating || 4.4,
    reviews: 120,
    stock: payload.stock,
    image: payload.image || earbudsImg,
    created_at: new Date().toISOString(),
    sellerId: payload.sellerId,
    sellerEmail: payload.sellerEmail?.trim().toLowerCase(),
    sellerName: payload.sellerName,
  };
  writeJSON(KEYS.products, [newProd, ...products]);
  return { success: true, message: 'Product added.', product: newProd };
}

export function deleteProductLocal(id: number): void {
  const products = readJSON<Product[]>(KEYS.products, DEFAULT_PRODUCTS).filter((p) => p.id !== id);
  writeJSON(KEYS.products, products);
}

export function deductProductStockLocal(
  items: { product_id: number; quantity: number }[]
): Product[] {
  const products = readJSON<Product[]>(KEYS.products, DEFAULT_PRODUCTS);
  const qtyById = new Map<number, number>();
  items.forEach((it) => {
    const qty = Math.max(1, Math.floor(Number(it.quantity) || 1));
    qtyById.set(it.product_id, (qtyById.get(it.product_id) || 0) + qty);
  });
  const updated = products.map((prod) => {
    const deduct = qtyById.get(prod.id);
    if (!deduct) return prod;
    return {
      ...prod,
      stock: Math.max(0, Math.floor(Number(prod.stock) || 0) - deduct),
    };
  });
  writeJSON(KEYS.products, updated);
  return updated;
}

export function updateOrderStatusLocal(orderId: number, status: Order['status']): { success: boolean; message: string } {
  const orders = readJSON<Order[]>(KEYS.orders, DEFAULT_ORDERS);
  const ord = orders.find((o) => o.id === orderId);
  if (!ord) return { success: false, message: 'Order not found.' };
  ord.status = status;
  writeJSON(KEYS.orders, orders);
  return { success: true, message: `Order #${ord.id} updated to ${status}.` };
}

export function updateOrderTrackingLocal(
  orderId: number,
  payload: {
    status: Order['status'];
    courierName?: string;
    trackingId?: string;
    trackingUrl?: string;
    trackingNote?: string;
  }
): { success: boolean; message: string; order?: Order } {
  const orders = readJSON<Order[]>(KEYS.orders, DEFAULT_ORDERS);
  const ord = orders.find((o) => o.id === orderId);
  if (!ord) return { success: false, message: 'Order not found locally.' };
  ord.status = payload.status;
  ord.courierName = (payload.courierName || '').trim() || undefined;
  ord.trackingId = (payload.trackingId || '').trim() || undefined;
  ord.trackingUrl = (payload.trackingUrl || '').trim() || undefined;
  ord.trackingNote = (payload.trackingNote || '').trim() || undefined;
  writeJSON(KEYS.orders, orders);
  return { success: true, message: `Tracking updated for Order #${ord.id}.`, order: ord };
}

export function requestOrderReturnLocal(
  orderId: number,
  payload: {
    returnReason: string;
    returnResolution?: 'Return' | 'Replace';
  }
): { success: boolean; message: string; order?: Order } {
  const orders = readJSON<Order[]>(KEYS.orders, DEFAULT_ORDERS);
  const ord = orders.find((o) => o.id === orderId);
  if (!ord) return { success: false, message: 'Order not found locally.' };
  ord.status = 'Return Requested';
  ord.returnReason = payload.returnReason.trim();
  ord.returnResolution = payload.returnResolution || 'Return';
  ord.returnRequestedAt = new Date().toISOString();
  writeJSON(KEYS.orders, orders);
  return {
    success: true,
    message: `Your ${ord.returnResolution.toLowerCase()} request for Order #${ord.id} has been submitted.`,
    order: ord,
  };
}

export function toggleUserBlockLocal(userId: number, status: 'active' | 'blocked'): void {
  const users = readJSON<StoredUser[]>(KEYS.users, DEFAULT_USERS);
  const user = users.find((u) => u.id === userId);
  if (user) {
    user.status = status;
    writeJSON(KEYS.users, users);
  }
}

export function deleteUserLocal(userId: number): void {
  const users = readJSON<StoredUser[]>(KEYS.users, DEFAULT_USERS).filter((u) => u.id !== userId);
  writeJSON(KEYS.users, users);
}

export function updateAdminSettingsLocal(username: string, newPassword: string): { success: boolean; message: string } {
  if (username.trim().length < 3) {
    return { success: false, message: 'Username must be at least 3 characters.' };
  }
  const creds = readJSON<AdminCreds>(KEYS.adminCreds, DEFAULT_ADMIN);
  creds.username = username.trim();
  if (newPassword && newPassword.length >= 6) {
    creds.password = newPassword;
  }
  writeJSON(KEYS.adminCreds, creds);
  return { success: true, message: 'Admin settings updated.' };
}

export function getStoredSellersLocal(): SellerProfile[] {
  return readJSON<SellerProfile[]>(KEYS.sellers, []).map((s) => ({
    ...s,
    status: normalizeSellerStatus(s.status),
  }));
}

export function cacheSellersLocal(sellers: SellerProfile[]): void {
  const existing = getStoredSellersLocal();
  const byKey = new Map<string, SellerProfile>();
  existing.forEach((s) => {
    const key = (s.docId || s.uid || s.email || s.id).toLowerCase();
    byKey.set(key, { ...s, status: normalizeSellerStatus(s.status) });
  });
  sellers.forEach((s) => {
    const key = (s.docId || s.uid || s.email || s.id).toLowerCase();
    byKey.set(key, { ...s, status: normalizeSellerStatus(s.status) });
  });
  writeJSON(KEYS.sellers, Array.from(byKey.values()));
}

export function updateSellerStatusLocal(
  sellerIdentifier: string,
  status: 'approved' | 'pending' | 'blocked'
): { success: boolean; message: string; seller?: SellerProfile } {
  const cleanId = sellerIdentifier.trim().toLowerCase();
  const sellers = getStoredSellersLocal();
  const idx = sellers.findIndex(
    (s) =>
      s.id.toLowerCase() === cleanId ||
      (s.uid && s.uid.toLowerCase() === cleanId) ||
      (s.docId && s.docId.toLowerCase() === cleanId) ||
      s.email.trim().toLowerCase() === cleanId
  );
  if (idx === -1) {
    return { success: false, message: 'Seller not found.' };
  }
  sellers[idx] = { ...sellers[idx], status };
  writeJSON(KEYS.sellers, sellers);

  const cur = getStoredCurrentSeller();
  if (
    cur &&
    (cur.id.toLowerCase() === cleanId ||
      (cur.uid && cur.uid.toLowerCase() === cleanId) ||
      cur.email.trim().toLowerCase() === cleanId)
  ) {
    setStoredCurrentSeller(sellers[idx]);
  }
  return { success: true, message: `Seller status updated to ${status}.`, seller: sellers[idx] };
}

export function getStoredCurrentSeller(): SellerProfile | null {
  const cur = readJSON<SellerProfile | null>(KEYS.currentSeller, null);
  return cur ? { ...cur, status: normalizeSellerStatus(cur.status) } : null;
}

export function setStoredCurrentSeller(seller: SellerProfile | null): void {
  writeJSON(KEYS.currentSeller, seller);
}

export function getWishlistIdsLocal(): number[] {
  return readJSON<number[]>(KEYS.wishlist, []);
}

export function saveWishlistIdsLocal(ids: number[]): void {
  writeJSON(KEYS.wishlist, ids);
}

export function getSavedAddressLocal(): SavedAddress | null {
  return readJSON<SavedAddress | null>(KEYS.savedAddress, null);
}

export function saveStructuredAddressLocal(addr: SavedAddress): void {
  writeJSON(KEYS.savedAddress, addr);
}

export function getSellerByEmailOrUidLocal(email?: string, uid?: string): SellerProfile | null {
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanUid = (uid || '').trim();
  if (!cleanEmail && !cleanUid) return null;
  const sellers = getStoredSellersLocal();
  return (
    sellers.find(
      (s) =>
        (cleanUid && (s.uid === cleanUid || s.id === cleanUid)) ||
        (cleanEmail && s.email.trim().toLowerCase() === cleanEmail)
    ) || null
  );
}

export function saveSellerProfileLocal(payload: {
  id?: string;
  uid?: string;
  docId?: string;
  email: string;
  storeName: string;
  ownerName: string;
  phone: string;
  gstOrPan?: string;
  pickupAddress: string;
  pickupPincode?: string;
  payoutAccount?: string;
  totalPaidOut?: number;
  pendingPayoutAmount?: number;
  payoutStatus?: SellerProfile['payoutStatus'];
  payoutRequestedAt?: string;
  lastPayoutPaidAt?: string;
  payoutHistory?: SellerPayoutRecord[];
  status?: SellerProfile['status'];
  created_at?: string;
}): { success: boolean; message: string; seller?: SellerProfile } {
  const cleanEmail = payload.email.trim().toLowerCase();
  const cleanStore = payload.storeName.trim();
  const cleanOwner = payload.ownerName.trim();
  const cleanPhone = payload.phone.replace(/\D/g, '').slice(-10) || payload.phone.trim();
  const cleanAddress = payload.pickupAddress.trim();
  const cleanPincode = (payload.pickupPincode || '').replace(/\D/g, '').slice(0, 6);
  const cleanPayoutAccount = (payload.payoutAccount || '').trim();

  if (!cleanEmail || !cleanStore || cleanStore.length < 2) {
    return { success: false, message: 'Store name and valid email are required.' };
  }
  if (!cleanOwner || cleanOwner.length < 2) {
    return { success: false, message: 'Owner name is required.' };
  }
  if (!cleanAddress || cleanAddress.length < 5) {
    return { success: false, message: 'Pickup address is required.' };
  }

  const sellers = getStoredSellersLocal();
  const existingIdx = sellers.findIndex(
    (s) =>
      (payload.uid && s.uid === payload.uid) ||
      (payload.id && s.id === payload.id) ||
      s.email.trim().toLowerCase() === cleanEmail
  );

  const nowIso = new Date().toISOString();
  const sellerRecord: SellerProfile =
    existingIdx !== -1
      ? {
          ...sellers[existingIdx],
          uid: payload.uid || sellers[existingIdx].uid,
          docId: payload.docId || sellers[existingIdx].docId || payload.uid,
          email: cleanEmail,
          storeName: cleanStore,
          ownerName: cleanOwner,
          phone: cleanPhone,
          gstOrPan: payload.gstOrPan !== undefined ? payload.gstOrPan.trim() : sellers[existingIdx].gstOrPan || '',
          pickupAddress: cleanAddress,
          pickupPincode: cleanPincode || sellers[existingIdx].pickupPincode || '',
          payoutAccount: cleanPayoutAccount || sellers[existingIdx].payoutAccount || '',
          totalPaidOut: payload.totalPaidOut ?? sellers[existingIdx].totalPaidOut ?? 0,
          pendingPayoutAmount: payload.pendingPayoutAmount ?? sellers[existingIdx].pendingPayoutAmount ?? 0,
          payoutStatus: payload.payoutStatus ?? sellers[existingIdx].payoutStatus ?? 'none',
          payoutRequestedAt: payload.payoutRequestedAt ?? sellers[existingIdx].payoutRequestedAt,
          lastPayoutPaidAt: payload.lastPayoutPaidAt ?? sellers[existingIdx].lastPayoutPaidAt,
          payoutHistory: payload.payoutHistory ?? sellers[existingIdx].payoutHistory ?? [],
          status: payload.status
            ? normalizeSellerStatus(payload.status)
            : normalizeSellerStatus(sellers[existingIdx].status),
        }
      : {
          id: payload.id || payload.uid || `seller_${Date.now()}`,
          uid: payload.uid,
          docId: payload.docId || payload.uid,
          email: cleanEmail,
          storeName: cleanStore,
          ownerName: cleanOwner,
          phone: cleanPhone,
          gstOrPan: payload.gstOrPan?.trim() || '',
          pickupAddress: cleanAddress,
          pickupPincode: cleanPincode,
          payoutAccount: cleanPayoutAccount,
          totalPaidOut: payload.totalPaidOut ?? 0,
          pendingPayoutAmount: payload.pendingPayoutAmount ?? 0,
          payoutStatus: payload.payoutStatus ?? 'none',
          payoutRequestedAt: payload.payoutRequestedAt,
          lastPayoutPaidAt: payload.lastPayoutPaidAt,
          payoutHistory: payload.payoutHistory ?? [],
          status: payload.status ? normalizeSellerStatus(payload.status) : 'pending',
          created_at: payload.created_at || nowIso,
        };

  if (existingIdx !== -1) {
    sellers[existingIdx] = sellerRecord;
  } else {
    sellers.unshift(sellerRecord);
  }
  writeJSON(KEYS.sellers, sellers);
  setStoredCurrentSeller(sellerRecord);

  // Also mark matching user in local users & currentUser as seller
  const users = readJSON<StoredUser[]>(KEYS.users, DEFAULT_USERS);
  const uIdx = users.findIndex(
    (u) => (payload.uid && u.uid === payload.uid) || u.email.trim().toLowerCase() === cleanEmail
  );
  if (uIdx !== -1) {
    users[uIdx] = {
      ...users[uIdx],
      isSeller: true,
      role: users[uIdx].role === 'admin' ? 'admin' : 'seller',
      sellerStoreName: cleanStore,
    };
    writeJSON(KEYS.users, users);
    const cur = readJSON<User | null>(KEYS.currentUser, null);
    if (cur && (cur.email.trim().toLowerCase() === cleanEmail || (payload.uid && cur.uid === payload.uid))) {
      setStoredCurrentUser({
        ...cur,
        isSeller: true,
        role: cur.role === 'admin' ? 'admin' : 'seller',
        sellerStoreName: cleanStore,
      });
    }
  }

  return {
    success: true,
    message:
      existingIdx !== -1
        ? 'Seller profile updated.'
        : 'Seller account submitted! Your store is pending Admin approval.',
    seller: sellerRecord,
  };
}

export function requestSellerPayoutLocal(
  sellerIdentifier: string,
  amount: number,
  payoutAccount: string
): { success: boolean; message: string; seller?: SellerProfile } {
  const cleanId = sellerIdentifier.trim().toLowerCase();
  const cleanAmount = Math.round(Number(amount || 0) * 100) / 100;
  const cleanAccount = payoutAccount.trim();

  if (cleanAmount <= 0) {
    return { success: false, message: 'No withdrawable balance available for payout.' };
  }
  if (cleanAccount.length < 3) {
    return { success: false, message: 'Please add a valid Bank Account or UPI ID first.' };
  }

  const sellers = getStoredSellersLocal();
  const idx = sellers.findIndex(
    (s) =>
      s.id.toLowerCase() === cleanId ||
      (s.uid && s.uid.toLowerCase() === cleanId) ||
      (s.docId && s.docId.toLowerCase() === cleanId) ||
      s.email.trim().toLowerCase() === cleanId
  );
  if (idx === -1) {
    return { success: false, message: 'Seller profile not found.' };
  }

  const nowIso = new Date().toISOString();
  const existingHistory = Array.isArray(sellers[idx].payoutHistory) ? sellers[idx].payoutHistory! : [];
  const nextPending = Math.round((Number(sellers[idx].pendingPayoutAmount || 0) + cleanAmount) * 100) / 100;
  const record: SellerPayoutRecord = {
    id: `po_${Date.now()}`,
    amount: cleanAmount,
    payoutAccount: cleanAccount,
    status: 'requested',
    requestedAt: nowIso,
  };

  sellers[idx] = {
    ...sellers[idx],
    payoutAccount: cleanAccount,
    pendingPayoutAmount: nextPending,
    payoutStatus: 'requested',
    payoutRequestedAt: nowIso,
    payoutHistory: [record, ...existingHistory].slice(0, 20),
  };

  writeJSON(KEYS.sellers, sellers);

  const cur = getStoredCurrentSeller();
  if (
    cur &&
    (cur.id.toLowerCase() === cleanId ||
      (cur.uid && cur.uid.toLowerCase() === cleanId) ||
      cur.email.trim().toLowerCase() === cleanId)
  ) {
    setStoredCurrentSeller(sellers[idx]);
  }

  return {
    success: true,
    message: `Payout request recorded for ${cleanAccount}. Smart Basket Admin will process it shortly.`,
    seller: sellers[idx],
  };
}

export function markSellerPayoutPaidLocal(
  sellerIdentifier: string,
  amountOverride?: number
): { success: boolean; message: string; seller?: SellerProfile; paidAmount?: number } {
  const cleanId = sellerIdentifier.trim().toLowerCase();
  const sellers = getStoredSellersLocal();
  const idx = sellers.findIndex(
    (s) =>
      s.id.toLowerCase() === cleanId ||
      (s.uid && s.uid.toLowerCase() === cleanId) ||
      (s.docId && s.docId.toLowerCase() === cleanId) ||
      s.email.trim().toLowerCase() === cleanId
  );
  if (idx === -1) {
    return { success: false, message: 'Seller profile not found.' };
  }

  const currentPending = Math.round(Number(sellers[idx].pendingPayoutAmount || 0) * 100) / 100;
  const fallbackAmt = Math.round(Number(amountOverride || 0) * 100) / 100;
  const paidAmount = currentPending > 0 ? currentPending : fallbackAmt;

  if (paidAmount <= 0) {
    return { success: false, message: 'No pending payout balance to mark as paid.' };
  }

  const nowIso = new Date().toISOString();
  const nextTotalPaidOut = Math.round((Number(sellers[idx].totalPaidOut || 0) + paidAmount) * 100) / 100;
  const existingHistory = Array.isArray(sellers[idx].payoutHistory) ? sellers[idx].payoutHistory! : [];
  const hadRequested = existingHistory.some((h) => h.status === 'requested');

  const updatedHistory: SellerPayoutRecord[] = hadRequested
    ? existingHistory.map((h) =>
        h.status === 'requested'
          ? { ...h, status: 'paid' as const, paidAt: nowIso }
          : h
      )
    : [
        {
          id: `po_${Date.now()}`,
          amount: paidAmount,
          payoutAccount: sellers[idx].payoutAccount || 'Registered UPI/Bank',
          status: 'paid' as const,
          requestedAt: nowIso,
          paidAt: nowIso,
        },
        ...existingHistory,
      ].slice(0, 20);

  sellers[idx] = {
    ...sellers[idx],
    totalPaidOut: nextTotalPaidOut,
    pendingPayoutAmount: 0,
    payoutStatus: 'paid',
    lastPayoutPaidAt: nowIso,
    payoutHistory: updatedHistory,
  };

  writeJSON(KEYS.sellers, sellers);

  const cur = getStoredCurrentSeller();
  if (
    cur &&
    (cur.id.toLowerCase() === cleanId ||
      (cur.uid && cur.uid.toLowerCase() === cleanId) ||
      cur.email.trim().toLowerCase() === cleanId)
  ) {
    setStoredCurrentSeller(sellers[idx]);
  }

  return {
    success: true,
    message: `Payout of ₹${paidAmount.toLocaleString('en-IN')} marked as Paid for ${sellers[idx].storeName}.`,
    seller: sellers[idx],
    paidAmount,
  };
}

// =============================================================================
// HYBRID LOGISTICS: DELIVERY PARTNERS, KYC SELF-REGISTRATION, COD LEDGER & GPS
// =============================================================================

export function getStoredOrdersLocal(): Order[] {
  return readJSON<Order[]>(KEYS.orders, DEFAULT_ORDERS);
}

function normalizeDeliveryBoyRecord(raw: Partial<DeliveryBoy>): DeliveryBoy {
  const kycRaw = (raw.kycStatus || 'approved').toString().toLowerCase();
  const kycStatus: RiderKycStatus =
    kycRaw === 'pending_kyc' || kycRaw === 'pending'
      ? 'pending_kyc'
      : kycRaw === 'rejected'
      ? 'rejected'
      : 'approved';
  const vehicleParts = [raw.vehicleType, raw.vehicleNumber, raw.areaPincode]
    .map((v) => (v || '').trim())
    .filter(Boolean);
  const vehicleArea =
    (raw.vehicleArea || '').trim() ||
    (vehicleParts.length > 0 ? vehicleParts.join(' • ') : 'Local Delivery Zone');

  return {
    id: raw.id || raw.docId || `rider_${Date.now()}`,
    docId: raw.docId || raw.id,
    riderId: (raw.riderId || 'RDR-101').trim().toUpperCase(),
    name: (raw.name || 'Delivery Partner').trim(),
    phone: (raw.phone || '').trim(),
    email: (raw.email || '').trim().toLowerCase(),
    password: String(raw.password || ''),
    vehicleType: raw.vehicleType?.trim() || undefined,
    vehicleNumber: raw.vehicleNumber?.trim().toUpperCase() || undefined,
    areaPincode: raw.areaPincode?.trim() || undefined,
    vehicleArea,
    aadhaarNumber: raw.aadhaarNumber?.trim() || undefined,
    aadhaarPhoto: raw.aadhaarPhoto || undefined,
    drivingLicensePhoto: raw.drivingLicensePhoto || undefined,
    selfiePhoto: raw.selfiePhoto || undefined,
    kycStatus,
    kycSubmittedAt: raw.kycSubmittedAt,
    kycReviewedAt: raw.kycReviewedAt,
    kycRejectionReason: raw.kycRejectionReason,
    codCashInHand: Math.max(0, Math.round(Number(raw.codCashInHand || 0) * 100) / 100),
    totalCodSettled: Math.max(0, Math.round(Number(raw.totalCodSettled || 0) * 100) / 100),
    lastCashSettledAt: raw.lastCashSettledAt,
    cashSettlementHistory: Array.isArray(raw.cashSettlementHistory) ? raw.cashSettlementHistory : [],
    status: raw.status === 'inactive' ? 'inactive' : 'active',
    created_at: raw.created_at || new Date().toISOString(),
  };
}

export function getStoredDeliveryBoysLocal(): DeliveryBoy[] {
  return readJSON<DeliveryBoy[]>(KEYS.deliveryBoys, []).map((r) => normalizeDeliveryBoyRecord(r));
}

export function cacheDeliveryBoysLocal(riders: DeliveryBoy[]): void {
  if (!Array.isArray(riders)) return;
  const existing = getStoredDeliveryBoysLocal();
  const byKey = new Map<string, DeliveryBoy>();
  existing.forEach((r) => {
    const key = r.docId || r.id || r.riderId;
    byKey.set(key, r);
  });
  riders.forEach((r) => {
    const norm = normalizeDeliveryBoyRecord(r);
    const key = norm.docId || norm.id || norm.riderId;
    byKey.set(key, norm);
  });
  const merged = Array.from(byKey.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  writeJSON(KEYS.deliveryBoys, merged);

  const cur = getStoredCurrentRider();
  if (cur) {
    const refreshed = merged.find(
      (r) =>
        r.id === cur.id ||
        (cur.docId && r.docId === cur.docId) ||
        r.riderId.toLowerCase() === cur.riderId.toLowerCase()
    );
    if (refreshed) {
      setStoredCurrentRider(refreshed);
    }
  }
}

export function getStoredCurrentRider(): DeliveryBoy | null {
  const raw = readJSON<DeliveryBoy | null>(KEYS.currentRider, null);
  return raw ? normalizeDeliveryBoyRecord(raw) : null;
}

export function setStoredCurrentRider(rider: DeliveryBoy | null): void {
  if (!rider) {
    localStorage.removeItem(KEYS.currentRider);
    return;
  }
  writeJSON(KEYS.currentRider, normalizeDeliveryBoyRecord(rider));
}

export function saveDeliveryBoyLocal(payload: {
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
}): { success: boolean; message: string; rider?: DeliveryBoy } {
  const cleanName = payload.name.trim();
  const cleanPhone = payload.phone.replace(/\D/g, '').slice(-10) || payload.phone.trim();
  const cleanEmail = (payload.email || '').trim().toLowerCase();
  const cleanPassword = payload.password.trim();
  const cleanVehicle = payload.vehicleArea.trim();

  if (cleanName.length < 2) {
    return { success: false, message: 'Please enter the Delivery Boy full name.' };
  }
  if (cleanPhone.length < 10) {
    return { success: false, message: 'Please enter a valid 10-digit phone number.' };
  }
  if (cleanPassword.length < 4) {
    return { success: false, message: 'Login PIN / Password must be at least 4 characters.' };
  }
  if (!cleanVehicle) {
    return { success: false, message: 'Please enter Vehicle & Delivery Area (e.g., Bike • Bawana 110039).' };
  }

  const list = getStoredDeliveryBoysLocal();
  const nowIso = new Date().toISOString();
  const existingIdx = payload.id
    ? list.findIndex((r) => r.id === payload.id || (payload.docId && r.docId === payload.docId))
    : -1;

  const autoRiderId =
    (payload.riderId || '').trim().toUpperCase() ||
    (existingIdx !== -1
      ? list[existingIdx].riderId
      : `RDR-${Math.floor(1000 + Math.random() * 9000)}`);

  const duplicate = list.find(
    (r, idx) =>
      idx !== existingIdx &&
      (r.phone === cleanPhone ||
        r.riderId.toLowerCase() === autoRiderId.toLowerCase() ||
        (cleanEmail && r.email && r.email.toLowerCase() === cleanEmail))
  );
  if (duplicate) {
    return {
      success: false,
      message: 'A Delivery Partner with this Phone, Rider ID, or Email already exists.',
    };
  }

  const record: DeliveryBoy =
    existingIdx !== -1
      ? normalizeDeliveryBoyRecord({
          ...list[existingIdx],
          riderId: autoRiderId,
          name: cleanName,
          phone: cleanPhone,
          email: cleanEmail,
          password: cleanPassword,
          vehicleType: payload.vehicleType ?? list[existingIdx].vehicleType,
          vehicleNumber: payload.vehicleNumber ?? list[existingIdx].vehicleNumber,
          areaPincode: payload.areaPincode ?? list[existingIdx].areaPincode,
          vehicleArea: cleanVehicle,
          aadhaarNumber: payload.aadhaarNumber ?? list[existingIdx].aadhaarNumber,
          aadhaarPhoto: payload.aadhaarPhoto ?? list[existingIdx].aadhaarPhoto,
          drivingLicensePhoto: payload.drivingLicensePhoto ?? list[existingIdx].drivingLicensePhoto,
          selfiePhoto: payload.selfiePhoto ?? list[existingIdx].selfiePhoto,
          kycStatus: payload.kycStatus ?? list[existingIdx].kycStatus ?? 'approved',
          status: payload.status ?? list[existingIdx].status,
        })
      : normalizeDeliveryBoyRecord({
          id: payload.id || `rider_${Date.now()}`,
          docId: payload.docId || payload.id || `rider_${Date.now()}`,
          riderId: autoRiderId,
          name: cleanName,
          phone: cleanPhone,
          email: cleanEmail,
          password: cleanPassword,
          vehicleType: payload.vehicleType,
          vehicleNumber: payload.vehicleNumber,
          areaPincode: payload.areaPincode,
          vehicleArea: cleanVehicle,
          aadhaarNumber: payload.aadhaarNumber,
          aadhaarPhoto: payload.aadhaarPhoto,
          drivingLicensePhoto: payload.drivingLicensePhoto,
          selfiePhoto: payload.selfiePhoto,
          kycStatus: payload.kycStatus ?? 'approved',
          kycReviewedAt: payload.kycStatus === 'pending_kyc' ? undefined : nowIso,
          codCashInHand: 0,
          totalCodSettled: 0,
          cashSettlementHistory: [],
          status: payload.status ?? 'active',
          created_at: nowIso,
        });

  if (existingIdx !== -1) {
    list[existingIdx] = record;
  } else {
    list.unshift(record);
  }
  writeJSON(KEYS.deliveryBoys, list);
  return {
    success: true,
    message:
      existingIdx !== -1
        ? `${record.name} updated successfully.`
        : `${record.name} (${record.riderId}) added as Delivery Partner.`,
    rider: record,
  };
}

export function submitRiderKycApplicationLocal(payload: {
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
}): { success: boolean; message: string; rider?: DeliveryBoy } {
  const cleanName = payload.name.trim();
  const cleanPhone = payload.phone.replace(/\D/g, '').slice(-10);
  const cleanEmail = (payload.email || '').trim().toLowerCase();
  const cleanArea = payload.areaPincode.trim();
  const cleanVehicleType = payload.vehicleType.trim();
  const cleanVehicleNo = payload.vehicleNumber.trim().toUpperCase();
  const cleanAadhaar = payload.aadhaarNumber.replace(/\D/g, '');
  const cleanPin = payload.loginPin.replace(/\D/g, '');

  if (cleanName.length < 2) {
    return { success: false, message: 'Please enter your Full Name.' };
  }
  if (!isValidIndianMobile(cleanPhone)) {
    return {
      success: false,
      message: 'Please enter a valid 10-digit Indian Mobile Number starting with 6, 7, 8, or 9.',
    };
  }
  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return {
      success: false,
      message: 'Please enter and verify a valid Email Address.',
    };
  }
  if (cleanArea.length < 3 || !/[1-9]\d{5}/.test(cleanArea)) {
    return { success: false, message: 'Please enter a valid 6-digit Indian Pincode verified via India Post.' };
  }
  if (!cleanVehicleType || !isValidIndianVehicleNumber(cleanVehicleNo)) {
    return {
      success: false,
      message: 'Please enter a valid Indian RTO Vehicle Number (e.g., DL01AB1234).',
    };
  }
  if (!isValidAadhaarVerhoeff(cleanAadhaar)) {
    return {
      success: false,
      message: 'Invalid 12-digit Aadhaar Number. Must start with 2-9 and pass official Verhoeff checksum.',
    };
  }
  if (!payload.aadhaarPhoto) {
    return { success: false, message: 'Please capture your Aadhaar Card photo using live camera.' };
  }
  if (!payload.drivingLicensePhoto) {
    return { success: false, message: 'Please capture your Driving License photo using live camera.' };
  }
  if (!payload.selfiePhoto) {
    return { success: false, message: 'Please capture your Live Selfie using front camera.' };
  }
  if (cleanPin.length !== 4) {
    return { success: false, message: 'Please create a 4-digit numeric Login PIN.' };
  }

  const sellerWithSamePhone = getStoredSellersLocal().find(
    (s) => s.phone.replace(/\D/g, '').slice(-10) === cleanPhone
  );
  if (sellerWithSamePhone) {
    return {
      success: false,
      message: 'This mobile number is already registered with an existing Seller account.',
    };
  }

  const list = getStoredDeliveryBoysLocal();
  const existing = list.find(
    (r) => r.phone === cleanPhone || (cleanEmail && r.email && r.email === cleanEmail)
  );
  if (existing) {
    if (existing.kycStatus === 'pending_kyc') {
      return {
        success: false,
        message: 'An application with this mobile number is already Pending KYC review by Admin.',
      };
    }
    if (existing.kycStatus === 'approved') {
      return {
        success: false,
        message: 'This mobile number is already registered as an approved Delivery Partner. Please sign in.',
      };
    }
  }

  const nowIso = new Date().toISOString();
  const docId = existing?.docId || existing?.id || `rider_${Date.now()}`;
  const riderId = existing?.riderId || `RDR-${Math.floor(1000 + Math.random() * 9000)}`;
  const vehicleArea = `${cleanVehicleType} (${cleanVehicleNo}) • ${cleanArea}`;

  const application: DeliveryBoy = normalizeDeliveryBoyRecord({
    id: docId,
    docId,
    riderId,
    name: cleanName,
    phone: cleanPhone,
    email: cleanEmail,
    password: cleanPin,
    vehicleType: cleanVehicleType,
    vehicleNumber: cleanVehicleNo,
    areaPincode: cleanArea,
    vehicleArea,
    aadhaarNumber: cleanAadhaar,
    aadhaarPhoto: payload.aadhaarPhoto,
    drivingLicensePhoto: payload.drivingLicensePhoto,
    selfiePhoto: payload.selfiePhoto,
    kycStatus: 'pending_kyc',
    kycSubmittedAt: nowIso,
    kycRejectionReason: undefined,
    codCashInHand: 0,
    totalCodSettled: 0,
    cashSettlementHistory: [],
    status: 'inactive',
    created_at: nowIso,
  });

  const nextList = existing
    ? list.map((r) => (r.id === existing.id ? application : r))
    : [application, ...list];
  writeJSON(KEYS.deliveryBoys, nextList);

  return {
    success: true,
    message: `Application submitted! Your Rider ID is ${riderId}. KYC Verification Pending from Admin.`,
    rider: application,
  };
}

export function reviewRiderKycLocal(
  id: string,
  decision: 'approved' | 'rejected',
  reason?: string
): { success: boolean; message: string; rider?: DeliveryBoy } {
  const list = getStoredDeliveryBoysLocal();
  const idx = list.findIndex((r) => r.id === id || r.docId === id);
  if (idx === -1) return { success: false, message: 'Rider application not found.' };
  const nowIso = new Date().toISOString();
  list[idx] = {
    ...list[idx],
    kycStatus: decision,
    kycReviewedAt: nowIso,
    kycRejectionReason: decision === 'rejected' ? (reason || 'KYC documents did not pass verification.').trim() : undefined,
    status: decision === 'approved' ? 'active' : 'inactive',
  };
  writeJSON(KEYS.deliveryBoys, list);
  return {
    success: true,
    message:
      decision === 'approved'
        ? `${list[idx].name} (${list[idx].riderId}) KYC approved and activated!`
        : `${list[idx].name}'s KYC application was rejected.`,
    rider: list[idx],
  };
}

export function toggleDeliveryBoyStatusLocal(
  id: string,
  status: 'active' | 'inactive'
): { success: boolean; message: string; rider?: DeliveryBoy } {
  const list = getStoredDeliveryBoysLocal();
  const idx = list.findIndex((r) => r.id === id || r.docId === id);
  if (idx === -1) return { success: false, message: 'Delivery partner not found.' };
  list[idx] = { ...list[idx], status };
  writeJSON(KEYS.deliveryBoys, list);
  return {
    success: true,
    message: `${list[idx].name} is now ${status === 'active' ? 'Active' : 'Inactive'}.`,
    rider: list[idx],
  };
}

export function deleteDeliveryBoyLocal(id: string): void {
  const list = getStoredDeliveryBoysLocal().filter((r) => r.id !== id && r.docId !== id);
  writeJSON(KEYS.deliveryBoys, list);
}

export function authenticateDeliveryBoyLocal(
  identifier: string,
  password: string,
  ridersOverride?: DeliveryBoy[]
): { success: boolean; message: string; rider?: DeliveryBoy; pendingKyc?: boolean } {
  const cleanId = identifier.trim().toLowerCase();
  const cleanPhone = identifier.replace(/\D/g, '').slice(-10);
  const cleanPass = password.trim();
  if (!cleanId || !cleanPass) {
    return { success: false, message: 'Enter your Phone Number, Rider ID, or Email and 4-digit PIN.' };
  }

  const list = ridersOverride && ridersOverride.length > 0 ? ridersOverride : getStoredDeliveryBoysLocal();
  const matched = list.find((r) => {
    const idMatch =
      r.riderId.toLowerCase() === cleanId ||
      (r.email && r.email.toLowerCase() === cleanId) ||
      (cleanPhone.length >= 10 && r.phone.replace(/\D/g, '').slice(-10) === cleanPhone) ||
      r.phone.toLowerCase() === cleanId;
    return idMatch && r.password === cleanPass;
  });

  if (!matched) {
    return { success: false, message: 'Invalid Delivery Partner credentials or PIN.' };
  }
  if (matched.kycStatus === 'pending_kyc') {
    return {
      success: false,
      pendingKyc: true,
      message: 'KYC Verification Pending from Admin. You can sign in once your Aadhaar, DL & Selfie are approved.',
    };
  }
  if (matched.kycStatus === 'rejected') {
    return {
      success: false,
      message: `KYC Application Rejected${matched.kycRejectionReason ? `: ${matched.kycRejectionReason}` : '. Please contact Admin or re-apply.'}`,
    };
  }
  if (matched.status !== 'active') {
    return {
      success: false,
      message: 'Your Delivery Partner account is currently Inactive. Please contact Smart Basket Admin.',
    };
  }

  setStoredCurrentRider(matched);
  return { success: true, message: `Welcome back, ${matched.name}!`, rider: matched };
}

export function recordRiderCodCollectionLocal(
  riderId: string,
  amount: number
): { success: boolean; rider?: DeliveryBoy } {
  const addAmt = Math.max(0, Math.round(Number(amount || 0) * 100) / 100);
  if (!riderId || addAmt <= 0) return { success: false };
  const list = getStoredDeliveryBoysLocal();
  const idx = list.findIndex((r) => r.id === riderId || r.docId === riderId || r.riderId === riderId);
  if (idx === -1) return { success: false };
  const nextCash = Math.round((Number(list[idx].codCashInHand || 0) + addAmt) * 100) / 100;
  list[idx] = { ...list[idx], codCashInHand: nextCash };
  writeJSON(KEYS.deliveryBoys, list);
  const cur = getStoredCurrentRider();
  if (cur && (cur.id === list[idx].id || cur.riderId === list[idx].riderId)) {
    setStoredCurrentRider(list[idx]);
  }
  return { success: true, rider: list[idx] };
}

export function settleRiderCodCashLocal(
  riderId: string,
  note?: string
): { success: boolean; message: string; settledAmount?: number; rider?: DeliveryBoy } {
  const list = getStoredDeliveryBoysLocal();
  const idx = list.findIndex((r) => r.id === riderId || r.docId === riderId || r.riderId === riderId);
  if (idx === -1) return { success: false, message: 'Delivery partner not found.' };

  const amount = Math.max(0, Math.round(Number(list[idx].codCashInHand || 0) * 100) / 100);
  if (amount <= 0) {
    return { success: false, message: `${list[idx].name} has ₹0 COD cash pending.` };
  }

  const nowIso = new Date().toISOString();
  const history = Array.isArray(list[idx].cashSettlementHistory) ? list[idx].cashSettlementHistory! : [];
  const entry: RiderCashSettlement = {
    id: `cod_${Date.now()}`,
    amount,
    settledAt: nowIso,
    note: note?.trim() || 'Settled with Admin',
  };

  list[idx] = {
    ...list[idx],
    codCashInHand: 0,
    totalCodSettled: Math.round((Number(list[idx].totalCodSettled || 0) + amount) * 100) / 100,
    lastCashSettledAt: nowIso,
    cashSettlementHistory: [entry, ...history].slice(0, 25),
  };
  writeJSON(KEYS.deliveryBoys, list);

  const cur = getStoredCurrentRider();
  if (cur && (cur.id === list[idx].id || cur.riderId === list[idx].riderId)) {
    setStoredCurrentRider(list[idx]);
  }

  return {
    success: true,
    settledAmount: amount,
    rider: list[idx],
    message: `Settled ₹${amount.toLocaleString('en-IN')} COD cash from ${list[idx].name}.`,
  };
}

export function assignOrderRiderLocal(
  orderId: number,
  rider: DeliveryBoy | null,
  deliveryOtp?: string
): { success: boolean; message: string; order?: Order; otp?: string } {
  const orders = readJSON<Order[]>(KEYS.orders, DEFAULT_ORDERS);
  const idx = orders.findIndex((o) => o.id === orderId);
  const otpToUse = deliveryOtp || (idx !== -1 && orders[idx].deliveryOtp) || generateDeliveryOtp();
  if (idx === -1) {
    return { success: true, message: rider ? `Assigned to ${rider.name}.` : 'Rider unassigned.', otp: otpToUse };
  }

  if (!rider) {
    orders[idx] = {
      ...orders[idx],
      dispatchMode: orders[idx].trackingId ? 'courier' : undefined,
      deliveryBoyId: undefined,
      deliveryBoyName: undefined,
      deliveryBoyPhone: undefined,
      deliveryBoyEmail: undefined,
      deliveryBoyVehicle: undefined,
      deliveryAssignedAt: undefined,
      riderLiveLat: undefined,
      riderLiveLng: undefined,
      riderLocationUpdatedAt: undefined,
    };
    writeJSON(KEYS.orders, orders);
    return { success: true, message: `Rider unassigned from Order #${orderId}.`, order: orders[idx], otp: otpToUse };
  }

  const nowIso = new Date().toISOString();
  orders[idx] = {
    ...orders[idx],
    dispatchMode: 'rider',
    deliveryBoyId: rider.docId || rider.id,
    deliveryBoyName: rider.name,
    deliveryBoyPhone: rider.phone,
    deliveryBoyEmail: rider.email || undefined,
    deliveryBoyVehicle: rider.vehicleArea,
    deliveryAssignedAt: nowIso,
    deliveryOtp: otpToUse,
    deliveryOtpVerified: false,
    pincode: extractPincodeFromAddress(orders[idx].address, orders[idx].pincode),
    courierName: 'Smart Basket Rider',
    trackingNote: `Assigned to Delivery Partner ${rider.name}`,
  };
  writeJSON(KEYS.orders, orders);
  return {
    success: true,
    message: `Order #${orderId} assigned to ${rider.name}. Delivery OTP: ${otpToUse}`,
    order: orders[idx],
    otp: otpToUse,
  };
}

export function shipOrderViaCourierLocal(
  orderId: number,
  payload: {
    courierName: string;
    trackingId: string;
    trackingUrl?: string;
    trackingNote?: string;
  }
): { success: boolean; message: string; order?: Order } {
  const cleanCourier = payload.courierName.trim();
  const cleanAwb = payload.trackingId.trim();
  if (!cleanCourier || !cleanAwb) {
    return { success: false, message: 'Courier Partner Name and AWB Tracking Number are required.' };
  }
  const orders = readJSON<Order[]>(KEYS.orders, DEFAULT_ORDERS);
  const idx = orders.findIndex((o) => o.id === orderId);
  if (idx === -1) {
    return { success: true, message: `Order #${orderId} shipped via ${cleanCourier}.` };
  }
  orders[idx] = {
    ...orders[idx],
    dispatchMode: 'courier',
    status: 'Shipped',
    courierName: cleanCourier,
    trackingId: cleanAwb,
    trackingUrl: (payload.trackingUrl || '').trim() || undefined,
    trackingNote: (payload.trackingNote || '').trim() || `Dispatched via ${cleanCourier}`,
    deliveryBoyId: undefined,
    deliveryBoyName: undefined,
    deliveryBoyPhone: undefined,
    deliveryBoyEmail: undefined,
    deliveryBoyVehicle: undefined,
    riderLiveLat: undefined,
    riderLiveLng: undefined,
    riderLocationUpdatedAt: undefined,
  };
  writeJSON(KEYS.orders, orders);
  return {
    success: true,
    message: `Order #${orderId} dispatched via ${cleanCourier} (AWB: ${cleanAwb}).`,
    order: orders[idx],
  };
}

export function markOrderOutForDeliveryLocal(
  orderId: number,
  coords?: { lat: number; lng: number } | null
): { success: boolean; message: string; order?: Order } {
  const orders = readJSON<Order[]>(KEYS.orders, DEFAULT_ORDERS);
  const idx = orders.findIndex((o) => o.id === orderId);
  if (idx === -1) return { success: true, message: `Order #${orderId} marked Out for Delivery.` };
  const nowIso = new Date().toISOString();
  orders[idx] = {
    ...orders[idx],
    status: 'Out for Delivery',
    deliveryOutForDeliveryAt: nowIso,
    riderLiveLat: coords ? coords.lat : orders[idx].riderLiveLat,
    riderLiveLng: coords ? coords.lng : orders[idx].riderLiveLng,
    riderLocationUpdatedAt: coords ? nowIso : orders[idx].riderLocationUpdatedAt,
    trackingNote: orders[idx].deliveryBoyName
      ? `Out for Delivery with ${orders[idx].deliveryBoyName}`
      : 'Out for Delivery',
  };
  writeJSON(KEYS.orders, orders);
  return { success: true, message: `Order #${orderId} is now Out for Delivery.`, order: orders[idx] };
}

export function updateOrderRiderLocationLocal(
  orderId: number,
  lat: number,
  lng: number
): { success: boolean; message: string } {
  const orders = readJSON<Order[]>(KEYS.orders, DEFAULT_ORDERS);
  const idx = orders.findIndex((o) => o.id === orderId);
  if (idx !== -1) {
    orders[idx] = {
      ...orders[idx],
      riderLiveLat: lat,
      riderLiveLng: lng,
      riderLocationUpdatedAt: new Date().toISOString(),
    };
    writeJSON(KEYS.orders, orders);
  }
  return { success: true, message: 'Live GPS location shared with customer.' };
}

export function verifyAndDeliverOrderLocal(
  orderId: number,
  enteredOtp: string,
  expectedOtp?: string,
  riderIdOverride?: string,
  codAmountOverride?: number
): { success: boolean; message: string; order?: Order; codCollected?: number } {
  const cleanEntered = enteredOtp.replace(/\D/g, '').slice(0, 4);
  if (cleanEntered.length !== 4) {
    return { success: false, message: 'Please enter the 4-digit Delivery OTP provided by the customer.' };
  }

  const orders = readJSON<Order[]>(KEYS.orders, DEFAULT_ORDERS);
  const idx = orders.findIndex((o) => o.id === orderId);
  const targetOtp = (expectedOtp || (idx !== -1 ? orders[idx].deliveryOtp : '') || '').trim();
  if (targetOtp && cleanEntered !== targetOtp) {
    return { success: false, message: 'Incorrect Delivery OTP. Please check with the customer and try again.' };
  }

  const nowIso = new Date().toISOString();
  let codCollected = 0;

  if (idx !== -1) {
    const ord = orders[idx];
    const wasAlreadyDelivered = ord.status === 'Delivered';
    const isCod = !isOnlinePaidOrder(ord);
    orders[idx] = {
      ...ord,
      status: 'Delivered',
      deliveryOtpVerified: true,
      deliveredAt: nowIso,
      trackingNote: ord.deliveryBoyName
        ? `Delivered by ${ord.deliveryBoyName} (OTP Verified)`
        : 'Delivered (OTP Verified)',
    };
    writeJSON(KEYS.orders, orders);

    if (!wasAlreadyDelivered && isCod) {
      const rId = riderIdOverride || ord.deliveryBoyId;
      const amt = codAmountOverride ?? Number(ord.total_amount ?? ord.total ?? 0);
      if (rId && amt > 0) {
        recordRiderCodCollectionLocal(rId, amt);
        codCollected = amt;
      }
    }
    return {
      success: true,
      message:
        codCollected > 0
          ? `Order #${orderId} delivered! ₹${codCollected.toLocaleString('en-IN')} added to your COD Cash in Hand.`
          : `Order #${orderId} verified & marked Delivered!`,
      order: orders[idx],
      codCollected,
    };
  }

  if (riderIdOverride && codAmountOverride && codAmountOverride > 0) {
    recordRiderCodCollectionLocal(riderIdOverride, codAmountOverride);
    codCollected = codAmountOverride;
  }

  return {
    success: true,
    message:
      codCollected > 0
        ? `Order #${orderId} delivered! ₹${codCollected.toLocaleString('en-IN')} added to your COD Cash in Hand.`
        : `Order #${orderId} verified & marked Delivered!`,
    codCollected,
  };
}

