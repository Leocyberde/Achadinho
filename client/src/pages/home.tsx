import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, User as UserIcon, ChevronLeft, ChevronRight } from "lucide-react";
import type { Product, User } from "@shared/schema";
import { AuthModal } from "@/components/auth-modal";
import { Button } from "@/components/ui/button";
import Admin from "./admin";

type Category = "Todas" | "Eletrônicos e Celulares" | "Casa e Eletrodomésticos" | "Esportes e Fitness" | "Ferramentas" | "Moda" | "Beleza e Cuidado Pessoal" | "Saúde" | "Bebês" | "Brinquedos e Hobbies" | "Papelaria" | "Games" | "Informática" | "Agro" | "Indústria e Comércio" | "Alimentos e Bebidas" | "Serviços" | "Câmeras e Acessórios" | "Pet Shop" | "Antiguidades e Coleções" | "Outras Categorias";

export default function Home() {
  const [selectedCategory, setSelectedCategory] = useState<Category>("Todas");
  const [user, setUser] = useState<User | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(new Set());
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const categoryScrollRef = useRef<HTMLDivElement>(null);

  const handleUserLogin = (loggedUser: User) => {
    setUser(loggedUser);
  };

  const handleLogout = () => {
    setUser(null);
  };

  const checkScroll = () => {
    if (categoryScrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = categoryScrollRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1);
    }
  };

  const scrollCategories = (direction: 'left' | 'right') => {
    if (categoryScrollRef.current) {
      const scrollAmount = 200;
      categoryScrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, []);

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const { data: featuredProduct } = useQuery<Product>({
    queryKey: ["/api/products/featured"],
  });

  const filteredProducts = selectedCategory === "Todas" 
    ? products.filter(p => p.destaque === 0)
    : products.filter(p => p.categoria === selectedCategory && p.destaque === 0);

  // Se o usuário for admin, mostrar painel
  if (user?.isAdmin === 1) {
    return <Admin user={user} onLogout={handleLogout} />;
  }

  const categories: { name: Category; emoji: string }[] = [
    { name: "Todas", emoji: "✨" },
    { name: "Eletrônicos e Celulares", emoji: "📱" },
    { name: "Casa e Eletrodomésticos", emoji: "🏠" },
    { name: "Esportes e Fitness", emoji: "⚽" },
    { name: "Ferramentas", emoji: "🔧" },
    { name: "Moda", emoji: "👗" },
    { name: "Beleza e Cuidado Pessoal", emoji: "💄" },
    { name: "Saúde", emoji: "💊" },
    { name: "Bebês", emoji: "👶" },
    { name: "Brinquedos e Hobbies", emoji: "🎮" },
    { name: "Papelaria", emoji: "📝" },
    { name: "Games", emoji: "🎯" },
    { name: "Informática", emoji: "💻" },
    { name: "Agro", emoji: "🌾" },
    { name: "Indústria e Comércio", emoji: "🏭" },
    { name: "Alimentos e Bebidas", emoji: "🍔" },
    { name: "Serviços", emoji: "🛠️" },
    { name: "Câmeras e Acessórios", emoji: "📷" },
    { name: "Pet Shop", emoji: "🐾" },
    { name: "Antiguidades e Coleções", emoji: "🏺" },
    { name: "Outras Categorias", emoji: "📦" },
  ];

  const getButtonColor = (index: number) => {
    const colors = ["bg-brand-orange", "bg-brand-blue", "bg-brand-pink"];
    return colors[index % colors.length];
  };

  const toggleDescription = (productId: string) => {
    setExpandedDescriptions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(productId)) {
        newSet.delete(productId);
      } else {
        newSet.add(productId);
      }
      return newSet;
    });
  };

  const handleProductClick = async (productId: string, productName: string) => {
    if (user) {
      try {
        await fetch("/api/product-click", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: user.id,
            productId,
            productName,
          }),
        });
      } catch (error) {
        console.error("Erro ao registrar clique:", error);
      }
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-gradient-to-br from-brand-pink/10 via-brand-orange/10 to-brand-blue/10 border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-12">
          <div className="flex items-center justify-between mb-6">
            <div className="flex-1"></div>
            <div className="flex items-center gap-3">
              <Sparkles className="w-8 h-8 text-brand-pink" />
              <h1 className="text-4xl sm:text-5xl font-bold text-foreground">
                Achadinhos do Dia
              </h1>
              <Sparkles className="w-8 h-8 text-brand-blue" />
            </div>
            <div className="flex-1 flex justify-end">
              {user ? (
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-foreground">
                    Olá, {user.name}!
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setUser(null)}
                  >
                    Sair
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={() => setAuthModalOpen(true)}
                  className="bg-brand-pink hover:bg-brand-pink/90 text-white"
                >
                  <UserIcon className="w-4 h-4 mr-2" />
                  Entrar
                </Button>
              )}
            </div>
          </div>
          <p className="text-lg sm:text-xl text-muted-foreground font-medium text-center">
            Garimpei pra você — só o que vale a pena!
          </p>
        </div>
      </header>

      {/* Category Filter */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-4">
          <div className="relative">
            {canScrollLeft && (
              <button
                onClick={() => scrollCategories('left')}
                className="absolute left-0 top-1/2 -translate-y-1/2 z-20 bg-background/90 backdrop-blur-sm border border-card-border rounded-full p-2 shadow-lg hover:bg-card transition-colors"
                aria-label="Rolar categorias para a esquerda"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            {canScrollRight && (
              <button
                onClick={() => scrollCategories('right')}
                className="absolute right-0 top-1/2 -translate-y-1/2 z-20 bg-background/90 backdrop-blur-sm border border-card-border rounded-full p-2 shadow-lg hover:bg-card transition-colors"
                aria-label="Rolar categorias para a direita"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            )}
            <div
              ref={categoryScrollRef}
              onScroll={checkScroll}
              className="category-scroll"
            >
              {categories.map((category) => (
                <button
                  key={category.name}
                  onClick={() => setSelectedCategory(category.name)}
                  className={`
                    flex items-center gap-2 px-5 py-2.5 rounded-full font-medium whitespace-nowrap
                    transition-all duration-200 hover-elevate active-elevate-2
                    ${selectedCategory === category.name
                      ? "bg-brand-pink text-white shadow-md"
                      : "bg-card text-foreground border border-card-border"
                    }
                  `}
                  data-testid={`button-category-${category.name.toLowerCase()}`}
                >
                  <span className="text-lg">{category.emoji}</span>
                  <span>{category.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-8 sm:py-12">
        {/* Featured Product */}
        {featuredProduct && (
          <div className="mb-12" data-testid="section-featured">
            <div className="flex items-center gap-2 mb-6">
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
                ⭐ Achadinho do Dia
              </h2>
            </div>
            <div className="bg-card border border-card-border rounded-2xl p-6 sm:p-8 shadow-lg hover-elevate transition-all duration-300 hover:shadow-xl">
              <div className="grid md:grid-cols-2 gap-8 items-center">
                <div className="relative aspect-square rounded-xl overflow-hidden bg-muted">
                  <img
                    src={featuredProduct.imagem}
                    alt={featuredProduct.nome}
                    className="w-full h-full object-contain"
                    data-testid="img-featured-product"
                  />
                </div>
                <div className="space-y-4">
                  <span className="inline-block px-3 py-1 text-xs font-semibold bg-brand-orange/20 text-brand-orange rounded-full">
                    {featuredProduct.categoria}
                  </span>
                  <h3 className="text-2xl sm:text-3xl font-bold text-foreground" data-testid="text-featured-name">
                    {featuredProduct.nome}
                  </h3>
                  {featuredProduct.descricao && (
                    <div className="space-y-2">
                      <p className={`text-muted-foreground text-base ${expandedDescriptions.has('featured') ? '' : 'line-clamp-3'}`}>
                        {featuredProduct.descricao}
                      </p>
                      {featuredProduct.descricao.length > 100 && (
                        <button
                          onClick={() => toggleDescription('featured')}
                          className="text-sm text-brand-pink hover:text-brand-pink/80 font-medium transition-colors"
                          data-testid="button-toggle-featured-description"
                        >
                          {expandedDescriptions.has('featured') ? 'Ver menos' : 'Ver mais'}
                        </button>
                      )}
                    </div>
                  )}
                  <p className="text-4xl font-bold text-brand-pink" data-testid="text-featured-price">
                    {featuredProduct.preco}
                  </p>
                  {user ? (
                    <a
                      href={featuredProduct.affiliateLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => handleProductClick(featuredProduct.id, featuredProduct.nome)}
                      className="inline-flex items-center justify-center w-full sm:w-auto px-8 py-4 bg-brand-pink text-white font-semibold rounded-xl hover-elevate active-elevate-2 transition-all duration-200 shadow-md hover:shadow-lg"
                      data-testid="button-featured-offer"
                    >
                      Ver Oferta 🎁
                    </a>
                  ) : (
                    <button
                      onClick={() => setAuthModalOpen(true)}
                      className="inline-flex items-center justify-center w-full sm:w-auto px-8 py-4 bg-brand-pink text-white font-semibold rounded-xl hover-elevate active-elevate-2 transition-all duration-200 shadow-md hover:shadow-lg"
                      data-testid="button-featured-offer"
                    >
                      Ver Oferta 🎁
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Products Grid */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-foreground mb-6">
            {selectedCategory === "Todas" ? "Todos os Achadinhos" : `${selectedCategory}`}
          </h2>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-card border border-card-border rounded-xl p-4 animate-pulse">
                <div className="aspect-square bg-muted rounded-lg mb-4"></div>
                <div className="h-4 bg-muted rounded mb-2"></div>
                <div className="h-6 bg-muted rounded mb-3"></div>
                <div className="h-10 bg-muted rounded"></div>
              </div>
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-2xl text-muted-foreground">
              Nenhum produto encontrado nesta categoria 🔍
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" data-testid="grid-products">
            {filteredProducts.map((product, index) => (
              <div
                key={product.id}
                className="group bg-card border border-card-border rounded-xl p-4 shadow-sm hover-elevate transition-all duration-300 hover:shadow-lg"
                data-testid={`card-product-${product.id}`}
              >
                <div className="relative aspect-square rounded-lg overflow-hidden bg-muted mb-4">
                  <img
                    src={product.imagem}
                    alt={product.nome}
                    className="w-full h-full object-contain"
                    data-testid={`img-product-${product.id}`}
                  />
                </div>
                <div className="space-y-2">
                  <h3 className="font-semibold text-foreground line-clamp-2 min-h-[2.5rem]" data-testid={`text-name-${product.id}`}>
                    {product.nome}
                  </h3>
                  {product.descricao && (
                    <div className="space-y-1">
                      <p className={`text-sm text-muted-foreground ${expandedDescriptions.has(product.id) ? '' : 'line-clamp-2'}`}>
                        {product.descricao}
                      </p>
                      {product.descricao.length > 80 && (
                        <button
                          onClick={() => toggleDescription(product.id)}
                          className="text-xs text-brand-pink hover:text-brand-pink/80 font-medium transition-colors"
                          data-testid={`button-toggle-description-${product.id}`}
                        >
                          {expandedDescriptions.has(product.id) ? 'Ver menos' : 'Ver mais'}
                        </button>
                      )}
                    </div>
                  )}
                  <p className="text-2xl font-bold text-brand-pink" data-testid={`text-price-${product.id}`}>
                    {product.preco}
                  </p>
                  {user ? (
                    <a
                      href={product.affiliateLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => handleProductClick(product.id, product.nome)}
                      className={`
                        block w-full text-center px-4 py-3 text-white font-semibold rounded-lg
                        hover-elevate active-elevate-2 transition-all duration-200
                        ${getButtonColor(index)}
                      `}
                      data-testid={`button-offer-${product.id}`}
                    >
                      Ver Oferta
                    </a>
                  ) : (
                    <button
                      onClick={() => setAuthModalOpen(true)}
                      className={`
                        block w-full text-center px-4 py-3 text-white font-semibold rounded-lg
                        hover-elevate active-elevate-2 transition-all duration-200
                        ${getButtonColor(index)}
                      `}
                      data-testid={`button-offer-${product.id}`}
                    >
                      Ver Oferta
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Auth Modal */}
      <AuthModal
        open={authModalOpen}
        onOpenChange={setAuthModalOpen}
        onSuccess={handleUserLogin}
      />

      {/* Footer */}
      <footer className="bg-gradient-to-br from-brand-pink/5 via-brand-orange/5 to-brand-blue/5 border-t border-border mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-12">
          <p className="text-center text-foreground text-base sm:text-lg">
            Achadinhos garimpados com 💖 — ao comprar, você me ajuda a continuar achando mais ofertas incríveis!
          </p>
        </div>
      </footer>
    </div>
  );
}