import { Express } from 'express';
import { eq, desc, and, sql } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import * as schema from '../../db/schema.ts';
import { getOptionalAuthUser } from '../middleware/auth.ts';
import {
  getSettingsMap,
  isPromoCurrentlyActive,
  calculateDiscountPercent,
} from '../services/storeHelpers.ts';
import { evaluateCustomerLoyaltyTickets } from '../services/loyaltyService.ts';
import { expireOverdueUnpaidOrders } from '../services/orderExpirationService.ts';

export function registerStorefrontRoutes(app: Express) {
  app.get('/api/storefront', async (req, res) => {
    try {
      await expireOverdueUnpaidOrders();
      const optUser = getOptionalAuthUser(req);
      const loyalty =
        optUser && optUser.role === 'CUSTOMER'
          ? await evaluateCustomerLoyaltyTickets(optUser.id)
          : null;
      const eligibleForFirstOrderFreeDelivery =
        optUser?.role === 'ADMIN'
          ? false
          : loyalty
          ? loyalty.isFirstOrderEligible
          : true;

      const allStores = await db.select().from(schema.stores);
      const store = allStores[0] || null;

      const activeCategories = await db
        .select()
        .from(schema.categories)
        .where(eq(schema.categories.status, 'ACTIVE'));

      const allProducts = await db
        .select()
        .from(schema.products)
        .orderBy(desc(schema.products.id));

      const allImages = await db.select().from(schema.productImages);
      const allKitItems = await db.select().from(schema.productKitItems);

      const categoryMap = new Map(activeCategories.map((c) => [c.id, c.name]));
      const prodMap = new Map(allProducts.map((p) => [p.id, p]));

      const visibleProducts = allProducts
        .filter((p) => p.status === 'ACTIVE' && p.stock > 0 && categoryMap.has(p.categoryId))
        .map((p) => {
          const prodImgs = allImages.filter((img) => img.productId === p.id);
          const primaryImg =
            prodImgs.find((i) => i.isPrimary && i.mediaType !== 'VIDEO') ||
            prodImgs.find((i) => i.mediaType !== 'VIDEO') ||
            prodImgs[0];
          const hasPromo = isPromoCurrentlyActive(p);
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
                  };
                })
            : [];

          return {
            ...p,
            hasPromo,
            effectivePrice,
            discountPercent,
            kitComponents,
            categoryName: categoryMap.get(p.categoryId) || 'Geral',
            imageUrl: primaryImg ? primaryImg.imageUrl : null,
            images: prodImgs,
          };
        });

      const settingsMap = await getSettingsMap();

      res.json({
        store,
        categories: activeCategories,
        products: visibleProducts,
        eligibleForFirstOrderFreeDelivery,
        loyalty,
        settings: {
          whatsappNumber: settingsMap.whatsapp_number || '5511999999999',
          pixKey: settingsMap.pix_key || '',
          pixInstructions: settingsMap.pix_instructions || '',
          paymentDeadlineHours: Number(settingsMap.payment_deadline_hours || 24),
        },
      });
    } catch (error) {
      console.error('Erro ao carregar vitrine:', error);
      res.status(500).json({ error: 'Erro ao carregar vitrine.' });
    }
  });

  app.get('/api/products/:id', async (req, res) => {
    try {
      const prodId = Number(req.params.id);
      if (isNaN(prodId)) {
        res.status(400).json({ error: 'ID de produto inválido.' });
        return;
      }

      const [product] = await db
        .select()
        .from(schema.products)
        .where(and(eq(schema.products.id, prodId), eq(schema.products.status, 'ACTIVE')));

      if (!product || product.stock <= 0) {
        res.status(404).json({
          error: 'Produto não encontrado ou sem estoque disponível na vitrine.',
        });
        return;
      }

      const [category] = await db
        .select()
        .from(schema.categories)
        .where(eq(schema.categories.id, product.categoryId));

      const images = await db
        .select()
        .from(schema.productImages)
        .where(eq(schema.productImages.productId, product.id));

      const primaryImg =
        images.find((i) => i.isPrimary && i.mediaType !== 'VIDEO') ||
        images.find((i) => i.mediaType !== 'VIDEO') ||
        images[0];

      const hasPromo = isPromoCurrentlyActive(product);
      const effectivePrice = hasPromo ? String(product.promoPrice) : String(product.price);
      const discountPercent = calculateDiscountPercent(
        product.price,
        product.promoPrice,
        hasPromo
      );

      let kitComponents: any[] = [];
      if (product.isKit) {
        const kitRows = await db
          .select()
          .from(schema.productKitItems)
          .where(eq(schema.productKitItems.kitProductId, product.id));
        const allProds = await db.select().from(schema.products);
        const prodMap = new Map(allProds.map((p) => [p.id, p]));
        kitComponents = kitRows.map((k) => {
          const comp = prodMap.get(k.componentProductId);
          return {
            id: k.id,
            componentProductId: k.componentProductId,
            componentCode: comp?.code || '',
            componentName: comp?.name || 'Item',
            quantityPerKit: k.quantityPerKit,
          };
        });
      }

      const optUser = getOptionalAuthUser(req);
      const loyalty =
        optUser && optUser.role === 'CUSTOMER'
          ? await evaluateCustomerLoyaltyTickets(optUser.id)
          : null;
      const eligibleForFirstOrderFreeDelivery =
        optUser?.role === 'ADMIN'
          ? false
          : loyalty
          ? loyalty.isFirstOrderEligible
          : true;

      // Registra visualização do produto automaticamente
      await db
        .update(schema.products)
        .set({ viewsCount: sql`${schema.products.viewsCount} + 1` })
        .where(eq(schema.products.id, product.id));

      const nextViews = (product.viewsCount || 0) + 1;

      res.json({
        ...product,
        viewsCount: nextViews,
        hasPromo,
        effectivePrice,
        discountPercent,
        kitComponents,
        eligibleForFirstOrderFreeDelivery,
        loyalty,
        categoryName: category ? category.name : 'Geral',
        imageUrl: primaryImg ? primaryImg.imageUrl : null,
        images,
      });
    } catch (error) {
      console.error('Erro ao buscar produto:', error);
      res.status(500).json({ error: 'Erro ao carregar detalhes do produto.' });
    }
  });

  // Registrar interação do produto (Cliques, Visualizações, Compartilhamentos no WhatsApp/Link)
  app.post('/api/products/:id/interaction', async (req, res) => {
    try {
      const prodId = Number(req.params.id);
      const { action = 'CLICK' } = req.body || {};
      if (isNaN(prodId)) {
        res.status(400).json({ error: 'ID de produto inválido.' });
        return;
      }

      if (action === 'SHARE') {
        await db
          .update(schema.products)
          .set({ sharesCount: sql`${schema.products.sharesCount} + 1` })
          .where(eq(schema.products.id, prodId));
      } else if (action === 'VIEW') {
        await db
          .update(schema.products)
          .set({ viewsCount: sql`${schema.products.viewsCount} + 1` })
          .where(eq(schema.products.id, prodId));
      } else {
        // CLICK
        await db
          .update(schema.products)
          .set({ clicksCount: sql`${schema.products.clicksCount} + 1` })
          .where(eq(schema.products.id, prodId));
      }

      const [updated] = await db
        .select({
          viewsCount: schema.products.viewsCount,
          clicksCount: schema.products.clicksCount,
          sharesCount: schema.products.sharesCount,
        })
        .from(schema.products)
        .where(eq(schema.products.id, prodId));

      res.json({ success: true, ...updated });
    } catch (err: any) {
      console.error('Erro ao registrar interação do produto:', err);
      res.status(500).json({ error: 'Erro ao registrar interação do produto.' });
    }
  });
}
