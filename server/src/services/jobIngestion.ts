/**
 * Job ingestion pipeline for external listings.
 *
 * Usage:
 *   npx ts-node -r dotenv/config src/services/jobIngestion.ts
 *   npm run ingest
 *
 * The service is idempotent: re-running never creates duplicates — each
 * listing is keyed by its `sourceUrl`, which maps to the `originalUrl`
 * unique constraint on `JobPosting`.
 */

import 'dotenv/config';
import { prisma } from '../lib/prisma';

// ── External data shape (mirrors what a scraper / Apify actor returns) ────────

export interface ExternalJobListing {
  jobTitle:    string;
  companyName: string;
  location:    string;   // "San Francisco, CA"
  salaryText:  string;   // "$25–$32/hr", "$52,000/yr", "Competitive"
  description: string;
  sourceUrl:   string;   // unique identifier used for deduplication
  source:      string;   // 'Indeed' | 'LinkedIn' | 'ZipRecruiter' …
  jobType?:    'TEMP' | 'PERMANENT';
}

export interface IngestionResult {
  inserted: number;
  skipped:  number;
  failed:   number;
  errors:   string[];
}

// ── Parsing helpers ───────────────────────────────────────────────────────────

function parseHourlyRate(text: string): number | null {
  const t = text.replace(/,/g, '');

  // "$25/hr", "$25–$32/hr", "$25.50 per hour", "$20-25 hourly"
  const hrMatch = t.match(/\$?([\d.]+)\s*(?:[-–]\s*\$?[\d.]+)?\s*(?:\/hr|per hour|hourly)/i);
  if (hrMatch) return parseFloat(hrMatch[1]);

  // "$52,000/yr", "$52k/yr", "$45,000 a year", "$40k–$50k per year"
  const yrMatch = t.match(/\$?([\d.]+)([kK])?\s*(?:[-–]\s*\$?[\d.]+[kK]?)?\s*(?:\/yr|per year|annually|a year)/i);
  if (yrMatch) {
    let annual = parseFloat(yrMatch[1]);
    if (yrMatch[2]) annual *= 1000;
    return parseFloat((annual / 2080).toFixed(2));
  }

  // Bare number: treat > 500 as annual salary, ≤ 500 as hourly
  const bare = t.match(/\$?([\d.]+)/);
  if (bare) {
    const val = parseFloat(bare[1]);
    return val > 500 ? parseFloat((val / 2080).toFixed(2)) : val;
  }

  return null;
}

function parseLocation(raw: string): { city: string | null; state: string | null } {
  const parts = raw.split(',').map((s) => s.trim());
  return {
    city:  parts[0] || null,
    state: parts[1]?.split(' ')[0] || null,
  };
}

const SOFTWARE_KEYWORDS: [string, string][] = [
  ['open dental', 'OPEN_DENTAL'],
  ['dentrix',     'DENTRIX'],
  ['eaglesoft',   'EAGLESOFT'],
  ['curve dental','CURVE_DENTAL'],
  ['carestream',  'CARESTREAM'],
];

function extractSoftware(description: string): string[] {
  const lower = description.toLowerCase();
  const found = new Set<string>();
  for (const [kw, val] of SOFTWARE_KEYWORDS) {
    if (lower.includes(kw)) found.add(val);
  }
  return Array.from(found);
}

function inferTier(jobTitle: string): 'RDA' | 'DA' | null {
  if (/\bRDA\b/.test(jobTitle) || /registered/i.test(jobTitle)) return 'RDA';
  if (/\bDA\b/i.test(jobTitle) || /dental assistant/i.test(jobTitle)) return 'DA';
  return null;
}

// TEMP jobs from external sources often lack exact shift times.
// We generate a placeholder shift one week out so the record passes schema
// constraints and appears in the deck immediately.
function placeholderShift(): { shiftStart: Date; shiftEnd: Date } {
  const start = new Date();
  start.setDate(start.getDate() + 7);
  start.setHours(9, 0, 0, 0);
  const end = new Date(start);
  end.setHours(17, 0, 0, 0);
  return { shiftStart: start, shiftEnd: end };
}

// ── Placeholder clinic resolution ─────────────────────────────────────────────
//
// External jobs don't map to real ClinicProfile rows.  We create one
// placeholder User + ClinicProfile per unique company name, keyed by a
// deterministic email so re-runs never create duplicates.

async function getOrCreateExternalClinic(
  companyName: string,
  city: string | null,
  state: string | null,
): Promise<{ clinicId: string; locationId: string }> {
  const slug  = companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  const email = `ext-${slug}@scraped.dentalwatch.local`;

  let user = await prisma.user.findUnique({ where: { email } });
  let clinicId: string;

  if (!user) {
    user = await prisma.user.create({
      data: { email, passwordHash: '$EXTERNAL_ACCOUNT_NO_LOGIN', role: 'CLINIC' },
    });
    const clinic = await prisma.clinicProfile.create({
      data: { userId: user.id, companyName },
    });
    clinicId = clinic.id;
  } else {
    const clinic = await prisma.clinicProfile.findUnique({ where: { userId: user.id } });
    if (!clinic) throw new Error(`Orphaned external user ${email} has no clinic profile`);
    clinicId = clinic.id;
  }

  // Find or create a matching location within this clinic
  const locations = await prisma.clinicLocation.findMany({ where: { clinicId } });
  let location = locations.find((l) => l.city === city && l.state === state);

  if (!location) {
    location = await prisma.clinicLocation.create({
      data: {
        clinicId,
        street:  '(External listing — address not published)',
        city,
        state,
        postal:  '00000',
        country: 'US',
      },
    });
  }

  return { clinicId, locationId: location.id };
}

// ── Main ingestion function ───────────────────────────────────────────────────

export async function ingestExternalJobs(
  listings: ExternalJobListing[],
): Promise<IngestionResult> {
  const result: IngestionResult = { inserted: 0, skipped: 0, failed: 0, errors: [] };

  for (const listing of listings) {
    try {
      // ── Deduplication: skip if this URL is already in the DB ──────────────
      const exists = await prisma.jobPosting.findUnique({
        where: { originalUrl: listing.sourceUrl },
        select: { id: true },
      });
      if (exists) { result.skipped++; continue; }

      // ── Parse and normalise fields ────────────────────────────────────────
      const hourlyRate = parseHourlyRate(listing.salaryText);
      if (!hourlyRate) {
        result.failed++;
        result.errors.push(`[${listing.sourceUrl}] Could not parse salary: "${listing.salaryText}"`);
        continue;
      }

      const { city, state }       = parseLocation(listing.location);
      const software               = extractSoftware(listing.description);
      const requiredTier           = inferTier(listing.jobTitle);
      const type: 'TEMP'|'PERMANENT' = listing.jobType ?? 'PERMANENT';
      const shift                  = type === 'TEMP' ? placeholderShift() : {};

      // ── Resolve placeholder clinic / location ─────────────────────────────
      const { clinicId, locationId } = await getOrCreateExternalClinic(
        listing.companyName, city, state,
      );

      // ── Insert ────────────────────────────────────────────────────────────
      await prisma.jobPosting.create({
        data: {
          clinicId,
          locationId,
          type,
          status:          'OPEN',
          slots:           1,
          hourlyRate,
          requiredTier:    requiredTier as 'RDA' | 'DA' | null,
          requiredSoftware: software as any[],
          description:     listing.description,
          isExternal:      true,
          externalSource:  listing.source,
          originalUrl:     listing.sourceUrl,
          ...shift,
        },
      });

      result.inserted++;
      console.log(`  ✓ Inserted: ${listing.companyName} — ${listing.jobTitle} (${listing.location})`);
    } catch (err: any) {
      result.failed++;
      result.errors.push(`[${listing.sourceUrl}] ${err.message}`);
      console.error(`  ✗ Failed: ${listing.sourceUrl} — ${err.message}`);
    }
  }

  return result;
}

// ── Mock external listings (simulates Apify / Bright Data scraper output) ────

export const MOCK_EXTERNAL_LISTINGS: ExternalJobListing[] = [
  {
    jobTitle:    'Registered Dental Assistant – Temp Coverage',
    companyName: 'Bright Smiles Dental Group',
    location:    'Los Angeles, CA',
    salaryText:  '$25–$32/hr',
    description: 'Busy multi-specialty group practice seeking an experienced RDA for temp coverage shifts. Proficiency in Dentrix required. Duties include chair-side assisting, X-rays, sterilization, and patient communication. Must hold valid CA RDA license.',
    sourceUrl:   'https://www.indeed.com/viewjob?jk=ext-mock-001',
    source:      'Indeed',
    jobType:     'TEMP',
  },
  {
    jobTitle:    'Dental Assistant – Full-Time Permanent',
    companyName: 'Pacific Coast Family Dentistry',
    location:    'San Francisco, CA',
    salaryText:  '$23/hr',
    description: 'Growing family practice in the Mission District hiring a full-time dental assistant. We use Open Dental and are looking for someone with 1+ year of chair-side experience. Benefits include health insurance, 401k, and paid PTO.',
    sourceUrl:   'https://www.linkedin.com/jobs/view/ext-mock-002',
    source:      'LinkedIn',
    jobType:     'PERMANENT',
  },
  {
    jobTitle:    'RDA Needed – Weekend Temp Shift',
    companyName: 'Emerald City Orthodontics',
    location:    'Seattle, WA',
    salaryText:  '$28/hr',
    description: 'Orthodontic office seeks licensed RDA for Saturday coverage. Eaglesoft knowledge preferred but not required. Experience with brackets and wire adjustments a plus. Flexible scheduling available.',
    sourceUrl:   'https://www.ziprecruiter.com/jobs/ext-mock-003',
    source:      'ZipRecruiter',
    jobType:     'TEMP',
  },
  {
    jobTitle:    'Dental Assistant – Entry Level',
    companyName: 'Desert Sun Dental Care',
    location:    'Phoenix, AZ',
    salaryText:  '$20–$24/hr',
    description: 'We welcome new graduates! Desert Sun Dental Care is a modern practice that mentors junior dental assistants into skilled professionals. Training provided on our software. Friendly team environment, consistent hours Mon–Fri.',
    sourceUrl:   'https://www.indeed.com/viewjob?jk=ext-mock-004',
    source:      'Indeed',
    jobType:     'PERMANENT',
  },
  {
    jobTitle:    'Registered Dental Assistant – Per Diem',
    companyName: 'Shoreline Dental Partners',
    location:    'San Diego, CA',
    salaryText:  '$30/hr',
    description: 'Per-diem RDA needed for a coastal multi-site practice. Must be comfortable with Curve Dental. Shifts vary — morning and afternoon blocks available throughout the month. Reliable transportation required.',
    sourceUrl:   'https://www.indeed.com/viewjob?jk=ext-mock-005',
    source:      'Indeed',
    jobType:     'TEMP',
  },
  {
    jobTitle:    'Dental Assistant – Permanent Position',
    companyName: 'Rose City Dental Studio',
    location:    'Portland, OR',
    salaryText:  '$22/hr',
    description: 'Join our award-winning team in Portland! We run Open Dental and focus on restorative and cosmetic dentistry. Looking for an enthusiastic DA ready to grow with us. 4-day work week with competitive pay and benefits.',
    sourceUrl:   'https://www.linkedin.com/jobs/view/ext-mock-006',
    source:      'LinkedIn',
    jobType:     'PERMANENT',
  },
  {
    jobTitle:    'RDA – Temp Shift Cover (Urgent)',
    companyName: 'Lone Star Dental Associates',
    location:    'Austin, TX',
    salaryText:  '$26–$30/hr',
    description: 'Urgent need for a licensed RDA in Austin this week. Dentrix experience required. Duties: chair-side assisting, impressions, X-rays. Friendly team. Must have active TX license. Same-week availability preferred.',
    sourceUrl:   'https://www.indeed.com/viewjob?jk=ext-mock-007',
    source:      'Indeed',
    jobType:     'TEMP',
  },
  {
    jobTitle:    'Dental Assistant – Full-Time',
    companyName: 'Mile High Smiles',
    location:    'Denver, CO',
    salaryText:  '$21/hr',
    description: 'Mile High Smiles is hiring a full-time DA for our growing practice near downtown Denver. No specific software requirement — we will train you. Benefits: health, dental, vision, and quarterly bonuses. Mon–Fri schedule.',
    sourceUrl:   'https://www.ziprecruiter.com/jobs/ext-mock-008',
    source:      'ZipRecruiter',
    jobType:     'PERMANENT',
  },
  {
    jobTitle:    'Registered Dental Assistant – Temp',
    companyName: 'Lakefront Dental Group',
    location:    'Chicago, IL',
    salaryText:  '$24/hr',
    description: 'Chicago practice needs RDA coverage for maternity leave. Duration: 3–4 months. Eaglesoft preferred. Duties include general chair-side assisting, scheduling support, and sterilization compliance. Friendly, established team.',
    sourceUrl:   'https://www.indeed.com/viewjob?jk=ext-mock-009',
    source:      'Indeed',
    jobType:     'TEMP',
  },
  {
    jobTitle:    'Dental Assistant – Permanent, Full-Time',
    companyName: 'Biscayne Bay Dental',
    location:    'Miami, FL',
    salaryText:  '$20–$25/hr',
    description: 'Bilingual (English/Spanish) dental practice in Miami seeking a dependable DA. Dentrix experience is a plus. Fast-paced environment with a loyal patient base. Excellent opportunity for career growth. Benefits included.',
    sourceUrl:   'https://www.linkedin.com/jobs/view/ext-mock-010',
    source:      'LinkedIn',
    jobType:     'PERMANENT',
  },
  {
    jobTitle:    'RDA – Temp Shift, Multi-Location',
    companyName: 'Bayou Dental Partners',
    location:    'Houston, TX',
    salaryText:  '$27/hr',
    description: 'Multi-site group practice in greater Houston area looking for a licensed RDA for per-diem shifts across our locations. Open Dental platform. We value reliability and great patient communication above all else.',
    sourceUrl:   'https://www.indeed.com/viewjob?jk=ext-mock-011',
    source:      'Indeed',
    jobType:     'TEMP',
  },
  {
    jobTitle:    'Dental Assistant – Full-Time Permanent',
    companyName: 'Vegas Bright Dental',
    location:    'Las Vegas, NV',
    salaryText:  '$22–$25/hr',
    description: 'Fast-growing Las Vegas practice using Carestream is hiring a motivated DA. We prioritize patient experience and team culture. Free dental care for employees, 401k matching, and 15 days PTO. Immediate start available.',
    sourceUrl:   'https://www.ziprecruiter.com/jobs/ext-mock-012',
    source:      'ZipRecruiter',
    jobType:     'PERMANENT',
  },
];

// ── CLI entrypoint ────────────────────────────────────────────────────────────

if (require.main === module) {
  console.log(`\n🦷 DentalMatch Job Ingestion Pipeline`);
  console.log(`   Processing ${MOCK_EXTERNAL_LISTINGS.length} external listings…\n`);

  ingestExternalJobs(MOCK_EXTERNAL_LISTINGS)
    .then((result) => {
      console.log('\n── Summary ──────────────────────────────');
      console.log(`  ✓ Inserted : ${result.inserted}`);
      console.log(`  ↷ Skipped  : ${result.skipped}  (already in DB)`);
      console.log(`  ✗ Failed   : ${result.failed}`);
      if (result.errors.length) {
        console.log('\nErrors:');
        result.errors.forEach((e) => console.log(`  • ${e}`));
      }
      console.log('─────────────────────────────────────────\n');
    })
    .catch((err) => {
      console.error('Fatal ingestion error:', err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
