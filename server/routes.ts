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

  app.get("/api/admin/users", async (_req, res) => {
    try {
      const users = await storage.getAllUsers();
      const usersWithoutPassword = users.map(({ password: _, ...user }) => user);
      res.json(usersWithoutPassword);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar usuários" });
    }
  });

  app.get("/api/admin/user-clicks/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const clicks = await storage.getClicksByUserId(userId);
      res.json(clicks);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar cliques do usuário" });
    }
  });

  app.post("/api/product-click", async (req, res) => {
    try {
      const { userId, productId, productName } = req.body;
      const click = await storage.recordProductClick({ userId, productId, productName });
      res.json(click);
    } catch (error) {
      res.status(500).json({ error: "Erro ao registrar clique" });
    }
  });

  app.post("/api/auth/register", async (req, res) => {
    try {
      const { name, email, phone, password } = req.body;
      
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ error: "Email já cadastrado" });
      }

      const user = await storage.createUser({ name, email, phone, password });
      const { password: _, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      res.status(500).json({ error: "Erro ao criar conta" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      
      const user = await storage.verifyUser(email, password);
      if (!user) {
        return res.status(401).json({ error: "Email ou senha inválidos" });
      }

      const { password: _, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      res.status(500).json({ error: "Erro ao fazer login" });
    }
  });

  // Rotas de administração
  app.post("/api/admin/products", async (req, res) => {
    try {
      const product = await storage.createProduct(req.body);
      res.json(product);
    } catch (error) {
      res.status(500).json({ error: "Erro ao criar produto" });
    }
  });

  app.put("/api/admin/products/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const product = await storage.updateProduct(id, req.body);
      if (!product) {
        return res.status(404).json({ error: "Produto não encontrado" });
      }
      res.json(product);
    } catch (error) {
      res.status(500).json({ error: "Erro ao atualizar produto" });
    }
  });

  app.delete("/api/admin/products/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteProduct(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Erro ao deletar produto" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
