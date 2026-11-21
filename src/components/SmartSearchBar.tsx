import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  addRecentSearchLocal,
  clearRecentSearchesLocal,
  getRecentSearchesLocal,
  removeRecentSearchLocal,
} from '../store/localStore';
import { Category, Product, formatINR } from '../types';

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSubmitSearch: (term: string) => void;
  onSelectProduct: (product: Product) => void;
  onSelectCategory: (category: Category) => void;
  products: Product[];
  categories: Category[];
  variant?: 'desktop' | 'mobile';
  onNotify?: (text: string, type?: 'info' | 'success' | 'error') => void;
}

interface BrowserSpeechRecognition {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((ev: { error?: string }) => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionCtor = new () => BrowserSpeechRecognition;

export const SmartSearchBar: React.FC<Props> = ({
  value,
  onChange,
  onSubmitSearch,
  onSelectProduct,
  onSelectCategory,
  products,
  categories,
  variant = 'desktop',
  onNotify,
}) => {
  const [open, setOpen] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => getRecentSearchesLocal());
  const [isListening, setIsListening] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEsc);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  const cleanQuery = value.trim().toLowerCase();

  const matchingCategories = useMemo(() => {
    if (!cleanQuery) return categories.slice(0, 6);
    return categories.filter((c) => c.name.toLowerCase().includes(cleanQuery)).slice(0, 4);
  }, [categories, cleanQuery]);

  const matchingProducts = useMemo(() => {
    if (!cleanQuery) return [];
    return products
      .filter((p) => {
        const catName = categories.find((c) => c.id === p.cat_id)?.name?.toLowerCase() || '';
        return (
          p.name.toLowerCase().includes(cleanQuery) ||
          p.description.toLowerCase().includes(cleanQuery) ||
          catName.includes(cleanQuery)
        );
      })
      .slice(0, 6);
  }, [products, categories, cleanQuery]);

  const commitSearch = (term: string) => {
    const clean = term.trim();
    if (clean.length >= 2) {
      setRecentSearches(addRecentSearchLocal(clean));
    }
    onChange(clean);
    onSubmitSearch(clean);
    setOpen(false);
  };

  const handleVoiceSearch = () => {
    if (isListening && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      setIsListening(false);
      return;
    }

    const win = window as unknown as {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRec) {
      onNotify?.('Voice search is not supported in this browser. Please type your search.', 'info');
      return;
    }

    try {
      const recognition = new SpeechRec();
      recognition.lang = 'en-IN';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      recognition.continuous = false;

      recognition.onresult = (event) => {
        const transcript = event.results?.[0]?.[0]?.transcript?.trim() || '';
        if (transcript) {
          setRecentSearches(addRecentSearchLocal(transcript));
          onChange(transcript);
          onSubmitSearch(transcript);
          setOpen(false);
          onNotify?.(`Searching for "${transcript}"`, 'success');
        }
      };

      recognition.onerror = (ev) => {
        setIsListening(false);
        if (ev?.error === 'not-allowed') {
          onNotify?.('Microphone permission denied. Allow mic access to use voice search.', 'error');
        } else if (ev?.error !== 'aborted' && ev?.error !== 'no-speech') {
          onNotify?.('Could not capture voice. Please try speaking again.', 'info');
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      setIsListening(true);
      setOpen(false);
      recognition.start();
    } catch {
      setIsListening(false);
      onNotify?.('Unable to start voice search right now.', 'error');
    }
  };

  const isMobile = variant === 'mobile';

  return (
    <div ref={containerRef} className="relative w-full">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          commitSearch(value);
        }}
        className="relative w-full flex items-center"
      >
        {isMobile && (
          <i className="fa-solid fa-magnifying-glass text-slate-400 text-xs absolute left-3.5 pointer-events-none"></i>
        )}
        <input
          type="text"
          value={value}
          onFocus={() => {
            setRecentSearches(getRecentSearchesLocal());
            setOpen(true);
          }}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          placeholder={
            isListening
              ? 'Listening... speak product name'
              : 'Search for products, brands and more'
          }
          className={`w-full h-9 rounded-md bg-white text-sm text-slate-900 placeholder-slate-400 focus:outline-none shadow-xs ${
            isMobile ? 'pl-9 pr-[72px]' : 'pl-4 pr-[76px]'
          } ${isListening ? 'ring-2 ring-[#FFE500]' : ''}`}
        />

        <div className="absolute right-1.5 flex items-center gap-0.5">
          {value && (
            <button
              type="button"
              onClick={() => {
                onChange('');
                setOpen(true);
              }}
              aria-label="Clear search"
              className="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
            >
              <i className="fa-solid fa-xmark text-xs"></i>
            </button>
          )}
          <button
            type="button"
            onClick={handleVoiceSearch}
            aria-label={isListening ? 'Stop voice search' : 'Voice search'}
            title={isListening ? 'Listening... tap to stop' : 'Voice Search (Web Speech)'}
            className={`w-7 h-7 rounded-md flex items-center justify-center transition ${
              isListening
                ? 'bg-rose-600 text-white'
                : 'text-[#2874F0] hover:bg-blue-50'
            }`}
          >
            <i className={`fa-solid ${isListening ? 'fa-microphone-lines' : 'fa-microphone'} text-xs`}></i>
          </button>
          {!isMobile && (
            <button
              type="submit"
              aria-label="Search products"
              className="w-7 h-7 rounded-md flex items-center justify-center text-[#2874F0] hover:bg-blue-50 transition"
            >
              <i className="fa-solid fa-magnifying-glass text-xs"></i>
            </button>
          )}
        </div>
      </form>

      {/* Live Autocomplete Dropdown */}
      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden text-slate-900 max-h-[70vh] overflow-y-auto">
          {/* Voice Listening Banner */}
          {isListening && (
            <div className="px-3.5 py-2.5 bg-rose-50 border-b border-rose-100 flex items-center justify-between text-xs text-rose-700 font-bold">
              <span className="flex items-center gap-2">
                <i className="fa-solid fa-microphone-lines"></i>
                <span>Listening... speak a product or category</span>
              </span>
              <button
                type="button"
                onClick={handleVoiceSearch}
                className="text-[11px] font-extrabold underline"
              >
                Stop
              </button>
            </div>
          )}

          {/* Recent Search Chips */}
          {recentSearches.length > 0 && (
            <div className="px-3.5 py-3 border-b border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-slate-500">Recent Searches</span>
                <button
                  type="button"
                  onClick={() => {
                    clearRecentSearchesLocal();
                    setRecentSearches([]);
                  }}
                  className="text-[11px] font-bold text-[#2874F0] hover:underline"
                >
                  Clear All
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {recentSearches.map((term) => (
                  <div
                    key={term}
                    className="inline-flex items-center rounded-md bg-slate-100 border border-slate-200/80 text-xs text-slate-700 overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => commitSearch(term)}
                      className="px-2.5 py-1 hover:bg-blue-50 hover:text-[#2874F0] font-semibold inline-flex items-center gap-1.5 transition"
                    >
                      <i className="fa-solid fa-clock-rotate-left text-[10px] text-slate-400"></i>
                      <span className="max-w-[140px] truncate">{term}</span>
                    </button>
                    <button
                      type="button"
                      aria-label={`Remove ${term} from recent searches`}
                      onClick={() => setRecentSearches(removeRecentSearchLocal(term))}
                      className="px-1.5 py-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                    >
                      <i className="fa-solid fa-xmark text-[10px]"></i>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Matching Products */}
          {cleanQuery.length > 0 && (
            <div className="py-1.5">
              {matchingProducts.length > 0 ? (
                <>
                  <p className="px-3.5 py-1 text-[11px] font-bold text-slate-400">
                    Matching Products
                  </p>
                  <div className="divide-y divide-slate-100">
                    {matchingProducts.map((prod) => {
                      const catName =
                        categories.find((c) => c.id === prod.cat_id)?.name || 'Smart Basket';
                      return (
                        <button
                          key={prod.docId || prod.id}
                          type="button"
                          onClick={() => {
                            setRecentSearches(addRecentSearchLocal(prod.name.split(' ').slice(0, 3).join(' ')));
                            setOpen(false);
                            onSelectProduct(prod);
                          }}
                          className="w-full px-3.5 py-2.5 flex items-center gap-3 text-left hover:bg-blue-50/50 transition"
                        >
                          <img
                            src={prod.image}
                            alt={prod.name}
                            referrerPolicy="no-referrer"
                            className="w-10 h-10 rounded-md object-cover bg-slate-100 border border-slate-200/70 shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-slate-900 truncate">
                              {prod.name}
                            </p>
                            <p className="text-[11px] text-slate-500 truncate">
                              in {catName}
                            </p>
                          </div>
                          <span className="text-xs font-extrabold font-mono text-slate-900 tabular-nums shrink-0">
                            {formatINR(prod.price)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={() => commitSearch(value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 hover:bg-blue-50 text-[#2874F0] text-xs font-bold text-center border-t border-slate-100 transition"
                  >
                    View all results for &ldquo;{value.trim()}&rdquo;
                  </button>
                </>
              ) : (
                <div className="px-4 py-4 text-center text-xs text-slate-500">
                  No direct product matches for &ldquo;{value.trim()}&rdquo;. Press Enter to search catalog.
                </div>
              )}
            </div>
          )}

          {/* Matching / Popular Categories */}
          {matchingCategories.length > 0 && (
            <div className="px-3.5 py-2.5 border-t border-slate-100 bg-slate-50/50">
              <p className="text-[11px] font-bold text-slate-400 mb-2">
                {cleanQuery ? 'Matching Categories' : 'Popular Categories'}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {matchingCategories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      onSelectCategory(cat);
                    }}
                    className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-white border border-slate-200/80 hover:border-[#2874F0] hover:text-[#2874F0] text-left transition"
                  >
                    <img
                      src={cat.image}
                      alt={cat.name}
                      referrerPolicy="no-referrer"
                      className="w-6 h-6 rounded-full object-cover shrink-0"
                    />
                    <span className="text-xs font-semibold text-slate-800 truncate">
                      {cat.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
