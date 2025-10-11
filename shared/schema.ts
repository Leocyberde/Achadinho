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

export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof products.$inferSelect;
