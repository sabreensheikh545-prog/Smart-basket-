export interface Category {
  id: number;
  docId?: string;
  name: string;
  image: string;
}

export interface Product {
  id: number;
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
  created_at: string;
  sellerId?: string;
  sellerEmail?: string;
  sellerName?: string;
}

export interface User {
  id: number;
  uid?: string;
  docId?: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  status: 'active' | 'blocked';
  created_at: string;
  role?: 'customer' | 'seller' | 'admin' | 'rider';
  isSeller?: boolean;
  sellerStoreName?: string;
}

export type RiderKycStatus = 'pending_kyc' | 'approved' | 'rejected';

export interface RiderCashSettlement {
  id: string;
  amount: number;
  settledAt: string;
  note?: string;
}

export interface DeliveryBoy {
  id: string;
  docId?: string;
  riderId: string;
  name: string;
  phone: string;
  email: string;
  password: string;
  vehicleType?: string;
  vehicleNumber?: string;
  areaPincode?: string;
  vehicleArea: string;
  aadhaarNumber?: string;
  aadhaarPhoto?: string;
  drivingLicensePhoto?: string;
  selfiePhoto?: string;
  kycStatus: RiderKycStatus;
  kycSubmittedAt?: string;
  kycReviewedAt?: string;
  kycRejectionReason?: string;
  codCashInHand: number;
  totalCodSettled?: number;
  lastCashSettledAt?: string;
  cashSettlementHistory?: RiderCashSettlement[];
  status: 'active' | 'inactive';
  created_at: string;
}

export type AddressLabel = 'Home' | 'Work' | 'Other';

export interface SavedAddress {
  id: string;
  label: AddressLabel;
  name: string;
  phone: string;
  houseStreet: string;
  area?: string;
  city: string;
  state?: string;
  pincode: string;
  isDefault?: boolean;
  updatedAt?: string;
}

export interface DeliverySettings {
  freeDeliveryThreshold: number;
  deliveryCharge: number;
  platformFee: number;
  updatedAt?: string;
}

export const DEFAULT_DELIVERY_SETTINGS: DeliverySettings = {
  freeDeliveryThreshold: 499,
  deliveryCharge: 40,
  platformFee: 10,
};

export interface PromoCode {
  id: string;
  docId?: string;
  code: string;
  discountType: 'flat' | 'percent';
  discountValue: number;
  maxDiscount?: number;
  minOrderValue: number;
  description?: string;
  active: boolean;
  usedCount?: number;
  created_at: string;
}

export interface ProductReview {
  id: string;
  docId?: string;
  productId: number;
  productDocId?: string;
  orderId: number;
  orderDocId?: string;
  userId: string;
  userName: string;
  rating: number;
  title: string;
  comment: string;
  verifiedPurchase: boolean;
  created_at: string;
}

export function calculatePromoDiscount(subtotal: number, promo?: PromoCode | null): number {
  if (!promo || !promo.active) return 0;
  const cleanSubtotal = Math.max(0, Number(subtotal) || 0);
  if (cleanSubtotal <= 0 || cleanSubtotal < Number(promo.minOrderValue || 0)) return 0;
  if (promo.discountType === 'percent') {
    const pct = Math.min(100, Math.max(0, Number(promo.discountValue) || 0));
    const raw = Math.round((cleanSubtotal * pct) / 100);
    const cap = promo.maxDiscount && promo.maxDiscount > 0 ? Math.min(raw, promo.maxDiscount) : raw;
    return Math.min(cleanSubtotal, Math.max(0, cap));
  }
  const flat = Math.max(0, Number(promo.discountValue) || 0);
  return Math.min(cleanSubtotal, Math.round(flat));
}

export function formatSavedAddressLine(addr: Pick<SavedAddress, 'houseStreet' | 'area' | 'city' | 'state' | 'pincode'>): string {
  const parts = [addr.houseStreet, addr.area, addr.city, addr.state].filter(Boolean);
  return `${parts.join(', ')}${addr.pincode ? ` - ${addr.pincode}` : ''}`;
}

export const SELLER_PLATFORM_COMMISSION_RATE = 0.1;

export interface SellerPayoutRecord {
  id: string;
  amount: number;
  payoutAccount: string;
  status: 'requested' | 'paid';
  requestedAt: string;
  paidAt?: string;
}

export interface SellerProfile {
  id: string;
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
  payoutStatus?: 'none' | 'requested' | 'paid';
  payoutRequestedAt?: string;
  lastPayoutPaidAt?: string;
  payoutHistory?: SellerPayoutRecord[];
  status: 'approved' | 'pending' | 'blocked' | 'active' | 'suspended';
  created_at: string;
}

export function calculateSellerEarnings(
  deliveredSales: number,
  seller?: Pick<SellerProfile, 'totalPaidOut' | 'pendingPayoutAmount'> | null
) {
  const grossDelivered = Math.max(0, Math.round(Number(deliveredSales || 0) * 100) / 100);
  const platformFee = Math.round(grossDelivered * SELLER_PLATFORM_COMMISSION_RATE * 100) / 100;
  const netEarnings = Math.max(0, Math.round((grossDelivered - platformFee) * 100) / 100);
  const totalPaidOut = Math.max(0, Math.round(Number(seller?.totalPaidOut || 0) * 100) / 100);
  const pendingPayout = Math.max(0, Math.round(Number(seller?.pendingPayoutAmount || 0) * 100) / 100);
  const withdrawableBalance = Math.max(
    0,
    Math.round((netEarnings - totalPaidOut - pendingPayout) * 100) / 100
  );
  return {
    grossDelivered,
    platformFee,
    netEarnings,
    totalPaidOut,
    pendingPayout,
    withdrawableBalance,
  };
}

export interface OrderItem {
  id: number;
  order_id: number;
  product_id: number;
  product_doc_id?: string;
  product_name: string;
  product_image: string;
  quantity: number;
  price: number;
  sellerId?: string;
  sellerEmail?: string;
  sellerName?: string;
}

export type OrderStatus =
  | 'Placed'
  | 'Confirmed'
  | 'Packed'
  | 'Shipped'
  | 'Dispatched'
  | 'Out for Delivery'
  | 'Delivered'
  | 'Return Requested'
  | 'Return Approved'
  | 'Refunded'
  | 'Cancelled';

export const COURIER_PARTNERS = [
  'Shiprocket',
  'Porter',
  'Delhivery',
  'Borzo',
  'BlueDart',
  'India Post',
  'Local Rider',
] as const;

export const RETURN_REASONS = [
  'Damaged Item',
  'Wrong Item Delivered',
  'Quality Issue',
  'Missing Parts / Accessories',
  'Defective / Not Working',
] as const;

export const ORDER_STATUS_OPTIONS: { value: OrderStatus; label: string }[] = [
  { value: 'Confirmed', label: 'Order Confirmed' },
  { value: 'Packed', label: 'Packed' },
  { value: 'Shipped', label: 'Shipped' },
  { value: 'Out for Delivery', label: 'Out for Delivery' },
  { value: 'Delivered', label: 'Delivered' },
  { value: 'Return Requested', label: 'Return Requested' },
  { value: 'Return Approved', label: 'Return Approved' },
  { value: 'Refunded', label: 'Refunded' },
  { value: 'Cancelled', label: 'Cancelled' },
];

export interface Order {
  id: number;
  docId?: string;
  user_id: number;
  userId?: string;
  name: string;
  phone: string;
  email?: string;
  address: string;
  total_amount: number;
  total?: number;
  subtotal?: number;
  deliveryFee?: number;
  platformFee?: number;
  couponCode?: string;
  couponDiscount?: number;
  stockDeducted?: boolean;
  stockRestored?: boolean;
  paymentMethod?: string;
  status: OrderStatus;
  courierName?: string;
  trackingId?: string;
  trackingUrl?: string;
  trackingNote?: string;
  returnReason?: string;
  returnResolution?: 'Return' | 'Replace';
  returnRequestedAt?: string;
  created_at: string;
  items: OrderItem[];
  sellerIds?: string[];
  sellerEmails?: string[];
  pincode?: string;
  dispatchMode?: 'rider' | 'courier';
  deliveryBoyId?: string;
  deliveryBoyName?: string;
  deliveryBoyPhone?: string;
  deliveryBoyEmail?: string;
  deliveryBoyVehicle?: string;
  deliveryAssignedAt?: string;
  deliveryOutForDeliveryAt?: string;
  deliveredAt?: string;
  deliveryOtp?: string;
  deliveryOtpVerified?: boolean;
  riderLiveLat?: number;
  riderLiveLng?: number;
  riderLocationUpdatedAt?: string;
}

export interface CartEntry {
  product: Product;
  quantity: number;
}

export function normalizeSellerStatus(status?: string): 'approved' | 'pending' | 'blocked' {
  const s = (status || '').toLowerCase();
  if (s === 'approved' || s === 'active') return 'approved';
  if (s === 'blocked' || s === 'suspended') return 'blocked';
  return 'pending';
}

export function normalizeOrderStatus(status?: string): OrderStatus {
  if (status === 'Placed') return 'Confirmed';
  if (status === 'Dispatched') return 'Shipped';
  const allowed: OrderStatus[] = [
    'Confirmed',
    'Packed',
    'Shipped',
    'Out for Delivery',
    'Delivered',
    'Return Requested',
    'Return Approved',
    'Refunded',
    'Cancelled',
  ];
  return allowed.includes(status as OrderStatus) ? (status as OrderStatus) : 'Confirmed';
}

export function getOrderStepIndex(status: OrderStatus): number {
  switch (status) {
    case 'Delivered':
    case 'Return Requested':
    case 'Return Approved':
    case 'Refunded':
      return 5;
    case 'Out for Delivery':
      return 4;
    case 'Shipped':
    case 'Dispatched':
      return 3;
    case 'Packed':
      return 2;
    case 'Cancelled':
      return 0;
    case 'Confirmed':
    case 'Placed':
    default:
      return 1;
  }
}

export function getOrderStatusLabel(status: OrderStatus): string {
  if (status === 'Placed' || status === 'Confirmed') return 'Order Confirmed';
  if (status === 'Dispatched') return 'Shipped';
  return status;
}

export function getCourierTrackingUrl(
  courierName?: string,
  trackingId?: string,
  trackingUrl?: string
): string {
  const custom = (trackingUrl || '').trim();
  if (custom) {
    return /^https?:\/\//i.test(custom) ? custom : `https://${custom}`;
  }
  const awb = (trackingId || '').trim();
  const courier = (courierName || '').trim().toLowerCase();
  if (!awb) return '';
  const encodedAwb = encodeURIComponent(awb);
  if (courier.includes('delhivery')) {
    return `https://www.delhivery.com/track-v2/package/${encodedAwb}`;
  }
  if (courier.includes('shiprocket')) {
    return `https://www.shiprocket.in/shipment-tracking/?awb=${encodedAwb}`;
  }
  if (courier.includes('bluedart') || courier.includes('blue dart')) {
    return `https://www.bluedart.com/tracking?trackFor=0&trackNo=${encodedAwb}`;
  }
  if (courier.includes('india post') || courier.includes('indiapost')) {
    return `https://www.indiapost.gov.in/_layouts/15/dop.portal.tracking/trackconsignment.aspx`;
  }
  if (courier.includes('porter')) {
    return `https://porter.in/track?order_id=${encodedAwb}`;
  }
  if (courier.includes('borzo')) {
    return `https://borzodelivery.com/in/track/${encodedAwb}`;
  }
  return `https://www.google.com/search?q=${encodeURIComponent(`${courierName || 'courier'} tracking ${awb}`)}`;
}

export function formatINR(amount: number): string {
  const num = Number(amount || 0);
  const hasDecimals = Math.round(num * 100) % 100 !== 0;
  return (
    '₹' +
    num.toLocaleString('en-IN', {
      minimumFractionDigits: hasDecimals ? 2 : 0,
      maximumFractionDigits: hasDecimals ? 2 : 0,
    })
  );
}

export function getDiscountPercent(price: number, mrp?: number): number {
  const original = mrp && mrp > price ? mrp : Math.round(price * 1.35);
  if (original <= price) return 0;
  return Math.round(((original - price) / original) * 100);
}

export function getEffectiveMrp(price: number, mrp?: number): number {
  return mrp && mrp > price ? mrp : Math.round((price * 1.35) / 10) * 10 - 1;
}

export function generateDeliveryOtp(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export function extractPincodeFromAddress(address?: string, explicitPincode?: string): string {
  const cleanExplicit = (explicitPincode || '').replace(/\D/g, '').slice(0, 6);
  if (cleanExplicit.length === 6) return cleanExplicit;
  const match = (address || '').match(/\b([1-9]\d{5})\b/);
  return match ? match[1] : '';
}

export function isOnlinePaidOrder(order: Pick<Order, 'paymentMethod'>): boolean {
  const pm = (order.paymentMethod || '').trim().toLowerCase();
  if (!pm) return false;
  if (pm.includes('cash on delivery') || pm === 'cod' || pm.includes('(cod)')) return false;
  return (
    pm.includes('razorpay') ||
    pm.includes('online') ||
    pm.includes('prepaid') ||
    pm.includes('paid') ||
    pm.includes('upi') ||
    pm.includes('card') ||
    pm.includes('netbanking')
  );
}

export function getOrderDeliveryStage(order: Order): 'Assigned' | 'Out for Delivery' | 'Delivered' | null {
  if (!order.deliveryBoyId && !order.deliveryBoyName) return null;
  if (
    order.status === 'Delivered' ||
    order.status === 'Return Requested' ||
    order.status === 'Return Approved' ||
    order.status === 'Refunded'
  ) {
    return 'Delivered';
  }
  if (order.status === 'Out for Delivery') {
    return 'Out for Delivery';
  }
  if (order.status === 'Cancelled') {
    return null;
  }
  return 'Assigned';
}

