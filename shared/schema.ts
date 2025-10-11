import { pgTable, text, varchar, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const products = pgTable("products", {
  id: varchar("id").primaryKey(),
  categoria: text("categoria").notNull(),
  nome: text("nome").notNull(),
  preco: text("preco").notNull(),
  imagem: text("imagem").notNull(),
  link: text("link").notNull(),
  destaque: integer("destaque").default(0).notNull(),
});

export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
});


export const users = pgTable("users", {
  id: varchar("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
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
