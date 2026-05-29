import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

type MatchStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CLOCKED_IN' | 'CLOCKED_OUT' | 'PLACED' | 'CANCELLED';
const VALID_STATUSES: MatchStatus[] = ['PENDING', 'ACCEPTED', 'DECLINED', 'CLOCKED_IN', 'CLOCKED_OUT', 'PLACED', 'CANCELLED'];

// ── POST /api/matches — assistant places a bid ────────────────────────────────

router.post('/', requireAuth, requireRole('ASSISTANT', 'ADMIN'), async (req: AuthRequest, res: Response) => {
  const assistantProfile = await prisma.assistantProfile.findUnique({
    where: { userId: req.userId },
  });
  if (!assistantProfile) {
    res.status(400).json({ error: 'Create an assistant profile before placing bids' });
    return;
  }

  const { jobId, bidRate } = req.body as { jobId?: string; bidRate?: number };
  if (!jobId) {
    res.status(400).json({ error: 'jobId is required' });
    return;
  }

  const job = await prisma.jobPosting.findUnique({ where: { id: jobId } });
  if (!job) {
    res.status(404).json({ error: 'Job posting not found' });
    return;
  }
  if (job.status !== 'OPEN') {
    res.status(400).json({ error: 'Job posting is not open for bids' });
    return;
  }

  const existing = await prisma.match.findUnique({
    where: { jobId_assistantId: { jobId, assistantId: assistantProfile.id } },
  });
  if (existing) {
    res.status(409).json({ error: 'You have already placed a bid on this job' });
    return;
  }

  let bidRateVal: number | null = null;
  if (job.type === 'TEMP') {
    if (bidRate === undefined) {
      res.status(400).json({ error: 'bidRate is required for TEMP jobs' });
      return;
    }
    const n = Number(bidRate);
    if (!isFinite(n) || n <= 0) {
      res.status(400).json({ error: 'bidRate must be a positive number' });
      return;
    }
    bidRateVal = n;
  }

  const match = await prisma.match.create({
    data: {
      jobId,
      assistantId: assistantProfile.id,
      status: 'PENDING',
      bidRate: bidRateVal,
    },
    include: {
      job: { select: { id: true, type: true, status: true, shiftStart: true, shiftEnd: true } },
      assistant: { select: { id: true, tier: true } },
    },
  });
  res.status(201).json(match);
});

// ── GET /api/matches — list matches ──────────────────────────────────────────
// Assistants see their own; Clinics see matches for their jobs; Admins see all.
// Optional query params: jobId, status, page, limit.

router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const q = req.query as Record<string, string | undefined>;
  const page  = Math.max(1, parseInt(q.page  ?? '1',  10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(q.limit ?? '20', 10) || 20));

  if (q.status && !VALID_STATUSES.includes(q.status as MatchStatus)) {
    res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
    return;
  }

  // Build scope filter based on caller's role
  type WhereClause = Record<string, unknown>;
  let scopeWhere: WhereClause = {};

  if (req.userRole === 'ASSISTANT') {
    const profile = await prisma.assistantProfile.findUnique({ where: { userId: req.userId } });
    if (!profile) {
      res.json({ data: [], pagination: { page, limit, total: 0, totalPages: 0 } });
      return;
    }
    scopeWhere = { assistantId: profile.id };
  } else if (req.userRole === 'CLINIC') {
    const clinicProfile = await prisma.clinicProfile.findUnique({ where: { userId: req.userId } });
    if (!clinicProfile) {
      res.json({ data: [], pagination: { page, limit, total: 0, totalPages: 0 } });
      return;
    }
    scopeWhere = { job: { clinicId: clinicProfile.id } };
  }

  const where: WhereClause = {
    ...scopeWhere,
    ...(q.jobId  && { jobId:  q.jobId }),
    ...(q.status && { status: q.status }),
  };

  const [data, total] = await Promise.all([
    prisma.match.findMany({
      where,
      include: {
        job: {
          select: {
            id: true, type: true, shiftStart: true, shiftEnd: true,
            clinic: { select: { companyName: true } },
          },
        },
        assistant: { select: { id: true, tier: true, user: { select: { email: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      skip:  (page - 1) * limit,
      take:  limit,
    }),
    prisma.match.count({ where }),
  ]);

  res.json({ data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
});

// ── GET /api/matches/:matchId — single match detail ──────────────────────────

router.get('/:matchId', requireAuth, async (req: AuthRequest, res: Response) => {
  const { matchId } = req.params as Record<string, string>;

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      job: {
        include: {
          location: true,
          clinic: { select: { id: true, companyName: true, userId: true } },
        },
      },
      assistant: {
        include: { user: { select: { id: true, email: true } } },
      },
      reviews: true,
    },
  });
  if (!match) {
    res.status(404).json({ error: 'Match not found' });
    return;
  }

  const isClinic    = req.userRole === 'ADMIN' || match.job.clinic.userId === req.userId;
  const isAssistant = match.assistant.user.id === req.userId;
  if (!isClinic && !isAssistant) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  res.json(match);
});

// ── PATCH /api/matches/:matchId/status — advance the match state machine ──────
//
// Allowed transitions:
//   PENDING    → ACCEPTED   (clinic)
//   PENDING    → DECLINED   (clinic)
//   PENDING    → CANCELLED  (either)
//   ACCEPTED   → CLOCKED_IN (assistant, TEMP only)
//   ACCEPTED   → PLACED     (clinic, PERMANENT only)
//   ACCEPTED   → CANCELLED  (either)
//   CLOCKED_IN → CLOCKED_OUT (assistant, TEMP only)
//   CLOCKED_OUT → PLACED    (clinic, TEMP only)

router.patch('/:matchId/status', requireAuth, async (req: AuthRequest, res: Response) => {
  const { matchId } = req.params as Record<string, string>;
  const { status: to } = req.body as { status?: string };

  if (!to) {
    res.status(400).json({ error: 'status is required' });
    return;
  }

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      job: { include: { clinic: { select: { userId: true } } } },
      assistant: { select: { userId: true } },
    },
  });
  if (!match) {
    res.status(404).json({ error: 'Match not found' });
    return;
  }

  const isClinic    = req.userRole === 'ADMIN' || match.job.clinic.userId === req.userId;
  const isAssistant = match.assistant.userId === req.userId;
  if (!isClinic && !isAssistant) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  const from    = match.status as MatchStatus;
  const jobType = match.job.type;

  type Actor = 'clinic' | 'assistant' | 'either';
  const TRANSITIONS: Record<string, { actor: Actor; validFrom: MatchStatus[] }> = {
    ACCEPTED:    { actor: 'clinic',     validFrom: ['PENDING'] },
    DECLINED:    { actor: 'clinic',     validFrom: ['PENDING'] },
    CLOCKED_IN:  { actor: 'assistant',  validFrom: ['ACCEPTED'] },
    CLOCKED_OUT: { actor: 'assistant',  validFrom: ['CLOCKED_IN'] },
    PLACED:      { actor: 'clinic',     validFrom: ['CLOCKED_OUT', 'ACCEPTED'] },
    CANCELLED:   { actor: 'either',     validFrom: ['PENDING', 'ACCEPTED'] },
  };

  const rule = TRANSITIONS[to];
  if (!rule) {
    res.status(400).json({ error: `Invalid target status: ${to}` });
    return;
  }

  if (rule.actor === 'clinic' && !isClinic) {
    res.status(403).json({ error: 'Only the clinic can perform this action' });
    return;
  }
  if (rule.actor === 'assistant' && !isAssistant) {
    res.status(403).json({ error: 'Only the assistant can perform this action' });
    return;
  }

  if (!rule.validFrom.includes(from)) {
    res.status(400).json({ error: `Cannot transition from ${from} to ${to}` });
    return;
  }

  // Job-type guards
  if ((to === 'CLOCKED_IN' || to === 'CLOCKED_OUT') && jobType !== 'TEMP') {
    res.status(400).json({ error: `${to} is only valid for TEMP jobs` });
    return;
  }
  if (to === 'PLACED' && from === 'CLOCKED_OUT' && jobType !== 'TEMP') {
    res.status(400).json({ error: 'CLOCKED_OUT → PLACED is only for TEMP jobs' });
    return;
  }
  if (to === 'PLACED' && from === 'ACCEPTED' && jobType !== 'PERMANENT') {
    res.status(400).json({ error: 'ACCEPTED → PLACED is only for PERMANENT jobs' });
    return;
  }

  const now = new Date();
  const updateData: Record<string, unknown> = { status: to };
  if (to === 'CLOCKED_IN')  updateData.clockedInAt  = now;
  if (to === 'CLOCKED_OUT') updateData.clockedOutAt = now;
  if (to === 'PLACED')      updateData.placedAt     = now;

  const updated = await prisma.match.update({
    where: { id: matchId },
    data: updateData,
    include: {
      job: { select: { id: true, type: true } },
      assistant: { select: { id: true, tier: true } },
    },
  });
  res.json(updated);
});

// ── DELETE /api/matches/:matchId — assistant withdraws a PENDING bid ──────────

router.delete('/:matchId', requireAuth, async (req: AuthRequest, res: Response) => {
  const { matchId } = req.params as Record<string, string>;

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { assistant: { select: { userId: true } } },
  });
  if (!match) {
    res.status(404).json({ error: 'Match not found' });
    return;
  }

  const isAssistant = match.assistant.userId === req.userId;
  if (!isAssistant && req.userRole !== 'ADMIN') {
    res.status(403).json({ error: 'Only the assistant can withdraw their bid' });
    return;
  }
  if (match.status !== 'PENDING') {
    res.status(400).json({ error: `Cannot withdraw a bid with status: ${match.status}` });
    return;
  }

  await prisma.match.delete({ where: { id: matchId } });
  res.status(204).send();
});

export default router;
