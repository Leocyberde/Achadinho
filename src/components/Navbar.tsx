import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Bell, ShoppingBag, Search, X, User, LogIn } from 'lucide-react';
import { useApp, AchadinhosDeliveryLogo } from '../context/AppContext.tsx';
import { PWAInstallButton } from './ui/PWAInstallButton.tsx';

export const Navbar: React.FC = () => {
  const {
    user,
    unreadNotificationsCount,
    markAllNotificationsRead,
    cartCount,
    searchQuery,
    setSearchQuery,
  } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const isHome = location.pathname === '/';

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    if (location.pathname !== '/') {
      navigate('/');
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-white border-b border-stone-200 shadow-2xs">
      <div className="max-w-[1200px] w-full mx-auto px-2.5 sm:px-4 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-3">
        {/* Esquerda: Botão Voltar (se fora da Home) ou Logo Achadinhos */}
        <div className="flex items-center shrink-0">
          {!isHome ? (
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="p-1.5 sm:p-2 -ml-1 rounded-full text-zinc-800 hover:bg-stone-100 transition-colors shrink-0 cursor-pointer"
              title="Voltar"
              aria-label="Voltar"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          ) : (
            <Link
              to="/"
              className="shrink-0 flex items-center pr-1"
              title="Achadinhos Delivery — Região de Itatiba"
            >
              <AchadinhosDeliveryLogo size="sm" />
            </Link>
          )}
        </div>

        {/* Centro: Campo de Busca no Topo Estilo Shopee */}
        <div className="relative flex-1 min-w-0">
          <Search className="w-4 h-4 text-[#7C3AED] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none shrink-0" />
          <input
            id="navbar-search-input"
            type="search"
            value={searchQuery}
            onChange={handleSearchChange}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && location.pathname !== '/') {
                navigate('/');
              }
            }}
            placeholder="Buscar no Achadinhos..."
            className="w-full pl-9 pr-8 py-1.5 sm:py-2 text-xs sm:text-sm bg-stone-100 focus:bg-white border border-stone-200 focus:border-[#7C3AED] rounded-full text-zinc-900 placeholder:text-stone-400 focus:outline-none focus:ring-1 focus:ring-[#7C3AED] transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 p-0.5 cursor-pointer"
              title="Limpar busca"
              aria-label="Limpar busca"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Direita: Sacola com badge + Notificações do lado da Sacola + Atalhos extras */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* 1. Sacola com badge contador estilo Shopee */}
          <Link
            to="/carrinho"
            className="relative p-2 rounded-full text-zinc-800 hover:text-[#7C3AED] hover:bg-stone-100 transition-colors shrink-0"
            title="Sacola de Compras"
            aria-label="Sacola de Compras"
          >
            <ShoppingBag className="w-5 h-5 sm:w-6 sm:h-6" />
            {cartCount > 0 && (
              <span className="absolute top-0 right-0 min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full bg-[#7C3AED] text-white flex items-center justify-center tabular-nums shadow-xs">
                {cartCount}
              </span>
            )}
          </Link>

          {/* 2. Notificações do lado da Sacola com badge contador estilo Shopee */}
          <Link
            to={user?.role === 'ADMIN' ? '/admin/pedidos' : '/minha-conta/notificacoes'}
            onClick={() => {
              if (user?.role === 'CUSTOMER' && unreadNotificationsCount > 0) {
                markAllNotificationsRead();
              }
            }}
            className="relative p-2 rounded-full text-zinc-800 hover:text-[#7C3AED] hover:bg-stone-100 transition-colors shrink-0"
            title="Notificações"
            aria-label="Notificações"
          >
            <Bell className="w-5 h-5 sm:w-6 sm:h-6" />
            {unreadNotificationsCount > 0 && (
              <span className="absolute top-0 right-0 min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full bg-[#7C3AED] text-white flex items-center justify-center tabular-nums shadow-xs">
                {unreadNotificationsCount}
              </span>
            )}
          </Link>

          <div className="hidden lg:flex items-center gap-1.5 pl-1.5 border-l border-stone-200">
            <PWAInstallButton />
          </div>

          {/* Botão de Perfil / Login em telas médias e grandes */}
          {user ? (
            <Link
              to={user.role === 'ADMIN' ? '/admin' : '/minha-conta'}
              className="hidden md:flex items-center gap-1.5 pl-2 border-l border-stone-200 text-xs text-zinc-700 hover:text-zinc-900 transition-colors"
            >
              <div className="w-6 h-6 rounded-full bg-stone-100 flex items-center justify-center text-zinc-700">
                <User className="w-3.5 h-3.5" />
              </div>
              <span className="font-semibold truncate max-w-[100px]">
                {user.name.split(' ')[0]}
              </span>
            </Link>
          ) : (
            <Link
              to="/login"
              className="hidden md:inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold transition-colors shrink-0"
            >
              <LogIn className="w-3.5 h-3.5 text-zinc-300" />
              <span>Entrar</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};
