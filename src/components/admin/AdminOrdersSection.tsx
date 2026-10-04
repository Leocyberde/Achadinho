import React, { useState } from 'react';
import { Search, ExternalLink, Ticket, ArrowUpDown } from 'lucide-react';
import {
  formatCurrency,
  formatPaymentMethodDisplay,
  formatDistance,
  formatDateTime,
  formatOrderNumberLabel,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_LIST,
  ProductImage,
  PaymentTimerBadge,
} from '../../context/AppContext.tsx';

interface AdminOrdersSectionProps {
  ordersData: { orders: any[]; paymentDeadlineHours: number };
  orderSearch: string;
  setOrderSearch: (val: string) => void;
  orderStatusFilter: string;
  setOrderStatusFilter: (val: string) => void;
  selectedAdminOrder: any | null;
  setSelectedAdminOrder: (ord: any | null) => void;
  editingOrderFreight: boolean;
  setEditingOrderFreight: (val: boolean) => void;
  orderFreightKm: string;
  setOrderFreightKm: (val: string) => void;
  orderFreightFee: string;
  setOrderFreightFee: (val: string) => void;
  orderAlsoUpdateAddress: boolean;
  setOrderAlsoUpdateAddress: (val: boolean) => void;
  freightRule: { baseDistanceKm: number; baseFee: number; extraKmFee: number };
  handleSaveOrderFreight: (e: React.FormEvent) => void;
  handleSetOrderManualFreeDelivery: (orderId: number) => void;
  handleChangeOrderStatus: (orderId: number, newStatus: string) => void;
  onRefreshOrders?: () => void;
}

export const AdminOrdersSection: React.FC<AdminOrdersSectionProps> = ({
  ordersData,
  orderSearch,
  setOrderSearch,
  orderStatusFilter,
  setOrderStatusFilter,
  selectedAdminOrder,
  setSelectedAdminOrder,
  editingOrderFreight,
  setEditingOrderFreight,
  orderFreightKm,
  setOrderFreightKm,
  orderFreightFee,
  setOrderFreightFee,
  orderAlsoUpdateAddress,
  setOrderAlsoUpdateAddress,
  freightRule,
  handleSaveOrderFreight,
  handleSetOrderManualFreeDelivery,
  handleChangeOrderStatus,
  onRefreshOrders,
}) => {
  const [sortByArrivalOrder, setSortByArrivalOrder] = useState(false);

  const filteredOrders = ordersData.orders
    .filter((o) => {
      if (orderStatusFilter === 'PENDING_FREIGHT') {
        return o.deliveryFee === null && o.status !== 'CANCELLED';
      }
      if (orderStatusFilter !== 'ALL' && o.status !== orderStatusFilter) {
        return false;
      }
      const q = orderSearch.trim().toLowerCase();
      if (!q) return true;
      return (
        o.orderNumber.toLowerCase().includes(q) ||
        formatOrderNumberLabel(o.orderNumber).toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.customerPhone.toLowerCase().includes(q)
      );
    })
    .slice()
    .sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      return sortByArrivalOrder ? timeA - timeB : timeB - timeA;
    });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Gestão de Pedidos</h1>
          <p className="text-xs text-zinc-500">
            Estoque reservado no ato do pedido (por ordem de chegada) com prazo automático de 1h para pagamento.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSortByArrivalOrder((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
              sortByArrivalOrder
                ? 'bg-zinc-900 text-white border-zinc-900'
                : 'bg-white text-zinc-700 border-stone-300 hover:bg-stone-50'
            }`}
            title="Alternar entre Ordem de Chegada (mais antigos primeiro) e Mais Recentes"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            <span>
              {sortByArrivalOrder
                ? 'Ordem de Chegada (1º da fila primeiro)'
                : 'Mais Recentes Primeiro'}
            </span>
          </button>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={orderSearch}
              onChange={(e) => setOrderSearch(e.target.value)}
              placeholder="Buscar por #pedido, cliente, tel..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-stone-300 rounded-lg"
            />
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 p-1 bg-stone-200/60 rounded-lg overflow-x-auto">
        <button
          type="button"
          onClick={() => setOrderStatusFilter('ALL')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap ${
            orderStatusFilter === 'ALL'
              ? 'bg-white text-zinc-900 shadow-xs'
              : 'text-zinc-600'
          }`}
        >
          Todos ({ordersData.orders.length})
        </button>
        <button
          type="button"
          onClick={() => {
            setOrderStatusFilter('PENDING_FREIGHT');
            setSortByArrivalOrder(true);
          }}
          className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap ${
            orderStatusFilter === 'PENDING_FREIGHT'
              ? 'bg-white text-zinc-900 shadow-xs'
              : 'text-zinc-600'
          }`}
        >
          Frete a Combinar / Aprovar
        </button>
        {ORDER_STATUS_LIST.map((st) => (
          <button
            key={st.value}
            type="button"
            onClick={() => setOrderStatusFilter(st.value)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap ${
              orderStatusFilter === st.value
                ? 'bg-white text-zinc-900 shadow-xs'
                : 'text-zinc-600'
            }`}
          >
            {st.label}
          </button>
        ))}
      </div>

      {/* Selected Order Detail Drawer/Card */}
      {selectedAdminOrder && (
        <div className="bg-white border-2 border-zinc-900 rounded-xl p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-200 pb-4">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-lg font-bold text-zinc-900">
                  {formatOrderNumberLabel(selectedAdminOrder.orderNumber)}
                </span>
                <span className="text-xs text-zinc-400">·</span>
                <span className="text-xs font-semibold text-zinc-800">
                  {ORDER_STATUS_LABELS[selectedAdminOrder.status] || selectedAdminOrder.status}
                </span>
                <span
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                    selectedAdminOrder.stockDeducted
                      ? selectedAdminOrder.status === 'NEW' ||
                        selectedAdminOrder.status === 'AWAITING_PAYMENT'
                        ? 'bg-amber-50 text-amber-900 border border-amber-200'
                        : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-stone-100 text-zinc-600 border border-stone-200'
                  }`}
                >
                  {selectedAdminOrder.stockDeducted
                    ? selectedAdminOrder.status === 'NEW' ||
                      selectedAdminOrder.status === 'AWAITING_PAYMENT'
                      ? 'Estoque reservado (Aguardando pagamento)'
                      : 'Estoque descontado (Pago)'
                    : selectedAdminOrder.status === 'CANCELLED'
                    ? 'Estoque devolvido à vitrine (Cancelado)'
                    : 'Estoque não reservado'}
                </span>
                {selectedAdminOrder.isFirstOrderFreeDelivery && (
                  <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-300 inline-flex items-center gap-1">
                    <Ticket className="w-3 h-3" />
                    <span>
                      {selectedAdminOrder.deliveryFeeSource === 'FIRST_ORDER_FREE'
                        ? 'Entrega Grátis (1º Pedido do Cliente)'
                        : selectedAdminOrder.deliveryFeeSource === 'MANUAL_FREE_DELIVERY'
                        ? 'Entrega Grátis (Manual Admin)'
                        : 'Ticket de Entrega Grátis (4º Pedido / Fidelidade)'}
                    </span>
                  </span>
                )}
              </div>
              <div className="text-xs text-zinc-500">
                Criado em {formatDateTime(selectedAdminOrder.createdAt)} · Cliente:{' '}
                <strong className="text-zinc-800">{selectedAdminOrder.customerName}</strong> (
                {selectedAdminOrder.customerPhone})
              </div>

              {(selectedAdminOrder.status === 'NEW' ||
                selectedAdminOrder.status === 'AWAITING_PAYMENT') && (
                <div className="pt-1">
                  <PaymentTimerBadge
                    paymentExpiresAt={selectedAdminOrder.paymentExpiresAt}
                    status={selectedAdminOrder.status}
                    paymentReleased={selectedAdminOrder.paymentReleased}
                    onExpired={onRefreshOrders}
                  />
                </div>
              )}

              {selectedAdminOrder.cancellationReason && (
                <div className="mt-1.5 text-xs text-red-700 font-medium">
                  Motivo do cancelamento: {selectedAdminOrder.cancellationReason}
                  {selectedAdminOrder.refundRequested
                    ? ' · (Cliente solicitou estorno de pedido pago)'
                    : ''}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {selectedAdminOrder.customerWhatsappUrl && (
                <a
                  href={selectedAdminOrder.customerWhatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg"
                >
                  <span>WhatsApp do Cliente</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
              <button
                type="button"
                onClick={() => setSelectedAdminOrder(null)}
                className="px-3 py-2 text-xs font-medium text-zinc-600 hover:text-zinc-900 bg-stone-100 rounded-lg"
              >
                Fechar
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Items & Freight Controls */}
            <div className="lg:col-span-7 space-y-5">
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-zinc-900">Itens do Pedido</h3>
                <div className="bg-stone-50 border border-stone-200 rounded-lg p-3.5 divide-y divide-stone-200 text-xs">
                  {selectedAdminOrder.items?.map((item: any) => (
                    <div key={item.id} className="py-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-md bg-white border border-stone-200 overflow-hidden shrink-0">
                          <ProductImage
                            src={item.imageUrl}
                            alt={item.productName}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <span className="truncate">
                          <strong className="tabular-nums">{item.quantity}x</strong>{' '}
                          {item.productName}{' '}
                          <span className="text-zinc-400">
                            ({formatCurrency(item.unitPrice)})
                          </span>
                        </span>
                      </div>
                      <span className="font-semibold tabular-nums shrink-0">
                        {formatCurrency(item.subtotal)}
                      </span>
                    </div>
                  ))}

                  <div className="pt-3 space-y-1.5">
                    <div className="flex justify-between text-zinc-600">
                      <span>Forma de Pagamento</span>
                      <span className="font-semibold text-zinc-900">
                        {formatPaymentMethodDisplay(
                          selectedAdminOrder.paymentMethod,
                          selectedAdminOrder.changeFor
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between text-zinc-600">
                      <span>Subtotal</span>
                      <span className="font-semibold tabular-nums">
                        {formatCurrency(selectedAdminOrder.subtotal)}
                      </span>
                    </div>
                    <div className="flex justify-between text-zinc-600">
                      <span>
                        Frete (
                        {selectedAdminOrder.isFirstOrderFreeDelivery
                          ? selectedAdminOrder.deliveryFeeSource === 'FIRST_ORDER_FREE'
                            ? 'Entrega grátis de 1º pedido'
                            : selectedAdminOrder.deliveryFeeSource === 'MANUAL_FREE_DELIVERY'
                            ? 'Entrega grátis manual (Admin)'
                            : 'Ticket de Entrega Grátis (Fidelidade)'
                          : `Origem: ${selectedAdminOrder.deliveryFeeSource || 'MANUAL'}${
                              selectedAdminOrder.deliveryDistanceKm
                                ? ` · ${formatDistance(selectedAdminOrder.deliveryDistanceKm)}`
                                : ''
                            }`}
                        )
                      </span>
                      <span className="font-semibold tabular-nums">
                        {selectedAdminOrder.isFirstOrderFreeDelivery
                          ? 'Grátis (R$ 0,00)'
                          : selectedAdminOrder.deliveryFee !== null
                          ? formatCurrency(selectedAdminOrder.deliveryFee)
                          : 'A combinar'}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm font-bold text-zinc-900 pt-1">
                      <span>Total do Pedido</span>
                      <span className="tabular-nums">
                        {formatCurrency(selectedAdminOrder.total)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Definir ou Editar Frete Direto no Pedido (Seção 10.1 item 6 e Seção 14) */}
              <div
                className={`border rounded-lg p-4 space-y-3 ${
                  selectedAdminOrder.deliveryFee === null &&
                  (selectedAdminOrder.status === 'NEW' ||
                    selectedAdminOrder.status === 'AWAITING_PAYMENT')
                    ? 'bg-amber-50/70 border-amber-300'
                    : 'bg-stone-50 border-stone-200'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-bold text-zinc-900">Frete deste Pedido</h4>
                    <p className="text-[11px] text-zinc-600">
                      {selectedAdminOrder.deliveryFee === null &&
                      (selectedAdminOrder.status === 'NEW' ||
                        selectedAdminOrder.status === 'AWAITING_PAYMENT')
                        ? 'Defina o frete (ou Entrega Grátis) para liberar o pagamento ao cliente e iniciar o prazo de 1h.'
                        : 'Defina o frete ou coloque Entrega Grátis (R$ 0,00) com 1 clique.'}
                    </p>
                  </div>
                  {!editingOrderFreight && (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleSetOrderManualFreeDelivery(selectedAdminOrder.id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-emerald-900 bg-emerald-50 border border-emerald-300 hover:bg-emerald-100 rounded-lg cursor-pointer"
                      >
                        <Ticket className="w-3.5 h-3.5 text-emerald-700" />
                        <span>Colocar Entrega Grátis (R$ 0,00)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setOrderFreightKm(
                            selectedAdminOrder.deliveryDistanceKm
                              ? String(selectedAdminOrder.deliveryDistanceKm)
                              : ''
                          );
                          setOrderFreightFee(
                            selectedAdminOrder.deliveryFee
                              ? String(selectedAdminOrder.deliveryFee)
                              : ''
                          );
                          setEditingOrderFreight(true);
                        }}
                        className="px-3 py-1.5 text-xs font-semibold text-zinc-900 bg-white border border-stone-300 hover:bg-stone-100 rounded-lg"
                      >
                        {selectedAdminOrder.deliveryFee === null
                          ? 'Definir Frete e Liberar Pagamento'
                          : 'Editar Frete'}
                      </button>
                    </div>
                  )}
                </div>

                {editingOrderFreight && (
                  <form
                    onSubmit={handleSaveOrderFreight}
                    className="border-t border-stone-200 pt-3 space-y-3"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="block text-xs font-semibold text-zinc-700">
                          Distância em km (opcional)
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          value={orderFreightKm}
                          onChange={(e) => {
                            const val = e.target.value;
                            setOrderFreightKm(val);
                            const num = parseFloat(val);
                            if (!isNaN(num) && num >= 0) {
                              const sug =
                                num <= freightRule.baseDistanceKm
                                  ? freightRule.baseFee
                                  : freightRule.baseFee +
                                    (num - freightRule.baseDistanceKm) * freightRule.extraKmFee;
                              setOrderFreightFee(sug.toFixed(2));
                            }
                          }}
                          placeholder="Ex: 4.8"
                          className="w-full px-3 py-1.5 text-xs bg-white border border-stone-300 rounded-lg font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-xs font-semibold text-zinc-700">
                          Valor do Frete (R$)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          required
                          value={orderFreightFee}
                          onChange={(e) => setOrderFreightFee(e.target.value)}
                          placeholder="Ex: 8.50"
                          className="w-full px-3 py-1.5 text-xs bg-white border border-stone-300 rounded-lg font-mono"
                        />
                      </div>
                    </div>

                    <label className="flex items-center gap-2 text-xs text-zinc-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={orderAlsoUpdateAddress}
                        onChange={(e) => setOrderAlsoUpdateAddress(e.target.checked)}
                      />
                      <span>
                        Também confirmar este frete no endereço do cliente para compras futuras
                      </span>
                    </label>

                    <div className="flex items-center gap-2">
                      <button
                        type="submit"
                        className="px-4 py-1.5 text-xs font-semibold text-white bg-zinc-900 rounded-lg"
                      >
                        Salvar, Liberar Pagamento e Iniciar 1h
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingOrderFreight(false)}
                        className="px-3 py-1.5 text-xs text-zinc-600"
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>

            {/* Right: Status Control, Snapshot & History */}
            <div className="lg:col-span-5 space-y-5">
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-zinc-900">Alterar Status do Pedido</h3>
                <div className="grid grid-cols-2 gap-1.5">
                  {ORDER_STATUS_LIST.map((st) => {
                    const active = selectedAdminOrder.status === st.value;
                    return (
                      <button
                        key={st.value}
                        type="button"
                        onClick={() => handleChangeOrderStatus(selectedAdminOrder.id, st.value)}
                        className={`px-3 py-2 text-xs font-medium rounded-lg border text-left transition-colors ${
                          active
                            ? 'bg-zinc-900 text-white border-zinc-900 font-semibold'
                            : 'bg-white text-zinc-700 border-stone-200 hover:bg-stone-50'
                        }`}
                      >
                        {st.label}
                      </button>
                    );
                  })}
                </div>

                {/* Botão de 1 clique para cancelar pedido aguardando pagamento devolvendo estoque (Seção 12) */}
                {(selectedAdminOrder.status === 'AWAITING_PAYMENT' ||
                  selectedAdminOrder.status === 'NEW') && (
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() =>
                        handleChangeOrderStatus(selectedAdminOrder.id, 'CANCELLED')
                      }
                      className="w-full py-2 px-3 text-xs font-semibold text-red-800 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors"
                    >
                      Cancelar com 1 clique e devolver estoque à vitrine
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <h3 className="text-xs font-bold text-zinc-900">
                  Endereço Snapshot (Gravado no Pedido)
                </h3>
                <div className="p-3 bg-stone-50 border border-stone-200 rounded-lg text-xs text-zinc-700 space-y-1">
                  <div className="font-semibold text-zinc-900">
                    {selectedAdminOrder.addressSnapshot?.label} — CEP{' '}
                    {selectedAdminOrder.addressSnapshot?.zipCode}
                  </div>
                  <div>
                    {selectedAdminOrder.addressSnapshot?.street},{' '}
                    {selectedAdminOrder.addressSnapshot?.number}
                    {selectedAdminOrder.addressSnapshot?.complement
                      ? ` (${selectedAdminOrder.addressSnapshot.complement})`
                      : ''}
                  </div>
                  <div>
                    {selectedAdminOrder.addressSnapshot?.neighborhood} —{' '}
                    {selectedAdminOrder.addressSnapshot?.city}/
                    {selectedAdminOrder.addressSnapshot?.state}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <h3 className="text-xs font-bold text-zinc-900">
                  Histórico de Alterações (order_status_history)
                </h3>
                <div className="p-3 bg-stone-50 border border-stone-200 rounded-lg text-xs space-y-1.5 max-h-36 overflow-y-auto">
                  {selectedAdminOrder.history?.map((h: any) => (
                    <div key={h.id} className="flex items-center justify-between gap-2">
                      <span className="text-zinc-700">
                        {h.oldStatus
                          ? `${ORDER_STATUS_LABELS[h.oldStatus] || h.oldStatus} → `
                          : ''}
                        <strong className="text-zinc-900">
                          {ORDER_STATUS_LABELS[h.newStatus] || h.newStatus}
                        </strong>
                      </span>
                      <span className="text-[11px] text-zinc-400 tabular-nums">
                        {formatDateTime(h.createdAt)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Orders Table */}
      <div className="bg-white border border-stone-200 rounded-xl overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-stone-200 text-zinc-500 bg-stone-50">
              <th className="py-3 px-4 font-semibold">Pedido</th>
              <th className="py-3 px-4 font-semibold">Cliente / WhatsApp</th>
              <th className="py-3 px-4 font-semibold text-right">Subtotal</th>
              <th className="py-3 px-4 font-semibold text-right">Frete / Dist.</th>
              <th className="py-3 px-4 font-semibold text-right">Total</th>
              <th className="py-3 px-4 font-semibold">Status & Prazo (1h)</th>
              <th className="py-3 px-4 font-semibold">Data</th>
              <th className="py-3 px-4 font-semibold text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-200">
            {filteredOrders.map((o, idx) => (
              <tr key={o.id} className="hover:bg-stone-50/70">
                <td className="py-3 px-4 font-mono font-bold text-zinc-900">
                  <div className="flex items-center gap-1.5">
                    <span>{formatOrderNumberLabel(o.orderNumber)}</span>
                    {sortByArrivalOrder && o.status !== 'CANCELLED' && (
                      <span className="px-1.5 py-0.5 rounded bg-zinc-900 text-white font-sans text-[10px] font-bold">
                        {idx + 1}º da fila
                      </span>
                    )}
                  </div>
                  {o.isFirstOrderFreeDelivery && (
                    <div className="mt-0.5 inline-block px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 font-sans text-[10px] font-semibold text-emerald-800">
                      {o.deliveryFeeSource === 'FIRST_ORDER_FREE'
                        ? 'Entrega Grátis (1º Pedido)'
                        : o.deliveryFeeSource === 'MANUAL_FREE_DELIVERY'
                        ? 'Entrega Grátis (Manual)'
                        : 'Ticket Entrega Grátis (4º Pedido)'}
                    </div>
                  )}
                </td>
                <td className="py-3 px-4">
                  <div className="font-semibold text-zinc-900">{o.customerName}</div>
                  <div className="text-[11px] text-zinc-500 tabular-nums">{o.customerPhone}</div>
                </td>
                <td className="py-3 px-4 text-right tabular-nums text-zinc-700">
                  {formatCurrency(o.subtotal)}
                </td>
                <td className="py-3 px-4 text-right tabular-nums">
                  {o.isFirstOrderFreeDelivery ? (
                    <div>
                      <div className="font-semibold text-emerald-800">Grátis (R$ 0,00)</div>
                      <div className="text-[11px] font-medium text-emerald-700">
                        {o.deliveryFeeSource === 'FIRST_ORDER_FREE'
                          ? '1º Pedido Grátis'
                          : o.deliveryFeeSource === 'MANUAL_FREE_DELIVERY'
                          ? 'Entrega Grátis Manual'
                          : 'Ticket Entrega Grátis'}
                      </div>
                    </div>
                  ) : o.deliveryFee !== null ? (
                    <div>
                      <div className="font-semibold text-zinc-900">
                        {formatCurrency(o.deliveryFee)}
                      </div>
                      <div className="text-[11px] text-zinc-400">
                        {formatDistance(o.deliveryDistanceKm)} ({o.deliveryFeeSource})
                      </div>
                    </div>
                  ) : (
                    <span className="font-medium text-amber-800">A combinar</span>
                  )}
                </td>
                <td className="py-3 px-4 text-right font-bold text-zinc-900 tabular-nums">
                  <div>{formatCurrency(o.total)}</div>
                  <div className="text-[11px] font-medium text-zinc-500 font-sans">
                    {formatPaymentMethodDisplay(o.paymentMethod, o.changeFor)}
                  </div>
                </td>
                <td className="py-3 px-4">
                  <div className="space-y-1">
                    <span
                      className={`font-semibold block ${
                        o.status === 'CANCELLED'
                          ? 'text-red-700'
                          : o.status === 'PAID' || o.status === 'DELIVERED'
                          ? 'text-emerald-800'
                          : 'text-zinc-800'
                      }`}
                    >
                      {ORDER_STATUS_LABELS[o.status] || o.status}
                    </span>
                    {(o.status === 'NEW' || o.status === 'AWAITING_PAYMENT') && (
                      <PaymentTimerBadge
                        paymentExpiresAt={o.paymentExpiresAt}
                        status={o.status}
                        paymentReleased={o.paymentReleased}
                        onExpired={onRefreshOrders}
                        compact={true}
                      />
                    )}
                  </div>
                </td>
                <td className="py-3 px-4 text-zinc-500 tabular-nums">
                  {formatDateTime(o.createdAt)}
                </td>
                <td className="py-3 px-4 text-right">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedAdminOrder(o);
                      setEditingOrderFreight(false);
                    }}
                    className="px-3 py-1.5 text-xs font-semibold text-zinc-900 bg-stone-100 hover:bg-stone-200 rounded-lg"
                  >
                    Abrir Pedido
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
