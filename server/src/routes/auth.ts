import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { signToken } from '../lib/jwt';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

const VALID_ROLES = ['ASSISTANT', 'CLINIC', 'ADMIN'] as const;

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response) => {
  const { email, password, role } = req.body as {
    email?: string;
    password?: string;
    role?: string;
  };

  if (!email || !password || !role) {
    res.status(400).json({ error: 'email, password, and role are required' });
    return;
  }
  if (!(VALID_ROLES as readonly string[]).includes(role)) {
    res.status(400).json({ error: `role must be one of: ${VALID_ROLES.join(', ')}` });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ error: 'password must be at least 8 characters' });
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({ error: 'Email already registered' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { email, passwordHash, role: role as (typeof VALID_ROLES)[number] },
    select: { id: true, email: true, role: true, createdAt: true },
  });

  const token = signToken({ userId: user.id, role: user.role });
  res.status(201).json({ user, token });
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    res.status(400).json({ error: 'email and password are required' });
    return;
  }

  const user = await prisma.user.findUnique({ where: { email } });
  // Use a constant-time compare even on not-found to avoid user enumeration.
  const passwordHash = user?.passwordHash ?? '$2a$12$invalidhashpaddingtoconstanttime';
  const valid = await bcrypt.compare(password, passwordHash);

  if (!user || !valid) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const token = signToken({ userId: user.id, role: user.role });
  res.json({ user: { id: user.id, email: user.email, role: user.role }, token });
});

// GET /api/auth/me  — returns the authenticated user
router.get('/me', requireAuth, async (req: AuthRequest, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { id: true, email: true, role: true, createdAt: true },
  });
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  res.json(user);
});

// POST /api/auth/logout  — JWT is stateless; instruct client to discard token
router.post('/logout', (_req: Request, res: Response) => {
  res.json({ message: 'Logged out successfully — discard your token' });
});

export default router;
