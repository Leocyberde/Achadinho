import express from 'express';
import http from 'http';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import * as dotenv from 'dotenv';
import { initializeDatabase } from './src/db/index.ts';
import { triggerAutoSnapshot } from './src/db/backup.ts';
import { registerStorageRoutes } from './src/server/routes/storageRoutes.ts';
import { registerAuthRoutes } from './src/server/routes/authRoutes.ts';
import { registerStorefrontRoutes } from './src/server/routes/storefrontRoutes.ts';
import { registerAddressRoutes } from './src/server/routes/addressRoutes.ts';
import { registerOrderRoutes } from './src/server/routes/orderRoutes.ts';
import { registerAdminRoutes } from './src/server/routes/adminRoutes.ts';
import { startOrderExpirationWatcher } from './src/server/services/orderExpirationService.ts';

export type { AuthUserPayload, AuthRequest } from './src/server/middleware/auth.ts';
export type { CustomerLoyaltySummary } from './src/server/services/loyaltyService.ts';

dotenv.config();

const PORT = 3000;

async function startServer() {
  await initializeDatabase();
  startOrderExpirationWatcher();

  const app = express();
  app.use(express.json({ limit: '50mb' }));

  // Salva snapshot automático do banco PostgreSQL a cada mutação bem-sucedida
  app.use('/api', (req, res, next) => {
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
      res.on('finish', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          triggerAutoSnapshot();
        }
      });
    }
    next();
  });

  // Serve generated assets in both dev and prod
  app.use('/src/assets', express.static(path.join(process.cwd(), 'src/assets')));

  // Serve PWA manifest and service worker with explicit headers
  app.get('/manifest.json', (_req, res) => {
    res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(process.cwd(), 'public', 'manifest.json'));
  });

  app.get('/sw.js', (_req, res) => {
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Service-Worker-Allowed', '/');
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(process.cwd(), 'public', 'sw.js'));
  });

  // Register modular API routes
  registerStorageRoutes(app);
  registerAuthRoutes(app);
  registerStorefrontRoutes(app);
  registerAddressRoutes(app);
  registerOrderRoutes(app);
  registerAdminRoutes(app);

  // Prevent unknown /api/* routes from falling through to the SPA index.html
  app.all('/api/*', (_req, res) => {
    res.status(404).json({ error: 'Rota da API não encontrada.' });
  });

  const server = http.createServer(app);

  // Vite Dev Middleware or Static Production Build
  if (process.env.NODE_ENV !== 'production') {
    const isHmrDisabled = process.env.DISABLE_HMR === 'true';
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: isHmrDisabled ? false : { server },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Porta ${PORT} já está em uso (EADDRINUSE).`);
      process.exit(1);
    } else {
      console.error('Erro no servidor:', err);
    }
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor Achadinhos rodando em http://0.0.0.0:${PORT}`);
  });

  const shutdown = () => {
    server.close(() => {
      process.exit(0);
    });
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

startServer().catch((err) => {
  console.error('Erro fatal ao iniciar servidor Achadinhos:', err);
});
