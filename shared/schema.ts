import { pgTable, text, varchar, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const products = pgTable("products", {
  id: varchar("id").primaryKey(),
  categoria: text("categoria").notNull(),
  nome: text("nome").notNull(),
  descricao: text("descricao"),
  preco: text("preco").notNull(),
  imagem: text("imagem").notNull(),
  imagens: text("imagens"), // Array de URLs separadas por vírgula
  affiliateLink: text("affiliate_link").notNull(),
  destaque: integer("destaque").default(0).notNull(),
});

export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
});


export const users = pgTable("users", {
  id: varchar("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone").notNull(),
  password: text("password").notNull(),
  isAdmin: integer("is_admin").default(0).notNull(),
  createdAt: text("created_at").notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;


export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof products.$inferSelect;

export const productClicks = pgTable("product_clicks", {
  id: varchar("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  productId: varchar("product_id").notNull(),
  productName: text("product_name").notNull(),
  clickedAt: text("clicked_at").notNull(),
});

export const insertProductClickSchema = createInsertSchema(productClicks).omit({
  id: true,
});

export type InsertProductClick = z.infer<typeof insertProductClickSchema>;
export type ProductClick = typeof productClicks.$inferSelect;
