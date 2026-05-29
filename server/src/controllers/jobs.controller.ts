import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { VALID_TIERS, VALID_SOFTWARE } from '../lib/validators';

// ── Internal validation helpers ───────────────────────────────────────────────

type Ok<T> = { ok: true; value: T };
type Err = { ok: false; error: string };

function ok<T>(value: T): Ok<T> { return { ok: true, value }; }
function err(error: string): Err { return { ok: false, error }; }

function parsePositiveDecimal(raw: unknown, field: string): Ok<number> | Err {
  const n = Number(raw);
  if (!isFinite(n) || n <= 0) return err(`${field} must be a positive number`);
  return ok(n);
}

function parsePositiveInt(raw: unknown, field: string): Ok<number> | Err {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) return err(`${field} must be a positive integer`);
  return ok(n);
}

// ── TEMP shift validation ─────────────────────────────────────────────────────

const MIN_NOTICE_MS = 30 * 60 * 1000;  // clinic must post ≥ 30 min before shift
const MAX_SHIFT_HOURS = 16;

function validateTempShift(
  rawStart: unknown,
  rawEnd: unknown,
): Ok<{ shiftStart: Date; shiftEnd: Date }> | Err {
  if (!rawStart || !rawEnd) {
    return err('shiftStart and shiftEnd are required for TEMP jobs');
  }

  const shiftStart = new Date(rawStart as string);
  const shiftEnd   = new Date(rawEnd as string);

  if (isNaN(shiftStart.getTime())) return err('shiftStart is not a valid ISO date-time');
  if (isNaN(shiftEnd.getTime()))   return err('shiftEnd is not a valid ISO date-time');

  if (shiftStart.getTime() < Date.now() + MIN_NOTICE_MS) {
    return err('shiftStart must be at least 30 minutes in the future');
  }
  if (shiftEnd <= shiftStart) {
    return err('shiftEnd must be after shiftStart');
  }
  const durationHours = (shiftEnd.getTime() - shiftStart.getTime()) / 3_600_000;
  if (durationHours > MAX_SHIFT_HOURS) {
    return err(`Shift duration cannot exceed ${MAX_SHIFT_HOURS} hours`);
  }

  return ok({ shiftStart, shiftEnd });
}

// ── Type aliases (keeps Prisma enum casts readable) ──────────────────────────

type JobType    = 'TEMP' | 'PERMANENT';
type JobStatus  = 'OPEN' | 'FILLED' | 'CANCELLED' | 'EXPIRED';
type Tier       = (typeof VALID_TIERS)[number];
type Software   = (typeof VALID_SOFTWARE)[number];

const JOB_STATUSES: JobStatus[] = ['OPEN', 'FILLED', 'CANCELLED', 'EXPIRED'];

// ── Controllers ───────────────────────────────────────────────────────────────

/**
 * GET /api/jobs
 * Public. Supports query params: type, status, date (YYYY-MM-DD), city,
 * requiredTier, page, limit.
 */
export async function listJobs(req: Request, res: Response): Promise<void> {
  const q = req.query as Record<string, string | undefined>;
  const { type, date, city, requiredTier, clinicId } = q;
  // status=ALL skips the status filter (useful for clinic seeing all their own jobs)
  const rawStatus = q.status ?? 'OPEN';
  const statusFilter = rawStatus !== 'ALL' ? (rawStatus as JobStatus) : undefined;
  const page  = Math.max(1, parseInt(q.page  ?? '1',  10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(q.limit ?? '20', 10) || 20));

  // ── Validate filters ─────────────────────────────────────────────────────
  if (type && type !== 'TEMP' && type !== 'PERMANENT') {
    res.status(400).json({ error: 'type must be TEMP or PERMANENT' });
    return;
  }
  if (statusFilter && !JOB_STATUSES.includes(statusFilter)) {
    res.status(400).json({ error: `status must be one of: ${JOB_STATUSES.join(', ')} or ALL` });
    return;
  }
  if (requiredTier && !(VALID_TIERS as readonly string[]).includes(requiredTier)) {
    res.status(400).json({ error: `requiredTier must be one of: ${VALID_TIERS.join(', ')}` });
    return;
  }

  let shiftDateFilter: { gte: Date; lt: Date } | undefined;
  if (date) {
    const d = new Date(date);
    if (isNaN(d.getTime())) {
      res.status(400).json({ error: 'date must be a valid date (YYYY-MM-DD)' });
      return;
    }
    const next = new Date(d);
    next.setUTCDate(next.getUTCDate() + 1);
    shiftDateFilter = { gte: d, lt: next };
  }

  // ── Query ────────────────────────────────────────────────────────────────
  const where = {
    ...(statusFilter      && { status: statusFilter }),
    ...(type              && { type: type as JobType }),
    ...(shiftDateFilter   && { shiftStart: shiftDateFilter }),
    ...(city              && { location: { city: { contains: city, mode: 'insensitive' as const } } }),
    ...(requiredTier      && { requiredTier: requiredTier as Tier }),
    ...(clinicId          && { clinicId }),
  };

  const [data, total] = await Promise.all([
    prisma.jobPosting.findMany({
      where,
      include: {
        location: { select: { id: true, name: true, street: true, city: true, state: true, postal: true, country: true } },
        clinic:   { select: { id: true, companyName: true } },
        _count:   { select: { matches: true } },
      },
      orderBy: type === 'TEMP' ? { shiftStart: 'asc' } : { createdAt: 'desc' },
      skip:  (page - 1) * limit,
      take:  limit,
    }),
    prisma.jobPosting.count({ where }),
  ]);

  res.json({ data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
}

/**
 * POST /api/jobs
 * CLINIC only. Validates and creates either a TEMP or PERMANENT posting.
 */
export async function createJob(req: AuthRequest, res: Response): Promise<void> {
  // Resolve the clinic profile from the token owner
  const clinicProfile = await prisma.clinicProfile.findUnique({
    where: { userId: req.userId },
    include: { locations: { select: { id: true } } },
  });
  if (!clinicProfile) {
    res.status(400).json({ error: 'Create a clinic profile before posting jobs' });
    return;
  }

  const {
    type, locationId, slots,
    requiredTier, requiredSoftware, description,
    shiftStart, shiftEnd, hourlyRate,
  } = req.body as {
    type?: string;
    locationId?: string;
    slots?: number;
    requiredTier?: string;
    requiredSoftware?: string[];
    description?: string;
    shiftStart?: string;
    shiftEnd?: string;
    hourlyRate?: number;
  };

  // ── Common validation ─────────────────────────────────────────────────────
  if (!type || (type !== 'TEMP' && type !== 'PERMANENT')) {
    res.status(400).json({ error: 'type must be TEMP or PERMANENT' });
    return;
  }
  if (!locationId) {
    res.status(400).json({ error: 'locationId is required' });
    return;
  }
  if (!clinicProfile.locations.some((l) => l.id === locationId)) {
    res.status(400).json({ error: 'locationId does not belong to your clinic' });
    return;
  }

  let slotsVal = 1;
  if (slots !== undefined) {
    const r = parsePositiveInt(slots, 'slots');
    if (!r.ok) { res.status(400).json({ error: r.error }); return; }
    slotsVal = r.value;
  }

  if (requiredTier !== undefined && !(VALID_TIERS as readonly string[]).includes(requiredTier)) {
    res.status(400).json({ error: `requiredTier must be one of: ${VALID_TIERS.join(', ')}` });
    return;
  }
  if (requiredSoftware !== undefined) {
    const invalid = requiredSoftware.filter((s) => !(VALID_SOFTWARE as readonly string[]).includes(s));
    if (invalid.length) {
      res.status(400).json({ error: `invalid requiredSoftware value(s): ${invalid.join(', ')}` });
      return;
    }
  }

  const commonData = {
    clinicId:        clinicProfile.id,
    locationId,
    status:          'OPEN' as JobStatus,
    slots:           slotsVal,
    requiredTier:    (requiredTier ?? null) as Tier | null,
    requiredSoftware: (requiredSoftware ?? []) as Software[],
    description:     description ?? null,
  };

  // ── TEMP branch ───────────────────────────────────────────────────────────
  if (type === 'TEMP') {
    const shiftResult = validateTempShift(shiftStart, shiftEnd);
    if (!shiftResult.ok) { res.status(400).json({ error: shiftResult.error }); return; }

    if (hourlyRate === undefined) {
      res.status(400).json({ error: 'hourlyRate is required for TEMP jobs' });
      return;
    }
    const rateResult = parsePositiveDecimal(hourlyRate, 'hourlyRate');
    if (!rateResult.ok) { res.status(400).json({ error: rateResult.error }); return; }

    const job = await prisma.jobPosting.create({
      data: {
        ...commonData,
        type:       'TEMP',
        hourlyRate: rateResult.value,
        salary:     null,
        shiftStart: shiftResult.value.shiftStart,
        shiftEnd:   shiftResult.value.shiftEnd,
      },
      include: {
        location: true,
        clinic:   { select: { companyName: true } },
      },
    });
    res.status(201).json(job);
    return;
  }

  // ── PERMANENT branch ──────────────────────────────────────────────────────
  if (hourlyRate === undefined) {
    res.status(400).json({ error: 'hourlyRate is required for PERMANENT jobs' });
    return;
  }
  const permRateResult = parsePositiveDecimal(hourlyRate, 'hourlyRate');
  if (!permRateResult.ok) { res.status(400).json({ error: permRateResult.error }); return; }

  const job = await prisma.jobPosting.create({
    data: {
      ...commonData,
      type:       'PERMANENT',
      hourlyRate: permRateResult.value,
      salary:     null,
      shiftStart: null,
      shiftEnd:   null,
    },
    include: {
      location: true,
      clinic:   { select: { companyName: true } },
    },
  });
  res.status(201).json(job);
}

/**
 * GET /api/jobs/:jobId
 * Public. Returns full posting detail with clinic profile and match count.
 */
export async function getJob(req: Request, res: Response): Promise<void> {
  const { jobId } = req.params as Record<string, string>;

  const job = await prisma.jobPosting.findUnique({
    where: { id: jobId },
    include: {
      location: true,
      clinic: {
        select: {
          id: true, companyName: true, phone: true, website: true,
          user: { select: { id: true, email: true } },
        },
      },
      _count: { select: { matches: true } },
    },
  });
  if (!job) {
    res.status(404).json({ error: 'Job posting not found' });
    return;
  }
  res.json(job);
}

/**
 * PUT /api/jobs/:jobId
 * Clinic owner or ADMIN. Allows updating mutable fields. Type cannot change.
 */
export async function updateJob(req: AuthRequest, res: Response): Promise<void> {
  const { jobId } = req.params as Record<string, string>;

  const job = await prisma.jobPosting.findUnique({
    where: { id: jobId },
    include: { clinic: { select: { userId: true } } },
  });
  if (!job) { res.status(404).json({ error: 'Job posting not found' }); return; }

  if (job.clinic.userId !== req.userId && req.userRole !== 'ADMIN') {
    res.status(403).json({ error: 'You can only update your own job postings' });
    return;
  }
  if (job.status === 'CANCELLED') {
    res.status(400).json({ error: 'Cannot update a cancelled posting' });
    return;
  }

  const { status, description, slots, hourlyRate, requiredTier, requiredSoftware } =
    req.body as {
      status?: string;
      description?: string;
      slots?: number;
      hourlyRate?: number;
      requiredTier?: string | null;
      requiredSoftware?: string[];
    };

  if (status !== undefined && !JOB_STATUSES.includes(status as JobStatus)) {
    res.status(400).json({ error: `status must be one of: ${JOB_STATUSES.join(', ')}` });
    return;
  }
  if (slots !== undefined) {
    const r = parsePositiveInt(slots, 'slots');
    if (!r.ok) { res.status(400).json({ error: r.error }); return; }
  }
  if (requiredTier !== undefined && requiredTier !== null &&
      !(VALID_TIERS as readonly string[]).includes(requiredTier)) {
    res.status(400).json({ error: `requiredTier must be one of: ${VALID_TIERS.join(', ')}` });
    return;
  }
  if (requiredSoftware !== undefined) {
    const invalid = requiredSoftware.filter((s) => !(VALID_SOFTWARE as readonly string[]).includes(s));
    if (invalid.length) {
      res.status(400).json({ error: `invalid requiredSoftware: ${invalid.join(', ')}` });
      return;
    }
  }

  const updated = await prisma.jobPosting.update({
    where: { id: jobId },
    data: {
      ...(status           !== undefined && { status:           status as JobStatus }),
      ...(description      !== undefined && { description }),
      ...(slots            !== undefined && { slots:            Number(slots) }),
      ...(hourlyRate       !== undefined && { hourlyRate:       Number(hourlyRate) }),
      ...(requiredTier     !== undefined && { requiredTier:     requiredTier as Tier | null }),
      ...(requiredSoftware !== undefined && { requiredSoftware: requiredSoftware as Software[] }),
    },
    include: {
      location: true,
      clinic: { select: { companyName: true } },
    },
  });
  res.json(updated);
}

/**
 * DELETE /api/jobs/:jobId
 * Clinic owner or ADMIN. Soft-cancels the posting (status → CANCELLED).
 * Preserves the row and all related matches for audit purposes.
 */
export async function cancelJob(req: AuthRequest, res: Response): Promise<void> {
  const { jobId } = req.params as Record<string, string>;

  const job = await prisma.jobPosting.findUnique({
    where: { id: jobId },
    include: { clinic: { select: { userId: true } } },
  });
  if (!job) { res.status(404).json({ error: 'Job posting not found' }); return; }

  if (job.clinic.userId !== req.userId && req.userRole !== 'ADMIN') {
    res.status(403).json({ error: 'You can only cancel your own job postings' });
    return;
  }
  if (job.status === 'CANCELLED') {
    res.status(400).json({ error: 'Job posting is already cancelled' });
    return;
  }

  await prisma.jobPosting.update({ where: { id: jobId }, data: { status: 'CANCELLED' } });
  res.status(204).send();
}
