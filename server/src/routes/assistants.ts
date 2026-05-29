import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { VALID_TIERS, VALID_SOFTWARE, validateAvailability } from '../lib/validators';

const router = Router();

// ── Helpers ──────────────────────────────────────────────────────────────────

function canEdit(req: AuthRequest, userId: string): boolean {
  return req.userRole === 'ADMIN' || req.userId === userId;
}

const PROFILE_USER_SELECT = { id: true, email: true, role: true, createdAt: true } as const;

// ── Routes ────────────────────────────────────────────────────────────────────

// GET /api/assistants — list all profiles (paginated)
router.get('/', async (req: AuthRequest, res: Response) => {
  const q = req.query as Record<string, string | undefined>;
  const page  = Math.max(1, parseInt(q.page  ?? '1',  10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(q.limit ?? '20', 10) || 20));

  const [data, total] = await Promise.all([
    prisma.assistantProfile.findMany({
      include: { user: { select: PROFILE_USER_SELECT } },
      orderBy: { hourlyRate: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.assistantProfile.count(),
  ]);

  res.json({ data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
});

// GET /api/assistants/:userId
router.get('/:userId', async (req: AuthRequest, res: Response) => {
  const { userId } = req.params as Record<string, string>;
  const profile = await prisma.assistantProfile.findUnique({
    where: { userId },
    include: { user: { select: PROFILE_USER_SELECT } },
  });
  if (!profile) {
    res.status(404).json({ error: 'Assistant profile not found' });
    return;
  }
  res.json(profile);
});

// PUT /api/assistants/:userId — create (201) or update (200) own profile
router.put('/:userId', requireAuth, async (req: AuthRequest, res: Response) => {
  const { userId } = req.params as Record<string, string>;

  if (!canEdit(req, userId)) {
    res.status(403).json({ error: 'You can only update your own profile' });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  if (user.role !== 'ASSISTANT') {
    res.status(400).json({ error: 'User is not an ASSISTANT' });
    return;
  }

  const { tier, software, travelRadius, hourlyRate, openToPermanent, availability, bio, yearsExp } =
    req.body as {
      tier?: string;
      software?: string[];
      travelRadius?: number;
      hourlyRate?: number;
      openToPermanent?: boolean;
      availability?: unknown;
      bio?: string | null;
      yearsExp?: number | null;
    };

  // Validate enum fields when present
  if (tier !== undefined && !(VALID_TIERS as readonly string[]).includes(tier)) {
    res.status(400).json({ error: `tier must be one of: ${VALID_TIERS.join(', ')}` });
    return;
  }
  if (software !== undefined) {
    const invalid = software.filter((s) => !(VALID_SOFTWARE as readonly string[]).includes(s));
    if (invalid.length) {
      res.status(400).json({ error: `invalid software value(s): ${invalid.join(', ')}` });
      return;
    }
  }
  if (availability !== undefined) {
    const avErr = validateAvailability(availability);
    if (avErr) { res.status(400).json({ error: avErr }); return; }
  }

  const existing = await prisma.assistantProfile.findUnique({ where: { userId } });

  if (!existing) {
    // ── CREATE ─────────────────────────────────────────────────────────────
    if (!tier || travelRadius === undefined || hourlyRate === undefined) {
      res.status(400).json({
        error: 'tier, travelRadius, and hourlyRate are required when creating a profile',
      });
      return;
    }
    const profile = await prisma.assistantProfile.create({
      data: {
        userId,
        tier: tier as (typeof VALID_TIERS)[number],
        software: (software ?? []) as (typeof VALID_SOFTWARE)[number][],
        travelRadius: Number(travelRadius),
        hourlyRate: Number(hourlyRate),
        openToPermanent: openToPermanent ?? false,
        availability: (availability as object) ?? {},
        bio: bio ?? null,
        yearsExp: yearsExp != null ? Number(yearsExp) : null,
      },
      include: { user: { select: PROFILE_USER_SELECT } },
    });
    res.status(201).json(profile);
    return;
  }

  // ── UPDATE (partial) ────────────────────────────────────────────────────
  const profile = await prisma.assistantProfile.update({
    where: { userId },
    data: {
      ...(tier !== undefined && { tier: tier as (typeof VALID_TIERS)[number] }),
      ...(software !== undefined && { software: software as (typeof VALID_SOFTWARE)[number][] }),
      ...(travelRadius !== undefined && { travelRadius: Number(travelRadius) }),
      ...(hourlyRate !== undefined && { hourlyRate: Number(hourlyRate) }),
      ...(openToPermanent !== undefined && { openToPermanent }),
      ...(availability !== undefined && { availability: availability as object }),
      ...(bio !== undefined && { bio }),
      ...(yearsExp !== undefined && { yearsExp: yearsExp != null ? Number(yearsExp) : null }),
    },
    include: { user: { select: PROFILE_USER_SELECT } },
  });
  res.json(profile);
});

// GET /api/assistants/:userId/availability
router.get('/:userId/availability', async (req: AuthRequest, res: Response) => {
  const { userId } = req.params as Record<string, string>;
  const profile = await prisma.assistantProfile.findUnique({
    where: { userId },
    select: { availability: true },
  });
  if (!profile) {
    res.status(404).json({ error: 'Assistant profile not found' });
    return;
  }
  res.json({ availability: profile.availability });
});

// PUT /api/assistants/:userId/availability — replace the full availability matrix
router.put('/:userId/availability', requireAuth, async (req: AuthRequest, res: Response) => {
  const { userId } = req.params as Record<string, string>;

  if (!canEdit(req, userId)) {
    res.status(403).json({ error: 'You can only update your own availability' });
    return;
  }

  const { availability } = req.body as { availability?: unknown };
  if (availability === undefined) {
    res.status(400).json({ error: 'availability is required' });
    return;
  }
  const avErr = validateAvailability(availability);
  if (avErr) { res.status(400).json({ error: avErr }); return; }

  const profile = await prisma.assistantProfile.update({
    where: { userId },
    data: { availability: availability as object },
    select: { userId: true, availability: true },
  });
  res.json({ availability: profile.availability });
});

export default router;
