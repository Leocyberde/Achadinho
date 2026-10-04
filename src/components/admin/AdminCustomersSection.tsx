import React from 'react';
import { Plus, Ticket } from 'lucide-react';
import {
  formatCurrency,
  formatDistance,
  formatDateTime,
  isItatibaCity,
} from '../../context/AppContext.tsx';

interface AdminCustomersSectionProps {
  customers: any[];
  pendingAddrCount: number;
  customerFilter: 'ALL' | 'PENDING_FREIGHT' | 'WITH_FREE_DELIVERY';
  setCustomerFilter: (val: 'ALL' | 'PENDING_FREIGHT' | 'WITH_FREE_DELIVERY') => void;
  customTicketInputs: Record<number, string>;
  setCustomTicketInputs: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  updatingCustomerTicketId: number | null;
  handleCustomerFreeDeliveryAction: (
    customerId: number,
    action: 'GRANT' | 'REMOVE' | 'SET',
    amount?: number,
    customerName?: string
  ) => void;
  openAddressFreightModal: (addr: any, customerName?: string) => void;
}

export const AdminCustomersSection: React.FC<AdminCustomersSectionProps> = ({
  customers,
  pendingAddrCount,
  customerFilter,
  setCustomerFilter,
  customTicketInputs,
  setCustomTicketInputs,
  updatingCustomerTicketId,
  handleCustomerFreeDeliveryAction,
  openAddressFreightModal,
}) => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">
            Clientes, Entrega Grátis & Frete Manual
          </h1>
          <p className="text-xs text-zinc-500">
            Regra da Loja: O cliente tem <strong>Entrega Grátis no 1º Pedido</strong>, o{' '}
            <strong>2º e 3º pedidos são pagos</strong> e no <strong>4º pedido</strong> ganha +1
            Ticket de Entrega Grátis acumulativo (você também pode conceder tickets manualmente).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1 p-1 bg-stone-200/60 rounded-lg self-start">
          <button
            type="button"
            onClick={() => setCustomerFilter('ALL')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md ${
              customerFilter === 'ALL'
                ? 'bg-white text-zinc-900 shadow-xs'
                : 'text-zinc-600'
            }`}
          >
            Todos os Clientes ({customers.length})
          </button>
          <button
            type="button"
            onClick={() => setCustomerFilter('WITH_FREE_DELIVERY')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md ${
              customerFilter === 'WITH_FREE_DELIVERY'
                ? 'bg-white text-emerald-900 shadow-xs font-semibold'
                : 'text-zinc-600'
            }`}
          >
            Com Entrega Grátis Ativa (
            {
              customers.filter(
                (c) =>
                  (c.freeDeliveryTickets || 0) > 0 ||
                  Boolean(c.eligibleForFirstOrderFreeDelivery) ||
                  Boolean(c.loyalty?.isFirstOrderEligible)
              ).length
            }
            )
          </button>
          <button
            type="button"
            onClick={() => setCustomerFilter('PENDING_FREIGHT')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md ${
              customerFilter === 'PENDING_FREIGHT'
                ? 'bg-white text-zinc-900 shadow-xs'
                : 'text-zinc-600'
            }`}
          >
            Com Endereço Sem Frete ({pendingAddrCount})
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {customers
          .filter((c) => {
            const custAddrs = Array.isArray(c.addresses) ? c.addresses : [];
            if (customerFilter === 'PENDING_FREIGHT') {
              return custAddrs.some((a: any) => a.deliveryFeeStatus === 'PENDING');
            }
            if (customerFilter === 'WITH_FREE_DELIVERY') {
              return (
                (c.freeDeliveryTickets || 0) > 0 ||
                Boolean(c.eligibleForFirstOrderFreeDelivery) ||
                Boolean(c.loyalty?.isFirstOrderEligible)
              );
            }
            return true;
          })
          .map((cust) => {
            const availTickets = Number(
              cust.freeDeliveryTickets ?? cust.loyalty?.freeDeliveryTickets ?? 0
            );
            const isFirstOrderEligible = Boolean(
              cust.eligibleForFirstOrderFreeDelivery ??
                cust.loyalty?.isFirstOrderEligible ??
                Number(cust.ordersCount || 0) === 0
            );
            const cycleOrders = Number(cust.loyalty?.ordersInCurrentCycle ?? 0);
            const remOrders = Number(cust.loyalty?.ordersRemainingForNextTicket ?? 3);
            const autoTickets = Number(cust.loyalty?.earnedAutoTickets ?? 0);
            const manualTickets = Number(cust.loyalty?.manualFreeDeliveryTickets ?? 0);
            const usedTickets = Number(cust.loyalty?.usedFreeDeliveryTickets ?? 0);
            const customTicketVal = customTicketInputs[cust.id] ?? String(availTickets);

            return (
              <div
                key={cust.id}
                className="bg-white border border-stone-200 rounded-xl p-5 space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-100 pb-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-bold text-zinc-900">{cust.name}</h2>
                      {cust.cpf && (
                        <span className="px-2 py-0.5 rounded bg-stone-100 border border-stone-200 font-mono text-xs font-semibold text-zinc-800">
                          CPF: {cust.cpf}
                        </span>
                      )}
                      {isFirstOrderEligible && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-700 text-white">
                          1º Pedido: Entrega Grátis Disponível
                        </span>
                      )}
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold tabular-nums ${
                          availTickets > 0
                            ? 'bg-amber-600 text-white'
                            : 'bg-stone-100 text-zinc-700 border border-stone-200'
                        }`}
                      >
                        <Ticket className="w-3.5 h-3.5" />
                        <span>
                          {availTickets} Ticket{availTickets === 1 ? '' : 's'} Fidelidade disponível
                          {availTickets === 1 ? '' : 'is'}
                        </span>
                      </span>
                    </div>
                    <div className="text-xs text-zinc-500 mt-0.5">
                      <span>{cust.email}</span>
                      <span aria-hidden="true"> · </span>
                      <span className="tabular-nums">Tel: {cust.phone}</span>
                      <span aria-hidden="true"> · </span>
                      <span className="tabular-nums">{cust.ordersCount} pedido(s)</span>
                    </div>
                  </div>
                </div>

                {/* Controle de Fidelidade (1º Pedido Grátis -> 2º e 3º Pagos -> 4° Grátis) + Opção Manual de Entrega Grátis */}
                <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-emerald-950 inline-flex items-center gap-1.5">
                        <Ticket className="w-4 h-4 text-emerald-700" />
                        <span>
                          Ciclo do Cliente: 1º Pedido Grátis → 2º e 3º Pagos → 4º Pedido Grátis
                        </span>
                      </span>
                      <div className="inline-flex items-center gap-1 font-mono text-[11px] font-bold bg-white px-2 py-0.5 rounded border border-emerald-200">
                        <span
                          className={`px-1.5 py-0.5 rounded ${
                            isFirstOrderEligible
                              ? 'bg-emerald-700 text-white ring-2 ring-emerald-300'
                              : 'bg-emerald-700 text-white'
                          }`}
                          title={
                            isFirstOrderEligible
                              ? '1º Pedido Grátis disponível'
                              : '1º Pedido já realizado'
                          }
                        >
                          1° Grátis
                        </span>
                        <span className="text-emerald-700">→</span>
                        <span
                          className={`px-1.5 py-0.5 rounded ${
                            cycleOrders >= 2
                              ? 'bg-emerald-700 text-white'
                              : 'bg-stone-100 text-zinc-500'
                          }`}
                        >
                          2° Pago
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded ${
                            cycleOrders >= 3
                              ? 'bg-emerald-700 text-white'
                              : 'bg-stone-100 text-zinc-500'
                          }`}
                        >
                          3° Pago
                        </span>
                        <span className="text-emerald-700">→</span>
                        <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
                          4° Grátis
                        </span>
                      </div>
                    </div>

                    <div className="text-xs text-emerald-900">
                      {isFirstOrderEligible ? (
                        <>
                          Status atual:{' '}
                          <strong className="text-emerald-950">
                            Novo cliente com direito a Entrega Grátis no 1º pedido!
                          </strong>{' '}
                          (O 2º e 3º serão pagos e no 4º ganha +1 Ticket)
                        </>
                      ) : (
                        <>
                          Ciclo atual: <strong>{cycleOrders}/3 pedidos</strong> (faltam{' '}
                          <strong>{remOrders}</strong> pedido(s) para ganhar +1 ticket no 4º
                          pedido)
                        </>
                      )}{' '}
                      · Tickets acumulativos disponíveis:{' '}
                      <strong className="text-emerald-950">{availTickets} ticket(s)</strong>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-emerald-800">
                      <span>
                        Ganhos a cada 3 pedidos: <strong>{autoTickets}</strong>
                      </span>
                      <span>·</span>
                      <span>
                        Colocados manualmente (Admin): <strong>{manualTickets}</strong>
                      </span>
                      <span>·</span>
                      <span>
                        Já utilizados pelo cliente: <strong>{usedTickets}</strong>
                      </span>
                    </div>
                  </div>

                  {/* Botões Manuais do Admin para colocar/remover/definir Entrega Grátis para o cliente */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={updatingCustomerTicketId === cust.id}
                      onClick={() =>
                        handleCustomerFreeDeliveryAction(cust.id, 'GRANT', 1, cust.name)
                      }
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 rounded-lg transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Colocar Entrega Grátis (+1 Ticket)</span>
                    </button>

                    {availTickets > 0 && (
                      <button
                        type="button"
                        disabled={updatingCustomerTicketId === cust.id}
                        onClick={() =>
                          handleCustomerFreeDeliveryAction(cust.id, 'REMOVE', 1, cust.name)
                        }
                        className="px-3 py-2 text-xs font-semibold text-red-700 bg-white border border-red-200 hover:bg-red-50 disabled:opacity-50 rounded-lg transition-colors cursor-pointer"
                      >
                        -1 Ticket
                      </button>
                    )}

                    <div className="inline-flex items-center gap-1 bg-white border border-emerald-300 rounded-lg p-1">
                      <input
                        type="number"
                        min="0"
                        value={customTicketVal}
                        onChange={(e) =>
                          setCustomTicketInputs((prev) => ({
                            ...prev,
                            [cust.id]: e.target.value,
                          }))
                        }
                        aria-label={`Definir tickets de entrega grátis para ${cust.name}`}
                        className="w-14 px-2 py-1 text-xs font-mono font-bold text-center text-zinc-900 bg-stone-50 border border-stone-200 rounded"
                      />
                      <button
                        type="button"
                        disabled={updatingCustomerTicketId === cust.id}
                        onClick={() =>
                          handleCustomerFreeDeliveryAction(
                            cust.id,
                            'SET',
                            Math.max(0, Math.floor(Number(customTicketVal) || 0)),
                            cust.name
                          )
                        }
                        className="px-2.5 py-1 text-xs font-semibold text-zinc-900 bg-stone-100 hover:bg-stone-200 rounded transition-colors cursor-pointer"
                      >
                        Definir Saldo
                      </button>
                    </div>
                  </div>
                </div>

                {!Array.isArray(cust.addresses) || cust.addresses.length === 0 ? (
                  <div className="text-xs text-zinc-400">
                    Este cliente ainda não cadastrou nenhum endereço.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {cust.addresses.map((addr: any) => {
                      const confirmed = addr.deliveryFeeStatus === 'CONFIRMED';
                      return (
                        <div
                          key={addr.id}
                          className={`p-4 rounded-lg border flex flex-col justify-between gap-3 ${
                            confirmed
                              ? 'border-stone-200 bg-stone-50/50'
                              : 'border-amber-300 bg-amber-50/40'
                          }`}
                        >
                          <div className="space-y-1 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-bold text-zinc-900">{addr.label}</span>
                              <span className="font-mono text-zinc-500">CEP {addr.zipCode}</span>
                            </div>
                            <div className="text-zinc-700">
                              {addr.street}, {addr.number}
                              {addr.complement ? ` (${addr.complement})` : ''} — {addr.neighborhood}
                              , {addr.city}/{addr.state}
                            </div>
                            {addr.reference && (
                              <div className="text-zinc-500">Ref: {addr.reference}</div>
                            )}

                            <div className="pt-1">
                              {isItatibaCity(addr.city) ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-[11px] font-semibold text-emerald-900">
                                  Cidade: Itatiba — Temos delivery
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-[11px] font-semibold text-amber-900">
                                  Entrega através dos Correios — conferir valor no WhatsApp
                                </span>
                              )}
                            </div>

                            <div className="pt-2 border-t border-stone-200/70 mt-2 space-y-0.5">
                              {confirmed ? (
                                <>
                                  <div className="font-semibold text-emerald-800 tabular-nums">
                                    Status: CONFIRMED · Frete: {formatCurrency(addr.deliveryFee)} ·
                                    Distância: {formatDistance(addr.deliveryDistanceKm)}
                                  </div>
                                  {addr.deliveryOrigin && (
                                    <div className="text-[11px] text-zinc-500">
                                      Origem: {addr.deliveryOrigin}
                                    </div>
                                  )}
                                  {addr.deliveryNotes && (
                                    <div className="text-[11px] text-zinc-500">
                                      Obs: {addr.deliveryNotes}
                                    </div>
                                  )}
                                  {addr.deliveryUpdatedAt && (
                                    <div className="text-[11px] text-zinc-400">
                                      Atualizado por {addr.updatedByName || 'Admin'} em{' '}
                                      {formatDateTime(addr.deliveryUpdatedAt)}
                                    </div>
                                  )}
                                </>
                              ) : (
                                <div className="font-semibold text-amber-800">
                                  Status: PENDING — Frete a combinar (aguardando definição)
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={() => openAddressFreightModal(addr, cust.name)}
                              className="px-3.5 py-2 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg transition-colors"
                            >
                              {confirmed ? 'Alterar Distância / Frete' : 'Definir Frete'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
};
