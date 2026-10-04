import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, Search, ShoppingBag, FileText, User, LogIn } from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';

export const BottomNav: React.FC = () => {
  const { user, cartCount } = useApp();
  const location = useLocation();
  const navigate = useNavigate();

  const isAuthPage = location.pathname === '/login' || location.pathname === '/cadastro';

  // Requisito 3: Se o cliente ainda NÃO fez cadastro/login, NÃO exibe o menu de 5 ícones lá embaixo!
  // Exibe apenas o botão de Entrar ou Se Cadastrar (que abre o formulário de login/cadastro).
  if (!user) {
    if (isAuthPage) {
      return null;
    }

    return (
      <div
        aria-label="Acesso do cliente"
        className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-zinc-200 px-4 py-3 shadow-[0_-2px_12px_rgba(0,0,0,0.06)]"
      >
        <div className="max-w-[1200px] mx-auto flex items-center justify-between gap-3">
          <Link
            to="/login"
            className="w-full py-3 px-5 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-sm transition-colors"
          >
            <LogIn className="w-4 h-4 shrink-0" />
            <span>Entrar ou Cadastrar-se</span>
          </Link>
        </div>
      </div>
    );
  }

  // Depois que o cliente se cadastrar / entrar, aí sim aparece o menu completo lá embaixo!
  const isHome = location.pathname === '/' && !location.hash;
  const isCart = location.pathname === '/carrinho' || location.pathname === '/checkout';
  const isOrders = location.pathname.startsWith('/minha-conta/pedidos');
  const isProfile =
    (location.pathname === '/minha-conta' ||
      location.pathname.startsWith('/admin') ||
      location.pathname === '/login' ||
      location.pathname === '/cadastro') &&
    !isOrders;

  const handleSearchClick = () => {
    if (location.pathname !== '/') {
      navigate('/');
    }
    window.setTimeout(() => {
      const input = document.getElementById('navbar-search-input') as HTMLInputElement | null;
      if (input) {
        input.scrollIntoView({ behavior: 'smooth', block: 'center' });
        input.focus();
      }
    }, 100);
  };

  return (
    <nav
      aria-label="Navegação principal inferior"
      className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-zinc-200 shadow-[0_-2px_12px_rgba(0,0,0,0.05)]"
    >
      <div className="max-w-[1200px] mx-auto px-2 h-16 grid grid-cols-5 items-center">
        {/* 1. Início */}
        <Link
          to="/"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className={`flex flex-col items-center justify-center gap-1 py-1.5 transition-colors ${
            isHome ? 'text-[#09090B] font-bold' : 'text-zinc-500 hover:text-zinc-900 font-medium'
          }`}
        >
          <Home className={`w-5 h-5 ${isHome ? 'stroke-[2.5] text-[#09090B]' : 'stroke-[1.8]'}`} />
          <span className="text-[11px] leading-none">Início</span>
        </Link>

        {/* 2. Busca */}
        <button
          type="button"
          onClick={handleSearchClick}
          className="flex flex-col items-center justify-center gap-1 py-1.5 text-zinc-500 hover:text-zinc-900 font-medium transition-colors cursor-pointer"
        >
          <Search className="w-5 h-5 stroke-[1.8]" />
          <span className="text-[11px] leading-none">Busca</span>
        </button>

        {/* 3. Sacola */}
        <Link
          to="/carrinho"
          className={`relative flex flex-col items-center justify-center gap-1 py-1.5 transition-colors ${
            isCart ? 'text-[#7C3AED] font-bold' : 'text-zinc-500 hover:text-zinc-900 font-medium'
          }`}
        >
          <div className="relative">
            <ShoppingBag
              className={`w-5 h-5 ${isCart ? 'stroke-[2.5] text-[#7C3AED]' : 'stroke-[1.8]'}`}
            />
            {cartCount > 0 && (
              <span className="absolute -top-1.5 -right-2.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#7C3AED] text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                {cartCount}
              </span>
            )}
          </div>
          <span className="text-[11px] leading-none">Sacola</span>
        </Link>

        {/* 4. Pedidos */}
        <Link
          to={user.role === 'ADMIN' ? '/admin/pedidos' : '/minha-conta/pedidos'}
          className={`flex flex-col items-center justify-center gap-1 py-1.5 transition-colors ${
            isOrders ? 'text-[#09090B] font-bold' : 'text-zinc-500 hover:text-zinc-900 font-medium'
          }`}
        >
          <FileText
            className={`w-5 h-5 ${isOrders ? 'stroke-[2.5] text-[#09090B]' : 'stroke-[1.8]'}`}
          />
          <span className="text-[11px] leading-none">Pedidos</span>
        </Link>

        {/* 5. Perfil */}
        <Link
          to={user.role === 'ADMIN' ? '/admin' : '/minha-conta'}
          className={`flex flex-col items-center justify-center gap-1 py-1.5 transition-colors ${
            isProfile ? 'text-[#09090B] font-bold' : 'text-zinc-500 hover:text-zinc-900 font-medium'
          }`}
        >
          <div className="relative">
            <User
              className={`w-5 h-5 ${isProfile ? 'stroke-[2.5] text-[#09090B]' : 'stroke-[1.8]'}`}
            />
            <span className="w-2 h-2 rounded-full bg-[#7C3AED] absolute -top-0.5 -right-0.5 border border-white" />
          </div>
          <span className="text-[11px] leading-none">
            {user.role === 'ADMIN' ? 'Admin' : 'Perfil'}
          </span>
        </Link>
      </div>
    </nav>
  );
};
