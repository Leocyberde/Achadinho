import { Express } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import * as schema from '../../db/schema.ts';
import { AuthRequest, requireAuth, requireAdmin } from '../middleware/auth.ts';

export function registerStorageRoutes(app: Express) {
  app.get('/api/storage/:key', async (req, res) => {
    try {
      const [obj] = await db
        .select()
        .from(schema.storedObjects)
        .where(eq(schema.storedObjects.key, req.params.key));
      if (!obj) {
        res.status(404).send('Imagem não encontrada');
        return;
      }
      const buffer = Buffer.from(obj.dataBase64, 'base64');
      res.setHeader('Content-Type', obj.mimeType);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.send(buffer);
    } catch (error) {
      console.error('Erro ao servir objeto:', error);
      res.status(500).send('Erro ao carregar imagem');
    }
  });

  app.post('/api/admin/upload-image', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const { mimeType, dataBase64, filename } = req.body;
      if (!mimeType || !dataBase64) {
        res.status(400).json({ error: 'Imagem inválida.' });
        return;
      }
      const safeName = (filename || 'produto').replace(/[^a-zA-Z0-9._-]/g, '_');
      const key = `${Date.now()}_${safeName}`;
      const cleanBase64 = dataBase64.includes('base64,')
        ? dataBase64.split('base64,')[1]
        : dataBase64;

      await db.insert(schema.storedObjects).values({
        key,
        mimeType,
        dataBase64: cleanBase64,
      });

      res.json({ url: `/api/storage/${key}`, key });
    } catch (error) {
      console.error('Erro no upload de imagem:', error);
      res.status(500).json({ error: 'Falha ao salvar imagem no armazenamento.' });
    }
  });
}
