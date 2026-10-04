import { Express } from 'express';
import { eq, desc, and, sql } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import * as schema from '../../db/schema.ts';
import { resolveAddressFreight } from '../../services/freightService.ts';
import {
  buildOrderWhatsAppMessage,
  buildRefundWhatsAppMessage,
  buildWhatsAppLink,
} from '../../utils/whatsapp.ts';
import { AuthRequest, requireAuth } from '../middleware/auth.ts';
import {
  CUSTOMER_CANCELLABLE_STATUSES,
  PAID_ORDER_STATUSES,
  computePaymentExpiresAt,
  getPrimaryStoreId,
  getSettingsMap,
  isPromoCurrentlyActive,
  calculatePromoLinePricing,
  getNextGlobalOrderNumber,
} from '../services/storeHelpers.ts';
import { evaluateCustomerLoyaltyTickets } from '../services/loyaltyService.ts';
import { expireOverdueUnpaidOrders } from '../services/orderExpirationService.ts';

export function registerOrderRoutes(app: Express) {
  app.post('/api/orders', requireAuth, async (req: AuthRequest, res) => {
    try {
      await expireOverdueUnpaidOrders();
      const { addressId, items, notes, paymentMethod, changeFor } = req.body;

      const allowedMethods = ['PIX', 'CARD_CREDIT', 'CARD_DEBIT', 'CASH'];
      const normalizedPaymentMethod = allowedMethods.includes(String(paymentMethod || 'PIX').toUpperCase())
        ? String(paymentMethod || 'PIX').toUpperCase()
        : 'PIX';

      if (!addressId || !Array.isArray(items) || items.length === 0) {
        res.status(400).json({
          error: 'Selecione um endereço de entrega e adicione pelo menos um produto ao pedido.',
        });
        return;
      }

      const [address] = await db
        .select()
        .from(schema.addresses)
        .where(
          and(
            eq(schema.addresses.id, Number(addressId)),
            eq(schema.addresses.userId, req.user!.id)
          )
        );

      if (!address) {
        res.status(400).json({ error: 'Endereço inválido ou não pertence à sua conta.' });
        return;
      }

      const storeId = await getPrimaryStoreId();
      const settingsMap = await getSettingsMap();
      const deadlineHours = Math.max(
        0.1,
        parseFloat(settingsMap.payment_deadline_hours || '1') || 1
      );

      const createdOrderResult = await db.transaction(async (tx) => {
        let subtotalNum = 0;
        const preparedItems: Array<{
          productId: number;
          productName: string;
          quantity: number;
          unitPrice: string;
          subtotal: string;
        }> = [];

        // Agrupa itens com o mesmo productId para garantir que o limite da promoção seja respeitado por produto
        const mergedItemsMap = new Map<number, { productId: number; quantity: number; productName?: string }>();
        for (const rawItem of items) {
          const prodId = Number(rawItem.productId);
          const qty = Math.floor(Number(rawItem.quantity));
          if (!prodId || isNaN(qty) || qty <= 0) {
            throw new Error('Quantidade inválida na sacola.');
          }
          const existing = mergedItemsMap.get(prodId);
          if (existing) {
            existing.quantity += qty;
          } else {
            mergedItemsMap.set(prodId, {
              productId: prodId,
              quantity: qty,
              productName: rawItem.productName,
            });
          }
        }

        for (const rawItem of mergedItemsMap.values()) {
          const prodId = rawItem.productId;
          const qty = rawItem.quantity;

          const [prod] = await tx
            .select()
            .from(schema.products)
            .where(eq(schema.products.id, prodId));

          if (!prod || prod.status !== 'ACTIVE') {
            throw new Error(
              `O produto "${rawItem.productName || '#' + prodId}" não está mais disponível.`
            );
          }

          if (prod.stock < qty) {
            if (prod.stock <= 0) {
              throw new Error(
                `O produto "${prod.code} - ${prod.name}" está sem estoque no momento.`
              );
            }
            throw new Error(
              `Estoque insuficiente para "${prod.code} - ${prod.name}". Disponível: ${prod.stock} un.`
            );
          }

          // Opção 2: Reserva/desconta imediatamente do estoque no ato do pedido (por ordem exata de chegada).
          // Se o saldo chegar a 0, marca como INACTIVE para sair da vitrine imediatamente.
          // Se o cliente não pagar em 1 hora, o verificador automático cancela o pedido e devolve o saldo para a vitrine.
          const nextProdStock = prod.stock - qty;
          const reservedRows = await tx
            .update(schema.products)
            .set({
              stock: sql`${schema.products.stock} - ${qty}`,
              status: nextProdStock <= 0 ? 'INACTIVE' : prod.status,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(schema.products.id, prod.id),
                sql`${schema.products.stock} >= ${qty}`
              )
            )
            .returning();

          if (reservedRows.length === 0) {
            throw new Error(
              `Estoque insuficiente para reservar "${prod.code} - ${prod.name}". Outro pedido acabou de reservar as últimas unidades.`
            );
          }

          // Calcula preço respeitando eventual limite de unidades na promoção (promoMaxUnits):
          // Até o limite sai pelo valor promocional; o excedente segue o valor normal do produto.
          const hasPromo = isPromoCurrentlyActive(prod);
          const pricing = calculatePromoLinePricing({
            normalPrice: prod.price,
            promoPrice: prod.promoPrice,
            hasPromo,
            promoMaxUnits: prod.promoMaxUnits,
            quantity: qty,
          });

          subtotalNum = Number((subtotalNum + pricing.subtotal).toFixed(2));

          // Código do produto na frente do nome nos pedidos e no WhatsApp
          const displayProductName = prod.code
            ? `${prod.code} - ${prod.name}`
            : prod.name;

          if (pricing.hasLimitExceeded) {
            preparedItems.push({
              productId: prod.id,
              productName: `${displayProductName} (Na promoção — máx. ${pricing.promoMaxUnits} un.)`,
              quantity: pricing.promoQty,
              unitPrice: pricing.promoUnitPrice.toFixed(2),
              subtotal: pricing.promoSubtotal.toFixed(2),
            });
            preparedItems.push({
              productId: prod.id,
              productName: `${displayProductName} (Valor normal acima do limite)`,
              quantity: pricing.normalQty,
              unitPrice: pricing.normalUnitPrice.toFixed(2),
              subtotal: pricing.normalSubtotal.toFixed(2),
            });
          } else {
            const appliedUnitPrice = pricing.hasPromo
              ? pricing.promoUnitPrice
              : pricing.normalUnitPrice;
            preparedItems.push({
              productId: prod.id,
              productName: displayProductName,
              quantity: qty,
              unitPrice: appliedUnitPrice.toFixed(2),
              subtotal: pricing.subtotal.toFixed(2),
            });
          }
        }

        const evaluatedFreight = resolveAddressFreight(address);
        const loyaltyBefore = await evaluateCustomerLoyaltyTickets(req.user!.id, tx);

        const isFirstOrderWelcomeFree = loyaltyBefore.isFirstOrderEligible;

        const wantsToUseTicket =
          req.body.useFreeDeliveryTicket !== undefined
            ? Boolean(req.body.useFreeDeliveryTicket)
            : true;
        const usingFreeDeliveryTicket =
          !isFirstOrderWelcomeFree &&
          loyaltyBefore.freeDeliveryTickets > 0 &&
          wantsToUseTicket;

        const deliveryDistanceStr =
          evaluatedFreight.status === 'CONFIRMED' && evaluatedFreight.distanceKm !== null
            ? evaluatedFreight.distanceKm.toFixed(2)
            : null;

        let deliveryFeeStr: string | null;
        let deliveryFeeSource: string;

        if (isFirstOrderWelcomeFree) {
          deliveryFeeStr = '0.00';
          deliveryFeeSource = 'FIRST_ORDER_FREE';
        } else if (usingFreeDeliveryTicket) {
          deliveryFeeStr = '0.00';
          deliveryFeeSource = 'FREE_DELIVERY_TICKET';
        } else {
          deliveryFeeStr =
            evaluatedFreight.status === 'CONFIRMED' && evaluatedFreight.fee !== null
              ? evaluatedFreight.fee.toFixed(2)
              : null;
          deliveryFeeSource = evaluatedFreight.status === 'CONFIRMED' ? 'AUTO' : 'MANUAL';
        }

        const totalNum =
          deliveryFeeStr !== null
            ? Number((subtotalNum + parseFloat(deliveryFeeStr)).toFixed(2))
            : subtotalNum;

        let changeForStr: string | null = null;
        if (normalizedPaymentMethod === 'CASH' && changeFor !== undefined && changeFor !== null && String(changeFor).trim() !== '') {
          const parsedChange = parseFloat(String(changeFor).replace(',', '.'));
          if (!isNaN(parsedChange) && parsedChange > 0) {
            if (parsedChange < totalNum) {
              throw new Error(
                `O valor para troco (R$ ${parsedChange.toFixed(2).replace('.', ',')}) deve ser igual ou maior que o total do pedido (R$ ${totalNum.toFixed(2).replace('.', ',')}).`
              );
            }
            changeForStr = parsedChange.toFixed(2);
          }
        }

        // Se o frete já for conhecido ou grátis, o pagamento já fica liberado com cronômetro de 1h.
        // Se o frete estiver "Em análise" (null), aguarda o Admin definir o frete para iniciar o cronômetro de 1h.
        const paymentReleased = deliveryFeeStr !== null;
        const paymentExpiresAt = paymentReleased
          ? computePaymentExpiresAt(deadlineHours)
          : null;

        const orderNumber = await getNextGlobalOrderNumber(tx);

        const addressSnapshot: schema.AddressSnapshot = {
          id: address.id,
          label: address.label,
          zipCode: address.zipCode,
          street: address.street,
          number: address.number,
          complement: address.complement,
          neighborhood: address.neighborhood,
          city: address.city,
          state: address.state,
          reference: address.reference,
          deliveryOrigin: address.deliveryOrigin,
          deliveryNotes: address.deliveryNotes,
        };

        const [newOrder] = await tx
          .insert(schema.orders)
          .values({
            orderNumber,
            userId: req.user!.id,
            storeId,
            subtotal: subtotalNum.toFixed(2),
            deliveryFee: deliveryFeeStr,
            deliveryDistanceKm: deliveryDistanceStr,
            deliveryFeeSource,
            total: totalNum.toFixed(2),
            paymentMethod: normalizedPaymentMethod,
            changeFor: changeForStr,
            status: 'NEW',
            isFirstOrderFreeDelivery: isFirstOrderWelcomeFree || usingFreeDeliveryTicket,
            usedFreeDeliveryTicket: usingFreeDeliveryTicket,
            stockDeducted: true,
            paymentExpiresAt,
            cancellationReason: null,
            refundRequested: false,
            notes: notes ? String(notes).trim() : null,
            addressSnapshot,
          })
          .returning();

        for (const item of preparedItems) {
          await tx.insert(schema.orderItems).values({
            orderId: newOrder.id,
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            subtotal: item.subtotal,
          });
        }

        await tx.insert(schema.orderStatusHistory).values({
          orderId: newOrder.id,
          oldStatus: null,
          newStatus: 'NEW',
          changedBy: req.user!.id,
        });

        // Recalcula fidelidade após criar o pedido: se completou mais 3 pedidos, ganha +1 Ticket de Entrega Grátis!
        const loyaltyAfter = await evaluateCustomerLoyaltyTickets(req.user!.id, tx);
        const earnedNewTicket = loyaltyAfter.earnedAutoTickets > loyaltyBefore.earnedAutoTickets;

        if (earnedNewTicket) {
          await tx.insert(schema.notifications).values({
            userId: req.user!.id,
            orderId: newOrder.id,
            orderNumber: newOrder.orderNumber,
            oldStatus: 'NEW',
            newStatus: 'FREE_DELIVERY_TICKET_EARNED',
            title: '🎟️ Você ganhou 1 Ticket de Entrega Grátis!',
            message: `Parabéns! Você completou 3 pedidos na loja Achadinhos Delivery e ganhou +1 Ticket de Entrega Grátis acumulativo (saldo disponível: ${loyaltyAfter.freeDeliveryTickets} ticket(s)). Seu próximo pedido (4º pedido) terá Entrega Grátis!`,
            isRead: false,
            popupDismissed: false,
          });
        }

        return {
          order: newOrder,
          items: preparedItems,
          loyalty: loyaltyAfter,
          earnedNewTicket,
        };
      });

      const allImages = await db.select().from(schema.productImages);
      const whatsappNumber = settingsMap.whatsapp_number || '5511999999999';
      const whatsappMessage = buildOrderWhatsAppMessage({
        orderNumber: createdOrderResult.order.orderNumber,
        items: createdOrderResult.items,
        subtotal: createdOrderResult.order.subtotal,
        deliveryFee: createdOrderResult.order.deliveryFee,
        deliveryDistanceKm: createdOrderResult.order.deliveryDistanceKm,
        total: createdOrderResult.order.total,
        paymentMethod: createdOrderResult.order.paymentMethod,
        changeFor: createdOrderResult.order.changeFor,
        addressSnapshot: createdOrderResult.order.addressSnapshot,
        notes: createdOrderResult.order.notes,
        isFirstOrderFreeDelivery: Boolean(
          createdOrderResult.order.usedFreeDeliveryTicket ||
            createdOrderResult.order.isFirstOrderFreeDelivery ||
            createdOrderResult.order.deliveryFeeSource === 'FREE_DELIVERY_TICKET' ||
            createdOrderResult.order.deliveryFeeSource === 'MANUAL_FREE_DELIVERY' ||
            createdOrderResult.order.deliveryFeeSource === 'FIRST_ORDER_FREE'
        ),
        usedFreeDeliveryTicket: Boolean(createdOrderResult.order.usedFreeDeliveryTicket),
        deliveryFeeSource: createdOrderResult.order.deliveryFeeSource,
      });
      const whatsappUrl = buildWhatsAppLink(whatsappNumber, whatsappMessage);

      const enrichedItems = createdOrderResult.items.map((it) => {
        const prodImgs = allImages.filter((img) => img.productId === it.productId);
        const primary =
          prodImgs.find((i) => i.isPrimary && i.mediaType !== 'VIDEO') ||
          prodImgs.find((i) => i.mediaType !== 'VIDEO') ||
          prodImgs[0];
        return {
          ...it,
          imageUrl: primary ? primary.imageUrl : null,
        };
      });

      const paymentReleased = Boolean(
        createdOrderResult.order.isFirstOrderFreeDelivery ||
          createdOrderResult.order.usedFreeDeliveryTicket ||
          (createdOrderResult.order.deliveryFee !== null &&
            createdOrderResult.order.deliveryFee !== undefined &&
            createdOrderResult.order.deliveryFee !== '')
      );

      res.status(201).json({
        ...createdOrderResult.order,
        paymentReleased,
        paymentDeadlineHours: deadlineHours,
        freeDeliveryTickets: createdOrderResult.loyalty.freeDeliveryTickets,
        loyalty: createdOrderResult.loyalty,
        earnedNewTicket: createdOrderResult.earnedNewTicket,
        canCustomerCancel: true,
        requiresRefundOnCancel: false,
        items: enrichedItems,
        whatsappMessage,
        whatsappUrl,
      });
    } catch (error: any) {
      console.error('Erro ao criar pedido:', error);
      res.status(400).json({
        error: error.message || 'Não foi possível concluir o pedido.',
      });
    }
  });

  app.get('/api/orders', requireAuth, async (req: AuthRequest, res) => {
    try {
      await expireOverdueUnpaidOrders();
      const userOrders = await db
        .select()
        .from(schema.orders)
        .where(eq(schema.orders.userId, req.user!.id))
        .orderBy(desc(schema.orders.id));

      const [customerUser] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, req.user!.id));

      const allItems = await db.select().from(schema.orderItems);
      const allImages = await db.select().from(schema.productImages);
      const allHistory = await db
        .select()
        .from(schema.orderStatusHistory)
        .orderBy(desc(schema.orderStatusHistory.id));
      const settingsMap = await getSettingsMap();
      const whatsappNumber = settingsMap.whatsapp_number || '5511999999999';

      const customerHasDeliveredOrder = userOrders.some((ord) => ord.status === 'DELIVERED');

      const enriched = userOrders.map((o) => {
        const items = allItems
          .filter((i) => i.orderId === o.id)
          .map((i) => {
            const prodImgs = allImages.filter((img) => img.productId === i.productId);
            const primary =
              prodImgs.find((im) => im.isPrimary && im.mediaType !== 'VIDEO') ||
              prodImgs.find((im) => im.mediaType !== 'VIDEO') ||
              prodImgs[0];
            return {
              ...i,
              imageUrl: primary ? primary.imageUrl : null,
            };
          });
        const history = allHistory.filter((h) => h.orderId === o.id);
        const isFirstOrderFreeDelivery = Boolean(
          o.usedFreeDeliveryTicket ||
            o.deliveryFeeSource === 'FREE_DELIVERY_TICKET' ||
            o.deliveryFeeSource === 'MANUAL_FREE_DELIVERY' ||
            (!customerHasDeliveredOrder &&
              (o.isFirstOrderFreeDelivery || o.deliveryFeeSource === 'FIRST_ORDER_FREE'))
        );
        const whatsappMessage = buildOrderWhatsAppMessage({
          orderNumber: o.orderNumber,
          items,
          subtotal: o.subtotal,
          deliveryFee: o.deliveryFee,
          deliveryDistanceKm: o.deliveryDistanceKm,
          total: o.total,
          paymentMethod: o.paymentMethod,
          changeFor: o.changeFor,
          addressSnapshot: o.addressSnapshot,
          notes: o.notes,
          isFirstOrderFreeDelivery,
          usedFreeDeliveryTicket: Boolean(o.usedFreeDeliveryTicket),
          deliveryFeeSource: o.deliveryFeeSource,
        });

        const canCustomerCancel = CUSTOMER_CANCELLABLE_STATUSES.includes(o.status);
        const requiresRefundOnCancel = PAID_ORDER_STATUSES.includes(o.status);
        const paymentReleased = Boolean(
          isFirstOrderFreeDelivery ||
            (o.deliveryFee !== null && o.deliveryFee !== undefined && o.deliveryFee !== '')
        );

        const refundWhatsappMessage = buildRefundWhatsAppMessage({
          orderNumber: o.orderNumber,
          customerName: customerUser?.name || req.user!.name,
          customerPhone: customerUser?.phone || '',
          items,
          subtotal: o.subtotal,
          deliveryFee: o.deliveryFee,
          total: o.total,
          cancellationReason:
            o.cancellationReason || 'Solicito o cancelamento e estorno do valor pago.',
        });
        const refundWhatsappUrl = buildWhatsAppLink(whatsappNumber, refundWhatsappMessage);

        return {
          ...o,
          isFirstOrderFreeDelivery,
          paymentReleased,
          canCustomerCancel,
          requiresRefundOnCancel,
          items,
          history,
          whatsappMessage,
          whatsappUrl: buildWhatsAppLink(whatsappNumber, whatsappMessage),
          refundWhatsappMessage:
            o.refundRequested || requiresRefundOnCancel ? refundWhatsappMessage : null,
          refundWhatsappUrl:
            o.refundRequested || requiresRefundOnCancel ? refundWhatsappUrl : null,
          pixKey: settingsMap.pix_key || '',
          pixInstructions: settingsMap.pix_instructions || '',
        };
      });

      res.json(enriched);
    } catch (error) {
      console.error('Erro ao listar pedidos do cliente:', error);
      res.status(500).json({ error: 'Erro ao carregar seus pedidos.' });
    }
  });

  app.get('/api/orders/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      await expireOverdueUnpaidOrders();
      const orderId = Number(req.params.id);
      const [order] = await db
        .select()
        .from(schema.orders)
        .where(eq(schema.orders.id, orderId));

      if (!order) {
        res.status(404).json({ error: 'Pedido não encontrado.' });
        return;
      }

      if (req.user!.role !== 'ADMIN' && order.userId !== req.user!.id) {
        res.status(403).json({ error: 'Acesso negado a este pedido.' });
        return;
      }

      const [orderCustomer] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, order.userId));

      const rawItems = await db
        .select()
        .from(schema.orderItems)
        .where(eq(schema.orderItems.orderId, order.id));
      const allImages = await db.select().from(schema.productImages);
      const items = rawItems.map((i) => {
        const prodImgs = allImages.filter((img) => img.productId === i.productId);
        const primary =
          prodImgs.find((im) => im.isPrimary && im.mediaType !== 'VIDEO') ||
          prodImgs.find((im) => im.mediaType !== 'VIDEO') ||
          prodImgs[0];
        return {
          ...i,
          imageUrl: primary ? primary.imageUrl : null,
        };
      });

      const history = await db
        .select()
        .from(schema.orderStatusHistory)
        .where(eq(schema.orderStatusHistory.orderId, order.id))
        .orderBy(desc(schema.orderStatusHistory.id));

      const settingsMap = await getSettingsMap();
      const whatsappNumber = settingsMap.whatsapp_number || '5511999999999';
      const isFirstOrderFreeDelivery = Boolean(
        order.usedFreeDeliveryTicket ||
          order.deliveryFeeSource === 'FREE_DELIVERY_TICKET' ||
          order.deliveryFeeSource === 'MANUAL_FREE_DELIVERY' ||
          order.isFirstOrderFreeDelivery ||
          order.deliveryFeeSource === 'FIRST_ORDER_FREE'
      );
      const whatsappMessage = buildOrderWhatsAppMessage({
        orderNumber: order.orderNumber,
        items,
        subtotal: order.subtotal,
        deliveryFee: order.deliveryFee,
        deliveryDistanceKm: order.deliveryDistanceKm,
        total: order.total,
        paymentMethod: order.paymentMethod,
        changeFor: order.changeFor,
        addressSnapshot: order.addressSnapshot,
        notes: order.notes,
        isFirstOrderFreeDelivery,
        usedFreeDeliveryTicket: Boolean(order.usedFreeDeliveryTicket),
        deliveryFeeSource: order.deliveryFeeSource,
      });

      const canCustomerCancel = CUSTOMER_CANCELLABLE_STATUSES.includes(order.status);
      const requiresRefundOnCancel = PAID_ORDER_STATUSES.includes(order.status);
      const paymentReleased = Boolean(
        isFirstOrderFreeDelivery ||
          (order.deliveryFee !== null &&
            order.deliveryFee !== undefined &&
            order.deliveryFee !== '')
      );
      const refundWhatsappMessage = buildRefundWhatsAppMessage({
        orderNumber: order.orderNumber,
        customerName: orderCustomer?.name || 'Cliente',
        customerPhone: orderCustomer?.phone || '',
        items,
        subtotal: order.subtotal,
        deliveryFee: order.deliveryFee,
        total: order.total,
        cancellationReason:
          order.cancellationReason || 'Solicito o cancelamento e estorno do valor pago.',
      });
      const refundWhatsappUrl = buildWhatsAppLink(whatsappNumber, refundWhatsappMessage);

      res.json({
        ...order,
        isFirstOrderFreeDelivery,
        paymentReleased,
        canCustomerCancel,
        requiresRefundOnCancel,
        items,
        history,
        whatsappMessage,
        whatsappUrl: buildWhatsAppLink(whatsappNumber, whatsappMessage),
        refundWhatsappMessage:
          order.refundRequested || requiresRefundOnCancel ? refundWhatsappMessage : null,
        refundWhatsappUrl:
          order.refundRequested || requiresRefundOnCancel ? refundWhatsappUrl : null,
        pixKey: settingsMap.pix_key || '',
        pixInstructions: settingsMap.pix_instructions || '',
      });
    } catch (error) {
      console.error('Erro ao abrir pedido:', error);
      res.status(500).json({ error: 'Erro ao carregar detalhes do pedido.' });
    }
  });

  // Cancelamento de Pedido pelo Cliente (Requisitos 1 e 2)
  app.post('/api/orders/:id/cancel', requireAuth, async (req: AuthRequest, res) => {
    try {
      const orderId = Number(req.params.id);
      const rawReason = req.body?.reason ?? req.body?.cancellationReason ?? '';
      const reasonText = String(rawReason).trim();

      const [existingOrder] = await db
        .select()
        .from(schema.orders)
        .where(eq(schema.orders.id, orderId));

      if (!existingOrder) {
        res.status(404).json({ error: 'Pedido não encontrado.' });
        return;
      }

      if (req.user!.role !== 'ADMIN' && existingOrder.userId !== req.user!.id) {
        res.status(403).json({ error: 'Você não tem permissão para cancelar este pedido.' });
        return;
      }

      if (existingOrder.status === 'OUT_FOR_DELIVERY') {
        res.status(400).json({
          error: 'Não é possível cancelar o pedido pois ele já saiu para entrega.',
        });
        return;
      }

      if (existingOrder.status === 'DELIVERED') {
        res.status(400).json({
          error: 'Não é possível cancelar um pedido que já foi entregue.',
        });
        return;
      }

      if (existingOrder.status === 'CANCELLED') {
        res.status(400).json({
          error: 'Este pedido já foi cancelado anteriormente.',
        });
        return;
      }

      const wasPaid =
        existingOrder.status === 'PAID' || existingOrder.status === 'PREPARING';

      const finalReason =
        reasonText ||
        (wasPaid
          ? 'Solicitação de cancelamento e estorno pelo cliente antes de sair para entrega.'
          : 'Cancelado pelo cliente antes do pagamento.');

      const result = await db.transaction(async (tx) => {
        const items = await tx
          .select()
          .from(schema.orderItems)
          .where(eq(schema.orderItems.orderId, existingOrder.id));

        // Devolve o saldo reservado para o estoque dos produtos e reativa na vitrine se estava zerado
        if (existingOrder.stockDeducted) {
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

        const [updatedOrder] = await tx
          .update(schema.orders)
          .set({
            status: 'CANCELLED',
            stockDeducted: false,
            paymentExpiresAt: null,
            cancellationReason: finalReason,
            refundRequested: wasPaid,
            updatedAt: new Date(),
          })
          .where(eq(schema.orders.id, existingOrder.id))
          .returning();

        await tx.insert(schema.orderStatusHistory).values({
          orderId: existingOrder.id,
          oldStatus: existingOrder.status,
          newStatus: 'CANCELLED',
          changedBy: req.user!.id,
        });

        const loyaltyAfterCancel = await evaluateCustomerLoyaltyTickets(
          existingOrder.userId,
          tx
        );

        return { updatedOrder, items, loyaltyAfterCancel };
      });

      const [customerUser] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, existingOrder.userId));
      const settingsMap = await getSettingsMap();
      const whatsappNumber = settingsMap.whatsapp_number || '5511999999999';

      let refundWhatsappMessage: string | null = null;
      let refundWhatsappUrl: string | null = null;

      if (wasPaid) {
        refundWhatsappMessage = buildRefundWhatsAppMessage({
          orderNumber: existingOrder.orderNumber,
          customerName: customerUser?.name || req.user!.name,
          customerPhone: customerUser?.phone || '',
          items: result.items,
          subtotal: existingOrder.subtotal,
          deliveryFee: existingOrder.deliveryFee,
          total: existingOrder.total,
          cancellationReason: finalReason,
        });
        refundWhatsappUrl = buildWhatsAppLink(whatsappNumber, refundWhatsappMessage);
      }

      res.json({
        ...result.updatedOrder,
        loyalty: result.loyaltyAfterCancel,
        canCustomerCancel: false,
        requiresRefundOnCancel: false,
        wasPaid,
        refundRequested: wasPaid,
        cancellationReason: finalReason,
        refundWhatsappMessage,
        refundWhatsappUrl,
      });
    } catch (error: any) {
      console.error('Erro ao cancelar pedido pelo cliente:', error);
      res.status(400).json({
        error: error.message || 'Não foi possível cancelar o pedido.',
      });
    }
  });

  // Notificações do Cliente
  app.get('/api/notifications', requireAuth, async (req: AuthRequest, res) => {
    try {
      const loyalty =
        req.user!.role === 'CUSTOMER'
          ? await evaluateCustomerLoyaltyTickets(req.user!.id)
          : null;
      const eligibleForFirstOrderFreeDelivery = loyalty ? loyalty.isFirstOrderEligible : false;

      const list =
        req.user!.role === 'CUSTOMER'
          ? await db
              .select()
              .from(schema.notifications)
              .where(eq(schema.notifications.userId, req.user!.id))
              .orderBy(desc(schema.notifications.id))
          : [];

      const unreadCount = list.filter((n) => !n.isRead).length;
      const activePopups = list.filter((n) => !n.popupDismissed);

      res.json({
        notifications: list,
        unreadCount,
        activePopups,
        eligibleForFirstOrderFreeDelivery,
        loyalty,
      });
    } catch (error) {
      console.error('Erro ao buscar notificações:', error);
      res.status(500).json({ error: 'Erro ao carregar notificações.' });
    }
  });

  app.put('/api/notifications/read-all', requireAuth, async (req: AuthRequest, res) => {
    try {
      await db
        .update(schema.notifications)
        .set({ isRead: true, popupDismissed: true })
        .where(eq(schema.notifications.userId, req.user!.id));

      res.json({ success: true });
    } catch (error) {
      console.error('Erro ao marcar todas notificações como lidas:', error);
      res.status(500).json({ error: 'Erro ao atualizar notificações.' });
    }
  });

  app.put('/api/notifications/:id/dismiss-popup', requireAuth, async (req: AuthRequest, res) => {
    try {
      const notifId = Number(req.params.id);
      const [updated] = await db
        .update(schema.notifications)
        .set({ popupDismissed: true })
        .where(
          and(
            eq(schema.notifications.id, notifId),
            eq(schema.notifications.userId, req.user!.id)
          )
        )
        .returning();

      res.json({ success: true, notification: updated || null });
    } catch (error) {
      console.error('Erro ao fechar pop-up de notificação:', error);
      res.status(500).json({ error: 'Erro ao fechar notificação.' });
    }
  });

  app.put('/api/notifications/:id/read', requireAuth, async (req: AuthRequest, res) => {
    try {
      const notifId = Number(req.params.id);
      const [updated] = await db
        .update(schema.notifications)
        .set({ isRead: true, popupDismissed: true })
        .where(
          and(
            eq(schema.notifications.id, notifId),
            eq(schema.notifications.userId, req.user!.id)
          )
        )
        .returning();

      res.json({ success: true, notification: updated || null });
    } catch (error) {
      console.error('Erro ao marcar notificação como lida:', error);
      res.status(500).json({ error: 'Erro ao atualizar notificação.' });
    }
  });
}
