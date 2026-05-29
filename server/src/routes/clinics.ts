import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

// ── Helpers ──────────────────────────────────────────────────────────────────

function canEdit(req: AuthRequest, userId: string): boolean {
  return req.userRole === 'ADMIN' || req.userId === userId;
}

const PROFILE_USER_SELECT = { id: true, email: true, role: true, createdAt: true } as const;

// ── Profile routes ────────────────────────────────────────────────────────────

// GET /api/clinics/:userId
router.get('/:userId', async (req: AuthRequest, res: Response) => {
  const { userId } = req.params as Record<string, string>;
  const profile = await prisma.clinicProfile.findUnique({
    where: { userId },
    include: {
      user: { select: PROFILE_USER_SELECT },
      locations: true,
    },
  });
  if (!profile) {
    res.status(404).json({ error: 'Clinic profile not found' });
    return;
  }
  res.json(profile);
});

// PUT /api/clinics/:userId — create (201) or update (200) own profile
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
  if (user.role !== 'CLINIC') {
    res.status(400).json({ error: 'User is not a CLINIC' });
    return;
  }

  const { companyName, phone, website } = req.body as {
    companyName?: string;
    phone?: string | null;
    website?: string | null;
  };

  const existing = await prisma.clinicProfile.findUnique({ where: { userId } });

  if (!existing) {
    // ── CREATE ────────────────────────────────────────────────────────────
    if (!companyName?.trim()) {
      res.status(400).json({ error: 'companyName is required when creating a profile' });
      return;
    }
    const profile = await prisma.clinicProfile.create({
      data: {
        userId,
        companyName: companyName.trim(),
        phone: phone ?? null,
        website: website ?? null,
      },
      include: { user: { select: PROFILE_USER_SELECT }, locations: true },
    });
    res.status(201).json(profile);
    return;
  }

  // ── UPDATE (partial) ──────────────────────────────────────────────────
  if (companyName !== undefined && !companyName.trim()) {
    res.status(400).json({ error: 'companyName cannot be blank' });
    return;
  }
  const profile = await prisma.clinicProfile.update({
    where: { userId },
    data: {
      ...(companyName !== undefined && { companyName: companyName.trim() }),
      ...(phone !== undefined && { phone }),
      ...(website !== undefined && { website }),
    },
    include: { user: { select: PROFILE_USER_SELECT }, locations: true },
  });
  res.json(profile);
});

// ── Location routes ───────────────────────────────────────────────────────────

// GET /api/clinics/:userId/locations
router.get('/:userId/locations', async (req: AuthRequest, res: Response) => {
  const { userId } = req.params as Record<string, string>;
  const profile = await prisma.clinicProfile.findUnique({
    where: { userId },
    include: { locations: true },
  });
  if (!profile) {
    res.status(404).json({ error: 'Clinic profile not found' });
    return;
  }
  res.json({ locations: profile.locations });
});

// POST /api/clinics/:userId/locations
router.post('/:userId/locations', requireAuth, async (req: AuthRequest, res: Response) => {
  const { userId } = req.params as Record<string, string>;

  if (!canEdit(req, userId)) {
    res.status(403).json({ error: 'You can only add locations to your own clinic' });
    return;
  }

  const profile = await prisma.clinicProfile.findUnique({ where: { userId } });
  if (!profile) {
    res.status(404).json({ error: 'Clinic profile not found. Create the clinic profile first.' });
    return;
  }

  const { name, country, street, city, state, postal, lat, lng } = req.body as {
    name?: string;
    country?: string;
    street?: string;
    city?: string;
    state?: string;
    postal?: string;
    lat?: number;
    lng?: number;
  };

  const countryCode = (country ?? 'US').trim().toUpperCase();
  if (!street?.trim() || !postal?.trim()) {
    res.status(400).json({ error: 'street and postal code are required' });
    return;
  }
  if (countryCode === 'US' && (!city?.trim() || !state?.trim())) {
    res.status(400).json({ error: 'city and state are required for US addresses' });
    return;
  }

  const location = await prisma.clinicLocation.create({
    data: {
      clinicId: profile.id,
      name:    name?.trim() ?? null,
      country: countryCode,
      street:  street.trim(),
      city:    city?.trim() ?? null,
      state:   state?.trim().toUpperCase() ?? null,
      postal:  postal.trim(),
      lat:     lat != null ? Number(lat) : null,
      lng:     lng != null ? Number(lng) : null,
    },
  });
  res.status(201).json(location);
});

// PATCH /api/clinics/:userId/locations/:locationId — update address fields or lat/lng
router.patch(
  '/:userId/locations/:locationId',
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const { userId, locationId } = req.params as Record<string, string>;

    if (!canEdit(req, userId)) {
      res.status(403).json({ error: 'You can only update locations for your own clinic' });
      return;
    }

    const profile = await prisma.clinicProfile.findUnique({ where: { userId } });
    if (!profile) {
      res.status(404).json({ error: 'Clinic profile not found' });
      return;
    }

    const location = await prisma.clinicLocation.findUnique({ where: { id: locationId } });
    if (!location) {
      res.status(404).json({ error: 'Location not found' });
      return;
    }
    if (location.clinicId !== profile.id) {
      res.status(403).json({ error: 'Location does not belong to this clinic' });
      return;
    }

    const { name, country, street, city, state, postal, lat, lng } = req.body as {
      name?: string | null;
      country?: string;
      street?: string;
      city?: string | null;
      state?: string | null;
      postal?: string;
      lat?: number | null;
      lng?: number | null;
    };

    const updated = await prisma.clinicLocation.update({
      where: { id: locationId },
      data: {
        ...(name    !== undefined && { name:    name?.trim() ?? null }),
        ...(country !== undefined && { country: country.trim().toUpperCase() }),
        ...(street  !== undefined && { street:  street.trim() }),
        ...(city    !== undefined && { city:    city?.trim() ?? null }),
        ...(state   !== undefined && { state:   state?.trim().toUpperCase() ?? null }),
        ...(postal  !== undefined && { postal:  postal.trim() }),
        ...(lat     !== undefined && { lat:     lat != null ? Number(lat) : null }),
        ...(lng     !== undefined && { lng:     lng != null ? Number(lng) : null }),
      },
    });
    res.json(updated);
  },
);

// DELETE /api/clinics/:userId/locations/:locationId
router.delete(
  '/:userId/locations/:locationId',
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const { userId, locationId } = req.params as Record<string, string>;

    if (!canEdit(req, userId)) {
      res.status(403).json({ error: 'You can only remove locations from your own clinic' });
      return;
    }

    const profile = await prisma.clinicProfile.findUnique({ where: { userId } });
    if (!profile) {
      res.status(404).json({ error: 'Clinic profile not found' });
      return;
    }

    const location = await prisma.clinicLocation.findUnique({ where: { id: locationId } });
    if (!location) {
      res.status(404).json({ error: 'Location not found' });
      return;
    }
    if (location.clinicId !== profile.id) {
      res.status(403).json({ error: 'Location does not belong to this clinic' });
      return;
    }

    await prisma.clinicLocation.delete({ where: { id: locationId } });
    res.status(204).send();
  },
);

export default router;
