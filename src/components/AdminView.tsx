import React, { useState } from 'react';
import { Category, Order, Product, User, formatINR } from '../types';

type AdminTab = 'dashboard' | 'categories' | 'products' | 'orders' | 'order_detail' | 'users' | 'settings';

interface Props {
  categories: Category[];
  products: Product[];
  orders: Order[];
  users: User[];
  adminUsername: string;
  onRefresh: () => Promise<void>;
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
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [adminTab, setAdminTab] = useState<AdminTab>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);

  // Admin Login Form
  const [loginUser, setLoginUser] = useState('admin');
  const [loginPass, setLoginPass] = useState('admin123');
  const [loginErr, setLoginErr] = useState('');

  // Category Modal State
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [catName, setCatName] = useState('');
  const [catImage, setCatImage] = useState('/src/assets/images/product_earbuds_1794891797883.jpg');

  // Product Modal State
  const [prodModalOpen, setProdModalOpen] = useState(false);
  const [editingProd, setEditingProd] = useState<Product | null>(null);
  const [prodCatId, setProdCatId] = useState<number>(categories[0]?.id || 1);
  const [prodName, setProdName] = useState('');
  const [prodDesc, setProdDesc] = useState('');
  const [prodPrice, setProdPrice] = useState('');
  const [prodStock, setProdStock] = useState('15');
  const [prodImage, setProdImage] = useState('/src/assets/images/product_earbuds_1794891797883.jpg');

  // Order Detail Status
  const [orderStatusDraft, setOrderStatusDraft] = useState<Order['status']>('Placed');

  // Admin Settings
  const [settingsUser, setSettingsUser] = useState(adminUsername);
  const [settingsPass, setSettingsPass] = useState('');

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginErr('');
    showLoader('Signing in...');
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUser, password: loginPass }),
      });
      const data = await res.json();
      hideLoader();
      if (data.success) {
        setIsAdminLoggedIn(true);
      } else {
        setLoginErr(data.message || 'Invalid credentials.');
      }
    } catch {
      hideLoader();
      setLoginErr('Network error.');
    }
  };

  if (!isAdminLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-7">
          <div className="text-center mb-6">
            <div className="w-12 h-12 rounded-2xl bg-orange-600 text-white flex items-center justify-center mx-auto shadow-md">
              <i className="fa-solid fa-shield-halved text-xl"></i>
            </div>
            <h1 className="mt-3 text-xl font-extrabold text-slate-900">Quick Kart Admin</h1>
            <p className="mt-1 text-xs text-slate-500">Default demo credentials: admin / admin123</p>
          </div>
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
                className="w-full h-11 px-4 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:bg-white focus:border-orange-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Password</label>
              <input
                type="password"
                value={loginPass}
                onChange={(e) => setLoginPass(e.target.value)}
                required
                className="w-full h-11 px-4 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:bg-white focus:border-orange-500 focus:outline-none"
              />
            </div>
            <button type="submit" className="w-full h-11 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-orange-600 transition flex items-center justify-center gap-2">
              <span>Sign In</span>
              <i className="fa-solid fa-arrow-right text-xs"></i>
            </button>
          </form>
          <button type="button" onClick={onExitAdmin} className="mt-5 w-full text-center text-xs font-semibold text-slate-500 hover:text-slate-900">
            <i className="fa-solid fa-arrow-left mr-1"></i> Back to Storefront
          </button>
        </div>
      </div>
    );
  }

  const revenue = orders.filter((o) => o.status !== 'Cancelled').reduce((acc, o) => acc + o.total_amount, 0);
  const activeProducts = products.filter((p) => p.stock > 0).length;
  const cancellations = orders.filter((o) => o.status === 'Cancelled').length;
  const shipments = orders.filter((o) => o.status === 'Dispatched' || o.status === 'Delivered').length;
  const activeOrder = orders.find((o) => o.id === selectedOrderId) || null;

  const openCategoryModal = (cat?: Category) => {
    setEditingCat(cat || null);
    setCatName(cat ? cat.name : '');
    setCatImage(cat ? cat.image : '/src/assets/images/product_earbuds_1794891797883.jpg');
    setCatModalOpen(true);
  };

  const saveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    showLoader('Saving category...');
    const res = await fetch('/api/admin/category', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editingCat?.id || 0, name: catName, image: catImage }),
    });
    const data = await res.json();
    hideLoader();
    if (data.success) {
      setCatModalOpen(false);
      await onRefresh();
    } else {
      showModal({ title: 'Error', message: data.message, type: 'error' });
    }
  };

  const deleteCategory = (id: number) => {
    showModal({
      title: 'Delete Category',
      message: 'Deleting a category also removes its linked products. Continue?',
      type: 'error',
      confirmText: 'Delete',
      onConfirm: async () => {
        showLoader('Deleting...');
        await fetch(`/api/admin/category/${id}`, { method: 'DELETE' });
        hideLoader();
        await onRefresh();
      },
    });
  };

  const openProductModal = (prod?: Product) => {
    setEditingProd(prod || null);
    setProdCatId(prod ? prod.cat_id : categories[0]?.id || 1);
    setProdName(prod ? prod.name : '');
    setProdDesc(prod ? prod.description : '');
    setProdPrice(prod ? String(prod.price) : '');
    setProdStock(prod ? String(prod.stock) : '15');
    setProdImage(prod ? prod.image : '/src/assets/images/product_earbuds_1794891797883.jpg');
    setProdModalOpen(true);
  };

  const saveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    showLoader('Saving product...');
    const res = await fetch('/api/admin/product', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: editingProd?.id || 0,
        cat_id: prodCatId,
        name: prodName,
        description: prodDesc,
        price: Number(prodPrice),
        stock: Number(prodStock),
        image: prodImage,
      }),
    });
    const data = await res.json();
    hideLoader();
    if (data.success) {
      setProdModalOpen(false);
      await onRefresh();
    } else {
      showModal({ title: 'Validation Error', message: data.message, type: 'error' });
    }
  };

  const deleteProduct = (id: number) => {
    showModal({
      title: 'Delete Product',
      message: 'Remove this product from your catalog?',
      type: 'error',
      confirmText: 'Delete',
      onConfirm: async () => {
        showLoader('Deleting...');
        await fetch(`/api/admin/product/${id}`, { method: 'DELETE' });
        hideLoader();
        await onRefresh();
      },
    });
  };

  const updateOrderStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrder) return;
    showLoader('Updating status...');
    const res = await fetch('/api/admin/order/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: activeOrder.id, status: orderStatusDraft }),
    });
    const data = await res.json();
    hideLoader();
    await onRefresh();
    showModal({ title: 'Status Updated', message: data.message, type: 'success' });
  };

  const toggleUserBlock = async (user: User) => {
    showLoader('Updating user...');
    await fetch('/api/admin/user/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id, status: user.status === 'blocked' ? 'active' : 'blocked' }),
    });
    hideLoader();
    await onRefresh();
  };

  const deleteUser = (id: number) => {
    showModal({
      title: 'Delete User',
      message: 'Are you sure you want to remove this user account?',
      type: 'error',
      confirmText: 'Delete',
      onConfirm: async () => {
        showLoader('Deleting...');
        await fetch(`/api/admin/user/${id}`, { method: 'DELETE' });
        hideLoader();
        await onRefresh();
      },
    });
  };

  const saveAdminSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    showLoader('Saving...');
    const res = await fetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: settingsUser, new_password: settingsPass }),
    });
    const data = await res.json();
    hideLoader();
    setSettingsPass('');
    await onRefresh();
    showModal({ title: data.success ? 'Saved' : 'Error', message: data.message, type: data.success ? 'success' : 'error' });
  };

  const imageChoices = [
    { label: 'Wireless Earbuds', url: '/src/assets/images/product_earbuds_1794891797883.jpg' },
    { label: 'Titanium Smartwatch', url: '/src/assets/images/product_smartwatch_1794891795980.jpg' },
    { label: 'Knit Sneakers', url: '/src/assets/images/product_sneakers_1794891798636.jpg' },
    { label: 'Commuter Backpack', url: '/src/assets/images/product_backpack_1794891798552.jpg' },
    { label: 'Steel Water Flask', url: '/src/assets/images/product_flask_1794891799263.jpg' },
    { label: 'Lifestyle Essentials', url: '/src/assets/images/hero_quick_kart_1794891801002.jpg' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 pb-20 md:pb-10">
      {/* Admin Top Bar */}
      <header className="sticky top-0 z-40 bg-slate-900 text-white border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setSidebarOpen(true)} className="w-10 h-10 -ml-1 rounded-xl flex items-center justify-center text-slate-200 hover:bg-slate-800">
              <i className="fa-solid fa-bars text-lg"></i>
            </button>
            <button type="button" onClick={() => setAdminTab('dashboard')} className="flex items-center gap-2 whitespace-nowrap">
              <span className="w-8 h-8 rounded-lg bg-orange-600 text-white flex items-center justify-center">
                <i className="fa-solid fa-bolt text-sm"></i>
              </span>
              <span className="text-base font-extrabold tracking-tight">Quick Kart Admin</span>
            </button>
          </div>
          <nav className="hidden md:flex items-center gap-5 text-xs font-semibold text-slate-300">
            {(['dashboard', 'categories', 'products', 'orders', 'users', 'settings'] as AdminTab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setAdminTab(t)}
                className={`capitalize whitespace-nowrap transition ${adminTab === t ? 'text-orange-400' : 'hover:text-white'}`}
              >
                {t}
              </button>
            ))}
          </nav>
          <button type="button" onClick={onExitAdmin} className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-200 text-xs font-semibold hover:bg-slate-700 whitespace-nowrap">
            <i className="fa-solid fa-store mr-1.5"></i>Storefront
          </button>
        </div>
      </header>

      {/* Admin Sliding Sidebar */}
      {sidebarOpen && <div onClick={() => setSidebarOpen(false)} className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs" />}
      <aside className={`fixed top-0 left-0 bottom-0 z-50 w-72 bg-slate-900 text-white border-r border-slate-800 shadow-2xl transform transition-transform duration-200 flex flex-col ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <span className="text-base font-extrabold">Admin Menu</span>
          <button type="button" onClick={() => setSidebarOpen(false)} className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-800">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: 'fa-chart-pie' },
            { id: 'categories', label: 'Categories', icon: 'fa-tags' },
            { id: 'products', label: 'Products', icon: 'fa-boxes-stacked' },
            { id: 'orders', label: 'Orders', icon: 'fa-receipt' },
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
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium ${adminTab === item.id ? 'bg-orange-600 text-white font-semibold' : 'text-slate-300 hover:bg-slate-800'}`}
            >
              <i className={`fa-solid ${item.icon} w-5 text-center`}></i>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-800">
          <button type="button" onClick={() => setIsAdminLoggedIn(false)} className="w-full py-2.5 rounded-xl bg-slate-800 text-rose-400 text-sm font-semibold hover:bg-slate-700">
            <i className="fa-solid fa-right-from-bracket mr-2"></i>Logout
          </button>
        </div>
      </aside>

      <main className="max-w-6xl mx-auto px-4 py-5 space-y-6">
        {adminTab === 'dashboard' && (
          <>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-extrabold text-slate-900">Dashboard Overview</h1>
                <p className="text-xs text-slate-500">Live store metrics &amp; quick controls</p>
              </div>
              <button type="button" onClick={() => setAdminTab('orders')} className="px-3.5 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-orange-600 transition">
                All Orders
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3.5 sm:gap-5">
              {[
                { label: 'Total Users', value: users.length, icon: 'fa-users', color: 'bg-blue-50 text-blue-600' },
                { label: 'Orders', value: orders.length, icon: 'fa-bag-shopping', color: 'bg-orange-50 text-orange-600' },
                { label: 'Revenue', value: formatINR(revenue), icon: 'fa-indian-rupee-sign', color: 'bg-emerald-50 text-emerald-600' },
                { label: 'Active Products', value: activeProducts, icon: 'fa-boxes-stacked', color: 'bg-indigo-50 text-indigo-600' },
                { label: 'Cancellations', value: cancellations, icon: 'fa-circle-xmark', color: 'bg-rose-50 text-rose-600' },
                { label: 'Shipments', value: shipments, icon: 'fa-truck-fast', color: 'bg-teal-50 text-teal-600' },
              ].map((stat) => (
                <div key={stat.label} className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 flex items-center gap-3.5">
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
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <button type="button" onClick={() => { setAdminTab('products'); openProductModal(); }} className="p-4 rounded-2xl bg-slate-900 text-white hover:bg-orange-600 transition flex items-center gap-3">
                  <i className="fa-solid fa-plus-circle text-lg"></i>
                  <span className="text-xs font-bold">Add Product</span>
                </button>
                <button type="button" onClick={() => setAdminTab('categories')} className="p-4 rounded-2xl bg-white border border-slate-200 text-slate-800 hover:border-orange-300 transition flex items-center gap-3">
                  <i className="fa-solid fa-tags text-orange-600 text-lg"></i>
                  <span className="text-xs font-bold">Categories</span>
                </button>
                <button type="button" onClick={() => setAdminTab('users')} className="p-4 rounded-2xl bg-white border border-slate-200 text-slate-800 hover:border-orange-300 transition flex items-center gap-3">
                  <i className="fa-solid fa-user-gear text-blue-600 text-lg"></i>
                  <span className="text-xs font-bold">Manage Users</span>
                </button>
                <button type="button" onClick={() => setAdminTab('settings')} className="p-4 rounded-2xl bg-white border border-slate-200 text-slate-800 hover:border-orange-300 transition flex items-center gap-3">
                  <i className="fa-solid fa-sliders text-slate-600 text-lg"></i>
                  <span className="text-xs font-bold">Settings</span>
                </button>
              </div>
            </div>
          </>
        )}

        {adminTab === 'categories' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-extrabold text-slate-900">Categories</h1>
              <button type="button" onClick={() => openCategoryModal()} className="px-4 py-2.5 rounded-xl bg-orange-600 text-white text-xs font-bold hover:bg-orange-700 transition">
                <i className="fa-solid fa-plus mr-1.5"></i>Add Category
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {categories.map((cat) => (
                <div key={cat.id} className="bg-white rounded-2xl border border-slate-200/80 p-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <img src={cat.image} alt={cat.name} className="w-14 h-14 rounded-xl object-cover bg-slate-100 shrink-0" />
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-slate-900 truncate">{cat.name}</h3>
                      <p className="text-xs text-slate-500 tabular-nums">{products.filter((p) => p.cat_id === cat.id).length} products</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button type="button" onClick={() => openCategoryModal(cat)} className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 flex items-center justify-center">
                      <i className="fa-solid fa-pen text-xs"></i>
                    </button>
                    <button type="button" onClick={() => deleteCategory(cat.id)} className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 flex items-center justify-center">
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
              <h1 className="text-xl font-extrabold text-slate-900">Products</h1>
              <button type="button" onClick={() => openProductModal()} className="px-4 py-2.5 rounded-xl bg-orange-600 text-white text-xs font-bold hover:bg-orange-700 transition">
                <i className="fa-solid fa-plus mr-1.5"></i>Add Product
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {products.map((prod) => (
                <div key={prod.id} className="bg-white rounded-2xl border border-slate-200/80 p-4 flex gap-3.5 items-center">
                  <img src={prod.image} alt={prod.name} className="w-20 h-20 rounded-xl object-cover bg-slate-100 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium text-slate-500 truncate">{categories.find((c) => c.id === prod.cat_id)?.name || 'General'}</p>
                    <h3 className="text-sm font-bold text-slate-900 truncate">{prod.name}</h3>
                    <div className="mt-1 flex items-center gap-3 text-xs">
                      <span className="font-extrabold text-slate-900 font-mono tabular-nums">{formatINR(prod.price)}</span>
                      <span className={`font-semibold ${prod.stock > 0 ? 'text-emerald-700' : 'text-rose-600'}`}>Stock: {prod.stock}</span>
                    </div>
                    <div className="mt-2.5 flex items-center gap-2">
                      <button type="button" onClick={() => openProductModal(prod)} className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-200">
                        <i className="fa-solid fa-pen mr-1"></i>Edit
                      </button>
                      <button type="button" onClick={() => deleteProduct(prod.id)} className="px-3 py-1.5 rounded-lg bg-rose-50 text-rose-600 text-xs font-semibold hover:bg-rose-100">
                        <i className="fa-solid fa-trash mr-1"></i>Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {adminTab === 'orders' && (
          <div className="space-y-5">
            <h1 className="text-xl font-extrabold text-slate-900">Orders</h1>
            <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="py-3 px-4">Order ID</th>
                      <th className="py-3 px-4">User</th>
                      <th className="py-3 px-4">Amount</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {orders.map((ord) => (
                      <tr
                        key={ord.id}
                        onClick={() => {
                          setSelectedOrderId(ord.id);
                          setOrderStatusDraft(ord.status);
                          setAdminTab('order_detail');
                        }}
                        className="hover:bg-slate-50 cursor-pointer transition"
                      >
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900 tabular-nums">#{ord.id}</td>
                        <td className="py-3.5 px-4 font-semibold text-slate-800">{ord.name}</td>
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900 tabular-nums">{formatINR(ord.total_amount)}</td>
                        <td className="py-3.5 px-4 text-xs font-semibold text-orange-600">{ord.status}</td>
                        <td className="py-3.5 px-4 text-xs text-slate-500">{new Date(ord.created_at).toLocaleDateString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {adminTab === 'order_detail' && activeOrder && (
          <div className="space-y-5 max-w-4xl">
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setAdminTab('orders')} className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-slate-50">
                <i className="fa-solid fa-arrow-left text-xs"></i>
              </button>
              <div>
                <h1 className="text-xl font-extrabold text-slate-900 font-mono">Order #{activeOrder.id}</h1>
                <p className="text-xs text-slate-500">{new Date(activeOrder.created_at).toLocaleString('en-IN')}</p>
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl border border-slate-200/80 p-5 space-y-2">
                <h2 className="text-xs font-bold text-slate-500 uppercase">Customer &amp; Delivery</h2>
                <p className="text-sm font-bold text-slate-900">{activeOrder.name}</p>
                <p className="text-xs text-slate-600"><i className="fa-solid fa-phone mr-1.5"></i>{activeOrder.phone}</p>
                <p className="text-xs text-slate-600"><i className="fa-solid fa-location-dot mr-1.5"></i>{activeOrder.address}</p>
              </div>
              <form onSubmit={updateOrderStatus} className="bg-white rounded-2xl border border-slate-200/80 p-5 space-y-3">
                <h2 className="text-xs font-bold text-slate-500 uppercase">Update Status</h2>
                <select
                  value={orderStatusDraft}
                  onChange={(e) => setOrderStatusDraft(e.target.value as Order['status'])}
                  className="w-full h-11 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold text-slate-900"
                >
                  <option value="Placed">Placed</option>
                  <option value="Dispatched">Dispatched</option>
                  <option value="Delivered">Delivered</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
                <button type="submit" className="w-full h-11 rounded-xl bg-orange-600 text-white text-sm font-bold hover:bg-orange-700 transition">
                  Save Order Status
                </button>
              </form>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900">Ordered Items</h2>
                <span className="text-sm font-extrabold font-mono tabular-nums">{formatINR(activeOrder.total_amount)}</span>
              </div>
              <div className="divide-y divide-slate-100">
                {activeOrder.items.map((it) => (
                  <div key={it.id} className="p-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <img src={it.product_image} alt={it.product_name} className="w-12 h-12 rounded-xl object-cover bg-slate-100" />
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

        {adminTab === 'users' && (
          <div className="space-y-4">
            <h1 className="text-xl font-extrabold text-slate-900">Registered Users</h1>
            {users.map((u) => (
              <div key={u.id} className="bg-white rounded-2xl border border-slate-200/80 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900">{u.name}</h3>
                    <span className={`text-[11px] font-semibold ${u.status === 'blocked' ? 'text-rose-600' : 'text-emerald-700'}`}>
                      · {u.status === 'blocked' ? 'Blocked' : 'Active'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">{u.email} · {u.phone}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleUserBlock(u)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-semibold ${u.status === 'blocked' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}
                  >
                    {u.status === 'blocked' ? 'Unblock' : 'Block'}
                  </button>
                  <button type="button" onClick={() => deleteUser(u.id)} className="px-3.5 py-2 rounded-xl bg-rose-50 text-rose-600 text-xs font-semibold">
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {adminTab === 'settings' && (
          <form onSubmit={saveAdminSettings} className="max-w-md bg-white rounded-3xl border border-slate-200 p-6 space-y-4">
            <h1 className="text-lg font-extrabold text-slate-900">Admin Settings</h1>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Username</label>
              <input type="text" value={settingsUser} onChange={(e) => setSettingsUser(e.target.value)} required className="w-full h-11 px-4 rounded-xl bg-slate-50 border border-slate-200 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">New Password (optional)</label>
              <input type="password" value={settingsPass} onChange={(e) => setSettingsPass(e.target.value)} placeholder="Min 6 characters" className="w-full h-11 px-4 rounded-xl bg-slate-50 border border-slate-200 text-sm" />
            </div>
            <button type="submit" className="w-full h-11 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-orange-600 transition">
              Save Changes
            </button>
          </form>
        )}
      </main>

      {/* Admin Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200">
        <div className="grid grid-cols-4 h-16 items-center">
          {[
            { id: 'dashboard', label: 'Home', icon: 'fa-chart-pie' },
            { id: 'products', label: 'Catalog', icon: 'fa-boxes-stacked' },
            { id: 'orders', label: 'Orders', icon: 'fa-receipt' },
            { id: 'users', label: 'Users', icon: 'fa-users' },
          ].map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setAdminTab(b.id as AdminTab)}
              className={`flex flex-col items-center justify-center h-full ${adminTab === b.id ? 'text-orange-600' : 'text-slate-500'}`}
            >
              <i className={`fa-solid ${b.icon} text-lg`}></i>
              <span className="text-[10px] font-semibold mt-1">{b.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Category Modal */}
      {catModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-extrabold text-slate-900">{editingCat ? 'Edit Category' : 'Add Category'}</h2>
              <button type="button" onClick={() => setCatModalOpen(false)} className="w-8 h-8 rounded-lg text-slate-500 hover:bg-slate-100">
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <form onSubmit={saveCategory} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Category Name</label>
                <input type="text" value={catName} onChange={(e) => setCatName(e.target.value)} required className="w-full h-11 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Category Icon Asset</label>
                <select value={catImage} onChange={(e) => setCatImage(e.target.value)} className="w-full h-11 px-3 rounded-xl bg-slate-50 border border-slate-200 text-sm">
                  {imageChoices.map((ic) => (
                    <option key={ic.url} value={ic.url}>{ic.label}</option>
                  ))}
                </select>
              </div>
              <button type="submit" className="w-full h-11 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-orange-600 transition">Save Category</button>
            </form>
          </div>
        </div>
      )}

      {/* Product Modal */}
      {prodModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-extrabold text-slate-900">{editingProd ? 'Edit Product' : 'Add Product'}</h2>
              <button type="button" onClick={() => setProdModalOpen(false)} className="w-8 h-8 rounded-lg text-slate-500 hover:bg-slate-100">
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Price (₹)</label>
                  <input type="number" min="1" value={prodPrice} onChange={(e) => setProdPrice(e.target.value)} required className="w-full h-10 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Stock</label>
                  <input type="number" min="0" value={prodStock} onChange={(e) => setProdStock(e.target.value)} required className="w-full h-10 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                <textarea rows={3} value={prodDesc} onChange={(e) => setProdDesc(e.target.value)} required className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Product Photo</label>
                <select value={prodImage} onChange={(e) => setProdImage(e.target.value)} className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 text-sm">
                  {imageChoices.map((ic) => <option key={ic.url} value={ic.url}>{ic.label}</option>)}
                </select>
              </div>
              <button type="submit" className="w-full h-11 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-orange-600 transition">Save Product</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
