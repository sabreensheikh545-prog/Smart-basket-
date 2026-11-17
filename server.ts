import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import JSZip from 'jszip';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

// In-memory store mirroring the Quick Kart MySQL schema
interface Category {
  id: number;
  name: string;
  image: string;
}

interface Product {
  id: number;
  cat_id: number;
  name: string;
  description: string;
  price: number;
  stock: number;
  image: string;
  created_at: string;
}

interface User {
  id: number;
  name: string;
  phone: string;
  email: string;
  password: string;
  address: string;
  status: 'active' | 'blocked';
  created_at: string;
}

interface OrderItem {
  id: number;
  order_id: number;
  product_id: number;
  product_name: string;
  product_image: string;
  quantity: number;
  price: number;
}

interface Order {
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

const state = {
  nextId: { cat: 6, prod: 7, user: 2, order: 3, item: 4 },
  admin: { id: 1, username: 'Seraj', password: 'seraj123' },
  categories: [
    { id: 1, name: 'Audio', image: '/src/assets/images/product_earbuds_1794891797883.jpg' },
    { id: 2, name: 'Wearables', image: '/src/assets/images/product_smartwatch_1794891795980.jpg' },
    { id: 3, name: 'Footwear', image: '/src/assets/images/product_sneakers_1794891798636.jpg' },
    { id: 4, name: 'Carry', image: '/src/assets/images/product_backpack_1794891798552.jpg' },
    { id: 5, name: 'Lifestyle', image: '/src/assets/images/product_flask_1794891799263.jpg' },
  ] as Category[],
  products: [
    {
      id: 1,
      cat_id: 1,
      name: 'Aura ANC Wireless Earbuds',
      description: 'Active noise cancelling earbuds with 36-hour charging case, dual-mic clarity, and IPX5 sweat resistance.',
      price: 2999,
      stock: 28,
      image: '/src/assets/images/product_earbuds_1794891797883.jpg',
      created_at: '2026-11-10T10:00:00Z',
    },
    {
      id: 2,
      cat_id: 2,
      name: 'Titan Pulse Smartwatch',
      description: 'Brushed titanium alloy bezel, AMOLED always-on display, SpO2 & heart rate tracking with 10-day battery.',
      price: 6499,
      stock: 15,
      image: '/src/assets/images/product_smartwatch_1794891795980.jpg',
      created_at: '2026-11-11T10:00:00Z',
    },
    {
      id: 3,
      cat_id: 3,
      name: 'Stride Knit Running Shoes',
      description: 'Breathable engineered fly-knit upper with responsive dual-density EVA cushioning for daily runs.',
      price: 3499,
      stock: 22,
      image: '/src/assets/images/product_sneakers_1794891798636.jpg',
      created_at: '2026-11-12T10:00:00Z',
    },
    {
      id: 4,
      cat_id: 4,
      name: 'Nomad Weatherproof Backpack',
      description: '20L urban commuter backpack in ballistic matte canvas with padded 16-inch laptop sleeve and YKK zippers.',
      price: 2799,
      stock: 18,
      image: '/src/assets/images/product_backpack_1794891798552.jpg',
      created_at: '2026-11-13T10:00:00Z',
    },
    {
      id: 5,
      cat_id: 5,
      name: 'Rivers Insulated Steel Flask',
      description: 'Double-wall vacuum insulated 750ml stainless steel flask keeps drinks cold for 24h or hot for 12h.',
      price: 1199,
      stock: 40,
      image: '/src/assets/images/product_flask_1794891799263.jpg',
      created_at: '2026-11-14T10:00:00Z',
    },
    {
      id: 6,
      cat_id: 1,
      name: 'Aura Studio Over-Ear Headphones',
      description: 'Low-latency wireless studio headphones with plush memory foam cushions and USB-C fast charging.',
      price: 4999,
      stock: 12,
      image: '/src/assets/images/hero_quick_kart_1794891801002.jpg',
      created_at: '2026-11-15T10:00:00Z',
    },
  ] as Product[],
  users: [
    {
      id: 1,
      name: 'Aarav Sharma',
      phone: '9876543210',
      email: 'aarav@quickkart.in',
      password: 'demo1234',
      address: '402 Indiranagar 100ft Road, Bengaluru, Karnataka 560038',
      status: 'active',
      created_at: '2026-11-01T09:00:00Z',
    },
  ] as User[],
  orders: [
    {
      id: 1001,
      user_id: 1,
      name: 'Aarav Sharma',
      phone: '9876543210',
      address: '402 Indiranagar 100ft Road, Bengaluru, Karnataka 560038',
      total_amount: 2999,
      status: 'Dispatched',
      created_at: '2026-11-15T14:20:00Z',
      items: [
        {
          id: 1,
          order_id: 1001,
          product_id: 1,
          product_name: 'Aura ANC Wireless Earbuds',
          product_image: '/src/assets/images/product_earbuds_1794891797883.jpg',
          quantity: 1,
          price: 2999,
        },
      ],
    },
    {
      id: 1000,
      user_id: 1,
      name: 'Aarav Sharma',
      phone: '9876543210',
      address: '402 Indiranagar 100ft Road, Bengaluru, Karnataka 560038',
      total_amount: 1199,
      status: 'Delivered',
      created_at: '2026-11-08T11:10:00Z',
      items: [
        {
          id: 2,
          order_id: 1000,
          product_id: 5,
          product_name: 'Rivers Insulated Steel Flask',
          product_image: '/src/assets/images/product_flask_1794891799263.jpg',
          quantity: 1,
          price: 1199,
        },
      ],
    },
  ] as Order[],
};

// Bootstrap data endpoint
app.get('/api/bootstrap', (_req, res) => {
  res.json({
    categories: state.categories,
    products: state.products,
    users: state.users.map(({ password: _p, ...u }) => u),
    orders: state.orders,
    adminUsername: state.admin.username,
  });
});

// User Auth
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  const user = state.users.find((u) => u.email.toLowerCase() === String(email || '').trim().toLowerCase());
  if (!user || user.password !== password) {
    return res.status(401).json({ success: false, message: 'Invalid email or password.' });
  }
  if (user.status === 'blocked') {
    return res.status(403).json({ success: false, message: 'Your account has been suspended.' });
  }
  const { password: _p, ...safeUser } = user;
  res.json({ success: true, message: 'Signed in successfully.', user: safeUser });
});

app.post('/api/auth/signup', (req, res) => {
  const { name, phone, email, password } = req.body || {};
  if (!name || !phone || !email || !password || String(password).length < 6) {
    return res.status(400).json({ success: false, message: 'Please fill all fields (min 6-char password).' });
  }
  if (state.users.some((u) => u.email.toLowerCase() === String(email).trim().toLowerCase())) {
    return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
  }
  const newUser: User = {
    id: state.nextId.user++,
    name: String(name).trim(),
    phone: String(phone).trim(),
    email: String(email).trim(),
    password: String(password),
    address: '',
    status: 'active',
    created_at: new Date().toISOString(),
  };
  state.users.unshift(newUser);
  const { password: _p, ...safeUser } = newUser;
  res.json({ success: true, message: 'Account created.', user: safeUser });
});

app.post('/api/profile', (req, res) => {
  const { id, name, phone, email, address } = req.body || {};
  const user = state.users.find((u) => u.id === Number(id));
  if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
  user.name = String(name || user.name).trim();
  user.phone = String(phone || user.phone).trim();
  user.email = String(email || user.email).trim();
  user.address = String(address ?? user.address).trim();
  const { password: _p, ...safeUser } = user;
  res.json({ success: true, message: 'Profile updated successfully.', user: safeUser });
});

app.post('/api/profile/password', (req, res) => {
  const { id, current_password, new_password } = req.body || {};
  const user = state.users.find((u) => u.id === Number(id));
  if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
  if (user.password !== current_password) {
    return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
  }
  if (!new_password || String(new_password).length < 6) {
    return res.status(400).json({ success: false, message: 'New password must be at least 6 characters.' });
  }
  user.password = String(new_password);
  res.json({ success: true, message: 'Password changed successfully.' });
});

// Checkout COD Order
app.post('/api/checkout', (req, res) => {
  const { user_id, name, phone, address, items } = req.body || {};
  if (!name || !phone || !address || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: 'Please provide complete delivery details and cart items.' });
  }

  let total = 0;
  const orderItems: OrderItem[] = [];
  const orderId = state.nextId.order + 1000;
  state.nextId.order++;

  for (const entry of items) {
    const prod = state.products.find((p) => p.id === Number(entry.product_id));
    if (!prod || prod.stock < Number(entry.quantity)) {
      return res.status(400).json({ success: false, message: `${prod?.name || 'Item'} has insufficient stock.` });
    }
    const qty = Math.max(1, Number(entry.quantity));
    prod.stock -= qty;
    total += prod.price * qty;
    orderItems.push({
      id: state.nextId.item++,
      order_id: orderId,
      product_id: prod.id,
      product_name: prod.name,
      product_image: prod.image,
      quantity: qty,
      price: prod.price,
    });
  }

  const newOrder: Order = {
    id: orderId,
    user_id: Number(user_id || 1),
    name: String(name).trim(),
    phone: String(phone).trim(),
    address: String(address).trim(),
    total_amount: total,
    status: 'Placed',
    created_at: new Date().toISOString(),
    items: orderItems,
  };
  state.orders.unshift(newOrder);

  const user = state.users.find((u) => u.id === Number(user_id));
  if (user && !user.address) user.address = newOrder.address;

  res.json({ success: true, message: `Order #${orderId} placed successfully!`, order: newOrder });
});

app.post('/api/orders/cancel', (req, res) => {
  const { order_id, user_id } = req.body || {};
  const ord = state.orders.find((o) => o.id === Number(order_id) && o.user_id === Number(user_id));
  if (!ord || ord.status !== 'Placed') {
    return res.status(400).json({ success: false, message: 'Only newly placed orders can be cancelled.' });
  }
  ord.status = 'Cancelled';
  res.json({ success: true, message: `Order #${ord.id} cancelled.` });
});

// Admin API
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body || {};
  if (username === state.admin.username && password === state.admin.password) {
    return res.json({ success: true, message: 'Welcome back, admin.' });
  }
  res.status(401).json({ success: false, message: 'Invalid admin credentials.' });
});

app.post('/api/admin/category', (req, res) => {
  const { id, name, image } = req.body || {};
  if (!name || String(name).trim().length < 2) {
    return res.status(400).json({ success: false, message: 'Category name is required.' });
  }
  if (Number(id) > 0) {
    const cat = state.categories.find((c) => c.id === Number(id));
    if (cat) {
      cat.name = String(name).trim();
      if (image) cat.image = String(image);
    }
    return res.json({ success: true, message: 'Category updated.' });
  }
  state.categories.unshift({
    id: state.nextId.cat++,
    name: String(name).trim(),
    image: image || '/src/assets/images/hero_quick_kart_1794891801002.jpg',
  });
  res.json({ success: true, message: 'Category added.' });
});

app.delete('/api/admin/category/:id', (req, res) => {
  const cid = Number(req.params.id);
  state.categories = state.categories.filter((c) => c.id !== cid);
  state.products = state.products.filter((p) => p.cat_id !== cid);
  res.json({ success: true, message: 'Category deleted.' });
});

app.post('/api/admin/product', (req, res) => {
  const { id, cat_id, name, description, price, stock, image } = req.body || {};
  if (!name || Number(price) <= 0) {
    return res.status(400).json({ success: false, message: 'Valid product name and price required.' });
  }
  if (Number(id) > 0) {
    const prod = state.products.find((p) => p.id === Number(id));
    if (prod) {
      prod.cat_id = Number(cat_id);
      prod.name = String(name).trim();
      prod.description = String(description || '').trim();
      prod.price = Number(price);
      prod.stock = Number(stock ?? 0);
      if (image) prod.image = String(image);
    }
    return res.json({ success: true, message: 'Product updated.' });
  }
  state.products.unshift({
    id: state.nextId.prod++,
    cat_id: Number(cat_id || 1),
    name: String(name).trim(),
    description: String(description || '').trim(),
    price: Number(price),
    stock: Number(stock ?? 10),
    image: image || '/src/assets/images/product_earbuds_1794891797883.jpg',
    created_at: new Date().toISOString(),
  });
  res.json({ success: true, message: 'Product added.' });
});

app.delete('/api/admin/product/:id', (req, res) => {
  const pid = Number(req.params.id);
  state.products = state.products.filter((p) => p.id !== pid);
  res.json({ success: true, message: 'Product deleted.' });
});

app.post('/api/admin/order/status', (req, res) => {
  const { order_id, status } = req.body || {};
  const ord = state.orders.find((o) => o.id === Number(order_id));
  if (!ord) return res.status(404).json({ success: false, message: 'Order not found.' });
  ord.status = status;
  res.json({ success: true, message: `Order #${ord.id} updated to ${status}.` });
});

app.post('/api/admin/user/toggle', (req, res) => {
  const { user_id, status } = req.body || {};
  const user = state.users.find((u) => u.id === Number(user_id));
  if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
  user.status = status === 'blocked' ? 'blocked' : 'active';
  res.json({ success: true, message: 'User status updated.' });
});

app.delete('/api/admin/user/:id', (req, res) => {
  const uid = Number(req.params.id);
  state.users = state.users.filter((u) => u.id !== uid);
  res.json({ success: true, message: 'User deleted.' });
});

app.post('/api/admin/settings', (req, res) => {
  const { username, new_password } = req.body || {};
  if (!username || String(username).trim().length < 3) {
    return res.status(400).json({ success: false, message: 'Username must be at least 3 characters.' });
  }
  state.admin.username = String(username).trim();
  if (new_password && String(new_password).length >= 6) {
    state.admin.password = String(new_password);
  }
  res.json({ success: true, message: 'Admin settings updated.' });
});

// List & Read PHP files from /quick-kart
function walkQuickKartDir(dir: string, base: string): { path: string; isBinary: boolean; content?: string }[] {
  const results: { path: string; isBinary: boolean; content?: string }[] = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    const rel = path.posix.join(base, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkQuickKartDir(full, rel));
    } else {
      const ext = path.extname(entry.name).toLowerCase();
      const isBinary = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext);
      results.push({
        path: rel,
        isBinary,
        content: isBinary ? undefined : fs.readFileSync(full, 'utf8'),
      });
    }
  }
  return results;
}

app.get('/api/php-files', (_req, res) => {
  const qkRoot = path.resolve(__dirname, 'quick-kart');
  res.json({ files: walkQuickKartDir(qkRoot, '') });
});

app.get('/api/download-php-zip', async (_req, res) => {
  const qkRoot = path.resolve(__dirname, 'quick-kart');
  const zip = new JSZip();
  const folder = zip.folder('quick-kart');
  const addFiles = (dir: string, relBase: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      const rel = relBase ? `${relBase}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        addFiles(full, rel);
      } else {
        folder?.file(rel, fs.readFileSync(full));
      }
    }
  };
  if (fs.existsSync(qkRoot)) addFiles(qkRoot, '');
  const buffer = await zip.generateAsync({ type: 'nodebuffer' });
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', 'attachment; filename="quick-kart-php-mysql.zip"');
  res.send(buffer);
});

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(3000, '0.0.0.0', () => {
    console.log('Quick Kart running on http://0.0.0.0:3000');
  });
}

startServer();
