import React, { useMemo, useRef, useState } from 'react';
import { ASSETS } from '../store/localStore';
import { Category, Product, formatINR, getDiscountPercent, getEffectiveMrp } from '../types';

export type SidebarCategoryKey =
  | 'for-you'
  | 'grocery'
  | 'fashion'
  | 'mobiles'
  | 'appliances'
  | 'electronics'
  | 'smart-gadgets'
  | 'home'
  | `custom-${number}`;

interface SidebarCategoryItem {
  key: SidebarCategoryKey;
  label: string;
  image?: string;
  icon?: string;
  catId?: number;
}

interface SubCategoryItem {
  id: string;
  label: string;
  subtitle?: string;
  image?: string;
  icon?: string;
  tintClass: string;
  iconColorClass: string;
  searchKeyword?: string;
  catId?: number;
  maxPrice?: number;
}

interface FeaturedShoppingDepartment {
  id: string;
  label: string;
  tag?: string;
  image: string;
  bgClass: string;
  targetCategoryKey?: SidebarCategoryKey;
  filterCatId?: number;
}

interface Props {
  categories: Category[];
  products: Product[];
  cartCount: number;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onOpenCart: () => void;
  onOpenProduct: (product: Product) => void;
  onBackHome: () => void;
  onBrowseShop: (opts: { catId?: number; query?: string; maxPrice?: number; sortBy?: 'relevance' | 'price_asc' | 'price_desc' | 'top_rated' }) => void;
  showModal: (opts: { title: string; message: string; type?: 'info' | 'success' | 'error'; confirmText?: string }) => void;
}

const CORE_SIDEBAR_CATEGORIES: SidebarCategoryItem[] = [
  { key: 'for-you', label: 'For You', icon: 'fa-sparkles' },
  { key: 'grocery', label: 'Grocery', image: ASSETS.grocery, catId: 6 },
  { key: 'fashion', label: 'Fashion', image: ASSETS.fashion, catId: 2 },
  { key: 'mobiles', label: 'Mobiles', image: ASSETS.smartphone, catId: 1 },
  { key: 'appliances', label: 'Appliances', image: ASSETS.homeAppliance, catId: 4 },
  { key: 'electronics', label: 'Electronics', image: ASSETS.earbuds, catId: 3 },
  { key: 'smart-gadgets', label: 'Smart Gadgets', image: ASSETS.smartwatch, catId: 3 },
  { key: 'home', label: 'Home', image: ASSETS.flask, catId: 4 },
];

const FEATURED_SHOPPING_CATEGORIES: FeaturedShoppingDepartment[] = [
  {
    id: 'dept-mobiles',
    label: 'Mobiles',
    tag: '5G DEALS',
    image: ASSETS.smartphone,
    bgClass: 'bg-blue-50',
    targetCategoryKey: 'mobiles',
  },
  {
    id: 'dept-fashion',
    label: 'Fashion',
    tag: 'MIN 40% OFF',
    image: ASSETS.fashion,
    bgClass: 'bg-indigo-50',
    targetCategoryKey: 'fashion',
  },
  {
    id: 'dept-electronics',
    label: 'Electronics',
    tag: 'TOP RATED',
    image: ASSETS.earbuds,
    bgClass: 'bg-slate-100',
    targetCategoryKey: 'electronics',
  },
  {
    id: 'dept-grocery',
    label: 'Grocery',
    tag: 'FRESH PACKS',
    image: ASSETS.grocery,
    bgClass: 'bg-emerald-50',
    targetCategoryKey: 'grocery',
  },
  {
    id: 'dept-smart-gadgets',
    label: 'Smart Gadgets',
    tag: 'TRENDING',
    image: ASSETS.smartwatch,
    bgClass: 'bg-teal-50',
    targetCategoryKey: 'smart-gadgets',
  },
  {
    id: 'dept-appliances',
    label: 'Appliances',
    tag: 'HOME ESSENTIALS',
    image: ASSETS.homeAppliance,
    bgClass: 'bg-amber-50',
    targetCategoryKey: 'appliances',
  },
];

const SUBCATEGORIES_MAP: Record<string, SubCategoryItem[]> = {
  grocery: [
    { id: 'dry-fruits', label: 'Dry Fruits', image: ASSETS.grocery, tintClass: 'bg-amber-50', iconColorClass: 'text-amber-700', searchKeyword: 'Almonds', catId: 6 },
    { id: 'honey', label: 'Raw Honey', icon: 'fa-jar', tintClass: 'bg-yellow-50', iconColorClass: 'text-amber-600', searchKeyword: 'Honey', catId: 6 },
    { id: 'tea', label: 'Green Tea', icon: 'fa-mug-hot', tintClass: 'bg-emerald-50', iconColorClass: 'text-emerald-700', searchKeyword: 'Tea', catId: 6 },
    { id: 'happilo', label: 'Happilo', subtitle: 'Brand', icon: 'fa-award', tintClass: 'bg-slate-100', iconColorClass: 'text-[#2874F0]', searchKeyword: 'Happilo', catId: 6 },
    { id: 'combos', label: 'Value Packs', icon: 'fa-basket-shopping', tintClass: 'bg-teal-50', iconColorClass: 'text-teal-700', catId: 6 },
    { id: 'under-999-g', label: 'Under ₹999', icon: 'fa-indian-rupee-sign', tintClass: 'bg-blue-50', iconColorClass: 'text-[#2874F0]', catId: 6, maxPrice: 999 },
  ],
  fashion: [
    { id: 'jackets', label: 'Denim & Shirts', image: ASSETS.fashion, tintClass: 'bg-blue-50', iconColorClass: 'text-[#2874F0]', searchKeyword: 'Denim', catId: 2 },
    { id: 'shoes', label: 'Running Shoes', image: ASSETS.sneakers, tintClass: 'bg-slate-100', iconColorClass: 'text-slate-700', searchKeyword: 'Shoes', catId: 2 },
    { id: 'backpacks', label: 'Backpacks', image: ASSETS.backpack, tintClass: 'bg-amber-50', iconColorClass: 'text-amber-700', searchKeyword: 'Backpack', catId: 2 },
    { id: 'uspa', label: 'U.S. Polo Assn.', subtitle: 'Brand', icon: 'fa-shirt', tintClass: 'bg-indigo-50', iconColorClass: 'text-indigo-700', searchKeyword: 'Polo', catId: 2 },
    { id: 'campus', label: 'Campus', subtitle: 'Brand', icon: 'fa-shoe-prints', tintClass: 'bg-emerald-50', iconColorClass: 'text-emerald-700', searchKeyword: 'Campus', catId: 2 },
    { id: 'wildcraft', label: 'Wildcraft', subtitle: 'Brand', icon: 'fa-briefcase', tintClass: 'bg-teal-50', iconColorClass: 'text-teal-700', searchKeyword: 'Wildcraft', catId: 2 },
  ],
  mobiles: [
    { id: '5g-phones', label: '5G Mobiles', image: ASSETS.smartphone, tintClass: 'bg-blue-50', iconColorClass: 'text-[#2874F0]', searchKeyword: '5G', catId: 1 },
    { id: 'redmi', label: 'Redmi', subtitle: 'Top Brand', icon: 'fa-mobile-screen', tintClass: 'bg-orange-50', iconColorClass: 'text-[#FB641B]', searchKeyword: 'Redmi', catId: 1 },
    { id: 'samsung', label: 'Samsung', subtitle: 'Top Brand', icon: 'fa-mobile-screen-button', tintClass: 'bg-indigo-50', iconColorClass: 'text-[#2874F0]', searchKeyword: 'Samsung', catId: 1 },
    { id: 'amoled', label: 'AMOLED Display', icon: 'fa-display', tintClass: 'bg-teal-50', iconColorClass: 'text-teal-700', searchKeyword: 'AMOLED', catId: 1 },
    { id: 'camera-phones', label: 'Camera Phones', icon: 'fa-camera', tintClass: 'bg-slate-100', iconColorClass: 'text-slate-700', searchKeyword: 'camera', catId: 1 },
    { id: 'under-20k', label: 'Under ₹20,000', icon: 'fa-bolt', tintClass: 'bg-emerald-50', iconColorClass: 'text-[#388E3C]', catId: 1, maxPrice: 20000 },
  ],
  appliances: [
    { id: 'kettles', label: 'Electric Kettles', image: ASSETS.homeAppliance, tintClass: 'bg-slate-100', iconColorClass: 'text-slate-700', searchKeyword: 'Kettle', catId: 4 },
    { id: 'prestige', label: 'Prestige', subtitle: 'Top Brand', icon: 'fa-fire-burner', tintClass: 'bg-orange-50', iconColorClass: 'text-[#FB641B]', searchKeyword: 'Prestige', catId: 4 },
    { id: 'kitchen', label: 'Kitchen Gear', icon: 'fa-kitchen-set', tintClass: 'bg-amber-50', iconColorClass: 'text-amber-700', catId: 4 },
    { id: 'rapid-boil', label: '1500W Rapid', icon: 'fa-bolt', tintClass: 'bg-blue-50', iconColorClass: 'text-[#2874F0]', searchKeyword: '1500W', catId: 4 },
    { id: 'home-under-1k', label: 'Under ₹1,000', icon: 'fa-tag', tintClass: 'bg-emerald-50', iconColorClass: 'text-[#388E3C]', catId: 4, maxPrice: 1000 },
    { id: 'all-home', label: 'All Appliances', icon: 'fa-plug', tintClass: 'bg-indigo-50', iconColorClass: 'text-indigo-700', catId: 4 },
  ],
  electronics: [
    { id: 'tws-earbuds', label: 'TWS Earbuds', image: ASSETS.earbuds, tintClass: 'bg-slate-100', iconColorClass: 'text-slate-700', searchKeyword: 'Earbuds', catId: 3 },
    { id: 'headphones', label: 'Headphones', image: ASSETS.hero, tintClass: 'bg-blue-50', iconColorClass: 'text-[#2874F0]', searchKeyword: 'Headphones', catId: 3 },
    { id: 'boat', label: 'boAt Audio', subtitle: 'Top Brand', icon: 'fa-headphones', tintClass: 'bg-rose-50', iconColorClass: 'text-rose-600', searchKeyword: 'boAt', catId: 3 },
    { id: 'sony', label: 'Sony Studio', subtitle: 'Top Brand', icon: 'fa-volume-high', tintClass: 'bg-indigo-50', iconColorClass: 'text-indigo-700', searchKeyword: 'Sony', catId: 3 },
    { id: 'watches', label: 'Smartwatches', image: ASSETS.smartwatch, tintClass: 'bg-teal-50', iconColorClass: 'text-teal-700', searchKeyword: 'Smartwatch', catId: 3 },
    { id: 'under-2k-e', label: 'Under ₹2,000', icon: 'fa-bolt', tintClass: 'bg-emerald-50', iconColorClass: 'text-[#388E3C]', catId: 3, maxPrice: 2000 },
  ],
  'smart-gadgets': [
    { id: 'sg-watch', label: 'AMOLED Watches', image: ASSETS.smartwatch, tintClass: 'bg-blue-50', iconColorClass: 'text-[#2874F0]', searchKeyword: 'Smartwatch', catId: 3 },
    { id: 'sg-anc', label: 'ANC Earbuds', image: ASSETS.earbuds, tintClass: 'bg-teal-50', iconColorClass: 'text-teal-700', searchKeyword: 'ANC', catId: 3 },
    { id: 'sg-noise', label: 'Noise', subtitle: 'Top Brand', icon: 'fa-clock', tintClass: 'bg-amber-50', iconColorClass: 'text-amber-700', searchKeyword: 'Noise', catId: 3 },
    { id: 'sg-bt-call', label: 'BT Calling', icon: 'fa-phone-volume', tintClass: 'bg-indigo-50', iconColorClass: 'text-indigo-700', searchKeyword: 'Bluetooth', catId: 3 },
    { id: 'sg-fitness', label: 'SpO2 Trackers', icon: 'fa-heart-pulse', tintClass: 'bg-rose-50', iconColorClass: 'text-rose-600', searchKeyword: 'SpO2', catId: 3 },
    { id: 'sg-audio', label: 'Wireless Studio', image: ASSETS.hero, tintClass: 'bg-slate-100', iconColorClass: 'text-slate-700', searchKeyword: 'Wireless', catId: 3 },
  ],
  home: [
    { id: 'flasks', label: 'Thermosteel Flask', image: ASSETS.flask, tintClass: 'bg-teal-50', iconColorClass: 'text-teal-700', searchKeyword: 'Flask', catId: 4 },
    { id: 'home-kettles', label: 'Electric Kettle', image: ASSETS.homeAppliance, tintClass: 'bg-slate-100', iconColorClass: 'text-slate-700', searchKeyword: 'Kettle', catId: 4 },
    { id: 'milton', label: 'Milton', subtitle: 'Top Brand', icon: 'fa-bottle-water', tintClass: 'bg-blue-50', iconColorClass: 'text-[#2874F0]', searchKeyword: 'Milton', catId: 4 },
    { id: 'prestige-h', label: 'Prestige', subtitle: 'Top Brand', icon: 'fa-mug-saucer', tintClass: 'bg-orange-50', iconColorClass: 'text-[#FB641B]', searchKeyword: 'Prestige', catId: 4 },
    { id: 'home-beauty', label: 'Daily Care', image: ASSETS.beauty, tintClass: 'bg-rose-50', iconColorClass: 'text-rose-600', catId: 5 },
    { id: 'home-under-1k', label: 'Under ₹1,000', icon: 'fa-tags', tintClass: 'bg-emerald-50', iconColorClass: 'text-[#388E3C]', catId: 4, maxPrice: 1000 },
  ],
};

export const CategoriesView: React.FC<Props> = ({
  categories,
  products,
  cartCount,
  searchQuery,
  onSearchChange,
  onOpenCart,
  onOpenProduct,
  onBackHome,
  onBrowseShop,
}) => {
  const [activeKey, setActiveKey] = useState<SidebarCategoryKey>('for-you');
  const [inlineSearchOpen, setInlineSearchOpen] = useState(false);
  const rightPaneRef = useRef<HTMLDivElement | null>(null);

  // Build left sidebar list: the 8 core shopping categories + any extra custom Firestore categories (e.g., Beauty)
  const sidebarItems = useMemo<SidebarCategoryItem[]>(() => {
    const coreNames = new Set(CORE_SIDEBAR_CATEGORIES.map((c) => c.label.toLowerCase()));
    const extras: SidebarCategoryItem[] = categories
      .filter((c) => !coreNames.has(c.name.trim().toLowerCase()))
      .map((c) => ({
        key: `custom-${c.id}` as SidebarCategoryKey,
        label: c.name,
        image: c.image,
        catId: c.id,
      }));
    return [...CORE_SIDEBAR_CATEGORIES, ...extras];
  }, [categories]);

  const activeItem = useMemo(
    () => sidebarItems.find((item) => item.key === activeKey) || sidebarItems[0],
    [sidebarItems, activeKey]
  );

  // Curated "New & Upcoming Launches" backed exclusively by live catalog products
  const launchCards = useMemo(() => {
    const badges: { text: string; bgClass: string }[] = [
      { text: 'NEW LAUNCH', bgClass: 'bg-teal-700' },
      { text: 'BUY NOW', bgClass: 'bg-[#00796B]' },
      { text: 'SALE IS LIVE', bgClass: 'bg-[#2E7D32]' },
      { text: 'NEW LAUNCH', bgClass: 'bg-teal-700' },
      { text: 'BUY NOW', bgClass: 'bg-[#00796B]' },
      { text: 'SALE IS LIVE', bgClass: 'bg-[#2E7D32]' },
    ];
    return products.slice(0, 6).map((prod, idx) => ({
      product: prod,
      badge: badges[idx % badges.length],
    }));
  }, [products]);

  // Products matching the currently selected left sidebar category
  const activeCategoryProducts = useMemo(() => {
    if (activeKey === 'for-you') return products;

    if (activeKey === 'appliances') {
      const applianceMatches = products.filter(
        (p) =>
          p.cat_id === 4 ||
          /kettle|appliance|prestige|mixer|iron|toaster/i.test(`${p.name} ${p.description}`)
      );
      return applianceMatches.length > 0 ? applianceMatches : products.filter((p) => p.cat_id === 4);
    }

    if (activeKey === 'smart-gadgets') {
      const gadgetMatches = products.filter((p) =>
        /smartwatch|earbuds|anc|bluetooth|amoled|noise|boat|wireless|gadget/i.test(`${p.name} ${p.description}`)
      );
      return gadgetMatches.length > 0 ? gadgetMatches : products.filter((p) => p.cat_id === 3);
    }

    if (activeKey === 'home') {
      const homeMatches = products.filter(
        (p) => p.cat_id === 4 || /flask|milton|kettle|home|kitchen/i.test(`${p.name} ${p.description}`)
      );
      return homeMatches.length > 0 ? homeMatches : products.filter((p) => p.cat_id === 4);
    }

    if (activeItem.catId) {
      return products.filter((p) => p.cat_id === activeItem.catId);
    }

    return products;
  }, [activeKey, activeItem, products]);

  const activeSubCategories = useMemo<SubCategoryItem[]>(() => {
    if (SUBCATEGORIES_MAP[activeKey]) return SUBCATEGORIES_MAP[activeKey];
    return [
      {
        id: 'all-items',
        label: `All ${activeItem.label}`,
        image: activeItem.image,
        icon: 'fa-boxes-stacked',
        tintClass: 'bg-blue-50',
        iconColorClass: 'text-[#2874F0]',
        catId: activeItem.catId,
      },
      {
        id: 'top-rated',
        label: 'Top Rated',
        icon: 'fa-star',
        tintClass: 'bg-amber-50',
        iconColorClass: 'text-amber-600',
        catId: activeItem.catId,
      },
      {
        id: 'best-value',
        label: 'Best Value',
        icon: 'fa-tags',
        tintClass: 'bg-emerald-50',
        iconColorClass: 'text-[#388E3C]',
        catId: activeItem.catId,
      },
    ];
  }, [activeKey, activeItem]);

  const handleSelectSidebar = (key: SidebarCategoryKey) => {
    setActiveKey(key);
    rightPaneRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubCategoryClick = (sub: SubCategoryItem) => {
    onBrowseShop({
      catId: sub.catId ?? activeItem.catId ?? 0,
      query: sub.searchKeyword || '',
      maxPrice: sub.maxPrice || 0,
    });
  };

  const liveSearchMatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    const catNameById = new Map(categories.map((c) => [c.id, c.name.toLowerCase()]));
    return products.filter((p) => {
      const catName = catNameById.get(p.cat_id) || '';
      return (
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        catName.includes(q) ||
        (p.sellerName && p.sellerName.toLowerCase().includes(q))
      );
    });
  }, [searchQuery, products, categories]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      onBrowseShop({ query: searchQuery.trim(), catId: 0 });
    }
  };

  return (
    <div className="min-h-[calc(100vh-56px)] md:min-h-screen bg-white flex flex-col">
      {/* 1. Clean White Sticky Top Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200/90">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={onBackHome}
              aria-label="Back to Home"
              className="hidden md:inline-flex w-9 h-9 -ml-1 rounded-full items-center justify-center text-slate-600 hover:bg-slate-100 transition shrink-0"
            >
              <i className="fa-solid fa-arrow-left text-sm"></i>
            </button>
            <h1 className="text-[17px] sm:text-lg font-extrabold text-slate-900 tracking-tight whitespace-nowrap">
              All Categories
            </h1>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setInlineSearchOpen((prev) => !prev)}
              aria-label="Search products"
              className={`min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center transition ${
                inlineSearchOpen ? 'bg-blue-50 text-[#2874F0]' : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <i className={`fa-solid ${inlineSearchOpen ? 'fa-xmark' : 'fa-magnifying-glass'} text-[17px]`}></i>
            </button>

            <button
              type="button"
              onClick={onOpenCart}
              aria-label="Open shopping cart"
              className="relative min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center text-slate-700 hover:bg-slate-100 transition"
            >
              <i className="fa-solid fa-cart-shopping text-[17px]"></i>
              {cartCount > 0 && (
                <span className="absolute top-1.5 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#E53935] text-white text-[10px] font-extrabold flex items-center justify-center tabular-nums shadow-xs">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Expandable Inline Live Search Bar */}
        {(inlineSearchOpen || searchQuery.trim().length > 0) && (
          <form onSubmit={handleSearchSubmit} className="max-w-7xl mx-auto px-4 pb-3">
            <div className="relative flex items-center">
              <i className="fa-solid fa-magnifying-glass text-slate-400 text-xs absolute left-3.5 pointer-events-none"></i>
              <input
                type="text"
                autoFocus={inlineSearchOpen}
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search mobiles, fashion, grocery, gadgets..."
                className="w-full h-10 pl-9 pr-24 rounded-lg bg-[#F1F3F6] border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:border-[#2874F0] focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => onSearchChange('')}
                  aria-label="Clear search"
                  className="absolute right-[72px] w-7 h-7 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition"
                >
                  <i className="fa-solid fa-xmark text-xs"></i>
                </button>
              )}
              <button
                type="submit"
                className="absolute right-1.5 px-3 h-7 rounded-md bg-[#2874F0] text-white text-xs font-bold hover:bg-[#1e60d5] transition"
              >
                Shop
              </button>
            </div>
          </form>
        )}
      </header>

      {/* Live Real-Time Search Results Overlay inside Categories */}
      {searchQuery.trim().length > 0 ? (
        <main className="max-w-7xl w-full mx-auto flex-1 px-3 sm:px-6 py-4 pb-20 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
            <div>
              <h2 className="text-sm sm:text-base font-extrabold text-slate-900">
                Matching results for &ldquo;{searchQuery.trim()}&rdquo;
              </h2>
              <p className="text-xs text-slate-500 tabular-nums">
                {liveSearchMatches.length} product{liveSearchMatches.length === 1 ? '' : 's'} found
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onBrowseShop({ query: searchQuery.trim(), catId: 0 })}
                className="px-3 py-1.5 rounded-lg bg-[#2874F0] text-white text-xs font-bold hover:bg-[#1e60d5] transition whitespace-nowrap"
              >
                Sort &amp; Filter in Shop
              </button>
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 transition whitespace-nowrap"
              >
                Clear
              </button>
            </div>
          </div>

          {liveSearchMatches.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-10 text-center space-y-2.5">
              <i className="fa-solid fa-magnifying-glass text-2xl text-slate-300"></i>
              <p className="text-sm font-bold text-slate-700">No matching products found</p>
              <p className="text-xs text-slate-500">Try searching for Mobiles, Earbuds, Shoes, Kettle, or Grocery.</p>
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="mt-2 px-4 py-2 rounded-lg bg-[#2874F0] text-white text-xs font-bold hover:bg-[#1e60d5] transition"
              >
                Reset Search
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {liveSearchMatches.map((prod) => {
                const mrp = getEffectiveMrp(prod.price, prod.mrp);
                const discount = getDiscountPercent(prod.price, mrp);
                return (
                  <button
                    key={prod.docId || prod.id}
                    type="button"
                    onClick={() => onOpenProduct(prod)}
                    className="group bg-white rounded-xl border border-slate-200/80 overflow-hidden text-left flex flex-col hover:border-[#2874F0]/50 hover:shadow-sm transition"
                  >
                    <div className="aspect-square bg-slate-50 p-2 overflow-hidden relative">
                      <img
                        src={prod.image}
                        alt={prod.name}
                        referrerPolicy="no-referrer"
                        className={`w-full h-full object-cover rounded-lg group-hover:scale-105 transition duration-200 ${
                          prod.stock <= 0 ? 'opacity-50 grayscale' : ''
                        }`}
                      />
                      {prod.stock <= 0 && (
                        <span className="absolute bottom-2 left-2 right-2 text-center py-0.5 rounded bg-slate-900/85 text-white text-[10px] font-bold">
                          Out of Stock
                        </span>
                      )}
                    </div>
                    <div className="p-2.5 flex-1 flex flex-col">
                      <p className="text-xs font-semibold text-slate-900 line-clamp-2 leading-snug group-hover:text-[#2874F0]">
                        {prod.name}
                      </p>
                      {Number(prod.reviews || 0) > 0 && Number(prod.rating || 0) > 0 && (
                        <div className="mt-1 flex items-center gap-1">
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-sm bg-[#388E3C] text-white text-[10px] font-bold leading-none tabular-nums">
                            {Number(prod.rating).toFixed(1)}
                            <i className="fa-solid fa-star text-[8px]"></i>
                          </span>
                          <span className="text-[10px] text-slate-400 tabular-nums">
                            ({Number(prod.reviews).toLocaleString('en-IN')})
                          </span>
                        </div>
                      )}
                      {prod.stock > 0 && prod.stock <= 5 && (
                        <p className="mt-1 text-[10px] font-bold text-rose-600">
                          Only {prod.stock} left in stock!
                        </p>
                      )}
                      <div className="mt-auto pt-1.5 flex flex-wrap items-baseline gap-x-1.5">
                        <span className="text-sm font-extrabold text-slate-900 font-mono tabular-nums">
                          {formatINR(prod.price)}
                        </span>
                        {mrp > prod.price && (
                          <span className="text-[11px] text-slate-400 line-through font-mono tabular-nums">
                            {formatINR(mrp)}
                          </span>
                        )}
                        {discount > 0 && (
                          <span className="text-[11px] font-bold text-[#388E3C] tabular-nums">
                            {discount}% off
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </main>
      ) : (
      /* Split-Screen Container: Left 26% Sidebar + Right 74% Independently Scrollable Content Pane */
      <div className="max-w-7xl w-full mx-auto flex-1 flex h-[calc(100vh-112px)] md:h-[calc(100vh-56px)] overflow-hidden bg-white border-x border-slate-100">
        {/* 2. Left Vertical Sidebar (26% width on mobile, light gray #F1F3F6) */}
        <aside
          aria-label="Category list"
          className="w-[26%] sm:w-[22%] lg:w-[210px] shrink-0 bg-[#F1F3F6] border-r border-slate-200/80 overflow-y-auto no-scrollbar pb-16"
        >
          {sidebarItems.map((item) => {
            const isActive = item.key === activeKey;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => handleSelectSidebar(item.key)}
                className={`relative w-full py-3.5 px-1.5 sm:px-3 flex flex-col items-center justify-center text-center transition-colors duration-150 border-b border-slate-200/60 min-h-[82px] ${
                  isActive ? 'bg-white text-[#2874F0]' : 'bg-[#F1F3F6] text-slate-700 hover:bg-slate-200/60'
                }`}
              >
                {/* 4px Royal Blue vertical indicator pill on the left edge */}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-[#2874F0]"
                  />
                )}

                <div
                  className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center overflow-hidden transition-transform duration-150 ${
                    isActive
                      ? 'bg-blue-50 ring-1 ring-[#2874F0]/25 scale-[1.03]'
                      : 'bg-white/90 border border-slate-200/70'
                  }`}
                >
                  {item.image ? (
                    <img
                      src={item.image}
                      alt={item.label}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#2874F0]/15 via-blue-50 to-[#FFE500]/30 text-[#2874F0]">
                      <i className="fa-solid fa-bag-shopping text-lg"></i>
                    </div>
                  )}
                </div>

                <span
                  className={`mt-1.5 text-[11px] sm:text-xs leading-tight line-clamp-2 ${
                    isActive ? 'font-extrabold text-[#2874F0]' : 'font-semibold text-slate-700'
                  }`}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </aside>

        {/* 3. Right Content Pane (74% width on mobile, pure white #FFFFFF, independently scrollable) */}
        <section
          ref={rightPaneRef}
          aria-label={`${activeItem.label} content`}
          className="w-[74%] sm:w-[78%] lg:flex-1 bg-white overflow-y-auto px-3 sm:px-6 py-4 pb-20"
        >
          {activeKey === 'for-you' ? (
            <div className="space-y-6">
              {/* Section 1: Real Shopping Categories */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-[14px] sm:text-base font-extrabold text-slate-900">Shop by Category</h2>
                  <button
                    type="button"
                    onClick={() => onBrowseShop({ catId: 0 })}
                    className="text-[11px] sm:text-xs font-bold text-[#2874F0] hover:underline whitespace-nowrap"
                  >
                    See All
                  </button>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-x-2.5 gap-y-4">
                  {FEATURED_SHOPPING_CATEGORIES.map((dept) => (
                    <button
                      key={dept.id}
                      type="button"
                      onClick={() => {
                        if (dept.targetCategoryKey) {
                          handleSelectSidebar(dept.targetCategoryKey);
                        } else {
                          onBrowseShop({ catId: dept.filterCatId ?? 0 });
                        }
                      }}
                      className="group flex flex-col items-center text-center focus-visible:outline-none"
                    >
                      <div
                        className={`relative w-full aspect-square rounded-xl ${dept.bgClass} border border-slate-100 overflow-hidden group-hover:border-[#2874F0]/40 group-active:scale-95 transition`}
                      >
                        <img
                          src={dept.image}
                          alt={dept.label}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-200"
                        />
                        {dept.tag && (
                          <span className="absolute bottom-1 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded-full bg-[#00796B] text-white text-[8px] sm:text-[9px] font-extrabold tracking-wide whitespace-nowrap shadow-xs">
                            {dept.tag}
                          </span>
                        )}
                      </div>
                      <span className="mt-1.5 text-[11px] sm:text-xs font-semibold text-slate-800 leading-tight line-clamp-2 group-hover:text-[#2874F0]">
                        {dept.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="h-px bg-slate-100" />

              {/* Section 2: New & Upcoming Launches (Real Catalog Products) */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-[14px] sm:text-base font-extrabold text-slate-900">
                    New &amp; Upcoming Launches
                  </h2>
                  <button
                    type="button"
                    onClick={() => onBrowseShop({ catId: 0, sortBy: 'relevance' })}
                    className="text-[11px] sm:text-xs font-bold text-[#2874F0] hover:underline whitespace-nowrap"
                  >
                    Explore
                  </button>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-x-2.5 gap-y-4">
                  {launchCards.map(({ product, badge }) => (
                    <button
                      key={product.docId || product.id}
                      type="button"
                      onClick={() => onOpenProduct(product)}
                      className="group flex flex-col items-center text-center focus-visible:outline-none"
                    >
                      <div className="relative w-full aspect-square rounded-xl bg-slate-50 border border-slate-200/80 overflow-hidden group-hover:border-[#2874F0]/50 group-active:scale-95 transition">
                        <img
                          src={product.image}
                          alt={product.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-200"
                        />
                        <div
                          className={`absolute inset-x-0 bottom-0 py-0.5 px-1 ${badge.bgClass} text-white text-[8px] sm:text-[9px] font-extrabold tracking-wider text-center uppercase`}
                        >
                          {badge.text}
                        </div>
                      </div>

                      <span className="mt-1.5 text-[11px] sm:text-xs font-semibold text-slate-800 leading-tight line-clamp-2 group-hover:text-[#2874F0]">
                        {product.name}
                      </span>
                      <span className="mt-0.5 text-[10px] sm:text-[11px] font-extrabold text-slate-900 font-mono tabular-nums">
                        {formatINR(product.price)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="h-px bg-slate-100" />

              {/* Section 3: Top Deals in Store (Real Catalog Products) */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-[14px] sm:text-base font-extrabold text-slate-900">
                    Top Deals For You
                  </h2>
                  <button
                    type="button"
                    onClick={() => onBrowseShop({ catId: 0 })}
                    className="text-[11px] sm:text-xs font-bold text-[#2874F0] hover:underline whitespace-nowrap"
                  >
                    View All
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
                  {products.slice(0, 8).map((prod) => {
                    const mrp = getEffectiveMrp(prod.price, prod.mrp);
                    const discount = getDiscountPercent(prod.price, mrp);
                    return (
                      <button
                        key={prod.docId || prod.id}
                        type="button"
                        onClick={() => onOpenProduct(prod)}
                        className="group bg-white rounded-xl border border-slate-200/80 overflow-hidden text-left flex flex-col hover:border-[#2874F0]/50 hover:shadow-sm transition"
                      >
                        <div className="aspect-square bg-slate-50 p-1.5 overflow-hidden">
                          <img
                            src={prod.image}
                            alt={prod.name}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover rounded-lg group-hover:scale-105 transition duration-200"
                          />
                        </div>
                        <div className="p-2 sm:p-2.5 flex-1 flex flex-col">
                          <p className="text-[11px] sm:text-xs font-semibold text-slate-900 line-clamp-2 leading-snug group-hover:text-[#2874F0]">
                            {prod.name}
                          </p>
                          <div className="mt-auto pt-1.5 flex flex-wrap items-baseline gap-x-1.5">
                            <span className="text-xs sm:text-sm font-extrabold text-slate-900 font-mono tabular-nums">
                              {formatINR(prod.price)}
                            </span>
                            {discount > 0 && (
                              <span className="text-[10px] font-bold text-[#388E3C] tabular-nums">
                                {discount}% off
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Active Category Header */}
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
                <div className="min-w-0">
                  <h2 className="text-[15px] sm:text-lg font-extrabold text-slate-900 truncate">
                    {activeItem.label}
                  </h2>
                  <p className="text-[11px] text-slate-500 tabular-nums">
                    {activeCategoryProducts.length} product{activeCategoryProducts.length === 1 ? '' : 's'} available
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onBrowseShop({
                      catId: activeItem.catId ?? 0,
                      query: activeKey === 'smart-gadgets' ? 'Smart' : '',
                    })
                  }
                  className="px-3 py-1.5 rounded-lg bg-blue-50 text-[#2874F0] text-[11px] sm:text-xs font-bold hover:bg-blue-100 transition whitespace-nowrap shrink-0"
                >
                  View All <i className="fa-solid fa-chevron-right text-[9px] ml-0.5"></i>
                </button>
              </div>

              {/* Sub-categories & Popular Brands (3-column icon grid) */}
              <div>
                <h3 className="text-xs sm:text-sm font-extrabold text-slate-800 mb-3">
                  Sub-categories &amp; Popular Brands
                </h3>
                <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-x-2.5 gap-y-4">
                  {activeSubCategories.map((sub) => (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => handleSubCategoryClick(sub)}
                      className="group flex flex-col items-center text-center"
                    >
                      <div
                        className={`w-full aspect-square rounded-xl ${sub.tintClass} border border-slate-100 flex items-center justify-center overflow-hidden group-hover:border-[#2874F0]/40 group-active:scale-95 transition`}
                      >
                        {sub.image ? (
                          <img
                            src={sub.image}
                            alt={sub.label}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover group-hover:scale-105 transition duration-200"
                          />
                        ) : (
                          <i className={`fa-solid ${sub.icon || 'fa-tag'} text-xl sm:text-2xl ${sub.iconColorClass}`}></i>
                        )}
                      </div>
                      <span className="mt-1.5 text-[11px] sm:text-xs font-semibold text-slate-800 leading-tight line-clamp-2 group-hover:text-[#2874F0]">
                        {sub.label}
                      </span>
                      {sub.subtitle && (
                        <span className="text-[9px] font-medium text-slate-400">{sub.subtitle}</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="h-px bg-slate-100" />

              {/* Matching Products from Live Catalog */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs sm:text-sm font-extrabold text-slate-800">
                    Top Picks in {activeItem.label}
                  </h3>
                  <span className="text-[11px] font-medium text-slate-400 tabular-nums">
                    {activeCategoryProducts.length} items
                  </span>
                </div>

                {activeCategoryProducts.length === 0 ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-6 text-center space-y-2.5">
                    <i className="fa-solid fa-box-open text-2xl text-slate-300"></i>
                    <p className="text-xs font-semibold text-slate-600">
                      No products listed in {activeItem.label} yet.
                    </p>
                    <button
                      type="button"
                      onClick={() => onBrowseShop({ catId: 0 })}
                      className="px-4 py-2 rounded-lg bg-[#2874F0] text-white text-xs font-bold hover:bg-[#1e60d5] transition"
                    >
                      Browse All Products
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
                    {activeCategoryProducts.map((prod) => {
                      const mrp = getEffectiveMrp(prod.price, prod.mrp);
                      const discount = getDiscountPercent(prod.price, mrp);
                      return (
                        <button
                          key={prod.docId || prod.id}
                          type="button"
                          onClick={() => onOpenProduct(prod)}
                          className="group bg-white rounded-xl border border-slate-200/80 overflow-hidden text-left flex flex-col hover:border-[#2874F0]/50 hover:shadow-sm transition"
                        >
                          <div className="aspect-square bg-slate-50 p-1.5 overflow-hidden relative">
                            <img
                              src={prod.image}
                              alt={prod.name}
                              referrerPolicy="no-referrer"
                              className={`w-full h-full object-cover rounded-lg group-hover:scale-105 transition duration-200 ${
                                prod.stock <= 0 ? 'opacity-50 grayscale' : ''
                              }`}
                            />
                            {prod.stock <= 0 && (
                              <span className="absolute bottom-1.5 left-1.5 right-1.5 text-center py-0.5 rounded bg-slate-900/85 text-white text-[9px] font-bold">
                                Out of Stock
                              </span>
                            )}
                          </div>
                          <div className="p-2 sm:p-2.5 flex-1 flex flex-col">
                            <p className="text-[11px] sm:text-xs font-semibold text-slate-900 line-clamp-2 leading-snug group-hover:text-[#2874F0]">
                              {prod.name}
                            </p>
                            {Number(prod.reviews || 0) > 0 && Number(prod.rating || 0) > 0 && (
                              <div className="mt-1 flex items-center gap-1">
                                <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded-sm bg-[#388E3C] text-white text-[9px] font-bold leading-none tabular-nums">
                                  {Number(prod.rating).toFixed(1)}
                                  <i className="fa-solid fa-star text-[7px]"></i>
                                </span>
                                <span className="text-[10px] text-slate-400 tabular-nums">
                                  ({Number(prod.reviews).toLocaleString('en-IN')})
                                </span>
                              </div>
                            )}
                            {prod.stock > 0 && prod.stock <= 5 && (
                              <p className="mt-1 text-[10px] font-bold text-rose-600">
                                Only {prod.stock} left!
                              </p>
                            )}
                            <div className="mt-auto pt-1.5 flex flex-wrap items-baseline gap-x-1.5">
                              <span className="text-xs sm:text-sm font-extrabold text-slate-900 font-mono tabular-nums">
                                {formatINR(prod.price)}
                              </span>
                              {mrp > prod.price && (
                                <span className="text-[10px] text-slate-400 line-through font-mono tabular-nums">
                                  {formatINR(mrp)}
                                </span>
                              )}
                              {discount > 0 && (
                                <span className="text-[10px] font-bold text-[#388E3C] tabular-nums">
                                  {discount}% off
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
      )}
    </div>
  );
};
