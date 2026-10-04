import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export const JWT_SECRET = process.env.JWT_SECRET || 'achadinhos-local-secret-key-2026-v3';

export interface AuthUserPayload {
  id: number;
  email: string;
  name: string;
  role: 'ADMIN' | 'CUSTOMER';
}

export interface AuthRequest extends Request {
  user?: AuthUserPayload;
}

// Simple in-memory Rate Limiter for login/register/password recovery (Seção 9 e 16)
interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const authRateLimits = new Map<string, RateLimitEntry>();
const RATE_LIMIT_MAX = 8;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutos

export function checkRateLimit(key: string): {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
} {
  const now = Date.now();
  const entry = authRateLimits.get(key);
  if (!entry || now > entry.resetAt) {
    authRateLimits.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1, retryAfterSec: 0 };
  }
  if (entry.count >= RATE_LIMIT_MAX) {
    const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, remaining: 0, retryAfterSec };
  }
  entry.count += 1;
  return { allowed: true, remaining: RATE_LIMIT_MAX - entry.count, retryAfterSec: 0 };
}

export function resetRateLimit(key: string) {
  authRateLimits.delete(key);
}

// Middleware de Autenticação (Seção 2 e 16)
export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Não autenticado. Faça login para continuar.' });
    return;
  }
  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUserPayload;
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Sessão expirada ou inválida. Faça login novamente.' });
  }
}

export function getOptionalAuthUser(req: Request): AuthUserPayload | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  try {
    return jwt.verify(token, JWT_SECRET) as AuthUserPayload;
  } catch {
    return null;
  }
}

// Middleware de Autorização por Role ADMIN (Seção 2, 7, 16, Teste 13)
export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ error: 'Não autenticado.' });
    return;
  }
  if (req.user.role !== 'ADMIN') {
    res.status(403).json({ error: 'Acesso negado: área restrita ao administrador.' });
    return;
  }
  next();
}
