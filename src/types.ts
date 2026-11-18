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
  gst_rate?: number; // 0, 5, 12, 18, 28
  rating?: number;
  reviews?: number;
  stock: number;
  image: string;
  created_at: string;
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
  gst_rate?: number;
}

export interface Order {
  id: number;
  docId?: string;
  user_id: number;
  userId?: string;
  name: string;
  phone: string;
  email?: string;
  address: string;
  subtotal_amount?: number;
  gst_amount?: number;
  total_amount: number;
  total?: number;
  paymentMethod?: string;
  utr_number?: string;
  payment_verified?: boolean;
  seller_gstin?: string;
  status: 'Placed' | 'Dispatched' | 'Delivered' | 'Cancelled';
  created_at: string;
  items: OrderItem[];
}

export interface StoreSettings {
  storeName: string;
  upiId: string;
  gstin: string;
  defaultGstRate: number;
}

export interface CartEntry {
  product: Product;
  quantity: number;
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
