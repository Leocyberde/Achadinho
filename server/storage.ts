import { type Product, type User, type InsertProduct } from "@shared/schema";
import { randomUUID, randomBytes, scryptSync } from "crypto";
import * as crypto from 'crypto'; // Import crypto module

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
}

export class MemStorage implements IStorage {
  private products: Product[] = [];
  private users: User[] = [];

  constructor() {
    this.initializeProducts();
  }

  private initializeProducts() {
    const sampleProducts: Product[] = [
      {
        id: "1",
        categoria: "Tech",
        nome: "Fone Bluetooth TWS Pro",
        preco: "R$ 89,90",
        imagem: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=500&h=500&fit=crop",
        link: "https://shopee.com.br",
        destaque: 1,
      },
      {
        id: "2",
        categoria: "Beleza",
        nome: "Kit Skincare 5 Produtos",
        preco: "R$ 129,90",
        imagem: "https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=500&h=500&fit=crop",
        link: "https://mercadolivre.com.br",
        destaque: 0,
      },
      {
        id: "3",
        categoria: "Casa",
        nome: "Organizador Multiuso 3 Gavetas",
        preco: "R$ 59,90",
        imagem: "https://images.unsplash.com/photo-1595428774223-ef52624120d2?w=500&h=500&fit=crop",
        link: "https://amazon.com.br",
        destaque: 0,
      },
      {
        id: "4",
        categoria: "Moda",
        nome: "Bolsa Crossbody Couro Eco",
        preco: "R$ 149,90",
        imagem: "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=500&h=500&fit=crop",
        link: "https://shopee.com.br",
        destaque: 0,
      },
      {
        id: "5",
        categoria: "Tech",
        nome: "Smartwatch Fitness Tracker",
        preco: "R$ 199,90",
        imagem: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&h=500&fit=crop",
        link: "https://mercadolivre.com.br",
        destaque: 0,
      },
      {
        id: "6",
        categoria: "Pets",
        nome: "Comedouro Automático Pet",
        preco: "R$ 119,90",
        imagem: "https://images.unsplash.com/photo-1591769225440-811ad7d6eab3?w=500&h=500&fit=crop",
        link: "https://amazon.com.br",
        destaque: 0,
      },
      {
        id: "7",
        categoria: "Beleza",
        nome: "Secador Íons Profissional",
        preco: "R$ 179,90",
        imagem: "https://images.unsplash.com/photo-1522338140262-f46f5913618a?w=500&h=500&fit=crop",
        link: "https://shopee.com.br",
        destaque: 0,
      },
      {
        id: "8",
        categoria: "Casa",
        nome: "Jogo Panelas Antiaderente 5 Peças",
        preco: "R$ 249,90",
        imagem: "https://images.unsplash.com/photo-1556911220-bff31c812dba?w=500&h=500&fit=crop",
        link: "https://mercadolivre.com.br",
        destaque: 0,
      },
      {
        id: "9",
        categoria: "Moda",
        nome: "Tênis Esportivo Confort",
        preco: "R$ 189,90",
        imagem: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500&h=500&fit=crop",
        link: "https://amazon.com.br",
        destaque: 0,
      },
      {
        id: "10",
        categoria: "Tech",
        nome: "Carregador Portátil 20000mAh",
        preco: "R$ 79,90",
        imagem: "https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=500&h=500&fit=crop",
        link: "https://shopee.com.br",
        destaque: 0,
      },
      {
        id: "11",
        categoria: "Pets",
        nome: "Casinha Pet Confort Plus",
        preco: "R$ 159,90",
        imagem: "https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=500&h=500&fit=crop",
        link: "https://mercadolivre.com.br",
        destaque: 0,
      },
      {
        id: "12",
        categoria: "Casa",
        nome: "Luminária LED RGB Smart",
        preco: "R$ 99,90",
        imagem: "https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?w=500&h=500&fit=crop",
        link: "https://amazon.com.br",
        destaque: 0,
      },
    ];

    sampleProducts.forEach((product) => {
      this.products.push(product);
    });
  }

  async getAllProducts(): Promise<Product[]> {
    return this.products;
  }

  async getProductById(id: string): Promise<Product | undefined> {
    return this.products.find((p) => p.id === id);
  }

  async getFeaturedProduct(): Promise<Product | undefined> {
    return this.products.find(p => p.destaque === 1);
  }

  async getProductsByCategory(categoria: string): Promise<Product[]> {
    return this.products.filter(
      (product) => product.categoria === categoria,
    );
  }

  async createProduct(insertProduct: InsertProduct): Promise<Product> {
    const id = randomUUID();
    const product: Product = {
      ...insertProduct,
      id,
      destaque: insertProduct.destaque ?? 0
    };
    this.products.push(product);
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
      password: hashedPassword,
      createdAt: new Date().toISOString(),
    };
    this.users.push(user);
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return this.users.find((u) => u.email === email);
  }

  async verifyUser(email: string, password: string): Promise<User | null> {
    const user = await this.getUserByEmail(email);
    if (!user) return null;
    const isValid = this.verifyPassword(password, user.password);
    return isValid ? user : null;
  }

  async updateProduct(id: string, updates: Partial<InsertProduct>): Promise<Product | null> {
    const productIndex = this.products.findIndex(p => p.id === id);
    if (productIndex === -1) return null;

    const updatedProduct = { ...this.products[productIndex], ...updates };
    this.products[productIndex] = updatedProduct;
    return updatedProduct;
  }

  async deleteProduct(id: string): Promise<void> {
    this.products = this.products.filter(p => p.id !== id);
  }
}

export const storage = new MemStorage();