import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Search,
  ShoppingBag,
  ArrowRight,
  X,
  Truck,
  MapPin,
  Ticket,
  Flame,
  Package,
  ArrowUpDown,
  Share2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  useApp,
  formatCurrency,
  calculateDiscountPercent,
  buildProductShareWhatsAppUrl,
  ProductImage,
  ProductMediaCarousel,
  ProductMediaItem,
  ExpandableDescription,
  PromoCountdown,
  AchadinhosDeliveryLogo,
} from '../context/AppContext.tsx';
import { LogisticsFlowIllustration } from '../components/ui/LogisticsFlowIllustration.tsx';

interface Category {
  id: number;
  name: string;
  description: string | null;
}

interface KitComponentInfo {
  id: number;
  componentProductId: number;
  componentCode: string;
  componentName: string;
  quantityPerKit: number;
}

interface Product {
  id: number;
  categoryId: number;
  categoryName: string;
  code: string;
  name: string;
  description: string | null;
  price: string;
  promoPrice: string | null;
  promoActive: boolean;
  promoEndsAt?: string | null;
  promoDurationHours?: number | null;
  promoMaxUnits?: number | null;
  hasPromo: boolean;
  effectivePrice: string;
  discountPercent?: number;
  isKit: boolean;
  kitComponents?: KitComponentInfo[];
  stock: number;
  weight: string;
  imageUrl: string | null;
  images?: ProductMediaItem[];
}

export const StorefrontPage: React.FC = () => {
  const {
    apiFetch,
    addToCart,
    cart,
    removeFromCart,
    user,
    freeDeliveryTickets,
    loyalty,
    setLoyalty,
    eligibleForFirstOrderFreeDelivery,
    setEligibleForFirstOrderFreeDelivery,
    searchQuery,
    setSearchQuery,
  } = useApp();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<number | 'ALL'>('ALL');
  const [specialFilter, setSpecialFilter] = useState<'ALL' | 'PROMO' | 'KITS'>('ALL');
  const [sortBy, setSortBy] = useState<'DEFAULT' | 'PRICE_ASC' | 'PRICE_DESC' | 'DISCOUNT_DESC'>(
    'DEFAULT'
  );
  const [autocompleteOpen, setAutocompleteOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const searchContainerRef = useRef<HTMLDivElement | null>(null);

  const recordInteraction = useCallback(
    (productId: number, action: 'CLICK' | 'SHARE' | 'VIEW' = 'CLICK') => {
      apiFetch(`/api/products/${productId}/interaction`, {
        method: 'POST',
        body: JSON.stringify({ action }),
      }).catch(() => {});
    },
    [apiFetch]
  );

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    apiFetch('/api/storefront')
      .then((data) => {
        if (!mounted) return;
        const loadedProducts: Product[] = Array.isArray(data?.products) ? data.products : [];
        setCategories(Array.isArray(data?.categories) ? data.categories : []);
        setProducts(loadedProducts);
        const validIds = new Set(loadedProducts.map((p) => p.id));
        cart.forEach((item) => {
          if (!validIds.has(item.productId)) {
            removeFromCart(item.productId);
          }
        });
        if (user?.role === 'ADMIN') {
          setLoyalty(null);
          setEligibleForFirstOrderFreeDelivery(false);
        } else {
          if (data.loyalty) {
            setLoyalty(data.loyalty);
          }
          if (typeof data.eligibleForFirstOrderFreeDelivery === 'boolean') {
            setEligibleForFirstOrderFreeDelivery(data.eligibleForFirstOrderFreeDelivery);
          }
        }
      })
      .catch((err) => {
        console.error(err);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [apiFetch, setLoyalty, setEligibleForFirstOrderFreeDelivery, user?.id, user?.role]);

  // Close autocomplete dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setAutocompleteOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Autocomplete suggestions ranked by prefix match on code/name first, then general match
  const autocompleteSuggestions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];

    const matches = products.filter((p) => {
      const code = (p.code || '').toLowerCase();
      const name = p.name.toLowerCase();
      const desc = (p.description || '').toLowerCase();
      const cat = (p.categoryName || '').toLowerCase();
      const fullLabel = `${code} - ${name}`;
      return (
        code.includes(q) ||
        name.includes(q) ||
        fullLabel.includes(q) ||
        cat.includes(q) ||
        desc.includes(q)
      );
    });

    // Rank prefix matches on code or name first for instant autocomplete feel
    return matches
      .sort((a, b) => {
        const aCode = (a.code || '').toLowerCase();
        const bCode = (b.code || '').toLowerCase();
        const aName = a.name.toLowerCase();
        const bName = b.name.toLowerCase();

        const aStartsCode = aCode.startsWith(q) ? 0 : aCode.includes(q) ? 1 : 2;
        const bStartsCode = bCode.startsWith(q) ? 0 : bCode.includes(q) ? 1 : 2;
        if (aStartsCode !== bStartsCode) return aStartsCode - bStartsCode;

        const aStartsName = aName.startsWith(q) ? 0 : aName.includes(q) ? 1 : 2;
        const bStartsName = bName.startsWith(q) ? 0 : bName.includes(q) ? 1 : 2;
        if (aStartsName !== bStartsName) return aStartsName - bStartsName;

        return aCode.localeCompare(bCode);
      })
      .slice(0, 8);
  }, [products, searchQuery]);

  const promoProductsCount = useMemo(
    () => products.filter((p) => Boolean(p.hasPromo)).length,
    [products]
  );
  const kitProductsCount = useMemo(
    () => products.filter((p) => Boolean(p.isKit)).length,
    [products]
  );

  const filteredProducts = useMemo(() => {
    const filtered = products.filter((p) => {
      const matchesCat = selectedCategory === 'ALL' || p.categoryId === selectedCategory;
      const matchesSpecial =
        specialFilter === 'ALL'
          ? true
          : specialFilter === 'PROMO'
          ? Boolean(p.hasPromo)
          : Boolean(p.isKit);
      const q = searchQuery.trim().toLowerCase();
      const code = (p.code || '').toLowerCase();
      const name = p.name.toLowerCase();
      const fullLabel = `${code} - ${name}`;
      const matchesSearch =
        !q ||
        code.includes(q) ||
        name.includes(q) ||
        fullLabel.includes(q) ||
        (p.description && p.description.toLowerCase().includes(q)) ||
        p.categoryName.toLowerCase().includes(q);
      return matchesCat && matchesSpecial && matchesSearch;
    });

    if (sortBy === 'DEFAULT') return filtered;

    return [...filtered].sort((a, b) => {
      const priceA = parseFloat(a.effectivePrice || a.price) || 0;
      const priceB = parseFloat(b.effectivePrice || b.price) || 0;
      if (sortBy === 'PRICE_ASC') return priceA - priceB;
      if (sortBy === 'PRICE_DESC') return priceB - priceA;
      if (sortBy === 'DISCOUNT_DESC') {
        const discA =
          a.discountPercent ?? calculateDiscountPercent(a.price, a.promoPrice, a.hasPromo);
        const discB =
          b.discountPercent ?? calculateDiscountPercent(b.price, b.promoPrice, b.hasPromo);
        if (discB !== discA) return discB - discA;
        return priceA - priceB;
      }
      return 0;
    });
  }, [products, selectedCategory, specialFilter, sortBy, searchQuery]);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!autocompleteOpen || autocompleteSuggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < autocompleteSuggestions.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev > 0 ? prev - 1 : autocompleteSuggestions.length - 1
      );
    } else if (e.key === 'Enter' && highlightedIndex >= 0) {
      e.preventDefault();
      const chosen = autocompleteSuggestions[highlightedIndex];
      if (chosen) {
        setAutocompleteOpen(false);
        navigate(`/produto/${chosen.id}`);
      }
    } else if (e.key === 'Escape') {
      setAutocompleteOpen(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 max-w-[1200px] w-full mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-8">
        {/* Faixa Roxa de Benefício estilo iFood no topo */}
        {user?.role !== 'ADMIN' && (
          <Link
            to={user ? '/checkout' : '/login'}
            className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-purple-50 hover:bg-purple-100 border border-purple-200 text-xs font-semibold text-zinc-900 transition-colors"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-6 h-6 rounded-full bg-[#7C3AED] text-white flex items-center justify-center shrink-0">
                <Ticket className="w-3.5 h-3.5" />
              </span>
              <span className="truncate">
                {freeDeliveryTickets > 0
                  ? `Você tem ${freeDeliveryTickets} Ticket(s) de Entrega Grátis disponível!`
                  : 'Você tem Entrega Grátis no 1º pedido e no 4º pedido!'}
              </span>
            </div>
            <ChevronRight className="w-4 h-4 text-[#7C3AED] shrink-0" />
          </Link>
        )}

        {/* Catálogo Geral dos Produtos */}
        <section id="catalogo" className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-zinc-900">Catálogo Disponível</h2>
              <p className="text-sm text-zinc-500 mt-0.5">
                Todos os itens exibidos possuem estoque imediato na loja Achadinhos.
              </p>
            </div>

            {/* Requisito 1: Campo de Busca com Auto Complete Instantâneo por Código ou Primeiras Letras */}
            <div id="busca" ref={searchContainerRef} className="relative w-full md:w-96 z-30">
              <Search className="w-4 h-4 text-[#7C3AED] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="storefront-search-input"
                type="search"
                role="combobox"
                aria-expanded={autocompleteOpen && searchQuery.trim().length > 0}
                aria-autocomplete="list"
                aria-controls="storefront-search-autocomplete"
                value={searchQuery}
                onFocus={() => {
                  if (searchQuery.trim().length > 0) {
                    setAutocompleteOpen(true);
                  }
                }}
                onChange={(e) => {
                  const val = e.target.value;
                  setSearchQuery(val);
                  setAutocompleteOpen(val.trim().length > 0);
                  setHighlightedIndex(-1);
                }}
                onKeyDown={handleSearchKeyDown}
                placeholder="Buscar por código (ex: 001), primeiras letras ou nome..."
                className="w-full pl-10 pr-9 py-2 text-sm bg-white border border-stone-300 rounded-lg text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setAutocompleteOpen(false);
                    setHighlightedIndex(-1);
                  }}
                  aria-label="Limpar busca"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-zinc-700"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}

              {/* Autocomplete Suggestions Dropdown */}
              {autocompleteOpen && searchQuery.trim().length > 0 && (
                <div
                  id="storefront-search-autocomplete"
                  role="listbox"
                  className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-stone-200 rounded-xl shadow-xl overflow-hidden z-40"
                >
                  <div className="px-3.5 py-2 bg-stone-50 border-b border-stone-200 flex items-center justify-between text-[11px] font-semibold text-zinc-600">
                    <span>
                      {autocompleteSuggestions.length > 0
                        ? `Sugestões de produtos (${autocompleteSuggestions.length})`
                        : 'Nenhum produto correspondente'}
                    </span>
                    <span className="text-zinc-400 font-normal">Auto-complete</span>
                  </div>

                  {autocompleteSuggestions.length === 0 ? (
                    <div className="p-4 text-center text-xs text-zinc-500">
                      Nenhum produto encontrado para &ldquo;{searchQuery}&rdquo;.
                    </div>
                  ) : (
                    <ul className="max-h-80 overflow-y-auto divide-y divide-stone-100">
                      {autocompleteSuggestions.map((item, idx) => {
                        const fullTitle = item.code
                          ? `${item.code} - ${item.name}`
                          : item.name;
                        const isHighlighted = idx === highlightedIndex;
                        return (
                          <li
                            key={item.id}
                            role="option"
                            aria-selected={isHighlighted}
                            className={`flex items-center justify-between gap-3 p-2.5 transition-colors ${
                              isHighlighted ? 'bg-stone-100' : 'hover:bg-stone-50'
                            }`}
                          >
                            <Link
                              to={`/produto/${item.id}`}
                              onClick={() => {
                                recordInteraction(item.id, 'CLICK');
                                setAutocompleteOpen(false);
                              }}
                              className="flex items-center gap-3 flex-1 min-w-0"
                            >
                              <div className="w-11 h-11 rounded-lg overflow-hidden bg-[#F9F9F8] border border-stone-200 shrink-0">
                                <ProductImage
                                  src={item.imageUrl}
                                  alt={fullTitle}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="text-xs font-semibold text-zinc-900 truncate">
                                  <span className="font-mono font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 mr-1.5">
                                    Cód. {item.code}
                                  </span>
                                  <span>{item.name}</span>
                                </div>
                                <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 mt-0.5">
                                  <span>{item.categoryName}</span>
                                  <span aria-hidden="true">·</span>
                                  <span className="font-semibold text-zinc-900 tabular-nums">
                                    {formatCurrency(item.effectivePrice || item.price)}
                                  </span>
                                  <span aria-hidden="true">·</span>
                                  <span>{item.stock} un.</span>
                                </div>
                              </div>
                            </Link>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                addToCart({
                                  productId: item.id,
                                  name: fullTitle,
                                  price: parseFloat(item.effectivePrice || item.price),
                                  originalPrice: parseFloat(item.price),
                                  promoPrice: item.promoPrice ? parseFloat(item.promoPrice) : null,
                                  hasPromo: Boolean(item.hasPromo),
                                  promoMaxUnits: item.promoMaxUnits ?? null,
                                  imageUrl: item.imageUrl,
                                  categoryName: item.categoryName,
                                  stock: item.stock,
                                });
                                setAutocompleteOpen(false);
                              }}
                              className="px-2.5 py-1.5 text-[11px] font-semibold text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg transition-colors shrink-0 cursor-pointer"
                            >
                              + Sacola
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Interactive Category Segmented Filter Bar */}
          <div className="space-y-3">
            <div className="flex items-center gap-1.5 p-1 bg-stone-200/60 rounded-lg overflow-x-auto">
              <button
                type="button"
                onClick={() => setSelectedCategory('ALL')}
                className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  selectedCategory === 'ALL'
                    ? 'bg-white text-zinc-900 shadow-xs'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                Todos os Produtos ({products.length})
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    selectedCategory === cat.id
                      ? 'bg-white text-zinc-900 shadow-xs'
                      : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Filtros Rápidos (Em Promoção / Kits) e Ordenação por Preço / Desconto */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setSpecialFilter((prev) => (prev === 'PROMO' ? 'ALL' : 'PROMO'))
                  }
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                    specialFilter === 'PROMO'
                      ? 'bg-emerald-700 text-white border-emerald-700'
                      : 'bg-white text-zinc-700 border-stone-300 hover:bg-stone-50'
                  }`}
                >
                  <Flame
                    className={`w-3.5 h-3.5 ${
                      specialFilter === 'PROMO' ? 'text-white' : 'text-emerald-700'
                    }`}
                  />
                  <span>Em Promoção ({promoProductsCount})</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setSpecialFilter((prev) => (prev === 'KITS' ? 'ALL' : 'KITS'))
                  }
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                    specialFilter === 'KITS'
                      ? 'bg-zinc-900 text-white border-zinc-900'
                      : 'bg-white text-zinc-700 border-stone-300 hover:bg-stone-50'
                  }`}
                >
                  <Package
                    className={`w-3.5 h-3.5 ${
                      specialFilter === 'KITS' ? 'text-white' : 'text-zinc-700'
                    }`}
                  />
                  <span>Kits ({kitProductsCount})</span>
                </button>

                {(specialFilter !== 'ALL' || sortBy !== 'DEFAULT') && (
                  <button
                    type="button"
                    onClick={() => {
                      setSpecialFilter('ALL');
                      setSortBy('DEFAULT');
                    }}
                    className="px-2.5 py-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-900 underline cursor-pointer"
                  >
                    Limpar filtros
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto">
                <label
                  htmlFor="storefront-sort-select"
                  className="inline-flex items-center gap-1 text-xs font-medium text-zinc-600 whitespace-nowrap"
                >
                  <ArrowUpDown className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Ordenar por:</span>
                </label>
                <select
                  id="storefront-sort-select"
                  value={sortBy}
                  onChange={(e) =>
                    setSortBy(
                      e.target.value as 'DEFAULT' | 'PRICE_ASC' | 'PRICE_DESC' | 'DISCOUNT_DESC'
                    )
                  }
                  className="px-3 py-1.5 text-xs font-semibold text-zinc-800 bg-white border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 cursor-pointer"
                >
                  <option value="DEFAULT">Mais recentes (Padrão)</option>
                  <option value="PRICE_ASC">Menor Preço</option>
                  <option value="PRICE_DESC">Maior Preço</option>
                  <option value="DISCOUNT_DESC">Maior Desconto (%)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Product Grid - 2 Colunas no Celular Estilo Shopee */}
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3.5">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <div
                  key={n}
                  className="bg-white border border-stone-200 rounded-xl overflow-hidden animate-pulse"
                >
                  <div className="aspect-square bg-stone-200" />
                  <div className="p-2.5 space-y-2">
                    <div className="h-3 w-16 bg-stone-200 rounded" />
                    <div className="h-4 w-full bg-stone-200 rounded" />
                    <div className="h-4 w-1/2 bg-stone-200 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="bg-white border border-stone-200 rounded-xl p-12 text-center space-y-3">
              <p className="text-base font-semibold text-zinc-900">
                Nenhum produto cadastrado na vitrine no momento.
              </p>
              <p className="text-sm text-zinc-500">
                {user?.role === 'ADMIN'
                  ? 'Sua loja foi zerada e está pronta para receber seus produtos reais! Acesse o Painel do Administrador para cadastrar.'
                  : 'Em breve novos produtos estarão disponíveis na vitrine.'}
              </p>
              {user?.role === 'ADMIN' && (
                <Link
                  to="/admin"
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-zinc-900 rounded-lg hover:bg-zinc-800 transition-colors"
                >
                  <span>Ir para o Painel Admin e Cadastrar Produtos</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              )}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="bg-white border border-stone-200 rounded-xl p-12 text-center space-y-3">
              <p className="text-base font-semibold text-zinc-900">
                Nenhum produto encontrado para o filtro selecionado.
              </p>
              <p className="text-sm text-zinc-500">
                Tente buscar por outro código/termo ou limpar o filtro de categoria.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory('ALL');
                  setSpecialFilter('ALL');
                  setSortBy('DEFAULT');
                  setSearchQuery('');
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-zinc-900 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                Ver Todos os Produtos
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3.5">
              {filteredProducts.map((product) => {
                const fullTitle = product.code
                  ? `${product.code} - ${product.name}`
                  : product.name;
                const discountPct =
                  product.discountPercent ??
                  calculateDiscountPercent(product.price, product.promoPrice, product.hasPromo);

                return (
                  <article
                    key={product.id}
                    className="group bg-white border border-stone-200/90 rounded-xl overflow-hidden flex flex-col justify-between hover:shadow-md transition-shadow"
                  >
                    <div className="relative aspect-square bg-[#F8F8F7] overflow-hidden">
                      <ProductMediaCarousel
                        images={product.images}
                        fallbackImageUrl={product.imageUrl}
                        alt={fullTitle}
                        discountPercent={discountPct}
                        linkTo={`/produto/${product.id}`}
                        onLinkClick={() => recordInteraction(product.id, 'CLICK')}
                        aspectClassName="aspect-square"
                      />

                      {product.isKit && (
                        <span className="absolute top-1.5 left-1.5 z-10 px-1.5 py-0.5 rounded bg-zinc-900/85 text-white text-[9px] font-bold">
                          Kit
                        </span>
                      )}
                    </div>

                    <div className="p-2 sm:p-2.5 flex-1 flex flex-col justify-between">
                      <div>
                        {/* Título com Tag Indicado em Roxo - Sem descrição na vitrine */}
                        <Link
                          to={`/produto/${product.id}`}
                          onClick={() => recordInteraction(product.id, 'CLICK')}
                          className="block group-hover:text-[#7C3AED] transition-colors"
                        >
                          <span className="inline-block bg-[#7C3AED] text-white text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded mr-1 leading-none align-baseline">
                            Indicado
                          </span>
                          <span className="text-xs sm:text-sm text-zinc-900 font-medium leading-snug line-clamp-2">
                            {product.name}
                          </span>
                        </Link>

                        {product.hasPromo && product.promoEndsAt && (
                          <div className="pt-1">
                            <PromoCountdown promoEndsAt={product.promoEndsAt} compact />
                          </div>
                        )}
                      </div>

                      <div className="pt-2">
                        {/* Bloco de Preço em Destaque em Roxo */}
                        <div>
                          {product.hasPromo && product.promoPrice ? (
                            <div className="flex flex-col">
                              <span className="text-[10px] text-zinc-400 line-through tabular-nums leading-none">
                                De {formatCurrency(product.price)}
                              </span>
                              <span className="text-sm sm:text-base font-extrabold text-[#7C3AED] tabular-nums leading-tight">
                                Por {formatCurrency(product.promoPrice)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-sm sm:text-base font-extrabold text-[#7C3AED] tabular-nums leading-tight">
                              {formatCurrency(product.price)}
                            </span>
                          )}
                        </div>

                        {/* Linha de Entrega Rápida e Estoque */}
                        <div className="mt-1 flex items-center justify-between gap-1 text-[10px] sm:text-[11px] text-zinc-500">
                          <span className="inline-flex items-center gap-0.5 text-emerald-700 font-medium truncate">
                            <Truck className="w-3 h-3 shrink-0" />
                            <span className="truncate">Entrega Rápida</span>
                          </span>
                          <span className="text-zinc-400 shrink-0 font-mono">
                            {product.stock} un.
                          </span>
                        </div>

                        {/* Botões de Ação (+ Sacola e Compartilhar) */}
                        <div className="mt-2 pt-2 border-t border-stone-100 flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              recordInteraction(product.id, 'CLICK');
                              addToCart({
                                productId: product.id,
                                name: fullTitle,
                                price: parseFloat(product.effectivePrice || product.price),
                                originalPrice: parseFloat(product.price),
                                promoPrice: product.promoPrice
                                  ? parseFloat(product.promoPrice)
                                  : null,
                                hasPromo: Boolean(product.hasPromo),
                                promoMaxUnits: product.promoMaxUnits ?? null,
                                imageUrl: product.imageUrl,
                                categoryName: product.categoryName,
                                stock: product.stock,
                              });
                            }}
                            className="flex-1 py-1.5 px-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-[11px] sm:text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                          >
                            <ShoppingBag className="w-3 h-3" />
                            <span>+ Sacola</span>
                          </button>
                          <a
                            href={buildProductShareWhatsAppUrl({
                              id: product.id,
                              code: product.code,
                              name: product.name,
                              price: product.price,
                              promoPrice: product.promoPrice,
                              hasPromo: product.hasPromo,
                            })}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => {
                              e.stopPropagation();
                              recordInteraction(product.id, 'SHARE');
                            }}
                            title="Compartilhar oferta no WhatsApp"
                            aria-label="Compartilhar oferta no WhatsApp"
                            className="p-1.5 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors shrink-0 cursor-pointer"
                          >
                            <Share2 className="w-3 h-3" />
                          </a>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* Section 3 (NO FINAL, ASSIM QUE ACABAM OS PRODUTOS): Apresentação Achadinhos Delivery, Promoção de Entrega Grátis e Como Funciona */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center border-t border-stone-200 pt-12">
          <div className="lg:col-span-6 space-y-5">
            <div className="inline-flex flex-wrap items-center gap-3 p-3 rounded-2xl bg-white border border-stone-200 shadow-2xs">
              <AchadinhosDeliveryLogo size="lg" />
              <span className="px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-[11px] font-bold text-emerald-800 inline-flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                <span>Região de Itatiba</span>
              </span>
            </div>

            <div className="text-xs font-semibold text-emerald-800 flex flex-wrap items-center gap-1.5">
              <span>Delivery exclusivo para a região de Itatiba por enquanto</span>
              <span aria-hidden="true"> · </span>
              <span className="text-stone-500 font-medium">
                Outras cidades: envio pelos Correios via WhatsApp
              </span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 leading-[1.15]">
              Produtos de utilidades, acessórios e novidades na palma da mão em poucas horas!
            </h2>

            <p className="text-base text-zinc-600 leading-relaxed max-w-[60ch]">
              Bem-vindo ao <strong>Achadinhos Delivery</strong>! Escolha utilidades domésticas,
              acessórios, tecnologia e iluminação e receba na palma da mão em poucas horas.{' '}
              <strong className="text-zinc-900">
                Lembrando que nosso delivery expresso atende apenas a região de Itatiba por
                enquanto
              </strong>{' '}
              (para outras cidades, enviamos através dos Correios — confira o valor no WhatsApp).
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <a
                href="#catalogo"
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg transition-colors whitespace-nowrap"
              >
                <span>Voltar ao Catálogo</span>
                <ArrowRight className="w-4 h-4" />
              </a>
              <Link
                to={user?.role === 'ADMIN' ? '/admin' : '/minha-conta'}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-zinc-800 bg-stone-200/70 hover:bg-stone-200 rounded-lg transition-colors whitespace-nowrap"
              >
                <span>
                  {user?.role === 'ADMIN'
                    ? 'Acessar Painel do Administrador'
                    : 'Cadastrar Endereço de Entrega'}
                </span>
              </Link>
            </div>
          </div>

          <div className="lg:col-span-6 space-y-2">
            <LogisticsFlowIllustration />
            {/* Banner de Entrega Grátis (1º Pedido Grátis + 2º e 3º Pagos + 4º Grátis) — NUNCA exibido para o ADMIN (dono da loja) */}
            {user?.role !== 'ADMIN' && (
              <div className="w-full p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-900">
                    <Ticket className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span>
                      {user && user.role === 'CUSTOMER' && eligibleForFirstOrderFreeDelivery
                        ? 'Parabéns! Você tem Entrega Grátis para o seu 1º Pedido!'
                        : 'Entrega Grátis no 1º Pedido + Fidelidade no 4º Pedido!'}
                    </span>
                  </div>
                  {user && user.role === 'CUSTOMER' && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {eligibleForFirstOrderFreeDelivery && (
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-700 text-white text-[11px] font-bold">
                          1º Pedido: Entrega Grátis Ativa
                        </span>
                      )}
                      {freeDeliveryTickets > 0 && (
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-600 text-white text-[11px] font-bold tabular-nums">
                          {freeDeliveryTickets} Ticket{freeDeliveryTickets === 1 ? '' : 's'} de Entrega Grátis
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {user && user.role === 'CUSTOMER' ? (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-emerald-800 pt-1 border-t border-emerald-200/70">
                    <span>
                      {eligibleForFirstOrderFreeDelivery
                        ? 'Você tem direito a Entrega Grátis no seu 1º pedido! O 2º e o 3º pedidos serão pagos e, no 4º pedido, você entra na promoção da Entrega Grátis novamente!'
                        : freeDeliveryTickets > 0
                        ? `Você tem ${freeDeliveryTickets} Ticket(s) de Entrega Grátis acumulativo(s) disponível(is) para usar no seu próximo pedido!`
                        : `Progresso da Fidelidade: ${
                            loyalty?.ordersInCurrentCycle || 0
                          }/3 pedidos concluídos (faltam ${
                            loyalty?.ordersRemainingForNextTicket ?? 3
                          } pedido(s) para ganhar +1 Ticket de Entrega Grátis no 4º pedido).`}
                    </span>
                    <div className="flex items-center gap-1 shrink-0 font-mono font-bold">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] ${
                          eligibleForFirstOrderFreeDelivery
                            ? 'bg-emerald-700 text-white ring-2 ring-emerald-300'
                            : 'bg-emerald-700 text-white'
                        }`}
                        title="1º Pedido com Entrega Grátis"
                      >
                        1° Grátis
                      </span>
                      <span className="text-emerald-700">→</span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] ${
                          (loyalty?.ordersInCurrentCycle || 0) >= 2
                            ? 'bg-emerald-700 text-white'
                            : 'bg-white border border-emerald-300 text-emerald-700'
                        }`}
                        title="2º Pedido com frete normal"
                      >
                        2° Pago
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] ${
                          (loyalty?.ordersInCurrentCycle || 0) >= 3
                            ? 'bg-emerald-700 text-white'
                            : 'bg-white border border-emerald-300 text-emerald-700'
                        }`}
                        title="3º Pedido com frete normal"
                      >
                        3° Pago
                      </span>
                      <span className="text-emerald-700">→</span>
                      <span
                        className="px-1.5 py-0.5 rounded text-[10px] bg-amber-100 border border-amber-300 text-amber-900"
                        title="No 4º Pedido ganha Ticket de Entrega Grátis"
                      >
                        4° Grátis
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-emerald-800 pt-1 border-t border-emerald-200/70">
                    <span>
                      Crie sua conta ou entre: o <strong>1º pedido tem Entrega Grátis</strong>, o <strong>2º e 3º são pagos</strong> e no <strong>4º pedido</strong> você ganha <strong>Entrega Grátis</strong> novamente!
                    </span>
                    <div className="flex items-center gap-1 shrink-0 font-mono font-bold">
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-700 text-white">
                        1° Grátis
                      </span>
                      <span className="text-emerald-700">→</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-white border border-emerald-300 text-emerald-700">
                        2° Pago
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-white border border-emerald-300 text-emerald-700">
                        3° Pago
                      </span>
                      <span className="text-emerald-700">→</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-100 border border-amber-300 text-amber-900">
                        4° Grátis
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Section 4: How Local Delivery & WhatsApp Ordering Works */}
        <section className="border-t border-stone-200 pt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-1.5">
            <h3 className="text-sm font-semibold text-zinc-900">01. Escolha seus produtos</h3>
            <p className="text-xs text-zinc-600 leading-relaxed">
              Adicione os itens desejados à sacola. O estoque é verificado em tempo real no momento
              de fechar o pedido.
            </p>
          </div>
          <div className="space-y-1.5">
            <h3 className="text-sm font-semibold text-zinc-900">
              02. Delivery em Itatiba ou Correios
            </h3>
            <p className="text-xs text-zinc-600 leading-relaxed">
              Cadastre seu endereço: se a cidade for <strong>Itatiba</strong>, temos delivery
              rápido! Se for outra cidade, enviamos através dos Correios (conferir valor no
              WhatsApp).
            </p>
          </div>
          <div className="space-y-1.5">
            <h3 className="text-sm font-semibold text-zinc-900">
              03. Finalize no WhatsApp & Pix
            </h3>
            <p className="text-xs text-zinc-600 leading-relaxed">
              Seu pedido gera um resumo completo com os códigos dos produtos para enviar no WhatsApp
              da loja e acompanhar o status na sua conta.
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-stone-200 bg-white mt-16">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500">
          <div className="flex items-center gap-3">
            <AchadinhosDeliveryLogo size="sm" />
            <span>— Produtos de utilidades e acessórios na palma da mão em poucas horas (Região de Itatiba)</span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              to={user?.role === 'ADMIN' ? '/admin' : '/minha-conta'}
              className="hover:text-zinc-900 transition-colors"
            >
              {user?.role === 'ADMIN' ? 'Administrador' : 'Minha Conta'}
            </Link>
            <Link to="/carrinho" className="hover:text-zinc-900 transition-colors">
              Sacola
            </Link>
            <Link to="/login" className="hover:text-zinc-900 transition-colors">
              Acesso
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
};
