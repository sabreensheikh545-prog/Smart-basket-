import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Category,
  DeliverySettings,
  Order,
  Product,
  ProductQuestion,
  ProductReview,
  PromoCode,
  User,
  formatINR,
  getDiscountPercent,
  getEffectiveMrp,
  getPincodeDeliveryEstimate,
  getProductGalleryImages,
} from '../types';

interface Props {
  product: Product;
  allProducts: Product[];
  categories: Category[];
  isWishlisted: boolean;
  isInCart: boolean;
  isSelectedVariantInCart?: (selectedVariant?: string) => boolean;
  deliveryPincode: string;
  onChangePincode: (pincode: string) => void;
  deliverySettings: DeliverySettings;
  promoCodes: PromoCode[];
  verifiedReviews: ProductReview[];
  avgRating: number;
  reviewCount: number;
  questions: ProductQuestion[];
  canAnswerQuestions: boolean;
  answerRole: 'Admin' | 'Seller';
  currentUser: User | null;
  deliveredOrderForReview: Order | null;
  productReviewStats: Map<number, { avg: number; count: number; items: ProductReview[] }>;
  onBack: () => void;
  onToggleWishlist: (productId: number) => void;
  onShareProduct: (product: Product) => void;
  onAddToCart: (product: Product, qty: number, buyNow: boolean, selectedVariant?: string) => void;
  onGoToCart: () => void;
  onOpenProduct: (product: Product) => void;
  onOpenReviewModal: (opts: { product: Product; order: Order; existing?: ProductReview | null }) => void;
  onSubmitQuestion: (questionText: string) => Promise<void>;
  onAnswerQuestion: (question: ProductQuestion, answerText: string) => Promise<void>;
}

export const ProductDetailsView: React.FC<Props> = ({
  product,
  allProducts,
  categories,
  isWishlisted,
  isInCart,
  isSelectedVariantInCart,
  deliveryPincode,
  onChangePincode,
  deliverySettings,
  promoCodes,
  verifiedReviews,
  avgRating,
  reviewCount,
  questions,
  canAnswerQuestions,
  answerRole,
  currentUser,
  deliveredOrderForReview,
  productReviewStats,
  onBack,
  onToggleWishlist,
  onShareProduct,
  onAddToCart,
  onGoToCart,
  onOpenProduct,
  onOpenReviewModal,
  onSubmitQuestion,
  onAnswerQuestion,
}) => {
  const [activeSlideIdx, setActiveSlideIdx] = useState(0);
  const [qty, setQty] = useState(1);
  const [editingPincode, setEditingPincode] = useState(false);
  const [pincodeDraft, setPincodeDraft] = useState(deliveryPincode);
  const [selectedVariantMap, setSelectedVariantMap] = useState<Record<string, string>>({});
  const [questionDraft, setQuestionDraft] = useState('');
  const [questionSubmitting, setQuestionSubmitting] = useState(false);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [replyOpenId, setReplyOpenId] = useState<string | null>(null);
  const [replySubmittingId, setReplySubmittingId] = useState<string | null>(null);
  const touchStartXRef = useRef<number | null>(null);
  const touchDeltaXRef = useRef<number>(0);

  const variantGroups = useMemo(() => product.variants || [], [product.variants]);

  useEffect(() => {
    setActiveSlideIdx(0);
    setQty(1);
    const initial: Record<string, string> = {};
    (product.variants || []).forEach((grp) => {
      if (grp.options.length > 0) {
        initial[grp.label] = grp.options[0];
      }
    });
    setSelectedVariantMap(initial);
  }, [product.id, product.variants]);

  const selectedVariantSummary = useMemo(() => {
    if (variantGroups.length === 0) return undefined;
    const parts = variantGroups
      .map((grp) => {
        const chosen = selectedVariantMap[grp.label] || grp.options[0];
        return chosen ? `${grp.label}: ${chosen}` : '';
      })
      .filter(Boolean);
    return parts.length > 0 ? parts.join(' · ') : undefined;
  }, [variantGroups, selectedVariantMap]);

  const currentSelectionInCart = isSelectedVariantInCart
    ? isSelectedVariantInCart(selectedVariantSummary)
    : isInCart;

  // Build up to 4 gallery images: product.image + product.images + same-category fallback angles if < 3
  const galleryImages = useMemo(() => {
    const sameCategoryImages = allProducts
      .filter((p) => p.id !== product.id && p.cat_id === product.cat_id)
      .map((p) => p.image);
    const otherImages = allProducts
      .filter((p) => p.id !== product.id && p.cat_id !== product.cat_id)
      .map((p) => p.image);
    return getProductGalleryImages(product, [...sameCategoryImages, ...otherImages]);
  }, [product, allProducts]);

  const safeSlideIdx = activeSlideIdx >= galleryImages.length ? 0 : activeSlideIdx;

  const detailMrp = getEffectiveMrp(product.price, product.mrp);
  const detailDiscount = getDiscountPercent(product.price, detailMrp);
  const detailCategory = categories.find((c) => c.id === product.cat_id)?.name || 'Smart Basket';
  const detailBrand = product.sellerName || product.name.split(' ').slice(0, 2).join(' ');
  const highlightBullets = useMemo(() => {
    const explicit = (product.highlights || []).map((h) => h.trim()).filter(Boolean);
    if (explicit.length > 0) return explicit;
    const fromDesc = product.description
      .split(/[.,;•\n]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 6);
    const structured = [
      ...fromDesc,
      `Category: ${detailCategory}`,
      `Sold by: ${product.sellerName || 'Smart Basket Assured Retail'}`,
    ];
    return Array.from(new Set(structured)).slice(0, 6);
  }, [product.highlights, product.description, product.sellerName, detailCategory]);

  const currentUid = currentUser ? currentUser.uid || String(currentUser.id) : '';
  const myExistingReview = currentUid
    ? verifiedReviews.find((r) => r.userId === currentUid) || null
    : null;

  const pincodeEstimate = useMemo(
    () => getPincodeDeliveryEstimate(deliveryPincode),
    [deliveryPincode]
  );

  const isFreeDelivery = product.price >= Number(deliverySettings.freeDeliveryThreshold || 499);
  const deliveryFeeLabel = isFreeDelivery
    ? 'Free'
    : formatINR(Number(deliverySettings.deliveryCharge || 40));

  // Build authentic inline Available Offers list (Razorpay UPI offer + real active Firestore promos + Free delivery threshold)
  const availableOffers = useMemo(() => {
    const rows: { id: string; label: string; text: string }[] = [
      {
        id: 'razorpay-upi',
        label: 'Bank Offer',
        text: 'Flat ₹50 off on Razorpay UPI orders above ₹499',
      },
    ];
    const activePromos = promoCodes.filter((p) => p.active).slice(0, 2);
    activePromos.forEach((promo) => {
      const valueText =
        promo.discountType === 'percent'
          ? `${promo.discountValue}% off${promo.maxDiscount ? ` (up to ${formatINR(promo.maxDiscount)})` : ''}`
          : `Flat ${formatINR(promo.discountValue)} off`;
      rows.push({
        id: promo.id || promo.code,
        label: `Code ${promo.code}`,
        text: `${valueText} on orders above ${formatINR(promo.minOrderValue)}`,
      });
    });
    rows.push({
      id: 'free-delivery-rule',
      label: 'Delivery Offer',
      text: `Free doorstep delivery on orders above ${formatINR(
        deliverySettings.freeDeliveryThreshold || 499
      )} · Cash on Delivery available`,
    });
    return rows;
  }, [promoCodes, deliverySettings.freeDeliveryThreshold]);

  // Similar / Recommended products prioritized from the same category
  const similarProducts = useMemo(() => {
    const sameCat = allProducts.filter((p) => p.id !== product.id && p.cat_id === product.cat_id);
    if (sameCat.length >= 6) return sameCat.slice(0, 8);
    const sameIds = new Set(sameCat.map((p) => p.id));
    const others = allProducts.filter((p) => p.id !== product.id && !sameIds.has(p.id));
    return [...sameCat, ...others].slice(0, 8);
  }, [allProducts, product.id, product.cat_id]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0]?.clientX ?? null;
    touchDeltaXRef.current = 0;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null) return;
    const currentX = e.touches[0]?.clientX ?? touchStartXRef.current;
    touchDeltaXRef.current = currentX - touchStartXRef.current;
  };

  const handleTouchEnd = () => {
    if (touchStartXRef.current === null) return;
    const delta = touchDeltaXRef.current;
    touchStartXRef.current = null;
    touchDeltaXRef.current = 0;
    if (Math.abs(delta) < 36 || galleryImages.length <= 1) return;
    if (delta < 0) {
      setActiveSlideIdx((prev) => (prev + 1) % galleryImages.length);
    } else {
      setActiveSlideIdx((prev) => (prev === 0 ? galleryImages.length - 1 : prev - 1));
    }
  };

  const handlePincodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = pincodeDraft.replace(/\D/g, '').slice(0, 6);
    if (clean.length === 6) {
      onChangePincode(clean);
      setEditingPincode(false);
    }
  };

  const handlePrimaryLeftAction = () => {
    if (product.stock <= 0) return;
    if (currentSelectionInCart) {
      onGoToCart();
    } else {
      onAddToCart(product, qty, false, selectedVariantSummary);
    }
  };

  const handleQuestionFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = questionDraft.trim();
    if (!trimmed || questionSubmitting) return;
    setQuestionSubmitting(true);
    try {
      await onSubmitQuestion(trimmed);
      setQuestionDraft('');
    } finally {
      setQuestionSubmitting(false);
    }
  };

  const handleAnswerFormSubmit = async (q: ProductQuestion) => {
    const text = (replyDrafts[q.id] || '').trim();
    if (!text || replySubmittingId) return;
    setReplySubmittingId(q.id);
    try {
      await onAnswerQuestion(q, text);
      setReplyDrafts((prev) => ({ ...prev, [q.id]: '' }));
      setReplyOpenId(null);
    } finally {
      setReplySubmittingId(null);
    }
  };

  return (
    <div className="bg-[#F1F3F6] min-h-screen pb-16 md:pb-10 overflow-x-hidden">
      <main className="max-w-6xl mx-auto px-0 sm:px-4 py-0 sm:py-4 space-y-2.5 sm:space-y-4">
        {/* Clean Breadcrumb Back Row */}
        <div className="bg-white sm:bg-transparent px-3 py-2.5 sm:px-0 sm:py-0 flex items-center justify-between border-b sm:border-b-0 border-slate-200/80">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 text-xs font-bold text-[#2874F0] hover:underline"
          >
            <i className="fa-solid fa-arrow-left"></i>
            <span>Back to Products</span>
          </button>
          <span className="text-[11px] font-semibold text-slate-500 truncate max-w-[55%]">
            {detailCategory} / {detailBrand}
          </span>
        </div>

        <div className="grid md:grid-cols-12 gap-3 sm:gap-5 items-start">
          {/* Left Column: Authentic Flipkart Swipeable Multi-Image Gallery (up to 4 images) */}
          <div className="md:col-span-5 bg-white sm:rounded-xl border-b sm:border border-slate-200/80 overflow-hidden md:sticky md:top-20">
            <div
              className="relative aspect-square bg-white overflow-hidden select-none"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <div
                className="flex h-full transition-transform duration-300 ease-out"
                style={{ transform: `translateX(-${safeSlideIdx * 100}%)` }}
              >
                {galleryImages.map((imgUrl, idx) => (
                  <div key={`${imgUrl}-${idx}`} className="w-full h-full shrink-0 p-4 sm:p-6 bg-slate-50/40">
                    <img
                      src={imgUrl}
                      alt={`${product.name} — view ${idx + 1}`}
                      referrerPolicy="no-referrer"
                      className={`w-full h-full object-contain sm:object-cover rounded-lg ${
                        product.stock <= 0 ? 'opacity-60 grayscale-[30%]' : ''
                      }`}
                    />
                  </div>
                ))}
              </div>

              {product.stock <= 0 && (
                <span className="absolute top-3 left-3 z-10 px-2.5 py-1 rounded bg-rose-600 text-white text-[11px] font-extrabold uppercase tracking-wide">
                  Out of Stock
                </span>
              )}

              {/* Clean Top-Right Wishlist & Share Controls */}
              <div className="absolute top-3 right-3 flex flex-col gap-2 z-10">
                <button
                  type="button"
                  onClick={() => onToggleWishlist(product.id)}
                  aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
                  className={`w-9 h-9 rounded-full bg-white border border-slate-200 flex items-center justify-center transition ${
                    isWishlisted ? 'text-[#E53935]' : 'text-slate-600 hover:text-[#E53935]'
                  }`}
                >
                  <i className={`${isWishlisted ? 'fa-solid' : 'fa-regular'} fa-heart text-sm`}></i>
                </button>
                <button
                  type="button"
                  onClick={() => onShareProduct(product)}
                  aria-label="Share product"
                  className="w-9 h-9 rounded-full bg-white border border-slate-200 text-slate-600 hover:text-[#2874F0] flex items-center justify-center transition"
                >
                  <i className="fa-solid fa-share-nodes text-sm"></i>
                </button>
              </div>

              {/* Subtle Desktop Arrow Controls */}
              {galleryImages.length > 1 && (
                <>
                  <button
                    type="button"
                    aria-label="Previous image"
                    onClick={() =>
                      setActiveSlideIdx((i) => (i === 0 ? galleryImages.length - 1 : i - 1))
                    }
                    className="hidden sm:flex absolute left-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 border border-slate-200 text-slate-700 items-center justify-center hover:bg-white transition"
                  >
                    <i className="fa-solid fa-chevron-left text-xs"></i>
                  </button>
                  <button
                    type="button"
                    aria-label="Next image"
                    onClick={() => setActiveSlideIdx((i) => (i + 1) % galleryImages.length)}
                    className="hidden sm:flex absolute right-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 border border-slate-200 text-slate-700 items-center justify-center hover:bg-white transition"
                  >
                    <i className="fa-solid fa-chevron-right text-xs"></i>
                  </button>
                </>
              )}
            </div>

            {/* Clean Page Indicator Dots (• • •) */}
            {galleryImages.length > 1 && (
              <div className="pt-2 pb-1 flex items-center justify-center gap-1.5 bg-white">
                {galleryImages.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    aria-label={`View image ${idx + 1}`}
                    onClick={() => setActiveSlideIdx(idx)}
                    className={`h-1.5 rounded-full transition-all ${
                      safeSlideIdx === idx ? 'w-4 bg-[#2874F0]' : 'w-1.5 bg-slate-300'
                    }`}
                  />
                ))}
              </div>
            )}

            {/* Thumbnail Switcher Strip (up to 4 images) */}
            <div className="px-3 py-2.5 flex items-center justify-center gap-2 border-t border-slate-100 bg-white">
              {galleryImages.map((img, idx) => (
                <button
                  key={`${img}-thumb-${idx}`}
                  type="button"
                  onClick={() => setActiveSlideIdx(idx)}
                  aria-label={`Select photo ${idx + 1}`}
                  className={`w-13 h-13 rounded-md overflow-hidden border-2 transition shrink-0 ${
                    safeSlideIdx === idx
                      ? 'border-[#2874F0]'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <img
                    src={img}
                    alt={`Thumbnail ${idx + 1}`}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Right Column: Title, Price, Inline Offers, Deliver to Pincode, Highlights & Reviews */}
          <div className="md:col-span-7 space-y-2.5 sm:space-y-3.5">
            {/* Core Purchase Module: Brand, Title, Rating, Price, Available Offers & Deliver to Pincode */}
            <section className="bg-white sm:rounded-xl border-y sm:border border-slate-200/80 p-4 sm:p-5 space-y-3">
              {/* Quiet Unboxed Metadata Line */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                <span className="font-semibold text-slate-700">{detailBrand}</span>
                <span aria-hidden="true">·</span>
                <span>{detailCategory}</span>
                <span aria-hidden="true">·</span>
                {product.stock <= 0 ? (
                  <span className="font-bold text-rose-600">Out of Stock</span>
                ) : product.stock <= 5 ? (
                  <span className="font-bold text-rose-600">
                    Only {product.stock} left in stock!
                  </span>
                ) : (
                  <span className="font-semibold text-[#2E7D32]">In Stock</span>
                )}
              </div>

              {/* Product Title */}
              <h1 className="text-base sm:text-xl font-bold text-slate-900 leading-snug">
                {product.name}
              </h1>

              {/* Real Verified Rating Summary */}
              <div className="flex items-center gap-2">
                {reviewCount > 0 ? (
                  <>
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm bg-[#388E3C] text-white text-xs font-bold tabular-nums leading-none">
                      <span>{avgRating.toFixed(1)}</span>
                      <i className="fa-solid fa-star text-[9px]"></i>
                    </span>
                    <span className="text-xs font-medium text-slate-500 tabular-nums">
                      {reviewCount.toLocaleString('en-IN')} Verified{' '}
                      {reviewCount === 1 ? 'Rating' : 'Ratings'}
                    </span>
                  </>
                ) : (
                  <span className="text-xs text-slate-400">No verified ratings yet</span>
                )}
              </div>

              {/* Price Row */}
              <div className="pt-0.5 space-y-0.5">
                <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                  <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-mono tabular-nums">
                    {formatINR(product.price)}
                  </span>
                  {detailMrp > product.price && (
                    <span className="text-sm text-slate-400 line-through font-mono tabular-nums">
                      {formatINR(detailMrp)}
                    </span>
                  )}
                  {detailDiscount > 0 && (
                    <span className="text-sm font-extrabold text-[#2E7D32] tabular-nums">
                      {detailDiscount}% off
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500">Inclusive of all taxes</p>
              </div>

              {/* Interactive Product Variants Selector (Size / Weight / Color) */}
              {variantGroups.length > 0 && (
                <div className="pt-3 border-t border-slate-100 space-y-3">
                  {variantGroups.map((group) => {
                    const activeOpt = selectedVariantMap[group.label] || group.options[0] || '';
                    return (
                      <div key={group.label} className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="font-bold text-slate-600">
                            Select {group.label}:{' '}
                            <strong className="text-slate-900">{activeOpt}</strong>
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {group.options.map((opt) => {
                            const selected = activeOpt === opt;
                            return (
                              <button
                                key={`${group.label}-${opt}`}
                                type="button"
                                onClick={() =>
                                  setSelectedVariantMap((prev) => ({
                                    ...prev,
                                    [group.label]: opt,
                                  }))
                                }
                                className={`min-w-[48px] px-3 py-1.5 rounded-md text-xs font-bold border transition ${
                                  selected
                                    ? 'border-[#2874F0] bg-blue-50 text-[#2874F0] ring-1 ring-[#2874F0]'
                                    : 'border-slate-300 bg-white text-slate-800 hover:border-slate-400'
                                }`}
                              >
                                {opt}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Inline Available Offers (Clean left-aligned rows with small green tag icons) */}
              <div className="pt-3 border-t border-slate-100 space-y-2">
                <h2 className="text-xs sm:text-sm font-extrabold text-slate-900">
                  Available Offers
                </h2>
                <ul className="space-y-2">
                  {availableOffers.map((offer) => (
                    <li key={offer.id} className="flex items-start gap-2.5 text-xs text-slate-700 leading-relaxed">
                      <i className="fa-solid fa-tag text-[#2E7D32] text-xs mt-0.5 shrink-0"></i>
                      <span>
                        <strong className="font-bold text-slate-900">{offer.label}:</strong>{' '}
                        {offer.text}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Inline "Deliver to [Pincode]" Row directly below Offers */}
              <div className="pt-3 border-t border-slate-100 space-y-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <i className="fa-solid fa-location-dot text-slate-500 text-sm mt-0.5 shrink-0"></i>
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-xs text-slate-600">
                        Deliver to{' '}
                        <strong className="font-mono font-extrabold text-slate-900 tabular-nums">
                          {deliveryPincode}
                        </strong>
                      </p>
                      <p className="text-xs sm:text-sm flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                        <span
                          className={`font-extrabold ${
                            pincodeEstimate.isExpress
                              ? 'text-[#2E7D32]'
                              : pincodeEstimate.isValid
                              ? 'text-slate-900'
                              : 'text-rose-600'
                          }`}
                        >
                          {pincodeEstimate.headline}
                        </span>
                        {pincodeEstimate.isValid && (
                          <>
                            <span className="text-slate-300">|</span>
                            <span
                              className={`font-bold ${
                                isFreeDelivery ? 'text-[#2E7D32]' : 'text-slate-700'
                              }`}
                            >
                              {deliveryFeeLabel}
                            </span>
                          </>
                        )}
                      </p>
                      <p className="text-[11px] text-slate-500">{pincodeEstimate.subtext}</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setPincodeDraft(deliveryPincode);
                      setEditingPincode((v) => !v);
                    }}
                    className="px-3 py-1.5 rounded-md border border-slate-200 text-xs font-bold text-[#2874F0] hover:bg-blue-50 shrink-0 whitespace-nowrap"
                  >
                    {editingPincode ? 'Cancel' : 'Change'}
                  </button>
                </div>

                {editingPincode && (
                  <form onSubmit={handlePincodeSubmit} className="flex items-center gap-2 pt-0.5">
                    <input
                      type="tel"
                      inputMode="numeric"
                      maxLength={6}
                      value={pincodeDraft}
                      onChange={(e) =>
                        setPincodeDraft(e.target.value.replace(/\D/g, '').slice(0, 6))
                      }
                      placeholder="Enter 6-digit Indian pincode (e.g. 110039)"
                      className="flex-1 h-9 px-3 rounded-md bg-slate-50 border border-slate-300 text-xs sm:text-sm font-mono focus:bg-white focus:border-[#2874F0] focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={pincodeDraft.replace(/\D/g, '').length !== 6}
                      className="px-4 h-9 rounded-md bg-[#2874F0] text-white text-xs font-bold disabled:opacity-50 whitespace-nowrap"
                    >
                      Check
                    </button>
                  </form>
                )}

                {/* Authentic Flipkart-Style Trust Policy Badges */}
                <div className="pt-3 border-t border-slate-100 grid grid-cols-3 gap-2">
                  <div className="rounded-lg bg-slate-50 border border-slate-200/80 px-2 py-2.5 text-center flex flex-col items-center gap-1">
                    <span className="w-7 h-7 rounded-full bg-blue-50 text-[#2874F0] flex items-center justify-center">
                      <i className="fa-solid fa-rotate-left text-xs"></i>
                    </span>
                    <span className="text-[11px] font-bold text-slate-800 leading-tight">
                      7-Day Replacement
                    </span>
                  </div>
                  <div className="rounded-lg bg-slate-50 border border-slate-200/80 px-2 py-2.5 text-center flex flex-col items-center gap-1">
                    <span className="w-7 h-7 rounded-full bg-emerald-50 text-[#2E7D32] flex items-center justify-center">
                      <i className="fa-solid fa-indian-rupee-sign text-xs"></i>
                    </span>
                    <span className="text-[11px] font-bold text-slate-800 leading-tight">
                      Cash on Delivery Available
                    </span>
                  </div>
                  <div className="rounded-lg bg-slate-50 border border-slate-200/80 px-2 py-2.5 text-center flex flex-col items-center gap-1">
                    <span className="w-7 h-7 rounded-full bg-amber-50 text-[#FB641B] flex items-center justify-center">
                      <i className="fa-solid fa-shield-halved text-xs"></i>
                    </span>
                    <span className="text-[11px] font-bold text-slate-800 leading-tight">
                      Smart Basket Assured
                    </span>
                  </div>
                </div>
              </div>

              {/* Quantity & Desktop CTA Buttons */}
              <div className="pt-3 border-t border-slate-100 space-y-3">
                {product.stock > 0 ? (
                  <div className="flex items-center justify-between">
                    <span className="text-xs sm:text-sm font-bold text-slate-700">Quantity</span>
                    <div className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50">
                      <button
                        type="button"
                        aria-label="Decrease quantity"
                        onClick={() => setQty((q) => Math.max(1, q - 1))}
                        className="w-9 h-8 flex items-center justify-center text-slate-700 hover:bg-slate-200/70 rounded-l-md"
                      >
                        <i className="fa-solid fa-minus text-[11px]"></i>
                      </button>
                      <span className="w-9 text-center text-sm font-extrabold tabular-nums">
                        {qty}
                      </span>
                      <button
                        type="button"
                        aria-label="Increase quantity"
                        onClick={() => setQty((q) => Math.min(product.stock, q + 1))}
                        className="w-9 h-8 flex items-center justify-center text-slate-700 hover:bg-slate-200/70 rounded-r-md"
                      >
                        <i className="fa-solid fa-plus text-[11px]"></i>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700">
                    Currently Out of Stock — unavailable for purchase until restocked.
                  </div>
                )}

                {/* Desktop Inline Action Buttons (Synced with Mobile Fixed Bottom Bar) */}
                <div className="hidden md:grid grid-cols-2 gap-3 pt-1">
                  <button
                    type="button"
                    disabled={product.stock <= 0}
                    onClick={handlePrimaryLeftAction}
                    className="h-12 rounded-md bg-white border border-slate-300 hover:bg-slate-50 text-slate-900 text-sm font-extrabold disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
                  >
                    <i className="fa-solid fa-cart-shopping text-xs"></i>
                    <span>
                      {product.stock <= 0
                        ? 'Out of Stock'
                        : currentSelectionInCart
                        ? 'Go to Cart'
                        : 'Add to Cart'}
                    </span>
                  </button>
                  <button
                    type="button"
                    disabled={product.stock <= 0}
                    onClick={() => onAddToCart(product, qty, true, selectedVariantSummary)}
                    className="h-12 rounded-md bg-[#FFC200] hover:bg-[#f2b800] text-slate-950 text-sm font-extrabold disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
                  >
                    <i className="fa-solid fa-bolt text-xs"></i>
                    <span>Buy Now</span>
                  </button>
                </div>
              </div>
            </section>

            {/* Product Highlights & Description */}
            <section className="bg-white sm:rounded-xl border-y sm:border border-slate-200/80 p-4 sm:p-5 space-y-3">
              <h2 className="text-sm sm:text-base font-extrabold text-slate-900">
                Product Highlights
              </h2>
              {highlightBullets.length > 0 && (
                <ul className="space-y-1.5">
                  {highlightBullets.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-xs sm:text-sm text-slate-700">
                      <span className="text-[#2874F0] font-bold mt-0.5">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="pt-2.5 border-t border-slate-100">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Description
                </p>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  {product.description}
                </p>
              </div>
            </section>

            {/* Verified Purchase Customer Reviews Only */}
            <section className="bg-white sm:rounded-xl border-y sm:border border-slate-200/80 p-4 sm:p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm sm:text-base font-extrabold text-slate-900">
                    Ratings &amp; Reviews
                  </h2>
                  {reviewCount > 0 && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm bg-[#388E3C] text-white text-xs font-bold tabular-nums">
                      {avgRating.toFixed(1)}
                      <i className="fa-solid fa-star text-[9px]"></i>
                    </span>
                  )}
                </div>

                {deliveredOrderForReview ? (
                  <button
                    type="button"
                    onClick={() =>
                      onOpenReviewModal({
                        product,
                        order: deliveredOrderForReview,
                        existing: myExistingReview,
                      })
                    }
                    className="px-3 py-1.5 rounded-md bg-[#2874F0] hover:bg-[#1e60d5] text-white text-xs font-bold transition"
                  >
                    {myExistingReview ? 'Edit Your Review' : 'Write Verified Review'}
                  </button>
                ) : (
                  <span className="text-[11px] font-medium text-slate-400">
                    Verified buyers only (after delivery)
                  </span>
                )}
              </div>

              {verifiedReviews.length === 0 ? (
                <div className="py-4 px-3 rounded-lg bg-slate-50 border border-slate-100 text-center space-y-1">
                  <p className="text-xs font-bold text-slate-700">No verified reviews yet</p>
                  <p className="text-[11px] text-slate-500">
                    Ratings appear here once verified buyers receive their delivered order.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {verifiedReviews.map((rev) => (
                    <div key={rev.id} className="py-3 first:pt-0 last:pb-0 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-sm text-white text-[10px] font-bold tabular-nums ${
                            rev.rating >= 4
                              ? 'bg-[#388E3C]'
                              : rev.rating === 3
                              ? 'bg-amber-500'
                              : 'bg-rose-600'
                          }`}
                        >
                          {rev.rating} <i className="fa-solid fa-star text-[8px]"></i>
                        </span>
                        <span className="text-xs font-bold text-slate-900">{rev.title}</span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">{rev.comment}</p>
                      <p className="text-[11px] text-slate-400 flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-slate-600">{rev.userName}</span>
                        <span className="inline-flex items-center gap-1 text-[#2E7D32] font-semibold">
                          <i className="fa-solid fa-circle-check text-[10px]"></i>
                          <span>Verified Purchase</span>
                        </span>
                        <span>·</span>
                        <span>
                          {new Date(rev.created_at).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Questions & Answers Block (Directly below Reviews) */}
            <section className="bg-white sm:rounded-xl border-y sm:border border-slate-200/80 p-4 sm:p-5 space-y-3.5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm sm:text-base font-extrabold text-slate-900">
                    Questions &amp; Answers
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Ask about sizing, warranty, authenticity, or delivery
                  </p>
                </div>
                <span className="text-xs font-bold text-slate-500 tabular-nums">
                  {questions.length} {questions.length === 1 ? 'Q&A' : 'Q&As'}
                </span>
              </div>

              {/* Post a Question Form */}
              <form onSubmit={handleQuestionFormSubmit} className="flex items-center gap-2">
                <input
                  type="text"
                  value={questionDraft}
                  onChange={(e) => setQuestionDraft(e.target.value)}
                  maxLength={220}
                  placeholder="Have a question about this product? Ask Seller/Admin..."
                  className="flex-1 min-w-0 h-10 px-3 rounded-lg bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:border-[#2874F0] focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!questionDraft.trim() || questionSubmitting}
                  className="h-10 px-3.5 rounded-lg bg-[#2874F0] hover:bg-[#1e60d5] text-white text-xs font-extrabold disabled:opacity-50 shrink-0 whitespace-nowrap transition"
                >
                  {questionSubmitting ? 'Posting...' : 'Post Question'}
                </button>
              </form>

              {questions.length === 0 ? (
                <div className="py-4 px-3 rounded-lg bg-slate-50 border border-slate-100 text-center space-y-1">
                  <p className="text-xs font-bold text-slate-700">No questions yet</p>
                  <p className="text-[11px] text-slate-500">
                    Be the first to ask a question — verified sellers and Smart Basket Admin reply directly here.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {questions.map((q) => {
                    const isReplying = replyOpenId === q.id;
                    return (
                      <div key={q.id} className="py-3 first:pt-0 last:pb-0 space-y-1.5">
                        <p className="text-xs sm:text-sm font-bold text-slate-900">
                          <span className="text-slate-500 mr-1.5">Q:</span>
                          {q.question}
                        </p>
                        {q.answer ? (
                          <div className="pl-3 border-l-2 border-emerald-200 space-y-1">
                            <p className="text-xs text-slate-700 leading-relaxed">
                              <span className="font-extrabold text-[#2E7D32] mr-1.5">A:</span>
                              {q.answer}
                            </p>
                            <p className="text-[10px] text-slate-500 flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-slate-700">
                                {q.answeredBy || 'Smart Basket Team'}
                              </span>
                              <span className="inline-flex items-center gap-1 text-[#2874F0] font-bold">
                                <i className="fa-solid fa-circle-check text-[9px]"></i>
                                <span>Verified {q.answeredRole || 'Seller'}</span>
                              </span>
                            </p>
                          </div>
                        ) : (
                          <p className="text-[11px] text-slate-400 pl-3">
                            Awaiting reply from Seller / Admin...
                          </p>
                        )}

                        <div className="flex items-center justify-between gap-2 pt-0.5">
                          <span className="text-[10px] text-slate-400">
                            Asked by {q.userName} ·{' '}
                            {new Date(q.created_at).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </span>

                          {canAnswerQuestions && (
                            <button
                              type="button"
                              onClick={() => {
                                setReplyOpenId(isReplying ? null : q.id);
                                if (!isReplying && q.answer && !replyDrafts[q.id]) {
                                  setReplyDrafts((prev) => ({ ...prev, [q.id]: q.answer || '' }));
                                }
                              }}
                              className="text-[11px] font-bold text-[#2874F0] hover:underline"
                            >
                              {isReplying
                                ? 'Cancel'
                                : q.answer
                                ? `Edit ${answerRole} Reply`
                                : `Reply as ${answerRole}`}
                            </button>
                          )}
                        </div>

                        {canAnswerQuestions && isReplying && (
                          <div className="pt-2 flex items-center gap-2">
                            <input
                              type="text"
                              value={replyDrafts[q.id] || ''}
                              onChange={(e) =>
                                setReplyDrafts((prev) => ({ ...prev, [q.id]: e.target.value }))
                              }
                              placeholder={`Write official ${answerRole} reply...`}
                              className="flex-1 min-w-0 h-9 px-3 rounded-lg bg-slate-50 border border-slate-300 text-xs focus:bg-white focus:border-[#2874F0] focus:outline-none"
                            />
                            <button
                              type="button"
                              disabled={!(replyDrafts[q.id] || '').trim() || replySubmittingId === q.id}
                              onClick={() => handleAnswerFormSubmit(q)}
                              className="h-9 px-3 rounded-lg bg-[#2E7D32] hover:bg-emerald-800 text-white text-xs font-bold disabled:opacity-50 shrink-0"
                            >
                              {replySubmittingId === q.id ? 'Saving...' : 'Save Reply'}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        </div>

        {/* Bottom "Similar / Recommended Products" Horizontal Row from Same Category */}
        {similarProducts.length > 0 && (
          <section className="bg-white sm:rounded-xl border-y sm:border border-slate-200/80 p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm sm:text-base font-extrabold text-slate-900">
                  Similar &amp; Recommended Products
                </h2>
                <p className="text-[11px] text-slate-500">More from {detailCategory}</p>
              </div>
              <span className="text-[11px] font-semibold text-slate-400 tabular-nums">
                {similarProducts.length} items
              </span>
            </div>

            <div className="flex items-stretch gap-2.5 sm:gap-3 overflow-x-auto no-scrollbar pb-1">
              {similarProducts.map((sim) => {
                const simMrp = getEffectiveMrp(sim.price, sim.mrp);
                const simDiscount = getDiscountPercent(sim.price, simMrp);
                const simStats = productReviewStats.get(sim.id);
                const simOut = sim.stock <= 0;
                return (
                  <button
                    key={sim.docId || sim.id}
                    type="button"
                    onClick={() => onOpenProduct(sim)}
                    className="w-36 sm:w-44 shrink-0 rounded-lg border border-slate-200/80 bg-white hover:border-[#2874F0]/50 overflow-hidden text-left flex flex-col transition group"
                  >
                    <div className="relative aspect-square bg-slate-50 p-2 overflow-hidden">
                      <img
                        src={sim.image}
                        alt={sim.name}
                        referrerPolicy="no-referrer"
                        className={`w-full h-full object-cover rounded-md group-hover:scale-105 transition duration-200 ${
                          simOut ? 'opacity-50 grayscale' : ''
                        }`}
                      />
                      {simOut && (
                        <span className="absolute bottom-2 left-2 right-2 text-center py-0.5 rounded bg-slate-900/85 text-white text-[9px] font-bold">
                          Out of Stock
                        </span>
                      )}
                    </div>
                    <div className="p-2.5 flex-1 flex flex-col">
                      <p className="text-xs font-semibold text-slate-900 line-clamp-2 leading-snug group-hover:text-[#2874F0]">
                        {sim.name}
                      </p>
                      {simStats && simStats.count > 0 && (
                        <div className="mt-1 flex items-center gap-1">
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-sm bg-[#388E3C] text-white text-[10px] font-bold leading-none tabular-nums">
                            {simStats.avg.toFixed(1)}
                            <i className="fa-solid fa-star text-[8px]"></i>
                          </span>
                          <span className="text-[10px] text-slate-400 tabular-nums">
                            ({simStats.count})
                          </span>
                        </div>
                      )}
                      <div className="mt-auto pt-1.5 flex flex-wrap items-baseline gap-x-1.5">
                        <span className="text-xs sm:text-sm font-extrabold text-slate-900 font-mono tabular-nums">
                          {formatINR(sim.price)}
                        </span>
                        {simDiscount > 0 && (
                          <span className="text-[10px] font-bold text-[#2E7D32] tabular-nums">
                            {simDiscount}% off
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}
      </main>

      {/* Authentic Flipkart Fixed Full-Width Bottom Action Bar (Flush Two-Button Split) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 shadow-[0_-2px_10px_rgba(15,23,42,0.08)]">
        <div className="grid grid-cols-2 h-13">
          <button
            type="button"
            disabled={product.stock <= 0}
            onClick={handlePrimaryLeftAction}
            className="h-full bg-white text-slate-900 text-sm font-extrabold border-r border-slate-200 active:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
          >
            <i className="fa-solid fa-cart-shopping text-xs"></i>
            <span>
              {product.stock <= 0
                ? 'Out of Stock'
                : currentSelectionInCart
                ? 'Go to Cart'
                : 'Add to Cart'}
            </span>
          </button>
          <button
            type="button"
            disabled={product.stock <= 0}
            onClick={() => onAddToCart(product, qty, true, selectedVariantSummary)}
            className="h-full bg-[#FFC200] hover:bg-[#f2b800] text-slate-950 text-sm font-extrabold active:brightness-95 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
          >
            <i className="fa-solid fa-bolt text-xs"></i>
            <span>Buy Now</span>
          </button>
        </div>
      </div>
    </div>
  );
};
