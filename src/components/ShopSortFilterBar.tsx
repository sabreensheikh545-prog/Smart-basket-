import React, { useEffect, useMemo, useState } from 'react';
import {
  CatalogFilterState,
  CatalogSortOption,
  Category,
  EMPTY_CATALOG_FILTERS,
  PriceRangeBucket,
  Product,
} from '../types';

export interface ProductReviewStatSummary {
  avg: number;
  count: number;
}

export const SORT_OPTIONS: { id: CatalogSortOption; label: string }[] = [
  { id: 'relevance', label: 'Popularity' },
  { id: 'price_asc', label: 'Price: Low to High' },
  { id: 'price_desc', label: 'Price: High to Low' },
  { id: 'top_rated', label: 'Top Rated' },
];

export const PRICE_RANGE_OPTIONS: { id: PriceRangeBucket; label: string }[] = [
  { id: 'under_500', label: 'Under ₹500' },
  { id: '500_2000', label: '₹500 – ₹2,000' },
  { id: 'above_2000', label: 'Above ₹2,000' },
];

export function matchesPriceBuckets(price: number, buckets: PriceRangeBucket[]): boolean {
  if (buckets.length === 0) return true;
  return buckets.some((b) => {
    if (b === 'under_500') return price < 500;
    if (b === '500_2000') return price >= 500 && price <= 2000;
    if (b === 'above_2000') return price > 2000;
    return true;
  });
}

export function countActiveCatalogFilters(filters: CatalogFilterState, maxPrice = 0): number {
  return (
    filters.priceRanges.length +
    filters.categoryIds.length +
    (filters.inStockOnly ? 1 : 0) +
    (maxPrice > 0 ? 1 : 0)
  );
}

export function applyCatalogFiltersAndSort(params: {
  products: Product[];
  categories: Category[];
  searchQuery?: string;
  filters: CatalogFilterState;
  maxPrice?: number;
  sortBy: CatalogSortOption;
  reviewStats?: Map<number, ProductReviewStatSummary>;
}): Product[] {
  const { products, categories, searchQuery = '', filters, maxPrice = 0, sortBy, reviewStats } = params;
  const q = searchQuery.trim().toLowerCase();
  const catNameById = new Map(categories.map((c) => [c.id, c.name.toLowerCase()]));

  const filtered = products.filter((p) => {
    if (filters.categoryIds.length > 0 && !filters.categoryIds.includes(p.cat_id)) return false;
    if (filters.inStockOnly && p.stock <= 0) return false;
    if (!matchesPriceBuckets(p.price, filters.priceRanges)) return false;
    if (maxPrice > 0 && p.price > maxPrice) return false;

    if (q) {
      const catName = catNameById.get(p.cat_id) || '';
      const matchName = p.name.toLowerCase().includes(q);
      const matchDesc = p.description.toLowerCase().includes(q);
      const matchCat = catName.includes(q);
      const matchSeller = Boolean(p.sellerName && p.sellerName.toLowerCase().includes(q));
      if (!matchName && !matchDesc && !matchCat && !matchSeller) return false;
    }
    return true;
  });

  if (sortBy === 'price_asc') {
    return [...filtered].sort((a, b) => a.price - b.price);
  }
  if (sortBy === 'price_desc') {
    return [...filtered].sort((a, b) => b.price - a.price);
  }
  if (sortBy === 'top_rated') {
    return [...filtered].sort((a, b) => {
      const sA = reviewStats?.get(a.id);
      const sB = reviewStats?.get(b.id);
      const avgA = sA?.avg ?? Number(a.rating || 0);
      const avgB = sB?.avg ?? Number(b.rating || 0);
      const diff = avgB - avgA;
      if (diff !== 0) return diff;
      const cntA = sA?.count ?? Number(a.reviews || 0);
      const cntB = sB?.count ?? Number(b.reviews || 0);
      return cntB - cntA;
    });
  }

  if (q) {
    return [...filtered].sort((a, b) => {
      const score = (item: Product) => {
        const n = item.name.toLowerCase();
        if (n.startsWith(q)) return 3;
        if (n.includes(q)) return 2;
        if ((catNameById.get(item.cat_id) || '').includes(q)) return 1;
        return 0;
      };
      return score(b) - score(a);
    });
  }

  return filtered;
}

interface Props {
  sortBy: CatalogSortOption;
  onSortChange: (next: CatalogSortOption) => void;
  filters: CatalogFilterState;
  onApplyFilters: (next: CatalogFilterState) => void;
  onResetAll: () => void;
  categories: Category[];
  allProducts: Product[];
  searchQuery?: string;
  maxPrice?: number;
  stickyTopClass?: string;
}

type FilterPaneTab = 'price' | 'category' | 'availability';

export const ShopSortFilterBar: React.FC<Props> = ({
  sortBy,
  onSortChange,
  filters,
  onApplyFilters,
  onResetAll,
  categories,
  allProducts,
  searchQuery = '',
  maxPrice = 0,
  stickyTopClass = 'top-[96px] md:top-[56px]',
}) => {
  const [sortSheetOpen, setSortSheetOpen] = useState(false);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [activeFilterTab, setActiveFilterTab] = useState<FilterPaneTab>('price');
  const [draftFilters, setDraftFilters] = useState<CatalogFilterState>(filters);

  useEffect(() => {
    if (filterSheetOpen) {
      setDraftFilters(filters);
    }
  }, [filterSheetOpen, filters]);

  const activeFilterCount = countActiveCatalogFilters(filters, maxPrice);
  const activeSortLabel = SORT_OPTIONS.find((o) => o.id === sortBy)?.label || 'Popularity';

  const draftMatchCount = useMemo(
    () =>
      applyCatalogFiltersAndSort({
        products: allProducts,
        categories,
        searchQuery,
        filters: draftFilters,
        sortBy,
      }).length,
    [allProducts, categories, searchQuery, draftFilters, sortBy]
  );

  const toggleDraftPriceRange = (bucket: PriceRangeBucket) => {
    setDraftFilters((prev) => ({
      ...prev,
      priceRanges: prev.priceRanges.includes(bucket)
        ? prev.priceRanges.filter((b) => b !== bucket)
        : [...prev.priceRanges, bucket],
    }));
  };

  const toggleDraftCategory = (catId: number) => {
    setDraftFilters((prev) => ({
      ...prev,
      categoryIds: prev.categoryIds.includes(catId)
        ? prev.categoryIds.filter((id) => id !== catId)
        : [...prev.categoryIds, catId],
    }));
  };

  const handleApplyDraft = () => {
    onApplyFilters(draftFilters);
    setFilterSheetOpen(false);
  };

  const handleClearDraft = () => {
    setDraftFilters(EMPTY_CATALOG_FILTERS);
  };

  return (
    <>
      {/* Authentic Flipkart Sticky Split Bar: 50% Sort | 50% Filter */}
      <div
        className={`sticky ${stickyTopClass} z-30 bg-white border-b border-slate-200/90 shadow-[0_1px_2px_rgba(15,23,42,0.04)]`}
      >
        <div className="max-w-7xl mx-auto grid grid-cols-2 divide-x divide-slate-200 h-11 sm:h-12">
          <button
            type="button"
            onClick={() => setSortSheetOpen(true)}
            aria-label="Sort products"
            className="h-full px-3 flex items-center justify-center gap-2 text-xs sm:text-sm font-bold text-slate-800 hover:bg-slate-50 active:bg-slate-100 transition whitespace-nowrap"
          >
            <i className="fa-solid fa-arrow-down-up-across-line text-[13px] text-slate-700"></i>
            <span>Sort</span>
            {sortBy !== 'relevance' && (
              <span className="hidden sm:inline text-[11px] font-semibold text-[#2874F0] truncate max-w-[140px]">
                · {activeSortLabel}
              </span>
            )}
            {sortBy !== 'relevance' && (
              <span className="sm:hidden text-[10px] font-extrabold text-[#2874F0]">•</span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setFilterSheetOpen(true)}
            aria-label="Filter products"
            className="h-full px-3 flex items-center justify-center gap-2 text-xs sm:text-sm font-bold text-slate-800 hover:bg-slate-50 active:bg-slate-100 transition whitespace-nowrap"
          >
            <i className="fa-solid fa-sliders text-[13px] text-slate-700"></i>
            <span>Filter</span>
            {activeFilterCount > 0 && (
              <span className="min-w-[18px] h-[18px] px-1 rounded-sm bg-[#2874F0] text-white text-[10px] font-extrabold inline-flex items-center justify-center tabular-nums">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Quiet Active Filter Summary Bar (only visible when filters or non-default sort are active) */}
        {activeFilterCount > 0 && (
          <div className="max-w-7xl mx-auto px-3 sm:px-4 py-1.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2 text-[11px]">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar text-slate-600 font-medium whitespace-nowrap">
              {filters.priceRanges.map((b) => (
                <span key={b} className="inline-flex items-center gap-1 text-slate-800 font-semibold">
                  {PRICE_RANGE_OPTIONS.find((o) => o.id === b)?.label}
                  <button
                    type="button"
                    aria-label="Remove price filter"
                    onClick={() =>
                      onApplyFilters({
                        ...filters,
                        priceRanges: filters.priceRanges.filter((x) => x !== b),
                      })
                    }
                    className="text-slate-400 hover:text-slate-800 ml-0.5"
                  >
                    ×
                  </button>
                </span>
              ))}
              {filters.categoryIds.map((cid) => {
                const name = categories.find((c) => c.id === cid)?.name;
                if (!name) return null;
                return (
                  <span key={cid} className="inline-flex items-center gap-1 text-slate-800 font-semibold">
                    <span className="text-slate-300">·</span>
                    {name}
                    <button
                      type="button"
                      aria-label={`Remove ${name} filter`}
                      onClick={() =>
                        onApplyFilters({
                          ...filters,
                          categoryIds: filters.categoryIds.filter((x) => x !== cid),
                        })
                      }
                      className="text-slate-400 hover:text-slate-800 ml-0.5"
                    >
                      ×
                    </button>
                  </span>
                );
              })}
              {filters.inStockOnly && (
                <span className="inline-flex items-center gap-1 text-[#2E7D32] font-semibold">
                  <span className="text-slate-300">·</span>
                  In Stock Only
                  <button
                    type="button"
                    aria-label="Remove availability filter"
                    onClick={() => onApplyFilters({ ...filters, inStockOnly: false })}
                    className="text-slate-400 hover:text-slate-800 ml-0.5"
                  >
                    ×
                  </button>
                </span>
              )}
              {maxPrice > 0 && (
                <span className="inline-flex items-center gap-1 text-slate-800 font-semibold">
                  <span className="text-slate-300">·</span>
                  Under ₹{maxPrice.toLocaleString('en-IN')}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={onResetAll}
              className="text-[11px] font-bold text-[#2874F0] hover:underline shrink-0 whitespace-nowrap"
            >
              Clear All
            </button>
          </div>
        )}
      </div>

      {/* 1. Authentic Flipkart Sort Bottom Sheet */}
      {sortSheetOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50"
          onClick={() => setSortSheetOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Sort products"
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-md bg-white rounded-t-xl sm:rounded-xl shadow-2xl border-t sm:border border-slate-200 overflow-hidden"
          >
            <div className="px-4 py-3.5 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                Sort By
              </h2>
              <button
                type="button"
                onClick={() => setSortSheetOpen(false)}
                aria-label="Close sort options"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100"
              >
                <i className="fa-solid fa-xmark text-sm"></i>
              </button>
            </div>

            <div className="divide-y divide-slate-100 py-1">
              {SORT_OPTIONS.map((opt) => {
                const selected = sortBy === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      onSortChange(opt.id);
                      setSortSheetOpen(false);
                    }}
                    className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-slate-50 transition"
                  >
                    <span
                      className={`text-sm ${
                        selected ? 'font-bold text-[#2874F0]' : 'font-medium text-slate-800'
                      }`}
                    >
                      {opt.label}
                    </span>
                    <span
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition ${
                        selected ? 'border-[#2874F0]' : 'border-slate-300'
                      }`}
                    >
                      {selected && <span className="w-2.5 h-2.5 rounded-full bg-[#2874F0]" />}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 2. Authentic Flipkart Split-Pane Filter Sheet */}
      {filterSheetOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/55"
          onClick={() => setFilterSheetOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Filter products"
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-xl h-[82vh] sm:h-[540px] bg-white rounded-t-xl sm:rounded-xl shadow-2xl border-t sm:border border-slate-200 flex flex-col overflow-hidden"
          >
            {/* Filter Header */}
            <div className="px-4 h-13 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setFilterSheetOpen(false)}
                  aria-label="Close filters"
                  className="w-8 h-8 -ml-1 rounded-lg flex items-center justify-center text-slate-600 hover:bg-slate-100"
                >
                  <i className="fa-solid fa-arrow-left text-sm"></i>
                </button>
                <h2 className="text-base font-extrabold text-slate-900">Filters</h2>
              </div>
              <button
                type="button"
                onClick={handleClearDraft}
                className="text-xs font-bold text-[#2874F0] hover:underline px-2 py-1"
              >
                Clear Filters
              </button>
            </div>

            {/* Split-Pane Body: Left Tabs + Right Checkboxes */}
            <div className="flex-1 flex min-h-0 overflow-hidden">
              {/* Left Vertical Tab Rail */}
              <div className="w-[36%] sm:w-[190px] shrink-0 bg-[#F1F3F6] border-r border-slate-200 overflow-y-auto">
                {(
                  [
                    {
                      id: 'price' as const,
                      label: 'Price Range',
                      count: draftFilters.priceRanges.length,
                    },
                    {
                      id: 'category' as const,
                      label: 'Category',
                      count: draftFilters.categoryIds.length,
                    },
                    {
                      id: 'availability' as const,
                      label: 'Availability',
                      count: draftFilters.inStockOnly ? 1 : 0,
                    },
                  ]
                ).map((tab) => {
                  const isActive = activeFilterTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveFilterTab(tab.id)}
                      className={`w-full px-3.5 py-4 text-left text-xs sm:text-sm flex items-center justify-between gap-2 border-b border-slate-200/70 transition ${
                        isActive
                          ? 'bg-white font-bold text-[#2874F0]'
                          : 'bg-[#F1F3F6] font-medium text-slate-700 hover:bg-slate-200/60'
                      }`}
                    >
                      <span className="truncate">{tab.label}</span>
                      {tab.count > 0 && (
                        <span className="text-[11px] font-extrabold text-[#2874F0] tabular-nums shrink-0">
                          {tab.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Right Checkbox Pane */}
              <div className="flex-1 bg-white overflow-y-auto p-4 space-y-1">
                {activeFilterTab === 'price' && (
                  <>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 pb-2">
                      Select Price Range
                    </p>
                    {PRICE_RANGE_OPTIONS.map((opt) => {
                      const checked = draftFilters.priceRanges.includes(opt.id);
                      return (
                        <label
                          key={opt.id}
                          className="flex items-center gap-3 py-3 cursor-pointer hover:bg-slate-50 px-2 rounded-lg transition"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleDraftPriceRange(opt.id)}
                            className="w-4 h-4 rounded accent-[#2874F0] cursor-pointer"
                          />
                          <span className={`text-sm ${checked ? 'font-bold text-slate-900' : 'text-slate-700'}`}>
                            {opt.label}
                          </span>
                        </label>
                      );
                    })}
                  </>
                )}

                {activeFilterTab === 'category' && (
                  <>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 pb-2">
                      Select Categories
                    </p>
                    {categories.map((cat) => {
                      const checked = draftFilters.categoryIds.includes(cat.id);
                      return (
                        <label
                          key={cat.id}
                          className="flex items-center gap-3 py-3 cursor-pointer hover:bg-slate-50 px-2 rounded-lg transition"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleDraftCategory(cat.id)}
                            className="w-4 h-4 rounded accent-[#2874F0] cursor-pointer"
                          />
                          <span className={`text-sm ${checked ? 'font-bold text-slate-900' : 'text-slate-700'}`}>
                            {cat.name}
                          </span>
                        </label>
                      );
                    })}
                  </>
                )}

                {activeFilterTab === 'availability' && (
                  <>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 pb-2">
                      Stock Availability
                    </p>
                    <label className="flex items-start gap-3 py-3 cursor-pointer hover:bg-slate-50 px-2 rounded-lg transition">
                      <input
                        type="checkbox"
                        checked={draftFilters.inStockOnly}
                        onChange={(e) =>
                          setDraftFilters((prev) => ({
                            ...prev,
                            inStockOnly: e.target.checked,
                          }))
                        }
                        className="w-4 h-4 mt-0.5 rounded accent-[#2874F0] cursor-pointer"
                      />
                      <div>
                        <span
                          className={`block text-sm ${
                            draftFilters.inStockOnly ? 'font-bold text-slate-900' : 'text-slate-700'
                          }`}
                        >
                          In Stock Only
                        </span>
                        <span className="block text-xs text-slate-500 mt-0.5">
                          Exclude currently out-of-stock products
                        </span>
                      </div>
                    </label>
                  </>
                )}
              </div>
            </div>

            {/* Filter Sheet Sticky Footer with Product Count & Apply Button */}
            <div className="px-4 py-3 border-t border-slate-200 bg-white flex items-center justify-between gap-3 shrink-0">
              <div>
                <p className="text-sm font-extrabold text-slate-900 tabular-nums">
                  {draftMatchCount.toLocaleString('en-IN')}
                </p>
                <p className="text-[11px] text-slate-500">
                  product{draftMatchCount === 1 ? '' : 's'} found
                </p>
              </div>
              <button
                type="button"
                onClick={handleApplyDraft}
                className="px-8 h-10 rounded-md bg-[#FB641B] hover:bg-[#e55812] text-white text-sm font-bold transition shadow-xs whitespace-nowrap"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
