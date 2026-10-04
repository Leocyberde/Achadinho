import React from 'react';
import {
  AlertTriangle,
  Package,
  ShoppingBag,
  Users,
  CheckCircle2,
  Clock,
  ExternalLink,
  MessageCircle,
  Truck,
  TrendingUp,
} from 'lucide-react';
import {
  formatCurrency,
  formatDateTime,
  formatOrderNumberLabel,
  ORDER_STATUS_LABELS,
  ProductImage,
} from '../../context/AppContext.tsx';
import { AdminSection } from './AdminSidebar.tsx';

interface AdminDashboardSectionProps {
  dashboardData: any;
  pendingAddrCount: number;
  pendingOrdCount: number;
  orders: any[];
  products: any[];
  setCustomerFilter: (val: 'ALL' | 'PENDING_FREIGHT' | 'WITH_FREE_DELIVERY') => void;
  setOrderStatusFilter: (val: string) => void;
  goToSection: (target: AdminSection) => void;
  openAddressFreightModal: (addr: any, customerName?: string) => void;
  openOrderFreightFromAlert: (ord: any) => void;
  openEditProduct: (prod: any) => void;
  setSelectedAdminOrder?: (ord: any) => void;
}

export const AdminDashboardSection: React.FC<AdminDashboardSectionProps> = ({
  dashboardData,
  pendingAddrCount,
  pendingOrdCount,
  orders,
  products,
  setCustomerFilter,
  setOrderStatusFilter,
  goToSection,
  openAddressFreightModal,
  openOrderFreightFromAlert,
  openEditProduct,
  setSelectedAdminOrder,
}) => {
  const metrics = dashboardData?.metrics || {};

  // Pedidos pendentes de entrega (visão principal solicitada pelo usuário)
  // Inclui todos os pedidos que não foram cancelados e nem entregues ainda
  const pendingDeliveryOrders = Array.isArray(dashboardData?.pendingDeliveryOrders)
    ? dashboardData.pendingDeliveryOrders
    : orders.filter((o) => o.status !== 'DELIVERED' && o.status !== 'CANCELLED');

  const pendingAddresses = Array.isArray(dashboardData?.alerts?.pendingFreightAddresses)
    ? dashboardData.alerts.pendingFreightAddresses
    : [];

  const lowStockList = Array.isArray(dashboardData?.lowStockProducts)
    ? dashboardData.lowStockProducts
    : [];

  const handleOpenOrder = (ord: any) => {
    if (setSelectedAdminOrder) {
      const fullOrder = orders.find((o) => o.id === ord.id) || ord;
      setSelectedAdminOrder(fullOrder);
    }
    setOrderStatusFilter('ALL');
    goToSection('ORDERS');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'NEW':
        return {
          label: 'Novo Pedido',
          className: 'bg-blue-100 text-blue-900 border border-blue-200',
        };
      case 'AWAITING_PAYMENT':
        return {
          label: 'Aguardando Pagamento',
          className: 'bg-amber-100 text-amber-900 border border-amber-200',
        };
      case 'PAID':
        return {
          label: 'Pago / Confirmado',
          className: 'bg-emerald-100 text-emerald-900 border border-emerald-200',
        };
      case 'PREPARING':
        return {
          label: 'Em Separação',
          className: 'bg-purple-100 text-purple-900 border border-purple-200',
        };
      case 'OUT_FOR_DELIVERY':
        return {
          label: 'Saiu para Entrega 🛵',
          className: 'bg-orange-100 text-orange-900 border border-orange-200 animate-pulse',
        };
      default:
        return {
          label: ORDER_STATUS_LABELS[status] || status,
          className: 'bg-stone-100 text-zinc-800 border border-stone-200',
        };
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Painel Operacional</h1>
          <p className="text-xs text-zinc-500">
            Acompanhe os pedidos que precisam de atendimento, envio e entrega em tempo real.
          </p>
        </div>

        <button
          type="button"
          onClick={() => goToSection('PROFIT_RANKING')}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 border border-purple-200 text-[#7C3AED] text-xs font-bold transition-colors cursor-pointer self-start sm:self-auto"
        >
          <TrendingUp className="w-4 h-4" />
          <span>Ver Análise de Lucro & Ranking dos Produtos →</span>
        </button>
      </div>

      {/* KPIs Operacionais Limpos (Sem misturar custos/lucros na tela inicial) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Pedidos Pendentes de Entrega */}
        <div className="bg-purple-50/80 border-2 border-[#7C3AED]/40 rounded-xl p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-purple-900 font-bold">
            <span>Pendentes de Entrega</span>
            <Clock className="w-4 h-4 text-[#7C3AED]" />
          </div>
          <div className="text-2xl font-extrabold text-[#6D28D9] tabular-nums">
            {pendingDeliveryOrders.length}
          </div>
          <div className="text-[11px] text-purple-800 font-semibold">
            {pendingDeliveryOrders.length === 1 ? '1 pedido precisa de ação' : `${pendingDeliveryOrders.length} pedidos precisam de ação`}
          </div>
        </div>

        {/* Vendas Concluídas Hoje (Apenas pedidos entregues!) */}
        <div className="bg-white border border-stone-200 rounded-xl p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>Entregues Hoje</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-700" />
          </div>
          <div className="text-xl font-bold text-zinc-900 tabular-nums">
            {formatCurrency(metrics.salesTodayTotal || 0)}
          </div>
          <div className="text-[11px] text-emerald-800 font-semibold tabular-nums">
            {metrics.ordersTodayCount || 0} pedido(s) entregue(s)
          </div>
        </div>

        {/* Vendas Concluídas no Mês (Apenas pedidos entregues!) */}
        <div className="bg-white border border-stone-200 rounded-xl p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>Entregues no Mês</span>
            <ShoppingBag className="w-4 h-4 text-zinc-700" />
          </div>
          <div className="text-xl font-bold text-zinc-900 tabular-nums">
            {formatCurrency(metrics.salesMonthTotal || 0)}
          </div>
          <div className="text-[11px] text-zinc-600 font-semibold tabular-nums">
            Total realizado no mês
          </div>
        </div>

        {/* Clientes Cadastrados */}
        <div className="bg-white border border-stone-200 rounded-xl p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>Clientes</span>
            <Users className="w-4 h-4 text-zinc-700" />
          </div>
          <div className="text-xl font-bold text-zinc-900 tabular-nums">
            {metrics.customersCount || 0}
          </div>
          <div className="text-[11px] text-zinc-500 tabular-nums">
            {pendingAddrCount > 0 ? (
              <span className="text-amber-800 font-bold">{pendingAddrCount} sem frete</span>
            ) : (
              'Todos com frete definido'
            )}
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* VISÃO PRINCIPAL: PEDIDOS PENDENTES DE ENTREGA (REQUISITO 1)           */}
      {/* ===================================================================== */}
      <div className="bg-white border border-stone-200 rounded-2xl p-5 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-100 border border-purple-200 flex items-center justify-center text-[#7C3AED]">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-zinc-900">
                  Pedidos Pendentes de Entrega
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-purple-100 text-[#6D28D9] text-xs font-extrabold tabular-nums">
                  {pendingDeliveryOrders.length}
                </span>
              </div>
              <p className="text-xs text-zinc-500">
                Pedidos em andamento aguardando confirmação, separação ou envio para entrega.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setOrderStatusFilter('ALL');
              goToSection('ORDERS');
            }}
            className="text-xs font-semibold text-[#7C3AED] hover:underline self-start sm:self-auto"
          >
            Abrir Todos os Pedidos →
          </button>
        </div>

        {pendingDeliveryOrders.length === 0 ? (
          <div className="p-10 text-center space-y-2 border border-dashed border-stone-200 rounded-xl bg-stone-50/50">
            <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
            <h3 className="text-sm font-bold text-zinc-900">
              Nenhum pedido pendente no momento!
            </h3>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto">
              Todos os pedidos já foram entregues aos clientes ou cancelados. Quando um novo pedido chegar, ele aparecerá em destaque aqui.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingDeliveryOrders.map((ord: any) => {
              const badge = getStatusBadge(ord.status);
              const itemsList = Array.isArray(ord.items) ? ord.items : [];
              const addr = ord.addressSnapshot;

              return (
                <div
                  key={ord.id}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest('button, a, input')) return;
                    handleOpenOrder(ord);
                  }}
                  className="p-4 rounded-xl border border-stone-200 hover:border-purple-400 transition-all bg-stone-50/40 hover:bg-white space-y-3.5 cursor-pointer shadow-2xs hover:shadow-xs"
                >
                  {/* Cabeçalho do Card */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-stone-100 pb-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-extrabold text-sm text-zinc-900">
                        {formatOrderNumberLabel(ord.orderNumber)}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                      <span className="text-zinc-400 text-xs">·</span>
                      <span className="text-xs text-zinc-500 tabular-nums">
                        {formatDateTime(ord.createdAt)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      <span className="text-xs text-zinc-500">Total:</span>
                      <span className="font-mono font-extrabold text-base text-zinc-900 tabular-nums">
                        {formatCurrency(ord.total)}
                      </span>
                    </div>
                  </div>

                  {/* Informações do Cliente, Endereço e Ações */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                    {/* Cliente e Endereço */}
                    <div className="md:col-span-5 space-y-1">
                      <div className="text-xs font-bold text-zinc-900">
                        Cliente: <span className="font-semibold text-zinc-800">{ord.customerName}</span>
                      </div>
                      {ord.customerPhone && (
                        <div className="text-xs text-zinc-600 font-mono">
                          Tel: {ord.customerPhone}
                        </div>
                      )}
                      {addr && (
                        <div className="text-[11px] text-zinc-500 leading-tight">
                          📍 {addr.street}, {addr.number} {addr.complement ? `(${addr.complement})` : ''} — {addr.neighborhood}, {addr.city}/{addr.state}
                        </div>
                      )}
                    </div>

                    {/* Resumo de Itens do Pedido */}
                    <div className="md:col-span-4 min-w-0">
                      <div className="text-[11px] font-bold text-zinc-600 uppercase mb-1">
                        Itens ({itemsList.reduce((acc: number, it: any) => acc + (it.quantity || 1), 0)} un.):
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {itemsList.slice(0, 3).map((it: any, iIdx: number) => (
                          <div
                            key={iIdx}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white border border-stone-200 text-[11px] text-zinc-800 font-medium max-w-[170px] truncate"
                            title={`${it.quantity}x ${it.productName}`}
                          >
                            <span className="font-bold text-[#7C3AED] font-mono">{it.quantity}x</span>
                            <span className="truncate">{it.productName}</span>
                          </div>
                        ))}
                        {itemsList.length > 3 && (
                          <span className="text-[10px] text-zinc-400 font-bold">
                            +{itemsList.length - 3} mais
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Botões de Ação Imediata (Responder no WhatsApp e Abrir Pedido) */}
                    <div className="md:col-span-3 flex flex-wrap sm:flex-nowrap md:flex-col lg:flex-row items-center gap-2 justify-end">
                      {ord.customerWhatsappUrl && (
                        <a
                          href={ord.customerWhatsappUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors"
                          title="Abrir conversa no WhatsApp com mensagem sobre o pedido"
                        >
                          <MessageCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>WhatsApp</span>
                        </a>
                      )}

                      <button
                        type="button"
                        onClick={() => handleOpenOrder(ord)}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
                      >
                        <span>Gerenciar</span>
                        <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Alertas de Frete Pendente e Estoque Baixo */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Alerta de Endereços Aguardando Frete */}
        {pendingAddrCount > 0 && (
          <div className="bg-amber-50/90 border border-amber-300 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-950">
                <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                <span>Endereços de Clientes Sem Frete ({pendingAddrCount})</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCustomerFilter('PENDING_FREIGHT');
                  goToSection('CUSTOMERS');
                }}
                className="text-xs font-semibold text-amber-950 underline"
              >
                Ver clientes
              </button>
            </div>
            <div className="space-y-2">
              {pendingAddresses.slice(0, 3).map((addr: any) => (
                <div
                  key={addr.id}
                  className="p-3 bg-white rounded-lg border border-amber-200 flex items-center justify-between gap-2 text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-bold text-zinc-900 truncate">
                      {addr.customerName} ({addr.label})
                    </div>
                    <div className="text-zinc-600 text-[11px] truncate">
                      {addr.street}, {addr.number} — {addr.neighborhood}, {addr.city}/{addr.state}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => openAddressFreightModal(addr, addr.customerName)}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg shrink-0"
                  >
                    Definir Frete
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Alerta de Produtos com Estoque Baixo */}
        {lowStockList.length > 0 && (
          <div className="bg-white border border-stone-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-zinc-900">
                <Package className="w-4 h-4 text-amber-600" />
                <span>Estoque Baixo (≤ 5 un.) ({lowStockList.length})</span>
              </div>
              <button
                type="button"
                onClick={() => goToSection('PRODUCTS')}
                className="text-xs font-semibold text-zinc-700 hover:text-zinc-900 underline"
              >
                Ver Produtos
              </button>
            </div>
            <div className="space-y-1.5 text-xs">
              {lowStockList.slice(0, 3).map((prod: any) => (
                <div
                  key={prod.id}
                  className="p-2 rounded-lg bg-stone-50 border border-stone-200 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <span className="font-mono font-bold text-zinc-800">{prod.code}</span> —{' '}
                    <span className="font-medium text-zinc-900 truncate">{prod.name}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold text-xs shrink-0 tabular-nums">
                    {prod.stock} un.
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
