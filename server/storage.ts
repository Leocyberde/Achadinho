
import { type Product, type User, type InsertProduct, type InsertUser, type ProductClick, type InsertProductClick } from "@shared/schema";
import { randomUUID, randomBytes, scryptSync } from "crypto";
import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

export interface IStorage {
  getAllProducts(): Promise<Product[]>;
  getProductById(id: string): Promise<Product | undefined>;
  getFeaturedProduct(): Promise<Product | undefined>;
  getProductsByCategory(categoria: string): Promise<Product[]>;
  createProduct(product: InsertProduct): Promise<Product>;
  createUser(userData: InsertUser): Promise<User>;
  getUserByEmail(email: string): Promise<User | undefined>;
  verifyUser(email: string, password: string): Promise<User | null>;
  updateProduct(id: string, updates: Partial<InsertProduct>): Promise<Product | null>;
  deleteProduct(id: string): Promise<void>;
  getAllUsers(): Promise<User[]>;
  recordProductClick(clickData: InsertProductClick): Promise<ProductClick>;
  getClicksByUserId(userId: string): Promise<ProductClick[]>;
}

export class SQLiteStorage implements IStorage {
  private db: Database.Database;

  constructor() {
    // Garantir que o diretório existe
    const dbDir = join(process.cwd(), 'data');
    if (!existsSync(dbDir)) {
      mkdirSync(dbDir, { recursive: true });
    }

    // Conectar ao banco SQLite
    this.db = new Database(join(dbDir, 'app.db'));
    this.db.pragma('journal_mode = WAL');
    
    this.initializeDatabase();
    this.initializeSampleProducts();
    this.initializeAdminUser();
  }

  private initializeDatabase() {
    // Criar tabela de produtos
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        categoria TEXT NOT NULL,
        nome TEXT NOT NULL,
        descricao TEXT,
        preco TEXT NOT NULL,
        imagem TEXT NOT NULL,
        imagens TEXT,
        affiliateLink TEXT NOT NULL,
        destaque INTEGER DEFAULT 0
      )
    `);

    // Criar tabela de usuários
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        phone TEXT,
        password TEXT NOT NULL,
        isAdmin INTEGER DEFAULT 0,
        createdAt TEXT NOT NULL
      )
    `);

    // Criar tabela de cliques
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS product_clicks (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        productId TEXT NOT NULL,
        productName TEXT NOT NULL,
        clickedAt TEXT NOT NULL,
        FOREIGN KEY (userId) REFERENCES users(id),
        FOREIGN KEY (productId) REFERENCES products(id)
      )
    `);
  }

  private initializeSampleProducts() {
    const count = this.db.prepare('SELECT COUNT(*) as count FROM products').get() as { count: number };
    
    if (count.count === 0) {
      const sampleProducts: Product[] = [
        {
          id: "1",
          categoria: "Tech",
          nome: "Fone Bluetooth TWS Pro",
          descricao: "Fone de ouvido sem fio com cancelamento de ruído e bateria de longa duração",
          preco: "R$ 89,90",
          imagem: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=500&h=500&fit=crop",
          imagens: null,
          affiliateLink: "https://shopee.com.br",
          destaque: 1,
        },
        {
          id: "2",
          categoria: "Beleza",
          nome: "Kit Skincare 5 Produtos",
          descricao: "Kit completo para cuidados com a pele, ideal para rotina diária",
          preco: "R$ 129,90",
          imagem: "https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=500&h=500&fit=crop",
          imagens: null,
          affiliateLink: "https://mercadolivre.com.br",
          destaque: 0,
        },
        {
          id: "3",
          categoria: "Casa",
          nome: "Organizador Multiuso 3 Gavetas",
          descricao: "Organizador prático e moderno para manter tudo no lugar",
          preco: "R$ 59,90",
          imagem: "https://images.unsplash.com/photo-1595428774223-ef52624120d2?w=500&h=500&fit=crop",
          imagens: null,
          affiliateLink: "https://amazon.com.br",
          destaque: 0,
        },
        {
          id: "4",
          categoria: "Moda",
          nome: "Bolsa Crossbody Couro Eco",
          descricao: "Bolsa estilosa em couro ecológico, perfeita para o dia a dia",
          preco: "R$ 149,90",
          imagem: "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=500&h=500&fit=crop",
          imagens: null,
          affiliateLink: "https://shopee.com.br",
          destaque: 0,
        },
        {
          id: "5",
          categoria: "Tech",
          nome: "Smartwatch Fitness Tracker",
          descricao: "Relógio inteligente com monitoramento de atividades e saúde",
          preco: "R$ 199,90",
          imagem: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&h=500&fit=crop",
          imagens: null,
          affiliateLink: "https://mercadolivre.com.br",
          destaque: 0,
        },
        {
          id: "6",
          categoria: "Pets",
          nome: "Comedouro Automático Pet",
          descricao: null,
          preco: "R$ 119,90",
          imagem: "https://images.unsplash.com/photo-1591769225440-811ad7d6eab3?w=500&h=500&fit=crop",
          imagens: null,
          affiliateLink: "https://amazon.com.br",
          destaque: 0,
        },
        {
          id: "7",
          categoria: "Beleza",
          nome: "Secador Íons Profissional",
          descricao: null,
          preco: "R$ 179,90",
          imagem: "https://images.unsplash.com/photo-1522338140262-f46f5913618a?w=500&h=500&fit=crop",
          imagens: null,
          affiliateLink: "https://shopee.com.br",
          destaque: 0,
        },
        {
          id: "8",
          categoria: "Casa",
          nome: "Jogo Panelas Antiaderente 5 Peças",
          descricao: null,
          preco: "R$ 249,90",
          imagem: "https://images.unsplash.com/photo-1556911220-bff31c812dba?w=500&h=500&fit=crop",
          imagens: null,
          affiliateLink: "https://mercadolivre.com.br",
          destaque: 0,
        },
        {
          id: "9",
          categoria: "Moda",
          nome: "Tênis Esportivo Confort",
          descricao: null,
          preco: "R$ 189,90",
          imagem: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500&h=500&fit=crop",
          imagens: null,
          affiliateLink: "https://amazon.com.br",
          destaque: 0,
        },
        {
          id: "10",
          categoria: "Tech",
          nome: "Carregador Portátil 20000mAh",
          descricao: null,
          preco: "R$ 79,90",
          imagem: "https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=500&h=500&fit=crop",
          imagens: null,
          affiliateLink: "https://shopee.com.br",
          destaque: 0,
        },
        {
          id: "11",
          categoria: "Pets",
          nome: "Casinha Pet Confort Plus",
          descricao: null,
          preco: "R$ 159,90",
          imagem: "https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=500&h=500&fit=crop",
          imagens: null,
          affiliateLink: "https://mercadolivre.com.br",
          destaque: 0,
        },
        {
          id: "12",
          categoria: "Casa",
          nome: "Luminária LED RGB Smart",
          descricao: null,
          preco: "R$ 99,90",
          imagem: "https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?w=500&h=500&fit=crop",
          imagens: null,
          affiliateLink: "https://amazon.com.br",
          destaque: 0,
        },
      ];

      const insert = this.db.prepare(`
        INSERT INTO products (id, categoria, nome, descricao, preco, imagem, imagens, affiliateLink, destaque)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const product of sampleProducts) {
        insert.run(
          product.id,
          product.categoria,
          product.nome,
          product.descricao,
          product.preco,
          product.imagem,
          product.imagens,
          product.affiliateLink,
          product.destaque
        );
      }
    }
  }

  async getAllProducts(): Promise<Product[]> {
    const products = this.db.prepare('SELECT * FROM products').all() as Product[];
    return products;
  }

  async getProductById(id: string): Promise<Product | undefined> {
    const product = this.db.prepare('SELECT * FROM products WHERE id = ?').get(id) as Product | undefined;
    return product;
  }

  async getFeaturedProduct(): Promise<Product | undefined> {
    const product = this.db.prepare('SELECT * FROM products WHERE destaque = 1 LIMIT 1').get() as Product | undefined;
    return product;
  }

  async getProductsByCategory(categoria: string): Promise<Product[]> {
    const products = this.db.prepare('SELECT * FROM products WHERE categoria = ?').all(categoria) as Product[];
    return products;
  }

  async createProduct(insertProduct: InsertProduct): Promise<Product> {
    const id = randomUUID();
    const product: Product = {
      ...insertProduct,
      id,
      descricao: insertProduct.descricao ?? null,
      imagens: insertProduct.imagens ?? null,
      destaque: insertProduct.destaque ?? 0
    };

    this.db.prepare(`
      INSERT INTO products (id, categoria, nome, descricao, preco, imagem, imagens, affiliateLink, destaque)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      product.id,
      product.categoria,
      product.nome,
      product.descricao,
      product.preco,
      product.imagem,
      product.imagens,
      product.affiliateLink,
      product.destaque
    );

    return product;
  }

  private hashPassword(password: string): string {
    const salt = randomBytes(16).toString("hex");
    const hash = scryptSync(password, salt, 64).toString("hex");
    return `${salt}:${hash}`;
  }

  private verifyPassword(password: string, storedHash: string): boolean {
    const [salt, hash] = storedHash.split(":");
    const verifyHash = scryptSync(password, salt, 64).toString("hex");
    return hash === verifyHash;
  }

  async createUser(userData: InsertUser): Promise<User> {
    const id = randomBytes(16).toString("hex");
    const hashedPassword = this.hashPassword(userData.password);
    const user: User = {
      id,
      name: userData.name,
      email: userData.email,
      phone: userData.phone || null,
      password: hashedPassword,
      isAdmin: 0,
      createdAt: new Date().toISOString(),
    };

    this.db.prepare(`
      INSERT INTO users (id, name, email, phone, password, isAdmin, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      user.id,
      user.name,
      user.email,
      user.phone,
      user.password,
      user.isAdmin,
      user.createdAt
    );

    return user;
  }

  async getAllUsers(): Promise<User[]> {
    const users = this.db.prepare('SELECT * FROM users WHERE isAdmin = 0').all() as User[];
    return users;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const user = this.db.prepare('SELECT * FROM users WHERE email = ?').get(email) as User | undefined;
    return user;
  }

  async verifyUser(email: string, password: string): Promise<User | null> {
    const user = await this.getUserByEmail(email);
    if (!user) return null;
    const isValid = this.verifyPassword(password, user.password);
    return isValid ? user : null;
  }

  async updateProduct(id: string, updates: Partial<InsertProduct>): Promise<Product | null> {
    const product = await this.getProductById(id);
    if (!product) return null;

    const updatedProduct = { ...product, ...updates };

    this.db.prepare(`
      UPDATE products 
      SET categoria = ?, nome = ?, descricao = ?, preco = ?, imagem = ?, imagens = ?, affiliateLink = ?, destaque = ?
      WHERE id = ?
    `).run(
      updatedProduct.categoria,
      updatedProduct.nome,
      updatedProduct.descricao,
      updatedProduct.preco,
      updatedProduct.imagem,
      updatedProduct.imagens,
      updatedProduct.affiliateLink,
      updatedProduct.destaque,
      id
    );

    return updatedProduct;
  }

  async deleteProduct(id: string): Promise<void> {
    this.db.prepare('DELETE FROM products WHERE id = ?').run(id);
  }

  async recordProductClick(clickData: InsertProductClick): Promise<ProductClick> {
    const click: ProductClick = {
      id: randomBytes(16).toString("hex"),
      userId: clickData.userId,
      productId: clickData.productId,
      productName: clickData.productName,
      clickedAt: new Date().toISOString(),
    };

    this.db.prepare(`
      INSERT INTO product_clicks (id, userId, productId, productName, clickedAt)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      click.id,
      click.userId,
      click.productId,
      click.productName,
      click.clickedAt
    );

    return click;
  }

  async getClicksByUserId(userId: string): Promise<ProductClick[]> {
    const clicks = this.db.prepare('SELECT * FROM product_clicks WHERE userId = ? ORDER BY clickedAt DESC').all(userId) as ProductClick[];
    return clicks;
  }

  private async initializeAdminUser() {
    const adminEmail = "leolulu842@gmail.com";
    const existingAdmin = await this.getUserByEmail(adminEmail);

    if (!existingAdmin) {
      const hashedPassword = this.hashPassword("123456");
      const adminUser: User = {
        id: "admin-001",
        name: "Administrador",
        email: adminEmail,
        phone: null,
        password: hashedPassword,
        isAdmin: 1,
        createdAt: new Date().toISOString(),
      };

      this.db.prepare(`
        INSERT INTO users (id, name, email, phone, password, isAdmin, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        adminUser.id,
        adminUser.name,
        adminUser.email,
        adminUser.phone,
        adminUser.password,
        adminUser.isAdmin,
        adminUser.createdAt
      );

      console.log("✅ Usuário admin criado:");
      console.log("   Email: leolulu842@gmail.com");
      console.log("   Senha: 123456");
    }
  }
}

export const storage = new SQLiteStorage();
