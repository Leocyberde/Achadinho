import { Express } from 'express';
import bcrypt from 'bcryptjs';
import { eq, desc, and, sql } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import * as schema from '../../db/schema.ts';
import {
  resolveAddressFreight,
  calculateSuggestedFreight,
} from '../../services/freightService.ts';
import {
  buildOrderWhatsAppMessage,
  buildWhatsAppLink,
} from '../../utils/whatsapp.ts';
import { AuthRequest, requireAuth, requireAdmin } from '../middleware/auth.ts';
import {
  STOCK_DEDUCTED_STATUSES,
  PAID_ORDER_STATUSES,
  VALID_ORDER_STATUSES,
  ORDER_STATUS_LABELS_PT,
  computePaymentExpiresAt,
  buildStatusNotificationTexts,
  validateAndNormalizeCode,
  calculateDiscountPercent,
  parseAndValidateMediaItems,
  isPromoCurrentlyActive,
  resolvePromoTiming,
  resolvePromoMaxUnits,
  getSettingsMap,
  getFreightRuleConfig,
  getPrimaryStoreId,
} from '../services/storeHelpers.ts';
import { evaluateCustomerLoyaltyTickets } from '../services/loyaltyService.ts';
import { expireOverdueUnpaidOrders } from '../services/orderExpirationService.ts';

export function registerAdminRoutes(app: Express) {
  // Notificações do Admin (Requisito 3: Notificação de Novo Cliente com opção de já cadastrar o frete e a distância)
  app.get('/api/admin/notifications', requireAuth, requireAdmin, async (_req, res) => {
    try {
      const notifRows = await db
        .select()
        .from(schema.adminNotifications)
        .orderBy(desc(schema.adminNotifications.id));
      const allUsers = await db.select().from(schema.users);
      const allAddresses = await db.select().from(schema.addresses);
      const freightRule = await getFreightRuleConfig();
      const settingsMap = await getSettingsMap();

      const userMap = new Map(allUsers.map((u) => [u.id, u]));
      const addrMap = new Map(allAddresses.map((a) => [a.id, a]));

      const enriched = notifRows.map((n) => {
        const cust = userMap.get(n.customerId);
        const addr =
          (n.addressId ? addrMap.get(n.addressId) : null) ||
          allAddresses.find((a) => a.userId === n.customerId) ||
          null;

        return {
          ...n,
          customer: cust
            ? {
                id: cust.id,
                name: cust.name,
                cpf: cust.cpf,
                email: cust.email,
                phone: cust.phone,
                createdAt: cust.createdAt,
              }
            : null,
          address: addr
            ? {
                ...addr,
                freight: resolveAddressFreight(addr),
              }
            : null,
        };
      });

      res.json({
        notifications: enriched,
        unreadCount: enriched.filter((n) => !n.isRead).length,
        activePopups: enriched.filter((n) => !n.popupDismissed),
        freightRule,
        defaultOrigin: settingsMap.store_origin_address || 'Matriz Achadinhos',
      });
    } catch (error) {
      console.error('Erro ao buscar notificações do admin:', error);
      res.status(500).json({ error: 'Erro ao carregar notificações do painel admin.' });
    }
  });

  app.put(
    '/api/admin/notifications/:id/dismiss-popup',
    requireAuth,
    requireAdmin,
    async (req, res) => {
      try {
        const notifId = Number(req.params.id);
        const [updated] = await db
          .update(schema.adminNotifications)
          .set({ popupDismissed: true })
          .where(eq(schema.adminNotifications.id, notifId))
          .returning();
        res.json({ success: true, notification: updated || null });
      } catch (error) {
        console.error('Erro ao fechar pop-up de notificação admin:', error);
        res.status(500).json({ error: 'Erro ao fechar notificação.' });
      }
    }
  );

  app.put('/api/admin/notifications/:id/read', requireAuth, requireAdmin, async (req, res) => {
    try {
      const notifId = Number(req.params.id);
      const [updated] = await db
        .update(schema.adminNotifications)
        .set({ isRead: true, popupDismissed: true })
        .where(eq(schema.adminNotifications.id, notifId))
        .returning();
      res.json({ success: true, notification: updated || null });
    } catch (error) {
      console.error('Erro ao marcar notificação admin como lida:', error);
      res.status(500).json({ error: 'Erro ao atualizar notificação.' });
    }
  });

  app.put('/api/admin/notifications/read-all', requireAuth, requireAdmin, async (_req, res) => {
    try {
      await db
        .update(schema.adminNotifications)
        .set({ isRead: true, popupDismissed: true });
      res.json({ success: true });
    } catch (error) {
      console.error('Erro ao marcar todas notificações admin como lidas:', error);
      res.status(500).json({ error: 'Erro ao atualizar notificações.' });
    }
  });

  // Dashboard
  app.get('/api/admin/dashboard', requireAuth, requireAdmin, async (_req, res) => {
    try {
      await expireOverdueUnpaidOrders();
      const allProducts = await db.select().from(schema.products);
      const allUsers = await db.select().from(schema.users);
      const allOrders = await db.select().from(schema.orders).orderBy(desc(schema.orders.id));
      const allOrderItems = await db.select().from(schema.orderItems);
      const allImages = await db.select().from(schema.productImages);
      const allAddresses = await db
        .select()
        .from(schema.addresses)
        .orderBy(desc(schema.addresses.id));

      const userMap = new Map(allUsers.map((u) => [u.id, u]));
      const productCostMap = new Map(
        allProducts.map((p) => [p.id, parseFloat(String(p.cost || '0')) || 0])
      );

      const itemsByOrderId = new Map<number, typeof allOrderItems>();
      for (const item of allOrderItems) {
        const list = itemsByOrderId.get(item.orderId) || [];
        list.push(item);
        itemsByOrderId.set(item.orderId, list);
      }

      const computeFinancialSummary = (orderSubset: typeof allOrders) => {
        let productsRevenue = 0;
        let freightRevenue = 0;
        let totalRevenue = 0;
        let productsCost = 0;
        let itemsSoldCount = 0;

        for (const ord of orderSubset) {
          productsRevenue += parseFloat(ord.subtotal || '0') || 0;
          freightRevenue += parseFloat(ord.deliveryFee || '0') || 0;
          totalRevenue += parseFloat(ord.total || '0') || 0;

          const ordItems = itemsByOrderId.get(ord.id) || [];
          for (const it of ordItems) {
            const unitCost = productCostMap.get(it.productId) || 0;
            productsCost += unitCost * (it.quantity || 0);
            itemsSoldCount += it.quantity || 0;
          }
        }

        const netProfit = productsRevenue - productsCost;
        const profitMarginPercent =
          productsRevenue > 0 ? Number(((netProfit / productsRevenue) * 100).toFixed(1)) : 0;

        return {
          ordersCount: orderSubset.length,
          itemsSoldCount,
          productsRevenue: Number(productsRevenue.toFixed(2)),
          freightRevenue: Number(freightRevenue.toFixed(2)),
          totalRevenue: Number(totalRevenue.toFixed(2)),
          productsCost: Number(productsCost.toFixed(2)),
          netProfit: Number(netProfit.toFixed(2)),
          profitMarginPercent,
        };
      };

      const activeProducts = allProducts.filter((p) => p.status === 'ACTIVE' && p.stock > 0);
      const inactiveProducts = allProducts.filter((p) => p.status === 'INACTIVE' || p.stock <= 0);
      const lowStockProducts = allProducts.filter(
        (p) => p.status === 'ACTIVE' && p.stock > 0 && p.stock <= 5
      );
      const customers = allUsers.filter((u) => u.role === 'CUSTOMER');

      // PEDIDOS PENDENTES DE ENTREGA (Novo, Aguardando Pagamento, Pago, Em separação, Saiu para entrega)
      // Visão principal solicitada pelo Administrador: pedidos que precisam de ação/entrega
      const pendingDeliveryOrders = allOrders
        .filter((o) => o.status !== 'DELIVERED' && o.status !== 'CANCELLED')
        .sort((a, b) => b.id - a.id)
        .map((o) => {
          const owner = userMap.get(o.userId);
          const ordItems = (itemsByOrderId.get(o.id) || []).map((it) => {
            const pImgs = allImages.filter((img) => img.productId === it.productId);
            const primary =
              pImgs.find((im) => im.isPrimary && im.mediaType !== 'VIDEO') ||
              pImgs.find((im) => im.mediaType !== 'VIDEO') ||
              pImgs[0];
            return {
              ...it,
              imageUrl: primary ? primary.imageUrl : null,
            };
          });

          const customerPhone = owner ? owner.phone : '';
          const customerName = owner ? owner.name : 'Cliente';
          const customerWhatsappUrl = customerPhone
            ? buildWhatsAppLink(
                customerPhone,
                `Olá ${customerName}! Aqui é da loja Achadinhos sobre o seu pedido ${o.orderNumber} (Status: ${ORDER_STATUS_LABELS_PT[o.status] || o.status}).`
              )
            : '';

          return {
            ...o,
            customerName,
            customerPhone,
            customerEmail: owner ? owner.email : '',
            customerWhatsappUrl,
            items: ordItems,
          };
        });

      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      // CORREÇÃO CRÍTICA SOLICITADA PELO USUÁRIO:
      // Vendas do dia e do mês SÓ devem contabilizar pedidos que foram EFETIVAMENTE ENTREGUES ('DELIVERED').
      // Pedidos pendentes/aguardando entrega não somam em vendas realizadas.
      const deliveredOrdersToday = allOrders.filter(
        (o) => new Date(o.createdAt) >= startOfToday && o.status === 'DELIVERED'
      );
      const salesTodayTotal = deliveredOrdersToday.reduce(
        (acc, o) => acc + parseFloat(o.total || '0'),
        0
      );

      const deliveredOrdersMonth = allOrders.filter(
        (o) => new Date(o.createdAt) >= startOfMonth && o.status === 'DELIVERED'
      );
      const salesMonthTotal = deliveredOrdersMonth.reduce(
        (acc, o) => acc + parseFloat(o.total || '0'),
        0
      );

      const deliveredOrdersAllTime = allOrders.filter((o) => o.status === 'DELIVERED');

      const todayFinancials = computeFinancialSummary(deliveredOrdersToday);
      const monthFinancials = computeFinancialSummary(deliveredOrdersMonth);
      const allTimeFinancials = computeFinancialSummary(deliveredOrdersAllTime);

      // Avaliação financeira do estoque atual na prateleira
      let totalStockUnits = 0;
      let totalInventoryCost = 0;
      let totalInventorySaleValue = 0;
      for (const p of allProducts) {
        if (p.stock > 0) {
          const c = parseFloat(String(p.cost || '0').replace(',', '.')) || 0;
          const s = isPromoCurrentlyActive(p) && p.promoPrice
            ? parseFloat(String(p.promoPrice).replace(',', '.')) || 0
            : parseFloat(String(p.price || '0').replace(',', '.')) || 0;
          totalStockUnits += p.stock;
          totalInventoryCost += c * p.stock;
          totalInventorySaleValue += s * p.stock;
        }
      }
      const inventoryValuation = {
        totalStockUnits,
        totalInventoryCost: Number(totalInventoryCost.toFixed(2)),
        totalInventorySaleValue: Number(totalInventorySaleValue.toFixed(2)),
        projectedInventoryProfit: Number((totalInventorySaleValue - totalInventoryCost).toFixed(2)),
      };

      const pendingFreightAddresses = allAddresses
        .filter((a) => a.deliveryFeeStatus === 'PENDING')
        .map((a) => {
          const owner = userMap.get(a.userId);
          return {
            ...a,
            customerName: owner ? owner.name : 'Cliente',
            customerPhone: owner ? owner.phone : '',
            customerEmail: owner ? owner.email : '',
          };
        });

      const pendingFreightOrders = allOrders
        .filter((o) => o.deliveryFee === null && o.status !== 'CANCELLED')
        .map((o) => {
          const owner = userMap.get(o.userId);
          return {
            ...o,
            customerName: owner ? owner.name : 'Cliente',
            customerPhone: owner ? owner.phone : '',
          };
        });

      res.json({
        metrics: {
          activeProductsCount: activeProducts.length,
          inactiveProductsCount: inactiveProducts.length,
          lowStockCount: lowStockProducts.length,
          customersCount: customers.length,
          pendingOrdersCount: pendingDeliveryOrders.length,
          deliveredOrdersCount: deliveredOrdersAllTime.length,
          ordersTodayCount: deliveredOrdersToday.length,
          salesTodayTotal: Number(salesTodayTotal.toFixed(2)),
          salesMonthTotal: Number(salesMonthTotal.toFixed(2)),
          profitTodayTotal: todayFinancials.netProfit,
          profitMonthTotal: monthFinancials.netProfit,
          costTodayTotal: todayFinancials.productsCost,
          costMonthTotal: monthFinancials.productsCost,
        },
        pendingDeliveryOrders,
        financials: {
          today: todayFinancials,
          month: monthFinancials,
          allTime: allTimeFinancials,
          inventory: inventoryValuation,
        },
        lowStockProducts,
        inactiveProducts,
        alerts: {
          pendingFreightAddresses,
          pendingFreightOrders,
        },
      });
    } catch (error) {
      console.error('Erro no dashboard admin:', error);
      res.status(500).json({ error: 'Erro ao carregar indicadores do dashboard.' });
    }
  });

  // ============================================================================
  // ANÁLISE DE LUCRO POR PRODUTO & RANKING DE VENDAS (REQUISITO 2)
  // ============================================================================
  app.get('/api/admin/analytics/products', requireAuth, requireAdmin, async (_req, res) => {
    try {
      const allProducts = await db.select().from(schema.products);
      const allCategories = await db.select().from(schema.categories);
      const allImages = await db.select().from(schema.productImages);
      const allOrders = await db.select().from(schema.orders);
      const allOrderItems = await db.select().from(schema.orderItems);

      const categoryMap = new Map(allCategories.map((c) => [c.id, c.name]));
      const deliveredOrdersSet = new Set(
        allOrders.filter((o) => o.status === 'DELIVERED').map((o) => o.id)
      );

      // Total de vendas por produto em pedidos entregues
      const salesByProduct = new Map<
        number,
        {
          unitsSold: number;
          totalRevenue: number;
          totalCost: number;
          ordersCount: number;
        }
      >();

      for (const it of allOrderItems) {
        if (!deliveredOrdersSet.has(it.orderId)) continue;
        const current = salesByProduct.get(it.productId) || {
          unitsSold: 0,
          totalRevenue: 0,
          totalCost: 0,
          ordersCount: 0,
        };
        current.unitsSold += it.quantity;
        current.totalRevenue += parseFloat(it.subtotal || '0') || 0;
        current.ordersCount += 1;
        salesByProduct.set(it.productId, current);
      }

      let totalStockUnits = 0;
      let totalStockCost = 0;
      let totalStockSaleValue = 0;
      let totalRealizedProfitAll = 0;
      let totalDeliveredUnitsAll = 0;

      const analyzedProducts = allProducts.map((p) => {
        const costNum = parseFloat(String(p.cost || '0').replace(',', '.')) || 0;
        const priceNum = parseFloat(String(p.price || '0').replace(',', '.')) || 0;
        const promoActive = isPromoCurrentlyActive(p);
        const promoNum = promoActive && p.promoPrice ? parseFloat(String(p.promoPrice).replace(',', '.')) : null;
        const effectivePrice = promoNum !== null ? promoNum : priceNum;

        const hasCostDefined = costNum > 0;
        let unitProfit = 0;
        let unitMarginPercent = 0;
        let markupPercent = 0;
        let marginStatus: 'NO_COST' | 'ZERO_PROFIT' | 'PROFITABLE' = 'NO_COST';

        if (hasCostDefined) {
          if (costNum >= effectivePrice) {
            unitProfit = 0;
            unitMarginPercent = 0;
            markupPercent = 0;
            marginStatus = 'ZERO_PROFIT';
          } else {
            unitProfit = Number((effectivePrice - costNum).toFixed(2));
            unitMarginPercent =
              effectivePrice > 0 ? Number(((unitProfit / effectivePrice) * 100).toFixed(1)) : 0;
            markupPercent = Number(((unitProfit / costNum) * 100).toFixed(1));
            marginStatus = 'PROFITABLE';
          }
        }

        const potentialStockProfit = Number((unitProfit * p.stock).toFixed(2));

        if (p.stock > 0) {
          totalStockUnits += p.stock;
          totalStockCost += costNum * p.stock;
          totalStockSaleValue += effectivePrice * p.stock;
        }

        const stats = salesByProduct.get(p.id) || {
          unitsSold: 0,
          totalRevenue: 0,
          totalCost: 0,
          ordersCount: 0,
        };

        const totalCostOfDelivered = costNum * stats.unitsSold;
        const realizedProfit = Number((stats.totalRevenue - totalCostOfDelivered).toFixed(2));

        totalRealizedProfitAll += realizedProfit;
        totalDeliveredUnitsAll += stats.unitsSold;

        const pImgs = allImages.filter((im) => im.productId === p.id);
        const primary =
          pImgs.find((im) => im.isPrimary && im.mediaType !== 'VIDEO') ||
          pImgs.find((im) => im.mediaType !== 'VIDEO') ||
          pImgs[0];

        return {
          id: p.id,
          code: p.code,
          name: p.name,
          categoryName: categoryMap.get(p.categoryId) || 'Geral',
          imageUrl: primary ? primary.imageUrl : null,
          status: p.status,
          stock: p.stock,
          isKit: p.isKit,
          cost: costNum,
          price: priceNum,
          promoPrice: promoNum,
          hasPromo: promoActive,
          effectivePrice,
          hasCostDefined,
          marginStatus,
          markupPercent,
          unitProfit,
          unitMarginPercent,
          potentialStockProfit,
          viewsCount: p.viewsCount || 0,
          clicksCount: p.clicksCount || 0,
          sharesCount: p.sharesCount || 0,
          conversionRatePercent:
            (p.viewsCount || 0) > 0 && stats.unitsSold > 0
              ? Number(((stats.unitsSold / (p.viewsCount || 1)) * 100).toFixed(1))
              : 0,
          unitsSold: stats.unitsSold,
          revenue: Number(stats.totalRevenue.toFixed(2)),
          realizedProfit,
          ordersCount: stats.ordersCount,
        };
      });

      // Rankings
      const rankingBestSellers = [...analyzedProducts]
        .sort((a, b) => b.unitsSold - a.unitsSold || b.revenue - a.revenue)
        .slice(0, 10);

      const rankingMostProfitable = [...analyzedProducts]
        .sort((a, b) => b.realizedProfit - a.realizedProfit || b.unitsSold - a.unitsSold)
        .slice(0, 10);

      const rankingHighestMargin = [...analyzedProducts]
        .filter((p) => p.status === 'ACTIVE')
        .sort((a, b) => b.unitMarginPercent - a.unitMarginPercent || b.unitProfit - a.unitProfit)
        .slice(0, 10);

      const rankingMostViewed = [...analyzedProducts]
        .sort((a, b) => b.viewsCount - a.viewsCount || b.clicksCount - a.clicksCount)
        .slice(0, 10);

      const rankingMostClicked = [...analyzedProducts]
        .sort((a, b) => b.clicksCount - a.clicksCount || b.viewsCount - a.viewsCount)
        .slice(0, 10);

      const rankingMostShared = [...analyzedProducts]
        .sort((a, b) => b.sharesCount - a.sharesCount || b.viewsCount - a.viewsCount)
        .slice(0, 10);

      res.json({
        summary: {
          totalProducts: allProducts.length,
          totalProductsWithCost: analyzedProducts.filter((p) => p.hasCostDefined).length,
          totalStockUnits,
          totalStockCost: Number(totalStockCost.toFixed(2)),
          totalStockSaleValue: Number(totalStockSaleValue.toFixed(2)),
          potentialInventoryProfit: Number((totalStockSaleValue - totalStockCost).toFixed(2)),
          averageMarginPercent:
            totalStockSaleValue > 0
              ? Number((((totalStockSaleValue - totalStockCost) / totalStockSaleValue) * 100).toFixed(1))
              : 0,
          totalRealizedProfitAll: Number(totalRealizedProfitAll.toFixed(2)),
          totalDeliveredUnitsAll,
          totalViewsAll: analyzedProducts.reduce((acc, p) => acc + (p.viewsCount || 0), 0),
          totalClicksAll: analyzedProducts.reduce((acc, p) => acc + (p.clicksCount || 0), 0),
          totalSharesAll: analyzedProducts.reduce((acc, p) => acc + (p.sharesCount || 0), 0),
        },
        products: analyzedProducts,
        rankingBestSellers,
        rankingMostProfitable,
        rankingHighestMargin,
        rankingMostViewed,
        rankingMostClicked,
        rankingMostShared,
      });
    } catch (error: any) {
      console.error('Erro na análise de produtos e ranking:', error);
      res.status(500).json({ error: error.message || 'Erro ao carregar análise de produtos.' });
    }
  });

  // Admin: Categorias
  app.get('/api/admin/categories', requireAuth, requireAdmin, async (_req, res) => {
    try {
      const list = await db
        .select()
        .from(schema.categories)
        .orderBy(desc(schema.categories.id));
      res.json(list);
    } catch (error) {
      console.error('Erro ao listar categorias:', error);
      res.status(500).json({ error: 'Erro ao listar categorias.' });
    }
  });

  app.post('/api/admin/categories', requireAuth, requireAdmin, async (req, res) => {
    try {
      const { name, description, status } = req.body;
      if (!name || !String(name).trim()) {
        res.status(400).json({ error: 'Informe o nome da categoria.' });
        return;
      }
      const storeId = await getPrimaryStoreId();
      const [created] = await db
        .insert(schema.categories)
        .values({
          storeId,
          name: String(name).trim(),
          description: description ? String(description).trim() : null,
          status: status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
        })
        .returning();
      res.status(201).json(created);
    } catch (error) {
      console.error('Erro ao criar categoria:', error);
      res.status(500).json({ error: 'Erro ao criar categoria.' });
    }
  });

  app.put('/api/admin/categories/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
      const catId = Number(req.params.id);
      const { name, description, status } = req.body;
      if (!name || !String(name).trim()) {
        res.status(400).json({ error: 'Informe o nome da categoria.' });
        return;
      }
      const [updated] = await db
        .update(schema.categories)
        .set({
          name: String(name).trim(),
          description: description ? String(description).trim() : null,
          status: status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
          updatedAt: new Date(),
        })
        .where(eq(schema.categories.id, catId))
        .returning();
      res.json(updated);
    } catch (error) {
      console.error('Erro ao editar categoria:', error);
      res.status(500).json({ error: 'Erro ao editar categoria.' });
    }
  });

  // Admin: Produtos e Kits
  app.get('/api/admin/products', requireAuth, requireAdmin, async (_req, res) => {
    try {
      await expireOverdueUnpaidOrders();
      // Garantir que qualquer produto com estoque zerado (<= 0) fique com status INACTIVE
      await db
        .update(schema.products)
        .set({ status: 'INACTIVE', updatedAt: new Date() })
        .where(and(eq(schema.products.status, 'ACTIVE'), sql`${schema.products.stock} <= 0`));

      const allProducts = await db
        .select()
        .from(schema.products)
        .orderBy(desc(schema.products.id));
      const allCategories = await db.select().from(schema.categories);
      const allImages = await db.select().from(schema.productImages);
      const allKitItems = await db.select().from(schema.productKitItems);

      const catMap = new Map(allCategories.map((c) => [c.id, c.name]));
      const prodMap = new Map(allProducts.map((p) => [p.id, p]));

      const enriched = allProducts.map((p) => {
        const imgs = allImages.filter((i) => i.productId === p.id);
        const primary =
          imgs.find((i) => i.isPrimary && i.mediaType !== 'VIDEO') ||
          imgs.find((i) => i.mediaType !== 'VIDEO') ||
          imgs[0];
        const hasPromo = isPromoCurrentlyActive(p);
        const promoExpired = Boolean(
          p.promoActive &&
            p.promoPrice &&
            p.promoEndsAt &&
            new Date(p.promoEndsAt).getTime() <= Date.now()
        );
        const effectivePrice = hasPromo ? String(p.promoPrice) : String(p.price);
        const discountPercent = calculateDiscountPercent(p.price, p.promoPrice, hasPromo);

        const kitComponents = p.isKit
          ? allKitItems
              .filter((k) => k.kitProductId === p.id)
              .map((k) => {
                const comp = prodMap.get(k.componentProductId);
                return {
                  id: k.id,
                  componentProductId: k.componentProductId,
                  componentCode: comp?.code || '',
                  componentName: comp?.name || 'Produto',
                  quantityPerKit: k.quantityPerKit,
                  totalReservedInKit: p.stock * k.quantityPerKit,
                };
              })
          : [];

        return {
          ...p,
          hasPromo,
          promoExpired,
          effectivePrice,
          discountPercent,
          kitComponents,
          categoryName: catMap.get(p.categoryId) || 'Sem categoria',
          imageUrl: primary ? primary.imageUrl : null,
          images: imgs,
        };
      });

      res.json(enriched);
    } catch (error) {
      console.error('Erro ao listar produtos no admin:', error);
      res.status(500).json({ error: 'Erro ao listar produtos.' });
    }
  });

  app.post('/api/admin/products', requireAuth, requireAdmin, async (req, res) => {
    try {
      const {
        categoryId,
        code,
        name,
        description,
        price,
        promoPrice,
        promoActive,
        cost,
        stock,
        weight,
        status,
      } = req.body;

      if (!categoryId || !name || price === undefined || price === '') {
        res.status(400).json({ error: 'Nome, categoria e preço são obrigatórios.' });
        return;
      }

      const normalizedCode = code
        ? validateAndNormalizeCode(code)
        : `A${String(Math.floor(100 + Math.random() * 900))}`;

      if (!normalizedCode) {
        res.status(400).json({
          error:
            'Código do produto inválido. Use até 4 caracteres: 1 letra seguida de até 3 números (ex: A001, B12, P105).',
        });
        return;
      }

      const storeId = await getPrimaryStoreId();
      const priceNum = Math.max(0, parseFloat(String(price).replace(',', '.')) || 0);
      const rawPromo =
        promoPrice !== undefined && promoPrice !== null && String(promoPrice).trim() !== ''
          ? parseFloat(String(promoPrice).replace(',', '.'))
          : null;
      const isPromoValid = rawPromo !== null && !isNaN(rawPromo) && rawPromo > 0;
      const finalPromoPrice = isPromoValid ? rawPromo.toFixed(2) : null;
      const finalPromoActive = Boolean(promoActive) && isPromoValid;
      const { promoEndsAt, promoDurationHours } = resolvePromoTiming(
        req.body,
        finalPromoActive,
        null
      );
      const promoMaxUnits = resolvePromoMaxUnits(req.body, finalPromoActive);

      const costNum = Math.max(0, parseFloat(String(cost || '0').replace(',', '.')) || 0);
      const stockNum = Math.max(0, Math.floor(Number(stock) || 0));
      const weightNum = Math.max(0, parseFloat(String(weight || '0').replace(',', '.')) || 0);

      const parsedMedia = parseAndValidateMediaItems(req.body);

      const [created] = await db
        .insert(schema.products)
        .values({
          storeId,
          categoryId: Number(categoryId),
          code: normalizedCode,
          name: String(name).trim(),
          description: description ? String(description).trim() : null,
          price: priceNum.toFixed(2),
          promoPrice: finalPromoPrice,
          promoActive: finalPromoActive,
          promoEndsAt,
          promoDurationHours,
          promoMaxUnits,
          isKit: false,
          cost: costNum.toFixed(2),
          stock: stockNum,
          weight: weightNum.toFixed(3),
          status: stockNum <= 0 || status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
        })
        .returning();

      if (parsedMedia && parsedMedia.length > 0) {
        for (const m of parsedMedia) {
          await db.insert(schema.productImages).values({
            productId: created.id,
            imageUrl: m.imageUrl,
            mediaType: m.mediaType,
            durationSeconds: m.durationSeconds,
            isPrimary: m.isPrimary,
          });
        }
      }

      res.status(201).json(created);
    } catch (error: any) {
      console.error('Erro ao cadastrar produto:', error);
      res.status(400).json({ error: error.message || 'Erro ao cadastrar produto.' });
    }
  });

  app.put('/api/admin/products/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
      const prodId = Number(req.params.id);
      const {
        categoryId,
        code,
        name,
        description,
        price,
        promoPrice,
        promoActive,
        cost,
        stock,
        weight,
        status,
      } = req.body;

      if (!categoryId || !name || price === undefined || price === '') {
        res.status(400).json({ error: 'Nome, categoria e preço são obrigatórios.' });
        return;
      }

      const [existingProd] = await db
        .select()
        .from(schema.products)
        .where(eq(schema.products.id, prodId));

      if (!existingProd) {
        res.status(404).json({ error: 'Produto não encontrado.' });
        return;
      }

      const normalizedCode = code
        ? validateAndNormalizeCode(code)
        : existingProd.code || 'A001';

      if (!normalizedCode) {
        res.status(400).json({
          error:
            'Código do produto inválido. Use até 4 caracteres: 1 letra seguida de até 3 números (ex: A001, B12, P105).',
        });
        return;
      }

      const priceNum = Math.max(0, parseFloat(String(price).replace(',', '.')) || 0);
      const rawPromo =
        promoPrice !== undefined && promoPrice !== null && String(promoPrice).trim() !== ''
          ? parseFloat(String(promoPrice).replace(',', '.'))
          : null;
      const isPromoValid = rawPromo !== null && !isNaN(rawPromo) && rawPromo > 0;
      const finalPromoPrice = isPromoValid ? rawPromo.toFixed(2) : null;
      const finalPromoActive = Boolean(promoActive) && isPromoValid;
      const { promoEndsAt, promoDurationHours } = resolvePromoTiming(
        req.body,
        finalPromoActive,
        existingProd
      );
      const promoMaxUnits = resolvePromoMaxUnits(req.body, finalPromoActive);

      const costNum = Math.max(0, parseFloat(String(cost || '0').replace(',', '.')) || 0);
      const stockNum = Math.max(0, Math.floor(Number(stock) || 0));
      const weightNum = Math.max(0, parseFloat(String(weight || '0').replace(',', '.')) || 0);

      const parsedMedia = parseAndValidateMediaItems(req.body);

      const [updated] = await db
        .update(schema.products)
        .set({
          categoryId: Number(categoryId),
          code: normalizedCode,
          name: String(name).trim(),
          description: description ? String(description).trim() : null,
          price: priceNum.toFixed(2),
          promoPrice: finalPromoPrice,
          promoActive: finalPromoActive,
          promoEndsAt,
          promoDurationHours,
          promoMaxUnits,
          cost: costNum.toFixed(2),
          stock: stockNum,
          weight: weightNum.toFixed(3),
          status: stockNum <= 0 || status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
          updatedAt: new Date(),
        })
        .where(eq(schema.products.id, prodId))
        .returning();

      if (parsedMedia !== null) {
        await db
          .delete(schema.productImages)
          .where(eq(schema.productImages.productId, prodId));
        for (const m of parsedMedia) {
          await db.insert(schema.productImages).values({
            productId: prodId,
            imageUrl: m.imageUrl,
            mediaType: m.mediaType,
            durationSeconds: m.durationSeconds,
            isPrimary: m.isPrimary,
          });
        }
      }

      res.json(updated);
    } catch (error: any) {
      console.error('Erro ao atualizar produto:', error);
      res.status(400).json({ error: error.message || 'Erro ao atualizar produto.' });
    }
  });

  // Requisito 1: Editar estoque de produto inativo/zerado e deixá-lo ATIVO novamente na vitrine
  app.put(
    '/api/admin/products/:id/activate-stock',
    requireAuth,
    requireAdmin,
    async (req, res) => {
      try {
        const prodId = Number(req.params.id);
        const stockNum = Math.floor(Number(req.body.stock));

        if (isNaN(stockNum) || stockNum <= 0) {
          res.status(400).json({
            error:
              'Informe uma quantidade de estoque maior que zero para reativar o produto na vitrine.',
          });
          return;
        }

        const [existingProd] = await db
          .select()
          .from(schema.products)
          .where(eq(schema.products.id, prodId));

        if (!existingProd) {
          res.status(404).json({ error: 'Produto não encontrado.' });
          return;
        }

        const [updated] = await db
          .update(schema.products)
          .set({
            stock: stockNum,
            status: 'ACTIVE',
            updatedAt: new Date(),
          })
          .where(eq(schema.products.id, prodId))
          .returning();

        res.json(updated);
      } catch (error: any) {
        console.error('Erro ao ativar estoque do produto:', error);
        res.status(400).json({ error: error.message || 'Erro ao ativar produto.' });
      }
    }
  );

  // Montar Kit & Desfazer Kit
  app.post('/api/admin/kits', requireAuth, requireAdmin, async (req, res) => {
    try {
      const {
        categoryId,
        code,
        name,
        description,
        price,
        promoPrice,
        promoActive,
        cost,
        kitsQuantity,
        weight,
        components,
      } = req.body;

      if (!categoryId || !name || price === undefined || price === '') {
        res.status(400).json({ error: 'Informe nome, categoria e preço do Kit.' });
        return;
      }

      if (!Array.isArray(components) || components.length === 0) {
        res.status(400).json({
          error: 'Selecione pelo menos um produto da loja e a quantidade para montar o Kit.',
        });
        return;
      }

      const normalizedCode = code
        ? validateAndNormalizeCode(code)
        : `K${String(Math.floor(100 + Math.random() * 900))}`;

      if (!normalizedCode) {
        res.status(400).json({
          error:
            'Código do Kit inválido. Use até 4 caracteres: 1 letra seguida de até 3 números (ex: K001).',
        });
        return;
      }

      const kitsCount = Math.max(1, Math.floor(Number(kitsQuantity) || 1));
      const storeId = await getPrimaryStoreId();

      const priceNum = Math.max(0, parseFloat(String(price).replace(',', '.')) || 0);
      const rawPromo =
        promoPrice !== undefined && promoPrice !== null && String(promoPrice).trim() !== ''
          ? parseFloat(String(promoPrice).replace(',', '.'))
          : null;
      const isPromoValid = rawPromo !== null && !isNaN(rawPromo) && rawPromo > 0;
      const finalPromoPrice = isPromoValid ? rawPromo.toFixed(2) : null;
      const finalPromoActive = Boolean(promoActive) && isPromoValid;
      const { promoEndsAt, promoDurationHours } = resolvePromoTiming(
        req.body,
        finalPromoActive,
        null
      );
      const promoMaxUnits = resolvePromoMaxUnits(req.body, finalPromoActive);
      const weightNum = Math.max(0, parseFloat(String(weight || '0').replace(',', '.')) || 0);

      const createdKit = await db.transaction(async (tx) => {
        let calculatedCostPerKit = 0;
        const validatedComponents: Array<{
          productId: number;
          quantityPerKit: number;
          totalDeducted: number;
          name: string;
          code: string;
        }> = [];

        for (const comp of components) {
          const compProdId = Number(comp.productId);
          const qtyPerKit = Math.floor(Number(comp.quantityPerKit));

          if (!compProdId || isNaN(qtyPerKit) || qtyPerKit <= 0) {
            throw new Error('Quantidade inválida para um dos produtos do Kit.');
          }

          const [prod] = await tx
            .select()
            .from(schema.products)
            .where(eq(schema.products.id, compProdId));

          if (!prod) {
            throw new Error(`Produto #${compProdId} não encontrado.`);
          }

          const totalToDeduct = qtyPerKit * kitsCount;
          if (prod.stock < totalToDeduct) {
            throw new Error(
              `Estoque insuficiente em "${prod.code} - ${prod.name}". Saldo atual: ${prod.stock} un. Necessário para montar o kit: ${totalToDeduct} un.`
            );
          }

          const nextCompStock = prod.stock - totalToDeduct;
          const updatedStock = await tx
            .update(schema.products)
            .set({
              stock: sql`${schema.products.stock} - ${totalToDeduct}`,
              status: nextCompStock <= 0 ? 'INACTIVE' : prod.status,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(schema.products.id, prod.id),
                sql`${schema.products.stock} >= ${totalToDeduct}`
              )
            )
            .returning();

          if (updatedStock.length === 0) {
            throw new Error(
              `Não foi possível reservar o estoque do produto "${prod.code} - ${prod.name}".`
            );
          }

          calculatedCostPerKit += parseFloat(String(prod.cost || '0')) * qtyPerKit;
          validatedComponents.push({
            productId: prod.id,
            quantityPerKit: qtyPerKit,
            totalDeducted: totalToDeduct,
            name: prod.name,
            code: prod.code,
          });
        }

        const finalCostNum =
          cost !== undefined && cost !== '' && !isNaN(parseFloat(String(cost).replace(',', '.')))
            ? Math.max(0, parseFloat(String(cost).replace(',', '.')))
            : calculatedCostPerKit;

        const autoDesc =
          description && String(description).trim()
            ? String(description).trim()
            : `Kit composto por: ${validatedComponents
                .map((c) => `${c.quantityPerKit}x ${c.code} - ${c.name}`)
                .join(', ')}.`;

        const [kitProd] = await tx
          .insert(schema.products)
          .values({
            storeId,
            categoryId: Number(categoryId),
            code: normalizedCode,
            name: String(name).trim(),
            description: autoDesc,
            price: priceNum.toFixed(2),
            promoPrice: finalPromoPrice,
            promoActive: finalPromoActive,
            promoEndsAt,
            promoDurationHours,
            promoMaxUnits,
            isKit: true,
            cost: finalCostNum.toFixed(2),
            stock: kitsCount,
            weight: weightNum.toFixed(3),
            status: 'ACTIVE',
          })
          .returning();

        for (const vc of validatedComponents) {
          await tx.insert(schema.productKitItems).values({
            kitProductId: kitProd.id,
            componentProductId: vc.productId,
            quantityPerKit: vc.quantityPerKit,
          });
        }

        const parsedKitMedia = parseAndValidateMediaItems(req.body);
        if (parsedKitMedia && parsedKitMedia.length > 0) {
          for (const m of parsedKitMedia) {
            await tx.insert(schema.productImages).values({
              productId: kitProd.id,
              imageUrl: m.imageUrl,
              mediaType: m.mediaType,
              durationSeconds: m.durationSeconds,
              isPrimary: m.isPrimary,
            });
          }
        }

        return {
          kit: kitProd,
          deductedComponents: validatedComponents,
        };
      });

      res.status(201).json(createdKit);
    } catch (error: any) {
      console.error('Erro ao montar kit:', error);
      res.status(400).json({ error: error.message || 'Erro ao montar Kit.' });
    }
  });

  // Desfazer Kit: devolve o saldo reservado de volta para os produtos originais
  app.post('/api/admin/kits/:id/disassemble', requireAuth, requireAdmin, async (req, res) => {
    try {
      const kitId = Number(req.params.id);

      const result = await db.transaction(async (tx) => {
        const [kit] = await tx
          .select()
          .from(schema.products)
          .where(eq(schema.products.id, kitId));

        if (!kit || !kit.isKit) {
          throw new Error('Kit não encontrado.');
        }

        const kitItems = await tx
          .select()
          .from(schema.productKitItems)
          .where(eq(schema.productKitItems.kitProductId, kit.id));

        const restoredDetails: Array<{ productId: number; restoredQty: number }> = [];

        if (kit.stock > 0 && kitItems.length > 0) {
          for (const item of kitItems) {
            const qtyToReturn = kit.stock * item.quantityPerKit;
            if (qtyToReturn > 0) {
              await tx
                .update(schema.products)
                .set({
                  stock: sql`${schema.products.stock} + ${qtyToReturn}`,
                  updatedAt: new Date(),
                })
                .where(eq(schema.products.id, item.componentProductId));

              restoredDetails.push({
                productId: item.componentProductId,
                restoredQty: qtyToReturn,
              });
            }
          }
        }

        const usedInOrders = await tx
          .select()
          .from(schema.orderItems)
          .where(eq(schema.orderItems.productId, kit.id));

        if (usedInOrders.length === 0) {
          await tx
            .delete(schema.productKitItems)
            .where(eq(schema.productKitItems.kitProductId, kit.id));
          await tx.delete(schema.products).where(eq(schema.products.id, kit.id));
        } else {
          await tx
            .delete(schema.productKitItems)
            .where(eq(schema.productKitItems.kitProductId, kit.id));
          await tx
            .update(schema.products)
            .set({
              stock: 0,
              status: 'INACTIVE',
              isKit: false,
              updatedAt: new Date(),
            })
            .where(eq(schema.products.id, kit.id));
        }

        return {
          kitName: kit.name,
          restoredDetails,
        };
      });

      res.json({
        message: `Kit "${result.kitName}" desfeito com sucesso! Os saldos voltaram para o estoque dos produtos originais.`,
        ...result,
      });
    } catch (error: any) {
      console.error('Erro ao desfazer kit:', error);
      res.status(400).json({ error: error.message || 'Erro ao desfazer Kit.' });
    }
  });

  // Admin: Clientes & Endereços & Frete Manual
  app.get('/api/admin/customers', requireAuth, requireAdmin, async (_req, res) => {
    try {
      const allUsers = await db
        .select()
        .from(schema.users)
        .orderBy(desc(schema.users.id));
      const allAddresses = await db
        .select()
        .from(schema.addresses)
        .orderBy(desc(schema.addresses.id));
      const allOrders = await db.select().from(schema.orders);

      const userMap = new Map(allUsers.map((u) => [u.id, u.name]));
      const freightRule = await getFreightRuleConfig();
      const settingsMap = await getSettingsMap();

      const customerUsers = allUsers.filter((u) => u.role === 'CUSTOMER');
      const customers = await Promise.all(
        customerUsers.map(async (u) => {
          const addrs = allAddresses
            .filter((a) => a.userId === u.id)
            .map((a) => ({
              ...a,
              updatedByName: a.deliveryUpdatedBy
                ? userMap.get(a.deliveryUpdatedBy) || 'Admin'
                : null,
              freight: resolveAddressFreight(a),
            }));
          const userOrders = allOrders.filter((o) => o.userId === u.id);
          const loyalty = await evaluateCustomerLoyaltyTickets(u.id);
          return {
            id: u.id,
            name: u.name,
            cpf: u.cpf,
            email: u.email,
            phone: u.phone,
            status: u.status,
            createdAt: u.createdAt,
            addresses: addrs,
            ordersCount: userOrders.length,
            freeDeliveryTickets: loyalty.freeDeliveryTickets,
            loyalty,
          };
        })
      );

      res.json({
        customers,
        freightRule,
        defaultOrigin: settingsMap.store_origin_address || 'Matriz Achadinhos',
      });
    } catch (error) {
      console.error('Erro ao listar clientes no admin:', error);
      res.status(500).json({ error: 'Erro ao carregar clientes e endereços.' });
    }
  });

  const handleAdminCustomerFreeDelivery = async (req: AuthRequest, res: any) => {
    try {
      const customerId = Number(req.params.id);
      const { action = 'GRANT', amount = 1, tickets } = req.body || {};

      const [customer] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, customerId));

      if (!customer || customer.role !== 'CUSTOMER') {
        res.status(404).json({ error: 'Cliente não encontrado.' });
        return;
      }

      const currentLoyalty = await evaluateCustomerLoyaltyTickets(customerId);
      let nextManualTickets = currentLoyalty.manualFreeDeliveryTickets;
      let grantedTicketsCount = 0;

      if (action === 'SET') {
        const rawTarget = tickets !== undefined && tickets !== null ? tickets : amount;
        const targetAvailable = Math.max(0, Math.floor(Number(rawTarget) || 0));
        const baseNet =
          currentLoyalty.earnedAutoTickets - currentLoyalty.usedFreeDeliveryTickets;
        nextManualTickets = targetAvailable - baseNet;
        grantedTicketsCount = Math.max(0, targetAvailable - currentLoyalty.freeDeliveryTickets);
      } else if (action === 'REMOVE') {
        const toRemove = Math.max(1, Math.floor(Number(amount) || 1));
        const targetAvailable = Math.max(0, currentLoyalty.freeDeliveryTickets - toRemove);
        const baseNet =
          currentLoyalty.earnedAutoTickets - currentLoyalty.usedFreeDeliveryTickets;
        nextManualTickets = targetAvailable - baseNet;
      } else {
        const toAdd = Math.max(1, Math.floor(Number(amount) || 1));
        nextManualTickets = currentLoyalty.manualFreeDeliveryTickets + toAdd;
        grantedTicketsCount = toAdd;
      }

      await db
        .update(schema.users)
        .set({
          manualFreeDeliveryTickets: nextManualTickets,
          updatedAt: new Date(),
        })
        .where(eq(schema.users.id, customerId));

      const updatedLoyalty = await evaluateCustomerLoyaltyTickets(customerId);

      if (grantedTicketsCount > 0) {
        await db.insert(schema.notifications).values({
          userId: customerId,
          orderId: null,
          orderNumber: 'TICKET',
          oldStatus: null,
          newStatus: 'MANUAL_FREE_DELIVERY_GRANTED',
          title: '🎁 Você ganhou Entrega Grátis!',
          message: `A loja Achadinhos Delivery liberou manualmente +${grantedTicketsCount} Ticket(s) de Entrega Grátis para sua conta! Seu saldo atual é de ${updatedLoyalty.freeDeliveryTickets} ticket(s) acumulativo(s) disponível(is) para uso.`,
          isRead: false,
          popupDismissed: false,
        });
      }

      res.json({
        customerId,
        customerName: customer.name,
        freeDeliveryTickets: updatedLoyalty.freeDeliveryTickets,
        loyalty: updatedLoyalty,
        message:
          grantedTicketsCount > 0
            ? `Entrega grátis liberada manualmente para ${customer.name}! Saldo disponível: ${updatedLoyalty.freeDeliveryTickets} ticket(s).`
            : `Saldo de tickets de entrega grátis de ${customer.name} atualizado para ${updatedLoyalty.freeDeliveryTickets}.`,
      });
    } catch (error) {
      console.error('Erro ao ajustar ticket de entrega grátis do cliente:', error);
      res
        .status(500)
        .json({ error: 'Erro ao atualizar tickets de entrega grátis do cliente.' });
    }
  };

  app.post(
    '/api/admin/customers/:id/free-delivery',
    requireAuth,
    requireAdmin,
    handleAdminCustomerFreeDelivery
  );
  app.put(
    '/api/admin/customers/:id/free-delivery',
    requireAuth,
    requireAdmin,
    handleAdminCustomerFreeDelivery
  );

  // Sugestão aritmética simples de frete
  app.post('/api/admin/freight/suggest', requireAuth, requireAdmin, async (req, res) => {
    try {
      const rawKm = parseFloat(String(req.body.distanceKm || '0').replace(',', '.'));
      if (isNaN(rawKm) || rawKm < 0) {
        res.status(400).json({ error: 'Informe uma distância válida em km.' });
        return;
      }
      const config = await getFreightRuleConfig();
      const suggestedFee = calculateSuggestedFreight(rawKm, config);
      res.json({
        distanceKm: rawKm,
        suggestedFee,
        rule: config,
      });
    } catch (error) {
      console.error('Erro ao sugerir frete:', error);
      res.status(500).json({ error: 'Erro ao calcular sugestão de frete.' });
    }
  });

  // Definir/alterar frete de um endereço pelo ADMIN
  app.put(
    '/api/admin/addresses/:id/freight',
    requireAuth,
    requireAdmin,
    async (req: AuthRequest, res) => {
      try {
        const addrId = Number(req.params.id);
        const { distanceKm, deliveryFee, deliveryOrigin, deliveryNotes } = req.body;

        const parsedDistance = parseFloat(String(distanceKm ?? '').replace(',', '.'));
        const parsedFee = parseFloat(String(deliveryFee ?? '').replace(',', '.'));

        if (isNaN(parsedDistance) || parsedDistance < 0) {
          res.status(400).json({ error: 'Informe uma distância em km válida (ex: 4,8).' });
          return;
        }
        if (isNaN(parsedFee) || parsedFee < 0) {
          res.status(400).json({ error: 'Informe um valor de frete válido (ex: 8,50).' });
          return;
        }

        const settingsMap = await getSettingsMap();
        const originText =
          deliveryOrigin && String(deliveryOrigin).trim()
            ? String(deliveryOrigin).trim()
            : settingsMap.store_origin_address || 'Matriz Achadinhos';

        const [updated] = await db
          .update(schema.addresses)
          .set({
            deliveryDistanceKm: parsedDistance.toFixed(2),
            deliveryFee: parsedFee.toFixed(2),
            deliveryFeeStatus: 'CONFIRMED',
            deliveryFeeSource: 'MANUAL',
            deliveryOrigin: originText,
            deliveryNotes: deliveryNotes ? String(deliveryNotes).trim() : null,
            deliveryUpdatedBy: req.user!.id,
            deliveryUpdatedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(schema.addresses.id, addrId))
          .returning();

        if (!updated) {
          res.status(404).json({ error: 'Endereço não encontrado.' });
          return;
        }

        await db
          .update(schema.adminNotifications)
          .set({ isRead: true, popupDismissed: true })
          .where(eq(schema.adminNotifications.customerId, updated.userId));

        // Se o cliente tiver algum pedido aberto ('NEW' ou 'AWAITING_PAYMENT') aguardando frete neste endereço,
        // já define o frete no pedido, recalcula o total, inicia o cronômetro de 1h e notifica o cliente!
        const deadlineHours = Math.max(
          0.1,
          parseFloat(settingsMap.payment_deadline_hours || '1') || 1
        );
        const customerOrders = await db
          .select()
          .from(schema.orders)
          .where(eq(schema.orders.userId, updated.userId));

        for (const ord of customerOrders) {
          if (
            (ord.status === 'NEW' || ord.status === 'AWAITING_PAYMENT') &&
            ord.deliveryFee === null &&
            (!ord.addressSnapshot?.id || ord.addressSnapshot.id === addrId)
          ) {
            const sub = parseFloat(ord.subtotal);
            const nextTot = Number((sub + parsedFee).toFixed(2));
            const nextExpires = computePaymentExpiresAt(deadlineHours);

            await db
              .update(schema.orders)
              .set({
                deliveryFee: parsedFee.toFixed(2),
                deliveryDistanceKm: parsedDistance.toFixed(2),
                deliveryFeeSource: 'MANUAL',
                total: nextTot.toFixed(2),
                paymentExpiresAt: nextExpires,
                updatedAt: new Date(),
              })
              .where(eq(schema.orders.id, ord.id));

            await db.insert(schema.notifications).values({
              userId: updated.userId,
              orderId: ord.id,
              orderNumber: ord.orderNumber,
              oldStatus: ord.status,
              newStatus: ord.status,
              title: `💰 Frete definido e pagamento liberado! (Pedido #${ord.orderNumber})`,
              message: `O frete do seu pedido #${ord.orderNumber} foi confirmado em R$ ${parsedFee
                .toFixed(2)
                .replace('.', ',')}. O pagamento via PIX/WhatsApp já está liberado e você tem 1 hora para realizar o pagamento antes que a reserva do estoque expire!`,
              isRead: false,
              popupDismissed: false,
            });
          }
        }

        res.json({
          ...updated,
          freight: resolveAddressFreight(updated),
        });
      } catch (error) {
        console.error('Erro ao definir frete do endereço:', error);
        res.status(500).json({ error: 'Erro ao salvar frete do endereço.' });
      }
    }
  );

  // Admin: Pedidos
  app.get('/api/admin/orders', requireAuth, requireAdmin, async (_req, res) => {
    try {
      await expireOverdueUnpaidOrders();
      const allOrders = await db
        .select()
        .from(schema.orders)
        .orderBy(desc(schema.orders.id));
      const allUsers = await db.select().from(schema.users);
      const allItems = await db.select().from(schema.orderItems);
      const allImages = await db.select().from(schema.productImages);
      const allHistory = await db
        .select()
        .from(schema.orderStatusHistory)
        .orderBy(desc(schema.orderStatusHistory.id));

      const userMap = new Map(allUsers.map((u) => [u.id, u]));
      const deliveredUserIds = new Set(
        allOrders.filter((ord) => ord.status === 'DELIVERED').map((ord) => ord.userId)
      );
      const settingsMap = await getSettingsMap();
      const deadlineHours = Math.max(
        0.1,
        parseFloat(settingsMap.payment_deadline_hours || '1') || 1
      );
      const nowMs = Date.now();

      const enriched = allOrders.map((o) => {
        const customer = userMap.get(o.userId);
        const customerHasDeliveredOrder = deliveredUserIds.has(o.userId);
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
        const history = allHistory
          .filter((h) => h.orderId === o.id)
          .map((h) => ({
            ...h,
            changedByName: h.changedBy ? userMap.get(h.changedBy)?.name || 'Usuário' : 'Sistema',
          }));

        const ageHours = (nowMs - new Date(o.createdAt).getTime()) / (1000 * 60 * 60);
        const isPaymentExpired = Boolean(
          (o.status === 'NEW' || o.status === 'AWAITING_PAYMENT') &&
            (o.paymentExpiresAt
              ? new Date(o.paymentExpiresAt).getTime() <= nowMs
              : ageHours >= deadlineHours)
        );

        const isFirstOrderFreeDelivery = Boolean(
          o.usedFreeDeliveryTicket ||
            o.deliveryFeeSource === 'FREE_DELIVERY_TICKET' ||
            o.deliveryFeeSource === 'MANUAL_FREE_DELIVERY' ||
            (!customerHasDeliveredOrder &&
              (o.isFirstOrderFreeDelivery || o.deliveryFeeSource === 'FIRST_ORDER_FREE'))
        );
        const paymentReleased = Boolean(
          isFirstOrderFreeDelivery ||
            (o.deliveryFee !== null && o.deliveryFee !== undefined && o.deliveryFee !== '')
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

        const customerWhatsappUrl = customer?.phone
          ? buildWhatsAppLink(
              customer.phone,
              `Olá ${customer.name}! Aqui é da loja Achadinhos sobre o seu pedido ${o.orderNumber}.`
            )
          : '';

        return {
          ...o,
          isFirstOrderFreeDelivery,
          paymentReleased,
          customerName: customer ? customer.name : 'Cliente',
          customerCpf: customer ? customer.cpf : null,
          customerEmail: customer ? customer.email : '',
          customerPhone: customer ? customer.phone : '',
          customerWhatsappUrl,
          items,
          history,
          isPaymentExpired,
          ageHours: Number(ageHours.toFixed(1)),
          whatsappMessage,
        };
      });

      res.json({
        orders: enriched,
        paymentDeadlineHours: deadlineHours,
      });
    } catch (error) {
      console.error('Erro ao listar pedidos no admin:', error);
      res.status(500).json({ error: 'Erro ao carregar pedidos.' });
    }
  });

  // Admin: Definir ou alterar o frete direto no pedido
  app.put(
    '/api/admin/orders/:id/freight',
    requireAuth,
    requireAdmin,
    async (req: AuthRequest, res) => {
      try {
        const orderId = Number(req.params.id);
        const { deliveryFee, deliveryDistanceKm, alsoUpdateAddress, isManualFreeDelivery } =
          req.body;

        const parsedFee = isManualFreeDelivery
          ? 0
          : parseFloat(String(deliveryFee ?? '').replace(',', '.'));
        const parsedDist =
          deliveryDistanceKm !== undefined &&
          deliveryDistanceKm !== null &&
          deliveryDistanceKm !== ''
            ? parseFloat(String(deliveryDistanceKm).replace(',', '.'))
            : null;

        if (isNaN(parsedFee) || parsedFee < 0) {
          res.status(400).json({ error: 'Informe um valor de frete válido.' });
          return;
        }

        const [existingOrder] = await db
          .select()
          .from(schema.orders)
          .where(eq(schema.orders.id, orderId));

        if (!existingOrder) {
          res.status(404).json({ error: 'Pedido não encontrado.' });
          return;
        }

        const subtotalNum = parseFloat(existingOrder.subtotal);
        const newTotalNum = Number((subtotalNum + parsedFee).toFixed(2));
        const nextSource =
          isManualFreeDelivery || parsedFee === 0 ? 'MANUAL_FREE_DELIVERY' : 'MANUAL';

        const settingsMap = await getSettingsMap();
        const deadlineHours = Math.max(
          0.1,
          parseFloat(settingsMap.payment_deadline_hours || '1') || 1
        );
        const wasWaitingForFreight = existingOrder.deliveryFee === null;
        const isUnpaidOrder =
          existingOrder.status === 'NEW' || existingOrder.status === 'AWAITING_PAYMENT';
        const nextPaymentExpiresAt = isUnpaidOrder
          ? existingOrder.paymentExpiresAt || computePaymentExpiresAt(deadlineHours)
          : existingOrder.paymentExpiresAt;

        const [updatedOrder] = await db
          .update(schema.orders)
          .set({
            deliveryFee: parsedFee.toFixed(2),
            deliveryDistanceKm:
              parsedDist !== null && !isNaN(parsedDist)
                ? parsedDist.toFixed(2)
                : existingOrder.deliveryDistanceKm,
            deliveryFeeSource: nextSource,
            isFirstOrderFreeDelivery: parsedFee === 0,
            total: newTotalNum.toFixed(2),
            paymentExpiresAt: nextPaymentExpiresAt,
            updatedAt: new Date(),
          })
          .where(eq(schema.orders.id, orderId))
          .returning();

        if (isUnpaidOrder && wasWaitingForFreight) {
          await db.insert(schema.notifications).values({
            userId: existingOrder.userId,
            orderId: existingOrder.id,
            orderNumber: existingOrder.orderNumber,
            oldStatus: existingOrder.status,
            newStatus: existingOrder.status,
            title: `💰 Frete definido e pagamento liberado! (Pedido #${existingOrder.orderNumber})`,
            message:
              parsedFee === 0
                ? `A loja liberou Entrega Grátis para o seu pedido #${existingOrder.orderNumber}! O pagamento via PIX/WhatsApp já está disponível e você tem 1 hora para concluir o pagamento.`
                : `O frete do seu pedido #${existingOrder.orderNumber} foi definido em R$ ${parsedFee
                    .toFixed(2)
                    .replace('.', ',')}. O pagamento via PIX/WhatsApp já está liberado e você tem 1 hora para realizar o pagamento antes que a reserva do estoque expire!`,
            isRead: false,
            popupDismissed: false,
          });
        }

        if (alsoUpdateAddress && existingOrder.addressSnapshot?.id) {
          await db
            .update(schema.addresses)
            .set({
              deliveryFee: parsedFee.toFixed(2),
              deliveryDistanceKm:
                parsedDist !== null && !isNaN(parsedDist) ? parsedDist.toFixed(2) : null,
              deliveryFeeStatus: 'CONFIRMED',
              deliveryFeeSource: 'MANUAL',
              deliveryOrigin: settingsMap.store_origin_address || 'Matriz Achadinhos',
              deliveryUpdatedBy: req.user!.id,
              deliveryUpdatedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(schema.addresses.id, existingOrder.addressSnapshot.id));
        }

        res.json(updatedOrder);
      } catch (error) {
        console.error('Erro ao atualizar frete no pedido:', error);
        res.status(500).json({ error: 'Erro ao atualizar frete do pedido.' });
      }
    }
  );

  app.put(
    '/api/admin/orders/:id/status',
    requireAuth,
    requireAdmin,
    async (req: AuthRequest, res) => {
      try {
        const orderId = Number(req.params.id);
        const { status } = req.body;

        if (!status || !VALID_ORDER_STATUSES.includes(status)) {
          res.status(400).json({ error: 'Status de pedido inválido.' });
          return;
        }

        const updated = await db.transaction(async (tx) => {
          const [order] = await tx
            .select()
            .from(schema.orders)
            .where(eq(schema.orders.id, orderId));

          if (!order) {
            throw new Error('Pedido não encontrado.');
          }

          const oldStatus = order.status;
          if (oldStatus === status) {
            return order;
          }

          const items = await tx
            .select()
            .from(schema.orderItems)
            .where(eq(schema.orderItems.orderId, order.id));

          const shouldHaveStockDeducted = STOCK_DEDUCTED_STATUSES.includes(status);
          const currentlyHasStockDeducted = Boolean(order.stockDeducted);
          let nextStockDeducted = currentlyHasStockDeducted;

          if (!currentlyHasStockDeducted && shouldHaveStockDeducted) {
            for (const item of items) {
              const [prod] = await tx
                .select()
                .from(schema.products)
                .where(eq(schema.products.id, item.productId));
              if (!prod || prod.stock < item.quantity) {
                throw new Error(
                  `Estoque insuficiente para confirmar o item "${item.productName}". Disponível: ${
                    prod?.stock ?? 0
                  } un.`
                );
              }
              const nextProdStock = prod.stock - item.quantity;
              const deducted = await tx
                .update(schema.products)
                .set({
                  stock: sql`${schema.products.stock} - ${item.quantity}`,
                  status: nextProdStock <= 0 ? 'INACTIVE' : prod.status,
                  updatedAt: new Date(),
                })
                .where(
                  and(
                    eq(schema.products.id, item.productId),
                    sql`${schema.products.stock} >= ${item.quantity}`
                  )
                )
                .returning();

              if (deducted.length === 0) {
                throw new Error(
                  `Não foi possível descontar o estoque do item "${item.productName}".`
                );
              }
            }
            nextStockDeducted = true;
          } else if (currentlyHasStockDeducted && !shouldHaveStockDeducted) {
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
            nextStockDeducted = false;
          }

          const settingsMap = await getSettingsMap(tx);
          const deadlineHours = Math.max(
            0.1,
            parseFloat(settingsMap.payment_deadline_hours || '1') || 1
          );

          // Se foi marcado como PAGO (ou status posterior pago) ou CANCELADO, desliga o cronômetro de expiração de 1h.
          // Se foi colocado em AWAITING_PAYMENT (ou NEW), garante que o cronômetro de 1h esteja ativo.
          let nextPaymentExpiresAt = order.paymentExpiresAt;
          if (PAID_ORDER_STATUSES.includes(status) || status === 'CANCELLED') {
            nextPaymentExpiresAt = null;
          } else if (
            (status === 'AWAITING_PAYMENT' || status === 'NEW') &&
            !order.paymentExpiresAt
          ) {
            nextPaymentExpiresAt = computePaymentExpiresAt(deadlineHours);
          }

          const [updatedOrder] = await tx
            .update(schema.orders)
            .set({
              status,
              stockDeducted: nextStockDeducted,
              paymentExpiresAt: nextPaymentExpiresAt,
              updatedAt: new Date(),
            })
            .where(eq(schema.orders.id, order.id))
            .returning();

          await tx.insert(schema.orderStatusHistory).values({
            orderId: order.id,
            oldStatus,
            newStatus: status,
            changedBy: req.user!.id,
          });

          const { title, message } = buildStatusNotificationTexts(
            order.orderNumber,
            oldStatus,
            status
          );
          const [createdNotification] = await tx
            .insert(schema.notifications)
            .values({
              userId: order.userId,
              orderId: order.id,
              orderNumber: order.orderNumber,
              oldStatus,
              newStatus: status,
              title,
              message,
              isRead: false,
              popupDismissed: false,
            })
            .returning();

          return {
            ...updatedOrder,
            notification: createdNotification,
          };
        });

        await evaluateCustomerLoyaltyTickets(updated.userId);
        res.json(updated);
      } catch (error: any) {
        console.error('Erro ao alterar status do pedido:', error);
        res.status(400).json({ error: error.message || 'Erro ao alterar status do pedido.' });
      }
    }
  );

  // Admin: Configurações
  app.get('/api/admin/settings', requireAuth, requireAdmin, async (_req, res) => {
    try {
      const map = await getSettingsMap();
      res.json({
        whatsapp_number: map.whatsapp_number || '5511999999999',
        pix_key: map.pix_key || '',
        pix_instructions: map.pix_instructions || '',
        freight_base_km: map.freight_base_km || '4.0',
        freight_base_fee: map.freight_base_fee || '7.50',
        freight_extra_km_fee: map.freight_extra_km_fee || '1.50',
        store_origin_address: map.store_origin_address || 'Matriz Achadinhos',
        payment_deadline_hours: map.payment_deadline_hours || '1',
        cpf_strict_validation_enabled: map.cpf_strict_validation_enabled || 'false',
      });
    } catch (error) {
      console.error('Erro ao buscar configurações:', error);
      res.status(500).json({ error: 'Erro ao carregar configurações.' });
    }
  });

  app.put('/api/admin/settings', requireAuth, requireAdmin, async (req, res) => {
    try {
      const allowedKeys = [
        'whatsapp_number',
        'pix_key',
        'pix_instructions',
        'freight_base_km',
        'freight_base_fee',
        'freight_extra_km_fee',
        'store_origin_address',
        'payment_deadline_hours',
        'cpf_strict_validation_enabled',
      ];

      for (const key of allowedKeys) {
        if (req.body[key] !== undefined) {
          const val = String(req.body[key]).trim();
          const existing = await db
            .select()
            .from(schema.settings)
            .where(eq(schema.settings.key, key));
          if (existing.length > 0) {
            await db
              .update(schema.settings)
              .set({ value: val, updatedAt: new Date() })
              .where(eq(schema.settings.key, key));
          } else {
            await db.insert(schema.settings).values({ key, value: val });
          }
        }
      }

      const updated = await getSettingsMap();
      res.json(updated);
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      res.status(500).json({ error: 'Erro ao salvar configurações.' });
    }
  });

  // Admin: Alterar E-mail, Nome e Senha do Administrador (Item 3.4)
  app.put(
    '/api/admin/credentials',
    requireAuth,
    requireAdmin,
    async (req: AuthRequest, res) => {
      try {
        const { name, email, currentPassword, newPassword } = req.body || {};

        if (!currentPassword || !String(currentPassword).trim()) {
          res.status(400).json({
            error: 'Informe sua senha atual para confirmar a alteração dos dados de acesso.',
          });
          return;
        }

        const [adminUser] = await db
          .select()
          .from(schema.users)
          .where(eq(schema.users.id, req.user!.id));

        if (!adminUser || adminUser.role !== 'ADMIN') {
          res.status(404).json({ error: 'Conta de administrador não encontrada.' });
          return;
        }

        const validCurrent = await bcrypt.compare(
          String(currentPassword),
          adminUser.passwordHash
        );
        if (!validCurrent) {
          res.status(400).json({ error: 'A senha atual informada está incorreta.' });
          return;
        }

        const nextName = name && String(name).trim() ? String(name).trim() : adminUser.name;
        const nextEmail =
          email && String(email).trim()
            ? String(email).trim().toLowerCase()
            : adminUser.email.toLowerCase();

        if (!nextEmail.includes('@')) {
          res.status(400).json({ error: 'Informe um endereço de e-mail válido.' });
          return;
        }

        if (nextEmail !== adminUser.email.toLowerCase()) {
          const allUsers = await db.select().from(schema.users);
          const duplicate = allUsers.find(
            (u) => u.id !== adminUser.id && u.email.toLowerCase() === nextEmail
          );
          if (duplicate) {
            res.status(400).json({
              error: 'Este e-mail já está sendo utilizado por outro usuário.',
            });
            return;
          }
        }

        let nextPasswordHash = adminUser.passwordHash;
        const cleanNewPass = newPassword ? String(newPassword).trim() : '';
        if (cleanNewPass.length > 0) {
          if (cleanNewPass.length < 6) {
            res.status(400).json({
              error: 'A nova senha deve ter pelo menos 6 caracteres.',
            });
            return;
          }
          nextPasswordHash = await bcrypt.hash(cleanNewPass, 10);
        }

        const [updatedAdmin] = await db
          .update(schema.users)
          .set({
            name: nextName,
            email: nextEmail,
            passwordHash: nextPasswordHash,
            updatedAt: new Date(),
          })
          .where(eq(schema.users.id, adminUser.id))
          .returning();

        res.json({
          message:
            cleanNewPass.length > 0
              ? 'E-mail e nova senha do Administrador atualizados com sucesso!'
              : 'Dados de acesso do Administrador atualizados com sucesso!',
          user: {
            id: updatedAdmin.id,
            name: updatedAdmin.name,
            email: updatedAdmin.email,
            phone: updatedAdmin.phone,
            role: updatedAdmin.role,
          },
        });
      } catch (error: any) {
        console.error('Erro ao atualizar credenciais do admin:', error);
        res.status(500).json({
          error: error.message || 'Erro ao atualizar dados de acesso do administrador.',
        });
      }
    }
  );

  // ============================================================================
  // BANCO DE DADOS POSTGRESQL (PRODUÇÃO, MIGRAÇÕES & EXPORTAÇÃO PARA VPS)
  // ============================================================================
  app.get('/api/admin/database/status', requireAuth, requireAdmin, async (_req, res) => {
    try {
      const { getDatabaseEngineInfo } = await import('../../db/index.ts');
      const { exportFullBackupJson, SNAPSHOT_FILE_PATH } = await import('../../db/backup.ts');
      const fs = await import('fs');

      const payload = await exportFullBackupJson();
      const snapshotExists = fs.existsSync(SNAPSHOT_FILE_PATH);
      const snapshotUpdatedAt = snapshotExists
        ? fs.statSync(SNAPSHOT_FILE_PATH).mtime.toISOString()
        : null;

      res.json({
        engine: getDatabaseEngineInfo(),
        snapshotUpdatedAt,
        counts: {
          products: payload.tables.products.length,
          categories: payload.tables.categories.length,
          kits: payload.tables.products.filter((p) => p.isKit).length,
          mediaFiles: payload.tables.storedObjects.length,
          customers: payload.tables.users.filter((u) => u.role !== 'ADMIN').length,
          orders: payload.tables.orders.length,
        },
      });
    } catch (error: any) {
      console.error('Erro ao consultar status do banco PostgreSQL:', error);
      res.status(500).json({ error: 'Erro ao consultar status do banco PostgreSQL.' });
    }
  });

  app.get('/api/admin/database/export-sql', requireAuth, requireAdmin, async (_req, res) => {
    try {
      const { exportFullPostgresSqlDump } = await import('../../db/backup.ts');
      const sqlDump = await exportFullPostgresSqlDump();
      res.setHeader('Content-Type', 'application/sql; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="achadinhos-postgresql-vps-${new Date().toISOString().slice(0, 10)}.sql"`
      );
      res.send(sqlDump);
    } catch (error: any) {
      console.error('Erro ao exportar dump SQL PostgreSQL:', error);
      res.status(500).json({ error: 'Erro ao gerar dump SQL do PostgreSQL.' });
    }
  });

  app.get('/api/admin/database/export-json', requireAuth, requireAdmin, async (_req, res) => {
    try {
      const { exportFullBackupJson, triggerAutoSnapshot } = await import('../../db/backup.ts');
      triggerAutoSnapshot();
      const jsonBackup = await exportFullBackupJson();
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="achadinhos-backup-${new Date().toISOString().slice(0, 10)}.json"`
      );
      res.send(JSON.stringify(jsonBackup, null, 2));
    } catch (error: any) {
      console.error('Erro ao exportar backup JSON PostgreSQL:', error);
      res.status(500).json({ error: 'Erro ao gerar backup JSON do PostgreSQL.' });
    }
  });

  app.post('/api/admin/database/restore-json', requireAuth, requireAdmin, async (req, res) => {
    try {
      const { restoreFromBackupJson } = await import('../../db/backup.ts');
      const result = await restoreFromBackupJson(req.body);
      res.json({
        message: `Backup restaurado com sucesso! (${result.productsRestored} produto(s), ${result.categoriesRestored} categoria(s), ${result.ordersRestored} pedido(s)).`,
        ...result,
      });
    } catch (error: any) {
      console.error('Erro ao restaurar backup PostgreSQL:', error);
      res.status(400).json({
        error: error.message || 'Erro ao restaurar arquivo de backup no PostgreSQL.',
      });
    }
  });

  // ============================================================================
  // DISPARAR NOTIFICAÇÃO / PROMOÇÃO PARA TODOS OS CLIENTES (ESTILO IFOOD)
  // ============================================================================
  app.post('/api/admin/broadcast-notification', requireAuth, requireAdmin, async (req, res) => {
    try {
      const { title, message } = req.body || {};
      if (!title || !String(title).trim()) {
        res.status(400).json({ error: 'O título da notificação é obrigatório.' });
        return;
      }
      if (!message || !String(message).trim()) {
        res.status(400).json({ error: 'A mensagem da notificação é obrigatória.' });
        return;
      }

      const allCustomers = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.role, 'CUSTOMER'));

      if (allCustomers.length === 0) {
        res.json({ count: 0, message: 'Nenhum cliente cadastrado ainda para receber o aviso.' });
        return;
      }

      const cleanTitle = String(title).trim();
      const cleanMessage = String(message).trim();

      for (const customer of allCustomers) {
        await db.insert(schema.notifications).values({
          userId: customer.id,
          orderId: null,
          orderNumber: 'PROMO',
          oldStatus: null,
          newStatus: 'PROMO_ALERT',
          title: cleanTitle,
          message: cleanMessage,
          isRead: false,
          popupDismissed: false,
        });
      }

      const { triggerAutoSnapshot } = await import('../../db/backup.ts');
      triggerAutoSnapshot();

      res.json({
        success: true,
        count: allCustomers.length,
        message: `Notificação enviada com sucesso para ${allCustomers.length} cliente(s)!`,
      });
    } catch (error: any) {
      console.error('Erro ao disparar notificação em massa:', error);
      res.status(500).json({ error: error.message || 'Erro ao enviar notificação para os clientes.' });
    }
  });

  app.patch('/api/admin/products/:id/cost', requireAuth, requireAdmin, async (req, res) => {
    try {
      const prodId = Number(req.params.id);
      const { cost, price } = req.body;

      const [existing] = await db
        .select()
        .from(schema.products)
        .where(eq(schema.products.id, prodId));

      if (!existing) {
        res.status(404).json({ error: 'Produto não encontrado.' });
        return;
      }

      const updates: any = { updatedAt: new Date() };

      if (cost !== undefined && cost !== null) {
        const costNum = Math.max(0, parseFloat(String(cost).replace(',', '.')) || 0);
        updates.cost = costNum.toFixed(2);
      }

      if (price !== undefined && price !== null && String(price).trim() !== '') {
        const priceNum = Math.max(0, parseFloat(String(price).replace(',', '.')) || 0);
        if (priceNum > 0) {
          updates.price = priceNum.toFixed(2);
        }
      }

      const [updated] = await db
        .update(schema.products)
        .set(updates)
        .where(eq(schema.products.id, prodId))
        .returning();

      const { triggerAutoSnapshot } = await import('../../db/backup.ts');
      triggerAutoSnapshot();

      const costNum = parseFloat(String(updated.cost || '0')) || 0;
      const priceNum = parseFloat(String(updated.price || '0')) || 0;
      const promoActive = isPromoCurrentlyActive(updated);
      const effectivePrice = promoActive && updated.promoPrice ? parseFloat(String(updated.promoPrice)) : priceNum;
      const unitProfit = Number(Math.max(0, effectivePrice - costNum).toFixed(2));
      const unitMarginPercent = effectivePrice > 0 ? Number(((unitProfit / effectivePrice) * 100).toFixed(1)) : 0;
      const potentialStockProfit = Number((unitProfit * updated.stock).toFixed(2));

      res.json({
        success: true,
        product: {
          ...updated,
          unitProfit,
          unitMarginPercent,
          potentialStockProfit,
        },
        message: 'Custo e margem do produto atualizados com sucesso!',
      });
    } catch (error: any) {
      console.error('Erro ao atualizar custo do produto:', error);
      res.status(500).json({ error: error.message || 'Erro ao atualizar custo do produto.' });
    }
  });
}
