import { eq, sql, inArray } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import * as schema from '../../db/schema.ts';
import { getSettingsMap } from './storeHelpers.ts';
import { evaluateCustomerLoyaltyTickets } from './loyaltyService.ts';

let isExpiringOrders = false;

/**
 * Verifica todos os pedidos pendentes de pagamento ('NEW' ou 'AWAITING_PAYMENT')
 * cujo prazo de pagamento (1h após a liberação do pagamento) já expirou.
 * Cancela automaticamente o pedido e devolve o saldo reservado para os produtos na vitrine.
 */
export async function expireOverdueUnpaidOrders(): Promise<number> {
  if (isExpiringOrders) return 0;
  isExpiringOrders = true;

  try {
    const unpaidOrders = await db
      .select()
      .from(schema.orders)
      .where(inArray(schema.orders.status, ['NEW', 'AWAITING_PAYMENT']));

    if (unpaidOrders.length === 0) return 0;

    const settingsMap = await getSettingsMap();
    const deadlineHours = Math.max(
      0.1,
      parseFloat(settingsMap.payment_deadline_hours || '1') || 1
    );
    const nowMs = Date.now();

    const expiredCandidates = unpaidOrders.filter((ord) => {
      // Se o frete ainda está "A combinar" (deliveryFee === null e não é entrega grátis)
      // e paymentExpiresAt ainda é nulo, o cliente ainda aguarda o Admin definir o frete.
      const hasConfirmedFreight =
        ord.isFirstOrderFreeDelivery ||
        ord.usedFreeDeliveryTicket ||
        (ord.deliveryFee !== null && ord.deliveryFee !== undefined && ord.deliveryFee !== '');

      if (ord.paymentExpiresAt) {
        return new Date(ord.paymentExpiresAt).getTime() <= nowMs;
      }

      if (!hasConfirmedFreight) {
        return false;
      }

      const createdMs = new Date(ord.createdAt).getTime();
      return nowMs - createdMs >= deadlineHours * 3600 * 1000;
    });

    if (expiredCandidates.length === 0) return 0;

    let expiredCount = 0;

    for (const candidate of expiredCandidates) {
      try {
        await db.transaction(async (tx) => {
          const [freshOrder] = await tx
            .select()
            .from(schema.orders)
            .where(eq(schema.orders.id, candidate.id));

          if (
            !freshOrder ||
            (freshOrder.status !== 'NEW' && freshOrder.status !== 'AWAITING_PAYMENT')
          ) {
            return;
          }

          const items = await tx
            .select()
            .from(schema.orderItems)
            .where(eq(schema.orderItems.orderId, freshOrder.id));

          // Devolve o saldo reservado para o estoque dos produtos e reativa na vitrine se estava zerado
          if (freshOrder.stockDeducted) {
            for (const item of items) {
              await tx
                .update(schema.products)
                .set({
                  stock: sql`${schema.products.stock} + ${item.quantity}`,
                  status: 'ACTIVE',
                  updatedAt: new Date(),
                })
                .where(eq(schema.products.id, item.productId));
            }
          }

          const reasonText =
            'Prazo de 1 hora para pagamento expirou. O pedido foi cancelado automaticamente e os itens voltaram para o estoque da vitrine.';

          await tx
            .update(schema.orders)
            .set({
              status: 'CANCELLED',
              stockDeducted: false,
              paymentExpiresAt: null,
              cancellationReason: reasonText,
              updatedAt: new Date(),
            })
            .where(eq(schema.orders.id, freshOrder.id));

          await tx.insert(schema.orderStatusHistory).values({
            orderId: freshOrder.id,
            oldStatus: freshOrder.status,
            newStatus: 'CANCELLED',
            changedBy: null,
          });

          await tx.insert(schema.notifications).values({
            userId: freshOrder.userId,
            orderId: freshOrder.id,
            orderNumber: freshOrder.orderNumber,
            oldStatus: freshOrder.status,
            newStatus: 'CANCELLED',
            title: `⏰ Prazo de 1h expirado — Pedido #${freshOrder.orderNumber}`,
            message: `O prazo de 1 hora para pagamento do pedido #${freshOrder.orderNumber} terminou e a reserva dos produtos foi cancelada automaticamente. Caso ainda queira os itens, basta fazer um novo pedido na vitrine!`,
            isRead: false,
            popupDismissed: false,
          });

          await evaluateCustomerLoyaltyTickets(freshOrder.userId, tx);
          expiredCount += 1;
        });
      } catch (err) {
        console.error(`Erro ao expirar pedido #${candidate.orderNumber}:`, err);
      }
    }

    return expiredCount;
  } finally {
    isExpiringOrders = false;
  }
}

export function startOrderExpirationWatcher() {
  // Executa imediatamente ao subir o servidor e depois a cada 15 segundos
  expireOverdueUnpaidOrders().catch((err) =>
    console.error('Erro inicial ao verificar expiração de pedidos:', err)
  );
  setInterval(() => {
    expireOverdueUnpaidOrders().catch((err) =>
      console.error('Erro no watcher de expiração de pedidos:', err)
    );
  }, 15000);
}
