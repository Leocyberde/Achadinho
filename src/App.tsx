import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './context/AppContext.tsx';
import { Navbar } from './components/Navbar.tsx';
import { StorefrontPage } from './pages/StorefrontPage.tsx';
import { ProductDetailPage } from './pages/ProductDetailPage.tsx';
import { CartPage } from './pages/CartPage.tsx';
import { CheckoutPage } from './pages/CheckoutPage.tsx';
import { AuthPage } from './pages/AuthPage.tsx';
import { CustomerAccountPage } from './pages/CustomerAccountPage.tsx';
import { AdminPanelPage } from './pages/AdminPanelPage.tsx';

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <div className="min-h-screen bg-[#FAF9F6] text-zinc-900 flex flex-col">
          <Navbar />
          <div className="flex-1">
            <Routes>
              {/* Rotas públicas e do cliente */}
              <Route path="/" element={<StorefrontPage />} />
              <Route path="/produto/:id" element={<ProductDetailPage />} />
              <Route path="/carrinho" element={<CartPage />} />
              <Route path="/checkout" element={<CheckoutPage />} />
              <Route path="/login" element={<AuthPage />} />
              <Route path="/cadastro" element={<AuthPage />} />
              <Route path="/minha-conta" element={<CustomerAccountPage />} />
              <Route path="/minha-conta/pedidos" element={<CustomerAccountPage />} />
              <Route path="/minha-conta/notificacoes" element={<CustomerAccountPage />} />

              {/* Rotas do painel administrativo */}
              <Route path="/admin" element={<AdminPanelPage />} />
              <Route path="/admin/produtos" element={<AdminPanelPage />} />
              <Route path="/admin/produtos-inativos" element={<AdminPanelPage />} />
              <Route path="/admin/categorias" element={<AdminPanelPage />} />
              <Route path="/admin/pedidos" element={<AdminPanelPage />} />
              <Route path="/admin/clientes" element={<AdminPanelPage />} />
              <Route path="/admin/configuracoes" element={<AdminPanelPage />} />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </div>
      </AppProvider>
    </BrowserRouter>
  );
}
