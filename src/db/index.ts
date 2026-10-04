import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs';
import * as schema from './schema.ts';

const dataDir = path.join(process.cwd(), '.pgdata');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export const pgClient = new PGlite(dataDir);
export const db = drizzle(pgClient, { schema });

export async function executeRawSql(sqlText: string): Promise<void> {
  await pgClient.exec(sqlText);
}

let initialized = false;

export async function initializeDatabase() {
  if (initialized) return;

  await pgClient.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      cpf TEXT,
      email TEXT NOT NULL UNIQUE,
      phone TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'CUSTOMER',
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      free_delivery_tickets INTEGER NOT NULL DEFAULT 0,
      manual_free_delivery_tickets INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    ALTER TABLE users ADD COLUMN IF NOT EXISTS cpf TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS free_delivery_tickets INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS manual_free_delivery_tickets INTEGER NOT NULL DEFAULT 0;

    CREATE TABLE IF NOT EXISTS stores (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      type TEXT NOT NULL DEFAULT 'OWN_STORE',
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS categories (
      id SERIAL PRIMARY KEY,
      store_id INTEGER NOT NULL REFERENCES stores(id),
      name TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      store_id INTEGER NOT NULL REFERENCES stores(id),
      category_id INTEGER NOT NULL REFERENCES categories(id),
      code TEXT NOT NULL DEFAULT 'A001',
      name TEXT NOT NULL,
      description TEXT,
      price NUMERIC(10, 2) NOT NULL,
      promo_price NUMERIC(10, 2),
      promo_active BOOLEAN NOT NULL DEFAULT FALSE,
      promo_ends_at TIMESTAMP,
      promo_duration_hours INTEGER,
      is_kit BOOLEAN NOT NULL DEFAULT FALSE,
      cost NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
      stock INTEGER NOT NULL DEFAULT 0,
      weight NUMERIC(10, 3) DEFAULT 0.000,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    ALTER TABLE products ADD COLUMN IF NOT EXISTS code TEXT NOT NULL DEFAULT 'A001';
    ALTER TABLE products ADD COLUMN IF NOT EXISTS promo_price NUMERIC(10, 2);
    ALTER TABLE products ADD COLUMN IF NOT EXISTS promo_active BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE products ADD COLUMN IF NOT EXISTS promo_ends_at TIMESTAMP;
    ALTER TABLE products ADD COLUMN IF NOT EXISTS promo_duration_hours INTEGER;
    ALTER TABLE products ADD COLUMN IF NOT EXISTS is_kit BOOLEAN NOT NULL DEFAULT FALSE;

    CREATE TABLE IF NOT EXISTS product_kit_items (
      id SERIAL PRIMARY KEY,
      kit_product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      component_product_id INTEGER NOT NULL REFERENCES products(id),
      quantity_per_kit INTEGER NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS product_images (
      id SERIAL PRIMARY KEY,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      image_url TEXT NOT NULL,
      media_type TEXT NOT NULL DEFAULT 'IMAGE',
      duration_seconds INTEGER,
      is_primary BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    ALTER TABLE product_images ADD COLUMN IF NOT EXISTS media_type TEXT NOT NULL DEFAULT 'IMAGE';
    ALTER TABLE product_images ADD COLUMN IF NOT EXISTS duration_seconds INTEGER;

    CREATE TABLE IF NOT EXISTS addresses (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      zip_code TEXT NOT NULL,
      street TEXT NOT NULL,
      number TEXT NOT NULL,
      complement TEXT,
      neighborhood TEXT NOT NULL,
      city TEXT NOT NULL,
      state TEXT NOT NULL,
      reference TEXT,
      delivery_distance_km NUMERIC(10, 2),
      delivery_fee NUMERIC(10, 2),
      delivery_fee_status TEXT NOT NULL DEFAULT 'PENDING',
      delivery_fee_source TEXT NOT NULL DEFAULT 'MANUAL',
      delivery_origin TEXT,
      delivery_notes TEXT,
      delivery_updated_by INTEGER,
      delivery_updated_at TIMESTAMP,
      latitude NUMERIC(10, 7),
      longitude NUMERIC(10, 7),
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      order_number TEXT NOT NULL UNIQUE,
      user_id INTEGER NOT NULL REFERENCES users(id),
      store_id INTEGER NOT NULL REFERENCES stores(id),
      subtotal NUMERIC(10, 2) NOT NULL,
      delivery_fee NUMERIC(10, 2),
      delivery_distance_km NUMERIC(10, 2),
      delivery_fee_source TEXT NOT NULL DEFAULT 'MANUAL',
      total NUMERIC(10, 2) NOT NULL,
      status TEXT NOT NULL DEFAULT 'NEW',
      is_first_order_free_delivery BOOLEAN NOT NULL DEFAULT FALSE,
      stock_deducted BOOLEAN NOT NULL DEFAULT FALSE,
      cancellation_reason TEXT,
      refund_requested BOOLEAN NOT NULL DEFAULT FALSE,
      notes TEXT,
      address_snapshot JSONB NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_first_order_free_delivery BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS used_free_delivery_ticket BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS stock_deducted BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_requested BOOLEAN NOT NULL DEFAULT FALSE;
    UPDATE orders SET stock_deducted = TRUE WHERE status IN ('PAID', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED') AND stock_deducted = FALSE;

    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
      order_number TEXT NOT NULL,
      old_status TEXT,
      new_status TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      is_read BOOLEAN NOT NULL DEFAULT FALSE,
      popup_dismissed BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    ALTER TABLE notifications ALTER COLUMN order_id DROP NOT NULL;

    CREATE TABLE IF NOT EXISTS admin_notifications (
      id SERIAL PRIMARY KEY,
      type TEXT NOT NULL DEFAULT 'NEW_CUSTOMER',
      customer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      address_id INTEGER REFERENCES addresses(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      is_read BOOLEAN NOT NULL DEFAULT FALSE,
      popup_dismissed BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id SERIAL PRIMARY KEY,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id),
      product_name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price NUMERIC(10, 2) NOT NULL,
      subtotal NUMERIC(10, 2) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS order_status_history (
      id SERIAL PRIMARY KEY,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      old_status TEXT,
      new_status TEXT NOT NULL,
      changed_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS stored_objects (
      key TEXT PRIMARY KEY,
      mime_type TEXT NOT NULL,
      data_base64 TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    UPDATE products SET status = 'INACTIVE' WHERE stock <= 0;
    INSERT INTO settings (key, value) VALUES ('cpf_strict_validation_enabled', 'false') ON CONFLICT (key) DO NOTHING;
  `);

  // Check if initial store "Achadinhos" exists
  const existingStores = await db.select().from(schema.stores);
  if (existingStores.length === 0) {
    console.log('Initializing clean Achadinhos database (Admin only, zero fictional data)...');
    // 1. Create OWN_STORE "Achadinhos"
    const [store] = await db
      .insert(schema.stores)
      .values({
        name: 'Achadinhos',
        description:
          'Loja local de utilidades, tecnologia, iluminação e presentes criativos para o dia a dia.',
        type: 'OWN_STORE',
        status: 'ACTIVE',
      })
      .returning();

    // 2. Create ONLY the Admin user (no demo customers)
    const adminHash = await bcrypt.hash('admin123', 10);
    await db.insert(schema.users).values({
      name: 'Administrador Achadinhos',
      email: 'admin@achadinhos.com.br',
      phone: '11999999999',
      passwordHash: adminHash,
      role: 'ADMIN',
      status: 'ACTIVE',
    });

    // 3. Default Settings
    const defaultSettings = [
      { key: 'whatsapp_number', value: '5511999999999' },
      { key: 'pix_key', value: 'pix@achadinhos.com.br' },
      {
        key: 'pix_instructions',
        value:
          'Faça o Pix usando a chave acima e envie o comprovante pelo WhatsApp informando o número do seu pedido.',
      },
      { key: 'freight_base_km', value: '4.0' },
      { key: 'freight_base_fee', value: '7.50' },
      { key: 'freight_extra_km_fee', value: '1.50' },
      { key: 'store_origin_address', value: 'Matriz Achadinhos - Rua Central, 120 - Centro' },
      { key: 'payment_deadline_hours', value: '24' },
      { key: 'cpf_strict_validation_enabled', value: 'false' },
      { key: 'clean_slate_real_data_v1', value: 'true' },
    ];
    for (const s of defaultSettings) {
      await db.insert(schema.settings).values(s);
    }

    // 4. Base Categories for the Admin to start registering real products
    await db.insert(schema.categories).values([
      {
        id: 1,
        storeId: store.id,
        name: 'Eletrônicos & Energia',
        description: 'Carregadores, cabos e acessórios para dispositivos móveis.',
        status: 'ACTIVE',
      },
      {
        id: 2,
        storeId: store.id,
        name: 'Casa & Iluminação',
        description: 'Luminárias, organização e utilidades domésticas.',
        status: 'ACTIVE',
      },
      {
        id: 3,
        storeId: store.id,
        name: 'Térmicos & Utilidades',
        description: 'Garrafas, copos térmicos e acessórios do dia a dia.',
        status: 'ACTIVE',
      },
    ]).onConflictDoNothing();
    console.log('Clean Achadinhos database initialized with ADMIN user and base categories.');
  }

  // Garante categorias base sempre presentes
  const currentCategories = await db.select().from(schema.categories);
  if (currentCategories.length === 0) {
    const allStores = await db.select().from(schema.stores);
    const storeId = allStores[0]?.id || 1;
    await db.insert(schema.categories).values([
      {
        id: 1,
        storeId,
        name: 'Eletrônicos & Energia',
        description: 'Carregadores, cabos e acessórios para dispositivos móveis.',
        status: 'ACTIVE',
      },
      {
        id: 2,
        storeId,
        name: 'Casa & Iluminação',
        description: 'Luminárias, organização e utilidades domésticas.',
        status: 'ACTIVE',
      },
      {
        id: 3,
        storeId,
        name: 'Térmicos & Utilidades',
        description: 'Garrafas, copos térmicos e acessórios do dia a dia.',
        status: 'ACTIVE',
      },
    ]).onConflictDoNothing();
  }

  // Tenta restaurar do snapshot JSON caso o banco esteja sem produtos
  const existingProds = await db.select().from(schema.products);
  if (existingProds.length === 0) {
    const snapshotPath = path.join(process.cwd(), 'src', 'db', 'achadinhos_snapshot.json');
    let restored = false;
    if (fs.existsSync(snapshotPath)) {
      try {
        const fileContent = fs.readFileSync(snapshotPath, 'utf8');
        const snap = JSON.parse(fileContent);
        if (snap?.tables?.products && snap.tables.products.length > 0) {
          const { restoreFromBackupJson } = await import('./backup.ts');
          await restoreFromBackupJson(snap);
          console.log(`Restaurados ${snap.tables.products.length} produtos do snapshot achadinhos_snapshot.json`);
          restored = true;
        }
      } catch (err) {
        console.error('Erro ao restaurar snapshot JSON no boot:', err);
      }
    }

    if (!restored) {
      console.log('Populando banco com os 5 produtos cadastrados pelo lojista...');
      const { SEED_PRODUCTS, SEED_STORED_OBJECTS } = await import('./seedData.ts');

      // 1. Stored objects (imagens)
      for (const obj of SEED_STORED_OBJECTS) {
        await db.insert(schema.storedObjects).values({
          key: obj.key,
          mimeType: obj.mimeType,
          dataBase64: obj.dataBase64,
        }).onConflictDoNothing();
      }

      // 2. Produtos
      const allStores = await db.select().from(schema.stores);
      const storeId = allStores[0]?.id || 1;

      for (const p of SEED_PRODUCTS) {
        const [inserted] = await db.insert(schema.products).values({
          id: p.id,
          storeId,
          categoryId: p.categoryId,
          code: p.code,
          name: p.name,
          description: p.description,
          price: p.price,
          promoPrice: p.promoPrice,
          promoActive: p.promoActive,
          cost: p.cost,
          stock: p.stock,
          weight: p.weight,
          status: p.status,
        }).onConflictDoNothing().returning();

        const prodId = inserted?.id || p.id;
        if (p.images && p.images.length > 0) {
          for (const img of p.images) {
            await db.insert(schema.productImages).values({
              productId: prodId,
              imageUrl: img.imageUrl,
              mediaType: 'IMAGE',
              isPrimary: img.isPrimary,
            }).onConflictDoNothing();
          }
        }
      }

      // Sincroniza sequences
      await pgClient.exec(`
        SELECT setval(pg_get_serial_sequence('products', 'id'), COALESCE((SELECT MAX(id) FROM products), 1), (SELECT COUNT(*) > 0 FROM products));
        SELECT setval(pg_get_serial_sequence('categories', 'id'), COALESCE((SELECT MAX(id) FROM categories), 1), (SELECT COUNT(*) > 0 FROM categories));
      `);
    }

    // Salva snapshot atualizado
    const { triggerAutoSnapshot } = await import('./backup.ts');
    triggerAutoSnapshot();
  }

  // Ensure ADMIN accounts never have customer free delivery tickets or customer notifications
  await pgClient.exec(`
    UPDATE users
    SET free_delivery_tickets = 0,
        manual_free_delivery_tickets = 0
    WHERE role = 'ADMIN';
    DELETE FROM notifications
    WHERE user_id IN (SELECT id FROM users WHERE role = 'ADMIN');
  `);

  initialized = true;
}

export function getDatabaseEngineInfo() {
  return {
    engine: 'PostgreSQL 16 (PGlite / Drizzle ORM)',
    status: initialized ? 'ONLINE' : 'INITIALIZING',
    storage: 'Local persistent data directory (.pgdata) + JSON Snapshots',
    persistence: 'FULL_DURABILITY',
  };
}
