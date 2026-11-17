export interface Category {
  id: number;
  name: string;
  image: string;
}

export interface Product {
  id: number;
  cat_id: number;
  name: string;
  description: string;
  price: number;
  stock: number;
  image: string;
  created_at: string;
}

export interface User {
  id: number;
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
  product_name: string;
  product_image: string;
  quantity: number;
  price: number;
}

export interface Order {
  id: number;
  user_id: number;
  name: string;
  phone: string;
  address: string;
  total_amount: number;
  status: 'Placed' | 'Dispatched' | 'Delivered' | 'Cancelled';
  created_at: string;
  items: OrderItem[];
}

export interface CartEntry {
  product: Product;
  quantity: number;
}

export interface PhpFileEntry {
  path: string;
  isBinary: boolean;
  content?: string;
}

export function formatINR(amount: number): string {
  return '₹' + Number(amount || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
