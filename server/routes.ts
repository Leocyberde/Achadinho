import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";

export async function registerRoutes(app: Express): Promise<Server> {
  app.get("/api/products", async (_req, res) => {
    try {
      const products = await storage.getAllProducts();
      res.json(products);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch products" });
    }
  });

  app.get("/api/products/featured", async (_req, res) => {
    try {
      const featured = await storage.getFeaturedProduct();
      if (!featured) {
        return res.status(404).json({ error: "No featured product found" });
      }
      res.json(featured);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch featured product" });
    }
  });

  app.get("/api/products/category/:categoria", async (req, res) => {
    try {
      const { categoria } = req.params;
      const products = await storage.getProductsByCategory(categoria);
      res.json(products);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch products by category" });
    }
  });

  app.get("/api/products/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const product = await storage.getProductById(id);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      res.json(product);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch product" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
