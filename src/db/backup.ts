import fs from 'fs';
import path from 'path';
import { db, executeRawSql } from './index.ts';
import * as schema from './schema.ts';

export const SNAPSHOT_FILE_PATH = path.join(process.cwd(), 'src', 'db', 'achadinhos_snapshot.json');

export interface DatabaseBackupPayload {
  version: string;
  exportedAt: string;
  engine: 'PostgreSQL';
  tables: {
    stores: any[];
    users: any[];
    categories: any[];
    products: any[];
    productKitItems: any[];
    productImages: any[];
    addresses: any[];
    orders: any[];
    orderItems: any[];
    orderStatusHistory: any[];
    notifications: any[];
    adminNotifications: any[];
    settings: any[];
    storedObjects: any[];
  };
}

export async function exportFullBackupJson(): Promise<DatabaseBackupPayload> {
  const [
    stores,
    users,
    categories,
    products,
    productKitItems,
    productImages,
    addresses,
    orders,
    orderItems,
    orderStatusHistory,
    notifications,
    adminNotifications,
    settings,
    storedObjects,
  ] = await Promise.all([
    db.select().from(schema.stores),
    db.select().from(schema.users),
    db.select().from(schema.categories),
    db.select().from(schema.products),
    db.select().from(schema.productKitItems),
    db.select().from(schema.productImages),
    db.select().from(schema.addresses),
    db.select().from(schema.orders),
    db.select().from(schema.orderItems),
    db.select().from(schema.orderStatusHistory),
    db.select().from(schema.notifications),
    db.select().from(schema.adminNotifications),
    db.select().from(schema.settings),
    db.select().from(schema.storedObjects),
  ]);

  return {
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    engine: 'PostgreSQL',
    tables: {
      stores,
      users,
      categories,
      products,
      productKitItems,
      productImages,
      addresses,
      orders,
      orderItems,
      orderStatusHistory,
      notifications,
      adminNotifications,
      settings,
      storedObjects,
    },
  };
}

let snapshotTimeout: NodeJS.Timeout | null = null;

export function triggerAutoSnapshot() {
  if (snapshotTimeout) {
    clearTimeout(snapshotTimeout);
  }
  snapshotTimeout = setTimeout(async () => {
    try {
      const payload = await exportFullBackupJson();
      fs.writeFileSync(SNAPSHOT_FILE_PATH, JSON.stringify(payload, null, 2), 'utf-8');
    } catch (err) {
      console.error('Erro ao salvar snapshot automático PostgreSQL:', err);
    }
  }, 300);
}

function sqlVal(val: any): string {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (typeof val === 'number') return Number.isFinite(val) ? String(val) : '0';
  if (val instanceof Date) return `'${val.toISOString()}'`;
  if (typeof val === 'object') {
    const jsonStr = JSON.stringify(val).replace(/'/g, "''");
    return `'${jsonStr}'::jsonb`;
  }
  const str = String(val).replace(/'/g, "''");
  return `'${str}'`;
}

export async function exportFullPostgresSqlDump(): Promise<string> {
  const data = await exportFullBackupJson();
  const migrationPath = path.join(process.cwd(), 'drizzle', '0000_achadinhos_production_schema.sql');
  const ddl = fs.existsSync(migrationPath)
    ? fs.readFileSync(migrationPath, 'utf-8')
    : '';

  const lines: string[] = [];
  lines.push('-- ============================================================================');
  lines.push(`-- ACHADINHOS DELIVERY — DUMP COMPLETO POSTGRESQL (MIGRAÇÃO + DADOS REAIS)`);
  lines.push(`-- Gerado em: ${data.exportedAt}`);
  lines.push('-- Como restaurar na sua VPS com PostgreSQL instalado:');
  lines.push('--   1. Crie o banco: createdb -U postgres achadinhos');
  lines.push('--   2. Importe este arquivo: psql -U postgres -d achadinhos -f achadinhos-postgresql-vps.sql');
  lines.push('-- ============================================================================');
  lines.push('');
  lines.push('BEGIN;');
  lines.push('');
  lines.push('-- 1. ESTRUTURA DE TABELAS E ÍNDICES (MIGRAÇÃO DDL)');
  lines.push(ddl);
  lines.push('');
  lines.push('-- 2. DADOS DAS TABELAS (UPSERT IDEMPOTENTE)');

  for (const s of data.tables.stores) {
    lines.push(
      `INSERT INTO stores (id, name, description, type, status, created_at, updated_at) VALUES (${sqlVal(s.id)}, ${sqlVal(s.name)}, ${sqlVal(s.description)}, ${sqlVal(s.type)}, ${sqlVal(s.status)}, ${sqlVal(s.createdAt)}, ${sqlVal(s.updatedAt)}) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, status = EXCLUDED.status, updated_at = EXCLUDED.updated_at;`
    );
  }

  for (const u of data.tables.users) {
    lines.push(
      `INSERT INTO users (id, name, cpf, email, phone, password_hash, role, status, free_delivery_tickets, manual_free_delivery_tickets, created_at, updated_at) VALUES (${sqlVal(u.id)}, ${sqlVal(u.name)}, ${sqlVal(u.cpf)}, ${sqlVal(u.email)}, ${sqlVal(u.phone)}, ${sqlVal(u.passwordHash)}, ${sqlVal(u.role)}, ${sqlVal(u.status)}, ${sqlVal(u.freeDeliveryTickets)}, ${sqlVal(u.manualFreeDeliveryTickets)}, ${sqlVal(u.createdAt)}, ${sqlVal(u.updatedAt)}) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, cpf = EXCLUDED.cpf, email = EXCLUDED.email, phone = EXCLUDED.phone, password_hash = EXCLUDED.password_hash, role = EXCLUDED.role, status = EXCLUDED.status, free_delivery_tickets = EXCLUDED.free_delivery_tickets, manual_free_delivery_tickets = EXCLUDED.manual_free_delivery_tickets, updated_at = EXCLUDED.updated_at;`
    );
  }

  for (const c of data.tables.categories) {
    lines.push(
      `INSERT INTO categories (id, store_id, name, description, status, created_at, updated_at) VALUES (${sqlVal(c.id)}, ${sqlVal(c.storeId)}, ${sqlVal(c.name)}, ${sqlVal(c.description)}, ${sqlVal(c.status)}, ${sqlVal(c.createdAt)}, ${sqlVal(c.updatedAt)}) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, status = EXCLUDED.status, updated_at = EXCLUDED.updated_at;`
    );
  }

  for (const p of data.tables.products) {
    lines.push(
      `INSERT INTO products (id, store_id, category_id, code, name, description, price, promo_price, promo_active, promo_ends_at, promo_duration_hours, promo_max_units, is_kit, cost, stock, weight, views_count, clicks_count, shares_count, status, created_at, updated_at) VALUES (${sqlVal(p.id)}, ${sqlVal(p.storeId)}, ${sqlVal(p.categoryId)}, ${sqlVal(p.code)}, ${sqlVal(p.name)}, ${sqlVal(p.description)}, ${sqlVal(p.price)}, ${sqlVal(p.promoPrice)}, ${sqlVal(p.promoActive)}, ${sqlVal(p.promoEndsAt)}, ${sqlVal(p.promoDurationHours)}, ${sqlVal(p.promoMaxUnits)}, ${sqlVal(p.isKit)}, ${sqlVal(p.cost)}, ${sqlVal(p.stock)}, ${sqlVal(p.weight)}, ${sqlVal(p.viewsCount || 0)}, ${sqlVal(p.clicksCount || 0)}, ${sqlVal(p.sharesCount || 0)}, ${sqlVal(p.status)}, ${sqlVal(p.createdAt)}, ${sqlVal(p.updatedAt)}) ON CONFLICT (id) DO UPDATE SET category_id = EXCLUDED.category_id, code = EXCLUDED.code, name = EXCLUDED.name, description = EXCLUDED.description, price = EXCLUDED.price, promo_price = EXCLUDED.promo_price, promo_active = EXCLUDED.promo_active, promo_ends_at = EXCLUDED.promo_ends_at, promo_duration_hours = EXCLUDED.promo_duration_hours, promo_max_units = EXCLUDED.promo_max_units, is_kit = EXCLUDED.is_kit, cost = EXCLUDED.cost, stock = EXCLUDED.stock, weight = EXCLUDED.weight, views_count = EXCLUDED.views_count, clicks_count = EXCLUDED.clicks_count, shares_count = EXCLUDED.shares_count, status = EXCLUDED.status, updated_at = EXCLUDED.updated_at;`
    );
  }

  for (const k of data.tables.productKitItems) {
    lines.push(
      `INSERT INTO product_kit_items (id, kit_product_id, component_product_id, quantity_per_kit, created_at) VALUES (${sqlVal(k.id)}, ${sqlVal(k.kitProductId)}, ${sqlVal(k.componentProductId)}, ${sqlVal(k.quantityPerKit)}, ${sqlVal(k.createdAt)}) ON CONFLICT (id) DO UPDATE SET quantity_per_kit = EXCLUDED.quantity_per_kit;`
    );
  }

  for (const img of data.tables.productImages) {
    lines.push(
      `INSERT INTO product_images (id, product_id, image_url, media_type, duration_seconds, is_primary, created_at) VALUES (${sqlVal(img.id)}, ${sqlVal(img.productId)}, ${sqlVal(img.imageUrl)}, ${sqlVal(img.mediaType)}, ${sqlVal(img.durationSeconds)}, ${sqlVal(img.isPrimary)}, ${sqlVal(img.createdAt)}) ON CONFLICT (id) DO UPDATE SET image_url = EXCLUDED.image_url, media_type = EXCLUDED.media_type, duration_seconds = EXCLUDED.duration_seconds, is_primary = EXCLUDED.is_primary;`
    );
  }

  for (const a of data.tables.addresses) {
    lines.push(
      `INSERT INTO addresses (id, user_id, label, zip_code, street, number, complement, neighborhood, city, state, reference, delivery_distance_km, delivery_fee, delivery_fee_status, delivery_fee_source, delivery_origin, delivery_notes, delivery_updated_by, delivery_updated_at, latitude, longitude, created_at, updated_at) VALUES (${sqlVal(a.id)}, ${sqlVal(a.userId)}, ${sqlVal(a.label)}, ${sqlVal(a.zipCode)}, ${sqlVal(a.street)}, ${sqlVal(a.number)}, ${sqlVal(a.complement)}, ${sqlVal(a.neighborhood)}, ${sqlVal(a.city)}, ${sqlVal(a.state)}, ${sqlVal(a.reference)}, ${sqlVal(a.deliveryDistanceKm)}, ${sqlVal(a.deliveryFee)}, ${sqlVal(a.deliveryFeeStatus)}, ${sqlVal(a.deliveryFeeSource)}, ${sqlVal(a.deliveryOrigin)}, ${sqlVal(a.deliveryNotes)}, ${sqlVal(a.deliveryUpdatedBy)}, ${sqlVal(a.deliveryUpdatedAt)}, ${sqlVal(a.latitude)}, ${sqlVal(a.longitude)}, ${sqlVal(a.createdAt)}, ${sqlVal(a.updatedAt)}) ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, zip_code = EXCLUDED.zip_code, street = EXCLUDED.street, number = EXCLUDED.number, complement = EXCLUDED.complement, neighborhood = EXCLUDED.neighborhood, city = EXCLUDED.city, state = EXCLUDED.state, reference = EXCLUDED.reference, delivery_distance_km = EXCLUDED.delivery_distance_km, delivery_fee = EXCLUDED.delivery_fee, delivery_fee_status = EXCLUDED.delivery_fee_status, updated_at = EXCLUDED.updated_at;`
    );
  }

  for (const o of data.tables.orders) {
    lines.push(
      `INSERT INTO orders (id, order_number, user_id, store_id, subtotal, delivery_fee, delivery_distance_km, delivery_fee_source, total, payment_method, change_for, status, is_first_order_free_delivery, used_free_delivery_ticket, stock_deducted, payment_expires_at, cancellation_reason, refund_requested, notes, address_snapshot, created_at, updated_at) VALUES (${sqlVal(o.id)}, ${sqlVal(o.orderNumber)}, ${sqlVal(o.userId)}, ${sqlVal(o.storeId)}, ${sqlVal(o.subtotal)}, ${sqlVal(o.deliveryFee)}, ${sqlVal(o.deliveryDistanceKm)}, ${sqlVal(o.deliveryFeeSource)}, ${sqlVal(o.total)}, ${sqlVal(o.paymentMethod)}, ${sqlVal(o.changeFor)}, ${sqlVal(o.status)}, ${sqlVal(o.isFirstOrderFreeDelivery)}, ${sqlVal(o.usedFreeDeliveryTicket)}, ${sqlVal(o.stockDeducted)}, ${sqlVal(o.paymentExpiresAt)}, ${sqlVal(o.cancellationReason)}, ${sqlVal(o.refundRequested)}, ${sqlVal(o.notes)}, ${sqlVal(o.addressSnapshot)}, ${sqlVal(o.createdAt)}, ${sqlVal(o.updatedAt)}) ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, stock_deducted = EXCLUDED.stock_deducted, updated_at = EXCLUDED.updated_at;`
    );
  }

  for (const oi of data.tables.orderItems) {
    lines.push(
      `INSERT INTO order_items (id, order_id, product_id, product_name, quantity, unit_price, subtotal, created_at) VALUES (${sqlVal(oi.id)}, ${sqlVal(oi.orderId)}, ${sqlVal(oi.productId)}, ${sqlVal(oi.productName)}, ${sqlVal(oi.quantity)}, ${sqlVal(oi.unitPrice)}, ${sqlVal(oi.subtotal)}, ${sqlVal(oi.createdAt)}) ON CONFLICT (id) DO NOTHING;`
    );
  }

  for (const h of data.tables.orderStatusHistory) {
    lines.push(
      `INSERT INTO order_status_history (id, order_id, old_status, new_status, changed_by, created_at) VALUES (${sqlVal(h.id)}, ${sqlVal(h.orderId)}, ${sqlVal(h.oldStatus)}, ${sqlVal(h.newStatus)}, ${sqlVal(h.changedBy)}, ${sqlVal(h.createdAt)}) ON CONFLICT (id) DO NOTHING;`
    );
  }

  for (const n of data.tables.notifications) {
    lines.push(
      `INSERT INTO notifications (id, user_id, order_id, order_number, old_status, new_status, title, message, is_read, popup_dismissed, created_at) VALUES (${sqlVal(n.id)}, ${sqlVal(n.userId)}, ${sqlVal(n.orderId)}, ${sqlVal(n.orderNumber)}, ${sqlVal(n.oldStatus)}, ${sqlVal(n.newStatus)}, ${sqlVal(n.title)}, ${sqlVal(n.message)}, ${sqlVal(n.isRead)}, ${sqlVal(n.popupDismissed)}, ${sqlVal(n.createdAt)}) ON CONFLICT (id) DO NOTHING;`
    );
  }

  for (const an of data.tables.adminNotifications) {
    lines.push(
      `INSERT INTO admin_notifications (id, type, customer_id, address_id, title, message, is_read, popup_dismissed, created_at) VALUES (${sqlVal(an.id)}, ${sqlVal(an.type)}, ${sqlVal(an.customerId)}, ${sqlVal(an.addressId)}, ${sqlVal(an.title)}, ${sqlVal(an.message)}, ${sqlVal(an.isRead)}, ${sqlVal(an.popupDismissed)}, ${sqlVal(an.createdAt)}) ON CONFLICT (id) DO NOTHING;`
    );
  }

  for (const st of data.tables.settings) {
    lines.push(
      `INSERT INTO settings (key, value, updated_at) VALUES (${sqlVal(st.key)}, ${sqlVal(st.value)}, ${sqlVal(st.updatedAt)}) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at;`
    );
  }

  for (const obj of data.tables.storedObjects) {
    lines.push(
      `INSERT INTO stored_objects (key, mime_type, data_base64, created_at) VALUES (${sqlVal(obj.key)}, ${sqlVal(obj.mimeType)}, ${sqlVal(obj.dataBase64)}, ${sqlVal(obj.createdAt)}) ON CONFLICT (key) DO UPDATE SET mime_type = EXCLUDED.mime_type, data_base64 = EXCLUDED.data_base64;`
    );
  }

  lines.push('');
  lines.push('-- 3. SINCRONIZAÇÃO DE SEQUÊNCIAS (SERIAL ID)');
  const serialTables = [
    'stores',
    'users',
    'categories',
    'products',
    'product_kit_items',
    'product_images',
    'addresses',
    'orders',
    'order_items',
    'order_status_history',
    'notifications',
    'admin_notifications',
  ];
  for (const tbl of serialTables) {
    lines.push(
      `SELECT setval(pg_get_serial_sequence('${tbl}', 'id'), COALESCE((SELECT MAX(id) FROM ${tbl}), 1), (SELECT COUNT(*) > 0 FROM ${tbl}));`
    );
  }

  lines.push('');
  lines.push('COMMIT;');
  return lines.join('\n');
}

const toDate = (v: any): Date => (v ? new Date(v) : new Date());
const toNullableDate = (v: any): Date | null => (v ? new Date(v) : null);

export async function restoreFromBackupJson(payload: DatabaseBackupPayload): Promise<{
  productsRestored: number;
  categoriesRestored: number;
  usersRestored: number;
  ordersRestored: number;
}> {
  if (!payload || !payload.tables) {
    throw new Error('Arquivo de backup inválido: estrutura "tables" não encontrada.');
  }

  const t = payload.tables;

  for (const s of t.stores || []) {
    await db
      .insert(schema.stores)
      .values({
        id: s.id,
        name: s.name,
        description: s.description,
        type: s.type || 'OWN_STORE',
        status: s.status || 'ACTIVE',
        createdAt: toDate(s.createdAt),
        updatedAt: toDate(s.updatedAt),
      })
      .onConflictDoUpdate({
        target: schema.stores.id,
        set: {
          name: s.name,
          description: s.description,
          status: s.status || 'ACTIVE',
          updatedAt: toDate(s.updatedAt),
        },
      });
  }

  for (const u of t.users || []) {
    await db
      .insert(schema.users)
      .values({
        id: u.id,
        name: u.name,
        cpf: u.cpf ?? null,
        email: u.email,
        phone: u.phone,
        passwordHash: u.passwordHash,
        role: u.role || 'CUSTOMER',
        status: u.status || 'ACTIVE',
        freeDeliveryTickets: Number(u.freeDeliveryTickets || 0),
        manualFreeDeliveryTickets: Number(u.manualFreeDeliveryTickets || 0),
        createdAt: toDate(u.createdAt),
        updatedAt: toDate(u.updatedAt),
      })
      .onConflictDoUpdate({
        target: schema.users.id,
        set: {
          name: u.name,
          cpf: u.cpf ?? null,
          email: u.email,
          phone: u.phone,
          passwordHash: u.passwordHash,
          role: u.role || 'CUSTOMER',
          status: u.status || 'ACTIVE',
          freeDeliveryTickets: Number(u.freeDeliveryTickets || 0),
          manualFreeDeliveryTickets: Number(u.manualFreeDeliveryTickets || 0),
          updatedAt: toDate(u.updatedAt),
        },
      });
  }

  for (const c of t.categories || []) {
    await db
      .insert(schema.categories)
      .values({
        id: c.id,
        storeId: c.storeId,
        name: c.name,
        description: c.description ?? null,
        status: c.status || 'ACTIVE',
        createdAt: toDate(c.createdAt),
        updatedAt: toDate(c.updatedAt),
      })
      .onConflictDoUpdate({
        target: schema.categories.id,
        set: {
          name: c.name,
          description: c.description ?? null,
          status: c.status || 'ACTIVE',
          updatedAt: toDate(c.updatedAt),
        },
      });
  }

  for (const p of t.products || []) {
    await db
      .insert(schema.products)
      .values({
        id: p.id,
        storeId: p.storeId,
        categoryId: p.categoryId,
        code: p.code || 'A001',
        name: p.name,
        description: p.description ?? null,
        price: String(p.price),
        promoPrice: p.promoPrice !== null && p.promoPrice !== undefined ? String(p.promoPrice) : null,
        promoActive: Boolean(p.promoActive),
        promoEndsAt: toNullableDate(p.promoEndsAt),
        promoDurationHours: p.promoDurationHours ?? null,
        promoMaxUnits: p.promoMaxUnits ?? null,
        isKit: Boolean(p.isKit),
        cost: String(p.cost ?? '0.00'),
        stock: Number(p.stock ?? 0),
        weight: String(p.weight ?? '0.000'),
        viewsCount: Number(p.viewsCount || 0),
        clicksCount: Number(p.clicksCount || 0),
        sharesCount: Number(p.sharesCount || 0),
        status: p.status || 'ACTIVE',
        createdAt: toDate(p.createdAt),
        updatedAt: toDate(p.updatedAt),
      })
      .onConflictDoUpdate({
        target: schema.products.id,
        set: {
          categoryId: p.categoryId,
          code: p.code || 'A001',
          name: p.name,
          description: p.description ?? null,
          price: String(p.price),
          promoPrice: p.promoPrice !== null && p.promoPrice !== undefined ? String(p.promoPrice) : null,
          promoActive: Boolean(p.promoActive),
          promoEndsAt: toNullableDate(p.promoEndsAt),
          promoDurationHours: p.promoDurationHours ?? null,
          promoMaxUnits: p.promoMaxUnits ?? null,
          isKit: Boolean(p.isKit),
          cost: String(p.cost ?? '0.00'),
          stock: Number(p.stock ?? 0),
          weight: String(p.weight ?? '0.000'),
          viewsCount: Number(p.viewsCount || 0),
          clicksCount: Number(p.clicksCount || 0),
          sharesCount: Number(p.sharesCount || 0),
          status: p.status || 'ACTIVE',
          updatedAt: toDate(p.updatedAt),
        },
      });
  }

  for (const k of t.productKitItems || []) {
    await db
      .insert(schema.productKitItems)
      .values({
        id: k.id,
        kitProductId: k.kitProductId,
        componentProductId: k.componentProductId,
        quantityPerKit: Number(k.quantityPerKit),
        createdAt: toDate(k.createdAt),
      })
      .onConflictDoUpdate({
        target: schema.productKitItems.id,
        set: {
          quantityPerKit: Number(k.quantityPerKit),
        },
      });
  }

  for (const img of t.productImages || []) {
    await db
      .insert(schema.productImages)
      .values({
        id: img.id,
        productId: img.productId,
        imageUrl: img.imageUrl,
        mediaType: img.mediaType || 'IMAGE',
        durationSeconds: img.durationSeconds ?? null,
        isPrimary: Boolean(img.isPrimary),
        createdAt: toDate(img.createdAt),
      })
      .onConflictDoUpdate({
        target: schema.productImages.id,
        set: {
          imageUrl: img.imageUrl,
          mediaType: img.mediaType || 'IMAGE',
          durationSeconds: img.durationSeconds ?? null,
          isPrimary: Boolean(img.isPrimary),
        },
      });
  }

  for (const a of t.addresses || []) {
    await db
      .insert(schema.addresses)
      .values({
        id: a.id,
        userId: a.userId,
        label: a.label,
        zipCode: a.zipCode,
        street: a.street,
        number: a.number,
        complement: a.complement ?? null,
        neighborhood: a.neighborhood,
        city: a.city,
        state: a.state,
        reference: a.reference ?? null,
        deliveryDistanceKm: a.deliveryDistanceKm ?? null,
        deliveryFee: a.deliveryFee ?? null,
        deliveryFeeStatus: a.deliveryFeeStatus || 'PENDING',
        deliveryFeeSource: a.deliveryFeeSource || 'MANUAL',
        deliveryOrigin: a.deliveryOrigin ?? null,
        deliveryNotes: a.deliveryNotes ?? null,
        deliveryUpdatedBy: a.deliveryUpdatedBy ?? null,
        deliveryUpdatedAt: toNullableDate(a.deliveryUpdatedAt),
        latitude: a.latitude ?? null,
        longitude: a.longitude ?? null,
        createdAt: toDate(a.createdAt),
        updatedAt: toDate(a.updatedAt),
      })
      .onConflictDoUpdate({
        target: schema.addresses.id,
        set: {
          label: a.label,
          zipCode: a.zipCode,
          street: a.street,
          number: a.number,
          complement: a.complement ?? null,
          neighborhood: a.neighborhood,
          city: a.city,
          state: a.state,
          reference: a.reference ?? null,
          deliveryDistanceKm: a.deliveryDistanceKm ?? null,
          deliveryFee: a.deliveryFee ?? null,
          deliveryFeeStatus: a.deliveryFeeStatus || 'PENDING',
          updatedAt: toDate(a.updatedAt),
        },
      });
  }

  for (const o of t.orders || []) {
    await db
      .insert(schema.orders)
      .values({
        id: o.id,
        orderNumber: o.orderNumber,
        userId: o.userId,
        storeId: o.storeId,
        subtotal: String(o.subtotal),
        deliveryFee: o.deliveryFee !== null && o.deliveryFee !== undefined ? String(o.deliveryFee) : null,
        deliveryDistanceKm: o.deliveryDistanceKm ?? null,
        deliveryFeeSource: o.deliveryFeeSource || 'MANUAL',
        total: String(o.total),
        paymentMethod: o.paymentMethod || 'PIX',
        changeFor: o.changeFor ?? null,
        status: o.status || 'NEW',
        isFirstOrderFreeDelivery: Boolean(o.isFirstOrderFreeDelivery),
        usedFreeDeliveryTicket: Boolean(o.usedFreeDeliveryTicket),
        stockDeducted: Boolean(o.stockDeducted),
        paymentExpiresAt: toNullableDate(o.paymentExpiresAt),
        cancellationReason: o.cancellationReason ?? null,
        refundRequested: Boolean(o.refundRequested),
        notes: o.notes ?? null,
        addressSnapshot: o.addressSnapshot,
        createdAt: toDate(o.createdAt),
        updatedAt: toDate(o.updatedAt),
      })
      .onConflictDoUpdate({
        target: schema.orders.id,
        set: {
          status: o.status || 'NEW',
          stockDeducted: Boolean(o.stockDeducted),
          updatedAt: toDate(o.updatedAt),
        },
      });
  }

  for (const oi of t.orderItems || []) {
    await db
      .insert(schema.orderItems)
      .values({
        id: oi.id,
        orderId: oi.orderId,
        productId: oi.productId,
        productName: oi.productName,
        quantity: Number(oi.quantity),
        unitPrice: String(oi.unitPrice),
        subtotal: String(oi.subtotal),
        createdAt: toDate(oi.createdAt),
      })
      .onConflictDoNothing();
  }

  for (const h of t.orderStatusHistory || []) {
    await db
      .insert(schema.orderStatusHistory)
      .values({
        id: h.id,
        orderId: h.orderId,
        oldStatus: h.oldStatus ?? null,
        newStatus: h.newStatus,
        changedBy: h.changedBy ?? null,
        createdAt: toDate(h.createdAt),
      })
      .onConflictDoNothing();
  }

  for (const n of t.notifications || []) {
    await db
      .insert(schema.notifications)
      .values({
        id: n.id,
        userId: n.userId,
        orderId: n.orderId ?? null,
        orderNumber: n.orderNumber,
        oldStatus: n.oldStatus ?? null,
        newStatus: n.newStatus,
        title: n.title,
        message: n.message,
        isRead: Boolean(n.isRead),
        popupDismissed: Boolean(n.popupDismissed),
        createdAt: toDate(n.createdAt),
      })
      .onConflictDoNothing();
  }

  for (const an of t.adminNotifications || []) {
    await db
      .insert(schema.adminNotifications)
      .values({
        id: an.id,
        type: an.type || 'NEW_CUSTOMER',
        customerId: an.customerId,
        addressId: an.addressId ?? null,
        title: an.title,
        message: an.message,
        isRead: Boolean(an.isRead),
        popupDismissed: Boolean(an.popupDismissed),
        createdAt: toDate(an.createdAt),
      })
      .onConflictDoNothing();
  }

  for (const st of t.settings || []) {
    await db
      .insert(schema.settings)
      .values({
        key: st.key,
        value: String(st.value),
        updatedAt: toDate(st.updatedAt),
      })
      .onConflictDoUpdate({
        target: schema.settings.key,
        set: {
          value: String(st.value),
          updatedAt: toDate(st.updatedAt),
        },
      });
  }

  for (const obj of t.storedObjects || []) {
    await db
      .insert(schema.storedObjects)
      .values({
        key: obj.key,
        mimeType: obj.mimeType,
        dataBase64: obj.dataBase64,
        createdAt: toDate(obj.createdAt),
      })
      .onConflictDoUpdate({
        target: schema.storedObjects.key,
        set: {
          mimeType: obj.mimeType,
          dataBase64: obj.dataBase64,
        },
      });
  }

  // Sincroniza todas as sequências SERIAL do PostgreSQL após restaurar IDs explícitos
  const serialTables = [
    'stores',
    'users',
    'categories',
    'products',
    'product_kit_items',
    'product_images',
    'addresses',
    'orders',
    'order_items',
    'order_status_history',
    'notifications',
    'admin_notifications',
  ];
  for (const tbl of serialTables) {
    await executeRawSql(
      `SELECT setval(pg_get_serial_sequence('${tbl}', 'id'), COALESCE((SELECT MAX(id) FROM ${tbl}), 1), (SELECT COUNT(*) > 0 FROM ${tbl}));`
    );
  }

  triggerAutoSnapshot();

  return {
    productsRestored: (t.products || []).length,
    categoriesRestored: (t.categories || []).length,
    usersRestored: (t.users || []).length,
    ordersRestored: (t.orders || []).length,
  };
}
