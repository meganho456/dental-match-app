import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

// ── POST /api/reviews — submit a review after a completed match ───────────────
// Both parties (assistant and clinic) can each leave one review per match.
// The match must be in PLACED or CLOCKED_OUT status.

router.post('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const { matchId, rating, comment } = req.body as {
    matchId?: string;
    rating?: number;
    comment?: string;
  };

  if (!matchId) {
    res.status(400).json({ error: 'matchId is required' });
    return;
  }
  if (rating === undefined) {
    res.status(400).json({ error: 'rating is required' });
    return;
  }
  const ratingNum = Number(rating);
  if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
    res.status(400).json({ error: 'rating must be an integer between 1 and 5' });
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

  const isClinic    = match.job.clinic.userId === req.userId;
  const isAssistant = match.assistant.userId  === req.userId;
  if (!isClinic && !isAssistant && req.userRole !== 'ADMIN') {
    res.status(403).json({ error: 'You are not a participant in this match' });
    return;
  }

  if (match.status !== 'PLACED' && match.status !== 'CLOCKED_OUT') {
    res.status(400).json({
      error: 'Reviews can only be submitted after a match reaches PLACED or CLOCKED_OUT',
    });
    return;
  }

  // Determine author and target based on who is calling
  // Clinic reviews the assistant; assistant reviews the clinic's user
  let authorId: string;
  let targetId: string;

  if (isClinic) {
    authorId = req.userId!;
    targetId = match.assistant.userId;
  } else {
    authorId = req.userId!;
    targetId = match.job.clinic.userId;
  }

  // One review per direction per match (@@unique[matchId, authorId] in schema)
  const existing = await prisma.review.findUnique({
    where: { matchId_authorId: { matchId, authorId } },
  });
  if (existing) {
    res.status(409).json({ error: 'You have already submitted a review for this match' });
    return;
  }

  const review = await prisma.review.create({
    data: {
      matchId,
      authorId,
      targetId,
      rating: ratingNum,
      comment: comment ?? null,
    },
    include: {
      author: { select: { id: true, email: true, role: true } },
      target: { select: { id: true, email: true, role: true } },
    },
  });
  res.status(201).json(review);
});

// ── GET /api/reviews/user/:userId — all reviews written ABOUT a user ──────────

router.get('/user/:userId', async (req: Request, res: Response) => {
  const { userId } = req.params as Record<string, string>;
  const q = req.query as Record<string, string | undefined>;
  const page  = Math.max(1, parseInt(q.page  ?? '1',  10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(q.limit ?? '20', 10) || 20));

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const where = { targetId: userId };

  const [data, total] = await Promise.all([
    prisma.review.findMany({
      where,
      include: {
        author: { select: { id: true, email: true, role: true } },
        match: { select: { id: true, job: { select: { type: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      skip:  (page - 1) * limit,
      take:  limit,
    }),
    prisma.review.count({ where }),
  ]);

  const avgRating =
    total > 0
      ? data.reduce((sum, r) => sum + r.rating, 0) / data.length
      : null;

  res.json({ data, avgRating, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
});

// ── GET /api/reviews/:reviewId — single review ────────────────────────────────

router.get('/:reviewId', async (req: Request, res: Response) => {
  const { reviewId } = req.params as Record<string, string>;

  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    include: {
      author: { select: { id: true, email: true, role: true } },
      target: { select: { id: true, email: true, role: true } },
      match:  { select: { id: true, jobId: true } },
    },
  });
  if (!review) {
    res.status(404).json({ error: 'Review not found' });
    return;
  }
  res.json(review);
});

export default router;
