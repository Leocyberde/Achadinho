import { Express } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import * as schema from '../../db/schema.ts';
import { resolveAddressFreight } from '../../services/freightService.ts';
import {
  JWT_SECRET,
  AuthUserPayload,
  AuthRequest,
  checkRateLimit,
  resetRateLimit,
  requireAuth,
} from '../middleware/auth.ts';
import {
  getSettingsMap,
  normalizeCpfDigits,
  formatCpfMask,
  isValidBrazilianCpf,
} from '../services/storeHelpers.ts';
import { evaluateCustomerLoyaltyTickets } from '../services/loyaltyService.ts';

export function registerAuthRoutes(app: Express) {
  app.get('/api/auth/register-config', async (_req, res) => {
    try {
      const settingsMap = await getSettingsMap();
      res.json({
        cpfStrictValidationEnabled: settingsMap.cpf_strict_validation_enabled === 'true',
      });
    } catch {
      res.json({ cpfStrictValidationEnabled: false });
    }
  });

  app.get('/api/auth/check-cpf/:cpf', async (req, res) => {
    try {
      const cleanCpf = normalizeCpfDigits(req.params.cpf);
      const settingsMap = await getSettingsMap();
      const cpfStrictValidationEnabled = settingsMap.cpf_strict_validation_enabled === 'true';

      if (cleanCpf.length !== 11) {
        res.json({
          exists: false,
          isValidRealCpf: false,
          cpfStrictValidationEnabled,
        });
        return;
      }

      const allUsers = await db.select().from(schema.users);
      const exists = allUsers.some((u) => u.cpf && normalizeCpfDigits(u.cpf) === cleanCpf);
      const isValidRealCpf = isValidBrazilianCpf(cleanCpf);

      res.json({
        exists,
        isValidRealCpf,
        cpfStrictValidationEnabled,
      });
    } catch (error) {
      console.error('Erro ao verificar CPF:', error);
      res.status(500).json({ error: 'Erro ao verificar CPF.' });
    }
  });

  app.post('/api/auth/register', async (req, res) => {
    try {
      const ipKey = `reg_${req.ip || 'local'}`;
      const limit = checkRateLimit(ipKey);
      if (!limit.allowed) {
        res.status(429).json({
          error: `Muitas tentativas de cadastro. Aguarde ${limit.retryAfterSec} segundos.`,
        });
        return;
      }

      const {
        name,
        cpf,
        email,
        phone,
        password,
        lgpdAccepted,
        address,
        label,
        zipCode,
        street,
        number,
        complement,
        neighborhood,
        city,
        state,
        reference,
      } = req.body;

      if (!name || !email || !phone || !password) {
        res.status(400).json({ error: 'Preencha nome, e-mail, telefone e senha.' });
        return;
      }
      if (!lgpdAccepted) {
        res.status(400).json({
          error: 'É necessário aceitar o aviso de privacidade (LGPD) para criar sua conta.',
        });
        return;
      }
      if (String(password).length < 6) {
        res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres.' });
        return;
      }

      const settingsMap = await getSettingsMap();
      const cpfStrictValidationEnabled = settingsMap.cpf_strict_validation_enabled === 'true';

      let formattedCpf: string | null = null;
      if (cpf !== undefined && cpf !== null && String(cpf).trim() !== '') {
        const cleanCpf = normalizeCpfDigits(cpf);
        if (cleanCpf.length !== 11) {
          res.status(400).json({ error: 'Informe os 11 números do CPF.' });
          return;
        }
        // Requisito 1: Validação de CPF real (inativo no momento de teste; ativo quando habilitado para produção)
        if (cpfStrictValidationEnabled && !isValidBrazilianCpf(cleanCpf)) {
          res.status(400).json({
            error: 'CPF inválido. Por favor, informe um CPF verdadeiro válido.',
          });
          return;
        }
        // Requisito 2: Verificar se já tem o CPF cadastrado para criar a conta
        const allUsersWithCpf = await db.select().from(schema.users);
        const cpfAlreadyExists = allUsersWithCpf.some(
          (u) => u.cpf && normalizeCpfDigits(u.cpf) === cleanCpf
        );
        if (cpfAlreadyExists) {
          res.status(400).json({
            error: 'Este CPF já está cadastrado em outra conta.',
          });
          return;
        }
        formattedCpf = formatCpfMask(cleanCpf);
      }

      const cleanEmail = String(email).trim().toLowerCase();
      const existing = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.email, cleanEmail));

      if (existing.length > 0) {
        res.status(400).json({ error: 'Este e-mail já está cadastrado.' });
        return;
      }

      // Resolve address payload (either nested in `address` or top-level fields)
      const addrInput = address || {
        label,
        zipCode,
        street,
        number,
        complement,
        neighborhood,
        city,
        state,
        reference,
      };
      const hasAddressFields = Boolean(
        addrInput &&
          addrInput.zipCode &&
          addrInput.street &&
          addrInput.number &&
          addrInput.neighborhood &&
          addrInput.city &&
          addrInput.state
      );

      const passwordHash = await bcrypt.hash(String(password), 10);

      // Cria o cliente, o endereço inicial (Requisito 3) e a notificação para o painel Admin em transação
      const { newUser, createdAddress, createdAdminNotification } = await db.transaction(
        async (tx) => {
          const [insertedUser] = await tx
            .insert(schema.users)
            .values({
              name: String(name).trim(),
              cpf: formattedCpf,
              email: cleanEmail,
              phone: String(phone).trim(),
              passwordHash,
              role: 'CUSTOMER',
              status: 'ACTIVE',
            })
            .returning();

          let insertedAddress: typeof schema.addresses.$inferSelect | null = null;
          if (hasAddressFields) {
            const [addrRow] = await tx
              .insert(schema.addresses)
              .values({
                userId: insertedUser.id,
                label: String(addrInput.label || 'Casa').trim(),
                zipCode: String(addrInput.zipCode).trim(),
                street: String(addrInput.street).trim(),
                number: String(addrInput.number).trim(),
                complement: addrInput.complement ? String(addrInput.complement).trim() : null,
                neighborhood: String(addrInput.neighborhood).trim(),
                city: String(addrInput.city).trim(),
                state: String(addrInput.state).trim().toUpperCase().slice(0, 2),
                reference: addrInput.reference ? String(addrInput.reference).trim() : null,
                deliveryDistanceKm: null,
                deliveryFee: null,
                deliveryFeeStatus: 'PENDING',
                deliveryFeeSource: 'MANUAL',
                latitude: null,
                longitude: null,
              })
              .returning();
            insertedAddress = addrRow;
          }

          const addrSummary = insertedAddress
            ? `${insertedAddress.street}, ${insertedAddress.number}${
                insertedAddress.complement ? ` (${insertedAddress.complement})` : ''
              } — ${insertedAddress.neighborhood}, ${insertedAddress.city}/${insertedAddress.state} (CEP ${
                insertedAddress.zipCode
              })`
            : 'Endereço ainda não informado';

          const [adminNotif] = await tx
            .insert(schema.adminNotifications)
            .values({
              type: 'NEW_CUSTOMER',
              customerId: insertedUser.id,
              addressId: insertedAddress ? insertedAddress.id : null,
              title: `Novo Cliente Cadastrado: ${insertedUser.name}`,
              message: `CPF: ${insertedUser.cpf || 'Não informado'} · Tel: ${
                insertedUser.phone
              } · Endereço: ${addrSummary}. Cadastre a distância e o frete deste cliente.`,
              isRead: false,
              popupDismissed: false,
            })
            .returning();

          return {
            newUser: insertedUser,
            createdAddress: insertedAddress,
            createdAdminNotification: adminNotif,
          };
        }
      );

      const payload: AuthUserPayload = {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: 'CUSTOMER',
      };
      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });

      const loyalty = await evaluateCustomerLoyaltyTickets(newUser.id);

      res.status(201).json({
        token,
        user: {
          id: newUser.id,
          name: newUser.name,
          cpf: newUser.cpf,
          email: newUser.email,
          phone: newUser.phone,
          role: newUser.role,
          status: newUser.status,
          freeDeliveryTickets: loyalty.freeDeliveryTickets,
          loyalty,
          eligibleForFirstOrderFreeDelivery: loyalty.isFirstOrderEligible,
        },
        address: createdAddress
          ? {
              ...createdAddress,
              freight: resolveAddressFreight(createdAddress),
            }
          : null,
        adminNotificationId: createdAdminNotification.id,
      });
    } catch (error) {
      console.error('Erro no cadastro:', error);
      res.status(500).json({ error: 'Erro interno ao criar conta.' });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      const cleanEmail = String(email || '').trim().toLowerCase();
      const rateKey = `login_${req.ip || 'local'}_${cleanEmail}`;

      const limit = checkRateLimit(rateKey);
      if (!limit.allowed) {
        res.status(429).json({
          error: `Limite de tentativas de login excedido. Tente novamente em ${limit.retryAfterSec} segundos.`,
        });
        return;
      }

      if (!cleanEmail || !password) {
        res.status(400).json({ error: 'Informe e-mail e senha.' });
        return;
      }

      const [user] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.email, cleanEmail));

      if (!user) {
        res.status(401).json({
          error: `E-mail ou senha inválidos. Tentativas restantes: ${limit.remaining}.`,
        });
        return;
      }

      if (user.status !== 'ACTIVE') {
        res.status(403).json({ error: 'Esta conta está desativada.' });
        return;
      }

      const valid = await bcrypt.compare(String(password), user.passwordHash);
      if (!valid) {
        res.status(401).json({
          error: `E-mail ou senha inválidos. Tentativas restantes: ${limit.remaining}.`,
        });
        return;
      }

      resetRateLimit(rateKey);

      const payload: AuthUserPayload = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role as 'ADMIN' | 'CUSTOMER',
      };
      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });

      const isAdminUser = user.role === 'ADMIN';
      const loyalty = isAdminUser ? null : await evaluateCustomerLoyaltyTickets(user.id);

      res.json({
        token,
        user: {
          id: user.id,
          name: user.name,
          cpf: user.cpf,
          email: user.email,
          phone: user.phone,
          role: user.role,
          status: user.status,
          freeDeliveryTickets: loyalty ? loyalty.freeDeliveryTickets : 0,
          loyalty,
          eligibleForFirstOrderFreeDelivery: loyalty ? loyalty.isFirstOrderEligible : false,
        },
      });
    } catch (error) {
      console.error('Erro no login:', error);
      res.status(500).json({ error: 'Erro interno ao realizar login.' });
    }
  });

  // Recuperação de senha (Seção 9)
  app.post('/api/auth/recover-password', async (req, res) => {
    try {
      const { email, phone, newPassword } = req.body;
      const cleanEmail = String(email || '').trim().toLowerCase();
      const rateKey = `recover_${req.ip || 'local'}_${cleanEmail}`;

      const limit = checkRateLimit(rateKey);
      if (!limit.allowed) {
        res.status(429).json({
          error: `Muitas tentativas. Aguarde ${limit.retryAfterSec} segundos.`,
        });
        return;
      }

      if (!cleanEmail || !phone || !newPassword) {
        res.status(400).json({ error: 'Informe o e-mail, telefone cadastrado e a nova senha.' });
        return;
      }
      if (String(newPassword).length < 6) {
        res.status(400).json({ error: 'A nova senha deve ter pelo menos 6 caracteres.' });
        return;
      }

      const [user] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.email, cleanEmail));

      const cleanInputPhone = String(phone).replace(/\D/g, '');
      const cleanUserPhone = user ? user.phone.replace(/\D/g, '') : '';

      if (!user || !cleanInputPhone || cleanInputPhone !== cleanUserPhone) {
        res.status(400).json({
          error: 'Não foi possível validar os dados informados (e-mail e telefone não conferem).',
        });
        return;
      }

      const passwordHash = await bcrypt.hash(String(newPassword), 10);
      await db
        .update(schema.users)
        .set({ passwordHash, updatedAt: new Date() })
        .where(eq(schema.users.id, user.id));

      resetRateLimit(rateKey);
      res.json({ message: 'Senha redefinida com sucesso! Você já pode entrar com a nova senha.' });
    } catch (error) {
      console.error('Erro na recuperação de senha:', error);
      res.status(500).json({ error: 'Erro ao redefinir senha.' });
    }
  });

  app.get('/api/auth/me', requireAuth, async (req: AuthRequest, res) => {
    try {
      const [user] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, req.user!.id));
      if (!user) {
        res.status(404).json({ error: 'Usuário não encontrado.' });
        return;
      }
      const isAdminUser = user.role === 'ADMIN';
      const loyalty = isAdminUser ? null : await evaluateCustomerLoyaltyTickets(user.id);

      res.json({
        id: user.id,
        name: user.name,
        cpf: user.cpf,
        email: user.email,
        phone: user.phone,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt,
        freeDeliveryTickets: loyalty ? loyalty.freeDeliveryTickets : 0,
        loyalty,
        eligibleForFirstOrderFreeDelivery: loyalty ? loyalty.isFirstOrderEligible : false,
      });
    } catch (error) {
      console.error('Erro ao buscar perfil:', error);
      res.status(500).json({ error: 'Erro ao buscar dados do usuário.' });
    }
  });

  app.put('/api/auth/profile', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { name, phone, password } = req.body;
      if (!name || !phone) {
        res.status(400).json({ error: 'Nome e telefone são obrigatórios.' });
        return;
      }

      const updateData: Record<string, any> = {
        name: String(name).trim(),
        phone: String(phone).trim(),
        updatedAt: new Date(),
      };

      if (password && String(password).trim().length > 0) {
        if (String(password).length < 6) {
          res.status(400).json({ error: 'A nova senha deve ter pelo menos 6 caracteres.' });
          return;
        }
        updateData.passwordHash = await bcrypt.hash(String(password), 10);
      }

      const [updated] = await db
        .update(schema.users)
        .set(updateData)
        .where(eq(schema.users.id, req.user!.id))
        .returning();

      res.json({
        id: updated.id,
        name: updated.name,
        email: updated.email,
        phone: updated.phone,
        role: updated.role,
      });
    } catch (error) {
      console.error('Erro ao atualizar perfil:', error);
      res.status(500).json({ error: 'Erro ao atualizar perfil.' });
    }
  });
}
